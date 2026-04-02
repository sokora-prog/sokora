import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// URL de production SOKORA
const API_URL = "http://91.98.225.226/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('sokora_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('sokora_token');
      await SecureStore.deleteItemAsync('sokora_user');
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: (phone_number, password) => api.post('/auth/login', { phone_number, password }),
  me: () => api.get('/auth/me'),
  logout: async () => {
    await SecureStore.deleteItemAsync('sokora_token');
    await SecureStore.deleteItemAsync('sokora_user');
  },
  getSession: async () => {
    const token = await SecureStore.getItemAsync('sokora_token');
    const user = await SecureStore.getItemAsync('sokora_user');
    return { token, user: user ? JSON.parse(user) : null };
  },
  saveSession: async (token, user) => {
    await SecureStore.setItemAsync('sokora_token', token);
    await SecureStore.setItemAsync('sokora_user', JSON.stringify(user));
  }
};

export const tablesService = {
  list: () => api.get('/tables/'),
};

export const ordersService = {
  list:         (params = {}) => api.get('/orders/', { params }),
  getById:      (id)          => api.get(`/orders/${id}`),
  create:       (data)        => api.post('/orders/', data),
  addItems:     (id, items)   => api.post(`/orders/${id}/items`, { items }),
  updateStatus: (id, status)  => api.patch(`/orders/${id}/status`, { status: status.toUpperCase() }),
};

export const paymentsService = {
  process: (data) => {
    // Mapping des méthodes mobiles vers le format Backend
    const cleanData = {
      ...data,
      method: ['wave', 'orange_money', 'mtn_money', 'mtn'].includes(data.method) 
              ? 'mobile_money' 
              : data.method
    };
    return api.post('/payments/', cleanData);
  },
};

export const productsService = {
  list: () => api.get('/products/'),
  categories: () => api.get('/categories/'),
};

export const dashboardService = {
  stats: () => api.get('/dashboard/stats'),
};