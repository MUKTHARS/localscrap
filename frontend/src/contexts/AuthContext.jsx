class SupportTicket(db.Model):
    __tablename__ = 'support_tickets'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    ticket_number = db.Column(db.String(20), unique=True, nullable=False)  # ADD THIS FIELD
    subject = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    urgency = db.Column(db.String(20), nullable=False, default='medium')
    status = db.Column(db.String(20), nullable=False, default='open')
    attachment_paths = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user = db.relationship('User', backref=db.backref('tickets', lazy=True, cascade='all, delete-orphan'))
    
    def __init__(self, **kwargs):
        # Call parent constructor first
        super().__init__(**kwargs)
        
        # Generate ticket number after initialization if not provided
        if 'ticket_number' not in kwargs:
            self.ticket_number = self._generate_ticket_number()
    
    def _generate_ticket_number(self):
        """Generate sequential ticket number for this user"""
        if not self.user_id:
            raise ValueError("User ID is required to generate ticket number")
        
        # Get the next ticket number for this user
        last_ticket = db.session.query(SupportTicket).filter_by(
            user_id=self.user_id
        ).order_by(
            SupportTicket.created_at.desc()
        ).first()
        
        if last_ticket and last_ticket.ticket_number:
            try:
                # Extract the numeric part from existing ticket number
                last_number = int(last_ticket.ticket_number.split('_')[1])
                next_number = last_number + 1
            except (ValueError, IndexError):
                # If parsing fails, start from 1
                next_number = 1
        else:
            # First ticket for this user
            next_number = 1
        
        # Format as ticket_001, ticket_002, etc.
        return f"ticket_{next_number:03d}"

// // src/contexts/AuthContext.jsx
// import React, { createContext, useState, useContext, useEffect } from 'react';
// import api from '../utils/apiConfig';

// const AuthContext = createContext();

// export const useAuth = () => {
//   return useContext(AuthContext);
// };

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);

//   // Add this useEffect to check auth status on component mount
//   useEffect(() => {
//     checkAuthStatus();
//   }, []);

//   const checkAuthStatus = async () => {
//     try {
//       const response = await api.get('/auth/login-status');
      
//       if (response.data.authenticated) {
//         setUser(response.data.user);
//       } else {
//         setUser(null);
//       }
//     } catch (error) {
//       console.error('Auth check failed:', error);
//       setUser(null);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const login = async (email, password, remember) => {
//     try {
//       const response = await api.post('/auth/login/traditional', { 
//         email, 
//         password, 
//         remember 
//       });

//       setUser(response.data.user);
//       return { success: true, message: response.data.message };
//     } catch (error) {
//       return {
//         success: false,
//         message: error.response?.data?.error || 'Login failed'
//       };
//     }
//   };

//   const register = async (name, email, password, confirmPassword) => {
//     try {
//       const response = await api.post('/auth/register', { 
//         name, 
//         email, 
//         password, 
//         confirm_password: confirmPassword 
//       });

//       setUser(response.data.user);
//       return { success: true, message: response.data.message };
//     } catch (error) {
//       return {
//         success: false,
//         message: error.response?.data?.error || 'Registration failed'
//       };
//     }
//   };

//   const logout = async () => {
//     try {
//       await api.post('/auth/logout');
//     } catch (error) {
//       console.error('Logout error:', error);
//     } finally {
//       setUser(null);
//     }
//   };

//   const value = {
//     user,
//     loading,
//     login,
//     register,
//     logout,
//     checkAuthStatus
//   };

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// };


// // src/contexts/AuthContext.jsx
// import React, { createContext, useState, useContext, useEffect } from 'react';
// import api from '../utils/apiConfig'; // Import the api instance

// const AuthContext = createContext();

// export const useAuth = () => {
//   return useContext(AuthContext);
// };

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);

//   const checkAuthStatus = async () => {
//     try {
//       const response = await api.get('/auth/login-status'); // Use api instance
      
//       if (response.data.authenticated) {
//         setUser(response.data.user);
//       } else {
//         setUser(null);
//       }
//     } catch (error) {
//       console.error('Auth check failed:', error);
//       setUser(null);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const login = async (email, password, remember) => {
//     try {
//       const response = await api.post('/auth/login/traditional', { 
//         email, 
//         password, 
//         remember 
//       });

//       setUser(response.data.user);
//       return { success: true, message: response.data.message };
//     } catch (error) {
//       return {
//         success: false,
//         message: error.response?.data?.error || 'Login failed'
//       };
//     }
//   };

//   const register = async (name, email, password, confirmPassword) => {
//     try {
//       const response = await api.post('/auth/register', { 
//         name, 
//         email, 
//         password, 
//         confirm_password: confirmPassword 
//       });

//       setUser(response.data.user);
//       return { success: true, message: response.data.message };
//     } catch (error) {
//       return {
//         success: false,
//         message: error.response?.data?.error || 'Registration failed'
//       };
//     }
//   };

//   const logout = async () => {
//     try {
//       await api.post('/auth/logout');
//     } catch (error) {
//       console.error('Logout error:', error);
//     } finally {
//       setUser(null);
//     }
//   };

//   const value = {
//     user,
//     loading,
//     login,
//     register,
//     logout,
//     checkAuthStatus
//   };

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// };
