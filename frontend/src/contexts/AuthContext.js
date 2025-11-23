import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// Custom hook to access auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Base API URL for production
  const API_URL = 'https://tutomart.com';

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/api/login-status`, {
        withCredentials: true
      });

      if (response.data.authenticated) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, remember) => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/login/traditional`,
        { email, password, remember },
        {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      setUser(response.data.user);
      return { success: true, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || 'Login failed'
      };
    }
  };

  const register = async (name, email, password, confirmPassword) => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/register`,
        { name, email, password, confirm_password: confirmPassword },
        {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      setUser(response.data.user);
      return { success: true, message: response.data.message };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || 'Registration failed'
      };
    }
  };

  const logout = async () => {
    try {
      await axios.post(
        `${API_URL}/auth/logout`,
        {},
        { withCredentials: true }
      );
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
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
