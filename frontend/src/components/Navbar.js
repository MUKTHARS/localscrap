
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Navbar.css';
import logoImg from '../assets/tutomart-logo.jpeg';

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
        {/* Left Side - Logo and Welcome */}
        <div className="nav-left-section">
          {/* Brand Logo */}
          <Link className="nav-brand" to="/dashboard" onClick={closeMobileMenu}>
            <img 
              src={logoImg} 
              alt="TutoMart" 
              style={{ 
                height: '52px', 
                width: 'auto', 
                borderRadius: '5px',
                objectFit: 'contain'
              }} 
            />
          </Link>
          
          {/* Welcome Text - Desktop Only */}
          <div className="welcome-desktop">
            <div className="nav-welcome">
              <span className="welcome-text">Welcome back,</span>
              <span className="user-name">{user?.name}</span>
            </div>
          </div>
        </div>

        {/* Desktop Navigation - Right Side */}
        <div className="nav-desktop">
          <div className="nav-links">
            <Link 
              className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
              to="/dashboard"
            >
              <span>Dashboard</span>
            </Link>
            
            <Link 
              className={`nav-link ${location.pathname === '/support' ? 'active' : ''}`}
              to="/support"
            >
              <span>Support</span>
            </Link>
            
            <Link 
              className={`nav-link ${location.pathname === '/history' ? 'active' : ''}`}
              to="/history"
            >
              <span>History</span>
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
              className={`mobile-nav-link ${location.pathname === '/support' ? 'active' : ''}`}
              to="/support"
              onClick={closeMobileMenu}
            >
              <i className="bi bi-ticket-perforated"></i>
              <span>Support</span>
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
            
            <Link 
              className={`mobile-nav-link ${location.pathname === '/history' ? 'active' : ''}`}
              to="/history"
              onClick={closeMobileMenu}
            >
              <i className="bi bi-clock-history"></i>
              <span>History</span>
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
