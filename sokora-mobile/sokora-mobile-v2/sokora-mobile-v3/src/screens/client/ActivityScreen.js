/**
 * ActivityScreen — Historique unifié SOKORA
 * Journal de bord complet : wallet, hôtels, voyages, services
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenHeader from '../../components/ScreenHeader';
import { API_URL } from '../../utils/constants';

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  navy:   '#0F1E35',
  navy2:  '#1A2E45',
  orange: '#FF6B35',
  teal:   '#00D4AA',
  bg:     '#F4F6F9',
  white:  '#FFFFFF',
  textD:  '#1A1A2E',
  textG:  '#8892A4',
  border: '#DDE4F0',
};

// ── Filtres disponibles ───────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',     label: 'Tout'       },
  { id: 'wallet',  label: '💳 Wallet'  },
  { id: 'hotel',   label: '🏨 Hôtels'  },
  { id: 'voyage',  label: '🚌 Transport'},
  { id: 'service', label: '🔧 Services' },
];

// ── Helper token ──────────────────────────────────────────────────────────────
async function getClientToken() {
  if (Platform.OS === 'web') return localStorage.getItem('sokora_client_token');
  try { return await SecureStore.getItemAsync('sokora_client_token'); } catch { return null; }
}

export default function ActivityScreen({ navigation }) {
  const [allItems,   setAllItems]   = useState([]);
  const [filter,     setFilter]     = useState('all');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Chargement parallèle ──────────────────────────────────────────────────
  const loadActivity = useCallback(async () => {
    const ct = await getClientToken();
    const headers = ct ? { 'X-Client-Token': ct } : {};

    const [walletTxs, hotelBookings, voyageTickets, serviceReqs] = await Promise.allSettled([
      fetch(`${API_URL}/wallet/transactions`,    { headers }).then(r => r.ok ? r.json() : {}),
      fetch(`${API_URL}/hotel/bookings/my`,      { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/voyage/tickets/my`,      { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/services/requests/my`,   { headers }).then(r => r.ok ? r.json() : []),
    ]);

    const items = [];

    // Wallet
    (walletTxs.value?.transactions || []).forEach(tx => {
      items.push({
        id:          `w-${tx.id}`,
        type:        'wallet',
        icon:        (tx.tx_type === 'credit' || tx.tx_type === 'cashback') ? '💰' : '💳',
        title:       tx.description || 'Transaction wallet',
        subtitle:    tx.service_type || 'Wallet SOKORA',
        amount:      tx.amount || 0,
        date:        tx.created_at,
        color:       C.orange,
        badge:       tx.tx_type === 'cashback' ? 'Cashback ✓' : null,
        badge_color: '#22C55E',
      });
    });

    // Hôtels
    (hotelBookings.value || []).forEach(b => {
      items.push({
        id:          `h-${b.id}`,
        type:        'hotel',
        icon:        '🏨',
        title:       b.hotel_name || 'Réservation hôtel',
        subtitle:    `${b.room_type || 'Chambre'} · ${b.nights || 1} nuit(s)`,
        amount:      b.total_amount || 0,
        date:        b.created_at,
        color:       '#6366F1',
        badge:       b.status === 'CHECKED_IN' ? 'Check-in ✓' : b.status === 'COMPLETED' ? 'Terminé' : 'Confirmé',
        badge_color: b.status === 'CHECKED_IN' ? C.teal : '#6366F1',
      });
    });

    // Voyages
    (voyageTickets.value || []).forEach(t => {
      items.push({
        id:          `v-${t.id}`,
        type:        'voyage',
        icon:        '🚌',
        title:       `${t.origin || '?'} → ${t.destination || '?'}`,
        subtitle:    t.departure_at ? new Date(t.departure_at).toLocaleDateString('fr-FR') : '',
        amount:      t.amount_paid || t.price || 0,
        date:        t.created_at || t.departure_at,
        color:       C.orange,
        badge:       t.status || null,
        badge_color: C.orange,
      });
    });

    // Services
    (serviceReqs.value || []).forEach(r => {
      items.push({
        id:          `s-${r.id}`,
        type:        'service',
        icon:        r.category_icon || '🔧',
        title:       r.provider_name || 'Prestation artisan',
        subtitle:    r.category_name || 'Service',
        amount:      r.agreed_price || r.base_price || 0,
        date:        r.created_at,
        color:       C.teal,
        badge:       r.payment_status === 'ESCROWED' ? '🔒 En escrow' : r.payment_status === 'RELEASED' ? '✓ Payé' : null,
        badge_color: r.payment_status === 'RELEASED' ? '#22C55E' : '#6366F1',
      });
    });

    // Trier par date décroissante
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    setAllItems(items);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadActivity();
  }, [loadActivity]));

  // ── Groupement par période ────────────────────────────────────────────────
  const groupByPeriod = (items) => {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const thisWeek  = new Date(today); thisWeek.setDate(today.getDate() - 7);
    const thisMonth = new Date(today); thisMonth.setDate(today.getDate() - 30);

    const groups = {
      "Aujourd'hui":  [],
      'Cette semaine': [],
      'Ce mois':       [],
      'Plus ancien':   [],
    };

    items.forEach(item => {
      const d = new Date(item.date);
      if (d >= today)     groups["Aujourd'hui"].push(item);
      else if (d >= thisWeek)  groups['Cette semaine'].push(item);
      else if (d >= thisMonth) groups['Ce mois'].push(item);
      else                     groups['Plus ancien'].push(item);
    });

    return groups;
  };

  // ── Items filtrés + sections ──────────────────────────────────────────────
  const filtered = filter === 'all' ? allItems : allItems.filter(i => i.type === filter);

  const groups = groupByPeriod(filtered);
  const listData = [];
  Object.entries(groups).forEach(([label, items]) => {
    if (items.length > 0) {
      listData.push({ type: 'header', label, id: `hdr-${label}` });
      items.forEach(item => listData.push({ type: 'item', ...item }));
    }
  });

  // ── Résumé mois en cours ──────────────────────────────────────────────────
  const thisMonthCutoff = new Date(); thisMonthCutoff.setDate(thisMonthCutoff.getDate() - 30);
  const monthItems  = allItems.filter(i => new Date(i.date) >= thisMonthCutoff);
  const monthTotal  = monthItems.reduce((s, i) => s + (i.amount || 0), 0);
  const monthCount  = monthItems.length;

  // ── Formatage date ────────────────────────────────────────────────────────
  const fmtDate = (str) => {
    if (!str) return '';
    try {
      return new Date(str).toLocaleString('fr-FR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch { return str; }
  };

  // ── Rendu item ────────────────────────────────────────────────────────────
  const renderRow = ({ item }) => {
    if (item.type === 'header') {
      return (
        <View style={s.periodHeader}>
          <Text style={s.periodTxt}>{item.label}</Text>
          <View style={s.periodLine} />
        </View>
      );
    }

    const isDebit = item.amount > 0;

    return (
      <View style={s.timelineItem}>
        {/* Dot + connecteur */}
        <View style={s.timelineLeft}>
          <View style={[s.timelineDot, { backgroundColor: item.color }]}>
            <Text style={{ fontSize: 14 }}>{item.icon}</Text>
          </View>
          <View style={s.timelineConnector} />
        </View>

        {/* Contenu */}
        <View style={s.timelineContent}>
          <View style={s.timelineHeader}>
            <Text style={s.timelineTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={[s.timelineAmount, { color: isDebit ? '#EF4444' : '#22C55E' }]}>
              {isDebit ? '-' : '+'}{Math.abs(item.amount).toLocaleString('fr-FR')} F
            </Text>
          </View>
          <Text style={s.timelineSub} numberOfLines={1}>{item.subtitle}</Text>
          <Text style={s.timelineDate}>{fmtDate(item.date)}</Text>
          {item.badge && (
            <View style={[s.timelineBadge, { backgroundColor: (item.badge_color || C.orange) + '20' }]}>
              <Text style={[s.timelineBadgeTxt, { color: item.badge_color || C.orange }]}>
                {item.badge}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <ScreenHeader
        navigation={navigation}
        title="Mes activités"
        subtitle="Historique complet SOKORA"
        dark={true}
      />

      {/* ── Carte résumé ── */}
      <View style={s.summaryCard}>
        <View style={s.summaryOrb} />
        <View style={s.summaryLeft}>
          <Text style={s.summaryLabel}>DÉPENSÉ CE MOIS</Text>
          <Text style={s.summaryAmount}>{monthTotal.toLocaleString('fr-FR')} F</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryRight}>
          <Text style={s.summaryLabel}>TRANSACTIONS</Text>
          <Text style={s.summaryCount}>{monthCount}</Text>
        </View>
      </View>

      {/* ── Filtres horizontaux ── */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={f => f.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filtersRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            style={[s.filterChip, filter === f.id && s.filterChipActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[s.filterTxt, filter === f.id && s.filterTxtActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Timeline ── */}
      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={C.orange} />
          <Text style={s.loaderTxt}>Chargement de vos activités…</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item.id}
          renderItem={renderRow}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadActivity(); }}
              tintColor={C.orange}
              colors={[C.orange]}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="time-outline" size={54} color={C.textG} />
              <Text style={s.emptyTxt}>Aucune activité trouvée</Text>
              <Text style={s.emptySub}>Vos paiements, réservations et services apparaîtront ici</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Résumé ──
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: C.navy,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: C.navy,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  summaryOrb: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    top: -50, right: -30,
    backgroundColor: 'rgba(0,212,170,0.12)',
  },
  summaryLeft:  { flex: 1 },
  summaryRight: { flex: 1, alignItems: 'flex-end' },
  summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  summaryLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.2, fontWeight: '700', textTransform: 'uppercase' },
  summaryAmount:{ fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 4 },
  summaryCount: { fontSize: 28, fontWeight: '900', color: C.orange, marginTop: 4 },

  // ── Filtres ──
  filtersRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipActive: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  filterTxt:       { fontSize: 12, fontWeight: '600', color: C.textG },
  filterTxtActive: { color: '#fff' },

  // ── Timeline ──
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },

  periodHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 16, marginBottom: 6,
  },
  periodTxt:  { fontSize: 11, fontWeight: '700', color: C.textG, textTransform: 'uppercase', letterSpacing: 0.8 },
  periodLine: { flex: 1, height: 1, backgroundColor: C.border },

  timelineItem: {
    flexDirection: 'row',
    marginBottom: 2,
  },

  timelineLeft: {
    alignItems: 'center',
    marginRight: 12,
    width: 38,
  },
  timelineDot: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  timelineConnector: {
    flex: 1, width: 2, backgroundColor: C.border,
    minHeight: 14, marginTop: 2,
  },

  timelineContent: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  timelineHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 3,
  },
  timelineTitle:  { flex: 1, fontSize: 13, fontWeight: '700', color: C.textD, marginRight: 8 },
  timelineAmount: { fontSize: 13, fontWeight: '800' },
  timelineSub:    { fontSize: 11, color: C.textG, marginBottom: 3 },
  timelineDate:   { fontSize: 10, color: C.textG },
  timelineBadge:  {
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  timelineBadgeTxt: { fontSize: 10, fontWeight: '700' },

  // ── Loader ──
  loader:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  loaderTxt: { fontSize: 13, color: C.textG },

  // ── Empty ──
  empty:    { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTxt: { fontSize: 16, fontWeight: '700', color: C.textG },
  emptySub: { fontSize: 12, color: C.textG, textAlign: 'center', paddingHorizontal: 40 },
});
