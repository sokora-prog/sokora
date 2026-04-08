/**
 * RoleSelectorScreen — SOKORA
 * Sélection du type de compte avant connexion
 */
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ScrollView, Animated,
  StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const N  = '#0F1E35'; // Navy
const O  = '#FF6B35'; // Orange
const T  = '#00D4AA'; // Teal
const W  = '#FFFFFF';

const ROLES = [
  {
    key: 'client',
    emoji: '🧑‍💼',
    label: 'Client',
    sub: 'Wallet · Réservations · Services',
    color: T,
    border: T,
    screen: 'LoginClient',
  },
  {
    key: 'artisan',
    emoji: '🔧',
    label: 'Artisan',
    sub: 'RDV · Paiements · QR',
    color: O,
    border: O,
    screen: 'LoginArtisan',
  },
  {
    key: 'staff',
    emoji: '🍽️',
    label: 'Serveur / Gérant',
    sub: 'Commandes · Caisse · Stock',
    color: '#6366F1',
    border: '#6366F1',
    screen: 'LoginStaff',
  },
  {
    key: 'hotel',
    emoji: '🏨',
    label: 'Réception Hôtel',
    sub: 'Check-in · Réservations',
    color: '#3B82F6',
    border: '#3B82F6',
    screen: 'LoginStaff',
  },
  {
    key: 'driver',
    emoji: '🚗',
    label: 'Chauffeur',
    sub: 'Transport · Scan QR',
    color: '#22C55E',
    border: '#22C55E',
    screen: 'LoginStaff',
  },
];

export default function RoleSelectorScreen({ navigation }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,   duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  // Séparer les 4 premières en grille 2x2, puis le chauffeur centré
  const gridRoles = ROLES.slice(0, 4);
  const lastRole  = ROLES[4];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={N} />

      {/* Orbes décoratifs */}
      <View style={s.orb1} />
      <View style={s.orb2} />
      <View style={s.orb3} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo animé */}
        <Animated.View style={[s.logoSection, { opacity: fadeAnim, transform: [{ translateY: floatAnim }] }]}>
          <View style={s.logoRing}>
            <View style={s.logoInner}>
              <Ionicons name="flash" size={34} color={O} />
            </View>
          </View>
          <Text style={s.wordmark}>
            S<Text style={{ color: O }}>O</Text>KORA
          </Text>
          <Text style={s.tagline}>Sélectionnez votre espace</Text>
        </Animated.View>

        {/* Grille 2 colonnes */}
        <Animated.View style={[s.grid, { opacity: fadeAnim }]}>
          {gridRoles.map(role => (
            <TouchableOpacity
              key={role.key}
              style={[s.card, { borderColor: role.color }]}
              onPress={() => navigation.navigate(role.screen)}
              activeOpacity={0.85}
            >
              <Text style={s.cardEmoji}>{role.emoji}</Text>
              <Text style={[s.cardLabel, { color: role.color }]}>{role.label}</Text>
              <Text style={s.cardSub}>{role.sub}</Text>
              <View style={[s.arrow, { backgroundColor: role.color + '18' }]}>
                <Ionicons name="arrow-forward" size={14} color={role.color} />
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Carte centré — Chauffeur */}
        <Animated.View style={[s.centerCardWrap, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={[s.card, s.cardCenter, { borderColor: lastRole.color }]}
            onPress={() => navigation.navigate(lastRole.screen)}
            activeOpacity={0.85}
          >
            <Text style={s.cardEmoji}>{lastRole.emoji}</Text>
            <Text style={[s.cardLabel, { color: lastRole.color }]}>{lastRole.label}</Text>
            <Text style={s.cardSub}>{lastRole.sub}</Text>
            <View style={[s.arrow, { backgroundColor: lastRole.color + '18' }]}>
              <Ionicons name="arrow-forward" size={14} color={lastRole.color} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Note partagée */}
        <View style={s.noteBox}>
          <Ionicons name="information-circle-outline" size={15} color="rgba(255,255,255,0.6)" />
          <Text style={s.noteText}>
            Gérant, Serveur, Réception et Chauffeur partagent la même page de connexion
          </Text>
        </View>

        {/* Footer */}
        <Text style={s.footer}>SOKORA © 2026 — Plateforme HoReCa Africaine</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: N,
  },

  // Orbes
  orb1: {
    position: 'absolute', top: -80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(255,107,53,0.12)',
  },
  orb2: {
    position: 'absolute', top: 200, left: -100,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(0,212,170,0.08)',
  },
  orb3: {
    position: 'absolute', bottom: 80, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(99,102,241,0.08)',
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 72 : 52,
    paddingBottom: 40,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoRing: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  logoInner: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: W,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: O,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  wordmark: {
    fontSize: 42, fontWeight: '900', color: W, letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10,
  },
  tagline: {
    fontSize: 14, color: 'rgba(255,255,255,0.7)',
    marginTop: 6, letterSpacing: 0.3,
  },

  // Grille 2 colonnes
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: W,
    borderRadius: 20,
    borderWidth: 2,
    padding: 18,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
    position: 'relative',
  },
  cardEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 11,
    color: '#7A8FAB',
    fontWeight: '500',
    marginBottom: 12,
  },
  arrow: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end',
  },

  // Carte centré
  centerCardWrap: {
    alignItems: 'center',
    marginTop: 12,
  },
  cardCenter: {
    width: '60%',
  },

  // Note
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 17,
  },

  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 24,
  },
});
