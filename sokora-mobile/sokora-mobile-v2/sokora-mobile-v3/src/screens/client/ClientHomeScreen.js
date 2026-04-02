/**
 * ClientHomeScreen v2 — SOKORA Client App
 * Dashboard central premium : Wallet masquable, Cashback gauge, Scan flottant
 * Charte graphique SOKORA officielle : #F26D21 / #3065A6 / #7AA6D4
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
import { walletService, dashboardService } from '../../services/api';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';
import { API_URL } from '../../utils/constants';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';

const { width: W } = Dimensions.get('window');

// ── Palette officielle ────────────────────────────────────────────────────────
const BRAND = {
  orange:    '#F26D21',
  orangeL:   '#F9A050',
  blue:      '#3065A6',
  blueL:     '#7AA6D4',
  navy:      '#1A2E4A',
  bg:        '#F2F5FB',
  surface:   '#FFFFFF',
  border:    '#DDE4F0',
  text:      '#1A2E4A',
  muted:     '#7A8FAB',
  gold:      '#F59E0B',
};

const SERVICES = [
  { id: 'hotel',    icon: '🏨', label: 'Hôtels',   sub: 'Disponibilités temps réel', tab: null,       screen: 'HotelSearch',  color: BRAND.blue },
  { id: 'voyage',   icon: '🚌', label: 'Voyages',   sub: 'Abidjan → partout',         tab: null,       screen: 'VoyageSearch', color: '#6366F1' },
  { id: 'discover', icon: '🍽️', label: 'Explorer',  sub: 'Maquis & Restaurants',      tab: 'Explorer', screen: 'Discover',     color: BRAND.orange },
  { id: 'reels',    icon: '📡', label: 'PULSE',     sub: 'Offres & promotions',        tab: 'PULSE',    screen: 'PromoFeedMain',color: '#E84040' },
];

const TIERS = {
  Bronze:   { emoji: '🥉', min: 0,      max: 10000,   cashback: 1,  color: '#CD7F32' },
  Silver:   { emoji: '🥈', min: 10000,  max: 50000,   cashback: 2,  color: '#9BA0A8' },
  Gold:     { emoji: '🥇', min: 50000,  max: 200000,  cashback: 5,  color: BRAND.gold },
  Diamond:  { emoji: '💎', min: 200000, max: 1000000, cashback: 10, color: '#7AA6D4' },
  Platinum: { emoji: '👑', min: 1000000,max: Infinity, cashback: 15, color: '#E5E4E2' },
};

function getTier(spent) {
  if (spent >= 1000000) return { name: 'Platinum', ...TIERS.Platinum };
  if (spent >= 200000)  return { name: 'Diamond',  ...TIERS.Diamond  };
  if (spent >= 50000)   return { name: 'Gold',     ...TIERS.Gold     };
  if (spent >= 10000)   return { name: 'Silver',   ...TIERS.Silver   };
  return { name: 'Bronze', ...TIERS.Bronze };
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function SkeletonBox({ w, h, r = 8, style }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: BRAND.border, opacity: pulse }, style]} />
  );
}

export default function ClientHomeScreen({ navigation }) {
  const { user } = useAuth();
  const { lang, setLang, t } = useTranslation();
  const [wallet,      setWallet]      = useState(null);
  const [cashback,    setCashback]    = useState(0);
  const [totalSpent,  setTotalSpent]  = useState(0);
  const [hidden,      setHidden]      = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loading,     setLoading]     = useState(true);

  const [showScanModal, setShowScanModal] = useState(false);
  const [qrScanned,     setQrScanned]     = useState(false);
  const [camPermission, requestCamPerm]   = useCameraPermissions();
  const [qrToken,       setQrToken]       = useState('');
  const [showQRModal,   setShowQRModal]   = useState(false);
  const [qrTimer,       setQrTimer]       = useState(10);
  const qrIntervalRef = useRef(null);
  const qrCountRef    = useRef(null);

  const scrollY   = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const scanScale = useRef(new Animated.Value(1)).current;

  // Pulse du bouton scan
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanScale, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(scanScale, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, []));

  const loadData = async () => {
    try {
      const res = await walletService.getMyWallet().catch(() => null);
      if (res?.data) {
        setWallet(res.data);
        const bal = res.data.balance ?? 0;
        const spent = res.data.total_spent ?? 0;
        setTotalSpent(spent);
        const tier = getTier(spent);
        setCashback(Math.floor(spent * tier.cashback / 100));
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
  const nextTierKey = Object.keys(TIERS).find(k => TIERS[k].min > totalSpent);
  const nextTier    = nextTierKey ? TIERS[nextTierKey] : null;
  const tierProgress = nextTier
    ? Math.min((totalSpent - tier.min) / (tier.max - tier.min) * 100, 100)
    : 100;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const fmt = n => n.toLocaleString('fr-FR');

  const headerH = scrollY.interpolate({ inputRange: [0, 100], outputRange: [220, 100], extrapolate: 'clamp' });
  const headerOp = scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0], extrapolate: 'clamp' });

  const getClientToken = async () => {
    try {
      if (Platform.OS === 'web') return localStorage.getItem('sokora_client_token');
      return await SecureStore.getItemAsync('sokora_client_token');
    } catch { return null; }
  };

  const refreshQRToken = async () => {
    try {
      const ct = await getClientToken();
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
    // Countdown timer
    qrCountRef.current = setInterval(() => {
      setQrTimer(t => {
        if (t <= 1) {
          refreshQRToken();
          return 10;
        }
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
      const token = data.replace('sokora://pay/', '');
      navigation.navigate('PaymentRequest', { token });
    } else {
      // Wallet QR or unknown — show wallet pay
      navigation.navigate('WalletPay');
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND.navy} />

      {/* ── Header ── */}
      <Animated.View style={[s.header, { height: headerH }]}>
        {/* Logo + notif */}
        <View style={s.headerTop}>
          <View style={s.logoRow}>
            <View style={s.logoIcon}>
              <Ionicons name="wifi" size={18} color="#fff" />
            </View>
            <Text style={s.logoText}>SOKORA</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              style={[s.notifBtn, { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: 7 }]}
              onPress={openQRModal}
            >
              <Ionicons name="qr-code-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.notifBtn} onPress={() => {}}>
              <Ionicons name="notifications-outline" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting + wallet badge */}
        <Animated.View style={[s.headerBody, { opacity: headerOp }]}>
          <View>
            <Text style={s.greeting}>{greeting()}, {user?.full_name?.split(' ')[0] ?? 'toi'} 👋</Text>
            <Text style={s.tagline}>Vis l'instant. Paye malin. Explore Abidjan. 🌍</Text>
          </View>
          <TouchableOpacity style={[s.tierBadge, { backgroundColor: tier.color + '30', borderColor: tier.color }]}
            onPress={() => navigation.navigate('Profil')}>
            <Text style={{ fontSize: 18 }}>{tier.emoji}</Text>
            <Text style={[s.tierBadgeLabel, { color: tier.color }]}>{tier.name}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={BRAND.orange} />}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── Carte Wallet ── */}
          <View style={s.walletCard}>
            <View style={s.walletTop}>
              <Text style={s.walletLabel}>Solde disponible</Text>
              <TouchableOpacity onPress={() => setHidden(h => !h)} style={s.eyeBtn}>
                <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
            {loading ? (
              <SkeletonBox w={180} h={40} r={8} style={{ marginVertical: 6 }} />
            ) : (
              <Text style={s.walletBalance}>
                {hidden ? '••••••' : fmt(balance)} <Text style={s.walletCur}>FCFA</Text>
              </Text>
            )}
            <View style={s.walletActions}>
              <TouchableOpacity style={s.walletBtn} onPress={() => navigation.navigate('WalletPay')}>
                <Ionicons name="add-circle-outline" size={16} color={BRAND.orange} />
                <Text style={s.walletBtnTxt}>Recharger</Text>
              </TouchableOpacity>
              <View style={s.walletDivider} />
              <TouchableOpacity style={s.walletBtn} onPress={() => navigation.navigate('Wallet')}>
                <Ionicons name="time-outline" size={16} color={BRAND.blueL} />
                <Text style={[s.walletBtnTxt, { color: BRAND.blueL }]}>Historique</Text>
              </TouchableOpacity>
              <View style={s.walletDivider} />
              <TouchableOpacity style={s.walletBtn} onPress={() => navigation.navigate('Profil', { screen: 'PremiumMain' })}>
                <Text style={{ fontSize: 14 }}>{tier.emoji}</Text>
                <Text style={[s.walletBtnTxt, { color: tier.color }]}>Mon tier</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Cashback Gauge ── */}
          <View style={s.cashbackCard}>
            <View style={s.cashbackHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>🎁</Text>
                <View>
                  <Text style={s.cashbackTitle}>Cashback accumulé</Text>
                  <Text style={s.cashbackSub}>Utilisable sur tous les services</Text>
                </View>
              </View>
              <Text style={s.cashbackAmount}>{fmt(cashback)} F</Text>
            </View>
            <View style={s.gaugeTrack}>
              <Animated.View style={[s.gaugeFill, { width: `${tierProgress}%`, backgroundColor: tier.color }]} />
            </View>
            <View style={s.gaugeLabels}>
              <Text style={s.gaugeLabel}>{tier.emoji} {tier.name}</Text>
              {nextTier && (
                <Text style={s.gaugeLabel}>
                  {fmt(tier.max - totalSpent)} F → {nextTierKey} {nextTier.emoji}
                </Text>
              )}
            </View>
          </View>

          {/* ── Services ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Nos services</Text>
            <View style={s.servicesGrid}>
              {SERVICES.map(svc => (
                <TouchableOpacity
                  key={svc.id}
                  style={s.serviceCard}
                  onPress={() => {
                    if (!svc.screen) return;
                    if (svc.tab) navigation.navigate(svc.tab, { screen: svc.screen });
                    else navigation.navigate(svc.screen);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[s.serviceIconBg, { backgroundColor: svc.color + '18' }]}>
                    <Text style={s.serviceIcon}>{svc.icon}</Text>
                  </View>
                  <Text style={s.serviceLabel}>{svc.label}</Text>
                  <Text style={s.serviceSub} numberOfLines={1}>{svc.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Actions rapides ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Actions rapides</Text>
            <View style={s.quickRow}>
              {[
                { icon: 'qr-code',       label: 'Mon QR',       color: BRAND.orange,  nav: () => navigation.navigate('WalletPay') },
                { icon: 'compass',       label: 'Explorer',     color: BRAND.blue,    nav: () => navigation.navigate('Explorer', { screen: 'Discover' }) },
                { icon: 'bed-outline',   label: 'Mes hôtels',   color: '#19A99D',     nav: () => navigation.navigate('MyBookings') },
                { icon: 'bus-outline',   label: 'Mes voyages',  color: '#6366F1',     nav: () => navigation.navigate('MyTrips') },
              ].map((a, i) => (
                <TouchableOpacity key={i} style={s.quickItem} onPress={a.nav}>
                  <View style={[s.quickIcon, { backgroundColor: a.color + '18' }]}>
                    <Ionicons name={a.icon} size={22} color={a.color} />
                  </View>
                  <Text style={s.quickLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Bouton SOKORA Black */}
            <TouchableOpacity
              style={s.blackBtn}
              onPress={() => navigation.navigate('Loyalty')}
              activeOpacity={0.88}
            >
              <Text style={s.blackBtnIcon}>🖤</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.blackBtnTitle}>SOKORA Black</Text>
                <Text style={s.blackBtnSub}>Programme de fidélité · {tier.name} {tier.emoji}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B9F2FF" />
            </TouchableOpacity>
          </View>

          {/* ── Carte promo cashback ── */}
          <View style={s.promoCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.promoTitle}>💸 Gagne plus de cashback</Text>
              <Text style={s.promoSub}>
                Niveau {tier.name} = {tier.cashback}% sur chaque paiement SOKORA
              </Text>
            </View>
            <TouchableOpacity style={s.promoBtn} onPress={() => navigation.navigate('Profil', { screen: 'PremiumMain' })}>
              <Text style={s.promoBtnTxt}>Voir →</Text>
            </TouchableOpacity>
          </View>

          {/* ── Langue / Language ── */}
          <View style={{ marginHorizontal: 16, marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, color: BRAND.muted, fontWeight: '600' }}>
              🌐 {t('profile.language')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[{ id: 'fr', label: '🇫🇷 FR' }, { id: 'en', label: '🇬🇧 EN' }].map(l => (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => setLang(l.id)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99,
                    backgroundColor: lang === l.id ? BRAND.orange : BRAND.bg,
                    borderWidth: 1.5, borderColor: lang === l.id ? BRAND.orange : BRAND.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: lang === l.id ? '#fff' : BRAND.muted }}>
                    {l.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </Animated.View>
      </Animated.ScrollView>

      {/* ── Bouton Scan flottant (FAB) ── */}
      <Animated.View style={[s.fab, { transform: [{ scale: scanScale }] }]}>
        <TouchableOpacity
          style={s.fabBtn}
          onPress={openScanner}
          activeOpacity={0.9}
        >
          <Ionicons name="scan-circle-outline" size={28} color="#fff" />
          <Text style={s.fabLabel}>SCAN</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Modal QR Wallet dynamique (MaxIT style) ── */}
      <Modal visible={showQRModal} transparent animationType="fade" onRequestClose={closeQRModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(26,46,74,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 28, padding: 28, alignItems: 'center', width: 300 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 20 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: BRAND.navy }}>Mon QR SOKORA</Text>
                <Text style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>Présentez à la caisse pour payer</Text>
              </View>
              <TouchableOpacity onPress={closeQRModal} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            {/* QR Code */}
            <View style={{ padding: 14, backgroundColor: BRAND.bg, borderRadius: 20, borderWidth: 2, borderColor: BRAND.orange + '30' }}>
              {qrToken
                ? <QRCode value={qrToken} size={180} color={BRAND.navy} backgroundColor="#F2F5FB" />
                : <View style={{ width: 180, height: 180, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={BRAND.orange} />
                  </View>
              }
            </View>

            {/* Timer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: qrTimer <= 3 ? '#FFF0F0' : BRAND.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: qrTimer <= 3 ? '#E84040' : BRAND.orange }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: qrTimer <= 3 ? '#E84040' : BRAND.orange }}>{qrTimer}</Text>
              </View>
              <Text style={{ fontSize: 12, color: BRAND.muted }}>
                {qrTimer <= 3 ? 'Renouvellement...' : 'Nouveau code dans ' + qrTimer + 's'}
              </Text>
            </View>

            {/* Wallet balance */}
            {wallet && (
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: BRAND.border, width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: BRAND.muted, fontWeight: '600' }}>SOLDE WALLET</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: BRAND.navy, marginTop: 4 }}>
                  {hidden ? '••• ••• F' : `${wallet.balance?.toLocaleString('fr-FR') ?? 0} F`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal Scanner QR ── */}
      <Modal visible={showScanModal} animationType="slide" onRequestClose={() => setShowScanModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={qrScanned ? undefined : handleQRScan}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
          {/* Cadre de scan */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 260, height: 260, borderRadius: 20, borderWidth: 3, borderColor: BRAND.orange, backgroundColor: 'transparent' }} />
          </View>
          {/* Instructions */}
          <View style={{ position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 4 }}>
              Scanner un QR SOKORA
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6 }}>
              QR de paiement ou QR Wallet
            </Text>
          </View>
          {/* Fermer */}
          <TouchableOpacity
            style={{ position: 'absolute', bottom: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 50, padding: 12 }}
            onPress={() => setShowScanModal(false)}
          >
            <Ionicons name="close-circle" size={52} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },

  // Header
  header: {
    backgroundColor: BRAND.navy,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: 20,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  headerTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon:     { width: 32, height: 32, borderRadius: 8, backgroundColor: BRAND.orange, justifyContent: 'center', alignItems: 'center' },
  logoText:     { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  notifBtn:     { padding: 4 },
  headerBody:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  greeting:     { fontSize: 20, fontWeight: '800', color: '#fff' },
  tagline:      { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3 },
  tierBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  tierBadgeLabel:{ fontSize: 12, fontWeight: '700' },

  // Wallet card
  walletCard: {
    margin: 16, marginTop: 16,
    backgroundColor: BRAND.navy,
    borderRadius: 20, padding: 20,
    ...Shadow.lg,
  },
  walletTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  eyeBtn:       { padding: 4 },
  walletBalance:{ fontSize: 34, fontWeight: '900', color: '#fff', marginVertical: 6 },
  walletCur:    { fontSize: 16, fontWeight: '400' },
  walletActions:{ flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 14 },
  walletBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  walletBtnTxt: { fontSize: 12, fontWeight: '700', color: BRAND.orange },
  walletDivider:{ width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 4 },

  // Cashback gauge
  cashbackCard: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: BRAND.surface,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: BRAND.border,
    ...Shadow.sm,
  },
  cashbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cashbackTitle:  { fontSize: 14, fontWeight: '700', color: BRAND.text },
  cashbackSub:    { fontSize: 11, color: BRAND.muted, marginTop: 1 },
  cashbackAmount: { fontSize: 20, fontWeight: '900', color: BRAND.orange },
  gaugeTrack:     { height: 8, backgroundColor: BRAND.border, borderRadius: 4, overflow: 'hidden' },
  gaugeFill:      { height: '100%', borderRadius: 4 },
  gaugeLabels:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  gaugeLabel:     { fontSize: 11, color: BRAND.muted, fontWeight: '600' },

  // Section
  section:      { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: BRAND.text, marginBottom: 12 },

  // Services grid
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceCard: {
    width: (W - 32 - 10) / 2,
    backgroundColor: BRAND.surface,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: BRAND.border,
    gap: 4,
    ...Shadow.sm,
  },
  serviceIconBg: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  serviceIcon:   { fontSize: 26 },
  serviceLabel:  { fontSize: 14, fontWeight: '700', color: BRAND.text },
  serviceSub:    { fontSize: 11, color: BRAND.muted },

  // Quick actions
  quickRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: { alignItems: 'center', gap: 6, flex: 1 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  quickLabel:{ fontSize: 11, fontWeight: '600', color: BRAND.text, textAlign: 'center' },

  // SOKORA Black button
  blackBtn: {
    marginTop: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0f1e35',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#B9F2FF33',
    ...Shadow.sm,
  },
  blackBtnIcon:  { fontSize: 24 },
  blackBtnTitle: { fontSize: 14, fontWeight: '800', color: '#B9F2FF', letterSpacing: 0.5 },
  blackBtnSub:   { fontSize: 11, color: '#7a8fab', marginTop: 2 },

  // Promo card
  promoCard: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: BRAND.orange + '12',
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: BRAND.orange + '30',
  },
  promoTitle:  { fontSize: 14, fontWeight: '700', color: BRAND.text },
  promoSub:    { fontSize: 12, color: BRAND.muted, marginTop: 3 },
  promoBtn:    { backgroundColor: BRAND.orange, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  promoBtnTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
  },
  fabBtn: {
    backgroundColor: BRAND.orange,
    borderRadius: 36, width: 72, height: 72,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: BRAND.orange, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 12, gap: 2,
  },
  fabLabel: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 1 },
});
