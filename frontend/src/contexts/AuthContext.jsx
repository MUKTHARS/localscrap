// src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../utils/apiConfig';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add this useEffect to check auth status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await api.get('/auth/login-status');
      
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
      const response = await api.post('/auth/login/traditional', { 
        email, 
        password, 
        remember 
      });

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
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
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


// // src/contexts/AuthContext.jsx
// import React, { createContext, useState, useContext, useEffect } from 'react';
// import api from '../utils/apiConfig'; // Import the api instance

// const AuthContext = createContext();

// export const useAuth = () => {
//   return useContext(AuthContext);
// };

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);

//   const checkAuthStatus = async () => {
//     try {
//       const response = await api.get('/auth/login-status'); // Use api instance
      
//       if (response.data.authenticated) {
//         setUser(response.data.user);
//       } else {
//         setUser(null);
//       }
//     } catch (error) {
//       console.error('Auth check failed:', error);
//       setUser(null);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const login = async (email, password, remember) => {
//     try {
//       const response = await api.post('/auth/login/traditional', { 
//         email, 
//         password, 
//         remember 
//       });

//       setUser(response.data.user);
//       return { success: true, message: response.data.message };
//     } catch (error) {
//       return {
//         success: false,
//         message: error.response?.data?.error || 'Login failed'
//       };
//     }
//   };

//   const register = async (name, email, password, confirmPassword) => {
//     try {
//       const response = await api.post('/auth/register', { 
//         name, 
//         email, 
//         password, 
//         confirm_password: confirmPassword 
//       });

//       setUser(response.data.user);
//       return { success: true, message: response.data.message };
//     } catch (error) {
//       return {
//         success: false,
//         message: error.response?.data?.error || 'Registration failed'
//       };
//     }
//   };

//   const logout = async () => {
//     try {
//       await api.post('/auth/logout');
//     } catch (error) {
//       console.error('Logout error:', error);
//     } finally {
//       setUser(null);
//     }
//   };

//   const value = {
//     user,
//     loading,
//     login,
//     register,
//     logout,
//     checkAuthStatus
//   };

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// };
