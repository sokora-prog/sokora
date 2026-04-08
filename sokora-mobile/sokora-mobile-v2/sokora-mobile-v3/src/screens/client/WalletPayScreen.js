/**
 * WalletPayScreen — SOKORA Wallet + Code Marchand 💳
 * Génère un code de paiement unique pour les marchands
 * Style : *144*82*MONTANT*CODE# — expire 60s
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Animated, ActivityIndicator, Alert, Share,
  Clipboard, RefreshControl, Modal,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';
import { walletService } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import ReceiptModal from '../../components/ReceiptModal';

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000];

const PAYMENT_METHODS = [
  { id: 'orange',  label: 'Orange Money',   emoji: '🟠', color: '#FF6600', ussd: '*144*' },
  { id: 'mtn',     label: 'MTN MoMo',       emoji: '🟡', color: '#FFCC00', ussd: '*133*' },
  { id: 'moov',    label: 'Moov Money',     emoji: '🔵', color: '#0066CC', ussd: '*155*' },
  { id: 'wave',    label: 'Wave',           emoji: '🌊', color: '#0055A5', ussd: 'App '  },
  { id: 'wallet',  label: 'Wallet SOKORA',  emoji: '💎', color: Colors.orange, ussd: 'QR ' },
];

export default function WalletPayScreen({ navigation }) {
  const { user } = useAuth();
  const [balance, setBalance]       = useState(0);
  const [amount, setAmount]         = useState('');
  const [payMethod, setPayMethod]   = useState('orange');
  const [merchantCode, setCode]     = useState(null);
  const [countdown, setCountdown]   = useState(0);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefresh]    = useState(false);
  const [txHistory, setHistory]     = useState([]);
  const [topupModal, setTopupModal] = useState(false);
  const [topupAmount, setTopupAmt]  = useState('');

  const [showReceipt,   setShowReceipt]   = useState(false);
  const [walletReceipt, setWalletReceipt] = useState(null);

  const timerRef   = useRef(null);
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const fadeAnim   = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  // ── Chargement wallet ──────────────────────────────────────────────────────
  const loadWallet = useCallback(async () => {
    try {
      const { data } = await walletService.getMyWallet();
      setBalance(data.balance ?? 0);
      setHistory(data.transactions ?? []);
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  // ── Génération du code marchand ────────────────────────────────────────────
  const generateCode = async () => {
    const amt = parseInt(amount, 10);
    if (!amt || amt < 100) {
      Alert.alert('Montant invalide', 'Entrez un montant minimum de 100 F');
      return;
    }
    setGenerating(true);
    try {
      // Appel API (ou génération locale si demo)
      let code, ussdCode;
      try {
        const { data } = await walletService.generatePaymentCode({ amount: amt, method: payMethod });
        code = data.code;
        ussdCode = data.ussd_code;
      } catch {
        // Demo fallback
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const method = PAYMENT_METHODS.find(m => m.id === payMethod);
        ussdCode = payMethod === 'wallet'
          ? `QR code ci-dessous`
          : `${method?.ussd}82*${amt}*${code}#`;
      }

      setCode({ code, ussdCode, amount: amt, method: payMethod, generatedAt: Date.now() });
      startCountdown(60);

      // Reçu automatique pour paiement wallet SOKORA
      if (payMethod === 'wallet') {
        const selectedMethod = PAYMENT_METHODS.find(m => m.id === payMethod);
        setWalletReceipt({
          from_name:   'Mon Wallet',
          to_name:     'Commerçant',
          amount:      amt,
          description: `Paiement SOKORA via ${selectedMethod?.label || 'Wallet'}`,
        });
        setShowReceipt(true);
      }

      // Animation pulse
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 200, useNativeDriver: true }),
      ]).start();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de générer le code');
    } finally {
      setGenerating(false);
    }
  };

  // ── Countdown 60s ─────────────────────────────────────────────────────────
  const startCountdown = (seconds) => {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    progressAnim.setValue(1);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: seconds * 1000,
      useNativeDriver: false,
    }).start();
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          setCode(null);
          return 0;
        }
        // Flash rouge quand < 10s
        if (c === 10) {
          Animated.loop(
            Animated.sequence([
              Animated.timing(fadeAnim, { toValue: 0.4, duration: 400, useNativeDriver: true }),
              Animated.timing(fadeAnim, { toValue: 1,   duration: 400, useNativeDriver: true }),
            ]),
            { iterations: 10 }
          ).start();
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Copier code ────────────────────────────────────────────────────────────
  const copyCode = () => {
    if (!merchantCode) return;
    Clipboard.setString(merchantCode.ussdCode);
    Alert.alert('✅ Copié !', `Le code a été copié dans le presse-papier`);
  };

  const shareCode = async () => {
    if (!merchantCode) return;
    const method = PAYMENT_METHODS.find(m => m.id === merchantCode.method);
    try {
      await Share.share({
        message: `💳 Paiement SOKORA\nMontant : ${merchantCode.amount.toLocaleString('fr-FR')} FCFA\nCode : ${merchantCode.ussdCode}\nValable ${countdown} secondes\n\nPayez via ${method?.label}`,
      });
    } catch (_) {}
  };

  const method = PAYMENT_METHODS.find(m => m.id === payMethod) || PAYMENT_METHODS[0];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.orange} />
      </View>
    );
  }

  return (
    <>
      <ReceiptModal
        visible={showReceipt}
        onClose={() => setShowReceipt(false)}
        receipt={walletReceipt}
        type="wallet"
      />
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); loadWallet(); }} tintColor={Colors.orange} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <ScreenHeader
        navigation={navigation}
        title="Wallet SOKORA"
        dark={true}
        rightIcon="time-outline"
        onRightPress={() => navigation?.navigate('Wallet')}
      />

      {/* ── Carte Solde ── */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <Text style={styles.balanceLabel}>SOLDE DISPONIBLE</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>
              {balance >= 50000 ? '💎 Diamond' : balance >= 20000 ? '🥇 Gold' : '🥉 Bronze'}
            </Text>
          </View>
        </View>
        <Text style={styles.balanceAmount}>
          {balance.toLocaleString('fr-FR')} <Text style={styles.currency}>FCFA</Text>
        </Text>
        <Text style={styles.balanceSub}>Utilisable dans tous les établissements SOKORA</Text>

        {/* Actions wallet */}
        <View style={styles.walletActions}>
          <TouchableOpacity style={styles.walletBtn} onPress={() => setTopupModal(true)}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.orange} />
            <Text style={styles.walletBtnText}>Recharger</Text>
          </TouchableOpacity>
          <View style={styles.walletBtnDivider} />
          <TouchableOpacity style={styles.walletBtn} onPress={() => navigation?.navigate('Wallet')}>
            <Ionicons name="swap-horizontal-outline" size={18} color={Colors.teal} />
            <Text style={styles.walletBtnText}>Transférer</Text>
          </TouchableOpacity>
          <View style={styles.walletBtnDivider} />
          <TouchableOpacity style={styles.walletBtn} onPress={() => navigation?.navigate('PremiumProfile')}>
            <Ionicons name="diamond-outline" size={18} color={Colors.gold} />
            <Text style={styles.walletBtnText}>VIP</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Générateur de code marchand ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💳 Payer un marchand</Text>
        <Text style={styles.sectionSub}>Générez un code unique pour payer à distance</Text>

        {/* Montant */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Montant (FCFA)</Text>
          <View style={styles.amountInputRow}>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={Colors.textFaint}
              value={amount}
              onChangeText={v => setAmount(v.replace(/\D/g, ''))}
              keyboardType="numeric"
            />
            <Text style={styles.amountCurrency}>F</Text>
          </View>
          {/* Montants rapides */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
            {QUICK_AMOUNTS.map(a => (
              <TouchableOpacity
                key={a}
                style={[styles.quickChip, amount === String(a) && styles.quickChipActive]}
                onPress={() => setAmount(String(a))}
              >
                <Text style={[styles.quickChipText, amount === String(a) && { color: '#fff' }]}>
                  {a.toLocaleString('fr-FR')} F
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Méthode de paiement */}
        <View style={styles.methodsSection}>
          <Text style={styles.methodsLabel}>Méthode de paiement</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.methodChip, payMethod === m.id && { borderColor: m.color, backgroundColor: m.color + '12' }]}
                onPress={() => setPayMethod(m.id)}
              >
                <Text style={{ fontSize: 18 }}>{m.emoji}</Text>
                <Text style={[styles.methodChipText, payMethod === m.id && { color: m.color }]}>{m.label}</Text>
                {payMethod === m.id && (
                  <Ionicons name="checkmark-circle" size={14} color={m.color} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Bouton générer */}
        <TouchableOpacity
          style={[styles.generateBtn, (!amount || generating) && { opacity: 0.6 }]}
          onPress={generateCode}
          disabled={!amount || generating}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.generateBtnText}>Générer le code de paiement</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Code généré ── */}
      {merchantCode && (
        <Animated.View style={[styles.codeCard, { transform: [{ scale: pulseAnim }], opacity: fadeAnim }]}>
          <View style={styles.codeCardHeader}>
            <Text style={styles.codeCardTitle}>✅ Code de paiement</Text>
            <View style={[
              styles.codeTimer,
              { backgroundColor: countdown > 15 ? Colors.green : Colors.red },
            ]}>
              <Text style={styles.codeTimerText}>{countdown}s</Text>
            </View>
          </View>

          {/* Barre de progression */}
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              backgroundColor: countdown > 15 ? Colors.green : Colors.red,
            }]} />
          </View>

          {/* Montant */}
          <View style={styles.codeAmountRow}>
            <Text style={styles.codeAmountLabel}>Montant :</Text>
            <Text style={styles.codeAmount}>{merchantCode.amount.toLocaleString('fr-FR')} FCFA</Text>
          </View>

          {/* Code USSD */}
          <View style={styles.ussdBox}>
            <Text style={styles.ussdTitle}>
              {method.emoji} Code {method.label}
            </Text>
            <Text style={styles.ussdCode}>{merchantCode.ussdCode}</Text>
            <Text style={styles.ussdHint}>
              {payMethod === 'wallet'
                ? 'Montrez ce QR code au caissier'
                : 'Composez ce code sur votre téléphone ou donnez-le au marchand'}
            </Text>
          </View>

          {/* QR code (pour wallet SOKORA) */}
          {payMethod === 'wallet' && (
            <View style={styles.qrContainer}>
              <QRCode
                value={`SOKORA_PAY:${merchantCode.code}:${merchantCode.amount}`}
                size={160}
                color={Colors.navy}
                backgroundColor="#fff"
              />
            </View>
          )}

          {/* Actions */}
          <View style={styles.codeActions}>
            <TouchableOpacity style={styles.codeActionBtn} onPress={copyCode}>
              <Ionicons name="copy-outline" size={18} color={Colors.navy} />
              <Text style={styles.codeActionText}>Copier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.codeActionBtn} onPress={shareCode}>
              <Ionicons name="share-outline" size={18} color={Colors.navy} />
              <Text style={styles.codeActionText}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.codeActionBtn, styles.codeActionBtnNew]}
              onPress={() => { setCode(null); setAmount(''); }}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={[styles.codeActionText, { color: '#fff' }]}>Nouveau</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── Historique récent ── */}
      {txHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transactions récentes</Text>
          {txHistory.slice(0, 5).map((tx, i) => (
            <View key={tx.id || i} style={styles.txRow}>
              <View style={[styles.txIcon, { backgroundColor: tx.amount > 0 ? Colors.greenPale : Colors.orangePale }]}>
                <Ionicons
                  name={tx.amount > 0 ? 'arrow-down' : 'arrow-up'}
                  size={18}
                  color={tx.amount > 0 ? Colors.green : Colors.orange}
                />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txDesc} numberOfLines={1}>{tx.description || 'Transaction'}</Text>
                <Text style={styles.txDate}>
                  {new Date(tx.created_at || Date.now()).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={[styles.txAmount, { color: tx.amount > 0 ? Colors.green : Colors.red }]}>
                {tx.amount > 0 ? '+' : ''}{(tx.amount || 0).toLocaleString('fr-FR')} F
              </Text>
            </View>
          ))}
          <TouchableOpacity style={styles.seeAllBtn} onPress={() => navigation?.navigate('Wallet')}>
            <Text style={styles.seeAllText}>Voir tout l'historique →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Modal Recharge ── */}
      <Modal visible={topupModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTopupModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Recharger mon wallet</Text>
            <TouchableOpacity onPress={() => setTopupModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.lg }}>
            <Text style={styles.topupBalance}>
              Solde actuel : {balance.toLocaleString('fr-FR')} FCFA
            </Text>

            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Montant à recharger</Text>
              <View style={styles.amountInputRow}>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={Colors.textFaint}
                  value={topupAmount}
                  onChangeText={v => setTopupAmt(v.replace(/\D/g, ''))}
                  keyboardType="numeric"
                  autoFocus
                />
                <Text style={styles.amountCurrency}>F</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
                {[2000, 5000, 10000, 25000, 50000].map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.quickChip, topupAmount === String(a) && styles.quickChipActive]}
                    onPress={() => setTopupAmt(String(a))}
                  >
                    <Text style={[styles.quickChipText, topupAmount === String(a) && { color: '#fff' }]}>
                      {a.toLocaleString('fr-FR')} F
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {PAYMENT_METHODS.filter(m => m.id !== 'wallet').map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.topupMethodRow, { borderColor: m.color + '40' }]}
                onPress={async () => {
                  try {
                    await walletService.requestTopup({ amount: parseInt(topupAmount, 10), method: m.id });
                    Alert.alert('✅ Demande envoyée', `Suivez les instructions ${m.label} pour finaliser.`);
                    setTopupModal(false);
                    setTopupAmt('');
                  } catch {
                    Alert.alert('Erreur', 'Réessayez plus tard');
                  }
                }}
              >
                <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.topupMethodName, { color: m.color }]}>{m.label}</Text>
                  <Text style={styles.topupMethodSub}>Recharge instantanée</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={m.color} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  // Header
  header: {
    backgroundColor: Colors.navy,
    paddingTop: 54, paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { padding: Spacing.sm, marginRight: Spacing.sm },
  headerTitle: { flex: 1, fontSize: Typography.xl, fontWeight: '800', color: '#fff', textAlign: 'center' },
  headerAction: { padding: Spacing.sm },

  // Balance Card
  balanceCard: {
    margin: Spacing.lg,
    backgroundColor: Colors.navy,
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    ...Shadow.lg,
  },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  balanceLabel: { fontSize: Typography.xs, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1 },
  tierBadge: {
    backgroundColor: Colors.gold + '25',
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.gold + '60',
  },
  tierText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.gold },
  balanceAmount: { fontSize: Typography['4xl'], fontWeight: '900', color: '#fff' },
  currency: { fontSize: Typography.lg, fontWeight: '400' },
  balanceSub: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.4)', marginTop: 4, marginBottom: Spacing.lg },

  walletActions: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.lg, padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  walletBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.sm },
  walletBtnText: { fontSize: Typography.xs, fontWeight: '600', color: '#fff' },
  walletBtnDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Section
  section: {
    margin: Spacing.lg, marginTop: 0,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl, padding: Spacing.xl,
    ...Shadow.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: Typography.md, fontWeight: '800', color: Colors.navy, marginBottom: 4 },
  sectionSub: { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: Spacing.lg },

  // Amount
  amountBox: { gap: Spacing.sm, marginBottom: Spacing.lg },
  amountLabel: { fontSize: Typography.sm, fontWeight: '600', color: Colors.text },
  amountInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: Colors.orange,
    paddingBottom: Spacing.sm,
  },
  amountInput: { flex: 1, fontSize: Typography['3xl'], fontWeight: '800', color: Colors.navy },
  amountCurrency: { fontSize: Typography.xl, fontWeight: '600', color: Colors.textMuted },
  quickRow: { marginTop: Spacing.sm },
  quickChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, marginRight: Spacing.sm,
    backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
  },
  quickChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  quickChipText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textMuted },

  // Methods
  methodsSection: { marginBottom: Spacing.lg, gap: Spacing.sm },
  methodsLabel: { fontSize: Typography.sm, fontWeight: '600', color: Colors.text },
  methodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  methodChipText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textMuted },

  // Generate button
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.orange,
    borderRadius: Radius.xl, paddingVertical: Spacing.md + 2,
    ...Shadow.orange,
  },
  generateBtnText: { fontSize: Typography.md, fontWeight: '800', color: '#fff' },

  // Code Card
  codeCard: {
    margin: Spacing.lg, marginTop: 0,
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    borderWidth: 2, borderColor: Colors.green,
    ...Shadow.lg,
  },
  codeCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  codeCardTitle: { fontSize: Typography.md, fontWeight: '800', color: Colors.navy },
  codeTimer: {
    paddingHorizontal: Spacing.md, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  codeTimerText: { fontSize: Typography.md, fontWeight: '800', color: '#fff' },

  progressBarBg: { height: 4, backgroundColor: Colors.border, borderRadius: 2, marginBottom: Spacing.lg },
  progressBarFill: { height: 4, borderRadius: 2 },

  codeAmountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  codeAmountLabel: { fontSize: Typography.sm, color: Colors.textMuted },
  codeAmount: { fontSize: Typography.lg, fontWeight: '800', color: Colors.navy },

  ussdBox: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg, padding: Spacing.lg,
    alignItems: 'center', marginBottom: Spacing.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.orange,
  },
  ussdTitle: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textMuted, marginBottom: Spacing.sm },
  ussdCode: { fontSize: Typography['2xl'], fontWeight: '900', color: Colors.navy, letterSpacing: 1, textAlign: 'center' },
  ussdHint: { fontSize: Typography.xs, color: Colors.textFaint, marginTop: Spacing.sm, textAlign: 'center' },

  qrContainer: {
    alignItems: 'center', marginVertical: Spacing.md,
    padding: Spacing.md, backgroundColor: '#fff',
    borderRadius: Radius.lg, ...Shadow.sm,
    alignSelf: 'center',
  },

  codeActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  codeActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
  },
  codeActionBtnNew: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  codeActionText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.navy },

  // Transactions
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  txIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: Typography.sm, fontWeight: '600', color: Colors.text },
  txDate: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  txAmount: { fontSize: Typography.sm, fontWeight: '700' },
  seeAllBtn: { marginTop: Spacing.md, alignItems: 'center' },
  seeAllText: { fontSize: Typography.sm, color: Colors.orange, fontWeight: '700' },

  // Modal Recharge
  modalContainer: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.xl, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: Typography.xl, fontWeight: '800', color: Colors.navy },
  topupBalance: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  topupMethodRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1.5,
    ...Shadow.sm,
  },
  topupMethodName: { fontSize: Typography.md, fontWeight: '700' },
  topupMethodSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
});
