import React, { useState, useEffect } from 'react';
import { Table, Badge, Button, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import { formatToAccountTime } from '../utils/dateUtils';
import { API_BASE_URL } from '../utils/config';

const Employees = ({ user }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');


  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/employees`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      } else {
        console.error('Failed to fetch employees');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async () => {
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      if (response.ok) {
        setShowAddModal(false);
        setFormData({ name: '', email: '', password: '' });
        fetchEmployees();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add employee');
      }
    } catch (error) {
      setError('Failed to connect to server');
    }
  };

  const handleToggleStatus = async (employeeId, currentStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
        credentials: 'include'
      });

      if (response.ok) {
        fetchEmployees();
      } else {
        alert('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating employee:', error);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/employees/${selectedEmployee.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setShowDeleteModal(false);
        setSelectedEmployee(null);
        fetchEmployees();
      } else {
        alert('Failed to delete employee');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
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
  
  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Employee Management</h1>
        <Button variant="primary" onClick={() => {
            setError('');
            setShowAddModal(true);
        }}>
          + Add New Employee
        </Button>
      </div>

      <Table hover responsive>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Total Tickets</th>
            <th>Active Tickets</th>
            {/* 3. SHOW CONFIGURED TIMEZONE IN HEADER */}
            <th>Join Date ({user?.timezone || 'UTC'})</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id}>
              <td><strong>{emp.name}</strong></td>
              <td>{emp.email}</td>
              <td>
                <Badge bg={emp.is_active ? 'success' : 'danger'}>
                  {emp.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td><Badge bg="info">{emp.ticket_count || 0}</Badge></td>
              <td><Badge bg="warning">{emp.active_tickets || 0}</Badge></td>
              <td>
                {/* 4. USE UTILITY TO FORMAT DATE */}
                {formatToAccountTime(emp.created_at, user?.timezone)}
              </td>
              <td>
                <div className="d-flex gap-2">
                  <Button
                    size="sm"
                    variant={emp.is_active ? 'warning' : 'success'}
                    onClick={() => handleToggleStatus(emp.id, emp.is_active)}
                  >
                    {emp.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => {
                      setSelectedEmployee(emp);
                      setShowDeleteModal(true);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {employees.length === 0 && (
            <tr>
              <td colSpan="7" className="text-center text-muted py-4">
                No employees found. Click "Add New Employee" to create one.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {/* Add Employee Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Employee</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form>
            <Form.Group className="mb-3">
              <Form.Label></Form.Label>
              <Form.Control
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Enter employee name"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label></Form.Label>
              <Form.Control
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="employee@tutomart.com"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label></Form.Label>
              <Form.Control
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Enter password"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddEmployee}>
            Add Employee
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete employee <strong>{selectedEmployee?.name}</strong>?
          <br/>
          <small className="text-danger">This action cannot be undone.</small>
          
          {selectedEmployee?.active_tickets > 0 && (
            <Alert variant="warning" className="mt-2">
              Warning: This employee has {selectedEmployee.active_tickets} active tickets. 
              These tickets will be unassigned and returned to the queue.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteEmployee}>
            Delete Employee
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Employees;
