import React from 'react';
import AdminNavbar from '../admin/Navigation';

const AdminLayout = ({ children, user, onLogout }) => {
  return (
    <>
      <AdminNavbar user={user} onLogout={onLogout} />
      <div className="container-fluid mt-3">
        {children}
      </div>
    </>
  );
};

export default AdminLayout;