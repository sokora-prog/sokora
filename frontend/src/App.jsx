import React, { useState, useCallback, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { useApi, useMutation } from "./useApi";
import { dashboardApi, tablesApi, menuApi, ordersApi, expensesApi, staffApi, stockApi, creditApi, walletApi, kdsApi, establishmentsApi, financeApi, adminApi, reportsApi, posApi } from "./api";

const fmt = n => new Intl.NumberFormat("fr-FR").format(n ?? 0) + " F";
const fmtDate = d => new Date(d).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
const CAT_EXPENSE = { stock:"Stock", salary:"Salaires", utility:"Charges", rent:"Loyer", other:"Autre" };

const C = {
  navy:"#0f1e35", navyMid:"#1a2e4a", navyLight:"#243a5e",
  orange:"#f07d1a", orangeHov:"#f9a050", orangePale:"#fff4ea",
  teal:"#19a99d", tealPale:"#edfaf8",
  green:"#4caf6e", purple:"#6366f1",
  red:"#e84040", gold:"#f59e0b",
  bg:"#f0f4fb", surface:"#ffffff",
  border:"#dde4f0", text:"#0f1e35",
  muted:"#7a8fab", faint:"#b8c4d8",
};

const AVATAR_COLORS = [C.orange, C.teal, C.purple, C.green];

const Logo = ({ size=32, text=true }) => (
  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill={C.navy}/>
      <rect width="48" height="48" rx="12" fill={`url(#lg${size})`}/>
      <defs>
        <linearGradient id={`lg${size}`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1a2e4a"/>
          <stop offset="100%" stopColor="#0f1e35"/>
        </linearGradient>
      </defs>
      {/* Assiette */}
      <ellipse cx="24" cy="30" rx="13" ry="4" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
      <ellipse cx="24" cy="30" rx="9" ry="2.8" fill="none" stroke={C.orange} strokeWidth="1.5"/>
      {/* Cloche */}
      <path d="M13 30 Q13 18 24 18 Q35 18 35 30" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Tige */}
      <line x1="24" y1="18" x2="24" y2="14" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Bouton cloche */}
      <circle cx="24" cy="13" r="2.5" fill={C.orange}/>
      {/* Signal wifi */}
      <path d="M20 24 Q24 21 28 24" stroke={C.orange} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M18 22 Q24 18 30 22" stroke={C.orange} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity=".5"/>
    </svg>
    {text && (
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:size*0.58, color:C.navy, letterSpacing:"-0.5px", lineHeight:1 }}>
          S<span style={{ color:C.orange }}>O</span>KORA
        </span>
        <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:500, fontSize:size*0.22, color:C.muted, letterSpacing:"0.8px", textTransform:"uppercase" }}>Restaurant OS</span>
      </div>
    )}
  </div>
);

const Ic = ({ n, sz=17, col="currentColor" }) => {
  const a = { width:sz, height:sz, viewBox:"0 0 24 24", fill:"none", stroke:col, strokeWidth:"2", strokeLinecap:"round", strokeLinejoin:"round" };
  const icons = {
    grid:    <svg {...a}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    menu:    <svg {...a}><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
    users:   <svg {...a}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    dollar:  <svg {...a}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    check:   <svg {...a}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
    plus:    <svg {...a}><path d="M12 5v14M5 12h14"/></svg>,
    warn:    <svg {...a}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    logout:  <svg {...a}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
    refresh: <svg {...a}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
    table:   <svg {...a}><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M6 7v11M18 7v11M6 12h12"/></svg>,
    chart:   <svg {...a}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    box:     <svg {...a}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    cal:     <svg {...a}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    trend:   <svg {...a}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    wallet:  <svg {...a}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/></svg>,
    chef:    <svg {...a}><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>,
    minus:   <svg {...a}><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    card:    <svg {...a}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  };
  return icons[n] || null;
};

const TST = { free:{l:"Libre",bg:C.tealPale,c:C.teal}, occupied:{l:"Occupée",bg:C.orangePale,c:C.orange}, reserved:{l:"Réservée",bg:"#eef0ff",c:C.purple} };
const OST = { open:{l:"En cours",bg:C.orangePale,c:C.orange}, sent:{l:"Envoyée",bg:"#eef0ff",c:C.purple}, ready:{l:"PrÃƒÆ’te",bg:C.tealPale,c:C.teal}, paid:{l:"Payée",bg:C.tealPale,c:C.teal}, cancelled:{l:"Annulée",bg:"#fff0f0",c:C.red} };

const Spinner = ({ size=20, col=C.orange }) => (
  <div style={{ width:size, height:size, border:`2.5px solid rgba(0,0,0,.08)`, borderTopColor:col, borderRadius:"50%", animation:"spin .7s linear infinite", flexShrink:0 }}/>
);

const ErrorBox = ({ msg, onRetry }) => (
  <div style={{ background:"#fff0f0", border:`1px solid ${C.red}33`, borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, fontSize:13, color:C.red }}>
    <span>{msg}</span>
    {onRetry && <button onClick={onRetry} style={{ background:"none", border:`1px solid ${C.red}44`, color:C.red, borderRadius:7, padding:"4px 11px", cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", gap:5 }}><Ic n="refresh" sz={11} col={C.red}/> Réessayer</button>}
  </div>
);

// ── MINI LINE CHART (SVG natif, sans librairie) ────────────────────────────────
function RevenueChart({ data, period }) {
  const W = 100, H = 52;
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.revenue), 1);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.revenue / maxVal) * H * 0.85 - 3;
    return `${x},${y}`;
  });

  const pathD = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt}`;
    const [px, py] = pts[i-1].split(",").map(Number);
    const [cx, cy] = pt.split(",").map(Number);
    const mx = (px + cx) / 2;
    return acc + ` C ${mx},${py} ${mx},${cy} ${cx},${cy}`;
  }, "");

  const areaD = pathD + ` L ${W},${H} L 0,${H} Z`;

  // Labels: afficher seulement 4-5 labels espacés
  const step = Math.ceil(data.length / 5);
  const labels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <div style={{ background: C.surface, borderRadius:16, padding:"18px 20px", border:`1px solid ${C.border}`, marginBottom:20 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <Ic n="trend" sz={14} col={C.orange}/>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, color:C.navy }}>
            CA par jour — {period === "30d" ? "30 derniers jours" : "7 derniers jours"}
          </span>
        </div>
        <span style={{ fontSize:11, color:C.muted }}>
          Total: {fmt(data.reduce((s,d) => s + d.revenue, 0))}
        </span>
      </div>

      {/* SVG chart */}
      <div style={{ position:"relative", height:110, marginBottom:6 }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position:"absolute", top:0, left:0, width:"100%", height:"80%" }}>
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.orange} stopOpacity="0.25"/>
              <stop offset="100%" stopColor={C.orange} stopOpacity="0.01"/>
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#chartGrad)"/>
          <path d={pathD} fill="none" stroke={C.orange} strokeWidth="1.5"/>
          {data.map((d, i) => {
            const x = (i / (data.length - 1)) * W;
            const y = H - (d.revenue / maxVal) * H * 0.85 - 3;
            return d.revenue > 0 ? (
              <circle key={i} cx={x} cy={y} r="1.2" fill={C.orange}/>
            ) : null;
          })}
        </svg>
        {/* Labels axe X */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, display:"flex", justifyContent:"space-between", padding:"0 2px" }}>
          {labels.map((d, i) => (
            <span key={i} style={{ fontSize:9, color:C.muted, fontWeight:500 }}>{d.label}</span>
          ))}
        </div>
      </div>

      {/* Barres mini en bas */}
      <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:28, marginTop:4 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <div style={{
              width:"100%", borderRadius:"3px 3px 0 0",
              height: d.revenue > 0 ? `${Math.max((d.revenue / maxVal) * 100, 8)}%` : "4px",
              background: d.revenue > 0 ? `linear-gradient(180deg, ${C.orange}, ${C.orangeHov})` : C.border,
              minHeight:3, transition:"height .4s ease"
            }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PERIOD SELECTOR ────────────────────────────────────────────────────────────
const PERIODS = [
  { id:"today", label:"Aujourd'hui" },
  { id:"7d",    label:"7 jours" },
  { id:"30d",   label:"30 jours" },
];

function PeriodSelector({ value, onChange }) {
  return (
    <div style={{ display:"flex", gap:4, background:C.bg, borderRadius:10, padding:3, border:`1px solid ${C.border}` }}>
      {PERIODS.map(p => (
        <button key={p.id} onClick={() => onChange(p.id)} style={{
          padding:"5px 12px", borderRadius:8, border:"none", cursor:"pointer",
          fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans',sans-serif",
          background: value === p.id ? C.orange : "transparent",
          color: value === p.id ? "#fff" : C.muted,
          boxShadow: value === p.id ? `0 2px 8px ${C.orange}44` : "none",
          transition:"all .15s"
        }}>{p.label}</button>
      ))}
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#eef2f9;color:#0f1e35;font-family:'Plus Jakarta Sans',sans-serif;font-size:13.5px;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#d0d9ec;border-radius:4px}

/* ── SIDEBAR ── */
.app{display:flex;min-height:100vh}
.sb{width:240px;min-height:100vh;background:#0b1829;display:flex;flex-direction:column;position:fixed;top:0;left:0;z-index:100;border-right:1px solid rgba(255,255,255,.06)}
.sb-logo{padding:22px 20px 18px;border-bottom:1px solid rgba(255,255,255,.06)}
.sb-tag{font-size:9px;color:rgba(255,255,255,.25);letter-spacing:2px;text-transform:uppercase;margin-top:4px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:500}
.sb-sect{padding:18px 20px 6px;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.2);font-weight:700;font-family:'Plus Jakarta Sans',sans-serif}
.sb-nav{padding:0 10px;flex:1;display:flex;flex-direction:column;gap:2px}
.ni{display:flex;align-items:center;gap:11px;padding:10px 13px;border-radius:10px;cursor:pointer;font-size:13px;color:rgba(255,255,255,.4);font-weight:500;transition:all .18s;border:none;background:none;width:100%;text-align:left;font-family:'Plus Jakarta Sans',sans-serif;letter-spacing:-.1px}
.ni:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.75)}
.ni.on{background:linear-gradient(135deg,#f07d1a 0%,#e8691a 100%);color:#fff;font-weight:600;box-shadow:0 4px 16px rgba(240,125,26,.35)}
.sb-foot{margin:10px 10px 16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 16px}
.sb-foot strong{color:rgba(255,255,255,.9);display:block;font-size:12.5px;margin:8px 0 2px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:600}
.sb-foot p{font-size:11px;color:rgba(255,255,255,.28);font-family:'Plus Jakarta Sans',sans-serif}
.trial{display:inline-flex;align-items:center;gap:5px;margin-top:9px;background:rgba(240,125,26,.15);color:#f9a050;border:1px solid rgba(240,125,26,.25);padding:4px 10px;border-radius:20px;font-size:9.5px;font-weight:700;letter-spacing:.3px}

/* ── MAIN ── */
.main{margin-left:240px;flex:1;display:flex;flex-direction:column}
.topbar{height:60px;padding:0 28px;background:#fff;border-bottom:1px solid #e6ecf7;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;box-shadow:0 1px 12px rgba(15,30,53,.05)}
.tb-title{font-family:'Syne',sans-serif;font-weight:700;font-size:16px;color:#0f1e35;letter-spacing:-.3px}
.tb-r{display:flex;align-items:center;gap:12px}
.live{background:#edfaf8;color:#19a99d;border:1px solid rgba(25,169,157,.2);padding:5px 12px;border-radius:20px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:6px;letter-spacing:.2px}
.dot{width:6px;height:6px;border-radius:50%;background:#19a99d;animation:blink 2s infinite}
.uavatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#f07d1a,#e8691a);display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;flex-shrink:0;border:none;box-shadow:0 2px 8px rgba(240,125,26,.35)}
.content{padding:24px 28px;flex:1;animation:fadeUp .25s ease}

/* ── KPI CARDS ── */
.kgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px}
.kcard{background:#fff;border-radius:16px;padding:18px;border:1px solid #e6ecf7;box-shadow:0 2px 12px rgba(15,30,53,.04);position:relative;overflow:hidden;transition:transform .18s,box-shadow .18s;animation:fadeUp .3s ease both}
.kcard:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(15,30,53,.09)}
.kstripe{position:absolute;top:0;left:0;right:0;height:3px;border-radius:16px 16px 0 0}
.kicon{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:17px;margin-bottom:12px}
.klabel{font-size:10px;color:#7a8fab;font-weight:700;text-transform:uppercase;letter-spacing:.8px}
.kval{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;margin-top:4px;line-height:1.1;letter-spacing:-.5px}
.ksub{font-size:10.5px;color:#b8c4d8;margin-top:4px;font-weight:500}

/* ── CARDS ── */
.card{background:#fff;border-radius:16px;border:1px solid #e6ecf7;box-shadow:0 2px 10px rgba(15,30,53,.04);overflow:hidden;margin-bottom:20px}
.sec-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.sec-title{font-family:'Syne',sans-serif;font-weight:700;font-size:14px;color:#0f1e35;display:flex;align-items:center;gap:8px;letter-spacing:-.2px}

/* ── TABLES ── */
.tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:11px;margin-bottom:20px}
.tcard{background:#fff;border-radius:14px;padding:14px 10px;text-align:center;cursor:pointer;border:2px solid transparent;box-shadow:0 2px 8px rgba(15,30,53,.05);transition:all .18s}
.tcard:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(15,30,53,.1)}
.tnum{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;letter-spacing:-.5px}
.tlbl{font-size:10px;color:#7a8fab;margin:3px 0 6px;font-weight:500}
.tpill{font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;display:inline-block;letter-spacing:.2px}
.tcap{font-size:9px;color:#b8c4d8;margin-top:5px;font-weight:500}

/* ── WAITERS ── */
.wlist{display:flex;flex-direction:column;gap:9px;margin-bottom:20px}
.wcard{background:#fff;border-radius:13px;padding:13px 16px;display:flex;align-items:center;gap:13px;border:1px solid #e6ecf7;transition:box-shadow .18s}
.wcard:hover{box-shadow:0 5px 16px rgba(15,30,53,.09)}
.wav{border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;color:#fff;flex-shrink:0}

/* ── PRODUCTS ── */
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:13px}
.pcard{background:#fff;border-radius:14px;padding:15px;border:1px solid #e6ecf7;box-shadow:0 2px 8px rgba(15,30,53,.04);transition:all .18s;position:relative;overflow:hidden}
.pcard:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(15,30,53,.09)}
.pcard.off{opacity:.5}
.pbadge{position:absolute;top:12px;right:12px;font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;letter-spacing:.2px}

/* ── TABLE ── */
.dt{width:100%;border-collapse:collapse;font-size:12.5px}
.dt th{text-align:left;padding:11px 16px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#7a8fab;border-bottom:1px solid #e6ecf7;font-weight:700;background:#f8fafd}
.dt td{padding:12px 16px;border-bottom:1px solid #e6ecf7;vertical-align:middle}
.dt tr:last-child td{border-bottom:none}
.dt tr:hover td{background:#fafbfd}

/* ── MISC ── */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
.tabs{display:flex;gap:5px;margin-bottom:18px;flex-wrap:wrap}
.tab{padding:6px 14px;border-radius:8px;font-size:12.5px;cursor:pointer;border:1.5px solid #e6ecf7;background:#fff;color:#7a8fab;font-weight:500;transition:all .18s;font-family:'Plus Jakarta Sans',sans-serif}
.tab:hover{border-color:rgba(240,125,26,.4);color:#f07d1a}
.tab.on{background:#f07d1a;color:#fff;border-color:#f07d1a;font-weight:700;box-shadow:0 3px 10px rgba(240,125,26,.3)}
.badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.2px}
.btn{padding:8px 16px;border-radius:9px;border:none;cursor:pointer;font-size:12.5px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;display:inline-flex;align-items:center;gap:6px;transition:all .18s;letter-spacing:-.1px}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn-o{background:linear-gradient(135deg,#f07d1a,#e8691a);color:#fff;box-shadow:0 3px 10px rgba(240,125,26,.35)}
.btn-o:hover:not(:disabled){background:linear-gradient(135deg,#f9a050,#f07d1a);box-shadow:0 5px 14px rgba(240,125,26,.45)}
.btn-g{background:#fff;color:#0f1e35;border:1.5px solid #e6ecf7}
.btn-g:hover:not(:disabled){border-color:#f07d1a;color:#f07d1a}
.form-row{display:flex;gap:11px;margin-bottom:11px;flex-wrap:wrap}
.ig{display:flex;flex-direction:column;gap:5px;flex:1;min-width:120px}
.ig label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#7a8fab;font-weight:700}
.ig input,.ig select{background:#fff;border:1.5px solid #e6ecf7;color:#0f1e35;padding:9px 12px;border-radius:8px;font-size:12.5px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:border-color .18s,box-shadow .18s}
.ig input:focus,.ig select:focus{border-color:#f07d1a;box-shadow:0 0 0 3px rgba(240,125,26,.1)}
.fcard{background:#f8fafd;border:1.5px solid #e6ecf7;border-radius:12px;padding:16px;margin-bottom:14px}
.prog{height:5px;background:#e6ecf7;border-radius:4px;overflow:hidden}
.progf{height:100%;border-radius:4px;transition:width .7s ease}
.erow{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid #e6ecf7}
.erow:last-child{border-bottom:none}
.ocard{background:#fff;border-radius:14px;padding:15px 18px;margin-bottom:11px;border:1px solid #e6ecf7;box-shadow:0 2px 8px rgba(15,30,53,.04)}
.sbox{border-radius:16px;padding:20px 22px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between}
.samt{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;letter-spacing:-.5px}
.empty{text-align:center;padding:48px;color:#7a8fab;font-size:13.5px}
.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#08111f 0%,#0f1e35 50%,#1a2e4a 100%);position:relative;overflow:hidden}
.login-page::before{content:'';position:absolute;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(240,125,26,.08) 0%,transparent 70%);top:-100px;right:-100px}
.login-page::after{content:'';position:absolute;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(25,169,157,.06) 0%,transparent 70%);bottom:-80px;left:-80px}
.login-card{background:#fff;border-radius:22px;padding:40px;width:100%;max-width:390px;box-shadow:0 32px 80px rgba(0,0,0,.4);position:relative;z-index:1}
.reg-steps{display:flex;align-items:center;gap:6px;margin-bottom:28px}
.reg-step{flex:1;height:4px;border-radius:2px;background:#e6ecf7;transition:background .3s}
.reg-step.done{background:#f07d1a}
.reg-step.active{background:#f07d1a;opacity:.5}
.onb-banner{background:linear-gradient(135deg,#fff4ea,#fffbf5);border:1.5px solid #f07d1a33;border-radius:18px;padding:22px 24px;margin-bottom:24px}
.onb-title{font-family:'Syne',sans-serif;font-weight:800;font-size:17px;color:#0f1e35;margin-bottom:4px}
.onb-sub{font-size:12.5px;color:#7a8fab;margin-bottom:16px}
.onb-steps{display:flex;flex-direction:column;gap:9px}
.onb-item{display:flex;align-items:center;gap:10px;font-size:13px;color:#0f1e35;cursor:pointer;padding:9px 12px;background:#fff;border-radius:10px;border:1px solid #e6ecf7;transition:border-color .2s}
.onb-item:hover{border-color:#f07d1a66}
.onb-item.done{color:#7a8fab;text-decoration:line-through}
.onb-check{width:22px;height:22px;border-radius:50%;border:2px solid #dde4f0;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px}
.onb-check.ok{background:#4caf6e;border-color:#4caf6e;color:#fff}
.period-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
`;


// ── CAISSE WIDGET ──────────────────────────────────────────────────────────────
function CaisseWidget() {
  const [period, setPeriod] = useState("today");
  const fetcher = useCallback(() => dashboardApi.caisse(period), [period]);
  const { data, loading, error, refetch } = useApi(fetcher);

  const PERIODS = [
    { id: "today", label: "Aujourd'hui" },
    { id: "week",  label: "Semaine"     },
    { id: "month", label: "Mois"        },
  ];

  if (loading) return <div style={{padding:24,textAlign:"center"}}><Spinner/></div>;
  if (error)   return <ErrorBox msg="Erreur chargement caisse" onRetry={refetch}/>;

  return (
    <div style={{background:"#fff",borderRadius:16,padding:24,border:`1px solid ${C.border}`,marginBottom:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:C.navy}}> Suivi Caisse</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{data?.open_orders || 0} commande(s) en cours</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{
              padding:"5px 12px", borderRadius:20, border:`1.5px solid ${period===p.id?C.orange:C.border}`,
              background:period===p.id?C.orange:"#fff", color:period===p.id?"#fff":C.muted,
              fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif"
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Total */}
      <div style={{background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,borderRadius:12,padding:"16px 20px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{color:"rgba(255,255,255,0.7)",fontSize:13}}>Total encaissé</div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,color:"#fff"}}>{fmt(data?.grand_total)}</div>
      </div>

      {/* Breakdown */}
      {(data?.breakdown || []).length === 0 ? (
        <div style={{textAlign:"center",color:C.muted,padding:"20px 0",fontSize:13}}>Aucun encaissement pour cette période</div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {(data?.breakdown || []).map(item => (
            <div key={item.method} style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:item.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                {item.icon}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.navy}}>{item.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.navy}}>{fmt(item.amount)}</span>
                </div>
                <div style={{background:C.bg,borderRadius:99,height:6,overflow:"hidden"}}>
                  <div style={{width:`${item.pct}%`,height:"100%",background:item.color,borderRadius:99,transition:"width .4s ease"}}/>
                </div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{item.count} paiement(s) · {item.pct}%</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── REVENUE BY METHOD CHART ────────────────────────────────────────────────────
function RevenueByMethodChart() {
  const [period, setPeriod] = useState("7d");
  const fetcher = useCallback(() => dashboardApi.revenueByMethod(period), [period]);
  const { data, loading, error, refetch } = useApi(fetcher);

  if (loading) return <div style={{padding:24,textAlign:"center"}}><Spinner/></div>;
  if (error)   return <ErrorBox msg="Erreur graphe méthodes" onRetry={refetch}/>;

  const days   = data?.days    || [];
  const methods = data?.methods || [];
  const maxVal  = Math.max(...days.map(d => d.total || 0), 1);

  return (
    <div style={{background:"#fff",borderRadius:16,padding:24,border:`1px solid ${C.border}`,marginBottom:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:C.navy}}> CA par méthode</div>
        <div style={{display:"flex",gap:6}}>
          {[{id:"7d",label:"7j"},{id:"30d",label:"30j"}].map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{
              padding:"5px 12px", borderRadius:20, border:`1.5px solid ${period===p.id?C.orange:C.border}`,
              background:period===p.id?C.orange:"#fff", color:period===p.id?"#fff":C.muted,
              fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif"
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Légende */}
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
        {methods.map(m => (
          <div key={m.method} style={{display:"flex",alignItems:"center",gap:5,background:m.color+"15",borderRadius:20,padding:"3px 10px"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:m.color}}/>
            <span style={{fontSize:11,fontWeight:600,color:m.color}}>{m.label}</span>
            <span style={{fontSize:11,color:C.muted}}>{fmt(m.total)}</span>
          </div>
        ))}
      </div>

      {/* Barres empilées */}
      <div style={{display:"flex",alignItems:"flex-end",gap:4,height:120,overflowX:"auto",paddingBottom:4}}>
        {days.map(day => {
          const totalH = maxVal > 0 ? (day.total / maxVal) * 100 : 0;
          return (
            <div key={day.date} style={{flex:1,minWidth:28,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{width:"100%",height:100,display:"flex",flexDirection:"column-reverse",borderRadius:6,overflow:"hidden",background:C.bg}}>
                {methods.map(m => {
                  const val = day[m.method] || 0;
                  const h   = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  return h > 0 ? (
                    <div key={m.method} title={`${m.label}: ${fmt(val)}`} style={{
                      width:"100%", height:`${h}%`, background:m.color, transition:"height .3s ease"
                    }}/>
                  ) : null;
                })}
              </div>
              <div style={{fontSize:9,color:C.muted,textAlign:"center",lineHeight:1.1}}>{day.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── VOICE ASSISTANT ────────────────────────────────────────────────────────────
function VoiceAssistant({ screen }) {
  const [active, setActive] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const recognRef = React.useRef(null);

  const SCREEN_LABELS = {
    dashboard:"Tableau de bord", caisse:"Suivi Caisse", kds:"Cuisine",
    pos:"Caisse Rapide", menu:"Menu et Produits", stock:"Stock",
    wallet:"Wallet", waiters:"Équipe", expenses:"Dépenses",
    orders:"Commandes", ardoise:"Ardoise", finance:"Finance IA", admin:"Super Admin",
  };

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR"; u.rate = 1.05;
    // Choisir une voix française si disponible
    const voices = window.speechSynthesis.getVoices();
    const fr = voices.find(v => v.lang.startsWith("fr"));
    if (fr) u.voice = fr;
    window.speechSynthesis.speak(u);
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { speak("La reconnaissance vocale n'est pas disponible sur ce navigateur."); return; }
    const r = new SR();
    r.lang = "fr-FR"; r.interimResults = false; r.maxAlternatives = 1;
    recognRef.current = r;
    r.onstart = () => setListening(true);
    r.onend   = () => setListening(false);
    r.onerror = () => setListening(false);
    r.onresult = (e) => {
      const cmd = e.results[0][0].transcript.toLowerCase();
      speak(`Commande reçue : ${e.results[0][0].transcript}`);
    };
    r.start();
  };

  const toggle = () => {
    if (active) {
      window.speechSynthesis?.cancel();
      recognRef.current?.abort();
      setActive(false); setListening(false);
    } else {
      setActive(true);
      const label = SCREEN_LABELS[screen] || screen;
      speak(`SOKORA. Vous êtes sur la page ${label}. Appuyez à nouveau pour une commande vocale.`);
    }
  };

  const handleMic = (e) => {
    e.stopPropagation();
    if (listening) { recognRef.current?.stop(); }
    else { startListening(); }
  };

  return (
    <div style={{position:"fixed",bottom:24,right:24,zIndex:999,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
      {active && (
        <button onClick={handleMic} title={listening?"Arrêter l'écoute":"Parler"} style={{
          width:42,height:42,borderRadius:"50%",border:"none",cursor:"pointer",
          background:listening?"#e84040":C.teal,color:"#fff",
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:"0 4px 12px rgba(0,0,0,.25)",fontSize:18,
          animation:listening?"pulse-ring 1.2s ease infinite":"none",
        }}>🎤</button>
      )}
      <button onClick={toggle} title="Assistant vocal SOKORA" style={{
        width:52,height:52,borderRadius:"50%",border:"none",cursor:"pointer",
        background:active?C.orange:C.navy,color:"#fff",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:`0 4px 16px ${active?C.orange+"80":"rgba(0,0,0,.3)"}`,
        fontSize:22,transition:"all .2s",
        transform:active?"scale(1.1)":"scale(1)",
      }}>🔊</button>
      {listening&&<div style={{background:C.navy,color:"#fff",fontSize:11,fontWeight:600,borderRadius:20,padding:"4px 10px",whiteSpace:"nowrap"}}>En écoute...</div>}
    </div>
  );
}

// ── SCREENS ────────────────────────────────────────────────────────────────────

function DashboardScreen() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("today");
  const chartPeriod = period === "today" ? "7d" : period;

  const [stats,   setStats]   = useState(null);
  const [waiters, setWaiters] = useState(null);
  const [chart,   setChart]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [newOrdersBadge, setNewOrdersBadge] = useState(0);
  const { data:tables, refetch:rt } = useApi(tablesApi.list);

  // Badge temps réel : incrémenter à chaque nouvelle commande
  useOrdersWebSocket({
    estId: user?.establishment_id,
    onEvent: (ev) => {
      if (ev.type === "new_order") {
        setNewOrdersBadge(n => n + 1);
        loadAll();
      }
    },
  });

  const defaultMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const blob = (await reportsApi.downloadMonthly(selectedMonth)).data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_sokora_${selectedMonth || 'mensuel'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) { console.error("Erreur téléchargement PDF:", e); }
    finally { setPdfLoading(false); }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, wRes, cRes] = await Promise.all([
        dashboardApi.statsPeriod(period),
        dashboardApi.waitersPeriod(period),
        dashboardApi.revenueChart(chartPeriod),
      ]);
      setStats(sRes.data);
      setWaiters(wRes.data);
      setChart(cRes.data);
    } catch(e) { console.log("Dashboard error:", e); }
    finally { setLoading(false); }
  }, [period, chartPeriod]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const periodLabel = PERIODS.find(p=>p.id===period)?.label || "";
  const maxRev = waiters ? Math.max(...waiters.map(w=>w.total_revenue||0), 1) : 1;

  const kpis = stats ? [
    { label:"CA "+periodLabel, value:fmt(stats.total_revenue_period), sub:`${stats.orders_period||0} commandes`, icon:"CA", c:C.orange, bg:C.orangePale },
    { label:"CA ce mois",      value:fmt(stats.total_revenue_month),  sub:`${stats.orders_month||0} commandes`,  icon:"M", c:C.teal,   bg:C.tealPale },
    { label:"Bénéfice net",    value:fmt(stats.net_profit_period),    sub:`Charges: ${fmt(stats.total_expenses_period)}`, icon:"B", c:C.green,  bg:"#edfaf4" },
    { label:"En cours",        value:stats.open_orders_count,         sub:"Commandes actives", icon:"~", c:C.orange, bg:C.orangePale },
    { label:"Tables occupées", value:`${stats.occupied_tables_count}/${tables?.length??"-"}`, sub:"Temps réel", icon:"T", c:C.teal, bg:C.tealPale },
    { label:"Plat phare",      value:stats.top_product??"—",          sub:"Le + commandé", icon:"*", c:C.gold||"#C8920A", bg:"#fef9ee" },
  ] : [];

  const alerts = stats?.stock_alerts || [];

  return (
    <div>
      {/* PERIODE SELECTOR */}
      <div className="period-bar">
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <Ic n="cal" sz={14} col={C.orange}/>
          <span style={{ fontSize:12, color:C.muted, fontWeight:500 }}>Période :</span>
        </div>
        <PeriodSelector value={period} onChange={setPeriod}/>
        <button className="btn btn-g" style={{ fontSize:11,padding:"5px 11px", position:"relative" }} onClick={()=>{ loadAll(); setNewOrdersBadge(0); }}>
          <Ic n="refresh" sz={12} col={C.orange}/> Actualiser
          {newOrdersBadge > 0 && (
            <span style={{ position:"absolute", top:-6, right:-6, background:C.orange, color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>
              {newOrdersBadge > 9 ? "9+" : newOrdersBadge}
            </span>
          )}
        </button>
      </div>

      {/* ALERTES STOCK */}
      {alerts.length > 0 && (
        <div style={{ background:C.orangePale, border:`1px solid ${C.orange}44`, borderRadius:12, padding:"11px 14px", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
            <Ic n="warn" sz={14} col={C.orange}/>
            <span style={{ fontWeight:700, fontSize:12, color:C.orange }}>v Actualisé</span>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
            {alerts.map(a => (
              <div key={a.id} style={{ background:"#fff", border:`1px solid ${C.orange}33`, borderRadius:8, padding:"5px 11px", fontSize:12 }}>
                <span style={{ fontWeight:600, color:C.navy }}>{a.name}</span>
                <span style={{ marginLeft:7, color:(a.stock_quantity??a.stock)===0?C.red:C.orange, fontWeight:700 }}>
                  {(a.stock_quantity??a.stock)===0 ? " Rupture" : ` ${a.stock_quantity??a.stock} unités`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="kgrid">
        {loading ? Array(6).fill(0).map((_,i)=>(
          <div key={i} className="kcard" style={{ animationDelay:`${i*0.05}s` }}>
            <div style={{ background:`linear-gradient(90deg,${C.border} 25%,#e8ecf5 50%,${C.border} 75%)`, backgroundSize:"200% 100%", animation:"spin .7s linear infinite", borderRadius:8, height:36, width:36, marginBottom:11 }}/>
            <div style={{ background:C.border, borderRadius:5, height:9, width:"55%", marginBottom:7 }}/>
            <div style={{ background:C.border, borderRadius:5, height:20, width:"75%" }}/>
          </div>
        )) : kpis.map((k,i)=>(
          <div className="kcard" key={i} style={{ animationDelay:`${i*0.06}s` }}>
            <div className="kstripe" style={{ background:k.c }}/>
            <div className="kicon" style={{ background:k.bg }}>{k.icon}</div>
            <div className="klabel">{k.label}</div>
            <div className="kval" style={{ color:k.c }}>{k.value}</div>
            <div className="ksub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* GRAPHIQUE CA */}
      {chart && chart.length > 0 && (
        <RevenueChart data={chart} period={chartPeriod}/>
      )}

      {/* TABLES */}
      <div className="sec-head">
        <div className="sec-title"><Ic n="table" sz={14} col={C.orange}/> Etat des tables</div>
        <button className="btn btn-g" style={{ fontSize:11,padding:"5px 11px" }} onClick={rt}><Ic n="refresh" sz={12} col={C.orange}/> Actualiser</button>
      </div>
      <div className="tgrid">
        {(tables??[]).map(t=>{const st=TST[t.status]||TST.free;return(
          <div className="tcard" key={t.id} style={{ borderColor:st.c+"44" }}>
            <div className="tnum" style={{ color:st.c }}>T{t.number}</div>
            <div className="tlbl">{t.label||"—"}</div>
            <div className="tpill" style={{ background:st.bg,color:st.c }}>{st.l}</div>
            <div className="tcap">{t.capacity} pers.</div>
          </div>
        );})}
      </div>

      {/* PERFORMANCE SERVEURS */}
      <div className="sec-head">
        <div className="sec-title"><Ic n="chart" sz={14} col={C.teal}/> Performance serveurs — {periodLabel}</div>
      </div>
      <div className="wlist">
        {loading ? <div style={{ height:70,display:"flex",alignItems:"center",justifyContent:"center" }}><Spinner size={22}/></div> :
          (waiters??[]).map((w,i)=>(
            <div className="wcard" key={w.waiter_id}>
              <div className="wav" style={{ width:40,height:40,fontSize:13,background:AVATAR_COLORS[i%4] }}>
                {(w.waiter_name||'').split(" ").map(n=>n[0]).join("")}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600,fontSize:13 }}>
                  {w.waiter_name}{i===0&&<span style={{ marginLeft:6,fontSize:10,color:C.gold,fontWeight:700 }}>* Top</span>}
                </div>
                <div style={{ fontSize:11,color:C.muted,marginTop:1 }}>
                  {w.orders_today||0} cmd aujourd'hui · {w.orders_month||0} ce mois
                </div>
                <div style={{ height:4,borderRadius:3,background:C.border,marginTop:6,overflow:"hidden",maxWidth:200 }}>
                  <div style={{ height:"100%",borderRadius:3,width:`${((w.total_revenue||0)/maxRev)*100}%`,background:AVATAR_COLORS[i%4],transition:"width .7s" }}/>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,color:C.orange }}>{fmt(w.total_revenue||0)}</div>
                <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{periodLabel}</div>
              </div>
            </div>
          ))
        }
        {!loading && (waiters??[]).length===0 && <div className="empty">Aucun serveur</div>}
      </div>

      {/* RAPPORT PDF MENSUEL */}
      <div style={{ marginTop:24 }}>
        <div className="sec-head">
          <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:7 }}>
            <span style={{ fontSize:15 }}>📥</span> Rapport mensuel PDF
          </div>
        </div>
        <div style={{ background:"#fff", borderRadius:14, border:`1px solid ${C.border}`, padding:"16px 20px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, color:C.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px" }}>Mois</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"7px 11px", fontSize:13, color:C.navy, outline:"none", fontFamily:"inherit" }}
            />
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            style={{ display:"flex", alignItems:"center", gap:8, background: pdfLoading ? C.border : C.teal, color:"#fff", border:"none", borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:700, cursor: pdfLoading ? "not-allowed" : "pointer", transition:"background .2s", marginTop:20 }}
          >
            <span style={{ fontSize:15 }}>📥</span>
            {pdfLoading ? "Génération..." : "Télécharger rapport PDF"}
          </button>
        </div>
      </div>

      {/* LOCALISATION GPS */}
      <GpsWidget/>
    </div>
  );
}

function GpsWidget() {
  const {user} = useAuth();
  const [est, setEst] = useState(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    establishmentsApi.getMe().then(r => {
      setEst(r.data);
      if (r.data.latitude)  setLat(String(r.data.latitude));
      if (r.data.longitude) setLng(String(r.data.longitude));
    }).catch(() => {});
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(String(pos.coords.latitude.toFixed(6))); setLng(String(pos.coords.longitude.toFixed(6))); setDetecting(false); },
      ()  => { setDetecting(false); }
    );
  };

  const save = async () => {
    if (!lat || !lng || !user?.establishment_id) return;
    setSaving(true); setMsg(null);
    try {
      await establishmentsApi.updateLocation(user.establishment_id, parseFloat(lat), parseFloat(lng));
      setMsg("success");
      setTimeout(() => setMsg(null), 3000);
    } catch { setMsg("error"); }
    finally { setSaving(false); }
  };

  const hasGps = est?.latitude && est?.longitude;
  return (
    <div style={{ marginTop:24 }}>
      <div className="sec-head">
        <div className="sec-title" style={{ display:"flex",alignItems:"center",gap:7 }}>
          <span style={{ fontSize:15 }}>📍</span> Localisation GPS
        </div>
      </div>
      <div style={{ background:"#fff",borderRadius:14,border:`1px solid ${C.border}`,padding:"16px 20px",display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap" }}>
        {hasGps && (
          <div style={{ background:C.tealPale,border:`1px solid ${C.teal}44`,borderRadius:9,padding:"6px 12px",fontSize:12,color:C.teal,fontWeight:600,whiteSpace:"nowrap" }}>
            ✓ GPS défini · {Number(est.latitude).toFixed(4)}, {Number(est.longitude).toFixed(4)}
          </div>
        )}
        <div style={{ flex:1,minWidth:180 }}>
          <div style={{ fontSize:10,fontWeight:700,color:C.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:1 }}>Latitude</div>
          <input value={lat} onChange={e=>setLat(e.target.value)} placeholder="ex: 5.319600" style={{ width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13 }}/>
        </div>
        <div style={{ flex:1,minWidth:180 }}>
          <div style={{ fontSize:10,fontWeight:700,color:C.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:1 }}>Longitude</div>
          <input value={lng} onChange={e=>setLng(e.target.value)} placeholder="ex: -4.019500" style={{ width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:13 }}/>
        </div>
        <button onClick={detectLocation} disabled={detecting} style={{ padding:"8px 14px",borderRadius:8,border:`1.5px solid ${C.teal}`,background:"#fff",color:C.teal,fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",height:36 }}>
          {detecting ? <Spinner size={14} col={C.teal}/> : "📡 Détecter"}
        </button>
        <button onClick={save} disabled={saving||!lat||!lng} style={{ padding:"8px 18px",borderRadius:8,border:"none",background:C.orange,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",height:36,opacity:(!lat||!lng)?0.5:1 }}>
          {saving ? <Spinner size={14} col="#fff"/> : "Enregistrer"}
        </button>
        {msg==="success" && <span style={{ fontSize:12,color:C.teal,fontWeight:600 }}>✓ Enregistré</span>}
        {msg==="error"   && <span style={{ fontSize:12,color:C.red,fontWeight:600 }}>⚠ Erreur</span>}
      </div>
    </div>
  );
}

function MenuScreen() {
  const { data:products,   loading,     error,     refetch }  = useApi(menuApi.products);
  const { data:categories, loading:lcat,            refetch:rcat } = useApi(menuApi.categories);
  const [showForm,    setShowForm]    = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [activeTab,   setActiveTab]   = useState("all");
  const [form,        setForm]        = useState({name:"",price:"",purchase_price:"",stock_quantity:"",category_id:"",is_available:true});
  const [catForm,     setCatForm]     = useState({name:""});
  const {mutate:doAdd,   loading:saving}    = useMutation(useCallback(d=>menuApi.addProduct(d),[]));
  const {mutate:doEdit,  loading:editing}   = useMutation(useCallback(d=>menuApi.updateProduct(editId,d),[editId]));
  const {mutate:doAddCat,loading:savingCat} = useMutation(useCallback(d=>menuApi.addCategory(d),[]));
  const [deletingId, setDeletingId] = useState(null);

  const handleDeleteProduct = async (e, id) => {
    e.stopPropagation();
    if (deletingId !== id) { setDeletingId(id); return; }
    try {
      await stockApi.deleteProduct(id);
      setDeletingId(null);
      refetch();
    } catch(err) {
      setDeletingId(null);
      console.error('Erreur suppression produit:', err);
    }
  };

  const margin = (p) => {
    if (!p.purchase_price||p.purchase_price===0) return null;
    return Math.round(((p.price-p.purchase_price)/p.price)*100);
  };
  const openAdd = () => {
    setEditId(null);
    setForm({name:"",price:"",purchase_price:"",stock_quantity:"",category_id:"",is_available:true});
    setShowForm(true); setShowCatForm(false);
  };
  const openEdit = (p) => {
    setEditId(p.id);
    setForm({name:p.name,price:p.price,purchase_price:p.purchase_price||"",stock_quantity:p.stock_quantity,category_id:p.category_id||"",is_available:p.is_available});
    setShowForm(true); setShowCatForm(false);
  };
  const handleSave = async () => {
    if(!form.name||!form.price) return;
    const payload = {...form, price:Number(form.price), purchase_price:Number(form.purchase_price||0), stock_quantity:Number(form.stock_quantity||0), category_id:form.category_id?Number(form.category_id):null};
    if(editId) await doEdit(payload); else await doAdd(payload);
    setShowForm(false); setEditId(null);
    setForm({name:"",price:"",purchase_price:"",stock_quantity:"",category_id:"",is_available:true});
    refetch();
  };
  const handleAddCat = async () => {
    if(!catForm.name) return;
    await doAddCat(catForm);
    setShowCatForm(false); setCatForm({name:""}); rcat();
  };

  const lowStock = (products??[]).filter(p=>p.stock_quantity<=10&&p.is_available);
  const filtered = (products??[]).filter(p=>activeTab==="all"||p.category_id===activeTab);

  return (
    <div>
      {lowStock.length>0&&<div style={{background:C.orangePale,border:`1px solid ${C.orange}44`,borderRadius:11,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:7,fontSize:12,color:C.orange}}><Ic n="warn" sz={13} col={C.orange}/><span><strong>{lowStock.length} article(s)</strong> en stock faible</span></div>}
      {error&&<ErrorBox msg={error} onRetry={refetch}/>}

      {/* ONGLETS CATEGORIES */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>setActiveTab("all")} style={{padding:"5px 13px",borderRadius:20,border:`1.5px solid ${activeTab==="all"?C.orange:C.border}`,background:activeTab==="all"?C.orange:"#fff",color:activeTab==="all"?"#fff":C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
          Tout ({(products??[]).length})
        </button>
        {(categories??[]).map(cat=>{
          const count=(products??[]).filter(p=>p.category_id===cat.id).length;
          return (
            <button key={cat.id} onClick={()=>setActiveTab(cat.id)} style={{padding:"5px 13px",borderRadius:20,border:`1.5px solid ${activeTab===cat.id?C.orange:C.border}`,background:activeTab===cat.id?C.orange:"#fff",color:activeTab===cat.id?"#fff":C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
              {cat.name} ({count})
            </button>
          );
        })}
        <button onClick={()=>{setShowCatForm(!showCatForm);setShowForm(false);}} style={{padding:"5px 11px",borderRadius:20,border:`1.5px dashed ${C.border}`,background:"#fff",color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
          <Ic n="plus" sz={11} col={C.muted}/> Catégorie
        </button>
      </div>

      {/* FORM NOUVELLE CATEGORIE */}
      {showCatForm&&<div className="fcard" style={{marginBottom:14}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,marginBottom:9,color:C.navy}}>Nouvelle categorie</div>
        <div className="form-row">
          <div className="ig"><label>Nom</label><input placeholder="Ex: Boissons, Plats, Desserts..." value={catForm.name} onChange={e=>setCatForm({name:e.target.value})} autoFocus/></div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button className="btn btn-o" onClick={handleAddCat} disabled={savingCat}>{savingCat?<Spinner size={13}/>:"Créer"}</button>
          <button className="btn btn-g" onClick={()=>setShowCatForm(false)}>Annuler</button>
        </div>
      </div>}

      {/* HEADER */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:12,color:C.muted}}>{filtered.length} produit(s){activeTab!=="all"&&" dans cette catégorie"}</div>
        <button className="btn btn-o" onClick={openAdd}><Ic n="plus" sz={13} col="#fff"/> Ajouter produit</button>
      </div>

      {/* FORM PRODUIT */}
      {showForm&&<div className="fcard" style={{marginBottom:14}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,marginBottom:10,color:C.navy}}>
          {editId?"E Modifier le produit":"+ Nouveau produit"}
        </div>
        <div className="form-row">
          <div className="ig"><label>Nom</label><input placeholder="Ex: Poulet braisé" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
          <div className="ig"><label>Prix de vente (F)</label><input type="number" placeholder="0" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></div>
        </div>
        <div className="form-row">
          <div className="ig">
            <label>Prix d'achat (F)</label>
            <input type="number" placeholder="0" value={form.purchase_price} onChange={e=>setForm({...form,purchase_price:e.target.value})}/>
            {form.price&&form.purchase_price&&Number(form.price)>0&&(
              <div style={{fontSize:10,color:C.teal,marginTop:3,fontWeight:600}}>
                Marge : {Math.round(((Number(form.price)-Number(form.purchase_price))/Number(form.price))*100)}%
                &nbsp;({fmt(Number(form.price)-Number(form.purchase_price))} / unité)
              </div>
            )}
          </div>
          <div className="ig"><label>Stock</label><input type="number" placeholder="0" value={form.stock_quantity} onChange={e=>setForm({...form,stock_quantity:e.target.value})}/></div>
        </div>
        <div className="form-row">
          <div className="ig">
            <label>Catégorie</label>
            <select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}>
              <option value="">— Sans catégorie —</option>
              {(categories??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="ig">
            <label>Disponible</label>
            <select value={form.is_available?"1":"0"} onChange={e=>setForm({...form,is_available:e.target.value==="1"})}>
              <option value="1">Oui</option><option value="0">Non</option>
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button className="btn btn-o" onClick={handleSave} disabled={saving||editing}>{(saving||editing)?<Spinner size={13}/>:(editId?"Enregistrer":"Créer")}</button>
          <button className="btn btn-g" onClick={()=>{setShowForm(false);setEditId(null);}}>Annuler</button>
        </div>
      </div>}

      {/* GRILLE PRODUITS */}
      {loading||lcat?<div style={{height:100,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>:
        <div className="pgrid">
          {filtered.map(p=>{
            const m=margin(p);
            const mColor=m===null?C.muted:m>=50?C.green:m>=30?C.teal:m>=15?C.orange:C.red;
            const cat=(categories??[]).find(c=>c.id===p.category_id);
            return (
              <div className={`pcard ${!p.is_available?"off":""}`} key={p.id} onClick={()=>openEdit(p)} style={{cursor:"pointer"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:p.is_available?(p.stock_quantity<=10?C.orange:C.teal):C.faint,borderRadius:"12px 12px 0 0"}}/>
                {/* Bouton supprimer */}
                <button
                  onClick={e=>handleDeleteProduct(e,p.id)}
                  title={deletingId===p.id?"Cliquer à nouveau pour confirmer":"Supprimer"}
                  style={{position:"absolute",top:8,right:8,width:22,height:22,borderRadius:6,border:`1px solid ${deletingId===p.id?C.red:C.faint}`,background:deletingId===p.id?"#fff0f0":"#fff",color:deletingId===p.id?C.red:C.faint,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:2,transition:"all .15s"}}
                >{deletingId===p.id?"!":"×"}</button>
                <span className="pbadge" style={{background:p.is_available?C.tealPale:"#fff0f0",color:p.is_available?C.teal:C.red}}>{p.is_available?"Dispo":"Indispo"}</span>
                {cat&&<div style={{fontSize:9,background:C.bg,color:C.muted,border:`1px solid ${C.border}`,padding:"1px 7px",borderRadius:20,display:"inline-block",marginBottom:5,fontWeight:600}}>{cat.name}</div>}
                <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{p.name}</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:C.orange,margin:"4px 0 3px"}}>{fmt(p.price)}</div>
                {p.purchase_price>0&&<div style={{fontSize:10,color:C.muted,marginBottom:4}}>Achat: {fmt(p.purchase_price)} · <span style={{fontWeight:700,color:mColor}}>Marge {m}%</span></div>}
                <div style={{fontSize:11,display:"flex",alignItems:"center",gap:4,color:p.stock_quantity<=10?C.orange:C.muted}}>
                  {p.stock_quantity<=10&&<Ic n="warn" sz={11} col={p.stock_quantity===0?C.red:C.orange}/>}
                  Stock: <strong style={{marginLeft:2,color:p.stock_quantity===0?C.red:p.stock_quantity<=10?C.orange:C.text}}>{p.stock_quantity===0?"Rupture":p.stock_quantity}</strong>
                </div>
              </div>
            );
          })}
          {filtered.length===0&&<div className="empty" style={{gridColumn:"1/-1"}}>Aucun produit{activeTab!=="all"?" dans cette catégorie":""}</div>}
        </div>
      }
    </div>
  );
}

function StockScreen() {
  const [tab, setTab] = useState("dashboard");
  const TABS = [
    {id:"dashboard", label:"Tableau de bord"},
    {id:"mouvements", label:"Mouvements"},
    {id:"bilan", label:"Bilan mensuel"},
    {id:"reappro", label:"Réapprovisionnements"},
  ];
  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:20,background:"#fff",borderRadius:12,padding:4,border:"1px solid "+C.border,width:"fit-content"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 16px",borderRadius:9,border:"none",background:tab===t.id?C.orange:"transparent",color:tab===t.id?"#fff":C.muted,fontSize:12,fontWeight:700,cursor:"pointer"}}>{t.label}</button>
        ))}
      </div>
      {tab==="dashboard" && <StockDashboard/>}
      {tab==="mouvements" && <StockMouvements/>}
      {tab==="bilan" && <StockBilan/>}
      {tab==="reappro" && <ReapproScreen/>}
    </div>
  );
}

function StockDashboard() {
  const {data:items,loading,error,refetch}=useApi(stockApi.dashboard);
  const {data:products,refetch:refetchProducts}=useApi(stockApi.list);
  const {data:cats}=useApi(menuApi.categories);
  const [filter,setFilter]=useState("all");
  const [editId,setEditId]=useState(null);
  const [adj,setAdj]=useState({qty:"",reason:"in"});
  const [showAdd,setShowAdd]=useState(false);
  const [newP,setNewP]=useState({name:"",purchase_price:"",price:"",stock_quantity:"",stock_alert_threshold:"5",stock_unit:"pcs",category_id:""});
  const [deletingId,setDeletingId]=useState(null);

  const all=items||[];
  const rupture=all.filter(p=>p.status==="out");
  const bas=all.filter(p=>p.status==="low");
  const valeurTotale=all.reduce((s,p)=>s+(p.valeur_stock>0?p.valeur_stock:0),0);
  const sortiesTotales=all.reduce((s,p)=>s+p.sorties_jour,0);
  const filtered=all.filter(p=>filter==="all"||(filter==="out"&&p.status==="out")||(filter==="low"&&p.status==="low")||(filter==="ok"&&p.status==="ok"));

  const handleAdjust=async(p)=>{
    if(!adj.qty||isNaN(Number(adj.qty)))return;
    await stockApi.update(p.id,{quantity:Number(adj.qty),movement_type:adj.reason,reason:adj.reason==="in"?"Entrée manuelle":adj.reason==="out"?"Sortie manuelle":"Correction inventaire"});
    setEditId(null);setAdj({qty:"",reason:"in"});refetch();
  };

  const handleDelete=async(id)=>{
    if(deletingId!==id){setDeletingId(id);return;}
    await stockApi.deleteProduct(id);
    setDeletingId(null);refetch();refetchProducts();
  };

  const handleAddProduct=async()=>{
    if(!newP.name||!newP.price)return;
    await menuApi.addProduct({...newP,price:Number(newP.price),purchase_price:Number(newP.purchase_price||0),stock_quantity:Number(newP.stock_quantity||0),stock_alert_threshold:Number(newP.stock_alert_threshold||5),category_id:newP.category_id?Number(newP.category_id):null});
    setShowAdd(false);setNewP({name:"",purchase_price:"",price:"",stock_quantity:"",stock_alert_threshold:"5",stock_unit:"pcs",category_id:""});
    refetch();refetchProducts();
  };

  const stColor=(s)=>s==="out"?C.red:s==="low"?C.orange:C.teal;
  const stLabel=(s)=>s==="out"?"Rupture":s==="low"?"Faible":"OK";
  const stBg=(s)=>s==="out"?"#fff0f0":s==="low"?C.orangePale:C.tealPale;

  return (
    <div>
      {error&&<ErrorBox msg={error} onRetry={refetch}/>}
      {rupture.length>0&&(
        <div style={{background:"#fff0f0",border:"1px solid "+C.red+"44",borderRadius:12,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <Ic n="warn" sz={14} col={C.red}/>
          <span style={{fontSize:13,color:C.red,fontWeight:700}}>{rupture.length} produit(s) en rupture :</span>
          <span style={{fontSize:12,color:C.red}}>{rupture.map(p=>p.name).join(", ")}</span>
        </div>
      )}
      {bas.length>0&&(
        <div style={{background:C.orangePale,border:"1px solid "+C.orange+"44",borderRadius:12,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <Ic n="warn" sz={14} col={C.orange}/>
          <span style={{fontSize:13,color:C.orange,fontWeight:700}}>{bas.length} produit(s) en stock bas :</span>
          <span style={{fontSize:12,color:C.orange}}>{bas.map(p=>p.name).join(", ")}</span>
        </div>
      )}
      <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        {[
          {label:"Rupture",val:rupture.length,c:C.red,bg:"#fff0f0"},
          {label:"Stock bas",val:bas.length,c:C.orange,bg:C.orangePale},
          {label:"Sorties du jour",val:sortiesTotales+" unités",c:C.purple,bg:"#f0f0ff",raw:true},
          {label:"Valeur stock",val:fmt(valeurTotale),c:C.navy,bg:"#eef2ff",raw:true},
        ].map((k,i)=>(
          <div key={i} style={{background:k.bg,border:"1px solid "+k.c+"33",borderRadius:12,padding:"12px 18px",flex:1,minWidth:140}}>
            <div style={{fontSize:10,color:k.c,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{k.label}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:k.raw?14:26,fontWeight:800,color:k.c}}>{k.val}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:6}}>
          {[{id:"all",label:"Tous"},{id:"out",label:"Rupture"},{id:"low",label:"Stock bas"},{id:"ok",label:"OK"}].map(f=>(
            <button key={f.id} onClick={()=>setFilter(f.id)} style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid "+(filter===f.id?C.orange:C.border),background:filter===f.id?C.orange:"#fff",color:filter===f.id?"#fff":C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>{f.label}</button>
          ))}
        </div>
        <button onClick={()=>setShowAdd(!showAdd)} style={{padding:"7px 16px",borderRadius:9,background:C.teal,border:"none",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
          {showAdd?"Annuler":"+ Nouveau produit"}
        </button>
      </div>
      {showAdd&&(
        <div style={{background:C.tealPale,border:"1px solid "+C.teal+"44",borderRadius:14,padding:18,marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:14,color:C.navy,marginBottom:12}}>Nouveau produit</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
            <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:3}}>Nom *</div><input value={newP.name} onChange={e=>setNewP({...newP,name:e.target.value})} placeholder="Ex: Coca-Cola" style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:13}}/></div>
            <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:3}}>Prix vente (F) *</div><input type="number" value={newP.price} onChange={e=>setNewP({...newP,price:e.target.value})} placeholder="0" style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:13}}/></div>
            <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:3}}>Prix achat (F)</div><input type="number" value={newP.purchase_price} onChange={e=>setNewP({...newP,purchase_price:e.target.value})} placeholder="0" style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:13}}/></div>
            <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:3}}>Stock initial</div><input type="number" value={newP.stock_quantity} onChange={e=>setNewP({...newP,stock_quantity:e.target.value})} placeholder="0" style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:13}}/></div>
            <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:3}}>Seuil alerte</div><input type="number" value={newP.stock_alert_threshold} onChange={e=>setNewP({...newP,stock_alert_threshold:e.target.value})} placeholder="5" style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:13}}/></div>
            <div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:3}}>Catégorie</div>
              <select value={newP.category_id} onChange={e=>setNewP({...newP,category_id:e.target.value})} style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:13}}>
                <option value="">-- Aucune --</option>
                {(cats||[]).map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleAddProduct} style={{padding:"8px 20px",borderRadius:8,background:C.teal,border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Ajouter le produit</button>
        </div>
      )}
      {loading?<div style={{height:100,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner size={26}/></div>:(
        <div className="card">
          <table className="dt">
            <thead>
              <tr>
                <th>Produit</th>
                <th style={{textAlign:"center"}}>Ouverture</th>
                <th style={{textAlign:"center"}}>Entrées auj.</th>
                <th style={{textAlign:"center"}}>Sorties auj.</th>
                <th style={{textAlign:"center"}}>Stock actuel</th>
                <th>Valeur stock</th>
                <th>Seuil</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={9}><div className="empty">Aucun produit</div></td></tr>}
              {filtered.map(p=>(
                <React.Fragment key={p.id}>
                  <tr style={{background:editId===p.id?"#fffbf5":p.status==="out"?"#fff8f8":""}}>
                    <td><div style={{fontWeight:700,color:C.navy}}>{p.name}</div><div style={{fontSize:10,color:C.muted}}>{p.stock_unit}</div></td>
                    <td style={{textAlign:"center",fontWeight:600,color:C.muted}}>{p.stock_ouverture}</td>
                    <td style={{textAlign:"center"}}>{p.entrees_jour>0?<span style={{color:C.teal,fontWeight:700}}>+{p.entrees_jour}</span>:<span style={{color:C.faint}}>—</span>}</td>
                    <td style={{textAlign:"center"}}>{p.sorties_jour>0?<span style={{color:C.orange,fontWeight:700}}>-{p.sorties_jour}</span>:<span style={{color:C.faint}}>—</span>}</td>
                    <td style={{textAlign:"center"}}><span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:stColor(p.status)}}>{p.stock_actuel}</span></td>
                    <td style={{fontSize:12,color:p.valeur_stock>0?C.navy:C.faint}}>{p.valeur_stock>0?fmt(p.valeur_stock):"—"}</td>
                    <td style={{fontSize:12,color:C.muted}}>{p.stock_alert_threshold}</td>
                    <td><span style={{background:stBg(p.status),color:stColor(p.status),borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>{stLabel(p.status)}</span></td>
                    <td>
                      <div style={{display:"flex",gap:5}}>
                        <button onClick={()=>{setEditId(editId===p.id?null:p.id);setAdj({qty:"",reason:"in"});}} style={{padding:"4px 9px",borderRadius:7,border:"1px solid "+C.orange,background:editId===p.id?C.orange:"#fff",color:editId===p.id?"#fff":C.orange,fontSize:11,fontWeight:700,cursor:"pointer"}}>{editId===p.id?"Fermer":"Ajuster"}</button>
                        <button onClick={()=>handleDelete(p.id)} style={{padding:"4px 9px",borderRadius:7,border:"1px solid "+(deletingId===p.id?C.red:C.border),background:deletingId===p.id?"#fff0f0":"#fff",color:deletingId===p.id?C.red:C.muted,fontSize:11,fontWeight:700,cursor:"pointer"}}>{deletingId===p.id?"Confirmer":"Suppr."}</button>
                      </div>
                    </td>
                  </tr>
                  {editId===p.id&&(
                    <tr>
                      <td colSpan={9} style={{padding:"12px 16px",background:"#fffbf5",borderBottom:"2px solid "+C.orange+"22"}}>
                        <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                          <div>
                            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4}}>Type</div>
                            <select value={adj.reason} onChange={e=>setAdj({...adj,reason:e.target.value})} style={{padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:12}}>
                              <option value="in">Entrée stock</option>
                              <option value="out">Sortie stock</option>
                              <option value="adjustment">Correction</option>
                            </select>
                          </div>
                          <div>
                            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4}}>Quantité</div>
                            <input type="number" min="1" value={adj.qty} onChange={e=>setAdj({...adj,qty:e.target.value})} placeholder="0" style={{width:90,padding:"7px 10px",borderRadius:7,border:"1px solid "+C.border,fontSize:14,fontWeight:700}}/>
                          </div>
                          <button onClick={()=>handleAdjust(p)} style={{padding:"8px 18px",borderRadius:8,background:C.orange,border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Valider</button>
                          <div style={{fontSize:12,color:C.muted,alignSelf:"center"}}>
                            Actuel: <strong style={{color:C.navy}}>{p.stock_actuel}</strong>
                            {adj.qty&&<> vers <strong style={{color:C.teal}}>{adj.reason==="in"?p.stock_actuel+Number(adj.qty):p.stock_actuel-Number(adj.qty)}</strong></>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StockMouvements() {
  const [period, setPeriod] = useState("today");
  const fetcher = useCallback(()=>stockApi.movementsPeriod(period),[period]);
  const {data:mvts,loading,error,refetch}=useApi(fetcher);
  useEffect(()=>{refetch();},[period]);

  const typeLabel=(t)=>t==="sale"?"Vente":t==="in"?"Entrée":t==="out"?"Sortie":t==="adjustment"?"Correction":t;
  const typeColor=(t)=>t==="sale"?C.orange:t==="in"?C.teal:t==="out"?C.red:C.purple;
  const typeBg=(t)=>t==="sale"?C.orangePale:t==="in"?C.tealPale:t==="out"?"#fff0f0":"#f0f0ff";

  const totalEntrees=(mvts||[]).filter(m=>m.quantity>0).reduce((s,m)=>s+m.quantity,0);
  const totalSorties=(mvts||[]).filter(m=>m.quantity<0).reduce((s,m)=>s+Math.abs(m.quantity),0);

  return (
    <div>
      {error&&<ErrorBox msg={error} onRetry={refetch}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:6}}>
          {[{id:"today",label:"Aujourd'hui"},{id:"week",label:"7 jours"},{id:"month",label:"Ce mois"}].map(p=>(
            <button key={p.id} onClick={()=>setPeriod(p.id)} style={{padding:"6px 14px",borderRadius:20,border:"1.5px solid "+(period===p.id?C.orange:C.border),background:period===p.id?C.orange:"#fff",color:period===p.id?"#fff":C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>{p.label}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:10}}>
          <div style={{background:C.tealPale,border:"1px solid "+C.teal+"33",borderRadius:9,padding:"6px 14px",fontSize:12,fontWeight:700,color:C.teal}}>+{totalEntrees} entrées</div>
          <div style={{background:C.orangePale,border:"1px solid "+C.orange+"33",borderRadius:9,padding:"6px 14px",fontSize:12,fontWeight:700,color:C.orange}}>-{totalSorties} sorties</div>
        </div>
      </div>
      {loading?<div style={{height:80,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner size={24}/></div>:(
        <div className="card">
          <table className="dt">
            <thead><tr><th>Date/Heure</th><th>Produit</th><th>Type</th><th style={{textAlign:"center"}}>Quantité</th><th>Motif</th></tr></thead>
            <tbody>
              {(mvts||[]).length===0&&<tr><td colSpan={5}><div className="empty">Aucun mouvement sur cette période</div></td></tr>}
              {(mvts||[]).map((m,i)=>(
                <tr key={i}>
                  <td style={{fontSize:11,color:C.muted,whiteSpace:"nowrap"}}>{new Date(m.created_at).toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</td>
                  <td style={{fontWeight:600}}>{m.product_name}</td>
                  <td><span style={{background:typeBg(m.movement_type),color:typeColor(m.movement_type),borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>{typeLabel(m.movement_type)}</span></td>
                  <td style={{textAlign:"center"}}><span style={{fontWeight:800,fontSize:14,color:m.quantity>0?C.teal:C.orange}}>{m.quantity>0?"+":""}{m.quantity}</span></td>
                  <td style={{fontSize:12,color:C.muted}}>{m.reason||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StockBilan() {
  const {data:bilan,loading,error}=useApi(stockApi.bilan);
  const totalValeurConso=(bilan||[]).reduce((s,p)=>s+p.valeur_consommee,0);
  const totalValeurReste=(bilan||[]).reduce((s,p)=>s+p.valeur_restante,0);
  const totalSorties=(bilan||[]).reduce((s,p)=>s+p.sorties_mois,0);
  const totalEntrees=(bilan||[]).reduce((s,p)=>s+p.entrees_mois,0);
  return (
    <div>
      {error&&<ErrorBox msg={error}/>}
      <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        {[
          {label:"Valeur consommée (mois)",val:fmt(totalValeurConso),c:C.orange,bg:C.orangePale},
          {label:"Valeur stock restante",val:fmt(totalValeurReste),c:C.teal,bg:C.tealPale},
          {label:"Total sorties (mois)",val:totalSorties+" unités",c:C.purple,bg:"#f0f0ff",raw:true},
          {label:"Total entrées (mois)",val:totalEntrees+" unités",c:C.navy,bg:"#eef2ff",raw:true},
        ].map((k,i)=>(
          <div key={i} style={{background:k.bg,border:"1px solid "+k.c+"33",borderRadius:12,padding:"12px 18px",flex:1,minWidth:140}}>
            <div style={{fontSize:10,color:k.c,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{k.label}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:k.raw?14:15,fontWeight:800,color:k.c}}>{k.val}</div>
          </div>
        ))}
      </div>
      {loading?<div style={{height:80,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner size={24}/></div>:(
        <div className="card">
          <table className="dt">
            <thead>
              <tr>
                <th>Produit</th>
                <th style={{textAlign:"center"}}>Stock début mois</th>
                <th style={{textAlign:"center"}}>Entrées mois</th>
                <th style={{textAlign:"center"}}>Sorties mois</th>
                <th style={{textAlign:"center"}}>Stock actuel</th>
                <th>Valeur consommée</th>
                <th>Valeur restante</th>
                <th style={{textAlign:"center"}}>Taux rotation</th>
              </tr>
            </thead>
            <tbody>
              {(bilan||[]).length===0&&<tr><td colSpan={8}><div className="empty">Aucune donnée</div></td></tr>}
              {(bilan||[]).map(p=>(
                <tr key={p.id}>
                  <td><div style={{fontWeight:700,color:C.navy}}>{p.name}</div><div style={{fontSize:10,color:C.muted}}>{p.stock_unit}</div></td>
                  <td style={{textAlign:"center",color:C.muted}}>{p.stock_debut_mois}</td>
                  <td style={{textAlign:"center"}}><span style={{color:C.teal,fontWeight:700}}>{p.entrees_mois>0?"+"+p.entrees_mois:"—"}</span></td>
                  <td style={{textAlign:"center"}}><span style={{color:p.sorties_mois>0?C.orange:C.faint,fontWeight:700}}>{p.sorties_mois>0?"-"+p.sorties_mois:"—"}</span></td>
                  <td style={{textAlign:"center"}}><span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:p.stock_actuel<=0?C.red:p.stock_actuel<=5?C.orange:C.teal}}>{p.stock_actuel}</span></td>
                  <td style={{fontSize:12,color:p.valeur_consommee>0?C.orange:C.faint}}>{p.valeur_consommee>0?fmt(p.valeur_consommee):"—"}</td>
                  <td style={{fontSize:12,color:p.valeur_restante>0?C.teal:C.faint}}>{p.valeur_restante>0?fmt(p.valeur_restante):"—"}</td>
                  <td style={{textAlign:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                      <div style={{width:50,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:Math.min(p.taux_rotation,100)+"%",background:p.taux_rotation>70?C.teal:p.taux_rotation>30?C.orange:C.red,borderRadius:3}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:C.muted}}>{p.taux_rotation}%</span>
                    </div>
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

function ReapproScreen() {
  const {data:reappros,loading,refetch}=useApi(stockApi.reapproList);
  const {data:products}=useApi(stockApi.list);
  const [showForm,setShowForm]=useState(false);
  const [receiving,setReceiving]=useState(null);
  const [form,setForm]=useState({product_id:"",quantity_ordered:"",unit_cost:"",supplier:"",notes:""});
  const [recvQty,setRecvQty]=useState("");
  const [filterStatus,setFilterStatus]=useState("all");
  const handleCreate=async()=>{
    if(!form.product_id||!form.quantity_ordered)return;
    await stockApi.reapproCreate({product_id:Number(form.product_id),quantity_ordered:Number(form.quantity_ordered),unit_cost:Number(form.unit_cost||0),supplier:form.supplier,notes:form.notes});
    setShowForm(false);setForm({product_id:"",quantity_ordered:"",unit_cost:"",supplier:"",notes:""});refetch();
  };
  const handleReceive=async(id)=>{
    if(!recvQty||Number(recvQty)<=0)return;
    await stockApi.reapproReceive(id,Number(recvQty));
    setReceiving(null);setRecvQty("");refetch();
  };
  const filtered=(reappros||[]).filter(r=>filterStatus==="all"||r.status===filterStatus);
  const pending=(reappros||[]).filter(r=>r.status==="pending").length;
  const badge=(s)=>s==="pending"?{bg:C.orangePale,color:C.orange,label:"En attente"}:s==="received"?{bg:C.tealPale,color:C.teal,label:"Reçu"}:{bg:"#f3f4f6",color:C.muted,label:s};
  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{background:C.orangePale,border:`1px solid ${C.orange}33`,borderRadius:12,padding:"12px 18px",flex:1,minWidth:130}}>
          <div style={{fontSize:10,color:C.orange,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>En attente</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,color:C.orange,marginTop:4}}>{pending}</div>
        </div>
        <div style={{background:C.tealPale,border:`1px solid ${C.teal}33`,borderRadius:12,padding:"12px 18px",flex:1,minWidth:130}}>
          <div style={{fontSize:10,color:C.teal,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Total commandes</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,color:C.teal,marginTop:4}}>{(reappros||[]).length}</div>
        </div>
        <button onClick={()=>setShowForm(!showForm)} style={{padding:"0 22px",borderRadius:12,background:C.orange,border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",minWidth:150}}>
          {showForm?"Annuler":"+ Nouvelle commande"}
        </button>
      </div>
      {showForm&&(
        <div style={{background:"#fffbf5",border:`1px solid ${C.orange}33`,borderRadius:14,padding:20,marginBottom:18}}>
          <div style={{fontWeight:800,fontSize:15,color:C.navy,marginBottom:14}}>Nouvelle commande fournisseur</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4}}>Produit *</div>
              <select value={form.product_id} onChange={e=>setForm({...form,product_id:e.target.value})} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13}}>
                <option value="">-- Choisir --</option>
                {(products||[]).map(p=><option key={p.id} value={p.id}>{p.name} (stock: {p.stock_quantity})</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4}}>Quantité commandée *</div>
              <input type="number" min="1" value={form.quantity_ordered} onChange={e=>setForm({...form,quantity_ordered:e.target.value})} placeholder="0" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13}}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4}}>Coût unitaire (F)</div>
              <input type="number" min="0" value={form.unit_cost} onChange={e=>setForm({...form,unit_cost:e.target.value})} placeholder="0" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13}}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4}}>Fournisseur</div>
              <input type="text" value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})} placeholder="Nom fournisseur" style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13}}/>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4}}>Notes</div>
            <input type="text" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Notes..." style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:13}}/>
          </div>
          <button onClick={handleCreate} style={{padding:"9px 24px",borderRadius:9,background:C.orange,border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Confirmer la commande</button>
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[{id:"all",label:"Toutes"},{id:"pending",label:"En attente"},{id:"received",label:"Reçues"}].map(f=>(
          <button key={f.id} onClick={()=>setFilterStatus(f.id)} style={{padding:"5px 13px",borderRadius:20,border:`1.5px solid ${filterStatus===f.id?C.orange:C.border}`,background:filterStatus===f.id?C.orange:"#fff",color:filterStatus===f.id?"#fff":C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>{f.label}</button>
        ))}
      </div>
      {loading?<div style={{height:80,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner size={24}/></div>:(
        <div className="card">
          <table className="dt">
            <thead><tr><th>Produit</th><th>Qté cmdée</th><th>Qté reçue</th><th>Fournisseur</th><th>Coût unit.</th><th>Statut</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={8}><div className="empty">Aucune commande</div></td></tr>}
              {filtered.map(r=>(
                <React.Fragment key={r.id}>
                  <tr>
                    <td style={{fontWeight:600}}>{r.product_name}</td>
                    <td style={{fontWeight:700,color:C.navy}}>{r.quantity_ordered} {r.stock_unit}</td>
                    <td style={{color:r.quantity_received>0?C.teal:C.muted}}>{r.quantity_received}</td>
                    <td style={{color:C.muted,fontSize:12}}>{r.supplier||"—"}</td>
                    <td style={{color:C.muted,fontSize:12}}>{r.unit_cost>0?r.unit_cost+" F":"—"}</td>
                    <td><span style={{background:badge(r.status).bg,color:badge(r.status).color,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>{badge(r.status).label}</span></td>
                    <td style={{color:C.muted,fontSize:11}}>{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                    <td>{r.status==="pending"&&<button onClick={()=>{setReceiving(receiving===r.id?null:r.id);setRecvQty("");}} style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${C.teal}`,background:receiving===r.id?C.teal:"#fff",color:receiving===r.id?"#fff":C.teal,fontSize:11,fontWeight:700,cursor:"pointer"}}>{receiving===r.id?"Annuler":"Réceptionner"}</button>}</td>
                  </tr>
                  {receiving===r.id&&(
                    <tr>
                      <td colSpan={8} style={{padding:"12px 16px",background:C.tealPale,borderBottom:`2px solid ${C.teal}22`}}>
                        <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                          <div>
                            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:4}}>Quantité reçue</div>
                            <input type="number" min="1" max={r.quantity_ordered} value={recvQty} onChange={e=>setRecvQty(e.target.value)} placeholder="0" style={{width:100,padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,fontWeight:700}}/>
                          </div>
                          <button onClick={()=>handleReceive(r.id)} style={{padding:"8px 18px",borderRadius:8,background:C.teal,border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Valider réception</button>
                          <div style={{fontSize:12,color:C.muted,alignSelf:"center"}}>Commandé: <strong>{r.quantity_ordered} {r.stock_unit}</strong></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function WaitersScreen() {
  const {data:waiters,loading,error,refetch}=useApi(staffApi.list);
  const [showForm,setShowForm]=useState(false);
  const [editW,setEditW]=useState(null);
  const [form,setForm]=useState({full_name:"",phone_number:"",password:""});
  const {mutate:doCreate,loading:saving,error:saveErr}=useMutation(useCallback(d=>staffApi.create(d),[]));
  const {mutate:doUpdate}=useMutation(useCallback(d=>staffApi.update(editW?.id,d),[editW]));

  const openAdd=()=>{setEditW(null);setForm({full_name:"",phone_number:"",password:""});setShowForm(true);};
  const openEdit=(w)=>{setEditW(w);setForm({full_name:w.full_name,phone_number:w.phone_number,password:""});setShowForm(true);};

  const handleSave=async()=>{
    if(!form.full_name||!form.phone_number)return;
    if(editW){
      const payload={full_name:form.full_name,phone_number:form.phone_number};
      if(form.password)payload.password=form.password;
      await doUpdate(payload);
    } else {
      if(!form.password)return;
      await doCreate({...form,role:"waiter"});
    }
    setShowForm(false);setEditW(null);setForm({full_name:"",phone_number:"",password:""});refetch();
  };

  const handleToggleActive=async(w)=>{
    await staffApi.update(w.id,{is_active:!w.is_active});
    refetch();
  };

  return (
    <div>
      {error&&<ErrorBox msg={error} onRetry={refetch}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:13,color:C.muted}}>{(waiters??[]).length} membre(s) d'équipe</div>
        <button className="btn btn-o" onClick={openAdd}><Ic n="plus" sz={13} col="#fff"/> Nouveau serveur</button>
      </div>
      {showForm&&<div className="fcard" style={{marginBottom:14}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,marginBottom:9,color:C.navy}}>{editW?"E Modifier le serveur":"+ Nouveau serveur"}</div>
        <div className="form-row">
          <div className="ig"><label>Nom complet</label><input placeholder="Konan Aya" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></div>
          <div className="ig"><label>Téléphone</label><input placeholder="0700000000" value={form.phone_number} onChange={e=>setForm({...form,phone_number:e.target.value})}/></div>
          <div className="ig"><label>Mot de passe {editW&&"(laisser vide = inchangé)"}</label><input type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div>
        </div>
        {saveErr&&<div style={{color:C.red,fontSize:12,marginBottom:8}}>{saveErr}</div>}
        <div style={{display:"flex",gap:7}}>
          <button className="btn btn-o" onClick={handleSave} disabled={saving}>{saving?<Spinner size={13}/>:(editW?"Enregistrer":"Créer")}</button>
          <button className="btn btn-g" onClick={()=>{setShowForm(false);setEditW(null);}}>Annuler</button>
        </div>
      </div>}
      {loading?<div style={{height:100,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner size={26}/></div>:
        <div className="card">
          <table className="dt">
            <thead><tr><th>Serveur</th><th>Téléphone</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {(waiters??[]).map((w,i)=>(
                <tr key={w.id} style={{opacity:w.is_active?1:0.55}}>
                  <td><div style={{display:"flex",alignItems:"center",gap:9}}><div className="wav" style={{width:32,height:32,fontSize:11,background:AVATAR_COLORS[i%4]}}>{(w.full_name||"?").split(" ").map(n=>n[0]).join("")}</div><div style={{fontWeight:600}}>{w.full_name}</div></div></td>
                  <td style={{color:C.muted}}>{w.phone_number}</td>
                  <td><span className="badge" style={{background:C.tealPale,color:C.teal}}>{w.role}</span></td>
                  <td><span className="badge" style={{background:w.is_active?"#edfaf8":"#fff0f0",color:w.is_active?C.teal:C.red}}>{w.is_active?"Actif":"Inactif"}</span></td>
                  <td>
                    <div style={{display:"flex",gap:5}}>
                      <button onClick={()=>openEdit(w)} style={{padding:"3px 9px",borderRadius:7,border:`1px solid ${C.border}`,background:"#fff",color:C.navy,fontSize:11,fontWeight:600,cursor:"pointer"}}>E</button>
                      <button onClick={()=>handleToggleActive(w)} style={{padding:"3px 9px",borderRadius:7,border:`1px solid ${w.is_active?C.orange:C.teal}`,background:w.is_active?C.orangePale:C.tealPale,color:w.is_active?C.orange:C.teal,fontSize:11,fontWeight:600,cursor:"pointer"}}>{w.is_active?"Désactiver":"Activer"}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {(waiters??[]).length===0&&<tr><td colSpan={5}><div className="empty">Aucun serveur</div></td></tr>}
            </tbody>
          </table>
        </div>
      }
    </div>
  );
}
function ExpensesScreen() {
  const {data:expenses,loading,error,refetch}=useApi(expensesApi.list);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({label:"",amount:"",category:"other"});
  const {mutate,loading:saving}=useMutation(useCallback(d=>expensesApi.create(d),[]));
  const total=(expenses??[]).reduce((s,e)=>s+e.amount,0);
  const bycat=(expenses??[]).reduce((a,e)=>{a[e.category]=(a[e.category]||0)+e.amount;return a;},{});
  const handleAdd=async()=>{
    if(!form.label||!form.amount)return;
    await mutate({...form,amount:Number(form.amount)});
    setShowForm(false);setForm({label:"",amount:"",category:"other"});refetch();
  };
  return (
    <div>
      {error&&<ErrorBox msg={error} onRetry={refetch}/>}
      <div className="sbox" style={{background:`linear-gradient(135deg,${C.navy},${C.navyLight})`}}>
        <div>
          <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,fontWeight:700,color:"rgba(255,255,255,.45)",marginBottom:4}}>Dépenses ce mois</div>
          <div className="samt" style={{color:"#fff"}}>{loading?"-":fmt(total)}</div>
        </div>
      </div>
      <div className="g2">
        <div>
          <div className="sec-title" style={{marginBottom:12}}>Par catégorie</div>
          <div className="card">
            {Object.entries(bycat).map(([cat,amount])=>(
              <div key={cat} style={{padding:"11px 16px",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:12}}>
                  <span style={{fontWeight:500}}>{CAT_EXPENSE[cat]||cat}</span>
                  <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:C.red}}>- {fmt(amount)}</span>
                </div>
                <div className="prog"><div className="progf" style={{width:`${(amount/Math.max(total,1))*100}%`,background:C.orange}}/></div>
              </div>
            ))}
            {Object.keys(bycat).length===0&&!loading&&<div className="empty">Aucune dépense</div>}
          </div>
        </div>
        <div>
          <div className="sec-head" style={{marginBottom:12}}>
            <div className="sec-title">Détail</div>
            <button className="btn btn-o" style={{fontSize:11,padding:"6px 11px"}} onClick={()=>setShowForm(!showForm)}><Ic n="plus" sz={12} col="#fff"/> Ajouter</button>
          </div>
          {showForm&&<div className="fcard">
            <div className="form-row">
              <div className="ig"><label>Libellé</label><input placeholder="Achat légumes" value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></div>
              <div className="ig"><label>Montant (F)</label><input type="number" placeholder="0" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></div>
            </div>
            <div className="form-row"><div className="ig"><label>Catégorie</label><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{Object.entries(CAT_EXPENSE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div></div>
            <div style={{display:"flex",gap:7}}>
              <button className="btn btn-o" onClick={handleAdd} disabled={saving}>{saving?<Spinner size={13}/>:"Enregistrer"}</button>
              <button className="btn btn-g" onClick={()=>setShowForm(false)}>Annuler</button>
            </div>
          </div>}
          <div className="card">
            {loading?<div style={{height:70,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner size={20}/></div>:
              (expenses??[]).map(e=>(
                <div className="erow" key={e.id}>
                  <div><div style={{fontSize:12,fontWeight:500}}>{e.label}</div><div style={{fontSize:10,color:C.muted,marginTop:2}}>{CAT_EXPENSE[e.category]} · {fmtDate(e.created_at)}</div></div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:C.red,fontSize:13}}>- {fmt(e.amount)}</div>
                </div>
              ))
            }
            {(expenses??[]).length===0&&!loading&&<div className="empty">Aucune dépense</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrdersScreen() {
  const [filter,setFilter]=useState("all");
  const fetcher=useCallback(()=>ordersApi.list(filter==="all"?null:filter),[filter]);
  const {data:orders,loading,error,refetch}=useApi(fetcher);
  return (
    <div>
      {error&&<ErrorBox msg={error} onRetry={refetch}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div className="tabs" style={{marginBottom:0}}>
          {["all","open","sent","paid"].map(s=>(
            <button key={s} className={`tab ${filter===s?"on":""}`} onClick={()=>setFilter(s)}>{s==="all"?"Toutes":OST[s]?.l}</button>
          ))}
        </div>
        <button className="btn btn-g" style={{fontSize:11,padding:"5px 11px"}} onClick={refetch}><Ic n="refresh" sz={12} col={C.orange}/></button>
      </div>
      {loading?<div style={{height:110,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner size={26}/></div>:
        (orders??[]).length===0?<div className="empty">Aucune commande</div>:
        (orders??[]).map(o=>{
          const st=OST[o.status?.toLowerCase()]||OST[o.status]||OST.open;
          const total=(o.items??[]).reduce((s,i)=>s+i.unit_price*i.quantity,0);
          return (
            <div className="ocard" key={o.id}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13}}>Commande #{o.id} — Table {o.table_number??o.table_id}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:1}}>Serveur #{o.waiter_id} · {fmtDate(o.created_at)}</div>
                </div>
                <span className="badge" style={{background:st.bg,color:st.c}}>{st.l}</span>
              </div>
              {(o.items??[]).length>0&&<>
                <hr style={{border:"none",borderTop:`1px solid ${C.border}`,margin:"9px 0"}}/>
                {o.items.map((item,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted,padding:"2px 0"}}>
                    <span>{item.product_name||item.name||`Article #${item.product_id}`} x{item.quantity}</span>
                    <span style={{fontWeight:500,color:C.text}}>{fmt(item.unit_price*item.quantity)}</span>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",marginTop:9,paddingTop:9,borderTop:`1px solid ${C.border}`,fontWeight:700,fontSize:13}}>
                  <span>Total</span><span style={{fontFamily:"'Syne',sans-serif",color:C.orange}}>{fmt(total)}</span>
                </div>
              </>}
            </div>
          );
        })
      }
    </div>
  );
}

// ── APP SHELL ────────────────────────────────────────────────────────────────

// ── WEBSOCKET ORDERS — hook temps réel ────────────────────────────────────
function useOrdersWebSocket({ estId, onEvent }) {
  const wsRef = useRef(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!estId) return;
    const token = localStorage.getItem("sokora_token");
    if (!token) return;

    const WS_BASE = (import.meta.env?.VITE_API_URL || "http://localhost:8001")
      .replace(/^http/, "ws");
    const url = `${WS_BASE}/ws/orders/${estId}?token=${encodeURIComponent(token)}`;

    let ws;
    let pingInterval;
    let reconnectTimeout;

    const connect = () => {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setLive(true);
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 30000);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (onEvent) onEvent(data);
        } catch {}
      };

      ws.onclose = () => {
        setLive(false);
        clearInterval(pingInterval);
        reconnectTimeout = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [estId]);

  return live;
}

// ── CAISSE PAGE SCREEN ──────────────────────────────────────────────────────

function KDSScreen() {
  const { user } = useAuth();
  const fetcher=useCallback(()=>kdsApi.orders(),[]);
  const {data:orders,loading,error,refetch}=useApi(fetcher);
  const [marking,setMarking]=useState(null);

  // WebSocket temps réel — refetch à chaque événement commande
  const live = useOrdersWebSocket({
    estId: user?.establishment_id,
    onEvent: (ev) => {
      if (ev.type === "new_order" || ev.type === "order_update") refetch();
    },
  });

  // Fallback polling 30s (au lieu de 15s) si WebSocket actif, sinon 10s
  useEffect(()=>{
    const t=setInterval(()=>refetch(), live ? 30000 : 10000);
    return ()=>clearInterval(t);
  },[refetch, live]);

  const [starting, setStarting]=useState(null);

  const handleStart=async(id)=>{
    setStarting(id);
    try{ await kdsApi.startOrder(id); refetch(); }finally{ setStarting(null); }
  };

  const handleReady=async(id)=>{
    setMarking(id);
    try{ await kdsApi.markReady(id); refetch(); }finally{ setMarking(null); }
  };

  const st = s => (s||"").toUpperCase();
  const active=(orders??[]).filter(o=>["SENT","IN_PROGRESS"].includes(st(o.status)));
  const ready=(orders??[]).filter(o=>st(o.status)==="READY");
  const borderColor=(s)=>{const u=st(s);if(u==="READY")return C.teal;if(u==="IN_PROGRESS")return C.orange;return "#6366f1";};
  const badgeBg=(s)=>{const u=st(s);if(u==="READY")return C.tealPale;if(u==="IN_PROGRESS")return C.orangePale;return "#f5f3ff";};
  const badgeColor=(s)=>{const u=st(s);if(u==="READY")return C.teal;if(u==="IN_PROGRESS")return C.orange;return "#6366f1";};
  const badgeLabel=(s)=>{const u=st(s);if(u==="READY")return "Prete";if(u==="IN_PROGRESS")return "En preparation";if(u==="SENT")return "Nouvelle";return s;};

  return (
    <div>
      {error&&<ErrorBox msg={error} onRetry={refetch}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <span className="badge" style={{background:"#f5f3ff",color:"#6366f1",fontSize:13,padding:"5px 12px"}}>{(orders??[]).filter(o=>st(o.status)==="SENT").length} nouvelles</span>
          <span className="badge" style={{background:C.orangePale,color:C.orange,fontSize:13,padding:"5px 12px"}}>{(orders??[]).filter(o=>st(o.status)==="IN_PROGRESS").length} en cours</span>
          <span className="badge" style={{background:C.tealPale,color:C.teal,fontSize:13,padding:"5px 12px"}}>{ready.length} pretes</span>
          <span style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:live?C.teal:C.muted,fontWeight:600}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:live?C.teal:C.muted,display:"inline-block",boxShadow:live?"0 0 0 3px #19a99d33":"none"}}/>
            {live?"Temps réel":"Polling"}
          </span>
        </div>
        <button className="btn btn-g" onClick={refetch} style={{fontSize:12}}>Actualiser</button>
      </div>
      {loading?<div style={{height:100,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner size={26}/></div>:
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          {(orders??[]).length===0&&<div className="empty" style={{gridColumn:"1/-1"}}>Aucune commande en cuisine</div>}
          {(orders??[]).map(order=>(
            <div key={order.id} style={{background:"#fff",borderRadius:14,padding:16,border:"2px solid "+borderColor(order.status),boxShadow:"0 2px 8px #0001"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:C.navy}}>Table {order.table_number||order.table_id}</div>
                <span className="badge" style={{background:badgeBg(order.status),color:badgeColor(order.status),fontSize:11}}>{badgeLabel(order.status)}</span>
              </div>
              <div style={{marginBottom:12}}>
                {(order.items||[]).map(item=>(
                  <div key={item.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+C.border,fontSize:13}}>
                    <span style={{fontWeight:600}}>{item.quantity}x {item.product_name}</span>
                    {item.is_complimentary&&<span style={{fontSize:10,background:"#eef2ff",color:C.purple,padding:"1px 6px",borderRadius:8,fontWeight:700}}>Offert</span>}
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:C.muted,marginBottom:10}}>
                <span>Serveur: {order.waiter_name||"---"}</span>
                <span>{new Date(order.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span>
              </div>
              {st(order.status)==="SENT"&&(
                <button onClick={()=>handleStart(order.id)} disabled={starting===order.id} style={{width:"100%",padding:"10px",borderRadius:9,background:"#6366f1",border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",opacity:starting===order.id?0.6:1}}>
                  {starting===order.id?<Spinner size={13} col="#fff"/>:"Prendre en charge"}
                </button>
              )}
              {st(order.status)==="IN_PROGRESS"&&(
                <button onClick={()=>handleReady(order.id)} disabled={marking===order.id} style={{width:"100%",padding:"10px",borderRadius:9,background:C.teal,border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",opacity:marking===order.id?0.6:1}}>
                  {marking===order.id?<Spinner size={13} col="#fff"/>:"Marquer Prete"}
                </button>
              )}
              {st(order.status)==="READY"&&(
                <div style={{width:"100%",padding:"10px",borderRadius:9,background:C.tealPale,border:"1px solid "+C.teal+"44",color:C.teal,fontWeight:700,fontSize:13,textAlign:"center"}}>
                  Prete -- en attente du serveur
                </div>
              )}
            </div>
          ))}
        </div>
      }
    </div>
  );

}
function CaissePageScreen() {
  return (
    <div style={{maxWidth:800,margin:"0 auto",padding:"0 0 32px"}}>
      <div style={{marginBottom:16}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:C.navy,margin:0}}>Suivi Caisse</h2>
        <p style={{color:C.muted,fontSize:13,margin:"4px 0 0"}}>Encaissements en temps réel par moyen de paiement</p>
      </div>
      <CaisseWidget/>
      <RevenueByMethodChart/>
    </div>
  );
}

// ── WALLET MANAGER SCREEN ────────────────────────────────────────────────────
function WalletManagerScreen() {
  const {data,loading,error,refetch}          = useApi(walletApi.manager);
  const {data:liq, refetch:refetchLiq}        = useApi(walletApi.liquidity);
  const [confirming,   setConfirming]   = useState(null);
  const [rejecting,    setRejecting]    = useState(null);
  const [pendingReject,setPendingReject] = useState(null);
  const [walletErr,    setWalletErr]    = useState('');
  const [tab, setTab] = useState("pending");

  const handleConfirm = async (id) => {
    setConfirming(id); setWalletErr('');
    try { await walletApi.confirmTopup(id); refetch(); }
    catch(e) { setWalletErr(e?.response?.data?.detail || e.message || 'Erreur lors de la confirmation'); }
    finally { setConfirming(null); }
  };

  const handleReject = async (id) => {
    setPendingReject(null);
    setRejecting(id); setWalletErr('');
    try { await walletApi.rejectTopup(id); refetch(); }
    catch(e) { setWalletErr(e?.response?.data?.detail || e.message || 'Erreur lors du rejet'); }
    finally { setRejecting(null); }
  };

  const METHOD_ICONS = { cash:"E", wave:"W", orange_money:"O", mtn_money:"M", card:"$" };
  const TX_COLORS    = { topup: C.teal, payment: C.orange, transfer: C.purple };
  const TX_LABELS    = { topup: "Recharge", payment: "Paiement", transfer: "Transfert" };

  if (loading) return <div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner size={28}/></div>;
  if (error)   return <ErrorBox msg={error} onRetry={refetch}/>;

  const pending = data?.pending_topups || [];
  const txs     = data?.recent_transactions || [];

  return (
    <div>
      {/* KPIs */}
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        {[
          {label:"En attente",    value:data?.pending_count||0,             c:C.orange, bg:C.orangePale, icon:"P"},
          {label:"Rechargé auj.", value:fmt(data?.today_topups||0),         c:C.teal,   bg:C.tealPale,   icon:"+"},
          {label:"Payé wallet",   value:fmt(data?.today_wallet_payments||0),c:C.purple, bg:"#f5f3ff",    icon:"$"},
          {label:"Clients actifs",value:data?.active_clients||0,            c:C.navy,   bg:"#eef2ff",    icon:"U"},
        ].map((k,i) => (
          <div key={i} style={{background:k.bg,border:`1px solid ${k.c}22`,borderRadius:14,padding:"14px 18px",flex:1,minWidth:140}}>
            <div style={{fontSize:18,marginBottom:6}}>{k.icon}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:k.c}}>{k.value}</div>
            <div style={{fontSize:11,color:C.muted,fontWeight:700,marginTop:2,textTransform:"uppercase",letterSpacing:0.8}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Liquidité */}
      {liq && (
        <div style={{background:liq.liquidity>=0?"#f0fdfa":"#fef2f2",border:`1px solid ${liq.liquidity>=0?"#0D9488":"#ef4444"}33`,borderRadius:14,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:liq.liquidity>=0?C.teal:C.red,textTransform:"uppercase",letterSpacing:0.8}}>
              {liq.liquidity>=0?"OK Liquidité disponible":"! Liquidité insuffisante"}
            </div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:liq.liquidity>=0?C.teal:C.red,marginTop:4}}>
              {fmt(liq.liquidity)}
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>
              Encaissé wallet: {fmt(liq.wallet_received)} — Rechargé: {fmt(liq.total_loaded)}
            </div>
          </div>
          {liq.pending_amount>0&&(
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:C.muted}}>En attente</div>
              <div style={{fontSize:16,fontWeight:800,color:C.orange}}>{fmt(liq.pending_amount)}</div>
            </div>
          )}
        </div>
      )}

      {/* Erreur inline */}
      {walletErr && <div style={{background:"#fff0f0",border:"1px solid "+C.red+"44",borderRadius:10,padding:"10px 14px",marginBottom:12,color:C.red,fontSize:13,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span>⚠ {walletErr}</span>
        <button onClick={()=>setWalletErr('')} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontWeight:700,fontSize:16}}>×</button>
      </div>}

      {/* Modale confirmation rejet */}
      {pendingReject && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:16,padding:28,width:340,boxShadow:"0 8px 32px rgba(0,0,0,.18)"}}>
            <div style={{fontWeight:800,fontSize:16,color:C.navy,marginBottom:8}}>Rejeter la demande ?</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Cette action est irréversible. Le client sera notifié du rejet.</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setPendingReject(null)} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid "+C.border,background:"#fff",cursor:"pointer",fontWeight:600}}>Annuler</button>
              <button onClick={()=>handleReject(pendingReject)} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:C.red,color:"#fff",cursor:"pointer",fontWeight:700}}>
                {rejecting?<Spinner size={14} col="#fff"/>:"Confirmer le rejet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[
          {id:"pending", label:`P En attente${pending.length>0?` (${pending.length})`:""}`},
          {id:"history", label:"H Historique"},
        ].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"8px 16px",borderRadius:20,border:`1.5px solid ${tab===t.id?C.orange:C.border}`,
            background:tab===t.id?C.orange:"#fff",color:tab===t.id?"#fff":C.muted,
            fontSize:13,fontWeight:700,cursor:"pointer"
          }}>{t.label}</button>
        ))}
        <button onClick={refetch} style={{marginLeft:"auto",padding:"8px 14px",borderRadius:20,border:`1px solid ${C.border}`,background:"#fff",color:C.muted,fontSize:12,cursor:"pointer"}}>~ Actualiser</button>
      </div>

      {/* Tab Pending */}
      {tab==="pending" && (
        <div>
          {pending.length===0 ? (
            <div style={{textAlign:"center",padding:"48px 0",color:C.muted}}>
              <div style={{fontSize:40,marginBottom:12}}>OK</div>
              <div style={{fontSize:14}}>Aucune demande en attente</div>
            </div>
          ) : (
            <div className="card">
              <table className="dt">
                <thead>
                  <tr><th>Client</th><th>Montant</th><th>Méthode</th><th>Heure</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {pending.map(t => (
                    <tr key={t.id}>
                      <td>
                        <div style={{fontWeight:700}}>{t.client_name}</div>
                        <div style={{fontSize:11,color:C.muted}}>{t.client_phone}</div>
                      </td>
                      <td><span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:C.orange}}>{fmt(t.amount)}</span></td>
                      <td><span style={{fontSize:16}}>{METHOD_ICONS[t.method]||"$"}</span> <span style={{fontSize:12,color:C.muted}}>{t.method}</span></td>
                      <td style={{fontSize:12,color:C.muted}}>{t.created_at?new Date(t.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}):"-"}</td>
                      <td>
                        <div style={{display:"flex",gap:6}}>
                          <button
                            onClick={()=>setPendingReject(t.id)}
                            disabled={rejecting===t.id}
                            style={{padding:"5px 10px",borderRadius:8,border:"1.5px solid #ef4444",background:"#fff",color:"#ef4444",fontSize:12,fontWeight:700,cursor:"pointer"}}
                          >{rejecting===t.id?"...":"✗ Rejeter"}</button>
                          <button
                            onClick={()=>handleConfirm(t.id)}
                            disabled={confirming===t.id}
                            style={{padding:"5px 12px",borderRadius:8,border:"none",background:C.teal,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}
                          >{confirming===t.id?<Spinner size={11} col="#fff"/>:"v Valider"}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab History */}
      {tab==="history" && (
        <div className="card">
          <table className="dt">
            <thead>
              <tr><th>Client</th><th>Type</th><th>Montant</th><th>Description</th><th>Date</th></tr>
            </thead>
            <tbody>
              {txs.length===0 && <tr><td colSpan={5}><div className="empty">Aucune transaction</div></td></tr>}
              {txs.map(tx => (
                <tr key={tx.id}>
                  <td>
                    <div style={{fontWeight:600}}>{tx.client_name}</div>
                    <div style={{fontSize:11,color:C.muted}}>{tx.client_phone}</div>
                  </td>
                  <td>
                    <span className="badge" style={{background:(TX_COLORS[tx.tx_type]||C.muted)+"22",color:TX_COLORS[tx.tx_type]||C.muted}}>
                      {TX_LABELS[tx.tx_type]||tx.tx_type}
                    </span>
                  </td>
                  <td><span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:tx.tx_type==="topup"?C.teal:C.orange}}>{tx.tx_type==="topup"?"+":"-"}{fmt(tx.amount)}</span></td>
                  <td style={{fontSize:12,color:C.muted}}>{tx.description||"-"}</td>
                  <td style={{fontSize:11,color:C.muted}}>{tx.created_at?new Date(tx.created_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function ArdoiseScreen() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [txs, setTxs] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const PAY_METHODS = [
    { id:'cash',label:'Espèces',icon:'💵' },
    { id:'orange_money',label:'Orange Money',icon:'🟠' },
    { id:'wave',label:'Wave',icon:'🌊' },
    { id:'mtn',label:'MTN',icon:'🟡' },
    { id:'wallet',label:'Wallet',icon:'💳' },
  ];

  const loadAccounts = async () => {
    try {
      setError('');
      const res = await creditApi.accounts();
      setAccounts(res.data);
    } catch(e) { setError(e?.response?.data?.detail || 'Impossible de charger les ardoises'); }
    finally { setLoading(false); }
  };

  const loadTx = async (id) => {
    setTxLoading(true);
    try {
      const res = await creditApi.transactions(id);
      setTxs(res.data);
    } catch(e) { setTxs([]); console.error('Erreur chargement transactions:', e); }
    finally { setTxLoading(false); }
  };

  const handleSelect = (acc) => {
    setSelected(acc);
    setTxs([]);
    loadTx(acc.id);
  };

  const handlePayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { setPayError('Montant invalide'); return; }
    if (amt > selected.balance) { setPayError(`Maximum autorisé : ${fmt(selected.balance)}`); return; }
    setPayError('');
    setPaying(true);
    try {
      await creditApi.addTransaction(selected.id, { amount: amt, transaction_type: 'payment', description: 'Remboursement', payment_method: payMethod });
      setShowPayModal(false);
      setPayAmount('');
      setPayError('');
      await loadAccounts();
      await loadTx(selected.id);
      setSelected(prev => ({ ...prev, balance: Math.max(0, prev.balance - amt) }));
    } catch(e) { setPayError(e?.response?.data?.detail || e.message || 'Erreur lors du paiement'); }
    finally { setPaying(false); }
  };

  useEffect(() => { loadAccounts(); }, []);

  const totalDue = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const debtors = accounts.filter(a => a.balance > 0);

  if (loading) return <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner size={28}/></div>;
  if (error) return <ErrorBox msg={error} onRetry={loadAccounts}/>;

  return (
    <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:20,height:'calc(100vh - 120px)'}}>
      {/* LEFT — liste clients */}
      <div style={{background:'#fff',borderRadius:14,border:'1px solid '+C.border,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'14px 16px',borderBottom:'1px solid '+C.border,background:C.navy}}>
          <div style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:2}}>Ardoises clients</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.6)'}}>{debtors.length} débiteur(s) · Total dû: {fmt(totalDue)}</div>
        </div>
        <div style={{overflowY:'auto',flex:1}}>
          {accounts.length === 0 && <div style={{padding:24,textAlign:'center',color:C.muted,fontSize:13}}>Aucune ardoise</div>}
          {accounts.map(acc => (
            <div key={acc.id} onClick={() => handleSelect(acc)}
              style={{padding:'12px 16px',borderBottom:'1px solid '+C.border,cursor:'pointer',
                background: selected?.id === acc.id ? C.orangePale : '#fff',
                borderLeft: selected?.id === acc.id ? '3px solid '+C.orange : '3px solid transparent'
              }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:C.navy}}>{acc.client_name}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:1}}>{acc.client_phone}</div>
                  {acc.credit_limit ? (() => {
                    const pct = Math.min((acc.balance/acc.credit_limit)*100, 100);
                    return (
                      <div style={{marginTop:4}}>
                        <div style={{height:3,borderRadius:2,background:C.border,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${pct}%`,background:pct>=90?C.red:pct>=70?C.orange:C.teal,transition:'width .5s'}}/>
                        </div>
                        <div style={{fontSize:9,color:C.muted,marginTop:1}}>{Math.round(pct)}% / {fmt(acc.credit_limit)}</div>
                      </div>
                    );
                  })() : null}
                </div>
                <div style={{textAlign:'right',marginLeft:8}}>
                  <div style={{fontWeight:800,fontSize:14,color:acc.balance>0?C.red:C.teal}}>{fmt(acc.balance)}</div>
                  <div style={{fontSize:10,marginTop:2,padding:'1px 6px',borderRadius:8,background:acc.balance>0?'#fff0f0':'#edfaf8',color:acc.balance>0?C.red:C.teal,fontWeight:700}}>
                    {acc.credit_limit&&acc.balance>=acc.credit_limit ? '🚨 Dépassé' : acc.balance > 0 ? 'Doit' : 'Soldé'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — detail */}
      <div style={{background:'#fff',borderRadius:14,border:'1px solid '+C.border,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {!selected ? (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,color:C.muted}}>
            <Ic n="users" sz={40} col={C.muted}/>
            <div style={{fontSize:14}}>Sélectionnez un client</div>
          </div>
        ) : (
          <>
            <div style={{padding:'16px 20px',borderBottom:'1px solid '+C.border,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:800,fontSize:17,color:C.navy}}>{selected.client_name}</div>
                <div style={{fontSize:12,color:C.muted}}>{selected.client_phone}</div>
              </div>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:11,color:C.muted}}>Solde dû</div>
                  <div style={{fontSize:20,fontWeight:800,color:selected.balance>0?C.red:C.teal}}>{fmt(selected.balance)}</div>
                </div>
                {selected.balance > 0 && (
                  <button className="btn" onClick={() => setShowPayModal(true)} style={{background:C.teal,color:'#fff',border:'none',padding:'8px 16px',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13}}>
                    Enregistrer paiement
                  </button>
                )}
              </div>
            </div>
            <div style={{padding:'12px 20px',borderBottom:'1px solid '+C.border,background:C.bg,display:'flex',gap:16}}>
              {[
                {label:'Consommé total',val:fmt(txs.filter(t=>t.type==='credit').reduce((s,t)=>s+t.amount,0)),c:C.red},
                {label:'Payé total',val:fmt(txs.filter(t=>t.type==='payment').reduce((s,t)=>s+t.amount,0)),c:C.teal},
                {label:'Nb transactions',val:txs.length,c:C.navy},
              ].map(k=>(
                <div key={k.label} style={{flex:1,background:'#fff',borderRadius:10,padding:'10px 14px',border:'1px solid '+C.border}}>
                  <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{k.label}</div>
                  <div style={{fontSize:16,fontWeight:800,color:k.c}}>{k.val}</div>
                </div>
              ))}
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'0 20px 16px'}}>
              <div style={{fontSize:12,fontWeight:700,color:C.muted,padding:'12px 0 8px',textTransform:'uppercase',letterSpacing:1}}>Historique</div>
              {txLoading && <div style={{textAlign:'center',padding:20}}><Spinner size={20}/></div>}
              {!txLoading && txs.length === 0 && <div style={{textAlign:'center',padding:20,color:C.muted,fontSize:13}}>Aucune transaction</div>}
              {txs.map(tx => (
                <div key={tx.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid '+C.border}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.navy}}>{tx.description || (tx.type==='credit'?'Ardoise':'Paiement')}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:1}}>{tx.created_at ? new Date(tx.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}</div>
                  </div>
                  <div style={{fontWeight:800,fontSize:14,color:tx.type==='credit'?C.red:C.teal}}>
                    {tx.type==='credit'?'+':'-'}{fmt(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MODAL PAIEMENT */}
      {showPayModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:340,boxShadow:'0 8px 32px rgba(0,0,0,.18)'}}>
            <div style={{fontWeight:800,fontSize:17,color:C.navy,marginBottom:4}}>Enregistrer un paiement</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Client: {selected?.client_name} · Solde: {fmt(selected?.balance)}</div>
            <input type="number" placeholder="Montant en F CFA" value={payAmount}
              onChange={e=>{setPayAmount(e.target.value);setPayError('');}}
              style={{width:'100%',padding:'10px 12px',borderRadius:8,border:`1px solid ${payError?C.red:C.border}`,fontSize:15,marginBottom:payError?8:16,boxSizing:'border-box'}}/>
            {payError && <div style={{color:C.red,fontSize:12,fontWeight:600,marginBottom:8}}>⚠ {payError}</div>}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Mode de paiement</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {PAY_METHODS.map(pm=>(
                  <button key={pm.id} onClick={()=>setPayMethod(pm.id)}
                    style={{padding:'5px 10px',borderRadius:8,border:`1.5px solid ${payMethod===pm.id?C.teal:C.border}`,
                      background:payMethod===pm.id?C.teal:'#fff',color:payMethod===pm.id?'#fff':C.navy,
                      cursor:'pointer',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:4}}>
                    {pm.icon} {pm.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{setShowPayModal(false);setPayAmount('');setPayError('');}} style={{flex:1,padding:'10px',borderRadius:8,border:'1px solid '+C.border,background:'#fff',cursor:'pointer',fontWeight:600}}>Annuler</button>
              <button onClick={handlePayment} disabled={paying} style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:C.teal,color:'#fff',cursor:'pointer',fontWeight:700,opacity:paying?0.6:1}}>
                {paying?<Spinner size={14} col="#fff"/>:'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FINANCE IA — Score bancaire & ratios
// ─────────────────────────────────────────────────────────────────────────────

function FinanceScreen() {
  const [data,  setData]  = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,  setError]   = useState('');

  useEffect(()=>{
    financeApi.getDashboard()
      .then(r=>setData(r.data))
      .catch(()=>setError('Impossible de charger le tableau de bord financier.'))
      .finally(()=>setLoading(false));
  },[]);

  const fmt = n => new Intl.NumberFormat('fr-FR').format(n) + ' F';

  if(loading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:300}}><Spinner size={32} col={C.teal}/></div>;
  if(error)   return <div style={{color:C.red,padding:24,textAlign:'center'}}>{error}</div>;
  if(!data)   return null;

  const {score,score_label,score_color,score_breakdown,ratios,loan_offers,recommendations} = data;

  // Score arc SVG (semi-circle gauge)
  const r=70, cx=90, cy=90;
  const angle = (score/100)*180;
  const toRad = d => d*Math.PI/180;
  const arcX = cx + r*Math.cos(toRad(180-angle));
  const arcY = cy - r*Math.sin(toRad(180-angle));
  const bgArc  = `M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`;
  const fgArc  = score>0 ? `M ${cx-r} ${cy} A ${r} ${r} 0 ${angle>180?1:0} 1 ${arcX} ${arcY}` : '';

  // Monthly revenue bars
  const revs = [ratios.revenue_m2, ratios.revenue_m1, ratios.revenue_m0];
  const maxRev = Math.max(...revs,1);
  const barLabels = ['M-2','M-1','Ce mois'];

  // Score breakdown items
  const breakdown = [
    {label:'Stabilité revenus', max:25, val:score_breakdown.stability},
    {label:'Recouvrement ardoise', max:20, val:score_breakdown.recovery},
    {label:'Volume mensuel', max:20, val:score_breakdown.volume},
    {label:'Croissance', max:20, val:score_breakdown.growth},
    {label:'Régularité', max:15, val:score_breakdown.regularity},
  ];

  return (
    <div style={{padding:24, maxWidth:900, margin:'0 auto'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <div style={{fontSize:28}}>🏦</div>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:C.navy}}>Finance IA</div>
          <div style={{fontSize:12,color:C.muted}}>Analyse des 90 derniers jours · Score bancaire SOKORA</div>
        </div>
        {!data.has_sufficient_data && (
          <div style={{marginLeft:'auto',background:'#fef9c3',border:'1px solid #fde047',borderRadius:8,padding:'6px 12px',fontSize:12,color:'#854d0e',fontWeight:600}}>
            ⚠ Données insuffisantes — continuez votre activité pour affiner le score
          </div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>

        {/* Score gauge */}
        <div style={{background:'#fff',borderRadius:16,border:`1px solid ${C.border}`,padding:24,display:'flex',flexDirection:'column',alignItems:'center'}}>
          <div style={{fontSize:13,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Score bancaire</div>
          <svg width={180} height={100} viewBox="0 0 180 100">
            <path d={bgArc} fill="none" stroke={C.border} strokeWidth={14} strokeLinecap="round"/>
            {fgArc && <path d={fgArc} fill="none" stroke={score_color} strokeWidth={14} strokeLinecap="round"/>}
            <text x={cx} y={cy-8} textAnchor="middle" fontSize={32} fontWeight={800} fill={score_color}>{score}</text>
            <text x={cx} y={cy+8} textAnchor="middle" fontSize={13} fontWeight={700} fill={C.navy}>{score_label}</text>
          </svg>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,width:'100%',marginTop:8}}>
            {breakdown.map(b=>(
              <div key={b.label} style={{fontSize:10,color:C.muted}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span>{b.label}</span><span style={{fontWeight:700,color:C.navy}}>{b.val}/{b.max}</span>
                </div>
                <div style={{height:4,borderRadius:2,background:C.border,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(b.val/b.max)*100}%`,background:score_color,borderRadius:2}}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,alignContent:'start'}}>
          {[
            {label:'CA ce mois',      val:fmt(ratios.revenue_m0),  icon:'📈', color:C.teal},
            {label:'CA moyen/mois',   val:fmt(ratios.revenue_avg), icon:'📊', color:C.navy},
            {label:'Panier moyen',    val:fmt(ratios.avg_ticket),  icon:'🛒', color:'#8b5cf6'},
            {label:'Croissance MoM',  val:(ratios.mom_growth>=0?'+':'')+ratios.mom_growth+'%', icon:'🚀',
              color: ratios.mom_growth>=0?'#22c55e':'#ef4444'},
            {label:'Jours actifs',    val:`${ratios.active_days} / 90`, icon:'📅', color:C.orange},
            {label:'Taux dépenses',   val:`${ratios.expense_ratio}%`,   icon:'💸',
              color: ratios.expense_ratio>60?'#ef4444':ratios.expense_ratio>40?C.orange:'#22c55e'},
          ].map(k=>(
            <div key={k.label} style={{background:'#fff',borderRadius:12,border:`1px solid ${C.border}`,padding:'12px 14px'}}>
              <div style={{fontSize:18,marginBottom:2}}>{k.icon}</div>
              <div style={{fontSize:15,fontWeight:800,color:k.color}}>{k.val}</div>
              <div style={{fontSize:10,color:C.muted,fontWeight:600}}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue bars + Ardoise + Payment methods */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20,marginBottom:20}}>

        {/* Revenue chart */}
        <div style={{background:'#fff',borderRadius:16,border:`1px solid ${C.border}`,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>Revenus mensuels</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:12,height:100}}>
            {revs.map((rv,i)=>{
              const h = maxRev>0 ? Math.max(4, Math.round((rv/maxRev)*90)) : 4;
              const isLatest = i===2;
              return (
                <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                  <div style={{fontSize:9,color:C.muted,fontWeight:600}}>{rv>0?fmt(rv):'–'}</div>
                  <div style={{width:'100%',height:h,borderRadius:'4px 4px 0 0',background:isLatest?C.teal:C.border}}/>
                  <div style={{fontSize:10,color:C.muted}}>{barLabels[i]}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ardoise summary */}
        <div style={{background:'#fff',borderRadius:16,border:`1px solid ${C.border}`,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>Ardoise</div>
          <div style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
              <span style={{color:C.muted}}>Recouvrement</span>
              <span style={{fontWeight:800,color:ratios.ardoise_recovery_rate>=80?'#22c55e':ratios.ardoise_recovery_rate>=60?C.orange:'#ef4444'}}>
                {ratios.ardoise_recovery_rate}%
              </span>
            </div>
            <div style={{height:6,borderRadius:3,background:C.border,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${ratios.ardoise_recovery_rate}%`,
                background:ratios.ardoise_recovery_rate>=80?'#22c55e':ratios.ardoise_recovery_rate>=60?C.orange:'#ef4444'}}/>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.muted,marginBottom:4}}>
            <span>Encours total</span><span style={{fontWeight:700,color:C.navy}}>{fmt(ratios.ardoise_outstanding)}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.muted}}>
            <span>Comptes actifs</span><span style={{fontWeight:700,color:C.navy}}>{ratios.ardoise_accounts}</span>
          </div>
        </div>

        {/* Payment methods */}
        <div style={{background:'#fff',borderRadius:16,border:`1px solid ${C.border}`,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>Modes de paiement</div>
          {Object.keys(ratios.payment_methods).length === 0
            ? <div style={{fontSize:12,color:C.muted,textAlign:'center',marginTop:20}}>Aucune donnée</div>
            : (() => {
                const total = Object.values(ratios.payment_methods).reduce((a,b)=>a+b,0);
                const colors = ['#14b8a6','#6366f1','#f59e0b','#22c55e','#ec4899','#f97316'];
                const LABELS = {CASH:'Espèces',WAVE:'Wave',MOBILE_MONEY:'Mobile Money',
                  ORANGE_MONEY:'Orange Money',MTN_MONEY:'MTN',CARD:'Carte',WALLET:'Wallet',CREDIT:'Ardoise'};
                return Object.entries(ratios.payment_methods).map(([m,cnt],i)=>(
                  <div key={m} style={{marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:2}}>
                      <span style={{color:C.navy,fontWeight:600}}>{LABELS[m]||m}</span>
                      <span style={{color:C.muted}}>{Math.round(cnt/total*100)}%</span>
                    </div>
                    <div style={{height:5,borderRadius:3,background:C.border,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${Math.round(cnt/total*100)}%`,background:colors[i%colors.length]}}/>
                    </div>
                  </div>
                ));
              })()
          }
        </div>
      </div>

      {/* Loan offers */}
      <div style={{background:'#fff',borderRadius:16,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
        <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:16}}>💰 Offres de financement SOKORA</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
          {loan_offers.map(offer=>(
            <div key={offer.type} style={{borderRadius:12,border:`2px solid ${offer.eligible?C.teal:C.border}`,padding:16,
              background:offer.eligible?'#f0fdfa':'#fafafa',opacity:offer.eligible?1:0.75}}>
              <div style={{fontSize:22,marginBottom:6}}>{offer.icon}</div>
              <div style={{fontSize:14,fontWeight:800,color:C.navy,marginBottom:2}}>{offer.label}</div>
              <div style={{fontSize:18,fontWeight:800,color:offer.eligible?C.teal:C.muted,marginBottom:4}}>
                {fmt(offer.amount)}
              </div>
              <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{offer.rate} · {offer.duration}</div>
              <div style={{fontSize:11,color:offer.eligible?'#0d9488':C.muted,fontWeight:600,marginTop:6}}>
                {offer.eligible ? '✅ ' : '🔒 '}{offer.reason}
              </div>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:C.muted,marginTop:12,fontStyle:'italic'}}>
          * Ces offres sont indicatives. Contactez SOKORA Finance pour une demande officielle.
        </div>
      </div>

      {/* Recommendations */}
      <div style={{background:'#fff',borderRadius:16,border:`1px solid ${C.border}`,padding:20}}>
        <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:12}}>🤖 Recommandations IA</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {recommendations.map((rec,i)=>(
            <div key={i} style={{background:'#f8fafc',borderRadius:8,padding:'10px 14px',fontSize:13,color:C.navy,
              borderLeft:`3px solid ${C.teal}`}}>
              {rec}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function SuperAdminScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getNetwork()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = n => new Intl.NumberFormat('fr-FR').format(n);
  const fmtF = n => fmt(n) + ' F';

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:60}}><Spinner size={32} col={C.teal}/></div>;
  if (!data) return <div style={{color:C.red,padding:24,textAlign:'center'}}>Accès refusé — Super Admin uniquement</div>;

  const { summary, top_establishments, revenue_by_method } = data;
  const LABELS = {CASH:'Espèces',WAVE:'Wave',MOBILE_MONEY:'Mobile Money',ORANGE_MONEY:'Orange Money',MTN_MONEY:'MTN',CARD:'Carte',WALLET:'Wallet',CREDIT:'Ardoise'};
  const COLORS = ['#14b8a6','#6366f1','#f59e0b','#22c55e','#ec4899','#f97316'];

  return (
    <div style={{padding:24,maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <div style={{fontSize:28}}>🌐</div>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:C.navy}}>Vue Réseau SOKORA</div>
          <div style={{fontSize:12,color:C.muted}}>Super Admin · Tableau de bord global 30 derniers jours</div>
        </div>
      </div>

      {/* KPI globaux */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
        {[
          {label:'Établissements actifs', val:summary.active_establishments+'/'+summary.total_establishments, icon:'🏪', color:C.teal},
          {label:'CA réseau (30j)',        val:fmtF(summary.revenue_month),  icon:'💰', color:'#22c55e'},
          {label:'Commandes (30j)',        val:fmt(summary.orders_month),    icon:'🧾', color:C.navy},
          {label:'Clients inscrits',       val:fmt(summary.total_clients),   icon:'👤', color:'#8b5cf6'},
          {label:'Wallet total',           val:fmtF(summary.wallet_liquidity),icon:'💳', color:C.orange},
          {label:'Ardoise encours',        val:fmtF(summary.ardoise_outstanding),icon:'📋', color:summary.ardoise_outstanding>500000?'#ef4444':C.muted},
          {label:'Gérants',               val:summary.total_managers,       icon:'👔', color:C.navy},
          {label:'Serveurs',              val:summary.total_waiters,        icon:'🍽️', color:C.teal},
          {label:'Ticket moyen réseau',   val:summary.orders_month>0?fmtF(Math.round(summary.revenue_month/summary.orders_month)):'—', icon:'🛒', color:'#f59e0b'},
        ].map(k => (
          <div key={k.label} style={{background:'#fff',borderRadius:12,border:`1px solid ${C.border}`,padding:'14px 16px'}}>
            <div style={{fontSize:20,marginBottom:4}}>{k.icon}</div>
            <div style={{fontSize:18,fontWeight:800,color:k.color}}>{k.val}</div>
            <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20,marginBottom:20}}>
        {/* Top établissements */}
        <div style={{background:'#fff',borderRadius:16,border:`1px solid ${C.border}`,padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:16}}>🏆 Top Établissements (30j)</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{borderBottom:`2px solid ${C.border}`}}>
                {['#','Établissement','Ville','Type','CA 30j','Commandes'].map(h=>(
                  <th key={h} style={{textAlign:'left',padding:'6px 8px',color:C.muted,fontWeight:700,textTransform:'uppercase',fontSize:10}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top_establishments.map((est,i)=>(
                <tr key={est.id} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?'#fafafa':'#fff'}}>
                  <td style={{padding:'8px',fontWeight:700,color:C.muted}}>{i+1}</td>
                  <td style={{padding:'8px',fontWeight:700,color:C.navy}}>{est.name}</td>
                  <td style={{padding:'8px',color:C.muted}}>{est.city||'—'}</td>
                  <td style={{padding:'8px'}}>
                    <span style={{background:C.teal+'22',color:C.teal,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>
                      {est.type||'resto'}
                    </span>
                  </td>
                  <td style={{padding:'8px',fontWeight:700,color:'#22c55e'}}>{fmtF(est.revenue_30d)}</td>
                  <td style={{padding:'8px',color:C.muted}}>{est.orders_30d}</td>
                </tr>
              ))}
              {top_establishments.length===0&&(
                <tr><td colSpan={6} style={{padding:20,textAlign:'center',color:C.muted}}>Aucune donnée</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Répartition paiements */}
        <div style={{background:'#fff',borderRadius:16,border:`1px solid ${C.border}`,padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:16}}>💳 Modes de paiement réseau</div>
          {Object.keys(revenue_by_method).length===0
            ? <div style={{fontSize:12,color:C.muted,textAlign:'center',marginTop:20}}>Aucune donnée</div>
            : (() => {
                const total = Object.values(revenue_by_method).reduce((a,b)=>a+b,0);
                return Object.entries(revenue_by_method)
                  .sort(([,a],[,b])=>b-a)
                  .map(([m,rev],i)=>(
                  <div key={m} style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                      <span style={{color:C.navy,fontWeight:600}}>{LABELS[m]||m}</span>
                      <span style={{color:C.muted}}>{Math.round(rev/total*100)}% · {fmtF(rev)}</span>
                    </div>
                    <div style={{height:6,borderRadius:3,background:C.border,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${Math.round(rev/total*100)}%`,background:COLORS[i%COLORS.length]}}/>
                    </div>
                  </div>
                ));
              })()
          }
        </div>
      </div>
    </div>
  );
}

// ── CAISSE RAPIDE / POS — Module petits commerces ────────────────────────────
const PAY_METHODS = [
  { id:"CASH",         label:"Espèces",      color:C.green  },
  { id:"WAVE",         label:"Wave",         color:"#1DA1F2"},
  { id:"ORANGE_MONEY", label:"Orange Money", color:"#ff6600"},
  { id:"MTN_MONEY",    label:"MTN Money",    color:"#ffd700"},
  { id:"MOBILE_MONEY", label:"Mobile Money", color:C.teal   },
  { id:"CARD",         label:"Carte",        color:C.purple },
];

function POSScreen() {
  const { data: products, loading: pLoad } = useApi(menuApi.products);
  const { data: statsData, refetch: refetchStats } = useApi(posApi.stats);
  const [cart, setCart] = useState([]);
  const [payMethod, setPayMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("pos"); // "pos" | "history"

  useEffect(() => {
    posApi.sales(20).then(r => setHistory(r.data)).catch(()=>{});
  }, []);

  const addToCart = (p) => {
    setCart(c => {
      const ex = c.find(x=>x.id===p.id);
      if(ex) return c.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x);
      return [...c, {id:p.id, name:p.name, price:p.price, qty:1}];
    });
  };
  const changeQty = (id, delta) => {
    setCart(c => c.map(x=>x.id===id?{...x,qty:Math.max(0,x.qty+delta)}:x).filter(x=>x.qty>0));
  };
  const total = cart.reduce((s,x)=>s+x.price*x.qty,0);

  const submitSale = async () => {
    if(!cart.length) return;
    setSaving(true);
    try {
      await posApi.createSale({
        items: cart.map(x=>({product_id:x.id, quantity:x.qty, unit_price:x.price})),
        payment_method: payMethod,
        note: note||undefined,
      });
      setCart([]); setNote("");
      setToast(`Vente enregistrée — ${new Intl.NumberFormat("fr-FR").format(total)} F`);
      setTimeout(()=>setToast(""),3500);
      refetchStats();
      posApi.sales(20).then(r=>setHistory(r.data)).catch(()=>{});
    } catch(e) {
      setToast("Erreur lors de l'enregistrement");
      setTimeout(()=>setToast(""),3000);
    } finally { setSaving(false); }
  };

  const avail = (products||[]).filter(p=>p.is_available);
  const s = statsData||{};

  return (
    <div>
      {toast&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:C.navy,color:"#fff",borderRadius:12,padding:"10px 22px",fontSize:14,zIndex:999,boxShadow:"0 4px 20px rgba(0,0,0,.2)"}}>{toast}</div>}

      {/* Stat du jour */}
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        {[
          {label:"Ventes aujourd'hui", val:s.count||0, unit:""},
          {label:"Chiffre du jour", val:new Intl.NumberFormat("fr-FR").format(s.total_revenue||0), unit:" F"},
        ].map(x=>(
          <div key={x.label} className="sbox" style={{flex:1,minWidth:150,background:C.surface,border:`1px solid ${C.border}`}}>
            <div><div style={{fontSize:12,color:C.muted,marginBottom:4}}>{x.label}</div>
            <div className="samt">{x.val}{x.unit}</div></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[{id:"pos",label:"Caisse rapide"},{id:"history",label:"Historique"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"8px 18px",borderRadius:99,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,
              background:tab===t.id?C.orange:C.bg, color:tab===t.id?"#fff":C.muted}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==="pos"&&<div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:20,alignItems:"start"}}>
        {/* Catalogue */}
        <div>
          <div style={{fontSize:13,fontWeight:700,color:C.muted,marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>Catalogue produits</div>
          {pLoad?<div style={{padding:32,textAlign:"center"}}><Spinner/></div>:
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
            {avail.map(p=>(
              <button key={p.id} onClick={()=>addToCart(p)}
                style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 10px",
                  cursor:"pointer",textAlign:"left",transition:"border-color .15s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.orange}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:4,lineClamp:2,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{p.name}</div>
                <div style={{fontSize:13,color:C.orange,fontWeight:700}}>{new Intl.NumberFormat("fr-FR").format(p.price)} F</div>
                {p.stock_quantity!=null&&p.stock_quantity<=5&&<div style={{fontSize:10,color:C.red,marginTop:3}}>Stock: {p.stock_quantity}</div>}
              </button>
            ))}
            {!avail.length&&<div className="empty">Aucun produit disponible</div>}
          </div>}
        </div>

        {/* Panier + paiement */}
        <div style={{position:"sticky",top:80}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,fontWeight:700,fontSize:14}}>🛒 Panier ({cart.length})</div>
            <div style={{maxHeight:260,overflowY:"auto"}}>
              {cart.length===0&&<div style={{padding:"24px",textAlign:"center",color:C.muted,fontSize:13}}>Ajoutez des produits</div>}
              {cart.map(x=>(
                <div key={x.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{flex:1,fontSize:13,fontWeight:600}}>{x.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <button onClick={()=>changeQty(x.id,-1)} style={{width:26,height:26,borderRadius:50,border:`1px solid ${C.border}`,background:C.bg,cursor:"pointer",fontWeight:700,fontSize:14}}>−</button>
                    <span style={{minWidth:20,textAlign:"center",fontWeight:700,fontSize:13}}>{x.qty}</span>
                    <button onClick={()=>changeQty(x.id,+1)} style={{width:26,height:26,borderRadius:50,border:`1px solid ${C.border}`,background:C.bg,cursor:"pointer",fontWeight:700,fontSize:14}}>+</button>
                  </div>
                  <div style={{fontSize:13,color:C.orange,fontWeight:700,minWidth:70,textAlign:"right"}}>{new Intl.NumberFormat("fr-FR").format(x.price*x.qty)} F</div>
                </div>
              ))}
            </div>
            <div style={{padding:"14px 18px",borderTop:`1px solid ${C.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:16,marginBottom:14}}>
                <span>Total</span><span style={{color:C.orange}}>{new Intl.NumberFormat("fr-FR").format(total)} F</span>
              </div>
              {/* Méthode de paiement */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11.5,fontWeight:600,color:C.muted,marginBottom:6,textTransform:"uppercase"}}>Paiement</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {PAY_METHODS.map(m=>(
                    <button key={m.id} onClick={()=>setPayMethod(m.id)}
                      style={{padding:"5px 11px",borderRadius:99,border:`1.5px solid ${payMethod===m.id?m.color:C.border}`,
                        background:payMethod===m.id?m.color+"22":"transparent",color:payMethod===m.id?m.color:C.muted,
                        fontSize:11.5,fontWeight:600,cursor:"pointer"}}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Note optionnelle */}
              <input placeholder="Note (optionnel)" value={note} onChange={e=>setNote(e.target.value)}
                style={{width:"100%",padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,marginBottom:12,color:C.text,outline:"none"}}/>
              <button className="btn btn-o" style={{width:"100%",justifyContent:"center",padding:12}} onClick={submitSale} disabled={!cart.length||saving}>
                {saving?<Spinner size={14} col="#fff"/>:`Enregistrer la vente`}
              </button>
              {cart.length>0&&<button style={{width:"100%",marginTop:8,background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer"}} onClick={()=>setCart([])}>Vider le panier</button>}
            </div>
          </div>
        </div>
      </div>}

      {tab==="history"&&<div>
        {history.length===0&&<div className="empty">Aucune vente enregistrée</div>}
        {history.map(s=>(
          <div key={s.id} className="ocard">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div>
                <span style={{fontWeight:700,fontSize:14}}>{new Intl.NumberFormat("fr-FR").format(s.total_amount)} F</span>
                <span style={{marginLeft:10,fontSize:11.5,color:C.muted}}>{fmtDate(s.created_at)}</span>
              </div>
              <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:99,background:C.orangePale,color:C.orange}}>{s.payment_method}</span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {s.items.map((it,i)=>(
                <span key={i} style={{fontSize:11.5,background:C.bg,borderRadius:99,padding:"3px 9px",color:C.text}}>{it.product_name} ×{it.quantity}</span>
              ))}
            </div>
            {s.note&&<div style={{fontSize:11.5,color:C.muted,marginTop:5}}>📝 {s.note}</div>}
          </div>
        ))}
      </div>}
    </div>
  );
}

const SCREENS=[
  {id:"dashboard", label:"Vue globale",    icon:"grid",    Comp:DashboardScreen},
  {id:"caisse",    label:"Suivi Caisse",   icon:"dollar",  Comp:CaissePageScreen},
  {id:"wallet",    label:"Wallet Manager", icon:"wallet",  Comp:WalletManagerScreen},
  {id:"kds",       label:"Cuisine (KDS)",  icon:"chef",    Comp:KDSScreen},
  {id:"pos",       label:"Caisse Rapide",  icon:"dollar",  Comp:POSScreen},
  {id:"menu",      label:"Menu & Produits",icon:"menu",    Comp:MenuScreen},
  {id:"stock",     label:"Stock",          icon:"box",     Comp:StockScreen},
  {id:"waiters",   label:"Serveurs",       icon:"users",   Comp:WaitersScreen},
  {id:"expenses",  label:"Dépenses",       icon:"minus",   Comp:ExpensesScreen},
  {id:"orders",    label:"Commandes",      icon:"check",   Comp:OrdersScreen},
  {id:"ardoise",   label:"Ardoise",        icon:"card",    Comp:ArdoiseScreen},
  {id:"finance",   label:"Finance IA",     icon:"chart",   Comp:FinanceScreen},
  {id:"admin",     label:"Vue Réseau",     icon:"grid",    Comp:SuperAdminScreen},
];
const TITLES={dashboard:"Vue d'ensemble",caisse:"Suivi Caisse",kds:"Cuisine - KDS",pos:"Caisse Rapide — POS",menu:"Menu & Produits",stock:"Gestion du stock",wallet:"Wallet Manager",waiters:"Equipe & Serveurs",expenses:"Depenses",orders:"Commandes",ardoise:"Ardoise / Crédit",finance:"Finance IA — Score bancaire",admin:"Vue Réseau — Super Admin"};

// ── REGISTER PAGE — onboarding gérant 3 étapes ───────────────────────────────
function RegisterPage({ onBack }) {
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    full_name:"", phone_number:"", password:"", password2:"",
    establishment_name:"", establishment_address:"", establishment_phone:"",
    establishment_type:"maquis", establishment_city:""
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const nextStep1 = () => {
    if(!form.full_name||!form.phone_number||!form.password) return setError("Tous les champs sont requis");
    if(form.password.length < 6) return setError("Mot de passe : 6 caractères minimum");
    if(form.password !== form.password2) return setError("Les mots de passe ne correspondent pas");
    setError(""); setStep(2);
  };

  const submit = async () => {
    if(!form.establishment_name) return setError("Nom de l’établissement requis");
    setError(""); setLoading(true);
    try {
      const { data } = await import("./api").then(m => m.authApi.register({
        full_name: form.full_name,
        phone_number: form.phone_number,
        password: form.password,
        establishment_name: form.establishment_name,
        establishment_address: form.establishment_address||undefined,
        establishment_phone: form.establishment_phone||undefined,
        establishment_type: form.establishment_type||"maquis",
        establishment_city: form.establishment_city||undefined,
      }));
      // Stocker le token + user directement
      localStorage.setItem("sokora_token", data.access_token);
      localStorage.setItem("sokora_user", JSON.stringify(data.user));
      localStorage.setItem("sokora_onboarding", "1");
      setStep(3);
    } catch(e) {
      setError(e.response?.data?.detail || "Erreur lors de l’inscription");
    } finally { setLoading(false); }
  };

  const finish = async () => {
    await login(form.phone_number, form.password).catch(()=>{});
  };

  const F = ({label,type="text",k,placeholder=""}) => (
    <div className="ig" style={{marginBottom:12}}>
      <label>{label}</label>
      <input type={type} placeholder={placeholder} value={form[k]} onChange={e=>set(k,e.target.value)}/>
    </div>
  );

  return (
    <div className="login-page">
      <div className="login-card" style={{maxWidth:420}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:7}}><Logo size={44}/></div>
        <div style={{fontFamily:"’Syne’,sans-serif",fontWeight:800,fontSize:20,color:C.text,margin:"12px 0 4px",textAlign:"center"}}>
          {step===3?"Bienvenue chez SOKORA 🎉":"Créer votre espace"}
        </div>
        <div style={{fontSize:12.5,color:C.muted,textAlign:"center",marginBottom:20}}>
          {step===1&&"Vos informations personnelles"}{step===2&&"Votre établissement"}{step===3&&"Votre essai de 14 jours commence maintenant"}
        </div>

        {step<3&&<div className="reg-steps">
          {[1,2].map(i=><div key={i} className={`reg-step${step>i?" done":step===i?" active":""}`}/>)}
        </div>}

        {error&&<div style={{background:"#fff0f0",border:`1px solid ${C.red}44`,color:C.red,borderRadius:8,padding:"9px 13px",fontSize:12,marginBottom:14,textAlign:"center"}}>{error}</div>}

        {step===1&&<>
          <F label="Votre nom complet" k="full_name" placeholder="Jean Kouassi"/>
          <F label="Numéro de téléphone" type="tel" k="phone_number" placeholder="0700000000"/>
          <F label="Mot de passe" type="password" k="password" placeholder="6 caractères minimum"/>
          <F label="Confirmer le mot de passe" type="password" k="password2" placeholder=""/>
          <button className="btn btn-o" style={{width:"100%",justifyContent:"center",padding:12,marginTop:8}} onClick={nextStep1}>Étape suivante →</button>
          <div style={{textAlign:"center",marginTop:16,fontSize:12.5,color:C.muted}}>
            Déjà un compte ?&nbsp;<span style={{color:C.orange,cursor:"pointer",fontWeight:600}} onClick={onBack}>Se connecter</span>
          </div>
        </>}

        {step===2&&<>
          <div className="ig" style={{marginBottom:12}}>
            <label>Type d’établissement</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
              {[
                {k:"maquis",    label:"🍖 Maquis"},
                {k:"bar",       label:"🍺 Bar / Club"},
                {k:"restaurant",label:"🍽️ Restaurant"},
                {k:"hotel",     label:"🏨 Hôtel"},
                {k:"voyage",    label:"🚌 Transport / Voyage"},
              ].map(t=>(
                <div key={t.k} onClick={()=>set("establishment_type",t.k)} style={{
                  padding:"10px 12px",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:600,
                  border:`2px solid ${form.establishment_type===t.k?C.orange:C.border}`,
                  background:form.establishment_type===t.k?C.orange+"15":C.bg,
                  color:form.establishment_type===t.k?C.orange:C.text,
                  textAlign:"center",transition:"all .15s",
                }}>{t.label}</div>
              ))}
            </div>
          </div>
          <F label="Nom de l’établissement" k="establishment_name" placeholder="Restaurant Le Baobab"/>
          <F label="Ville" k="establishment_city" placeholder="Abidjan, Bouaké..."/>
          <F label="Adresse (optionnel)" k="establishment_address" placeholder="Rue des Jardins, Abidjan"/>
          <F label="Téléphone établissement (optionnel)" type="tel" k="establishment_phone" placeholder="0700000000"/>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button className="btn" style={{flex:1,justifyContent:"center",padding:12,background:C.bg,color:C.text}} onClick={()=>setStep(1)}>← Retour</button>
            <button className="btn btn-o" style={{flex:2,justifyContent:"center",padding:12}} onClick={submit} disabled={loading}>
              {loading?<Spinner size={15} col="#fff"/>:"Créer mon espace →"}
            </button>
          </div>
        </>}

        {step===3&&<>
          <div style={{background:C.bg,borderRadius:14,padding:"18px 20px",marginBottom:20}}>
            <div style={{fontWeight:700,color:C.text,marginBottom:12,fontSize:13}}>✅ Votre espace est prêt !</div>
            {[
              {icon:"🍽️",label:"Ajoutez vos catégories et produits au menu"},
              {icon:"🪑",label:"Configurez vos tables ou zones de service"},
              {icon:"📱",label:"Partagez le QR code de votre établissement"},
              {icon:"👥",label:"Invitez votre équipe (serveurs, caissiers)"},
            ].map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,fontSize:13,color:C.text,padding:"7px 0",borderBottom:i<3?`1px solid ${C.border}`:undefined}}>
                <span style={{fontSize:17}}>{s.icon}</span>{s.label}
              </div>
            ))}
          </div>
          <div style={{fontSize:11.5,color:C.muted,textAlign:"center",marginBottom:18}}>
            🎁 Essai gratuit de <strong>14 jours</strong> — aucune carte bancaire requise
          </div>
          <button className="btn btn-o" style={{width:"100%",justifyContent:"center",padding:14,fontSize:15}} onClick={finish} disabled={loading}>
            {loading?<Spinner size={15} col="#fff"/>:"Accéder à mon tableau de bord →"}
          </button>
        </>}
      </div>
    </div>
  );
}

function LoginPage({ onRegister }) {
  const {login}=useAuth();
  const [phone,setPhone]=useState("");
  const [pass,setPass]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const handleSubmit=async(e)=>{
    e.preventDefault();
    if(!phone||!pass){setError("Veuillez remplir tous les champs");return;}
    setLoading(true);setError("");
    try{await login(phone,pass);}
    catch(err){setError(err.response?.data?.detail||"Identifiants incorrects");}
    finally{setLoading(false);}
  };
  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{display:"flex",justifyContent:"center",marginBottom:7}}><Logo size={48}/></div>
        <div style={{fontFamily:"’Syne’,sans-serif",fontWeight:800,fontSize:22,color:C.text,margin:"16px 0 5px",textAlign:"center",letterSpacing:"-.5px"}}>Espace gérant</div>
        <div style={{fontSize:12.5,color:C.muted,textAlign:"center",marginBottom:28,fontWeight:500}}>Connectez-vous à votre tableau de bord</div>
        {error&&<div style={{background:"#fff0f0",border:`1px solid ${C.red}44`,color:C.red,borderRadius:8,padding:"9px 13px",fontSize:12,marginBottom:14,textAlign:"center"}}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="ig" style={{marginBottom:12}}><label>Numéro de téléphone</label><input type="tel" placeholder="0700000000" value={phone} onChange={e=>setPhone(e.target.value)} autoFocus/></div>
          <div className="ig" style={{marginBottom:20}}><label>Mot de passe</label><input type="password" placeholder="" value={pass} onChange={e=>setPass(e.target.value)}/></div>
          <button type="submit" className="btn btn-o" style={{width:"100%",justifyContent:"center",padding:12}} disabled={loading}>{loading?<Spinner size={15} col="#fff"/>:"Se connecter"}</button>
        </form>
        <div style={{textAlign:"center",marginTop:20,fontSize:12.5,color:C.muted}}>
          Nouveau sur SOKORA ?&nbsp;<span style={{color:C.orange,cursor:"pointer",fontWeight:600}} onClick={onRegister}>Créer mon espace gratuit</span>
        </div>
      </div>
    </div>
  );
}

// ── ONBOARDING CHECKLIST (affiché dans le dashboard pour les nouveaux gérants) ─
const ONB_STEPS = [
  { id:"menu",   icon:"🍽️", label:"Créer le menu",        hint:"Ajoutez catégories et produits",          screen:"menu"      },
  { id:"tables", icon:"🪑", label:"Configurer les tables", hint:"Définissez vos tables ou comptoirs",       screen:"tables"    },
  { id:"staff",  icon:"👥", label:"Inviter l'équipe",      hint:"Ajoutez vos serveurs et caissiers",        screen:"staff"     },
  { id:"qr",     icon:"📱", label:"Afficher les QR codes", hint:"Imprimez les QR de commande client",       screen:"tables"    },
];
function OnboardingBanner({ onNavigate }) {
  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sokora_onb_done")||"[]"); } catch { return []; }
  });
  const [hidden, setHidden] = useState(false);
  if(hidden || done.length >= ONB_STEPS.length) return null;

  const toggle = (id) => {
    const next = done.includes(id) ? done.filter(x=>x!==id) : [...done, id];
    setDone(next);
    localStorage.setItem("sokora_onb_done", JSON.stringify(next));
  };

  return (
    <div className="onb-banner">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <div className="onb-title">🚀 Configurez votre espace SOKORA</div>
          <div className="onb-sub">{done.length}/{ONB_STEPS.length} étapes complétées · Essai 14 jours actif</div>
        </div>
        <button style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:18,lineHeight:1}} onClick={()=>{setHidden(true);localStorage.setItem("sokora_onboarding","done");}}>✕</button>
      </div>
      <div style={{background:"#e6ecf7",borderRadius:99,height:4,margin:"0 0 16px",overflow:"hidden"}}>
        <div style={{height:"100%",background:C.orange,width:`${(done.length/ONB_STEPS.length)*100}%`,transition:"width .4s",borderRadius:99}}/>
      </div>
      <div className="onb-steps">
        {ONB_STEPS.map(s=>(
          <div key={s.id} className={`onb-item${done.includes(s.id)?" done":""}`} onClick={()=>{ onNavigate(s.screen); if(!done.includes(s.id)) toggle(s.id); }}>
            <div className={`onb-check${done.includes(s.id)?" ok":""}`}>{done.includes(s.id)?"✓":""}</div>
            <span style={{fontSize:16}}>{s.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13}}>{s.label}</div>
              <div style={{fontSize:11.5,color:C.muted}}>{s.hint}</div>
            </div>
            <span style={{color:C.orange,fontSize:12,fontWeight:600}}>→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const {user,logout}=useAuth();
  const [screen,setScreen]=useState("dashboard");
  const showOnboarding = localStorage.getItem("sokora_onboarding")==="1";
  const {Comp}=SCREENS.find(s=>s.id===screen)||SCREENS[0];
  return (
    <div className="app">
      <aside className="sb">
        <div className="sb-logo"><Logo size={30}/><div className="sb-tag">Espace gérant</div></div>
        <div className="sb-sect">Navigation</div>
        <nav className="sb-nav">
          {SCREENS.filter(s=>s.id!=="admin"||user?.role==="SUPER_ADMIN").map(s=>(
            <button key={s.id} className={`ni ${screen===s.id?"on":""}`} onClick={()=>setScreen(s.id)}>
              <Ic n={s.icon} sz={15} col={screen===s.id?"#fff":"rgba(255,255,255,.45)"}/>{s.label}
            </button>
          ))}
        </nav>
        <div className="sb-foot">
          <Logo size={20} text={false}/>
          <strong>{user?.full_name||"Gérant"}</strong>
          <p>{user?.phone_number}</p>
          <span className="trial">v Trial actif</span>
          <button onClick={logout} style={{marginTop:10,width:"100%",display:"flex",alignItems:"center",gap:6,padding:"8px 10px",borderRadius:8,border:"none",background:"rgba(232,64,64,.12)",color:"#e84040",cursor:"pointer",fontSize:12,fontWeight:600}}>
            <Ic n="logout" sz={13} col="#e84040"/>Déconnexion
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="tb-title">{TITLES[screen]}</div>
          <div className="tb-r">
            <div className="live"><span className="dot"/>En direct</div>
            <button className="uavatar" onClick={logout} title="Déconnexion"><Ic n="logout" sz={15} col="#fff"/></button>
          </div>
        </div>
        <div className="content">
          {showOnboarding && screen==="dashboard" && <OnboardingBanner onNavigate={setScreen}/>}
          <Comp/>
        </div>
      </main>
      <VoiceAssistant screen={screen}/>
    </div>
  );
}

function AppContent() {
  const {user,loading}=useAuth();
  const [mode,setMode]=useState("login"); // "login" | "register"
  if(loading) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:C.navy,gap:22}}>
      <Logo size={48}/><Spinner size={28} col="#fff"/>
    </div>
  );
  if(user) return <Dashboard/>;
  if(mode==="register") return <RegisterPage onBack={()=>setMode("login")}/>;
  return <LoginPage onRegister={()=>setMode("register")}/>;
}

export default function App() {
  return (
    <AuthProvider>
      <style>{css}</style>
      <AppContent/>
    </AuthProvider>
  );
}
