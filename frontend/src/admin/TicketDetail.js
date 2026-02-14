import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Badge, Button, Form, Alert, ListGroup, Spinner } from 'react-bootstrap';
// 1. IMPORT UTILITY
import { formatToAccountTime } from '../utils/dateUtils';
import { API_BASE_URL } from '../utils/config';

// 2. ACCEPT USER PROP
const TicketDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [updating, setUpdating] = useState(false);

useEffect(() => {
    fetchTicket();
  }, [id]);

  const fetchTicket = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/${id}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setTicket(data);
      } else {
        setError('Ticket not found or unauthorized');
      }
    } catch (error) {
      setError('Failed to fetch ticket details');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include'
      });

      if (response.ok) {
        fetchTicket(); 
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;

    setUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText }),
        credentials: 'include'
      });

      if (response.ok) {
        setReplyText('');
        fetchTicket(); 
        alert('Reply sent successfully!');
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply');
    } finally {
      setUpdating(false);
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'secondary';
      default: return 'light';
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

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-5">
        <Alert variant="danger">
          <h4 className="alert-heading">Error</h4>
          <p>{error}</p>
          <Button variant="outline-danger" onClick={() => navigate('/tickets')}>
            Back to Tickets
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Button variant="outline-secondary" onClick={() => navigate('/tickets')} className="me-2">
            ← Back to Tickets
          </Button>
          <h1 className="d-inline-block mb-0 ms-2">Ticket Details</h1>
        </div>
        <div>
          <Form.Select 
            value={ticket?.status || 'open'} 
            onChange={(e) => updateStatus(e.target.value)}
            disabled={updating}
            style={{ width: 'auto' }}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </Form.Select>
        </div>
      </div>

      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-0">{ticket?.subject}</h5>
            <small className="text-muted">Ticket ID: {ticket?.ticket_number}</small>
          </div>
          <div>
            <Badge bg={getUrgencyColor(ticket?.urgency)} className="me-2">
              {ticket?.urgency?.toUpperCase()}
            </Badge>
            <Badge bg={getStatusColor(ticket?.status)}>
              {ticket?.status?.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="row mb-4">
            <div className="col-md-6">
              <h6>User Information</h6>
              <ListGroup>
                <ListGroup.Item>
                  <strong>Name:</strong> {ticket?.user?.name}
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>Email:</strong> {ticket?.user?.email}
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>User ID:</strong> {ticket?.user?.id ? `${ticket.user.id}` : 'N/A'}
                </ListGroup.Item>
              </ListGroup>
            </div>
            <div className="col-md-6">
              <h6>Ticket Information</h6>
              <ListGroup>
                <ListGroup.Item>
                  {/* 3. USE UTILITY FOR CREATED DATE */}
                  <strong>Created:</strong> {formatToAccountTime(ticket?.created_at, user?.timezone)}
                </ListGroup.Item>
                <ListGroup.Item>
                  {/* 3. USE UTILITY FOR UPDATED DATE */}
                  <strong>Last Updated:</strong> {ticket?.updated_at ? formatToAccountTime(ticket.updated_at, user?.timezone) : 'N/A'}
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>Attachments:</strong> {ticket?.attachment_paths?.length || 0} files
                </ListGroup.Item>
              </ListGroup>
            </div>
          </div>

          <h6>Description</h6>
          <Card className="mb-4">
            <Card.Body>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {ticket?.description}
              </div>
            </Card.Body>
          </Card>

          {/* ... Reply Section (No changes needed) ... */}
          <h6>Add Reply</h6>
          <Card>
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply here..."
                  disabled={updating}
                />
              </Form.Group>
              <Button 
                variant="primary" 
                onClick={sendReply}
                disabled={updating || !replyText.trim()}
              >
                {updating ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Sending...
                  </>
                ) : (
                  'Send Reply'
                )}
              </Button>
            </Card.Body>
          </Card>

          {ticket?.attachment_paths?.length > 0 && (
            <>
              <h6 className="mt-4">Attachments</h6>
              <ListGroup>
                {ticket.attachment_paths.map((attachment, index) => (
                  <ListGroup.Item key={index}>
                    <a 
                      href={`${API_BASE_URL}${attachment.path}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-decoration-none"
                    >
                      📎 {attachment.original_name}
                    </a>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </>
          )}
        </Card.Body>
        <Card.Footer className="text-muted">
          <small>
            {/* 3. USE UTILITY FOR FOOTER DATE */}
            Ticket created on {formatToAccountTime(ticket?.created_at, user?.timezone)}
          </small>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default TicketDetail;