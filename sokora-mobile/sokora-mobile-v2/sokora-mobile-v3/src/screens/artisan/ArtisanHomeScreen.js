/**
 * ArtisanHomeScreen — Dashboard artisan SOKORA
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../services/AuthContext';
import { API_URL } from '../../utils/constants';
import { useGeolocation } from '../../hooks/useGeolocation';
import * as SecureStore from 'expo-secure-store';

const C = {
  navy: '#0F1E35', orange: '#FF6B35', teal: '#00D4AA',
  bg: '#F4F6F9', white: '#FFFFFF', text: '#1A1A2E', muted: '#8892A4',
  border: '#DDE4F0', gold: '#F59E0B', green: '#22C55E', red: '#EF4444',
};

const STATUS_CONFIG = {
  PENDING_VALIDATION: { label: 'En attente',  color: C.gold,   bg: '#FFF9E6', icon: 'time-outline' },
  CONFIRMED:          { label: 'Confirmé',    color: C.teal,   bg: '#E6FAF7', icon: 'checkmark-circle-outline' },
  PAID:               { label: 'Payé',        color: C.green,  bg: '#E6F9EE', icon: 'wallet-outline' },
  IN_PROGRESS:        { label: 'En cours',    color: C.orange, bg: '#FFF4EE', icon: 'construct-outline' },
  COMPLETED:          { label: 'Terminé',     color: C.green,  bg: '#E6F9EE', icon: 'checkmark-done-outline' },
  CANCELLED:          { label: 'Annulé',      color: C.red,    bg: '#FEE9E9', icon: 'close-circle-outline' },
  REJECTED:           { label: 'Refusé',      color: C.red,    bg: '#FEE9E9', icon: 'ban-outline' },
};

export default function ArtisanHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const { coords, requestLocation, permission } = useGeolocation({ autoRequest: false });
  const [locationSent, setLocationSent] = useState(false);

  useFocusEffect(useCallback(() => { loadDashboard(); }, []));

  const loadDashboard = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/services/artisan/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDashboard(await res.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  const getToken = async () => {
    const { Platform } = require('react-native');
    if (Platform.OS === 'web') return localStorage.getItem('sokora_token');
    try {
      const SecureStore = require('expo-secure-store');
      return await SecureStore.getItemAsync('sokora_token');
    } catch { return null; }
  };

  const updateArtisanLocation = async (c) => {
    try {
      const token = Platform.OS === 'web'
        ? localStorage.getItem('sokora_client_token')
        : await SecureStore.getItemAsync('sokora_client_token').catch(() => null);
      await fetch(`${API_URL}/services/artisan/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ latitude: c.latitude, longitude: c.longitude }),
      });
      setLocationSent(true);
    } catch {}
  };

  useEffect(() => {
    const askGps = async () => {
      const c = await requestLocation();
      if (c) updateArtisanLocation(c);
    };
    askGps();
  }, []);

  const fmt = n => Number(n || 0).toLocaleString('fr-FR');

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={C.orange} /></View>;
  }

  const provider = dashboard?.provider;
  const pending  = dashboard?.pending_count || 0;

  return (
    <ScrollView
      style={s.root}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} tintColor={C.orange} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerAvatar}>
          <Text style={{ fontSize: 28 }}>{provider?.category_icon || '🔧'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerGreeting}>Bonjour, {user?.full_name?.split(' ')[0]} 👋</Text>
          <Text style={s.headerRole}>{provider?.category_name || 'Artisan SOKORA'}</Text>
        </View>
        {pending > 0 && (
          <View style={s.pendingBadge}>
            <Text style={s.pendingBadgeTxt}>{pending}</Text>
          </View>
        )}
      </View>

      {/* Wallet card */}
      <View style={s.walletCard}>
        <View style={s.walletOrb1} />
        <View style={s.walletOrb2} />
        <Text style={s.walletLabel}>WALLET ARTISAN</Text>
        <Text style={s.walletBalance}>{fmt(dashboard?.wallet_balance)} <Text style={s.walletCur}>FCFA</Text></Text>
        <Text style={s.walletSub}>Total gagné : {fmt(dashboard?.total_earned)} FCFA</Text>
        <View style={s.walletAccent} />
      </View>

      {/* GPS banners */}
      {permission === 'denied' && !locationSent && (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', margin: 16, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F59E0B30' }}
          onPress={async () => { const c = await requestLocation(); if (c) updateArtisanLocation(c); }}
        >
          <Ionicons name="location-outline" size={18} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>Activez la géolocalisation</Text>
            <Text style={{ fontSize: 11, color: '#92400E', opacity: 0.8 }}>Les clients vous trouveront plus facilement près d'eux</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
        </TouchableOpacity>
      )}
      {locationSent && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E6FAF7', marginHorizontal: 16, marginBottom: 4, borderRadius: 10, padding: 10 }}>
          <Ionicons name="navigate-circle" size={16} color="#00D4AA" />
          <Text style={{ fontSize: 12, color: '#00D4AA', fontWeight: '600' }}>Position GPS mise à jour — les clients vous trouvent ✓</Text>
        </View>
      )}

      {/* Stats */}
      <View style={s.statsGrid}>
        {[
          { icon: '📋', label: 'Total RDV',    val: dashboard?.total_requests || 0, color: C.orange },
          { icon: '⏳', label: 'En attente',   val: dashboard?.status_counts?.PENDING_VALIDATION || 0, color: C.gold },
          { icon: '✅', label: 'Terminés',     val: dashboard?.status_counts?.COMPLETED || 0, color: C.green },
          { icon: '⭐', label: 'Note moyenne', val: `${dashboard?.avg_rating || '—'}/5`, color: C.gold },
        ].map((st, i) => (
          <View key={i} style={s.statCard}>
            <Text style={{ fontSize: 22 }}>{st.icon}</Text>
            <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
            <Text style={s.statLbl}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* Actions rapides */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Actions rapides</Text>
        <View style={s.actionsRow}>
          <TouchableOpacity style={s.actionCard} onPress={() => navigation.navigate('ArtisanAppointments')} activeOpacity={0.8}>
            <View style={[s.actionIcon, { backgroundColor: C.orange + '20' }]}>
              <Ionicons name="calendar" size={24} color={C.orange} />
            </View>
            <Text style={s.actionLbl}>Mes RDV</Text>
            {pending > 0 && <View style={s.actionBadge}><Text style={s.actionBadgeTxt}>{pending}</Text></View>}
          </TouchableOpacity>

          <TouchableOpacity style={s.actionCard} onPress={() => navigation.navigate('ArtisanScan')} activeOpacity={0.8}>
            <View style={[s.actionIcon, { backgroundColor: C.teal + '20' }]}>
              <Ionicons name="scan" size={24} color={C.teal} />
            </View>
            <Text style={s.actionLbl}>Scanner QR</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionCard} onPress={() => navigation.navigate('ArtisanWallet')} activeOpacity={0.8}>
            <View style={[s.actionIcon, { backgroundColor: C.gold + '20' }]}>
              <Ionicons name="wallet" size={24} color={C.gold} />
            </View>
            <Text style={s.actionLbl}>Wallet</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* RDV en attente */}
      {pending > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>⏳ RDV en attente de validation</Text>
          <TouchableOpacity
            style={s.pendingAlert}
            onPress={() => navigation.navigate('ArtisanAppointments', { filter: 'PENDING_VALIDATION' })}
          >
            <Ionicons name="notifications" size={20} color={C.gold} />
            <Text style={s.pendingAlertTxt}>{pending} demande{pending > 1 ? 's' : ''} à confirmer</Text>
            <Ionicons name="chevron-forward" size={16} color={C.gold} />
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, paddingTop: 50, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  headerAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.orange + '20', alignItems: 'center', justifyContent: 'center' },
  headerGreeting: { fontSize: 18, fontWeight: '800', color: C.text },
  headerRole:     { fontSize: 12, color: C.muted, marginTop: 2 },
  pendingBadge:   { backgroundColor: C.gold, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  pendingBadgeTxt:{ fontSize: 12, fontWeight: '800', color: '#fff' },

  walletCard: { margin: 16, backgroundColor: C.navy, borderRadius: 24, padding: 22, paddingTop: 22, paddingBottom: 0, overflow: 'hidden', minHeight: 140, shadowColor: C.navy, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  walletOrb1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -80, right: -60, backgroundColor: 'rgba(0,212,170,0.15)' },
  walletOrb2: { position: 'absolute', width: 150, height: 150, borderRadius: 75, bottom: -40, left: -30, backgroundColor: 'rgba(255,107,53,0.12)' },
  walletLabel:   { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  walletBalance: { fontSize: 36, fontWeight: '900', color: '#fff', marginTop: 8 },
  walletCur:     { fontSize: 16, fontWeight: '400' },
  walletSub:     { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 18 },
  walletAccent:  { height: 5, marginHorizontal: -22, backgroundColor: C.orange, opacity: 0.75 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  statCard:  { flex: 1, minWidth: '45%', backgroundColor: C.white, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  statVal:   { fontSize: 22, fontWeight: '900' },
  statLbl:   { fontSize: 11, color: C.muted, fontWeight: '600' },

  section:      { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 12 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionCard: { flex: 1, backgroundColor: C.white, borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, position: 'relative', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLbl:  { fontSize: 11, fontWeight: '700', color: C.text, textAlign: 'center' },
  actionBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: C.red, borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  actionBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },

  pendingAlert: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF9E6', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: C.gold + '50' },
  pendingAlertTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: C.gold },
});
