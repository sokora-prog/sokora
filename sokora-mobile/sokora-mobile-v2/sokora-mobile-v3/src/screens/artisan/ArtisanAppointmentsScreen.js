/**
 * ArtisanAppointmentsScreen — Liste et gestion des RDV artisan
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../../utils/constants';
import ScreenHeader from '../../components/ScreenHeader';

const C = {
  navy: '#0F1E35', orange: '#FF6B35', teal: '#00D4AA',
  bg: '#F4F6F9', white: '#FFFFFF', text: '#1A1A2E', muted: '#8892A4',
  border: '#DDE4F0', gold: '#F59E0B', green: '#22C55E', red: '#EF4444',
};

const STATUS_CONFIG = {
  PENDING_VALIDATION: { label: 'En attente',  color: C.gold,   bg: '#FFF9E6' },
  CONFIRMED:          { label: 'Confirmé',    color: C.teal,   bg: '#E6FAF7' },
  PAID:               { label: 'Payé ✓',     color: C.green,  bg: '#E6F9EE' },
  IN_PROGRESS:        { label: 'En cours',    color: C.orange, bg: '#FFF4EE' },
  COMPLETED:          { label: 'Terminé',     color: C.green,  bg: '#E6F9EE' },
  CANCELLED:          { label: 'Annulé',      color: C.red,    bg: '#FEE9E9' },
  REJECTED:           { label: 'Refusé',      color: C.red,    bg: '#FEE9E9' },
};

const FILTERS = [
  { key: null,                 label: 'Tous' },
  { key: 'PENDING_VALIDATION', label: 'En attente' },
  { key: 'CONFIRMED',          label: 'Confirmés' },
  { key: 'PAID',               label: 'Payés' },
  { key: 'COMPLETED',          label: 'Terminés' },
];

export default function ArtisanAppointmentsScreen({ navigation, route }) {
  const initFilter = route.params?.filter || null;
  const [requests,   setRequests]  = useState([]);
  const [filter,     setFilter]    = useState(initFilter);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefreshing]= useState(false);

  useFocusEffect(useCallback(() => { load(); }, [filter]));

  const getToken = async () => {
    const { Platform } = require('react-native');
    if (Platform.OS === 'web') return localStorage.getItem('sokora_token');
    try { return await require('expo-secure-store').getItemAsync('sokora_token'); } catch { return null; }
  };

  const load = async () => {
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (filter) params.append('status', filter);
      const res = await fetch(`${API_URL}/services/artisan/appointments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  const action = async (reqId, endpoint) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/services/artisan/requests/${reqId}/${endpoint}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { load(); }
      else Alert.alert('Erreur', 'Action impossible');
    } catch { Alert.alert('Erreur réseau'); }
  };

  const fmt = n => n ? `${Number(n).toLocaleString('fr-FR')} F` : '—';
  const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  const renderItem = ({ item: req }) => {
    const cfg = STATUS_CONFIG[req.status] || { label: req.status, color: C.muted, bg: C.bg };
    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View>
            <Text style={s.clientName}>{req.client_name}</Text>
            <Text style={s.clientPhone}>{req.client_phone}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[s.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {req.description && <Text style={s.desc} numberOfLines={2}>{req.description}</Text>}

        <View style={s.metaRow}>
          {req.scheduled_at && (
            <View style={s.metaItem}>
              <Ionicons name="calendar-outline" size={13} color={C.muted} />
              <Text style={s.metaTxt}>{fmtDate(req.scheduled_at)}</Text>
            </View>
          )}
          {req.address && (
            <View style={s.metaItem}>
              <Ionicons name="location-outline" size={13} color={C.muted} />
              <Text style={s.metaTxt} numberOfLines={1}>{req.address}</Text>
            </View>
          )}
        </View>

        {req.agreed_price > 0 && (
          <View style={s.priceRow}>
            <Ionicons name="wallet-outline" size={14} color={C.orange} />
            <Text style={s.priceTxt}>{fmt(req.agreed_price)}</Text>
            {req.payment_status === 'ESCROWED' && (
              <View style={s.escrowBadge}>
                <Text style={s.escrowTxt}>🔒 En escrow</Text>
              </View>
            )}
          </View>
        )}

        {/* Actions selon statut */}
        <View style={s.actions}>
          {req.status === 'PENDING_VALIDATION' && (
            <>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.teal }]} onPress={() => action(req.id, 'accept')}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={s.actionBtnTxt}>Accepter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.red }]} onPress={() => action(req.id, 'reject')}>
                <Ionicons name="close" size={16} color="#fff" />
                <Text style={s.actionBtnTxt}>Refuser</Text>
              </TouchableOpacity>
            </>
          )}
          {req.status === 'PAID' && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: C.orange, flex: 1 }]}
              onPress={() => navigation.navigate('ArtisanScan', { requestId: req.id })}
            >
              <Ionicons name="scan" size={16} color="#fff" />
              <Text style={s.actionBtnTxt}>Scanner QR client → Recevoir {fmt(req.escrow_amount)}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <ScreenHeader navigation={navigation} title="Mes rendez-vous" dark={true} />

      {/* Filtres */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={f => String(f.key)}
        showsHorizontalScrollIndicator={false}
        style={s.filterRow}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            style={[s.filterChip, filter === f.key && s.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.filterTxt, filter === f.key && s.filterTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.orange} /></View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={r => String(r.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.orange} />}
          ListEmptyComponent={() => (
            <View style={s.center}>
              <Text style={{ fontSize: 48 }}>📭</Text>
              <Text style={s.emptyTxt}>Aucun rendez-vous</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  filterRow: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border },
  filterChipActive: { backgroundColor: C.orange, borderColor: C.orange },
  filterTxt:    { fontSize: 12, fontWeight: '700', color: C.muted },
  filterTxtActive: { color: '#fff' },
  card: { backgroundColor: C.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  clientName: { fontSize: 15, fontWeight: '800', color: C.text },
  clientPhone: { fontSize: 12, color: C.muted, marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusTxt:   { fontSize: 11, fontWeight: '700' },
  desc:   { fontSize: 13, color: C.muted, marginBottom: 8, lineHeight: 20 },
  metaRow: { gap: 4, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaTxt:  { fontSize: 12, color: C.muted, flex: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  priceTxt: { fontSize: 15, fontWeight: '800', color: C.orange },
  escrowBadge: { backgroundColor: '#FFF9E6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  escrowTxt:   { fontSize: 10, fontWeight: '700', color: C.gold },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
  actionBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyTxt: { fontSize: 16, fontWeight: '700', color: C.muted },
});
