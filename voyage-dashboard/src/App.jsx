import { useState, useEffect, useCallback } from 'react';
import { authApi, voyageApi, financeApi } from './services/api';

/* ═══════════════════════════════════════════════════════════════
   CHARTE GRAPHIQUE SOKORA
═══════════════════════════════════════════════════════════════ */
const C = {
  orange:      '#F26D21',
  orangeHov:   '#FF8040',
  orangePale:  '#F26D2115',
  orangeBorder:'#F26D2144',
  navy:        '#1A2E4A',
  navyMid:     '#243A5E',
  blue:        '#3065A6',
  bluePale:    '#3065A615',
  black:       '#0F1117',
  blackMid:    '#1a1a2e',
  blackLight:  '#232336',
  border:      '#2a2a3e',
  borderLight: '#3a3a4e',
  white:       '#FFFFFF',
  whiteOff:    '#F5F5F5',
  muted:       '#888899',
  mutedLight:  '#aaaacc',
  green:       '#2ECC71',
  greenPale:   '#2ECC7115',
  red:         '#E74C3C',
  redPale:     '#E74C3C15',
  purple:      '#9B59B6',
  purplePale:  '#9B59B615',
  teal:        '#1ABC9C',
  tealPale:    '#1ABC9C15',
  gold:        '#F59E0B',
  goldPale:    '#F59E0B15',
};

const TRIP_STATUS = {
  SCHEDULED:   { label: 'Programmé',    c: C.blue,   bg: C.bluePale },
  BOARDING:    { label: 'Embarquement', c: C.green,  bg: C.greenPale },
  IN_PROGRESS: { label: 'En cours',     c: C.orange, bg: C.orangePale },
  COMPLETED:   { label: 'Terminé',      c: C.teal,   bg: C.tealPale },
  CANCELLED:   { label: 'Annulé',       c: C.red,    bg: C.redPale },
};

const VEHICLE_TYPE = {
  MINIBUS: '🚐 Minibus',
  BUS:     '🚌 Bus',
  VAN:     '🚐 Van',
  SHARED:  '🚕 Taxi brousse',
};

const fmt     = n  => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';
const fmtDate = d  => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = d  => d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDateTime = d => d ? `${fmtDate(d)} ${fmtTime(d)}` : '—';

/* ═══════════════════════════════════════════════════════════════
   GLOBAL CSS
═══════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
  .btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:8px; border:none; cursor:pointer; font-size:13px; font-weight:600; transition:all .2s; }
  .btn-primary { background:${C.orange}; color:#fff; }
  .btn-primary:hover { background:${C.orangeHov}; transform:translateY(-1px); }
  .btn-ghost { background:transparent; color:${C.muted}; border:1px solid ${C.border}; }
  .btn-ghost:hover { border-color:${C.orange}; color:${C.orange}; }
  .btn-danger { background:${C.redPale}; color:${C.red}; border:1px solid ${C.red}44; }
  .btn-danger:hover { background:${C.red}; color:#fff; }
  .btn-sm { padding:5px 10px; font-size:12px; }
  .card { background:${C.blackLight}; border:1px solid ${C.border}; border-radius:12px; padding:20px; }
  .input { width:100%; padding:10px 14px; background:${C.blackMid}; border:1px solid ${C.border}; border-radius:8px; color:#fff; font-size:13px; outline:none; transition:border .2s; }
  .input:focus { border-color:${C.orange}; }
  .input::placeholder { color:${C.muted}; }
  select.input option { background:${C.blackMid}; }
  .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; }
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1000; padding:20px; }
  .modal { background:${C.blackLight}; border:1px solid ${C.border}; border-radius:16px; width:100%; max-width:500px; max-height:90vh; overflow-y:auto; }
  .modal-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid ${C.border}; }
  .modal-body { padding:24px; display:flex; flex-direction:column; gap:16px; }
  .modal-footer { padding:16px 24px; border-top:1px solid ${C.border}; display:flex; gap:10px; justify-content:flex-end; }
  .form-group { display:flex; flex-direction:column; gap:6px; }
  .form-label { font-size:12px; color:${C.muted}; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
  .table { width:100%; border-collapse:collapse; }
  .table th { text-align:left; padding:10px 14px; font-size:11px; color:${C.muted}; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid ${C.border}; }
  .table td { padding:12px 14px; font-size:13px; border-bottom:1px solid ${C.border}22; }
  .table tr:hover td { background:${C.border}22; }
  .tab { padding:8px 16px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; transition:all .2s; border:none; background:transparent; color:${C.muted}; }
  .tab.active { background:${C.orangePale}; color:${C.orange}; }
  .tab:hover:not(.active) { color:#fff; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .fade-in { animation: fadeIn .3s ease; }
`;

/* ═══════════════════════════════════════════════════════════════
   LOGIN SCREEN
═══════════════════════════════════════════════════════════════ */
function LoginScreen({ onLogin }) {
  const [form, setForm]   = useState({ phone_number: '', password: '' });
  const [err, setErr]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const { data } = await authApi.login(form);
      localStorage.setItem('voyage_token', data.access_token);
      localStorage.setItem('voyage_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch {
      setErr('Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:C.black, padding:20 }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🚌</div>
          <div style={{ fontSize:28, fontWeight:800, color:C.orange }}>SOKORA</div>
          <div style={{ fontSize:14, color:C.muted, marginTop:4 }}>Dashboard Compagnie Voyage</div>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="form-group">
              <label className="form-label">Téléphone</label>
              <input className="input" type="tel" placeholder="0700000000"
                value={form.phone_number}
                onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <input className="input" type="password" placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            {err && <div style={{ color:C.red, fontSize:13, textAlign:'center' }}>{err}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width:'100%', justifyContent:'center', padding:12 }}>
              {loading ? '...' : '🚀 Connexion'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KPI CARD
═══════════════════════════════════════════════════════════════ */
function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className="card" style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:(color||C.orange)+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
          {icon}
        </div>
        <span style={{ fontSize:12, color:C.muted, fontWeight:600 }}>{label}</span>
      </div>
      <div style={{ fontSize:28, fontWeight:800, color:color||C.orange }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:C.muted }}>{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════════════════════ */
function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">
        <div className="modal-header">
          <span style={{ fontWeight:700, fontSize:16 }}>{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD OVERVIEW
═══════════════════════════════════════════════════════════════ */
function DashboardScreen({ company }) {
  const [stats, setStats] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    Promise.all([
      voyageApi.getDashboard(company.id).catch(() => ({ data: {} })),
      voyageApi.searchTrips('', '', '').catch(() => ({ data: [] })),
    ]).then(([s, t]) => {
      setStats(s.data);
      setTrips((t.data || []).slice(0, 10));
      setLoading(false);
    });
  }, [company]);

  if (!company) return (
    <div style={{ padding:40, textAlign:'center', color:C.muted }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🏢</div>
      <p>Sélectionnez ou créez une compagnie pour commencer</p>
    </div>
  );

  if (loading) return <div style={{ padding:40, textAlign:'center', color:C.muted }}>Chargement...</div>;

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <div>
        <h2 style={{ fontSize:22, fontWeight:800, marginBottom:4 }}>{company.name}</h2>
        <p style={{ color:C.muted, fontSize:13 }}>Vue d'ensemble — Aujourd'hui</p>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16 }}>
        <KpiCard icon="🚌" label="Véhicules actifs"   value={stats?.nb_vehicles      ?? 0} color={C.blue} />
        <KpiCard icon="👨‍✈️" label="Chauffeurs actifs"  value={stats?.nb_drivers       ?? 0} color={C.purple} />
        <KpiCard icon="📅" label="Voyages aujourd'hui" value={stats?.nb_trips_today   ?? 0} color={C.orange} />
        <KpiCard icon="🎫" label="Réservations / jour" value={stats?.nb_bookings_today ?? 0} color={C.teal} />
        <KpiCard icon="💰" label="CA aujourd'hui"      value={fmt(stats?.ca_today ?? 0)} color={C.green} sub="Wallet SOKORA" />
      </div>

      {/* Derniers voyages */}
      {trips.length > 0 && (
        <div className="card">
          <h3 style={{ fontWeight:700, marginBottom:16, fontSize:15 }}>🗓️ Prochains voyages</h3>
          <div style={{ overflowX:'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Trajet</th>
                  <th>Départ</th>
                  <th>Places</th>
                  <th>Prix</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {trips.map(t => {
                  const st = TRIP_STATUS[t.status] || TRIP_STATUS.SCHEDULED;
                  return (
                    <tr key={t.id}>
                      <td><strong>{t.origin}</strong> → <strong>{t.destination}</strong></td>
                      <td style={{ color:C.muted }}>{fmtDateTime(t.departure_at)}</td>
                      <td>
                        <span style={{ color: t.seats_left < 5 ? C.red : C.green }}>
                          {t.seats_left}/{t.seats_total}
                        </span>
                      </td>
                      <td style={{ color:C.orange, fontWeight:700 }}>{fmt(t.price)}</td>
                      <td><span className="badge" style={{ background:st.bg, color:st.c }}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VÉHICULES
═══════════════════════════════════════════════════════════════ */
function VehiclesScreen({ company }) {
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:'', plate:'', vehicle_type:'BUS', seat_count:30 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!company) return;
    voyageApi.listVehicles(company.id).then(r => setVehicles(r.data || [])).catch(() => {});
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await voyageApi.createVehicle(company.id, { ...form, seat_count: Number(form.seat_count) });
      setShowModal(false);
      setForm({ name:'', plate:'', vehicle_type:'BUS', seat_count:30 });
      load();
    } catch {} finally { setSaving(false); }
  };

  if (!company) return <div style={{ padding:40, textAlign:'center', color:C.muted }}>Sélectionnez une compagnie</div>;

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800 }}>🚌 Flotte de véhicules</h2>
          <p style={{ color:C.muted, fontSize:13, marginTop:2 }}>{vehicles.length} véhicule(s) enregistré(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Ajouter un véhicule</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
        {vehicles.map(v => (
          <div key={v.id} className="card" style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ fontSize:32 }}>{v.vehicle_type === 'BUS' ? '🚌' : v.vehicle_type === 'MINIBUS' ? '🚐' : '🚕'}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{v.name}</div>
                <div style={{ color:C.muted, fontSize:12 }}>{VEHICLE_TYPE[v.vehicle_type] || v.vehicle_type}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ flex:1, background:C.blackMid, borderRadius:8, padding:'8px 12px' }}>
                <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase' }}>Plaque</div>
                <div style={{ fontWeight:600, marginTop:2 }}>{v.plate || '—'}</div>
              </div>
              <div style={{ flex:1, background:C.blackMid, borderRadius:8, padding:'8px 12px' }}>
                <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase' }}>Sièges</div>
                <div style={{ fontWeight:600, color:C.orange, marginTop:2 }}>{v.seat_count}</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:4, background: v.is_active ? C.green : C.red }} />
              <span style={{ fontSize:12, color: v.is_active ? C.green : C.red }}>{v.is_active ? 'Actif' : 'Inactif'}</span>
            </div>
          </div>
        ))}
        {vehicles.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40, color:C.muted }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🚌</div>
            <p>Aucun véhicule. Ajoutez votre premier bus !</p>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="➕ Nouveau véhicule" onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Enregistrer'}</button>
          </>}
        >
          <div className="form-group">
            <label className="form-label">Nom du véhicule</label>
            <input className="input" placeholder="ex: Bus 07 — GTI Transport" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Immatriculation</label>
            <input className="input" placeholder="ex: 1234 AB 01" value={form.plate} onChange={e => setForm(f => ({...f, plate:e.target.value}))} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="input" value={form.vehicle_type} onChange={e => setForm(f => ({...f, vehicle_type:e.target.value}))}>
                <option value="BUS">🚌 Bus</option>
                <option value="MINIBUS">🚐 Minibus</option>
                <option value="VAN">🚐 Van</option>
                <option value="SHARED">🚕 Taxi brousse</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nb de sièges</label>
              <input className="input" type="number" min="1" max="100" value={form.seat_count} onChange={e => setForm(f => ({...f, seat_count:e.target.value}))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHAUFFEURS
═══════════════════════════════════════════════════════════════ */
function DriversScreen({ company }) {
  const [drivers, setDrivers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name:'', phone:'', license_no:'', password:'' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    if (!company) return;
    voyageApi.listDrivers(company.id).then(r => setDrivers(r.data || [])).catch(() => {});
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.full_name || !form.phone || !form.password) { setErr('Nom, téléphone et mot de passe requis'); return; }
    setSaving(true); setErr('');
    try {
      await voyageApi.createDriver(company.id, form);
      setShowModal(false);
      setForm({ full_name:'', phone:'', license_no:'', password:'' });
      load();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Erreur lors de la création');
    } finally { setSaving(false); }
  };

  if (!company) return <div style={{ padding:40, textAlign:'center', color:C.muted }}>Sélectionnez une compagnie</div>;

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800 }}>👨‍✈️ Chauffeurs</h2>
          <p style={{ color:C.muted, fontSize:13, marginTop:2 }}>{drivers.length} chauffeur(s) enregistré(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Ajouter un chauffeur</button>
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Chauffeur</th>
              <th>Téléphone</th>
              <th>Permis</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map(d => (
              <tr key={d.id}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:18, background:C.orangePale, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>👤</div>
                    <div>
                      <div style={{ fontWeight:600 }}>{d.full_name}</div>
                      <div style={{ fontSize:11, color:C.muted }}>ID #{d.id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color:C.muted }}>{d.phone || '—'}</td>
                <td style={{ color:C.muted }}>{d.license_no || '—'}</td>
                <td>
                  <span className="badge" style={{ background: d.is_active ? C.greenPale : C.redPale, color: d.is_active ? C.green : C.red }}>
                    {d.is_active ? '✓ Actif' : '✕ Inactif'}
                  </span>
                </td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign:'center', padding:32, color:C.muted }}>Aucun chauffeur</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="➕ Nouveau chauffeur" onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Créer'}</button>
          </>}
        >
          {err && <div style={{ color:C.red, fontSize:13, background:C.redPale, padding:'8px 12px', borderRadius:8 }}>{err}</div>}
          <div className="form-group">
            <label className="form-label">Nom complet *</label>
            <input className="input" placeholder="Prénom Nom" value={form.full_name} onChange={e => setForm(f => ({...f, full_name:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone * (login app)</label>
            <input className="input" type="tel" placeholder="0700000000" value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">N° Permis</label>
            <input className="input" placeholder="ex: CI-2024-001234" value={form.license_no} onChange={e => setForm(f => ({...f, license_no:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe app * </label>
            <input className="input" type="password" placeholder="Mot de passe pour l'app chauffeur" value={form.password} onChange={e => setForm(f => ({...f, password:e.target.value}))} />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIGNES / ROUTES
═══════════════════════════════════════════════════════════════ */
function RoutesScreen({ company }) {
  const [routes, setRoutes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ origin:'', destination:'', base_price:'', distance_km:'', duration_min:'' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!company) return;
    voyageApi.listRoutes(company.id).then(r => setRoutes(r.data || [])).catch(() => {});
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await voyageApi.createRoute(company.id, {
        ...form,
        base_price:   Number(form.base_price),
        distance_km:  form.distance_km  ? Number(form.distance_km)  : null,
        duration_min: form.duration_min ? Number(form.duration_min) : null,
      });
      setShowModal(false);
      setForm({ origin:'', destination:'', base_price:'', distance_km:'', duration_min:'' });
      load();
    } catch {} finally { setSaving(false); }
  };

  if (!company) return <div style={{ padding:40, textAlign:'center', color:C.muted }}>Sélectionnez une compagnie</div>;

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800 }}>🗺️ Lignes de transport</h2>
          <p style={{ color:C.muted, fontSize:13, marginTop:2 }}>{routes.length} ligne(s) active(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nouvelle ligne</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16 }}>
        {routes.map(r => (
          <div key={r.id} className="card" style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontWeight:800, fontSize:16 }}>{r.origin}</div>
                <div style={{ color:C.orange, fontSize:18 }}>↓</div>
                <div style={{ fontWeight:800, fontSize:16 }}>{r.destination}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:20, fontWeight:800, color:C.orange }}>{fmt(r.base_price)}</div>
                <div style={{ fontSize:11, color:C.muted }}>tarif de base</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {r.distance_km && (
                <span className="badge" style={{ background:C.bluePale, color:C.blue }}>📍 {r.distance_km} km</span>
              )}
              {r.duration_min && (
                <span className="badge" style={{ background:C.purplePale, color:C.purple }}>⏱ {Math.floor(r.duration_min/60)}h{r.duration_min%60 > 0 ? r.duration_min%60+'min' : ''}</span>
              )}
            </div>
          </div>
        ))}
        {routes.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40, color:C.muted }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🗺️</div>
            <p>Aucune ligne. Créez votre premier trajet !</p>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="➕ Nouvelle ligne" onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Créer'}</button>
          </>}
        >
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label className="form-label">Ville de départ *</label>
              <input className="input" placeholder="ex: Abidjan" value={form.origin} onChange={e => setForm(f => ({...f, origin:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Ville d'arrivée *</label>
              <input className="input" placeholder="ex: Aboisso" value={form.destination} onChange={e => setForm(f => ({...f, destination:e.target.value}))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Prix de base (FCFA) *</label>
            <input className="input" type="number" placeholder="ex: 2000" value={form.base_price} onChange={e => setForm(f => ({...f, base_price:e.target.value}))} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label className="form-label">Distance (km)</label>
              <input className="input" type="number" placeholder="ex: 90" value={form.distance_km} onChange={e => setForm(f => ({...f, distance_km:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Durée (minutes)</label>
              <input className="input" type="number" placeholder="ex: 120" value={form.duration_min} onChange={e => setForm(f => ({...f, duration_min:e.target.value}))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VOYAGES PROGRAMMÉS
═══════════════════════════════════════════════════════════════ */
function TripsScreen({ company }) {
  const [trips, setTrips]     = useState([]);
  const [routes, setRoutes]   = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ route_id:'', vehicle_id:'', driver_id:'', departure_at:'', price:'' });
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  const load = useCallback(() => {
    if (!company) return;
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      voyageApi.searchTrips('', '', today).catch(() => ({ data: [] })),
      voyageApi.listRoutes(company.id).catch(()  => ({ data: [] })),
      voyageApi.listVehicles(company.id).catch(() => ({ data: [] })),
      voyageApi.listDrivers(company.id).catch(()  => ({ data: [] })),
    ]).then(([tr, ro, ve, dr]) => {
      setTrips(tr.data || []);
      setRoutes(ro.data || []);
      setVehicles(ve.data || []);
      setDrivers(dr.data || []);
    });
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.route_id || !form.vehicle_id || !form.departure_at || !form.price) {
      setErr('Ligne, véhicule, départ et prix requis'); return;
    }
    setSaving(true); setErr('');
    try {
      await voyageApi.createTrip({
        route_id:     Number(form.route_id),
        vehicle_id:   Number(form.vehicle_id),
        driver_id:    form.driver_id ? Number(form.driver_id) : null,
        departure_at: form.departure_at,
        price:        Number(form.price),
      });
      setShowModal(false);
      setForm({ route_id:'', vehicle_id:'', driver_id:'', departure_at:'', price:'' });
      load();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Erreur');
    } finally { setSaving(false); }
  };

  const handleStatus = async (tripId, status) => {
    await voyageApi.updateTripStatus(tripId, status).catch(() => {});
    load();
  };

  if (!company) return <div style={{ padding:40, textAlign:'center', color:C.muted }}>Sélectionnez une compagnie</div>;

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800 }}>📅 Voyages programmés</h2>
          <p style={{ color:C.muted, fontSize:13, marginTop:2 }}>Aujourd'hui — {trips.length} voyage(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Programmer un voyage</button>
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Trajet</th>
              <th>Départ</th>
              <th>Véhicule</th>
              <th>Remplissage</th>
              <th>Prix</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {trips.map(t => {
              const st = TRIP_STATUS[t.status] || TRIP_STATUS.SCHEDULED;
              const fill = t.seats_total > 0 ? Math.round((t.seats_booked / t.seats_total) * 100) : 0;
              return (
                <tr key={t.id}>
                  <td><strong>{t.origin}</strong> → <strong>{t.destination}</strong></td>
                  <td style={{ color:C.muted, fontSize:12 }}>{fmtDateTime(t.departure_at)}</td>
                  <td style={{ color:C.muted }}>{t.vehicle_type || '—'}</td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1, height:6, background:C.border, borderRadius:3 }}>
                        <div style={{ width:`${fill}%`, height:'100%', borderRadius:3, background: fill>80 ? C.red : fill>50 ? C.orange : C.green }} />
                      </div>
                      <span style={{ fontSize:11, color:C.muted, whiteSpace:'nowrap' }}>{t.seats_booked}/{t.seats_total}</span>
                    </div>
                  </td>
                  <td style={{ color:C.orange, fontWeight:700 }}>{fmt(t.price)}</td>
                  <td><span className="badge" style={{ background:st.bg, color:st.c }}>{st.label}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:4 }}>
                      {t.status === 'SCHEDULED' && (
                        <button className="btn btn-sm" style={{ background:C.greenPale, color:C.green, border:`1px solid ${C.green}44` }}
                          onClick={() => handleStatus(t.id, 'BOARDING')}>Embarquement</button>
                      )}
                      {t.status === 'BOARDING' && (
                        <button className="btn btn-sm" style={{ background:C.orangePale, color:C.orange, border:`1px solid ${C.orangeBorder}` }}
                          onClick={() => handleStatus(t.id, 'IN_PROGRESS')}>Démarrer</button>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <button className="btn btn-sm" style={{ background:C.tealPale, color:C.teal, border:`1px solid ${C.teal}44` }}
                          onClick={() => handleStatus(t.id, 'COMPLETED')}>Terminer</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {trips.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:C.muted }}>Aucun voyage aujourd'hui</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="➕ Programmer un voyage" onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Programmer'}</button>
          </>}
        >
          {err && <div style={{ color:C.red, fontSize:13, background:C.redPale, padding:'8px 12px', borderRadius:8 }}>{err}</div>}
          <div className="form-group">
            <label className="form-label">Ligne *</label>
            <select className="input" value={form.route_id} onChange={e => setForm(f => ({...f, route_id:e.target.value}))}>
              <option value="">— Choisir une ligne —</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Véhicule *</label>
            <select className="input" value={form.vehicle_id} onChange={e => setForm(f => ({...f, vehicle_id:e.target.value}))}>
              <option value="">— Choisir un véhicule —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.seat_count} places)</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Chauffeur</label>
            <select className="input" value={form.driver_id} onChange={e => setForm(f => ({...f, driver_id:e.target.value}))}>
              <option value="">— Aucun chauffeur assigné —</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date et heure de départ *</label>
            <input className="input" type="datetime-local" value={form.departure_at} onChange={e => setForm(f => ({...f, departure_at:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Prix (FCFA) *</label>
            <input className="input" type="number" placeholder="ex: 2500" value={form.price} onChange={e => setForm(f => ({...f, price:e.target.value}))} />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPAGNIES (Super Admin)
═══════════════════════════════════════════════════════════════ */
function CompaniesScreen({ onSelectCompany, selectedCompany }) {
  const [companies, setCompanies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', address:'', latitude:'', longitude:'' });
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const load = () => {
    voyageApi.listCompanies().then(r => setCompanies(r.data || [])).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const detectGPS = () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({...f, latitude:pos.coords.latitude.toFixed(6), longitude:pos.coords.longitude.toFixed(6)})); setDetecting(false); },
      () => setDetecting(false)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.latitude)  payload.latitude  = parseFloat(payload.latitude);
      else delete payload.latitude;
      if (payload.longitude) payload.longitude = parseFloat(payload.longitude);
      else delete payload.longitude;
      await voyageApi.createCompany(payload);
      setShowModal(false);
      setForm({ name:'', phone:'', address:'', latitude:'', longitude:'' });
      load();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800 }}>🏢 Compagnies de transport</h2>
          <p style={{ color:C.muted, fontSize:13, marginTop:2 }}>{companies.length} compagnie(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nouvelle compagnie</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
        {companies.map(c => (
          <div key={c.id} className="card" onClick={() => onSelectCompany(c)}
            style={{ cursor:'pointer', borderColor: selectedCompany?.id === c.id ? C.orange : C.border, transition:'all .2s' }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:48, height:48, borderRadius:12, background:C.orangePale, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🚌</div>
              <div>
                <div style={{ fontWeight:800, fontSize:15 }}>{c.name}</div>
                <div style={{ fontSize:11, color:C.muted }}>ID #{c.id}</div>
              </div>
              {selectedCompany?.id === c.id && (
                <span className="badge" style={{ marginLeft:'auto', background:C.orangePale, color:C.orange }}>✓ Sélectionné</span>
              )}
            </div>
            {c.phone && <div style={{ fontSize:12, color:C.muted }}>📞 {c.phone}</div>}
            {c.address && <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>📍 {c.address}</div>}
            {c.latitude && c.longitude && (
              <div style={{ fontSize:11, color:C.teal, marginTop:4, fontWeight:600 }}>
                🛰️ {Number(c.latitude).toFixed(4)}, {Number(c.longitude).toFixed(4)}
              </div>
            )}
          </div>
        ))}
        {companies.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40, color:C.muted }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🏢</div>
            <p>Aucune compagnie. Créez-en une pour commencer !</p>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="➕ Nouvelle compagnie" onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Créer'}</button>
          </>}
        >
          <div className="form-group">
            <label className="form-label">Nom de la compagnie *</label>
            <input className="input" placeholder="ex: GTI Transport" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone</label>
            <input className="input" type="tel" placeholder="ex: 0700000000" value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Adresse / Gare</label>
            <input className="input" placeholder="ex: Gare de Bassam, Abidjan" value={form.address} onChange={e => setForm(f => ({...f, address:e.target.value}))} />
          </div>
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, marginTop:4 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
              📍 GPS <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>(optionnel — position de la gare)</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'end' }}>
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input className="input" placeholder="5.3196" value={form.latitude} onChange={e => setForm(f => ({...f, latitude:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input className="input" placeholder="-4.0195" value={form.longitude} onChange={e => setForm(f => ({...f, longitude:e.target.value}))} />
              </div>
              <button type="button" className="btn btn-ghost" onClick={detectGPS} disabled={detecting} style={{ height:42 }}>
                {detecting ? '...' : '📡 Détecter'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FINANCE IA SCREEN
═══════════════════════════════════════════════════════════════ */
function FinanceIAScreen({ company }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!company?.id) return;
    financeApi.getCompanyDashboard(company.id)
      .then(r => setData(r.data))
      .catch(() => setError('Impossible de charger le tableau de bord financier.'))
      .finally(() => setLoading(false));
  }, [company?.id]);

  const fmt = n => new Intl.NumberFormat('fr-FR').format(n) + ' F';

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:60}}><Spinner/></div>;
  if (error) return <div style={{color:'#ef4444',padding:24,textAlign:'center'}}>{error}</div>;
  if (!data) return null;

  const { score, score_label, score_color, score_breakdown, ratios, loan_offers, recommendations } = data;

  // SVG gauge semi-circulaire
  const r=70, cx=90, cy=90;
  const angle = (score/100)*180;
  const toRad = d => d*Math.PI/180;
  const arcX = cx + r*Math.cos(toRad(180-angle));
  const arcY = cy - r*Math.sin(toRad(180-angle));
  const bgArc = `M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`;
  const fgArc = score > 0 ? `M ${cx-r} ${cy} A ${r} ${r} 0 ${angle>180?1:0} 1 ${arcX} ${arcY}` : '';

  const breakdown = [
    { label:'Stabilité revenus', max:20, val:score_breakdown.stability },
    { label:'Taux remplissage',  max:25, val:score_breakdown.load_factor },
    { label:'Croissance',        max:20, val:score_breakdown.growth },
    { label:'Fiabilité',         max:20, val:score_breakdown.reliability },
    { label:'Diversité routes',  max:15, val:score_breakdown.diversity },
  ];

  const revs = [ratios.revenue_m2, ratios.revenue_m1, ratios.revenue_m0];
  const maxRev = Math.max(...revs, 1);

  return (
    <div style={{ padding:24, maxWidth:960, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <div style={{ fontSize:28 }}>🏦</div>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:C.navy }}>Finance IA — {company?.name}</div>
          <div style={{ fontSize:12, color:C.muted }}>Analyse des 90 derniers jours · Score bancaire SOKORA Voyage</div>
        </div>
        {!data.has_sufficient_data && (
          <div style={{ marginLeft:'auto', background:'#fef9c3', border:'1px solid #fde047', borderRadius:8, padding:'6px 12px', fontSize:12, color:'#854d0e', fontWeight:600 }}>
            ⚠ Données insuffisantes
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Jauge */}
        <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, padding:24, display:'flex', flexDirection:'column', alignItems:'center' }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Score bancaire transport</div>
          <svg width={180} height={100} viewBox="0 0 180 100">
            <path d={bgArc} fill="none" stroke={C.border} strokeWidth={14} strokeLinecap="round"/>
            {fgArc && <path d={fgArc} fill="none" stroke={score_color} strokeWidth={14} strokeLinecap="round"/>}
            <text x={cx} y={cy-8} textAnchor="middle" fontSize={32} fontWeight={800} fill={score_color}>{score}</text>
            <text x={cx} y={cy+8} textAnchor="middle" fontSize={13} fontWeight={700} fill={C.navy}>{score_label}</text>
          </svg>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, width:'100%', marginTop:8 }}>
            {breakdown.map(b => (
              <div key={b.label} style={{ fontSize:10, color:C.muted }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                  <span>{b.label}</span><span style={{ fontWeight:700, color:C.navy }}>{b.val}/{b.max}</span>
                </div>
                <div style={{ height:4, borderRadius:2, background:C.border, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(b.val/b.max)*100}%`, background:score_color }}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, alignContent:'start' }}>
          {[
            { label:'CA ce mois',         val:fmt(ratios.revenue_m0),         icon:'📈', color:C.teal },
            { label:'Taux remplissage',    val:`${ratios.load_factor}%`,       icon:'🚌', color: ratios.load_factor>=70?'#22c55e':ratios.load_factor>=50?C.orange:'#ef4444' },
            { label:'RevPAS',             val:fmt(ratios.revpas),             icon:'💺', color:C.navy },
            { label:'Croissance MoM',     val:(ratios.mom_growth>=0?'+':'')+ratios.mom_growth+'%', icon:'🚀', color: ratios.mom_growth>=0?'#22c55e':'#ef4444' },
            { label:'Routes actives',     val:ratios.total_routes,            icon:'🗺️', color:'#8b5cf6' },
            { label:'Véhicules actifs',   val:ratios.total_vehicles,          icon:'🚐', color:C.orange },
          ].map(k => (
            <div key={k.label} style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, padding:'12px 14px' }}>
              <div style={{ fontSize:18, marginBottom:2 }}>{k.icon}</div>
              <div style={{ fontSize:15, fontWeight:800, color:k.color }}>{k.val}</div>
              <div style={{ fontSize:10, color:C.muted, fontWeight:600 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenus 3 mois + métriques transport + revenus par route */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Barres revenus */}
        <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:16 }}>Revenus mensuels</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:12, height:100 }}>
            {revs.map((rv,i) => {
              const h = maxRev>0 ? Math.max(4, Math.round((rv/maxRev)*90)) : 4;
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ fontSize:9, color:C.muted, fontWeight:600 }}>{rv>0?fmt(rv):'–'}</div>
                  <div style={{ width:'100%', height:h, borderRadius:'4px 4px 0 0', background:i===2?C.teal:C.border }}/>
                  <div style={{ fontSize:10, color:C.muted }}>{['M-2','M-1','Ce mois'][i]}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Métriques transport */}
        <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:16 }}>Indicateurs transport</div>
          {[
            { label:'Annulations passagers', val:`${ratios.cancel_rate}%`,       color: ratios.cancel_rate>15?'#ef4444':C.muted },
            { label:'Voyages annulés',       val:`${ratios.trip_cancel_rate}%`,  color: ratios.trip_cancel_rate>10?'#ef4444':C.muted },
            { label:'Sièges offerts (90j)',  val:ratios.total_seats_offered,     color:C.navy },
            { label:'Réservations',          val:ratios.total_bookings,          color:C.teal },
            { label:'Voyages opérés',        val:ratios.total_trips,             color:C.navy },
          ].map(m => (
            <div key={m.label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
              <span style={{ color:C.muted }}>{m.label}</span>
              <span style={{ fontWeight:700, color:m.color }}>{m.val}</span>
            </div>
          ))}
        </div>

        {/* Revenus par route */}
        <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:16 }}>Revenus par route</div>
          {Object.keys(ratios.route_revenue || {}).length === 0
            ? <div style={{ fontSize:12, color:C.muted, textAlign:'center', marginTop:20 }}>Aucune donnée</div>
            : (() => {
                const maxR = Math.max(...Object.values(ratios.route_revenue), 1);
                const colors = ['#14b8a6','#6366f1','#f59e0b','#22c55e','#ec4899'];
                return Object.entries(ratios.route_revenue).map(([route, rev], i) => (
                  <div key={route} style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:2 }}>
                      <span style={{ color:C.navy, fontWeight:600, fontSize:10 }}>{route}</span>
                      <span style={{ color:C.muted }}>{fmt(rev)}</span>
                    </div>
                    <div style={{ height:5, borderRadius:3, background:C.border, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.round(rev/maxR*100)}%`, background:colors[i%colors.length] }}/>
                    </div>
                  </div>
                ));
              })()
          }
        </div>
      </div>

      {/* Offres de prêt */}
      <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, padding:20, marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:16 }}>💰 Offres de financement SOKORA Voyage</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {loan_offers.map(offer => (
            <div key={offer.type} style={{ borderRadius:12, border:`2px solid ${offer.eligible?C.teal:C.border}`, padding:16,
              background:offer.eligible?'#f0fdfa':'#fafafa', opacity:offer.eligible?1:0.75 }}>
              <div style={{ fontSize:22, marginBottom:6 }}>{offer.icon}</div>
              <div style={{ fontSize:14, fontWeight:800, color:C.navy, marginBottom:2 }}>{offer.label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:offer.eligible?C.teal:C.muted, marginBottom:4 }}>{fmt(offer.amount)}</div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>{offer.rate} · {offer.duration}</div>
              <div style={{ fontSize:11, color:offer.eligible?'#0d9488':C.muted, fontWeight:600, marginTop:6 }}>
                {offer.eligible?'✅ ':'🔒 '}{offer.reason}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommandations */}
      <div style={{ background:'#fff', borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:12 }}>🤖 Recommandations IA</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {recommendations.map((rec,i) => (
            <div key={i} style={{ background:'#f8fafc', borderRadius:8, padding:'10px 14px', fontSize:13, color:C.navy, borderLeft:`3px solid ${C.teal}` }}>
              {rec}
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:C.muted, marginTop:12, fontStyle:'italic' }}>
          * Offres indicatives. Contactez SOKORA Finance pour une demande officielle.
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   APP PRINCIPALE
═══════════════════════════════════════════════════════════════ */
const NAV = [
  { id: 'dashboard',  icon: '📊', label: 'Dashboard'  },
  { id: 'companies',  icon: '🏢', label: 'Compagnies' },
  { id: 'trips',      icon: '📅', label: 'Voyages'    },
  { id: 'vehicles',   icon: '🚌', label: 'Véhicules'  },
  { id: 'drivers',    icon: '👨‍✈️', label: 'Chauffeurs' },
  { id: 'routes',     icon: '🗺️', label: 'Lignes'     },
  { id: 'finance',    icon: '🏦', label: 'Finance IA' },
];

export default function App() {
  const [user, setUser]             = useState(() => {
    try { return JSON.parse(localStorage.getItem('voyage_user')); } catch { return null; }
  });
  const [screen, setScreen]         = useState('dashboard');
  const [company, setCompany]       = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Inject global CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('voyage_token');
    localStorage.removeItem('voyage_user');
    setUser(null);
  };

  if (!user) return <LoginScreen onLogin={u => setUser(u)} />;

  const renderScreen = () => {
    switch(screen) {
      case 'dashboard':  return <DashboardScreen company={company} />;
      case 'companies':  return <CompaniesScreen onSelectCompany={c => { setCompany(c); setScreen('dashboard'); }} selectedCompany={company} />;
      case 'trips':      return <TripsScreen company={company} />;
      case 'vehicles':   return <VehiclesScreen company={company} />;
      case 'drivers':    return <DriversScreen company={company} />;
      case 'routes':     return <RoutesScreen company={company} />;
      case 'finance':    return <FinanceIAScreen company={company} />;
      default:           return <DashboardScreen company={company} />;
    }
  };

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:C.black }}>
      {/* ── SIDEBAR ── */}
      <div style={{
        width: sidebarOpen ? 220 : 64, flexShrink:0,
        background: C.blackMid, borderRight:`1px solid ${C.border}`,
        display:'flex', flexDirection:'column',
        transition:'width .3s', overflow:'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding:'20px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10, minHeight:64 }}>
          <span style={{ fontSize:24, flexShrink:0 }}>🚌</span>
          {sidebarOpen && (
            <div>
              <div style={{ fontWeight:800, color:C.orange, fontSize:15, lineHeight:1.2 }}>SOKORA</div>
              <div style={{ fontSize:10, color:C.muted }}>Voyage</div>
            </div>
          )}
        </div>

        {/* Company selector */}
        {sidebarOpen && company && (
          <div style={{ margin:'12px', padding:'10px 12px', background:C.orangePale, borderRadius:8, border:`1px solid ${C.orangeBorder}` }}>
            <div style={{ fontSize:10, color:C.orange, fontWeight:700, textTransform:'uppercase' }}>Compagnie active</div>
            <div style={{ fontSize:13, fontWeight:700, marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{company.name}</div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex:1, padding:'8px', display:'flex', flexDirection:'column', gap:2 }}>
          {NAV.map(item => (
            <button key={item.id}
              onClick={() => setScreen(item.id)}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding: sidebarOpen ? '10px 12px' : '10px',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                borderRadius:8, border:'none', cursor:'pointer', width:'100%',
                background: screen === item.id ? C.orangePale : 'transparent',
                color: screen === item.id ? C.orange : C.muted,
                fontWeight: screen === item.id ? 700 : 500,
                fontSize:13, transition:'all .2s',
              }}
            >
              <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
              {sidebarOpen && <span style={{ whiteSpace:'nowrap' }}>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User + logout */}
        <div style={{ padding:'12px', borderTop:`1px solid ${C.border}` }}>
          {sidebarOpen && (
            <div style={{ fontSize:12, color:C.muted, marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              👤 {user.full_name || user.phone_number}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ width:'100%', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
            <span>🚪</span>{sidebarOpen && ' Déconnexion'}
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Top bar */}
        <div style={{ height:64, background:C.blackMid, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', padding:'0 24px', gap:16, flexShrink:0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <h1 style={{ fontSize:16, fontWeight:700, flex:1 }}>
            {NAV.find(n => n.id === screen)?.icon} {NAV.find(n => n.id === screen)?.label}
          </h1>
          {!company && screen !== 'companies' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setScreen('companies')}>
              ⚠️ Sélectionner une compagnie
            </button>
          )}
          <div style={{ fontSize:12, color:C.muted }}>
            {new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' })}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflow:'auto', padding:24 }}>
          {renderScreen()}
        </div>
      </div>
    </div>
  );
}
