/**
 * CrossSellModal — Widget recommandation cross-module SOKORA
 * Après voyage → suggère hôtels dans la ville de destination
 * Après hôtel  → suggère services dans le quartier
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: H } = Dimensions.get('window');

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  navy:   '#0F1E35',
  orange: '#FF6B35',
  teal:   '#00D4AA',
  bg:     '#F4F6F9',
  white:  '#FFFFFF',
  textD:  '#1A1A2E',
  textG:  '#8892A4',
  border: '#DDE4F0',
};

// ── Suggestions selon le type ─────────────────────────────────────────────────
function getSuggestions(type, context) {
  const city         = context?.city         || 'cette ville';
  const neighborhood = context?.neighborhood || 'ce quartier';

  if (type === 'voyage') {
    return {
      headerEmoji: '🏨',
      headerTitle: `Besoin d'un hébergement à ${city} ?`,
      headerSub:   'Réservez votre hôtel dès maintenant',
      suggestions: [
        { icon: '🏨', label: `Chercher un hôtel à ${city}`, screen: 'HotelSearch', params: { city } },
        { icon: '🔧', label: `Services disponibles à ${city}`, screen: 'ServiceSearch', params: { city } },
        { icon: '🚌', label: 'Voyages retour', screen: 'VoyageSearch', params: {} },
      ],
      ctaLabel: 'Voir les hôtels →',
      ctaScreen: 'HotelSearch',
      ctaParams: { city },
    };
  }

  // type === 'hotel'
  return {
    headerEmoji: '🔧',
    headerTitle: `Services disponibles à ${neighborhood} ?`,
    headerSub:   'Artisans & prestataires proches de votre hôtel',
    suggestions: [
      { icon: '💇', label: 'Coiffure & beauté',   screen: 'ServiceSearch', params: { category: 'beaute' } },
      { icon: '👔', label: 'Pressing',             screen: 'ServiceSearch', params: { category: 'pressing' } },
      { icon: '🚗', label: 'Lavage auto',          screen: 'ServiceSearch', params: { category: 'auto' } },
    ],
    ctaLabel: 'Explorer les services →',
    ctaScreen: 'ServiceSearch',
    ctaParams: { neighborhood },
  };
}

export default function CrossSellModal({ visible, onClose, type = 'voyage', context = {}, navigation }) {
  const slideAnim = useRef(new Animated.Value(H)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim,   { toValue: H, duration: 280, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const cfg = getSuggestions(type, context);

  const handleExplore = () => {
    onClose();
    setTimeout(() => {
      if (navigation && cfg.ctaScreen) {
        navigation.navigate(cfg.ctaScreen, cfg.ctaParams || {});
      }
    }, 320);
  };

  const handleSuggestionPress = (suggestion) => {
    onClose();
    setTimeout(() => {
      if (navigation && suggestion.screen) {
        navigation.navigate(suggestion.screen, suggestion.params || {});
      }
    }, 320);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Overlay semi-transparent */}
      <Animated.View style={[s.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet animé */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Indicateur */}
        <View style={s.indicator} />

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerEmojiWrap}>
              <Text style={{ fontSize: 28 }}>{cfg.headerEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>{cfg.headerTitle}</Text>
              <Text style={s.headerSub}>{cfg.headerSub}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={18} color={C.textG} />
          </TouchableOpacity>
        </View>

        {/* Suggestions */}
        <View style={s.suggestionsBlock}>
          {cfg.suggestions.map((sg, i) => (
            <TouchableOpacity
              key={i}
              style={s.suggestionRow}
              onPress={() => handleSuggestionPress(sg)}
              activeOpacity={0.75}
            >
              <View style={s.suggestionIcon}>
                <Text style={{ fontSize: 22 }}>{sg.icon}</Text>
              </View>
              <Text style={s.suggestionLabel}>{sg.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.textG} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Boutons CTA */}
        <View style={s.actions}>
          <TouchableOpacity style={s.ctaBtn} onPress={handleExplore} activeOpacity={0.85}>
            <Text style={s.ctaBtnTxt}>{cfg.ctaLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.laterBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={s.laterTxt}>Plus tard</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,30,53,0.6)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },

  indicator: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: C.border,
    marginTop: 10, marginBottom: 14,
  },

  // ── Header ──
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerLeft: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  headerEmojiWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: C.textD, lineHeight: 20 },
  headerSub:   { fontSize: 11, color: C.textG, marginTop: 3 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },

  // ── Suggestions ──
  suggestionsBlock: {
    backgroundColor: C.bg,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 18,
  },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
    gap: 12,
  },
  suggestionIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  suggestionLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: C.textD },

  // ── Actions ──
  actions: { gap: 10 },
  ctaBtn: {
    backgroundColor: C.orange,
    borderRadius: 16, padding: 15,
    alignItems: 'center',
    shadowColor: C.orange, shadowOpacity: 0.35, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  ctaBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },

  laterBtn: {
    borderRadius: 16, padding: 13,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border,
  },
  laterTxt: { color: C.textG, fontSize: 14, fontWeight: '600' },
});
