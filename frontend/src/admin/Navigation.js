import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, Button, Dropdown } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Navigation = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(user);

  // --- 1. ROBUST USER LOADING ---
  // If 'user' prop is missing or incomplete, try to load from localStorage as fallback
  useEffect(() => {
    if (user && user.role) {
      setCurrentUser(user);
    } else {
      const stored = localStorage.getItem('admin_user');
      if (stored) {
        try {
          setCurrentUser(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse stored user");
        }
      }
    }
  }, [user]);

  // --- 2. PRECISE ROLE CHECKING ---
  // .trim() removes accidental spaces from DB (e.g. "employee ")
  // .toLowerCase() ensures "Employee" matches "employee"
  const rawRole = currentUser?.role || '';
  const role = rawRole.trim().toLowerCase();

  // Debugging: Check your console to see exactly what the role is
  // console.log("Navigation User:", currentUser, "Detected Role:", role);

  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';
  const isStaff = isAdmin || isEmployee;

  // --- 3. DYNAMIC LINKS ---
  // Staff -> Admin Dashboard (/admin/dashboard)
  // Customers -> User Dashboard (/dashboard)
  const dashboardLink = isStaff ? '/admin/dashboard' : '/dashboard';
  
  // const API_BASE_URL = 'https://api.tutomart.com';
const API_BASE_URL = 'http://api.localhost:3001';
  const handleLogout = async () => {
    try {
      const endpoint = isStaff ? '/api/admin/logout' : '/api/auth/logout';
      await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    } catch (error) {
      console.error("Logout API failed", error);
    } finally {
      if (onLogout) onLogout();
      // Remove specific storage keys
      localStorage.removeItem('admin_user');
      navigate(isStaff ? '/admin/login' : '/login');
    }
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="mb-3 shadow">
      <Container fluid>
        {/* --- BRAND LOGO --- */}
        <Navbar.Brand as={Link} to={dashboardLink} className="d-flex align-items-center">
          <div className="me-2">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <span className="fw-bold text-white">TutoMart</span>
            <small className="d-block text-light opacity-75" style={{ fontSize: '0.75rem' }}>
              {isAdmin ? 'Admin Panel' : isStaff ? 'Staff Portal' : 'Support Portal'}
            </small>
          </div>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {/* This checks if you are staff. If yes, it sends you to /admin/dashboard */}
            <Nav.Link 
              as={Link} 
              to={dashboardLink} 
              active={location.pathname === '/dashboard' || location.pathname === '/admin/dashboard'}
              className="d-flex align-items-center"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="me-1">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
              Dashboard
            </Nav.Link>
            
            {/* --- TICKETS LINK (Common) --- */}
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
            
            {/* --- ADMIN ONLY MENU --- */}
            {isAdmin && (
              <Dropdown as={Nav.Item}>
                <Dropdown.Toggle as={Nav.Link} className="d-flex align-items-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="me-1">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                  Management
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item as={Link} to="/users">
                    <i className="bi bi-people me-2"></i>Users
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/employees">
                    <i className="bi bi-person-badge me-2"></i>Employees
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            )}

            {/* --- ASSIGN TICKETS (Staff Only) --- */}
            {isStaff && (
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
            )}
          </Nav>

          {/* --- USER PROFILE --- */}
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
                      {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                </div>
                <div className="text-start d-none d-md-block">
                  <div className="small fw-bold">{currentUser?.name}</div>
                  <div className="small text-light opacity-75" style={{ fontSize: '0.7rem' }}>
                    {isAdmin ? 'Administrator' : isStaff ? 'Support Staff' : 'User'}
                  </div>
                </div>
              </Dropdown.Toggle>

              <Dropdown.Menu>
                <Dropdown.Header>
                  <div className="fw-bold">{currentUser?.name}</div>
                  <small className="text-muted">{currentUser?.email}</small>
                </Dropdown.Header>
                <Dropdown.Divider />
                
                <Dropdown.Item as={Link} to={dashboardLink}>
                  <i className="bi bi-speedometer2 me-2"></i> Dashboard
                </Dropdown.Item>
                
                <Dropdown.Item as={Link} to="/tickets">
                  <i className="bi bi-ticket-perforated me-2"></i> My Tickets
                </Dropdown.Item>
                
                <Dropdown.Divider />
                
                <Dropdown.Item onClick={handleLogout} className="text-danger">
                  <i className="bi bi-box-arrow-right me-2"></i> Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>

            {/* --- QUICK ACTION (Staff Only) --- */}
            {isStaff && (
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

            {/* Mobile Logout */}
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
