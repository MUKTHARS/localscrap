import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// --- USER IMPORTS ---
import UserLogin from './components/Login';
import UserDashboard from './components/Dashboard';
import UserProfile from './components/Profile';
import UserNavbar from './components/Navbar';
import SupportTickets from './components/SupportTickets';

// --- ADMIN IMPORTS ---
import AdminLogin from './admin/Login';      
import AdminDashboard from './admin/Dashboard';
import AdminNavbar from './admin/Navigation';      
import AdminTickets from './admin/Tickets';
import AdminTicketDetail from './admin/TicketDetail';
import AdminUsers from './admin/Users';
import AssignTickets from './admin/AssignTickets';
import Employees from './admin/Employees';

// Debug Auth Component
function DebugAuth() {
  const { user, loading } = useAuth();
  if (process.env.NODE_ENV !== 'development') return null;
  return (
    <div style={{ position: 'fixed', top: 10, right: 10, background: 'white', padding: '5px', zIndex: 9999, fontSize: '10px', border: '1px solid #ccc' }}>
      User: {loading ? '...' : (user ? user.email : 'None')}
    </div>
  );
}

// User Protected Route
function ProtectedUserRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center mt-5">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

// Admin Protected Route
function ProtectedAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center mt-5">Loading...</div>;
  return user ? children : <Navigate to="/admin/login" />;
}

// Admin Layout Wrapper
const AdminLayout = ({ children }) => {
  const [adminUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('admin_user'));
    } catch { return null; }
  });

  const logout = async () => {
    try {
      // API_BASE_URL is assumed to be handled by proxy or relative path
      await fetch('https://tutomart.com/api/admin/logout', { 
        method: 'POST',
        credentials: 'include' // Critical for HttpOnly Cookies
      });
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      localStorage.removeItem('admin_user');
      window.location.href = '/admin/login';
    }
  };

  return (
    <>
      <AdminNavbar user={adminUser} onLogout={logout} />
      <div className="container-fluid mt-3">
        {children}
      </div>
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <DebugAuth />
          <Routes>
            {/* === USER ROUTES === */}
            <Route path="/login" element={<UserLogin />} />
            
            {/* Smart Dashboard Redirect: If Admin is logged in, /dashboard goes to /admin/dashboard */}
            <Route path="/dashboard" element={<ProtectedUserRoute><UserNavbar /><UserDashboard /></ProtectedUserRoute>} />
            
            <Route path="/profile" element={<ProtectedUserRoute><UserNavbar /><UserProfile /></ProtectedUserRoute>} />
            <Route path="/support" element={
              <ProtectedUserRoute>
                <UserNavbar />
                <div className="container mt-4"><SupportTickets /></div>
              </ProtectedUserRoute>
            } />

            {/* === ADMIN ROUTES === */}
            {/* Login */}
            <Route path="/admin/login" element={
                <AdminLogin onLogin={() => window.location.href = '/admin/dashboard'} />
            } />

            {/* Dashboard */}
            <Route path="/admin/dashboard" element={
              <ProtectedAdminRoute>
                <AdminLayout>
                  <AdminDashboard user={JSON.parse(localStorage.getItem('admin_user'))} />
                </AdminLayout>
              </ProtectedAdminRoute>
            } />

            {/* Tickets (Matches Navigation.js links: /tickets) */}
            <Route path="/tickets" element={
              <ProtectedAdminRoute>
                <AdminLayout>
                  <AdminTickets user={JSON.parse(localStorage.getItem('admin_user'))} />
                </AdminLayout>
              </ProtectedAdminRoute>
            } />

            {/* Ticket Detail (Matches Navigation.js links: /tickets/:id) */}
            <Route path="/tickets/:id" element={
              <ProtectedAdminRoute>
                <AdminLayout><AdminTicketDetail /></AdminLayout>
              </ProtectedAdminRoute>
            } />

            {/* Users (Matches Navigation.js links: /users) */}
            <Route path="/users" element={
              <ProtectedAdminRoute>
                <AdminLayout><AdminUsers /></AdminLayout>
              </ProtectedAdminRoute>
            } />

            {/* Assign (Matches Navigation.js links: /assign) */}
            <Route path="/assign" element={
              <ProtectedAdminRoute requiredRole="admin">
                <AdminLayout><AssignTickets /></AdminLayout>
              </ProtectedAdminRoute>
            } />

            {/* Employees (Matches Navigation.js links: /employees) */}
            <Route path="/employees" element={
              <ProtectedAdminRoute requiredRole="admin">
                <AdminLayout><Employees /></AdminLayout>
              </ProtectedAdminRoute>
            } />
              
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
