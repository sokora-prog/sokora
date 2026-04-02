/**
 * EstablishmentPageScreen — Page Établissement SOKORA 🏪
 * Profil complet : infos, photos, menu preview, promos, avis, réservation
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, Alert, Linking, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';

const { width: W } = Dimensions.get('window');

const CATEGORIES = {
  maquis:     { emoji: '🍖', label: 'Maquis',     color: '#E67E22' },
  bar:        { emoji: '🍺', label: 'Bar',         color: Colors.teal },
  restaurant: { emoji: '🍽️', label: 'Restaurant', color: Colors.orange },
  hotel:      { emoji: '🏨', label: 'Hôtel',       color: Colors.purple },
  voyage:     { emoji: '🚌', label: 'Voyage',      color: '#3498DB' },
};

const DEMO_REVIEWS = [
  { id: 1, author: 'Aminata K.',  rating: 5, text: 'Excellent endroit ! Nourriture délicieuse et service impeccable.', date: '28 Mar' },
  { id: 2, author: 'Kouamé D.',   rating: 4, text: 'Très bon rapport qualité/prix. Je recommande le poulet braisé.', date: '25 Mar' },
  { id: 3, author: 'Fatou M.',    rating: 5, text: 'Ambiance top, musique parfaite. On reviendra !', date: '20 Mar' },
  { id: 4, author: 'Jean-Paul Y.',rating: 3, text: 'Correct mais temps d\'attente un peu long le weekend.', date: '15 Mar' },
];

const DEMO_MENU = [
  { id: 1, name: 'Poulet Braisé', price: 2500, emoji: '🍗', desc: 'Poulet grillé au feu de bois + attiéké' },
  { id: 2, name: 'Alloco Poisson', price: 1500, emoji: '🐟', desc: 'Poisson frit + alloco + sauce tomate' },
  { id: 3, name: 'Plateau Spécial', price: 5000, emoji: '🎁', desc: 'Assortiment complet pour 2 personnes' },
  { id: 4, name: 'Jus de Fruit Frais', price: 800, emoji: '🥤', desc: 'Jus naturel du jour' },
];

function StarRating({ rating, size = 14, color = Colors.gold }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={color}
        />
      ))}
    </View>
  );
}

function InfoRow({ icon, label, value, onPress, color }) {
  return (
    <TouchableOpacity
      style={styles.infoRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.infoIcon, { backgroundColor: (color || Colors.orange) + '20' }]}>
        <Ionicons name={icon} size={16} color={color || Colors.orange} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, onPress && { color: color || Colors.orange }]}>{value}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />}
    </TouchableOpacity>
  );
}

export default function EstablishmentPageScreen({ navigation, route }) {
  const { establishment } = route?.params || {};
  const [activeTab, setTab] = useState('info');
  const [liked, setLiked] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const likeAnim = useRef(new Animated.Value(1)).current;

  const cat = CATEGORIES[establishment?.type || 'restaurant'];

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [200, 80],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const handleLike = () => {
    setLiked(prev => !prev);
    Animated.sequence([
      Animated.timing(likeAnim, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.spring(likeAnim,  { toValue: 1,   useNativeDriver: true }),
    ]).start();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🌟 Découvre ${establishment?.name} sur SOKORA !\n${establishment?.type ? cat.emoji + ' ' + cat.label : ''}\n📍 ${establishment?.city || ''}\n\nTélécharge SOKORA pour réserver !`,
      });
    } catch (_) {}
  };

  const handleCall = () => {
    if (establishment?.phone) Linking.openURL(`tel:${establishment.phone}`);
    else Alert.alert('Info', 'Numéro non renseigné');
  };

  const handleDirections = () => {
    if (establishment?.lat && establishment?.lon) {
      Linking.openURL(`https://maps.google.com/?q=${establishment.lat},${establishment.lon}`);
    } else {
      Alert.alert('Info', 'Adresse : ' + (establishment?.address || 'Non renseignée'));
    }
  };

  const TABS = [
    { id: 'info',   label: 'Infos',   icon: 'information-circle-outline' },
    { id: 'menu',   label: 'Menu',    icon: 'restaurant-outline'          },
    { id: 'promos', label: 'Promos',  icon: 'pricetag-outline'            },
    { id: 'avis',   label: 'Avis',    icon: 'star-outline'                },
  ];

  const rating = establishment?.rating || 4.5;
  const reviews_count = establishment?.reviews_count || 87;

  return (
    <View style={styles.container}>
      {/* ── Header animé ── */}
      <Animated.View style={[styles.headerBanner, { height: headerHeight }]}>
        <View style={[styles.bannerContent, { backgroundColor: (cat.color) + '25' }]}>
          <Animated.Text style={[styles.bannerEmoji, { opacity: headerOpacity }]}>
            {cat.emoji}
          </Animated.Text>
          {establishment?.is_premium && (
            <View style={styles.premiumBanner}>
              <Text style={styles.premiumBannerText}>⭐ Établissement Premium</Text>
            </View>
          )}
        </View>

        {/* Boutons overlay */}
        <View style={styles.bannerActions}>
          <TouchableOpacity style={styles.bannerBtn} onPress={() => navigation?.goBack()}>
            <Ionicons name="arrow-back" size={20} color={Colors.navy} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.bannerBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={Colors.navy} />
          </TouchableOpacity>
          <Animated.View style={{ transform: [{ scale: likeAnim }] }}>
            <TouchableOpacity style={[styles.bannerBtn, liked && { backgroundColor: Colors.red }]} onPress={handleLike}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#fff' : Colors.navy} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>

      {/* ── Carte info principale ── */}
      <View style={styles.mainCard}>
        <View style={styles.mainCardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.estabName}>{establishment?.name || 'Établissement'}</Text>
            <View style={styles.typeRow}>
              <View style={[styles.typeBadge, { backgroundColor: cat.color + '20' }]}>
                <Text style={{ fontSize: 12 }}>{cat.emoji}</Text>
                <Text style={[styles.typeLabel, { color: cat.color }]}>{cat.label}</Text>
              </View>
              {establishment?.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.teal} />
                  <Text style={styles.verifiedText}>Vérifié</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.ratingBlock}>
            <Text style={styles.ratingValue}>{rating}</Text>
            <StarRating rating={rating} />
            <Text style={styles.reviewsCount}>{reviews_count} avis</Text>
          </View>
        </View>

        <Text style={styles.address}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          {' '}{establishment?.city || 'Abidjan'}{establishment?.address ? ` · ${establishment.address}` : ''}
          {establishment?.distance && ` · ${establishment.distance < 1 ? `${Math.round(establishment.distance * 1000)}m` : `${establishment.distance.toFixed(1)}km`}`}
        </Text>

        {/* CTA principal */}
        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.ctaMain} onPress={handleCall}>
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.ctaMainText}>Contacter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSecondary} onPress={handleDirections}>
            <Ionicons name="navigate" size={18} color={Colors.teal} />
            <Text style={styles.ctaSecondaryText}>Itinéraire</Text>
          </TouchableOpacity>
          {(establishment?.type === 'restaurant' || establishment?.type === 'maquis') && (
            <TouchableOpacity
              style={styles.ctaSecondary}
              onPress={() => navigation?.navigate('VoyageSearch')}
            >
              <Ionicons name="restaurant" size={18} color={Colors.orange} />
              <Text style={styles.ctaSecondaryText}>Commander</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Onglets ── */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
            onPress={() => setTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.id ? Colors.orange : Colors.textMuted}
            />
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Contenu par onglet ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── INFOS ── */}
        {activeTab === 'info' && (
          <View style={styles.tabContent}>
            {establishment?.description && (
              <View style={styles.descCard}>
                <Text style={styles.descText}>{establishment.description}</Text>
              </View>
            )}

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Informations pratiques</Text>
              <InfoRow icon="time-outline" label="Horaires" value={establishment?.hours || '08:00 — 23:00 (tous les jours)'} color={Colors.green} />
              <InfoRow icon="call-outline" label="Téléphone" value={establishment?.phone || '+225 XX XX XX XX'} onPress={handleCall} color={Colors.teal} />
              <InfoRow icon="location-outline" label="Adresse" value={`${establishment?.address || 'Voir sur la carte'}, ${establishment?.city || ''}`} onPress={handleDirections} color={Colors.purple} />
              <InfoRow icon="wifi-outline" label="Wi-Fi" value="Disponible" color={Colors.orange} />
              <InfoRow icon="card-outline" label="Paiement" value="Cash · SOKORA Wallet · Mobile Money" color={Colors.navy} />
            </View>

            {establishment?.promo && (
              <View style={styles.promoHighlight}>
                <Text style={styles.promoHighlightTitle}>🏷️ Offre SOKORA Exclusive</Text>
                <Text style={styles.promoHighlightText}>{establishment.promo}</Text>
                <TouchableOpacity style={styles.promoHighlightBtn}>
                  <Text style={styles.promoHighlightBtnText}>Profiter de l'offre →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── MENU ── */}
        {activeTab === 'menu' && (
          <View style={styles.tabContent}>
            <Text style={styles.menuTitle}>Menu populaire</Text>
            {DEMO_MENU.map(item => (
              <View key={item.id} style={styles.menuItem}>
                <Text style={styles.menuEmoji}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuName}>{item.name}</Text>
                  <Text style={styles.menuDesc}>{item.desc}</Text>
                </View>
                <Text style={styles.menuPrice}>{item.price.toLocaleString('fr-FR')} F</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.fullMenuBtn}>
              <Text style={styles.fullMenuBtnText}>Voir le menu complet →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── PROMOS ── */}
        {activeTab === 'promos' && (
          <View style={styles.tabContent}>
            {establishment?.promo ? (
              <View style={styles.promoCard}>
                <View style={styles.promoCardTop}>
                  <Text style={styles.promoCardTitle}>Offre du moment</Text>
                  <View style={styles.promoTimeBadge}>
                    <Text style={styles.promoTimeBadgeText}>Expire bientôt</Text>
                  </View>
                </View>
                <Text style={styles.promoCardContent}>{establishment.promo}</Text>
                <Text style={styles.promoCardSub}>Payez avec SOKORA Wallet pour bénéficier de cette offre</Text>
                <TouchableOpacity style={styles.promoApplyBtn}>
                  <Ionicons name="wallet" size={16} color="#fff" />
                  <Text style={styles.promoApplyBtnText}>Utiliser mon Wallet</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 40 }}>🏷️</Text>
                <Text style={styles.emptyTitle}>Pas de promo active</Text>
                <Text style={styles.emptyText}>Revenez bientôt pour les offres exclusives !</Text>
              </View>
            )}
          </View>
        )}

        {/* ── AVIS ── */}
        {activeTab === 'avis' && (
          <View style={styles.tabContent}>
            {/* Résumé */}
            <View style={styles.reviewSummary}>
              <Text style={styles.reviewBigRating}>{rating}</Text>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <StarRating rating={rating} size={20} />
                <Text style={styles.reviewCount}>{reviews_count} avis clients</Text>
              </View>
            </View>

            {/* Liste avis */}
            {DEMO_REVIEWS.map(review => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <Text style={{ fontSize: 18 }}>😊</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewAuthor}>{review.author}</Text>
                    <StarRating rating={review.rating} size={12} />
                  </View>
                  <Text style={styles.reviewDate}>{review.date}</Text>
                </View>
                <Text style={styles.reviewText}>{review.text}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.writeReviewBtn}>
              <Ionicons name="create-outline" size={18} color={Colors.orange} />
              <Text style={styles.writeReviewText}>Écrire un avis</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header Banner
  headerBanner: {
    position: 'relative',
    overflow: 'hidden',
  },
  bannerContent: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  bannerEmoji: { fontSize: 80 },
  premiumBanner: {
    position: 'absolute', bottom: 12,
    backgroundColor: Colors.gold + '30',
    borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.gold,
  },
  premiumBannerText: { fontSize: Typography.xs, fontWeight: '700', color: '#B7791F' },
  bannerActions: {
    position: 'absolute', top: 54, left: 0, right: 0,
    flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm,
  },
  bannerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    ...Shadow.sm,
  },

  // Main Card
  mainCard: {
    margin: Spacing.lg, marginTop: -Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadow.lg,
    zIndex: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  mainCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  estabName: { fontSize: Typography.xl, fontWeight: '900', color: Colors.navy },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  typeLabel: { fontSize: Typography.xs, fontWeight: '700' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedText: { fontSize: Typography.xs, color: Colors.teal, fontWeight: '600' },
  ratingBlock: { alignItems: 'center', gap: 2 },
  ratingValue: { fontSize: Typography['2xl'], fontWeight: '900', color: Colors.navy },
  reviewsCount: { fontSize: Typography.xs, color: Colors.textMuted },
  address: { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: Spacing.md },

  ctaRow: { flexDirection: 'row', gap: Spacing.sm },
  ctaMain: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.orange, borderRadius: Radius.lg,
    paddingVertical: Spacing.sm + 2, ...Shadow.orange,
  },
  ctaMainText: { fontSize: Typography.sm, fontWeight: '700', color: '#fff' },
  ctaSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  ctaSecondaryText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.text },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.md, gap: 3,
    borderRightWidth: 1, borderRightColor: Colors.border,
  },
  tabItemActive: { backgroundColor: Colors.orangePale, borderBottomWidth: 2, borderBottomColor: Colors.orange },
  tabLabel:       { fontSize: Typography.xs, fontWeight: '600', color: Colors.textMuted },
  tabLabelActive: { color: Colors.orange },

  // Tab content
  tabContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md },

  // Info
  descCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  descText: { fontSize: Typography.base, color: Colors.text, lineHeight: 22 },
  infoCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg,
    ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
  },
  infoCardTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.navy, marginBottom: Spacing.md },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  infoIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  infoLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  infoValue: { fontSize: Typography.sm, fontWeight: '600', color: Colors.text },

  promoHighlight: {
    backgroundColor: Colors.orangePale,
    borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1.5, borderColor: Colors.orange + '60',
  },
  promoHighlightTitle: { fontSize: Typography.md, fontWeight: '800', color: Colors.orange, marginBottom: 6 },
  promoHighlightText: { fontSize: Typography.base, color: Colors.text, lineHeight: 20 },
  promoHighlightBtn: { marginTop: Spacing.md, alignSelf: 'flex-start' },
  promoHighlightBtnText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.orange },

  // Menu
  menuTitle: { fontSize: Typography.md, fontWeight: '800', color: Colors.navy },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
    ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
  },
  menuEmoji: { fontSize: 30 },
  menuName: { fontSize: Typography.sm, fontWeight: '700', color: Colors.navy },
  menuDesc: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  menuPrice: { fontSize: Typography.md, fontWeight: '800', color: Colors.orange },
  fullMenuBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  fullMenuBtnText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.orange },

  // Promos
  promoCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl,
    ...Shadow.md, borderWidth: 1.5, borderColor: Colors.orange + '60',
  },
  promoCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  promoCardTitle: { fontSize: Typography.md, fontWeight: '800', color: Colors.navy },
  promoTimeBadge: { backgroundColor: Colors.redPale, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  promoTimeBadgeText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.red },
  promoCardContent: { fontSize: Typography.base, color: Colors.text, lineHeight: 21, marginBottom: Spacing.sm },
  promoCardSub: { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: Spacing.lg },
  promoApplyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.orange, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, ...Shadow.orange,
  },
  promoApplyBtnText: { fontSize: Typography.md, fontWeight: '700', color: '#fff' },

  // Reviews
  reviewSummary: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xl,
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl,
    ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center',
  },
  reviewBigRating: { fontSize: Typography['4xl'], fontWeight: '900', color: Colors.navy },
  reviewCount: { fontSize: Typography.xs, color: Colors.textMuted },
  reviewCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
    ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center',
  },
  reviewAuthor: { fontSize: Typography.sm, fontWeight: '700', color: Colors.navy },
  reviewDate: { fontSize: Typography.xs, color: Colors.textFaint },
  reviewText: { fontSize: Typography.sm, color: Colors.text, lineHeight: 18 },
  writeReviewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  writeReviewText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.orange },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
  emptyTitle: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center' },
});
