import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ordersService, paymentsService } from '../../services/api';
import { Colors, Spacing, Radius, Shadow, Typography, OrderStatus, getOrderStatus } from '../../utils/constants';

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';
const fmtDate = d => new Date(d).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const PAYMENT_METHODS = [
  { id: 'cash',        label: 'Espèces',      icon: 'cash-outline',        color: Colors.green },
  { id: 'wave',        label: 'Wave',          icon: 'phone-portrait-outline', color: '#1A8CFF' },
  { id: 'orange_money',label: 'Orange Money', icon: 'phone-portrait-outline', color: '#FF6B00' },
  { id: 'mtn',         label: 'MTN Money',    icon: 'phone-portrait-outline', color: '#FFC300' },
  { id: 'card',        label: 'Carte',         icon: 'card-outline',        color: Colors.purple },
];

export default function OrderDetailScreen({ navigation, route }) {
  const { orderId, isNew } = route.params || {};
  const [order,      setOrder]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [paying,     setPaying]     = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod,  setPayMethod]  = useState('cash');
  const [refreshing, setRefreshing] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const { data } = await ordersService.getById(orderId);
      setOrder(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la commande.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => {
    loadOrder();
    const interval = setInterval(loadOrder, 20000);
    return () => clearInterval(interval);
  }, [loadOrder]));

  const total = order
    ? (order.items || []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
    : 0;

  // Normalise le statut backend (UPPERCASE) en lowercase pour les comparaisons
  const status = (order?.status || 'open').toLowerCase();

  const handlePayment = async () => {
    setPaying(true);
    try {
      await paymentsService.process({
        order_id: order.id,
        amount: total,
        method: payMethod,
      });
      setShowPayModal(false);
      Alert.alert('✅ Paiement enregistré', `Table libérée — ${fmt(total)} encaissé`, [
        { text: 'OK', onPress: () => navigation.navigate('Home') }
      ]);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.detail || 'Paiement impossible.');
    } finally {
      setPaying(false);
    }
  };

  const handleSendToKitchen = async () => {
    try {
      await ordersService.updateStatus(order.id, 'sent');
      await loadOrder();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer en cuisine.');
    }
  };

  const handleShareBill = async () => {
    const lines = [
      `🧾 SOKORA — Facture`,
      `Table ${order.table_id} — Commande #${order.id}`,
      `─────────────────`,
      ...(order.items || []).map(i => `${i.product_name || 'Article'} × ${i.quantity}   ${fmt(i.unit_price * i.quantity)}`),
      `─────────────────`,
      `TOTAL : ${fmt(total)}`,
      `\nMerci de votre visite !`,
    ];
    await Share.share({ message: lines.join('\n') });
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={Colors.orange} />
    </View>
  );

  if (!order) return null;

  const st = getOrderStatus(order.status);
  const canPay      = status !== 'paid' && status !== 'cancelled';
  const canAddItems = status === 'open';

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.surface} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Commande #{order.id}</Text>
          <Text style={styles.headerSub}>Table {order.table_id} · {fmtDate(order.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

        {/* ALERTE SI NOUVEAU */}
        {isNew && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.green} />
            <Text style={styles.successText}>Commande créée avec succès !</Text>
          </View>
        )}

        {/* ARTICLES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Articles commandés</Text>
            {canAddItems && (
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => navigation.navigate('NewOrder', { table: { id: order.table_id, number: order.table_id }, addToOrder: order.id })}
              >
                <Ionicons name="add" size={16} color={Colors.orange} />
                <Text style={styles.addItemBtnText}>Ajouter</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.itemsCard}>
            {(order.items || []).map((item, i) => (
              <View key={i} style={[styles.itemRow, i > 0 && styles.itemRowBorder]}>
                <View style={styles.itemQtyBadge}>
                  <Text style={styles.itemQty}>{item.quantity}</Text>
                </View>
                <Text style={styles.itemName}>{item.product_name || `Article #${item.product_id}`}</Text>
                <View style={styles.itemRight}>
                  <Text style={styles.itemPrice}>{fmt(item.unit_price * item.quantity)}</Text>
                  <Text style={styles.itemUnitPrice}>{fmt(item.unit_price)} / u</Text>
                </View>
              </View>
            ))}

            {/* TOTAL */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>{fmt(total)}</Text>
            </View>
          </View>
        </View>

        {/* NOTE */}
        {order.notes && (
          <View style={styles.section}>
            <View style={styles.noteCard}>
              <Ionicons name="chatbubble-outline" size={16} color={Colors.teal} />
              <Text style={styles.noteText}>{order.notes}</Text>
            </View>
          </View>
        )}

        {/* ACTIONS */}
        {canPay && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionsRow}>
              {status === 'open' && (
                <TouchableOpacity style={styles.actionBtn} onPress={handleSendToKitchen}>
                  <Ionicons name="flame-outline" size={20} color={Colors.purple} />
                  <Text style={[styles.actionBtnText, { color: Colors.purple }]}>En cuisine</Text>
                </TouchableOpacity>
              )}
              {(status === 'sent' || status === 'in_progress') && (
                <View style={[styles.actionBtn, { backgroundColor: Colors.purplePale, borderColor: Colors.purple + '44' }]}>
                  <Ionicons name="time-outline" size={20} color={Colors.purple} />
                  <Text style={[styles.actionBtnText, { color: Colors.purple }]}>
                    {status === 'sent' ? 'En cuisine' : 'En préparation'}
                  </Text>
                </View>
              )}
              {status === 'ready' && (
                <View style={[styles.actionBtn, { backgroundColor: Colors.greenPale, borderColor: Colors.green + '44' }]}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.green} />
                  <Text style={[styles.actionBtnText, { color: Colors.green }]}>Prêt à servir</Text>
                </View>
              )}
              <TouchableOpacity style={styles.actionBtn} onPress={handleShareBill}>
                <Ionicons name="share-outline" size={20} color={Colors.teal} />
                <Text style={[styles.actionBtnText, { color: Colors.teal }]}>Partager facture</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() => setShowPayModal(true)}
              >
                <Ionicons name="checkmark-done-outline" size={20} color={Colors.surface} />
                <Text style={[styles.actionBtnText, { color: Colors.surface }]}>Encaisser</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PAYÉE */}
        {status === 'paid' && (
          <View style={styles.paidBanner}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.teal} />
            <Text style={styles.paidText}>Commande payée</Text>
            <Text style={styles.paidAmount}>{fmt(total)}</Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* MODAL PAIEMENT */}
      {showPayModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Encaissement</Text>
              <TouchableOpacity onPress={() => setShowPayModal(false)}>
                <Ionicons name="close" size={24} color={Colors.navy} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTotal}>{fmt(total)}</Text>

            <Text style={styles.modalLabel}>Mode de paiement</Text>
            <View style={styles.payMethods}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.payMethod, payMethod === m.id && { borderColor: m.color, backgroundColor: m.color + '15' }]}
                  onPress={() => setPayMethod(m.id)}
                >
                  <Ionicons name={m.icon} size={20} color={payMethod === m.id ? m.color : Colors.textMuted} />
                  <Text style={[styles.payMethodText, payMethod === m.id && { color: m.color, fontWeight: '700' }]}>
                    {m.label}
                  </Text>
                  {payMethod === m.id && (
                    <Ionicons name="checkmark-circle" size={16} color={m.color} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.confirmPayBtn, paying && { opacity: 0.7 }]}
              onPress={handlePayment}
              disabled={paying}
            >
              {paying
                ? <ActivityIndicator color={Colors.surface} />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={22} color={Colors.surface} />
                    <Text style={styles.confirmPayBtnText}>Confirmer le paiement</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.navy,
    paddingTop: 54, paddingBottom: 16,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: Typography.xl, fontWeight: '800', color: Colors.surface },
  headerSub: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: Typography.xs, fontWeight: '700' },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.greenPale, margin: Spacing.xl,
    borderRadius: Radius.md, padding: Spacing.md,
    borderLeftWidth: 4, borderLeftColor: Colors.green,
  },
  successText: { fontSize: Typography.sm, color: Colors.green, fontWeight: '600' },
  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.navy },
  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.orangePale, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addItemBtnText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.orange },
  itemsCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md,
  },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  itemQtyBadge: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.orangePale, alignItems: 'center', justifyContent: 'center',
  },
  itemQty: { fontSize: Typography.sm, fontWeight: '800', color: Colors.orange },
  itemName: { flex: 1, fontSize: Typography.base, color: Colors.navy, fontWeight: '500' },
  itemRight: { alignItems: 'flex-end' },
  itemPrice: { fontSize: Typography.base, fontWeight: '800', color: Colors.navy },
  itemUnitPrice: { fontSize: Typography.xs, color: Colors.textFaint, marginTop: 1 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.navy, borderTopWidth: 1, borderTopColor: Colors.navyLight,
  },
  totalLabel: { fontSize: Typography.base, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  totalAmount: { fontSize: Typography['2xl'], fontWeight: '800', color: Colors.orangeLight },
  noteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.tealPale, borderRadius: Radius.md,
    padding: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.teal,
  },
  noteText: { flex: 1, fontSize: Typography.sm, color: Colors.navy },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  actionBtn: {
    flex: 1, minWidth: 100,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: Spacing.md,
    alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.orange, borderColor: Colors.orange, ...Shadow.orange,
  },
  actionBtnText: { fontSize: Typography.sm, fontWeight: '700', textAlign: 'center' },
  paidBanner: {
    margin: Spacing.xl, backgroundColor: Colors.tealPale,
    borderRadius: Radius.xl, padding: Spacing.xl,
    alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.teal + '44',
  },
  paidText: { fontSize: Typography.lg, fontWeight: '700', color: Colors.teal },
  paidAmount: { fontSize: Typography['2xl'], fontWeight: '800', color: Colors.navy },
  modalOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(26,46,74,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
    padding: Spacing['2xl'], paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: Typography.xl, fontWeight: '800', color: Colors.navy },
  modalTotal: {
    fontSize: Typography['4xl'], fontWeight: '800', color: Colors.orange,
    textAlign: 'center', marginBottom: Spacing.xl,
  },
  modalLabel: {
    fontSize: Typography.xs, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md,
  },
  payMethods: { gap: Spacing.sm, marginBottom: Spacing.xl },
  payMethod: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bg, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border,
  },
  payMethodText: { flex: 1, fontSize: Typography.base, color: Colors.textMuted },
  confirmPayBtn: {
    backgroundColor: Colors.orange, borderRadius: Radius.xl,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    ...Shadow.orange,
  },
  confirmPayBtnText: { fontSize: Typography.md, fontWeight: '700', color: Colors.surface },
});
