/**
 * ArtisanWalletScreen — Wallet artisan SOKORA
 * Solde, historique des paiements reçus, total gagné.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../../utils/constants';
import ScreenHeader from '../../components/ScreenHeader';

const C = {
  navy: '#0F1E35', orange: '#FF6B35', teal: '#00D4AA',
  bg: '#F4F6F9', white: '#FFFFFF', text: '#1A1A2E', muted: '#8892A4',
  border: '#DDE4F0', gold: '#F59E0B', green: '#22C55E', red: '#EF4444',
  navyLight: '#1E3251',
};

async function getToken() {
  if (Platform.OS === 'web') return localStorage.getItem('sokora_client_token');
  try { return await SecureStore.getItemAsync('sokora_client_token'); } catch { return null; }
}

const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

const TRANSACTION_TYPES = {
  RELEASED:  { label: 'Paiement reçu',    icon: 'arrow-down-circle', color: C.green },
  ESCROWED:  { label: 'En attente',        icon: 'time-outline',      color: C.gold  },
  REFUNDED:  { label: 'Remboursement',     icon: 'arrow-up-circle',   color: C.red   },
};

export default function ArtisanWalletScreen({ navigation }) {
  const [wallet, setWallet]         = useState(null);
  const [transactions, setTxs]      = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [dashRes, txRes] = await Promise.all([
        fetch(`${API_URL}/services/artisan/dashboard`, { headers }),
        fetch(`${API_URL}/services/artisan/transactions`, { headers }),
      ]);
      if (dashRes.ok) {
        const d = await dashRes.json();
        setWallet({ balance: d.wallet_balance ?? 0, total_earned: d.total_earned ?? 0 });
      }
      if (txRes.ok) {
        const d = await txRes.json();
        setTxs(d);
      }
    } catch (e) {
      console.warn('wallet load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={C.orange} />
      </View>
    );
  }

  const balance = wallet?.balance ?? 0;
  const totalEarned = wallet?.total_earned ?? 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.orange} />}
    >
      <ScreenHeader navigation={navigation} title="Mon Wallet" dark={true} />

      {/* ── Carte Wallet ── */}
      <View style={styles.walletCard}>
        <View style={styles.orb1} />
        <View style={styles.orb2} />

        <Text style={styles.cardLabel}>Solde disponible</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceAmount}>
            {balanceVisible ? fmt(balance) : '••••••• F'}
          </Text>
          <TouchableOpacity onPress={() => setBalanceVisible(v => !v)} style={styles.eyeBtn}>
            <Ionicons
              name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
              size={20} color="rgba(255,255,255,0.7)"
            />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="trending-up" size={16} color={C.teal} />
            <View>
              <Text style={styles.statLabel}>Total gagné</Text>
              <Text style={styles.statValue}>{fmt(totalEarned)}</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="shield-checkmark-outline" size={16} color={C.gold} />
            <View>
              <Text style={styles.statLabel}>En escrow</Text>
              <Text style={styles.statValue}>
                {fmt(transactions
                  .filter(t => t.payment_status === 'ESCROWED')
                  .reduce((s, t) => s + (t.escrow_amount || 0), 0)
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Retirer */}
        <TouchableOpacity style={styles.withdrawBtn}>
          <Ionicons name="arrow-up-circle-outline" size={18} color={C.navy} />
          <Text style={styles.withdrawBtnText}>Retirer les fonds</Text>
        </TouchableOpacity>
      </View>

      {/* ── Barre info escrow ── */}
      <View style={styles.escrowInfo}>
        <Ionicons name="lock-closed-outline" size={16} color={C.gold} />
        <Text style={styles.escrowInfoText}>
          Les fonds clients sont sécurisés en escrow et libérés après scan du QR client.
        </Text>
      </View>

      {/* ── Historique ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Historique des paiements</Text>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={48} color={C.border} />
            <Text style={styles.emptyText}>Aucune transaction pour l'instant</Text>
            <Text style={styles.emptySubtext}>
              Vos paiements apparaîtront ici après chaque prestation
            </Text>
          </View>
        ) : (
          transactions.map((tx, i) => {
            const type = TRANSACTION_TYPES[tx.payment_status] || TRANSACTION_TYPES.RELEASED;
            const date = tx.updated_at
              ? new Date(tx.updated_at).toLocaleDateString('fr-FR', {
                  day: '2-digit', month: 'short', year: 'numeric'
                })
              : '—';
            return (
              <View key={tx.id ?? i} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: type.color + '20' }]}>
                  <Ionicons name={type.icon} size={22} color={type.color} />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txLabel}>{tx.client_name || 'Client'}</Text>
                  <Text style={styles.txCategory}>{tx.category || '—'}</Text>
                  <Text style={styles.txDate}>{date}</Text>
                </View>
                <View style={styles.txAmountCol}>
                  <Text style={[styles.txAmount, { color: type.color }]}>
                    {tx.payment_status === 'ESCROWED' ? '~' : '+'}{fmt(tx.escrow_amount || 0)}
                  </Text>
                  <View style={[styles.txBadge, { backgroundColor: type.color + '20' }]}>
                    <Text style={[styles.txBadgeText, { color: type.color }]}>{type.label}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ── Scanner CTA ── */}
      <View style={styles.scanCTA}>
        <View style={styles.scanCTALeft}>
          <Text style={styles.scanCTATitle}>Scanner QR client</Text>
          <Text style={styles.scanCTASub}>Libérez les fonds après la prestation</Text>
        </View>
        <TouchableOpacity
          style={styles.scanCTABtn}
          onPress={() => navigation?.navigate('ArtisanScan')}
        >
          <Ionicons name="qr-code-outline" size={22} color={C.white} />
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loader:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  walletCard: {
    margin: 16, borderRadius: 24,
    backgroundColor: C.navy,
    padding: 24, overflow: 'hidden',
  },
  orb1: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: C.orange, opacity: 0.12,
    top: -60, right: -50,
  },
  orb2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: C.teal, opacity: 0.10,
    bottom: -30, left: 20,
  },
  cardLabel:    { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  balanceRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  balanceAmount:{ fontSize: 34, fontWeight: '900', color: C.white, letterSpacing: -1, flex: 1 },
  eyeBtn:       { padding: 4 },

  statsRow:   { flexDirection: 'row', marginTop: 20, marginBottom: 20 },
  statItem:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statDivider:{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  statLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  statValue:  { fontSize: 14, fontWeight: '700', color: C.white },

  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: C.teal,
    paddingVertical: 12, borderRadius: 12,
  },
  withdrawBtnText: { fontSize: 14, fontWeight: '700', color: C.navy },

  escrowInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF9E6',
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F59E0B30',
  },
  escrowInfoText: { fontSize: 12, color: C.gold, flex: 1, lineHeight: 17 },

  section:      { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 12 },

  emptyState:   { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText:    { fontSize: 15, fontWeight: '600', color: C.muted },
  emptySubtext: { fontSize: 12, color: C.muted, textAlign: 'center' },

  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderRadius: 14,
    padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  txIcon:       { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txInfo:       { flex: 1, gap: 2 },
  txLabel:      { fontSize: 14, fontWeight: '700', color: C.text },
  txCategory:   { fontSize: 12, color: C.muted },
  txDate:       { fontSize: 11, color: C.muted },
  txAmountCol:  { alignItems: 'flex-end', gap: 4 },
  txAmount:     { fontSize: 15, fontWeight: '800' },
  txBadge:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  txBadgeText:  { fontSize: 10, fontWeight: '700' },

  scanCTA: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.navy, borderRadius: 16,
    margin: 16, marginTop: 4, padding: 16,
  },
  scanCTALeft:  { flex: 1 },
  scanCTATitle: { fontSize: 15, fontWeight: '800', color: C.white },
  scanCTASub:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  scanCTABtn: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: C.orange, justifyContent: 'center', alignItems: 'center',
  },
});
