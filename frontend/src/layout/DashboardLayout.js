import React from 'react';
import Navbar from '../components/navigation/Navbar';
import ChatWidget from '../components/common/ChatWidget';

const DashboardLayout = ({ children }) => {
  return (
    <>
      <Navbar />
      <div className="dashboard-layout">
        {children}
      </div>
      <ChatWidget />
    </>
  );
};

export default DashboardLayout;