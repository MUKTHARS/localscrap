from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from flask_cors import cross_origin
from authlib.integrations.flask_client import OAuth
from werkzeug.security import generate_password_hash, check_password_hash
from db_models import db, User, SearchHistory
import uuid

auth_bp = Blueprint('auth', __name__)
oauth = OAuth()

def init_oauth(app):
    oauth.init_app(app)
    google = oauth.register(
        name='google',
        client_id=app.config['GOOGLE_CLIENT_ID'],
        client_secret=app.config['GOOGLE_CLIENT_SECRET'],
        server_metadata_url='https://accounts.google.com/.well-known/openid_configuration',
        client_kwargs={
            'scope': 'openid email profile'
        }
    )

@auth_bp.route('/login')
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    return redirect('http://localhost:3000/login')

@auth_bp.route('/login/google')
def google_login():
    redirect_uri = url_for('auth.google_callback', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@auth_bp.route('/login/google/callback')
def google_callback():
    try:
        token = oauth.google.authorize_access_token()
        user_info = token.get('userinfo')
        
        if not user_info:
            return redirect('http://localhost:3000/login?error=google_login_failed')
        
        # Check if user exists
        user = User.query.filter_by(google_id=user_info['sub']).first()
        
        if not user:
            # Check if user exists with same email but different login method
            user = User.query.filter_by(email=user_info['email']).first()
            if user:
                # Link Google account to existing user
                user.google_id = user_info['sub']
            else:
                # Create new user
                user = User(
                    email=user_info['email'],
                    name=user_info['name'],
                    google_id=user_info['sub']
                )
                db.session.add(user)
            
            db.session.commit()
        
        login_user(user)
        return redirect('http://localhost:3000/dashboard')
        
    except Exception as e:
        return redirect('http://localhost:3000/login?error=google_login_failed')

@auth_bp.route('/login/traditional', methods=['POST'])
@cross_origin(supports_credentials=True)
def traditional_login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    remember = bool(data.get('remember'))
    
    user = User.query.filter_by(email=email).first()
    
    if user and user.password and check_password_hash(user.password, password):
        login_user(user, remember=remember)
        return jsonify({
            'message': f'Welcome back, {user.name}!',
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email
            }
        })
    else:
        return jsonify({'error': 'Invalid email or password.'}), 401

@auth_bp.route('/register', methods=['POST'])
@cross_origin(supports_credentials=True)
def register():
    data = request.get_json()
    email = data.get('email')
    name = data.get('name')
    password = data.get('password')
    confirm_password = data.get('confirm_password')
    
    # Validation
    if not all([email, name, password, confirm_password]):
        return jsonify({'error': 'All fields are required.'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long.'}), 400
    
    if password != confirm_password:
        return jsonify({'error': 'Passwords do not match.'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered.'}), 400
    
    # Create user
    user = User(
        email=email,
        name=name,
        password=generate_password_hash(password)
    )
    
    try:
        db.session.add(user)
        db.session.commit()
        login_user(user)
        return jsonify({
            'message': 'Registration successful! Welcome to Price Comparison Tool.',
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email
            }
        })
    except Exception as e:
        return jsonify({'error': 'Registration failed. Please try again.'}), 500

@auth_bp.route('/logout', methods=['POST'])
@login_required
@cross_origin(supports_credentials=True)
def logout():
    logout_user()
    return jsonify({'message': 'You have been logged out successfully.'})

# from flask import Blueprint, render_template, redirect, url_for, request, flash
# from flask_login import login_user, logout_user, login_required, current_user
# from authlib.integrations.flask_client import OAuth
# from werkzeug.security import generate_password_hash, check_password_hash
# from db_models import db, User, SearchHistory
# import uuid

# auth_bp = Blueprint('auth', __name__)
# oauth = OAuth()

# def init_oauth(app):
#     oauth.init_app(app)
#     google = oauth.register(
#         name='google',
#         client_id=app.config['GOOGLE_CLIENT_ID'],
#         client_secret=app.config['GOOGLE_CLIENT_SECRET'],
#         server_metadata_url='https://accounts.google.com/.well-known/openid_configuration',
#         client_kwargs={
#             'scope': 'openid email profile'
#         }
#     )

# @auth_bp.route('/login')
# def login():
#     if current_user.is_authenticated:
#         return redirect(url_for('index'))
#     return render_template('login.html')

# @auth_bp.route('/login/google')
# def google_login():
#     redirect_uri = url_for('auth.google_callback', _external=True)
#     return oauth.google.authorize_redirect(redirect_uri)

# @auth_bp.route('/login/google/callback')
# def google_callback():
#     try:
#         token = oauth.google.authorize_access_token()
#         user_info = token.get('userinfo')
        
#         if not user_info:
#             flash('Google login failed. Please try again.', 'error')
#             return redirect(url_for('auth.login'))
        
#         # Check if user exists
#         user = User.query.filter_by(google_id=user_info['sub']).first()
        
#         if not user:
#             # Check if user exists with same email but different login method
#             user = User.query.filter_by(email=user_info['email']).first()
#             if user:
#                 # Link Google account to existing user
#                 user.google_id = user_info['sub']
#             else:
#                 # Create new user
#                 user = User(
#                     email=user_info['email'],
#                     name=user_info['name'],
#                     google_id=user_info['sub']
#                 )
#                 db.session.add(user)
            
#             db.session.commit()
        
#         login_user(user)
#         flash(f'Welcome back, {user.name}!', 'success')
#         return redirect(url_for('index'))
        
#     except Exception as e:
#         flash('Google login failed. Please try again.', 'error')
#         return redirect(url_for('auth.login'))

# @auth_bp.route('/login/traditional', methods=['POST'])
# def traditional_login():
#     email = request.form.get('email')
#     password = request.form.get('password')
#     remember = bool(request.form.get('remember'))
    
#     user = User.query.filter_by(email=email).first()
    
#     if user and user.password and check_password_hash(user.password, password):
#         login_user(user, remember=remember)
#         flash(f'Welcome back, {user.name}!', 'success')
#         return redirect(url_for('index'))
#     else:
#         flash('Invalid email or password.', 'error')
#         return redirect(url_for('auth.login'))

# @auth_bp.route('/register', methods=['POST'])
# def register():
#     email = request.form.get('email')
#     name = request.form.get('name')
#     password = request.form.get('password')
#     confirm_password = request.form.get('confirm_password')
    
#     # Validation
#     if not all([email, name, password, confirm_password]):
#         flash('All fields are required.', 'error')
#         return redirect(url_for('auth.login'))
    
#     if len(password) < 6:
#         flash('Password must be at least 6 characters long.', 'error')
#         return redirect(url_for('auth.login'))
    
#     if password != confirm_password:
#         flash('Passwords do not match.', 'error')
#         return redirect(url_for('auth.login'))
    
#     if User.query.filter_by(email=email).first():
#         flash('Email already registered.', 'error')
#         return redirect(url_for('auth.login'))
    
#     # Create user
#     user = User(
#         email=email,
#         name=name,
#         password=generate_password_hash(password)
#     )
    
#     try:
#         db.session.add(user)
#         db.session.commit()
#         login_user(user)
#         flash('Registration successful! Welcome to Price Comparison Tool.', 'success')
#         return redirect(url_for('index'))
#     except Exception as e:
#         flash('Registration failed. Please try again.', 'error')
#         return redirect(url_for('auth.login'))

# @auth_bp.route('/logout')
# @login_required
# def logout():
#     logout_user()
#     flash('You have been logged out successfully.', 'info')
#     return redirect(url_for('auth.login'))