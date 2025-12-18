import axios from 'axios';

const api = axios.create({
  // CRITICAL: This must point to port 8080
  baseURL: 'http://localhost:8080/api', 
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

// // src/utils/apiConfig.js
// import axios from 'axios';

// // Create axios instance with default config
// const api = axios.create({
//   baseURL: 'https://tutomart.com/api',
//   withCredentials: true,
//   headers: {
//     'Content-Type': 'application/json'
//   }
// });

// // Add response interceptor for better error handling
// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response?.status === 401) {
//       // Auto-logout on 401
//       window.location.href = '/login';
//     }
//     return Promise.reject(error);
//   }
// );

// export default api;
