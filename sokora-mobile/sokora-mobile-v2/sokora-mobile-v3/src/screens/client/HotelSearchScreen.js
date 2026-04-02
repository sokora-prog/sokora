/**
 * HotelSearchScreen — SOKORA Hotels
 * Recherche hôtels avec disponibilités temps réel
 * Connexion directe au module hotel backend (/hotel/nearby, /hotel/{id}/availability)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, ActivityIndicator, Dimensions,
  Platform, FlatList, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../../utils/constants';
import { Colors, Spacing, Radius, Shadow, Typography } from '../../utils/constants';

const { width: W } = Dimensions.get('window');

const BRAND = {
  orange: '#F26D21', orangeL: '#F9A050',
  blue:   '#3065A6', blueL:   '#7AA6D4',
  navy:   '#1A2E4A', bg:      '#F2F5FB',
  surface:'#FFFFFF', border:  '#DDE4F0',
  text:   '#1A2E4A', muted:   '#7A8FAB',
};

const ROOM_TYPES_LABELS = {
  SIMPLE:   { label: 'Simple',   icon: '🛏️',  color: '#6366F1' },
  DOUBLE:   { label: 'Double',   icon: '🛏️🛏️', color: BRAND.blue  },
  SUITE:    { label: 'Suite',    icon: '👑',   color: BRAND.orange},
  STANDARD: { label: 'Standard', icon: '🏠',   color: '#19A99D' },
};

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[skeletonStyles.card, { opacity: pulse }]}>
      <View style={skeletonStyles.banner} />
      <View style={{ padding: 12, gap: 8 }}>
        <View style={skeletonStyles.line} />
        <View style={[skeletonStyles.line, { width: '60%' }]} />
        <View style={[skeletonStyles.line, { width: '40%' }]} />
      </View>
    </Animated.View>
  );
}
const skeletonStyles = StyleSheet.create({
  card:   { backgroundColor: BRAND.surface, borderRadius: 16, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: BRAND.border },
  banner: { height: 140, backgroundColor: BRAND.border },
  line:   { height: 12, backgroundColor: BRAND.border, borderRadius: 6, width: '80%' },
});

// ── Étoiles ───────────────────────────────────────────────────────────────────
function Stars({ rating }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={12} color="#F59E0B" />
      ))}
    </View>
  );
}

export default function HotelSearchScreen({ navigation }) {
  const today    = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [hotels,    setHotels]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [checkin,   setCheckin]   = useState(today);
  const [checkout,  setCheckout]  = useState(tomorrow);
  const [search,    setSearch]    = useState('');
  const [sortBy,    setSortBy]    = useState('rating');
  const [error,     setError]     = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => { fetchHotels(); }, [checkin, checkout]));

  const fetchHotels = async () => {
    setLoading(true);
    setError(null);
    try {
      // Cherche hôtels nearby (lat/lng Abidjan par défaut)
      const params = new URLSearchParams({
        lat: '5.3364',
        lng: '-4.0267',
        radius_km: '50',
        checkin_date: checkin,
        checkout_date: checkout,
      });
      const res = await fetch(`${API_URL}/hotel/nearby?${params}`);
      if (res.ok) {
        const data = await res.json();
        setHotels(Array.isArray(data) ? data : []);
      } else {
        setHotels(DEMO_HOTELS);
      }
    } catch {
      setHotels(DEMO_HOTELS);
    }
    setLoading(false);
    setRefreshing(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const filtered = hotels
    .filter(h => !search || h.name?.toLowerCase().includes(search.toLowerCase()) || h.address?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'rating')   return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === 'price')    return (a.min_price ?? 0) - (b.min_price ?? 0);
      if (sortBy === 'distance') return (a.distance_km ?? 0) - (b.distance_km ?? 0);
      return 0;
    });

  const SORTS = [
    { id: 'rating',   label: '⭐ Note' },
    { id: 'price',    label: '💰 Prix' },
    { id: 'distance', label: '📍 Distance' },
  ];

  const nights = Math.max(1, Math.round((new Date(checkout) - new Date(checkin)) / 86400000));

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Hôtels & Résidences</Text>
          <Text style={s.headerSub}>{checkin} → {checkout} · {nights} nuit{nights > 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* ── Dates ── */}
      <View style={s.datesRow}>
        <View style={s.dateBox}>
          <Text style={s.dateLabel}>📅 Arrivée</Text>
          <TextInput
            style={s.dateInput}
            value={checkin}
            onChangeText={setCheckin}
            placeholder="AAAA-MM-JJ"
          />
        </View>
        <Ionicons name="arrow-forward" size={18} color={BRAND.muted} />
        <View style={s.dateBox}>
          <Text style={s.dateLabel}>📅 Départ</Text>
          <TextInput
            style={s.dateInput}
            value={checkout}
            onChangeText={setCheckout}
            placeholder="AAAA-MM-JJ"
          />
        </View>
        <TouchableOpacity style={s.searchDateBtn} onPress={fetchHotels}>
          <Ionicons name="search" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Searchbar + Tri ── */}
      <View style={s.toolbar}>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={16} color={BRAND.muted} />
          <TextInput
            style={s.searchInput}
            placeholder="Chercher un hôtel..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={BRAND.muted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={BRAND.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.sortRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {SORTS.map(sort => (
          <TouchableOpacity
            key={sort.id}
            style={[s.sortChip, sortBy === sort.id && s.sortChipActive]}
            onPress={() => setSortBy(sort.id)}
          >
            <Text style={[s.sortChipTxt, sortBy === sort.id && s.sortChipTxtActive]}>{sort.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Liste ── */}
      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </ScrollView>
      ) : (
        <Animated.FlatList
          data={filtered}
          keyExtractor={item => String(item.id ?? item.name)}
          style={{ opacity: fadeAnim }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHotels(); }} tintColor={BRAND.orange} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>🏨</Text>
              <Text style={s.emptyTitle}>Aucun hôtel trouvé</Text>
              <Text style={s.emptySub}>Modifiez vos dates ou votre recherche</Text>
            </View>
          }
          renderItem={({ item }) => (
            <HotelCard
              hotel={item}
              checkin={checkin}
              checkout={checkout}
              nights={nights}
              onPress={() => navigation.navigate('HotelDetail', { hotel: item, checkin, checkout, nights })}
            />
          )}
        />
      )}
    </View>
  );
}

function HotelCard({ hotel, nights, onPress }) {
  const fmt = n => (n ?? 0).toLocaleString('fr-FR');
  const minPrice = hotel.min_price ?? hotel.available_rooms?.[0]?.base_price ?? 0;
  const availCount = hotel.available_rooms_count ?? hotel.available_rooms?.length ?? 0;

  return (
    <TouchableOpacity style={sc.card} onPress={onPress} activeOpacity={0.88}>
      {/* Banner emoji */}
      <View style={sc.banner}>
        <Text style={{ fontSize: 56 }}>🏨</Text>
        {hotel.is_premium && (
          <View style={sc.premiumBadge}>
            <Text style={sc.premiumTxt}>✨ Premium</Text>
          </View>
        )}
        {availCount > 0 ? (
          <View style={[sc.availBadge, { backgroundColor: '#4CAF6E' }]}>
            <Text style={sc.availTxt}>{availCount} chambre{availCount > 1 ? 's' : ''} dispo</Text>
          </View>
        ) : (
          <View style={[sc.availBadge, { backgroundColor: '#E84040' }]}>
            <Text style={sc.availTxt}>Complet</Text>
          </View>
        )}
      </View>

      <View style={sc.body}>
        <View style={sc.titleRow}>
          <Text style={sc.name} numberOfLines={1}>{hotel.name}</Text>
          {hotel.is_verified && <Ionicons name="checkmark-circle" size={16} color={BRAND.blue} />}
        </View>
        <View style={sc.metaRow}>
          <Stars rating={hotel.rating ?? 4} />
          <Text style={sc.reviews}>({hotel.reviews_count ?? 0} avis)</Text>
        </View>
        <View style={sc.addrRow}>
          <Ionicons name="location-outline" size={12} color={BRAND.muted} />
          <Text style={sc.addr} numberOfLines={1}>{hotel.address ?? hotel.city ?? 'Abidjan'}</Text>
          {hotel.distance_km != null && (
            <Text style={sc.dist}>{hotel.distance_km.toFixed(1)} km</Text>
          )}
        </View>

        {/* Types de chambres disponibles */}
        {hotel.available_rooms && hotel.available_rooms.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {hotel.available_rooms.slice(0, 4).map((rm, i) => {
              const rt = ROOM_TYPES_LABELS[rm.type] ?? ROOM_TYPES_LABELS.STANDARD;
              return (
                <View key={i} style={[sc.roomChip, { borderColor: rt.color + '40', backgroundColor: rt.color + '10' }]}>
                  <Text style={{ fontSize: 12 }}>{rt.icon}</Text>
                  <Text style={[sc.roomChipTxt, { color: rt.color }]}>{rt.label}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={sc.footer}>
          <View>
            <Text style={sc.priceFrom}>À partir de</Text>
            <Text style={sc.price}>{fmt(minPrice)} <Text style={sc.priceSub}>F/nuit</Text></Text>
            {nights > 1 && <Text style={sc.priceTotal}>≈ {fmt(minPrice * nights)} F total</Text>}
          </View>
          <TouchableOpacity
            style={[sc.bookBtn, availCount === 0 && { backgroundColor: BRAND.muted }]}
            onPress={onPress}
            disabled={availCount === 0}
          >
            <Text style={sc.bookBtnTxt}>{availCount > 0 ? 'Voir →' : 'Complet'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const sc = StyleSheet.create({
  card: {
    backgroundColor: BRAND.surface, borderRadius: 18, marginBottom: 14,
    borderWidth: 1, borderColor: BRAND.border, overflow: 'hidden',
    ...Shadow.md,
  },
  banner: {
    height: 140, backgroundColor: BRAND.blueL + '30',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  premiumBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: '#F59E0B', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  premiumTxt: { fontSize: 11, fontWeight: '700', color: '#fff' },
  availBadge: {
    position: 'absolute', top: 10, right: 10,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  availTxt: { fontSize: 11, fontWeight: '700', color: '#fff' },
  body: { padding: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name:     { fontSize: 16, fontWeight: '800', color: BRAND.text, flex: 1 },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  reviews:  { fontSize: 11, color: BRAND.muted },
  addrRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addr:     { fontSize: 12, color: BRAND.muted, flex: 1 },
  dist:     { fontSize: 11, fontWeight: '700', color: BRAND.blue, backgroundColor: BRAND.blueL + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  roomChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginRight: 6 },
  roomChipTxt: { fontSize: 11, fontWeight: '600' },
  footer:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 },
  priceFrom:{ fontSize: 10, color: BRAND.muted },
  price:    { fontSize: 20, fontWeight: '900', color: BRAND.navy },
  priceSub: { fontSize: 12, fontWeight: '400', color: BRAND.muted },
  priceTotal:{ fontSize: 11, color: BRAND.muted },
  bookBtn:  { backgroundColor: BRAND.orange, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  bookBtnTxt:{ fontSize: 14, fontWeight: '800', color: '#fff' },
});

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BRAND.bg },
  header: {
    backgroundColor: BRAND.navy,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  datesRow: {
    backgroundColor: BRAND.surface,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BRAND.border,
  },
  dateBox:    { flex: 1 },
  dateLabel:  { fontSize: 10, color: BRAND.muted, fontWeight: '600', marginBottom: 2 },
  dateInput:  { fontSize: 13, fontWeight: '700', color: BRAND.text },
  searchDateBtn: {
    backgroundColor: BRAND.orange, borderRadius: 10,
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
  },

  toolbar: {
    backgroundColor: BRAND.surface, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BRAND.border,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: BRAND.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: BRAND.text },
  sortRow:    { backgroundColor: BRAND.surface, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BRAND.border },
  sortChip:   { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: BRAND.bg, borderWidth: 1, borderColor: BRAND.border },
  sortChipActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  sortChipTxt:    { fontSize: 12, fontWeight: '600', color: BRAND.muted },
  sortChipTxtActive: { color: '#fff' },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: BRAND.text },
  emptySub:   { fontSize: 13, color: BRAND.muted },
});

// ── Données démo ──────────────────────────────────────────────────────────────
const DEMO_HOTELS = [
  {
    id: 1, name: 'Hotel Le Diplomate', address: 'Plateau, Abidjan',
    rating: 4.5, reviews_count: 128, is_premium: true, is_verified: true,
    min_price: 35000, distance_km: 2.1,
    available_rooms_count: 5,
    available_rooms: [
      { type: 'SIMPLE', base_price: 35000 },
      { type: 'DOUBLE', base_price: 55000 },
      { type: 'SUITE',  base_price: 120000 },
    ],
  },
  {
    id: 2, name: 'Résidence Les Palmiers', address: 'Cocody, Abidjan',
    rating: 4.2, reviews_count: 84, is_premium: false, is_verified: true,
    min_price: 22000, distance_km: 4.7,
    available_rooms_count: 3,
    available_rooms: [
      { type: 'STANDARD', base_price: 22000 },
      { type: 'DOUBLE',   base_price: 38000 },
    ],
  },
  {
    id: 3, name: 'Hotel Ivoire Prestige', address: 'Marcory, Abidjan',
    rating: 4.8, reviews_count: 212, is_premium: true, is_verified: true,
    min_price: 65000, distance_km: 1.3,
    available_rooms_count: 2,
    available_rooms: [
      { type: 'DOUBLE', base_price: 65000 },
      { type: 'SUITE',  base_price: 180000 },
    ],
  },
  {
    id: 4, name: 'Auberge du Centre', address: 'Yopougon, Abidjan',
    rating: 3.9, reviews_count: 47, is_premium: false, is_verified: false,
    min_price: 15000, distance_km: 8.2,
    available_rooms_count: 0,
    available_rooms: [],
  },
];
