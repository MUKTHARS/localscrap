import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedAdminRoute from '../middleware/adminMiddleware';
import AdminLayout from '../layout/AdminLayout';
import AdminDashboard from '../admin/Dashboard';
import AdminTickets from '../admin/Tickets';
import AdminTicketDetail from '../admin/TicketDetail';
import AdminUsers from '../admin/Users';
import AssignTickets from '../admin/AssignTickets';
import Employees from '../admin/Employees';
import QuizManager from '../admin/QuizManager';

const AdminRoutes = () => {
  const [adminUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('admin_user'));
    } catch { return null; }
  });

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      localStorage.removeItem('admin_user');
      window.location.href = '/admin/login';
    }
  };

  return (
    <Routes>
      <Route path="/dashboard" element={
        <ProtectedAdminRoute>
          <AdminLayout user={adminUser} onLogout={logout}>
            <AdminDashboard user={adminUser} />
          </AdminLayout>
        </ProtectedAdminRoute>
      } />
      
      <Route path="/tickets" element={
        <ProtectedAdminRoute>
          <AdminLayout user={adminUser} onLogout={logout}>
            <AdminTickets user={adminUser} />
          </AdminLayout>
        </ProtectedAdminRoute>
      } />
      
      <Route path="/tickets/:id" element={
        <ProtectedAdminRoute>
          <AdminLayout user={adminUser} onLogout={logout}>
            <AdminTicketDetail user={adminUser} />
          </AdminLayout>
        </ProtectedAdminRoute>
      } />
      
      <Route path="/users" element={
        <ProtectedAdminRoute>
          <AdminLayout user={adminUser} onLogout={logout}>
            <AdminUsers user={adminUser} />
          </AdminLayout>
        </ProtectedAdminRoute>
      } />
      
      <Route path="/assign" element={
        <ProtectedAdminRoute requiredRole="admin">
          <AdminLayout user={adminUser} onLogout={logout}>
            <AssignTickets />
          </AdminLayout>
        </ProtectedAdminRoute>
      } />
      
      <Route path="/employees" element={
        <ProtectedAdminRoute requiredRole="admin">
          <AdminLayout user={adminUser} onLogout={logout}>
            <Employees user={adminUser} />
          </AdminLayout>
        </ProtectedAdminRoute>
      } />
      
      <Route path="/quiz-manager" element={
        <ProtectedAdminRoute requiredRole="admin">
          <AdminLayout user={adminUser} onLogout={logout}>
            <QuizManager user={adminUser} />
          </AdminLayout>
        </ProtectedAdminRoute>
      } />
    </Routes>
  );
};

export default AdminRoutes;