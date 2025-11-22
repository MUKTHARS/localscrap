from flask import Flask, request, jsonify, session, render_template
from flask_login import LoginManager, current_user, login_required
from flask_cors import CORS
from db_models import db, User, SearchHistory, create_tables, insert_sample
from auth_config import Config
from auth_routes import auth_bp, init_oauth
import pandas as pd
import time, random, os, tempfile

# ------------------ SCRAPERS ------------------
from scrapers.amazon_scraper import scrape_amazon
from scrapers.flipkart_scraper import scrape_flipkart
from scrapers.ebay_scraper import scrape_ebay
from scrapers.snapdeal_scraper import scrape_snapdeal
from scrapers.amitretail_scraper import scrape_amitretail
from scrapers.noon_scraper import scrape_noon
from scrapers.sharafdg_scraper import scrape_sharafdg

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for React frontend
CORS(app, supports_credentials=True, origins=["http://localhost:3000"])

# Initialize DB + Login
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

# OAuth Init
init_oauth(app)

# Register Auth Blueprint
app.register_blueprint(auth_bp, url_prefix='/auth')


SCRAPERS = {
    "amazon": scrape_amazon,
    "flipkart": scrape_flipkart,
    "ebay": scrape_ebay,
    "snapdeal": scrape_snapdeal,
    "amitretail": scrape_amitretail,
    "noon": scrape_noon,
    "sharafdg": scrape_sharafdg
}

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

@app.route("/api/user")
@login_required
def get_user():
    return jsonify({
        'id': current_user.id,
        'name': current_user.name,
        'email': current_user.email
    })

@app.route("/api/scrape", methods=["POST"])
@login_required
def scrape_products():
    results = []
    error = None

    try:
        # ----------------- FILE UPLOAD -----------------
        if 'file' in request.files:
            file = request.files['file']
            if file.filename == '':
                return jsonify({"error": "No file selected"}), 400

            # Get Amazon domain from form data (not from file)
            amazon_domain = request.form.get('amazon_country', 'amazon.com').strip().lower()
            if not amazon_domain:
                amazon_domain = "amazon.com"
            
            print(f"🟡 Using Amazon domain for bulk upload: {amazon_domain}")  # Debug log

            # Validate extension
            allowed = ['.csv', '.xlsx', '.xls']
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in allowed:
                return jsonify({"error": "Upload CSV or Excel only"}), 400

            # Save temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
                file.save(temp_file.name)

                df = pd.read_csv(temp_file.name) if ext == ".csv" else pd.read_excel(temp_file.name)

                os.unlink(temp_file.name)

            # Save bulk search history
            bulk = SearchHistory(
                user_id=current_user.id,
                brand="Bulk Upload",
                product=f"{len(df)} products",
                search_type='bulk'
            )
            db.session.add(bulk)
            db.session.commit()

            # Process every row
            for _, row in df.iterrows():
                brand = str(row.get("Brand", "")).strip()
                product = str(row.get("Product", "")).strip()
                site = str(row.get("Website Name", "")).lower().strip()
                oem = str(row.get("OEM Number", "")).strip()
                asin = str(row.get("ASIN Number", "")).strip()
                
                # Use the amazon_domain from form data, not from file
                # Remove this line: amazon_domain = str(row.get("Amazon Domain", "amazon.com")).strip().lower()

                if not brand or not product:
                    continue

                sites_to_scrape = SCRAPERS.keys() if not site else [site]

                for site_name in sites_to_scrape:
                    if site_name not in SCRAPERS:
                        continue

                    scraper = SCRAPERS[site_name]

                    if site_name == "amazon":
                        os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                        print(f"🟡 Scraping Amazon with domain: {amazon_domain}")  # Debug log
                        data = scraper(brand, product)
                    else:
                        data = scraper(brand, product, oem, asin)

                    if "error" in data:
                        error = data["error"]
                    else:
                        for d in data["data"]:
                            d["WEBSITE"] = site_name.capitalize()
                            results.append(d)

                    if site_name == "amazon":
                        time.sleep(random.uniform(10, 25))

        # ----------------- MANUAL JSON INPUT -----------------
        else:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400

            brand = data.get("brand", "").strip()
            product = data.get("product", "").strip()
            website = data.get("website", "").lower().strip()
            oem = data.get("oem_number", "").strip()
            asin = data.get("asin_number", "").strip()
            amazon_domain = data.get("amazon_country", "amazon.com").strip()

            print(f"🟡 Using Amazon domain for manual: {amazon_domain}")  # Debug log

            # Save search history
            if brand and product:
                search = SearchHistory(
                    user_id=current_user.id,
                    brand=brand,
                    product=product,
                    oem_number=oem or None,
                    asin_number=asin or None,
                    website=website or None,
                    search_type='manual'
                )
                db.session.add(search)
                db.session.commit()

            if not brand or not product:
                return jsonify({"error": "Brand and Product required"}), 400

            sites_to_scrape = SCRAPERS.keys() if not website else [website]

            for site in sites_to_scrape:
                if site not in SCRAPERS:
                    continue

                scraper = SCRAPERS[site]

                if site == "amazon":
                    os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                    print(f"🟡 Scraping Amazon with domain: {amazon_domain}")  # Debug log
                    data = scraper(brand, product)
                else:
                    data = scraper(brand, product, oem, asin)

                if "error" in data:
                    error = data["error"]
                else:
                    for d in data["data"]:
                        d["WEBSITE"] = site.capitalize()
                        results.append(d)

        if not results and not error:
            error = "No results found."

    except Exception as e:
        error = str(e)
        print(f"🔴 Error in scrape_products: {error}")  # Debug log

    if error:
        return jsonify({"error": error}), 400

    return jsonify({"data": results})

@app.route('/api/profile')
@login_required
def get_profile():
    history = SearchHistory.query.filter_by(user_id=current_user.id)\
        .order_by(SearchHistory.created_at.desc())\
        .limit(20).all()

    history_data = [{
        'id': h.id,
        'brand': h.brand,
        'product': h.product,
        'oem_number': h.oem_number,
        'asin_number': h.asin_number,
        'website': h.website,
        'search_type': h.search_type,
        'created_at': h.created_at.isoformat()
    } for h in history]

    return jsonify({
        "user": {
            "name": current_user.name,
            "email": current_user.email,
            "created_at": current_user.created_at.isoformat()
        },
        "search_history": history_data
    })

@app.route('/api/delete-search/<search_id>', methods=['DELETE'])
@login_required
def delete_search(search_id):
    entry = SearchHistory.query.filter_by(id=search_id, user_id=current_user.id).first()
    if entry:
        db.session.delete(entry)
        db.session.commit()
        return jsonify({"message": "Deleted"})
    return jsonify({"error": "Not found"}), 404

@app.route("/api/health")
def health():
    return jsonify({"status": "healthy"})

@app.route("/", methods=["GET", "POST"])
def html_index():
    results = []
    error = None

    if request.method == "POST":
        try:
            brand = request.form.get("brand", "").strip()
            product = request.form.get("product", "").strip()
            website = request.form.get("website", "").lower().strip()
            oem = request.form.get("oem_number", "").strip()
            asin = request.form.get("asin_number", "").strip()
            amazon_domain = request.form.get("amazon_country", "amazon.com").strip()
            file = request.files.get("file")

            os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain

            # ---- BULK UPLOAD ----
            if file and file.filename:
                # Use the amazon_domain from form, not from file
                amazon_domain = request.form.get("amazon_country", "amazon.com").strip()
                os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                
                df = pd.read_excel(file) if file.filename.endswith(".xlsx") else pd.read_csv(file)

                for _, row in df.iterrows():
                    brand = str(row.get("Brand", "")).strip()
                    product = str(row.get("Product", "")).strip()
                    site = str(row.get("Website Name", "")).lower().strip()
                    oem = str(row.get("OEM Number", "")).strip()
                    asin = str(row.get("ASIN Number", "")).strip()
                    # Remove: amazon_domain = str(row.get("Amazon Domain", "amazon.com")).strip()

                    if not brand or not product:
                        continue

                    sites = SCRAPERS.keys() if not site else [site]

                    for s in sites:
                        if s not in SCRAPERS:
                            continue

                        scraper = SCRAPERS[s]

                        if s == "amazon":
                            os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                            data = scraper(brand, product)
                        else:
                            data = scraper(brand, product, oem, asin)

                        if "error" in data:
                            error = data["error"]
                        else:
                            for d in data["data"]:
                                d["WEBSITE"] = s.capitalize()
                                results.append(d)

                        if s == "amazon":
                            time.sleep(random.uniform(10, 25))

            # ---- MANUAL ----
            else:
                if not brand or not product:
                    error = "Brand and Product are required"
                else:
                    sites = SCRAPERS.keys() if website in ("", "allwebsite") else [website]

                    for s in sites:
                        if s not in SCRAPERS:
                            continue

                        scraper = SCRAPERS[s]

                        if s == "amazon":
                            os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                            data = scraper(brand, product)
                        else:
                            data = scraper(brand, product, oem, asin)

                        if "error" in data:
                            error = data["error"]
                        else:
                            for d in data["data"]:
                                d["WEBSITE"] = s.capitalize()
                                results.append(d)

        except Exception as e:
            error = str(e)

    return render_template("index.html", results=results, error=error)

if __name__ == "__main__":
    create_tables(app)
    insert_sample(app)
    app.run(debug=True, port=8080)
