import { useState, useEffect, useCallback } from 'react';
import { authApi, serviceApi } from './services/api';

const CI_CITIES = [
  'Abidjan','Yamoussoukro','Bouaké','Daloa','San-Pédro','Korhogo','Man','Gagnoa',
  'Abengourou','Divo','Soubré','Odienné','Bondoukou','Séguéla','Ferkessédougou',
  'Katiola','Aboisso','Adzopé','Agboville','Anyama','Bingerville','Grand-Bassam',
  'Grand-Lahou','Guiglo','Issia','Jacqueville','Lakota','Sassandra','Tiassalé',
  'Toumodi','Vavoua','Zuénoula','Tabou','Boundiali','Tengréla','Bouna','Dabou',
  'Duekoué','Sinfra','Oumé','Dimbokro','Bongouanou',
];

/* ════════════════════════════════════════════════════════════════
   CHARTE GRAPHIQUE SOKORA OFFICIELLE
════════════════════════════════════════════════════════════════ */
const C = {
  bg:          '#0f1e35',
  surface:     '#0b1829',
  card:        '#1a2e4a',
  cardHov:     '#243a5e',
  border:      '#1e3557',
  orange:      '#FF6B35',
  orangeHov:   '#FF8C5A',
  orangePale:  '#FF6B3512',
  orangeBorder:'#FF6B3540',
  teal:        '#00D4AA',
  tealPale:    '#00D4AA12',
  tealBorder:  '#00D4AA40',
  white:       '#f0f4ff',
  whiteOff:    '#E8EDF5',
  muted:       '#6b84a3',
  mutedLight:  '#8A9BC0',
  green:       '#22c55e',
  greenPale:   '#22c55e12',
  red:         '#ef4444',
  redPale:     '#ef444412',
  yellow:      '#f59e0b',
};

const STATUS_COLORS = {
  PENDING_VALIDATION: { bg:'#f59e0b22', color:'#f59e0b', label:'En attente validation' },
  CONFIRMED:          { bg:'#00D4AA22', color:'#00D4AA', label:'Confirmé' },
  PAID:               { bg:'#3b82f622', color:'#3b82f6', label:'Payé (escrow)' },
  IN_PROGRESS:        { bg:'#a78bfa22', color:'#a78bfa', label:'En cours' },
  COMPLETED:          { bg:'#22c55e22', color:'#22c55e', label:'Terminé' },
  CANCELLED:          { bg:'#ef444422', color:'#ef4444', label:'Annulé' },
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.white}; font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .app { display: flex; min-height: 100vh; }
  .sidebar { width: 220px; flex-shrink: 0; background: ${C.surface}; border-right: 1px solid ${C.border};
    display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; }
  .main { flex: 1; padding: 32px; overflow-y: auto; }
  .ni { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border: none;
    background: none; color: ${C.muted}; font-size: 13px; font-weight: 600; cursor: pointer;
    width: 100%; text-align: left; border-radius: 8px; transition: all .2s; }
  .ni:hover { background: ${C.card}; color: ${C.white}; }
  .ni.on { background: ${C.orangePale}; color: ${C.orange}; border-left: 3px solid ${C.orange}; }
  .card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; padding: 20px; }
  input, select, textarea { outline: none; font-family: inherit; }
  input::placeholder { color: ${C.muted}; }
  table { width: 100%; border-collapse: collapse; }
  th { font-weight: 700; font-size: 12px; color: ${C.muted}; text-align: left;
    padding: 10px 14px; border-bottom: 1px solid ${C.border}; }
  td { padding: 10px 14px; border-bottom: 1px solid ${C.border}22; font-size: 13px; }
`;

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
const Spinner = () => (
  <div style={{width:28,height:28,border:`3px solid ${C.border}`,borderTopColor:C.orange,
    borderRadius:'50%',animation:'spin 0.7s linear infinite'}} />
);

function Toast({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div style={{position:'fixed',bottom:24,right:24,zIndex:1000,
      padding:'14px 20px', borderRadius:12, fontWeight:600, fontSize:13,
      background: msg.ok ? C.tealPale : '#ff4d4d22',
      border:`1px solid ${msg.ok?C.tealBorder:'#ff4d4d55'}`,
      color: msg.ok ? C.teal : '#ff6b6b',
      boxShadow:'0 8px 32px #00000044',
    }}>
      {msg.text}
    </div>
  );
}

function Badge({ status }) {
  const s = STATUS_COLORS[status] || { bg:'#33333322', color:C.muted, label: status };
  return (
    <span style={{padding:'3px 10px', borderRadius:20, fontSize:11,
      fontWeight:700, background:s.bg, color:s.color}}>
      {s.label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════
   LOGIN
════════════════════════════════════════════════════════════════ */
function LoginScreen({ onLogin }) {
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');

  const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:10, background:'#0b1829', border:`1px solid ${C.border}`, color:C.white, fontSize:14, outline:'none', fontFamily:'inherit', transition:'border-color .2s' };
  const btnStyle = ok => ({ width:'100%', padding:'13px 20px', borderRadius:10, border:'none', background: ok ? `linear-gradient(135deg, ${C.teal}, #00B090)` : `${C.teal}55`, color:'#fff', fontWeight:800, fontSize:14, cursor: ok ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:8 });

  const handleLogin = async () => {
    if (!phone || !password) return;
    setLoading(true); setErr('');
    try {
      const { data } = await authApi.login({ phone_number: phone, password });
      localStorage.setItem('service_token', data.access_token);
      localStorage.setItem('service_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) { setErr(e.response?.data?.detail || e.message || 'Numéro ou mot de passe incorrect'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', position: 'relative', overflow: 'hidden' }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Panneau gauche décoratif ── */}
      <div style={{
        width: '45%',
        background: 'linear-gradient(160deg, #052a22 0%, #0f1e35 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 50px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Cercles décoratifs */}
        <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', background:`${C.teal}15`, border:`1px solid ${C.teal}22` }} />
        <div style={{ position:'absolute', bottom:-60, left:-60, width:200, height:200, borderRadius:'50%', background:`${C.teal}10` }} />

        {/* Logo SOKORA Services */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:48 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:C.teal, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>🔧</div>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:C.white, letterSpacing:'-0.5px', lineHeight:1 }}>
              SOKORA<span style={{ color:C.teal }}>.</span>
            </div>
            <div style={{ fontSize:10, color:C.teal, fontWeight:700, letterSpacing:2, textTransform:'uppercase', marginTop:2 }}>SERVICES</div>
          </div>
        </div>

        <h1 style={{ fontSize:30, fontWeight:800, color:C.white, lineHeight:1.25, marginBottom:16 }}>
          Gérez vos artisans<br />
          <span style={{ color:C.teal }}>& prestataires</span>
        </h1>
        <p style={{ fontSize:13, color:C.muted, lineHeight:1.75 }}>
          Demandes de service, paiements escrow SOKORA Wallet, suivi des prestations — tout en un seul tableau de bord.
        </p>

        <div style={{ marginTop:40, display:'flex', flexDirection:'column', gap:14 }}>
          {[
            'Paiement sécurisé via Wallet SOKORA',
            'Suivi des demandes en temps réel',
            'Gestion des artisans vérifiés',
          ].map(f => (
            <div key={f} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:C.teal, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0 }}>✓</div>
              <span style={{ fontSize:13, color:C.muted }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panneau droit — formulaire login ── */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
        <div style={{ width:'100%', maxWidth:400 }}>

          <div style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:24, fontWeight:800, color:C.white, marginBottom:6 }}>Espace Coordinateur Services</h2>
            <p style={{ fontSize:13, color:C.muted }}>Connectez-vous pour gérer vos artisans et prestataires</p>
          </div>

          {err && <div style={{ padding:'10px 14px', borderRadius:8, background:'#ef444418', border:'1px solid #ef444440', color:'#f87171', fontSize:12, marginBottom:20 }}>{err}</div>}

          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:12, fontWeight:600, color:C.muted, display:'block', marginBottom:6 }}>Numéro de téléphone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0700000000" style={inputStyle} onKeyDown={e => e.key==='Enter' && handleLogin()} autoComplete="off" autoFocus />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:12, fontWeight:600, color:C.muted, display:'block', marginBottom:6 }}>Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" style={inputStyle} onKeyDown={e => e.key==='Enter' && handleLogin()} autoComplete="new-password" />
          </div>
          <button onClick={handleLogin} disabled={loading || !phone || !password} style={btnStyle(!loading && !!phone && !!password)}>
            {loading ? <Spinner /> : 'Se connecter →'}
          </button>

          <p style={{ textAlign:'center', fontSize:11, color:C.muted, marginTop:28 }}>
            SOKORA Services · Artisans &amp; Prestataires · v3.0
          </p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DASHBOARD SCREEN
════════════════════════════════════════════════════════════════ */
function DashboardScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    serviceApi.dashboard().then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{textAlign:'center',padding:60}}><Spinner /></div>;
  if (!data) return <div style={{color:C.muted, padding:40}}>Erreur de chargement</div>;

  return (
    <div>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:22, fontWeight:800, color:C.white}}>🔧 Vue d'ensemble</div>
        <div style={{fontSize:13, color:C.muted, marginTop:4}}>Services informels · Marketplace SOKORA</div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:14, marginBottom:28}}>
        {[
          { icon:'🔧', label:'Prestataires actifs',        val: data.total_providers,                              color: C.teal },
          { icon:'✅', label:'Vérifiés SOKORA',             val: data.verified_providers,                           color: C.green },
          { icon:'📋', label:'Demandes totales',            val: data.total_requests,                               color: C.orange },
          { icon:'⏳', label:'En attente validation',       val: data.status_counts?.PENDING_VALIDATION ?? 0,       color: '#f59e0b' },
          { icon:'✔️', label:'Prestations terminées',       val: data.status_counts?.COMPLETED ?? 0,                color: '#a78bfa' },
          { icon:'🔄', label:'En cours',                    val: data.status_counts?.IN_PROGRESS ?? 0,              color: C.mutedLight },
        ].map(k => (
          <div key={k.label} className="card">
            <div style={{fontSize:24}}>{k.icon}</div>
            <div style={{fontWeight:800, color:k.color, fontSize:26, marginTop:8}}>{k.val ?? 0}</div>
            <div style={{fontSize:11, color:C.muted, marginTop:4}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
        {/* Status breakdown */}
        <div className="card">
          <div style={{fontWeight:700, color:C.white, marginBottom:14}}>Statuts des demandes</div>
          {Object.entries(data.status_counts||{}).map(([s, cnt]) => {
            const meta = STATUS_COLORS[s] || {};
            return (
              <div key={s} style={{display:'flex', alignItems:'center', gap:10,
                padding:'8px 0', borderBottom:`1px solid ${C.border}22`}}>
                <span style={{padding:'2px 9px', borderRadius:20, fontSize:11,
                  fontWeight:700, background:meta.bg||C.card, color:meta.color||C.white}}>
                  {meta.label||s}
                </span>
                <div style={{flex:1, height:4, borderRadius:2, background:C.border, overflow:'hidden'}}>
                  <div style={{height:'100%', width:`${Math.min(100, (cnt/(data.total_requests||1))*100)}%`,
                    background:meta.color||C.orange, borderRadius:2}} />
                </div>
                <span style={{fontWeight:700, color:C.white, minWidth:24, textAlign:'right'}}>{cnt}</span>
              </div>
            );
          })}
        </div>

        {/* By category */}
        <div className="card">
          <div style={{fontWeight:700, color:C.white, marginBottom:14}}>Prestataires par catégorie</div>
          <div style={{maxHeight:220, overflowY:'auto'}}>
            {(data.by_category||[]).slice(0,10).map(c => (
              <div key={c.category} style={{display:'flex', alignItems:'center', gap:10,
                padding:'6px 0', borderBottom:`1px solid ${C.border}22`}}>
                <span style={{fontSize:18}}>{c.icon}</span>
                <span style={{flex:1, fontSize:13, color:C.white}}>{c.category}</span>
                <span style={{fontWeight:700, color:c.count>0?C.orange:C.muted}}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top providers */}
      {data.top_providers?.length > 0 && (
        <div className="card" style={{marginTop:16}}>
          <div style={{fontWeight:700, color:C.white, marginBottom:14}}>Top prestataires</div>
          <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
            {data.top_providers.map(p => (
              <div key={p.id} style={{background:C.bg, border:`1px solid ${C.border}`,
                borderRadius:12, padding:'14px 16px', minWidth:160}}>
                <div style={{fontSize:20}}>{p.category_icon}</div>
                <div style={{fontWeight:700, color:C.white, fontSize:13, marginTop:6}}>{p.name}</div>
                <div style={{fontSize:11, color:C.muted}}>{p.category_name}</div>
                <div style={{display:'flex', alignItems:'center', gap:4, marginTop:6}}>
                  <span style={{color:C.yellow}}>⭐</span>
                  <span style={{fontWeight:700, color:C.white, fontSize:13}}>{p.rating?.toFixed(1)}</span>
                  <span style={{fontSize:11, color:C.muted}}>({p.reviews_count})</span>
                  {p.is_verified && <span style={{marginLeft:4, fontSize:11, color:C.teal}}>✓ Vérifié</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PROVIDERS SCREEN
════════════════════════════════════════════════════════════════ */
function ProvidersScreen({ showToast }) {
  const [providers, setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', category_id:'', city:'Abidjan', neighborhood:'', description:'', base_price:'', price_unit:'prestation' });

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (catFilter) params.category_id = catFilter;
    try {
      const [p, c] = await Promise.all([serviceApi.listProviders(params), serviceApi.categories()]);
      setProviders(p.data.providers || []);
      setCategories(c.data || []);
    } catch {}
    setLoading(false);
  }, [search, catFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await serviceApi.createProvider({ ...form, category_id: parseInt(form.category_id), base_price: form.base_price ? parseFloat(form.base_price) : null });
      showToast({ text: 'Prestataire ajouté', ok: true });
      setShowForm(false);
      setForm({ name:'', phone:'', category_id:'', city:'Abidjan', neighborhood:'', description:'', base_price:'', price_unit:'prestation' });
      load();
    } catch(e) { showToast({ text: e.response?.data?.detail || 'Erreur', ok: false }); }
  };

  const handleVerify = async (p) => {
    await serviceApi.updateProvider(p.id, { is_verified: !p.is_verified });
    showToast({ text: p.is_verified ? 'Vérification retirée' : '✓ Prestataire vérifié', ok: true });
    load();
  };

  const handleDelete = async (id) => {
    await serviceApi.deleteProvider(id);
    showToast({ text: 'Prestataire désactivé', ok: true });
    load();
  };

  const inp = (placeholder, key, type='text', opts={}) => (
    <input
      type={type}
      placeholder={placeholder}
      value={form[key]}
      onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
      style={{width:'100%', padding:'10px 12px', borderRadius:8, margin:'4px 0 12px',
        background:C.bg, border:`1px solid ${C.border}`, color:C.white, fontSize:13, ...opts}}
    />
  );

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <div>
          <div style={{fontSize:20, fontWeight:800, color:C.white}}>🔧 Prestataires</div>
          <div style={{fontSize:12, color:C.muted, marginTop:2}}>{providers.length} prestataire(s) trouvé(s)</div>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          padding:'10px 20px', borderRadius:10, border:'none',
          background:`linear-gradient(135deg, ${C.orange}, ${C.orangeHov})`,
          color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer',
        }}>+ Ajouter prestataire</button>
      </div>

      {/* Filters */}
      <div style={{display:'flex', gap:10, marginBottom:16}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Rechercher par nom ou téléphone…"
          style={{flex:1, padding:'10px 14px', borderRadius:8,
            background:C.card, border:`1px solid ${C.border}`, color:C.white, fontSize:13}} />
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
          style={{padding:'10px 14px', borderRadius:8, background:C.card, border:`1px solid ${C.border}`, color:C.white}}>
          <option value="">Toutes catégories</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div style={{position:'fixed', inset:0, background:'#00000088', zIndex:100,
          display:'flex', alignItems:'center', justifyContent:'center'}}>
          <form onSubmit={handleCreate} style={{
            background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:28,
            width:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px #00000066',
          }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:20}}>
              <div style={{fontWeight:700, color:C.white, fontSize:16}}>Nouveau prestataire</div>
              <button type="button" onClick={() => setShowForm(false)}
                style={{background:'none', border:'none', color:C.muted, fontSize:18, cursor:'pointer'}}>✕</button>
            </div>
            <label style={{fontSize:12, color:C.muted}}>Nom *</label>
            {inp('Ex: Kouassi Jean-Claude', 'name')}
            <label style={{fontSize:12, color:C.muted}}>Téléphone *</label>
            {inp('+225 07 00 00 00 00', 'phone')}
            <label style={{fontSize:12, color:C.muted}}>Catégorie *</label>
            <select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}
              required
              style={{width:'100%', padding:'10px 12px', borderRadius:8, margin:'4px 0 12px',
                background:C.bg, border:`1px solid ${C.border}`, color:C.white}}>
              <option value="">-- Sélectionner --</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              <div>
                <label style={{fontSize:12, color:C.muted}}>Ville</label>
                <select value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}
                  style={{width:'100%', padding:'10px 12px', borderRadius:8, margin:'4px 0 12px',
                    background:C.bg, border:`1px solid ${C.border}`, color:C.white, fontSize:13}}>
                  <option value="">— Choisir —</option>
                  {CI_CITIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={{fontSize:12, color:C.muted}}>Quartier</label>{inp('Cocody, Yop…', 'neighborhood')}</div>
            </div>
            <label style={{fontSize:12, color:C.muted}}>Description</label>
            <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
              placeholder="Compétences, expérience…"
              style={{width:'100%', padding:'10px 12px', borderRadius:8, margin:'4px 0 12px',
                background:C.bg, border:`1px solid ${C.border}`, color:C.white, fontSize:13,
                minHeight:80, resize:'vertical'}} />
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              <div><label style={{fontSize:12, color:C.muted}}>Tarif (XOF)</label>{inp('5000', 'base_price', 'number')}</div>
              <div>
                <label style={{fontSize:12, color:C.muted}}>Unité</label>
                <select value={form.price_unit} onChange={e=>setForm(f=>({...f,price_unit:e.target.value}))}
                  style={{width:'100%', padding:'10px 12px', borderRadius:8, margin:'4px 0 12px',
                    background:C.bg, border:`1px solid ${C.border}`, color:C.white}}>
                  {['prestation','heure','jour','semaine'].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex', gap:10, marginTop:8}}>
              <button type="button" onClick={() => setShowForm(false)} style={{
                flex:1, padding:'12px', borderRadius:8, border:`1px solid ${C.border}`,
                background:'none', color:C.muted, fontWeight:700, cursor:'pointer',
              }}>Annuler</button>
              <button type="submit" style={{
                flex:2, padding:'12px', borderRadius:8, border:'none',
                background:`linear-gradient(135deg, ${C.orange}, ${C.orangeHov})`,
                color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer',
              }}>Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div style={{textAlign:'center',padding:60}}><Spinner /></div> : (
        <div className="card" style={{overflowX:'auto'}}>
          <table>
            <thead>
              <tr>
                {['Prestataire','Catégorie','Ville','Tarif','Note','Statut','Actions'].map(h=>(
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{fontWeight:700, color:C.white}}>{p.name}</div>
                    <div style={{fontSize:11, color:C.muted}}>{p.phone}</div>
                  </td>
                  <td>
                    <span style={{fontSize:16}}>{p.category_icon}</span>
                    <span style={{marginLeft:6, fontSize:12, color:C.muted}}>{p.category_name}</span>
                  </td>
                  <td style={{color:C.muted, fontSize:12}}>{p.city}{p.neighborhood ? ` · ${p.neighborhood}` : ''}</td>
                  <td style={{color:C.white, fontSize:12}}>
                    {p.base_price ? `${p.base_price?.toLocaleString()} XOF / ${p.price_unit}` : '—'}
                  </td>
                  <td>
                    {p.reviews_count > 0 ? (
                      <span style={{color:C.yellow}}>⭐ {p.rating?.toFixed(1)} <span style={{color:C.muted,fontSize:11}}>({p.reviews_count})</span></span>
                    ) : <span style={{color:C.muted, fontSize:12}}>—</span>}
                  </td>
                  <td>
                    {p.is_verified
                      ? <span style={{padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:C.tealPale, color:C.teal}}>✓ Vérifié</span>
                      : <span style={{padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:C.orangePale, color:C.orange}}>Non vérifié</span>
                    }
                  </td>
                  <td>
                    <div style={{display:'flex', gap:6}}>
                      <button onClick={() => handleVerify(p)}
                        style={{padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer',
                          background: p.is_verified ? C.orangePale : C.tealPale,
                          color: p.is_verified ? C.orange : C.teal, fontSize:11, fontWeight:700}}>
                        {p.is_verified ? 'Retirer ✓' : '✓ Vérifier'}
                      </button>
                      <button onClick={() => handleDelete(p.id)}
                        style={{padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer',
                          background:'#ef444422', color:C.red, fontSize:11, fontWeight:700}}>
                        Désactiver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr><td colSpan={7} style={{textAlign:'center', padding:40, color:C.muted}}>
                  Aucun prestataire trouvé
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   REQUESTS SCREEN
════════════════════════════════════════════════════════════════ */
function RequestsScreen({ showToast }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const r = await serviceApi.listRequests(params);
      setRequests(r.data.requests || []);
    } catch {}
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await serviceApi.updateStatus(id, status);
      showToast({ text: `Statut mis à jour : ${STATUS_COLORS[status]?.label||status}`, ok: true });
      load();
    } catch { showToast({ text: 'Erreur', ok: false }); }
  };

  const NEXT_STATUS = {
    PENDING_VALIDATION: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED:          ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS:        ['COMPLETED', 'CANCELLED'],
  };

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <div>
          <div style={{fontSize:20, fontWeight:800, color:C.white}}>📋 Demandes de service</div>
          <div style={{fontSize:12, color:C.muted, marginTop:2}}>{requests.length} demande(s)</div>
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{padding:'10px 14px', borderRadius:8, background:C.card, border:`1px solid ${C.border}`, color:C.white}}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_COLORS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? <div style={{textAlign:'center',padding:60}}><Spinner /></div> : (
        <div className="card" style={{overflowX:'auto'}}>
          <table>
            <thead>
              <tr>
                {['Date','Client','Prestataire','Description','Statut','Prix','Actions'].map(h=><th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td style={{color:C.muted, fontSize:11}}>{r.created_at?.slice(0,10)}</td>
                  <td>
                    <div style={{fontWeight:600, color:C.white}}>{r.client_name}</div>
                    <div style={{fontSize:11, color:C.muted}}>{r.client_phone}</div>
                  </td>
                  <td style={{color:C.white, fontSize:12}}>{r.provider_name}</td>
                  <td style={{color:C.muted, fontSize:12, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {r.description || '—'}
                  </td>
                  <td><Badge status={r.status} /></td>
                  <td style={{color:C.orange, fontSize:12, fontWeight:700}}>
                    {r.agreed_price ? `${r.agreed_price?.toLocaleString()} XOF` : '—'}
                  </td>
                  <td>
                    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                      {(NEXT_STATUS[r.status]||[]).map(s => (
                        <button key={s} onClick={() => updateStatus(r.id, s)}
                          style={{padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer',
                            background: STATUS_COLORS[s]?.bg || C.card,
                            color: STATUS_COLORS[s]?.color || C.white,
                            fontSize:11, fontWeight:700}}>
                          → {STATUS_COLORS[s]?.label||s}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td colSpan={7} style={{textAlign:'center', padding:40, color:C.muted}}>
                  Aucune demande
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SIDEBAR + APP ROOT
════════════════════════════════════════════════════════════════ */
const NAV = [
  { id: 'dashboard',  icon: '📊', label: 'Vue d\'ensemble' },
  { id: 'providers',  icon: '🔧', label: 'Prestataires'   },
  { id: 'requests',   icon: '📋', label: 'Demandes'        },
];

function SokoraLogo() {
  return (
    <div style={{padding:'20px 16px 12px', borderBottom:`1px solid ${C.border}`}}>
      <div style={{fontSize:20, fontWeight:900, color:C.white, letterSpacing:'-0.5px'}}>
        SOKORA<span style={{color:C.orange}}>.</span>
      </div>
      <div style={{fontSize:10, color:C.orange, fontWeight:700, marginTop:2, letterSpacing:'1px'}}>
        SERVICES INFORMELS
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('service_user')); } catch { return null; }
  });
  const [screen, setScreen] = useState('dashboard');
  const [toast, setToast]   = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const handleLogout = () => {
    localStorage.removeItem('service_token');
    localStorage.removeItem('service_user');
    setUser(null);
  };

  if (!user) return <LoginScreen onLogin={setUser} />;

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard': return <DashboardScreen />;
      case 'providers': return <ProvidersScreen showToast={showToast} />;
      case 'requests':  return <RequestsScreen  showToast={showToast} />;
      default:          return <DashboardScreen />;
    }
  };

  return (
    <div className="app">
      <style>{GLOBAL_CSS}</style>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Sidebar */}
      <div className="sidebar">
        <SokoraLogo />
        <nav style={{flex:1, padding:'12px 8px'}}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setScreen(n.id)}
              className={`ni${screen===n.id?' on':''}`}>
              <span style={{fontSize:16}}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div style={{padding:16, borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:12, color:C.muted, marginBottom:8}}>
            {user?.full_name || user?.phone_number || 'Admin'}
          </div>
          <button onClick={handleLogout} style={{
            width:'100%', padding:'8px', borderRadius:8,
            border:`1px solid ${C.border}`, background:'none',
            color:C.muted, fontSize:12, fontWeight:600, cursor:'pointer',
          }}>Déconnexion</button>
        </div>
      </div>

      {/* Main */}
      <main className="main">
        {renderScreen()}
      </main>

      <Toast msg={toast} onClose={() => setToast(null)} />
    </div>
  );
}
