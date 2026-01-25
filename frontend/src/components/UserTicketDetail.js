import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/apiConfig';
import { formatToAccountTime } from '../utils/dateUtils';

const UserTicketDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // FIX: Ensure this is empty to use the current domain
  // const API_BASE_URL = 'https://api.tutomart.com';
const API_BASE_URL = 'http://api.localhost:3001';
  useEffect(() => {
    const fetchTicketDetails = async () => {
      try {
        const response = await api.get(`/support/ticket/${id}`);
        setTicket(response.data);
      } catch (err) {
        setError('Failed to load ticket details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTicketDetails();
  }, [id]);

  // --- NEW HELPER FUNCTION ---
  // This ensures both old tickets (saved as /static/) and new ones (saved as /api/) 
  // both route through the API so Nginx doesn't block them.
  const getDownloadLink = (path) => {
    if (!path) return '#';
    // Replace /static/ with /api/uploads/ if it exists in the string
    return path.replace('/static/uploads/tickets/', '/api/uploads/tickets/');
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
  
  if (error) return (
    <div className="container mt-5">
      <div className="alert alert-danger">
        {error} 
        <button className="btn btn-link ms-2" onClick={() => navigate('/support')}>Go Back</button>
      </div>
    </div>
  );

  if (!ticket) return null;

  return (
    <div className="container mt-4">
      <button className="btn btn-outline-secondary mb-3" onClick={() => navigate('/support')}>
        <i className="bi bi-arrow-left me-2"></i>Back to My Tickets
      </button>

      <div className="card shadow-sm">
        <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
          <div>
            <h4 className="mb-1">{ticket.subject}</h4>
            <span className="text-muted small me-3">ID: {ticket.ticket_number}</span>
            <span className="text-muted small">
              Created: {formatToAccountTime(ticket.created_at, user?.timezone)}
            </span>
          </div>
          <div>
            <span className={`badge me-2 ${ticket.status === 'open' ? 'bg-success' : 'bg-secondary'}`}>
              {ticket.status.toUpperCase()}
            </span>
            <span className={`badge ${ticket.urgency === 'critical' ? 'bg-danger' : 'bg-primary'}`}>
              {ticket.urgency.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="card-body">
          <h6 className="text-muted text-uppercase small fw-bold mb-2">Description</h6>
          <div className="p-3 bg-light rounded mb-4" style={{ whiteSpace: 'pre-wrap' }}>
            {ticket.description}
          </div>

          {ticket.attachment_paths && ticket.attachment_paths.length > 0 && (
            <div className="mt-4">
              <h6 className="text-muted text-uppercase small fw-bold mb-2">
                <i className="bi bi-paperclip me-1"></i> Attachments
              </h6>
              <div className="list-group">
                {ticket.attachment_paths.map((file, index) => (
                  <a 
                    key={index}
                    // --- USE THE HELPER FUNCTION HERE ---
                    href={`${API_BASE_URL}${getDownloadLink(file.path)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="list-group-item list-group-item-action d-flex align-items-center"
                  >
                    <div className="me-3 fs-4 text-primary">
                      <i className="bi bi-file-earmark-text"></i>
                    </div>
                    <div>
                      <div className="fw-bold text-decoration-underline">{file.original_name}</div>
                      <small className="text-muted">Click to view/download</small>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserTicketDetail;
