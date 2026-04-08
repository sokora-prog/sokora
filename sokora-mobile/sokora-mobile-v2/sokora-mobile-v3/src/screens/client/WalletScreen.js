/**
 * WalletScreen — SOKORA Client
 * Affiche le solde, carte NFC Pro Business, QR Code dynamique (refresh 10s) et historique.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated, LinearGradient,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';
import { API_URL } from '../../utils/constants';
import { useTranslation } from '../../services/i18n';
import ScreenHeader from '../../components/ScreenHeader';

// ── Données démo offline ──────────────────────────────────────────────────────
const DEMO_WALLET = {
  balance: 2850000,
  card: {
    holder:  'MAHAMADOU BAMBA',
    number:  'SKW-PRO-0001',
    plan:    'Pro Business',
    nfc:     true,
    iban:    'CI92 0001 0000 0001 0001 001',
  },
  by_service: {
    restaurant: { spent: 384000, count: 12 },
    hotel:      { spent: 150000, count: 2  },
    voyage:     { spent: 210000, count: 3  },
  },
  transactions: [
    { id:1, description:'Dîner — Le Dakar',     tx_type:'payment', amount:-38500,  balance_after:2811500, created_at:'2026-04-05T19:42:00', service_type:'restaurant' },
    { id:2, description:'Recharge Wave',         tx_type:'topup',   amount:200000,  balance_after:2850000, created_at:'2026-04-05T09:00:00', service_type:'cashback'   },
    { id:3, description:'Nuit — Hôtel Ivoire',   tx_type:'payment', amount:-75000,  balance_after:2650000, created_at:'2026-04-04T14:00:00', service_type:'hotel'      },
    { id:4, description:'Bus Abidjan-Bouaké',    tx_type:'payment', amount:-12000,  balance_after:2725000, created_at:'2026-04-03T07:30:00', service_type:'voyage'     },
    { id:5, description:'Cashback fidélité',     tx_type:'cashback',amount:5500,    balance_after:2737000, created_at:'2026-04-02T12:00:00', service_type:'cashback'   },
  ],
};

const SERVICE_LABELS = {
  restaurant: { label: 'Restaurant',  icon: 'restaurant',    color: Colors.orange },
  hotel:      { label: 'Hôtel',        icon: 'bed',           color: Colors.teal   },
  voyage:     { label: 'Voyage',       icon: 'airplane',      color: Colors.purple },
  cashback:   { label: 'Cashback',     icon: 'gift',          color: Colors.green  },
};

export default function WalletScreen({ clientToken, navigation }) {
  const { t } = useTranslation();
  const [wallet, setWallet]       = useState(null);
  const [qrData, setQrData]       = useState(null);
  const [qrTimer, setQrTimer]     = useState(10);
  const [activeService, setActiveService] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Chargement wallet ──────────────────────────────────
  const loadWallet = useCallback(async () => {
    try {
      const url = activeService
        ? `${API_URL}/wallet/transactions?service=${activeService}`
        : `${API_URL}/wallet/transactions`;
      const res = await fetch(url, {
        headers: { 'X-Client-Token': clientToken },
      });
      if (!res.ok) throw new Error('Erreur chargement wallet');
      const data = await res.json();
      setWallet(data);
      setError(null);
    } catch (e) {
      // Mode démo offline — données mock
      setWallet(DEMO_WALLET);
      setError(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientToken, activeService]);

  // ── Génération QR Token ────────────────────────────────
  const refreshQR = useCallback(async (service = 'restaurant') => {
    try {
      const res = await fetch(`${API_URL}/wallet/qr-token?service=${service}`, {
        headers: { 'X-Client-Token': clientToken },
      });
      if (!res.ok) return;
      const data = await res.json();
      setQrData(data);
      setQrTimer(10);
      // Animation pulse
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ]).start();
    } catch (_) {}
  }, [clientToken, pulseAnim]);

  // ── Timer QR refresh toutes les 10s ───────────────────
  useEffect(() => {
    refreshQR(activeService || 'restaurant');
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setQrTimer(t => {
        if (t <= 1) {
          refreshQR(activeService || 'restaurant');
          return 10;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [activeService, refreshQR]);

  // ── Chargement initial ────────────────────────────────
  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const onRefresh = () => {
    setRefreshing(true);
    loadWallet();
    refreshQR(activeService || 'restaurant');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.orange} />
      </View>
    );
  }

  if (error && !wallet) {
    return (
      <View style={styles.root}>
        <ScreenHeader navigation={navigation} title="Mon Wallet" dark={true} />
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textFaint} />
          <Text style={styles.errorText}>Erreur de chargement</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setLoading(true); setError(null); loadWallet(); }}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const transactions = wallet?.transactions || [];
  const byService    = wallet?.by_service   || {};
  const balance      = wallet?.balance ?? 0;

  return (
    <View style={styles.root}>
      <ScreenHeader navigation={navigation} title="Mon Wallet" dark={true} />
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
    >
      {/* ── Header solde ── */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('wallet.balance')} SOKORA</Text>
        <Text style={styles.balanceAmount}>
          {balance.toLocaleString('fr-FR')} <Text style={styles.currency}>FCFA</Text>
        </Text>
        <Text style={styles.balanceSub}>Wallet universel — utilisable partout</Text>
      </View>

      {/* ── Carte NFC Pro Business ── */}
      {wallet?.card && (
        <View style={styles.nfcCard}>
          {/* Cercles déco */}
          <View style={styles.nfcCircle1} />
          <View style={styles.nfcCircle2} />

          {/* Badge plan + NFC */}
          <View style={styles.nfcTopRow}>
            <View style={styles.nfcBadge}>
              <Text style={styles.nfcBadgeText}>{wallet.card.plan}</Text>
            </View>
            {wallet.card.nfc && (
              <View style={styles.nfcChip}>
                <Ionicons name="radio-outline" size={14} color={Colors.gold} />
                <Text style={styles.nfcChipText}>NFC</Text>
              </View>
            )}
          </View>

          {/* Logo SOKORA */}
          <Text style={styles.nfcBrand}>SOKORA</Text>

          {/* N° compte */}
          <Text style={styles.nfcNumber}>{wallet.card.number}</Text>

          {/* Titulaire + IBAN */}
          <View style={styles.nfcBottomRow}>
            <View>
              <Text style={styles.nfcLabel}>Titulaire</Text>
              <Text style={styles.nfcHolder}>{wallet.card.holder}</Text>
            </View>
            <View style={styles.nfcIbanBox}>
              <Text style={styles.nfcLabel}>IBAN</Text>
              <Text style={styles.nfcIban}>{wallet.card.iban}</Text>
            </View>
          </View>

          {/* Actions rapides */}
          <View style={styles.nfcActions}>
            {[
              { label: 'Envoyer',  icon: 'arrow-up-circle-outline'   },
              { label: 'Recevoir', icon: 'arrow-down-circle-outline'  },
              { label: 'Payer NFC',icon: 'radio-outline'              },
            ].map(btn => (
              <TouchableOpacity key={btn.label} style={styles.nfcBtn}>
                <Ionicons name={btn.icon} size={22} color={Colors.gold} />
                <Text style={styles.nfcBtnText}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── QR Code dynamique ── */}
      <View style={styles.qrSection}>
        <Text style={styles.sectionTitle}>{t('wallet.qr_code')}</Text>

        {/* Filtre service */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.serviceRow}>
          {Object.entries(SERVICE_LABELS).filter(([k]) => k !== 'cashback').map(([key, svc]) => (
            <TouchableOpacity
              key={key}
              style={[styles.serviceChip, activeService === key && { backgroundColor: svc.color }]}
              onPress={() => setActiveService(activeService === key ? null : key)}
            >
              <Ionicons name={svc.icon} size={14} color={activeService === key ? '#fff' : svc.color} />
              <Text style={[styles.serviceChipText, activeService === key && { color: '#fff' }]}>
                {svc.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Animated.View style={[styles.qrWrapper, { transform: [{ scale: pulseAnim }] }]}>
          {qrData ? (
            <QRCode
              value={qrData.qr_token}
              size={200}
              color={Colors.navy}
              backgroundColor="#fff"
            />
          ) : (
            <ActivityIndicator size="large" color={Colors.orange} />
          )}
        </Animated.View>

        {/* Timer */}
        <View style={styles.timerRow}>
          <View style={[styles.timerDot, { backgroundColor: qrTimer > 4 ? Colors.green : Colors.red }]} />
          <Text style={styles.timerText}>
            Expire dans <Text style={{ fontWeight: '700' }}>{qrTimer}s</Text>
          </Text>
          <TouchableOpacity onPress={() => refreshQR(activeService || 'restaurant')} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={16} color={Colors.orange} />
          </TouchableOpacity>
        </View>
        <Text style={styles.qrHint}>
          {t('wallet.qr_hint')}
        </Text>
      </View>

      {/* ── Stats par service ── */}
      {Object.keys(byService).length > 0 && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Dépenses par service</Text>
          <View style={styles.statsGrid}>
            {Object.entries(byService).map(([svc, stats]) => {
              const info = SERVICE_LABELS[svc] || { label: svc, icon: 'card', color: Colors.textMuted };
              return (
                <TouchableOpacity
                  key={svc}
                  style={[styles.statCard, activeService === svc && { borderColor: info.color, borderWidth: 2 }]}
                  onPress={() => setActiveService(activeService === svc ? null : svc)}
                >
                  <Ionicons name={info.icon} size={22} color={info.color} />
                  <Text style={styles.statLabel}>{info.label}</Text>
                  <Text style={[styles.statAmount, { color: info.color }]}>
                    {stats.spent.toLocaleString('fr-FR')} F
                  </Text>
                  <Text style={styles.statCount}>{stats.count} opér.</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Historique transactions ── */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Historique</Text>
          {activeService && (
            <TouchableOpacity onPress={() => setActiveService(null)}>
              <Text style={styles.clearFilter}>Tout afficher ×</Text>
            </TouchableOpacity>
          )}
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={Colors.textFaint} />
            <Text style={styles.emptyText}>{t('wallet.tx_empty')}</Text>
          </View>
        ) : (
          transactions.map(tx => {
            const svcInfo = SERVICE_LABELS[tx.service_type] || SERVICE_LABELS.restaurant;
            const isDebit = tx.amount < 0;
            return (
              <View key={tx.id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: svcInfo.color + '20' }]}>
                  <Ionicons name={svcInfo.icon} size={18} color={svcInfo.color} />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc} numberOfLines={1}>{tx.description || tx.tx_type}</Text>
                  <Text style={styles.txMeta}>
                    {svcInfo.label} · {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                </View>
                <View style={styles.txAmountCol}>
                  <Text style={[styles.txAmount, { color: isDebit ? Colors.red : Colors.green }]}>
                    {isDebit ? '' : '+'}{Math.abs(tx.amount).toLocaleString('fr-FR')} F
                  </Text>
                  <Text style={styles.txBalance}>{tx.balance_after?.toLocaleString('fr-FR')} F</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },
  container:    { flex: 1, backgroundColor: Colors.bg },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  // NFC Pro Business Card
  nfcCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: '#0F1E35',
    padding: Spacing.xl,
    overflow: 'hidden',
    position: 'relative',
    ...Shadow.lg,
  },
  nfcCircle1: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(240,125,26,0.08)', top: -60, right: -40,
  },
  nfcCircle2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(25,169,157,0.06)', bottom: -30, left: -20,
  },
  nfcTopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md,
  },
  nfcBadge: {
    backgroundColor: 'rgba(240,125,26,0.15)',
    borderWidth: 1, borderColor: 'rgba(240,125,26,0.35)',
    borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  nfcBadgeText: {
    color: Colors.orange, fontSize: Typography.xs,
    fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase',
  },
  nfcChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  nfcChipText: {
    color: Colors.gold, fontSize: Typography.xs, fontWeight: '900',
  },
  nfcBrand: {
    color: 'rgba(255,255,255,0.9)', fontSize: Typography['2xl'],
    fontWeight: '900', letterSpacing: 4, marginBottom: Spacing.sm,
  },
  nfcNumber: {
    fontFamily: 'monospace', color: Colors.gold,
    fontSize: Typography.md, fontWeight: '700',
    letterSpacing: 2, marginBottom: Spacing.lg,
  },
  nfcBottomRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', marginBottom: Spacing.lg,
  },
  nfcLabel: {
    color: 'rgba(255,255,255,0.4)', fontSize: Typography.xs,
    marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  nfcHolder: {
    color: '#fff', fontSize: Typography.base, fontWeight: '700', letterSpacing: 1,
  },
  nfcIbanBox: { alignItems: 'flex-end' },
  nfcIban: {
    color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: Typography.xs,
  },
  nfcActions: {
    flexDirection: 'row', justifyContent: 'space-around',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: Spacing.md, marginTop: Spacing.sm,
  },
  nfcBtn: { alignItems: 'center', gap: 4 },
  nfcBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.xs, fontWeight: '600' },

  // Balance
  balanceCard: {
    margin: Spacing.lg,
    padding: Spacing['2xl'],
    borderRadius: Radius.xl,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    ...Shadow.lg,
  },
  balanceLabel:  { color: 'rgba(255,255,255,0.7)', fontSize: Typography.sm, marginBottom: 4 },
  balanceAmount: { color: '#fff', fontSize: Typography['4xl'], fontWeight: '800' },
  currency:      { fontSize: Typography.lg, fontWeight: '400' },
  balanceSub:    { color: 'rgba(255,255,255,0.5)', fontSize: Typography.xs, marginTop: 6 },

  // QR
  qrSection: {
    margin: Spacing.lg,
    marginTop: 0,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadow.md,
  },
  sectionTitle: {
    fontSize: Typography.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
  serviceRow:   { marginBottom: Spacing.md, alignSelf: 'stretch' },
  serviceChip:  {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    marginRight: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  serviceChipText: { fontSize: Typography.sm, color: Colors.text, fontWeight: '500' },

  qrWrapper: {
    padding: Spacing.lg,
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    ...Shadow.sm,
  },
  timerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Spacing.md,
  },
  timerDot:  { width: 8, height: 8, borderRadius: 4 },
  timerText: { fontSize: Typography.sm, color: Colors.textMuted },
  refreshBtn: { padding: 4, marginLeft: 4 },
  qrHint: {
    fontSize: Typography.xs, color: Colors.textFaint,
    marginTop: Spacing.sm, textAlign: 'center',
  },

  // Stats
  statsSection: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    flex: 1, minWidth: 100,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center', gap: 4,
    ...Shadow.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  statLabel:  { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: '500' },
  statAmount: { fontSize: Typography.md, fontWeight: '700' },
  statCount:  { fontSize: Typography.xs, color: Colors.textFaint },

  // History
  historySection: { marginHorizontal: Spacing.lg, marginBottom: Spacing['3xl'] },
  historyHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  clearFilter:    { fontSize: Typography.sm, color: Colors.orange, fontWeight: '600' },
  emptyState:     { alignItems: 'center', paddingVertical: Spacing['3xl'], gap: Spacing.sm },
  emptyText:      { color: Colors.textFaint, fontSize: Typography.base },

  txRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  txIcon:      { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txInfo:      { flex: 1 },
  txDesc:      { fontSize: Typography.sm, fontWeight: '600', color: Colors.text },
  txMeta:      { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  txAmountCol: { alignItems: 'flex-end' },
  txAmount:    { fontSize: Typography.sm, fontWeight: '700' },
  txBalance:   { fontSize: Typography.xs, color: Colors.textFaint, marginTop: 1 },

  // Error state
  errorText: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text, marginTop: Spacing.md },
  errorSub:  { fontSize: Typography.sm, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
  retryBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.orange, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
  },
  retryBtnText: { fontSize: Typography.sm, fontWeight: '700', color: '#fff' },
});
