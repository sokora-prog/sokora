/**
 * BookingConfirmScreen — SOKORA Client
 * Affiche le billet de voyage avec QR code d'embarquement.
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Share,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';

const STATUS_CONFIG = {
  CONFIRMED: { label: '✅ Confirmée',  color: Colors.green,  bg: Colors.greenPale  },
  BOARDED:   { label: '🛂 Embarqué',   color: Colors.teal,   bg: Colors.tealPale   },
  PENDING:   { label: '⏳ En attente', color: Colors.orange, bg: Colors.orangePale },
  CANCELLED: { label: '❌ Annulée',   color: Colors.red,    bg: Colors.redPale    },
};

export default function BookingConfirmScreen({ route, navigation }) {
  const { booking } = route?.params || {};

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={{ color: Colors.textMuted }}>Réservation introuvable</Text>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.CONFIRMED;
  const departure = new Date(booking.departure_at);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🚌 Mon billet SOKORA Voyage\n${booking.origin} → ${booking.destination}\n${departure.toLocaleString('fr-FR')}\nSiège #${booking.seat_number}\nRéf: #${booking.id}`,
      });
    } catch (_) {}
  };

  return (
    <ScrollView style={styles.container}>
      {/* ── Success header ── */}
      <View style={styles.successHeader}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={56} color={Colors.green} />
        </View>
        <Text style={styles.successTitle}>Réservation confirmée !</Text>
        <Text style={styles.successSubtitle}>Votre billet a été généré</Text>
      </View>

      {/* ── Billet ── */}
      <View style={styles.ticket}>
        {/* Haut du billet */}
        <View style={styles.ticketHeader}>
          <Text style={styles.ticketCompany}>🚌 SOKORA Voyage</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>

        {/* Trajet */}
        <View style={styles.routeSection}>
          <View style={styles.routeCity}>
            <Text style={styles.cityLabel}>DÉPART</Text>
            <Text style={styles.cityName}>{booking.origin}</Text>
          </View>
          <View style={styles.routeCenter}>
            <Ionicons name="airplane" size={24} color={Colors.orange} />
            <View style={styles.routeLine} />
          </View>
          <View style={[styles.routeCity, { alignItems: 'flex-end' }]}>
            <Text style={styles.cityLabel}>ARRIVÉE</Text>
            <Text style={styles.cityName}>{booking.destination}</Text>
          </View>
        </View>

        {/* Détails */}
        <View style={styles.detailsGrid}>
          <DetailItem icon="calendar"  label="Date"      value={departure.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })} />
          <DetailItem icon="time"      label="Heure"     value={departure.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} />
          <DetailItem icon="grid"      label="Siège"     value={`#${booking.seat_number}`} />
          <DetailItem icon="pricetag"  label="Montant"   value={`${booking.amount_paid?.toLocaleString('fr-FR')} FCFA`} />
          {booking.passenger_name && (
            <DetailItem icon="person"  label="Passager"  value={booking.passenger_name} />
          )}
          <DetailItem icon="barcode"   label="Référence" value={`#${booking.id}`} />
        </View>

        {/* Séparateur dentelé */}
        <View style={styles.ticketTear} />

        {/* QR Code embarquement */}
        {booking.qr_token && booking.status === 'CONFIRMED' && (
          <View style={styles.qrSection}>
            <Text style={styles.qrTitle}>QR Code d'embarquement</Text>
            <View style={styles.qrWrapper}>
              <QRCode
                value={booking.qr_token}
                size={180}
                color={Colors.navy}
                backgroundColor="#fff"
              />
            </View>
            <Text style={styles.qrHint}>Présentez ce code au chauffeur lors de l'embarquement</Text>
          </View>
        )}
      </View>

      {/* ── Actions ── */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={Colors.navy} />
          <Text style={styles.shareBtnText}>Partager le billet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation?.navigate('VoyageSearch')}
        >
          <Ionicons name="search" size={18} color="#fff" />
          <Text style={styles.homeBtnText}>Nouveau voyage</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <View style={detailStyles.item}>
      <Ionicons name={`${icon}-outline`} size={15} color={Colors.textMuted} />
      <View>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={detailStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  item:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  label: { fontSize: Typography.xs, color: Colors.textMuted },
  value: { fontSize: Typography.sm, fontWeight: '600', color: Colors.text, maxWidth: 160 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  successHeader:   { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  successIcon:     { marginBottom: Spacing.sm },
  successTitle:    { fontSize: Typography['2xl'], fontWeight: '800', color: Colors.navy },
  successSubtitle: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 4 },

  ticket: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  ticketHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.navy,
  },
  ticketCompany: { fontSize: Typography.md, fontWeight: '700', color: '#fff' },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusText:    { fontSize: Typography.xs, fontWeight: '700' },

  routeSection: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.xl,
    backgroundColor: Colors.navyMid,
  },
  routeCity:   { flex: 2 },
  routeCenter: { flex: 1, alignItems: 'center', gap: 4 },
  routeLine:   { width: 2, height: 20, backgroundColor: Colors.orange },
  cityLabel:   { fontSize: Typography.xs, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  cityName:    { fontSize: Typography.xl, fontWeight: '800', color: '#fff' },

  detailsGrid: { padding: Spacing.xl, paddingBottom: 0 },

  ticketTear: {
    height: 1,
    marginHorizontal: -1,
    marginVertical: Spacing.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  qrSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  qrTitle:  { fontSize: Typography.sm, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  qrWrapper: {
    padding: Spacing.md, backgroundColor: '#fff',
    borderRadius: Radius.md, ...Shadow.sm,
  },
  qrHint: {
    fontSize: Typography.xs, color: Colors.textFaint,
    textAlign: 'center', marginTop: Spacing.sm, maxWidth: 240,
  },

  actions: {
    flexDirection: 'row', gap: Spacing.md,
    padding: Spacing.lg, paddingBottom: Spacing['3xl'],
  },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  shareBtnText: { fontWeight: '600', color: Colors.navy, fontSize: Typography.sm },
  homeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.orange, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, ...Shadow.orange,
  },
  homeBtnText: { fontWeight: '700', color: '#fff', fontSize: Typography.sm },
});
