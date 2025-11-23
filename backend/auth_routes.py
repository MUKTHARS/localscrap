from flask import Blueprint, redirect, url_for, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from flask_cors import cross_origin
from authlib.integrations.flask_client import OAuth
from werkzeug.security import generate_password_hash, check_password_hash
from db_models import db, User
import requests

auth_bp = Blueprint('auth', __name__)
oauth = OAuth()

def init_oauth(app):
    oauth.init_app(app)
    
    # Google OAuth configuration
    oauth.register(
        name='google',
        client_id=app.config['GOOGLE_CLIENT_ID'],
        client_secret=app.config['GOOGLE_CLIENT_SECRET'],
        authorize_url='https://accounts.google.com/o/oauth2/auth',
        access_token_url='https://oauth2.googleapis.com/token',
        api_base_url='https://www.googleapis.com/',
        userinfo_endpoint='https://www.googleapis.com/oauth2/v1/userinfo',
        client_kwargs={
            'scope': 'email profile',
            'token_endpoint_auth_method': 'client_secret_post'
        },
    )

@auth_bp.route('/login')
def login():
    """Login endpoint that redirects to React frontend"""
    if current_user.is_authenticated:
        return redirect('http://localhost:3000/dashboard')
    return redirect('http://localhost:3000/login')

@auth_bp.route('/api/login-status')
@cross_origin(supports_credentials=True)
def login_status():
    """Check if user is logged in"""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': current_user.id,
                'name': current_user.name,
                'email': current_user.email
            }
        })
    else:
        return jsonify({
            'authenticated': False,
            'user': None
        })

@auth_bp.route('/login/google')
def google_login():
    try:
        # Verify credentials are loaded
        if not current_app.config['GOOGLE_CLIENT_ID'] or not current_app.config['GOOGLE_CLIENT_SECRET']:
            print("🔴 OAuth credentials not configured")
            return redirect('http://localhost:3000/login?error=oauth_not_configured')
        
        # Check if credentials are still placeholders
        client_id = current_app.config['GOOGLE_CLIENT_ID']
        if 'your-google-client' in client_id or 'example' in client_id:
            print("🔴 OAuth credentials are still placeholders")
            return redirect('http://localhost:3000/login?error=oauth_credentials_invalid')
        
        redirect_uri = url_for('auth.google_callback', _external=True)
        print(f"🟡 OAuth Config:")
        print(f"   Client ID: {client_id[:20]}...")
        print(f"   Redirect URI: {redirect_uri}")
        
        return oauth.google.authorize_redirect(redirect_uri)
        
    except Exception as e:
        print(f"🔴 Google login initiation error: {e}")
        return redirect('http://localhost:3000/login?error=oauth_init_failed')

@auth_bp.route('/login/google/callback')
def google_callback():
    try:
        print("🟡 Google callback received")
        
        # Clear any existing session to ensure clean state
        logout_user()
        
        code = request.args.get('code')
        error = request.args.get('error')
        
        print(f"🟡 Callback params - code: {bool(code)}, error: {error}")
        
        if error:
            print(f"🔴 OAuth error from Google: {error}")
            return redirect('http://localhost:3000/login?error=oauth_denied')
        
        if not code:
            print("🔴 No authorization code received")
            return redirect('http://localhost:3000/login?error=no_authorization_code')
        
        # Manual token exchange
        redirect_uri = url_for('auth.google_callback', _external=True)
        
        print("🟡 Exchanging code for token manually...")
        token_response = requests.post(
            'https://oauth2.googleapis.com/token',
            data={
                'client_id': current_app.config['GOOGLE_CLIENT_ID'],
                'client_secret': current_app.config['GOOGLE_CLIENT_SECRET'],
                'code': code,
                'grant_type': 'authorization_code',
                'redirect_uri': redirect_uri
            },
            headers={
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout=30
        )
        
        print(f"🟡 Token response status: {token_response.status_code}")
        
        if token_response.status_code != 200:
            print(f"🔴 Token exchange failed: {token_response.text}")
            return redirect('http://localhost:3000/login?error=token_exchange_failed')
        
        token_data = token_response.json()
        access_token = token_data.get('access_token')
        
        print(f"🟡 Access token received: {bool(access_token)}")
        
        if not access_token:
            print("🔴 No access token in response")
            return redirect('http://localhost:3000/login?error=no_access_token')
        
        # Get user info using the access token
        print("🟡 Fetching user info...")
        user_response = requests.get(
            'https://www.googleapis.com/oauth2/v1/userinfo',
            params={'access_token': access_token},
            timeout=30
        )
        
        print(f"🟡 User info response status: {user_response.status_code}")
        
        if user_response.status_code != 200:
            print(f"🔴 User info fetch failed: {user_response.text}")
            return redirect('http://localhost:3000/login?error=user_info_failed')
        
        user_info = user_response.json()
        print(f"🟡 User info: {user_info}")
        
        if not user_info or 'email' not in user_info:
            print("🔴 No user info or email in response")
            return redirect('http://localhost:3000/login?error=user_info_incomplete')
        
        # Find or create user
        google_id = user_info.get('id')
        user_email = user_info['email']
        user_name = user_info.get('name', user_email.split('@')[0])
        
        print(f"🟡 Processing user - ID: {google_id}, Email: {user_email}, Name: {user_name}")
        
        user = User.query.filter_by(google_id=google_id).first()
        
        if not user:
            user = User.query.filter_by(email=user_email).first()
            if user:
                # Link Google account to existing user
                user.google_id = google_id
                print(f"🟡 Linked Google account to existing user: {user_email}")
            else:
                # Create new user
                user = User(
                    email=user_email,
                    name=user_name,
                    google_id=google_id
                )
                db.session.add(user)
                print(f"🟡 Created new user: {user_email}")
            
            db.session.commit()
        
        # Log the user in
        login_user(user, remember=True)
        print(f"🟡 User logged in successfully: {user_email}")
        
        # Redirect to dashboard with success
        return redirect('http://localhost:3000/dashboard?login=success')
        
    except requests.exceptions.Timeout:
        print("🔴 Request timeout during OAuth flow")
        return redirect('http://localhost:3000/login?error=timeout')
    except Exception as e:
        print(f"🔴 Google callback error: {str(e)}")
        import traceback
        traceback.print_exc()
        return redirect('http://localhost:3000/login?error=authentication_failed')

@auth_bp.route('/login/traditional', methods=['POST'])
@cross_origin(supports_credentials=True)
def traditional_login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        remember = bool(data.get('remember'))
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
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
            
    except Exception as e:
        print(f"🔴 Traditional login error: {e}")
        return jsonify({'error': 'Login failed. Please try again.'}), 500

@auth_bp.route('/register', methods=['POST'])
@cross_origin(supports_credentials=True)
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        email = data.get('email', '').strip()
        name = data.get('name', '').strip()
        password = data.get('password', '').strip()
        confirm_password = data.get('confirm_password', '').strip()
        
        # Validation
        if not all([email, name, password, confirm_password]):
            return jsonify({'error': 'All fields are required.'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters long.'}), 400
        
        if password != confirm_password:
            return jsonify({'error': 'Passwords do not match.'}), 400
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'error': 'Email already registered.'}), 400
        
        # Create user
        user = User(
            email=email,
            name=name,
            password=generate_password_hash(password)
        )
        
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
        print(f"🔴 Registration error: {e}")
        db.session.rollback()
        return jsonify({'error': 'Registration failed. Please try again.'}), 500

@auth_bp.route('/logout', methods=['POST'])
@login_required
@cross_origin(supports_credentials=True)
def logout():
    try:
        logout_user()
        return jsonify({'message': 'You have been logged out successfully.'})
    except Exception as e:
        print(f"🔴 Logout error: {e}")
        return jsonify({'error': 'Logout failed'}), 500