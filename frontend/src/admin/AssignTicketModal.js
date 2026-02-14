import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { API_BASE_URL } from '../utils/config';
const AssignTicketModal = ({ show, onHide, ticketId, ticketNumber, onAssign }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      // Reset state when modal opens
      setError('');
      setSelectedEmployee('');
      fetchEmployees();
    }
  }, [show]);

  const fetchEmployees = async () => {
    try {
      // FIX: Added URL and credentials
      const response = await fetch(`${API_BASE_URL}/api/admin/employees`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees ? data.employees.filter(emp => emp.is_active) : []);
      } else {
        console.error('Failed to fetch employees');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedEmployee) return;

    setLoading(true);
    setError('');

    try {
      // FIX: Added URL and credentials
      const response = await fetch(`${API_BASE_URL}/api/tickets/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          employee_id: selectedEmployee
        }),
        credentials: 'include' // Important for cookies
      });

      if (response.ok) {
        onAssign(); // Refresh parent list
        onHide();   // Close modal
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to assign ticket');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Assign Ticket</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Assign ticket <strong>#{ticketNumber}</strong> to:</p>
        
        {error && <Alert variant="danger">{error}</Alert>}
        
        <Form.Group>
          <Form.Label>Select Employee</Form.Label>
          <Form.Select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            disabled={loading}
          >
            <option value="">Choose employee...</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.email}) - {emp.active_tickets} active tickets
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleAssign} 
          disabled={!selectedEmployee || loading}
        >
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Assigning...
            </>
          ) : 'Assign Ticket'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AssignTicketModal;
