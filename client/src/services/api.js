/**
 * API Service Layer
 * Handles all HTTP requests to the backend
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add any auth headers if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorMessage = error.response?.data?.error?.message || error.message || 'An error occurred';
    console.error('API Error:', errorMessage);
    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      code: error.response?.data?.error?.code,
    });
  }
);

// ==================== Metrics API ====================

export const metricsApi = {
  getOverview: () => api.get('/metrics/overview'),
  
  getAuthTrends: (params = {}) => 
    api.get('/metrics/auth-trends', { params }),
  
  getTopUsers: (limit = 10) => 
    api.get('/metrics/top-users', { params: { limit } }),
  
  getByApplication: () => 
    api.get('/metrics/by-application'),
  
  getByRealm: () => 
    api.get('/metrics/by-realm'),
  
  getFailureAnalysis: () => 
    api.get('/metrics/failure-analysis'),
};

// ==================== Auth Events API ====================

export const authEventsApi = {
  list: (params = {}) => 
    api.get('/auth-events', { params }),
  
  get: (id) => 
    api.get(`/auth-events/${id}`),
  
  create: (data) => 
    api.post('/auth-events', data),
  
  bulkCreate: (events) => 
    api.post('/auth-events/bulk', { events }),
};

// ==================== Sessions API ====================

export const sessionsApi = {
  list: (params = {}) => 
    api.get('/sessions', { params }),
  
  get: (id) => 
    api.get(`/sessions/${id}`),
  
  getActive: () => 
    api.get('/sessions/active'),
  
  getStats: () => 
    api.get('/sessions/stats'),
  
  create: (data) => 
    api.post('/sessions', data),
  
  end: (id) => 
    api.patch(`/sessions/${id}/end`),
};

// ==================== Alerts API ====================

export const alertsApi = {
  list: (params = {}) => 
    api.get('/alerts', { params }),
  
  get: (id) => 
    api.get(`/alerts/${id}`),
  
  getActive: () => 
    api.get('/alerts/active'),
  
  create: (data) => 
    api.post('/alerts', data),
  
  acknowledge: (id, acknowledgedBy) => 
    api.patch(`/alerts/${id}/acknowledge`, { acknowledged_by: acknowledgedBy }),
  
  resolve: (id, resolvedBy) => 
    api.patch(`/alerts/${id}/resolve`, { resolved_by: resolvedBy }),
};

// ==================== Dashboard API ====================

export const dashboardApi = {
  getConfigs: () => 
    api.get('/dashboard/configs'),
  
  getDefaultConfig: () => 
    api.get('/dashboard/configs/default'),
  
  getConfig: (id) => 
    api.get(`/dashboard/configs/${id}`),
  
  createConfig: (data) => 
    api.post('/dashboard/configs', data),
  
  updateConfig: (id, data) => 
    api.put(`/dashboard/configs/${id}`, data),
  
  deleteConfig: (id) => 
    api.delete(`/dashboard/configs/${id}`),
};

// ==================== Reports API ====================

export const reportsApi = {
  getSummary: (params = {}) => 
    api.get('/reports/summary', { params }),
  
  getAuthentication: (params = {}) => 
    api.get('/reports/authentication', { params }),
  
  getSecurity: (params = {}) => 
    api.get('/reports/security', { params }),
  
  exportData: (params = {}) => 
    api.get('/reports/export', { params }),
};

export default api;
