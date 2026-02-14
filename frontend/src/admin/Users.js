import React, { useState, useEffect } from 'react';
import { Table, Badge, Card, Spinner, Alert } from 'react-bootstrap';
// 1. IMPORT UTILITY
import { formatToAccountTime } from '../utils/dateUtils';
import { API_BASE_URL } from '../utils/config';
// 2. ACCEPT USER PROP
const Users = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

 useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
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
                {/* 3. SHOW TZ IN HEADER */}
                <th>Join Date ({user?.timezone || 'UTC'})</th>
                <th>Total Tickets</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <code>{u.id ? u.id.substring(0, 8) : 'N/A'}...</code>
                  </td>
                  <td>
                    <strong>{u.name}</strong>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    {/* 4. USE UTILITY FOR DATE */}
                    {formatToAccountTime(u.created_at, user?.timezone)}
                  </td>
                  <td>
                    <Badge bg={u.ticket_count > 0 ? 'info' : 'secondary'}>
                      {u.ticket_count} ticket{u.ticket_count !== 1 ? 's' : ''}
                    </Badge>
                  </td>
                  <td>
                    <Badge bg={u.is_active ? 'success' : 'danger'}>
                      {u.is_active ? 'Active' : 'Inactive'}
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
