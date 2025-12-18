import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Login.css';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, loading: authLoading, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, location]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      let result;
      if (isLogin) {
        result = await login(formData.email, formData.password, true);
      } else {
        if (formData.password !== formData.confirmPassword) {
          setMessage('Passwords do not match');
          setLoading(false);
          return;
        }
        result = await register(formData.name, formData.email, formData.password, formData.confirmPassword);
      }

      if (result.success) {
        // Navigation will be handled by the useEffect above
        setMessage('Login successful! Redirecting...');
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = 'https://tutomart.com/api/auth/login/google';
  };  
  
  // Show loading while checking auth status
  if (authLoading) {
    return (
      <div className="premium-login-container">
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
          <div className="text-center">
            <div className="btn-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px' }}></div>
            <p>Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render login form if user is authenticated (will redirect)
  if (user) {
    return (
      <div className="premium-login-container">
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
          <div className="text-center">
            <div className="btn-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px' }}></div>
            <p>Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-login-container">
      {/* Background Animation */}
      <div className="login-background">
        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="premium-login-card">
        {/* Header Section */}
        <div className="login-card-header">
          <div className="brand-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="login-header-content">
            <h1 className="login-title">Welcome Back</h1>
            <p className="login-subtitle">
              {isLogin ? 'Sign in to continue to TutoMart' : 'Create your TutoMart account'}
            </p>
          </div>
        </div>

        {/* Alert Messages */}
        {message && (
          <div className={`premium-alert ${message.includes('error') ? 'alert-error' : 'alert-success'}`}>
            <div className="alert-icon">
              <i className={`bi ${message.includes('error') ? 'bi-exclamation-triangle' : 'bi-check-circle'}`}></i>
            </div>
            <div className="alert-content">
              <p className="alert-message">{message}</p>
            </div>
            <button 
              className="alert-close"
              onClick={() => setMessage('')}
            >
              <i className="bi bi-x"></i>
            </button>
          </div>
        )}

        {/* Social Login */}
        <div className="social-login-section">
          <button 
            className="social-login-btn google"
            onClick={handleGoogleLogin}
            disabled={loading}
            type="button"
          >
            <div className="social-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21.8055 10.0415H21V10H12V14H17.6515C16.827 16.3285 14.6115 18 12 18C8.6865 18 6 15.3135 6 12C6 8.6865 8.6865 6 12 6C13.5295 6 14.921 6.577 15.9805 7.5195L18.809 4.691C17.023 3.0265 14.634 2 12 2C6.4775 2 2 6.4775 2 12C2 17.5225 6.4775 22 12 22C17.5225 22 22 17.5225 22 12C22 11.3295 21.931 10.675 21.8055 10.0415Z" fill="#FFC107"/>
                <path d="M3.153 7.3455L6.4385 9.755C7.3275 7.554 9.4805 6 12 6C13.5295 6 14.921 6.577 15.9805 7.5195L18.809 4.691C17.023 3.0265 14.634 2 12 2C8.159 2 4.828 4.1685 3.153 7.3455Z" fill="#FF3D00"/>
                <path d="M12 22C14.583 22 16.93 21.0115 18.7045 19.404L15.6095 16.785C14.6055 17.5455 13.3575 18 12 18C9.399 18 7.1905 16.3415 6.3585 14.027L3.0975 16.5395C4.7525 19.778 8.1135 22 12 22Z" fill="#4CAF50"/>
                <path d="M21.8055 10.0415H21V10H12V14H17.6515C17.2555 15.1185 16.536 16.083 15.608 16.7855L15.6095 16.7845L18.7045 19.4035C18.4855 19.6025 22 17 22 12C22 11.3295 21.931 10.675 21.8055 10.0415Z" fill="#1976D2"/>
              </svg>
            </div>
            <span className="social-text">Continue with Google</span>
          </button>
        </div>

        {/* Divider */}
        <div className="divider-section">
          <div className="divider-line"></div>
          <span className="divider-text">or continue with email</span>
          <div className="divider-line"></div>
        </div>

        {/* Login Form */}
        <form className="premium-login-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <div className="input-wrapper">
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder=" "
                />
                <label className="form-label">Full Name</label>
                <div className="input-icon">
                  <i className="bi bi-person"></i>
                </div>
              </div>
            </div>
          )}
          
          <div className="form-group">
            <div className="input-wrapper">
              <input
                type="email"
                name="email"
                className="form-input"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder=" "
              />
              <label className="form-label">Email Address</label>
              <div className="input-icon">
                <i className="bi bi-envelope"></i>
              </div>
            </div>
          </div>
          
          <div className="form-group">
            <div className="input-wrapper">
              <input
                type="password"
                name="password"
                className="form-input"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder=" "
              />
              <label className="form-label">Password</label>
              <div className="input-icon">
                <i className="bi bi-lock"></i>
              </div>
            </div>
          </div>
          
          {!isLogin && (
            <div className="form-group">
              <div className="input-wrapper">
                <input
                  type="password"
                  name="confirmPassword"
                  className="form-input"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder=" "
                />
                <label className="form-label">Confirm Password</label>
                <div className="input-icon">
                  <i className="bi bi-shield-lock"></i>
                </div>
              </div>
            </div>
          )}

          {isLogin && (
            <div className="form-options">
              <label className="checkbox-container">
                <input type="checkbox" id="remember" />
                <span className="checkmark"></span>
                Remember me for 30 days
              </label>
              <button type="button" className="forgot-password">
                Forgot password?
              </button>
            </div>
          )}

          <button 
            type="submit" 
            className="premium-btn primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="btn-spinner"></div>
                {isLogin ? 'Signing In...' : 'Creating Account...'}
              </>
            ) : (
              <>
                <i className={`bi ${isLogin ? 'bi-arrow-right' : 'bi-person-plus'}`}></i>
                {isLogin ? 'Sign In' : 'Create Account'}
              </>
            )}
          </button>
        </form>

        {/* Toggle Section */}
        <div className="toggle-section">
          <p className="toggle-text">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              className="toggle-link"
              onClick={() => setIsLogin(!isLogin)}
              type="button"
              disabled={loading}
            >
              {isLogin ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p className="footer-text">
            By continuing, you agree to our 
            <button className="footer-link">Terms of Service</button> 
            and 
            <button className="footer-link">Privacy Policy</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
