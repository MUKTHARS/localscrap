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

def create_tables(app):
    with app.app_context():
        db.create_all()

# from flask_sqlalchemy import SQLAlchemy
# from flask_login import UserMixin
# from datetime import datetime, timezone
# import uuid

# db = SQLAlchemy()

# class User(UserMixin, db.Model):
#     __tablename__ = 'users'
    
#     id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
#     email = db.Column(db.String(120), unique=True, nullable=False, index=True)
#     password = db.Column(db.String(255))
#     name = db.Column(db.String(100), nullable=False)
#     google_id = db.Column(db.String(100), unique=True)
#     created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
#     is_active = db.Column(db.Boolean, default=True)

#     def __init__(self, **kwargs):
#         # Ensure created_at is always set
#         if 'created_at' not in kwargs:
#             kwargs['created_at'] = datetime.now(timezone.utc)
#         super().__init__(**kwargs)

# class SearchHistory(db.Model):
#     __tablename__ = 'search_history'
    
#     id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
#     user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
#     brand = db.Column(db.String(200), nullable=False)
#     product = db.Column(db.String(200), nullable=False)
#     oem_number = db.Column(db.String(100))
#     asin_number = db.Column(db.String(100))
#     website = db.Column(db.String(50))
#     search_type = db.Column(db.String(10), default='manual')
#     created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
#     user = db.relationship('User', backref=db.backref('searches', lazy=True))

# class SupportTicket(db.Model):
#     __tablename__ = 'support_tickets'
    
#     id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
#     user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
#     ticket_number = db.Column(db.String(20), unique=True, nullable=False)  # ADD THIS FIELD
#     subject = db.Column(db.String(200), nullable=False)
#     description = db.Column(db.Text, nullable=False)
#     urgency = db.Column(db.String(20), nullable=False, default='medium')
#     status = db.Column(db.String(20), nullable=False, default='open')
#     attachment_paths = db.Column(db.JSON, default=list)
#     created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)
#     updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
#     # Relationships
#     user = db.relationship('User', backref=db.backref('tickets', lazy=True, cascade='all, delete-orphan'))
    
#     def __init__(self, **kwargs):
#         # Call parent constructor first
#         super().__init__(**kwargs)
        
#         # Generate ticket number after initialization if not provided
#         if 'ticket_number' not in kwargs:
#             self.ticket_number = self._generate_ticket_number()
    
#     def _generate_ticket_number(self):
#         """Generate sequential ticket number for this user"""
#         if not self.user_id:
#             raise ValueError("User ID is required to generate ticket number")
        
#         # Get the next ticket number for this user
#         last_ticket = db.session.query(SupportTicket).filter_by(
#             user_id=self.user_id
#         ).order_by(
#             SupportTicket.created_at.desc()
#         ).first()
        
#         if last_ticket and last_ticket.ticket_number:
#             try:
#                 # Extract the numeric part from existing ticket number
#                 last_number = int(last_ticket.ticket_number.split('_')[1])
#                 next_number = last_number + 1
#             except (ValueError, IndexError):
#                 # If parsing fails, start from 1
#                 next_number = 1
#         else:
#             # First ticket for this user
#             next_number = 1
        
#         # Format as ticket_001, ticket_002, etc.
#         return f"ticket_{next_number:03d}"

# def create_tables(app):
#     with app.app_context():
#         db.create_all()
