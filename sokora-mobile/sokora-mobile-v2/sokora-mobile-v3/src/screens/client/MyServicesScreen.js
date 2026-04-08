/**
 * MyServicesScreen — SOKORA Client
 * Mes demandes de service + QR code escrow à montrer à l'artisan
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../services/AuthContext';
import { API_URL } from '../../utils/constants';

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  navy:    '#0F1E35',
  orange:  '#FF6B35',
  teal:    '#00D4AA',
  tealPale:'#E6FAF7',
  bg:      '#F4F6F9',
  white:   '#FFFFFF',
  textD:   '#1A1A2E',
  textG:   '#8892A4',
  border:  '#DDE4F0',
};

// ── Statuts ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  PENDING_VALIDATION: { label: 'En attente validation', color: '#F59E0B', bg: '#FFF9E6', icon: 'time-outline' },
  CONFIRMED:          { label: 'Confirmé',              color: '#00D4AA', bg: '#E6FAF7', icon: 'checkmark-circle-outline' },
  PAID:               { label: 'Payé — QR disponible',  color: '#6366F1', bg: '#EEF2FF', icon: 'qr-code-outline' },
  IN_PROGRESS:        { label: 'En cours',              color: '#FF6B35', bg: '#FFF4EE', icon: 'construct-outline' },
  COMPLETED:          { label: 'Terminé ✓',             color: '#22C55E', bg: '#E6F9EE', icon: 'checkmark-done-outline' },
  CANCELLED:          { label: 'Annulé',                color: '#EF4444', bg: '#FEE9E9', icon: 'close-circle-outline' },
  REJECTED:           { label: 'Refusé',                color: '#EF4444', bg: '#FEE9E9', icon: 'ban-outline' },
};

// ── Filtres ───────────────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'ALL',                label: 'Tous' },
  { id: 'PENDING_VALIDATION', label: 'En attente' },
  { id: 'CONFIRMED',          label: 'Confirmés' },
  { id: 'PAID',               label: 'Payés 🔑' },
  { id: 'COMPLETED',          label: 'Terminés' },
  { id: 'CANCELLED',          label: 'Annulés' },
];

// ── Formattage date ──────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtPrice(n) {
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('fr-FR') + ' FCFA';
}

// ── Carte demande ─────────────────────────────────────────────────────────────
function RequestCard({ item }) {
  const status = STATUS_CONFIG[item.status] || { label: item.status, color: C.textG, bg: C.bg, icon: 'help-circle-outline' };
  const showQR = item.payment_status === 'ESCROWED' && item.qr_release_token;
  const isCompleted = item.status === 'COMPLETED';
  const price = item.agreed_price || item.base_price;

  return (
    <View style={s.card}>
      {/* Ligne principale */}
      <View style={s.cardHeader}>
        <View style={s.cardIconWrap}>
          <Text style={{ fontSize: 24 }}>{item.category_icon || '🔧'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName}>{item.provider_name || 'Artisan'}</Text>
          <Text style={s.cardCategory}>{item.provider_category || 'Service'}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon} size={11} color={status.color} />
          <Text style={[s.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Détails */}
      <View style={s.cardDetails}>
        {item.scheduled_at && (
          <View style={s.detailRow}>
            <Ionicons name="calendar-outline" size={13} color={C.textG} />
            <Text style={s.detailText}>{fmtDate(item.scheduled_at)}</Text>
          </View>
        )}
        {item.address && (
          <View style={s.detailRow}>
            <Ionicons name="location-outline" size={13} color={C.textG} />
            <Text style={s.detailText} numberOfLines={1}>{item.address}</Text>
          </View>
        )}
        {price != null && (
          <View style={s.detailRow}>
            <Ionicons name="cash-outline" size={13} color={C.textG} />
            <Text style={s.detailText}>{fmtPrice(price)}</Text>
          </View>
        )}
      </View>

      {/* Badge terminé */}
      {isCompleted && (
        <View style={s.completedBadge}>
          <Ionicons name="checkmark-done-circle" size={14} color={C.teal} />
          <Text style={s.completedText}>Prestation terminée ✓</Text>
        </View>
      )}

      {/* Section QR escrow */}
      {showQR && (
        <View style={s.qrSection}>
          <View style={s.qrTitleRow}>
            <Ionicons name="qr-code-outline" size={16} color={C.teal} />
            <Text style={s.qrTitle}>Montrez ce QR à l'artisan après la prestation</Text>
          </View>
          <View style={s.qrBox}>
            <QRCode
              value={item.qr_release_token}
              size={160}
              color={C.navy}
              backgroundColor="#FFFFFF"
            />
          </View>
          <View style={s.escrowBadge}>
            <Ionicons name="lock-closed-outline" size={13} color="#6366F1" />
            <Text style={s.escrowText}>🔒 Fonds en escrow — libérés après scan</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function MyServicesScreen({ navigation }) {
  const { user } = useAuth();
  const [requests,   setRequests]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('ALL');
  const [error,      setError]      = useState(null);

  const getToken = async () => {
    if (user) {
      const t = Platform.OS === 'web'
        ? localStorage.getItem('sokora_token')
        : await SecureStore.getItemAsync('sokora_token').catch(() => null);
      if (t) return t;
    }
    return Platform.OS === 'web'
      ? localStorage.getItem('sokora_client_token')
      : await SecureStore.getItemAsync('sokora_client_token').catch(() => null);
  };

  const loadRequests = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError('Non connecté. Veuillez vous identifier.');
        return;
      }
      const res = await fetch(`${API_URL}/services/requests/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Impossible de charger vos demandes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadRequests();
    }, [loadRequests])
  );

  const filtered = filter === 'ALL'
    ? requests
    : requests.filter(r => r.status === filter);

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Mes Services</Text>
          <Text style={s.headerSub}>Vos demandes de prestation</Text>
        </View>
      </View>

      {/* ── Filtres ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filtersRow}
        style={s.filtersContainer}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.id}
            style={[s.filterChip, filter === f.id && s.filterChipActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[s.filterLabel, filter === f.id && s.filterLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Contenu ── */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={C.orange} />
          <Text style={s.loadingText}>Chargement de vos demandes...</Text>
        </View>
      ) : error ? (
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={52} color="#EF4444" />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); loadRequests(); }}>
            <Text style={s.retryLabel}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadRequests(); }}
              tintColor={C.orange}
              colors={[C.orange]}
            />
          }
          renderItem={({ item }) => <RequestCard item={item} />}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="construct-outline" size={62} color={C.textG} />
              <Text style={s.emptyTitle}>Aucune demande de service</Text>
              <Text style={s.emptySub}>
                {filter === 'ALL'
                  ? 'Vous n\'avez pas encore fait de demande de prestation.'
                  : `Aucune demande avec ce statut.`}
              </Text>
              {filter === 'ALL' && (
                <TouchableOpacity
                  style={s.ctaBtn}
                  onPress={() => navigation.navigate('ServiceSearch')}
                >
                  <Ionicons name="search-outline" size={16} color="#fff" />
                  <Text style={s.ctaLabel}>Trouver un artisan</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    backgroundColor: C.navy,
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 19, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 },

  // Filtres
  filtersContainer: { maxHeight: 52, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  filtersRow:       { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
  },
  filterChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  filterLabel:      { fontSize: 12, fontWeight: '600', color: C.textG },
  filterLabelActive:{ color: '#fff' },

  // Carte
  card: {
    backgroundColor: C.white, borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  cardIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#F0FDF9', alignItems: 'center', justifyContent: 'center',
  },
  cardName:     { fontSize: 14, fontWeight: '700', color: C.textD },
  cardCategory: { fontSize: 12, color: C.textG, marginTop: 2 },
  statusBadge:  {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  statusLabel:  { fontSize: 10, fontWeight: '700' },

  // Détails
  cardDetails: { gap: 5, marginBottom: 8 },
  detailRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText:  { fontSize: 12, color: C.textG, flex: 1 },

  // Badge terminé
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E6FAF7', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6, marginTop: 4,
  },
  completedText: { fontSize: 12, fontWeight: '700', color: C.teal },

  // QR section
  qrSection: {
    marginTop: 14,
    backgroundColor: '#E6FAF7',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.teal,
    padding: 16,
    alignItems: 'center',
  },
  qrTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 14, alignSelf: 'stretch',
  },
  qrTitle: { fontSize: 12, fontWeight: '700', color: C.navy, flex: 1 },
  qrBox: {
    backgroundColor: '#FFFFFF', padding: 14,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,212,170,0.25)',
  },
  escrowBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  escrowText: { fontSize: 11, fontWeight: '600', color: '#6366F1' },

  // États
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { color: C.textG, marginTop: 12, fontSize: 14 },
  errorText:   { color: '#EF4444', marginTop: 12, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: 16, backgroundColor: C.orange,
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10,
  },
  retryLabel: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Vide
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: C.textD, marginTop: 16 },
  emptySub:   { fontSize: 13, color: C.textG, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  ctaBtn: {
    marginTop: 24, backgroundColor: C.orange,
    borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  ctaLabel: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
