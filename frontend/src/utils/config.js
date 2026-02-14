// Configuration utility to get API URL from environment
const getApiUrl = () => {
  const apiUrl = process.env.REACT_APP_API_URL;
  
  if (!apiUrl) {
    console.warn('REACT_APP_API_URL is not set in environment variables');
    return '';
  }
  
  return apiUrl;
};

const getGoogleAuthUrl = () => {
  const googleUrl = process.env.REACT_APP_GOOGLE_AUTH_URL;
  
  if (googleUrl) {
    return googleUrl;
  }
  
  // Fallback: construct from API URL if Google URL not set
  const apiUrl = getApiUrl();
  return `${apiUrl}/api/auth/login/google`;
};

export const API_BASE_URL = getApiUrl();
export const GOOGLE_AUTH_URL = getGoogleAuthUrl();
export default API_BASE_URL;