import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { dashboardService } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { Colors, Spacing, Radius, Shadow, Typography } from '../../utils/constants';

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

const PERIODS = [
  { id: 'day',   label: 'Aujourd\'hui' },
  { id: 'week',  label: 'Cette semaine' },
  { id: 'month', label: 'Ce mois' },
];

export default function WaiterStatsScreen() {
  const { user, logout } = useAuth();
  const [stats,     setStats]     = useState(null);
  const [period,    setPeriod]    = useState('day');
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const loadStats = useCallback(async (p) => {
    try {
      const { data } = await dashboardService.myStats(p);
      setStats(data);
    } catch (e) {
    console.log('StatsScreen error:', e?.message);
    } finally {
    setLoading(false);
    setRefreshing(false);
  }
  }, []); // ← plus de dépendance sur period

  useFocusEffect(useCallback(() => { loadStats(period); }, [period, loadStats]));

  const handlePeriod = (p) => {
    setPeriod(p);
    setLoading(true);
    loadStats(p); // ← p garanti, pas la closure
};

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  const onRefresh = () => { setRefreshing(true); loadStats(); };

  const AVATAR_COLORS = [Colors.orange, Colors.teal, Colors.purple, Colors.green];
  const initials = (user?.full_name || 'S').split(' ').map(n => n[0]).join('').toUpperCase();
  const avatarColor = AVATAR_COLORS[0];

  return (
    <View style={styles.container}>
      {/* HEADER PROFILE */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{user?.full_name}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="restaurant-outline" size={12} color={Colors.teal} />
            <Text style={styles.roleText}>Serveur</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            logout();
          }}
        >
          <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
        showsVerticalScrollIndicator={false}
      >
        {/* SÉLECTEUR PÉRIODE */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.periodBtn, period === p.id && styles.periodBtnActive]}
              onPress={() => setPeriod(p.id)}
            >
              <Text style={[styles.periodBtnText, period === p.id && styles.periodBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* KPIs PRINCIPAUX */}
        <View style={styles.section}>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { borderTopColor: Colors.orange }]}>
              <Text style={styles.kpiEmoji}>💰</Text>
              <Text style={[styles.kpiValue, { color: Colors.orange }]}>
                {loading ? '—' : fmt(stats?.total_revenue_today || 0)}
              </Text>
              <Text style={styles.kpiLabel}>Chiffre d'affaires</Text>
            </View>
            <View style={[styles.kpiCard, { borderTopColor: Colors.teal }]}>
              <Text style={styles.kpiEmoji}>📋</Text>
              <Text style={[styles.kpiValue, { color: Colors.teal }]}>
                {loading ? '—' : stats?.open_orders_count || 0}
              </Text>
              <Text style={styles.kpiLabel}>Commandes</Text>
            </View>
          </View>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { borderTopColor: Colors.purple }]}>
              <Text style={styles.kpiEmoji}>🍽️</Text>
              <Text style={[styles.kpiValue, { color: Colors.purple }]}>
                {loading ? '—' : stats?.occupied_tables_count || 0}
              </Text>
              <Text style={styles.kpiLabel}>Tables servies</Text>
            </View>
            <View style={[styles.kpiCard, { borderTopColor: Colors.green }]}>
              <Text style={styles.kpiEmoji}>⭐</Text>
              <Text style={[styles.kpiValue, { color: Colors.green }]}>
                {loading ? '—' : stats?.top_product || '—'}
              </Text>
              <Text style={styles.kpiLabel}>Plat phare</Text>
            </View>
          </View>
        </View>

        {/* OBJECTIF */}
        <View style={styles.section}>
          <View style={styles.objectifCard}>
            <View style={styles.objectifHeader}>
              <Ionicons name="trophy-outline" size={20} color={Colors.gold} />
              <Text style={styles.objectifTitle}>Objectif mensuel</Text>
            </View>
            <View style={styles.objectifContent}>
              <Text style={styles.objectifSub}>Pas d'objectif assigné</Text>
              <Text style={styles.objectifHint}>
                Le gérant peut vous assigner un objectif de vente depuis son dashboard.
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '0%', backgroundColor: Colors.orange }]} />
            </View>
            <Text style={styles.progressLabel}>0% atteint</Text>
          </View>
        </View>

        {/* INFOS COMPTE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon compte</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.infoLabel}>Téléphone</Text>
              <Text style={styles.infoValue}>{user?.phone_number || '—'}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Ionicons name="business-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.infoLabel}>Établissement</Text>
              <Text style={styles.infoValue}>#{user?.establishment_id || '—'}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.infoLabel}>Rôle</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{user?.role || 'waiter'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* DÉCONNEXION */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutCard} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={Colors.red} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.red} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.navy,
    paddingTop: 54, paddingBottom: 20,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: Typography.xl, fontWeight: '800', color: Colors.surface },
  headerInfo: { flex: 1 },
  headerName: { fontSize: Typography.xl, fontWeight: '800', color: Colors.surface },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 4,
  },
  roleText: { fontSize: Typography.xs, color: Colors.teal, fontWeight: '600' },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  periodRow: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xl,
  },
  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  periodBtnText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textMuted },
  periodBtnTextActive: { color: Colors.surface },
  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sectionTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.navy, marginBottom: Spacing.md },
  kpiGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  kpiCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.md, alignItems: 'center',
    borderTopWidth: 3, ...Shadow.sm,
  },
  kpiEmoji: { fontSize: 22, marginBottom: 6 },
  kpiValue: { fontSize: Typography.xl, fontWeight: '800', textAlign: 'center' },
  kpiLabel: { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  objectifCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.lg, ...Shadow.sm,
    borderTopWidth: 3, borderTopColor: Colors.gold,
  },
  objectifHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  objectifTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.navy },
  objectifContent: { marginBottom: Spacing.md },
  objectifSub: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textMuted },
  objectifHint: { fontSize: Typography.xs, color: Colors.textFaint, marginTop: 4 },
  progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  progressLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 6 },
  infoCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    ...Shadow.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md,
  },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  infoLabel: { flex: 1, fontSize: Typography.base, color: Colors.textMuted },
  infoValue: { fontSize: Typography.base, fontWeight: '600', color: Colors.navy },
  rolePill: {
    backgroundColor: Colors.tealPale, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  rolePillText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.teal },
  logoutCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.redPale, borderRadius: Radius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.red + '33',
  },
  logoutText: { flex: 1, fontSize: Typography.base, fontWeight: '700', color: Colors.red },
});
