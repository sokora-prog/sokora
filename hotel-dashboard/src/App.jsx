import { useState, useEffect, useCallback } from 'react';
import { authApi, hotelApi, roomApi, roomTypeApi, reservationApi, seasonApi, reviewApi, transactionApi, financeApi } from './services/api';

/* ═══════════════════════════════════════════════════════════════
   CHARTE GRAPHIQUE SOKORA OFFICIELLE
═══════════════════════════════════════════════════════════════ */
const C = {
  // Couleurs officielles SOKORA
  orange:      '#F26D21',
  orangeHov:   '#FF8040',
  orangePale:  '#F26D2115',
  orangeBorder:'#F26D2144',
  blue:        '#3065A6',
  blueLight:   '#7AA6D4',
  bluePale:    '#3065A615',
  black:       '#1A1A1A',
  blackMid:    '#222222',
  blackLight:  '#2C2C2C',
  border:      '#333333',
  borderLight: '#444444',
  white:       '#FFFFFF',
  whiteOff:    '#F5F5F5',
  muted:       '#888888',
  mutedLight:  '#AAAAAA',
  // Statuts
  green:       '#2ECC71',
  greenPale:   '#2ECC7115',
  red:         '#E74C3C',
  redPale:     '#E74C3C15',
  purple:      '#9B59B6',
  purplePale:  '#9B59B615',
  teal:        '#1ABC9C',
  tealPale:    '#1ABC9C15',
};

const ROOM_STATUS_CONFIG = {
  AVAILABLE:   { label: 'Disponible',  bg: C.greenPale,  c: C.green,  dot: C.green },
  OCCUPIED:    { label: 'Occupée',     bg: C.orangePale, c: C.orange, dot: C.orange },
  RESERVED:    { label: 'Réservée',    bg: C.bluePale,   c: C.blue,   dot: C.blueLight },
  CLEANING:    { label: 'Ménage',      bg: C.tealPale,   c: C.teal,   dot: C.teal },
  MAINTENANCE: { label: 'Maintenance', bg: C.redPale,    c: C.red,    dot: C.red },
  BLOCKED:     { label: 'Bloquée',     bg: '#33333344',  c: C.muted,  dot: C.muted },
};

const RESA_STATUS = {
  PENDING:    { label: 'En attente', c: C.mutedLight, bg: '#33333333' },
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
  background: ${C.black};
  color: ${C.white};
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: ${C.blackMid}; }
::-webkit-scrollbar-thumb { background: ${C.borderLight}; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: ${C.orange}; }

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
  background: ${C.blackLight};
  color: ${C.white};
  border: 1.5px solid ${C.border};
  border-radius: 10px;
  padding: 11px 14px;
  font-size: 13px;
  outline: none;
  width: 100%;
  transition: border-color .2s, box-shadow .2s;
}
input:focus, select:focus, textarea:focus {
  border-color: ${C.orange};
  box-shadow: 0 0 0 3px ${C.orangePale};
}
input::placeholder, textarea::placeholder { color: ${C.muted}; }
select option { background: ${C.blackLight}; }

label {
  font-size: 11px;
  font-weight: 700;
  color: ${C.mutedLight};
  letter-spacing: .7px;
  text-transform: uppercase;
  display: block;
  margin-bottom: 7px;
}
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
  const cfg = config?.[status] || { label: status, bg: C.blackLight, c: C.muted, dot: C.muted };
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
    background: C.blackMid,
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
    background: C.blue,
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
    background: 'rgba(0,0,0,.8)',
    zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
    backdropFilter: 'blur(4px)',
  }}>
    <div className="fade-in" style={{
      background: C.blackMid,
      border: `1.5px solid ${C.orange}`,
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
          background: C.blackLight, border: `1px solid ${C.border}`,
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
        <div style={{ fontSize: big ? 10 : 9, color: C.muted, letterSpacing: '1px', marginTop: 1 }}>
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
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!phone || !password) return;
    setLoading(true); setError('');
    try {
      const { data } = await authApi.login(phone, password);
      if (data.user.role !== 'MANAGER' && data.user.role !== 'SUPER_ADMIN') {
        setError('Accès réservé aux gérants');
        return;
      }
      localStorage.setItem('hotel_token', data.access_token);
      localStorage.setItem('hotel_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) {
      setError(e.response?.data?.detail || 'Identifiants incorrects');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: C.black,
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Panel gauche — décoratif */}
      <div style={{
        width: '45%',
        background: `linear-gradient(160deg, ${C.blue} 0%, #1a1a2e 100%)`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 50px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Cercles décoratifs */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: `${C.orange}15`, border: `1px solid ${C.orange}22` }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: `${C.blueLight}10` }} />

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
          {['Réservation avec escrow wallet', 'Check-in QR Code sécurisé', 'Yield management intégré'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✓</div>
              <span style={{ fontSize: 13, color: C.mutedLight }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel droit — formulaire */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}>
        <div className="fade-in" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: C.white, marginBottom: 8 }}>
              Espace Gérant
            </h2>
            <p style={{ fontSize: 13, color: C.muted }}>
              Connectez-vous à votre tableau de bord hôtelier
            </p>
          </div>

          <ErrorBox msg={error} />

          <Field label="Numéro de téléphone">
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0700000000" type="tel" />
          </Field>
          <Field label="Mot de passe">
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </Field>

          <OrangeBtn
            onClick={handleLogin}
            disabled={loading || !phone || !password}
            style={{ width: '100%', justifyContent: 'center', padding: '13px 20px', marginTop: 8, fontSize: 14 }}
          >
            {loading ? <Spinner size={18} color={C.white} /> : 'Se connecter →'}
          </OrangeBtn>

          <p style={{ textAlign: 'center', fontSize: 11, color: C.muted, marginTop: 28 }}>
            SOKORA Pro · Hôtellerie Africaine · v2.0
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
    <div style={{ minHeight: '100vh', background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
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
              <input value={form.city} onChange={e => upd('city', e.target.value)} />
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
          <span style={{ fontSize: 11, color: C.teal, background: C.tealPale, border: `1px solid ${C.teal}44`, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
            ✓ {Number(hotel.latitude).toFixed(4)}, {Number(hotel.longitude).toFixed(4)}
          </span>
        )}
        {!hasGps && (
          <span style={{ fontSize: 11, color: C.muted, background: '#33333333', borderRadius: 20, padding: '3px 10px' }}>
            GPS non défini
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, alignItems: 'end' }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Latitude</div>
          <input className="input" value={lat} onChange={e => setLat(e.target.value)} placeholder="ex: 5.319600" style={{ fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Longitude</div>
          <input className="input" value={lng} onChange={e => setLng(e.target.value)} placeholder="ex: -4.019500" style={{ fontSize: 13 }} />
        </div>
        <button onClick={detect} disabled={detecting} className="btn btn-ghost" style={{ height: 42 }}>
          {detecting ? '...' : '📡 Détecter'}
        </button>
        <button onClick={save} disabled={saving || !lat || !lng} className="btn btn-primary" style={{ height: 42, opacity: (!lat || !lng) ? 0.5 : 1 }}>
          {saving ? <Spinner size={14} color={C.white} /> : 'Enregistrer'}
        </button>
      </div>
      {msg === 'ok'  && <div style={{ marginTop: 8, fontSize: 12, color: C.teal, fontWeight: 600 }}>✓ GPS mis à jour</div>}
      {msg === 'err' && <div style={{ marginTop: 8, fontSize: 12, color: C.red,  fontWeight: 600 }}>⚠ Erreur lors de la sauvegarde</div>}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════ */
function DashboardScreen({ hotel }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hotelApi.dashboard(hotel.id).then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [hotel.id]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>;
  if (!data) return <div style={{ color: C.muted, textAlign: 'center', padding: 40 }}>Erreur de chargement</div>;

  const taux = data.occupancy_rate_pct || 0;

  return (
    <div className="fade-in">
      <SectionTitle icon="📊" title="Vue d'ensemble" sub={`Aujourd'hui · ${data.today}`} />

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KPICard icon="🏨" label="Taux occupation" value={`${taux}%`}
          sub={`${data.occupied_rooms}/${data.total_rooms} chambres`}
          color={taux > 70 ? C.green : taux > 40 ? C.orange : C.red} />
        <KPICard icon="💰" label="CA du mois" value={fmt(data.ca_month)} sub="Revenus nets" color={C.orange} />
        <KPICard icon="✈️" label="Arrivées" value={data.checkins_today} sub="Aujourd'hui" color={C.blue} />
        <KPICard icon="🚪" label="Départs" value={data.checkouts_today} sub="Aujourd'hui" color={C.blueLight} />
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
        <div style={{ height: 10, background: C.blackLight, borderRadius: 5, overflow: 'hidden' }}>
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
                background: C.blackLight,
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
   RÉSERVATIONS
═══════════════════════════════════════════════════════════════ */
function ReservationsScreen({ hotel }) {
  const [reservations, setReservations] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await reservationApi.list(hotel.id, filter || undefined);
    setReservations(r.data || []); setLoading(false);
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

  return (
    <div className="fade-in">
      <SectionTitle icon="📅" title="Réservations" />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => {
          const label = s ? (RESA_STATUS[s]?.label || s) : 'Toutes';
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              background: filter === s ? C.orange : C.blackLight,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reservations.map(r => {
            return (
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
                    {r.special_requests && <div style={{ fontSize: 11, color: C.blueLight, marginTop: 4 }}>💬 {r.special_requests}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: C.orange, fontWeight: 800, fontSize: 17 }}>{fmt(r.hotel_amount)}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>Total client: {fmt(r.total_amount)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
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
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHECK-IN
═══════════════════════════════════════════════════════════════ */
function CheckInScreen() {
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleScan = async () => {
    if (!qr.trim()) return;
    setLoading(true); setResult(null); setError('');
    try {
      const r = await reservationApi.checkin(qr.trim(), null, null);
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
                <div style={{ fontSize: 12, color: C.muted }}>Fonds libérés vers votre wallet</div>
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
                  <div style={{ flex: 1, height: 6, background: C.blackLight, borderRadius: 3 }}>
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
              {r.comment && <p style={{ fontSize: 13, color: C.mutedLight }}>{r.comment}</p>}
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
  reservation: { label: 'Réservation', bg: C.bluePale,   c: C.blue,  icon: '📅' },
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
            background: period === o.value ? C.orange : C.blackMid,
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
        <KPICard icon="📅" label="Réservations"   value={summary.nb_reservations ?? '—'} color={C.blue} />
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
              const cfg = TX_TYPE_CFG[tx.type] || { label: tx.type_label, bg: C.blackLight, c: C.muted, icon: '•' };
              const dateStr = tx.date ? new Date(tx.date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
              return (
                <div key={tx.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 12,
                  background: C.blackLight,
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
  if (error) return <div style={{color:'#ef4444',padding:24,textAlign:'center'}}>{error}</div>;
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
          <div style={{ marginLeft:'auto', background:'#fef9c3', border:'1px solid #fde047', borderRadius:8, padding:'6px 12px', fontSize:12, color:'#854d0e', fontWeight:600 }}>
            ⚠ Données insuffisantes — continuez votre activité pour affiner le score
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Jauge score */}
        <div style={{ background:C.blackMid, borderRadius:16, border:`1px solid ${C.border}`, padding:24, display:'flex', flexDirection:'column', alignItems:'center' }}>
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
            { label:'RevPAR',           val:fmtF(ratios.revpar),             icon:'🏨', color:C.blue },
            { label:'ADR (prix/nuit)',  val:fmtF(ratios.adr),                icon:'💰', color:'#8b5cf6' },
            { label:'Taux occupation',  val:`${ratios.occupancy_rate}%`,     icon:'🛏️', color: ratios.occupancy_rate>=70?C.green:ratios.occupancy_rate>=40?C.orange:C.red },
            { label:'Croissance MoM',   val:(ratios.mom_growth>=0?'+':'')+ratios.mom_growth+'%', icon:'🚀', color: ratios.mom_growth>=0?C.green:C.red },
            { label:'Note clients',     val:ratios.avg_rating>0?`${ratios.avg_rating}/5`:'—',    icon:'⭐', color:'#f59e0b' },
          ].map(k => (
            <div key={k.label} style={{ background:C.blackMid, borderRadius:12, border:`1px solid ${C.border}`, padding:'12px 14px' }}>
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
        <div style={{ background:C.blackMid, borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
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
        <div style={{ background:C.blackMid, borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
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
        <div style={{ background:C.blackMid, borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:16 }}>💡 Tarification IA</div>
          {smart_pricing && (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>
                {smart_pricing.action==='augmenter'?'📈':smart_pricing.action==='baisser'?'📉':'✅'}
              </div>
              <div style={{ display:'inline-block', padding:'4px 12px', borderRadius:20, fontSize:13, fontWeight:800,
                background: smart_pricing.action==='augmenter'?'#14532d':smart_pricing.action==='baisser'?'#7f1d1d':'#0c4a6e',
                color: smart_pricing.action==='augmenter'?C.green:smart_pricing.action==='baisser'?C.red:C.blueLight,
                marginBottom:12 }}>
                {smart_pricing.action==='augmenter'?`+${smart_pricing.pct}% recommandé`:smart_pricing.action==='baisser'?`-${smart_pricing.pct}% suggéré`:'Tarifs optimaux'}
              </div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.5 }}>{smart_pricing.reason}</div>
            </div>
          )}
        </div>
      </div>

      {/* Offres de prêt */}
      <div style={{ background:C.blackMid, borderRadius:16, border:`1px solid ${C.border}`, padding:20, marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:16 }}>💰 Offres de financement SOKORA Hôtel</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {loan_offers.map(offer => (
            <div key={offer.type} style={{ borderRadius:12, border:`2px solid ${offer.eligible?C.teal:C.border}`, padding:16,
              background:offer.eligible?C.tealPale:C.blackLight, opacity:offer.eligible?1:0.75 }}>
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
      <div style={{ background:C.blackMid, borderRadius:16, border:`1px solid ${C.border}`, padding:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.white, marginBottom:12 }}>🤖 Recommandations IA</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {recommendations.map((rec,i) => (
            <div key={i} style={{ background:C.blackLight, borderRadius:8, padding:'10px 14px', fontSize:13, color:C.white, borderLeft:`3px solid ${C.teal}` }}>
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
];

function Sidebar({ active, onNav, user, hotel, onLogout }) {
  return (
    <div style={{
      width: 248, background: C.blackMid,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'fixed', left: 0, top: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${C.border}` }}>
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
      <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 14px', borderRadius: 10, border: 'none',
            background: active === n.id ? C.orange : 'transparent',
            color: active === n.id ? C.white : C.mutedLight,
            fontWeight: active === n.id ? 700 : 500,
            fontSize: 13, textAlign: 'left', width: '100%',
            transition: 'all .15s',
            boxShadow: active === n.id ? `0 4px 14px ${C.orangePale}` : 'none',
          }}
          onMouseEnter={e => { if (active !== n.id) { e.currentTarget.style.background = C.blackLight; e.currentTarget.style.color = C.white; }}}
          onMouseLeave={e => { if (active !== n.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.mutedLight; }}}
          >
            <span style={{ fontSize: 17 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      {/* Footer user */}
      <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: C.blue,
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
      case 'reservations': return <ReservationsScreen hotel={hotel} />;
      case 'checkin':      return <CheckInScreen />;
      case 'rates':        return <SeasonRatesScreen hotel={hotel} />;
      case 'reviews':      return <ReviewsScreen hotel={hotel} />;
      case 'finance':      return <FinanceIAScreen hotel={hotel} />;
      default:             return <DashboardScreen hotel={hotel} />;
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <style>{GLOBAL_CSS}</style>
      <SokoraLogo size="lg" />
      <Spinner size={36} />
    </div>
  );

  if (!user) return <><style>{GLOBAL_CSS}</style><LoginScreen onLogin={handleLogin} /></>;
  if (needSetup) return <><style>{GLOBAL_CSS}</style><SetupHotel onDone={() => { setNeedSetup(false); loadHotel(); }} /></>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.black }}>
      <style>{GLOBAL_CSS}</style>
      <Sidebar active={screen} onNav={setScreen} user={user} hotel={hotel} onLogout={handleLogout} />
      <main style={{ marginLeft: 248, flex: 1, padding: '32px 36px', minHeight: '100vh', overflowY: 'auto' }}>
        {renderScreen()}
      </main>
    </div>
  );
}

