/**
 * MyTripsScreen — Mes réservations voyage
 * Historique des billets de bus avec QR code d'embarquement.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Share, Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../../utils/constants';
import { useTranslation } from '../../services/i18n';

const B = {
  orange:'#F26D21', navy:'#1A2E4A', bg:'#F2F5FB',
  surface:'#FFFFFF', border:'#DDE4F0', muted:'#7A8FAB',
  green:'#4CAF6E', greenPale:'#F0FAF2', red:'#E84040', redPale:'#FFF0F0',
  teal:'#19A99D', tealPale:'#EDFAF8',
};

const STATUS = {
  CONFIRMED: { label: 'Confirmé',    color: B.green,   bg: B.greenPale },
  BOARDED:   { label: 'Embarqué',    color: B.teal,    bg: B.tealPale  },
  CANCELLED: { label: 'Annulé',      color: B.red,     bg: B.redPale   },
  COMPLETED: { label: 'Terminé',     color: B.muted,   bg: '#F5F5F5'   },
  PENDING:   { label: 'En attente',  color: B.orange,  bg: '#FFF4EA'   },
};

async function getClientToken() {
  if (Platform.OS === 'web') return localStorage.getItem('sokora_client_token');
  try { return await SecureStore.getItemAsync('sokora_client_token'); } catch { return null; }
}

export default function MyTripsScreen({ navigation }) {
  const { t } = useTranslation();
  const [trips,   setTrips]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = await getClientToken();
      if (!token) { setLoading(false); return; }
      const res = await fetch(`${API_URL}/voyage/bookings/me`, {
        headers: { 'X-Client-Token': token },
      });
      if (res.ok) setTrips(await res.json());
    } catch {}
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleShare = async (t) => {
    try {
      await Share.share({
        message: `🚌 Mon billet SOKORA Voyage\n${t.origin} → ${t.destination}\n${new Date(t.departure_at).toLocaleString('fr-FR')}\nSiège #${t.seat_number}\nRéf: #${t.id}`,
      });
    } catch {}
  };

  const fmt = (d) => new Date(d).toLocaleString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={s.root}>
      {/* Nav */}
      <View style={s.nav}>
        {navigation && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={s.navTitle}>{t('voyage.my_trips')}</Text>
        <TouchableOpacity onPress={load} style={s.backBtn}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={B.orange} style={{ flex: 1 }} size="large" />
      ) : trips.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 56 }}>🚌</Text>
          <Text style={s.emptyTitle}>{t('voyage.trip_empty')}</Text>
          <Text style={s.emptyTxt}>Vos billets de voyage apparaîtront ici.</Text>
          <TouchableOpacity style={s.cta} onPress={() => navigation?.navigate('VoyageSearch')}>
            <Text style={s.ctaTxt}>Chercher un voyage</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {trips.map(t => {
            const st = STATUS[t.status] ?? STATUS.CONFIRMED;
            const isActive = t.status === 'CONFIRMED';
            return (
              <View key={t.id} style={[s.card, isActive && s.cardActive]}>
                {/* Route */}
                <View style={s.routeRow}>
                  <View style={{ flex: 1 }}>
                    <View style={s.routeCities}>
                      <Text style={s.city}>{t.origin}</Text>
                      <Ionicons name="arrow-forward" size={16} color={B.orange} />
                      <Text style={s.city}>{t.destination}</Text>
                    </View>
                    <Text style={s.departure}>{fmt(t.departure_at)}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[s.statusTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {/* Détails */}
                <View style={s.detailsRow}>
                  <View style={s.detail}>
                    <Ionicons name="grid-outline" size={14} color={B.muted} />
                    <Text style={s.detailTxt}>Siège #{t.seat_number}</Text>
                  </View>
                  <View style={s.detail}>
                    <Ionicons name="card-outline" size={14} color={B.muted} />
                    <Text style={s.detailTxt}>{(t.amount_paid ?? 0).toLocaleString('fr-FR')} F</Text>
                  </View>
                  <View style={s.detail}>
                    <Ionicons name="barcode-outline" size={14} color={B.muted} />
                    <Text style={s.detailTxt}>#{t.id}</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={s.actions}>
                  {t.qr_token && isActive && (
                    <TouchableOpacity style={s.qrBtn} onPress={() => setQrModal(t)}>
                      <Ionicons name="qr-code-outline" size={15} color="#fff" />
                      <Text style={s.qrBtnTxt}>{t('voyage.qr_boarding')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.shareBtn} onPress={() => handleShare(t)}>
                    <Ionicons name="share-outline" size={15} color={B.navy} />
                    <Text style={s.shareBtnTxt}>Partager</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Modal QR Code */}
      <Modal visible={!!qrModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>QR d'embarquement</Text>
            <View style={s.modalRoute}>
              <Text style={s.modalCity}>{qrModal?.origin}</Text>
              <Ionicons name="arrow-forward" size={18} color={B.orange} />
              <Text style={s.modalCity}>{qrModal?.destination}</Text>
            </View>
            <Text style={s.modalDep}>{qrModal ? fmt(qrModal.departure_at) : ''}</Text>
            <Text style={s.modalSeat}>Siège #{qrModal?.seat_number}</Text>

            {qrModal?.qr_token && (
              <View style={s.qrWrapper}>
                <QRCode
                  value={qrModal.qr_token}
                  size={200}
                  color={B.navy}
                  backgroundColor="#fff"
                />
              </View>
            )}

            <Text style={s.qrHint}>Présentez ce code au chauffeur lors de l'embarquement</Text>
            <Text style={s.qrRef}>Réf: #{qrModal?.id}</Text>

            <TouchableOpacity style={s.closeBtn} onPress={() => setQrModal(null)}>
              <Text style={s.closeBtnTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: B.bg },

  nav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: B.navy },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  navTitle:{ fontSize: 17, fontWeight: '800', color: '#fff' },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: B.navy, marginTop: 12 },
  emptyTxt:   { fontSize: 14, color: B.muted, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  cta:        { backgroundColor: B.orange, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  ctaTxt:     { color: '#fff', fontWeight: '800', fontSize: 15 },

  card:       { backgroundColor: B.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: B.border },
  cardActive: { borderColor: B.orange + '55' },

  routeRow:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  routeCities:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  city:       { fontSize: 16, fontWeight: '800', color: B.navy },
  departure:  { fontSize: 12, color: B.muted },
  statusBadge:{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusTxt:  { fontSize: 11, fontWeight: '700' },

  detailsRow: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  detail:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailTxt:  { fontSize: 12, color: B.muted },

  actions:    { flexDirection: 'row', gap: 10 },
  qrBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: B.navy, borderRadius: 12, paddingVertical: 10 },
  qrBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  shareBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: B.border },
  shareBtnTxt:{ color: B.navy, fontWeight: '600', fontSize: 13 },

  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:  { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center', paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', marginBottom: 20 },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: B.navy, marginBottom: 12 },
  modalRoute:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  modalCity:   { fontSize: 18, fontWeight: '800', color: B.navy },
  modalDep:    { fontSize: 13, color: B.muted, marginBottom: 4 },
  modalSeat:   { fontSize: 15, fontWeight: '700', color: B.navy, marginBottom: 20 },
  qrWrapper:   { padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: B.border, marginBottom: 16 },
  qrHint:      { fontSize: 12, color: B.muted, textAlign: 'center', maxWidth: 260, marginBottom: 6 },
  qrRef:       { fontSize: 11, color: B.muted, fontFamily: 'monospace', marginBottom: 20 },
  closeBtn:    { backgroundColor: B.navy, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14, width: '100%', alignItems: 'center' },
  closeBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
