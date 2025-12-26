import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/apiConfig';
import { formatToAccountTime } from '../utils/dateUtils'; // Ensure this utility exists
import '../styles/SupportTickets.css';

const SupportTickets = ({ user }) => { // Accept user prop for timezone
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Initialize with 'attachments' as an empty array
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    urgency: 'medium',
    attachments: [] 
  });

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
    setFormData({ ...formData, [name]: value });
  };

  // FIX 1: Allow appending multiple files
  const handleFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFormData(prev => ({
        ...prev,
        // Spread existing attachments AND new files
        attachments: [...prev.attachments, ...newFiles]
      }));
    }
  };

  // FIX 1: Allow removing a file from selection
  const removeFile = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const ticketData = new FormData();
      ticketData.append('subject', formData.subject);
      ticketData.append('description', formData.description);
      ticketData.append('urgency', formData.urgency);
      
      // Append each file from the array
      formData.attachments.forEach(file => {
        ticketData.append('attachments', file);
      });

      const response = await api.post('/support/create-ticket', ticketData, {
        headers: { 'Content-Type': 'multipart/form-data' }
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

  // Helper functions
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

  return (
    <div className="support-tickets-container container mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <button 
          className="btn btn-outline-secondary" 
          onClick={() => navigate('/dashboard')}
        >
          <i className="bi bi-arrow-left me-2"></i>Back to Dashboard
        </button>
        
        {!showNewTicketForm && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowNewTicketForm(true)}
          >
            <i className="bi bi-plus-circle me-2"></i>Create New Ticket
          </button>
        )}
      </div>

      {/* New Ticket Form */}
      {showNewTicketForm && (
        <div className="card mb-4 shadow-sm">
          <div className="card-header bg-white">
            <h5 className="mb-0 text-primary">Create New Support Ticket</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-8 mb-3">
                  <label className="fw-bold mb-1">Subject <span className="text-danger">*</span></label>
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

                <div className="col-md-4 mb-3">
                  <label className="fw-bold mb-1">Urgency <span className="text-danger">*</span></label>
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
              </div>

              <div className="mb-3">
                <label className="fw-bold mb-1">Description <span className="text-danger">*</span></label>
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

              {/* Attachments Section */}
              <div className="mb-4">
                <div className="p-3 bg-light border rounded">
                  <label className="fw-bold mb-2">
                    <i className="bi bi-paperclip me-1"></i> Attachments (Optional)
                  </label>
                  
                  {/* File Input */}
                  <input
                    type="file"
                    className="form-control"
                    multiple
                    onChange={handleFileChange}
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt"
                  />
                  <div className="form-text mt-1 text-muted">
                    <small>Max size: 10MB each. Supported: Images, PDF, Docs.</small>
                  </div>

                  {/* Selected Files List with Remove Option */}
                  {formData.attachments.length > 0 && (
                    <div className="mt-3">
                      <h6 className="small text-muted mb-2">Selected files ({formData.attachments.length}):</h6>
                      <ul className="list-group">
                        {formData.attachments.map((file, index) => (
                          <li key={index} className="list-group-item d-flex justify-content-between align-items-center py-2">
                            <div>
                              <span className="me-2">📄</span>
                              <span>{file.name}</span>
                              <span className="text-muted small ms-2">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                            </div>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline-danger border-0"
                              onClick={() => removeFile(index)}
                              title="Remove file"
                            >
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating...</> : 'Submit Ticket'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewTicketForm(false)} disabled={loading}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket List Table */}
      <div className="card shadow-sm">
        <div className="card-header bg-white">
          <h5 className="mb-0">My Support Tickets</h5>
        </div>
        <div className="card-body p-0">
          {tickets.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Ticket ID</th>
                    <th>Subject</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Files</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => (
                    <tr key={ticket.id}>
                      {/* FIX 2: Make ID Clickable */}
                      <td>
                        <Link to={`/support/tickets/${ticket.id}`} className="text-decoration-none fw-bold font-monospace">
                          {ticket.ticket_number}
                        </Link>
                      </td>
                      {/* FIX 2: Make Subject Clickable */}
                      <td>
                        <Link to={`/support/tickets/${ticket.id}`} className="text-decoration-none text-dark fw-bold d-block">
                          {ticket.subject}
                        </Link>
                        <small className="text-muted text-truncate d-block" style={{maxWidth: '250px'}}>
                          {ticket.description}
                        </small>
                      </td>
                      <td><span className={getUrgencyBadgeClass(ticket.urgency)}>{ticket.urgency.toUpperCase()}</span></td>
                      <td><span className={getStatusBadgeClass(ticket.status)}>{ticket.status.replace('_', ' ').toUpperCase()}</span></td>
                      <td>{formatToAccountTime(ticket.created_at, user?.timezone)}</td>
                      <td>
                        {ticket.attachment_paths?.length > 0 ? (
                          <span className="badge bg-light text-dark border">
                            <i className="bi bi-paperclip"></i> {ticket.attachment_paths.length}
                          </span>
                        ) : <span className="text-muted small">-</span>}
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
              <button className="btn btn-primary" onClick={() => setShowNewTicketForm(true)}>
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

// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import api from '../utils/apiConfig';
// import '../styles/SupportTickets.css';

// const SupportTickets = ({ onBack }) => {
//   const navigate = useNavigate();
//   const [tickets, setTickets] = useState([]);
//   const [showNewTicketForm, setShowNewTicketForm] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [formData, setFormData] = useState({
//     subject: '',
//     description: '',
//     urgency: 'medium',
//     attachments: []
//   });

//   useEffect(() => {
//     fetchTickets();
//   }, []);

//   const fetchTickets = async () => {
//     try {
//       const response = await api.get('/support/tickets');
//       setTickets(response.data.tickets);
//     } catch (error) {
//       console.error('Error fetching tickets:', error);
//     }
//   };

//   // REMOVED: handleDeleteTicket function

//   const handleInputChange = (e) => {
//     const { name, value } = e.target;
//     setFormData({ ...formData, [name]: value });
//   };

//   const handleFileChange = (e) => {
//     setFormData({ ...formData, attachments: Array.from(e.target.files) });
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       const ticketData = new FormData();
//       ticketData.append('subject', formData.subject);
//       ticketData.append('description', formData.description);
//       ticketData.append('urgency', formData.urgency);
      
//       formData.attachments.forEach(file => {
//         ticketData.append('attachments', file);
//       });

//       const response = await api.post('/support/create-ticket', ticketData, {
//         headers: { 'Content-Type': 'multipart/form-data' }
//       });

//       if (response.data.success) {
//         alert('Ticket created successfully!');
//         setFormData({
//           subject: '',
//           description: '',
//           urgency: 'medium',
//           attachments: []
//         });
//         setShowNewTicketForm(false);
//         fetchTickets();
//       }
//     } catch (error) {
//       alert(error.response?.data?.error || 'Failed to create ticket');
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Helper functions for badges and dates
//   const getUrgencyBadgeClass = (urgency) => {
//     switch (urgency) {
//       case 'low': return 'badge bg-info';
//       case 'medium': return 'badge bg-primary';
//       case 'high': return 'badge bg-warning';
//       case 'critical': return 'badge bg-danger';
//       default: return 'badge bg-secondary';
//     }
//   };

//   const getStatusBadgeClass = (status) => {
//     switch (status) {
//       case 'open': return 'badge bg-success';
//       case 'in_progress': return 'badge bg-warning';
//       case 'resolved': return 'badge bg-info';
//       case 'closed': return 'badge bg-secondary';
//       default: return 'badge bg-light text-dark';
//     }
//   };

//   const formatDate = (dateString) => {
//     if (!dateString) return "—";
//     const d = new Date(dateString);
//     if (isNaN(d.getTime())) return "Invalid date";
//     return d.toLocaleString("en-US", {
//       year: "numeric", month: "short", day: "numeric",
//       hour: "2-digit", minute: "2-digit"
//     });
//   };

//   return (
//     <div className="support-tickets-container">
//       {/* Header Section */}
//       <div className="d-flex justify-content-between align-items-center mb-4">
//         <button 
//           className="btn btn-outline-secondary" 
//           onClick={() => {
//             if (onBack) onBack();
//             else navigate('/dashboard');
//           }}
//         >
//           <i className="bi bi-arrow-left me-2"></i>Back to Dashboard
//         </button>
        
//         {/* Hide this button if the form is already open */}
//         {!showNewTicketForm && (
//           <button 
//             className="btn btn-primary"
//             onClick={() => setShowNewTicketForm(true)}
//           >
//             <i className="bi bi-plus-circle me-2"></i>Create New Ticket
//           </button>
//         )}
//       </div>

//       {/* New Ticket Form */}
//       {showNewTicketForm && (
//         <div className="card mb-4 shadow-sm">
//           <div className="card-header bg-white">
//             <h5 className="mb-0 text-primary">Create New Support Ticket</h5>
//           </div>
//           <div className="card-body">
//             <form onSubmit={handleSubmit}>
//               <div className="row">
//                 {/* Subject Field */}
//                 <div className="col-md-8 mb-3">
//                   <label className="fw-bold mb-1">Subject <span className="text-danger">*</span></label>
//                   <input
//                     type="text"
//                     className="form-control"
//                     name="subject"
//                     value={formData.subject}
//                     onChange={handleInputChange}
//                     required
//                     placeholder="Brief description of your issue"
//                   />
//                 </div>

//                 {/* Urgency Field */}
//                 <div className="col-md-4 mb-3">
//                   <label className="fw-bold mb-1">Urgency <span className="text-danger">*</span></label>
//                   <select
//                     className="form-select"
//                     name="urgency"
//                     value={formData.urgency}
//                     onChange={handleInputChange}
//                     required
//                   >
//                     <option value="low">Low</option>
//                     <option value="medium">Medium</option>
//                     <option value="high">High</option>
//                     <option value="critical">Critical</option>
//                   </select>
//                 </div>
//               </div>

//               {/* Description Field */}
//               <div className="mb-3">
//                 <label className="fw-bold mb-1">Description <span className="text-danger">*</span></label>
//                 <textarea
//                   className="form-control"
//                   name="description"
//                   rows="6"
//                   value={formData.description}
//                   onChange={handleInputChange}
//                   required
//                   placeholder="Please provide detailed information about your issue..."
//                 />
//               </div>

//               {/* Attachments Field - Cleaned UI */}
//               <div className="mb-4">
//                 <div className="p-3 bg-light border rounded">
//                   <label className="fw-bold mb-2">
//                     <i className="bi bi-paperclip me-1"></i> Attachments (Optional)
//                   </label>
//                   <input
//                     type="file"
//                     className="form-control"
//                     multiple
//                     onChange={handleFileChange}
//                     accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt"
//                   />
//                   <div className="form-text mt-1 text-muted">
//                     <small>Max size: 10MB each. Formats: JPG, PNG, PDF, DOC, TXT</small>
//                   </div>

//                   {/* File Preview List */}
//                   {formData.attachments.length > 0 && (
//                     <div className="mt-2">
//                       <h6 className="small text-muted mb-2">Selected files:</h6>
//                       <ul className="list-group list-group-flush small">
//                         {formData.attachments.map((file, index) => (
//                           <li key={index} className="list-group-item bg-transparent d-flex justify-content-between align-items-center px-0 py-1">
//                             <span>{file.name}</span>
//                             <span className="badge bg-secondary rounded-pill">
//                               {(file.size / 1024 / 1024).toFixed(2)} MB
//                             </span>
//                           </li>
//                         ))}
//                       </ul>
//                     </div>
//                   )}
//                 </div>
//               </div>

//               {/* Form Buttons */}
//               <div className="d-flex gap-2">
//                 <button 
//                   type="submit" 
//                   className="btn btn-success"
//                   disabled={loading}
//                 >
//                   {loading ? (
//                     <>
//                       <span className="spinner-border spinner-border-sm me-2"></span>
//                       Creating...
//                     </>
//                   ) : (
//                     'Submit Ticket'
//                   )}
//                 </button>
//                 <button 
//                   type="button" 
//                   className="btn btn-secondary"
//                   onClick={() => setShowNewTicketForm(false)}
//                   disabled={loading}
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* Ticket List Table */}
//       <div className="card shadow-sm">
//         <div className="card-header bg-white">
//           <h5 className="mb-0">My Support Tickets</h5>
//         </div>
//         <div className="card-body p-0">
//           {tickets.length > 0 ? (
//             <div className="table-responsive">
//               <table className="table table-hover mb-0 align-middle">
//                 <thead className="table-light">
//                   <tr>
//                     <th>Ticket ID</th>
//                     <th>Subject</th>
//                     <th>Urgency</th>
//                     <th>Status</th>
//                     <th>Date</th>
//                     <th>Files</th>
//                     {/* REMOVED: Action Column Header */}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {tickets.map(ticket => (
//                     <tr key={ticket.id}>
//                       <td><code className="text-dark">{ticket.ticket_number}</code></td>
//                       <td>
//                         <span className="fw-bold d-block">{ticket.subject}</span>
//                         <small className="text-muted text-truncate d-block" style={{maxWidth: '200px'}}>
//                           {ticket.description}
//                         </small>
//                       </td>
//                       <td><span className={getUrgencyBadgeClass(ticket.urgency)}>{ticket.urgency.toUpperCase()}</span></td>
//                       <td><span className={getStatusBadgeClass(ticket.status)}>{ticket.status.replace('_', ' ').toUpperCase()}</span></td>
//                       <td>{formatDate(ticket.created_at)}</td>
//                       <td>
//                         {ticket.attachment_paths?.length > 0 ? (
//                           <span className="badge bg-light text-dark border">
//                             <i className="bi bi-paperclip"></i> {ticket.attachment_paths.length}
//                           </span>
//                         ) : <span className="text-muted small">-</span>}
//                       </td>
//                       {/* REMOVED: Action Column Button */}
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ) : (
//             <div className="text-center py-5">
//               <i className="bi bi-ticket-perforated display-1 text-muted"></i>
//               <h4 className="mt-3">No Support Tickets</h4>
//               <p className="text-muted">You haven't created any support tickets yet.</p>
//               <button className="btn btn-primary" onClick={() => setShowNewTicketForm(true)}>
//                 Create Your First Ticket
//               </button>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default SupportTickets;

// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import api from '../utils/apiConfig';
// import '../styles/SupportTickets.css';

// const SupportTickets = ({ onBack }) => {
//   const navigate = useNavigate();
//   const [tickets, setTickets] = useState([]);
//   const [showNewTicketForm, setShowNewTicketForm] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [formData, setFormData] = useState({
//     subject: '',
//     description: '',
//     urgency: 'medium',
//     attachments: []
//   });

//   useEffect(() => {
//     fetchTickets();
//   }, []);

//   const fetchTickets = async () => {
//     try {
//       const response = await api.get('/support/tickets');
//       setTickets(response.data.tickets);
//     } catch (error) {
//       console.error('Error fetching tickets:', error);
//     }
//   };

//   const handleDeleteTicket = async (ticketId) => {
//     if (window.confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
//       try {
//         await api.delete(`/support/tickets/${ticketId}`);
//         setTickets(prevTickets => prevTickets.filter(t => t.id !== ticketId));
//       } catch (error) {
//         console.error('Error deleting ticket:', error);
//         alert(error.response?.data?.error || 'Failed to delete ticket');
//       }
//     }
//   };

//   const handleInputChange = (e) => {
//     const { name, value } = e.target;
//     setFormData({ ...formData, [name]: value });
//   };

//   const handleFileChange = (e) => {
//     setFormData({ ...formData, attachments: Array.from(e.target.files) });
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       const ticketData = new FormData();
//       ticketData.append('subject', formData.subject);
//       ticketData.append('description', formData.description);
//       ticketData.append('urgency', formData.urgency);
      
//       formData.attachments.forEach(file => {
//         ticketData.append('attachments', file);
//       });

//       const response = await api.post('/support/create-ticket', ticketData, {
//         headers: { 'Content-Type': 'multipart/form-data' }
//       });

//       if (response.data.success) {
//         alert('Ticket created successfully!');
//         setFormData({
//           subject: '',
//           description: '',
//           urgency: 'medium',
//           attachments: []
//         });
//         setShowNewTicketForm(false);
//         fetchTickets();
//       }
//     } catch (error) {
//       alert(error.response?.data?.error || 'Failed to create ticket');
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Helper functions for badges and dates
//   const getUrgencyBadgeClass = (urgency) => {
//     switch (urgency) {
//       case 'low': return 'badge bg-info';
//       case 'medium': return 'badge bg-primary';
//       case 'high': return 'badge bg-warning';
//       case 'critical': return 'badge bg-danger';
//       default: return 'badge bg-secondary';
//     }
//   };

//   const getStatusBadgeClass = (status) => {
//     switch (status) {
//       case 'open': return 'badge bg-success';
//       case 'in_progress': return 'badge bg-warning';
//       case 'resolved': return 'badge bg-info';
//       case 'closed': return 'badge bg-secondary';
//       default: return 'badge bg-light text-dark';
//     }
//   };

//   const formatDate = (dateString) => {
//     if (!dateString) return "—";
//     const d = new Date(dateString);
//     if (isNaN(d.getTime())) return "Invalid date";
//     return d.toLocaleString("en-US", {
//       year: "numeric", month: "short", day: "numeric",
//       hour: "2-digit", minute: "2-digit"
//     });
//   };

//   return (
//     <div className="support-tickets-container">
//       {/* Header Section */}
//       <div className="d-flex justify-content-between align-items-center mb-4">
//         <button 
//           className="btn btn-outline-secondary" 
//           onClick={() => {
//             if (onBack) onBack();
//             else navigate('/dashboard');
//           }}
//         >
//           <i className="bi bi-arrow-left me-2"></i>Back to Dashboard
//         </button>
        
//         {/* Hide this button if the form is already open */}
//         {!showNewTicketForm && (
//           <button 
//             className="btn btn-primary"
//             onClick={() => setShowNewTicketForm(true)}
//           >
//             <i className="bi bi-plus-circle me-2"></i>Create New Ticket
//           </button>
//         )}
//       </div>

//       {/* New Ticket Form */}
//       {showNewTicketForm && (
//         <div className="card mb-4 shadow-sm">
//           <div className="card-header bg-white">
//             <h5 className="mb-0 text-primary">Create New Support Ticket</h5>
//           </div>
//           <div className="card-body">
//             <form onSubmit={handleSubmit}>
//               <div className="row">
//                 {/* Subject Field */}
//                 <div className="col-md-8 mb-3">
//                   <label className="fw-bold mb-1">Subject <span className="text-danger">*</span></label>
//                   <input
//                     type="text"
//                     className="form-control"
//                     name="subject"
//                     value={formData.subject}
//                     onChange={handleInputChange}
//                     required
//                     placeholder="Brief description of your issue"
//                   />
//                 </div>

//                 {/* Urgency Field */}
//                 <div className="col-md-4 mb-3">
//                   <label className="fw-bold mb-1">Urgency <span className="text-danger">*</span></label>
//                   <select
//                     className="form-select"
//                     name="urgency"
//                     value={formData.urgency}
//                     onChange={handleInputChange}
//                     required
//                   >
//                     <option value="low">Low</option>
//                     <option value="medium">Medium</option>
//                     <option value="high">High</option>
//                     <option value="critical">Critical</option>
//                   </select>
//                 </div>
//               </div>

//               {/* Description Field */}
//               <div className="mb-3">
//                 <label className="fw-bold mb-1">Description <span className="text-danger">*</span></label>
//                 <textarea
//                   className="form-control"
//                   name="description"
//                   rows="6"
//                   value={formData.description}
//                   onChange={handleInputChange}
//                   required
//                   placeholder="Please provide detailed information about your issue..."
//                 />
//               </div>

//               {/* Attachments Field - Cleaned UI */}
//               <div className="mb-4">
//                 <div className="p-3 bg-light border rounded">
//                   <label className="fw-bold mb-2">
//                     <i className="bi bi-paperclip me-1"></i> Attachments (Optional)
//                   </label>
//                   <input
//                     type="file"
//                     className="form-control"
//                     multiple
//                     onChange={handleFileChange}
//                     accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt"
//                   />
//                   <div className="form-text mt-1 text-muted">
//                     <small>Max size: 10MB each. Formats: JPG, PNG, PDF, DOC, TXT</small>
//                   </div>

//                   {/* File Preview List */}
//                   {formData.attachments.length > 0 && (
//                     <div className="mt-2">
//                       <h6 className="small text-muted mb-2">Selected files:</h6>
//                       <ul className="list-group list-group-flush small">
//                         {formData.attachments.map((file, index) => (
//                           <li key={index} className="list-group-item bg-transparent d-flex justify-content-between align-items-center px-0 py-1">
//                             <span>{file.name}</span>
//                             <span className="badge bg-secondary rounded-pill">
//                               {(file.size / 1024 / 1024).toFixed(2)} MB
//                             </span>
//                           </li>
//                         ))}
//                       </ul>
//                     </div>
//                   )}
//                 </div>
//               </div>

//               {/* Form Buttons */}
//               <div className="d-flex gap-2">
//                 <button 
//                   type="submit" 
//                   className="btn btn-success"
//                   disabled={loading}
//                 >
//                   {loading ? (
//                     <>
//                       <span className="spinner-border spinner-border-sm me-2"></span>
//                       Creating...
//                     </>
//                   ) : (
//                     'Submit Ticket'
//                   )}
//                 </button>
//                 <button 
//                   type="button" 
//                   className="btn btn-secondary"
//                   onClick={() => setShowNewTicketForm(false)}
//                   disabled={loading}
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* Ticket List Table */}
//       <div className="card shadow-sm">
//         <div className="card-header bg-white">
//           <h5 className="mb-0">My Support Tickets</h5>
//         </div>
//         <div className="card-body p-0">
//           {tickets.length > 0 ? (
//             <div className="table-responsive">
//               <table className="table table-hover mb-0 align-middle">
//                 <thead className="table-light">
//                   <tr>
//                     <th>Ticket ID</th>
//                     <th>Subject</th>
//                     <th>Urgency</th>
//                     <th>Status</th>
//                     <th>Date</th>
//                     <th>Files</th>
//                     <th>Action</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {tickets.map(ticket => (
//                     <tr key={ticket.id}>
//                       <td><code className="text-dark">{ticket.ticket_number}</code></td>
//                       <td>
//                         <span className="fw-bold d-block">{ticket.subject}</span>
//                         <small className="text-muted text-truncate d-block" style={{maxWidth: '200px'}}>
//                           {ticket.description}
//                         </small>
//                       </td>
//                       <td><span className={getUrgencyBadgeClass(ticket.urgency)}>{ticket.urgency.toUpperCase()}</span></td>
//                       <td><span className={getStatusBadgeClass(ticket.status)}>{ticket.status.replace('_', ' ').toUpperCase()}</span></td>
//                       <td>{formatDate(ticket.created_at)}</td>
//                       <td>
//                         {ticket.attachment_paths?.length > 0 ? (
//                           <span className="badge bg-light text-dark border">
//                             <i className="bi bi-paperclip"></i> {ticket.attachment_paths.length}
//                           </span>
//                         ) : <span className="text-muted small">-</span>}
//                       </td>
//                       <td>
//                         <button 
//                           className="btn btn-sm btn-outline-danger border-0"
//                           onClick={() => handleDeleteTicket(ticket.id)}
//                           title="Delete Ticket"
//                         >
//                           <i className="bi bi-trash"></i>
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ) : (
//             <div className="text-center py-5">
//               <i className="bi bi-ticket-perforated display-1 text-muted"></i>
//               <h4 className="mt-3">No Support Tickets</h4>
//               <p className="text-muted">You haven't created any support tickets yet.</p>
//               <button className="btn btn-primary" onClick={() => setShowNewTicketForm(true)}>
//                 Create Your First Ticket
//               </button>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default SupportTickets;
