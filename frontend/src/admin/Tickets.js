import React, { useState, useEffect } from 'react';
import { Table, Badge, Button, Form, Modal, InputGroup, Alert, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Tickets = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAdmin = user?.role === 'admin';

  // Define Base URL
  const API_BASE_URL = 'http://localhost:8080';

  useEffect(() => {
    fetchTickets();
    if (isAdmin) {
      fetchEmployees();
    }
  }, [filter]);

  const fetchTickets = async () => {
    try {
      // FIX: Changed endpoint to /api/admin/tickets and added credentials
      const response = await fetch(`${API_BASE_URL}/api/admin/tickets`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setError('Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      // FIX: Added URL and credentials
      const response = await fetch(`${API_BASE_URL}/api/admin/employees`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees ? data.employees.filter(emp => emp.is_active) : []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      // FIX: Added URL and credentials
      const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include'
      });

      if (response.ok) {
        fetchTickets(); // Refresh the list
        setSuccess('Ticket status updated successfully!');
      }
    } catch (error) {
      console.error('Error updating ticket status:', error);
      setError('Failed to update ticket status');
    }
  };

  const handleAssignTicket = async () => {
    if (!selectedTicket || !selectedEmployee) return;

    setAssigning(true);
    setError('');
    setSuccess('');

    try {
      // FIX: Added URL and credentials
      const response = await fetch(`${API_BASE_URL}/api/tickets/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: selectedTicket.id,
          employee_id: selectedEmployee
        }),
        credentials: 'include'
      });

      if (response.ok) {
        setShowAssignModal(false);
        setSelectedTicket(null);
        setSelectedEmployee('');
        setSuccess('Ticket assigned successfully!');
        fetchTickets(); // Refresh tickets
        fetchEmployees(); // Refresh employee data
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to assign ticket');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;

    setAssigning(true);
    try {
      // FIX: Added URL and credentials
      const response = await fetch(`${API_BASE_URL}/api/tickets/${selectedTicket.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reply: replyText
          // admin_name handled by backend session
        }),
        credentials: 'include'
      });

      if (response.ok) {
        setShowReplyModal(false);
        setReplyText('');
        fetchTickets();
        setSuccess('Reply added successfully!');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add reply');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  // ... (Helper functions for Colors and Icons remain the same) ...
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

  const filteredTickets = tickets.filter(ticket => {
    if (filter !== 'all' && ticket.status !== filter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        ticket.subject.toLowerCase().includes(searchLower) ||
        ticket.description.toLowerCase().includes(searchLower) ||
        (ticket.user_name && ticket.user_name.toLowerCase().includes(searchLower)) ||
        (ticket.user_email && ticket.user_email.toLowerCase().includes(searchLower)) ||
        ticket.ticket_number.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tickets-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="mb-1">Support Tickets</h1>
          <p className="text-muted mb-0">
            {isAdmin ? 'Manage all support tickets' : 'View your assigned tickets'}
          </p>
        </div>
        <div>
          {isAdmin && (
            <Button as={Link} to="/assign" variant="warning" className="me-2">
              Assign Tickets
            </Button>
          )}
          <Button variant="primary" onClick={fetchTickets}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')} className="mb-3">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')} className="mb-3">
          {success}
        </Alert>
      )}

      {/* Filters */}
      <div className="row mb-4">
        <div className="col-md-6">
          <InputGroup>
            <Form.Control
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="outline-secondary">
              Search
            </Button>
          </InputGroup>
        </div>
        <div className="col-md-6">
          <div className="d-flex flex-wrap gap-2">
            {['all', 'open', 'in_progress', 'resolved', 'closed'].map(status => (
                <Button
                    key={status}
                    variant={filter === status ? 'primary' : 'outline-primary'}
                    onClick={() => setFilter(status)}
                    className="text-capitalize"
                >
                    {status.replace('_', ' ')}
                </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="table-responsive">
        <Table hover responsive>
          <thead>
            <tr>
              <th>Ticket #</th>
              <th>Subject</th>
              {isAdmin && <th>Customer</th>}
              <th>Urgency</th>
              <th>Status</th>
              {isAdmin && <th>Assigned To</th>}
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map(ticket => (
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
                      <div className="fw-bold">{ticket.user_name || 'Unknown'}</div>
                      <small className="text-muted">{ticket.user_email}</small>
                    </div>
                  </td>
                )}
                <td>
                  <Badge bg={getUrgencyColor(ticket.urgency)}>
                    {getUrgencyIcon(ticket.urgency)} {ticket.urgency.toUpperCase()}
                  </Badge>
                </td>
                <td>
                  <Badge bg={getStatusColor(ticket.status)}>
                    {ticket.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </td>
                {isAdmin && (
                  <td>
                    {ticket.assigned_employee_name ? (
                      <Badge bg="info">{ticket.assigned_employee_name}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline-warning"
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setShowAssignModal(true);
                        }}
                      >
                        Assign
                      </Button>
                    )}
                  </td>
                )}
                <td>
                  {new Date(ticket.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      as={Link}
                      to={`/tickets/${ticket.id}`}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-success"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setShowReplyModal(true);
                      }}
                    >
                      Reply
                    </Button>
                    <Form.Select
                      size="sm"
                      style={{ width: '120px' }}
                      value={ticket.status}
                      onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </Form.Select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Empty State */}
      {filteredTickets.length === 0 && (
        <div className="text-center py-5">
          <div className="text-muted">
             <p>No tickets match the current filter.</p>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      <Modal show={showReplyModal} onHide={() => setShowReplyModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Reply to Ticket</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTicket && (
            <>
              <p className="mb-2">
                <strong>Ticket:</strong> #{selectedTicket.ticket_number}
              </p>
              <Form.Group>
                <Form.Label>Your Reply</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply here..."
                  disabled={assigning}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReplyModal(false)} disabled={assigning}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleReply}
            disabled={!replyText.trim() || assigning}
          >
            {assigning ? <Spinner size="sm" animation="border"/> : 'Send Reply'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Assign Ticket Modal */}
      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Assign Ticket</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTicket && (
            <Form.Group>
                <Form.Label>Select Employee</Form.Label>
                <Form.Select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  disabled={assigning}
                >
                  <option value="">Choose employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.email}) - {emp.active_tickets} active
                    </option>
                  ))}
                </Form.Select>
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)} disabled={assigning}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAssignTicket}
            disabled={!selectedEmployee || assigning}
          >
            {assigning ? <Spinner size="sm" animation="border"/> : 'Assign Ticket'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Tickets;