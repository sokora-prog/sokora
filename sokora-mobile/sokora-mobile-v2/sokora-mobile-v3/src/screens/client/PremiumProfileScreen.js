/**
 * PremiumProfileScreen — SOKORA CONCIERGERIE 💎
 * Profil VIP : Carte premium, cashback, avantages, assistance prioritaire
 * Design : Gradient or/platine, carte de membre animée, badges tier
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';
import { useAuth } from '../../services/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';

const { width: W } = Dimensions.get('window');

// ── Tiers Conciergerie ──────────────────────────────────────────────────────
const TIERS = [
  {
    id: 'bronze',
    label: 'Bronze',
    emoji: '🥉',
    min: 0,
    max: 9999,
    color: '#CD7F32',
    bg: '#FFF8F0',
    gradient: ['#CD7F32', '#A0522D'],
    cashback: 1,
    benefits: ['Paiement SOKORA Wallet', 'Historique transactions', 'Support standard'],
  },
  {
    id: 'silver',
    label: 'Silver',
    emoji: '🥈',
    min: 10000,
    max: 49999,
    color: '#94A3B8',
    bg: '#F8FAFC',
    gradient: ['#94A3B8', '#64748B'],
    cashback: 2,
    benefits: ['Tout Bronze', 'Réductions 2% chez les partenaires', 'Accès offres exclusives', 'Support prioritaire'],
  },
  {
    id: 'gold',
    label: 'Gold',
    emoji: '🥇',
    min: 50000,
    max: 199999,
    color: Colors.gold,
    bg: '#FFFBEB',
    gradient: ['#F59E0B', '#D97706'],
    cashback: 5,
    benefits: ['Tout Silver', 'Cashback 5%', 'Réservation prioritaire', 'Invitations événements VIP', 'Assistant dédié'],
  },
  {
    id: 'diamond',
    label: 'Diamond',
    emoji: '💎',
    min: 200000,
    max: 999999,
    color: '#6366F1',
    bg: Colors.purplePale,
    gradient: ['#818CF8', '#6366F1'],
    cashback: 10,
    benefits: ['Tout Gold', 'Cashback 10%', 'Service conciergerie 24/7', 'Accès salons VIP', 'Surclassements hôtels', 'Livraison gratuite'],
  },
  {
    id: 'platinum',
    label: 'Platine ✦',
    emoji: '👑',
    min: 1000000,
    max: Infinity,
    color: Colors.navy,
    bg: '#EFF6FF',
    gradient: ['#1A2E4A', '#2E4A76'],
    cashback: 15,
    benefits: ['Tout Diamond', 'Cashback 15%', 'Majordome virtuel SOKORA', 'Accès partenaires prestige', 'Événements privés', 'Conciergerie personnelle', 'Accès anticipé aux nouvelles fonctionnalités'],
  },
];

const BENEFITS_ICONS = {
  'Paiement SOKORA Wallet': 'wallet',
  'Historique transactions': 'time',
  'Support standard': 'chatbubble-outline',
  'Cashback': 'cash',
  'Réductions': 'pricetag',
  'Offres exclusives': 'star',
  'Priorité': 'rocket',
  'VIP': 'diamond',
  'Conciergerie': 'person-circle',
  'Assistant': 'headset',
  'Livraison': 'bicycle',
  'Surclassement': 'arrow-up-circle',
  'Majordome': 'people',
};

// ── Composant MemberCard animée ──────────────────────────────────────────────
function MemberCard({ user, tier, totalSpent }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const rotate  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();
  }, []);

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1], outputRange: [-W, W],
  });

  return (
    <View style={[styles.memberCard, { backgroundColor: tier.color }]}>
      {/* Shimmer effect */}
      <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerTranslate }] }]} />

      {/* Top row */}
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.cardBrand}>SOKORA</Text>
          <Text style={styles.cardType}>CONCIERGERIE {tier.label.toUpperCase()}</Text>
        </View>
        <Text style={styles.cardTierEmoji}>{tier.emoji}</Text>
      </View>

      {/* Nom membre */}
      <View style={styles.cardMiddle}>
        <Text style={styles.cardName}>{user?.name || user?.phone_number || 'Membre SOKORA'}</Text>
        <Text style={styles.cardSub}>Membre depuis {new Date().getFullYear()}</Text>
      </View>

      {/* Solde / points */}
      <View style={styles.cardBottom}>
        <View>
          <Text style={styles.cardStatLabel}>Dépenses totales</Text>
          <Text style={styles.cardStatValue}>{totalSpent.toLocaleString('fr-FR')} FCFA</Text>
        </View>
        <View style={styles.cardSeparator} />
        <View>
          <Text style={styles.cardStatLabel}>Cashback gagné</Text>
          <Text style={[styles.cardStatValue, { color: Colors.gold }]}>
            {Math.round(totalSpent * tier.cashback / 100).toLocaleString('fr-FR')} F
          </Text>
        </View>
        <View style={styles.cardChip}>
          <View style={styles.cardChipInner} />
        </View>
      </View>
    </View>
  );
}

// ── Composant TierProgress ──────────────────────────────────────────────────
function TierProgress({ currentTier, totalSpent }) {
  const tierIndex = TIERS.findIndex(t => t.id === currentTier.id);
  const nextTier = TIERS[tierIndex + 1];
  if (!nextTier) return (
    <View style={[styles.progressCard, { backgroundColor: currentTier.bg }]}>
      <Text style={[styles.progressTitle, { color: currentTier.color }]}>
        {currentTier.emoji} Niveau Maximum — {currentTier.label}
      </Text>
      <Text style={styles.progressSub}>Vous avez atteint le sommet de la Conciergerie SOKORA !</Text>
    </View>
  );

  const progress = Math.min((totalSpent - currentTier.min) / (nextTier.min - currentTier.min), 1);
  const remaining = nextTier.min - totalSpent;

  return (
    <View style={[styles.progressCard, { backgroundColor: currentTier.bg, borderColor: currentTier.color + '40' }]}>
      <View style={styles.progressHeader}>
        <Text style={[styles.progressTitle, { color: currentTier.color }]}>
          {currentTier.emoji} {currentTier.label}
        </Text>
        <View style={styles.progressNextBadge}>
          <Text style={styles.progressNextText}>→ {nextTier.emoji} {nextTier.label}</Text>
        </View>
      </View>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarBg]}>
          <View style={[styles.progressBarFill, {
            width: `${progress * 100}%`,
            backgroundColor: currentTier.color,
          }]} />
        </View>
        <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
      </View>
      <Text style={styles.progressSub}>
        Plus que {remaining.toLocaleString('fr-FR')} FCFA pour atteindre {nextTier.label}
      </Text>
    </View>
  );
}

// ── Composant BenefitItem ────────────────────────────────────────────────────
function BenefitItem({ text, active, color }) {
  const iconKey = Object.keys(BENEFITS_ICONS).find(k => text.includes(k));
  const icon = iconKey ? BENEFITS_ICONS[iconKey] : 'checkmark-circle';
  return (
    <View style={[styles.benefitItem, !active && styles.benefitItemInactive]}>
      <View style={[styles.benefitIcon, { backgroundColor: active ? color + '20' : Colors.bg }]}>
        <Ionicons name={icon} size={18} color={active ? color : Colors.textFaint} />
      </View>
      <Text style={[styles.benefitText, !active && styles.benefitTextInactive]}>{text}</Text>
      {active && <Ionicons name="checkmark" size={16} color={color} style={{ marginLeft: 'auto' }} />}
    </View>
  );
}

// ── Écran principal ──────────────────────────────────────────────────────────
export default function PremiumProfileScreen({ navigation }) {
  const { user } = useAuth();
  const [totalSpent] = useState(87500); // Viendra de l'API
  const [cashbackHistory] = useState([
    { id: 1, desc: 'Maquis La Belle Vie', amount: 1250, date: '28 Mar' },
    { id: 2, desc: 'Hotel Le Diplomate', amount: 3500, date: '25 Mar' },
    { id: 3, desc: 'UTB Abidjan → Bouaké', amount: 175, date: '20 Mar' },
    { id: 4, desc: 'Bar Étoile VIP', amount: 600, date: '15 Mar' },
  ]);

  const scrollY = useRef(new Animated.Value(0)).current;

  const currentTier = TIERS.find(t => totalSpent >= t.min && totalSpent <= t.max) || TIERS[0];
  const currentTierIndex = TIERS.findIndex(t => t.id === currentTier.id);

  const totalCashback = cashbackHistory.reduce((s, c) => s + c.amount, 0);

  const handleVIPSupport = () => {
    Alert.alert(
      '👑 Support Conciergerie',
      'Votre conseiller SOKORA est disponible 24/7.\nChoisissez votre canal :',
      [
        { text: '📞 Appel VIP', onPress: () => Linking.openURL('tel:+2250700000000') },
        { text: '💬 WhatsApp', onPress: () => Linking.openURL('https://wa.me/2250700000000') },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader navigation={navigation} title="Mon profil" dark={true} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Carte de membre */}
        <View style={styles.cardContainer}>
          <MemberCard user={user} tier={currentTier} totalSpent={totalSpent} />
        </View>

        {/* Progression tier */}
        <View style={styles.section}>
          <TierProgress currentTier={currentTier} totalSpent={totalSpent} />
        </View>

        {/* Stats cashback */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: Colors.greenPale, borderColor: Colors.green + '40' }]}>
            <Ionicons name="cash" size={24} color={Colors.green} />
            <Text style={styles.statAmount}>{totalCashback.toLocaleString('fr-FR')} F</Text>
            <Text style={styles.statLabel}>Cashback reçu</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.orangePale, borderColor: Colors.orange + '40' }]}>
            <Ionicons name="pricetag" size={24} color={Colors.orange} />
            <Text style={styles.statAmount}>{currentTier.cashback}%</Text>
            <Text style={styles.statLabel}>Taux cashback</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.purplePale, borderColor: Colors.purple + '40' }]}>
            <Ionicons name="star" size={24} color={Colors.purple} />
            <Text style={styles.statAmount}>{totalSpent.toLocaleString('fr-FR')}</Text>
            <Text style={styles.statLabel}>Total dépensé</Text>
          </View>
        </View>

        {/* Avantages du niveau actuel */}
        <View style={[styles.benefitsSection, { borderColor: currentTier.color + '40' }]}>
          <View style={styles.benefitsHeader}>
            <Text style={styles.benefitsTitle}>{currentTier.emoji} Avantages {currentTier.label}</Text>
            <View style={[styles.cashbackBadge, { backgroundColor: currentTier.color }]}>
              <Text style={styles.cashbackBadgeText}>{currentTier.cashback}% cashback</Text>
            </View>
          </View>
          {currentTier.benefits.map((b, i) => (
            <BenefitItem key={i} text={b} active={true} color={currentTier.color} />
          ))}
        </View>

        {/* Tous les niveaux */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Tous les niveaux</Text>
          {TIERS.map((tier, i) => {
            const isActive = tier.id === currentTier.id;
            const isPast   = i < currentTierIndex;
            const isFuture = i > currentTierIndex;
            return (
              <View key={tier.id} style={[
                styles.tierRow,
                isActive && { borderColor: tier.color, borderWidth: 2, backgroundColor: tier.bg },
              ]}>
                <Text style={styles.tierRowEmoji}>{tier.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.tierRowLabel, isActive && { color: tier.color }]}>{tier.label}</Text>
                    {isActive && (
                      <View style={[styles.currentBadge, { backgroundColor: tier.color }]}>
                        <Text style={styles.currentBadgeText}>Actuel</Text>
                      </View>
                    )}
                    {isPast && <Ionicons name="checkmark-circle" size={16} color={Colors.green} />}
                  </View>
                  <Text style={styles.tierRowSub}>
                    {tier.min === 0
                      ? `Dès 0 FCFA`
                      : `À partir de ${tier.min.toLocaleString('fr-FR')} FCFA`}
                  </Text>
                  <Text style={[styles.tierCashback, { color: tier.color }]}>
                    Cashback {tier.cashback}%
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={isFuture ? Colors.textFaint : tier.color} />
              </View>
            );
          })}
        </View>

        {/* Historique cashback */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Historique cashback</Text>
          {cashbackHistory.map(item => (
            <View key={item.id} style={styles.cashbackRow}>
              <View style={styles.cashbackIcon}>
                <Ionicons name="cash" size={18} color={Colors.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cashbackDesc}>{item.desc}</Text>
                <Text style={styles.cashbackDate}>{item.date}</Text>
              </View>
              <Text style={styles.cashbackAmount}>+{item.amount.toLocaleString('fr-FR')} F</Text>
            </View>
          ))}
        </View>

        {/* Services prioritaires */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Services prioritaires</Text>
          <View style={styles.servicesGrid}>
            {[
              { icon: 'restaurant',   label: 'Table\nPrioritaire', color: Colors.orange },
              { icon: 'bed',          label: 'Chambre\nUpgrade',   color: Colors.teal   },
              { icon: 'airplane',     label: 'Embarquement\nVIP',  color: Colors.purple },
              { icon: 'bicycle',      label: 'Livraison\nExpress', color: Colors.green  },
              { icon: 'headset',      label: 'Support\n24/7',      color: Colors.navy   },
              { icon: 'gift',         label: 'Cadeaux\nFidélité',  color: Colors.gold   },
            ].map((svc, i) => {
              const isAvailable = i < currentTierIndex + 2;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.serviceCard, !isAvailable && styles.serviceCardLocked]}
                  onPress={() => !isAvailable && Alert.alert('🔒 Fonctionnalité Premium', `Disponible dès le niveau ${TIERS[i]?.label || 'supérieur'}`)}
                >
                  <Ionicons
                    name={isAvailable ? svc.icon : 'lock-closed'}
                    size={24}
                    color={isAvailable ? svc.color : Colors.textFaint}
                  />
                  <Text style={[styles.serviceLabel, !isAvailable && { color: Colors.textFaint }]}>
                    {svc.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bouton Support VIP */}
        <View style={styles.section}>
          <TouchableOpacity style={[styles.vipSupportBtn, { backgroundColor: currentTier.color }]} onPress={handleVIPSupport}>
            <Ionicons name="headset" size={22} color="#fff" />
            <View>
              <Text style={styles.vipSupportTitle}>Assistance Conciergerie</Text>
              <Text style={styles.vipSupportSub}>Votre conseiller dédié vous répond</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    backgroundColor: Colors.navy,
    paddingTop: 54, paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { padding: Spacing.sm, width: 40 },
  headerTitle: { flex: 1, fontSize: Typography.xl, fontWeight: '800', color: '#fff', textAlign: 'center' },

  cardContainer: { padding: Spacing.lg },

  // Member Card
  memberCard: {
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    height: 200,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...Shadow.lg,
  },
  shimmer: {
    position: 'absolute', top: 0, bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    transform: [{ skewX: '-20deg' }],
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardBrand: { fontSize: Typography.sm, fontWeight: '900', color: 'rgba(255,255,255,0.8)', letterSpacing: 2 },
  cardType: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginTop: 2 },
  cardTierEmoji: { fontSize: 36 },
  cardMiddle: {},
  cardName: { fontSize: Typography.xl, fontWeight: '800', color: '#fff' },
  cardSub: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.lg },
  cardStatLabel: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  cardStatValue: { fontSize: Typography.sm, fontWeight: '700', color: '#fff' },
  cardSeparator: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  cardChip: {
    marginLeft: 'auto',
    width: 40, height: 30, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardChipInner: {
    width: 30, height: 22, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Progress
  section: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadow.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: Typography.md, fontWeight: '800', color: Colors.navy, marginBottom: Spacing.md },

  progressCard: {
    borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1.5,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  progressTitle: { fontSize: Typography.md, fontWeight: '800' },
  progressNextBadge: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  progressNextText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.textMuted },
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressBarBg: { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: 4 },
  progressBarFill: { height: 8, borderRadius: 4, minWidth: 8 },
  progressPct: { fontSize: Typography.xs, fontWeight: '700', color: Colors.textMuted },
  progressSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: Spacing.sm },

  // Stats
  statsRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1, alignItems: 'center', gap: 4,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, ...Shadow.sm,
  },
  statAmount: { fontSize: Typography.sm, fontWeight: '800', color: Colors.navy },
  statLabel: { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center' },

  // Benefits
  benefitsSection: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl, padding: Spacing.xl,
    borderWidth: 1.5, ...Shadow.md,
  },
  benefitsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  benefitsTitle: { fontSize: Typography.md, fontWeight: '800', color: Colors.navy },
  cashbackBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  cashbackBadgeText: { fontSize: Typography.xs, fontWeight: '700', color: '#fff' },

  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 7 },
  benefitItemInactive: { opacity: 0.4 },
  benefitIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  benefitText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.text, flex: 1 },
  benefitTextInactive: { color: Colors.textFaint },

  // Tiers list
  tierRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  tierRowEmoji: { fontSize: 28 },
  tierRowLabel: { fontSize: Typography.sm, fontWeight: '700', color: Colors.text },
  tierRowSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  tierCashback: { fontSize: Typography.xs, fontWeight: '700', marginTop: 1 },
  currentBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  currentBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // Cashback history
  cashbackRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cashbackIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.greenPale,
    justifyContent: 'center', alignItems: 'center',
  },
  cashbackDesc: { fontSize: Typography.sm, fontWeight: '600', color: Colors.text },
  cashbackDate: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  cashbackAmount: { fontSize: Typography.sm, fontWeight: '800', color: Colors.green },

  // Services grid
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  serviceCard: {
    width: (W - Spacing.lg * 2 - Spacing.xl * 2 - Spacing.sm * 2) / 3,
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg, padding: Spacing.md,
    alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  serviceCardLocked: { opacity: 0.5 },
  serviceLabel: { fontSize: Typography.xs, fontWeight: '600', color: Colors.text, textAlign: 'center' },

  // VIP Support
  vipSupportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.xl, padding: Spacing.lg,
    ...Shadow.md,
  },
  vipSupportTitle: { fontSize: Typography.md, fontWeight: '800', color: '#fff' },
  vipSupportSub: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
