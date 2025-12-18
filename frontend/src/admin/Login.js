import React, { useState } from 'react';
import api from '../utils/apiConfig'; // Import your configured axios instance

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // --- FIX: CLEAR OLD DATA ---
    localStorage.removeItem('admin_user');
    // ---------------------------

    try {
      const response = await api.post('/admin/login', { 
        email, 
        password 
      });

      if (response.data.user) {
        console.log('Admin Login successful:', response.data);
        localStorage.setItem('admin_user', JSON.stringify(response.data.user));
        window.location.href = '/admin/dashboard';
      }
    } catch (err) {
      console.error('Login error:', err);
      const msg = err.response?.data?.error || 'Login failed. Check credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="row justify-content-center mt-5">
        <div className="col-md-6 col-lg-4">
          <div className="card shadow">
            <div className="card-header bg-primary text-white text-center">
              <h4 className="mb-0">Admin Dashboard Login</h4>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin@tutomart.com"
                  />
                </div>
                <div className="mb-3">
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                </div>
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}
                <div className="d-grid">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
