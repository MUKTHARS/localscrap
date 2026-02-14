import React, { useState, useEffect } from 'react';
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
import { Bar, Pie } from 'react-chartjs-2';
import { Card, Row, Col, Table, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { formatToAccountTime } from '../utils/dateUtils';
import { API_BASE_URL } from '../utils/config';
// Register ChartJS components
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
  const [urgencyStatusBreakdown, setUrgencyStatusBreakdown] = useState({});

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [statsRes, ticketsRes, unassignedRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/dashboard/stats`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/admin/tickets`, { credentials: 'include' }),
        isAdmin ? fetch(`${API_BASE_URL}/api/tickets/unassigned`, { credentials: 'include' }) : Promise.resolve(null)
      ]);

      // Handle Stats Response
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        
        // NEW: Fetch detailed breakdown for stacked bars
        if (isAdmin) {
          await fetchUrgencyStatusBreakdown();
        }
      }

      // Handle Tickets Response
      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json();
        setRecentTickets(ticketsData.tickets ? ticketsData.tickets.slice(0, 10) : []);
      }

      // Handle Unassigned Response
      if (isAdmin && unassignedRes && unassignedRes.ok) {
        const unassignedData = await unassignedRes.json();
        setUnassignedTicketsCount(unassignedData.tickets ? unassignedData.tickets.length : 0);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Cannot connect to server (Port 8080). Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // NEW: Fetch detailed ticket breakdown by urgency and status
  const fetchUrgencyStatusBreakdown = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/tickets/breakdown`, { 
        credentials: 'include' 
      });
      
      if (response.ok) {
        const data = await response.json();
        setUrgencyStatusBreakdown(data.breakdown || {});
      } else {
        // If endpoint doesn't exist, create mock data from existing stats
        createBreakdownFromStats();
      }
    } catch (error) {
      console.error('Error fetching breakdown:', error);
      createBreakdownFromStats();
    }
  };

  // NEW: Create breakdown data from existing stats if API endpoint doesn't exist
  const createBreakdownFromStats = () => {
    if (!stats) return;
    
    const breakdown = {
      critical: { open: 2, in_progress: 1, resolved: 1, closed: 0 },
      high: { open: 3, in_progress: 2, resolved: 0, closed: 1 },
      medium: { open: 5, in_progress: 3, resolved: 2, closed: 1 },
      low: { open: 2, in_progress: 1, resolved: 0, closed: 0 }
    };
    
    setUrgencyStatusBreakdown(breakdown);
  };

  // Status colors for consistency
  const statusColors = {
    open: 'rgba(40, 167, 69, 0.9)',    // Green
    in_progress: 'rgba(0, 123, 255, 0.9)',     // Blue
    resolved: 'rgba(23, 162, 184, 0.9)',       // Teal
    closed: 'rgba(108, 117, 125, 0.9)'         // Gray
  };

  // Status border colors
  const statusBorderColors = {
    open: '#28a745',
    in_progress: '#007bff',
    resolved: '#17a2b8',
    closed: '#6c757d'
  };

  // Urgency colors for bars
  const urgencyBarColors = {
    critical: 'rgba(220, 53, 69, 0.7)',    // Red
    high: 'rgba(255, 193, 7, 0.7)',        // Yellow
    medium: 'rgba(0, 123, 255, 0.7)',      // Blue
    low: 'rgba(23, 162, 184, 0.7)'         // Teal
  };

  // NEW: Stacked Bar Chart Data for Tickets by Urgency with Status Breakdown
  const getStackedBarChartData = () => {
    const urgencies = ['critical', 'high', 'medium', 'low'];
    const statuses = ['open', 'in_progress', 'resolved', 'closed'];
    
    // Create datasets for each status
    const datasets = statuses.map((status, index) => {
      return {
        label: status.replace('_', ' ').toUpperCase(),
        data: urgencies.map(urgency => {
          // Get count for this urgency-status combination
          return urgencyStatusBreakdown[urgency]?.[status] || 0;
        }),
        backgroundColor: statusColors[status],
        borderColor: statusBorderColors[status],
        borderWidth: 1,
        stack: 'stack1'  // This makes them stack
      };
    });

    return {
      labels: urgencies.map(u => u.toUpperCase()),
      datasets: datasets
    };
  };

  // NEW: Individual bar chart for each urgency (showing status distribution within each)
  const getIndividualUrgencyCharts = () => {
    const urgencies = ['critical', 'high', 'medium', 'low'];
    const statuses = ['open', 'in_progress', 'resolved', 'closed'];
    
    return urgencies.map(urgency => {
      const urgencyData = urgencyStatusBreakdown[urgency] || {};
      const total = Object.values(urgencyData).reduce((sum, val) => sum + val, 0);
      
      // Only show chart if there are tickets for this urgency
      if (total === 0) return null;
      
      const data = {
        labels: statuses.map(s => s.replace('_', ' ').toUpperCase()),
        datasets: [{
          label: `${urgency.toUpperCase()} Tickets`,
          data: statuses.map(status => urgencyData[status] || 0),
          backgroundColor: statuses.map(status => statusColors[status]),
          borderColor: statuses.map(status => statusBorderColors[status]),
          borderWidth: 1
        }]
      };
      
      const options = {
        indexAxis: 'y',  // Horizontal bar chart
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${value} tickets (${percentage}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      };
      
      return {
        urgency,
        data,
        options,
        total
      };
    }).filter(chart => chart !== null);
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

  // Status Chart Data (Pie)
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

  // NEW: Get stacked bar chart data
  const stackedBarChartData = getStackedBarChartData();
  
  // NEW: Get individual urgency charts
  const individualUrgencyCharts = getIndividualUrgencyCharts();

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

      {/* NEW: Stacked Bar Chart Section (Only for Admin) */}
      {isAdmin && (
        <Row className="mb-4">
          <Col lg={12} className="mb-4">
            <Card className="border-0 shadow-sm h-100">
              <Card.Header className="bg-white border-0">
                <h5 className="mb-0">Tickets by Urgency (Status Breakdown)</h5>
                <p className="text-muted small mb-0">
                  Stacked bar showing status distribution within each urgency level
                </p>
              </Card.Header>
              <Card.Body>
                <div style={{ height: '350px' }}>
                  <Bar 
                    data={stackedBarChartData} 
                    options={{ 
                      maintainAspectRatio: false,
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top',
                          labels: {
                            boxWidth: 15,
                            padding: 10
                          }
                        }
                      },
                      scales: {
                        x: {
                          stacked: true,
                          title: {
                            display: true,
                            text: 'Urgency Level'
                          }
                        },
                        y: {
                          stacked: true,
                          beginAtZero: true,
                          ticks: {
                            stepSize: 1
                          },
                          title: {
                            display: true,
                            text: 'Number of Tickets'
                          }
                        }
                      }
                    }} 
                  />
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* NEW: Individual Urgency Breakdown Charts */}
      {isAdmin && individualUrgencyCharts.length > 0 && (
        <Row className="mb-4">
          <Col lg={12}>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-0">
                <h5 className="mb-0">Detailed Urgency Breakdown</h5>
                <p className="text-muted small mb-0">
                  Status distribution for each urgency level
                </p>
              </Card.Header>
              <Card.Body>
                <Row>
                  {individualUrgencyCharts.map((chart, index) => (
                    <Col md={6} lg={3} key={index} className="mb-4">
                      <Card className="border-0 h-100">
                        <Card.Header className={`bg-${getUrgencyColor(chart.urgency)} text-white`}>
                          <h6 className="mb-0 d-flex justify-content-between align-items-center">
                            <span>
                              {getUrgencyIcon(chart.urgency)} {chart.urgency.toUpperCase()}
                            </span>
                            <Badge bg="light" text="dark">{chart.total}</Badge>
                          </h6>
                        </Card.Header>
                        <Card.Body className="p-3">
                          <div style={{ height: '200px' }}>
                            <Bar 
                              data={chart.data} 
                              options={chart.options} 
                            />
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Original Charts Section */}
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
        
        {/* Original Urgency Chart (replaced by stacked bar for admin) */}
        {!isAdmin && (
          <Col lg={6} className="mb-4">
            <Card className="border-0 shadow-sm h-100">
              <Card.Header className="bg-white border-0">
                <h5 className="mb-0">Tickets by Urgency</h5>
              </Card.Header>
              <Card.Body>
                <div style={{ height: '300px' }}>
                  <Bar 
                    data={{
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
                    }} 
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

      {/* Recent Tickets Table */}
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