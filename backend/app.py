from flask import Flask, request, jsonify, send_from_directory, session
from flask_login import LoginManager, current_user, login_required
from flask_cors import CORS
from db_models import db, User, SearchHistory, SupportTicket, AdminUser, EmployeeTicketAssignment, create_tables
from auth_config import Config
from auth_routes import auth_bp, init_oauth
import pandas as pd
import time, random, os, tempfile, gc, logging, json
from datetime import datetime, timezone, timedelta
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash, generate_password_hash
import uuid

# --- AI Integration: Google Gemini ---
import google.generativeai as genai

# --- Scrapers ---
from scrapers.amazon_scraper import scrape_amazon
from scrapers.flipkart_scraper import scrape_flipkart
from scrapers.ebay_scraper import scrape_ebay
from scrapers.snapdeal_scraper import scrape_snapdeal
from scrapers.amitretail_scraper import scrape_amitretail
from scrapers.noon_scraper import scrape_noon
from scrapers.sharafdg_scraper import scrape_sharafdg
from scrapers.ntsuae_scraper import scrape_ntsuae
from scrapers.seazoneuae_scraper import scrape_seazoneuae
from scrapers.empiremarine_scraper import scrape_empiremarine
from scrapers.climaxmarine_scraper import scrape_climaxmarine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'txt'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
UPLOAD_FOLDER = 'static/uploads/tickets'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Configure Gemini ---
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
else:
    logger.warning("GOOGLE_API_KEY not found. AI features will be disabled.")

SCRAPERS = {
    "amazon": scrape_amazon,
    "flipkart": scrape_flipkart,
    "ebay": scrape_ebay,
    "snapdeal": scrape_snapdeal,
    "amitretail": scrape_amitretail,
    "noon": scrape_noon,
    "sharafdg": scrape_sharafdg,
    "ntsuae": scrape_ntsuae,
    "seazoneuae": scrape_seazoneuae,
    "empiremarine": scrape_empiremarine,
    "climaxmarine": scrape_climaxmarine
}

app = Flask(__name__, static_folder='frontend/build', static_url_path='/')
app.config.from_object(Config)
app.wsgi_app = ProxyFix(
    app.wsgi_app,
    x_for=1,
    x_proto=1,
    x_host=1,
    x_port=1,
    x_prefix=1
)

if not app.config.get("SECRET_KEY"):
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-for-local")

app.config.update({
    "SESSION_COOKIE_SECURE": True,
    "SESSION_COOKIE_SAMESITE": "Lax",
    "SESSION_COOKIE_HTTPONLY": True,
    "SESSION_COOKIE_DOMAIN": "tutomart.com",
    "REMEMBER_COOKIE_SAMESITE": "Lax",
    "REMEMBER_COOKIE_SECURE": True,
    "REMEMBER_COOKIE_DOMAIN": "tutomart.com",
    "PERMANENT_SESSION_LIFETIME": timedelta(days=7)
})

CORS(app,
     supports_credentials=True,
     origins=["https://tutomart.com", "https://www.tutomart.com"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     expose_headers=["Content-Type", "Authorization"])

db.init_app(app)
init_oauth(app)

app.register_blueprint(auth_bp, url_prefix='/api/auth')

login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    try:
        return db.session.get(User, user_id)
    except Exception:
        return None

@login_manager.unauthorized_handler
def unauthorized_callback():
    return jsonify({"error": "Unauthorized"}), 401

# --- AI HELPER FUNCTION (GEMINI VERSION) ---
def enrich_results_with_ai(user_query, results):
    """
    Sends scraped titles to Gemini to determine relevance.
    Uses batching to handle large lists (e.g. 300+ items).
    """
    if not results: return []
    if not os.environ.get("GOOGLE_API_KEY"):
        logger.warning("Skipping AI enrichment (No API Key)")
        for r in results: r['relevance_score'] = 100
        return results

    # Configuration for Gemini 1.5 Flash (Fast & Cheap)
    generation_config = {
        "temperature": 0.1,
        "top_p": 0.95,
        "top_k": 64,
        "max_output_tokens": 8192,
        "response_mime_type": "application/json",
    }
    
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=generation_config,
    )

    # Helper function to process a specific chunk of items
    def process_chunk(chunk_items):
        try:
            # Create prompt
            prompt = f"""
            User Query: "{user_query}"
            
            Task: Analyze these products. Assign a 'relevance_score' (0-100).
            - 90-100: Exact match.
            - 70-89: Good match (variant/color).
            - 10-39: Accessory (Case/Cover) unless queried.
            - 0-9: Irrelevant.

            Return JSON: {{ "evaluations": [ {{ "id": 123, "score": 90 }} ] }}
            
            Products: {json.dumps(chunk_items)}
            """
            
            response = model.generate_content(prompt)
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Gemini chunk failed: {e}")
            return None

    # Prepare list with global IDs to maintain order/mapping
    # 

[Image of Batch Processing Flow]

    # We assign a unique ID (the index) to every item before splitting
    items_to_check = [
        {"id": i, "title": item.get('PRODUCT NAME', ''), "price": item.get('PRICE', '')} 
        for i, item in enumerate(results)
    ]

    BATCH_SIZE = 50
    total_evaluations = {}
    
    # Process in batches
    for i in range(0, len(items_to_check), BATCH_SIZE):
        batch = items_to_check[i:i + BATCH_SIZE]
        logger.info(f"Processing AI batch {i} to {i + len(batch)}...")
        
        ai_response = process_chunk(batch)
        
        if ai_response and "evaluations" in ai_response:
            for eval_item in ai_response["evaluations"]:
                total_evaluations[eval_item['id']] = eval_item['score']
        
        # Short sleep to prevent rate limiting issues
        time.sleep(1) 

    # Merge scores back into the original results list
    for i, item in enumerate(results):
        item['relevance_score'] = total_evaluations.get(i, 50) # Default to 50 if AI failed for a specific item

    return results

# --- AUTH HELPERS ---
def check_admin_auth():
    if 'admin_user' in session:
        return session['admin_user']
    return None

def is_super_admin():
    admin = check_admin_auth()
    return admin and admin.get('role') == 'admin'

# --- ADMIN ROUTES ---
@app.route('/api/admin/employees', methods=['POST'])
def create_employee():
    if not is_super_admin():
        return jsonify({"error": "Unauthorized"}), 403

    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()

        if not all([name, email, password]):
            return jsonify({"error": "All fields required"}), 400

        if AdminUser.query.filter_by(email=email).first():
            return jsonify({"error": "Email already exists"}), 400

        new_emp = AdminUser(
            name=name,
            email=email,
            password=generate_password_hash(password),
            role='employee',
            is_active=True
        )
        db.session.add(new_emp)
        db.session.commit()

        return jsonify({"message": "Employee created"})
    except Exception as e:
        logger.error(f"Error creating employee: {e}")
        return jsonify({"error": "Failed"}), 500

@app.route('/api/admin/employees/<employee_id>', methods=['PUT'])
def update_employee(employee_id):
    if not is_super_admin():
        return jsonify({"error": "Unauthorized"}), 403

    try:
        emp = db.session.get(AdminUser, employee_id)
        if not emp: return jsonify({"error": "Not found"}), 404

        data = request.get_json()
        if 'is_active' in data:
            emp.is_active = data['is_active']
            db.session.commit()
            
        return jsonify({"message": "Updated"})
    except Exception as e:
        logger.error(f"Error updating employee: {e}")
        return jsonify({"error": "Failed"}), 500

@app.route('/api/admin/employees/<employee_id>', methods=['DELETE'])
def delete_employee(employee_id):
    if not is_super_admin():
        return jsonify({"error": "Unauthorized"}), 403

    try:
        emp = db.session.get(AdminUser, employee_id)
        if not emp: return jsonify({"error": "Not found"}), 404

        SupportTicket.query.filter_by(assigned_to=emp.id).update({'assigned_to': None})
        
        db.session.delete(emp)
        db.session.commit()
        return jsonify({"message": "Deleted"})
    except Exception as e:
        logger.error(f"Error deleting employee: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed"}), 500

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    try:
        data = request.get_json()
        email = data.get('email', '').lower().strip()
        password = data.get('password', '')

        admin = AdminUser.query.filter_by(email=email, is_active=True).first()
        
        if not admin or not check_password_hash(admin.password, password):
            return jsonify({"error": "Invalid credentials"}), 401
            
        user_data = {
            'id': admin.id,
            'name': admin.name,
            'email': admin.email,
            'role': admin.role
        }
        
        session.permanent = True
        session['admin_user'] = user_data 
        
        return jsonify({"message": "Login successful", "user": user_data})
    
    except Exception as e:
        logger.error(f"Admin login error: {e}")
        return jsonify({"error": "Server error"}), 500
    
@app.route('/api/admin/users', methods=['GET'])
def get_admin_users():
    if not is_super_admin():
        return jsonify({"error": "Unauthorized"}), 403
        
    try:
        users = User.query.order_by(User.created_at.desc()).all()
        user_list = []
        
        for u in users:
            ticket_count = SupportTicket.query.filter_by(user_id=u.id).count()
            
            user_list.append({
                'id': u.id,
                'name': u.name,
                'email': u.email,
                'created_at': u.created_at.isoformat() if u.created_at else None,
                'is_active': u.is_active,
                'ticket_count': ticket_count
            })
            
        return jsonify({"users": user_list})
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return jsonify({"error": "Failed to fetch users"}), 500

@app.route('/api/admin/status', methods=['GET'])
def admin_status():
    admin = check_admin_auth()
    if admin:
        return jsonify(admin)
    return jsonify({"authenticated": False}), 401

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    session.pop('admin_user', None)
    return jsonify({"message": "Logged out"})

@app.route('/api/admin/tickets', methods=['GET'])
def get_admin_tickets():
    admin = check_admin_auth()
    if not admin:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        query = db.session.query(SupportTicket).order_by(SupportTicket.created_at.desc())
        
        if admin['role'] == 'employee':
            query = query.filter(SupportTicket.assigned_to == admin['id'])
            
        tickets = query.all()
        results = []
        
        for t in tickets:
            user = db.session.get(User, t.user_id)
            assigned = db.session.get(AdminUser, t.assigned_to) if t.assigned_to else None
            
            results.append({
                'id': t.id,
                'ticket_number': t.ticket_number,
                'subject': t.subject,
                'status': t.status,
                'urgency': t.urgency,
                'description': t.description,
                'created_at': t.created_at.isoformat(),
                'user_name': user.name if user else "Unknown",
                'user_email': user.email if user else "Unknown",
                'assigned_employee_name': assigned.name if assigned else None
            })
            
        return jsonify({"tickets": results})
    except Exception as e:
        logger.error(f"Admin ticket fetch error: {e}")
        return jsonify({"error": "Failed to fetch tickets"}), 500

@app.route('/api/tickets/unassigned', methods=['GET'])
def get_unassigned():
    if not is_super_admin():
        return jsonify({"error": "Unauthorized"}), 403
        
    tickets = SupportTicket.query.filter(SupportTicket.assigned_to == None).all()
    data = []
    for t in tickets:
        user = db.session.get(User, t.user_id)
        data.append({
            'id': t.id,
            'ticket_number': t.ticket_number,
            'subject': t.subject,
            'urgency': t.urgency,
            'user_name': user.name if user else "Unknown",
            'user_email': user.email if user else "Unknown",
            'created_at': t.created_at.isoformat()
        })
    return jsonify({"tickets": data})

@app.route('/api/admin/employees', methods=['GET'])
def get_employees():
    if not is_super_admin():
        return jsonify({"error": "Unauthorized"}), 403
        
    emps = AdminUser.query.filter_by(role='employee').all()
    data = []
    for e in emps:
        active_tickets = SupportTicket.query.filter(
            SupportTicket.assigned_to == e.id,
            SupportTicket.status.in_(['open', 'in_progress']) 
        ).count()
        
        total_tickets = SupportTicket.query.filter_by(assigned_to=e.id).count()

        data.append({
            'id': e.id,
            'name': e.name,
            'email': e.email,
            'active_tickets': active_tickets,
            'ticket_count': total_tickets,
            'is_active': e.is_active,
            'created_at': e.created_at.isoformat() if hasattr(e, 'created_at') and e.created_at else None
        })
    return jsonify({"employees": data})

@app.route('/api/tickets/assign', methods=['POST'])
def assign_ticket():
    if not is_super_admin():
        return jsonify({"error": "Unauthorized"}), 403
        
    data = request.get_json()
    ticket = db.session.get(SupportTicket, data.get('ticket_id'))
    employee = db.session.get(AdminUser, data.get('employee_id'))
    
    if not ticket or not employee:
        return jsonify({"error": "Not found"}), 404
        
    ticket.assigned_to = employee.id
    ticket.status = 'in_progress'
    
    log = EmployeeTicketAssignment(
        ticket_id=ticket.id, 
        employee_id=employee.id, 
        assigned_by=check_admin_auth()['id']
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({"message": "Assigned successfully", "employee_name": employee.name})

@app.route('/api/tickets/<ticket_id>', methods=['GET'])
def get_admin_ticket_detail(ticket_id):
    admin = check_admin_auth()
    if not admin:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        ticket = db.session.get(SupportTicket, ticket_id)
        if not ticket:
            return jsonify({"error": "Not found"}), 404

        if admin['role'] == 'employee' and ticket.assigned_to != admin['id']:
            return jsonify({"error": "Access denied"}), 403

        user = db.session.get(User, ticket.user_id)
        assigned = db.session.get(AdminUser, ticket.assigned_to) if ticket.assigned_to else None

        return jsonify({
            'id': ticket.id,
            'ticket_number': ticket.ticket_number,
            'subject': ticket.subject,
            'description': ticket.description,
            'urgency': ticket.urgency,
            'status': ticket.status,
            'attachment_paths': ticket.attachment_paths or [],
            'created_at': ticket.created_at.isoformat(),
            'updated_at': ticket.updated_at.isoformat() if ticket.updated_at else None,
            'user': {
                'id': user.id if user else None,
                'name': user.name if user else 'Unknown',
                'email': user.email if user else 'Unknown'
            },
            'assigned_employee': assigned.name if assigned else None
        })
    except Exception as e:
        logger.error(f"Error fetching ticket detail: {e}")
        return jsonify({"error": "Server error"}), 500

@app.route('/api/tickets/<ticket_id>/status', methods=['PUT'])
def update_ticket_status(ticket_id):
    admin = check_admin_auth()
    if not admin:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        ticket = db.session.get(SupportTicket, ticket_id)
        if not ticket: return jsonify({"error": "Not found"}), 404

        if admin['role'] == 'employee' and ticket.assigned_to != admin['id']:
            return jsonify({"error": "Access denied"}), 403

        data = request.get_json()
        new_status = data.get('status')
        if new_status in ['open', 'in_progress', 'resolved', 'closed']:
            ticket.status = new_status
            ticket.updated_at = datetime.now(timezone.utc)
            db.session.commit()
            return jsonify({"message": "Status updated", "new_status": new_status})
        return jsonify({"error": "Invalid status"}), 400
    except Exception as e:
        logger.error(f"Error updating status: {e}")
        return jsonify({"error": "Failed"}), 500

@app.route('/api/tickets/<ticket_id>/reply', methods=['POST'])
def admin_reply_ticket(ticket_id):
    admin = check_admin_auth()
    if not admin:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        ticket = db.session.get(SupportTicket, ticket_id)
        if not ticket: return jsonify({"error": "Not found"}), 404

        if admin['role'] == 'employee' and ticket.assigned_to != admin['id']:
            return jsonify({"error": "Access denied"}), 403

        data = request.get_json()
        reply_text = data.get('reply', '').strip()
        
        if not reply_text:
            return jsonify({"error": "Reply required"}), 400

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
        ticket.description += f"\n\n--- REPLY ({timestamp}) ---\n"
        ticket.description += f"By: {admin['name']} ({admin['role']})\n"
        ticket.description += f"{reply_text}\n"
        
        if ticket.status == 'open':
            ticket.status = 'in_progress'
            
        ticket.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        
        return jsonify({"message": "Reply added"})
    except Exception as e:
        logger.error(f"Error replying: {e}")
        return jsonify({"error": "Failed"}), 500

@app.route('/api/dashboard/stats', methods=['GET'])
def dashboard_stats():
    admin = check_admin_auth()
    if not admin: return jsonify({"error": "Unauthorized"}), 401
    
    total_tickets = SupportTicket.query.count()
    
    open_count = SupportTicket.query.filter_by(status='open').count()
    progress_count = SupportTicket.query.filter_by(status='in_progress').count()
    resolved_count = SupportTicket.query.filter_by(status='resolved').count()
    closed_count = SupportTicket.query.filter_by(status='closed').count()
    
    critical_count = SupportTicket.query.filter_by(urgency='critical').count()
    high_count = SupportTicket.query.filter_by(urgency='high').count()
    medium_count = SupportTicket.query.filter_by(urgency='medium').count()
    low_count = SupportTicket.query.filter_by(urgency='low').count()

    total_users = User.query.count()
    total_employees = AdminUser.query.filter_by(role='employee', is_active=True).count()

    stats = {
        'total_tickets': total_tickets,
        'total_users': total_users,
        'total_employees': total_employees,
        'tickets_by_status': {
            'open': open_count,
            'in_progress': progress_count, 
            'resolved': resolved_count,
            'closed': closed_count
        },
        'tickets_by_urgency': {
            'critical': critical_count,
            'high': high_count,
            'medium': medium_count,
            'low': low_count
        }
    }
    return jsonify(stats)

@app.route("/api/user")
@login_required
def get_user():
    return jsonify({
        'id': current_user.id,
        'name': current_user.name,
        'email': current_user.email,
        'authenticated': True
    })

# --- SEARCH AND SCRAPE ROUTES ---
@app.route("/api/scrape", methods=["POST"])
@login_required
def scrape_products():
    print(f"Current user: {current_user}")
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

                bulk = SearchHistory(
                    user_id=current_user.id,
                    brand="Bulk Upload",
                    product=f"{len(df)} products",
                    search_type='bulk',
                    created_at=datetime.now(timezone.utc)
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
                            gc.collect()
                            if site_name == "amazon":
                                os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                                time.sleep(0.2)
                                data = scraper(brand, product)
                                if "SELECTED_AMAZON_DOMAIN" in os.environ:
                                    del os.environ["SELECTED_AMAZON_DOMAIN"]
                            else:
                                data = scraper(brand, product, oem, asin)

                            if isinstance(data, dict) and "error" in data:
                                error = data["error"]
                            else:
                                for d in data.get("data", []):
                                    d["WEBSITE"] = site_name.capitalize()
                                    results.append(d)

                            if site_name == "amazon":
                                time.sleep(random.uniform(5, 10))

                        except Exception as scrape_error:
                            logger.exception(f"Error scraping {site_name}: {scrape_error}")
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
            amazon_domain = data.get("amazon_country", "amazon.com").strip() or "amazon.com"

            if not brand or not product:
                return jsonify({"error": "Brand and Product required"}), 400
                
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

            sites_to_scrape = SCRAPERS.keys() if not website else [website]

            for site in sites_to_scrape:
                if site not in SCRAPERS:
                    continue

                scraper = SCRAPERS[site]

                try:
                    gc.collect()
                    if site == "amazon":
                        os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
                        data = scraper(brand, product)
                        if "SELECTED_AMAZON_DOMAIN" in os.environ:
                            del os.environ["SELECTED_AMAZON_DOMAIN"]
                    else:
                        data = scraper(brand, product, oem, asin)

                    if data is None: continue
                    if not isinstance(data, dict): continue

                    if isinstance(data, dict) and "error" in data:
                        error = data["error"]
                    else:
                        for d in data.get("data", []):
                            d["WEBSITE"] = site.capitalize()
                            results.append(d)
                            
                    if site == "amazon":
                        time.sleep(random.uniform(3, 7))

                except Exception as scrape_error:
                    logger.exception(f"Error scraping {site}: {scrape_error}")
                    continue
            
            # --- AI SMART FILTER INTEGRATION (GEMINI) ---
            if results:
                logger.info(f"Enriching {len(results)} scraped items with AI scores...")
                query_context = f"{brand} {product}"
                if oem: query_context += f" (OEM: {oem})"
                
                results = enrich_results_with_ai(query_context, results)

        if not results and not error:
            error = "No results found."

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
    try:
        history = SearchHistory.query.filter_by(user_id=current_user.id)\
            .order_by(SearchHistory.created_at.desc())\
            .limit(20).all()

        history_data = []
        for h in history:
            formatted_date = h.created_at.isoformat() if h.created_at else None

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
        if current_user.created_at is None:
            current_user.created_at = user_created_at
            db.session.commit()

        return jsonify({
            "user": {
                "name": current_user.name,
                "email": current_user.email,
                "created_at": user_created_at.isoformat()
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

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/api/support/tickets", methods=["GET"])
@login_required
def get_user_tickets():
    try:
        tickets = SupportTicket.query.filter_by(user_id=current_user.id)\
            .order_by(SupportTicket.created_at.desc())\
            .all()
        
        tickets_data = []
        for ticket in tickets:
            tickets_data.append({
                'id': ticket.id,
                'ticket_number': ticket.ticket_number,
                'subject': ticket.subject,
                'description': ticket.description,
                'urgency': ticket.urgency,
                'status': ticket.status,
                'attachment_paths': ticket.attachment_paths or [],
                'created_at': ticket.created_at.replace(tzinfo=timezone.utc).isoformat(),
                'updated_at': ticket.updated_at.isoformat() + 'Z' if ticket.updated_at else None
            })
        
        return jsonify({'tickets': tickets_data})
    except Exception as e:
        logger.exception("Error fetching tickets")
        return jsonify({"error": "Failed to fetch tickets"}), 500

@app.route("/api/support/create-ticket", methods=["POST"])
@login_required
def create_support_ticket():
    try:
        subject = request.form.get('subject', '').strip()
        description = request.form.get('description', '').strip()
        urgency = request.form.get('urgency', 'medium').strip().lower()
        
        if not subject or not description:
            return jsonify({"error": "Subject and description are required"}), 400
        
        if urgency not in ['low', 'medium', 'high', 'critical']:
            urgency = 'medium'
        
        attachment_paths = []
        
        if 'attachments' in request.files:
            files = request.files.getlist('attachments')
            
            for file in files:
                if file and file.filename:
                    if file.content_length > MAX_FILE_SIZE:
                        return jsonify({"error": f"File {file.filename} exceeds 10MB limit"}), 400
                    
                    if allowed_file(file.filename):
                        filename = secure_filename(file.filename)
                        unique_filename = f"{uuid.uuid4().hex}_{filename}"
                        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
                        
                        file.save(file_path)
                        
                        web_path = f"/static/uploads/tickets/{unique_filename}"
                        attachment_paths.append({
                            'original_name': filename,
                            'stored_name': unique_filename,
                            'path': web_path
                        })
        
        new_ticket = SupportTicket(
            user_id=current_user.id,
            subject=subject,
            description=description,
            urgency=urgency,
            attachment_paths=attachment_paths
        )
        
        db.session.add(new_ticket)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Ticket created successfully",
            "ticket_id": new_ticket.id,
            "ticket_number": new_ticket.ticket_number
        })
        
    except Exception as e:
        logger.exception("Error creating ticket")
        db.session.rollback()
        return jsonify({"error": "Failed to create ticket"}), 500
    
@app.route('/api/setup-admin', methods=['GET'])
def setup_admin():
    if AdminUser.query.first():
        return "Admin already exists"
    
    admin = AdminUser(
        email='admin@tutomart.com',
        password=generate_password_hash('Admin@123'),
        name='Super Admin',
        role='admin'
    )
    db.session.add(admin)
    db.session.commit()
    return "Admin created: admin@tutomart.com / Admin@123"

@app.route("/api/support/ticket/<ticket_id>", methods=["GET"])
@login_required
def get_ticket_details(ticket_id):
    try:
        ticket = SupportTicket.query.filter_by(
            id=ticket_id, 
            user_id=current_user.id
        ).first()
        
        if not ticket:
            return jsonify({"error": "Ticket not found"}), 404
        
        return jsonify({
            'id': ticket.id,
            'ticket_number': ticket.ticket_number,
            'subject': ticket.subject,
            'description': ticket.description,
            'urgency': ticket.urgency,
            'status': ticket.status,
            'attachment_paths': ticket.attachment_paths or [],
            'created_at': ticket.created_at.replace(tzinfo=timezone.utc).isoformat(),
            'updated_at': ticket.updated_at.isoformat() + 'Z' if ticket.updated_at else None
        })
        
    except Exception as e:
        logger.exception("Error fetching ticket details")
        return jsonify({"error": "Failed to fetch ticket details"}), 500

@app.route('/static/uploads/tickets/<filename>')
def serve_ticket_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder + '/static', path)

@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)

    return send_from_directory(app.static_folder, 'index.html')

if __name__ == "__main__":
    create_tables(app)
    app.run(debug=False, host='0.0.0.0', port=8080)

# from flask import Flask, request, jsonify, send_from_directory, session
# from flask_login import LoginManager, current_user, login_required
# from flask_cors import CORS
# from db_models import db, User, SearchHistory, SupportTicket, AdminUser, EmployeeTicketAssignment, create_tables
# from auth_config import Config
# from auth_routes import auth_bp, init_oauth
# import pandas as pd
# import time, random, os, tempfile, gc, logging
# from datetime import datetime, timezone, timedelta
# from werkzeug.middleware.proxy_fix import ProxyFix
# from werkzeug.utils import secure_filename
# from werkzeug.security import check_password_hash, generate_password_hash
# import uuid

# from scrapers.amazon_scraper import scrape_amazon
# from scrapers.flipkart_scraper import scrape_flipkart
# from scrapers.ebay_scraper import scrape_ebay
# from scrapers.snapdeal_scraper import scrape_snapdeal
# from scrapers.amitretail_scraper import scrape_amitretail
# from scrapers.noon_scraper import scrape_noon
# from scrapers.sharafdg_scraper import scrape_sharafdg
# from scrapers.ntsuae_scraper import scrape_ntsuae
# from scrapers.seazoneuae_scraper import scrape_seazoneuae
# from scrapers.empiremarine_scraper import scrape_empiremarine
# from scrapers.climaxmarine_scraper import scrape_climaxmarine

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'txt'}
# MAX_FILE_SIZE = 10 * 1024 * 1024
# UPLOAD_FOLDER = 'static/uploads/tickets'
# os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# SCRAPERS = {
#     "amazon": scrape_amazon,
#     "flipkart": scrape_flipkart,
#     "ebay": scrape_ebay,
#     "snapdeal": scrape_snapdeal,
#     "amitretail": scrape_amitretail,
#     "noon": scrape_noon,
#     "sharafdg": scrape_sharafdg,
#     "ntsuae": scrape_ntsuae,
#     "seazoneuae": scrape_seazoneuae,
#     "empiremarine": scrape_empiremarine,
#     "climaxmarine": scrape_climaxmarine
# }

# app = Flask(__name__, static_folder='frontend/build', static_url_path='/')
# app.config.from_object(Config)
# app.wsgi_app = ProxyFix(
#     app.wsgi_app,
#     x_for=1,
#     x_proto=1,
#     x_host=1,
#     x_port=1,
#     x_prefix=1
# )

# if not app.config.get("SECRET_KEY"):
#     app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-for-local")

# app.config.update({
#     "SESSION_COOKIE_SECURE": True,
#     "SESSION_COOKIE_SAMESITE": "Lax",
#     "SESSION_COOKIE_HTTPONLY": True,
#     "SESSION_COOKIE_DOMAIN": "tutomart.com",
#     "REMEMBER_COOKIE_SAMESITE": "Lax",
#     "REMEMBER_COOKIE_SECURE": True,
#     "REMEMBER_COOKIE_DOMAIN": "tutomart.com",
#     "PERMANENT_SESSION_LIFETIME": timedelta(days=7)
# })

# CORS(app,
#      supports_credentials=True,
#      origins=["https://tutomart.com", "https://www.tutomart.com"],
#      allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
#      methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
#      expose_headers=["Content-Type", "Authorization"])

# db.init_app(app)
# init_oauth(app)

# app.register_blueprint(auth_bp, url_prefix='/api/auth')

# login_manager = LoginManager()
# login_manager.init_app(app)

# @login_manager.user_loader
# def load_user(user_id):
#     try:
#         return db.session.get(User, user_id)
#     except Exception:
#         return None

# @login_manager.unauthorized_handler
# def unauthorized_callback():
#     return jsonify({"error": "Unauthorized"}), 401

# def check_admin_auth():
#     if 'admin_user' in session:
#         return session['admin_user']
#     return None

# def is_super_admin():
#     admin = check_admin_auth()
#     return admin and admin.get('role') == 'admin'

# @app.route('/api/admin/employees', methods=['POST'])
# def create_employee():
#     """Create new employee (Admin Only)"""
#     if not is_super_admin():
#         return jsonify({"error": "Unauthorized"}), 403

#     try:
#         data = request.get_json()
#         name = data.get('name', '').strip()
#         email = data.get('email', '').strip().lower()
#         password = data.get('password', '').strip()

#         if not all([name, email, password]):
#             return jsonify({"error": "All fields required"}), 400

#         if AdminUser.query.filter_by(email=email).first():
#             return jsonify({"error": "Email already exists"}), 400

#         new_emp = AdminUser(
#             name=name,
#             email=email,
#             password=generate_password_hash(password),
#             role='employee',
#             is_active=True
#         )
#         db.session.add(new_emp)
#         db.session.commit()

#         return jsonify({"message": "Employee created"})
#     except Exception as e:
#         logger.error(f"Error creating employee: {e}")
#         return jsonify({"error": "Failed"}), 500

# @app.route('/api/admin/employees/<employee_id>', methods=['PUT'])
# def update_employee(employee_id):
#     """Toggle Employee Status (Admin Only)"""
#     if not is_super_admin():
#         return jsonify({"error": "Unauthorized"}), 403

#     try:
#         emp = db.session.get(AdminUser, employee_id)
#         if not emp: return jsonify({"error": "Not found"}), 404

#         data = request.get_json()
#         if 'is_active' in data:
#             emp.is_active = data['is_active']
#             db.session.commit()
            
#         return jsonify({"message": "Updated"})
#     except Exception as e:
#         logger.error(f"Error updating employee: {e}")
#         return jsonify({"error": "Failed"}), 500

# @app.route('/api/admin/employees/<employee_id>', methods=['DELETE'])
# def delete_employee(employee_id):
#     """Delete Employee (Admin Only)"""
#     if not is_super_admin():
#         return jsonify({"error": "Unauthorized"}), 403

#     try:
#         emp = db.session.get(AdminUser, employee_id)
#         if not emp: return jsonify({"error": "Not found"}), 404

#         SupportTicket.query.filter_by(assigned_to=emp.id).update({'assigned_to': None})
        
#         db.session.delete(emp)
#         db.session.commit()
#         return jsonify({"message": "Deleted"})
#     except Exception as e:
#         logger.error(f"Error deleting employee: {e}")
#         db.session.rollback()
#         return jsonify({"error": "Failed"}), 500

# @app.route('/api/admin/login', methods=['POST'])
# def admin_login():
#     try:
#         data = request.get_json()
#         email = data.get('email', '').lower().strip()
#         password = data.get('password', '')

#         admin = AdminUser.query.filter_by(email=email, is_active=True).first()
        
#         if not admin or not check_password_hash(admin.password, password):
#             return jsonify({"error": "Invalid credentials"}), 401
            
#         user_data = {
#             'id': admin.id,
#             'name': admin.name,
#             'email': admin.email,
#             'role': admin.role
#         }
        
#         session.permanent = True
#         session['admin_user'] = user_data 
        
#         return jsonify({"message": "Login successful", "user": user_data})
    
#     except Exception as e:
#         logger.error(f"Admin login error: {e}")
#         return jsonify({"error": "Server error"}), 500
    
# @app.route('/api/admin/users', methods=['GET'])
# def get_admin_users():
#     if not is_super_admin():
#         return jsonify({"error": "Unauthorized"}), 403
        
#     try:
#         users = User.query.order_by(User.created_at.desc()).all()
#         user_list = []
        
#         for u in users:
#             ticket_count = SupportTicket.query.filter_by(user_id=u.id).count()
            
#             user_list.append({
#                 'id': u.id,
#                 'name': u.name,
#                 'email': u.email,
#                 'created_at': u.created_at.isoformat() if u.created_at else None,
#                 'is_active': u.is_active,
#                 'ticket_count': ticket_count
#             })
            
#         return jsonify({"users": user_list})
#     except Exception as e:
#         logger.error(f"Error fetching users: {e}")
#         return jsonify({"error": "Failed to fetch users"}), 500

# @app.route('/api/admin/status', methods=['GET'])
# def admin_status():
#     admin = check_admin_auth()
#     if admin:
#         return jsonify(admin)
#     return jsonify({"authenticated": False}), 401

# @app.route('/api/admin/logout', methods=['POST'])
# def admin_logout():
#     session.pop('admin_user', None)
#     return jsonify({"message": "Logged out"})

# @app.route('/api/admin/tickets', methods=['GET'])
# def get_admin_tickets():
#     admin = check_admin_auth()
#     if not admin:
#         return jsonify({"error": "Unauthorized"}), 401

#     try:
#         query = db.session.query(SupportTicket).order_by(SupportTicket.created_at.desc())
        
#         if admin['role'] == 'employee':
#             query = query.filter(SupportTicket.assigned_to == admin['id'])
            
#         tickets = query.all()
#         results = []
        
#         for t in tickets:
#             user = db.session.get(User, t.user_id)
#             assigned = db.session.get(AdminUser, t.assigned_to) if t.assigned_to else None
            
#             results.append({
#                 'id': t.id,
#                 'ticket_number': t.ticket_number,
#                 'subject': t.subject,
#                 'status': t.status,
#                 'urgency': t.urgency,
#                 'description': t.description,
#                 'created_at': t.created_at.isoformat(),
#                 'user_name': user.name if user else "Unknown",
#                 'user_email': user.email if user else "Unknown",
#                 'assigned_employee_name': assigned.name if assigned else None
#             })
            
#         return jsonify({"tickets": results})
#     except Exception as e:
#         logger.error(f"Admin ticket fetch error: {e}")
#         return jsonify({"error": "Failed to fetch tickets"}), 500

# @app.route('/api/tickets/unassigned', methods=['GET'])
# def get_unassigned():
#     if not is_super_admin():
#         return jsonify({"error": "Unauthorized"}), 403
        
#     tickets = SupportTicket.query.filter(SupportTicket.assigned_to == None).all()
#     data = []
#     for t in tickets:
#         user = db.session.get(User, t.user_id)
#         data.append({
#             'id': t.id,
#             'ticket_number': t.ticket_number,
#             'subject': t.subject,
#             'urgency': t.urgency,
#             'user_name': user.name if user else "Unknown",
#             'user_email': user.email if user else "Unknown",
#             'created_at': t.created_at.isoformat()
#         })
#     return jsonify({"tickets": data})

# @app.route('/api/admin/employees', methods=['GET'])
# def get_employees():
#     if not is_super_admin():
#         return jsonify({"error": "Unauthorized"}), 403
        
#     emps = AdminUser.query.filter_by(role='employee').all()
#     data = []
#     for e in emps:
#         active_tickets = SupportTicket.query.filter(
#             SupportTicket.assigned_to == e.id,
#             SupportTicket.status.in_(['open', 'in_progress']) 
#         ).count()
        
#         total_tickets = SupportTicket.query.filter_by(assigned_to=e.id).count()

#         data.append({
#             'id': e.id,
#             'name': e.name,
#             'email': e.email,
#             'active_tickets': active_tickets,
#             'ticket_count': total_tickets,
#             'is_active': e.is_active,
#             'created_at': e.created_at.isoformat() if hasattr(e, 'created_at') and e.created_at else None
#         })
#     return jsonify({"employees": data})

# @app.route('/api/tickets/assign', methods=['POST'])
# def assign_ticket():
#     if not is_super_admin():
#         return jsonify({"error": "Unauthorized"}), 403
        
#     data = request.get_json()
#     ticket = db.session.get(SupportTicket, data.get('ticket_id'))
#     employee = db.session.get(AdminUser, data.get('employee_id'))
    
#     if not ticket or not employee:
#         return jsonify({"error": "Not found"}), 404
        
#     ticket.assigned_to = employee.id
#     ticket.status = 'in_progress'
    
#     log = EmployeeTicketAssignment(
#         ticket_id=ticket.id, 
#         employee_id=employee.id, 
#         assigned_by=check_admin_auth()['id']
#     )
#     db.session.add(log)
#     db.session.commit()
    
#     return jsonify({"message": "Assigned successfully", "employee_name": employee.name})

# @app.route('/api/tickets/<ticket_id>', methods=['GET'])
# def get_admin_ticket_detail(ticket_id):
#     """Admin: Get specific ticket details"""
#     admin = check_admin_auth()
#     if not admin:
#         return jsonify({"error": "Unauthorized"}), 401

#     try:
#         ticket = db.session.get(SupportTicket, ticket_id)
#         if not ticket:
#             return jsonify({"error": "Not found"}), 404

#         if admin['role'] == 'employee' and ticket.assigned_to != admin['id']:
#             return jsonify({"error": "Access denied"}), 403

#         user = db.session.get(User, ticket.user_id)
#         assigned = db.session.get(AdminUser, ticket.assigned_to) if ticket.assigned_to else None

#         return jsonify({
#             'id': ticket.id,
#             'ticket_number': ticket.ticket_number,
#             'subject': ticket.subject,
#             'description': ticket.description,
#             'urgency': ticket.urgency,
#             'status': ticket.status,
#             'attachment_paths': ticket.attachment_paths or [],
#             'created_at': ticket.created_at.isoformat(),
#             'updated_at': ticket.updated_at.isoformat() if ticket.updated_at else None,
#             'user': {
#                 'id': user.id if user else None,
#                 'name': user.name if user else 'Unknown',
#                 'email': user.email if user else 'Unknown'
#             },
#             'assigned_employee': assigned.name if assigned else None
#         })
#     except Exception as e:
#         logger.error(f"Error fetching ticket detail: {e}")
#         return jsonify({"error": "Server error"}), 500

# @app.route('/api/tickets/<ticket_id>/status', methods=['PUT'])
# def update_ticket_status(ticket_id):
#     """Admin: Update ticket status"""
#     admin = check_admin_auth()
#     if not admin:
#         return jsonify({"error": "Unauthorized"}), 401

#     try:
#         ticket = db.session.get(SupportTicket, ticket_id)
#         if not ticket: return jsonify({"error": "Not found"}), 404

#         if admin['role'] == 'employee' and ticket.assigned_to != admin['id']:
#             return jsonify({"error": "Access denied"}), 403

#         data = request.get_json()
#         new_status = data.get('status')
#         if new_status in ['open', 'in_progress', 'resolved', 'closed']:
#             ticket.status = new_status
#             ticket.updated_at = datetime.now(timezone.utc)
#             db.session.commit()
#             return jsonify({"message": "Status updated", "new_status": new_status})
#         return jsonify({"error": "Invalid status"}), 400
#     except Exception as e:
#         logger.error(f"Error updating status: {e}")
#         return jsonify({"error": "Failed"}), 500

# @app.route('/api/tickets/<ticket_id>/reply', methods=['POST'])
# def admin_reply_ticket(ticket_id):
#     """Admin: Reply to ticket"""
#     admin = check_admin_auth()
#     if not admin:
#         return jsonify({"error": "Unauthorized"}), 401

#     try:
#         ticket = db.session.get(SupportTicket, ticket_id)
#         if not ticket: return jsonify({"error": "Not found"}), 404

#         if admin['role'] == 'employee' and ticket.assigned_to != admin['id']:
#             return jsonify({"error": "Access denied"}), 403

#         data = request.get_json()
#         reply_text = data.get('reply', '').strip()
        
#         if not reply_text:
#             return jsonify({"error": "Reply required"}), 400

#         timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
#         ticket.description += f"\n\n--- REPLY ({timestamp}) ---\n"
#         ticket.description += f"By: {admin['name']} ({admin['role']})\n"
#         ticket.description += f"{reply_text}\n"
        
#         if ticket.status == 'open':
#             ticket.status = 'in_progress'
            
#         ticket.updated_at = datetime.now(timezone.utc)
#         db.session.commit()
        
#         return jsonify({"message": "Reply added"})
#     except Exception as e:
#         logger.error(f"Error replying: {e}")
#         return jsonify({"error": "Failed"}), 500

# @app.route('/api/dashboard/stats', methods=['GET'])
# def dashboard_stats():
#     admin = check_admin_auth()
#     if not admin: return jsonify({"error": "Unauthorized"}), 401
    
#     total_tickets = SupportTicket.query.count()
    
#     open_count = SupportTicket.query.filter_by(status='open').count()
#     progress_count = SupportTicket.query.filter_by(status='in_progress').count()
#     resolved_count = SupportTicket.query.filter_by(status='resolved').count()
#     closed_count = SupportTicket.query.filter_by(status='closed').count()
    
#     critical_count = SupportTicket.query.filter_by(urgency='critical').count()
#     high_count = SupportTicket.query.filter_by(urgency='high').count()
#     medium_count = SupportTicket.query.filter_by(urgency='medium').count()
#     low_count = SupportTicket.query.filter_by(urgency='low').count()

#     total_users = User.query.count()
#     total_employees = AdminUser.query.filter_by(role='employee', is_active=True).count()

#     stats = {
#         'total_tickets': total_tickets,
#         'total_users': total_users,
#         'total_employees': total_employees,
#         'tickets_by_status': {
#             'open': open_count,
#             'in_progress': progress_count, 
#             'resolved': resolved_count,
#             'closed': closed_count
#         },
#         'tickets_by_urgency': {
#             'critical': critical_count,
#             'high': high_count,
#             'medium': medium_count,
#             'low': low_count
#         }
#     }
#     return jsonify(stats)

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
#                             gc.collect()
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
#                     gc.collect()
#                     if site == "amazon":
#                         os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
#                         data = scraper(brand, product)
#                         if "SELECTED_AMAZON_DOMAIN" in os.environ:
#                             del os.environ["SELECTED_AMAZON_DOMAIN"]
#                     else:
#                         data = scraper(brand, product, oem, asin)

#                     if data is None: continue
#                     if not isinstance(data, dict): continue

#                     if isinstance(data, dict) and "error" in data:
#                         error = data["error"]
#                     else:
#                         for d in data.get("data", []):
#                             d["WEBSITE"] = site.capitalize()
#                             results.append(d)
                            
#                     if site == "amazon":
#                         time.sleep(random.uniform(10, 25))

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
#             formatted_date = h.created_at.isoformat() if h.created_at else None

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
#         if current_user.created_at is None:
#             current_user.created_at = user_created_at
#             db.session.commit()

#         return jsonify({
#             "user": {
#                 "name": current_user.name,
#                 "email": current_user.email,
#                 "created_at": user_created_at.isoformat()
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

# def allowed_file(filename):
#     return '.' in filename and \
#            filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# @app.route("/api/support/tickets", methods=["GET"])
# @login_required
# def get_user_tickets():
#     try:
#         tickets = SupportTicket.query.filter_by(user_id=current_user.id)\
#             .order_by(SupportTicket.created_at.desc())\
#             .all()
        
#         tickets_data = []
#         for ticket in tickets:
#             tickets_data.append({
#                 'id': ticket.id,
#                 'ticket_number': ticket.ticket_number,
#                 'subject': ticket.subject,
#                 'description': ticket.description,
#                 'urgency': ticket.urgency,
#                 'status': ticket.status,
#                 'attachment_paths': ticket.attachment_paths or [],
#                 'created_at': ticket.created_at.replace(tzinfo=timezone.utc).isoformat(),
#                 'updated_at': ticket.updated_at.isoformat() + 'Z' if ticket.updated_at else None
#             })
        
#         return jsonify({'tickets': tickets_data})
#     except Exception as e:
#         logger.exception("Error fetching tickets")
#         return jsonify({"error": "Failed to fetch tickets"}), 500

# @app.route("/api/support/create-ticket", methods=["POST"])
# @login_required
# def create_support_ticket():
#     try:
#         subject = request.form.get('subject', '').strip()
#         description = request.form.get('description', '').strip()
#         urgency = request.form.get('urgency', 'medium').strip().lower()
        
#         if not subject or not description:
#             return jsonify({"error": "Subject and description are required"}), 400
        
#         if urgency not in ['low', 'medium', 'high', 'critical']:
#             urgency = 'medium'
        
#         attachment_paths = []
        
#         if 'attachments' in request.files:
#             files = request.files.getlist('attachments')
            
#             for file in files:
#                 if file and file.filename:
#                     if file.content_length > MAX_FILE_SIZE:
#                         return jsonify({"error": f"File {file.filename} exceeds 10MB limit"}), 400
                    
#                     if allowed_file(file.filename):
#                         filename = secure_filename(file.filename)
#                         unique_filename = f"{uuid.uuid4().hex}_{filename}"
#                         file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
                        
#                         file.save(file_path)
                        
#                         web_path = f"/static/uploads/tickets/{unique_filename}"
#                         attachment_paths.append({
#                             'original_name': filename,
#                             'stored_name': unique_filename,
#                             'path': web_path
#                         })
        
#         new_ticket = SupportTicket(
#             user_id=current_user.id,
#             subject=subject,
#             description=description,
#             urgency=urgency,
#             attachment_paths=attachment_paths
#         )
        
#         db.session.add(new_ticket)
#         db.session.commit()
        
#         return jsonify({
#             "success": True,
#             "message": "Ticket created successfully",
#             "ticket_id": new_ticket.id,
#             "ticket_number": new_ticket.ticket_number
#         })
        
#     except Exception as e:
#         logger.exception("Error creating ticket")
#         db.session.rollback()
#         return jsonify({"error": "Failed to create ticket"}), 500
    
# @app.route('/api/setup-admin', methods=['GET'])
# def setup_admin():
#     if AdminUser.query.first():
#         return "Admin already exists"
    
#     admin = AdminUser(
#         email='admin@tutomart.com',
#         password=generate_password_hash('Admin@123'),
#         name='Super Admin',
#         role='admin'
#     )
#     db.session.add(admin)
#     db.session.commit()
#     return "Admin created: admin@tutomart.com / Admin@123"

# @app.route("/api/support/ticket/<ticket_id>", methods=["GET"])
# @login_required
# def get_ticket_details(ticket_id):
#     try:
#         ticket = SupportTicket.query.filter_by(
#             id=ticket_id, 
#             user_id=current_user.id
#         ).first()
        
#         if not ticket:
#             return jsonify({"error": "Ticket not found"}), 404
        
#         return jsonify({
#             'id': ticket.id,
#             'ticket_number': ticket.ticket_number,
#             'subject': ticket.subject,
#             'description': ticket.description,
#             'urgency': ticket.urgency,
#             'status': ticket.status,
#             'attachment_paths': ticket.attachment_paths or [],
#             'created_at': ticket.created_at.replace(tzinfo=timezone.utc).isoformat(),
#             'updated_at': ticket.updated_at.isoformat() + 'Z' if ticket.updated_at else None
#         })
        
#     except Exception as e:
#         logger.exception("Error fetching ticket details")
#         return jsonify({"error": "Failed to fetch ticket details"}), 500

# @app.route('/static/uploads/tickets/<filename>')
# def serve_ticket_file(filename):
#     return send_from_directory(UPLOAD_FOLDER, filename)

# @app.route('/static/<path:path>')
# def serve_static(path):
#     return send_from_directory(app.static_folder + '/static', path)

# @app.route('/uploads/<path:filename>')
# def serve_uploads(filename):
#     return send_from_directory(UPLOAD_FOLDER, filename)

# @app.route('/', defaults={'path': ''})
# @app.route('/<path:path>')
# def serve(path):
#     if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
#         return send_from_directory(app.static_folder, path)

#     return send_from_directory(app.static_folder, 'index.html')

# if __name__ == "__main__":
#     create_tables(app)
#     app.run(debug=False, host='0.0.0.0', port=8080)
    
# from flask import Flask, request, jsonify, send_from_directory
# from flask_login import LoginManager, current_user, login_required
# from flask_cors import CORS
# from db_models import db, User, SearchHistory, SupportTicket ,create_tables
# from auth_config import Config
# from auth_routes import auth_bp, init_oauth
# import pandas as pd
# import time, random, os, tempfile, gc
# from datetime import datetime, timezone
# import logging
# from werkzeug.middleware.proxy_fix import ProxyFix
# import os
# from werkzeug.utils import secure_filename
# import uuid

# # Scrapers
# from scrapers.amazon_scraper import scrape_amazon
# from scrapers.flipkart_scraper import scrape_flipkart
# from scrapers.ebay_scraper import scrape_ebay
# from scrapers.snapdeal_scraper import scrape_snapdeal
# from scrapers.amitretail_scraper import scrape_amitretail
# from scrapers.noon_scraper import scrape_noon
# from scrapers.sharafdg_scraper import scrape_sharafdg
# from scrapers.ntsuae_scraper import scrape_ntsuae
# from scrapers.seazoneuae_scraper import scrape_seazoneuae
# from scrapers.empiremarine_scraper import scrape_empiremarine
# from scrapers.climaxmarine_scraper import scrape_climaxmarine

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'txt'}
# MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
# UPLOAD_FOLDER = 'static/uploads/tickets'
# os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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
#     "sharafdg": scrape_sharafdg,
#     "ntsuae": scrape_ntsuae,
#     "seazoneuae": scrape_seazoneuae,
#     "empiremarine": scrape_empiremarine,
#     "climaxmarine": scrape_climaxmarine
# }

# @login_manager.user_loader
# def load_user(user_id):
#     try:
#         # FIX: Use db.session.get() instead of User.query.get()
#         # PRODUCTION/LOCALHOST: Updated to avoid deprecation warning
#         return db.session.get(User, user_id)
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
#                             gc.collect()
#                             if site_name == "amazon":
#                                 os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
#                                 time.sleep(0.2)
#                                 data = scraper(brand, product)
#                                 if "SELECTED_AMAZON_DOMAIN" in os.environ:
#                                     del os.environ["SELECTED_AMAZON_DOMAIN"]
#                             else:
#                                 data = scraper(brand, product, oem, asin)

#                             # if data is None: continue 
#                             # if not isinstance(data, dict): continue

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
#                     gc.collect()
#                     if site == "amazon":
#                         os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
#                         data = scraper(brand, product)
#                         if "SELECTED_AMAZON_DOMAIN" in os.environ:
#                             del os.environ["SELECTED_AMAZON_DOMAIN"]
#                     else:
#                         data = scraper(brand, product, oem, asin)

#                     if data is None: continue
#                     if not isinstance(data, dict): continue

#                     if isinstance(data, dict) and "error" in data:
#                         error = data["error"]
#                     else:
#                         for d in data.get("data", []):
#                             d["WEBSITE"] = site.capitalize()
#                             results.append(d)
                            
#                     if site == "amazon":
#                         time.sleep(random.uniform(10, 25))

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

# def allowed_file(filename):
#     return '.' in filename and \
#            filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# @app.route("/api/support/tickets", methods=["GET"])
# @login_required
# def get_user_tickets():
#     try:
#         tickets = SupportTicket.query.filter_by(user_id=current_user.id)\
#             .order_by(SupportTicket.created_at.desc())\
#             .all()
        
#         tickets_data = []
#         for ticket in tickets:
#             tickets_data.append({
#                 'id': ticket.id,
#                 'ticket_number': ticket.ticket_number,
#                 'subject': ticket.subject,
#                 'description': ticket.description,
#                 'urgency': ticket.urgency,
#                 'status': ticket.status,
#                 'attachment_paths': ticket.attachment_paths or [],
#                 'created_at': ticket.created_at.replace(tzinfo=timezone.utc).isoformat(),
#                 'updated_at': ticket.updated_at.isoformat() + 'Z' if ticket.updated_at else None
#             })
        
#         return jsonify({'tickets': tickets_data})
#     except Exception as e:
#         logger.exception("Error fetching tickets")
#         return jsonify({"error": "Failed to fetch tickets"}), 500

# @app.route("/api/support/create-ticket", methods=["POST"])
# @login_required
# def create_support_ticket():
#     try:
#         # Get form data
#         subject = request.form.get('subject', '').strip()
#         description = request.form.get('description', '').strip()
#         urgency = request.form.get('urgency', 'medium').strip().lower()
        
#         if not subject or not description:
#             return jsonify({"error": "Subject and description are required"}), 400
        
#         if urgency not in ['low', 'medium', 'high', 'critical']:
#             urgency = 'medium'
        
#         # Handle file uploads
#         attachment_paths = []
        
#         if 'attachments' in request.files:
#             files = request.files.getlist('attachments')
            
#             for file in files:
#                 if file and file.filename:
#                     if file.content_length > MAX_FILE_SIZE:
#                         return jsonify({"error": f"File {file.filename} exceeds 10MB limit"}), 400
                    
#                     if allowed_file(file.filename):
#                         # Generate unique filename
#                         filename = secure_filename(file.filename)
#                         unique_filename = f"{uuid.uuid4().hex}_{filename}"
#                         file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
                        
#                         # Save file
#                         file.save(file_path)
                        
#                         # Store relative path for web access
#                         web_path = f"/static/uploads/tickets/{unique_filename}"
#                         attachment_paths.append({
#                             'original_name': filename,
#                             'stored_name': unique_filename,
#                             'path': web_path
#                         })
        
#         # Create ticket in database
#         new_ticket = SupportTicket(
#             user_id=current_user.id,
#             subject=subject,
#             description=description,
#             urgency=urgency,
#             attachment_paths=attachment_paths
#         )
        
#         db.session.add(new_ticket)
#         db.session.commit()
        
#         return jsonify({
#             "success": True,
#             "message": "Ticket created successfully",
#             "ticket_id": new_ticket.id,
#             "ticket_number": new_ticket.ticket_number
#         })
        
#     except Exception as e:
#         logger.exception("Error creating ticket")
#         db.session.rollback()
#         return jsonify({"error": "Failed to create ticket"}), 500

# # 👇 UPDATED ROUTE: Changed <int:ticket_id> to <string:ticket_id>
# @app.route("/api/support/tickets/<string:ticket_id>", methods=["DELETE"])
# @login_required
# def delete_support_ticket(ticket_id):
#     try:
#         # Find ticket ensuring it belongs to the current user
#         ticket = SupportTicket.query.filter_by(id=ticket_id, user_id=current_user.id).first()
        
#         if not ticket:
#             return jsonify({"error": "Ticket not found or unauthorized"}), 404

#         # Delete from database
#         db.session.delete(ticket)
#         db.session.commit()
        
#         return jsonify({"success": True, "message": "Ticket deleted successfully"})

#     except Exception as e:
#         logger.exception(f"Error deleting ticket {ticket_id}")
#         db.session.rollback()
#         return jsonify({"error": "Failed to delete ticket"}), 500

# @app.route("/api/support/ticket/<ticket_id>", methods=["GET"])
# @login_required
# def get_ticket_details(ticket_id):
#     try:
#         ticket = SupportTicket.query.filter_by(
#             id=ticket_id, 
#             user_id=current_user.id
#         ).first()
        
#         if not ticket:
#             return jsonify({"error": "Ticket not found"}), 404
        
#         return jsonify({
#             'id': ticket.id,
#             'ticket_number': ticket.ticket_number,
#             'subject': ticket.subject,
#             'description': ticket.description,
#             'urgency': ticket.urgency,
#             'status': ticket.status,
#             'attachment_paths': ticket.attachment_paths or [],
#             'created_at': ticket.created_at.replace(tzinfo=timezone.utc).isoformat(),
#             'updated_at': ticket.updated_at.isoformat() + 'Z' if ticket.updated_at else None
#         })
        
#     except Exception as e:
#         logger.exception("Error fetching ticket details")
#         return jsonify({"error": "Failed to fetch ticket details"}), 500

# # Serve uploaded files
# @app.route('/static/uploads/tickets/<filename>')
# def serve_ticket_file(filename):
#     return send_from_directory(UPLOAD_FOLDER, filename)

# if __name__ == "__main__":
#     # Ensure DB tables exist (when running via python app.py locally)
#     create_tables(app)
#     app.run(debug=False, host='0.0.0.0', port=8080)

# from flask import Flask, request, jsonify
# from flask_login import LoginManager, current_user, login_required
# from flask_cors import CORS
# from db_models import db, User, SearchHistory, create_tables
# from auth_config import Config
# from auth_routes import auth_bp, init_oauth
# import pandas as pd
# import time, random, os, tempfile, gc
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
# from scrapers.ntsuae_scraper import scrape_ntsuae
# from scrapers.seazoneuae_scraper import scrape_seazoneuae
# from scrapers.empiremarine_scraper import scrape_empiremarine
# from scrapers.climaxmarine_scraper import scrape_climaxmarine

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
#     "sharafdg": scrape_sharafdg,
#     "ntsuae": scrape_ntsuae,
#     "seazoneuae": scrape_seazoneuae,
#     "empiremarine": scrape_empiremarine,
#     "climaxmarine": scrape_climaxmarine
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
#                             gc.collect()
#                             if site_name == "amazon":
#                                 os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
#                                 time.sleep(0.2)
#                                 data = scraper(brand, product)
#                                 if "SELECTED_AMAZON_DOMAIN" in os.environ:
#                                     del os.environ["SELECTED_AMAZON_DOMAIN"]
#                             else:
#                                 data = scraper(brand, product, oem, asin)

#                             # if data is None: continue 
#                             # if not isinstance(data, dict): continue

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
#                     gc.collect()
#                     if site == "amazon":
#                         os.environ["SELECTED_AMAZON_DOMAIN"] = amazon_domain
#                         data = scraper(brand, product)
#                         if "SELECTED_AMAZON_DOMAIN" in os.environ:
#                             del os.environ["SELECTED_AMAZON_DOMAIN"]
#                     else:
#                         data = scraper(brand, product, oem, asin)

#                     if data is None: continue
#                     if not isinstance(data, dict): continue

#                     if isinstance(data, dict) and "error" in data:
#                         error = data["error"]
#                     else:
#                         for d in data.get("data", []):
#                             d["WEBSITE"] = site.capitalize()
#                             results.append(d)
                            
#                     if site == "amazon":
#                         time.sleep(random.uniform(10, 25))

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
