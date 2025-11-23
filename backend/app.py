from flask import Flask, request, jsonify
from flask_login import LoginManager, current_user, login_required
from flask_cors import CORS
from db_models import db, User, SearchHistory, create_tables
from auth_config import Config
from auth_routes import auth_bp, init_oauth
import pandas as pd
import time, random, os, tempfile
from datetime import datetime
import logging
from datetime import datetime, timezone  # Updated import

# Scrapers
from scrapers.amazon_scraper import scrape_amazon
from scrapers.flipkart_scraper import scrape_flipkart
from scrapers.ebay_scraper import scrape_ebay
from scrapers.snapdeal_scraper import scrape_snapdeal
from scrapers.amitretail_scraper import scrape_amitretail
from scrapers.noon_scraper import scrape_noon
from scrapers.sharafdg_scraper import scrape_sharafdg

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)

CORS(app, supports_credentials=True, origins=["http://localhost:3000"])

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

init_oauth(app)
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
        'email': current_user.email,
        'authenticated': True
    })

@app.route("/api/scrape", methods=["POST"])
@login_required
def scrape_products():
    results = []
    error = None
    temp_file_path = None

    try:
        if 'file' in request.files:
            file = request.files['file']
            if file.filename == '':
                return jsonify({"error": "No file selected"}), 400

            amazon_domain = request.form.get('amazon_country', 'amazon.com').strip().lower()
            if not amazon_domain:
                amazon_domain = "amazon.com"
            
            ext = os.path.splitext(file.filename)[1].lower()
            allowed = ['.csv', '.xlsx', '.xls']
            if ext not in allowed:
                return jsonify({"error": "Upload CSV or Excel only"}), 400

            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
                file.save(temp_file.name)
                temp_file_path = temp_file.name

            try:
                if ext == ".csv":
                    df = pd.read_csv(temp_file_path)
                else:
                    df = pd.read_excel(temp_file_path)

                bulk = SearchHistory(
                    user_id=current_user.id,
                    brand="Bulk Upload",
                    product=f"{len(df)} products",
                    search_type='bulk',
                    created_at=datetime.now(timezone.utc)  # Updated
                )
                db.session.add(bulk)
                db.session.commit()

                for index, row in df.iterrows():
                    brand = str(row.get("Brand", "")).strip()
                    product = str(row.get("Product", "")).strip()
                    site = str(row.get("Website Name", "")).lower().strip()
                    oem = str(row.get("OEM Number", "")).strip()
                    asin = str(row.get("ASIN Number", "")).strip()
                    
                    if not brand or not product:
                        continue

                    sites_to_scrape = SCRAPERS.keys() if not site else [site]

                    for site_name in sites_to_scrape:
                        if site_name not in SCRAPERS:
                            continue

                        scraper = SCRAPERS[site_name]

                        try:
                            if site_name == "amazon":
                                os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
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
                                
                        except Exception as scrape_error:
                            logger.error(f"Error scraping {site_name}: {scrape_error}")
                            continue

            except Exception as file_error:
                error = f"Error processing file: {str(file_error)}"
            finally:
                if temp_file_path and os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)

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

            if brand and product:
                search = SearchHistory(
                    user_id=current_user.id,
                    brand=brand,
                    product=product,
                    oem_number=oem or None,
                    asin_number=asin or None,
                    website=website or None,
                    search_type='manual',
                    created_at=datetime.now(timezone.utc)  # Updated
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

                try:
                    if site == "amazon":
                        os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                        data = scraper(brand, product)
                    else:
                        data = scraper(brand, product, oem, asin)

                    if "error" in data:
                        error = data["error"]
                    else:
                        for d in data["data"]:
                            d["WEBSITE"] = site.capitalize()
                            results.append(d)
                            
                except Exception as scrape_error:
                    logger.error(f"Error scraping {site}: {scrape_error}")
                    continue

        if not results and not error:
            error = "No results found."

    except Exception as e:
        error = str(e)
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

    if error:
        return jsonify({"error": error}), 400

    return jsonify({"data": results})

@app.route('/api/profile')
@login_required
def get_profile():
    """Get user profile and search history"""
    try:
        # Get search history
        history = SearchHistory.query.filter_by(user_id=current_user.id)\
            .order_by(SearchHistory.created_at.desc())\
            .limit(20).all()

        history_data = []
        for h in history:
            # Handle search history dates
            if h.created_at:
                formatted_date = h.created_at.isoformat() + 'Z'
            else:
                formatted_date = None
            
            history_data.append({
                'id': h.id,
                'brand': h.brand,
                'product': h.product,
                'oem_number': h.oem_number,
                'asin_number': h.asin_number,
                'website': h.website,
                'search_type': h.search_type,
                'created_at': formatted_date
            })

        # Handle user creation date - ensure it's never None
        user_created_at = current_user.created_at
        if user_created_at is None:
            user_created_at = datetime.now(timezone.utc)
            # Optionally update the user record in database
            current_user.created_at = user_created_at
            db.session.commit()
    
        return jsonify({
            "user": {
                "name": current_user.name,
                "email": current_user.email,
                "created_at": user_created_at.isoformat() + 'Z'
            },
            "search_history": history_data
        })
    except Exception as e:
        logger.error(f"Error getting profile: {e}")
        return jsonify({"error": "Failed to get profile"}), 500

@app.route('/api/delete-search/<search_id>', methods=['DELETE'])
@login_required
def delete_search(search_id):
    entry = SearchHistory.query.filter_by(id=search_id, user_id=current_user.id).first()
    if entry:
        db.session.delete(entry)
        db.session.commit()
        return jsonify({"message": "Search history deleted successfully"})
    return jsonify({"error": "Search history not found"}), 404

@app.route("/api/health")
def health():
    return jsonify({
        "status": "healthy", 
        "timestamp": datetime.now(timezone.utc).isoformat(),  # Updated
        "authenticated": current_user.is_authenticated
    })

if __name__ == "__main__":
    create_tables(app)
    app.run(debug=True, host='0.0.0.0', port=8080)