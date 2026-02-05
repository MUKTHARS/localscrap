from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime, timezone
import uuid
import time

from sqlalchemy import text

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
    timezone = db.Column(db.String(50), default='UTC', nullable=False)
    
    session_token = db.Column(db.String(36), nullable=True)

    def __init__(self, **kwargs):
        if 'created_at' not in kwargs:
            kwargs['created_at'] = datetime.now(timezone.utc)
        super().__init__(**kwargs)

class AdminUser(db.Model):
    __tablename__ = 'admin_users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='employee') # 'admin' or 'employee'
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    timezone = db.Column(db.String(50), default='UTC', nullable=False)

class SearchHistory(db.Model):
    __tablename__ = 'search_history'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    brand = db.Column(db.String(200))
    product = db.Column(db.String(200))
    oem_number = db.Column(db.String(100))
    asin_number = db.Column(db.String(100))
    website = db.Column(db.String(50))
    search_type = db.Column(db.String(10), default='manual')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class SupportTicket(db.Model):
    __tablename__ = 'support_tickets'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

    ticket_sequence = db.Column(db.Integer, db.Sequence('support_tickets_seq'), server_default=text("nextval('support_tickets_seq')"))
    ticket_number = db.Column(db.String(20), unique=True, nullable=True)
    
    subject = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    urgency = db.Column(db.String(20), nullable=False, default='medium')
    status = db.Column(db.String(20), nullable=False, default='open')
    attachment_paths = db.Column(db.JSON, default=list)
    
    assigned_to = db.Column(db.String(36), db.ForeignKey('admin_users.id', ondelete='SET NULL'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = db.relationship('User', backref=db.backref('tickets', lazy=True, cascade='all, delete-orphan'))
    assigned_employee = db.relationship('AdminUser', foreign_keys=[assigned_to], backref=db.backref('tickets_assigned', lazy=True))

class EmployeeTicketAssignment(db.Model):
    __tablename__ = 'employee_ticket_assignments'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = db.Column(db.String(36), db.ForeignKey('support_tickets.id', ondelete='CASCADE'))
    employee_id = db.Column(db.String(36), db.ForeignKey('admin_users.id', ondelete='CASCADE'))
    assigned_by = db.Column(db.String(36), db.ForeignKey('admin_users.id', ondelete='SET NULL'))
    assigned_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


# Add these models at the end of the file

class QuizQuestion(db.Model):
    __tablename__ = 'quiz_questions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question = db.Column(db.Text, nullable=False)
    product_name = db.Column(db.String(200), nullable=False)
    correct_price_range = db.Column(db.String(100))  # e.g., "$1000-$1200"
    affiliate_link = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), default='electronics')
    difficulty = db.Column(db.String(20), default='medium')  # easy, medium, hard
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # For daily rotation
    last_shown_date = db.Column(db.Date, nullable=True)
    show_count = db.Column(db.Integer, default=0)

class UserQuizAttempt(db.Model):
    __tablename__ = 'user_quiz_attempts'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    question_id = db.Column(db.String(36), db.ForeignKey('quiz_questions.id'), nullable=False)
    guessed_price = db.Column(db.String(50))
    attempted_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    redirect_to_affiliate = db.Column(db.Boolean, default=False)
    
    user = db.relationship('User', backref=db.backref('quiz_attempts', lazy=True))
    question = db.relationship('QuizQuestion')

    
def create_tables(app):
    with app.app_context():
        db.create_all()
