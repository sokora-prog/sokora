import axios from 'axios';
import { getApiBase, getApiToken } from './connection.js';

const api = axios.create();

// L'adresse est résolue à chaque requête, et non à la création du client :
// changer de serveur depuis l'onglet « Connexion » prend effet immédiatement,
// sans recharger l'application — ce qui, dans un APK, voudrait dire la fermer
// et la rouvrir.
api.interceptors.request.use(config => {
  config.baseURL = getApiBase();
  const token = getApiToken();
  if (token) config.headers['X-Sport-Token'] = token;
  return config;
});

/** Message d'erreur lisible, quelle que soit la forme de la réponse FastAPI. */
export function errorMessage(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(d => `${(d.loc || []).slice(-1)[0]} : ${d.msg}`).join(' · ');
  }
  return error?.message || 'Erreur inconnue';
}

export const sportApi = {
  dashboard:      ()               => api.get('/sport/dashboard'),

  // Compétitions
  competitions:   ()               => api.get('/sport/competitions'),
  createCompetition: d             => api.post('/sport/competitions', d),
  deleteCompetition: id            => api.delete(`/sport/competitions/${id}`),
  table:          id               => api.get(`/sport/competitions/${id}/table`),

  // Équipes
  teams:          params           => api.get('/sport/teams', { params }),
  createTeam:     d                => api.post('/sport/teams', d),
  teamStats:      (id, last = 10)  => api.get(`/sport/teams/${id}/stats`, { params: { last } }),

  // Matchs
  matches:        params           => api.get('/sport/matches', { params }),
  createMatch:    d                => api.post('/sport/matches', d),
  updateMatch:    (id, d)          => api.put(`/sport/matches/${id}`, d),
  deleteMatch:    id               => api.delete(`/sport/matches/${id}`),
  setResult:      (id, d)          => api.put(`/sport/matches/${id}/result`, d),
  importCsv:      d                => api.post('/sport/matches/import', d),

  // Cotes
  odds:           id               => api.get(`/sport/matches/${id}/odds`),
  addOdds:        (id, d)          => api.post(`/sport/matches/${id}/odds`, d),
  deleteOdds:     id               => api.delete(`/sport/odds/${id}`),

  // Analyse
  analysis:       (id, params)     => api.get(`/sport/matches/${id}/analysis`, { params }),
  predict:        d                => api.post('/sport/predict', d),
  valueBets:      params           => api.get('/sport/value-bets', { params }),
  backtest:       params           => api.get('/sport/backtest', { params }),

  // Réalisme : le modèle bat-il le marché, et à quel risque ?
  calibration:    params           => api.get('/sport/calibration', { params }),
  riskSimulation: params           => api.get('/sport/risk-simulation', { params }),

  // Laboratoire : quelle variante prédit le mieux, et où ?
  modelComparison: params        => api.get('/sport/model-comparison', { params }),
  edgeMap:        params           => api.get('/sport/edge-map', { params }),
  forecasts:      params           => api.get('/sport/forecasts', { params }),
  snapshotForecasts: d             => api.post('/sport/forecasts/snapshot', d),
  forecastScoreboard: params       => api.get('/sport/forecasts/scoreboard', { params }),
  deleteForecast: id               => api.delete(`/sport/forecasts/${id}`),

  // Paris et bankroll
  bets:           params           => api.get('/sport/bets', { params }),
  createBet:      d                => api.post('/sport/bets', d),
  settleBet:      (id, d)          => api.put(`/sport/bets/${id}/settle`, d),
  deleteBet:      id               => api.delete(`/sport/bets/${id}`),
  performance:    ()               => api.get('/sport/performance'),
  bankroll:       ()               => api.get('/sport/bankroll'),
  addBankrollTx:  d                => api.post('/sport/bankroll/transactions', d),
  deleteBankrollTx: id             => api.delete(`/sport/bankroll/transactions/${id}`),

  seedDemo:       (params)         => api.post('/sport/seed-demo', null, { params }),
};

export default api;
