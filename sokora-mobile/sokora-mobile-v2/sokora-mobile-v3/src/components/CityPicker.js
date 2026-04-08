/**
 * CityPicker — Composant partagé SOKORA
 * Liste déroulante des villes de Côte d'Ivoire avec recherche
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  TextInput, StyleSheet, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ── Liste complète des villes CI ──────────────────────────────────────────────
export const CI_CITIES = [
  // Grand Abidjan
  'Abidjan',
  'Abidjan — Cocody',
  'Abidjan — Plateau',
  'Abidjan — Marcory',
  'Abidjan — Yopougon',
  'Abidjan — Abobo',
  'Abidjan — Adjamé',
  'Abidjan — Treichville',
  'Abidjan — Koumassi',
  'Abidjan — Port-Bouet',
  'Abidjan — Attécoubé',
  // Grandes villes
  'Yamoussoukro',
  'Bouaké',
  'Daloa',
  'San-Pédro',
  'Korhogo',
  'Man',
  'Gagnoa',
  'Abengourou',
  'Divo',
  'Soubré',
  'Odienné',
  'Bondoukou',
  'Séguéla',
  'Ferkessédougou',
  'Katiola',
  // Villes secondaires
  'Aboisso',
  'Adzopé',
  'Agboville',
  'Anyama',
  'Bingerville',
  'Grand-Bassam',
  'Grand-Lahou',
  'Guiglo',
  'Issia',
  'Jacqueville',
  'Lakota',
  'Sassandra',
  'Tiassalé',
  'Toumodi',
  'Vavoua',
  'Zuénoula',
  'Tabou',
  'Boundiali',
  'Tengréla',
  'Bouna',
  'Nassian',
  'Dabou',
  'Duekoué',
  'Sinfra',
  'Oumé',
  'Dimbokro',
  'M\'Bahiakro',
  'Bongouanou',
  'Adzopé',
];

export default function CityPicker({
  value,
  onChange,
  placeholder = 'Sélectionner une ville',
  label,
  iconName = 'location-outline',
  iconColor = '#FF6B35',
  style,
}) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch]   = useState('');

  const filtered = useMemo(() =>
    CI_CITIES.filter(c => c.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  const select = (city) => {
    onChange(city);
    setVisible(false);
    setSearch('');
  };

  return (
    <>
      {/* ── Trigger ── */}
      <TouchableOpacity
        style={[s.trigger, style]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name={iconName} size={18} color={iconColor} />
        <Text style={[s.triggerTxt, !value && s.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#8892A4" />
      </TouchableOpacity>

      {/* ── Modal ── */}
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            {/* Header */}
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{label || 'Choisir une ville'}</Text>
              <TouchableOpacity onPress={() => { setVisible(false); setSearch(''); }} style={s.closeBtn}>
                <Ionicons name="close" size={22} color="#8892A4" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={18} color="#8892A4" />
              <TextInput
                style={s.searchInput}
                placeholder="Rechercher une ville..."
                placeholderTextColor="#8892A4"
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#8892A4" />
                </TouchableOpacity>
              )}
            </View>

            {/* Liste */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.cityRow, value === item && s.cityRowActive]}
                  onPress={() => select(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.startsWith('Abidjan —') ? 'business-outline' : 'location-outline'}
                    size={16}
                    color={value === item ? '#FF6B35' : '#8892A4'}
                  />
                  <Text style={[s.cityTxt, value === item && s.cityTxtActive]}>{item}</Text>
                  {value === item && <Ionicons name="checkmark" size={18} color="#FF6B35" />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={s.sep} />}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F4F6F9', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: '#DDE4F0',
  },
  triggerTxt: { flex: 1, fontSize: 14, color: '#1A1A2E', fontWeight: '500' },
  placeholder:{ color: '#8892A4', fontWeight: '400' },

  overlay: { flex: 1, backgroundColor: 'rgba(15,30,53,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '85%', paddingTop: 8,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: -5 },
    elevation: 20,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F2F8',
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A2E' },
  closeBtn:   { padding: 4 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginVertical: 12,
    backgroundColor: '#F4F6F9', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1.5, borderColor: '#DDE4F0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A2E', padding: 0 },

  cityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 13,
  },
  cityRowActive: { backgroundColor: '#FFF4EF' },
  cityTxt:       { flex: 1, fontSize: 14, color: '#1A1A2E', fontWeight: '500' },
  cityTxtActive: { color: '#FF6B35', fontWeight: '700' },
  sep:           { height: 1, backgroundColor: '#F0F2F8', marginHorizontal: 20 },
});
