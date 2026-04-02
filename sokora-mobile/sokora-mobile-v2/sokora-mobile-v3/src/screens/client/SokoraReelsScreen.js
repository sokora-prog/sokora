/**
 * SokoraReelsScreen — SOKORA PULSE ✨
 * Feed vertical TikTok-style : vidéos courtes, réactions, CTA direct (Réserver / Acheter)
 * "Pour vous" vs "À proximité" — BottomSheet intégré sans quitter le reel
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, Dimensions, Platform, Modal, TouchableWithoutFeedback,
  TextInput, Alert, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { promoService } from '../../services/api';
import { Colors, Shadow, Radius } from '../../utils/constants';

const { width: W, height: H } = Dimensions.get('window');

const BRAND = {
  orange:'#F26D21', orangeL:'#F9A050', orangePale:'#FFF4EA',
  blue:'#3065A6',   blueL:'#7AA6D4',   navy:'#1A2E4A',
  surface:'#FFFFFF',border:'#DDE4F0',
  text:'#1A2E4A',   muted:'#7A8FAB',
};

const REACTIONS = [
  { key: 'fire',  emoji: '🔥', label: "C'est chaud!" },
  { key: 'heart', emoji: '❤️',  label: "J'aime"       },
  { key: 'clap',  emoji: '👏',  label: 'Bravo'        },
  { key: 'wow',   emoji: '😮',  label: 'Wow!'         },
  { key: 'go',    emoji: '🚀',  label: "J'y vais"     },
];

const POST_COLORS = {
  promo:  { bg: ['#F07D1A', '#F9A050'], label: '🏷️ Promo'    },
  event:  { bg: ['#6366F1', '#818CF8'], label: '🎉 Événement' },
  new:    { bg: ['#19A99D', '#2DCFC2'], label: '✨ Nouveau'   },
  info:   { bg: ['#3065A6', '#7AA6D4'], label: 'ℹ️ Info'      },
};

const ESTAB_EMOJIS = {
  maquis:'🍖', bar:'🍺', restaurant:'🍽️', hotel:'🏨', voyage:'🚌', default:'🏪',
};

// ── Données démo ──────────────────────────────────────────────────────────────
const DEMO_REELS = [
  {
    id: 'r1', type: 'promo', estab_name: '@MaquisLaBelleVie', estab_type: 'maquis',
    caption: '🍗 Ce weekend : Poulet braisé + Attiéké à 3 000 F seulement ! Venez nombreux 🔥',
    tag: '#Abidjan #Maquis #Promo',
    cta_label: 'Voir le menu', cta_type: 'menu',
    discount: '-20%', reactions: { fire: 142, heart: 88, go: 67 }, comments: 24,
    is_sponsored: false, time_left: '2h restantes',
    location: 'Cocody, Abidjan · 1.2 km',
  },
  {
    id: 'r2', type: 'event', estab_name: '@BarEtoileVIP', estab_type: 'bar',
    caption: '🎉 Soirée DJ samedi 20h ! Entrée gratuite avant 21h avec ton code SOKORA',
    tag: '#Soirée #Abidjan #DJ',
    cta_label: 'Réserver ma table', cta_type: 'reserve',
    reactions: { fire: 234, heart: 156, clap: 89 }, comments: 47,
    is_sponsored: true, event_date: 'Sam. 5 Avr · 20h00',
    location: 'Marcory, Abidjan · 3.1 km',
  },
  {
    id: 'r3', type: 'new', estab_name: '@HotelLeDiplomate', estab_type: 'hotel',
    caption: '🏨 Notre suite présidentielle vient d\'ouvrir ! Vue panoramique sur le plateau. Dispo ce weekend.',
    tag: '#Hotel #Luxe #Abidjan',
    cta_label: 'Voir les chambres', cta_type: 'hotel',
    reactions: { heart: 312, wow: 201, go: 145 }, comments: 38,
    is_sponsored: true,
    location: 'Plateau, Abidjan · 0.8 km',
  },
  {
    id: 'r4', type: 'promo', estab_name: '@RestauSaveurs', estab_type: 'restaurant',
    caption: '🍽️ Menu complet à 5 000 F : Entrée + Plat + Dessert. Valable midi et soir !',
    tag: '#Restaurant #Yopougon #MenuDuJour',
    cta_label: 'Commander maintenant', cta_type: 'order',
    discount: '-30%', reactions: { fire: 98, heart: 76, clap: 45 }, comments: 18,
    is_sponsored: false, time_left: 'Jusqu\'à 23h',
    location: 'Yopougon, Abidjan · 6.4 km',
  },
  {
    id: 'r5', type: 'promo', estab_name: '@MaquisWoyo', estab_type: 'maquis',
    caption: '🔥 Brochettes + Alloco + Bière = 2 500 F ! Happy hour 17h-20h tous les soirs',
    tag: '#HappyHour #Abidjan #Brochettes',
    cta_label: "J'y vais !", cta_type: 'directions',
    discount: '-25%', reactions: { fire: 187, heart: 124, go: 93 }, comments: 31,
    is_sponsored: false, time_left: '3j restants',
    location: 'Adjamé, Abidjan · 4.2 km',
  },
];

// ── Un Reel ───────────────────────────────────────────────────────────────────
function ReelItem({ item, isActive, onCTA, onDoubleTap }) {
  const [liked,       setLiked]       = useState(false);
  const [reactions,   setReactions]   = useState(item.reactions ?? {});
  const [showReact,   setShowReact]   = useState(false);
  const [heartAnim]                   = useState(new Animated.Value(0));
  const lastTap                       = useRef(0);

  const totalReacts = Object.values(reactions).reduce((a, b) => a + b, 0);
  const pColor = POST_COLORS[item.type] ?? POST_COLORS.promo;
  const emoji  = ESTAB_EMOJIS[item.estab_type] ?? ESTAB_EMOJIS.default;

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setLiked(true);
      Animated.sequence([
        Animated.timing(heartAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(heartAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      onDoubleTap?.(item);
    }
    lastTap.current = now;
  };

  const doReact = (key) => {
    setReactions(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    setShowReact(false);
  };

  const handleShare = () => {
    Share.share({ message: `${item.caption}\n\n— Partagé via SOKORA PULSE` }).catch(() => {});
  };

  return (
    <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View style={rs.reel}>
        {/* Fond gradient simulé */}
        <View style={[rs.bg, { backgroundColor: pColor.bg[0] + 'CC' }]}>
          <Text style={rs.bgEmoji}>{emoji}</Text>
        </View>

        {/* Overlay dégradé bas */}
        <View style={rs.gradient} />

        {/* ── Haut : filtres ── */}
        <View style={rs.topBar}>
          <View style={rs.typeTag}>
            <Text style={rs.typeTagTxt}>{pColor.label}</Text>
          </View>
          {item.is_sponsored && (
            <View style={rs.sponsoredBadge}>
              <Text style={rs.sponsoredTxt}>Sponsorisé</Text>
            </View>
          )}
        </View>

        {/* Double-tap heart */}
        <Animated.View style={[rs.heartPop, {
          opacity: heartAnim,
          transform: [{ scale: heartAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1.4, 1] }) }],
        }]}>
          <Text style={{ fontSize: 80 }}>❤️</Text>
        </Animated.View>

        {/* ── Droite : actions ── */}
        <View style={rs.sideActions}>
          {/* Avatar établissement */}
          <View style={rs.avatarWrap}>
            <View style={rs.avatar}>
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </View>
            <View style={rs.followBtn}>
              <Text style={{ fontSize: 12, color: '#fff', fontWeight: '800' }}>+</Text>
            </View>
          </View>

          {/* Réaction */}
          <TouchableOpacity style={rs.actionBtn} onPress={() => setShowReact(s => !s)}>
            <Text style={rs.actionEmoji}>🔥</Text>
            <Text style={rs.actionCount}>{(totalReacts / 1000).toFixed(1)}k</Text>
          </TouchableOpacity>

          {/* Favoris */}
          <TouchableOpacity style={rs.actionBtn} onPress={() => setLiked(l => !l)}>
            <Text style={rs.actionEmoji}>{liked ? '❤️' : '🤍'}</Text>
            <Text style={rs.actionCount}>{(reactions.heart ?? 0) + (liked ? 1 : 0)}</Text>
          </TouchableOpacity>

          {/* Commentaires */}
          <TouchableOpacity style={rs.actionBtn}>
            <Ionicons name="chatbubble-outline" size={26} color="#fff" />
            <Text style={rs.actionCount}>{item.comments ?? 0}</Text>
          </TouchableOpacity>

          {/* Partage */}
          <TouchableOpacity style={rs.actionBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={26} color="#fff" />
            <Text style={rs.actionCount}>Partager</Text>
          </TouchableOpacity>

          {/* Vinyle SOKORA */}
          <View style={rs.vinylWrap}>
            <View style={rs.vinyl}>
              <Ionicons name="wifi" size={14} color="#fff" />
            </View>
          </View>
        </View>

        {/* ── Bas : infos + CTA ── */}
        <View style={rs.bottomArea}>
          <Text style={rs.estabName}>{item.estab_name}</Text>
          <Text style={rs.caption}>{item.caption}</Text>
          <Text style={rs.tag}>{item.tag}</Text>

          <View style={rs.metaRow}>
            <View style={rs.locationRow}>
              <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={rs.location}>{item.location}</Text>
            </View>
            {item.time_left && (
              <View style={rs.timeLeftBadge}>
                <Ionicons name="time-outline" size={11} color={BRAND.orange} />
                <Text style={rs.timeLeftTxt}>{item.time_left}</Text>
              </View>
            )}
            {item.event_date && (
              <View style={[rs.timeLeftBadge, { backgroundColor: '#6366F1' + '30', borderColor: '#6366F1' }]}>
                <Text style={[rs.timeLeftTxt, { color: '#818CF8' }]}>{item.event_date}</Text>
              </View>
            )}
          </View>

          {/* CTA */}
          <TouchableOpacity style={rs.ctaBtn} onPress={() => onCTA(item)} activeOpacity={0.88}>
            {item.discount && (
              <View style={rs.discountBadge}>
                <Text style={rs.discountTxt}>{item.discount}</Text>
              </View>
            )}
            <Text style={rs.ctaBtnTxt}>{item.cta_label}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Réactions panel ── */}
        {showReact && (
          <View style={rs.reactPanel}>
            {REACTIONS.map(r => (
              <TouchableOpacity key={r.key} style={rs.reactItem} onPress={() => doReact(r.key)}>
                <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
                <Text style={rs.reactLabel}>{r.label}</Text>
                <Text style={rs.reactCount}>{reactions[r.key] ?? 0}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

// ── BottomSheet CTA ───────────────────────────────────────────────────────────
function CTABottomSheet({ item, visible, onClose, navigation }) {
  const translateY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 400,
      friction: 8, tension: 100, useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!item) return null;

  const actions = {
    menu:       { label: 'Voir le menu complet',     icon: 'restaurant-outline', screen: 'Discover' },
    reserve:    { label: 'Réserver une table',        icon: 'calendar-outline',   screen: 'Discover' },
    hotel:      { label: 'Voir les chambres dispo',   icon: 'bed-outline',        screen: 'HotelSearch' },
    order:      { label: 'Passer une commande',       icon: 'cart-outline',       screen: 'Discover' },
    directions: { label: "Itinéraire (Maps)",         icon: 'navigate-outline',   screen: null },
  };
  const action = actions[item.cta_type] ?? actions.menu;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={bss.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[bss.sheet, { transform: [{ translateY }] }]}>
              <View style={bss.handle} />

              <View style={bss.estabRow}>
                <View style={bss.estabAvatar}>
                  <Text style={{ fontSize: 24 }}>{ESTAB_EMOJIS[item.estab_type] ?? '🏪'}</Text>
                </View>
                <View>
                  <Text style={bss.estabName}>{item.estab_name}</Text>
                  <Text style={bss.estabSub}>{item.location}</Text>
                </View>
              </View>

              <View style={bss.offerBox}>
                <Text style={bss.offerCaption} numberOfLines={3}>{item.caption}</Text>
                {item.discount && (
                  <View style={bss.discountRow}>
                    <View style={bss.discountBadge}>
                      <Text style={bss.discountTxt}>{item.discount} de réduction</Text>
                    </View>
                    {item.time_left && <Text style={bss.timeLeft}>⏱ {item.time_left}</Text>}
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={bss.mainBtn}
                onPress={() => {
                  onClose();
                  if (action.screen) navigation?.navigate(action.screen);
                }}
              >
                <Ionicons name={action.icon} size={20} color="#fff" />
                <Text style={bss.mainBtnTxt}>{action.label}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={bss.secondBtn} onPress={() => { onClose(); navigation?.navigate('WalletMain'); }}>
                <Ionicons name="wallet-outline" size={18} color={BRAND.orange} />
                <Text style={bss.secondBtnTxt}>Payer avec SOKORA Wallet</Text>
              </TouchableOpacity>

              <TouchableOpacity style={bss.cancelBtn} onPress={onClose}>
                <Text style={bss.cancelTxt}>Fermer</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function SokoraReelsScreen({ navigation }) {
  const [reels,      setReels]      = useState(DEMO_REELS);
  const [loading,    setLoading]    = useState(false);
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [feed,       setFeed]       = useState('foryou'); // 'foryou' | 'nearby'
  const [ctaItem,    setCtaItem]    = useState(null);
  const [ctaVisible, setCtaVisible] = useState(false);
  const [saved,      setSaved]      = useState([]);

  useFocusEffect(useCallback(() => {
    loadReels();
  }, [feed]));

  const loadReels = async () => {
    try {
      const data = await promoService.list({ category: feed === 'nearby' ? undefined : undefined });
      if (Array.isArray(data) && data.length > 0) {
        setReels(data.map(p => ({
          id: p.id,
          type: p.post_type ?? 'promo',
          estab_name: `@${(p.establishment_name ?? 'Établissement').replace(/\s/g, '')}`,
          estab_type: p.estab_type ?? 'default',
          caption: p.content ?? p.title ?? '',
          tag: `#${p.category ?? 'Abidjan'}`,
          cta_label: 'Voir l\'offre',
          cta_type: 'menu',
          reactions: p.reactions ?? {},
          comments: p.comments_count ?? 0,
          location: p.city ?? 'Abidjan',
          is_sponsored: p.is_sponsored ?? false,
        })));
      }
    } catch { /* use demo */ }
  };

  const handleCTA = (item) => {
    setCtaItem(item);
    setCtaVisible(true);
  };

  const handleDoubleTap = (item) => {
    setSaved(prev => prev.includes(item.id) ? prev : [...prev, item.id]);
  };

  const onViewableChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveIdx(viewableItems[0].index ?? 0);
  }).current;

  const viewConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  return (
    <View style={ms.root}>
      {/* ── Header fixe ── */}
      <View style={ms.header}>
        <TouchableOpacity
          style={[ms.feedTab, feed === 'foryou' && ms.feedTabActive]}
          onPress={() => setFeed('foryou')}
        >
          <Text style={[ms.feedTabTxt, feed === 'foryou' && ms.feedTabTxtActive]}>Pour vous</Text>
        </TouchableOpacity>
        <View style={ms.headerDot} />
        <TouchableOpacity
          style={[ms.feedTab, feed === 'nearby' && ms.feedTabActive]}
          onPress={() => setFeed('nearby')}
        >
          <Text style={[ms.feedTabTxt, feed === 'nearby' && ms.feedTabTxtActive]}>📍 À proximité</Text>
        </TouchableOpacity>
        {saved.length > 0 && (
          <View style={ms.savedBadge}>
            <Text style={ms.savedBadgeTxt}>{saved.length} sauvegardé{saved.length > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* ── Feed vertical ── */}
      <FlatList
        data={reels}
        keyExtractor={item => String(item.id)}
        renderItem={({ item, index }) => (
          <ReelItem
            item={item}
            isActive={index === activeIdx}
            onCTA={handleCTA}
            onDoubleTap={handleDoubleTap}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={H - (Platform.OS === 'ios' ? 90 : 70)}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableChanged}
        viewabilityConfig={viewConfig}
        getItemLayout={(_, index) => ({
          length: H - (Platform.OS === 'ios' ? 90 : 70),
          offset: (H - (Platform.OS === 'ios' ? 90 : 70)) * index,
          index,
        })}
      />

      {/* ── BottomSheet CTA ── */}
      <CTABottomSheet
        item={ctaItem}
        visible={ctaVisible}
        onClose={() => setCtaVisible(false)}
        navigation={navigation}
      />
    </View>
  );
}

// ── Styles Reel ───────────────────────────────────────────────────────────────
const REEL_H = H - (Platform.OS === 'ios' ? 90 : 70);

const rs = StyleSheet.create({
  reel: {
    width: W, height: REEL_H,
    backgroundColor: BRAND.navy,
    position: 'relative',
    overflow: 'hidden',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  bgEmoji: { fontSize: 180, opacity: 0.15 },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },

  topBar: {
    position: 'absolute', top: 16, left: 16, right: 80,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  typeTag: {
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  typeTagTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  sponsoredBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  sponsoredTxt: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  heartPop: { position: 'absolute', alignSelf: 'center', top: '30%' },

  sideActions: {
    position: 'absolute', right: 12, bottom: 140,
    alignItems: 'center', gap: 18,
  },
  avatarWrap:  { alignItems: 'center', marginBottom: 4 },
  avatar:      { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  followBtn:   { width: 20, height: 20, borderRadius: 10, backgroundColor: BRAND.orange, justifyContent: 'center', alignItems: 'center', marginTop: -10 },
  actionBtn:   { alignItems: 'center', gap: 3 },
  actionEmoji: { fontSize: 28 },
  actionCount: { fontSize: 11, color: '#fff', fontWeight: '700' },
  vinylWrap:   { marginTop: 4 },
  vinyl:       { width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND.orange, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },

  bottomArea: {
    position: 'absolute', bottom: 0, left: 0, right: 70,
    padding: 16, paddingBottom: 20,
    backgroundColor: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
  },
  estabName:  { fontSize: 16, fontWeight: '900', color: '#fff', marginBottom: 6 },
  caption:    { fontSize: 14, color: 'rgba(255,255,255,0.92)', lineHeight: 20, marginBottom: 4 },
  tag:        { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  locationRow:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  location:   { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  timeLeftBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(240,125,26,0.25)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: BRAND.orange + '60' },
  timeLeftTxt:  { fontSize: 10, fontWeight: '700', color: BRAND.orangeL },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BRAND.orange, borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 20,
    position: 'relative', overflow: 'hidden',
    shadowColor: BRAND.orange, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  ctaBtnTxt:    { fontSize: 15, fontWeight: '800', color: '#fff', flex: 1, textAlign: 'center' },
  discountBadge:{ position: 'absolute', top: -8, right: -8, backgroundColor: '#E84040', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
  discountTxt:  { fontSize: 10, fontWeight: '900', color: '#fff' },

  reactPanel: {
    position: 'absolute', right: 68, bottom: 200,
    backgroundColor: 'rgba(26,46,74,0.95)', borderRadius: 20, padding: 10, gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  reactItem:  { alignItems: 'center', paddingVertical: 4 },
  reactLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  reactCount: { fontSize: 10, color: BRAND.orangeL, fontWeight: '700' },
});

// ── Styles Main ───────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute', top: Platform.OS === 'ios' ? 52 : 36, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  feedTab:        { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  feedTabActive:  { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  feedTabTxt:     { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  feedTabTxtActive:{ color: '#fff', fontWeight: '800' },
  headerDot:      { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  savedBadge:     { position: 'absolute', right: 16, backgroundColor: BRAND.orange, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  savedBadgeTxt:  { fontSize: 10, fontWeight: '700', color: '#fff' },
});

// ── Styles BottomSheet ────────────────────────────────────────────────────────
const bss = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  handle:     { width: 40, height: 4, backgroundColor: '#DDE4F0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  estabRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  estabAvatar:{ width: 52, height: 52, borderRadius: 26, backgroundColor: BRAND.orange + '20', justifyContent: 'center', alignItems: 'center' },
  estabName:  { fontSize: 16, fontWeight: '800', color: BRAND.text },
  estabSub:   { fontSize: 12, color: BRAND.muted },
  offerBox:   { backgroundColor: '#F2F5FB', borderRadius: 14, padding: 14, marginBottom: 16 },
  offerCaption:{ fontSize: 14, color: BRAND.text, lineHeight: 20 },
  discountRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  discountBadge:{ backgroundColor: '#E84040', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  discountTxt:{ fontSize: 12, fontWeight: '800', color: '#fff' },
  timeLeft:   { fontSize: 12, color: BRAND.muted },
  mainBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: BRAND.orange, borderRadius: 14, padding: 14, marginBottom: 10 },
  mainBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  secondBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: BRAND.orange + '12', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: BRAND.orange + '30' },
  secondBtnTxt:{ fontSize: 14, fontWeight: '700', color: BRAND.orange },
  cancelBtn:  { alignItems: 'center', padding: 10 },
  cancelTxt:  { fontSize: 14, color: BRAND.muted },
});
