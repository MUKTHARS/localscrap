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
from logging.handlers import RotatingFileHandler
from werkzeug.middleware.proxy_fix import ProxyFix

# ===== ENHANCED LOGGING SETUP =====
os.makedirs('/root/Final_Scraper/backend/logs', exist_ok=True)

# Configure comprehensive logging
file_handler = RotatingFileHandler(
    '/root/Final_Scraper/backend/logs/debug.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
))

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s'
))

# Configure root logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.DEBUG)
root_logger.addHandler(file_handler)
root_logger.addHandler(console_handler)

# Get logger for this module
logger = logging.getLogger(__name__)

logger.info("🚀 STARTING FLASK APP WITH DEBUG LOGGING")

# Scrapers
try:
    logger.info("🔄 IMPORTING SCRAPERS...")
    from scrapers.amazon_scraper import scrape_amazon
    from scrapers.flipkart_scraper import scrape_flipkart
    from scrapers.ebay_scraper import scrape_ebay
    from scrapers.snapdeal_scraper import scrape_snapdeal
    from scrapers.amitretail_scraper import scrape_amitretail
    from scrapers.noon_scraper import scrape_noon
    from scrapers.sharafdg_scraper import scrape_sharafdg
    logger.info("✅ ALL SCRAPERS IMPORTED SUCCESSFULLY")
except Exception as e:
    logger.exception("❌ FAILED TO IMPORT SCRAPERS")
    raise e

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

logger.info(f"📋 REGISTERED {len(SCRAPERS)} SCRAPERS: {list(SCRAPERS.keys())}")

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

@app.route("/api/debug-scrapers", methods=["GET"])
@login_required
def debug_scrapers():
    """Test all scrapers individually"""
    logger.info("🔧 DEBUG: Testing all scrapers")
    
    test_results = {}
    test_brand = "samsung"
    test_product = "phone"
    
    for scraper_name, scraper_func in SCRAPERS.items():
        logger.info(f"🔧 Testing {scraper_name} scraper...")
        try:
            start_time = time.time()
            
            if scraper_name == "amazon":
                # Test Amazon with default domain
                result = scraper_func(test_brand, test_product)
            else:
                result = scraper_func(test_brand, test_product)
                
            elapsed_time = time.time() - start_time
            
            test_results[scraper_name] = {
                "status": "success" if "data" in result else "error",
                "execution_time": f"{elapsed_time:.2f}s",
                "products_found": len(result.get("data", [])),
                "result_type": type(result).__name__,
                "details": result.get("error", "No error") if "error" in result else "Working"
            }
            
            logger.info(f"   ✅ {scraper_name}: {test_results[scraper_name]['status']} - {test_results[scraper_name]['products_found']} products")
            
        except Exception as e:
            test_results[scraper_name] = {
                "status": "crash",
                "error": str(e),
                "execution_time": "N/A"
            }
            logger.error(f"   ❌ {scraper_name}: CRASHED - {str(e)}")
    
    return jsonify({"scraper_tests": test_results})

@app.route("/api/debug-upload", methods=["POST"])
@login_required 
def debug_upload():
    """Test file upload and parsing without scraping"""
    logger.info("🧪 DEBUG UPLOAD: Testing file processing")
    
    if 'file' not in request.files:
        logger.error("❌ DEBUG UPLOAD: No file in request")
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.error("❌ DEBUG UPLOAD: Empty filename")
        return jsonify({"error": "No file selected"}), 400

    temp_file_path = None
    try:
        logger.info(f"📁 DEBUG UPLOAD: Processing file '{file.filename}'")
        
        # Get Amazon domain from form
        amazon_domain = request.form.get('amazon_country', 'amazon.com').strip().lower() or "amazon.com"
        logger.info(f"🌐 DEBUG UPLOAD: Amazon domain = '{amazon_domain}'")
        
        # File validation
        ext = os.path.splitext(file.filename)[1].lower()
        logger.info(f"📄 DEBUG UPLOAD: File extension = '{ext}'")
        
        allowed = ['.csv', '.xlsx', '.xls']
        if ext not in allowed:
            logger.error(f"❌ DEBUG UPLOAD: Invalid file type '{ext}'")
            return jsonify({"error": "Upload CSV or Excel only"}), 400

        # Save file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            file.save(temp_file.name)
            temp_file_path = temp_file.name
            file_size = os.path.getsize(temp_file_path)
            logger.info(f"💾 DEBUG UPLOAD: Saved temp file '{temp_file_path}' ({file_size} bytes)")

        # Read file
        logger.info("📊 DEBUG UPLOAD: Reading file content...")
        if ext == ".csv":
            df = pd.read_csv(temp_file_path)
        else:
            df = pd.read_excel(temp_file_path)
        
        logger.info(f"✅ DEBUG UPLOAD: Successfully read {len(df)} rows, {len(df.columns)} columns")
        logger.info(f"📊 DEBUG UPLOAD: Columns = {list(df.columns)}")
        
        # Check required columns
        required_columns = ['Brand', 'Product']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            logger.error(f"❌ DEBUG UPLOAD: Missing columns {missing_columns}")
            return jsonify({
                "error": f"Missing required columns: {', '.join(missing_columns)}",
                "available_columns": list(df.columns)
            }), 400
        
        # Sample data
        sample_data = []
        for i in range(min(3, len(df))):
            sample_data.append({
                "row": i + 1,
                "brand": str(df.iloc[i].get("Brand", "")).strip(),
                "product": str(df.iloc[i].get("Product", "")).strip(),
                "website": str(df.iloc[i].get("Website Name", "")).strip(),
                "oem": str(df.iloc[i].get("OEM Number", "")).strip(),
                "asin": str(df.iloc[i].get("ASIN Number", "")).strip()
            })
        
        logger.info(f"📋 DEBUG UPLOAD: Sample data = {sample_data}")
        
        return jsonify({
            "status": "success",
            "file_info": {
                "filename": file.filename,
                "rows": len(df),
                "columns": list(df.columns),
                "sample_data": sample_data
            },
            "amazon_domain": amazon_domain
        })
        
    except Exception as e:
        logger.exception("🚨 DEBUG UPLOAD: FAILED")
        return jsonify({
            "error": f"File processing failed: {str(e)}",
            "type": type(e).__name__
        }), 400
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
            logger.info("🧹 DEBUG UPLOAD: Temp file cleaned up")

@app.route("/api/scrape", methods=["POST"])
@login_required
def scrape_products():
    logger.info("🎯 ===== MAIN SCRAPE ENDPOINT CALLED =====")
    results = []
    error = None
    temp_file_path = None

    try:
        logger.info(f"👤 User: {current_user.id}, Authenticated: {current_user.is_authenticated}")

        if 'file' in request.files:
            logger.info("📦 BULK UPLOAD MODE DETECTED")
            file = request.files['file']
            
            # Log file info
            file_contents = file.read()
            file.seek(0)  # Reset pointer after reading
            logger.info(f"📁 File: '{file.filename}', Size: {len(file_contents)} bytes")
            
            if file.filename == '':
                logger.error("❌ Empty filename")
                return jsonify({"error": "No file selected"}), 400

            amazon_domain = request.form.get('amazon_country', 'amazon.com').strip().lower() or "amazon.com"
            logger.info(f"🌐 Amazon domain: '{amazon_domain}'")

            # File validation
            ext = os.path.splitext(file.filename)[1].lower()
            logger.info(f"📄 File extension: '{ext}'")
            
            allowed = ['.csv', '.xlsx', '.xls']
            if ext not in allowed:
                logger.error(f"❌ Invalid file type: '{ext}'")
                return jsonify({"error": "Upload CSV or Excel only"}), 400

            # Save temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
                file.save(temp_file.name)
                temp_file_path = temp_file.name
                file_size = os.path.getsize(temp_file_path)
                logger.info(f"💾 Temp file saved: '{temp_file_path}' ({file_size} bytes)")

            try:
                # Read file
                logger.info("📊 Reading file content...")
                if ext == ".csv":
                    df = pd.read_csv(temp_file_path)
                else:
                    df = pd.read_excel(temp_file_path)
                
                logger.info(f"✅ File parsed: {len(df)} rows, {len(df.columns)} columns")
                logger.info(f"📊 Columns: {list(df.columns)}")
                
                if len(df) > 0:
                    logger.info(f"📋 First row sample: {dict(df.iloc[0])}")

                # Validate required columns
                required_columns = ['Brand', 'Product']
                missing_columns = [col for col in required_columns if col not in df.columns]
                if missing_columns:
                    logger.error(f"❌ Missing required columns: {missing_columns}")
                    logger.error(f"❌ Available columns: {list(df.columns)}")
                    return jsonify({"error": f"Missing required columns: {', '.join(missing_columns)}"}), 400

                # Save to search history
                logger.info("💾 Saving to search history...")
                try:
                    bulk = SearchHistory(
                        user_id=current_user.id,
                        brand="Bulk Upload",
                        product=f"{len(df)} products",
                        search_type='bulk',
                        created_at=datetime.now(timezone.utc)
                    )
                    db.session.add(bulk)
                    db.session.commit()
                    logger.info("✅ Search history saved successfully")
                except Exception as db_error:
                    logger.exception("🚨 Database error saving search history")
                    # Continue despite DB error

                # Process each row
                total_rows = len(df)
                logger.info(f"🔄 Starting to process {total_rows} rows...")
                
                successful_rows = 0
                for index, row in df.iterrows():
                    row_num = index + 1
                    logger.info(f"--- PROCESSING ROW {row_num}/{total_rows} ---")
                    
                    brand = str(row.get("Brand", "")).strip()
                    product = str(row.get("Product", "")).strip()
                    site = str(row.get("Website Name", "")).lower().strip()
                    oem = str(row.get("OEM Number", "")).strip()
                    asin = str(row.get("ASIN Number", "")).strip()

                    logger.info(f"   📝 Data - Brand: '{brand}', Product: '{product}', Site: '{site}'")

                    if not brand or not product:
                        logger.warning(f"   ⚠️ Skipping row {row_num} - missing brand or product")
                        continue

                    sites_to_scrape = SCRAPERS.keys() if not site else [site]
                    logger.info(f"   🌐 Sites to scrape: {sites_to_scrape}")

                    for site_name in sites_to_scrape:
                        if site_name not in SCRAPERS:
                            logger.warning(f"   ⚠️ Skipping unknown site: {site_name}")
                            continue

                        logger.info(f"   🚀 Starting {site_name} scraper...")
                        scraper = SCRAPERS[site_name]

                        try:
                            if site_name == "amazon":
                                os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                                time.sleep(0.5)
                                logger.info(f"   🔍 Calling Amazon scraper with domain: {amazon_domain}")
                                data = scraper(brand, product)
                                if "SELECTED_AMAZON_DOMAIN" in os.environ:
                                    del os.environ["SELECTED_AMAZON_DOMAIN"]
                            else:
                                data = scraper(brand, product, oem, asin)

                            logger.info(f"   📊 {site_name} returned: {type(data)}")
                            
                            if isinstance(data, dict):
                                if "error" in data:
                                    logger.error(f"   ❌ {site_name} error: {data['error']}")
                                    # Don't set global error for individual scraper failures
                                elif "data" in data:
                                    product_count = len(data["data"])
                                    logger.info(f"   ✅ {site_name} success: found {product_count} products")
                                    for d in data["data"]:
                                        d["WEBSITE"] = site_name.capitalize()
                                        results.append(d)
                                    successful_rows += 1
                                else:
                                    logger.warning(f"   ⚠️ {site_name}: No data in response")
                            else:
                                logger.error(f"   ❌ {site_name}: Invalid response type: {type(data)}")

                            # Rate limiting for Amazon
                            if site_name == "amazon":
                                sleep_time = random.uniform(10, 25)
                                logger.info(f"   💤 Sleeping {sleep_time:.1f}s after Amazon scrape")
                                time.sleep(sleep_time)

                        except Exception as scrape_error:
                            logger.exception(f"   🚨 {site_name} SCRAPER CRASHED")
                            continue

                logger.info(f"📈 PROCESSING COMPLETE: {successful_rows}/{total_rows} rows successful, {len(results)} total products found")

            except Exception as file_error:
                logger.exception("🚨 FILE PROCESSING ERROR")
                error = f"Error processing file: {str(file_error)}"
            finally:
                if temp_file_path and os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    logger.info("🧹 Temporary file cleaned up")

        else:
            logger.info("📝 MANUAL SCRAPE MODE DETECTED")
            # Your existing manual scrape code (preserved)
            data = request.get_json()
            if not data:
                logger.error("❌ No JSON data in manual scrape")
                return jsonify({"error": "No data provided"}), 400

            brand = data.get("brand", "").strip()
            product = data.get("product", "").strip()
            website = data.get("website", "").lower().strip()
            oem = data.get("oem_number", "").strip()
            asin = data.get("asin_number", "").strip()
            amazon_domain = data.get("amazon_country", "amazon.com").strip() or "amazon.com"

            logger.info(f"📝 Manual scrape - Brand: '{brand}', Product: '{product}', Website: '{website}'")

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
                logger.info("✅ Manual search history saved")

            if not brand or not product:
                logger.error("❌ Manual scrape missing brand or product")
                return jsonify({"error": "Brand and Product required"}), 400

            sites_to_scrape = SCRAPERS.keys() if not website else [website]
            logger.info(f"🌐 Manual sites to scrape: {sites_to_scrape}")

            for site in sites_to_scrape:
                if site not in SCRAPERS:
                    logger.warning(f"⚠️ Skipping unknown site: {site}")
                    continue

                logger.info(f"🚀 Manual scraping {site}...")
                scraper = SCRAPERS[site]

                try:
                    if site == "amazon":
                        os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                        data = scraper(brand, product)
                        if "SELECTED_AMAZON_DOMAIN" in os.environ:
                            del os.environ["SELECTED_AMAZON_DOMAIN"]
                    else:
                        data = scraper(brand, product, oem, asin)

                    if isinstance(data, dict) and "error" in data:
                        logger.error(f"❌ {site} error: {data['error']}")
                        error = data["error"]
                    else:
                        product_count = len(data.get("data", []))
                        logger.info(f"✅ {site} manual: found {product_count} products")
                        for d in data.get("data", []):
                            d["WEBSITE"] = site.capitalize()
                            results.append(d)

                except Exception as scrape_error:
                    logger.exception(f"🚨 Manual {site} scraping failed")
                    continue

        if not results and not error:
            error = "No results found from any searches."
            logger.warning("⚠️ No results found and no specific error")

    except Exception as e:
        logger.exception("🚨 UNEXPECTED ERROR IN SCRAPE ENDPOINT")
        error = f"Server error: {str(e)}"
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

    # Final response
    if error:
        logger.error(f"🔴 RETURNING ERROR: {error}")
        return jsonify({"error": error}), 400

    logger.info(f"🟢 SUCCESS: Returning {len(results)} products")
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

@app.route("/api/debug-info", methods=["GET"])
def debug_info():
    """Get system and app debug information"""
    import platform
    import sys
    
    info = {
        "python_version": sys.version,
        "platform": platform.platform(),
        "current_time": datetime.now(timezone.utc).isoformat(),
        "working_directory": os.getcwd(),
        "environment_variables": {
            "SELECTED_AMAZON_DOMAIN": os.environ.get("SELECTED_AMAZON_DOMAIN", "Not set"),
            "PATH": os.environ.get("PATH", "Not set")[:100] + "..."  # Truncate long PATH
        },
        "scrapers_loaded": list(SCRAPERS.keys()),
        "log_file": "/root/Final_Scraper/backend/logs/debug.log"
    }
    
    return jsonify(info)

if __name__ == "__main__":
    logger.info("🚀 STARTING FLASK APPLICATION")
    # Ensure DB tables exist (when running via python app.py locally)
    create_tables(app)
    app.run(debug=False, host='0.0.0.0', port=8080)


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

# # Update cookie settings:
# app.config.update({
#     "SESSION_COOKIE_SECURE": True,
#     "SESSION_COOKIE_SAMESITE": "Lax",  # Change from "None" to "Lax"
#     "SESSION_COOKIE_HTTPONLY": True,
#     "SESSION_COOKIE_DOMAIN": "tutomart.com",  # Remove the leading dot
#     "REMEMBER_COOKIE_SAMESITE": "Lax",
#     "REMEMBER_COOKIE_SECURE": True,
#     "REMEMBER_COOKIE_DOMAIN": "tutomart.com"
# })

# # CORS: allow your frontend and enable credentials
# CORS(app,
#      supports_credentials=True,
#      origins=["https://tutomart.com", "https://www.tutomart.com"],
#      allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
#      methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

# app.register_blueprint(auth_bp, url_prefix='/api/auth')

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
#     print(f"Current user: {current_user}")
#     print(f"User authenticated: {current_user.is_authenticated}")
#     print(f"User ID: {current_user.id if current_user.is_authenticated else 'None'}")
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
#                                 time.sleep(0.2)
#                                 data = scraper(brand, product)
#                                 if "SELECTED_AMAZON_DOMAIN" in os.environ:
#                                     del os.environ["SELECTED_AMAZON_DOMAIN"]
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
#                         if "SELECTED_AMAZON_DOMAIN" in os.environ:
#                             del os.environ["SELECTED_AMAZON_DOMAIN"]
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


# @app.route('/api/delete-search/<string:search_id>', methods=['DELETE'])
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
