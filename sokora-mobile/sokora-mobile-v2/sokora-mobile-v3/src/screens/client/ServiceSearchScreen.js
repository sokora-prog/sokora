/**
 * ServiceSearchScreen — SOKORA Services
 * Recherche d'artisans par catégorie et ville
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, FlatList, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../../utils/constants';
import CityPicker from '../../components/CityPicker';
import { useGeolocation, formatDistance } from '../../hooks/useGeolocation';
import ScreenHeader from '../../components/ScreenHeader';

const C = {
  navy: '#0F1E35', orange: '#FF6B35', teal: '#00D4AA',
  bg: '#F4F6F9', white: '#FFFFFF', text: '#1A1A2E', muted: '#8892A4',
  border: '#DDE4F0', card: '#FFFFFF',
};

export default function ServiceSearchScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [providers,  setProviders]  = useState([]);
  const [selCat,     setSelCat]     = useState(null);
  const [city,       setCity]       = useState('');
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [loadingCats,setLoadingCats]= useState(true);
  const { coords } = useGeolocation({ autoRequest: true });

  useFocusEffect(useCallback(() => { loadCategories(); }, []));

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/services/categories`);
      const data = await res.json();
      setCategories(data);
    } catch {}
    setLoadingCats(false);
  };

  const searchProviders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selCat) params.append('category_id', selCat);
      if (city)   params.append('city', city.split('—')[0].trim());
      if (search) params.append('search', search);
      if (coords) {
        params.append('client_lat', coords.latitude);
        params.append('client_lng', coords.longitude);
      }
      const res = await fetch(`${API_URL}/services/providers?${params}`);
      const data = await res.json();
      setProviders(data.providers || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { searchProviders(); }, [selCat, city]);

  const fmt = n => n ? `${Number(n).toLocaleString('fr-FR')} F` : 'Prix à définir';

  return (
    <View style={s.root}>
      <ScreenHeader
        navigation={navigation}
        title="🔧 Services"
        subtitle="Trouvez un artisan près de chez vous"
      >
        {coords && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="navigate-circle" size={12} color="#00D4AA" />
            <Text style={{ fontSize: 10, color: '#00D4AA' }}>Géolocalisation active — résultats triés par distance</Text>
          </View>
        )}
      </ScreenHeader>

      {/* Recherche */}
      <View style={s.searchBox}>
        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={18} color={C.muted} />
          <TextInput
            style={s.searchInput}
            placeholder="Rechercher un artisan..."
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={searchProviders}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); searchProviders(); }}>
              <Ionicons name="close-circle" size={18} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>
        <CityPicker
          value={city}
          onChange={setCity}
          placeholder="Toutes les villes"
          style={{ marginTop: 10 }}
        />
      </View>

      {/* Catégories */}
      {loadingCats ? (
        <ActivityIndicator color={C.orange} style={{ margin: 16 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catsRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' }}>
          <TouchableOpacity
            style={[s.catChip, !selCat && s.catChipActive]}
            onPress={() => setSelCat(null)}
          >
            <Text style={[s.catChipTxt, !selCat && s.catChipTxtActive]}>Tous</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[s.catChip, selCat === cat.id && s.catChipActive]}
              onPress={() => setSelCat(selCat === cat.id ? null : cat.id)}
            >
              <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
              <Text style={[s.catChipTxt, selCat === cat.id && s.catChipTxtActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Résultats */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.orange} /></View>
      ) : providers.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48 }}>🔍</Text>
          <Text style={s.emptyTxt}>Aucun artisan trouvé</Text>
          <Text style={s.emptySub}>Essayez une autre catégorie ou ville</Text>
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: p }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('ServiceProvider', { provider: p })}
              activeOpacity={0.85}
            >
              {/* Avatar */}
              <View style={[s.avatar, { backgroundColor: C.orange + '20' }]}>
                <Text style={{ fontSize: 28 }}>{p.category_icon || '🔧'}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.cardName}>{p.name}</Text>
                  {p.is_verified && (
                    <View style={s.verifiedBadge}>
                      <Text style={s.verifiedTxt}>✓ Vérifié</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cardCat}>{p.category_icon} {p.category_name}</Text>
                <View style={s.cardMeta}>
                  <Ionicons name="location-outline" size={12} color={C.muted} />
                  <Text style={s.cardMetaTxt}>{p.city}{p.neighborhood ? ` · ${p.neighborhood}` : ''}</Text>
                </View>
                {p.distance_km != null && (
                  <View style={[s.cardMeta, { marginTop: 2 }]}>
                    <Ionicons name="navigate-outline" size={12} color="#00D4AA" />
                    <Text style={[s.cardMetaTxt, { color: '#00D4AA', fontWeight: '700' }]}>
                      {formatDistance(p.distance_km)} de vous
                    </Text>
                  </View>
                )}
                <View style={s.cardFooter}>
                  <Text style={s.cardPrice}>{fmt(p.base_price)}/{p.price_unit}</Text>
                  {p.reviews_count > 0 && (
                    <View style={s.ratingRow}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text style={s.ratingTxt}>{p.rating.toFixed(1)} ({p.reviews_count})</Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.muted} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },

  searchBox: { backgroundColor: C.white, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 14, color: C.text },

  catsRow: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 58, flexGrow: 0 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border },
  catChipActive: { backgroundColor: C.orange, borderColor: C.orange },
  catChipTxt:    { fontSize: 12, fontWeight: '700', color: C.muted },
  catChipTxtActive: { color: '#fff' },

  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTxt: { fontSize: 16, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 13, color: C.muted },

  card: { backgroundColor: C.white, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  avatar: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 15, fontWeight: '800', color: C.text },
  cardCat:  { fontSize: 12, color: C.muted, marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  cardMetaTxt: { fontSize: 11, color: C.muted },
  cardFooter:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  cardPrice:   { fontSize: 13, fontWeight: '800', color: C.orange },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingTxt:   { fontSize: 11, fontWeight: '600', color: C.text },
  verifiedBadge: { backgroundColor: '#00D4AA20', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedTxt:   { fontSize: 9, fontWeight: '800', color: '#00D4AA' },
});
