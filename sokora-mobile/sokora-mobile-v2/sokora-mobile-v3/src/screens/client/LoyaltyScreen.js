/**
 * LoyaltyScreen — SOKORA Black
 * Programme de fidélité : tiers Bronze / Silver / Gold / Diamond
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { Colors, API_URL } from '../../utils/constants';
import ScreenHeader from '../../components/ScreenHeader';

async function getClientToken() {
  if (Platform.OS === 'web') return localStorage.getItem('sokora_client_token');
  try { return await SecureStore.getItemAsync('sokora_client_token'); } catch { return null; }
}

// ── Tiers SOKORA Black ────────────────────────────────────────────────────────
const TIERS = [
  { name: 'Bronze',  color: '#CD7F32', min: 0,      max: 5000,   icon: '🥉', perks: ['Cashback 1%', 'Accès prioritaire promos'] },
  { name: 'Silver',  color: '#C0C0C0', min: 5000,   max: 15000,  icon: '🥈', perks: ['Cashback 2%', 'Réductions hôtels -10%', 'Support prioritaire'] },
  { name: 'Gold',    color: '#FFD700', min: 15000,  max: 50000,  icon: '🥇', perks: ['Cashback 3%', 'Réductions -15%', 'Accès lounge', 'Check-in express'] },
  { name: 'Diamond', color: '#B9F2FF', min: 50000,  max: 999999, icon: '💎', perks: ['Cashback 5%', 'Réductions -25%', 'Conciergerie dédiée', 'Surclassement auto'] },
];

export default function LoyaltyScreen({ navigation }) {
  const [points,      setPoints]      = useState(0);
  const [totalSpent,  setTotalSpent]  = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [history,     setHistory]     = useState([]);
  const [tierData,    setTierData]    = useState(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Tier courant
  const currentTier    = TIERS.find(t => points >= t.min && points < t.max) || TIERS[0];
  const nextTier       = TIERS[TIERS.indexOf(currentTier) + 1];
  const progressToNext = nextTier
    ? ((points - currentTier.min) / (nextTier.min - currentTier.min)) * 100
    : 100;

  // Couleur et nom du tier depuis l'API (prioritaire) ou calcul local
  const activeColor = (tierData && tierData.tier_color) ? tierData.tier_color : currentTier.color;
  const activeName  = (tierData && tierData.tier)       ? tierData.tier       : currentTier.name;

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getClientToken();
        if (!token) { setLoading(false); return; }

        const resp = await fetch(`${API_URL}/client/loyalty`, {
          headers: { 'X-Client-Token': token }
        });
        if (resp.ok) {
          const d = await resp.json();
          setPoints(d.total_points || 0);
          setTotalSpent(d.total_spent || 0);
          setTierData(d);
          setHistory(d.transactions || []);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressToNext,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progressToNext]);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.orange} />;
  }

  return (
    <ScrollView style={s.root} showsVerticalScrollIndicator={false}>

      {/* ── Header navigation ── */}
      <ScreenHeader
        navigation={navigation}
        title="Fidélité SOKORA"
        dark={true}
      />

      {/* ── Hero card ── */}
      <View style={[s.heroCard, { backgroundColor: activeColor + '22', borderColor: activeColor + '66' }]}>
        <Text style={s.tierIcon}>{currentTier.icon}</Text>
        <Text style={[s.tierName, { color: activeColor }]}>SOKORA {activeName}</Text>
        <Text style={s.points}>{points.toLocaleString('fr-FR')} pts</Text>
        <Text style={s.spent}>Total dépensé : {totalSpent.toLocaleString('fr-FR')} F CFA</Text>

        {nextTier && (
          <View style={s.progressSection}>
            <View style={s.progressRow}>
              <Text style={s.progressLabel}>{points.toLocaleString('fr-FR')} pts</Text>
              <Text style={[s.progressLabel, { color: nextTier.color }]}>
                → {nextTier.min.toLocaleString('fr-FR')} pts pour {nextTier.name}
              </Text>
            </View>
            <View style={s.progressBg}>
              <Animated.View style={[s.progressFill, {
                width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                backgroundColor: activeColor,
              }]} />
            </View>
          </View>
        )}
      </View>

      {/* ── Avantages du tier actuel ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>✨ Vos avantages {currentTier.name}</Text>
        {currentTier.perks.map((perk, i) => (
          <View key={i} style={s.perkRow}>
            <Ionicons name="checkmark-circle" size={18} color={currentTier.color} />
            <Text style={s.perkText}>{perk}</Text>
          </View>
        ))}
      </View>

      {/* ── Tous les tiers ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>🏆 Niveaux SOKORA Black</Text>
        {TIERS.map((tier, i) => {
          const isActive = tier.name === currentTier.name;
          return (
            <View
              key={i}
              style={[
                s.tierCard,
                isActive && { borderColor: tier.color, borderWidth: 2, backgroundColor: tier.color + '11' },
              ]}
            >
              <Text style={s.tierCardIcon}>{tier.icon}</Text>
              <View style={s.tierCardInfo}>
                <Text style={[s.tierCardName, isActive && { color: tier.color }]}>
                  {tier.name}{isActive ? '  ← Vous êtes ici' : ''}
                </Text>
                <Text style={s.tierCardRange}>
                  {tier.min.toLocaleString('fr-FR')} – {tier.max < 999999 ? tier.max.toLocaleString('fr-FR') : '∞'} pts
                </Text>
                <Text style={s.tierCardPerks}>{tier.perks.join(' · ')}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Historique des points ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>📋 Historique des points</Text>
        {history.map(h => (
          <View key={h.id} style={s.historyRow}>
            <View>
              <Text style={s.historyLabel}>{h.label}</Text>
              <Text style={s.historyDate}>{h.date}</Text>
            </View>
            <Text style={[s.historyPoints, { color: h.type === 'earn' ? '#22c55e' : '#ef4444' }]}>
              {h.type === 'earn' ? '+' : ''}{h.points} pts
            </Text>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#0f1e35' },

  // Nav bar
  navBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  navTitle:       { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  // Hero
  heroCard:       { margin: 16, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1 },
  tierIcon:       { fontSize: 56, marginBottom: 8 },
  tierName:       { fontSize: 18, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  points:         { fontSize: 36, fontWeight: '900', color: '#fff', marginBottom: 4 },
  spent:          { fontSize: 12, color: '#7a8fab', marginBottom: 16 },
  progressSection:{ width: '100%' },
  progressRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel:  { fontSize: 11, color: '#7a8fab' },
  progressBg:     { height: 8, borderRadius: 4, backgroundColor: '#1a2e4a', overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 4 },

  // Section
  section:        { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle:   { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 12 },

  // Perks
  perkRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  perkText:       { fontSize: 14, color: '#b8c4d8' },

  // Tier cards
  tierCard:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#1a2e4a', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#243a5e' },
  tierCardIcon:   { fontSize: 28 },
  tierCardInfo:   { flex: 1 },
  tierCardName:   { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 2 },
  tierCardRange:  { fontSize: 11, color: '#7a8fab', marginBottom: 4 },
  tierCardPerks:  { fontSize: 11, color: '#b8c4d8' },

  // History
  historyRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a2e4a' },
  historyLabel:   { fontSize: 13, color: '#fff', fontWeight: '600' },
  historyDate:    { fontSize: 11, color: '#7a8fab', marginTop: 2 },
  historyPoints:  { fontSize: 15, fontWeight: '800' },
});
