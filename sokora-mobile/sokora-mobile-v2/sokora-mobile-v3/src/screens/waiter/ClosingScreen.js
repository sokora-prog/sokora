import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Share, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { dashboardService } from '../../services/api';
import { Colors, Spacing, Radius, Shadow } from '../../utils/constants';

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

const METHOD_CONFIG = {
  cash:         { label: 'Espèces',      icon: 'cash-outline',           color: '#22C55E', bg: '#F0FDF4' },
  wave:         { label: 'Wave',          icon: 'phone-portrait-outline', color: '#1A8CFF', bg: '#EFF6FF' },
  orange_money: { label: 'Orange Money',  icon: 'phone-portrait-outline', color: '#FF6B00', bg: '#FFF7ED' },
  mtn_money:    { label: 'MTN Money',     icon: 'phone-portrait-outline', color: '#FFC300', bg: '#FFFBEB' },
  card:         { label: 'Carte',         icon: 'card-outline',           color: '#8B5CF6', bg: '#F5F3FF' },
};

export default function ClosingScreen({ navigation }) {
  const [report,     setReport]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [date,       setDate]       = useState(null); // null = today

  const load = useCallback(async () => {
    try {
      const { data } = await dashboardService.closing(date);
      setReport(data);
    } catch (e) {
      console.error('closing error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleShare = async () => {
    if (!report) return;
    const lines = [
      `📊 CLÔTURE DE CAISSE — ${report.date_label}`,
      `─────────────────────`,
      `💰 CA Total : ${fmt(report.total_revenue)}`,
      `🧾 Commandes : ${report.total_orders}`,
      ``,
      `ENCAISSEMENTS PAR MODE :`,
      ...(report.methods || []).map(m => {
        const cfg = METHOD_CONFIG[m.method] || {};
        return `• ${cfg.label || m.method} : ${fmt(m.total)} (${m.count} cmd)`;
      }),
      ``,
      `💸 Dépenses : ${fmt(report.total_expenses)}`,
      `🎁 Offerts : ${fmt(report.total_complimentary)}`,
      `─────────────────────`,
      `✅ BÉNÉFICE NET : ${fmt(report.net_profit)}`,
      ``,
      `_Rapport généré par SOKORA_`,
    ].join('\n');
    await Share.share({ message: lines });
  };

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
      <ActivityIndicator size="large" color={Colors.orange} />
    </View>
  );

  const isProfit = report?.net_profit >= 0;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Clôture de caisse</Text>
          <Text style={styles.headerSub}>{report?.date_label || '—'}</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={Colors.orange} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.orange} />}
        contentContainerStyle={{ padding: Spacing.xl, gap: 16, paddingBottom: 60 }}
      >
        {/* RÉSUMÉ PRINCIPAL */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>CA TOTAL DU JOUR</Text>
          <Text style={styles.summaryRevenue}>{fmt(report?.total_revenue)}</Text>
          <Text style={styles.summaryOrders}>{report?.total_orders} commande{report?.total_orders !== 1 ? 's' : ''} encaissée{report?.total_orders !== 1 ? 's' : ''}</Text>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Dépenses</Text>
              <Text style={[styles.summaryItemValue, { color: '#EF4444' }]}>- {fmt(report?.total_expenses)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Offerts</Text>
              <Text style={[styles.summaryItemValue, { color: '#8B5CF6' }]}>- {fmt(report?.total_complimentary)}</Text>
            </View>
          </View>

          <View style={[styles.netRow, { backgroundColor: isProfit ? '#F0FDF4' : '#FEF2F2' }]}>
            <Text style={[styles.netLabel, { color: isProfit ? '#22C55E' : '#EF4444' }]}>
              {isProfit ? '✅' : '⚠️'} BÉNÉFICE NET
            </Text>
            <Text style={[styles.netAmount, { color: isProfit ? '#22C55E' : '#EF4444' }]}>
              {fmt(report?.net_profit)}
            </Text>
          </View>
        </View>

        {/* ENCAISSEMENTS PAR MODE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 Encaissements par mode</Text>
          {(report?.methods || []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Aucun encaissement aujourd'hui</Text>
            </View>
          ) : (
            (report.methods).map((m, i) => {
              const cfg = METHOD_CONFIG[m.method] || { label: m.method, icon: 'cash-outline', color: Colors.orange, bg: Colors.orangePale };
              return (
                <View key={i} style={[styles.methodCard, { borderLeftColor: cfg.color }]}>
                  <View style={[styles.methodIcon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodLabel}>{cfg.label}</Text>
                    <Text style={styles.methodCount}>{m.count} commande{m.count !== 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={[styles.methodAmount, { color: cfg.color }]}>{fmt(m.total)}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* TOP PRODUITS */}
        {(report?.top_products || []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Top produits du jour</Text>
            <View style={styles.card}>
              {report.top_products.map((p, i) => (
                <View key={i} style={[styles.topRow, i > 0 && styles.topRowBorder]}>
                  <View style={styles.topRank}>
                    <Text style={styles.topRankText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.topName}>{p.name}</Text>
                  <Text style={styles.topQty}>x{p.qty}</Text>
                  <Text style={styles.topRevenue}>{fmt(p.revenue)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* PERFORMANCE SERVEURS */}
        {(report?.waiter_stats || []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👥 Performance serveurs</Text>
            <View style={styles.card}>
              {report.waiter_stats.map((w, i) => (
                <View key={i} style={[styles.waiterRow, i > 0 && styles.topRowBorder]}>
                  <View style={styles.waiterAvatar}>
                    <Text style={styles.waiterAvatarText}>{w.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.waiterName}>{w.name}</Text>
                    <Text style={styles.waiterOrders}>{w.orders} commande{w.orders !== 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={styles.waiterRevenue}>{fmt(w.revenue)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* DÉPENSES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💸 Dépenses du jour</Text>
          {(report?.expenses || []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Aucune dépense enregistrée</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {report.expenses.map((e, i) => (
                <View key={i} style={[styles.expenseRow, i > 0 && styles.topRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expenseLabel}>{e.label}</Text>
                    <Text style={styles.expenseCategory}>{e.category} · {e.time}</Text>
                  </View>
                  <Text style={styles.expenseAmount}>- {fmt(e.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    backgroundColor: Colors.navy, paddingTop: 54, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  summaryCard: {
    backgroundColor: Colors.navy, borderRadius: 20, padding: 24,
    ...Shadow.md,
  },
  summaryLabel:   { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1 },
  summaryRevenue: { fontSize: 42, fontWeight: '800', color: Colors.orange, marginTop: 4 },
  summaryOrders:  { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  summaryDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  summaryRow:     { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryItem:    { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 12 },
  summaryItemLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  summaryItemValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  netRow: { borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netLabel:  { fontSize: 13, fontWeight: '800' },
  netAmount: { fontSize: 20, fontWeight: '800' },

  section:      { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden',
  },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0',
  },
  emptyText: { color: Colors.textMuted, fontSize: 14 },

  methodCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 4,
    ...Shadow.sm,
  },
  methodIcon:   { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  methodLabel:  { fontSize: 15, fontWeight: '700', color: Colors.navy },
  methodCount:  { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  methodAmount: { fontSize: 18, fontWeight: '800' },

  topRow:       { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  topRowBorder: { borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  topRank: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: Colors.orangePale, alignItems: 'center', justifyContent: 'center',
  },
  topRankText:    { fontSize: 12, fontWeight: '800', color: Colors.orange },
  topName:        { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.navy },
  topQty:         { fontSize: 13, color: Colors.textMuted, fontWeight: '600', marginRight: 8 },
  topRevenue:     { fontSize: 14, fontWeight: '800', color: Colors.navy },

  waiterRow:      { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  waiterAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.orangePale, alignItems: 'center', justifyContent: 'center',
  },
  waiterAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.orange },
  waiterName:       { fontSize: 14, fontWeight: '700', color: Colors.navy },
  waiterOrders:     { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  waiterRevenue:    { fontSize: 15, fontWeight: '800', color: Colors.navy },

  expenseRow:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  expenseLabel:   { fontSize: 14, fontWeight: '600', color: Colors.navy },
  expenseCategory:{ fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  expenseAmount:  { fontSize: 14, fontWeight: '800', color: '#EF4444' },
});
