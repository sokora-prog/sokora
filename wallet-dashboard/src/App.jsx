import React, { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Wallet, Users, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft,
  Shield, Star, CreditCard, Activity, Bell, Search, Filter,
  ChevronRight, RefreshCw, Download, Eye, EyeOff, MoreVertical,
  CheckCircle, XCircle, Clock, AlertTriangle, Zap, Globe, Lock
} from 'lucide-react'

// ─── DATA ────────────────────────────────────────────────────────────────────

const volumeData = [
  { month: 'Oct', entrants: 4200000, sortants: 3100000, net: 1100000 },
  { month: 'Nov', entrants: 5800000, sortants: 4200000, net: 1600000 },
  { month: 'Déc', entrants: 7200000, sortants: 5100000, net: 2100000 },
  { month: 'Jan', entrants: 6100000, sortants: 4800000, net: 1300000 },
  { month: 'Fév', entrants: 8300000, sortants: 5900000, net: 2400000 },
  { month: 'Mar', entrants: 9700000, sortants: 6400000, net: 3300000 },
  { month: 'Avr', entrants: 11200000, sortants: 7200000, net: 4000000 },
]

const txTypeData = [
  { name: 'Dépôt', value: 38, color: '#0D9488' },
  { name: 'Retrait', value: 22, color: '#F97316' },
  { name: 'Transfert', value: 28, color: '#3B82F6' },
  { name: 'Paiement', value: 12, color: '#F59E0B' },
]

const dailyTxData = [
  { day: 'Lun', count: 842 },
  { day: 'Mar', count: 1203 },
  { day: 'Mer', count: 987 },
  { day: 'Jeu', count: 1456 },
  { day: 'Ven', count: 1789 },
  { day: 'Sam', count: 2103 },
  { day: 'Dim', count: 1342 },
]

const wallets = [
  {
    id: 'WLT-001',
    owner: 'Amadou Diallo',
    email: 'amadou.diallo@email.com',
    phone: '+221 77 123 4567',
    tier: 'BLACK',
    balance: 4750000,
    currency: 'XOF',
    status: 'active',
    txCount: 342,
    joined: '2024-03-15',
    country: 'SN',
    flag: '🇸🇳',
    kycLevel: 3,
    lastActivity: 'Il y a 2h',
    monthlyVolume: 1200000,
  },
  {
    id: 'WLT-002',
    owner: 'Fatou Traoré',
    email: 'fatou.traore@email.com',
    phone: '+225 07 456 7890',
    tier: 'PREMIUM',
    balance: 1280000,
    currency: 'XOF',
    status: 'active',
    txCount: 187,
    joined: '2024-06-22',
    country: 'CI',
    flag: '🇨🇮',
    kycLevel: 2,
    lastActivity: 'Il y a 30min',
    monthlyVolume: 680000,
  },
  {
    id: 'WLT-003',
    owner: 'Kofi Mensah',
    email: 'kofi.mensah@email.com',
    phone: '+233 24 789 0123',
    tier: 'STANDARD',
    balance: 87500,
    currency: 'XOF',
    status: 'frozen',
    txCount: 54,
    joined: '2024-09-10',
    country: 'GH',
    flag: '🇬🇭',
    kycLevel: 1,
    lastActivity: 'Il y a 5j',
    monthlyVolume: 95000,
  },
  {
    id: 'WLT-004',
    owner: 'Aïssatou Bah',
    email: 'aissatou.bah@email.com',
    phone: '+224 62 234 5678',
    tier: 'BLACK',
    balance: 9320000,
    currency: 'XOF',
    status: 'active',
    txCount: 521,
    joined: '2023-11-08',
    country: 'GN',
    flag: '🇬🇳',
    kycLevel: 3,
    lastActivity: 'Il y a 15min',
    monthlyVolume: 3400000,
  },
  {
    id: 'WLT-005',
    owner: 'Ibrahim Coulibaly',
    email: 'ibrahim.coulibaly@email.com',
    phone: '+223 76 345 6789',
    tier: 'PREMIUM',
    balance: 534000,
    currency: 'XOF',
    status: 'pending',
    txCount: 23,
    joined: '2025-01-30',
    country: 'ML',
    flag: '🇲🇱',
    kycLevel: 1,
    lastActivity: 'Il y a 1j',
    monthlyVolume: 210000,
  },
  {
    id: 'WLT-006',
    owner: 'Marie-Claire Zongo',
    email: 'marieclaire.zongo@email.com',
    phone: '+226 70 456 7890',
    tier: 'STANDARD',
    balance: 215000,
    currency: 'XOF',
    status: 'active',
    txCount: 98,
    joined: '2024-07-14',
    country: 'BF',
    flag: '🇧🇫',
    kycLevel: 2,
    lastActivity: 'Il y a 4h',
    monthlyVolume: 320000,
  },
]

const transactions = [
  {
    id: 'TX-2025-04-001',
    type: 'depot',
    from: 'Orange Money SN',
    to: 'WLT-001 (Amadou Diallo)',
    amount: 500000,
    fee: 2500,
    status: 'completed',
    date: '2025-04-07 09:14',
    ref: 'OM-SN-887432',
    channel: 'Mobile Money',
  },
  {
    id: 'TX-2025-04-002',
    type: 'transfert',
    from: 'WLT-004 (Aïssatou Bah)',
    to: 'WLT-002 (Fatou Traoré)',
    amount: 150000,
    fee: 750,
    status: 'completed',
    date: '2025-04-07 08:52',
    ref: 'SOKORA-INT-5521',
    channel: 'Interne',
  },
  {
    id: 'TX-2025-04-003',
    type: 'retrait',
    from: 'WLT-002 (Fatou Traoré)',
    to: 'Wave CI',
    amount: 80000,
    fee: 400,
    status: 'pending',
    date: '2025-04-07 08:30',
    ref: 'WAVE-CI-334891',
    channel: 'Mobile Money',
  },
  {
    id: 'TX-2025-04-004',
    type: 'paiement',
    from: 'WLT-001 (Amadou Diallo)',
    to: 'Boutique Dakar Chic',
    amount: 125000,
    fee: 1875,
    status: 'completed',
    date: '2025-04-07 07:18',
    ref: 'POS-DCH-00219',
    channel: 'QR Code',
  },
  {
    id: 'TX-2025-04-005',
    type: 'depot',
    from: 'MTN MoMo GH',
    to: 'WLT-003 (Kofi Mensah)',
    amount: 45000,
    fee: 225,
    status: 'failed',
    date: '2025-04-06 22:45',
    ref: 'MTN-GH-776123',
    channel: 'Mobile Money',
  },
  {
    id: 'TX-2025-04-006',
    type: 'transfert',
    from: 'WLT-004 (Aïssatou Bah)',
    to: 'WLT-006 (Marie-Claire Zongo)',
    amount: 200000,
    fee: 1000,
    status: 'completed',
    date: '2025-04-06 18:22',
    ref: 'SOKORA-INT-5498',
    channel: 'Interne',
  },
  {
    id: 'TX-2025-04-007',
    type: 'retrait',
    from: 'WLT-004 (Aïssatou Bah)',
    to: 'Coris Bank GN',
    amount: 1000000,
    fee: 5000,
    status: 'processing',
    date: '2025-04-06 15:10',
    ref: 'CORIS-GN-10045',
    channel: 'Virement Bancaire',
  },
  {
    id: 'TX-2025-04-008',
    type: 'paiement',
    from: 'WLT-006 (Marie-Claire Zongo)',
    to: 'Pharmacie du Progrès',
    amount: 18500,
    fee: 278,
    status: 'completed',
    date: '2025-04-06 12:05',
    ref: 'POS-PHR-00087',
    channel: 'NFC',
  },
]

const alerts = [
  {
    id: 1,
    type: 'critical',
    title: 'Tentative de fraude détectée',
    detail: 'WLT-003 (Kofi Mensah) — 3 tentatives de retrait inhabituelles en 10 min depuis IP 105.112.44.87 (Lagos, NG)',
    time: 'Il y a 5 min',
    action: 'Wallet gelé automatiquement',
  },
  {
    id: 2,
    type: 'warning',
    title: 'Volume anormal',
    detail: 'WLT-004 (Aïssatou Bah) — Volume journalier 340% au-dessus de la moyenne (3 400 000 XOF vs moy. 780 000 XOF)',
    time: 'Il y a 1h',
    action: 'Révision KYC recommandée',
  },
  {
    id: 3,
    type: 'info',
    title: 'KYC en attente',
    detail: 'WLT-005 (Ibrahim Coulibaly) — Documents soumis, en attente de validation niveau 2',
    time: 'Il y a 6h',
    action: 'Vérifier documents',
  },
  {
    id: 4,
    type: 'warning',
    title: 'Transaction en attente prolongée',
    detail: 'TX-2025-04-003 — Retrait Wave CI de 80 000 XOF en attente depuis +30 min',
    time: 'Il y a 30 min',
    action: 'Relancer le prestataire',
  },
  {
    id: 5,
    type: 'info',
    title: 'Limite mensuelle approchée',
    detail: 'WLT-002 (Fatou Traoré) — 91% de la limite mensuelle PREMIUM atteinte (612 000 / 670 000 XOF)',
    time: 'Il y a 2h',
    action: 'Notifier le client',
  },
]

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 })
    .format(n)

const fmtShort = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

const TIER_STYLES = {
  BLACK: 'bg-gradient-to-r from-gray-800 to-gray-900 text-amber-400 border border-amber-500/30',
  PREMIUM: 'bg-gradient-to-r from-sokora-teal/20 to-teal-900/30 text-teal-300 border border-teal-500/30',
  STANDARD: 'bg-sokora-navy-light text-gray-300 border border-gray-600/30',
}

const STATUS_STYLES = {
  active: 'bg-emerald-500/10 text-emerald-400',
  frozen: 'bg-blue-500/10 text-blue-400',
  pending: 'bg-amber-500/10 text-amber-400',
  suspended: 'bg-red-500/10 text-red-400',
}

const TX_TYPE_STYLES = {
  depot: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: ArrowDownLeft, label: 'Dépôt' },
  retrait: { color: 'text-red-400', bg: 'bg-red-500/10', icon: ArrowUpRight, label: 'Retrait' },
  transfert: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: RefreshCw, label: 'Transfert' },
  paiement: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: CreditCard, label: 'Paiement' },
}

const TX_STATUS_STYLES = {
  completed: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle, label: 'Complété' },
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock, label: 'En attente' },
  processing: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: RefreshCw, label: 'Traitement' },
  failed: { color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle, label: 'Échoué' },
}

const ALERT_STYLES = {
  critical: { border: 'border-red-500/40', bg: 'bg-red-500/5', icon: XCircle, color: 'text-red-400', dot: 'bg-red-500' },
  warning: { border: 'border-amber-500/40', bg: 'bg-amber-500/5', icon: AlertTriangle, color: 'text-amber-400', dot: 'bg-amber-500' },
  info: { border: 'border-blue-500/40', bg: 'bg-blue-500/5', icon: Bell, color: 'text-blue-400', dot: 'bg-blue-500' },
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, trend, color = 'orange' }) {
  const colors = {
    orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/20',
    teal: 'from-teal-500/20 to-teal-600/5 border-teal-500/20',
    gold: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
  }
  const iconColors = {
    orange: 'bg-orange-500/20 text-orange-400',
    teal: 'bg-teal-500/20 text-teal-400',
    gold: 'bg-amber-500/20 text-amber-400',
    purple: 'bg-purple-500/20 text-purple-400',
  }
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-5 card-hover`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${iconColors[color]}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <span className={`stat-badge ${trend >= 0 ? 'stat-badge-green' : 'stat-badge-red'}`}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-gray-400 text-xs font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-sokora-navy-card border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-gray-400 text-xs mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="text-sm font-semibold">
          {p.name}: {fmtShort(p.value)} XOF
        </p>
      ))}
    </div>
  )
}

// ─── TAB 1: OVERVIEW ─────────────────────────────────────────────────────────

function TabOverview() {
  return (
    <div className="space-y-6 slide-in">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Volume Total Wallets" value="28.4M XOF" sub="Encours consolidé" trend={12} color="orange" />
        <StatCard icon={Users} label="Wallets Actifs" value="4 812" sub="Sur 5 234 total" trend={8} color="teal" />
        <StatCard icon={TrendingUp} label="Flux Entrants (Avr)" value="11.2M XOF" sub="vs 9.7M mars (+15%)" trend={15} color="gold" />
        <StatCard icon={Activity} label="Transactions/Jour" value="1 674" sub="Moyenne 7 derniers jours" trend={-3} color="purple" />
      </div>

      {/* Volume Chart */}
      <div className="bg-sokora-navy-card border border-white/8 rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-semibold">Flux de Trésorerie</h3>
            <p className="text-gray-500 text-xs">Entrants vs Sortants — 7 derniers mois (XOF)</p>
          </div>
          <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-sokora-navy-light px-3 py-1.5 rounded-lg transition-colors">
            <Download size={13} /> Exporter
          </button>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={volumeData}>
            <defs>
              <linearGradient id="gradEntrants" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSortants" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A2B45" />
            <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtShort(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px', color: '#9CA3AF' }} />
            <Area type="monotone" dataKey="entrants" name="Entrants" stroke="#0D9488" fill="url(#gradEntrants)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="sortants" name="Sortants" stroke="#F97316" fill="url(#gradSortants)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Two bottom charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie chart */}
        <div className="bg-sokora-navy-card border border-white/8 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-1">Répartition par Type</h3>
          <p className="text-gray-500 text-xs mb-4">% des transactions ce mois</p>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={txTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {txTypeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#162236', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 min-w-[120px]">
              {txTypeData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-400 text-xs">{d.name}</span>
                  <span className="text-white text-xs font-semibold ml-auto">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily bar chart */}
        <div className="bg-sokora-navy-card border border-white/8 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-1">Transactions par Jour</h3>
          <p className="text-gray-500 text-xs mb-4">Volume cette semaine</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyTxData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A2B45" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#162236', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              <Bar dataKey="count" name="Transactions" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── TAB 2: WALLETS ──────────────────────────────────────────────────────────

function TabWallets() {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('ALL')
  const [showBalance, setShowBalance] = useState(true)
  const [selected, setSelected] = useState(null)

  const filtered = wallets.filter(w => {
    const matchSearch = w.owner.toLowerCase().includes(search.toLowerCase()) ||
      w.id.toLowerCase().includes(search.toLowerCase()) ||
      w.phone.includes(search)
    const matchTier = tierFilter === 'ALL' || w.tier === tierFilter
    return matchSearch && matchTier
  })

  return (
    <div className="space-y-5 slide-in">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, ID, téléphone…"
            className="w-full bg-sokora-navy-card border border-white/8 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-sokora-orange/50"
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'BLACK', 'PREMIUM', 'STANDARD'].map(t => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tierFilter === t
                  ? 'bg-sokora-orange text-white'
                  : 'bg-sokora-navy-card border border-white/8 text-gray-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-2.5 bg-sokora-navy-card border border-white/8 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            {showBalance ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-sokora-navy-card border border-white/8 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">WALLET / CLIENT</th>
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">TIER</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">SOLDE</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">TX</th>
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">STATUT</th>
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">KYC</th>
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">ACTIVITÉ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => (
                <tr
                  key={w.id}
                  onClick={() => setSelected(selected?.id === w.id ? null : w)}
                  className={`border-b border-white/5 cursor-pointer transition-colors ${
                    selected?.id === w.id ? 'bg-sokora-orange/5' : 'hover:bg-white/3'
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sokora-orange/30 to-teal-500/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {w.flag}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{w.owner}</p>
                        <p className="text-gray-500 text-xs">{w.id} · {w.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TIER_STYLES[w.tier]}`}>
                      {w.tier === 'BLACK' && '★ '}{w.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-white text-sm font-semibold">
                      {showBalance ? fmt(w.balance) : '••••••'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-gray-300 text-sm">{w.txCount}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[w.status]}`}>
                      {w.status === 'active' ? 'Actif' : w.status === 'frozen' ? 'Gelé' : w.status === 'pending' ? 'En attente' : 'Suspendu'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1">
                      {[1, 2, 3].map(l => (
                        <div
                          key={l}
                          className={`w-4 h-1.5 rounded-full ${l <= w.kycLevel ? 'bg-sokora-teal' : 'bg-white/10'}`}
                        />
                      ))}
                    </div>
                    <p className="text-gray-600 text-xs mt-0.5">Niv. {w.kycLevel}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-gray-400 text-xs">{w.lastActivity}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <button className="text-gray-500 hover:text-white transition-colors">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="bg-sokora-navy-card border border-sokora-orange/20 rounded-xl p-5 slide-in">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sokora-orange/30 to-teal-500/20 flex items-center justify-center text-2xl">
                {selected.flag}
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">{selected.owner}</h3>
                <p className="text-gray-500 text-sm">{selected.email}</p>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white">
              <XCircle size={20} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-sokora-navy rounded-lg p-3">
              <p className="text-gray-500 text-xs">Solde actuel</p>
              <p className="text-sokora-orange font-bold text-lg">{fmt(selected.balance)}</p>
            </div>
            <div className="bg-sokora-navy rounded-lg p-3">
              <p className="text-gray-500 text-xs">Volume mensuel</p>
              <p className="text-white font-semibold">{fmt(selected.monthlyVolume)}</p>
            </div>
            <div className="bg-sokora-navy rounded-lg p-3">
              <p className="text-gray-500 text-xs">Transactions</p>
              <p className="text-white font-semibold">{selected.txCount} tx</p>
            </div>
            <div className="bg-sokora-navy rounded-lg p-3">
              <p className="text-gray-500 text-xs">Membre depuis</p>
              <p className="text-white font-semibold">{selected.joined}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="flex-1 py-2 bg-sokora-teal/20 text-teal-300 border border-teal-500/30 rounded-lg text-sm font-medium hover:bg-sokora-teal/30 transition-colors">
              Voir historique
            </button>
            <button className="flex-1 py-2 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors">
              {selected.status === 'frozen' ? 'Dégeler' : 'Geler'} le wallet
            </button>
            <button className="flex-1 py-2 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-lg text-sm font-medium hover:bg-blue-500/20 transition-colors">
              Valider KYC
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB 3: TRANSACTIONS ─────────────────────────────────────────────────────

function TabTransactions() {
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const filtered = transactions.filter(tx => {
    const matchType = typeFilter === 'ALL' || tx.type === typeFilter
    const matchStatus = statusFilter === 'ALL' || tx.status === statusFilter
    return matchType && matchStatus
  })

  return (
    <div className="space-y-5 slide-in">
      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Volume total (Avr)', value: '11.2M XOF', color: 'text-teal-400' },
          { label: 'Transactions complétées', value: '5 / 8', color: 'text-emerald-400' },
          { label: 'En attente / traitement', value: '2', color: 'text-amber-400' },
          { label: 'Échouées', value: '1', color: 'text-red-400' },
        ].map((s, i) => (
          <div key={i} className="bg-sokora-navy-card border border-white/8 rounded-xl px-4 py-3">
            <p className="text-gray-500 text-xs">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {['ALL', 'depot', 'retrait', 'transfert', 'paiement'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                typeFilter === t
                  ? 'bg-sokora-orange text-white'
                  : 'bg-sokora-navy-card border border-white/8 text-gray-400 hover:text-white'
              }`}
            >
              {t === 'ALL' ? 'Tous types' : TX_TYPE_STYLES[t]?.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['ALL', 'completed', 'pending', 'processing', 'failed'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-sokora-navy-light border border-sokora-orange/50 text-sokora-orange'
                  : 'bg-sokora-navy-card border border-white/8 text-gray-400 hover:text-white'
              }`}
            >
              {s === 'ALL' ? 'Tous statuts' : TX_STATUS_STYLES[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions list */}
      <div className="space-y-2.5">
        {filtered.map(tx => {
          const typeStyle = TX_TYPE_STYLES[tx.type]
          const statusStyle = TX_STATUS_STYLES[tx.status]
          const TypeIcon = typeStyle.icon
          const StatusIcon = statusStyle.icon
          return (
            <div key={tx.id} className="bg-sokora-navy-card border border-white/8 rounded-xl p-4 card-hover">
              <div className="flex items-center gap-4">
                {/* Type icon */}
                <div className={`p-2.5 rounded-lg ${typeStyle.bg} flex-shrink-0`}>
                  <TypeIcon size={18} className={typeStyle.color} />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.color}`}>
                      {typeStyle.label}
                    </span>
                    <span className="text-gray-600 text-xs">{tx.id}</span>
                  </div>
                  <p className="text-gray-400 text-xs truncate">
                    <span className="text-gray-300">{tx.from}</span>
                    <ChevronRight size={11} className="inline mx-1" />
                    <span className="text-gray-300">{tx.to}</span>
                  </p>
                  <p className="text-gray-600 text-xs mt-0.5">Réf: {tx.ref} · Canal: {tx.channel}</p>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-base font-bold ${typeStyle.color}`}>
                    {tx.type === 'depot' ? '+' : '-'}{fmt(tx.amount)}
                  </p>
                  <p className="text-gray-600 text-xs">Frais: {fmt(tx.fee)}</p>
                </div>

                {/* Status & date */}
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.color}`}>
                    <StatusIcon size={12} />
                    {statusStyle.label}
                  </div>
                  <p className="text-gray-600 text-xs mt-1">{tx.date}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── TAB 4: SÉCURITÉ & ALERTES ───────────────────────────────────────────────

function TabSecurity() {
  const criticalCount = alerts.filter(a => a.type === 'critical').length
  const warningCount = alerts.filter(a => a.type === 'warning').length
  const infoCount = alerts.filter(a => a.type === 'info').length

  const securityMetrics = [
    { label: 'Taux de fraude', value: '0.08%', sub: 'En dessous du seuil (0.5%)', icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Transactions bloquées', value: '14', sub: 'Ce mois — Score risque élevé', icon: Lock, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'KYC en attente', value: '23', sub: 'Délai moyen: 48h', icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Uptime Système', value: '99.97%', sub: 'SLA: 99.9% — Respecté', icon: Zap, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { label: 'Pays actifs', value: '6', sub: 'SN, CI, GH, GN, ML, BF', icon: Globe, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Score conformité', value: '94/100', sub: 'BCEAO — Excellent', icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ]

  return (
    <div className="space-y-6 slide-in">
      {/* Alert summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-400">{criticalCount}</p>
          <p className="text-gray-400 text-xs mt-1">Alertes critiques</p>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-400">{warningCount}</p>
          <p className="text-gray-400 text-xs mt-1">Avertissements</p>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{infoCount}</p>
          <p className="text-gray-400 text-xs mt-1">Informations</p>
        </div>
      </div>

      {/* Security Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {securityMetrics.map((m, i) => {
          const Icon = m.icon
          return (
            <div key={i} className={`${m.bg} border border-white/8 rounded-xl p-4 card-hover`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className={m.color} />
                <p className="text-gray-400 text-xs">{m.label}</p>
              </div>
              <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-gray-600 text-xs mt-0.5">{m.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Alerts list */}
      <div>
        <h3 className="text-white font-semibold mb-3">Alertes Actives</h3>
        <div className="space-y-3">
          {alerts.map(alert => {
            const style = ALERT_STYLES[alert.type]
            const Icon = style.icon
            return (
              <div key={alert.id} className={`${style.bg} border ${style.border} rounded-xl p-4`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="relative">
                      <Icon size={18} className={style.color} />
                      {alert.type === 'critical' && (
                        <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 ${style.dot} rounded-full pulse-orange`} />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm font-semibold ${style.color}`}>{alert.title}</p>
                      <span className="text-gray-600 text-xs">{alert.time}</span>
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed">{alert.detail}</p>
                    <div className="mt-2">
                      <button className={`text-xs font-medium px-3 py-1 rounded-lg border ${style.border} ${style.color} hover:opacity-80 transition-opacity`}>
                        {alert.action}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Compliance footer */}
      <div className="bg-sokora-navy-card border border-white/8 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-sokora-teal" />
          <h3 className="text-white font-semibold">Conformité BCEAO / UEMOA</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Limites de transaction', detail: 'Max 1 000 000 XOF/tx — Standard | 5 000 000 XOF/tx — BLACK', ok: true },
            { label: 'KYC obligatoire', detail: 'Niveau 1 requis pour activation — Niveau 3 pour volumes > 2M XOF/mois', ok: true },
            { label: 'Reporting CENTIF', detail: 'Rapport mensuel généré automatiquement — Dernier: Mars 2025', ok: true },
            { label: 'Audit trail', detail: 'Toutes les transactions archivées 5 ans — Chiffrement AES-256', ok: true },
            { label: 'Gel OFAC/UN Sanctions', detail: 'Screening temps réel actif — 0 correspondance ce mois', ok: true },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle size={15} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white text-sm font-medium">{item.label}</p>
                <p className="text-gray-500 text-xs">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: Activity },
  { id: 'wallets', label: 'Wallets', icon: Wallet },
  { id: 'transactions', label: 'Transactions', icon: CreditCard },
  { id: 'security', label: 'Sécurité & Alertes', icon: Shield },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [notifOpen, setNotifOpen] = useState(false)
  const criticalAlerts = alerts.filter(a => a.type === 'critical').length

  return (
    <div className="min-h-screen bg-sokora-navy font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-sokora-navy/95 backdrop-blur border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sokora-orange to-sokora-orange-light flex items-center justify-center">
              <Wallet size={18} className="text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-lg leading-none">SOKORA</span>
              <p className="text-gray-500 text-xs leading-none">Wallet Manager</p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Live badge */}
            <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full pulse-orange" />
              <span className="text-emerald-400 text-xs font-medium">Système opérationnel</span>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 bg-sokora-navy-card border border-white/8 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <Bell size={18} />
                {criticalAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                    {criticalAlerts}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-80 bg-sokora-navy-card border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/8">
                    <p className="text-white font-semibold text-sm">Alertes récentes</p>
                  </div>
                  {alerts.slice(0, 3).map(a => {
                    const style = ALERT_STYLES[a.type]
                    return (
                      <div key={a.id} className={`px-4 py-3 border-b border-white/5 ${style.bg}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          <p className={`text-xs font-semibold ${style.color}`}>{a.title}</p>
                        </div>
                        <p className="text-gray-500 text-xs pl-3.5">{a.time}</p>
                      </div>
                    )
                  })}
                  <button
                    onClick={() => { setActiveTab('security'); setNotifOpen(false) }}
                    className="w-full py-2.5 text-sokora-orange text-xs font-medium hover:bg-white/3 transition-colors"
                  >
                    Voir toutes les alertes →
                  </button>
                </div>
              )}
            </div>

            {/* Admin avatar */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sokora-orange to-sokora-teal flex items-center justify-center text-white text-xs font-bold">
                AD
              </div>
              <div className="hidden sm:block">
                <p className="text-white text-sm font-medium leading-none">Admin</p>
                <p className="text-gray-500 text-xs">Super Admin</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-[61px] z-40 bg-sokora-navy/95 backdrop-blur border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 py-2 overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-sokora-orange text-white shadow-lg shadow-orange-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                  {tab.id === 'security' && criticalAlerts > 0 && (
                    <span className="w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                      {criticalAlerts}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'overview' && <TabOverview />}
        {activeTab === 'wallets' && <TabWallets />}
        {activeTab === 'transactions' && <TabTransactions />}
        {activeTab === 'security' && <TabSecurity />}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/8 mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <p className="text-gray-600 text-xs">© 2025 SOKORA — Wallet Manager v1.0</p>
          <p className="text-gray-600 text-xs">Zone UEMOA · 6 pays actifs · BCEAO compliant</p>
        </div>
      </footer>
    </div>
  )
}
