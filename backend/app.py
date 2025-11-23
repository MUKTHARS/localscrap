# /var/www/Final_Scraper/backend/app.py
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

# Scrapers (your existing imports)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)

# Fix: Better session configuration
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-secret-key'),
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE='None',
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_DOMAIN='.tutomart.com',
    REMEMBER_COOKIE_SECURE=True,
    REMEMBER_COOKIE_SAMESITE='None',
    REMEMBER_COOKIE_DOMAIN='.tutomart.com'
)

# CORS configuration
CORS(app,
     supports_credentials=True,
     origins=["https://tutomart.com", "https://www.tutomart.com"],
     expose_headers=["Content-Type", "Authorization"])

# Database initialization with better error handling
db.init_app(app)

# Add this to handle database connection issues
@app.before_first_request
def create_tables_on_startup():
    try:
        with app.app_context():
            db.create_all()
            logger.info("Database tables created/verified successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")

login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.unauthorized_handler
def unauthorized_callback():
    return jsonify({"error": "Unauthorized"}), 401

init_oauth(app)

# Proxy fix
app.wsgi_app = ProxyFix(
    app.wsgi_app,
    x_for=1,
    x_proto=1,
    x_host=1,
    x_port=1,
    x_prefix=1
)

app.register_blueprint(auth_bp, url_prefix='/auth')

# Your existing SCRAPERS dict and routes...

@login_manager.user_loader
def load_user(user_id):
    try:
        return User.query.get(user_id)
    except Exception as e:
        logger.error(f"Error loading user {user_id}: {e}")
        return None

# Add database health check endpoint
@app.route("/api/db-health")
def db_health():
    try:
        # Test database connection
        db.session.execute('SELECT 1')
        return jsonify({"status": "healthy", "database": "connected"})
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return jsonify({"status": "unhealthy", "database": "disconnected", "error": str(e)}), 500

# Your existing routes...

if __name__ == "__main__":
    try:
        with app.app_context():
            db.create_all()
            logger.info("Application started with database tables verified")
        app.run(debug=False, host='0.0.0.0', port=8080)
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise

# # /var/www/Final_Scraper/backend/app.py
# from flask import Flask, request, jsonify
# from flask_login import LoginManager, current_user, login_required
# from flask_cors import CORS
# from db_models import db, User, SearchHistory, create_tables
# from auth_config import Config
# from auth_routes import auth_bp, init_oauth
# import pandas as pd
# import time, random, os, tempfile
# from datetime import datetime, timezone
# import logging
# from werkzeug.middleware.proxy_fix import ProxyFix

# # Scrapers
# from scrapers.amazon_scraper import scrape_amazon
# from scrapers.flipkart_scraper import scrape_flipkart
# from scrapers.ebay_scraper import scrape_ebay
# from scrapers.snapdeal_scraper import scrape_snapdeal
# from scrapers.amitretail_scraper import scrape_amitretail
# from scrapers.noon_scraper import scrape_noon
# from scrapers.sharafdg_scraper import scrape_sharafdg

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# app = Flask(__name__)
# # load base config (ensure Config reads secrets from env in auth_config)
# app.config.from_object(Config)
# app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# # ---- PRODUCTION cookie / session settings ----
# if not app.config.get("SECRET_KEY"):
#     app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-for-local")

# # Cookie settings for production
# app.config.update({
#     "SESSION_COOKIE_SECURE": True,          # only send cookie over HTTPS
#     "SESSION_COOKIE_SAMESITE": "None",      # allow cross-site (React <> API)
#     "SESSION_COOKIE_HTTPONLY": True,
#     "SESSION_COOKIE_DOMAIN": ".tutomart.com",  # leading dot for subdomains
#     "REMEMBER_COOKIE_SAMESITE": "None",
#     "REMEMBER_COOKIE_SECURE": True,
#     "REMEMBER_COOKIE_DOMAIN": ".tutomart.com"
# })

# # CORS: allow your frontend and enable credentials
# CORS(app,
#      supports_credentials=True,
#      origins=["https://tutomart.com", "https://www.tutomart.com"],
#      expose_headers=["Content-Type", "Authorization"])

# db.init_app(app)

# login_manager = LoginManager()
# login_manager.init_app(app)

# # Avoid default redirect behavior for APIs — return JSON 401 instead
# @login_manager.unauthorized_handler
# def unauthorized_callback():
#     return jsonify({"error": "Unauthorized"}), 401

# init_oauth(app)

# # Fix HTTPS + domain detection behind Nginx
# app.wsgi_app = ProxyFix(
#     app.wsgi_app,
#     x_for=1,
#     x_proto=1,
#     x_host=1,
#     x_port=1,
#     x_prefix=1
# )

# app.register_blueprint(auth_bp, url_prefix='/auth')

# SCRAPERS = {
#     "amazon": scrape_amazon,
#     "flipkart": scrape_flipkart,
#     "ebay": scrape_ebay,
#     "snapdeal": scrape_snapdeal,
#     "amitretail": scrape_amitretail,
#     "noon": scrape_noon,
#     "sharafdg": scrape_sharafdg
# }


# @login_manager.user_loader
# def load_user(user_id):
#     try:
#         # User.id is a UUID string — query by string directly
#         return User.query.get(user_id)
#     except Exception:
#         return None


# @app.route("/api/user")
# @login_required
# def get_user():
#     return jsonify({
#         'id': current_user.id,
#         'name': current_user.name,
#         'email': current_user.email,
#         'authenticated': True
#     })


# @app.route("/api/scrape", methods=["POST"])
# @login_required
# def scrape_products():
#     results = []
#     error = None
#     temp_file_path = None

#     try:
#         if 'file' in request.files:
#             file = request.files['file']
#             if file.filename == '':
#                 return jsonify({"error": "No file selected"}), 400

#             amazon_domain = request.form.get('amazon_country', 'amazon.com').strip().lower() or "amazon.com"

#             ext = os.path.splitext(file.filename)[1].lower()
#             allowed = ['.csv', '.xlsx', '.xls']
#             if ext not in allowed:
#                 return jsonify({"error": "Upload CSV or Excel only"}), 400

#             with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
#                 file.save(temp_file.name)
#                 temp_file_path = temp_file.name

#             try:
#                 if ext == ".csv":
#                     df = pd.read_csv(temp_file_path)
#                 else:
#                     df = pd.read_excel(temp_file_path)

#                 bulk = SearchHistory(
#                     user_id=current_user.id,
#                     brand="Bulk Upload",
#                     product=f"{len(df)} products",
#                     search_type='bulk',
#                     created_at=datetime.now(timezone.utc)
#                 )
#                 db.session.add(bulk)
#                 db.session.commit()

#                 for index, row in df.iterrows():
#                     brand = str(row.get("Brand", "")).strip()
#                     product = str(row.get("Product", "")).strip()
#                     site = str(row.get("Website Name", "")).lower().strip()
#                     oem = str(row.get("OEM Number", "")).strip()
#                     asin = str(row.get("ASIN Number", "")).strip()

#                     if not brand or not product:
#                         continue

#                     sites_to_scrape = SCRAPERS.keys() if not site else [site]

#                     for site_name in sites_to_scrape:
#                         if site_name not in SCRAPERS:
#                             continue

#                         scraper = SCRAPERS[site_name]

#                         try:
#                             if site_name == "amazon":
#                                 os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
#                                 data = scraper(brand, product)
#                             else:
#                                 data = scraper(brand, product, oem, asin)

#                             if isinstance(data, dict) and "error" in data:
#                                 error = data["error"]
#                             else:
#                                 for d in data.get("data", []):
#                                     d["WEBSITE"] = site_name.capitalize()
#                                     results.append(d)

#                             if site_name == "amazon":
#                                 time.sleep(random.uniform(10, 25))

#                         except Exception as scrape_error:
#                             logger.exception(f"Error scraping {site_name}: {scrape_error}")
#                             continue

#             except Exception as file_error:
#                 error = f"Error processing file: {str(file_error)}"
#             finally:
#                 if temp_file_path and os.path.exists(temp_file_path):
#                     os.unlink(temp_file_path)

#         else:
#             data = request.get_json()
#             if not data:
#                 return jsonify({"error": "No data provided"}), 400

#             brand = data.get("brand", "").strip()
#             product = data.get("product", "").strip()
#             website = data.get("website", "").lower().strip()
#             oem = data.get("oem_number", "").strip()
#             asin = data.get("asin_number", "").strip()
#             amazon_domain = data.get("amazon_country", "amazon.com").strip() or "amazon.com"

#             if brand and product:
#                 search = SearchHistory(
#                     user_id=current_user.id,
#                     brand=brand,
#                     product=product,
#                     oem_number=oem or None,
#                     asin_number=asin or None,
#                     website=website or None,
#                     search_type='manual',
#                     created_at=datetime.now(timezone.utc)
#                 )
#                 db.session.add(search)
#                 db.session.commit()

#             if not brand or not product:
#                 return jsonify({"error": "Brand and Product required"}), 400

#             sites_to_scrape = SCRAPERS.keys() if not website else [website]

#             for site in sites_to_scrape:
#                 if site not in SCRAPERS:
#                     continue

#                 scraper = SCRAPERS[site]

#                 try:
#                     if site == "amazon":
#                         os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
#                         data = scraper(brand, product)
#                     else:
#                         data = scraper(brand, product, oem, asin)

#                     if isinstance(data, dict) and "error" in data:
#                         error = data["error"]
#                     else:
#                         for d in data.get("data", []):
#                             d["WEBSITE"] = site.capitalize()
#                             results.append(d)

#                 except Exception as scrape_error:
#                     logger.exception(f"Error scraping {site}: {scrape_error}")
#                     continue

#         if not results and not error:
#             error = "No results found."

#     except Exception as e:
#         logger.exception("Unexpected error during scrape")
#         error = str(e)
#         if temp_file_path and os.path.exists(temp_file_path):
#             os.unlink(temp_file_path)

#     if error:
#         return jsonify({"error": error}), 400

#     return jsonify({"data": results})


# @app.route('/api/profile')
# @login_required
# def get_profile():
#     """Get user profile and search history"""
#     try:
#         history = SearchHistory.query.filter_by(user_id=current_user.id)\
#             .order_by(SearchHistory.created_at.desc())\
#             .limit(20).all()

#         history_data = []
#         for h in history:
#             formatted_date = h.created_at.isoformat() + 'Z' if h.created_at else None

#             history_data.append({
#                 'id': h.id,
#                 'brand': h.brand,
#                 'product': h.product,
#                 'oem_number': h.oem_number,
#                 'asin_number': h.asin_number,
#                 'website': h.website,
#                 'search_type': h.search_type,
#                 'created_at': formatted_date
#             })

#         user_created_at = current_user.created_at or datetime.now(timezone.utc)
#         # Optionally persist if previously None (you can remove if undesired)
#         if current_user.created_at is None:
#             current_user.created_at = user_created_at
#             db.session.commit()

#         return jsonify({
#             "user": {
#                 "name": current_user.name,
#                 "email": current_user.email,
#                 "created_at": user_created_at.isoformat() + 'Z'
#             },
#             "search_history": history_data
#         })
#     except Exception as e:
#         logger.exception("Error getting profile")
#         return jsonify({"error": "Failed to get profile"}), 500


# @app.route('/api/delete-search/<int:search_id>', methods=['DELETE'])
# @login_required
# def delete_search(search_id):
#     entry = SearchHistory.query.filter_by(id=search_id, user_id=current_user.id).first()
#     if entry:
#         db.session.delete(entry)
#         db.session.commit()
#         return jsonify({"message": "Search history deleted successfully"})
#     return jsonify({"error": "Search history not found"}), 404


# @app.route("/api/health")
# def health():
#     return jsonify({
#         "status": "healthy",
#         "timestamp": datetime.now(timezone.utc).isoformat(),
#         "authenticated": current_user.is_authenticated
#     })


# if __name__ == "__main__":
#     # Ensure DB tables exist (when running via python app.py locally)
#     create_tables(app)
#     app.run(debug=False, host='0.0.0.0', port=8080)
