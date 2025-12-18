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
function ProtectedAdminRoute({ children, requiredRole }) {
  // Check LocalStorage for UI state safely
  let adminUser = null;
  try {
    const stored = localStorage.getItem('admin_user');
    if (stored) adminUser = JSON.parse(stored);
  } catch (e) {
    localStorage.removeItem('admin_user'); // Clear corrupted data
  }
  
  if (!adminUser) {
    return <Navigate to="/admin/login" replace />;
  }
  
  if (requiredRole && adminUser.role !== requiredRole) {
    // If employee tries to access admin-only route, send to dashboard
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
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
      // Use relative path so it works on localhost AND production
      await fetch('/api/admin/logout', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            {/* REMOVED: isAdminLoggedIn logic. 
                Now, if an admin visits /, they see the user homepage. 
                If they want the dashboard, they must go to /admin */}
            
            <Route path="/login" element={<UserLogin />} />
            
            <Route path="/" element={
               <ProtectedUserRoute><UserNavbar /><UserDashboard /></ProtectedUserRoute>
            } />
            
            <Route path="/dashboard" element={
              <ProtectedUserRoute><UserNavbar /><UserDashboard /></ProtectedUserRoute>
            } />
            
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

            {/* ... Keep all other Admin Routes exactly as they are ... */}
            <Route path="/tickets" element={<ProtectedAdminRoute><AdminLayout><AdminTickets user={JSON.parse(localStorage.getItem('admin_user'))} /></AdminLayout></ProtectedAdminRoute>} />
            <Route path="/tickets/:id" element={<ProtectedAdminRoute><AdminLayout><AdminTicketDetail /></AdminLayout></ProtectedAdminRoute>} />
            <Route path="/users" element={<ProtectedAdminRoute><AdminLayout><AdminUsers /></AdminLayout></ProtectedAdminRoute>} />
            <Route path="/assign" element={<ProtectedAdminRoute requiredRole="admin"><AdminLayout><AssignTickets /></AdminLayout></ProtectedAdminRoute>} />
            <Route path="/employees" element={<ProtectedAdminRoute requiredRole="admin"><AdminLayout><Employees /></AdminLayout></ProtectedAdminRoute>} />

            {/* Catch All */}
            {/* If they type /admin and nothing else, send to admin login or dashboard */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" />} />
            
            {/* General Catch All: Send to User Dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
