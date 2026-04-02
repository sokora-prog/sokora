/**
 * HotelDetailScreen — SOKORA Hotels
 * Détail hôtel, sélection chambre, réservation wallet, check-in QR
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Animated, ActivityIndicator,
  Dimensions, Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../../utils/constants';
import { Shadow, Radius } from '../../utils/constants';
import { walletService } from '../../services/api';
import { useAuth } from '../../services/AuthContext';

async function getClientToken() {
  if (Platform.OS === 'web') return localStorage.getItem('sokora_client_token');
  try { return await SecureStore.getItemAsync('sokora_client_token'); } catch { return null; }
}

const { width: W } = Dimensions.get('window');

const BRAND = {
  orange:'#F26D21', orangeL:'#F9A050', orangePale:'#FFF4EA',
  blue:'#3065A6',   blueL:'#7AA6D4',   bluePale:'#EFF4FB',
  navy:'#1A2E4A',   bg:'#F2F5FB',
  surface:'#FFFFFF',border:'#DDE4F0',
  text:'#1A2E4A',   muted:'#7A8FAB',
  green:'#4CAF6E',  greenPale:'#F0FAF2',
  red:'#E84040',    redPale:'#FFF0F0',
  gold:'#F59E0B',
};

const ROOM_STATUS = {
  AVAILABLE:   { label: 'Disponible',   color: BRAND.green,  bg: BRAND.greenPale },
  OCCUPIED:    { label: 'Occupée',      color: BRAND.red,    bg: BRAND.redPale   },
  RESERVED:    { label: 'Réservée',     color: '#6366F1',    bg: '#EEF0FF'       },
  CLEANING:    { label: 'Nettoyage',    color: BRAND.gold,   bg: '#FFFBEB'       },
  MAINTENANCE: { label: 'Maintenance',  color: BRAND.muted,  bg: BRAND.bg        },
};

const ROOM_TYPES = {
  SIMPLE:   { label: 'Simple',   icon: '🛏️',  color: '#6366F1' },
  DOUBLE:   { label: 'Double',   icon: '🛏️🛏️', color: BRAND.blue  },
  SUITE:    { label: 'Suite',    icon: '👑',   color: BRAND.orange },
  STANDARD: { label: 'Standard', icon: '🏠',   color: '#19A99D' },
};

function Stars({ rating }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={14} color={BRAND.gold} />
      ))}
      <Text style={{ fontSize: 12, color: BRAND.muted, marginLeft: 4 }}>{rating?.toFixed(1)}</Text>
    </View>
  );
}

export default function HotelDetailScreen({ route, navigation }) {
  const { hotel, checkin, checkout, nights = 1 } = route.params ?? {};
  const { user } = useAuth();

  const [rooms,       setRooms]       = useState([]);
  const [reviews,     setReviews]     = useState([]);
  const [wallet,      setWallet]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('rooms');
  const [selectedRoom,setSelectedRoom]= useState(null);
  const [bookModal,   setBookModal]   = useState(false);
  const [guests,      setGuests]      = useState('1');
  const [requests,    setRequests]    = useState('');
  const [booking,     setBooking]     = useState(false);
  const [confirmed,   setConfirmed]   = useState(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const bannerH = scrollY.interpolate({ inputRange: [0, 160], outputRange: [200, 100], extrapolate: 'clamp' });
  const bannerOp = scrollY.interpolate({ inputRange: [0, 160], outputRange: [1, 0], extrapolate: 'clamp' });

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  const loadAll = async () => {
    try {
      const [roomsRes, reviewsRes, walletRes] = await Promise.all([
        fetch(`${API_URL}/hotel/${hotel?.id}/availability?checkin_date=${checkin}&checkout_date=${checkout}`)
          .then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_URL}/hotel/${hotel?.id}/reviews`)
          .then(r => r.ok ? r.json() : []).catch(() => []),
        walletService.getMyWallet().catch(() => null),
      ]);
      setRooms(Array.isArray(roomsRes) ? roomsRes : DEMO_ROOMS);
      setReviews(Array.isArray(reviewsRes) ? reviewsRes : DEMO_REVIEWS);
      if (walletRes?.data) setWallet(walletRes.data);
    } catch {
      setRooms(DEMO_ROOMS);
      setReviews(DEMO_REVIEWS);
    }
    setLoading(false);
  };

  const doBook = async () => {
    if (!selectedRoom) return;
    setBooking(true);
    try {
      const clientToken = await getClientToken();
      if (!clientToken) {
        Alert.alert('Non connecté', 'Vous devez être connecté en tant que client pour réserver.');
        setBooking(false);
        return;
      }
      const res = await fetch(`${API_URL}/hotel/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Token': clientToken },
        body: JSON.stringify({
          hotel_id:         hotel?.id ?? 1,
          room_id:          selectedRoom.id,
          checkin_date:     checkin,
          checkout_date:    checkout,
          guest_count:      parseInt(guests) || 1,
          special_requests: requests || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfirmed({
          ...data,
          hotel_name:    data.hotel_name    ?? hotel?.name ?? 'Hôtel SOKORA',
          room_number:   data.room_number   ?? selectedRoom.room_number ?? '101',
          checkin_date:  data.checkin_date  ?? checkin,
          checkout_date: data.checkout_date ?? checkout,
          status:        data.status        ?? 'CONFIRMED',
          qr_code:       data.qr_code,
        });
        setBookModal(false);
      } else {
        Alert.alert('Réservation impossible', data.detail ?? 'Veuillez réessayer.');
      }
    } catch (e) {
      Alert.alert('Erreur réseau', 'Impossible de joindre le serveur. Vérifiez votre connexion.');
    }
    setBooking(false);
  };

  const fmt = n => (n ?? 0).toLocaleString('fr-FR');
  const balance = wallet?.balance ?? 0;

  const TABS = [
    { id: 'rooms',   label: '🛏️ Chambres' },
    { id: 'info',    label: 'ℹ️ Infos' },
    { id: 'reviews', label: '⭐ Avis' },
  ];

  if (confirmed) {
    return <ConfirmationScreen booking={confirmed} onClose={() => { setConfirmed(null); navigation.goBack(); }} />;
  }

  return (
    <View style={s.root}>
      {/* ── Banner animé ── */}
      <Animated.View style={[s.banner, { height: bannerH }]}>
        <Animated.View style={[s.bannerEmoji, { opacity: bannerOp }]}>
          <Text style={{ fontSize: 72 }}>🏨</Text>
        </Animated.View>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        {hotel?.is_premium && (
          <View style={s.premiumBadge}>
            <Text style={s.premiumTxt}>✨ Premium</Text>
          </View>
        )}
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Info principale ── */}
        <View style={s.mainCard}>
          <View style={s.hotelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.hotelName}>{hotel?.name ?? 'Hôtel SOKORA'}</Text>
              <Stars rating={hotel?.rating ?? 4.5} />
            </View>
            {hotel?.is_verified && (
              <View style={s.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={BRAND.blue} />
                <Text style={s.verifiedTxt}>Vérifié</Text>
              </View>
            )}
          </View>
          <View style={s.addrRow}>
            <Ionicons name="location-outline" size={14} color={BRAND.muted} />
            <Text style={s.addr}>{hotel?.address ?? hotel?.city ?? 'Abidjan'}</Text>
          </View>
          <View style={s.dateChips}>
            <View style={s.dateChip}>
              <Ionicons name="log-in-outline" size={14} color={BRAND.blue} />
              <Text style={s.dateChipTxt}>Arrivée : {checkin}</Text>
            </View>
            <View style={s.dateChip}>
              <Ionicons name="log-out-outline" size={14} color={BRAND.orange} />
              <Text style={s.dateChipTxt}>Départ : {checkout}</Text>
            </View>
            <View style={[s.dateChip, { backgroundColor: BRAND.navy }]}>
              <Text style={[s.dateChipTxt, { color: '#fff', fontWeight: '800' }]}>{nights} nuit{nights > 1 ? 's' : ''}</Text>
            </View>
          </View>
        </View>

        {/* ── Tabs ── */}
        <View style={s.tabsRow}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.tab, activeTab === t.id && s.tabActive]}
              onPress={() => setActiveTab(t.id)}
            >
              <Text style={[s.tabTxt, activeTab === t.id && s.tabTxtActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── CHAMBRES ── */}
        {activeTab === 'rooms' && (
          <View style={s.section}>
            {loading ? (
              <ActivityIndicator color={BRAND.orange} style={{ marginTop: 40 }} />
            ) : rooms.length === 0 ? (
              <View style={s.empty}>
                <Text style={{ fontSize: 40 }}>😔</Text>
                <Text style={s.emptyTxt}>Aucune chambre disponible pour ces dates</Text>
              </View>
            ) : (
              rooms.map(room => {
                const rt = ROOM_TYPES[room.type] ?? ROOM_TYPES.STANDARD;
                const st = ROOM_STATUS[room.status] ?? ROOM_STATUS.AVAILABLE;
                const isAvail = room.status === 'AVAILABLE';
                const total = (room.base_price ?? 0) * nights;
                const isSelected = selectedRoom?.id === room.id;

                return (
                  <TouchableOpacity
                    key={room.id}
                    style={[s.roomCard, isSelected && s.roomCardSelected, !isAvail && s.roomCardDisabled]}
                    onPress={() => isAvail && setSelectedRoom(room)}
                    activeOpacity={isAvail ? 0.85 : 1}
                  >
                    <View style={s.roomLeft}>
                      <View style={[s.roomTypeBadge, { backgroundColor: rt.color + '18' }]}>
                        <Text style={{ fontSize: 22 }}>{rt.icon}</Text>
                      </View>
                    </View>
                    <View style={s.roomBody}>
                      <View style={s.roomTitleRow}>
                        <Text style={s.roomName}>Chambre {room.room_number ?? room.id}</Text>
                        <View style={[s.roomStatusBadge, { backgroundColor: st.bg }]}>
                          <Text style={[s.roomStatusTxt, { color: st.color }]}>{st.label}</Text>
                        </View>
                      </View>
                      <Text style={s.roomType}>{rt.label} · {room.capacity ?? 2} pers.</Text>
                      {room.amenities && room.amenities.length > 0 && (
                        <Text style={s.roomAmenities} numberOfLines={1}>
                          {room.amenities.slice(0, 3).join(' · ')}
                        </Text>
                      )}
                      <View style={s.roomPriceRow}>
                        <Text style={s.roomPrice}>{fmt(room.base_price)} F<Text style={s.roomPriceSub}>/nuit</Text></Text>
                        {nights > 1 && <Text style={s.roomTotal}>{fmt(total)} F total</Text>}
                      </View>
                    </View>
                    {isSelected && (
                      <View style={s.checkMark}>
                        <Ionicons name="checkmark-circle" size={24} color={BRAND.green} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ── INFO ── */}
        {activeTab === 'info' && (
          <View style={s.section}>
            {[
              { icon: 'call-outline',       label: 'Téléphone',   value: hotel?.phone ?? '+225 00 00 00 00' },
              { icon: 'mail-outline',        label: 'Email',       value: hotel?.email ?? 'hotel@sokora.ci' },
              { icon: 'time-outline',        label: 'Horaires',    value: hotel?.hours ?? 'Check-in 14h · Check-out 12h' },
              { icon: 'wifi-outline',        label: 'WiFi',        value: 'Inclus dans toutes les chambres' },
              { icon: 'card-outline',        label: 'Paiement',    value: 'Wallet SOKORA · Orange Money · Wave · Espèces' },
              { icon: 'shield-checkmark-outline', label: 'Annulation', value: 'Gratuite jusqu\'à 24h avant l\'arrivée' },
            ].map((item, i) => (
              <View key={i} style={s.infoRow}>
                <Ionicons name={item.icon} size={18} color={BRAND.blue} />
                <View>
                  <Text style={s.infoLabel}>{item.label}</Text>
                  <Text style={s.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── AVIS ── */}
        {activeTab === 'reviews' && (
          <View style={s.section}>
            {reviews.length === 0 ? (
              <View style={s.empty}>
                <Text style={{ fontSize: 40 }}>💬</Text>
                <Text style={s.emptyTxt}>Aucun avis pour l'instant</Text>
              </View>
            ) : (
              reviews.map((rev, i) => (
                <View key={i} style={s.reviewCard}>
                  <View style={s.reviewHeader}>
                    <View style={s.reviewAvatar}>
                      <Text style={{ fontSize: 18 }}>👤</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.reviewAuthor}>{rev.author ?? 'Client SOKORA'}</Text>
                      <Stars rating={rev.rating ?? 5} />
                    </View>
                    <Text style={s.reviewDate}>{rev.date ?? 'Récent'}</Text>
                  </View>
                  {rev.comment && <Text style={s.reviewComment}>{rev.comment}</Text>}
                </View>
              ))
            )}
          </View>
        )}
      </Animated.ScrollView>

      {/* ── Barre de réservation ── */}
      {selectedRoom && (
        <View style={s.bookBar}>
          <View>
            <Text style={s.bookBarLabel}>Chambre sélectionnée</Text>
            <Text style={s.bookBarPrice}>
              {fmt(selectedRoom.base_price * nights)} F
              <Text style={s.bookBarNights}> · {nights} nuit{nights > 1 ? 's' : ''}</Text>
            </Text>
          </View>
          <TouchableOpacity style={s.bookBarBtn} onPress={() => setBookModal(true)}>
            <Text style={s.bookBarBtnTxt}>Réserver →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Modal réservation ── */}
      <Modal visible={bookModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Confirmer la réservation</Text>

            {/* Récap */}
            <View style={s.modalRecap}>
              <Text style={s.modalRecapTitle}>{hotel?.name ?? 'Hôtel SOKORA'}</Text>
              <Text style={s.modalRecapRoom}>
                Chambre {selectedRoom?.room_number ?? selectedRoom?.id} · {ROOM_TYPES[selectedRoom?.type]?.label ?? 'Standard'}
              </Text>
              <View style={s.modalDates}>
                <Text style={s.modalDate}>📅 {checkin} → {checkout}</Text>
                <Text style={s.modalNights}>{nights} nuit{nights > 1 ? 's' : ''}</Text>
              </View>
            </View>

            <TextInput
              style={s.modalInput}
              placeholder="Nombre de voyageurs (1-4)"
              value={guests}
              onChangeText={setGuests}
              keyboardType="numeric"
              placeholderTextColor={BRAND.muted}
            />
            <TextInput
              style={[s.modalInput, { height: 80 }]}
              placeholder="Demandes spéciales (optionnel)"
              value={requests}
              onChangeText={setRequests}
              multiline
              placeholderTextColor={BRAND.muted}
            />

            {/* Total + wallet */}
            <View style={s.modalTotalRow}>
              <Text style={s.modalTotalLabel}>Total à payer</Text>
              <Text style={s.modalTotalAmount}>{fmt((selectedRoom?.base_price ?? 0) * nights)} F</Text>
            </View>
            <View style={s.modalWalletRow}>
              <Ionicons name="wallet-outline" size={16} color={balance >= (selectedRoom?.base_price ?? 0) * nights ? BRAND.green : BRAND.red} />
              <Text style={[s.modalWalletTxt, { color: balance >= (selectedRoom?.base_price ?? 0) * nights ? BRAND.green : BRAND.red }]}>
                Wallet : {fmt(balance)} F · {balance >= (selectedRoom?.base_price ?? 0) * nights ? 'Solde suffisant ✓' : 'Solde insuffisant'}
              </Text>
            </View>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setBookModal(false)}>
                <Text style={s.modalCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={doBook} disabled={booking}>
                {booking ? <ActivityIndicator color="#fff" /> : <Text style={s.modalConfirmTxt}>Confirmer & Payer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Écran de confirmation ─────────────────────────────────────────────────────
function ConfirmationScreen({ booking, onClose }) {
  const fmt = n => (n ?? 0).toLocaleString('fr-FR');
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(bounce, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={cs.root}>
      <Animated.View style={[cs.card, { transform: [{ scale: bounce }] }]}>
        <View style={cs.checkCircle}>
          <Ionicons name="checkmark" size={44} color="#fff" />
        </View>
        <Text style={cs.title}>Réservation confirmée !</Text>
        <Text style={cs.sub}>Votre chambre est réservée. Scannez le QR à l'arrivée.</Text>

        <View style={cs.ticket}>
          <Text style={cs.ticketHotel}>{booking.hotel_name}</Text>
          <Text style={cs.ticketRoom}>Chambre {booking.room_number}</Text>
          <View style={cs.ticketDates}>
            <View style={{ alignItems: 'center' }}>
              <Text style={cs.ticketDateLabel}>Arrivée</Text>
              <Text style={cs.ticketDateVal}>{booking.checkin_date}</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={BRAND.muted} />
            <View style={{ alignItems: 'center' }}>
              <Text style={cs.ticketDateLabel}>Départ</Text>
              <Text style={cs.ticketDateVal}>{booking.checkout_date}</Text>
            </View>
          </View>
          <View style={cs.separator}>
            {Array.from({ length: 24 }).map((_, i) => (
              <View key={i} style={cs.dashItem} />
            ))}
          </View>
          {/* QR Code check-in */}
          <View style={cs.qrBox}>
            {booking.qr_code ? (
              <QRCode
                value={booking.qr_code}
                size={140}
                color={BRAND.navy}
                backgroundColor="#fff"
              />
            ) : (
              <Text style={{ fontSize: 12, color: BRAND.muted, textAlign: 'center' }}>
                QR code en cours de génération…
              </Text>
            )}
          </View>
          <Text style={cs.qrHint}>Présentez ce QR à la réception pour le check-in</Text>
          <Text style={cs.qrRef}>Réf: #{booking.reservation_id ?? booking.id}</Text>
          <Text style={cs.ticketTotal}>Total payé : {fmt(booking.total_amount)} FCFA</Text>
        </View>

        <TouchableOpacity style={cs.closeBtn} onPress={onClose}>
          <Text style={cs.closeBtnTxt}>Parfait 🎉</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const cs = StyleSheet.create({
  root:       { flex: 1, backgroundColor: BRAND.navy, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:       { backgroundColor: BRAND.surface, borderRadius: 24, padding: 24, width: '100%', alignItems: 'center', ...Shadow.lg },
  checkCircle:{ width: 80, height: 80, borderRadius: 40, backgroundColor: BRAND.green, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title:      { fontSize: 22, fontWeight: '900', color: BRAND.text, marginBottom: 8 },
  sub:        { fontSize: 13, color: BRAND.muted, textAlign: 'center', marginBottom: 20 },
  ticket:     { width: '100%', backgroundColor: BRAND.bg, borderRadius: 16, padding: 16, alignItems: 'center' },
  ticketHotel:{ fontSize: 16, fontWeight: '800', color: BRAND.text },
  ticketRoom: { fontSize: 13, color: BRAND.muted, marginBottom: 12 },
  ticketDates:{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  ticketDateLabel:{ fontSize: 10, color: BRAND.muted, textTransform: 'uppercase' },
  ticketDateVal:  { fontSize: 15, fontWeight: '700', color: BRAND.text },
  separator:  { flexDirection: 'row', width: '100%', gap: 4, marginBottom: 12 },
  dashItem:   { flex: 1, height: 2, backgroundColor: BRAND.border },
  qrBox:      { padding: 12, backgroundColor: '#fff', borderRadius: 12, marginBottom: 6, alignItems: 'center', justifyContent: 'center', minHeight: 164 },
  qrHint:     { fontSize: 10, color: BRAND.muted, textAlign: 'center', marginBottom: 4, maxWidth: 220 },
  qrRef:      { fontSize: 10, color: BRAND.muted, fontFamily: 'monospace', marginBottom: 8 },
  ticketTotal:{ fontSize: 16, fontWeight: '900', color: BRAND.orange },
  closeBtn:   { marginTop: 20, backgroundColor: BRAND.orange, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14 },
  closeBtnTxt:{ fontSize: 16, fontWeight: '800', color: '#fff' },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.bg },
  banner: {
    backgroundColor: BRAND.blueL + '40',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative', overflow: 'hidden',
  },
  bannerEmoji: { position: 'absolute' },
  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 52 : 36, left: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  premiumBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 52 : 36, right: 16,
    backgroundColor: BRAND.gold, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  premiumTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },

  mainCard: {
    backgroundColor: BRAND.surface, marginHorizontal: 16, marginTop: -20,
    borderRadius: 20, padding: 16, ...Shadow.md,
    borderWidth: 1, borderColor: BRAND.border,
  },
  hotelHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  hotelName:   { fontSize: 20, fontWeight: '900', color: BRAND.text, marginBottom: 4 },
  verifiedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BRAND.bluePale, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedTxt: { fontSize: 11, fontWeight: '700', color: BRAND.blue },
  addrRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  addr:        { fontSize: 13, color: BRAND.muted },
  dateChips:   { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  dateChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BRAND.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: BRAND.border },
  dateChipTxt: { fontSize: 12, fontWeight: '600', color: BRAND.text },

  tabsRow:   { flexDirection: 'row', backgroundColor: BRAND.surface, marginTop: 12, borderBottomWidth: 1, borderBottomColor: BRAND.border },
  tab:       { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: BRAND.orange },
  tabTxt:    { fontSize: 13, fontWeight: '600', color: BRAND.muted },
  tabTxtActive:{ color: BRAND.orange, fontWeight: '800' },

  section: { padding: 16 },

  roomCard: {
    backgroundColor: BRAND.surface, borderRadius: 16, padding: 14, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: BRAND.border, ...Shadow.sm,
  },
  roomCardSelected: { borderColor: BRAND.green, backgroundColor: BRAND.greenPale },
  roomCardDisabled: { opacity: 0.5 },
  roomLeft:  {},
  roomTypeBadge:{ width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  roomBody:  { flex: 1 },
  roomTitleRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  roomName:  { fontSize: 15, fontWeight: '800', color: BRAND.text },
  roomStatusBadge:{ borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  roomStatusTxt:  { fontSize: 10, fontWeight: '700' },
  roomType:  { fontSize: 12, color: BRAND.muted, marginBottom: 4 },
  roomAmenities:{ fontSize: 11, color: BRAND.muted, marginBottom: 6 },
  roomPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roomPrice: { fontSize: 16, fontWeight: '900', color: BRAND.navy },
  roomPriceSub: { fontSize: 11, fontWeight: '400', color: BRAND.muted },
  roomTotal: { fontSize: 11, color: BRAND.orange, fontWeight: '700' },
  checkMark: { marginLeft: 4 },

  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BRAND.border,
  },
  infoLabel: { fontSize: 11, color: BRAND.muted, marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: '600', color: BRAND.text },

  reviewCard: {
    backgroundColor: BRAND.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: BRAND.border,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND.bg, justifyContent: 'center', alignItems: 'center' },
  reviewAuthor: { fontSize: 13, fontWeight: '700', color: BRAND.text },
  reviewDate:   { fontSize: 11, color: BRAND.muted },
  reviewComment:{ fontSize: 13, color: BRAND.text, lineHeight: 20 },

  empty:    { alignItems: 'center', paddingTop: 50, gap: 10 },
  emptyTxt: { fontSize: 14, color: BRAND.muted, textAlign: 'center' },

  bookBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: BRAND.surface, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    borderTopWidth: 1, borderTopColor: BRAND.border, ...Shadow.lg,
  },
  bookBarLabel: { fontSize: 11, color: BRAND.muted, fontWeight: '600' },
  bookBarPrice: { fontSize: 20, fontWeight: '900', color: BRAND.navy },
  bookBarNights:{ fontSize: 12, fontWeight: '400', color: BRAND.muted },
  bookBarBtn:   { backgroundColor: BRAND.orange, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
  bookBarBtnTxt:{ fontSize: 15, fontWeight: '800', color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: BRAND.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHandle:  { width: 40, height: 4, backgroundColor: BRAND.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: '900', color: BRAND.text, marginBottom: 16 },
  modalRecap:   { backgroundColor: BRAND.bg, borderRadius: 14, padding: 14, marginBottom: 14 },
  modalRecapTitle:{ fontSize: 15, fontWeight: '800', color: BRAND.text },
  modalRecapRoom: { fontSize: 13, color: BRAND.muted, marginTop: 2 },
  modalDates:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  modalDate:    { fontSize: 12, color: BRAND.text, fontWeight: '600' },
  modalNights:  { fontSize: 12, fontWeight: '700', color: BRAND.orange },
  modalInput:   { backgroundColor: BRAND.bg, borderRadius: 12, padding: 12, fontSize: 14, color: BRAND.text, marginBottom: 10, borderWidth: 1, borderColor: BRAND.border },
  modalTotalRow:{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: BRAND.border },
  modalTotalLabel:{ fontSize: 14, color: BRAND.muted, fontWeight: '600' },
  modalTotalAmount:{ fontSize: 20, fontWeight: '900', color: BRAND.navy },
  modalWalletRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  modalWalletTxt: { fontSize: 12, fontWeight: '600' },
  modalBtns:    { flexDirection: 'row', gap: 10 },
  modalCancel:  { flex: 1, backgroundColor: BRAND.bg, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: BRAND.border },
  modalCancelTxt:{ fontSize: 14, fontWeight: '700', color: BRAND.muted },
  modalConfirm: { flex: 2, backgroundColor: BRAND.orange, borderRadius: 14, padding: 14, alignItems: 'center' },
  modalConfirmTxt:{ fontSize: 14, fontWeight: '800', color: '#fff' },
});

const DEMO_ROOMS = [
  { id: 101, room_number: '101', type: 'SIMPLE',   status: 'AVAILABLE', base_price: 35000, capacity: 1, amenities: ['WiFi', 'Climatisation', 'TV'] },
  { id: 102, room_number: '102', type: 'DOUBLE',   status: 'AVAILABLE', base_price: 55000, capacity: 2, amenities: ['WiFi', 'Clim', 'TV', 'Minibar'] },
  { id: 201, room_number: '201', type: 'SUITE',    status: 'AVAILABLE', base_price: 120000, capacity: 4, amenities: ['WiFi', 'Jacuzzi', 'Vue mer', 'Service room'] },
  { id: 103, room_number: '103', type: 'STANDARD', status: 'OCCUPIED',  base_price: 28000, capacity: 2, amenities: ['WiFi', 'Climatisation'] },
  { id: 104, room_number: '104', type: 'DOUBLE',   status: 'CLEANING',  base_price: 55000, capacity: 2, amenities: ['WiFi', 'TV'] },
];

const DEMO_REVIEWS = [
  { author: 'Kofi A.', rating: 5, comment: 'Excellent séjour, personnel très accueillant. Chambre propre et climatisation parfaite.', date: 'Il y a 3 jours' },
  { author: 'Ama K.',  rating: 4, comment: 'Bonne adresse, proche du centre. Le petit-déjeuner est compris et copieux.', date: 'Il y a 1 semaine' },
  { author: 'Jean P.', rating: 5, comment: 'La suite est magnifique, vue imprenable. Je recommande vivement !', date: 'Il y a 2 semaines' },
];
