import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://91.98.225.226/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('voyage_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const authApi = {
  login:      d => api.post('/auth/login', d),
  requestOtp: phone => api.post('/auth/request-otp', { phone }),
  verifyOtp:  (phone, code, password) =>
    api.post('/auth/verify-otp-login', { phone, code, ...(password ? { password } : {}) }),
};

export const voyageApi = {
  // Companies
  listCompanies:  ()         => api.get('/voyage/companies'),
  createCompany:  d          => api.post('/voyage/companies', d),
  updateCompany:  (id, d)    => api.put(`/voyage/companies/${id}`, d),
  getDashboard:   id         => api.get(`/voyage/companies/${id}/dashboard`),

  // Vehicles
  listVehicles:   cid        => api.get(`/voyage/companies/${cid}/vehicles`),
  createVehicle:  (cid, d)   => api.post(`/voyage/companies/${cid}/vehicles`, d),

  // Drivers
  listDrivers:    cid        => api.get(`/voyage/companies/${cid}/drivers`),
  createDriver:   (cid, d)   => api.post(`/voyage/companies/${cid}/drivers`, d),

  // Routes
  listRoutes:     cid        => api.get(`/voyage/companies/${cid}/routes`),
  createRoute:    (cid, d)   => api.post(`/voyage/companies/${cid}/routes`, d),

  // Trips
  createTrip:     d          => api.post('/voyage/trips', d),
  updateTripStatus: (id, s)  => api.put(`/voyage/trips/${id}/status`, { status: s }),
  searchTrips:    (o, d, dt) => api.get('/voyage/search', { params: { origin: o, destination: d, date: dt } }),
  getTripDetail:  id         => api.get(`/voyage/trips/${id}`),

  // Trip bookings (Feature 2 — liste passagers)
  getTripBookings: (tripId)  => api.get(`/voyage/trips/${tripId}/bookings`),

  // Driver stats
  getDriverStats: (cid, did, period) => api.get(`/voyage/companies/${cid}/drivers/${did}/stats`, { params: { period } }),

  // Vehicle positions (Feature 3 — tracking live)
  getVehiclePositions: (companyId) => api.get('/voyage/vehicles/positions', { params: { company_id: companyId } }),
};

export const financeApi = {
  getCompanyDashboard: (companyId) => api.get(`/voyage/companies/${companyId}/finance/dashboard`),
};

export const loyaltyApi = {
  dashboard:    ()       => api.get('/loyalty/dashboard'),
  listClients:  (params) => api.get('/loyalty/clients', { params }),
  earn:         (data)   => api.post('/loyalty/earn', data),
  redeem:       (data)   => api.post('/loyalty/redeem', data),
  transactions: (params) => api.get('/loyalty/transactions', { params }),
};
