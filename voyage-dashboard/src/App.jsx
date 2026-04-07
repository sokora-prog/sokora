import { useState, useEffect, useCallback, useRef } from 'react';
import { authApi, voyageApi, financeApi, loyaltyApi } from './services/api';

/* ═══════════════════════════════════════════════════════════════
   CHARTE GRAPHIQUE SOKORA — PALETTE UNIFIÉE
═══════════════════════════════════════════════════════════════ */
const C = {
  bg:           '#0f1e35',   // SOKORA navy officiel
  surface:      '#0b1829',   // SOKORA sidebar shade
  card:         '#1a2e4a',   // SOKORA navyMid
  cardHov:      '#243a5e',   // SOKORA navyLight
  border:       '#1e3557',   // bordure subtile entre navyMid et navyLight
  borderLight:  '#243a5e',   // SOKORA navyLight
  orange:       '#FF6B35',
  orangeHov:    '#FF8C5A',
  orangePale:   '#FF6B3512',
  orangeBorder: '#FF6B3540',
  teal:         '#00D4AA',
  tealPale:     '#00D4AA12',
  tealBorder:   '#00D4AA40',
  white:        '#FFFFFF',
  whiteOff:     '#E8EDF5',
  muted:        '#6B7A99',
  mutedLight:   '#8A9BC0',
  green:        '#2ECC71',
  greenPale:    '#2ECC7112',
  red:          '#E74C3C',
  redPale:      '#E74C3C12',
  purple:       '#9B59B6',
  purplePale:   '#9B59B612',
  gold:         '#F59E0B',
  goldPale:     '#F59E0B12',
};

const TRIP_STATUS = {
  SCHEDULED:   { label: 'Programmé',    c: C.mutedLight, bg: C.card,       dot: C.muted },
  BOARDING:    { label: 'Embarquement', c: C.teal,       bg: C.tealPale,   dot: C.teal },
  IN_PROGRESS: { label: 'En cours',     c: C.orange,     bg: C.orangePale, dot: C.orange },
  COMPLETED:   { label: 'Terminé',      c: C.green,      bg: C.greenPale,  dot: C.green },
  CANCELLED:   { label: 'Annulé',       c: C.red,        bg: C.redPale,    dot: C.red },
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
   GLOBAL CSS — SOKORA VOYAGE DASHBOARD
═══════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0f1e35; color: #E8EDF5; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13.5px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: #0b1829; }
::-webkit-scrollbar-thumb { background: #1e3557; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #FF6B35; }
button { cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; }
input, select, textarea { font-family: 'Plus Jakarta Sans', sans-serif; background: #0b1829; color: #fff; border: 1.5px solid #1e3557; border-radius: 10px; padding: 10px 14px; font-size: 13px; outline: none; width: 100%; transition: border-color .2s, box-shadow .2s; }
input:focus, select:focus, textarea:focus { border-color: #FF6B35; box-shadow: 0 0 0 3px rgba(255,107,53,.1); }
input::placeholder { color: #6B7A99; }
select option { background: #1a2e4a; }
label { font-size: 11px; font-weight: 700; color: #8A9BC0; letter-spacing: .7px; text-transform: uppercase; display: block; margin-bottom: 7px; }

/* APP LAYOUT */
.app { display: flex; min-height: 100vh; background: #0f1e35; }
.sb { width: 240px; min-height: 100vh; background: #0b1829; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; z-index: 100; border-right: 1px solid #1e3557; }
.sb-logo { padding: 22px 20px 18px; border-bottom: 1px solid rgba(255,255,255,.05); }
.sb-sect { padding: 18px 20px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,.2); font-weight: 700; }
.sb-nav { padding: 0 10px; flex: 1; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.ni { display: flex; align-items: center; gap: 11px; padding: 10px 13px; border-radius: 10px; cursor: pointer; font-size: 13px; color: rgba(255,255,255,.4); font-weight: 500; transition: all .18s; border: none; background: none; width: 100%; text-align: left; }
.ni:hover { background: rgba(255,255,255,.05); color: rgba(255,255,255,.75); }
.ni.on { background: linear-gradient(135deg, #FF6B35 0%, #E8501A 100%); color: #fff; font-weight: 700; box-shadow: 0 4px 16px rgba(255,107,53,.35); }
.sb-foot { margin: 10px 10px 16px; background: rgba(255,255,255,.03); border: 1px solid #1e3557; border-radius: 12px; padding: 14px 16px; }

/* MAIN */
.main { margin-left: 240px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
.topbar { height: 60px; padding: 0 28px; background: #0f1e35; border-bottom: 1px solid #1e3557; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
.tb-title { font-weight: 800; font-size: 16px; color: #FFFFFF; letter-spacing: -.3px; }
.content { padding: 24px 28px; flex: 1; animation: fadeIn .25s ease; }

/* KPI */
.kgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; margin-bottom: 22px; }
.kcard { background: #1a2e4a; border-radius: 16px; padding: 20px; border: 1px solid #1e3557; position: relative; overflow: hidden; transition: transform .18s, box-shadow .18s; }
.kcard:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,.3); border-color: #243a5e; }
.kstripe { position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 16px 16px 0 0; }
.kicon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 14px; }
.klabel { font-size: 10px; color: #6B7A99; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; }
.kval { font-size: 22px; font-weight: 800; margin-top: 4px; line-height: 1.1; letter-spacing: -.5px; color: #fff; }
.ksub { font-size: 11px; color: #6B7A99; margin-top: 4px; }

/* CARDS */
.card { background: #1a2e4a; border-radius: 16px; border: 1px solid #1e3557; overflow: hidden; margin-bottom: 20px; }
.card-body { padding: 20px 22px; }

/* TABLE */
.dt { width: 100%; border-collapse: collapse; font-size: 13px; }
.dt th { text-align: left; padding: 11px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6B7A99; border-bottom: 1px solid #1e3557; font-weight: 700; background: #0b1829; }
.dt td { padding: 12px 16px; border-bottom: 1px solid rgba(30,53,87,.6); vertical-align: middle; color: #E8EDF5; }
.dt tr:last-child td { border-bottom: none; }
.dt tr:hover td { background: #243a5e; }

/* legacy table class — kept for backwards compat */
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; padding: 11px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6B7A99; border-bottom: 1px solid #1e3557; font-weight: 700; background: #0b1829; }
.table td { padding: 12px 16px; border-bottom: 1px solid rgba(30,53,87,.6); vertical-align: middle; color: #E8EDF5; }
.table tr:last-child td { border-bottom: none; }
.table tr:hover td { background: #243a5e; }

/* BUTTONS */
.btn { padding: 8px 16px; border-radius: 9px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans',sans-serif; display: inline-flex; align-items: center; gap: 6px; transition: all .18s; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary { background: linear-gradient(135deg, #FF6B35, #E8501A); color: #fff; box-shadow: 0 3px 10px rgba(255,107,53,.35); }
.btn-primary:hover:not(:disabled) { box-shadow: 0 5px 16px rgba(255,107,53,.5); transform: translateY(-1px); }
.btn-ghost { background: transparent; color: #8A9BC0; border: 1.5px solid #1e3557; }
.btn-ghost:hover:not(:disabled) { border-color: #FF6B35; color: #FF6B35; }
.btn-teal { background: linear-gradient(135deg, #00D4AA, #00B090); color: #fff; box-shadow: 0 3px 10px rgba(0,212,170,.3); }
.btn-danger { background: rgba(231,76,60,.1); color: #E74C3C; border: 1px solid rgba(231,76,60,.3); }
.btn-danger:hover:not(:disabled) { background: #E74C3C; color: #fff; }
.btn-sm { padding: 5px 11px; font-size: 12px; }

/* TABS */
.tabs { display: flex; gap: 5px; margin-bottom: 18px; flex-wrap: wrap; }
.tab { padding: 6px 14px; border-radius: 8px; font-size: 12.5px; cursor: pointer; border: 1.5px solid #1e3557; background: transparent; color: #6B7A99; font-weight: 500; transition: all .18s; font-family: 'Plus Jakarta Sans',sans-serif; }
.tab:hover { border-color: rgba(255,107,53,.4); color: #FF6B35; }
.tab.on, .tab.active { background: #FF6B35; color: #fff; border-color: #FF6B35; font-weight: 700; box-shadow: 0 3px 10px rgba(255,107,53,.3); }

/* BADGE */
.badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }

/* MODALS */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.75); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; backdrop-filter: blur(4px); }
.modal { background: #1a2e4a; border: 1.5px solid rgba(255,107,53,.25); border-radius: 20px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,.6); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #1e3557; }
.modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.modal-footer { padding: 16px 24px; border-top: 1px solid #1e3557; display: flex; gap: 10px; justify-content: flex-end; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 11px; font-weight: 700; color: #8A9BC0; letter-spacing: .7px; text-transform: uppercase; display: block; margin-bottom: 7px; }

/* INPUT legacy */
.input { width: 100%; padding: 10px 14px; background: #0b1829; border: 1.5px solid #1e3557; border-radius: 10px; color: #fff; font-size: 13px; outline: none; transition: border-color .2s, box-shadow .2s; font-family: 'Plus Jakarta Sans', sans-serif; }
.input:focus { border-color: #FF6B35; box-shadow: 0 0 0 3px rgba(255,107,53,.1); }
.input::placeholder { color: #6B7A99; }
select.input option { background: #1a2e4a; }

/* LOGIN */
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 20% 50%, #0F1E3A 0%, #0f1e35 60%); }
.login-card { background: #0b1829; border: 1px solid #1e3557; border-radius: 22px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 32px 80px rgba(0,0,0,.6); }

/* MISC */
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
.empty { text-align: center; padding: 48px; color: #6B7A99; font-size: 13.5px; }
.sec-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.sec-title { font-weight: 800; font-size: 15px; color: #fff; display: flex; align-items: center; gap: 8px; letter-spacing: -.2px; }

/* ANIMATIONS */
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
.spin { animation: spin .8s linear infinite; }
.fade-in { animation: fadeIn .25s ease forwards; }
`;

/* ═══════════════════════════════════════════════════════════════
   SPINNER
═══════════════════════════════════════════════════════════════ */
function Spinner() {
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.orange }} className="spin" />
  );
}

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
      // Bug #4 : persister company_id dès le login si présent dans la réponse
      if (data.user?.company_id) {
        localStorage.setItem('voyage_company_id', data.user.company_id);
      }
      onLogin(data.user);
    } catch {
      setErr('Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 16, background: C.orange, marginBottom: 12, fontSize: 32 }}>🚌</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.white, letterSpacing: -1 }}>
            S<span style={{ color: C.orange }}>O</span>KORA
          </div>
          <div style={{ fontSize: 11, color: C.orange, marginTop: 4, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>VOYAGES &amp; TRANSPORT</div>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            {err && <div style={{ color: C.red, fontSize: 13, textAlign: 'center', background: C.redPale, padding: '8px 12px', borderRadius: 8 }}>{err}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: 12 }}>
              {loading ? <Spinner /> : '🚀 Connexion'}
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
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: (color || C.orange) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || C.orange }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>}
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
          <span style={{ fontWeight: 700, fontSize: 16, color: C.white }}>{title}</span>
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
      const allTrips = t.data || [];
      // Filtre côté client par company_id si disponible
      const filtered = company.id ? allTrips.filter(tr => !tr.company_id || tr.company_id === company.id) : allTrips;
      setTrips(filtered.slice(0, 10));
      setLoading(false);
    });
  }, [company]);

  if (!company) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
      <p>Sélectionnez ou créez une compagnie pour commencer</p>
    </div>
  );

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}><Spinner /></div>;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, color: C.white }}>{company.name}</h2>
        <p style={{ color: C.muted, fontSize: 13 }}>Vue d'ensemble — Aujourd'hui</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <KpiCard icon="🚌" label="Véhicules actifs"   value={stats?.nb_vehicles      ?? 0} color={C.teal} />
        <KpiCard icon="👨‍✈️" label="Chauffeurs actifs"  value={stats?.nb_drivers       ?? 0} color={C.purple} />
        <KpiCard icon="📅" label="Voyages aujourd'hui" value={stats?.nb_trips_today   ?? 0} color={C.orange} />
        <KpiCard icon="🎫" label="Réservations / jour" value={stats?.nb_bookings_today ?? 0} color={C.teal} />
        <KpiCard icon="💰" label="CA aujourd'hui"      value={fmt(stats?.ca_today ?? 0)} color={C.green} sub="Wallet SOKORA" />
      </div>

      {/* Derniers voyages */}
      {trips.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: C.white }}>🗓️ Prochains voyages</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
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
                      <td style={{ color: C.muted }}>{fmtDateTime(t.departure_at)}</td>
                      <td>
                        <span style={{ color: t.seats_left < 5 ? C.red : C.green }}>
                          {t.seats_left}/{t.seats_total}
                        </span>
                      </td>
                      <td style={{ color: C.orange, fontWeight: 700 }}>{fmt(t.price)}</td>
                      <td>
                        <span className="badge" style={{ background: st.bg, color: st.c }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot, marginRight: 5, display: 'inline-block' }} />
                          {st.label}
                        </span>
                      </td>
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
  const [form, setForm] = useState({ name: '', plate: '', vehicle_type: 'BUS', seat_count: 30 });
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
      setForm({ name: '', plate: '', vehicle_type: 'BUS', seat_count: 30 });
      load();
    } catch {} finally { setSaving(false); }
  };

  if (!company) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Sélectionnez une compagnie</div>;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.white }}>🚌 Flotte de véhicules</h2>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{vehicles.length} véhicule(s) enregistré(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Ajouter un véhicule</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {vehicles.map(v => (
          <div key={v.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 32 }}>{v.vehicle_type === 'BUS' ? '🚌' : v.vehicle_type === 'MINIBUS' ? '🚐' : '🚕'}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.white }}>{v.name}</div>
                <div style={{ color: C.muted, fontSize: 12 }}>{VEHICLE_TYPE[v.vehicle_type] || v.vehicle_type}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: C.surface, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase' }}>Plaque</div>
                <div style={{ fontWeight: 600, marginTop: 2, color: C.whiteOff }}>{v.plate || '—'}</div>
              </div>
              <div style={{ flex: 1, background: C.surface, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase' }}>Sièges</div>
                <div style={{ fontWeight: 600, color: C.orange, marginTop: 2 }}>{v.seat_count}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: v.is_active ? C.green : C.red }} />
              <span style={{ fontSize: 12, color: v.is_active ? C.green : C.red }}>{v.is_active ? 'Actif' : 'Inactif'}</span>
            </div>
          </div>
        ))}
        {vehicles.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚌</div>
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
            <input className="input" placeholder="ex: Bus 07 — GTI Transport" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Immatriculation</label>
            <input className="input" placeholder="ex: 1234 AB 01" value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="input" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                <option value="BUS">🚌 Bus</option>
                <option value="MINIBUS">🚐 Minibus</option>
                <option value="VAN">🚐 Van</option>
                <option value="SHARED">🚕 Taxi brousse</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nb de sièges</label>
              <input className="input" type="number" min="1" max="100" value={form.seat_count} onChange={e => setForm(f => ({ ...f, seat_count: e.target.value }))} />
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
  const [form, setForm] = useState({ full_name: '', phone: '', license_no: '', password: '' });
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
      setForm({ full_name: '', phone: '', license_no: '', password: '' });
      load();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Erreur lors de la création');
    } finally { setSaving(false); }
  };

  if (!company) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Sélectionnez une compagnie</div>;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.white }}>👨‍✈️ Chauffeurs</h2>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{drivers.length} chauffeur(s) enregistré(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Ajouter un chauffeur</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: C.orangePale, border: `1px solid ${C.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>
                    <div>
                      <div style={{ fontWeight: 600, color: C.whiteOff }}>{d.full_name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>ID #{d.id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: C.muted }}>{d.phone || '—'}</td>
                <td style={{ color: C.muted }}>{d.license_no || '—'}</td>
                <td>
                  <span className="badge" style={{ background: d.is_active ? C.greenPale : C.redPale, color: d.is_active ? C.green : C.red }}>
                    {d.is_active ? '✓ Actif' : '✕ Inactif'}
                  </span>
                </td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: C.muted }}>Aucun chauffeur</td></tr>
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
          {err && <div style={{ color: C.red, fontSize: 13, background: C.redPale, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.red}44` }}>{err}</div>}
          <div className="form-group">
            <label className="form-label">Nom complet *</label>
            <input className="input" placeholder="Prénom Nom" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone * (login app)</label>
            <input className="input" type="tel" placeholder="0700000000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">N° Permis</label>
            <input className="input" placeholder="ex: CI-2024-001234" value={form.license_no} onChange={e => setForm(f => ({ ...f, license_no: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe app *</label>
            <input className="input" type="password" placeholder="Mot de passe pour l'app chauffeur" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
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
  const [form, setForm] = useState({ origin: '', destination: '', base_price: '', distance_km: '', duration_min: '' });
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
      setForm({ origin: '', destination: '', base_price: '', distance_km: '', duration_min: '' });
      load();
    } catch {} finally { setSaving(false); }
  };

  if (!company) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Sélectionnez une compagnie</div>;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.white }}>🗺️ Lignes de transport</h2>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{routes.length} ligne(s) active(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nouvelle ligne</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {routes.map(r => (
          <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.white }}>{r.origin}</div>
                <div style={{ color: C.orange, fontSize: 18 }}>↓</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.white }}>{r.destination}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.orange }}>{fmt(r.base_price)}</div>
                <div style={{ fontSize: 11, color: C.muted }}>tarif de base</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {r.distance_km && (
                <span className="badge" style={{ background: C.tealPale, color: C.teal }}>📍 {r.distance_km} km</span>
              )}
              {r.duration_min && (
                <span className="badge" style={{ background: C.purplePale, color: C.purple }}>⏱ {Math.floor(r.duration_min / 60)}h{r.duration_min % 60 > 0 ? r.duration_min % 60 + 'min' : ''}</span>
              )}
            </div>
          </div>
        ))}
        {routes.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Ville de départ *</label>
              <input className="input" placeholder="ex: Abidjan" value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Ville d'arrivée *</label>
              <input className="input" placeholder="ex: Aboisso" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Prix de base (FCFA) *</label>
            <input className="input" type="number" placeholder="ex: 2000" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Distance (km)</label>
              <input className="input" type="number" placeholder="ex: 90" value={form.distance_km} onChange={e => setForm(f => ({ ...f, distance_km: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Durée (minutes)</label>
              <input className="input" type="number" placeholder="ex: 120" value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VOYAGES PROGRAMMÉS  (Bug #1, #2, #3 corrigés)
═══════════════════════════════════════════════════════════════ */
function TripsScreen({ company }) {
  const [trips, setTrips]         = useState([]);
  const [routes, setRoutes]       = useState([]);
  const [vehicles, setVehicles]   = useState([]);
  const [drivers, setDrivers]     = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState({ route_id: '', vehicle_id: '', driver_id: '', departure_at: '', price: '' });
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');
  // Bug #2 : pagination
  const [page, setPage]           = useState(1);
  const perPage                   = 20;
  // Bug #3 : erreur de changement de statut
  const [statusErr, setStatusErr] = useState('');
  const [statusLoading, setStatusLoading] = useState({});

  const load = useCallback(() => {
    if (!company) return;
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      // Bug #1 : utilise l'endpoint company trips, filtre côté client si nécessaire
      voyageApi.searchTrips('', '', today).catch(() => ({ data: [] })),
      voyageApi.listRoutes(company.id).catch(() => ({ data: [] })),
      voyageApi.listVehicles(company.id).catch(() => ({ data: [] })),
      voyageApi.listDrivers(company.id).catch(() => ({ data: [] })),
    ]).then(([tr, ro, ve, dr]) => {
      const allTrips = tr.data || [];
      // Bug #1 : filtrage par company_id côté client
      const companyTrips = allTrips.filter(t => !t.company_id || t.company_id === company.id);
      setTrips(companyTrips);
      setRoutes(ro.data || []);
      setVehicles(ve.data || []);
      setDrivers(dr.data || []);
      setPage(1);
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
      setForm({ route_id: '', vehicle_id: '', driver_id: '', departure_at: '', price: '' });
      load();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Erreur lors de la création du voyage');
    } finally { setSaving(false); }
  };

  // Bug #3 : try/catch propre + gestion état loading par trip
  const handleStatus = async (tripId, status) => {
    setStatusErr('');
    setStatusLoading(prev => ({ ...prev, [tripId]: true }));
    try {
      await voyageApi.updateTripStatus(tripId, status);
      load();
    } catch (e) {
      const msg = e.response?.data?.detail || `Impossible de passer au statut "${status}"`;
      setStatusErr(`Voyage #${tripId} : ${msg}`);
    } finally {
      setStatusLoading(prev => ({ ...prev, [tripId]: false }));
    }
  };

  if (!company) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Sélectionnez une compagnie</div>;

  // Bug #2 : calcul pagination
  const totalTrips  = trips.length;
  const totalPages  = Math.max(1, Math.ceil(totalTrips / perPage));
  const pageStart   = (page - 1) * perPage;
  const pageEnd     = Math.min(pageStart + perPage, totalTrips);
  const pagedTrips  = trips.slice(pageStart, pageEnd);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.white }}>📅 Voyages programmés</h2>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>Aujourd'hui — {totalTrips} voyage(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Programmer un voyage</button>
      </div>

      {/* Bug #3 : affichage erreur statut */}
      {statusErr && (
        <div style={{ background: C.redPale, border: `1px solid ${C.red}44`, borderRadius: 10, padding: '10px 16px', color: C.red, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ {statusErr}</span>
          <button onClick={() => setStatusErr('')} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
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
            {pagedTrips.map(t => {
              const st = TRIP_STATUS[t.status] || TRIP_STATUS.SCHEDULED;
              const fill = t.seats_total > 0 ? Math.round((t.seats_booked / t.seats_total) * 100) : 0;
              const isLoading = statusLoading[t.id];
              return (
                <tr key={t.id}>
                  <td><strong style={{ color: C.white }}>{t.origin}</strong> <span style={{ color: C.muted }}>→</span> <strong style={{ color: C.white }}>{t.destination}</strong></td>
                  <td style={{ color: C.muted, fontSize: 12 }}>{fmtDateTime(t.departure_at)}</td>
                  <td style={{ color: C.muted }}>{t.vehicle_type || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3 }}>
                        <div style={{ width: `${fill}%`, height: '100%', borderRadius: 3, background: fill > 80 ? C.red : fill > 50 ? C.orange : C.green }} />
                      </div>
                      <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{t.seats_booked}/{t.seats_total}</span>
                    </div>
                  </td>
                  <td style={{ color: C.orange, fontWeight: 700 }}>{fmt(t.price)}</td>
                  <td>
                    <span className="badge" style={{ background: st.bg, color: st.c }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot, marginRight: 5, display: 'inline-block' }} />
                      {st.label}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {t.status === 'SCHEDULED' && (
                        <button
                          className="btn btn-sm"
                          style={{ background: C.greenPale, color: C.green, border: `1px solid ${C.green}44` }}
                          disabled={isLoading}
                          onClick={() => handleStatus(t.id, 'BOARDING')}
                        >
                          {isLoading ? '...' : 'Embarquement'}
                        </button>
                      )}
                      {t.status === 'BOARDING' && (
                        <button
                          className="btn btn-sm"
                          style={{ background: C.orangePale, color: C.orange, border: `1px solid ${C.orangeBorder}` }}
                          disabled={isLoading}
                          onClick={() => handleStatus(t.id, 'IN_PROGRESS')}
                        >
                          {isLoading ? '...' : 'Démarrer'}
                        </button>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <button
                          className="btn btn-sm"
                          style={{ background: C.tealPale, color: C.teal, border: `1px solid ${C.tealBorder}` }}
                          disabled={isLoading}
                          onClick={() => handleStatus(t.id, 'COMPLETED')}
                        >
                          {isLoading ? '...' : 'Terminer'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {pagedTrips.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: C.muted }}>Aucun voyage aujourd'hui</td></tr>
            )}
          </tbody>
        </table>

        {/* Bug #2 : contrôles pagination */}
        {totalTrips > perPage && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.surface }}>
            <span style={{ fontSize: 12, color: C.muted }}>
              {pageStart + 1}–{pageEnd} de {totalTrips} trajets
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ← Précédent
              </button>
              <span style={{ fontSize: 12, color: C.mutedLight, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="➕ Programmer un voyage" onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Programmer'}</button>
          </>}
        >
          {err && <div style={{ color: C.red, fontSize: 13, background: C.redPale, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.red}44` }}>{err}</div>}
          <div className="form-group">
            <label className="form-label">Ligne *</label>
            <select className="input" value={form.route_id} onChange={e => setForm(f => ({ ...f, route_id: e.target.value }))}>
              <option value="">— Choisir une ligne —</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Véhicule *</label>
            <select className="input" value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}>
              <option value="">— Choisir un véhicule —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.seat_count} places)</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Chauffeur</label>
            <select className="input" value={form.driver_id} onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}>
              <option value="">— Aucun chauffeur assigné —</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date et heure de départ *</label>
            <input className="input" type="datetime-local" value={form.departure_at} onChange={e => setForm(f => ({ ...f, departure_at: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Prix (FCFA) *</label>
            <input className="input" type="number" placeholder="ex: 2500" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
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
  const [form, setForm] = useState({ name: '', phone: '', address: '', latitude: '', longitude: '' });
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
      pos => { setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })); setDetecting(false); },
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
      setForm({ name: '', phone: '', address: '', latitude: '', longitude: '' });
      load();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.white }}>🏢 Compagnies de transport</h2>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{companies.length} compagnie(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nouvelle compagnie</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {companies.map(c => (
          <div key={c.id} className="card" onClick={() => onSelectCompany(c)}
            style={{ cursor: 'pointer', borderColor: selectedCompany?.id === c.id ? C.orange : C.border, transition: 'all .2s', padding: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: C.orangePale, border: `1px solid ${C.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🚌</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.white }}>{c.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>ID #{c.id}</div>
              </div>
              {selectedCompany?.id === c.id && (
                <span className="badge" style={{ marginLeft: 'auto', background: C.orangePale, color: C.orange }}>✓ Sélectionné</span>
              )}
            </div>
            {c.phone && <div style={{ fontSize: 12, color: C.muted }}>📞 {c.phone}</div>}
            {c.address && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>📍 {c.address}</div>}
            {c.latitude && c.longitude && (
              <div style={{ fontSize: 11, color: C.teal, marginTop: 4, fontWeight: 600 }}>
                🛰️ {Number(c.latitude).toFixed(4)}, {Number(c.longitude).toFixed(4)}
              </div>
            )}
          </div>
        ))}
        {companies.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
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
            <input className="input" placeholder="ex: GTI Transport" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone</label>
            <input className="input" type="tel" placeholder="ex: 0700000000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Adresse / Gare</label>
            <input className="input" placeholder="ex: Gare de Bassam, Abidjan" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              📍 GPS <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optionnel — position de la gare)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input className="input" placeholder="5.3196" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input className="input" placeholder="-4.0195" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
              </div>
              <button type="button" className="btn btn-ghost" onClick={detectGPS} disabled={detecting} style={{ height: 42 }}>
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

  const fmtFin = n => new Intl.NumberFormat('fr-FR').format(n) + ' F';

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>;
  if (error) return <div style={{ color: C.red, padding: 24, textAlign: 'center', background: C.redPale, margin: 24, borderRadius: 12 }}>{error}</div>;
  if (!data) return null;

  const { score, score_label, score_color, score_breakdown, ratios, loan_offers, recommendations } = data;

  // SVG gauge semi-circulaire
  const r = 70, cx = 90, cy = 90;
  const angle = (score / 100) * 180;
  const toRad = d => d * Math.PI / 180;
  const arcX = cx + r * Math.cos(toRad(180 - angle));
  const arcY = cy - r * Math.sin(toRad(180 - angle));
  const bgArc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fgArc = score > 0 ? `M ${cx - r} ${cy} A ${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${arcX} ${arcY}` : '';

  const breakdown = [
    { label: 'Stabilité revenus', max: 20, val: score_breakdown.stability },
    { label: 'Taux remplissage',  max: 25, val: score_breakdown.load_factor },
    { label: 'Croissance',        max: 20, val: score_breakdown.growth },
    { label: 'Fiabilité',         max: 20, val: score_breakdown.reliability },
    { label: 'Diversité routes',  max: 15, val: score_breakdown.diversity },
  ];

  const revs = [ratios.revenue_m2, ratios.revenue_m1, ratios.revenue_m0];
  const maxRev = Math.max(...revs, 1);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 28 }}>🏦</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>Finance IA — {company?.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>Analyse des 90 derniers jours · Score bancaire SOKORA Voyage</div>
        </div>
        {!data.has_sufficient_data && (
          <div style={{ marginLeft: 'auto', background: C.goldPale, border: `1px solid ${C.gold}44`, borderRadius: 8, padding: '6px 12px', fontSize: 12, color: C.gold, fontWeight: 600 }}>
            ⚠ Données insuffisantes
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Jauge */}
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Score bancaire transport</div>
          <svg width={180} height={100} viewBox="0 0 180 100">
            <path d={bgArc} fill="none" stroke={C.border} strokeWidth={14} strokeLinecap="round" />
            {fgArc && <path d={fgArc} fill="none" stroke={score_color} strokeWidth={14} strokeLinecap="round" />}
            <text x={cx} y={cy - 8} textAnchor="middle" fontSize={32} fontWeight={800} fill={score_color}>{score}</text>
            <text x={cx} y={cy + 8} textAnchor="middle" fontSize={13} fontWeight={700} fill={C.whiteOff}>{score_label}</text>
          </svg>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%', marginTop: 8 }}>
            {breakdown.map(b => (
              <div key={b.label} style={{ fontSize: 10, color: C.muted }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span>{b.label}</span><span style={{ fontWeight: 700, color: C.mutedLight }}>{b.val}/{b.max}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(b.val / b.max) * 100}%`, background: score_color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start' }}>
          {[
            { label: 'CA ce mois',       val: fmtFin(ratios.revenue_m0),                                              icon: '📈', color: C.teal },
            { label: 'Taux remplissage', val: `${ratios.load_factor}%`,                                               icon: '🚌', color: ratios.load_factor >= 70 ? C.green : ratios.load_factor >= 50 ? C.orange : C.red },
            { label: 'RevPAS',           val: fmtFin(ratios.revpas),                                                  icon: '💺', color: C.mutedLight },
            { label: 'Croissance MoM',   val: (ratios.mom_growth >= 0 ? '+' : '') + ratios.mom_growth + '%',          icon: '🚀', color: ratios.mom_growth >= 0 ? C.green : C.red },
            { label: 'Routes actives',   val: ratios.total_routes,                                                    icon: '🗺️', color: C.purple },
            { label: 'Véhicules actifs', val: ratios.total_vehicles,                                                  icon: '🚐', color: C.orange },
          ].map(k => (
            <div key={k.label} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '12px 14px' }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{k.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenus 3 mois + métriques transport + revenus par route */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Barres revenus */}
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Revenus mensuels</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100 }}>
            {revs.map((rv, i) => {
              const h = maxRev > 0 ? Math.max(4, Math.round((rv / maxRev) * 90)) : 4;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>{rv > 0 ? fmtFin(rv) : '–'}</div>
                  <div style={{ width: '100%', height: h, borderRadius: '4px 4px 0 0', background: i === 2 ? C.teal : C.border }} />
                  <div style={{ fontSize: 10, color: C.muted }}>{['M-2', 'M-1', 'Ce mois'][i]}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Métriques transport */}
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Indicateurs transport</div>
          {[
            { label: 'Annulations passagers', val: `${ratios.cancel_rate}%`,      color: ratios.cancel_rate > 15 ? C.red : C.muted },
            { label: 'Voyages annulés',        val: `${ratios.trip_cancel_rate}%`, color: ratios.trip_cancel_rate > 10 ? C.red : C.muted },
            { label: 'Sièges offerts (90j)',   val: ratios.total_seats_offered,    color: C.mutedLight },
            { label: 'Réservations',           val: ratios.total_bookings,         color: C.teal },
            { label: 'Voyages opérés',         val: ratios.total_trips,            color: C.mutedLight },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
              <span style={{ color: C.muted }}>{m.label}</span>
              <span style={{ fontWeight: 700, color: m.color }}>{m.val}</span>
            </div>
          ))}
        </div>

        {/* Revenus par route */}
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Revenus par route</div>
          {Object.keys(ratios.route_revenue || {}).length === 0
            ? <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 20 }}>Aucune donnée</div>
            : (() => {
                const maxR = Math.max(...Object.values(ratios.route_revenue), 1);
                const colors = [C.teal, C.purple, C.gold, C.green, C.orange];
                return Object.entries(ratios.route_revenue).map(([route, rev], i) => (
                  <div key={route} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: C.mutedLight, fontWeight: 600, fontSize: 10 }}>{route}</span>
                      <span style={{ color: C.muted }}>{fmtFin(rev)}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(rev / maxR * 100)}%`, background: colors[i % colors.length] }} />
                    </div>
                  </div>
                ));
              })()
          }
        </div>
      </div>

      {/* Offres de prêt */}
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 16 }}>💰 Offres de financement SOKORA Voyage</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {loan_offers.map(offer => (
            <div key={offer.type} style={{
              borderRadius: 12,
              border: `2px solid ${offer.eligible ? C.teal : C.border}`,
              padding: 16,
              background: offer.eligible ? C.tealPale : C.surface,
              opacity: offer.eligible ? 1 : 0.75
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{offer.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 2 }}>{offer.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: offer.eligible ? C.teal : C.muted, marginBottom: 4 }}>{fmtFin(offer.amount)}</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{offer.rate} · {offer.duration}</div>
              <div style={{ fontSize: 11, color: offer.eligible ? C.teal : C.muted, fontWeight: 600, marginTop: 6 }}>
                {offer.eligible ? '✅ ' : '🔒 '}{offer.reason}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommandations */}
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 12 }}>🤖 Recommandations IA</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recommendations.map((rec, i) => (
            <div key={i} style={{ background: C.surface, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.whiteOff, borderLeft: `3px solid ${C.teal}` }}>
              {rec}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 12, fontStyle: 'italic' }}>
          * Offres indicatives. Contactez SOKORA Finance pour une demande officielle.
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATS CHAUFFEURS
═══════════════════════════════════════════════════════════════ */
function DriverStatsScreen({ company }) {
  const [drivers, setDrivers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  // Charge la liste des chauffeurs
  useEffect(() => {
    if (!company?.id) return;
    setLoading(true);
    voyageApi.listDrivers(company.id)
      .then(r => setDrivers(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company?.id]);

  // Charge les stats quand on sélectionne un chauffeur ou change la période
  useEffect(() => {
    if (!selected || !company?.id) return;
    setLoadingStats(true);
    voyageApi.getDriverStats(company.id, selected.id, period)
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [selected?.id, period, company?.id]);

  // Vue liste des chauffeurs (quand aucun sélectionné)
  if (!selected) {
    return (
      <div>
        <div className="sec-head">
          <span className="sec-title">🧑‍✈️ Stats Chauffeurs</span>
        </div>
        {loading ? <Spinner /> : (
          <div className="kgrid">
            {drivers.map(d => (
              <div key={d.id} className="kcard" style={{cursor:'pointer'}} onClick={() => setSelected(d)}>
                <div className="kstripe" style={{background: C.orange}} />
                <div className="kicon" style={{background: C.orangePale, fontSize:22}}>🧑‍✈️</div>
                <div className="kval" style={{fontSize:16}}>{d.full_name || d.name}</div>
                <div className="klabel" style={{marginTop:4}}>{d.phone || '—'}</div>
                <div style={{marginTop:10, fontSize:11, color: C.teal, fontWeight:600}}>
                  Voir stats →
                </div>
              </div>
            ))}
            {drivers.length === 0 && <div className="empty">Aucun chauffeur enregistré</div>}
          </div>
        )}
      </div>
    );
  }

  // Vue stats d'un chauffeur
  return (
    <div>
      {/* Header avec retour */}
      <div className="sec-head">
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setStats(null); }}>
            ← Retour
          </button>
          <span className="sec-title">🧑‍✈️ {selected.full_name || selected.name}</span>
        </div>
        {/* Sélecteur période */}
        <div className="tabs" style={{marginBottom:0}}>
          {[{v:'7d',l:'7 jours'},{v:'30d',l:'30 jours'},{v:'90d',l:'90 jours'}].map(p => (
            <button key={p.v} className={`tab${period===p.v?' on':''}`} onClick={() => setPeriod(p.v)}>{p.l}</button>
          ))}
        </div>
      </div>

      {loadingStats ? <Spinner /> : !stats ? null : (
        <>
          {/* KPI Cards */}
          <div className="kgrid">
            {[
              {icon:'🚌', label:'Voyages total', val:stats.trips_total, color:C.orange},
              {icon:'✅', label:'Terminés', val:stats.trips_completed, color:C.green},
              {icon:'👥', label:'Passagers', val:stats.passengers_total, color:C.teal},
              {icon:'💰', label:'Revenus générés', val:fmt(stats.revenue_generated), color:C.gold},
              {icon:'📏', label:'KM estimés', val:`${stats.km_estimated} km`, color:C.purple},
              {icon:'⭐', label:'Note moyenne', val:`${stats.avg_rating}/5`, color:C.orange},
              {icon:'⏱️', label:'Ponctualité', val:`${stats.avg_punctuality_pct}%`, color:C.teal},
              {icon:'🔄', label:'En cours', val:stats.trips_in_progress, color:C.gold},
            ].map((k,i) => (
              <div key={i} className="kcard">
                <div className="kstripe" style={{background:k.color}} />
                <div className="kicon" style={{background:`${k.color}20`, fontSize:18}}>{k.icon}</div>
                <div className="klabel">{k.label}</div>
                <div className="kval" style={{color:k.color}}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Graphe activité par jour (SVG natif) */}
          {stats.daily_series?.length > 0 && (
            <div className="card" style={{padding:'20px 24px', marginBottom:20}}>
              <div className="sec-head" style={{marginBottom:14}}>
                <span className="sec-title" style={{fontSize:13}}>📈 Activité — {stats.period_label}</span>
              </div>
              {(() => {
                const data = stats.daily_series;
                const maxV = Math.max(...data.map(d => d.trips), 1);
                const W = 100, H = 50;
                const pts = data.map((d,i) => {
                  const x = data.length > 1 ? (i/(data.length-1))*W : W/2;
                  const y = H - (d.trips/maxV)*H*0.85 - 3;
                  return `${x},${y}`;
                });
                const pathD = pts.reduce((acc,pt,i) => {
                  if (i===0) return `M ${pt}`;
                  const [px,py] = pts[i-1].split(',').map(Number);
                  const [cx,cy] = pt.split(',').map(Number);
                  const mx = (px+cx)/2;
                  return acc+` C ${mx},${py} ${mx},${cy} ${cx},${cy}`;
                }, '');
                const areaD = pathD + ` L ${W},${H} L 0,${H} Z`;
                const step = Math.ceil(data.length/5);
                const labels = data.filter((_,i) => i%step===0 || i===data.length-1);
                return (
                  <div style={{position:'relative', height:90}}>
                    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                      style={{position:'absolute',top:0,left:0,width:'100%',height:'76%'}}>
                      <defs>
                        <linearGradient id="driverGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.teal} stopOpacity="0.25"/>
                          <stop offset="100%" stopColor={C.teal} stopOpacity="0.01"/>
                        </linearGradient>
                      </defs>
                      <path d={areaD} fill="url(#driverGrad)"/>
                      <path d={pathD} fill="none" stroke={C.teal} strokeWidth="1.5"/>
                      {data.map((d,i) => {
                        const x = data.length>1 ? (i/(data.length-1))*W : W/2;
                        const y = H-(d.trips/maxV)*H*0.85-3;
                        return d.trips>0 ? <circle key={i} cx={x} cy={y} r="1.2" fill={C.teal}/> : null;
                      })}
                    </svg>
                    <div style={{position:'absolute',bottom:0,left:0,right:0,display:'flex',justifyContent:'space-between',padding:'0 2px'}}>
                      {labels.map((d,i) => (
                        <span key={i} style={{fontSize:9,color:C.muted,fontWeight:500}}>{d.date}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Infos chauffeur */}
          <div className="card" style={{padding:'20px 24px'}}>
            <div className="sec-title" style={{marginBottom:14, fontSize:13}}>👤 Profil</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              {[
                ['Nom', stats.driver_name],
                ['Téléphone', stats.driver_phone],
                ['Permis', stats.driver_license],
                ['Voyages annulés', stats.trips_cancelled],
              ].map(([l,v]) => (
                <div key={l} style={{background:C.surface, borderRadius:10, padding:'12px 14px'}}>
                  <div style={{fontSize:10, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:4}}>{l}</div>
                  <div style={{fontSize:14, color:C.white, fontWeight:600}}>{v ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LISTE PASSAGERS (export par trip)
═══════════════════════════════════════════════════════════════ */
function PassengerListScreen({ company }) {
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);

  // Charge les trips du jour (filtrés par company côté client)
  useEffect(() => {
    if (!company?.id) return;
    setLoadingTrips(true);
    voyageApi.searchTrips('', '', searchDate)
      .then(r => {
        const all = r.data || [];
        setTrips(all.filter(t => !t.company_id || t.company_id === company.id));
      })
      .catch(() => {})
      .finally(() => setLoadingTrips(false));
  }, [searchDate, company?.id]);

  // Charge les passagers du trip sélectionné
  const loadBookings = (trip) => {
    setSelectedTrip(trip);
    setLoadingBookings(true);
    voyageApi.getTripBookings(trip.id)
      .then(r => setBookings(r.data?.bookings || []))
      .catch(() => setBookings([]))
      .finally(() => setLoadingBookings(false));
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Siège','Nom','Téléphone','Statut','Paiement','Montant (F)','Embarquement'];
    const rows = bookings.map(b => [
      b.seat_number,
      b.client_name,
      b.client_phone,
      b.status,
      b.payment_method || 'WALLET SOKORA',
      b.amount_paid,
      b.boarded_at ? new Date(b.boarded_at).toLocaleString('fr-FR') : '—',
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passagers_${selectedTrip?.id}_${searchDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF
  const exportPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const orange = [255, 107, 53];
    const dark = [20, 29, 46];
    const muted = [107, 122, 153];

    // Header
    doc.setFillColor(...orange);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('SOKORA Voyages', 14, 13);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Marketplace Transport — Liste des Passagers', 14, 21);

    let y = 40;
    doc.setTextColor(...dark);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(`Voyage : ${selectedTrip?.origin || '—'} → ${selectedTrip?.destination || '—'}`, 14, y); y += 7;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`Date : ${searchDate}   |   Passagers : ${bookings.length}   |   Véhicule : ${selectedTrip?.vehicle_plate || '—'}`, 14, y); y += 10;

    // Table header
    doc.setFillColor(...orange);
    doc.rect(14, y-4, 182, 8, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    ['Siège','Nom','Téléphone','Statut','Paiement','Montant'].forEach((h, i) => {
      doc.text(h, 14+[0,20,70,115,140,168][i], y);
    });
    y += 8;

    doc.setFont('helvetica', 'normal');
    bookings.forEach((b, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(245,245,245); doc.rect(14,y-4,182,7,'F'); }
      doc.setTextColor(...dark);
      const statusColors = { BOARDED:[25,200,170], CONFIRMED:[255,107,53], CANCELLED:[231,76,60] };
      const sc = statusColors[b.status] || [...muted];
      [
        String(b.seat_number||'—'),
        (b.client_name||'—').substring(0,22),
        b.client_phone||'—',
        b.status||'—',
        b.payment_method||'WALLET',
        `${new Intl.NumberFormat('fr-FR').format(b.amount_paid||0)} F`,
      ].forEach((v, i) => {
        if (i === 3) doc.setTextColor(...sc); else doc.setTextColor(...dark);
        doc.text(v, 14+[0,20,70,115,140,165][i], y);
      });
      y += 7;
    });

    doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text('SOKORA — Marketplace Transport — sokora.ci', 14, 285);
    doc.save(`passagers_${selectedTrip?.id}_${searchDate}.pdf`);
  };

  // Vue liste des trips (sélection)
  if (!selectedTrip) {
    return (
      <div>
        <div className="sec-head">
          <span className="sec-title">🎫 Liste Passagers</span>
          <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}
            style={{width:'auto', padding:'6px 12px', fontSize:13}} />
        </div>
        {loadingTrips ? <Spinner /> : (
          <div className="card">
            <table className="dt">
              <thead><tr>
                <th>Départ</th><th>Itinéraire</th><th>Véhicule</th><th>Statut</th><th>Passagers</th><th></th>
              </tr></thead>
              <tbody>
                {trips.length === 0 && (
                  <tr><td colSpan={6} className="empty">Aucun voyage pour cette date</td></tr>
                )}
                {trips.map(t => (
                  <tr key={t.id}>
                    <td style={{color:C.muted}}>{t.departure_time ? new Date(t.departure_time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                    <td><span style={{fontWeight:700,color:C.white}}>{t.origin}</span> → {t.destination}</td>
                    <td style={{color:C.muted}}>{t.vehicle_plate || '—'}</td>
                    <td><span className="badge" style={TRIP_STATUS[t.status]||{}}>{TRIP_STATUS[t.status]?.label||t.status}</span></td>
                    <td style={{color:C.teal,fontWeight:700}}>{t.seats_booked ?? '—'} / {t.total_seats ?? '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => loadBookings(t)}>
                        Voir passagers
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Vue passagers d'un trip
  return (
    <div>
      <div className="sec-head">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedTrip(null); setBookings([]); }}>← Retour</button>
          <span className="sec-title">
            🎫 {selectedTrip.origin} → {selectedTrip.destination}
            <span style={{fontSize:12,color:C.muted,fontWeight:400,marginLeft:8}}>{searchDate}</span>
          </span>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV} disabled={!bookings.length}>
            📊 CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={exportPDF} disabled={!bookings.length}>
            📄 PDF
          </button>
        </div>
      </div>

      {/* KPI rapide */}
      <div style={{display:'flex',gap:12,marginBottom:18,flexWrap:'wrap'}}>
        {[
          {icon:'🎫', label:'Total passagers', val:bookings.length, color:C.orange},
          {icon:'✅', label:'Embarqués', val:bookings.filter(b=>b.status==='BOARDED'||b.status==='COMPLETED').length, color:C.green},
          {icon:'💰', label:'Revenu total', val:fmt(bookings.reduce((s,b)=>s+(b.amount_paid||0),0)), color:C.teal},
          {icon:'❌', label:'Annulés', val:bookings.filter(b=>b.status==='CANCELLED').length, color:C.red},
        ].map((k,i) => (
          <div key={i} style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 18px', flex:'1', minWidth:140}}>
            <div style={{fontSize:18,marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:'.7px'}}>{k.label}</div>
            <div style={{fontSize:20,fontWeight:800,color:k.color,marginTop:2}}>{k.val}</div>
          </div>
        ))}
      </div>

      {loadingBookings ? <Spinner /> : (
        <div className="card">
          <table className="dt">
            <thead><tr>
              <th>Siège</th><th>Nom</th><th>Téléphone</th><th>Statut</th><th>Paiement</th><th>Montant</th><th>Embarquement</th>
            </tr></thead>
            <tbody>
              {bookings.length === 0 && <tr><td colSpan={7} className="empty">Aucune réservation</td></tr>}
              {bookings.map(b => {
                const stCfg = {
                  BOARDED:    {c:C.teal,  bg:C.tealPale},
                  CONFIRMED:  {c:C.orange,bg:C.orangePale},
                  COMPLETED:  {c:C.green, bg:C.greenPale},
                  CANCELLED:  {c:C.red,   bg:C.redPale},
                  PENDING:    {c:C.muted, bg:C.card},
                }[b.status] || {c:C.muted,bg:C.card};
                return (
                  <tr key={b.booking_id}>
                    <td><span style={{fontFamily:'monospace',fontWeight:700,color:C.white,background:C.surface,padding:'2px 8px',borderRadius:6}}>#{b.seat_number}</span></td>
                    <td style={{fontWeight:600}}>{b.client_name||'—'}</td>
                    <td style={{color:C.muted}}>{b.client_phone||'—'}</td>
                    <td><span className="badge" style={{background:stCfg.bg,color:stCfg.c}}>{b.status}</span></td>
                    <td>
                      <span className="badge" style={{background:C.tealPale,color:C.teal}}>
                        💳 Wallet SOKORA
                      </span>
                    </td>
                    <td style={{fontWeight:700,color:C.white}}>{fmt(b.amount_paid)}</td>
                    <td style={{color:C.muted,fontSize:12}}>
                      {b.boarded_at ? new Date(b.boarded_at).toLocaleString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TRACKING TEMPS RÉEL (Leaflet)
═══════════════════════════════════════════════════════════════ */
function TrackingScreen({ company }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef({});
  const [positions, setPositions] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPositions = useCallback(() => {
    voyageApi.getVehiclePositions(company?.id)
      .then(r => {
        setPositions(r.data?.positions || []);
        setLastUpdate(new Date());
        setError('');
      })
      .catch(() => setError('Impossible de charger les positions'));
  }, [company?.id]);

  // Init Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const L = window.L;
    if (!L) { setError('Leaflet non disponible'); setLoading(false); return; }

    const map = L.map(mapRef.current, {
      center: [5.3484, -4.0060], // Abidjan
      zoom: 9,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    leafletMap.current = map;
    setLoading(false);

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // Polling positions
  useEffect(() => {
    if (!company?.id) return;
    fetchPositions();
    const interval = setInterval(fetchPositions, 10000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  // Met à jour les markers sur la carte
  useEffect(() => {
    const L = window.L;
    const map = leafletMap.current;
    if (!L || !map || positions.length === 0) return;

    // Nettoyer les anciens markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    positions.forEach(pos => {
      const isMoving = pos.status === 'IN_PROGRESS';
      const color = isMoving ? '#FF6B35' : '#00D4AA';

      // Marker SVG personnalisé
      const svgIcon = L.divIcon({
        html: `
          <div style="
            width:36px;height:36px;border-radius:50% 50% 50% 0;
            background:${color};border:3px solid #fff;
            box-shadow:0 3px 10px rgba(0,0,0,.35);
            transform:rotate(-45deg);
            display:flex;align-items:center;justify-content:center;
          ">
            <span style="transform:rotate(45deg);font-size:15px;">🚌</span>
          </div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
      });

      const marker = L.marker([pos.lat, pos.lng], { icon: svgIcon });

      const popupContent = `
        <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:200px;padding:4px">
          <div style="font-weight:800;font-size:14px;color:#0f1e35;margin-bottom:6px">
            🚌 ${pos.vehicle_plate}
          </div>
          <div style="font-size:12px;color:#333;margin-bottom:4px">
            <strong>${pos.origin}</strong> → <strong>${pos.destination}</strong>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            <span style="background:#FF6B3520;color:#FF6B35;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">
              ${pos.status === 'IN_PROGRESS' ? '🟢 En route' : '🟡 Embarquement'}
            </span>
            <span style="background:#00D4AA20;color:#00D4AA;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">
              👥 ${pos.passengers_aboard}/${pos.total_seats}
            </span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#666">
            <div>Progression : <strong>${pos.progress_pct}%</strong></div>
            <div>Vitesse : <strong>${pos.speed_kmh} km/h</strong></div>
            ${pos.is_mock ? '<div style="color:#aaa;margin-top:4px;font-style:italic">⚠️ Position simulée (dev)</div>' : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(map);
      markersRef.current[pos.trip_id] = marker;
    });

    // Ajuster la vue si des markers existent
    if (positions.length > 0) {
      try {
        const group = L.featureGroup(Object.values(markersRef.current));
        map.fitBounds(group.getBounds().pad(0.3));
      } catch (e) {
        // pas de bounds si un seul point
      }
    }
  }, [positions]);

  const timeSince = lastUpdate
    ? Math.floor((Date.now() - lastUpdate) / 1000)
    : null;

  return (
    <div>
      {/* Header */}
      <div className="sec-head" style={{marginBottom:14}}>
        <span className="sec-title">🗺️ Tracking Temps Réel</span>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {timeSince !== null && (
            <span style={{fontSize:11,color:C.muted}}>
              Mis à jour il y a {timeSince}s
            </span>
          )}
          <span style={{display:'flex',alignItems:'center',gap:6,background:C.tealPale,color:C.teal,padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:700}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:C.teal,animation:'pulse 2s infinite',display:'inline-block'}}/>
            LIVE
          </span>
          <button className="btn btn-ghost btn-sm" onClick={fetchPositions}>🔄 Actualiser</button>
        </div>
      </div>

      {error && <div style={{background:C.redPale,color:C.red,border:`1px solid ${C.red}44`,borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12}}>⚠️ {error}</div>}

      {/* KPI bar */}
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        {[
          {icon:'🚌', label:'Véhicules actifs', val:positions.length, color:C.orange},
          {icon:'🟢', label:'En route', val:positions.filter(p=>p.status==='IN_PROGRESS').length, color:C.green},
          {icon:'🟡', label:'Embarquement', val:positions.filter(p=>p.status==='BOARDING').length, color:C.gold},
          {icon:'👥', label:'Passagers en transit', val:positions.reduce((s,p)=>s+p.passengers_aboard,0), color:C.teal},
        ].map((k,i) => (
          <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 16px',flex:'1',minWidth:130,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>{k.icon}</span>
            <div>
              <div style={{fontSize:9,color:C.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:'.7px'}}>{k.label}</div>
              <div style={{fontSize:22,fontWeight:800,color:k.color,lineHeight:1.1}}>{k.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Carte Leaflet */}
      <div style={{borderRadius:16,overflow:'hidden',border:`1px solid ${C.border}`,position:'relative'}}>
        {loading && (
          <div style={{position:'absolute',inset:0,background:C.card,display:'flex',alignItems:'center',justifyContent:'center',zIndex:10}}>
            <Spinner />
          </div>
        )}
        <div ref={mapRef} style={{height:520,width:'100%'}} />
      </div>

      {/* Liste véhicules */}
      {positions.length > 0 && (
        <div className="card" style={{marginTop:16,padding:'0'}}>
          <table className="dt">
            <thead><tr>
              <th>Véhicule</th><th>Ligne</th><th>Statut</th><th>Progression</th><th>Passagers</th><th>Vitesse</th>
            </tr></thead>
            <tbody>
              {positions.map(pos => (
                <tr key={pos.trip_id} style={{cursor:'pointer'}} onClick={() => {
                  const m = markersRef.current[pos.trip_id];
                  if (m && leafletMap.current) { leafletMap.current.setView([pos.lat,pos.lng],12); m.openPopup(); }
                }}>
                  <td style={{fontWeight:700,color:C.white}}>{pos.vehicle_plate}</td>
                  <td style={{color:C.muted}}>{pos.route_name}</td>
                  <td>
                    <span className="badge" style={{
                      background: pos.status==='IN_PROGRESS' ? C.orangePale : C.tealPale,
                      color: pos.status==='IN_PROGRESS' ? C.orange : C.teal,
                    }}>
                      {pos.status==='IN_PROGRESS' ? '🟢 En route' : '🟡 Embarquement'}
                    </span>
                  </td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{flex:1,height:6,background:C.border,borderRadius:3}}>
                        <div style={{width:`${pos.progress_pct}%`,height:'100%',background:C.orange,borderRadius:3,transition:'width .5s'}}/>
                      </div>
                      <span style={{fontSize:12,color:C.muted,minWidth:35}}>{pos.progress_pct}%</span>
                    </div>
                  </td>
                  <td style={{color:C.teal,fontWeight:700}}>{pos.passengers_aboard}/{pos.total_seats}</td>
                  <td style={{color:pos.speed_kmh>0?C.white:C.muted}}>{pos.speed_kmh} km/h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOKORA BLACK — FIDÉLITÉ VOYAGE
═══════════════════════════════════════════════════════════════ */
const TIER_META_V = {
  Black:  { color: '#e8d5ff', bg: '#2a1550', badge: '⬛', cashback: '5%' },
  Gold:   { color: '#FFD700', bg: '#2a2200', badge: '🥇', cashback: '3%' },
  Silver: { color: '#C0C0C0', bg: '#1e2230', badge: '🥈', cashback: '2%' },
  Bronze: { color: '#CD7F32', bg: '#2a1800', badge: '🥉', cashback: '1%' },
};

function LoyaltyVoyageScreen({ company }) {
  const [stats, setStats]     = useState(null);
  const [clients, setClients] = useState([]);
  const [txs, setTxs]         = useState([]);
  const [tab, setTab]         = useState('dashboard');
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [earnPhone, setEarnPhone] = useState('');
  const [earnAmount, setEarnAmount] = useState('');
  const [msg, setMsg]         = useState(null);

  const showMsg = (m, ok=true) => { setMsg({text:m,ok}); setTimeout(()=>setMsg(null),3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, c, t] = await Promise.all([
        loyaltyApi.dashboard(),
        loyaltyApi.listClients({ search, limit: 50 }),
        loyaltyApi.transactions({ limit: 30 }),
      ]);
      setStats(d.data);
      setClients(c.data.clients || []);
      setTxs(t.data.transactions || []);
    } catch { showMsg('Erreur chargement fidélité', false); }
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleEarn = async () => {
    if (!earnPhone || !earnAmount) return;
    try {
      const r = await loyaltyApi.earn({ phone: earnPhone, amount: parseFloat(earnAmount) });
      showMsg(`+${r.data.points_earned} pts · Tier: ${r.data.tier}${r.data.tier_upgraded ? ' 🎉 UPGRADE!' : ''}`);
      setEarnPhone(''); setEarnAmount(''); load();
    } catch(e) { showMsg(e.response?.data?.detail || 'Erreur', false); }
  };

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: '8px 18px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
      background: tab === id ? C.orange : C.card,
      color: tab === id ? '#fff' : C.muted, cursor: 'pointer',
    }}>{label}</button>
  );

  return (
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:22, fontWeight:800, color:C.white}}>⭐ SOKORA Black</div>
        <div style={{fontSize:13, color:C.muted, marginTop:4}}>Programme de fidélité · Wallet SOKORA</div>
      </div>

      {msg && (
        <div style={{ padding:'12px 16px', borderRadius:10, marginBottom:16,
          background: msg.ok ? '#00D4AA12' : '#ff4d4d22',
          border:`1px solid ${msg.ok?'#00D4AA40':'#ff4d4d55'}`,
          color: msg.ok ? C.teal : '#ff6b6b', fontWeight:600, fontSize:13}}>
          {msg.text}
        </div>
      )}

      {/* Tier legend */}
      <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        {Object.entries(TIER_META_V).map(([name, m]) => (
          <div key={name} style={{padding:'10px 16px', borderRadius:10,
            background:m.bg, border:`1px solid ${m.color}44`,
            display:'flex', alignItems:'center', gap:8}}>
            <span style={{fontSize:18}}>{m.badge}</span>
            <div>
              <div style={{fontWeight:800, color:m.color, fontSize:13}}>{name}</div>
              <div style={{fontSize:11, color:C.muted}}>Cashback {m.cashback}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:'flex', gap:8, marginBottom:20}}>
        <TabBtn id="dashboard" label="📊 Stats" />
        <TabBtn id="clients"   label="👤 Voyageurs" />
        <TabBtn id="actions"   label="⚡ Attribuer pts" />
        <TabBtn id="history"   label="📋 Historique" />
      </div>

      {loading ? <div style={{textAlign:'center',padding:40,color:C.muted}}>Chargement…</div> : (
        tab === 'dashboard' && stats ? (
          <div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20}}>
              {[
                {icon:'👤', label:'Voyageurs fidèles', val:stats.total_clients, color:C.teal},
                {icon:'⭐', label:'Pts émis total', val:stats.total_points_issued?.toLocaleString(), color:C.orange},
                {icon:'📈', label:'Pts gagnés (30j)', val:stats.points_earned_30d?.toLocaleString(), color:'#22c55e'},
                {icon:'💎', label:'Pts utilisés (30j)', val:stats.points_redeemed_30d?.toLocaleString(), color:'#a78bfa'},
              ].map(k => (
                <div key={k.label} style={{background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:22}}>{k.icon}</div>
                  <div style={{fontWeight:800, color:k.color, fontSize:20, marginTop:6}}>{k.val}</div>
                  <div style={{fontSize:11, color:C.muted, marginTop:4}}>{k.label}</div>
                </div>
              ))}
            </div>
            <div style={{background:C.card, borderRadius:12, padding:20, border:`1px solid ${C.border}`}}>
              <div style={{fontWeight:700, color:C.white, marginBottom:14}}>Répartition par tier</div>
              <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                {Object.entries(stats.tier_distribution || {}).map(([name, count]) => {
                  const m = TIER_META_V[name] || {};
                  return (
                    <div key={name} style={{flex:1, minWidth:90, padding:'16px 12px', borderRadius:10,
                      background:m.bg||C.card, border:`1px solid ${(m.color||C.border)}44`, textAlign:'center'}}>
                      <div style={{fontSize:24}}>{m.badge}</div>
                      <div style={{fontWeight:800, color:m.color||C.white, fontSize:20, marginTop:4}}>{count}</div>
                      <div style={{fontSize:11, color:C.muted, marginTop:2}}>{name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : tab === 'clients' ? (
          <div>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Rechercher voyageur…"
              style={{width:'100%', padding:'10px 14px', borderRadius:8, marginBottom:14,
                background:C.card, border:`1px solid ${C.border}`, color:C.white, fontSize:13, boxSizing:'border-box'}} />
            <div style={{background:C.card, borderRadius:12, border:`1px solid ${C.border}`, overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
                <thead>
                  <tr style={{color:C.muted}}>
                    {['Voyageur','Téléphone','Tier','Points','Voyages'].map(h=>(
                      <th key={h} style={{padding:'10px 14px', textAlign:'left', borderBottom:`1px solid ${C.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => {
                    const m = TIER_META_V[c.tier] || {};
                    return (
                      <tr key={c.id} style={{borderBottom:`1px solid ${C.border}22`}}>
                        <td style={{padding:'10px 14px', color:C.white, fontWeight:600}}>{c.name}</td>
                        <td style={{padding:'10px 14px', color:C.muted}}>{c.phone}</td>
                        <td style={{padding:'10px 14px'}}>
                          <span style={{padding:'3px 10px', borderRadius:20,
                            background:m.bg||C.card, color:m.color||C.white, fontWeight:700, fontSize:11}}>
                            {m.badge} {c.tier}
                          </span>
                        </td>
                        <td style={{padding:'10px 14px', color:C.orange, fontWeight:700}}>{c.total_points?.toLocaleString()}</td>
                        <td style={{padding:'10px 14px', color:C.muted}}>{c.visit_count}</td>
                      </tr>
                    );
                  })}
                  {clients.length===0 && <tr><td colSpan={5} style={{textAlign:'center',padding:32,color:C.muted}}>Aucun voyageur</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'actions' ? (
          <div style={{maxWidth:440}}>
            <div style={{background:C.card, borderRadius:12, padding:20, border:`1px solid ${C.border}`}}>
              <div style={{fontWeight:700, color:C.teal, marginBottom:14}}>📈 Attribuer des points voyage</div>
              <div style={{fontSize:12, color:C.muted, marginBottom:12}}>1 pt par 100 XOF · Wallet SOKORA</div>
              <label style={{fontSize:12, color:C.muted}}>Téléphone voyageur</label>
              <input value={earnPhone} onChange={e=>setEarnPhone(e.target.value)}
                placeholder="+225 07 00 00 00 00"
                style={{width:'100%', padding:'10px 12px', borderRadius:8, margin:'6px 0 12px',
                  background:C.bg, border:`1px solid ${C.border}`, color:C.white, fontSize:13, boxSizing:'border-box'}} />
              <label style={{fontSize:12, color:C.muted}}>Prix du billet (XOF)</label>
              <input value={earnAmount} onChange={e=>setEarnAmount(e.target.value)} type="number"
                placeholder="2500"
                style={{width:'100%', padding:'10px 12px', borderRadius:8, margin:'6px 0 16px',
                  background:C.bg, border:`1px solid ${C.border}`, color:C.white, fontSize:13, boxSizing:'border-box'}} />
              <button onClick={handleEarn} style={{
                width:'100%', padding:'12px', borderRadius:8, border:'none',
                background:`linear-gradient(135deg, ${C.teal}, #00a885)`,
                color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer',
              }}>Valider points voyage</button>
            </div>
          </div>
        ) : tab === 'history' ? (
          <div style={{background:C.card, borderRadius:12, border:`1px solid ${C.border}`, overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{color:C.muted}}>
                  {['Date','Client','Type','Points','Description'].map(h=>(
                    <th key={h} style={{padding:'10px 14px', textAlign:'left', borderBottom:`1px solid ${C.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txs.map(t => (
                  <tr key={t.id} style={{borderBottom:`1px solid ${C.border}22`}}>
                    <td style={{padding:'9px 14px', color:C.muted, fontSize:11}}>{t.created_at?.slice(0,10)}</td>
                    <td style={{padding:'9px 14px', color:C.white, fontWeight:600}}>{t.client_name}</td>
                    <td style={{padding:'9px 14px'}}>
                      <span style={{
                        padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700,
                        background: t.tx_type==='earn' ? '#00D4AA12' : t.tx_type==='redeem' ? '#FF6B3512' : '#a78bfa22',
                        color: t.tx_type==='earn' ? C.teal : t.tx_type==='redeem' ? C.orange : '#a78bfa',
                      }}>{t.tx_type}</span>
                    </td>
                    <td style={{padding:'9px 14px', fontWeight:700,
                      color: t.points>0 ? C.teal : C.orange}}>
                      {t.points>0?'+':''}{t.points}
                    </td>
                    <td style={{padding:'9px 14px', color:C.muted}}>{t.description}</td>
                  </tr>
                ))}
                {txs.length===0 && <tr><td colSpan={5} style={{textAlign:'center',padding:32,color:C.muted}}>Aucune transaction</td></tr>}
              </tbody>
            </table>
          </div>
        ) : null
      )}
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
  { id: 'finance',      icon: '🏦', label: 'Finance IA'     },
  { id: 'driver-stats', icon: '🧑‍✈️', label: 'Stats Chauffeurs' },
  { id: 'passengers',   icon: '🎫', label: 'Liste Passagers'  },
  { id: 'tracking',     icon: '🗺️', label: 'Tracking Live'    },
  { id: 'loyalty',      icon: '⭐', label: 'SOKORA Black'     },
];

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('voyage_user')); } catch { return null; }
  });
  const [screen, setScreen]           = useState('dashboard');
  const [company, setCompany]         = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Bug #4 : restaurer company depuis localStorage au chargement
  useEffect(() => {
    const savedCompanyId = localStorage.getItem('voyage_company_id');
    if (savedCompanyId && !company) {
      // Tenter de charger la compagnie depuis l'API si on a l'id
      voyageApi.listCompanies().then(r => {
        const companies = r.data || [];
        const found = companies.find(c => String(c.id) === String(savedCompanyId));
        if (found) setCompany(found);
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CSS injecté via JSX (synchrone, pas de flash au premier rendu)

  const handleLogout = () => {
    localStorage.removeItem('voyage_token');
    localStorage.removeItem('voyage_user');
    localStorage.removeItem('voyage_company_id');
    setUser(null);
    setCompany(null);
  };

  // Bug #4 : persister company_id à chaque changement de compagnie
  const handleSelectCompany = c => {
    setCompany(c);
    if (c?.id) localStorage.setItem('voyage_company_id', c.id);
    setScreen('dashboard');
  };

  if (!user) return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <LoginScreen onLogin={u => setUser(u)} />
    </>
  );

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard':  return <DashboardScreen company={company} />;
      case 'companies':  return <CompaniesScreen onSelectCompany={handleSelectCompany} selectedCompany={company} />;
      case 'trips':      return <TripsScreen company={company} />;
      case 'vehicles':   return <VehiclesScreen company={company} />;
      case 'drivers':    return <DriversScreen company={company} />;
      case 'routes':     return <RoutesScreen company={company} />;
      case 'finance':      return <FinanceIAScreen company={company} />;
      case 'driver-stats': return <DriverStatsScreen company={company} />;
      case 'passengers':   return <PassengerListScreen company={company} />;
      case 'tracking':     return <TrackingScreen company={company} />;
      case 'loyalty':      return <LoyaltyVoyageScreen company={company} />;
      default:             return <DashboardScreen company={company} />;
    }
  };

  return (
    <>
    <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      {/* ── SIDEBAR ── */}
      <div style={{
        width: sidebarOpen ? 224 : 64, flexShrink: 0,
        background: '#0b1829', borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        transition: 'width .3s', overflow: 'hidden',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, minHeight: 64 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: C.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0, boxShadow: `0 4px 12px ${C.orangeBorder}`,
          }}>🚌</div>
          {sidebarOpen && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2, letterSpacing: -0.5 }}>
                S<span style={{ color: C.orange }}>O</span>KORA
              </div>
              <div style={{ fontSize: 9, color: C.orange, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>VOYAGES &amp; TRANSPORT</div>
            </div>
          )}
        </div>

        {/* Company selector */}
        {sidebarOpen && company && (
          <div style={{ margin: '12px 10px', padding: '10px 12px', background: C.orangePale, borderRadius: 10, border: `1px solid ${C.orangeBorder}` }}>
            <div style={{ fontSize: 9, color: C.orange, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Compagnie active</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: C.white }}>{company.name}</div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => (
            <button key={item.id}
              onClick={() => setScreen(item.id)}
              className={screen === item.id ? 'ni on' : 'ni'}
              style={{
                padding: sidebarOpen ? '10px 13px' : '10px',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User + logout */}
        <div style={{ padding: '12px', borderTop: `1px solid ${C.border}` }}>
          {sidebarOpen && (
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              👤 {user.full_name || user.phone_number}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ width: '100%', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
            <span>🚪</span>{sidebarOpen && ' Déconnexion'}
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ height: 60, background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0, position: 'sticky', top: 0, zIndex: 50 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <h1 style={{ fontSize: 16, fontWeight: 800, flex: 1, color: C.white, letterSpacing: -0.3 }}>
            {NAV.find(n => n.id === screen)?.icon} {NAV.find(n => n.id === screen)?.label}
          </h1>
          {!company && screen !== 'companies' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setScreen('companies')} style={{ color: C.gold, borderColor: C.gold + '44' }}>
              ⚠️ Sélectionner une compagnie
            </button>
          )}
          <div style={{ fontSize: 12, color: C.muted }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24, background: C.bg }}>
          {renderScreen()}
        </div>
      </div>
    </div>
    </>
  );
}
