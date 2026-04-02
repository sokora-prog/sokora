/**
 * PromoFeedScreen — SOKORA PULSE ✨
 * Feed social dynamique pour la promotion des établissements
 * Design unique SOKORA — Réactions vivantes, Stories Pulse, Cartes Wave
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, TextInput, Modal, Share, Dimensions,
  ActivityIndicator, RefreshControl, ScrollView, Pressable,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';
import { promoService } from '../../services/api';

const { width: W } = Dimensions.get('window');

// ── Réactions uniques SOKORA ─────────────────────────────────────────────────
const REACTIONS = [
  { key: 'fire',  emoji: '🔥', label: "C'est chaud!" },
  { key: 'heart', emoji: '❤️',  label: "J'aime"       },
  { key: 'clap',  emoji: '👏',  label: 'Bravo'        },
  { key: 'wow',   emoji: '😮',  label: 'Wow!'         },
  { key: 'go',    emoji: '🚀',  label: "J'y vais"     },
];

const POST_TYPES = {
  promo:  { label: '🏷️ Promo',     color: Colors.orange, bg: Colors.orangePale },
  event:  { label: '🎉 Événement',  color: Colors.purple, bg: Colors.purplePale },
  new:    { label: '✨ Nouveau',    color: Colors.green,  bg: Colors.greenPale  },
  info:   { label: 'ℹ️ Info',       color: Colors.teal,   bg: Colors.tealPale   },
};

const ESTAB_ICONS = {
  maquis: '🍖', bar: '🍺', restaurant: '🍽️',
  hotel: '🏨', voyage: '🚌', default: '🏪',
};

const CATEGORIES = [
  { id: 'all',    label: '✨ Tout'      },
  { id: 'promo',  label: '🏷️ Promos'   },
  { id: 'event',  label: '🎉 Events'   },
  { id: 'new',    label: '🆕 Nouveaux' },
  { id: 'near',   label: '📍 Près de moi' },
];

// ── Données démo (remplacé par API en production) ────────────────────────────
const DEMO_STORIES = [
  { id: 's1', name: 'La Belle Vie',  type: 'maquis',     active: true,  emoji: '🍖' },
  { id: 's2', name: 'Bar Etoile',    type: 'bar',        active: true,  emoji: '🍺' },
  { id: 's3', name: 'Hotel Ivoire',  type: 'hotel',      active: false, emoji: '🏨' },
  { id: 's4', name: 'Maquis Wôyo',   type: 'maquis',     active: true,  emoji: '🔥' },
  { id: 's5', name: 'Résidence 5★',  type: 'hotel',      active: false, emoji: '⭐' },
  { id: 's6', name: 'Fast Afrik',    type: 'restaurant', active: true,  emoji: '🍽️' },
];

const DEMO_POSTS = [
  {
    id: '1',
    establishment: { id: 1, name: 'Maquis La Belle Vie', type: 'maquis', city: 'Cocody', isVerified: true },
    content: '🔥 Ce soir SPÉCIAL : Poulet braisé géant + attiéké + boisson à seulement 2 500 F !\n\nOfre valable jusqu\'à 23h. Réservez votre table maintenant sur SOKORA et payez avec votre wallet 💳',
    postType: 'promo',
    discount: '-30%',
    reactions: { fire: 47, heart: 23, clap: 12, wow: 5, go: 31, userReaction: null },
    comments_count: 14,
    shares_count: 8,
    time_ago: '15min',
    is_sponsored: true,
    has_booking: true,
  },
  {
    id: '2',
    establishment: { id: 2, name: 'Hotel Le Diplomate', type: 'hotel', city: 'Plateau', isVerified: true },
    content: '🏨 Nouveau ! Chambre DELUXE disponible avec vue sur la lagune.\n\nDîner inclus + accès piscine. Réservation en ligne — paiement wallet accepté ✅',
    postType: 'new',
    discount: null,
    reactions: { fire: 12, heart: 34, clap: 8, wow: 19, go: 6, userReaction: null },
    comments_count: 5,
    shares_count: 12,
    time_ago: '1h',
    is_sponsored: false,
    has_booking: true,
  },
  {
    id: '3',
    establishment: { id: 3, name: 'Bar Étoile VIP', type: 'bar', city: 'Marcory', isVerified: false },
    content: '🎉 SOIRÉE AFROBEATS ce samedi !\n\nDJ Platine + Danseuses + Bouteilles à partir de 15 000 F\nTables VIP limitées — réservez maintenant !',
    postType: 'event',
    discount: null,
    event_date: 'Sam. 5 Avr.',
    reactions: { fire: 89, heart: 45, clap: 33, wow: 28, go: 67, userReaction: null },
    comments_count: 31,
    shares_count: 45,
    time_ago: '3h',
    is_sponsored: true,
    has_booking: true,
  },
  {
    id: '4',
    establishment: { id: 4, name: 'Restaurant Saveurs d\'Abidjan', type: 'restaurant', city: 'Yopougon', isVerified: true },
    content: '🍽️ Notre nouveau menu "Cuisine du terroir ivoirien" est arrivé !\n\nFoufou, Sauce Graine, Kedjenou de Poulet... un voyage gustatif authentique.\n\nDécouvrez sur SOKORA 👇',
    postType: 'new',
    discount: null,
    reactions: { fire: 23, heart: 56, clap: 41, wow: 17, go: 29, userReaction: null },
    comments_count: 22,
    shares_count: 18,
    time_ago: '5h',
    is_sponsored: false,
    has_booking: false,
  },
  {
    id: '5',
    establishment: { id: 5, name: 'Maquis Wôyo Beach', type: 'maquis', city: 'Grand-Bassam', isVerified: true },
    content: '📍 Wôyo Beach ouvre ses portes au bord de la mer !\n\nPoisson frais grillé sur place + vue panoramique sur l\'Atlantique 🌊\n\nWeekend spécial 20% OFF avec SOKORA Wallet !',
    postType: 'promo',
    discount: '-20%',
    reactions: { fire: 134, heart: 89, clap: 56, wow: 45, go: 112, userReaction: null },
    comments_count: 67,
    shares_count: 89,
    time_ago: '8h',
    is_sponsored: false,
    has_booking: true,
  },
];

const DEMO_COMMENTS = [
  { id: 1, author: 'Aminata K.', text: 'Super endroit ! J\'y étais hier, c\'était délicieux 😍', time: '10min' },
  { id: 2, author: 'Kouamé D.',  text: 'Le poulet braisé vaut vraiment le détour 🔥', time: '25min' },
  { id: 3, author: 'Fatou M.',   text: 'Réservation faite via SOKORA, merci !', time: '1h' },
];

// ── Composant PulseStory ─────────────────────────────────────────────────────
function PulseStory({ story, onPress }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!story.active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [story.active]);

  return (
    <TouchableOpacity style={styles.storyItem} onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[
        styles.storyRing,
        story.active ? styles.storyRingActive : styles.storyRingInactive,
        story.active && { transform: [{ scale: pulse }] },
      ]}>
        <View style={styles.storyAvatar}>
          <Text style={styles.storyEmoji}>{story.emoji}</Text>
        </View>
      </Animated.View>
      <Text style={styles.storyName} numberOfLines={1}>{story.name.split(' ')[0]}</Text>
    </TouchableOpacity>
  );
}

// ── Composant ReactionBurst (animation like) ─────────────────────────────────
function ReactionBurst({ visible, emoji }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0); opacity.setValue(1); translateY.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.5, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -40, duration: 600, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.Text style={[
      styles.burstEmoji,
      { opacity, transform: [{ scale }, { translateY }] },
    ]}>
      {emoji}
    </Animated.Text>
  );
}

// ── Composant PostCard ───────────────────────────────────────────────────────
function PostCard({ post, onReact, onComment, onEstablishment }) {
  const [burst, setBurst]           = useState({ visible: false, emoji: '' });
  const [showAllReactions, setShow] = useState(false);
  const [localReactions, setLocal]  = useState(post.reactions);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleReact = (reaction) => {
    const isToggle = localReactions.userReaction === reaction.key;
    const newReactions = { ...localReactions };
    if (localReactions.userReaction) {
      newReactions[localReactions.userReaction] = Math.max(0, (newReactions[localReactions.userReaction] || 1) - 1);
    }
    if (!isToggle) {
      newReactions[reaction.key] = (newReactions[reaction.key] || 0) + 1;
      newReactions.userReaction = reaction.key;
      setBurst({ visible: true, emoji: reaction.emoji });
      setTimeout(() => setBurst({ visible: false, emoji: '' }), 800);
    } else {
      newReactions.userReaction = null;
    }
    setLocal(newReactions);
    setShow(false);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim,  { toValue: 1,    useNativeDriver: true }),
    ]).start();
    onReact?.(post.id, reaction.key);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🌟 Via SOKORA\n${post.establishment.name} — ${post.content.slice(0, 100)}...\n\nTélécharge SOKORA pour plus!`,
      });
    } catch (_) {}
  };

  const postType = POST_TYPES[post.postType] || POST_TYPES.info;
  const estabIcon = ESTAB_ICONS[post.establishment.type] || ESTAB_ICONS.default;
  const totalReactions = REACTIONS.reduce((s, r) => s + (localReactions[r.key] || 0), 0);

  return (
    <Animated.View style={[styles.postCard, { transform: [{ scale: scaleAnim }] }]}>

      {/* ── Header établissement ── */}
      <TouchableOpacity style={styles.postHeader} onPress={() => onEstablishment?.(post.establishment)} activeOpacity={0.8}>
        <View style={styles.postAvatar}>
          <Text style={{ fontSize: 22 }}>{estabIcon}</Text>
          {post.establishment.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={8} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.postHeaderInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.postEstabName}>{post.establishment.name}</Text>
            {post.is_sponsored && (
              <View style={styles.sponsoredBadge}>
                <Text style={styles.sponsoredText}>Sponsorisé</Text>
              </View>
            )}
          </View>
          <Text style={styles.postMeta}>
            📍 {post.establishment.city} · {post.time_ago}
          </Text>
        </View>
        <View style={[styles.postTypeBadge, { backgroundColor: postType.bg }]}>
          <Text style={[styles.postTypeText, { color: postType.color }]}>{postType.label}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Bannière promo/event ── */}
      {(post.discount || post.event_date) && (
        <View style={[styles.promoBanner, {
          backgroundColor: post.postType === 'event' ? Colors.purple : Colors.orange,
        }]}>
          {post.discount && (
            <>
              <Text style={styles.promoDiscount}>{post.discount}</Text>
              <Text style={styles.promoLabel}>sur ce service via SOKORA Wallet</Text>
            </>
          )}
          {post.event_date && (
            <>
              <Ionicons name="calendar" size={16} color="#fff" />
              <Text style={styles.promoLabel}>{post.event_date}</Text>
            </>
          )}
        </View>
      )}

      {/* ── Contenu ── */}
      <View style={styles.postContent}>
        <Text style={styles.postText}>{post.content}</Text>
      </View>

      {/* ── Compteurs réactions ── */}
      {totalReactions > 0 && (
        <View style={styles.reactionSummary}>
          <View style={styles.reactionEmojis}>
            {REACTIONS.filter(r => (localReactions[r.key] || 0) > 0).slice(0, 3).map(r => (
              <Text key={r.key} style={styles.reactionSummaryEmoji}>{r.emoji}</Text>
            ))}
          </View>
          <Text style={styles.reactionCount}>{totalReactions.toLocaleString('fr-FR')}</Text>
          <Text style={styles.reactionCountSep}>·</Text>
          <Text style={styles.reactionCount}>{post.comments_count} commentaires</Text>
        </View>
      )}

      <View style={styles.postDivider} />

      {/* ── Barre d'actions ── */}
      <View style={styles.actionsBar}>

        {/* Bouton réaction principal */}
        <View style={{ position: 'relative' }}>
          <ReactionBurst visible={burst.visible} emoji={burst.emoji} />
          <TouchableOpacity
            style={[styles.actionBtn, localReactions.userReaction && styles.actionBtnActive]}
            onLongPress={() => setShow(true)}
            onPress={() => {
              if (!localReactions.userReaction) handleReact(REACTIONS[1]); // heart par défaut
              else handleReact(REACTIONS.find(r => r.key === localReactions.userReaction));
            }}
          >
            <Text style={{ fontSize: 18 }}>
              {localReactions.userReaction
                ? REACTIONS.find(r => r.key === localReactions.userReaction)?.emoji
                : '🤍'}
            </Text>
            <Text style={[styles.actionLabel, localReactions.userReaction && { color: Colors.orange }]}>
              J'aime
            </Text>
          </TouchableOpacity>

          {/* Panel réactions étendu */}
          {showAllReactions && (
            <View style={styles.reactionsPanel}>
              {REACTIONS.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={styles.reactionOption}
                  onPress={() => handleReact(r)}
                >
                  <Text style={styles.reactionOptionEmoji}>{r.emoji}</Text>
                  <Text style={styles.reactionOptionLabel}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment?.(post)}>
          <Ionicons name="chatbubble-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.actionLabel}>Commenter</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.actionLabel}>Partager</Text>
        </TouchableOpacity>

        {post.has_booking && (
          <TouchableOpacity
            style={styles.actionBtnBook}
            onPress={() => onEstablishment?.(post.establishment)}
          >
            <Ionicons name="calendar" size={14} color="#fff" />
            <Text style={styles.actionBtnBookText}>Réserver</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Fermer panel réactions si ouvert */}
      {showAllReactions && (
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShow(false)} />
      )}
    </Animated.View>
  );
}

// ── Composant CommentModal ───────────────────────────────────────────────────
function CommentModal({ visible, post, onClose }) {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState(DEMO_COMMENTS);

  const sendComment = () => {
    if (!comment.trim()) return;
    setComments(prev => [
      { id: Date.now(), author: 'Vous', text: comment.trim(), time: 'à l\'instant' },
      ...prev,
    ]);
    setComment('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Commentaires</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {post && (
            <View style={styles.modalPostPreview}>
              <Text style={styles.modalPostName}>{post.establishment?.name}</Text>
              <Text style={styles.modalPostSnippet} numberOfLines={2}>{post.content}</Text>
            </View>
          )}

          {/* Liste commentaires */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
            {comments.map(c => (
              <View key={c.id} style={styles.commentItem}>
                <View style={styles.commentAvatar}>
                  <Text style={{ fontSize: 16 }}>😊</Text>
                </View>
                <View style={styles.commentBody}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{c.author}</Text>
                    <Text style={styles.commentTime}>{c.time}</Text>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Input commentaire */}
          <View style={styles.commentInput}>
            <View style={styles.commentAvatar}>
              <Text style={{ fontSize: 16 }}>😊</Text>
            </View>
            <TextInput
              style={styles.commentInputField}
              placeholder="Écrire un commentaire..."
              placeholderTextColor={Colors.textFaint}
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <TouchableOpacity
              style={[styles.commentSendBtn, !comment.trim() && { opacity: 0.4 }]}
              onPress={sendComment}
              disabled={!comment.trim()}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Écran principal PromoFeedScreen ─────────────────────────────────────────
export default function PromoFeedScreen({ navigation }) {
  const [posts, setPosts]         = useState(DEMO_POSTS);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory]   = useState('all');
  const [commentPost, setCommentPost] = useState(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  const loadPosts = useCallback(async () => {
    try {
      const data = await promoService.list({ category: category === 'all' ? undefined : category });
      if (Array.isArray(data)) setPosts(data);
    } catch {
      // Keep demo data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useFocusEffect(useCallback(() => { loadPosts(); }, [loadPosts]));

  const handleEstablishment = (estab) => {
    navigation?.navigate('EstablishmentPage', { establishment: estab });
  };

  const filteredPosts = category === 'all'
    ? posts
    : posts.filter(p => p.postType === category || (category === 'near' && true));

  const ListHeader = () => (
    <>
      {/* ── Header PULSE ── */}
      <View style={styles.pulseHeader}>
        <View style={styles.pulseHeaderLeft}>
          <Text style={styles.pulseLogo}>
            <Text style={{ color: Colors.orange }}>SOKORA</Text>
            <Text style={{ color: '#fff' }}> PULSE</Text>
          </Text>
          <Text style={styles.pulseSubtitle}>Découvrez les offres du moment</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={22} color="#fff" />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </View>

      {/* ── Stories / Pulses ── */}
      <View style={styles.storiesSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
          {/* Votre story */}
          <TouchableOpacity style={styles.storyItem}>
            <View style={[styles.storyRing, styles.storyRingAdd]}>
              <View style={[styles.storyAvatar, { backgroundColor: Colors.orangePale }]}>
                <Ionicons name="add" size={22} color={Colors.orange} />
              </View>
            </View>
            <Text style={styles.storyName}>Votre pulse</Text>
          </TouchableOpacity>

          {DEMO_STORIES.map(s => (
            <PulseStory key={s.id} story={s} onPress={() => handleEstablishment({ name: s.name, type: s.type })} />
          ))}
        </ScrollView>
      </View>

      {/* ── Filtres catégories ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.filterChip, category === cat.id && styles.filterChipActive]}
            onPress={() => setCategory(cat.id)}
          >
            <Text style={[styles.filterChipText, category === cat.id && styles.filterChipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Bandeau promo SOKORA ── */}
      <TouchableOpacity style={styles.sokoraBanner} activeOpacity={0.9}>
        <View style={styles.sokoraBannerContent}>
          <Text style={styles.sokoraBannerEmoji}>💎</Text>
          <View>
            <Text style={styles.sokoraBannerTitle}>Passez en CONCIERGERIE</Text>
            <Text style={styles.sokoraBannerSub}>Cashback sur tous vos achats + services prioritaires</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.gold} />
      </TouchableOpacity>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredPosts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onReact={(id, key) => {}}
            onComment={setCommentPost}
            onEstablishment={handleEstablishment}
          />
        )}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadPosts(); }}
            tintColor={Colors.orange}
            colors={[Colors.orange]}
          />
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📡</Text>
              <Text style={styles.emptyTitle}>Aucun pulse pour l'instant</Text>
              <Text style={styles.emptyText}>Revenez bientôt pour voir les offres</Text>
            </View>
          )
        }
      />

      <CommentModal
        visible={!!commentPost}
        post={commentPost}
        onClose={() => setCommentPost(null)}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // ── Pulse Header
  pulseHeader: {
    backgroundColor: Colors.navy,
    paddingTop: 54, paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  pulseHeaderLeft: {},
  pulseLogo: { fontSize: Typography['2xl'], fontWeight: '900', letterSpacing: 0.5 },
  pulseSubtitle: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  notifBtn: { padding: Spacing.sm, position: 'relative' },
  notifDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.orange, borderWidth: 1.5, borderColor: Colors.navy,
  },

  // ── Stories
  storiesSection: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  storiesRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.lg },
  storyItem: { alignItems: 'center', gap: 4, width: 64 },
  storyRing: {
    width: 58, height: 58, borderRadius: 29,
    padding: 2, justifyContent: 'center', alignItems: 'center',
  },
  storyRingActive: {
    borderWidth: 2.5,
    borderColor: Colors.orange,
    shadowColor: Colors.orange,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  storyRingInactive: { borderWidth: 2, borderColor: Colors.border },
  storyRingAdd:      { borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.orange },
  storyAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.bg,
    justifyContent: 'center', alignItems: 'center',
  },
  storyEmoji: { fontSize: 24 },
  storyName: { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },

  // ── Filtres
  filterRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterChipText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textMuted },
  filterChipTextActive: { color: '#fff' },

  // ── Bandeau SOKORA
  sokoraBanner: {
    margin: Spacing.lg,
    marginTop: Spacing.sm,
    backgroundColor: Colors.navy,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadow.md,
  },
  sokoraBannerContent:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sokoraBannerEmoji:  { fontSize: 32 },
  sokoraBannerTitle:  { fontSize: Typography.sm, fontWeight: '700', color: Colors.gold },
  sokoraBannerSub:    { fontSize: Typography.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  // ── Post Card
  postCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  postHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: Spacing.sm,
  },
  postAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.orangePale,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  verifiedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.teal,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.surface,
  },
  postHeaderInfo: { flex: 1 },
  postEstabName: { fontSize: Typography.sm, fontWeight: '800', color: Colors.navy },
  postMeta: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  sponsoredBadge: {
    backgroundColor: Colors.purplePale,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  sponsoredText: { fontSize: 9, fontWeight: '700', color: Colors.purple },
  postTypeBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  postTypeText: { fontSize: Typography.xs, fontWeight: '700' },

  // ── Promo Banner
  promoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  promoDiscount: { fontSize: Typography.xl, fontWeight: '900', color: '#fff' },
  promoLabel: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.9)', fontWeight: '600', flex: 1 },

  // ── Post Content
  postContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  postText: { fontSize: Typography.base, color: Colors.text, lineHeight: 21 },

  // ── Reaction Summary
  reactionSummary: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
    gap: 4,
  },
  reactionEmojis: { flexDirection: 'row' },
  reactionSummaryEmoji: { fontSize: 14, marginRight: -2 },
  reactionCount: { fontSize: Typography.xs, color: Colors.textMuted },
  reactionCountSep: { fontSize: Typography.xs, color: Colors.textFaint, marginHorizontal: 2 },

  postDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },

  // ── Actions Bar
  actionsBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  actionBtnActive: { backgroundColor: Colors.orangePale },
  actionLabel: { fontSize: Typography.xs, fontWeight: '600', color: Colors.textMuted },
  actionBtnBook: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.orange,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    ...Shadow.orange,
  },
  actionBtnBookText: { fontSize: Typography.xs, fontWeight: '700', color: '#fff' },

  // ── Reactions Panel
  reactionsPanel: {
    position: 'absolute', bottom: 44, left: 0,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.sm,
    gap: Spacing.xs,
    ...Shadow.lg,
    zIndex: 100,
    borderWidth: 1, borderColor: Colors.border,
  },
  reactionOption: { alignItems: 'center', padding: Spacing.xs },
  reactionOptionEmoji: { fontSize: 24 },
  reactionOptionLabel: { fontSize: 8, color: Colors.textMuted, marginTop: 2 },

  // ── Burst
  burstEmoji: {
    position: 'absolute', bottom: 24, left: 16,
    fontSize: 28, zIndex: 50,
  },

  // ── Comment Modal
  modalContainer: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.navy },
  modalClose: { padding: Spacing.sm },
  modalPostPreview: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalPostName: { fontSize: Typography.sm, fontWeight: '700', color: Colors.orange },
  modalPostSnippet: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },

  commentItem: {
    flexDirection: 'row', gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: Spacing.md,
    ...Shadow.sm,
  },
  commentAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bg,
    justifyContent: 'center', alignItems: 'center',
  },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor: { fontSize: Typography.sm, fontWeight: '700', color: Colors.navy },
  commentTime: { fontSize: Typography.xs, color: Colors.textFaint },
  commentText: { fontSize: Typography.sm, color: Colors.text, marginTop: 2, lineHeight: 18 },

  commentInput: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: Spacing.md, gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  commentInputField: {
    flex: 1, fontSize: Typography.base, color: Colors.text,
    backgroundColor: Colors.bg, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    maxHeight: 80,
  },
  commentSendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    ...Shadow.orange,
  },

  // ── Empty
  emptyState: { alignItems: 'center', paddingVertical: Spacing['4xl'], gap: Spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text },
  emptyText:  { fontSize: Typography.sm, color: Colors.textMuted },
});
