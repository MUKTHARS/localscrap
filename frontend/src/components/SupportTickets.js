import React, { useState, useEffect } from 'react';
import api from '../utils/apiConfig';
import '../styles/SupportTickets.css';

const SupportTickets = ({ onBack }) => {
  const [tickets, setTickets] = useState([]);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    urgency: 'medium',
    attachments: []
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await api.get('/support/tickets');
      setTickets(response.data.tickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleFileChange = (e) => {
    setFormData({
      ...formData,
      attachments: Array.from(e.target.files)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const ticketData = new FormData();
      ticketData.append('subject', formData.subject);
      ticketData.append('description', formData.description);
      ticketData.append('urgency', formData.urgency);
      
      // Append attachments
      formData.attachments.forEach(file => {
        ticketData.append('attachments', file);
      });

      const response = await api.post('/support/create-ticket', ticketData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        alert('Ticket created successfully!');
        setFormData({
          subject: '',
          description: '',
          urgency: 'medium',
          attachments: []
        });
        setShowNewTicketForm(false);
        fetchTickets();
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyBadgeClass = (urgency) => {
    switch (urgency) {
      case 'low': return 'badge bg-info';
      case 'medium': return 'badge bg-primary';
      case 'high': return 'badge bg-warning';
      case 'critical': return 'badge bg-danger';
      default: return 'badge bg-secondary';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'open': return 'badge bg-success';
      case 'in_progress': return 'badge bg-warning';
      case 'resolved': return 'badge bg-info';
      case 'closed': return 'badge bg-secondary';
      default: return 'badge bg-light text-dark';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
  
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Invalid date";
  
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="support-tickets-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <button className="btn btn-outline-secondary" onClick={onBack}>
          <i className="bi bi-arrow-left me-2"></i>Back to Profile
        </button>
        <button 
          className="btn btn-primary"
          onClick={() => setShowNewTicketForm(true)}
        >
          <i className="bi bi-plus-circle me-2"></i>Create New Ticket
        </button>
      </div>

      {showNewTicketForm ? (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Create New Support Ticket</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Subject *</label>
                <input
                  type="text"
                  className="form-control"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                  placeholder="Brief description of your issue"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Urgency *</label>
                <select
                  className="form-select"
                  name="urgency"
                  value={formData.urgency}
                  onChange={handleInputChange}
                  required
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">Description *</label>
                <textarea
                  className="form-control"
                  name="description"
                  rows="6"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  placeholder="Please provide detailed information about your issue..."
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Attachments (Optional)</label>
                <input
                  type="file"
                  className="form-control"
                  multiple
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt"
                />
                <small className="text-muted">
                  Maximum file size: 10MB each. Supported formats: JPG, PNG, PDF, DOC, TXT
                </small>
                {formData.attachments.length > 0 && (
                  <div className="mt-2">
                    <strong>Selected files:</strong>
                    <ul className="list-group mt-2">
                      {formData.attachments.map((file, index) => (
                        <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                          {file.name}
                          <span className="badge bg-secondary">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="d-flex gap-2">
                <button 
                  type="submit" 
                  className="btn btn-success"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Creating...
                    </>
                  ) : (
                    'Submit Ticket'
                  )}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowNewTicketForm(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">My Support Tickets</h5>
        </div>
        <div className="card-body">
          {tickets.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Subject</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th>Created Date</th>
                    <th>Attachments</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => (
                    <tr key={ticket.id}>
                      {/* <td>
                        <code>{ticket.id.substring(0, 8)}...</code>
                      </td> */}
                      <td>
  <code>{ticket.ticket_number}</code>
</td>
                      
                      <td>
                        <strong>{ticket.subject}</strong>
                        <p className="text-muted mb-0 small">
                          {ticket.description.substring(0, 100)}...
                        </p>
                      </td>
                      <td>
                        <span className={getUrgencyBadgeClass(ticket.urgency)}>
                          {ticket.urgency.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(ticket.status)}>
                          {ticket.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>{formatDate(ticket.created_at)}</td>
                      <td>
                        {ticket.attachment_paths && ticket.attachment_paths.length > 0 ? (
                          <span className="badge bg-info">
                            <i className="bi bi-paperclip me-1"></i>
                            {ticket.attachment_paths.length} file(s)
                          </span>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-5">
              <i className="bi bi-ticket-perforated display-1 text-muted"></i>
              <h4 className="mt-3">No Support Tickets</h4>
              <p className="text-muted">You haven't created any support tickets yet.</p>
              <button 
                className="btn btn-primary"
                onClick={() => setShowNewTicketForm(true)}
              >
                Create Your First Ticket
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportTickets;
