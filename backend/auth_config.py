import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here-change-in-production')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'postgresql://postgres:Tutomart$2025@localhost:5432/price_scraper

')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
    SESSION_PROTECTION = 'strong'

    # Remove these lines as they're causing redirect issues
    # SERVER_NAME = "tutomart.com"  # This forces all URLs to use this domain
    # PREFERRED_URL_SCHEME = "https"
