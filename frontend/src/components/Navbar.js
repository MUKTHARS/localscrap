import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Navbar.css';

const Navbar = () => {
  const auth = useAuth() || {};
  const user = auth.user || null;
  const logout = auth.logout || (() => Promise.resolve());
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="premium-navbar">
      <div className="nav-container">
        {/* Brand Logo */}
        <Link className="nav-brand" to="/dashboard" onClick={closeMobileMenu}>
          {/* <div className="brand-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div> */}
          <span className="brand-text">TutoMart</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="nav-desktop">
          <div className="nav-welcome">
            <span className="welcome-text">Welcome back,</span>
            <span className="user-name">{user?.name}</span>
          </div>
          
          <div className="nav-links">
            <Link 
              className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
              to="/dashboard"
            >
             
              <span>Dashboard</span>
            </Link>
            
            <Link 
              className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
              to="/profile"
            >
             
              <span>Profile</span>
            </Link>
            
            <button 
              className="nav-link logout-btn"
              onClick={handleLogout}
            >
             
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className={`mobile-menu-btn ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Mobile Navigation */}
        <div className={`nav-mobile ${isMobileMenuOpen ? 'active' : ''}`}>
          <div className="mobile-user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <div className="user-name-mobile">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>

          <div className="mobile-nav-links">
            <Link 
              className={`mobile-nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
              to="/dashboard"
              onClick={closeMobileMenu}
            >
              <i className="bi bi-house"></i>
              <span>Dashboard</span>
              <div className="link-indicator"></div>
            </Link>
            
            <Link 
              className={`mobile-nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
              to="/profile"
              onClick={closeMobileMenu}
            >
              <i className="bi bi-person"></i>
              <span>Profile</span>
              <div className="link-indicator"></div>
            </Link>
            
            <button 
              className="mobile-nav-link logout-btn"
              onClick={handleLogout}
            >
              <i className="bi bi-box-arrow-right"></i>
              <span>Logout</span>
              <div className="link-indicator"></div>
            </button>
          </div>
        </div>

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div className="mobile-overlay" onClick={closeMobileMenu}></div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
