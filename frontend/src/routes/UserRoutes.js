import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedUserRoute from '../middleware/authMiddleware';
import DashboardLayout from '../layout/DashboardLayout';
import UserDashboard from '../components/dashboard/Dashboard';
import UserProfile from '../components/user/Profile';
import UserHistory from '../components/user/History';
import SupportTickets from '../components/user/SupportTickets';
import UserTicketDetail from '../components/user/UserTicketDetail';

const UserRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={
        <ProtectedUserRoute>
          <DashboardLayout>
            <UserDashboard />
          </DashboardLayout>
        </ProtectedUserRoute>
      } />
      
      <Route path="/dashboard" element={
        <ProtectedUserRoute>
          <DashboardLayout>
            <UserDashboard />
          </DashboardLayout>
        </ProtectedUserRoute>
      } />
      
      <Route path="/profile" element={
        <ProtectedUserRoute>
          <DashboardLayout>
            <div className="container mt-4">
              <UserProfile />
            </div>
          </DashboardLayout>
        </ProtectedUserRoute>
      } />
      
      <Route path="/history" element={
        <ProtectedUserRoute>
          <DashboardLayout>
            <div className="container mt-4">
              <UserHistory />
            </div>
          </DashboardLayout>
        </ProtectedUserRoute>
      } />
      
      <Route path="/support" element={
        <ProtectedUserRoute>
          <DashboardLayout>
            <div className="container mt-4">
              <SupportTickets />
            </div>
          </DashboardLayout>
        </ProtectedUserRoute>
      } />
      
      <Route path="/support/tickets/:id" element={
        <ProtectedUserRoute>
          <DashboardLayout>
            <UserTicketDetail />
          </DashboardLayout>
        </ProtectedUserRoute>
      } />
    </Routes>
  );
};

export default UserRoutes;