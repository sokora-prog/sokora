import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://91.98.225.226/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('hotel_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hotel_token');
      localStorage.removeItem('hotel_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (phone_number, password) => api.post('/auth/login', { phone_number, password }),
  me: () => api.get('/auth/me'),
};

export const hotelApi = {
  setup:     (data)     => api.post('/hotel/setup', data),
  getMe:     ()         => api.get('/hotel/me'),
  update:    (id, data) => api.patch(`/hotel/${id}`, data),
  dashboard: (id)       => api.get(`/hotel/${id}/dashboard`),
  availability: (id, cin, cout) => api.get(`/hotel/${id}/availability`, { params: { checkin_date: cin, checkout_date: cout } }),
};

export const roomTypeApi = {
  list:   (hotelId)       => api.get(`/hotel/${hotelId}/room-types`),
  create: (hotelId, data) => api.post(`/hotel/${hotelId}/room-types`, data),
};

export const roomApi = {
  list:         (hotelId)                 => api.get(`/hotel/${hotelId}/rooms`),
  create:       (hotelId, data)           => api.post(`/hotel/${hotelId}/rooms`, data),
  updateStatus: (hotelId, roomId, status) => api.patch(`/hotel/${hotelId}/rooms/${roomId}/status`, { status }),
};

export const reservationApi = {
  list:    (hotelId, status) => api.get(`/hotel/${hotelId}/reservations`, { params: status ? { status } : {} }),
  checkin: (qr_code, lat, lng) => api.post('/hotel/checkin/scan', { qr_code, lat, lng }),
  checkout: (id) => api.post(`/hotel/reservations/${id}/checkout`),
  noShow:   (id) => api.post(`/hotel/reservations/${id}/no-show`),
  update:   (id, data) => api.put(`/hotel/reservations/${id}`, data),
  delete:   (id) => api.delete(`/hotel/reservations/${id}`),
};

export const seasonApi = {
  list:   (hotelId)       => api.get(`/hotel/${hotelId}/season-rates`),
  create: (hotelId, data) => api.post(`/hotel/${hotelId}/season-rates`, data),
};

export const reviewApi = {
  list: (hotelId) => api.get(`/hotel/${hotelId}/reviews`),
};

export const blockApi = {
  create: (hotelId, data) => api.post(`/hotel/${hotelId}/blocks`, data),
};

export const transactionApi = {
  list: (hotelId, period = 'today') => api.get(`/hotel/${hotelId}/transactions`, { params: { period } }),
};

export const financeApi = {
  getHotelDashboard: (hotelId) => api.get(`/hotel/${hotelId}/finance/dashboard`),
};

export const loyaltyApi = {
  dashboard:    ()           => api.get('/loyalty/dashboard'),
  listClients:  (params)     => api.get('/loyalty/clients', { params }),
  getClient:    (phone)      => api.get(`/loyalty/clients/${phone}`),
  earn:         (data)       => api.post('/loyalty/earn', data),
  redeem:       (data)       => api.post('/loyalty/redeem', data),
  bonus:        (data)       => api.post('/loyalty/bonus', data),
  transactions: (params)     => api.get('/loyalty/transactions', { params }),
};

export default api;



