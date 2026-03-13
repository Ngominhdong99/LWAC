// Central API URL configuration
// In production (Render), set VITE_API_URL environment variable to the backend URL
// In local development, it falls back to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default API_URL;
