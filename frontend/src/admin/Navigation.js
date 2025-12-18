import React from 'react';
import { Navbar, Nav, Container, Button, Dropdown } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Navigation = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  // Define Base URL for Flask Backend
  const API_BASE_URL = 'http://localhost:8080';

  const handleLogout = async () => {
    try {
      // 1. Call Backend to clear HttpOnly Cookie
      await fetch(`${API_BASE_URL}/api/admin/logout`, {
        method: 'POST',
        credentials: 'include' // Critical: sends the cookie so server can delete it
      });
    } catch (error) {
      console.error("Logout API failed", error);
    } finally {
      // 2. Clear Frontend State
      onLogout();
      // 3. Redirect
      navigate('/login');
    }
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="mb-3 shadow">
      <Container fluid>
        {/* Brand/Logo Section */}
        <Navbar.Brand as={Link} to="/dashboard" className="d-flex align-items-center">
          <div className="me-2">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <span className="fw-bold text-white">TutoMart</span>
            <small className="d-block text-light opacity-75" style={{ fontSize: '0.75rem' }}>
              {isAdmin ? 'Admin Dashboard' : 'Support Portal'}
            </small>
          </div>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        <Navbar.Collapse id="basic-navbar-nav">
          {/* Left Navigation Links */}
          <Nav className="me-auto">
            <Nav.Link 
              as={Link} 
              to="/dashboard" 
              active={location.pathname === '/dashboard'}
              className="d-flex align-items-center"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="me-1">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
              Dashboard
            </Nav.Link>
            
            <Nav.Link 
              as={Link} 
              to="/tickets" 
              active={location.pathname === '/tickets' || location.pathname.startsWith('/tickets/')}
              className="d-flex align-items-center"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="me-1">
                <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
              </svg>
              Tickets
            </Nav.Link>
            
            {isAdmin && (
              <>
                <Dropdown as={Nav.Item}>
                  <Dropdown.Toggle as={Nav.Link} className="d-flex align-items-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="me-1">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                    Management
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item as={Link} to="/users">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="me-2">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                      Users
                    </Dropdown.Item>
                    <Dropdown.Item as={Link} to="/employees">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="me-2">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                      </svg>
                      Employees
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>

                 <Nav.Link 
                    as={Link} 
                    to="/assign" 
                    active={location.pathname === '/assign'}
                    className="d-flex align-items-center"
                  >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="me-1">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  Assign Tickets
                </Nav.Link>
              </>
            )}
          </Nav>

          {/* Right Section - User Info */}
          <Nav className="align-items-center">
            <Dropdown align="end">
              <Dropdown.Toggle 
                as={Button} 
                variant="outline-light" 
                size="sm"
                className="d-flex align-items-center"
              >
                <div className="me-2">
                  <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center" 
                       style={{ width: '32px', height: '32px' }}>
                    <span className="text-white fw-bold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="text-start d-none d-md-block">
                  <div className="small fw-bold">{user?.name}</div>
                  <div className="small text-light opacity-75" style={{ fontSize: '0.7rem' }}>
                    {user?.role === 'admin' ? 'Administrator' : 'Support Staff'}
                  </div>
                </div>
              </Dropdown.Toggle>

              <Dropdown.Menu>
                <Dropdown.Header>
                  <div className="fw-bold">{user?.name}</div>
                  <small className="text-muted">{user?.email}</small>
                </Dropdown.Header>
                <Dropdown.Divider />
                <Dropdown.Item as={Link} to="/dashboard">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="me-2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  Dashboard
                </Dropdown.Item>
                <Dropdown.Item as={Link} to="/tickets">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="me-2">
                    <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
                  </svg>
                  My Tickets
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout} className="text-danger">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="me-2">
                    <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                  </svg>
                  Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>

            {/* Quick Actions for Admin */}
            {isAdmin && (
              <Button 
                variant="primary" 
                size="sm" 
                className="ms-3 d-none d-md-block"
                onClick={() => navigate('/tickets')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="me-1">
                  <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
                </svg>
                View All Tickets
              </Button>
            )}

            {/* Mobile Logout Button */}
            <div className="d-lg-none mt-3">
              <Button 
                variant="outline-light" 
                onClick={handleLogout}
                className="w-100"
              >
                Logout
              </Button>
            </div>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;