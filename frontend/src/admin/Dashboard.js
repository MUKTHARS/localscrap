import React, { useState, useEffect } from 'react';
import { Bar, Pie } from 'react-chartjs-2'; // Removed unused imports for cleaner code
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Card, Row, Col, Table, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { formatToAccountTime } from '../utils/dateUtils';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  PointElement,
  LineElement
);

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [unassignedTicketsCount, setUnassignedTicketsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Define Base URL for Flask Backend
  const API_BASE_URL = 'https://api.tutomart.com';
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Fetch Stats
      // 2. Fetch Tickets (Corrected endpoint to /api/admin/tickets)
      // 3. Fetch Unassigned (Only if Admin)
      
      const [statsRes, ticketsRes, unassignedRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/dashboard/stats`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/admin/tickets`, { credentials: 'include' }),
        isAdmin ? fetch(`${API_BASE_URL}/api/tickets/unassigned`, { credentials: 'include' }) : Promise.resolve(null)
      ]);

      // --- Handle Stats Response ---
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      } else {
        // If 401, session might be expired
        if(statsRes.status === 401) setError('Session expired. Please login again.');
        else setError('Failed to load dashboard stats');
      }

      // --- Handle Tickets Response ---
      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json();
        // Backend returns { tickets: [...] }
        // We slice the first 10 for the "Recent" view
        setRecentTickets(ticketsData.tickets ? ticketsData.tickets.slice(0, 10) : []);
      }

      // --- Handle Unassigned Response ---
      if (isAdmin && unassignedRes && unassignedRes.ok) {
        const unassignedData = await unassignedRes.json();
        // Backend returns { tickets: [...] }, we need the count
        setUnassignedTicketsCount(unassignedData.tickets ? unassignedData.tickets.length : 0);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Cannot connect to server (Port 8080). Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'info';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'success';
      case 'in_progress': return 'primary';
      case 'resolved': return 'info';
      case 'closed': return 'secondary';
      default: return 'light';
    }
  };

  const getUrgencyIcon = (urgency) => {
    switch (urgency) {
      case 'critical': return '🔥';
      case 'high': return '⚠️';
      case 'medium': return '📋';
      case 'low': return '📝';
      default: return '📌';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return '🟢';
      case 'in_progress': return '🟡';
      case 'resolved': return '🔵';
      case 'closed': return '⚫';
      default: return '⚪';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status" variant="primary">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3 text-muted">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-5">
        <Alert variant="danger">
          <Alert.Heading>Error Loading Dashboard</Alert.Heading>
          <p>{error}</p>
          <Button variant="outline-danger" onClick={fetchDashboardData}>
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  // Status Chart Data
  const statusChartData = {
    labels: ['Open', 'In Progress', 'Resolved', 'Closed'],
    datasets: [{
      label: 'Tickets by Status',
      data: [
        stats?.tickets_by_status?.open || 0,
        stats?.tickets_by_status?.in_progress || 0,
        stats?.tickets_by_status?.resolved || 0,
        stats?.tickets_by_status?.closed || 0
      ],
      backgroundColor: [
        'rgba(40, 167, 69, 0.7)',
        'rgba(0, 123, 255, 0.7)',
        'rgba(23, 162, 184, 0.7)',
        'rgba(108, 117, 125, 0.7)'
      ],
      borderColor: [
        '#28a745',
        '#007bff',
        '#17a2b8',
        '#6c757d'
      ],
      borderWidth: 1
    }]
  };

  // Urgency Chart Data
  const urgencyChartData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      label: 'Tickets by Urgency',
      data: [
        stats?.tickets_by_urgency?.critical || 0,
        stats?.tickets_by_urgency?.high || 0,
        stats?.tickets_by_urgency?.medium || 0,
        stats?.tickets_by_urgency?.low || 0
      ],
      backgroundColor: [
        'rgba(220, 53, 69, 0.7)',
        'rgba(255, 193, 7, 0.7)',
        'rgba(0, 123, 255, 0.7)',
        'rgba(23, 162, 184, 0.7)'
      ],
      borderColor: [
        '#dc3545',
        '#ffc107',
        '#007bff',
        '#17a2b8'
      ],
      borderWidth: 1
    }]
  };

  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="mb-1">Dashboard Overview</h1>
          <p className="text-muted mb-0">
            Welcome back, <strong>{user?.name}</strong>! 
            {isAdmin ? ' Here\'s your system overview.' : ' Here are your assigned tickets.'}
          </p>
        </div>
        <div>
          <Button variant="outline-primary" onClick={fetchDashboardData} className="me-2">
            Refresh
          </Button>
          {isAdmin && (
            <>
              <Button as={Link} to="/tickets" variant="primary" className="me-2">
                Manage Tickets
              </Button>
              <Button as={Link} to="/assign" variant="warning">
                Assign Tickets
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <Row className="mb-4">
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <h2 className="fw-bold text-primary">{stats?.total_tickets || 0}</h2>
              <Card.Title className="mb-0">Total Tickets</Card.Title>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <h2 className="fw-bold text-success">{stats?.tickets_by_status?.open || 0}</h2>
              <Card.Title className="mb-0">Open Tickets</Card.Title>
            </Card.Body>
          </Card>
        </Col>

        {isAdmin ? (
          <>
            <Col md={3} className="mb-3">
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="text-center">
                  <h2 className="fw-bold text-info">{stats?.total_users || 0}</h2>
                  <Card.Title className="mb-0">Total Users</Card.Title>
                </Card.Body>
              </Card>
            </Col>

            <Col md={3} className="mb-3">
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="text-center">
                  <h2 className="fw-bold text-warning">{stats?.total_employees || 0}</h2>
                  <Card.Title className="mb-0">Active Employees</Card.Title>
                </Card.Body>
              </Card>
            </Col>
          </>
        ) : (
          <>
            <Col md={3} className="mb-3">
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="text-center">
                  <h2 className="fw-bold text-primary">{stats?.tickets_by_status?.in_progress || 0}</h2>
                  <Card.Title className="mb-0">In Progress</Card.Title>
                </Card.Body>
              </Card>
            </Col>

            <Col md={3} className="mb-3">
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="text-center">
                  <h2 className="fw-bold text-info">{stats?.tickets_by_status?.resolved || 0}</h2>
                  <Card.Title className="mb-0">Resolved</Card.Title>
                </Card.Body>
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* Additional Stats Row for Admin */}
      {isAdmin && (
        <Row className="mb-4">
          <Col md={4} className="mb-3">
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="text-center">
                <h2 className="fw-bold text-danger">{stats?.tickets_by_urgency?.critical || 0}</h2>
                <Card.Title className="mb-0">Critical</Card.Title>
              </Card.Body>
            </Card>
          </Col>

          <Col md={4} className="mb-3">
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="text-center">
                <h2 className="fw-bold text-warning">{unassignedTicketsCount}</h2>
                <Card.Title className="mb-0">Unassigned</Card.Title>
              </Card.Body>
            </Card>
          </Col>

          <Col md={4} className="mb-3">
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="text-center">
                <h2 className="fw-bold text-secondary">{stats?.tickets_by_status?.closed || 0}</h2>
                <Card.Title className="mb-0">Closed</Card.Title>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Charts Section */}
      <Row className="mb-4">
        <Col lg={isAdmin ? 6 : 12} className="mb-4">
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-0">
              <h5 className="mb-0">Tickets by Status</h5>
            </Card.Header>
            <Card.Body>
              <div style={{ height: '300px' }}>
                <Pie 
                  data={statusChartData} 
                  options={{ 
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                  }} 
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        {isAdmin && (
          <Col lg={6} className="mb-4">
            <Card className="border-0 shadow-sm h-100">
              <Card.Header className="bg-white border-0">
                <h5 className="mb-0">Tickets by Urgency</h5>
              </Card.Header>
              <Card.Body>
                <div style={{ height: '300px' }}>
                  <Bar 
                    data={urgencyChartData} 
                    options={{ 
                      maintainAspectRatio: false,
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                    }} 
                  />
                </div>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>

      {/* Recent Tickets */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white border-0 d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            {isAdmin ? 'Recent Tickets' : 'My Recent Tickets'}
            <Badge bg="light" text="dark" className="ms-2">
              {recentTickets.length}
            </Badge>
          </h5>
          <Link to="/tickets" className="btn btn-sm btn-outline-primary">
            View All
          </Link>
        </Card.Header>
        <Card.Body>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Subject</th>
                  {isAdmin && <th>Customer</th>}
                  {isAdmin && <th>Assigned To</th>}
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.length > 0 ? (
                  recentTickets.map(ticket => (
                    <tr key={ticket.id}>
                      <td>
                        <Link to={`/tickets/${ticket.id}`} className="text-decoration-none fw-bold">
                          #{ticket.ticket_number}
                        </Link>
                      </td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '200px' }}>
                          {ticket.subject}
                        </div>
                      </td>
                      {isAdmin && (
                        <td>
                          <div>
                            <div className="fw-bold">{ticket.user_name}</div>
                            <small className="text-muted">{ticket.user_email}</small>
                          </div>
                        </td>
                      )}
                      {isAdmin && (
                        <td>
                          {ticket.assigned_employee_name ? (
                            <Badge bg="info">{ticket.assigned_employee_name}</Badge>
                          ) : (
                            <Badge bg="warning">Unassigned</Badge>
                          )}
                        </td>
                      )}
                      <td>
                        <Badge bg={getUrgencyColor(ticket.urgency)}>
                          {getUrgencyIcon(ticket.urgency)} {ticket.urgency.toUpperCase()}
                        </Badge>
                      </td>
                      <td>
                        <Badge bg={getStatusColor(ticket.status)}>
                          {getStatusIcon(ticket.status)} {ticket.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td>
                        {formatToAccountTime(ticket.created_at, user?.timezone)}
                      </td>
                      <td>
                        <Button
                          as={Link}
                          to={`/tickets/${ticket.id}`}
                          size="sm"
                          variant="outline-primary"
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 6} className="text-center py-4">
                      <p className="mb-0 text-muted">No tickets found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Dashboard;
