/**
 * VoyageSearchScreen — SOKORA Client
 * Recherche de trajets interurbains.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';
import { API_URL } from '../../utils/constants';
import { useTranslation } from '../../services/i18n';
import CityPicker from '../../components/CityPicker';
import DatePickerModal from '../../components/DatePickerModal';
import { useGeolocation } from '../../hooks/useGeolocation';
import ScreenHeader from '../../components/ScreenHeader';
import CrossSellModal from '../../components/CrossSellModal';

async function getClientToken() {
  if (Platform.OS === 'web') return localStorage.getItem('sokora_client_token');
  try { return await SecureStore.getItemAsync('sokora_client_token'); } catch { return null; }
}

const POPULAR_ROUTES = [
  { origin: 'Abidjan', destination: 'Aboisso' },
  { origin: 'Abidjan', destination: 'Yamoussoukro' },
  { origin: 'Abidjan', destination: 'Bouaké' },
  { origin: 'Abidjan', destination: 'San Pedro' },
  { origin: 'Yamoussoukro', destination: 'Bouaké' },
];

export default function VoyageSearchScreen({ navigation, clientToken }) {
  const { t } = useTranslation();
  const { coords } = useGeolocation({ autoRequest: true });
  const [origin, setOrigin]           = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [results, setResults]         = useState(null);
  const [showCrossSell, setShowCrossSell] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const handleSearch = async () => {
    if (!origin.trim() || !destination.trim()) {
      Alert.alert(t('error'), t('voyage.from') + ' / ' + t('voyage.to'));
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const params = new URLSearchParams({
        origin: origin.trim(),
        destination: destination.trim(),
        ...(date ? { date } : {}),
      });
      if (coords) {
        params.append('client_lat', coords.latitude);
        params.append('client_lng', coords.longitude);
      }
      const res = await fetch(`${API_URL}/voyage/search?${params}`);
      if (!res.ok) throw new Error('Erreur de recherche');
      const data = await res.json();
      setResults(data);
      if (data.length > 0) {
        setTimeout(() => setShowCrossSell(true), 2000);
      }
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    const tmp = origin;
    setOrigin(destination);
    setDestination(tmp);
  };

  const formatDuration = (min) => {
    if (!min) return '';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`;
  };

  return (
    <>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* ── Header ── */}
      <ScreenHeader
        navigation={navigation}
        title="🚌 Transport"
        subtitle="Transport interurbain en Côte d'Ivoire"
        dark={true}
      />

      {/* ── Formulaire recherche ── */}
      <View style={styles.searchCard}>
        {/* Départ */}
        <View style={{ marginBottom: Spacing.sm }}>
          <CityPicker
            value={origin}
            onChange={setOrigin}
            placeholder={t('voyage.from')}
            label="Ville de départ"
            iconName="radio-button-on-outline"
            iconColor={Colors.green}
          />
        </View>

        {/* Séparateur + swap */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <TouchableOpacity style={styles.swapBtn} onPress={handleSwap}>
            <Ionicons name="swap-vertical" size={18} color={Colors.orange} />
          </TouchableOpacity>
          <View style={styles.dividerLine} />
        </View>

        {/* Destination */}
        <View style={{ marginBottom: Spacing.sm }}>
          <CityPicker
            value={destination}
            onChange={setDestination}
            placeholder={t('voyage.to')}
            label="Ville d'arrivée"
            iconName="location"
            iconColor={Colors.red}
          />
        </View>

        {/* Date */}
        <DatePickerModal
          value={date}
          onChange={setDate}
          placeholder="Choisir une date de départ"
          label="Date de départ"
          minDate={today}
          style={{ marginTop: Spacing.sm }}
        />

        {/* Bouton rechercher */}
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="search" size={18} color="#fff" />
                <Text style={styles.searchBtnText}>{t('voyage.search')}</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* ── Trajets populaires ── */}
      {results === null && (
        <View style={styles.popularSection}>
          <Text style={styles.sectionTitle}>Trajets populaires</Text>
          {POPULAR_ROUTES.map((r, i) => (
            <TouchableOpacity
              key={i}
              style={styles.popularRow}
              onPress={() => { setOrigin(r.origin); setDestination(r.destination); }}
            >
              <View style={styles.popularRoute}>
                <Text style={styles.popularOrigin}>{r.origin}</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} />
                <Text style={styles.popularDest}>{r.destination}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Résultats ── */}
      {results !== null && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>
            {results.length} trajet{results.length !== 1 ? 's' : ''} trouvé{results.length !== 1 ? 's' : ''}
          </Text>

          {results.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bus-outline" size={48} color={Colors.textFaint} />
              <Text style={styles.emptyText}>{t('voyage.trip_empty')}</Text>
              <Text style={styles.emptySubtext}>Essayez une autre date ou un autre trajet</Text>
            </View>
          ) : (
            results.map(trip => (
              <TouchableOpacity
                key={trip.id}
                style={styles.tripCard}
                onPress={() => navigation?.navigate('SeatPicker', { trip })}
              >
                <View style={styles.tripHeader}>
                  <View style={styles.tripRoute}>
                    <Text style={styles.tripOrigin}>{trip.origin}</Text>
                    <View style={styles.tripArrow}>
                      <View style={styles.tripLine} />
                      <Ionicons name="airplane" size={14} color={Colors.orange} />
                      <View style={styles.tripLine} />
                    </View>
                    <Text style={styles.tripDest}>{trip.destination}</Text>
                  </View>
                  <Text style={styles.tripPrice}>
                    {trip.price.toLocaleString('fr-FR')} F
                  </Text>
                </View>

                <View style={styles.tripMeta}>
                  <View style={styles.tripMetaItem}>
                    <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.tripMetaText}>
                      {new Date(trip.departure_at).toLocaleString('fr-FR', {
                        hour: '2-digit', minute: '2-digit',
                        day: '2-digit', month: 'short'
                      })}
                    </Text>
                  </View>
                  {trip.duration_min && (
                    <View style={styles.tripMetaItem}>
                      <Ionicons name="hourglass-outline" size={13} color={Colors.textMuted} />
                      <Text style={styles.tripMetaText}>{formatDuration(trip.duration_min)}</Text>
                    </View>
                  )}
                  <View style={styles.tripMetaItem}>
                    <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
                    <Text style={[styles.tripMetaText, trip.seats_left < 5 && { color: Colors.red }]}>
                      {trip.seats_left} place{trip.seats_left !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.tripFooter}>
                  <View style={[styles.statusBadge,
                    { backgroundColor: trip.status === 'BOARDING' ? Colors.greenPale : Colors.orangePale }
                  ]}>
                    <Text style={[styles.statusText,
                      { color: trip.status === 'BOARDING' ? Colors.green : Colors.orange }
                    ]}>
                      {trip.status === 'BOARDING' ? '🟢 Embarquement' : '🕐 Programmé'}
                    </Text>
                  </View>
                  <Text style={styles.bookNow}>Réserver →</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </ScrollView>

    <CrossSellModal
      visible={showCrossSell}
      onClose={() => setShowCrossSell(false)}
      type="voyage"
      context={{ city: destination }}
      navigation={navigation}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: { padding: Spacing.xl, paddingBottom: 0 },
  title:    { fontSize: Typography['2xl'], fontWeight: '800', color: Colors.navy },
  subtitle: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },

  searchCard: {
    margin: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadow.md,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  inputDot: { width: 10, height: 10, borderRadius: 5 },
  input: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.text,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: Spacing.sm, paddingLeft: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  swapBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.orangePale,
    justifyContent: 'center', alignItems: 'center',
    marginHorizontal: Spacing.sm,
  },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, marginTop: Spacing.lg,
    backgroundColor: Colors.orange, borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    ...Shadow.orange,
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.md },

  sectionTitle: {
    fontSize: Typography.md, fontWeight: '700',
    color: Colors.text, marginBottom: Spacing.md,
  },

  popularSection: { paddingHorizontal: Spacing.lg },
  popularRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  popularRoute:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  popularOrigin: { fontSize: Typography.base, fontWeight: '600', color: Colors.text },
  popularDest:   { fontSize: Typography.base, color: Colors.textMuted },

  resultsSection: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing['3xl'] },
  emptyState:  { alignItems: 'center', paddingVertical: Spacing['4xl'], gap: Spacing.sm },
  emptyText:   { fontSize: Typography.lg, fontWeight: '600', color: Colors.textMuted },
  emptySubtext:{ fontSize: Typography.sm, color: Colors.textFaint },

  tripCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.lg, marginBottom: Spacing.md,
    ...Shadow.md,
  },
  tripHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  tripRoute:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  tripOrigin: { fontSize: Typography.md, fontWeight: '700', color: Colors.navy },
  tripDest:   { fontSize: Typography.md, fontWeight: '700', color: Colors.navy },
  tripArrow:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  tripLine:   { flex: 1, height: 1, backgroundColor: Colors.border },
  tripPrice:  { fontSize: Typography.lg, fontWeight: '800', color: Colors.orange },

  tripMeta: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  tripMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tripMetaText: { fontSize: Typography.xs, color: Colors.textMuted },

  tripFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusText:  { fontSize: Typography.xs, fontWeight: '600' },
  bookNow:     { fontSize: Typography.sm, fontWeight: '700', color: Colors.orange },
});
