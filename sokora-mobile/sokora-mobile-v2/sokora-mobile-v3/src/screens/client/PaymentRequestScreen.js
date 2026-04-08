/**
 * PaymentRequestScreen — SOKORA Client
 * Affiché quand le client scanne le QR de paiement du serveur.
 * Flow: scan QR → voir facture → choisir méthode → payer → confirmation
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';
import { API_URL } from '../../utils/constants';
import * as SecureStore from 'expo-secure-store';
import ScreenHeader from '../../components/ScreenHeader';

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

const METHODS = [
  { key: 'wallet',       label: 'Wallet SOKORA',  icon: 'wallet',            color: Colors.teal,   needsAuth: true  },
  { key: 'orange_money', label: 'Orange Money',   icon: 'phone-portrait',    color: '#F97316',     needsAuth: false },
  { key: 'wave',         label: 'Wave',           icon: 'phone-portrait',    color: '#0EA5E9',     needsAuth: false },
  { key: 'mtn_money',    label: 'MTN MoMo',       icon: 'phone-portrait',    color: '#FACC15',     needsAuth: false },
  { key: 'cash',         label: 'Espèces',        icon: 'cash',              color: Colors.green,  needsAuth: false },
];

const getClientToken = async () => {
  try {
    if (Platform.OS === 'web') return localStorage.getItem('sokora_client_token');
    return await SecureStore.getItemAsync('sokora_client_token');
  } catch { return null; }
};

export default function PaymentRequestScreen({ route, navigation }) {
  const { token } = route.params || {};

  const [request,     setRequest]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [method,      setMethod]      = useState('wallet');
  const [clientPhone, setClientPhone] = useState('');
  const [paying,      setPaying]      = useState(false);
  const [paid,        setPaid]        = useState(false);
  const [result,      setResult]      = useState(null);

  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!token) { setError('Token manquant'); setLoading(false); return; }
    fetch(`${API_URL}/payment-requests/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.detail) { setError(d.detail); setLoading(false); return; }
        setRequest(d);
        setLoading(false);
      })
      .catch(() => { setError('Erreur réseau'); setLoading(false); });
  }, [token]);

  const handlePay = async () => {
    if (!request) return;
    if (method !== 'cash' && method !== 'wallet' && !clientPhone.trim()) {
      Alert.alert('Numéro requis', 'Entrez votre numéro de téléphone pour ce mode de paiement');
      return;
    }

    setPaying(true);
    try {
      const clientToken = await getClientToken();
      const headers = { 'Content-Type': 'application/json' };
      if (clientToken) headers['X-Client-Token'] = clientToken;

      const res = await fetch(`${API_URL}/payment-requests/${token}/pay`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ method, client_phone: clientPhone }),
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Paiement refusé', data.detail || 'Erreur lors du paiement');
        setPaying(false);
        return;
      }

      setResult(data);
      setPaid(true);
      Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, tension: 60 }).start();
    } catch {
      Alert.alert('Erreur réseau', 'Vérifiez votre connexion et réessayez');
    } finally {
      setPaying(false);
    }
  };

  // ── États loading / error ─────────────────────────────────────────────────
  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.orange} />
      <Text style={styles.loadText}>Chargement de la facture…</Text>
    </View>
  );

  if (error) return (
    <View style={styles.center}>
      <Ionicons name="alert-circle" size={48} color={Colors.red} />
      <Text style={styles.errorTitle}>QR Invalide</Text>
      <Text style={styles.errorSub}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.retryBtnText}>Retour</Text>
      </TouchableOpacity>
    </View>
  );

  if (request?.status === 'paid') return (
    <View style={styles.center}>
      <Ionicons name="checkmark-circle" size={64} color={Colors.green} />
      <Text style={[styles.errorTitle, { color: Colors.green }]}>Déjà payée</Text>
      <Text style={styles.errorSub}>Cette facture a été réglée.</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.retryBtnText}>Fermer</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Écran de succès ───────────────────────────────────────────────────────
  if (paid && result) return (
    <View style={styles.successScreen}>
      <Animated.View style={[styles.successCard, { transform: [{ scale: successAnim }] }]}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={44} color="#fff" />
        </View>
        <Text style={styles.successTitle}>Paiement effectué !</Text>
        <Text style={styles.successAmount}>{fmt(result.amount_paid)}</Text>
        <Text style={styles.successEst}>{result.establishment}</Text>
        <Text style={styles.successRef}>Réf: {result.reference}</Text>
        {result.cashback > 0 && (
          <View style={styles.cashbackBadge}>
            <Ionicons name="gift" size={14} color={Colors.green} />
            <Text style={styles.cashbackText}>+{fmt(result.cashback)} cashback crédité !</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.doneBtnText}>Fermer</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  // ── Écran principal ───────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <ScreenHeader
        navigation={navigation}
        title="Demande de paiement"
        subtitle={request.table_number ? `${request.establishment_name} · Table ${request.table_number}` : request.establishment_name}
        dark={true}
      />

      {/* Détail facture */}
      <View style={styles.receiptCard}>
        <Text style={styles.sectionTitle}>Détail de la commande</Text>
        {(request.items || []).map((item, i) => (
          <View key={i} style={styles.lineItem}>
            <Text style={styles.lineQty}>{item.qty}×</Text>
            <Text style={styles.lineName}>{item.product_name}</Text>
            <Text style={styles.linePrice}>{fmt(item.line_total)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalAmount}>{fmt(request.total_amount)}</Text>
        </View>
      </View>

      {/* Méthode de paiement */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mode de paiement</Text>
        {METHODS.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[styles.methodRow, method === m.key && styles.methodSelected]}
            onPress={() => setMethod(m.key)}
            activeOpacity={0.75}
          >
            <View style={[styles.methodIcon, { backgroundColor: m.color + '20' }]}>
              <Ionicons name={m.icon} size={20} color={m.color} />
            </View>
            <Text style={[styles.methodLabel, method === m.key && { color: Colors.navy, fontWeight: '700' }]}>
              {m.label}
            </Text>
            {method === m.key && (
              <Ionicons name="checkmark-circle" size={20} color={m.color} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Champ téléphone pour mobile money */}
      {['orange_money', 'wave', 'mtn_money'].includes(method) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Numéro {METHODS.find(m2 => m2.key === method)?.label}</Text>
          <TextInput
            style={styles.phoneInput}
            value={clientPhone}
            onChangeText={setClientPhone}
            placeholder="+225 07 00 00 00 00"
            placeholderTextColor={Colors.textFaint}
            keyboardType="phone-pad"
          />
        </View>
      )}

      {/* Bouton payer */}
      <TouchableOpacity
        style={[styles.payBtn, paying && { opacity: 0.75 }]}
        onPress={handlePay}
        disabled={paying}
        activeOpacity={0.85}
      >
        {paying
          ? <ActivityIndicator color="#fff" />
          : <>
              <Ionicons name="lock-closed" size={20} color="#fff" />
              <Text style={styles.payBtnText}>Payer {fmt(request.total_amount)}</Text>
            </>
        }
      </TouchableOpacity>

      <Text style={styles.footerNote}>
        Paiement sécurisé • SOKORA © 2026
      </Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bg, padding: 32,
  },
  loadText:   { marginTop: 16, color: Colors.textMuted, fontSize: Typography.base },
  errorTitle: { fontSize: Typography.xl, fontWeight: '800', color: Colors.navy, marginTop: 16 },
  errorSub:   { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
  retryBtn: {
    marginTop: 24, backgroundColor: Colors.orange, borderRadius: Radius.lg,
    paddingHorizontal: 32, paddingVertical: 12,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, paddingHorizontal: 16,
    paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerInfo: { flex: 1 },
  headerEst:   { fontSize: Typography.lg, fontWeight: '700', color: Colors.navy },
  headerTable: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },
  statusBadge: {
    backgroundColor: Colors.orangePale, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  statusPending: { backgroundColor: Colors.orangePale },
  statusText: { fontSize: Typography.xs, color: Colors.orange, fontWeight: '700' },

  receiptCard: {
    backgroundColor: Colors.surface, margin: 16, borderRadius: Radius.xl,
    padding: 20, ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.xs, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  lineItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  lineQty:  { width: 28, fontSize: Typography.sm, color: Colors.textMuted, fontWeight: '700' },
  lineName: { flex: 1, fontSize: Typography.base, color: Colors.text },
  linePrice: { fontSize: Typography.base, fontWeight: '700', color: Colors.navy },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1.5, borderTopColor: Colors.border,
  },
  totalLabel:  { fontSize: Typography.sm, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1 },
  totalAmount: { fontSize: Typography['2xl'], fontWeight: '800', color: Colors.navy },

  section: {
    backgroundColor: Colors.surface, marginHorizontal: 16, marginBottom: 12,
    borderRadius: Radius.xl, padding: 20, ...Shadow.sm,
  },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderRadius: Radius.md, paddingHorizontal: 8, marginBottom: 4,
  },
  methodSelected: { backgroundColor: Colors.bg },
  methodIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  methodLabel: { flex: 1, fontSize: Typography.base, color: Colors.textMuted },

  phoneInput: {
    backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: Typography.base, color: Colors.text,
  },

  payBtn: {
    backgroundColor: Colors.orange, borderRadius: Radius.xl,
    paddingVertical: 18, marginHorizontal: 16, marginTop: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    ...Shadow.orange,
  },
  payBtnText: { fontSize: Typography.lg, fontWeight: '800', color: '#fff' },
  footerNote: {
    textAlign: 'center', fontSize: Typography.xs, color: Colors.textFaint,
    marginTop: 16,
  },

  // ── Succès ─────────────────────────────────────────────────────────────────
  successScreen: {
    flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  successCard: {
    backgroundColor: Colors.surface, borderRadius: Radius['2xl'],
    padding: 32, margin: 24, alignItems: 'center', ...Shadow.lg,
  },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle:  { fontSize: Typography['2xl'], fontWeight: '800', color: Colors.navy },
  successAmount: { fontSize: Typography['3xl'], fontWeight: '800', color: Colors.orange, marginTop: 8 },
  successEst:    { fontSize: Typography.base, color: Colors.textMuted, marginTop: 8 },
  successRef:    { fontSize: Typography.xs, color: Colors.textFaint, marginTop: 4, fontFamily: 'monospace' },
  cashbackBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.greenPale, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 6, marginTop: 16,
  },
  cashbackText: { fontSize: Typography.sm, color: Colors.green, fontWeight: '700' },
  doneBtn: {
    backgroundColor: Colors.orange, borderRadius: Radius.lg,
    paddingHorizontal: 40, paddingVertical: 14, marginTop: 24, ...Shadow.orange,
  },
  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: Typography.base },
});
