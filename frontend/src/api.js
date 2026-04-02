import axios from "axios";

const BASE_URL = import.meta.env?.VITE_API_URL || "http://localhost:8001";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("sokora_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("sokora_token");
      localStorage.removeItem("sokora_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (phone_number, password) => api.post("/auth/login", { phone_number, password }),
  me: () => api.get("/auth/me"),
  register: (data) => api.post("/auth/register", data),
};

export const dashboardApi = {
  stats:           ()                                    => api.get("/dashboard/stats"),
  waiters:         ()                                    => api.get("/dashboard/waiters"),
  statsPeriod:     (p="today", date_from, date_to) => { const period = p==="7d"?"week":p==="30d"?"month":p; return api.get("/dashboard/stats-period", { params: { period, date_from, date_to } }); },
  waitersPeriod:   (p="today", date_from, date_to) => { const period = p==="7d"?"week":p==="30d"?"month":p; return api.get("/dashboard/waiters-period", { params: { period, date_from, date_to } }); },
  revenueChart:    (period="7d")                        => api.get("/dashboard/revenue-chart",   { params: { period } }),
  caisse:          (period="today")                     => api.get("/dashboard/caisse",           { params: { period } }),
  revenueByMethod: (period="7d")                        => api.get("/dashboard/revenue-by-method",{ params: { period } }),
  closing:         (date=null)                          => api.get("/dashboard/closing" + (date ? "?date=" + date : "")),
  myStats:         (period="today")                     => api.get("/dashboard/my-stats",        { params: { period } }),
  complimentary:   (start, end)                         => api.get("/dashboard/complimentary",    { params: { start, end } }),
};

export const tablesApi = {
  list:         ()              => api.get("/tables/"),
  create:       (data)          => api.post("/tables/", data),
  updateStatus: (id, status)    => api.patch(`/tables/${id}/status`, { status }),
};

export const menuApi = {
  categories:    ()        => api.get("/categories/"),
  addCategory:   (data)    => api.post("/categories/", data),
  products:      ()        => api.get("/products/"),
  addProduct:    (data)    => api.post("/products/", data),
  updateProduct: (id, data)=> api.patch(`/products/${id}`, data),
};

export const ordersApi = {
  list:         (status)     => api.get("/orders/", { params: status ? { status } : {} }),
  create:       (data)       => api.post("/orders/", data),
  addItems:     (id, data)   => api.post(`/orders/${id}/items`, data),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
};

export const paymentsApi = {
  process: (data) => api.post("/payments/", data),
};

export const expensesApi = {
  list:   ()     => api.get("/expenses/"),
  create: (data) => api.post("/expenses/", data),
};

export const staffApi = {
  list:   ()         => api.get("/staff/"),
  create: (data)     => api.post("/staff/", data),
  update: (id, data) => api.patch(`/staff/${id}`, data),
};

export default api;

export const stockApi = {
  list:             ()              => api.get("/stock"),
  waiterList:       ()              => api.get("/stock/waiter"),
  update:           (id, data)      => api.patch(`/stock/${id}`, data),
  updateThreshold:  (id, data)      => api.patch(`/stock/${id}/settings`, data),
  updateReorder:    (id, threshold) => api.patch(`/stock/${id}/reorder-threshold`, { threshold }),
  movements:        (id)            => api.get(`/stock/${id}/movements`),
  bulkUpdate:       (items)         => api.post("/stock/bulk-update", { items }),
  submitInventory:  (items)         => api.post("/stock/inventory", { items }),
  inventoryHistory: ()              => api.get("/stock/inventory/history"),
  orderList:        ()              => api.get("/stock/order-list"),
  dashboard:        ()              => api.get("/stock/dashboard"),
  movementsPeriod:  (period)        => api.get("/stock/movements-period", { params: { period } }),
  bilan:            ()              => api.get("/stock/bilan"),
  deleteProduct:    (id)            => api.delete("/stock/" + id),
  reapproList:      (status=null)    => api.get("/stock/reappro", { params: status ? { status } : {} }),
  reapproCreate:    (data)           => api.post("/stock/reappro", data),
  reapproReceive:   (id, qty)        => api.patch(`/stock/reappro/${id}/receive`, { quantity_received: qty }),
};

export const creditApi = {
  accounts:       (active_only=false) => api.get("/credit/accounts", { params: { active_only } }),
  search:         (q)                 => api.get("/credit/accounts/search", { params: { q } }),
  create:         (data)              => api.post("/credit/accounts", data),
  get:            (id)                => api.get(`/credit/accounts/${id}`),
  addTransaction: (id, data)          => api.post(`/credit/accounts/${id}/transactions`, data),
  transactions:   (id)                => api.get(`/credit/accounts/${id}/transactions`),
  close:          (id)                => api.patch(`/credit/accounts/${id}/close`),
  stats:          ()                  => api.get("/credit/stats"),
};

export const walletApi = {
  myWallet:        ()      => api.get("/wallet/me"),
  manager:         ()      => api.get("/wallet/manager"),
  liquidity:       ()      => api.get("/wallet/liquidity"),
  pendingTopups:   ()      => api.get("/wallet/topups/pending"),
  confirmTopup:    (id)    => api.patch(`/wallet/topups/${id}/confirm`),
  rejectTopup:     (id)    => api.patch(`/wallet/topups/${id}/reject`),
  expressTopup:    (data)  => api.post("/wallet/topups/express", data),
  checkBalance:    (phone) => api.get(`/wallet/client-balance/${phone}`),
  payByPhone:      (data)  => api.post("/wallet/pay-by-phone", data),
  paymentRequests: ()      => api.get("/wallet/payment-requests"),
  confirmPayReq:   (id)    => api.post(`/wallet/payment-requests/${id}/confirm`),
  rejectPayReq:    (id)    => api.post(`/wallet/payment-requests/${id}/reject`),
};

export const kdsApi = {
  orders:     ()  => api.get("/kds/orders"),
  startOrder: (id)=> api.patch(`/orders/${id}/start`),
  markReady:  (id)=> api.patch(`/orders/${id}/ready`),
};

export const establishmentsApi = {
  getMe:          ()                    => api.get("/establishments/me"),
  updateLocation: (id, lat, lng)        => api.patch(`/establishments/${id}/location`, { latitude: lat, longitude: lng }),
};

export const financeApi = {
  getDashboard: () => api.get("/finance/dashboard"),
};

export const adminApi = {
  getNetwork: () => api.get("/admin/network"),
};

export const reportsApi = {
  downloadMonthly: (month) => api.get(`/reports/monthly${month ? '?month=' + month : ''}`, { responseType: 'blob' }),
};

export const posApi = {
  sales:      (limit=50)  => api.get("/pos/sales", { params: { limit } }),
  createSale: (data)      => api.post("/pos/sales", data),
  stats:      ()          => api.get("/pos/stats"),
};
