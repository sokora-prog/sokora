/**
 * SeatPickerScreen — SOKORA Client
 * Plan de sièges interactif pour réserver un voyage.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';
import { API_URL } from '../../utils/constants';

export default function SeatPickerScreen({ route, navigation }) {
  const { trip, clientToken } = route?.params || {};
  const [seats, setSeats]       = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [booking, setBooking]   = useState(false);

  useEffect(() => {
    if (!trip) return;
    fetch(`${API_URL}/voyage/trips/${trip.id}`)
      .then(r => r.json())
      .then(data => { setSeats(data.seats || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [trip]);

  const handleBook = async () => {
    if (!selected) return;
    Alert.alert(
      'Confirmer la réservation',
      `Siège ${selected} — ${trip.price.toLocaleString('fr-FR')} FCFA\nLe montant sera débité de votre wallet.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setBooking(true);
            try {
              const res = await fetch(`${API_URL}/voyage/bookings`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Client-Token': clientToken,
                },
                body: JSON.stringify({ trip_id: trip.id, seat_number: selected }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.detail || 'Erreur réservation');
              navigation?.navigate('BookingConfirm', { booking: data, clientToken });
            } catch (e) {
              Alert.alert('Erreur', e.message);
            } finally {
              setBooking(false);
            }
          }
        }
      ]
    );
  };

  const getSeatStyle = (seat) => {
    if (seat.status === 'BOOKED' || seat.status === 'BOARDED') return styles.seatBooked;
    if (selected === seat.seat_number) return styles.seatSelected;
    return styles.seatFree;
  };

  const getSeatTextStyle = (seat) => {
    if (seat.status === 'BOOKED' || seat.status === 'BOARDED') return styles.seatTextBooked;
    if (selected === seat.seat_number) return styles.seatTextSelected;
    return styles.seatTextFree;
  };

  if (!trip) {
    return (
      <View style={styles.center}>
        <Text style={{ color: Colors.textMuted }}>Voyage introuvable</Text>
      </View>
    );
  }

  // Organiser les sièges en rangées de 4 (2+couloir+2)
  const rows = [];
  for (let i = 0; i < seats.length; i += 4) {
    rows.push(seats.slice(i, i + 4));
  }

  return (
    <View style={styles.container}>
      {/* ── Header trajet ── */}
      <View style={styles.tripInfo}>
        <View style={styles.tripRoute}>
          <Text style={styles.tripCity}>{trip.origin}</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.orange} />
          <Text style={styles.tripCity}>{trip.destination}</Text>
        </View>
        <Text style={styles.tripTime}>
          {new Date(trip.departure_at).toLocaleString('fr-FR', {
            weekday: 'long', day: '2-digit', month: 'long',
            hour: '2-digit', minute: '2-digit'
          })}
        </Text>
        <Text style={styles.tripPrice}>{trip.price.toLocaleString('fr-FR')} FCFA / place</Text>
      </View>

      {/* ── Légende ── */}
      <View style={styles.legend}>
        {[
          { style: styles.seatFree,     label: 'Libre' },
          { style: styles.seatSelected, label: 'Sélectionné' },
          { style: styles.seatBooked,   label: 'Occupé' },
        ].map((l, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, l.style]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Plan de sièges ── */}
      <ScrollView style={styles.seatsContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.orange} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Avant du bus */}
            <View style={styles.busFont}>
              <Ionicons name="bus" size={32} color={Colors.navy} />
              <Text style={styles.busFontText}>AVANT</Text>
            </View>

            <View style={styles.seatsGrid}>
              {rows.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.seatRow}>
                  {row.slice(0, 2).map(seat => (
                    <TouchableOpacity
                      key={seat.seat_number}
                      style={[styles.seat, getSeatStyle(seat)]}
                      disabled={seat.status !== 'FREE'}
                      onPress={() => setSelected(
                        selected === seat.seat_number ? null : seat.seat_number
                      )}
                    >
                      <Text style={getSeatTextStyle(seat)}>{seat.seat_number}</Text>
                    </TouchableOpacity>
                  ))}

                  {/* Couloir */}
                  <View style={styles.aisle} />

                  {row.slice(2, 4).map(seat => (
                    <TouchableOpacity
                      key={seat.seat_number}
                      style={[styles.seat, getSeatStyle(seat)]}
                      disabled={seat.status !== 'FREE'}
                      onPress={() => setSelected(
                        selected === seat.seat_number ? null : seat.seat_number
                      )}
                    >
                      <Text style={getSeatTextStyle(seat)}>{seat.seat_number}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Footer réservation ── */}
      <View style={styles.footer}>
        {selected ? (
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedLabel}>Siège sélectionné</Text>
            <Text style={styles.selectedNumber}>#{selected}</Text>
          </View>
        ) : (
          <Text style={styles.selectHint}>Touchez un siège libre pour le sélectionner</Text>
        )}

        <TouchableOpacity
          style={[styles.bookBtn, !selected && styles.bookBtnDisabled]}
          onPress={handleBook}
          disabled={!selected || booking}
        >
          {booking
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.bookBtnText}>
                {selected ? `Réserver — ${trip.price.toLocaleString('fr-FR')} F` : 'Choisir un siège'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tripInfo: {
    backgroundColor: Colors.navy, padding: Spacing.xl,
    alignItems: 'center', gap: 4,
  },
  tripRoute:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tripCity:   { fontSize: Typography.xl, fontWeight: '800', color: '#fff' },
  tripTime:   { fontSize: Typography.sm, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  tripPrice:  { fontSize: Typography.md, fontWeight: '700', color: Colors.orange },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl, padding: Spacing.md, backgroundColor: Colors.surface },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 20, height: 20, borderRadius: 4 },
  legendText: { fontSize: Typography.xs, color: Colors.textMuted },

  seatsContainer: { flex: 1 },
  busFont:    { alignItems: 'center', paddingVertical: Spacing.lg, gap: 4 },
  busFontText:{ fontSize: Typography.xs, color: Colors.textMuted, fontWeight: '600' },

  seatsGrid: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  seatRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  aisle:     { width: 24 },

  seat: {
    width: 44, height: 44, borderRadius: Radius.sm,
    justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 3,
  },
  seatFree:     { backgroundColor: Colors.tealPale, borderWidth: 1, borderColor: Colors.teal },
  seatSelected: { backgroundColor: Colors.orange, borderWidth: 2, borderColor: Colors.orangeLight },
  seatBooked:   { backgroundColor: Colors.border, borderWidth: 1, borderColor: Colors.textFaint },

  seatTextFree:     { fontSize: Typography.xs, fontWeight: '700', color: Colors.teal },
  seatTextSelected: { fontSize: Typography.xs, fontWeight: '700', color: '#fff' },
  seatTextBooked:   { fontSize: Typography.xs, fontWeight: '600', color: Colors.textFaint },

  footer: {
    backgroundColor: Colors.surface, padding: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    ...Shadow.lg,
  },
  selectedInfo:   { flex: 1 },
  selectedLabel:  { fontSize: Typography.xs, color: Colors.textMuted },
  selectedNumber: { fontSize: Typography.xl, fontWeight: '800', color: Colors.navy },
  selectHint:     { flex: 1, fontSize: Typography.sm, color: Colors.textMuted },

  bookBtn: {
    backgroundColor: Colors.orange, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    ...Shadow.orange,
  },
  bookBtnDisabled: { backgroundColor: Colors.border },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.md },
});
