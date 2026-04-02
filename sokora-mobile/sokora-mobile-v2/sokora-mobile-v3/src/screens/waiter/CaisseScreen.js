import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { dashboardService } from '../../services/api';
import { Colors, Spacing, Radius, Typography } from '../../utils/constants';

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

const METHOD_META = {
  cash:         { label: 'Espèces',       color: '#F97316', bg: '#fff4ea' },
  wave:         { label: 'Wave',          color: '#0EA5E9', bg: '#e0f2fe' },
  orange_money: { label: 'Orange Money',  color: '#F59E0B', bg: '#fffbeb' },
  mtn_money:    { label: 'MTN Money',     color: '#FACC15', bg: '#fefce8' },
  card:         { label: 'Carte',         color: '#8B5CF6', bg: '#f5f3ff' },
  wallet:       { label: 'Wallet SOKORA', color: '#14B8A6', bg: '#f0fdfa' },
  credit:       { label: 'Ardoise',       color: '#6B7280', bg: '#f3f4f6' },
};

export default function CaisseScreen({ navigation }) {
  const [tab, setTab]           = useState('today');
  const [caisse, setCaisse]     = useState(null);
  const [revMethod, setRevMethod] = useState(null);
  const [chartPeriod, setChartPeriod] = useState('7d');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [todayRes, weekRes, monthRes, chartRes] = await Promise.all([
        dashboardService.caisse('today'),
        dashboardService.caisse('week'),
        dashboardService.caisse('month'),
        dashboardService.revenueByMethod(chartPeriod),
      ]);
      setCaisse({
        today: todayRes.data,
        week:  weekRes.data,
        month: monthRes.data,
      });
      setRevMethod(chartRes.data);
    } catch (e) {
      console.log('CaisseScreen error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chartPeriod]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const TABS = [
    { id: 'today', label: "Aujourd'hui" },
    { id: 'week',  label: 'Cette semaine' },
    { id: 'month', label: 'Ce mois' },
  ];

  const data = caisse?.[tab];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.teal} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suivi caisse</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs période */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total encaissé */}
      {data && (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>TOTAL ENCAISSÉ</Text>
          <Text style={styles.totalValue}>{fmt(data.grand_total)}</Text>
          <Text style={styles.totalSub}>
            {data.total_count} paiement{data.total_count > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Breakdown par méthode */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Par moyen de paiement</Text>
        {!data || data.breakdown?.length === 0 ? (
          <Text style={styles.empty}>Aucun encaissement pour cette période</Text>
        ) : (
          <View style={styles.methodGrid}>
            {(data.breakdown || []).map(m => {
              const meta = METHOD_META[m.method] || { label: m.method, color: '#6B7280', bg: '#f3f4f6' };
              const pct  = data.grand_total > 0 ? Math.round((m.total / data.grand_total) * 100) : 0;
              return (
                <View key={m.method} style={[styles.methodCard, { backgroundColor: meta.bg, borderColor: meta.color + '33' }]}>
                  <View style={styles.methodRow}>
                    <Text style={[styles.methodLabel, { color: Colors.muted }]}>{meta.label}</Text>
                    <Text style={[styles.methodPct, { backgroundColor: meta.color + '22', color: meta.color }]}>{pct}%</Text>
                  </View>
                  <Text style={[styles.methodTotal, { color: meta.color }]}>{fmt(m.total)}</Text>
                  <Text style={styles.methodCount}>{m.count} pmt</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Graphe évolution */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Évolution</Text>
          <View style={styles.chartTabRow}>
            {[['7d','7j'],['30d','30j']].map(([id, label]) => (
              <TouchableOpacity key={id} onPress={() => setChartPeriod(id)}
                style={[styles.chartTab, chartPeriod === id && styles.chartTabActive]}>
                <Text style={[styles.chartTabText, chartPeriod === id && styles.chartTabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {revMethod && (
          <>
            {/* Légende */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(revMethod.methods || []).map(m => (
                  <View key={m.method} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: m.color }} />
                    <Text style={{ fontSize: 10, color: Colors.muted }}>{m.label}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.navy }}>{fmt(m.total)}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Barres */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120, paddingBottom: 20 }}>
                {(revMethod.days || []).map((day, i) => {
                  const maxTotal = Math.max(...revMethod.days.map(d => d.total), 1);
                  const barH = day.total > 0 ? Math.max((day.total / maxTotal) * 90, 3) : 3;
                  const methods = revMethod.methods || [];
                  return (
                    <View key={i} style={{ alignItems: 'center', width: 28 }}>
                      <View style={{ width: 22, height: barH, borderRadius: 3, overflow: 'hidden', flexDirection: 'column-reverse' }}>
                        {day.total === 0 ? (
                          <View style={{ flex: 1, backgroundColor: Colors.border }} />
                        ) : methods.map(m => {
                          const mVal = day[m.method] || 0;
                          const mH = day.total > 0 ? (mVal / day.total) * barH : 0;
                          return mVal > 0 ? (
                            <View key={m.method} style={{ width: '100%', height: mH, backgroundColor: m.color }} />
                          ) : null;
                        })}
                      </View>
                      <Text style={{ fontSize: 8, color: Colors.muted, marginTop: 3 }}>{day.label}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={{ textAlign: 'right', fontSize: 11, color: Colors.muted, marginTop: 4 }}>
              Total : <Text style={{ fontWeight: '800', color: Colors.purple }}>{fmt(revMethod.grand_total)}</Text>
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f0f4fb' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 20, backgroundColor: '#fff' },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f4fb', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: Colors.navy },
  tabRow:       { flexDirection: 'row', margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 4 },
  tabBtn:       { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#14B8A6' },
  tabText:      { fontSize: 11, fontWeight: '600', color: Colors.muted },
  tabTextActive:{ color: '#fff' },
  totalCard:    { marginHorizontal: 16, backgroundColor: '#14B8A6', borderRadius: 14, padding: 18, marginBottom: 16 },
  totalLabel:   { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  totalValue:   { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 2 },
  totalSub:     { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 },
  section:      { marginHorizontal: 16, marginBottom: 20 },
  sectionHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy, marginBottom: 10 },
  empty:        { color: Colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  methodGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  methodCard:   { width: '47%', borderRadius: 12, padding: 12, borderWidth: 1 },
  methodRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  methodLabel:  { fontSize: 10, fontWeight: '600' },
  methodPct:    { fontSize: 10, fontWeight: '700', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  methodTotal:  { fontSize: 16, fontWeight: '800' },
  methodCount:  { fontSize: 10, color: Colors.muted, marginTop: 2 },
  barBg:        { marginTop: 8, height: 3, backgroundColor: '#e5e7eb', borderRadius: 3 },
  barFill:      { height: 3, borderRadius: 3 },
  chartTabRow:  { flexDirection: 'row', gap: 6 },
  chartTab:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: Colors.border },
  chartTabActive: { backgroundColor: '#6366f1' },
  chartTabText:   { fontSize: 11, fontWeight: '600', color: Colors.muted },
  chartTabTextActive: { color: '#fff' },
});
