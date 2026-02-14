import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/fonts.css';
import './styles/App.css';
// import UserLogin from './components/Login'; 
import UserLogin from'./components/auth/Login';
import UserRoutes from './routes/UserRoutes';
import AdminRoutes from './routes/AdminRoutes';
import AdminLogin from './admin/Login'; 

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<UserLogin />} />
            <Route path="/admin/login" element={
              <AdminLogin onLogin={() => window.location.href = '/admin/dashboard'} />
            } />
            
            {/* User Routes */}
            <Route path="/*" element={<UserRoutes />} />
            
            {/* Admin Routes */}
            <Route path="/admin/*" element={<AdminRoutes />} />
            
            {/* Redirects */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;