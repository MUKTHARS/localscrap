import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedAdminRoute = ({ children, requiredRole }) => {
  let adminUser = null;
  
  try {
    const stored = localStorage.getItem('admin_user');
    if (stored) adminUser = JSON.parse(stored);
  } catch (e) {
    localStorage.removeItem('admin_user');
  }
  
  if (!adminUser) {
    return <Navigate to="/admin/login" replace />;
  }
  
  if (requiredRole && adminUser.role !== requiredRole) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

export default ProtectedAdminRoute;