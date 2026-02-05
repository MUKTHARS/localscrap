import React from 'react';
import Navbar from '../components/navigation/Navbar';
import ChatWidget from '../components/common/ChatWidget';

const MainLayout = ({ children }) => {
  return (
    <>
      <Navbar />
      <main className="main-content">
        {children}
      </main>
      <ChatWidget />
    </>
  );
};

export default MainLayout;