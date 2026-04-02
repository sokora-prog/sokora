/**
 * MyBookingsScreen — Mes réservations hôtel
 * Liste toutes les réservations du client connecté avec QR code check-in.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, Platform,
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
  gold:'#F59E0B', purple:'#6366F1',
};

const STATUS = {
  CONFIRMED: { label: 'Confirmée',   color: B.green,   bg: B.greenPale },
  CHECKED_IN:{ label: 'Checked-in', color: B.purple,  bg: '#EEF0FF'   },
  CHECKED_OUT:{ label: 'Terminée',  color: B.muted,   bg: '#F5F5F5'   },
  CANCELLED: { label: 'Annulée',    color: B.red,     bg: B.redPale   },
  NO_SHOW:   { label: 'No-show',    color: B.muted,   bg: '#F5F5F5'   },
};

async function getClientToken() {
  if (Platform.OS === 'web') return localStorage.getItem('sokora_client_token');
  try { return await SecureStore.getItemAsync('sokora_client_token'); } catch { return null; }
}

export default function MyBookingsScreen({ navigation }) {
  const { t } = useTranslation();
  const [bookings,    setBookings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [qrModal,     setQrModal]     = useState(null);   // booking selectionné pour QR
  const [cancelling,  setCancelling]  = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = await getClientToken();
      if (!token) { setLoading(false); return; }
      const res = await fetch(`${API_URL}/hotel/reservations/my`, {
        headers: { 'X-Client-Token': token },
      });
      if (res.ok) setBookings(await res.json());
    } catch {}
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleCancel = (booking) => {
    Alert.alert(
      t('hotel.cancel'),
      `Annuler ${booking.hotel_name} du ${booking.checkin_date} au ${booking.checkout_date} ?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'), style: 'destructive',
          onPress: async () => {
            setCancelling(booking.id);
            try {
              const token = await getClientToken();
              const res = await fetch(`${API_URL}/hotel/reservations/${booking.id}/cancel`, {
                method: 'POST',
                headers: { 'X-Client-Token': token },
              });
              if (res.ok) {
                Alert.alert('Annulée', 'Votre réservation a été annulée.');
                load();
              } else {
                const d = await res.json();
                Alert.alert('Erreur', d.detail ?? 'Annulation impossible');
              }
            } catch {
              Alert.alert('Erreur', 'Impossible de joindre le serveur.');
            }
            setCancelling(null);
          },
        },
      ]
    );
  };

  const fmt = n => (n ?? 0).toLocaleString('fr-FR');

  return (
    <View style={s.root}>
      {/* Nav */}
      <View style={s.nav}>
        {navigation && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={s.navTitle}>{t('hotel.my_bookings')}</Text>
        <TouchableOpacity onPress={load} style={s.backBtn}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={B.orange} style={{ flex: 1 }} size="large" />
      ) : bookings.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 56 }}>🏨</Text>
          <Text style={s.emptyTitle}>{t('hotel.booking_empty')}</Text>
          <Text style={s.emptyTxt}>Vos réservations hôtel apparaîtront ici.</Text>
          <TouchableOpacity
            style={s.cta}
            onPress={() => navigation?.navigate('HotelSearch')}
          >
            <Text style={s.ctaTxt}>Trouver un hôtel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {bookings.map(b => {
            const st = STATUS[b.status] ?? STATUS.CONFIRMED;
            const isActive = b.status === 'CONFIRMED';
            return (
              <View key={b.id} style={[s.card, isActive && s.cardActive]}>
                {/* Header */}
                <View style={s.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.hotelName}>{b.hotel_name}</Text>
                    <Text style={s.roomNum}>Chambre {b.room_number ?? '—'}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[s.statusTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {/* Dates */}
                <View style={s.datesRow}>
                  <View style={s.dateChip}>
                    <Ionicons name="log-in-outline" size={13} color={B.orange} />
                    <Text style={s.dateChipTxt}>{b.checkin_date}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={B.muted} />
                  <View style={s.dateChip}>
                    <Ionicons name="log-out-outline" size={13} color={B.navy} />
                    <Text style={s.dateChipTxt}>{b.checkout_date}</Text>
                  </View>
                  <View style={[s.dateChip, { backgroundColor: B.navy }]}>
                    <Text style={[s.dateChipTxt, { color: '#fff', fontWeight: '700' }]}>
                      {b.nights ?? '—'} nuit{(b.nights ?? 0) > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {/* Total */}
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Total payé</Text>
                  <Text style={s.totalVal}>{fmt(b.total_amount)} F CFA</Text>
                </View>

                {/* Actions */}
                <View style={s.actions}>
                  {isActive && b.qr_code && (
                    <TouchableOpacity
                      style={s.qrBtn}
                      onPress={() => setQrModal(b)}
                    >
                      <Ionicons name="qr-code-outline" size={16} color="#fff" />
                      <Text style={s.qrBtnTxt}>QR Check-in</Text>
                    </TouchableOpacity>
                  )}
                  {isActive && (
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => handleCancel(b)}
                      disabled={cancelling === b.id}
                    >
                      {cancelling === b.id
                        ? <ActivityIndicator color={B.red} size="small" />
                        : <Text style={s.cancelBtnTxt}>Annuler</Text>
                      }
                    </TouchableOpacity>
                  )}
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
            <Text style={s.modalTitle}>QR Code Check-in</Text>
            <Text style={s.modalHotel}>{qrModal?.hotel_name}</Text>
            <Text style={s.modalRoom}>Chambre {qrModal?.room_number}</Text>

            {qrModal?.qr_code && (
              <View style={s.qrWrapper}>
                <QRCode
                  value={qrModal.qr_code}
                  size={200}
                  color={B.navy}
                  backgroundColor="#fff"
                />
              </View>
            )}

            <Text style={s.qrHint}>
              Présentez ce code à la réception pour effectuer votre check-in
            </Text>
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

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  hotelName:  { fontSize: 16, fontWeight: '800', color: B.navy },
  roomNum:    { fontSize: 12, color: B.muted, marginTop: 2 },
  statusBadge:{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusTxt:  { fontSize: 11, fontWeight: '700' },

  datesRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dateChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: B.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  dateChipTxt:{ fontSize: 12, color: B.navy },

  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  totalLabel: { fontSize: 13, color: B.muted },
  totalVal:   { fontSize: 15, fontWeight: '800', color: B.navy },

  actions:    { flexDirection: 'row', gap: 10 },
  qrBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: B.navy, borderRadius: 12, paddingVertical: 10 },
  qrBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancelBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: B.red + '55' },
  cancelBtnTxt:{ color: B.red, fontWeight: '700', fontSize: 13 },

  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:  { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center', paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', marginBottom: 20 },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: B.navy, marginBottom: 4 },
  modalHotel:  { fontSize: 15, fontWeight: '700', color: B.navy },
  modalRoom:   { fontSize: 13, color: B.muted, marginBottom: 20 },
  qrWrapper:   { padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: B.border, marginBottom: 16 },
  qrHint:      { fontSize: 12, color: B.muted, textAlign: 'center', maxWidth: 260, marginBottom: 6 },
  qrRef:       { fontSize: 11, color: B.muted, fontFamily: 'monospace', marginBottom: 20 },
  closeBtn:    { backgroundColor: B.navy, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14, width: '100%', alignItems: 'center' },
  closeBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
