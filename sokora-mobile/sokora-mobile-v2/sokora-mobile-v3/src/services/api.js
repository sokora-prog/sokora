import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '../utils/constants';

// Stockage cross-platform : SecureStore sur native, localStorage sur web
const storage = {
  async getItem(key) {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    try { return await SecureStore.getItemAsync(key); } catch { return null; }
  },
  async setItem(key, value) {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key) {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    try { await SecureStore.deleteItemAsync(key); } catch {}
  },
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await storage.getItem('sokora_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await storage.deleteItem('sokora_token');
      await storage.deleteItem('sokora_user');
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: (phone_number, password) => api.post('/auth/login', { phone_number, password }),
  me: () => api.get('/auth/me'),
  saveSession: async (token, user) => {
    await storage.setItem('sokora_token', token);
    await storage.setItem('sokora_user', JSON.stringify(user));
  },
  getSession: async () => {
    const token = await storage.getItem('sokora_token');
    const userStr = await storage.getItem('sokora_user');
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, user };
  },
  logout: async () => {
    await storage.deleteItem('sokora_token');
    await storage.deleteItem('sokora_user');
  },
};

export const tablesService = {
  list: () => api.get('/tables/'),
  updateStatus: (id, status) => api.patch(`/tables/${id}/status`, { status }),
  create: (data) => api.post('/tables/', data),
};

export const ordersService = {
  list: (params = {}) => { const q = new URLSearchParams(); if (params.status) q.append('status', params.status); if (params.waiter_id) q.append('waiter_id', params.waiter_id); const qs = q.toString(); return api.get('/orders/' + (qs ? '?' + qs : '')); },
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders/', data),
  addItems: (id, items) => api.post(`/orders/${id}/items`, { items }),
  updateStatus: (id, status, payment_method) => api.patch(`/orders/${id}/status`, { status, payment_method }),
};

export const paymentsService = {
  process: (data) => api.post('/payments/', data),
};

export const productsService = {
  list: () => api.get('/products/'),
  categories: () => api.get('/categories/'),
};

export const dashboardService = {
  stats:       ()               => api.get('/dashboard/stats'),
  waiterStats: ()               => api.get('/dashboard/waiters'),
  myStats:     (period='today') => api.get('/dashboard/my-stats', { params: { period } }),
  closing:     (date=null)      => api.get('/dashboard/closing' + (date ? '?date=' + date : '')),
  caisse:         (period='today') => api.get('/dashboard/caisse',           { params: { period } }),
  revenueByMethod:(period='7d')    => api.get('/dashboard/revenue-by-method', { params: { period } }),
};

export const staffService = {
  list: () => api.get('/staff/'),
  create: (data) => api.post('/staff/', data),
  update: (id, data) => api.patch(`/staff/${id}`, data),
};

export const expensesService = {
  list: () => api.get('/expenses/'),
  create: (data) => api.post('/expenses/', data),
};


export const walletService = {
  getMyWallet:        ()        => api.get('/wallet/me'),
  requestTopup:       (data)    => api.post('/wallet/topup', data),
  payWithWallet:      (data)    => api.post('/wallet/pay', data),          // client paie sa propre commande
  staffPayByPhone:    (data)    => api.post('/wallet/pay-by-phone', data), // serveur encaisse via tel client
  transfer:           (data)    => api.post('/wallet/transfer', data),
  getPendingTopups:   ()        => api.get('/wallet/topups/pending'),
  confirmTopup:       (id)      => api.patch(`/wallet/topups/${id}/confirm`),
  rejectTopup:        (id)      => api.patch(`/wallet/topups/${id}/reject`),
  expressTopup:       (data)    => api.post('/wallet/topups/express', data),
  checkClientBalance: (phone)   => api.get(`/wallet/client-balance/${phone}`),
  getQrToken:         (service) => api.get('/wallet/qr-token', { params: { service } }),
  payByQr:            (data)    => api.post('/wallet/pay-by-qr', data),
};

// ── SOKORA PULSE — Feed social ────────────────────────────────────────────────
export const promoService = {
  list:         (params = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.append('category', params.category);
    if (params.city) q.append('city', params.city);
    if (params.estab_type) q.append('estab_type', params.estab_type);
    return api.get('/promo/posts' + (q.toString() ? '?' + q : '')).then(r => r.data);
  },
  getPost:      (id) => api.get(`/promo/posts/${id}`).then(r => r.data),
  createPost:   (data) => api.post('/promo/posts', data),
  react:        (postId, reaction_key) => api.post(`/promo/posts/${postId}/react`, { reaction_key }),
  getComments:  (postId) => api.get(`/promo/posts/${postId}/comments`).then(r => r.data),
  addComment:   (postId, data) => api.post(`/promo/posts/${postId}/comments`, data),
};

// ── SOKORA EXPLORE — Établissements ──────────────────────────────────────────
export const discoverService = {
  list: (params = {}) => {
    const q = new URLSearchParams();
    if (params.category)  q.append('category',  params.category);
    if (params.city)      q.append('city',       params.city);
    if (params.sort)      q.append('sort',       params.sort);
    if (params.search)    q.append('search',     params.search);
    if (params.open_only) q.append('open_only',  'true');
    return api.get('/promo/establishments' + (q.toString() ? '?' + q : '')).then(r => r.data);
  },
  getById: (id) => api.get(`/promo/establishments/${id}`).then(r => r.data),
  create:  (data) => api.post('/promo/establishments', data),

  // Endpoints explore dédiés
  getEstablishments: ({ category, city, search } = {}) => {
    const q = new URLSearchParams();
    if (category) q.append('category', category);
    if (city)     q.append('city',     city);
    if (search)   q.append('search',   search);
    return api.get('/promo/establishments' + (q.toString() ? '?' + q : '')).then(r => r.data);
  },
  getHotels: ({ city, search } = {}) => {
    const q = new URLSearchParams();
    if (city)   q.append('city',   city);
    if (search) q.append('search', search);
    return api.get('/hotel/nearby' + (q.toString() ? '?' + q : '')).then(r => r.data);
  },
  getVoyages: ({ origin, destination } = {}) => {
    const q = new URLSearchParams();
    if (origin)      q.append('origin',      origin);
    if (destination) q.append('destination', destination);
    return api.get('/voyage/search' + (q.toString() ? '?' + q : '')).then(r => r.data);
  },
};

// ── CONCIERGERIE — Profil Premium ─────────────────────────────────────────────
export const conciergeService = {
  getProfile:  () => api.get('/promo/profile/premium').then(r => r.data),
};

// ── CLIENT DASHBOARD — Agrégation cross-module ───────────────────────────────
export const clientDashboardService = {
  /**
   * Dashboard unifié : wallet + upcoming events + loyalty + activity
   * Requiert X-Client-Token header (token OTP client)
   */
  get: async (clientToken) => {
    const res = await fetch(`${API_URL}/client/dashboard`, {
      headers: { 'X-Client-Token': clientToken },
    });
    if (!res.ok) throw new Error('Dashboard unavailable');
    return res.json();
  },
};

// ── CLIENT SERVICES — Mes demandes de service ────────────────────────────────
export const clientServicesApi = {
  myRequests: async (token) => {
    const res = await fetch(`${API_URL}/services/requests/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok ? res.json() : [];
  },
  payRequest: async (token, requestId) => {
    const res = await fetch(`${API_URL}/services/requests/${requestId}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    return res.json();
  },
};

// ── HOTEL CLIENT — Mes réservations ─────────────────────────────────────────
export const clientHotelApi = {
  myBookings: async (clientToken) => {
    const res = await fetch(`${API_URL}/hotel/bookings/my`, {
      headers: { 'X-Client-Token': clientToken },
    });
    return res.ok ? res.json() : [];
  },
};

// ── VOYAGE CLIENT — Mes tickets ──────────────────────────────────────────────
export const clientVoyageApi = {
  myTickets: async (clientToken) => {
    const res = await fetch(`${API_URL}/voyage/tickets/my`, {
      headers: { 'X-Client-Token': clientToken },
    });
    return res.ok ? res.json() : [];
  },
};

export const hotelService = {
  me: () => api.get('/hotel/me'),
};

export default api;


