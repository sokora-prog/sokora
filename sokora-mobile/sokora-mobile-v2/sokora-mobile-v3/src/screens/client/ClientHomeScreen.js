/**
 * ClientHomeScreen v3 — SOKORA MaxIT Design
 * Charte prototype : header blanc, wallet gradient sombre, pills colorées
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, RefreshControl, Dimensions, StatusBar, Platform, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../services/AuthContext';
import { useTranslation } from '../../services/i18n';
import { walletService, clientDashboardService } from '../../services/api';
import { API_URL } from '../../utils/constants';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';

const { width: W } = Dimensions.get('window');

// ── Palette MaxIT (prototype) ────────────────────────────────────────────────
const C = {
  navy:    '#0F1E35',
  navy2:   '#133050',
  navy3:   '#0a4a38',
  orange:  '#FF6B35',
  orangeL: '#ff8c5a',
  teal:    '#00D4AA',
  tealD:   '#00b894',
  gold:    '#FFB800',
  purple:  '#6C63FF',
  bg:      '#F4F6F9',
  white:   '#FFFFFF',
  textD:   '#1A1A2E',
  textG:   '#8892A4',
  cardD:   '#1A2E45',
};

const TIERS = {
  Bronze:   { emoji: '🥉', min: 0,      max: 10000,   cashback: 1,  color: '#CD7F32' },
  Silver:   { emoji: '🥈', min: 10000,  max: 50000,   cashback: 2,  color: '#9BA0A8' },
  Gold:     { emoji: '🥇', min: 50000,  max: 200000,  cashback: 5,  color: '#F59E0B' },
  Diamond:  { emoji: '💎', min: 200000, max: 1000000, cashback: 10, color: '#00D4AA' },
  Platinum: { emoji: '👑', min: 1000000,max: Infinity, cashback: 15, color: '#E5E4E2' },
};

function getTier(spent) {
  if (spent >= 1000000) return { name: 'Platinum', ...TIERS.Platinum };
  if (spent >= 200000)  return { name: 'Diamond',  ...TIERS.Diamond  };
  if (spent >= 50000)   return { name: 'Gold',     ...TIERS.Gold     };
  if (spent >= 10000)   return { name: 'Silver',   ...TIERS.Silver   };
  return { name: 'Bronze', ...TIERS.Bronze };
}

export default function ClientHomeScreen({ navigation }) {
  const { user } = useAuth();
  const { lang, setLang } = useTranslation();
  const [wallet,     setWallet]     = useState(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [hidden,     setHidden]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const [upcomingEvents,   setUpcomingEvents]   = useState([]);
  const [pendingServices,  setPendingServices]  = useState(0);
  const [loyaltyPts,       setLoyaltyPts]       = useState(0);

  const [showScanModal, setShowScanModal] = useState(false);
  const [qrScanned,     setQrScanned]     = useState(false);
  const [camPermission, requestCamPerm]   = useCameraPermissions();
  const [qrToken,       setQrToken]       = useState('');
  const [showQRModal,   setShowQRModal]   = useState(false);
  const [qrTimer,       setQrTimer]       = useState(10);
  const qrCountRef = useRef(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scanScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanScale, { toValue: 1.1, duration: 900, useNativeDriver: true }),
        Animated.timing(scanScale, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const res = await walletService.getMyWallet().catch(() => null);
      if (res?.data) {
        setWallet(res.data);
        setTotalSpent(res.data.total_spent ?? 0);
      }
    } catch {}
    // Charger dashboard unifié
    try {
      const ct = Platform.OS === 'web'
        ? localStorage.getItem('sokora_client_token')
        : await SecureStore.getItemAsync('sokora_client_token').catch(() => null);
      if (ct) {
        const dash = await clientDashboardService.get(ct).catch(() => null);
        if (dash) {
          setUpcomingEvents(dash.upcoming_events || []);
          setPendingServices(dash.pending_services || 0);
          setLoyaltyPts(dash.loyalty?.total_points || 0);
        }
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  const balance = wallet?.balance ?? 0;
  const tier    = getTier(totalSpent);
  const fmt     = n => Number(n).toLocaleString('fr-FR');

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const dateStr = () => {
    return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const refreshQRToken = async () => {
    try {
      const ct = Platform.OS === 'web'
        ? localStorage.getItem('sokora_client_token')
        : await SecureStore.getItemAsync('sokora_client_token').catch(() => null);
      if (!ct) return;
      const res = await fetch(`${API_URL}/wallet/qr-token?service=restaurant`, {
        headers: { 'X-Client-Token': ct },
      });
      if (!res.ok) return;
      const data = await res.json();
      setQrToken(data.qr_token || '');
      setQrTimer(10);
    } catch {}
  };

  const openQRModal = () => {
    setShowQRModal(true);
    refreshQRToken();
    qrCountRef.current = setInterval(() => {
      setQrTimer(t => {
        if (t <= 1) { refreshQRToken(); return 10; }
        return t - 1;
      });
    }, 1000);
  };

  const closeQRModal = () => {
    setShowQRModal(false);
    if (qrCountRef.current) { clearInterval(qrCountRef.current); qrCountRef.current = null; }
  };

  const openScanner = async () => {
    if (!camPermission?.granted) {
      const { granted } = await requestCamPerm();
      if (!granted) return;
    }
    setQrScanned(false);
    setShowScanModal(true);
  };

  const handleQRScan = ({ data }) => {
    if (qrScanned) return;
    setQrScanned(true);
    setShowScanModal(false);
    if (data.startsWith('sokora://pay/')) {
      navigation.navigate('PaymentRequest', { token: data.replace('sokora://pay/', '') });
    } else {
      navigation.navigate('WalletPay');
    }
  };

  const firstName = user?.full_name?.split(' ')[0] ?? 'toi';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* ══════════ HEADER BLANC ══════════ */}
      <View style={s.header}>
        <View>
          <Text style={s.headerGreeting}>{greeting()} {firstName} 👋</Text>
          <Text style={s.headerDate}>{dateStr()}</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerBtn} onPress={openQRModal}>
            <Ionicons name="qr-code-outline" size={22} color={C.textD} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => {}}>
            <Ionicons name="notifications-outline" size={22} color={C.textD} />
            <View style={s.notifDot} />
          </TouchableOpacity>
          <View style={s.avatar}>
            <Text style={{ fontSize: 18 }}>{tier.emoji}</Text>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={C.orange} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ══════════ CARTE WALLET ══════════ */}
          <View style={s.walletCard}>
            {/* Orbes déco */}
            <View style={s.orb1} />
            <View style={s.orb2} />

            {/* Haut : SOKORA PAY + tier */}
            <View style={s.walletTop}>
              <Text style={s.walletBrand}>SOKORA PAY</Text>
              <View style={[s.tierChip, { borderColor: tier.color + '66', backgroundColor: tier.color + '22' }]}>
                <Text style={{ fontSize: 11 }}>{tier.emoji}</Text>
                <Text style={[s.tierChipTxt, { color: tier.color }]}>{tier.name.toUpperCase()}</Text>
              </View>
            </View>

            {/* Balance */}
            <View style={s.walletBalanceArea}>
              <Text style={s.walletLabel}>SOLDE DISPONIBLE</Text>
              <View style={s.walletRow}>
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.walletAmount}>{hidden ? '•••••' : fmt(balance)}</Text>
                }
                <Text style={s.walletCur}>FCFA</Text>
                <TouchableOpacity onPress={() => setHidden(h => !h)} style={{ marginLeft: 8 }}>
                  <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.55)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Bande accent */}
            <View style={s.walletAccent} />

            {/* Barre fidélité */}
            {loyaltyPts > 0 && (
              <View style={s.loyaltyBar}>
                <Ionicons name="star" size={12} color={C.gold} />
                <Text style={s.loyaltyTxt}>{loyaltyPts.toLocaleString('fr-FR')} pts SOKORA</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Loyalty')}>
                  <Text style={s.loyaltyLink}>Voir →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ══════════ ACTION PILLS ══════════ */}
          <View style={s.pillsCard}>
            {[
              { icon: '↑',  label: 'Envoyer',  bg: ['#FF6B35','#ff8c5a'], nav: () => navigation.navigate('WalletPay') },
              { icon: '↓',  label: 'Recevoir', bg: ['#00D4AA','#00b894'], nav: openQRModal },
              { icon: '⊡',  label: 'Payer',    bg: ['#6C63FF','#9b93ff'], nav: () => navigation.navigate('WalletPay') },
              { icon: '+',  label: 'Recharger',bg: ['#FFB800','#ffd60a'], nav: () => navigation.navigate('WalletPay') },
            ].map((a, i) => (
              <TouchableOpacity key={i} style={s.pill} onPress={a.nav} activeOpacity={0.8}>
                <View style={[s.pillIcon, { backgroundColor: a.bg[0] }]}>
                  <Text style={{ fontSize: 22, color: '#fff', fontWeight: '900' }}>{a.icon}</Text>
                </View>
                <Text style={s.pillLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ══════════ ÉVÉNEMENTS À VENIR ══════════ */}
          {upcomingEvents.length > 0 && (
            <View style={s.upcomingSection}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>📅 Prochainement</Text>
                {pendingServices > 0 && (
                  <TouchableOpacity
                    style={s.alertBadge}
                    onPress={() => navigation.navigate('MyServices')}
                  >
                    <Text style={s.alertBadgeTxt}>{pendingServices} RDV en attente</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 2 }}>
                {upcomingEvents.map((ev, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.eventCard, { borderLeftColor: ev.color }]}
                    onPress={() => {
                      if (ev.type === 'voyage') navigation.navigate('MyTrips');
                      else if (ev.type === 'hotel') navigation.navigate('MyBookings');
                      else if (ev.type === 'service') navigation.navigate('MyServices');
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{ev.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.eventTitle} numberOfLines={1}>{ev.title}</Text>
                      <Text style={s.eventSub}>{ev.subtitle}</Text>
                    </View>
                    {ev.qr_available && (
                      <View style={s.qrAvailDot}>
                        <Ionicons name="qr-code" size={14} color="#6366F1" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ══════════ ACCÈS RAPIDE ══════════ */}
          <View style={s.section}>
            <View style={s.sectionHd}>
              <Text style={s.sectionTitle}>Accès rapide</Text>
              <TouchableOpacity><Text style={s.sectionMore}>Voir tout →</Text></TouchableOpacity>
            </View>
            <View style={s.accessGrid}>
              {[
                { emoji: '🏨', label: 'Hôtels',    bg: '#667eea', nav: () => navigation.navigate('HotelSearch') },
                { emoji: '🚌', label: 'Transport',  bg: '#f093fb', nav: () => navigation.navigate('VoyageSearch') },
                { emoji: '🍽️', label: 'Maquis',    bg: '#4facfe', nav: () => navigation.navigate('Explorer', { screen: 'Discover' }) },
                { emoji: '🔧', label: 'Services',    bg: '#43e97b', nav: () => navigation.navigate('ServiceSearch') },
                { emoji: '📋', label: 'Mes services',bg: '#00D4AA', nav: () => navigation.navigate('MyServices') },
              ].map((item, i) => (
                <TouchableOpacity key={i} style={s.accessItem} onPress={item.nav} activeOpacity={0.8}>
                  <View style={[s.accessIcon, { backgroundColor: item.bg }]}>
                    <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
                  </View>
                  <Text style={s.accessLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ══════════ OFFRES DU JOUR ══════════ */}
          <View style={s.section}>
            <View style={s.sectionHd}>
              <Text style={s.sectionTitle}>🔥 Offres du jour</Text>
              <TouchableOpacity onPress={() => navigation.navigate('PULSE', { screen: 'PromoFeedMain' })}>
                <Text style={s.sectionMore}>Tout voir →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
              {[
                { emoji: '🏨', label: 'Hôtel Diplomate', sub: 'Nuit dès 35 000 F', disc: '-30%', bg: '#667eea' },
                { emoji: '🍖', label: 'Maquis Belle Vie', sub: 'Menu complet 5 000 F', disc: '-20%', bg: '#f093fb' },
                { emoji: '🚌', label: 'UTB Abidjan→Bouaké', sub: 'Aller simple 6 500 F', disc: '-15%', bg: '#4facfe' },
              ].map((o, i) => (
                <TouchableOpacity key={i} style={s.offerCard} activeOpacity={0.85}
                  onPress={() => navigation.navigate('PULSE', { screen: 'PromoFeedMain' })}>
                  <View style={[s.offerThumb, { backgroundColor: o.bg }]}>
                    <Text style={{ fontSize: 36 }}>{o.emoji}</Text>
                    <View style={s.offerDisc}><Text style={s.offerDiscTxt}>{o.disc}</Text></View>
                  </View>
                  <View style={s.offerBody}>
                    <Text style={s.offerName}>{o.label}</Text>
                    <Text style={s.offerSub}>{o.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ══════════ SOKORA BLACK ══════════ */}
          <TouchableOpacity style={s.blackBar} onPress={() => navigation.navigate('Loyalty')} activeOpacity={0.88}>
            <Text style={{ fontSize: 22 }}>🖤</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.blackTitle}>SOKORA Black</Text>
              <Text style={s.blackSub}>Programme de fidélité · {tier.name} {tier.emoji}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#B9F2FF" />
          </TouchableOpacity>

          {/* ══════════ HISTORIQUE ══════════ */}
          <TouchableOpacity style={s.historyBtn} onPress={() => navigation.navigate('Activity')} activeOpacity={0.82}>
            <Ionicons name="time-outline" size={18} color={C.orange} />
            <Text style={s.historyBtnTxt}>Voir tout l'historique SOKORA</Text>
            <Ionicons name="chevron-forward" size={16} color={C.textG} />
          </TouchableOpacity>

        </Animated.View>
      </Animated.ScrollView>

      {/* ══════════ FAB SCAN ══════════ */}
      <Animated.View style={[s.fab, { transform: [{ scale: scanScale }] }]}>
        <TouchableOpacity style={s.fabBtn} onPress={openScanner} activeOpacity={0.9}>
          <Ionicons name="scan-circle-outline" size={26} color="#fff" />
          <Text style={s.fabLabel}>SCAN</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ══════════ MODAL QR WALLET ══════════ */}
      <Modal visible={showQRModal} transparent animationType="fade" onRequestClose={closeQRModal}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Mon QR SOKORA</Text>
                <Text style={s.modalSub}>Présentez à la caisse pour payer</Text>
              </View>
              <TouchableOpacity onPress={closeQRModal}><Ionicons name="close" size={22} color={C.textG} /></TouchableOpacity>
            </View>
            <View style={s.qrBox}>
              {qrToken
                ? <QRCode value={qrToken} size={180} color={C.navy} backgroundColor={C.bg} />
                : <View style={s.qrLoading}><ActivityIndicator size="large" color={C.orange} /></View>
              }
            </View>
            <View style={s.timerRow}>
              <View style={[s.timerCircle, { borderColor: qrTimer <= 3 ? '#E84040' : C.orange, backgroundColor: qrTimer <= 3 ? '#FFF0F0' : C.bg }]}>
                <Text style={[s.timerNum, { color: qrTimer <= 3 ? '#E84040' : C.orange }]}>{qrTimer}</Text>
              </View>
              <Text style={s.timerTxt}>{qrTimer <= 3 ? 'Renouvellement...' : `Nouveau code dans ${qrTimer}s`}</Text>
            </View>
            {wallet && (
              <View style={s.modalBalance}>
                <Text style={s.modalBalLabel}>SOLDE WALLET</Text>
                <Text style={s.modalBalAmt}>{hidden ? '••• ••• F' : `${fmt(balance)} F`}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ══════════ MODAL SCANNER ══════════ */}
      <Modal visible={showScanModal} animationType="slide" onRequestClose={() => setShowScanModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={qrScanned ? undefined : handleQRScan}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
          <View style={s.scanOverlay}>
            <View style={s.scanFrame} />
          </View>
          <View style={s.scanTop}>
            <Text style={s.scanTitle}>Scanner un QR SOKORA</Text>
            <Text style={s.scanSub}>QR de paiement ou QR Wallet</Text>
          </View>
          <TouchableOpacity style={s.scanClose} onPress={() => setShowScanModal(false)}>
            <Ionicons name="close-circle" size={52} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Header blanc ──
  header: {
    backgroundColor: C.white,
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  headerGreeting: { fontSize: 20, fontWeight: '800', color: C.textD },
  headerDate:     { fontSize: 11, color: C.textG, marginTop: 2 },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    width: 9, height: 9, borderRadius: 5, backgroundColor: C.orange,
    position: 'absolute', top: 7, right: 7, borderWidth: 2, borderColor: C.white,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.orange, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  // ── Wallet card ──
  walletCard: {
    margin: 16,
    backgroundColor: C.navy,
    borderRadius: 26, paddingTop: 22, paddingHorizontal: 22,
    overflow: 'hidden',
    minHeight: 175,
    shadowColor: C.navy, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  orb1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    top: -80, right: -60,
    backgroundColor: 'rgba(0,212,170,0.15)',
  },
  orb2: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    bottom: -40, left: -30,
    backgroundColor: 'rgba(255,107,53,0.12)',
  },
  walletTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  walletBrand:{ fontSize: 13, fontWeight: '900', color: 'rgba(255,255,255,0.5)', letterSpacing: 2.5, textTransform: 'uppercase' },
  tierChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  tierChipTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  walletBalanceArea: { marginTop: 14, zIndex: 1 },
  walletLabel:{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600' },
  walletRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  walletAmount:{ fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  walletCur:  { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginBottom: 4 },
  walletAccent:{
    height: 6,
    marginTop: 18,
    marginHorizontal: -22,
    // Simule le dégradé orange → teal → navy avec une View colorée
    backgroundColor: C.orange,
    opacity: 0.75,
  },

  // ── Action pills ──
  pillsCard: {
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: C.white, borderRadius: 22,
    flexDirection: 'row', justifyContent: 'space-around',
    padding: 16,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pill:      { alignItems: 'center', gap: 7 },
  pillIcon:  { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
               shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  pillLabel: { fontSize: 10, fontWeight: '700', color: C.textG, textTransform: 'capitalize' },

  // ── Section ──
  section:      { paddingHorizontal: 16, marginTop: 18 },
  sectionHd:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.textD },
  sectionMore:  { fontSize: 11, color: C.orange, fontWeight: '700' },

  // ── Access grid ──
  accessGrid:  { flexDirection: 'row', justifyContent: 'space-between' },
  accessItem:  { alignItems: 'center', gap: 7, flex: 1 },
  accessIcon:  { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                 shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  accessLabel: { fontSize: 10, fontWeight: '700', color: C.textD, textAlign: 'center' },

  // ── Offer cards ──
  offerCard: {
    width: 170, backgroundColor: C.white, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  offerThumb: { height: 96, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  offerDisc:  { position: 'absolute', top: 8, right: 8, backgroundColor: C.orange, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  offerDiscTxt:{ fontSize: 10, fontWeight: '800', color: '#fff' },
  offerBody:  { padding: 10 },
  offerName:  { fontSize: 11, fontWeight: '700', color: C.textD, marginBottom: 3 },
  offerSub:   { fontSize: 10, color: C.textG },

  // ── SOKORA Black ──
  blackBar: {
    margin: 16, marginTop: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0f1e35', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(185,242,255,0.2)',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  blackTitle: { fontSize: 14, fontWeight: '800', color: '#B9F2FF', letterSpacing: 0.5 },
  blackSub:   { fontSize: 11, color: '#7a8fab', marginTop: 2 },

  // ── FAB ──
  fab: { position: 'absolute', bottom: 24, alignSelf: 'center' },
  fabBtn: {
    backgroundColor: C.orange, borderRadius: 36, width: 72, height: 72,
    justifyContent: 'center', alignItems: 'center', gap: 2,
    shadowColor: C.orange, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12,
  },
  fabLabel: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 1 },

  // ── Modal QR ──
  modalBg:   { flex: 1, backgroundColor: 'rgba(15,30,53,0.92)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 28, padding: 28, alignItems: 'center', width: 300 },
  modalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.navy },
  modalSub:   { fontSize: 12, color: C.textG, marginTop: 2 },
  qrBox:      { padding: 14, backgroundColor: C.bg, borderRadius: 20, borderWidth: 2, borderColor: C.orange + '30' },
  qrLoading:  { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  timerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  timerCircle:{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  timerNum:   { fontSize: 14, fontWeight: '800' },
  timerTxt:   { fontSize: 12, color: C.textG },
  modalBalance:{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#DDE4F0', width: '100%', alignItems: 'center' },
  modalBalLabel:{ fontSize: 11, color: C.textG, fontWeight: '600', letterSpacing: 0.5 },
  modalBalAmt:{ fontSize: 24, fontWeight: '800', color: C.navy, marginTop: 4 },

  // ── Historique ──
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white,
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  historyBtnTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: C.textD },

  // ── Scanner ──
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame:   { width: 260, height: 260, borderRadius: 20, borderWidth: 3, borderColor: C.orange },
  scanTop:     { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
  scanTitle:   { color: '#fff', fontSize: 18, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 4 },
  scanSub:     { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6 },
  scanClose:   { position: 'absolute', bottom: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 50, padding: 4 },

  // ── Upcoming events ──
  upcomingSection: { paddingHorizontal: 16, marginBottom: 16 },
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  alertBadge:      { backgroundColor: '#FEE9E9', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  alertBadgeTxt:   { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  eventCard: {
    width: 200, backgroundColor: C.white, borderRadius: 14,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 6, elevation: 2,
  },
  eventTitle: { fontSize: 13, fontWeight: '700', color: C.textD },
  eventSub:   { fontSize: 11, color: C.textG, marginTop: 2 },
  qrAvailDot: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },

  // ── Loyalty bar (inside wallet card) ──
  loyaltyBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  loyaltyTxt: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  loyaltyLink:{ fontSize: 12, color: C.gold, fontWeight: '800' },
});
