import React, { useState, useEffect } from 'react';
import { Table, Badge, Card, Spinner, Alert } from 'react-bootstrap';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Define Base URL
  const API_BASE_URL = 'http://localhost:8080';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // FIX: Changed endpoint to /api/admin/users and added credentials
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        setError('Failed to fetch users or unauthorized');
      }
    } catch (error) {
      setError('Network error. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <button className="btn btn-outline-danger" onClick={fetchUsers}>
            Retry
          </button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Registered Users</h1>
        <button className="btn btn-outline-primary" onClick={fetchUsers}>
          Refresh
        </button>
      </div>

      <Card>
        <Card.Header>
          <h5 className="mb-0">
            Total Users: <Badge bg="primary">{users.length}</Badge>
          </h5>
        </Card.Header>
        <Card.Body>
          <Table hover responsive>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Join Date</th>
                <th>Total Tickets</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <code>{user.id ? user.id.substring(0, 8) : 'N/A'}...</code>
                  </td>
                  <td>
                    <strong>{user.name}</strong>
                  </td>
                  <td>{user.email}</td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>
                    <Badge bg={user.ticket_count > 0 ? 'info' : 'secondary'}>
                      {user.ticket_count} ticket{user.ticket_count !== 1 ? 's' : ''}
                    </Badge>
                  </td>
                  <td>
                    <Badge bg={user.is_active ? 'success' : 'danger'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                    <td colSpan="6" className="text-center text-muted">No registered users found.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Users;