from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime, timezone
import uuid

db = SQLAlchemy()

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255))
    name = db.Column(db.String(100), nullable=False)
    google_id = db.Column(db.String(100), unique=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    def __init__(self, **kwargs):
        # Ensure created_at is always set
        if 'created_at' not in kwargs:
            kwargs['created_at'] = datetime.now(timezone.utc)
        super().__init__(**kwargs)

class SearchHistory(db.Model):
    __tablename__ = 'search_history'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    brand = db.Column(db.String(200), nullable=False)
    product = db.Column(db.String(200), nullable=False)
    oem_number = db.Column(db.String(100))
    asin_number = db.Column(db.String(100))
    website = db.Column(db.String(50))
    search_type = db.Column(db.String(10), default='manual')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    user = db.relationship('User', backref=db.backref('searches', lazy=True))

def create_tables(app):
    with app.app_context():
        db.create_all()