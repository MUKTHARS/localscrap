import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../utils/apiConfig'; // Ensure this file exists as shown above

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on page load
  const checkAuthStatus = async () => {
    try {
      // Corresponds to http://localhost:8080/api/auth/login-status
      const response = await api.get('/auth/login-status');
      
      if (response.data.authenticated) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      // 401 Unauthorized is expected if not logged in
      console.log("Auth Check:", error.response?.status === 401 ? "Not logged in" : error.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Run once when the app mounts
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const login = async (email, password, remember) => {
    try {
      setLoading(true);
      // Corresponds to http://localhost:8080/api/auth/login/traditional
      const response = await api.post('/auth/login/traditional', { 
        email, 
        password, 
        remember 
      });

      console.log("Login API Response:", response.data); // Debug log

      if (response.data.user) {
        setUser(response.data.user);
        return { success: true, message: response.data.message };
      } else {
        return { success: false, message: "No user data received" };
      }
      
    } catch (error) {
      console.error("Login Error:", error);
      return {
        success: false,
        message: error.response?.data?.error || 'Login failed. Check console.'
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, confirmPassword) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/register', { 
        name, 
        email, 
        password, 
        confirm_password: confirmPassword 
      });

      setUser(response.data.user);
      return { success: true, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || 'Registration failed'
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      // We don't necessarily need window.location.reload if state is handled correctly,
      // but keeping your approach for safety:
      window.location.href = '/login';
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    checkAuthStatus
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
