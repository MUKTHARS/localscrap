
from flask import Flask, request, jsonify
from flask_login import LoginManager, current_user, login_required
from flask_cors import CORS
from db_models import db, User, SearchHistory, create_tables
from auth_config import Config
from auth_routes import auth_bp, init_oauth
import pandas as pd
import time, random, os, tempfile
from datetime import datetime, timezone
import logging
from werkzeug.middleware.proxy_fix import ProxyFix

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
# load base config (ensure Config reads secrets from env in auth_config)
app.config.from_object(Config)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# ---- PRODUCTION cookie / session settings ----
if not app.config.get("SECRET_KEY"):
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-for-local")

# Update cookie settings:
app.config.update({
    "SESSION_COOKIE_SECURE": True,
    "SESSION_COOKIE_SAMESITE": "Lax",  # Change from "None" to "Lax"
    "SESSION_COOKIE_HTTPONLY": True,
    "SESSION_COOKIE_DOMAIN": "tutomart.com",  # Remove the leading dot
    "REMEMBER_COOKIE_SAMESITE": "Lax",
    "REMEMBER_COOKIE_SECURE": True,
    "REMEMBER_COOKIE_DOMAIN": "tutomart.com"
})

# CORS: allow your frontend and enable credentials
CORS(app,
     supports_credentials=True,
     origins=["https://tutomart.com", "https://www.tutomart.com"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     expose_headers=["Content-Type", "Authorization"])

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)

# Avoid default redirect behavior for APIs — return JSON 401 instead
@login_manager.unauthorized_handler
def unauthorized_callback():
    return jsonify({"error": "Unauthorized"}), 401

init_oauth(app)

# Fix HTTPS + domain detection behind Nginx
app.wsgi_app = ProxyFix(
    app.wsgi_app,
    x_for=1,
    x_proto=1,
    x_host=1,
    x_port=1,
    x_prefix=1
)

app.register_blueprint(auth_bp, url_prefix='/api/auth')

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
    try:
        # User.id is a UUID string — query by string directly
        return User.query.get(user_id)
    except Exception:
        return None


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
    print(f"Current user: {current_user}")
    print(f"User authenticated: {current_user.is_authenticated}")
    results = []
    error = None
    temp_file_path = None

    try:
        if 'file' in request.files:
            file = request.files['file']
            if file.filename == '':
                return jsonify({"error": "No file selected"}), 400

            amazon_domain = request.form.get('amazon_country', 'amazon.com').strip().lower() or "amazon.com"

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

                # Validate required columns
                required_columns = ['Brand', 'Product']
                missing_columns = [col for col in required_columns if col not in df.columns]
                if missing_columns:
                    return jsonify({"error": f"Missing required columns: {', '.join(missing_columns)}"}), 400

                # Log bulk upload
                bulk = SearchHistory(
                    user_id=current_user.id,
                    brand="Bulk Upload",
                    product=f"{len(df)} products",
                    search_type='bulk',
                    created_at=datetime.now(timezone.utc)
                )
                db.session.add(bulk)
                db.session.commit()

                processed_count = 0
                max_products = min(50, len(df))  # Limit to 50 products max

                for index, row in df.iterrows()[:max_products]:
                    brand = str(row.get("Brand", "")).strip()
                    product = str(row.get("Product", "")).strip()
                    site = str(row.get("Website Name", "")).lower().strip()
                    oem = str(row.get("OEM Number", "")).strip()
                    asin = str(row.get("ASIN Number", "")).strip()

                    if not brand or not product:
                        continue

                    processed_count += 1
                    sites_to_scrape = SCRAPERS.keys() if not site or site == "all" else [site]

                    print(f"🟡 Processing bulk item {processed_count}: {brand} - {product}")

                    for site_name in sites_to_scrape:
                        if site_name not in SCRAPERS:
                            continue

                        scraper = SCRAPERS[site_name]

                        try:
                            # Set Amazon domain for Amazon scraper
                            if site_name == "amazon":
                                os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                                data = scraper(brand, product, oem, asin)
                            else:
                                data = scraper(brand, product, oem, asin)

                            if isinstance(data, dict) and "data" in data:
                                for d in data["data"]:
                                    d["WEBSITE"] = site_name.capitalize()
                                    results.append(d)
                                print(f"🟢 {site_name}: Found {len(data['data'])} products for {brand} {product}")
                            elif isinstance(data, dict) and "error" in data:
                                print(f"🔴 {site_name} error for {brand} {product}: {data['error']}")

                            # Add delay between scrapers to avoid rate limiting
                            time.sleep(random.uniform(2, 5))

                        except Exception as scrape_error:
                            logger.exception(f"Error scraping {site_name} for {brand} {product}: {scrape_error}")
                            continue

                print(f"🟢 Bulk upload completed: {processed_count} products processed, {len(results)} results found")

            except Exception as file_error:
                error = f"Error processing file: {str(file_error)}"
                logger.exception("File processing error")
            finally:
                if temp_file_path and os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)

        else:
            # Manual scraping (existing code remains the same)
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400

            brand = data.get("brand", "").strip()
            product = data.get("product", "").strip()
            website = data.get("website", "").lower().strip()
            oem = data.get("oem_number", "").strip()
            asin = data.get("asin_number", "").strip()
            amazon_domain = data.get("amazon_country", "amazon.com").strip() or "amazon.com"

            if brand and product:
                search = SearchHistory(
                    user_id=current_user.id,
                    brand=brand,
                    product=product,
                    oem_number=oem or None,
                    asin_number=asin or None,
                    website=website or None,
                    search_type='manual',
                    created_at=datetime.now(timezone.utc)
                )
                db.session.add(search)
                db.session.commit()

            if not brand or not product:
                return jsonify({"error": "Brand and Product required"}), 400

            sites_to_scrape = SCRAPERS.keys() if not website or website == "all" else [website]

            for site in sites_to_scrape:
                if site not in SCRAPERS:
                    continue

                scraper = SCRAPERS[site]

                try:
                    if site == "amazon":
                        os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                        data = scraper(brand, product, oem, asin)
                    else:
                        data = scraper(brand, product, oem, asin)

                    if isinstance(data, dict) and "data" in data:
                        for d in data["data"]:
                            d["WEBSITE"] = site.capitalize()
                            results.append(d)
                    elif isinstance(data, dict) and "error" in data:
                        error = data["error"]

                except Exception as scrape_error:
                    logger.exception(f"Error scraping {site}: {scrape_error}")
                    continue

        if not results and not error:
            error = "No results found from any website."

    except Exception as e:
        logger.exception("Unexpected error during scrape")
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
        history = SearchHistory.query.filter_by(user_id=current_user.id)\
            .order_by(SearchHistory.created_at.desc())\
            .limit(20).all()

        history_data = []
        for h in history:
            formatted_date = h.created_at.isoformat() + 'Z' if h.created_at else None

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

        user_created_at = current_user.created_at or datetime.now(timezone.utc)
        # Optionally persist if previously None (you can remove if undesired)
        if current_user.created_at is None:
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
        logger.exception("Error getting profile")
        return jsonify({"error": "Failed to get profile"}), 500


@app.route('/api/delete-search/<string:search_id>', methods=['DELETE'])
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
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "authenticated": current_user.is_authenticated
    })


if __name__ == "__main__":
    # Ensure DB tables exist (when running via python app.py locally)
    create_tables(app)
    app.run(debug=False, host='0.0.0.0', port=8080)
