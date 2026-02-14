import axios from 'axios';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`, 
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

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
