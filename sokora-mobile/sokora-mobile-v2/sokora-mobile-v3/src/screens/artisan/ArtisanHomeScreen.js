/**
 * ArtisanHomeScreen — SOKORA Services v3
 * Écran d'accueil pour les prestataires de services informels (artisans, livreurs indépendants, etc.)
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../services/AuthContext';
import { Colors, Spacing, Radius, Shadow, Typography } from '../../utils/constants';

const API_BASE = '/api';

export default function ArtisanHomeScreen() {
  const { user } = useAuth();
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user?.establishment_id) { setLoading(false); return; }
    try {
      const token = await import('expo-secure-store').then(m =>
        m.getItemAsync('sokora_token')
      );
      const res = await fetch(
        `${API_BASE}/service/artisan/${user.id}/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setStats(await res.json());
    } catch (_) {
      // Stats optionnelles
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  const onRefresh = () => { setRefreshing(true); loadStats(); };
  const initials  = (user?.full_name || 'A').split(' ').map(n => n[0]).join('').toUpperCase();

  const KPI = ({ icon, label, value, color }) => (
    <View style={[styles.kpi, { borderTopColor: color }]}>
      <Ionicons name={icon} size={22} color={color} style={{ marginBottom: 6 }} />
      <Text style={[styles.kpiValue, { color }]}>{value ?? '—'}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: Colors.purple }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{user?.full_name}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="construct-outline" size={12} color={Colors.purple} />
            <Text style={styles.roleText}>Artisan — {user?.establishment_name || 'Services SOKORA'}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.purple} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* KPIs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon activité</Text>
          {loading ? (
            <ActivityIndicator color={Colors.purple} style={{ marginTop: 20 }} />
          ) : stats ? (
            <View style={styles.kpiGrid}>
              <KPI icon="briefcase-outline"          label="Missions actives"    value={stats.active_missions}   color={Colors.purple} />
              <KPI icon="checkmark-circle-outline"   label="Terminées ce mois"   value={stats.done_this_month}   color={Colors.teal} />
              <KPI icon="star-outline"               label="Note moyenne"         value={stats.avg_rating ? `${stats.avg_rating.toFixed(1)}/5` : '—'} color={Colors.orange} />
              <KPI icon="cash-outline"               label="Gains du mois"        value={stats.earnings_month != null ? `${(stats.earnings_month / 1000).toFixed(0)}K F` : '—'} color={Colors.green} />
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="construct-outline" size={36} color={Colors.textFaint} />
              <Text style={styles.emptyText}>Aucune donnée disponible</Text>
              <Text style={styles.emptyHint}>Vos statistiques apparaîtront ici une fois votre activité démarrée</Text>
            </View>
          )}
        </View>

        {/* ACTIONS RAPIDES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.actionsGrid}>
            {[
              { icon: 'add-circle-outline',    label: 'Nouvelle mission',  color: Colors.purple  },
              { icon: 'list-outline',          label: 'Mes missions',      color: Colors.teal    },
              { icon: 'chatbubble-outline',    label: 'Messages',          color: Colors.orange  },
              { icon: 'wallet-outline',        label: 'Mes gains',         color: Colors.green   },
            ].map((a, i) => (
              <TouchableOpacity key={i} style={[styles.actionBtn, { borderColor: a.color + '44' }]}>
                <Ionicons name={a.icon} size={24} color={a.color} />
                <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* MON PROFIL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon compte</Text>
          <View style={styles.accountCard}>
            <View style={styles.accountRow}>
              <Ionicons name="call-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.accountLabel}>Téléphone</Text>
              <Text style={styles.accountValue}>{user?.phone_number || '—'}</Text>
            </View>
            <View style={[styles.accountRow, styles.accountRowBorder]}>
              <Ionicons name="business-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.accountLabel}>Structure</Text>
              <Text style={styles.accountValue}>{user?.establishment_name || '—'}</Text>
            </View>
            <View style={[styles.accountRow, styles.accountRowBorder]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.accountLabel}>Rôle</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>Artisan</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.bg },
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
  avatarText:  { fontSize: Typography.xl, fontWeight: '800', color: Colors.surface },
  headerInfo:  { flex: 1 },
  headerName:  { fontSize: Typography.xl, fontWeight: '800', color: Colors.surface },
  roleBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  roleText:    { fontSize: Typography.xs, color: Colors.purple, fontWeight: '600' },

  section:      { paddingHorizontal: Spacing.xl, marginTop: Spacing.xl },
  sectionTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.navy, marginBottom: Spacing.md },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kpi: {
    flex: 1, minWidth: '45%',
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.md, alignItems: 'center',
    borderTopWidth: 3, ...Shadow.sm,
  },
  kpiValue: { fontSize: Typography.xl, fontWeight: '800' },
  kpiLabel: { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionBtn: {
    flex: 1, minWidth: '45%',
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1, ...Shadow.sm,
  },
  actionLabel: { fontSize: Typography.xs, fontWeight: '700' },

  emptyCard: {
    alignItems: 'center', paddingVertical: Spacing['2xl'],
    backgroundColor: Colors.surface, borderRadius: Radius.xl, ...Shadow.sm,
  },
  emptyText: { fontSize: Typography.md, fontWeight: '600', color: Colors.textMuted, marginTop: Spacing.sm },
  emptyHint: { fontSize: Typography.xs, color: Colors.textFaint, marginTop: 4, textAlign: 'center', paddingHorizontal: Spacing.xl },

  accountCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    ...Shadow.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  accountRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md,
  },
  accountRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  accountLabel: { flex: 1, fontSize: Typography.base, color: Colors.textMuted },
  accountValue: { fontSize: Typography.base, fontWeight: '600', color: Colors.navy },
  rolePill: {
    backgroundColor: '#ede9fe', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  rolePillText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.purple },
});
