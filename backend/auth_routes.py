from flask import Blueprint, redirect, url_for, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from flask_cors import cross_origin
from authlib.integrations.flask_client import OAuth
from werkzeug.security import generate_password_hash, check_password_hash
from db_models import db, User
import requests
import os

auth_bp = Blueprint("auth", __name__)
oauth = OAuth()

# Use your actual domain
FRONTEND_BASE = "https://tutomart.com"
CALLBACK_URL = "https://tutomart.com/api/auth/login/google/callback"  # Updated

def init_oauth(app):
    oauth.init_app(app)

    oauth.register(
        name="google",
        client_id=app.config["GOOGLE_CLIENT_ID"],
        client_secret=app.config["GOOGLE_CLIENT_SECRET"],
        authorize_url="https://accounts.google.com/o/oauth2/auth",
        access_token_url="https://oauth2.googleapis.com/token",
        api_base_url="https://www.googleapis.com/",
        userinfo_endpoint="https://www.googleapis.com/oauth2/v1/userinfo",
        client_kwargs={
            "scope": "email profile",
            "token_endpoint_auth_method": "client_secret_post"
        },
    )

# -------------------------- LOGIN STATUS ----------------------------------

@auth_bp.route("/")
def login():
    if current_user.is_authenticated:
        return redirect(f"{FRONTEND_BASE}/dashboard")
    return redirect(f"{FRONTEND_BASE}/login")

@auth_bp.route('/login-status')
@cross_origin(supports_credentials=True)
def login_status():
    if current_user.is_authenticated:
        return jsonify({
            "authenticated": True,
            "user": {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email
            }
        })
    return jsonify({"authenticated": False})

# -------------------------- GOOGLE LOGIN ----------------------------------

@auth_bp.route("/login/google")
def google_login():
    try:
        redirect_uri = CALLBACK_URL
        return oauth.google.authorize_redirect(redirect_uri)
    except Exception as e:
        print("Google OAuth Error:", e)
        return redirect(f"{FRONTEND_BASE}/login?error=oauth_failed")

@auth_bp.route("/login/google/callback")
def google_callback():
    try:
        # Manually exchange token
        code = request.args.get("code")
        if not code:
            return redirect(f"{FRONTEND_BASE}/login?error=no_code")

        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": current_app.config["GOOGLE_CLIENT_ID"],
                "client_secret": current_app.config["GOOGLE_CLIENT_SECRET"],
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": CALLBACK_URL
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30
        )

        if token_response.status_code != 200:
            print("Token Exchange Error:", token_response.text)
            return redirect(f"{FRONTEND_BASE}/login?error=token_failed")

        token_data = token_response.json()
        access_token = token_data.get("access_token")

        # Get user info
        user_response = requests.get(
            "https://www.googleapis.com/oauth2/v1/userinfo",
            params={"access_token": access_token},
            timeout=30
        )

        if user_response.status_code != 200:
            print("User Info Error:", user_response.text)
            return redirect(f"{FRONTEND_BASE}/login?error=userinfo_failed")

        user_info = user_response.json()
        email = user_info["email"]
        google_id = user_info.get("id")
        name = user_info.get("name") or email.split("@")[0]

        # Check if user exists
        user = User.query.filter_by(email=email).first()

        if not user:
            user = User(email=email, name=name, google_id=google_id)
            db.session.add(user)
        else:
            # Update Google ID if missing
            if not user.google_id:
                user.google_id = google_id

        db.session.commit()

        login_user(user, remember=True)

        # FIX: Use absolute URL for redirect
        return redirect(f"{FRONTEND_BASE}/dashboard?login=success")

    except Exception as e:
        print("Callback Error:", str(e))
        return redirect(f"{FRONTEND_BASE}/login?error=callback_failed")

# -------------------------- TRADITIONAL LOGIN -----------------------------

@auth_bp.route('/login/traditional', methods=['POST'])
@cross_origin(supports_credentials=True)
def traditional_login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        email = data.get("email", "").strip()
        password = data.get("password", "").strip()

        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400

        user = User.query.filter_by(email=email).first()

        if not user or not user.password:
            return jsonify({"error": "Invalid credentials"}), 401

        if not check_password_hash(user.password, password):
            return jsonify({"error": "Invalid credentials"}), 401

        login_user(user, remember=True)

        return jsonify({
            "message": "Login successful",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email
            }
        })

    except Exception as e:
        print("Login Error:", e)
        return jsonify({"error": "Login failed"}), 500


# -------------------------- REGISTRATION ----------------------------------

@auth_bp.route('/register', methods=['POST'])
@cross_origin(supports_credentials=True)
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        email = data.get("email", "").strip()
        name = data.get("name", "").strip()
        password = data.get("password", "").strip()
        confirm = data.get("confirm_password", "").strip()

        if not all([email, name, password, confirm]):
            return jsonify({"error": "All fields required"}), 400

        if len(password) < 6:
            return jsonify({"error": "Password must be ≥ 6 chars"}), 400

        if password != confirm:
            return jsonify({"error": "Passwords do not match"}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already exists"}), 400

        user = User(
            email=email,
            name=name,
            password=generate_password_hash(password)
        )

        db.session.add(user)
        db.session.commit()

        login_user(user)

        return jsonify({
            "message": "Registration successful",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email
            }
        })

    except Exception as e:
        print("Registration Error:", e)
        db.session.rollback()
        return jsonify({"error": "Registration failed"}), 500


# -------------------------- LOGOUT ----------------------------------------

@auth_bp.route('/logout', methods=['POST'])
@login_required
@cross_origin(supports_credentials=True)
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"})
