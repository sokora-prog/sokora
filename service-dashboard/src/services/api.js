import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://91.98.225.226/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('service_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const authApi = {
  login:      d => api.post('/auth/login', d),
  requestOtp: phone => api.post('/auth/request-otp', { phone }),
  verifyOtp:  (phone, code, password) =>
    api.post('/auth/verify-otp-login', { phone, code, ...(password ? { password } : {}) }),
};

export const serviceApi = {
  // Dashboard
  dashboard:       ()            => api.get('/services/dashboard'),

  // Categories
  categories:      ()            => api.get('/services/categories'),
  createCategory:  d             => api.post('/services/categories', d),

  // Providers
  listProviders:   (params)      => api.get('/services/providers', { params }),
  getProvider:     id            => api.get(`/services/providers/${id}`),
  createProvider:  d             => api.post('/services/providers', d),
  updateProvider:  (id, d)       => api.put(`/services/providers/${id}`, d),
  deleteProvider:  id            => api.delete(`/services/providers/${id}`),

  // Requests
  listRequests:    (params)      => api.get('/services/requests', { params }),
  createRequest:   d             => api.post('/services/requests', d),
  updateStatus:    (id, status)  => api.put(`/services/requests/${id}/status`, { status }),
  submitReview:    (id, d)       => api.post(`/services/requests/${id}/review`, d),
};
