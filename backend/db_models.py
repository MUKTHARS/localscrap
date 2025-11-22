from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import uuid

db = SQLAlchemy()

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255))
    name = db.Column(db.String(100), nullable=False)
    google_id = db.Column(db.String(100), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    def get_id(self):
        return self.id

    def __repr__(self):
        return f'<User {self.email}>'

class SearchHistory(db.Model):
    __tablename__ = 'search_history'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    brand = db.Column(db.String(200), nullable=False)
    product = db.Column(db.String(200), nullable=False)
    oem_number = db.Column(db.String(100))
    asin_number = db.Column(db.String(100))
    website = db.Column(db.String(50))
    search_type = db.Column(db.String(10), default='manual')  # 'manual' or 'bulk'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    user = db.relationship('User', backref=db.backref('searches', lazy=True, cascade='all, delete-orphan'))

    def __repr__(self):
        return f'<SearchHistory {self.brand} {self.product}>'

def create_tables(app):
    """Create all tables if they don't exist"""
    with app.app_context():
        try:
            db.create_all()
            print("✅ Database tables created successfully!")
        except Exception as e:
            print(f"❌ Error creating tables: {e}")

def insert_sample(app):
    """Insert sample data for testing"""
    with app.app_context():
        try:
            # Check if sample data already exists
            if User.query.first() is None:
                # Create dummy users
                dummy_user1 = User(
                    id=str(uuid.uuid4()),
                    email="test@example.com",
                    password="test123",  # In real app, this should be hashed
                    name="Test User",
                    google_id=None,
                    created_at=datetime.utcnow(),
                    is_active=True
                )
                
                dummy_user2 = User(
                    id=str(uuid.uuid4()),
                    email="john.doe@example.com", 
                    password="password123",
                    name="John Doe",
                    google_id="google123",
                    created_at=datetime.utcnow(),
                    is_active=True
                )
                
                db.session.add(dummy_user1)
                db.session.add(dummy_user2)
                db.session.commit()
                
                # Create dummy search history
                search1 = SearchHistory(
                    id=str(uuid.uuid4()),
                    user_id=dummy_user1.id,
                    brand="Toyota",
                    product="Camry Brake Pads",
                    oem_number="04465-06160",
                    asin_number="B07B4L8Q9K",
                    website="amazon",
                    search_type="manual",
                    created_at=datetime.utcnow()
                )
                
                search2 = SearchHistory(
                    id=str(uuid.uuid4()),
                    user_id=dummy_user1.id,
                    brand="Honda",
                    product="Civic Air Filter",
                    oem_number="17220-R50-A01",
                    asin_number="B000C9VHK4",
                    website="ebay",
                    search_type="bulk",
                    created_at=datetime.utcnow()
                )
                
                search3 = SearchHistory(
                    id=str(uuid.uuid4()),
                    user_id=dummy_user2.id,
                    brand="Ford",
                    product="F-150 Oil Filter",
                    oem_number="FL-910",
                    asin_number="B000C9T6T6",
                    website="amazon",
                    search_type="manual",
                    created_at=datetime.utcnow()
                )
                
                db.session.add(search1)
                db.session.add(search2)
                db.session.add(search3)
                db.session.commit()
                
                print("✅ Sample data inserted successfully!")
            else:
                print("ℹ️ Sample data already exists, skipping insertion.")
                
        except Exception as e:
            print(f"❌ Error inserting sample data: {e}")