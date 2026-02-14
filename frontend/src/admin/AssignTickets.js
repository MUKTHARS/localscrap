import React, { useState, useEffect } from 'react';
import { Card, Table, Badge, Button, Form, Modal, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { API_BASE_URL } from '../utils/config';
const AssignTickets = () => {
  const [unassignedTickets, setUnassignedTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

 useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [ticketsRes, employeesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/tickets/unassigned`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/admin/employees`, { credentials: 'include' })
      ]);

      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json();
        setUnassignedTickets(ticketsData.tickets || []);
      }

      if (employeesRes.ok) {
        const employeesData = await employeesRes.json();
        const activeEmployees = employeesData.employees ? employeesData.employees.filter(emp => emp.is_active) : [];
        // Sort: Least busy employees first
        activeEmployees.sort((a, b) => a.active_tickets - b.active_tickets);
        setEmployees(activeEmployees);
      }
    } catch (error) {
      setError('Network error. Check backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTicket = async () => {
    if (!selectedTicket || !selectedEmployee) return;
    setAssigning(true);
    
    try {
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
        const data = await response.json();
        setSuccess(`Assigned to ${data.employee_name}!`);
        setShowAssignModal(false);
        setSelectedTicket(null);
        setSelectedEmployee('');
        // This will now update the counts correctly because Backend logic is fixed
        fetchData(); 
      }
    } catch (error) {
      setError('Failed to assign.');
    } finally {
      setAssigning(false);
    }
  };

  // ... (Bulk Assign logic remains similar, calling fetchData() at the end) ...
  const handleBulkAssign = async () => {
    if (!selectedEmployee || selectedTickets.length === 0) return;
    setAssigning(true);
    try {
        let count = 0;
        for(let id of selectedTickets) {
            const res = await fetch(`${API_BASE_URL}/api/tickets/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket_id: id, employee_id: selectedEmployee }),
                credentials: 'include'
            });
            if(res.ok) count++;
        }
        if(count > 0) {
            setSuccess(`Assigned ${count} tickets.`);
            setShowBulkModal(false);
            setSelectedTickets([]);
            fetchData();
        }
    } catch(e) { setError('Bulk assign failed'); }
    finally { setAssigning(false); }
  };

  const toggleTicketSelection = (ticketId) => {
    if (selectedTickets.includes(ticketId)) {
      setSelectedTickets(selectedTickets.filter(id => id !== ticketId));
    } else {
      setSelectedTickets([...selectedTickets, ticketId]);
    }
  };

  const selectAllTickets = () => {
    if (selectedTickets.length === unassignedTickets.length) {
      setSelectedTickets([]);
    } else {
      setSelectedTickets(unassignedTickets.map(ticket => ticket.id));
    }
  };

  const getUrgencyColor = (u) => {
      if(!u) return 'secondary';
      return u === 'critical' ? 'danger' : u === 'high' ? 'warning' : u === 'medium' ? 'primary' : 'info';
  };

  if (loading) return <div className="text-center py-5"><Spinner animation="border"/></div>;

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between mb-4">
        <h2>Assign Tickets</h2>
        <div>
            {selectedTickets.length > 0 && <Button variant="warning" onClick={() => setShowBulkModal(true)} className="me-2">Bulk Assign</Button>}
            <Button onClick={fetchData}>Refresh</Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Stats Cards */}
      <Row className="mb-4">
        <Col md={4}><Card className="text-center p-3 shadow-sm"><h3>{unassignedTickets.length}</h3>Unassigned Tickets</Card></Col>
        <Col md={4}><Card className="text-center p-3 shadow-sm"><h3>{employees.length}</h3>Active Employees</Card></Col>
        <Col md={4}><Card className="text-center p-3 shadow-sm">
            {/* Counts total active tickets across all employees */}
            <h3>{employees.reduce((acc, curr) => acc + curr.active_tickets, 0)}</h3>
            Active Tickets (Assigned)
        </Card></Col>
      </Row>

      {/* Unassigned List */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="d-flex justify-content-between">
            <span>Unassigned Queue</span>
            {unassignedTickets.length > 0 && <Button size="sm" variant="outline-dark" onClick={selectAllTickets}>Select All</Button>}
        </Card.Header>
        <Card.Body>
            {unassignedTickets.length === 0 ? <p className="text-center text-muted">No tickets to assign.</p> : (
            <Table hover>
                <thead>
                    <tr>
                        <th><Form.Check checked={selectedTickets.length === unassignedTickets.length} onChange={selectAllTickets} /></th>
                        <th>ID</th>
                        <th>Subject</th>
                        <th>Customer</th>
                        <th>Urgency</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {unassignedTickets.map(t => (
                        <tr key={t.id}>
                            <td><Form.Check checked={selectedTickets.includes(t.id)} onChange={() => toggleTicketSelection(t.id)} /></td>
                            <td>#{t.ticket_number}</td>
                            <td>
                                <div>{t.subject}</div>
                                <small className="text-muted">{(t.description || '').substring(0, 50)}...</small>
                            </td>
                            <td>{t.user_name}</td>
                            <td><Badge bg={getUrgencyColor(t.urgency)}>{t.urgency}</Badge></td>
                            <td><Button size="sm" onClick={() => { setSelectedTicket(t); setShowAssignModal(true); }}>Assign</Button></td>
                        </tr>
                    ))}
                </tbody>
            </Table>
            )}
        </Card.Body>
      </Card>

      {/* Employee List */}
      <h3>Employee Workload</h3>
      <Row>
        {employees.map(emp => (
            <Col md={4} key={emp.id} className="mb-3">
                <Card className="h-100 shadow-sm">
                    <Card.Body>
                        <div className="d-flex justify-content-between">
                            <h5>{emp.name}</h5>
                            {/* ACTIVE TICKETS BADGE */}
                            <Badge bg={emp.active_tickets === 0 ? 'success' : 'warning'}>
                                {emp.active_tickets} Active
                            </Badge>
                        </div>
                        <small className="text-muted">{emp.email}</small>
                        <hr/>
                        <div className="d-flex justify-content-between align-items-center">
                            <span className="text-muted">Total Lifetime: {emp.ticket_count}</span>
                            <Button size="sm" variant="outline-primary" onClick={() => { setSelectedEmployee(emp.id); setShowBulkModal(true); }}>
                                Assign To
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            </Col>
        ))}
      </Row>

      {/* Modals */}
      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)}>
        <Modal.Header closeButton><Modal.Title>Assign Ticket</Modal.Title></Modal.Header>
        <Modal.Body>
            <p>Assign ticket <strong>#{selectedTicket?.ticket_number}</strong> to:</p>
            <Form.Select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
                <option value="">Select Employee...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.active_tickets} active)</option>)}
            </Form.Select>
        </Modal.Body>
        <Modal.Footer>
            <Button onClick={handleAssignTicket} disabled={!selectedEmployee || assigning}>{assigning ? <Spinner size="sm"/> : "Assign"}</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)}>
        <Modal.Header closeButton><Modal.Title>Bulk Assign</Modal.Title></Modal.Header>
        <Modal.Body>
            <p>Assign <strong>{selectedTickets.length} tickets</strong> to:</p>
            <Form.Select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
                <option value="">Select Employee...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.active_tickets} active)</option>)}
            </Form.Select>
        </Modal.Body>
        <Modal.Footer>
            <Button onClick={handleBulkAssign} disabled={!selectedEmployee || assigning}>{assigning ? <Spinner size="sm"/> : "Assign All"}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AssignTickets;
