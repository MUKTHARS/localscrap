import axios from 'axios';

const api = axios.create({
  // baseURL: 'https://tutomart.com/api', 
  // baseURL: 'https://api.tutomart.com/api',
  baseURL: 'http://localhost:3001/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add the interceptor to handle errors gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If it's just a login check failing, don't redirect
    if (error.config?.url?.includes('login-status')) {
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export default api;
