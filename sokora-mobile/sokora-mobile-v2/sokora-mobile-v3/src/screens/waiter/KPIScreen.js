import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Shadow } from '../../utils/constants';
import { API_URL } from '../../utils/constants';
import * as SecureStore from 'expo-secure-store';
import ScreenHeader from '../../components/ScreenHeader';

const { width: W } = Dimensions.get('window');
const CHART_W = W - 48;
const CHART_H = 160;
const fmt  = n => new Intl.NumberFormat('fr-FR').format(Math.round(n ?? 0));
const fmtF = n => fmt(n) + ' F';

async function getHeaders() {
  const token = await SecureStore.getItemAsync('sokora_token');
  return { Authorization: `Bearer ${token}` };
}

const PERIODS = [
  { id: '7d',  label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: '90d', label: '3 mois' },
  { id: 'month', label: 'Ce mois' },
];

// ── Mini graphe barres SVG-like en RN pur ──────────────────────
function BarChart({ data, color, valueKey, labelKey, height = CHART_H }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const barW = Math.floor((CHART_W - 16) / data.length) - 3;

  return (
    <View style={{ height, paddingHorizontal: 8 }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        {data.map((d, i) => {
          const h = Math.max(3, Math.round(((d[valueKey] || 0) / max) * (height - 24)));
          const isToday = i === data.length - 1;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {d[valueKey] > 0 && (
                <Text style={{ fontSize: 7, color: Colors.textMuted, marginBottom: 2 }}>
                  {d[valueKey] > 999 ? Math.round(d[valueKey]/1000)+'k' : d[valueKey]}
                </Text>
              )}
              <View style={{
                width: barW, height: h,
                backgroundColor: isToday ? color : color + '88',
                borderRadius: 4,
              }} />
              <Text style={{ fontSize: 8, color: Colors.textMuted, marginTop: 3, width: barW + 4, textAlign: 'center' }} numberOfLines={1}>
                {d[labelKey]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Mini graphe ligne ──────────────────────────────────────────
function LineChart({ data, color, valueKey, height = CHART_H }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const n = data.length;
  const pts = data.map((d, i) => ({
    x: (i / (n - 1)) * (CHART_W - 24),
    y: height - 24 - ((d[valueKey] || 0) / max) * (height - 32),
    val: d[valueKey] || 0,
  }));

  // Construire le path SVG simplifié via View positions absolues
  return (
    <View style={{ height, paddingHorizontal: 8 }}>
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Lignes horizontales guides */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <View key={f} style={{
            position: 'absolute', left: 0, right: 0,
            top: (1 - f) * (height - 32),
            borderTopWidth: 1, borderTopColor: '#E2E8F0',
          }} />
        ))}
        {/* Points et segments */}
        {pts.map((pt, i) => (
          <React.Fragment key={i}>
            {i < pts.length - 1 && (
              <LineSegment x1={pts[i].x} y1={pts[i].y} x2={pts[i+1].x} y2={pts[i+1].y} color={color} />
            )}
            <View style={{
              position: 'absolute',
              left: pt.x - 4, top: pt.y - 4,
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: i === n - 1 ? color : '#fff',
              borderWidth: 2, borderColor: color,
            }} />
          </React.Fragment>
        ))}
        {/* Labels X */}
        {data.map((d, i) => (
          (i === 0 || i === Math.floor(n/2) || i === n-1) ? (
            <Text key={i} style={{
              position: 'absolute', bottom: 0,
              left: pts[i].x - 16, width: 32, textAlign: 'center',
              fontSize: 8, color: Colors.textMuted,
            }}>{d.label}</Text>
          ) : null
        ))}
      </View>
    </View>
  );
}

function LineSegment({ x1, y1, x2, y2, color }) {
  const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
  const angle = Math.atan2(y2-y1, x2-x1) * 180 / Math.PI;
  return (
    <View style={{
      position: 'absolute',
      left: x1, top: y1,
      width: len, height: 2,
      backgroundColor: color + 'CC',
      transformOrigin: 'left center',
      transform: [{ rotate: `${angle}deg` }],
    }} />
  );
}

export default function KPIScreen({ navigation }) {
  const [period,    setPeriod]    = useState('7d');
  const [stats,     setStats]     = useState(null);
  const [chart,     setChart]     = useState([]);
  const [waiters,   setWaiters]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('revenue'); // revenue | orders

  const load = useCallback(async (p = period) => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      const [statsRes, chartRes, waitersRes] = await Promise.all([
        fetch(`${API_URL}/dashboard/stats-period?period=${p}`, { headers }),
        fetch(`${API_URL}/dashboard/revenue-chart?period=${p}`, { headers }),
        fetch(`${API_URL}/dashboard/waiters-period?period=${p}`, { headers }),
      ]);
      const [statsData, chartData, waitersData] = await Promise.all([
        statsRes.json(), chartRes.json(), waitersRes.json(),
      ]);
      setStats(statsData);
      setChart(Array.isArray(chartData) ? chartData : []);
      setWaiters(Array.isArray(waitersData) ? waitersData : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(period); }, [period]));

  const switchPeriod = (p) => { setPeriod(p); load(p); };

  const ticketMoyen = stats?.orders_period > 0
    ? stats.total_revenue_period / stats.orders_period
    : 0;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <ScreenHeader
        navigation={navigation}
        title="KPI & Performance"
        subtitle="Analyse de performance"
        dark={true}
      />

      {/* SÉLECTEUR PÉRIODE */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[styles.periodBtn, period === p.id && styles.periodBtnActive]}
            onPress={() => switchPeriod(p.id)}
          >
            <Text style={[styles.periodBtnText, period === p.id && styles.periodBtnTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>

          {/* KPIs PRINCIPAUX */}
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { borderTopColor: Colors.orange }]}>
              <Text style={styles.kpiIcon}>💰</Text>
              <Text style={styles.kpiVal}>{fmtF(stats?.total_revenue_period)}</Text>
              <Text style={styles.kpiLbl}>CA Total</Text>
            </View>
            <View style={[styles.kpiCard, { borderTopColor: '#22C55E' }]}>
              <Text style={styles.kpiIcon}>📈</Text>
              <Text style={[styles.kpiVal, { color: '#22C55E' }]}>{fmtF(stats?.net_profit_period)}</Text>
              <Text style={styles.kpiLbl}>Bénéfice net</Text>
            </View>
            <View style={[styles.kpiCard, { borderTopColor: '#8B5CF6' }]}>
              <Text style={styles.kpiIcon}>🧾</Text>
              <Text style={[styles.kpiVal, { color: '#8B5CF6' }]}>{stats?.orders_period ?? 0}</Text>
              <Text style={styles.kpiLbl}>Commandes</Text>
            </View>
            <View style={[styles.kpiCard, { borderTopColor: '#06B6D4' }]}>
              <Text style={styles.kpiIcon}>🎯</Text>
              <Text style={[styles.kpiVal, { color: '#06B6D4' }]}>{fmtF(ticketMoyen)}</Text>
              <Text style={styles.kpiLbl}>Ticket moyen</Text>
            </View>
          </View>

          {/* GRAPHE CA / COMMANDES */}
          <View style={styles.chartCard}>
            <View style={styles.chartTabRow}>
              <TouchableOpacity
                style={[styles.chartTab, activeTab === 'revenue' && styles.chartTabActive]}
                onPress={() => setActiveTab('revenue')}
              >
                <Text style={[styles.chartTabText, activeTab === 'revenue' && styles.chartTabTextActive]}>
                  Chiffre d'affaires
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chartTab, activeTab === 'orders' && styles.chartTabActive]}
                onPress={() => setActiveTab('orders')}
              >
                <Text style={[styles.chartTabText, activeTab === 'orders' && styles.chartTabTextActive]}>
                  Commandes
                </Text>
              </TouchableOpacity>
            </View>

            {chart.length > 0 ? (
              activeTab === 'revenue' ? (
                <>
                  <Text style={styles.chartMax}>
                    Max : {fmtF(Math.max(...chart.map(d => d.revenue || 0)))}
                  </Text>
                  <LineChart data={chart} color={Colors.orange} valueKey="revenue" />
                </>
              ) : (
                <>
                  <Text style={styles.chartMax}>
                    Max : {Math.max(...chart.map(d => d.orders || 0))} cmd
                  </Text>
                  <BarChart data={chart} color="#8B5CF6" valueKey="orders" labelKey="label" />
                </>
              )
            ) : (
              <View style={styles.noData}>
                <Ionicons name="bar-chart-outline" size={32} color={Colors.textFaint} />
                <Text style={styles.noDataText}>Pas encore de données</Text>
              </View>
            )}
          </View>

          {/* ALERTES STOCK */}
          {stats?.stock_alerts?.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>⚠️ Alertes stock</Text>
                <View style={styles.alertCount}>
                  <Text style={styles.alertCountText}>{stats.stock_alerts.length}</Text>
                </View>
              </View>
              <View style={styles.card}>
                {stats.stock_alerts.map((item, i) => (
                  <View key={i} style={[styles.alertRow, i > 0 && styles.rowBorder]}>
                    <View style={styles.alertDot} />
                    <Text style={styles.alertName}>{item.name}</Text>
                    <Text style={styles.alertStock}>{item.stock_quantity ?? item.stock ?? 0} restants</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TOP PRODUIT */}
          {stats?.top_product && (
            <View style={styles.topProductCard}>
              <Text style={styles.topProductLabel}>🏆 Top produit ({PERIODS.find(p=>p.id===period)?.label})</Text>
              <Text style={styles.topProductName}>{stats.top_product}</Text>
            </View>
          )}

          {/* PERFORMANCE SERVEURS */}
          {waiters?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>👤 Performance serveurs</Text>
              <View style={styles.card}>
                {waiters.map((w, i) => {
                  const maxRev = Math.max(...waiters.map(x => x.revenue || 0), 1);
                  const pct = Math.round(((w.revenue || 0) / maxRev) * 100);
                  return (
                    <View key={i} style={[styles.waiterRow, i > 0 && styles.rowBorder]}>
                      <View style={styles.waiterAvatar}>
                        <Text style={styles.waiterAvatarText}>
                          {(w.name || w.waiter_name || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.waiterTop}>
                          <Text style={styles.waiterName}>{w.name || w.waiter_name}</Text>
                          <Text style={styles.waiterRevenue}>{fmtF(w.revenue)}</Text>
                        </View>
                        <View style={styles.waiterBarBg}>
                          <View style={[styles.waiterBar, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.waiterOrders}>{w.orders} commande(s)</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* COMPARATIF DÉPENSES */}
          <View style={styles.compareCard}>
            <Text style={styles.compareTitle}>Synthèse financière</Text>
            <View style={styles.compareRow}>
              <View style={styles.compareItem}>
                <Text style={styles.compareLabel}>CA</Text>
                <Text style={[styles.compareVal, { color: Colors.orange }]}>
                  {fmtF(stats?.total_revenue_period)}
                </Text>
              </View>
              <Ionicons name="remove" size={16} color={Colors.textMuted} />
              <View style={styles.compareItem}>
                <Text style={styles.compareLabel}>Dépenses</Text>
                <Text style={[styles.compareVal, { color: '#EF4444' }]}>
                  {fmtF(stats?.total_expenses_period)}
                </Text>
              </View>
              <Ionicons name="remove" size={16} color={Colors.textMuted} />
              <View style={styles.compareItem}>
                <Text style={styles.compareLabel}>Bénéfice</Text>
                <Text style={[styles.compareVal, { color: '#22C55E' }]}>
                  {fmtF(stats?.net_profit_period)}
                </Text>
              </View>
            </View>
            {/* Barre de répartition */}
            {(stats?.total_revenue_period || 0) > 0 && (
              <View style={styles.splitBar}>
                <View style={[styles.splitBarProfit, {
                  width: `${Math.min(100, (stats.net_profit_period / stats.total_revenue_period) * 100)}%`
                }]} />
                <View style={[styles.splitBarExpense, {
                  width: `${Math.min(100, (stats.total_expenses_period / stats.total_revenue_period) * 100)}%`
                }]} />
              </View>
            )}
            <View style={styles.splitLegend}>
              <View style={styles.splitLegendItem}>
                <View style={[styles.splitDot, { backgroundColor: '#22C55E' }]} />
                <Text style={styles.splitLegendText}>Bénéfice</Text>
              </View>
              <View style={styles.splitLegendItem}>
                <View style={[styles.splitDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.splitLegendText}>Dépenses</Text>
              </View>
            </View>
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    backgroundColor: Colors.navy, paddingTop: 54, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  periodRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  periodBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#F1F5F9', alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  periodBtnActive:    { backgroundColor: Colors.navy, borderColor: Colors.navy },
  periodBtnText:      { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  periodBtnTextActive:{ color: '#fff' },

  kpiGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    width: (W - 42) / 2, backgroundColor: '#fff', borderRadius: 16,
    padding: 14, borderTopWidth: 3, ...Shadow.sm, gap: 4,
  },
  kpiIcon:  { fontSize: 20 },
  kpiVal:   { fontSize: 16, fontWeight: '800', color: Colors.navy },
  kpiLbl:   { fontSize: 11, color: Colors.textMuted },

  chartCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E2E8F0', gap: 12, ...Shadow.sm,
  },
  chartTabRow:     { flexDirection: 'row', gap: 8 },
  chartTab: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#F1F5F9', alignItems: 'center',
  },
  chartTabActive:    { backgroundColor: Colors.navy },
  chartTabText:      { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  chartTabTextActive:{ color: '#fff' },
  chartMax:          { fontSize: 11, color: Colors.textMuted, textAlign: 'right' },
  noData:            { alignItems: 'center', paddingVertical: 32, gap: 8 },
  noDataText:        { fontSize: 14, color: Colors.textMuted },

  section:       { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle:  { fontSize: 15, fontWeight: '800', color: Colors.navy },
  alertCount: {
    backgroundColor: '#EF4444', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  alertCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden',
  },
  alertRow:   { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  rowBorder:  { borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  alertDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  alertName:  { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.navy },
  alertStock: { fontSize: 12, color: '#EF4444', fontWeight: '700' },

  topProductCard: {
    backgroundColor: Colors.orange, borderRadius: 16, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  topProductLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  topProductName:  { fontSize: 18, fontWeight: '800', color: '#fff', flex: 1, textAlign: 'right' },

  waiterRow:   { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  waiterAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  waiterAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  waiterTop:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  waiterName:       { fontSize: 14, fontWeight: '700', color: Colors.navy },
  waiterRevenue:    { fontSize: 13, fontWeight: '800', color: Colors.orange },
  waiterOrders:     { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  waiterBarBg:      { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden' },
  waiterBar:        { height: 4, backgroundColor: Colors.orange, borderRadius: 2 },

  compareCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E2E8F0', gap: 12,
  },
  compareTitle:  { fontSize: 15, fontWeight: '800', color: Colors.navy },
  compareRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  compareItem:   { alignItems: 'center', gap: 4 },
  compareLabel:  { fontSize: 11, color: Colors.textMuted },
  compareVal:    { fontSize: 16, fontWeight: '800' },
  splitBar: {
    height: 10, backgroundColor: '#F1F5F9', borderRadius: 5,
    flexDirection: 'row', overflow: 'hidden',
  },
  splitBarProfit:  { height: 10, backgroundColor: '#22C55E' },
  splitBarExpense: { height: 10, backgroundColor: '#EF4444' },
  splitLegend:     { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  splitLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  splitDot:        { width: 8, height: 8, borderRadius: 4 },
  splitLegendText: { fontSize: 11, color: Colors.textMuted },
});
