/**
 * DiscoverScreen — SOKORA EXPLORE 🗺️
 * Géodécouverte des établissements avec GPS
 * Design SOKORA : cartes épurées, badges distance, filtres dynamiques
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator, RefreshControl,
  Animated, Dimensions, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';
import { discoverService } from '../../services/api';
import ScreenHeader from '../../components/ScreenHeader';

const { width: W } = Dimensions.get('window');

// ── Catégories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',        label: 'Tout',        emoji: '🌍', color: Colors.navy   },
  { id: 'maquis',    label: 'Maquis',      emoji: '🍖', color: '#E67E22'     },
  { id: 'restaurant',label: 'Restaurant',  emoji: '🍽️', color: Colors.orange },
  { id: 'bar',       label: 'Bar',         emoji: '🍺', color: Colors.teal   },
  { id: 'hotel',     label: 'Hôtel',       emoji: '🏨', color: Colors.purple },
  { id: 'voyage',    label: 'Voyage',      emoji: '🚌', color: '#3498DB'     },
];

const SORT_OPTIONS = [
  { id: 'distance', label: '📍 Distance' },
  { id: 'rating',   label: '⭐ Note'     },
  { id: 'popular',  label: '🔥 Populaire'},
  { id: 'promo',    label: '🏷️ Promos'   },
];

// ── Données démo ──────────────────────────────────────────────────────────────
const DEMO_ESTABLISHMENTS = [
  {
    id: 1, name: 'Maquis La Belle Vie', type: 'maquis',
    city: 'Cocody', address: 'Angré 8ème Tranche',
    distance: 0.3, rating: 4.8, reviews_count: 124,
    is_open: true, is_premium: true, is_verified: true,
    promo: '-25% sur commande SOKORA',
    tags: ['Poulet braisé', 'Attiéké', 'Ambiance'],
    price_range: '💰💰',
  },
  {
    id: 2, name: 'Hotel Le Diplomate', type: 'hotel',
    city: 'Plateau', address: 'Avenue Botreau-Roussel',
    distance: 1.2, rating: 4.6, reviews_count: 89,
    is_open: true, is_premium: true, is_verified: true,
    promo: null,
    tags: ['Piscine', 'Restaurant', 'Climatisé'],
    price_range: '💰💰💰',
  },
  {
    id: 3, name: 'Bar Étoile VIP', type: 'bar',
    city: 'Marcory', address: 'Zone 4',
    distance: 2.1, rating: 4.4, reviews_count: 203,
    is_open: true, is_premium: false, is_verified: true,
    promo: 'Soirée gratuite ce soir !',
    tags: ['Cocktails', 'DJ', 'Ambiance'],
    price_range: '💰💰',
  },
  {
    id: 4, name: 'Restaurant Saveurs d\'Abidjan', type: 'restaurant',
    city: 'Yopougon', address: 'Marché Selmer',
    distance: 3.7, rating: 4.3, reviews_count: 156,
    is_open: false, is_premium: false, is_verified: true,
    promo: null,
    tags: ['Cuisine ivoirienne', 'Familial', 'Terrasse'],
    price_range: '💰',
  },
  {
    id: 5, name: 'Maquis Wôyo Beach', type: 'maquis',
    city: 'Grand-Bassam', address: 'Plage de Bassam',
    distance: 44.2, rating: 4.9, reviews_count: 342,
    is_open: true, is_premium: true, is_verified: true,
    promo: '-20% avec SOKORA Wallet',
    tags: ['Plage', 'Poisson frais', 'Vue mer'],
    price_range: '💰💰',
  },
  {
    id: 6, name: 'Résidence Les Palmiers', type: 'hotel',
    city: 'Bouaké', address: 'Centre-Ville',
    distance: 338, rating: 4.1, reviews_count: 67,
    is_open: true, is_premium: false, is_verified: false,
    promo: null,
    tags: ['Calme', 'Parking', 'Wifi'],
    price_range: '💰💰',
  },
  {
    id: 7, name: 'Terminal Voyage UTB', type: 'voyage',
    city: 'Adjamé', address: 'Gare Routière',
    distance: 4.8, rating: 4.0, reviews_count: 512,
    is_open: true, is_premium: true, is_verified: true,
    promo: 'Abidjan → Bouaké dès 3 500F',
    tags: ['Climatisé', 'GPS', 'Ponctuel'],
    price_range: '💰',
  },
  {
    id: 8, name: 'Chic Lounge & Bar', type: 'bar',
    city: 'Riviera', address: 'Riviera Palmeraie',
    distance: 1.8, rating: 4.7, reviews_count: 88,
    is_open: false, is_premium: true, is_verified: true,
    promo: null,
    tags: ['Rooftop', 'Cigares', 'VIP'],
    price_range: '💰💰💰',
  },
];

// ── Composant EstablishmentCard ──────────────────────────────────────────────
function EstablishmentCard({ item, onPress, onPromo }) {
  const scale = useRef(new Animated.Value(1)).current;
  const cat = CATEGORIES.find(c => c.id === item.type) || CATEGORIES[0];

  const handlePressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Animated.View style={[styles.estabCard, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {/* ── Bannière top ── */}
        <View style={[styles.estabBanner, { backgroundColor: cat.color + '18' }]}>
          {/* Emoji établissement */}
          <Text style={styles.estabBannerEmoji}>{cat.emoji}</Text>

          {/* Badges */}
          <View style={styles.estabBadges}>
            {item.is_premium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>⭐ Premium</Text>
              </View>
            )}
            {item.promo && (
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>🏷️ Promo</Text>
              </View>
            )}
          </View>

          {/* Statut ouvert/fermé */}
          <View style={[styles.openBadge, { backgroundColor: item.is_open ? Colors.green : Colors.textFaint }]}>
            <View style={[styles.openDot, { backgroundColor: '#fff' }]} />
            <Text style={styles.openText}>{item.is_open ? 'Ouvert' : 'Fermé'}</Text>
          </View>
        </View>

        {/* ── Corps ── */}
        <View style={styles.estabBody}>
          <View style={styles.estabNameRow}>
            <Text style={styles.estabName} numberOfLines={1}>{item.name}</Text>
            {item.is_verified && (
              <Ionicons name="checkmark-circle" size={16} color={Colors.teal} />
            )}
          </View>

          <View style={styles.estabMeta}>
            <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.estabCity}>{item.city} · {item.address}</Text>
          </View>

          <View style={styles.estabInfoRow}>
            {/* Rating */}
            <View style={styles.ratingChip}>
              <Ionicons name="star" size={12} color={Colors.gold} />
              <Text style={styles.ratingText}>{item.rating}</Text>
              <Text style={styles.reviewsText}>({item.reviews_count})</Text>
            </View>

            {/* Distance */}
            <View style={styles.distanceChip}>
              <Ionicons name="navigate-outline" size={12} color={Colors.teal} />
              <Text style={styles.distanceText}>
                {(item.distance ?? 0) < 1
                  ? `${Math.round((item.distance ?? 0) * 1000)}m`
                  : `${(item.distance ?? 0).toFixed(1)}km`}
              </Text>
            </View>

            {/* Prix */}
            <Text style={styles.priceRange}>{item.price_range}</Text>
          </View>

          {/* Tags */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsRow}>
            {(item.tags || []).map((tag, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Promo */}
          {item.promo && (
            <TouchableOpacity style={styles.promoStrip} onPress={() => onPromo?.(item)}>
              <Ionicons name="pricetag" size={13} color={Colors.orange} />
              <Text style={styles.promoStripText} numberOfLines={1}>{item.promo}</Text>
              <Ionicons name="chevron-forward" size={13} color={Colors.orange} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Actions rapides ── */}
        <View style={styles.estabActions}>
          <TouchableOpacity style={styles.quickAction} onPress={onPress}>
            <Ionicons name="eye-outline" size={16} color={Colors.navy} />
            <Text style={styles.quickActionText}>Voir</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.quickAction, styles.quickActionPrimary]} onPress={onPress}>
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={[styles.quickActionText, { color: '#fff' }]}>Réserver</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── EstablishmentCardHorizontal (pour "sponsorisés") ────────────────────────
function FeaturedCard({ item, onPress }) {
  const cat = CATEGORIES.find(c => c.id === item.type) || CATEGORIES[0];
  return (
    <TouchableOpacity style={styles.featuredCard} onPress={onPress} activeOpacity={0.88}>
      <View style={[styles.featuredBanner, { backgroundColor: cat.color + '25' }]}>
        <Text style={{ fontSize: 40 }}>{cat.emoji}</Text>
        {item.promo && (
          <View style={styles.featuredPromoBadge}>
            <Text style={styles.featuredPromoBadgeText}>{item.promo.split(' ').slice(0, 3).join(' ')}</Text>
          </View>
        )}
      </View>
      <View style={styles.featuredBody}>
        <Text style={styles.featuredName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.featuredCity}>{item.city}</Text>
        <View style={styles.featuredRating}>
          <Ionicons name="star" size={11} color={Colors.gold} />
          <Text style={styles.featuredRatingText}>{item.rating}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Écran principal ──────────────────────────────────────────────────────────
export default function DiscoverScreen({ navigation }) {
  const [search, setSearch]         = useState('');
  const [category, setCategory]     = useState('all');
  const [sortBy, setSortBy]         = useState('distance');
  const [openOnly, setOpenOnly]     = useState(false);
  const [establishments, setEstab]  = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasGPS, setHasGPS]         = useState(true);
  const searchAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      const data = await discoverService.list({
        category: category === 'all' ? undefined : category,
        sort: sortBy,
        open_only: openOnly,
        search: search || undefined,
      });
      if (Array.isArray(data) && data.length > 0) {
        setEstab(data);
      } else {
        // Fallback sur les données démo si l'API retourne vide ou échoue
        setEstab(prev => prev.length === 0 ? DEMO_ESTABLISHMENTS : prev);
      }
    } catch {
      // Fallback démo : ne pas casser l'UI si l'API est indisponible
      setEstab(prev => prev.length === 0 ? DEMO_ESTABLISHMENTS : prev);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, sortBy, openOnly, search]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const filtered = establishments.filter(e => {
    const matchCat    = category === 'all' || e.type === category;
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
                        e.city.toLowerCase().includes(search.toLowerCase());
    const matchOpen   = !openOnly || e.is_open;
    return matchCat && matchSearch && matchOpen;
  }).sort((a, b) => {
    if (sortBy === 'rating')   return b.rating - a.rating;
    if (sortBy === 'popular')  return b.reviews_count - a.reviews_count;
    if (sortBy === 'promo')    return (b.promo ? 1 : 0) - (a.promo ? 1 : 0);
    return a.distance - b.distance;
  });

  const featured = filtered.filter(e => e.is_premium).slice(0, 5);

  const handleEstablishment = (item) => {
    navigation?.navigate('EstablishmentPage', { establishment: item });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ScreenHeader
          navigation={navigation}
          title="Explorer"
          subtitle="Découvrez les établissements SOKORA"
          dark={true}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={Colors.orange} />
          <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Chargement des établissements...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <ScreenHeader
        navigation={navigation}
        title="Explorer"
        subtitle="Découvrez les établissements SOKORA"
        dark={true}
        rightIcon="map-outline"
        onRightPress={() => {}}
      >
        {/* Barre de recherche */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un endroit, une cuisine..."
            placeholderTextColor={Colors.textFaint}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </ScreenHeader>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <EstablishmentCard
            item={item}
            onPress={() => handleEstablishment(item)}
            onPromo={() => handleEstablishment(item)}
          />
        )}
        contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={Colors.orange}
          />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <>
            {/* Filtres catégorie */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, category === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Text style={styles.catChipEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.catChipLabel, category === cat.id && { color: '#fff' }]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Filtres avancés */}
            <View style={styles.filterBar}>
              {/* Sort */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
                {SORT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.sortChip, sortBy === opt.id && styles.sortChipActive]}
                    onPress={() => setSortBy(opt.id)}
                  >
                    <Text style={[styles.sortChipText, sortBy === opt.id && styles.sortChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.openToggle}>
                <Text style={styles.openToggleLabel}>Ouverts</Text>
                <Switch
                  value={openOnly}
                  onValueChange={setOpenOnly}
                  trackColor={{ false: Colors.border, true: Colors.green + '60' }}
                  thumbColor={openOnly ? Colors.green : Colors.textFaint}
                />
              </View>
            </View>

            {/* Featured / Sponsorisés */}
            {featured.length > 0 && (
              <View style={styles.featuredSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>⭐ À la une</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAll}>Tout voir →</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm }}>
                  {featured.map(item => (
                    <FeaturedCard key={item.id} item={item} onPress={() => handleEstablishment(item)} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <Text style={styles.statsText}>
                {filtered.length} établissement{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.statsOpen}>
                {filtered.filter(e => e.is_open).length} ouverts maintenant
              </Text>
            </View>
          </>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🔍</Text>
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptyText}>Essayez une autre catégorie ou ville</Text>
          </View>
        }
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    backgroundColor: Colors.navy,
    paddingTop: 54, paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl, gap: Spacing.md,
  },
  headerTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: Typography['2xl'], fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  locationText:{ fontSize: Typography.sm, color: 'rgba(255,255,255,0.7)' },
  mapToggle:   {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
  },
  searchInput: { flex: 1, fontSize: Typography.base, color: Colors.text },

  // Catégories
  categoryRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  catChipEmoji: { fontSize: 15 },
  catChipLabel: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textMuted },

  // Filtres
  filterBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.md,
  },
  sortChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  sortChipActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  sortChipText:       { fontSize: Typography.xs, fontWeight: '600', color: Colors.textMuted },
  sortChipTextActive: { color: '#fff' },
  openToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  openToggleLabel: { fontSize: Typography.xs, fontWeight: '600', color: Colors.text },

  // Featured
  featuredSection: { marginBottom: Spacing.sm },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: Typography.md, fontWeight: '800', color: Colors.text },
  seeAll:       { fontSize: Typography.sm, color: Colors.orange, fontWeight: '600' },

  featuredCard: {
    width: 150, backgroundColor: Colors.surface,
    borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  featuredBanner: {
    height: 80, justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  featuredPromoBadge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: Colors.orange,
    borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2,
  },
  featuredPromoBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  featuredBody: { padding: Spacing.sm },
  featuredName: { fontSize: Typography.sm, fontWeight: '700', color: Colors.navy },
  featuredCity: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  featuredRating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  featuredRatingText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.gold },

  // Stats
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  statsText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.text },
  statsOpen: { fontSize: Typography.xs, color: Colors.green, fontWeight: '600' },

  // Establishment Card
  estabCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  estabBanner: {
    height: 80, justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', paddingHorizontal: Spacing.lg,
    position: 'relative',
  },
  estabBannerEmoji: { fontSize: 40 },
  estabBadges: {
    position: 'absolute', top: Spacing.sm, left: Spacing.sm,
    flexDirection: 'row', gap: Spacing.xs,
  },
  premiumBadge: {
    backgroundColor: Colors.gold + '30',
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.gold,
  },
  premiumBadgeText: { fontSize: 9, fontWeight: '700', color: '#B7791F' },
  promoBadge: {
    backgroundColor: Colors.orangePale,
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.orange + '60',
  },
  promoBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.orange },
  openBadge: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full,
  },
  openDot:  { width: 5, height: 5, borderRadius: 3 },
  openText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  estabBody: { padding: Spacing.md },
  estabNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estabName: { fontSize: Typography.md, fontWeight: '800', color: Colors.navy, flex: 1 },
  estabMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, marginBottom: Spacing.sm },
  estabCity: { fontSize: Typography.xs, color: Colors.textMuted },
  estabInfoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.text },
  reviewsText: { fontSize: Typography.xs, color: Colors.textFaint },
  distanceChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  distanceText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.teal },
  priceRange: { fontSize: Typography.sm, marginLeft: 'auto' },

  tagsRow: { marginBottom: Spacing.sm },
  tag: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    marginRight: Spacing.xs,
    borderWidth: 1, borderColor: Colors.border,
  },
  tagText: { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: '500' },

  promoStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.orangePale,
    borderRadius: Radius.md, padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  promoStripText: { flex: 1, fontSize: Typography.xs, fontWeight: '600', color: Colors.orange },

  estabActions: {
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  quickAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
  },
  quickActionPrimary: { backgroundColor: Colors.orange, borderColor: Colors.orange, ...Shadow.orange },
  quickActionText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.navy },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: Spacing['4xl'], gap: Spacing.md },
  emptyTitle: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text },
  emptyText:  { fontSize: Typography.sm, color: Colors.textMuted },
});
