import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://91.98.225.226/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('voyage_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const authApi = {
  login: d => api.post('/auth/login', d),
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
};

export const financeApi = {
  getCompanyDashboard: (companyId) => api.get(`/voyage/companies/${companyId}/finance/dashboard`),
};
