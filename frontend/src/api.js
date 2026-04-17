import axios from 'axios';

// Central API URL configuration
// In production (Render/VPS), it falls back to the '/api' relative path which Nginx handles.
// In local development, the Vite Server's proxy intercepts '/api' and routes it to '127.0.0.1:8000'.
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Global Axios Interceptor to attach the JWT Token for the new Bearer Auth requirement
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('lwac_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default API_URL;
