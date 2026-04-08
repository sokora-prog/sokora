import { useState, useEffect, useCallback, useRef } from 'react';
import { authApi, hotelApi, roomApi, roomTypeApi, reservationApi, seasonApi, reviewApi, transactionApi, financeApi, loyaltyApi } from './services/api';

/* ═══════════════════════════════════════════════════════════════
   CHARTE GRAPHIQUE SOKORA OFFICIELLE v3
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

const CI_CITIES = [
  'Abidjan','Yamoussoukro','Bouaké','Daloa','San-Pédro','Korhogo','Man','Gagnoa',
  'Abengourou','Divo','Soubré','Odienné','Bondoukou','Séguéla','Ferkessédougou',
  'Katiola','Aboisso','Adzopé','Agboville','Anyama','Bingerville','Grand-Bassam',
  'Grand-Lahou','Guiglo','Issia','Jacqueville','Lakota','Sassandra','Tiassalé',
  'Toumodi','Vavoua','Zuénoula','Tabou','Boundiali','Tengréla','Bouna','Dabou',
  'Duekoué','Sinfra','Oumé','Dimbokro','Bongouanou',
];

const ROOM_STATUS_CONFIG = {
  AVAILABLE:   { label: 'Disponible',  bg: C.greenPale,  c: C.green,  dot: C.green },
  OCCUPIED:    { label: 'Occupée',     bg: C.orangePale, c: C.orange, dot: C.orange },
  RESERVED:    { label: 'Réservée',    bg: C.tealPale,   c: C.teal,   dot: C.teal },
  CLEANING:    { label: 'Ménage',      bg: C.purplePale, c: C.purple, dot: C.purple },
  MAINTENANCE: { label: 'Maintenance', bg: C.redPale,    c: C.red,    dot: C.red },
  BLOCKED:     { label: 'Bloquée',     bg: `${C.border}44`,  c: C.muted,  dot: C.muted },
};

const RESA_STATUS = {
  PENDING:    { label: 'En attente', c: C.mutedLight, bg: `${C.border}33` },
  CONFIRMED:  { label: 'Confirmée',  c: C.orange,     bg: C.orangePale },
  CHECKED_IN: { label: 'En cours',   c: C.green,      bg: C.greenPale },
  COMPLETED:  { label: 'Terminée',   c: C.teal,       bg: C.tealPale },
  CANCELLED:  { label: 'Annulée',    c: C.red,        bg: C.redPale },
  NO_SHOW:    { label: 'No-show',    c: C.red,        bg: C.redPale },
};

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';

/* ═══════════════════════════════════════════════════════════════
   GLOBAL STYLES
═══════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #0f1e35;
  color: #FFFFFF;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: #0b1829; }
::-webkit-scrollbar-thumb { background: #243a5e; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #FF6B35; }

.spin { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeIn .25s ease forwards; }

.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }

button { cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; }

input, select, textarea {
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: #0b1829;
  color: #FFFFFF;
  border: 1.5px solid #1e3557;
  border-radius: 10px;
  padding: 11px 14px;
  font-size: 13px;
  outline: none;
  width: 100%;
  transition: border-color .2s, box-shadow .2s;
}
input:focus, select:focus, textarea:focus {
  border-color: #FF6B35;
  box-shadow: 0 0 0 3px rgba(255,107,53,.1);
}
input::placeholder, textarea::placeholder { color: #6B7A99; }
select option { background: #0b1829; }

label {
  font-size: 11px;
  font-weight: 700;
  color: #8A9BC0;
  letter-spacing: .7px;
  text-transform: uppercase;
  display: block;
  margin-bottom: 7px;
}

/* Layout */
.app { display: flex; min-height: 100vh; background: #0f1e35; }
.sb { width: 240px; min-height: 100vh; background: #0b1829; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; z-index: 100; border-right: 1px solid #1e3557; }
.sb-logo { padding: 22px 20px 18px; border-bottom: 1px solid #1e355740; }
.sb-sect { padding: 18px 20px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,.2); font-weight: 700; }
.sb-nav { padding: 0 10px; flex: 1; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.ni { display: flex; align-items: center; gap: 11px; padding: 10px 13px; border-radius: 10px; cursor: pointer; font-size: 13px; color: rgba(255,255,255,.4); font-weight: 500; transition: all .18s; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans',sans-serif; }
.ni:hover { background: rgba(255,255,255,.05); color: rgba(255,255,255,.75); }
.ni.on { background: linear-gradient(135deg, #FF6B35 0%, #E8501A 100%); color: #fff; font-weight: 700; box-shadow: 0 4px 16px rgba(255,107,53,.35); }
.sb-foot { margin: 10px 10px 16px; background: rgba(255,255,255,.03); border: 1px solid #1e3557; border-radius: 12px; padding: 14px 16px; }

/* Main */
.main { margin-left: 240px; flex: 1; display: flex; flex-direction: column; }
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

/* Cards / Tables */
.card { background: #1a2e4a; border-radius: 16px; border: 1px solid #1e3557; overflow: hidden; margin-bottom: 20px; }
.dt { width: 100%; border-collapse: collapse; font-size: 13px; }
.dt th { text-align: left; padding: 11px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6B7A99; border-bottom: 1px solid #1e3557; font-weight: 700; background: #0b1829; }
.dt td { padding: 12px 16px; border-bottom: 1px solid #1e355760; vertical-align: middle; color: #E8EDF5; }
.dt tr:last-child td { border-bottom: none; }
.dt tr:hover td { background: #243a5e; }

/* Buttons */
.btn { padding: 8px 16px; border-radius: 9px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans',sans-serif; display: inline-flex; align-items: center; gap: 6px; transition: all .18s; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary { background: linear-gradient(135deg, #FF6B35, #E8501A); color: #fff; box-shadow: 0 3px 10px rgba(255,107,53,.35); }
.btn-primary:hover:not(:disabled) { box-shadow: 0 5px 16px rgba(255,107,53,.5); transform: translateY(-1px); }
.btn-ghost { background: transparent; color: #8A9BC0; border: 1.5px solid #1e3557; }
.btn-ghost:hover:not(:disabled) { border-color: #FF6B35; color: #FF6B35; }
.btn-teal { background: linear-gradient(135deg, #00D4AA, #00B090); color: #fff; box-shadow: 0 3px 10px rgba(0,212,170,.3); }
.btn-danger { background: #E74C3C12; color: #E74C3C; border: 1px solid #E74C3C44; }
.btn-danger:hover:not(:disabled) { background: #E74C3C; color: #fff; }
.btn-sm { padding: 5px 11px; font-size: 12px; }

/* Tabs */
.tabs { display: flex; gap: 5px; margin-bottom: 18px; flex-wrap: wrap; }
.tab { padding: 6px 14px; border-radius: 8px; font-size: 12.5px; cursor: pointer; border: 1.5px solid #1e3557; background: transparent; color: #6B7A99; font-weight: 500; transition: all .18s; font-family: 'Plus Jakarta Sans',sans-serif; }
.tab:hover { border-color: rgba(255,107,53,.4); color: #FF6B35; }
.tab.on { background: #FF6B35; color: #fff; border-color: #FF6B35; font-weight: 700; box-shadow: 0 3px 10px rgba(255,107,53,.3); }

/* Login */
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 20% 50%, #0F1E3A 0%, #0f1e35 60%); }
.login-card { background: #0b1829; border: 1px solid #1e3557; border-radius: 22px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 32px 80px rgba(0,0,0,.6); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.75); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; backdrop-filter: blur(4px); }
.modal { background: #1a2e4a; border: 1.5px solid #FF6B3540; border-radius: 20px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,.6); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #1e3557; }
.modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.modal-footer { padding: 16px 24px; border-top: 1px solid #1e3557; display: flex; gap: 10px; justify-content: flex-end; }
`;

/* ═══════════════════════════════════════════════════════════════
   COMPOSANTS UI
═══════════════════════════════════════════════════════════════ */
const Spinner = ({ size = 20, color = C.orange }) => (
  <div className="spin" style={{
    width: size, height: size,
    border: `2.5px solid ${C.border}`,
    borderTopColor: color,
    borderRadius: '50%',
    flexShrink: 0,
  }} />
);

const Badge = ({ status, config }) => {
  const cfg = config?.[status] || { label: status, bg: C.card, c: C.muted, dot: C.muted };
  return (
    <span style={{
      background: cfg.bg, color: cfg.c,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', gap: 5,
      border: `1px solid ${cfg.c}33`,
    }}>
      {cfg.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />}
      {cfg.label}
    </span>
  );
};

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: C.card,
    border: `1.5px solid ${C.border}`,
    borderRadius: 16,
    padding: '20px 22px',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'border-color .2s, transform .15s, box-shadow .2s',
    ...style,
  }}
  onMouseEnter={e => {
    if (onClick) {
      e.currentTarget.style.borderColor = C.orange;
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 8px 24px ${C.orangePale}`;
    }
  }}
  onMouseLeave={e => {
    if (onClick) {
      e.currentTarget.style.borderColor = C.border;
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }
  }}
  >
    {children}
  </div>
);

const KPICard = ({ label, value, sub, icon, color = C.orange }) => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: `${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>{icon}</div>
      <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' }}>{label}</span>
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</div>}
  </Card>
);

const OrangeBtn = ({ children, onClick, disabled, style = {}, variant = 'filled' }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: variant === 'filled'
      ? `linear-gradient(135deg, ${C.orange}, ${C.orangeHov})`
      : 'transparent',
    color: variant === 'filled' ? C.white : C.orange,
    border: `1.5px solid ${C.orange}`,
    borderRadius: 10,
    padding: '10px 20px',
    fontWeight: 700,
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    opacity: disabled ? .5 : 1,
    transition: 'all .2s',
    letterSpacing: '.2px',
    boxShadow: variant === 'filled' ? `0 4px 16px ${C.orangePale}` : 'none',
    ...style,
  }}
  onMouseEnter={e => {
    if (!disabled) {
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.boxShadow = `0 8px 24px ${C.orangeBorder}`;
    }
  }}
  onMouseLeave={e => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = variant === 'filled' ? `0 4px 16px ${C.orangePale}` : 'none';
  }}
  >
    {children}
  </button>
);

const BlueBtn = ({ children, onClick, disabled, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: C.teal,
    color: C.white,
    border: 'none',
    borderRadius: 10,
    padding: '10px 20px',
    fontWeight: 700,
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    opacity: disabled ? .5 : 1,
    transition: 'all .2s',
    ...style,
  }}>
    {children}
  </button>
);

const Modal = ({ title, onClose, children }) => (
  <div style={{
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,.75)',
    zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
    backdropFilter: 'blur(4px)',
  }}>
    <div className="fade-in" style={{
      background: C.card,
      border: `1.5px solid ${C.orangeBorder}`,
      borderRadius: 20,
      width: '100%', maxWidth: 520,
      maxHeight: '90vh', overflowY: 'auto',
      boxShadow: `0 24px 64px rgba(0,0,0,.6)`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: C.white }}>{title}</h3>
        <button onClick={onClose} style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, color: C.muted, width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700,
        }}>✕</button>
      </div>
      <div style={{ padding: '24px' }}>{children}</div>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label>{label}</label>
    {children}
  </div>
);

const SectionTitle = ({ icon, title, sub, action }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: C.orangePale,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>{icon}</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.white }}>{title}</h2>
      </div>
      {sub && <p style={{ fontSize: 12, color: C.muted, marginLeft: 46 }}>{sub}</p>}
    </div>
    {action}
  </div>
);

const ErrorBox = ({ msg }) => msg ? (
  <div style={{
    background: C.redPale, border: `1px solid ${C.red}44`,
    borderRadius: 10, padding: '10px 14px',
    marginBottom: 16, fontSize: 12, color: C.red,
    display: 'flex', alignItems: 'center', gap: 8,
  }}>
    ⚠️ {msg}
  </div>
) : null;

const Toast = ({ msg, onClose }) => msg ? (
  <div style={{
    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
    background: C.teal, color: '#fff',
    padding: '12px 20px', borderRadius: 12,
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,.3)',
    animation: 'fadeIn .3s ease',
    fontSize: 13, fontWeight: 600,
  }}>
    ✓ {msg}
    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, marginLeft: 4 }}>✕</button>
  </div>
) : null;

/* ═══════════════════════════════════════════════════════════════
   LOGO SOKORA
═══════════════════════════════════════════════════════════════ */
const SokoraLogo = ({ size = 'md' }) => {
  const big = size === 'lg';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: big ? 12 : 8 }}>
      <div style={{
        width: big ? 48 : 36, height: big ? 48 : 36,
        background: C.orange, borderRadius: big ? 14 : 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 24 24" width={big ? 28 : 20} fill="white">
          <path d="M1 6c0-2.76 2.24-5 5-5h12c2.76 0 5 2.24 5 5v12c0 2.76-2.24 5-5 5H6c-2.76 0-5-2.24-5-5V6z" fill="transparent"/>
          <path d="M12 4.5c-4.14 0-7.5 3.36-7.5 7.5s3.36 7.5 7.5 7.5 7.5-3.36 7.5-7.5S16.14 4.5 12 4.5zm0 2c1.38 0 2.5 1.12 2.5 2.5S13.38 11.5 12 11.5 9.5 10.38 9.5 9s1.12-2.5 2.5-2.5zm0 10.5c-1.88 0-3.54-.96-4.5-2.4.02-1.5 3-2.32 4.5-2.32 1.5 0 4.48.82 4.5 2.32-.96 1.44-2.62 2.4-4.5 2.4z"/>
        </svg>
      </div>
      <div>
        <div style={{
          fontWeight: 800,
          fontSize: big ? 24 : 18,
          color: C.white,
          letterSpacing: '-0.5px',
          lineHeight: 1,
        }}>
          S<span style={{ color: C.orange }}>O</span>KORA
        </div>
        <div style={{ fontSize: big ? 10 : 9, color: C.orange, letterSpacing: '1px', marginTop: 1, fontWeight: 700 }}>
          HOTEL & RÉSIDENCES
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   LOGIN SCREEN
═══════════════════════════════════════════════════════════════ */
function LoginScreen({ onLogin }) {
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:10, background:'#0b1829', border:`1.5px solid ${C.border}`, color:C.white, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' };

  const handleLogin = async () => {
    if (!phone || !password) return;
    setLoading(true); setError('');
    try {
      const { data } = await authApi.login(phone, password);
      localStorage.setItem('hotel_token', data.access_token);
      localStorage.setItem('hotel_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) {
      setError(e.response?.data?.detail || 'Numéro ou mot de passe incorrect');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', position: 'relative', overflow: 'hidden' }}>
      {/* Panel gauche — décoratif */}
      <div style={{
        width: '45%',
        background: `linear-gradient(160deg, #0F1E3A 0%, #0f1e35 100%)`,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 50px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: `${C.orange}15`, border: `1px solid ${C.orange}22` }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: `${C.teal}10` }} />

        <SokoraLogo size="lg" />

        <div style={{ marginTop: 48 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: C.white, lineHeight: 1.2, marginBottom: 16 }}>
            Gérez votre hôtel<br />
            <span style={{ color: C.orange }}>en temps réel</span>
          </h1>
          <p style={{ fontSize: 14, color: C.mutedLight, lineHeight: 1.7 }}>
            Réservations, check-in, paiements escrow et suivi d'occupation — tout en un seul tableau de bord.
          </p>
        </div>

        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {['Réservation avec Wallet SOKORA', 'Check-in QR Code sécurisé', 'Yield management intégré'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✓</div>
              <span style={{ fontSize: 13, color: C.mutedLight }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel droit — formulaire login */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
        <div className="fade-in" style={{ width:'100%', maxWidth:400 }}>

          <div style={{ marginBottom:32 }}>
            <h2 style={{ fontSize:24, fontWeight:800, color:C.white, marginBottom:6 }}>Espace Gérant Hôtel</h2>
            <p style={{ fontSize:13, color:C.muted }}>Connectez-vous pour accéder à votre tableau de bord hôtel</p>
          </div>

          {error && <div style={{ padding:'10px 14px', borderRadius:8, background:'#ef444418', border:'1px solid #ef444440', color:'#f87171', fontSize:12, marginBottom:20 }}>{error}</div>}

          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, fontWeight:600, color:C.muted, display:'block', marginBottom:6 }}>Numéro de téléphone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0700000000" style={inputStyle} onKeyDown={e => e.key==='Enter' && handleLogin()} autoFocus />
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:12, fontWeight:600, color:C.muted, display:'block', marginBottom:6 }}>Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" style={inputStyle} onKeyDown={e => e.key==='Enter' && handleLogin()} autoComplete="new-password" />
          </div>

          <OrangeBtn onClick={handleLogin} disabled={loading || !phone || !password} style={{ width:'100%', justifyContent:'center', padding:'13px 20px', fontSize:14 }}>
            {loading ? <Spinner size={18} color={C.white} /> : 'Se connecter →'}
          </OrangeBtn>

          <p style={{ textAlign:'center', fontSize:11, color:C.muted, marginTop:28 }}>
            SOKORA Hôtel · Hôtellerie Africaine · v3.0
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SETUP HOTEL
═══════════════════════════════════════════════════════════════ */
function SetupHotel({ onDone }) {
  const [form, setForm] = useState({
    name: '', address: '', city: 'Abidjan', country: 'CI',
    description: '', checkin_time: '14:00', checkout_time: '12:00',
    cleaning_fee: 0, no_show_penalty_pct: 50,
    cancellation_hours: 24, template: 'BUSINESS',
    latitude: '', longitude: '',
  });
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState('');
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const detectGPS = () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      pos => { upd('latitude', pos.coords.latitude.toFixed(6)); upd('longitude', pos.coords.longitude.toFixed(6)); setDetecting(false); },
      () => setDetecting(false)
    );
  };

  const handleSubmit = async () => {
    if (!form.name || !form.address) { setError('Nom et adresse requis'); return; }
    setLoading(true);
    try {
      const payload = { ...form };
      if (payload.latitude)  payload.latitude  = parseFloat(payload.latitude);
      else delete payload.latitude;
      if (payload.longitude) payload.longitude = parseFloat(payload.longitude);
      else delete payload.longitude;
      await hotelApi.setup(payload);
      onDone();
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur configuration');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: 580 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <SokoraLogo size="lg" />
          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.white, marginTop: 24, marginBottom: 8 }}>
            Configuration de votre hôtel
          </h2>
          <p style={{ fontSize: 13, color: C.muted }}>Remplissez les informations de base pour démarrer</p>
        </div>

        <Card>
          <ErrorBox msg={error} />
          <div className="grid-2">
            <Field label="Nom de l'hôtel *">
              <input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Grand Hôtel Abidjan" />
            </Field>
            <Field label="Ville">
              <select value={form.city} onChange={e => upd('city', e.target.value)}>
                <option value="">— Choisir une ville —</option>
                {CI_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Adresse *">
            <input value={form.address} onChange={e => upd('address', e.target.value)} placeholder="Plateau, Boulevard de la République" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={e => upd('description', e.target.value)} rows={2} placeholder="Décrivez votre établissement..." />
          </Field>
          <div className="grid-2">
            <Field label="Check-in">
              <input value={form.checkin_time} onChange={e => upd('checkin_time', e.target.value)} type="time" />
            </Field>
            <Field label="Check-out">
              <input value={form.checkout_time} onChange={e => upd('checkout_time', e.target.value)} type="time" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Frais de ménage (F)">
              <input value={form.cleaning_fee} onChange={e => upd('cleaning_fee', +e.target.value)} type="number" />
            </Field>
            <Field label="Pénalité no-show (%)">
              <input value={form.no_show_penalty_pct} onChange={e => upd('no_show_penalty_pct', +e.target.value)} type="number" />
            </Field>
          </div>
          <Field label="Template">
            <select value={form.template} onChange={e => upd('template', e.target.value)}>
              <option value="LUXE">Luxe</option>
              <option value="BUSINESS">Business</option>
              <option value="STUDIO_URBAIN">Studio Urbain</option>
              <option value="VILLA_VACANCES">Villa Vacances</option>
              <option value="AUBERGE">Auberge</option>
            </select>
          </Field>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              📍 Localisation GPS <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optionnel — pour la recherche de proximité)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
              <Field label="Latitude">
                <input value={form.latitude} onChange={e => upd('latitude', e.target.value)} placeholder="ex: 5.319600" />
              </Field>
              <Field label="Longitude">
                <input value={form.longitude} onChange={e => upd('longitude', e.target.value)} placeholder="ex: -4.019500" />
              </Field>
              <button type="button" onClick={detectGPS} disabled={detecting} style={{ padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${C.orange}`, background: 'transparent', color: C.orange, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: 0 }}>
                {detecting ? '...' : '📡 Détecter'}
              </button>
            </div>
          </div>
          <OrangeBtn onClick={handleSubmit} disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
            {loading ? <Spinner size={16} color={C.white} /> : 'Configurer mon hôtel →'}
          </OrangeBtn>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GPS WIDGET HOTEL
═══════════════════════════════════════════════════════════════ */
function HotelGpsCard({ hotel }) {
  const [lat, setLat] = useState(hotel?.latitude ? String(hotel.latitude) : '');
  const [lng, setLng] = useState(hotel?.longitude ? String(hotel.longitude) : '');
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [msg, setMsg] = useState(null);

  const detect = () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6)); setDetecting(false); },
      () => setDetecting(false)
    );
  };

  const save = async () => {
    if (!lat || !lng) return;
    setSaving(true); setMsg(null);
    try {
      await hotelApi.update(hotel.id, { latitude: parseFloat(lat), longitude: parseFloat(lng) });
      setMsg('ok');
      setTimeout(() => setMsg(null), 3000);
    } catch { setMsg('err'); } finally { setSaving(false); }
  };

  const hasGps = hotel?.latitude && hotel?.longitude;
  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          📍 Localisation GPS
        </div>
        {hasGps && (
          <span style={{ fontSize: 11, color: C.teal, background: C.tealPale, border: `1px solid ${C.tealBorder}`, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
            ✓ {Number(hotel.latitude).toFixed(4)}, {Number(hotel.longitude).toFixed(4)}
          </span>
        )}
        {!hasGps && (
          <span style={{ fontSize: 11, color: C.muted, background: `${C.border}33`, borderRadius: 20, padding: '3px 10px' }}>
            GPS non défini
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, alignItems: 'end' }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Latitude</div>
          <input value={lat} onChange={e => setLat(e.target.value)} placeholder="ex: 5.319600" style={{ fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Longitude</div>
          <input value={lng} onChange={e => setLng(e.target.value)} placeholder="ex: -4.019500" style={{ fontSize: 13 }} />
        </div>
        <button onClick={detect} disabled={detecting} className="btn btn-ghost" style={{ height: 42 }}>
          {detecting ? '...' : '📡 Détecter'}
        </button>
        <button onClick={save} disabled={saving || !lat || !lng} className="btn btn-primary" style={{ height: 42, opacity: (!lat || !lng) ? 0.5 : 1 }}>
          {saving ? <Spinner size={14} color={C.white} /> : 'Enregistrer'}
        </button>
      </div>
      {msg === 'ok'  && <div style={{ marginTop: 8, fontSize: 12, color: C.teal,  fontWeight: 600 }}>✓ GPS mis à jour</div>}
      {msg === 'err' && <div style={{ marginTop: 8, fontSize: 12, color: C.red,   fontWeight: 600 }}>⚠ Erreur lors de la sauvegarde</div>}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD  — Bug #2 corrigé : refresh auto 30s + indicateur
═══════════════════════════════════════════════════════════════ */
function DashboardScreen({ hotel }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [secAgo, setSecAgo] = useState(0);

  const loadData = useCallback(() => {
    hotelApi.dashboard(hotel.id)
      .then(r => { setData(r.data); setLastRefresh(Date.now()); setSecAgo(0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hotel.id]);

  // Premier chargement + interval 30s
  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 30000);
    return () => clearInterval(iv);
  }, [loadData]);

  // Compteur "il y a X secondes"
  useEffect(() => {
    const tick = setInterval(() => {
      setSecAgo(Math.floor((Date.now() - lastRefresh) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastRefresh]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>;
  if (!data) return <div style={{ color: C.muted, textAlign: 'center', padding: 40 }}>Erreur de chargement</div>;

  const taux = data.occupancy_rate_pct || 0;

  const refreshLabel = secAgo < 5
    ? 'À l\'instant'
    : secAgo < 60
      ? `Il y a ${secAgo}s`
      : `Il y a ${Math.floor(secAgo / 60)}min`;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <SectionTitle icon="📊" title="Vue d'ensemble" sub={`Aujourd'hui · ${data.today}`} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 20, padding: '5px 12px', fontSize: 11, color: C.muted,
          flexShrink: 0,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block', animation: 'spin 2s linear infinite' }} />
          {refreshLabel}
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPICard icon="🏨" label="Taux occupation" value={`${taux}%`}
          sub={`${data.occupied_rooms}/${data.total_rooms} chambres`}
          color={taux > 70 ? C.green : taux > 40 ? C.orange : C.red} />
        <KPICard icon="💰" label="CA du mois" value={fmt(data.ca_month)} sub="Revenus nets" color={C.orange} />
        <KPICard icon="✈️" label="Arrivées" value={data.checkins_today} sub="Aujourd'hui" color={C.teal} />
        <KPICard icon="🚪" label="Départs" value={data.checkouts_today} sub="Aujourd'hui" color={C.mutedLight} />
      </div>

      {/* Barre occupation */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Occupation des chambres</span>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Disponibles', val: data.available_rooms, c: C.green },
              { label: 'Occupées', val: data.occupied_rooms, c: C.orange },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.c, display: 'inline-block' }} />
                <span style={{ color: C.muted }}>{s.label}:</span>
                <span style={{ fontWeight: 700, color: s.c }}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 10, background: C.surface, borderRadius: 5, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${taux}%`,
            background: taux > 70 ? C.green : taux > 40 ? C.orange : C.red,
            borderRadius: 5,
            transition: 'width 1s ease',
          }} />
        </div>
      </Card>

      {/* LOCALISATION GPS */}
      <HotelGpsCard hotel={hotel} />

      {/* Prochaines arrivées */}
      {data.next_arrivals?.length > 0 && (
        <Card>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: C.orange }}>→</span> Prochaines arrivées (7 jours)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.next_arrivals.map(r => (
              <div key={r.reservation_id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                background: C.surface,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: C.white, fontSize: 14 }}>{r.client_name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    Chambre {r.room_number} · {r.nights} nuit(s)
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: C.orange, fontWeight: 700, fontSize: 13 }}>{fmtDate(r.checkin_date)}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmt(r.total_amount)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHAMBRES
═══════════════════════════════════════════════════════════════ */
function RoomsScreen({ hotel }) {
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddType, setShowAddType] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    const [r, rt] = await Promise.all([roomApi.list(hotel.id), roomTypeApi.list(hotel.id)]);
    setRooms(r.data || []); setRoomTypes(rt.data || []); setLoading(false);
  }, [hotel.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const updateStatus = async (roomId, status) => {
    setUpdatingId(roomId);
    try { await roomApi.updateStatus(hotel.id, roomId, status); await load(); } finally { setUpdatingId(null); }
  };

  const statusCounts = {};
  rooms.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>;

  return (
    <div className="fade-in">
      <SectionTitle icon="🛏️" title="Chambres" sub={`${rooms.length} chambres · ${roomTypes.length} types`}
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <OrangeBtn variant="outline" onClick={() => setShowAddType(true)} style={{ fontSize: 12, padding: '8px 16px' }}>+ Type</OrangeBtn>
            <OrangeBtn onClick={() => setShowAddRoom(true)} style={{ fontSize: 12, padding: '8px 16px' }}>+ Chambre</OrangeBtn>
          </div>
        }
      />

      {/* Résumé statuts */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(ROOM_STATUS_CONFIG).map(([k, v]) => (
          <div key={k} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: v.bg, border: `1px solid ${v.c}33`,
            borderRadius: 20, padding: '5px 12px',
            fontSize: 11, color: v.c, fontWeight: 700,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: v.dot }} />
            {v.label} ({statusCounts[k] || 0})
          </div>
        ))}
      </div>

      {rooms.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛏️</div>
          <div style={{ color: C.muted, marginBottom: 20 }}>Aucune chambre configurée</div>
          {roomTypes.length === 0 && <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Commencez par créer un type de chambre</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <OrangeBtn variant="outline" onClick={() => setShowAddType(true)}>+ Type de chambre</OrangeBtn>
            {roomTypes.length > 0 && <OrangeBtn onClick={() => setShowAddRoom(true)}>+ Chambre</OrangeBtn>}
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
          {rooms.map(room => {
            const cfg = ROOM_STATUS_CONFIG[room.status] || ROOM_STATUS_CONFIG.AVAILABLE;
            return (
              <Card key={room.id} style={{ borderColor: `${cfg.c}33` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.orange }}>#{room.number}</div>
                  <Badge status={room.status} config={ROOM_STATUS_CONFIG} />
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>
                  {room.room_type?.name || '—'} · Étage {room.floor}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                  {room.room_type?.bed_type} · {room.room_type?.capacity} pers.
                </div>
                {room.room_type?.base_price && (
                  <div style={{ fontSize: 14, color: C.orange, fontWeight: 800, marginBottom: 12 }}>
                    {fmt(room.room_type.base_price)}<span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>/nuit</span>
                  </div>
                )}
                <select value={room.status} onChange={e => updateStatus(room.id, e.target.value)}
                  disabled={updatingId === room.id}
                  style={{ fontSize: 11, padding: '7px 10px', borderRadius: 8 }}>
                  {Object.entries(ROOM_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Card>
            );
          })}
        </div>
      )}

      {showAddType && <AddRoomTypeModal hotelId={hotel.id} onClose={() => { setShowAddType(false); load(); }} />}
      {showAddRoom && <AddRoomModal hotelId={hotel.id} roomTypes={roomTypes} onClose={() => { setShowAddRoom(false); load(); }} />}
    </div>
  );
}

function AddRoomTypeModal({ hotelId, onClose }) {
  const [form, setForm] = useState({ name: '', bed_type: 'DOUBLE', capacity: 2, base_price: '' });
  const [loading, setLoading] = useState(false);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = async () => {
    setLoading(true);
    try { await roomTypeApi.create(hotelId, { ...form, base_price: +form.base_price, capacity: +form.capacity }); onClose(); }
    finally { setLoading(false); }
  };
  return (
    <Modal title="Nouveau type de chambre" onClose={onClose}>
      <Field label="Nom"><input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Suite Présidentielle" /></Field>
      <div className="grid-2">
        <Field label="Type de lit">
          <select value={form.bed_type} onChange={e => upd('bed_type', e.target.value)}>
            {['SIMPLE','DOUBLE','TWIN','KING','SUITE'].map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Capacité"><input value={form.capacity} onChange={e => upd('capacity', e.target.value)} type="number" min={1} /></Field>
      </div>
      <Field label="Prix/nuit (F CFA)"><input value={form.base_price} onChange={e => upd('base_price', e.target.value)} type="number" placeholder="45000" /></Field>
      <OrangeBtn onClick={handleSubmit} disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
        {loading ? <Spinner size={16} color={C.white} /> : 'Créer le type'}
      </OrangeBtn>
    </Modal>
  );
}

function AddRoomModal({ hotelId, roomTypes, onClose }) {
  const [form, setForm] = useState({ number: '', floor: 1, room_type_id: roomTypes[0]?.id || '' });
  const [loading, setLoading] = useState(false);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = async () => {
    setLoading(true);
    try { await roomApi.create(hotelId, { ...form, floor: +form.floor, room_type_id: +form.room_type_id }); onClose(); }
    finally { setLoading(false); }
  };
  return (
    <Modal title="Nouvelle chambre" onClose={onClose}>
      <div className="grid-2">
        <Field label="Numéro"><input value={form.number} onChange={e => upd('number', e.target.value)} placeholder="101" /></Field>
        <Field label="Étage"><input value={form.floor} onChange={e => upd('floor', e.target.value)} type="number" min={0} /></Field>
      </div>
      <Field label="Type de chambre">
        <select value={form.room_type_id} onChange={e => upd('room_type_id', e.target.value)}>
          {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name} — {fmt(rt.base_price)}/nuit</option>)}
        </select>
      </Field>
      <OrangeBtn onClick={handleSubmit} disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
        {loading ? <Spinner size={16} color={C.white} /> : 'Ajouter'}
      </OrangeBtn>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EDIT RESERVATION MODAL
═══════════════════════════════════════════════════════════════ */
function EditReservationModal({ hotel, reservation, onClose, onSaved }) {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({
    checkin_date:  reservation.checkin_date  ? reservation.checkin_date.slice(0, 10)  : '',
    checkout_date: reservation.checkout_date ? reservation.checkout_date.slice(0, 10) : '',
    room_id:       reservation.room_id || '',
    status:        reservation.status || 'PENDING',
    notes:         reservation.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    roomApi.list(hotel.id).then(r => setRooms(r.data || [])).catch(() => {});
  }, [hotel.id]);

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      await reservationApi.update(reservation.id, form);
      onSaved();
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally { setLoading(false); }
  };

  return (
    <Modal title={`Éditer réservation — ${reservation.client_name}`} onClose={onClose}>
      <ErrorBox msg={error} />
      <div className="grid-2">
        <Field label="Date d'arrivée">
          <input type="date" value={form.checkin_date} onChange={e => upd('checkin_date', e.target.value)} />
        </Field>
        <Field label="Date de départ">
          <input type="date" value={form.checkout_date} onChange={e => upd('checkout_date', e.target.value)} />
        </Field>
      </div>
      <Field label="Chambre">
        <select value={form.room_id} onChange={e => upd('room_id', e.target.value)}>
          <option value="">— Conserver actuelle —</option>
          {rooms.map(r => (
            <option key={r.id} value={r.id}>
              #{r.number} · {r.room_type?.name || ''}
              {r.room_type?.base_price ? ` — ${fmt(r.room_type.base_price)}/nuit` : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Statut">
        <select value={form.status} onChange={e => upd('status', e.target.value)}>
          {Object.entries(RESA_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Notes">
        <textarea rows={3} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="Notes internes..." />
      </Field>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onClose} className="btn btn-ghost">Annuler</button>
        <OrangeBtn onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner size={16} color={C.white} /> : '✓ Enregistrer'}
        </OrangeBtn>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RÉSERVATIONS  — Bug #3 corrigé : pagination + édition/suppression
═══════════════════════════════════════════════════════════════ */
function ReservationsScreen({ hotel, showToast }) {
  const [reservations, setReservations] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [page, setPage] = useState(1);
  const [editModal, setEditModal] = useState(null);       // reservation object
  const [deleteModal, setDeleteModal] = useState(null);   // reservation object
  const [deleteLoading, setDeleteLoading] = useState(false);
  const perPage = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const r = await reservationApi.list(hotel.id, filter || undefined);
    setReservations(r.data || []); setLoading(false);
    setPage(1);
  }, [hotel.id, filter]);

  useEffect(() => { load(); }, [load]);

  const handleNoShow = async (id) => {
    if (!window.confirm('Déclarer ce client en no-show ?')) return;
    setProcessing(id);
    try { await reservationApi.noShow(id); await load(); } finally { setProcessing(null); }
  };

  const handleCheckout = async (id) => {
    setProcessing(id);
    try { await reservationApi.checkout(id); await load(); } finally { setProcessing(null); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      await reservationApi.delete(deleteModal.id);
      setDeleteModal(null);
      await load();
      showToast && showToast('Réservation supprimée');
    } catch (e) {
      alert(e.response?.data?.detail || 'Erreur lors de la suppression');
    } finally { setDeleteLoading(false); }
  };

  const totalPages = Math.ceil(reservations.length / perPage);
  const start = (page - 1) * perPage;
  const end = Math.min(start + perPage, reservations.length);
  const pageItems = reservations.slice(start, end);

  return (
    <div className="fade-in">
      <SectionTitle icon="📅" title="Réservations" />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => {
          const label = s ? (RESA_STATUS[s]?.label || s) : 'Toutes';
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              background: filter === s ? C.orange : C.card,
              color: filter === s ? C.white : C.mutedLight,
              border: `1.5px solid ${filter === s ? C.orange : C.border}`,
              borderRadius: 20, padding: '6px 16px',
              fontSize: 12, fontWeight: 700, transition: 'all .2s',
            }}>
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={32} /></div>
      ) : reservations.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ color: C.muted }}>Aucune réservation</div>
        </Card>
      ) : (
        <>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
            {start + 1}–{end} de {reservations.length} réservation{reservations.length > 1 ? 's' : ''}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pageItems.map(r => (
              <Card key={r.id}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: C.white }}>{r.client_name}</span>
                      <Badge status={r.status} config={RESA_STATUS} />
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      Chambre <strong style={{ color: C.orange }}>{r.room_number}</strong> · {r.nights} nuit(s) · {fmtDate(r.checkin_date)} → {fmtDate(r.checkout_date)}
                    </div>
                    {r.special_requests && <div style={{ fontSize: 11, color: C.teal, marginTop: 4 }}>💬 {r.special_requests}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: C.orange, fontWeight: 800, fontSize: 17 }}>{fmt(r.hotel_amount)}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>Total client: {fmt(r.total_amount)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.status === 'CHECKED_IN' && (
                    <OrangeBtn variant="outline" onClick={() => handleCheckout(r.id)} disabled={processing === r.id} style={{ fontSize: 11, padding: '6px 14px' }}>
                      {processing === r.id ? <Spinner size={12} /> : '🔑 Check-out'}
                    </OrangeBtn>
                  )}
                  {r.status === 'CONFIRMED' && (
                    <button onClick={() => handleNoShow(r.id)} disabled={processing === r.id} style={{
                      background: C.redPale, color: C.red, border: `1px solid ${C.red}44`,
                      borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 700,
                    }}>
                      {processing === r.id ? <Spinner size={12} /> : '⚠️ No-show'}
                    </button>
                  )}
                  {/* Éditer */}
                  <button
                    onClick={() => setEditModal(r)}
                    title="Éditer"
                    style={{
                      background: C.surface, color: C.mutedLight,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: '6px 12px', fontSize: 13,
                      fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.color = C.orange; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.mutedLight; }}
                  >✏️</button>
                  {/* Supprimer */}
                  <button
                    onClick={() => setDeleteModal(r)}
                    title="Supprimer"
                    style={{
                      background: C.redPale, color: C.red,
                      border: `1px solid ${C.red}44`,
                      borderRadius: 8, padding: '6px 12px', fontSize: 13,
                      fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = C.white; }}
                    onMouseLeave={e => { e.currentTarget.style.background = C.redPale; e.currentTarget.style.color = C.red; }}
                  >🗑️</button>
                </div>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-ghost btn-sm">← Précédent</button>
              <span style={{ fontSize: 13, color: C.mutedLight, fontWeight: 600 }}>Page {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-ghost btn-sm">Suivant →</button>
            </div>
          )}
        </>
      )}

      {/* Modale édition */}
      {editModal && (
        <EditReservationModal
          hotel={hotel}
          reservation={editModal}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); load(); showToast && showToast('Réservation mise à jour'); }}
        />
      )}

      {/* Modale suppression */}
      {deleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
          <div className="fade-in" style={{ background: C.card, border: `1.5px solid ${C.red}44`, borderRadius: 20, width: '100%', maxWidth: 420, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,.6)' }}>
            <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>🗑️</div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: C.white, marginBottom: 10, textAlign: 'center' }}>Supprimer la réservation ?</h3>
            <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
              Réservation de <strong style={{ color: C.white }}>{deleteModal.client_name}</strong><br />
              du {fmtDate(deleteModal.checkin_date)} au {fmtDate(deleteModal.checkout_date)}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteModal(null)} className="btn btn-ghost">Annuler</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="btn btn-danger" style={{ padding: '8px 20px', background: C.red, color: C.white, border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13 }}>
                {deleteLoading ? <Spinner size={14} color={C.white} /> : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHECK-IN  — Bug #1 corrigé : géolocalisation
═══════════════════════════════════════════════════════════════ */

/** Wrapper Promise autour de getCurrentPosition */
const getGeoPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) { reject(new Error('unavailable')); return; }
  navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
});

function CheckInScreen() {
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [geoWarn, setGeoWarn] = useState('');

  const handleScan = async () => {
    if (!qr.trim()) return;
    setLoading(true); setResult(null); setError(''); setGeoWarn('');

    let lat = null;
    let lng = null;

    try {
      const pos = await getGeoPosition();
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      setGeoWarn('Géolocalisation indisponible ou refusée — check-in sans coordonnées GPS.');
    }

    try {
      const r = await reservationApi.checkin(qr.trim(), lat, lng);
      setResult(r.data); setQr('');
    } catch (e) {
      setError(e.response?.data?.detail || 'QR Code invalide');
    } finally { setLoading(false); }
  };

  return (
    <div className="fade-in">
      <SectionTitle icon="📲" title="Check-in Scanner" sub="Validez l'arrivée du client et libérez les fonds escrow" />
      <div style={{ maxWidth: 500 }}>
        <Card style={{ marginBottom: 20, borderColor: C.orangeBorder }}>
          <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: C.orangePale, border: `2px solid ${C.orange}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, margin: '0 auto 16px',
            }}>📱</div>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Validation du Pass SOKORA</h3>
            <p style={{ fontSize: 12, color: C.muted }}>Entrez le code QR du client ou utilisez un scanner physique</p>
          </div>
          <ErrorBox msg={error} />
          {geoWarn && (
            <div style={{
              background: C.goldPale, border: `1px solid ${C.gold}44`,
              borderRadius: 10, padding: '10px 14px',
              marginBottom: 16, fontSize: 12, color: C.gold,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              ⚠️ {geoWarn}
            </div>
          )}
          <Field label="Code QR">
            <input value={qr} onChange={e => setQr(e.target.value.toUpperCase())} placeholder="Ex: A3B9F2C1D8E7..."
              onKeyDown={e => e.key === 'Enter' && handleScan()}
              style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: 14 }} />
          </Field>
          <OrangeBtn onClick={handleScan} disabled={loading || !qr} style={{ width: '100%', justifyContent: 'center', padding: '13px' }}>
            {loading ? <Spinner size={18} color={C.white} /> : '✓ Valider le check-in'}
          </OrangeBtn>
        </Card>

        {result && (
          <Card className="fade-in" style={{ borderColor: `${C.green}66`, background: C.greenPale }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✓</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: C.green }}>Check-in validé !</div>
                <div style={{ fontSize: 12, color: C.muted }}>Fonds libérés vers votre Wallet SOKORA</div>
              </div>
            </div>
            {[
              { label: 'Client', val: result.client_name, color: C.white },
              { label: 'Chambre', val: result.room_number, color: C.white },
              { label: 'Montant libéré', val: fmt(result.hotel_amount_released), color: C.orange },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span style={{ color: C.muted }}>{row.label}</span>
                <span style={{ fontWeight: 700, color: row.color }}>{row.val}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TARIFS SAISONNIERS
═══════════════════════════════════════════════════════════════ */
function SeasonRatesScreen({ hotel }) {
  const [rates, setRates] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [r, rt] = await Promise.all([seasonApi.list(hotel.id), roomTypeApi.list(hotel.id)]);
    setRates(r.data || []); setRoomTypes(rt.data || []); setLoading(false);
  }, [hotel.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="fade-in">
      <SectionTitle icon="📆" title="Tarifs Saisonniers" sub="Yield management — tarifs par période"
        action={<OrangeBtn onClick={() => setShowAdd(true)} style={{ fontSize: 12, padding: '8px 16px' }}>+ Nouveau tarif</OrangeBtn>}
      />
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={32} /></div>
      : rates.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📆</div>
          <div style={{ color: C.muted, marginBottom: 8 }}>Aucun tarif saisonnier</div>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Créez des tarifs Week-end, Haute saison, Fêtes...</p>
          <OrangeBtn onClick={() => setShowAdd(true)}>Créer un tarif</OrangeBtn>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rates.map(rate => (
            <Card key={rate.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{rate.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{fmtDate(rate.date_from)} → {fmtDate(rate.date_to)}</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.orange }}>
                {fmt(rate.price)}<span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>/nuit</span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {showAdd && <AddSeasonRateModal hotelId={hotel.id} roomTypes={roomTypes} onClose={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddSeasonRateModal({ hotelId, roomTypes, onClose }) {
  const [form, setForm] = useState({ name: '', price: '', date_from: '', date_to: '', room_type_id: '' });
  const [loading, setLoading] = useState(false);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await seasonApi.create(hotelId, { ...form, price: +form.price, room_type_id: form.room_type_id ? +form.room_type_id : undefined });
      onClose();
    } finally { setLoading(false); }
  };
  return (
    <Modal title="Nouveau tarif saisonnier" onClose={onClose}>
      <Field label="Nom du tarif"><input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Haute saison, Week-end..." /></Field>
      <Field label="Prix/nuit (F CFA)"><input value={form.price} onChange={e => upd('price', e.target.value)} type="number" /></Field>
      <div className="grid-2">
        <Field label="Du"><input value={form.date_from} onChange={e => upd('date_from', e.target.value)} type="date" /></Field>
        <Field label="Au"><input value={form.date_to} onChange={e => upd('date_to', e.target.value)} type="date" /></Field>
      </div>
      <Field label="Type de chambre (vide = tous)">
        <select value={form.room_type_id} onChange={e => upd('room_type_id', e.target.value)}>
          <option value="">Tous les types</option>
          {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
        </select>
      </Field>
      <OrangeBtn onClick={handleSubmit} disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
        {loading ? <Spinner size={16} color={C.white} /> : 'Créer'}
      </OrangeBtn>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AVIS
═══════════════════════════════════════════════════════════════ */
function ReviewsScreen({ hotel }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { reviewApi.list(hotel.id).then(r => { setReviews(r.data || []); setLoading(false); }); }, [hotel.id]);
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  return (
    <div className="fade-in">
      <SectionTitle icon="⭐" title="Avis Clients" />
      {avg && (
        <Card style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
          <div style={{ textAlign: 'center', minWidth: 100 }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: C.orange, lineHeight: 1 }}>{avg}</div>
            <div style={{ color: C.orange, letterSpacing: 2, fontSize: 16 }}>{stars(Math.round(avg))}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{reviews.length} avis</div>
          </div>
          <div style={{ flex: 1 }}>
            {[5,4,3,2,1].map(star => {
              const count = reviews.filter(r => r.rating === star).length;
              const pct = reviews.length ? count / reviews.length * 100 : 0;
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.orange, minWidth: 20 }}>{star}★</span>
                  <div style={{ flex: 1, height: 6, background: C.surface, borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: C.orange, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: C.muted, minWidth: 20 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={32} /></div>
      : reviews.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
          <div style={{ color: C.muted }}>Aucun avis</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map(r => (
            <Card key={r.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{r.client_name}</span>
                <span style={{ color: C.orange, letterSpacing: 1 }}>{stars(r.rating)}</span>
              </div>
              {r.comment && <p style={{ fontSize: 13, color: C.whiteOff }}>{r.comment}</p>}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>{fmtDate(r.created_at)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TRANSACTIONS SCREEN
═══════════════════════════════════════════════════════════════ */
const PERIOD_OPTS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week',  label: '7 derniers jours' },
  { value: 'month', label: 'Ce mois' },
];

const TX_TYPE_CFG = {
  reservation: { label: 'Réservation', bg: C.tealPale,   c: C.teal,  icon: '📅' },
  payment:     { label: 'Paiement reçu', bg: C.greenPale, c: C.green, icon: '✅' },
};

function TransactionsScreen({ hotel }) {
  const [period,       setPeriod]       = useState('today');
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await transactionApi.list(hotel.id, period);
      setData(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [hotel.id, period]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary || {};
  const txs     = data?.transactions || [];

  return (
    <div className="fade-in">
      <SectionTitle icon="💳" title="Transactions" sub="Réservations et paiements reçus" />

      {/* Sélecteur période */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {PERIOD_OPTS.map(o => (
          <button key={o.value} onClick={() => setPeriod(o.value)} style={{
            padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: period === o.value ? C.orange : C.card,
            color:      period === o.value ? C.white  : C.mutedLight,
            border: `1.5px solid ${period === o.value ? C.orange : C.border}`,
            transition: 'all .15s',
          }}>
            {o.label}
          </button>
        ))}
      </div>

      {/* KPIs résumé */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <KPICard icon="📅" label="Réservations"   value={summary.nb_reservations ?? '—'} color={C.teal} />
        <KPICard icon="✅" label="Paiements reçus" value={summary.nb_payments ?? '—'}     color={C.green} />
        <KPICard icon="🔒" label="CA Réservé"      value={summary.ca_reserve  != null ? fmt(summary.ca_reserve)  : '—'} color={C.orange} />
        <KPICard icon="💰" label="CA Encaissé"     value={summary.ca_encaisse != null ? fmt(summary.ca_encaisse) : '—'} color={C.teal} />
      </div>

      {/* Liste transactions */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Détail des transactions</span>
          <span style={{ fontSize: 12, color: C.muted }}>{txs.length} transaction{txs.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : error ? (
          <div style={{ color: C.red, textAlign: 'center', padding: 32, fontSize: 13 }}>{error}</div>
        ) : txs.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.muted, padding: 48 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 600 }}>Aucune transaction sur cette période</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {txs.map(tx => {
              const cfg = TX_TYPE_CFG[tx.type] || { label: tx.type_label, bg: C.surface, c: C.muted, icon: '•' };
              const dateStr = tx.date ? new Date(tx.date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
              return (
                <div key={tx.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 12,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                }}>
                  {/* Icône type */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: cfg.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                  }}>{cfg.icon}</div>

                  {/* Infos */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: C.white }}>
                        {tx.client_name}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: cfg.bg, color: cfg.c,
                        border: `1px solid ${cfg.c}33`,
                      }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      Chambre {tx.room_number || '—'} · {fmtDate(tx.checkin_date)} → {fmtDate(tx.checkout_date)}
                      {tx.nights ? ` · ${tx.nights} nuit${tx.nights > 1 ? 's' : ''}` : ''}
                    </div>
                  </div>

                  {/* Montant + date */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: tx.type === 'payment' ? C.green : C.white }}>
                      {fmt(tx.amount)}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{dateStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   FINANCE IA
═══════════════════════════════════════════════════════════════ */
function FinanceIAScreen({ hotel }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hotel?.id) return;
    financeApi.getHotelDashboard(hotel.id)
      .then(r => setData(r.data))
      .catch(() => setError('Impossible de charger le tableau de bord financier.'))
      .finally(() => setLoading(false));
  }, [hotel?.id]);

  const fmtF = n => new Intl.NumberFormat('fr-FR').format(n) + ' F';

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:60}}><Spinner/></div>;
  if (error) return <div style={{color: C.red, padding:24,textAlign:'center'}}>{error}</div>;
  if (!data) return null;

  const { score, score_label, score_color, score_breakdown, ratios, loan_offers, recommendations, smart_pricing } = data;

  // SVG gauge
  const r=70, cx=90, cy=90;
  const angle = (score/100)*180;
  const toRad = d => d*Math.PI/180;
  const arcX = cx + r*Math.cos(toRad(180-angle));
  const arcY = cy - r*Math.sin(toRad(180-angle));
  const bgArc = `M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`;
  const fgArc = score > 0 ? `M ${cx-r} ${cy} A ${r} ${r} 0 ${angle>180?1:0} 1 ${arcX} ${arcY}` : '';

  const breakdown = [
    { label: 'Stabilité revenus',  max: 20, val: score_breakdown.stability },
    { label: 'Taux occupation',    max: 25, val: score_breakdown.occupancy },
    { label: 'Croissance',         max: 20, val: score_breakdown.growth },
    { label: 'Fiabilité',          max: 20, val: score_breakdown.reliability },
    { label: 'Avis clients',       max: 15, val: score_breakdown.reviews },
  ];

  const revs = [ratios.revenue_m2, ratios.revenue_m1, ratios.revenue_m0];
  const maxRev = Math.max(...revs, 1);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <div style={{ fontSize:28 }}>🏦</div>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color: C.white }}>Finance IA — {hotel?.name}</div>
          <div style={{ fontSize:12, color: C.muted }}>Analyse des 90 derniers jours · Score bancaire SOKORA Hôtel</div>
        </div>
        {!data.has_sufficient_data && (
          <div style={{ marginLeft:'auto', background: C.goldPale, border:`1px solid ${C.gold}44`, borderRadius:8, padding:'6px 12px', fontSize:12, color: C.gold, fontWeight:600 }}>
            ⚠ Données insuffisantes — continuez votre activité pour affiner le score
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Jauge score */}
        <div style={{ background: C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:24, display:'flex', flexDirection:'column', alignItems:'center' }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Score bancaire hôtel</div>
          <svg width={180} height={100} viewBox="0 0 180 100">
            <path d={bgArc} fill="none" stroke={C.border} strokeWidth={14} strokeLinecap="round"/>
            {fgArc && <path d={fgArc} fill="none" stroke={score_color} strokeWidth={14} strokeLinecap="round"/>}
            <text x={cx} y={cy-8} textAnchor="middle" fontSize={32} fontWeight={800} fill={score_color}>{score}</text>
            <text x={cx} y={cy+8} textAnchor="middle" fontSize={13} fontWeight={700} fill={C.white}>{score_label}</text>
          </svg>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, width:'100%', marginTop:8 }}>
            {breakdown.map(b => (
              <div key={b.label} style={{ fontSize:10, color:C.muted }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                  <span>{b.label}</span><span style={{ fontWeight:700, color:C.white }}>{b.val}/{b.max}</span>
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
            { label:'CA ce mois',       val:fmtF(ratios.revenue_m0),         icon:'📈', color:C.teal },
            { label:'RevPAR',           val:fmtF(ratios.revpar),             icon:'🏨', color:C.teal },
            { label:'ADR (prix/nuit)',  val:fmtF(ratios.adr),                icon:'💰', color:C.purple },
            { label:'Taux occupation',  val:`${ratios.occupancy_rate}%`,     icon:'🛏️', color: ratios.occupancy_rate>=70?C.green:ratios.occupancy_rate>=40?C.orange:C.red },
            { label:'Croissance MoM',   val:(ratios.mom_growth>=0?'+':'')+ratios.mom_growth+'%', icon:'🚀', color: ratios.mom_growth>=0?C.green:C.red },
            { label:'Note clients',     val:ratios.avg_rating>0?`${ratios.avg_rating}/5`:'—',    icon:'⭐', color: C.gold },
          ].map(k => (
            <div key={k.label} style={{ background: C.card, borderRadius:12, border:`1px solid ${C.border}`, padding:'12px 14px' }}>
              <div style={{ fontSize:18, marginBottom:2 }}>{k.icon}</div>
              <div style={{ fontSize:15, fontWeight:800, color:k.color }}>{k.val}</div>
              <div style={{ fontSize:10, color:C.muted, fontWeight:600 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenus 3 mois + métriques hôtelières + smart pricing */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Barres revenus */}
        <div style={{ background: C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:16 }}>Revenus mensuels</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:12, height:100 }}>
            {revs.map((rv,i) => {
              const h = maxRev>0 ? Math.max(4, Math.round((rv/maxRev)*90)) : 4;
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ fontSize:9, color:C.muted, fontWeight:600 }}>{rv>0?fmtF(rv):'–'}</div>
                  <div style={{ width:'100%', height:h, borderRadius:'4px 4px 0 0', background:i===2?C.teal:C.border }}/>
                  <div style={{ fontSize:10, color:C.muted }}>{['M-2','M-1','Ce mois'][i]}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Métriques hôtelières */}
        <div style={{ background: C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:16 }}>Indicateurs hôteliers</div>
          {[
            { label:'No-show',          val:`${ratios.no_show_rate}%`,        color: ratios.no_show_rate>10?C.red:C.muted },
            { label:'Annulations',      val:`${ratios.cancel_rate}%`,         color: ratios.cancel_rate>15?C.red:C.muted },
            { label:'Lead time',        val:`${ratios.avg_lead_time_days}j`,  color: C.muted },
            { label:'Chambres actives', val:ratios.total_rooms,               color: C.white },
            { label:'Nuitées vendues',  val:ratios.total_nights,              color: C.teal },
            { label:'Réservations',     val:ratios.total_bookings,            color: C.white },
          ].map(m => (
            <div key={m.label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
              <span style={{ color:C.muted }}>{m.label}</span>
              <span style={{ fontWeight:700, color:m.color }}>{m.val}</span>
            </div>
          ))}
        </div>

        {/* Smart pricing */}
        <div style={{ background: C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:16 }}>💡 Tarification IA</div>
          {smart_pricing && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>
                {smart_pricing.action==='augmenter'?'📈':smart_pricing.action==='baisser'?'📉':'✅'}
              </div>
              <div style={{ display:'inline-block', padding:'4px 12px', borderRadius:20, fontSize:13, fontWeight:800,
                background: smart_pricing.action==='augmenter'? C.greenPale :smart_pricing.action==='baisser'? C.redPale : C.tealPale,
                color: smart_pricing.action==='augmenter'?C.green:smart_pricing.action==='baisser'?C.red:C.teal,
                marginBottom:12 }}>
                {smart_pricing.action==='augmenter'?`+${smart_pricing.pct}% recommandé`:smart_pricing.action==='baisser'?`-${smart_pricing.pct}% suggéré`:'Tarifs optimaux'}
              </div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>{smart_pricing.reason}</div>
            </div>
          )}
        </div>
      </div>

      {/* Offres de prêt */}
      <div style={{ background: C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:20, marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:16 }}>💰 Offres de financement SOKORA Hôtel</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {loan_offers.map(offer => (
            <div key={offer.type} style={{ borderRadius:12, border:`2px solid ${offer.eligible?C.teal:C.border}`, padding:16,
              background:offer.eligible?C.tealPale:C.surface, opacity:offer.eligible?1:0.75 }}>
              <div style={{ fontSize:22, marginBottom:6 }}>{offer.icon}</div>
              <div style={{ fontSize:14, fontWeight:800, color:C.white, marginBottom:2 }}>{offer.label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:offer.eligible?C.teal:C.muted, marginBottom:4 }}>
                {fmtF(offer.amount)}
              </div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>{offer.rate} · {offer.duration}</div>
              <div style={{ fontSize:11, color:offer.eligible?C.teal:C.muted, fontWeight:600, marginTop:6 }}>
                {offer.eligible?'✅ ':'🔒 '}{offer.reason}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommandations */}
      <div style={{ background: C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:12 }}>🤖 Recommandations IA</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {recommendations.map((rec,i) => (
            <div key={i} style={{ background: C.surface, borderRadius:8, padding:'10px 14px', fontSize:13, color:C.white, borderLeft:`3px solid ${C.teal}` }}>
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
   RAPPORT MENSUEL — export PDF
═══════════════════════════════════════════════════════════════ */
const exportMonthlyPDF = (hotel, month, stats) => {
  if (!window.jspdf) { alert('jsPDF non chargé'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const orange = [255, 107, 53];
  const dark = [20, 29, 46];
  const muted = [107, 122, 153];

  doc.setFillColor(...orange);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('SOKORA', 14, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Marketplace Hôtelière', 14, 21);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rapport Mensuel — ${hotel?.name || 'Hôtel'}`, 14, 28);

  let y = 42;
  doc.setTextColor(...dark);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Période : ${stats.period || month}`, 14, y);
  doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 120, y);
  y += 10;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...orange);
  doc.text('Occupation', 14, y); y += 6;
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'normal');
  doc.text(`Taux d'occupation : ${stats.occupancy_rate || 0}%`, 14, y); y += 5;
  doc.text(`Nuits vendues : ${stats.nights_sold || 0}`, 14, y); y += 5;
  doc.text(`Revenu total : ${new Intl.NumberFormat('fr-FR').format(stats.total_revenue || 0)} F CFA`, 14, y); y += 10;

  if (stats.rooms_breakdown?.length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...orange);
    doc.text('Revenus par type de chambre', 14, y); y += 7;
    doc.setFillColor(...orange);
    doc.rect(14, y - 4, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    ['Type', 'Réservations', 'Nuits', 'Revenu', 'Prix moy/nuit'].forEach((h, i) => {
      doc.text(h, 14 + [0, 50, 90, 120, 160][i], y);
    });
    y += 7;
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'normal');
    stats.rooms_breakdown.forEach((r, idx) => {
      if (idx % 2 === 0) { doc.setFillColor(245, 245, 245); doc.rect(14, y - 4, 182, 7, 'F'); }
      [r.type, r.bookings, r.nights, `${new Intl.NumberFormat('fr-FR').format(r.revenue)} F`, `${new Intl.NumberFormat('fr-FR').format(r.avg_price)} F`].forEach((v, i) => {
        doc.text(String(v), 14 + [0, 50, 90, 120, 160][i], y);
      });
      y += 7;
    });
    y += 5;
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...orange);
  doc.text('Activité du mois', 14, y); y += 6;
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'normal');
  doc.text(`Check-in : ${stats.checkins || 0}`, 14, y);
  doc.text(`Check-out : ${stats.checkouts || 0}`, 60, y);
  doc.text(`No-show : ${stats.no_shows || 0}`, 106, y);
  doc.text(`Annulations : ${stats.cancellations || 0}`, 145, y);
  y += 10;

  if (stats.top_wallet_clients?.length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...orange);
    doc.text('Top clients Wallet SOKORA', 14, y); y += 7;
    doc.setFillColor(...orange);
    doc.rect(14, y - 4, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    ['Client', 'Téléphone', 'Séjours', 'Total', 'Mode'].forEach((h, i) => {
      doc.text(h, 14 + [0, 60, 100, 125, 165][i], y);
    });
    y += 7;
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'normal');
    stats.top_wallet_clients.forEach((c, idx) => {
      if (idx % 2 === 0) { doc.setFillColor(245, 245, 245); doc.rect(14, y - 4, 182, 7, 'F'); }
      [c.name || '—', c.phone || '—', c.stays, `${new Intl.NumberFormat('fr-FR').format(c.total)} F`, 'Wallet SOKORA'].forEach((v, i) => {
        doc.text(String(v), 14 + [0, 60, 100, 125, 165][i], y);
      });
      y += 7;
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text('Document généré par SOKORA — Marketplace Hôtelière — sokora.ci', 14, 285);
  doc.save(`rapport_${hotel?.name?.replace(/\s/g, '_') || 'hotel'}_${month}.pdf`);
};

const buildStats = (dashData, reservations, period) => ({
  period,
  occupancy_rate: dashData?.occupancy_rate_pct || dashData?.occupancy_rate ||
    (dashData?.total_rooms ? Math.round((dashData.occupied_rooms / dashData.total_rooms) * 100) : 0),
  nights_sold: (reservations?.filter(r => r.status === 'COMPLETED' || r.status === 'CHECKED_IN').length || 0) * 2,
  total_revenue: dashData?.ca_month || dashData?.monthly_revenue || dashData?.total_revenue || 0,
  checkins: reservations?.filter(r => r.status === 'CHECKED_IN' || r.status === 'COMPLETED').length || 0,
  checkouts: reservations?.filter(r => r.status === 'COMPLETED').length || 0,
  no_shows: reservations?.filter(r => r.status === 'NO_SHOW').length || 0,
  cancellations: reservations?.filter(r => r.status === 'CANCELLED').length || 0,
  rooms_breakdown: [],
  top_wallet_clients: (reservations || [])
    .filter(r => r.payment_method === 'WALLET')
    .slice(0, 5)
    .map(r => ({ name: r.client_name, phone: r.guest_phone || r.client_phone || '—', stays: 1, total: r.total_price || r.total_amount || 0 })),
});

function ReportScreen({ hotel }) {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateReport = async () => {
    setLoading(true); setError(''); setStats(null);
    try {
      const [dashRes, resaRes] = await Promise.all([
        hotelApi.dashboard(hotel.id),
        reservationApi.list(hotel.id),
      ]);
      const [year, mon] = month.split('-');
      const periodLabel = new Date(+year, +mon - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const allResas = resaRes.data || [];
      // Filter reservations for the selected month
      const monthResas = allResas.filter(r => {
        const d = r.checkin_date ? r.checkin_date.slice(0, 7) : '';
        return d === month;
      });
      setStats(buildStats(dashRes.data, monthResas.length > 0 ? monthResas : allResas, periodLabel));
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur lors du chargement des données');
    } finally { setLoading(false); }
  };

  return (
    <div className="fade-in">
      <SectionTitle icon="📊" title="Rapport Mensuel" sub="Générez et exportez votre rapport mensuel en PDF" />

      {/* Header controls */}
      <Card style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ marginBottom: 6 }}>Mois / Année</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            style={{ width: 180 }}
          />
        </div>
        <OrangeBtn onClick={generateReport} disabled={loading} style={{ alignSelf: 'flex-end', marginBottom: 1 }}>
          {loading ? <Spinner size={16} color={C.white} /> : '📈 Générer le rapport'}
        </OrangeBtn>
      </Card>

      <ErrorBox msg={error} />

      {stats && (
        <div className="fade-in">
          {/* Section 1 — Résumé */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.orange, marginBottom: 12 }}>1. Résumé hôtel</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
              <div><span style={{ color: C.muted }}>Hôtel : </span><strong>{hotel.name}</strong></div>
              <div><span style={{ color: C.muted }}>Période : </span><strong>{stats.period}</strong></div>
            </div>
          </Card>

          {/* Section 2 — Occupation */}
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <KPICard icon="🏨" label="Taux d'occupation" value={`${stats.occupancy_rate}%`} color={C.teal} />
            <KPICard icon="🌙" label="Nuits vendues" value={stats.nights_sold} color={C.orange} />
            <KPICard icon="💰" label="Revenu total" value={fmt(stats.total_revenue)} color={C.green} />
          </div>

          {/* Section 3 — Revenus par type de chambre */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.orange, marginBottom: 14 }}>3. Revenus par type de chambre</div>
            {stats.rooms_breakdown.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, fontStyle: 'italic' }}>
                Données détaillées par type de chambre non disponibles via l'API actuelle.
              </div>
            ) : (
              <table className="dt" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Type</th><th>Réservations</th><th>Nuits</th><th>Revenu total</th><th>Prix moy/nuit</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.rooms_breakdown.map((rb, i) => (
                    <tr key={i}>
                      <td>{rb.type}</td><td>{rb.bookings}</td><td>{rb.nights}</td>
                      <td style={{ color: C.orange, fontWeight: 700 }}>{fmt(rb.revenue)}</td>
                      <td>{fmt(rb.avg_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Section 4 — Activité */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <KPICard icon="✈️" label="Check-in" value={stats.checkins} color={C.teal} />
            <KPICard icon="🚪" label="Check-out" value={stats.checkouts} color={C.orange} />
            <KPICard icon="⚠️" label="No-show" value={stats.no_shows} color={C.red} />
            <KPICard icon="❌" label="Annulations" value={stats.cancellations} color={C.red} />
          </div>

          {/* Section 5 — Top clients Wallet SOKORA */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.orange, marginBottom: 14 }}>5. Top clients Wallet SOKORA</div>
            {stats.top_wallet_clients.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, fontStyle: 'italic' }}>
                Aucun paiement par Wallet SOKORA sur cette période.
              </div>
            ) : (
              <table className="dt">
                <thead>
                  <tr><th>Client</th><th>Téléphone</th><th>Séjours</th><th>Montant total</th><th>Mode</th></tr>
                </thead>
                <tbody>
                  {stats.top_wallet_clients.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{c.name || '—'}</td>
                      <td style={{ color: C.muted }}>{c.phone || '—'}</td>
                      <td>{c.stays}</td>
                      <td style={{ color: C.orange, fontWeight: 700 }}>{fmt(c.total)}</td>
                      <td>
                        <span style={{
                          background: C.tealPale, color: C.teal,
                          border: `1px solid ${C.tealBorder}`,
                          borderRadius: 20, padding: '3px 10px',
                          fontSize: 11, fontWeight: 700,
                        }}>Wallet SOKORA</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Bouton export */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => exportMonthlyPDF(hotel, month, stats)}
              style={{
                background: `linear-gradient(135deg, ${C.orange}, ${C.orangeHov})`,
                color: C.white, border: 'none', borderRadius: 12,
                padding: '13px 28px', fontWeight: 800, fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                boxShadow: `0 4px 16px ${C.orangeBorder}`,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              📄 Exporter en PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOKORA BLACK — FIDÉLITÉ
═══════════════════════════════════════════════════════════════ */
const TIER_META = {
  Black:  { color: '#e8d5ff', bg: '#2a1550', badge: '⬛', cashback: '5%' },
  Gold:   { color: '#FFD700', bg: '#2a2200', badge: '🥇', cashback: '3%' },
  Silver: { color: '#C0C0C0', bg: '#1e2230', badge: '🥈', cashback: '2%' },
  Bronze: { color: '#CD7F32', bg: '#2a1800', badge: '🥉', cashback: '1%' },
};

function LoyaltyScreen({ hotel }) {
  const [stats, setStats]       = useState(null);
  const [clients, setClients]   = useState([]);
  const [txs, setTxs]           = useState([]);
  const [tab, setTab]           = useState('dashboard');
  const [search, setSearch]     = useState('');
  const [tierFilter, setTier]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [earnPhone, setEarnPhone] = useState('');
  const [earnAmount, setEarnAmount] = useState('');
  const [redeemPhone, setRedeemPhone] = useState('');
  const [redeemPts, setRedeemPts] = useState('');
  const [msg, setMsg]           = useState(null);

  const showMsg = (m, ok=true) => { setMsg({text:m,ok}); setTimeout(()=>setMsg(null),3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, c, t] = await Promise.all([
        loyaltyApi.dashboard(),
        loyaltyApi.listClients({ search, tier: tierFilter || undefined, limit: 50 }),
        loyaltyApi.transactions({ limit: 30 }),
      ]);
      setStats(d.data);
      setClients(c.data.clients || []);
      setTxs(t.data.transactions || []);
    } catch (e) {
      showMsg('Erreur chargement fidélité', false);
    }
    setLoading(false);
  }, [search, tierFilter]);

  useEffect(() => { load(); }, [load]);

  const handleEarn = async () => {
    if (!earnPhone || !earnAmount) return;
    try {
      const r = await loyaltyApi.earn({ phone: earnPhone, amount: parseFloat(earnAmount), establishment_id: hotel?.id });
      showMsg(`+${r.data.points_earned} pts · Tier: ${r.data.tier}${r.data.tier_upgraded ? ' 🎉 UPGRADE!' : ''}`);
      setEarnPhone(''); setEarnAmount(''); load();
    } catch(e) { showMsg(e.response?.data?.detail || 'Erreur', false); }
  };

  const handleRedeem = async () => {
    if (!redeemPhone || !redeemPts) return;
    try {
      const r = await loyaltyApi.redeem({ phone: redeemPhone, points: parseInt(redeemPts), establishment_id: hotel?.id });
      showMsg(`${r.data.points_redeemed} pts remboursés → ${r.data.cashback_xof} XOF`);
      setRedeemPhone(''); setRedeemPts(''); load();
    } catch(e) { showMsg(e.response?.data?.detail || 'Erreur', false); }
  };

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: '8px 18px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13,
      background: tab === id ? C.orange : C.card,
      color: tab === id ? C.white : C.muted,
      cursor: 'pointer', transition: 'all .2s',
    }}>{label}</button>
  );

  return (
    <div>
      <SectionTitle icon="⭐" title="SOKORA Black" sub="Programme de fidélité · Wallet SOKORA" />

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: msg.ok ? C.tealPale : '#ff4d4d22',
          border: `1px solid ${msg.ok ? C.tealBorder : '#ff4d4d55'}`,
          color: msg.ok ? C.teal : '#ff6b6b', fontWeight: 600, fontSize: 13 }}>
          {msg.text}
        </div>
      )}

      {/* Tier legend */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {Object.entries(TIER_META).map(([name, m]) => (
          <div key={name} style={{ padding:'10px 16px', borderRadius:10,
            background: m.bg, border:`1px solid ${m.color}44`,
            display:'flex', alignItems:'center', gap:8 }}>
            <span style={{fontSize:18}}>{m.badge}</span>
            <div>
              <div style={{fontWeight:800, color:m.color, fontSize:13}}>{name}</div>
              <div style={{fontSize:11, color:C.muted}}>Cashback {m.cashback}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <TabBtn id="dashboard" label="📊 Stats" />
        <TabBtn id="clients"   label="👤 Clients" />
        <TabBtn id="actions"   label="⚡ Actions" />
        <TabBtn id="history"   label="📋 Historique" />
      </div>

      {loading ? <div style={{textAlign:'center',padding:40}}><Spinner size={32}/></div> : (

        tab === 'dashboard' && stats ? (
          <div>
            <div className="grid-4" style={{marginBottom:24}}>
              <KPICard icon="👤" label="Total clients" value={stats.total_clients} color={C.teal} />
              <KPICard icon="⭐" label="Pts émis total" value={stats.total_points_issued?.toLocaleString()} color={C.orange} />
              <KPICard icon="📈" label="Pts gagnés (30j)" value={stats.points_earned_30d?.toLocaleString()} color={C.green} />
              <KPICard icon="💎" label="Pts utilisés (30j)" value={stats.points_redeemed_30d?.toLocaleString()} color={C.purple || '#a78bfa'} />
            </div>
            {/* Tier distribution */}
            <Card style={{marginBottom:20}}>
              <div style={{fontWeight:700, color:C.white, marginBottom:14, fontSize:14}}>Répartition par tier</div>
              <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                {Object.entries(stats.tier_distribution || {}).map(([name, count]) => {
                  const m = TIER_META[name] || {};
                  return (
                    <div key={name} style={{flex:1, minWidth:100, padding:'16px 12px', borderRadius:10,
                      background: m.bg || C.card, border:`1px solid ${(m.color||C.border)}44`,
                      textAlign:'center'}}>
                      <div style={{fontSize:24}}>{m.badge}</div>
                      <div style={{fontWeight:800, color:m.color||C.white, fontSize:20, marginTop:4}}>{count}</div>
                      <div style={{fontSize:11, color:C.muted, marginTop:2}}>{name}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
            {/* Top clients */}
            <Card>
              <div style={{fontWeight:700, color:C.white, marginBottom:14, fontSize:14}}>Top 5 clients fidèles</div>
              {(stats.top_clients||[]).map((c,i) => {
                const m = TIER_META[c.tier] || {};
                return (
                  <div key={c.id} style={{display:'flex', alignItems:'center', gap:12,
                    padding:'10px 0', borderBottom: i<4?`1px solid ${C.border}`:'none'}}>
                    <div style={{width:28, height:28, borderRadius:'50%', background:C.orange,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontWeight:800, color:'#fff', fontSize:12}}>{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700, color:C.white, fontSize:13}}>{c.name}</div>
                      <div style={{fontSize:11, color:C.muted}}>{c.phone}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:800, color:m.color||C.white, fontSize:13}}>{m.badge} {c.tier}</div>
                      <div style={{fontSize:11, color:C.muted}}>{c.total_points?.toLocaleString()} pts</div>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        ) : tab === 'clients' ? (
          <div>
            <div style={{display:'flex', gap:10, marginBottom:16, flexWrap:'wrap'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Rechercher par nom ou téléphone…"
                style={{flex:1, minWidth:200, padding:'10px 14px', borderRadius:8,
                  background:C.card, border:`1px solid ${C.border}`, color:C.white, fontSize:13}} />
              <select value={tierFilter} onChange={e=>setTier(e.target.value)}
                style={{padding:'10px 14px', borderRadius:8, background:C.card, border:`1px solid ${C.border}`, color:C.white}}>
                <option value="">Tous les tiers</option>
                {['Black','Gold','Silver','Bronze'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Card style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
                <thead>
                  <tr style={{color:C.muted, textAlign:'left'}}>
                    {['Client','Téléphone','Tier','Points','Dépensé','Visites'].map(h=>(
                      <th key={h} style={{padding:'8px 12px', borderBottom:`1px solid ${C.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => {
                    const m = TIER_META[c.tier] || {};
                    return (
                      <tr key={c.id} style={{borderBottom:`1px solid ${C.border}22`}}>
                        <td style={{padding:'10px 12px', color:C.white, fontWeight:600}}>{c.name}</td>
                        <td style={{padding:'10px 12px', color:C.muted}}>{c.phone}</td>
                        <td style={{padding:'10px 12px'}}>
                          <span style={{padding:'3px 10px', borderRadius:20,
                            background:m.bg||C.card, color:m.color||C.white, fontWeight:700, fontSize:11}}>
                            {m.badge} {c.tier}
                          </span>
                        </td>
                        <td style={{padding:'10px 12px', color:C.orange, fontWeight:700}}>{c.total_points?.toLocaleString()}</td>
                        <td style={{padding:'10px 12px', color:C.teal}}>{c.total_spent?.toLocaleString()} XOF</td>
                        <td style={{padding:'10px 12px', color:C.muted}}>{c.visit_count}</td>
                      </tr>
                    );
                  })}
                  {clients.length === 0 && (
                    <tr><td colSpan={6} style={{textAlign:'center',padding:32,color:C.muted}}>Aucun client</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        ) : tab === 'actions' ? (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            {/* Earn */}
            <Card>
              <div style={{fontWeight:700, color:C.teal, marginBottom:14, fontSize:14}}>📈 Attribuer des points</div>
              <div style={{fontSize:12, color:C.muted, marginBottom:12}}>1 pt par 100 XOF dépensé</div>
              <label style={{fontSize:12, color:C.muted}}>Téléphone client</label>
              <input value={earnPhone} onChange={e=>setEarnPhone(e.target.value)}
                placeholder="+225 07 00 00 00 00"
                style={{width:'100%', padding:'10px 12px', borderRadius:8, margin:'6px 0 12px',
                  background:C.bg, border:`1px solid ${C.border}`, color:C.white, fontSize:13, boxSizing:'border-box'}} />
              <label style={{fontSize:12, color:C.muted}}>Montant dépensé (XOF)</label>
              <input value={earnAmount} onChange={e=>setEarnAmount(e.target.value)} type="number"
                placeholder="5000"
                style={{width:'100%', padding:'10px 12px', borderRadius:8, margin:'6px 0 16px',
                  background:C.bg, border:`1px solid ${C.border}`, color:C.white, fontSize:13, boxSizing:'border-box'}} />
              <button onClick={handleEarn} style={{
                width:'100%', padding:'12px', borderRadius:8, border:'none',
                background:`linear-gradient(135deg, ${C.teal}, #00a885)`,
                color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer',
              }}>Valider +pts</button>
            </Card>
            {/* Redeem */}
            <Card>
              <div style={{fontWeight:700, color:C.orange, marginBottom:14, fontSize:14}}>💰 Utiliser des points</div>
              <div style={{fontSize:12, color:C.muted, marginBottom:12}}>100 pts = 100 XOF de cashback · Wallet SOKORA</div>
              <label style={{fontSize:12, color:C.muted}}>Téléphone client</label>
              <input value={redeemPhone} onChange={e=>setRedeemPhone(e.target.value)}
                placeholder="+225 07 00 00 00 00"
                style={{width:'100%', padding:'10px 12px', borderRadius:8, margin:'6px 0 12px',
                  background:C.bg, border:`1px solid ${C.border}`, color:C.white, fontSize:13, boxSizing:'border-box'}} />
              <label style={{fontSize:12, color:C.muted}}>Points à utiliser</label>
              <input value={redeemPts} onChange={e=>setRedeemPts(e.target.value)} type="number"
                placeholder="500"
                style={{width:'100%', padding:'10px 12px', borderRadius:8, margin:'6px 0 16px',
                  background:C.bg, border:`1px solid ${C.border}`, color:C.white, fontSize:13, boxSizing:'border-box'}} />
              <button onClick={handleRedeem} style={{
                width:'100%', padding:'12px', borderRadius:8, border:'none',
                background:`linear-gradient(135deg, ${C.orange}, ${C.orangeHov})`,
                color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer',
              }}>Rembourser pts</button>
            </Card>
          </div>
        ) : tab === 'history' ? (
          <Card style={{overflowX:'auto'}}>
            <div style={{fontWeight:700, color:C.white, marginBottom:14, fontSize:14}}>Dernières transactions fidélité</div>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{color:C.muted, textAlign:'left'}}>
                  {['Date','Client','Type','Points','Description'].map(h=>(
                    <th key={h} style={{padding:'8px 12px', borderBottom:`1px solid ${C.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txs.map(t => (
                  <tr key={t.id} style={{borderBottom:`1px solid ${C.border}22`}}>
                    <td style={{padding:'9px 12px', color:C.muted, fontSize:11}}>{t.created_at?.slice(0,10)}</td>
                    <td style={{padding:'9px 12px', color:C.white, fontWeight:600}}>{t.client_name}</td>
                    <td style={{padding:'9px 12px'}}>
                      <span style={{
                        padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700,
                        background: t.tx_type==='earn' ? C.tealPale : t.tx_type==='redeem' ? C.orangePale : '#a78bfa22',
                        color: t.tx_type==='earn' ? C.teal : t.tx_type==='redeem' ? C.orange : '#a78bfa',
                      }}>{t.tx_type}</span>
                    </td>
                    <td style={{padding:'9px 12px', fontWeight:700,
                      color: t.points>0 ? C.teal : C.orange}}>
                      {t.points>0?'+':''}{t.points}
                    </td>
                    <td style={{padding:'9px 12px', color:C.muted}}>{t.description}</td>
                  </tr>
                ))}
                {txs.length===0 && <tr><td colSpan={5} style={{textAlign:'center',padding:32,color:C.muted}}>Aucune transaction</td></tr>}
              </tbody>
            </table>
          </Card>
        ) : null
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════════ */
const NAV = [
  { id: 'dashboard',    icon: '📊', label: 'Vue d\'ensemble' },
  { id: 'transactions', icon: '💳', label: 'Transactions' },
  { id: 'rooms',        icon: '🛏️', label: 'Chambres' },
  { id: 'reservations', icon: '📅', label: 'Réservations' },
  { id: 'checkin',      icon: '📲', label: 'Check-in' },
  { id: 'rates',        icon: '📆', label: 'Tarifs' },
  { id: 'reviews',      icon: '⭐', label: 'Avis' },
  { id: 'finance',      icon: '🏦', label: 'Finance IA' },
  { id: 'rapport',      icon: '📊', label: 'Rapport Mensuel' },
  { id: 'loyalty',      icon: '⭐', label: 'SOKORA Black' },
];

function Sidebar({ active, onNav, user, hotel, onLogout }) {
  return (
    <div className="sb">
      {/* Header */}
      <div className="sb-logo">
        <SokoraLogo />
        {hotel && (
          <div style={{
            marginTop: 14, padding: '10px 12px',
            background: C.orangePale,
            border: `1px solid ${C.orangeBorder}`,
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.orange }}>{hotel.name}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{hotel.city || hotel.address}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sb-nav">
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => onNav(n.id)}
            className={`ni${active === n.id ? ' on' : ''}`}
          >
            <span style={{ fontSize: 17 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      {/* Footer user */}
      <div className="sb-foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: C.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, color: C.white, flexShrink: 0,
          }}>
            {(user?.full_name || 'G').charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>Gérant</div>
          </div>
        </div>
        <button onClick={onLogout} style={{
          background: 'none', border: `1px solid ${C.border}`,
          borderRadius: 8, color: C.muted, fontSize: 12, fontWeight: 600,
          padding: '8px 14px', width: '100%', transition: 'all .2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [user, setUser]     = useState(null);
  const [hotel, setHotel]   = useState(null);
  const [screen, setScreen] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [needSetup, setNeedSetup] = useState(false);
  const [toast, setToast]   = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadHotel = useCallback(async () => {
    try {
      const r = await hotelApi.getMe();
      setHotel(r.data);
      setNeedSetup(false);
    } catch {
      setNeedSetup(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('hotel_token');
    const u     = localStorage.getItem('hotel_user');
    if (token && u) { setUser(JSON.parse(u)); loadHotel(); }
    else { setLoading(false); }
  }, [loadHotel]);

  const handleLogin = async (u) => { setUser(u); setLoading(true); await loadHotel(); };
  const handleLogout = () => {
    localStorage.removeItem('hotel_token');
    localStorage.removeItem('hotel_user');
    setUser(null); setHotel(null); setNeedSetup(false);
  };

  const renderScreen = () => {
    if (!hotel) return null;
    switch (screen) {
      case 'dashboard':    return <DashboardScreen hotel={hotel} />;
      case 'transactions': return <TransactionsScreen hotel={hotel} />;
      case 'rooms':        return <RoomsScreen hotel={hotel} />;
      case 'reservations': return <ReservationsScreen hotel={hotel} showToast={showToast} />;
      case 'checkin':      return <CheckInScreen />;
      case 'rates':        return <SeasonRatesScreen hotel={hotel} />;
      case 'reviews':      return <ReviewsScreen hotel={hotel} />;
      case 'finance':      return <FinanceIAScreen hotel={hotel} />;
      case 'rapport':      return <ReportScreen hotel={hotel} />;
      case 'loyalty':      return <LoyaltyScreen hotel={hotel} />;
      default:             return <DashboardScreen hotel={hotel} />;
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <style>{GLOBAL_CSS}</style>
      <SokoraLogo size="lg" />
      <Spinner size={36} />
    </div>
  );

  if (!user) return <><style>{GLOBAL_CSS}</style><LoginScreen onLogin={handleLogin} /></>;
  if (needSetup) return <><style>{GLOBAL_CSS}</style><SetupHotel onDone={() => { setNeedSetup(false); loadHotel(); }} /></>;

  return (
    <div className="app">
      <style>{GLOBAL_CSS}</style>
      <Sidebar active={screen} onNav={setScreen} user={user} hotel={hotel} onLogout={handleLogout} />
      <main className="main">
        <div className="content">
          {renderScreen()}
        </div>
      </main>
      <Toast msg={toast} onClose={() => setToast(null)} />
    </div>
  );
}
