import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Share,
  Modal, TextInput, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ordersService, paymentsService, walletService } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { Colors, Spacing, Radius, Shadow, Typography, OrderStatus } from '../../utils/constants';
import { checkConnectivity, enqueueAction } from '../../services/offlineQueue';

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';
const fmtDate = d => new Date(d).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const PAYMENT_METHODS = [
  { id: 'cash',         label: 'Espèces',      icon: 'cash-outline',           color: '#22C55E' },
  { id: 'wave',         label: 'Wave',          icon: 'phone-portrait-outline', color: '#1A8CFF' },
  { id: 'orange_money', label: 'Orange Money',  icon: 'phone-portrait-outline', color: '#FF6B00' },
  { id: 'mtn_money',    label: 'MTN Money',     icon: 'phone-portrait-outline', color: '#FFC300' },
  { id: 'card',         label: 'Carte',         icon: 'card-outline',           color: '#8B5CF6' },
  { id: 'wallet',       label: 'Wallet SOKORA', icon: 'wallet-outline',         color: '#14B8A6' },
  { id: 'credit',       label: 'A credit',      icon: 'time-outline',           color: '#6366F1' },
];

export default function OrderDetailScreen({ navigation, route }) {
  const { orderId, isNew } = route.params || {};
  const { user } = useAuth();
  const [order,        setOrder]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [paying,       setPaying]       = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod,    setPayMethod]    = useState('cash');
  const [walletPhone,  setWalletPhone]  = useState('');
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletChecking, setWalletChecking] = useState(false);
  const [creditPhone, setCreditPhone] = useState('');
  const [creditName, setCreditName] = useState('');

  // WhatsApp modal
  const [showWAModal,  setShowWAModal]  = useState(false);
  const [clientPhone,  setClientPhone]  = useState('');

  const loadOrder = useCallback(async () => {
    try {
      const { data } = await ordersService.getById(orderId);
      setOrder(data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la commande.');
    } finally {
      setLoading(false);
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

  // Vérifier solde wallet client
  const checkWalletBalance = async (phone) => {
    if (!phone || phone.length < 8) { setWalletBalance(null); return; }
    setWalletChecking(true);
    try {
      const { data } = await walletService.checkClientBalance(phone);
      setWalletBalance(data?.balance ?? data);
    } catch { setWalletBalance(null); }
    finally { setWalletChecking(false); }
  };

  const handlePayment = async () => {
    // Paiement wallet
    if (payMethod === 'wallet') {
      if (!walletPhone) { Alert.alert('Numéro requis', 'Entrez le numéro du client pour payer via Wallet.'); return; }
      if (walletBalance !== null && walletBalance < total) {
        Alert.alert('Solde insuffisant', `Solde wallet: ${fmt(walletBalance)}\nTotal commande: ${fmt(total)}`);
        return;
      }
      setPaying(true);
      try {
        await walletService.payWithWallet({ order_id: order.id, establishment_id: user?.establishment_id, amount: total, client_phone: walletPhone });
        setShowPayModal(false);
        Alert.alert('Paiement Wallet ✓', `${fmt(total)} débité du Wallet de ${walletPhone}`, [
          { text: 'OK', onPress: () => navigation.navigate('Home') }
        ]);
      } catch (err) {
        const detail = err.response?.data?.detail;
        Alert.alert('Erreur', typeof detail === 'string' ? detail : 'Paiement wallet impossible.');
      } finally { setPaying(false); }
      return;
    }

    // Paiement a credit - validation
    if (payMethod === 'credit') {
      if (!creditPhone) { Alert.alert('Numéro requis', 'Entrez le numéro du client pour créer l\'ardoise.'); return; }
      if (!creditName)  { Alert.alert('Nom requis', 'Entrez le nom du client pour créer l\'ardoise.'); return; }
    }

    // Paiement classique
    setPaying(true);
    try {
      await paymentsService.process({
        order_id: order.id,
        amount: total,
        method: payMethod.toUpperCase(),
        client_phone: payMethod === 'credit' ? creditPhone : undefined,
        client_name: payMethod === 'credit' ? creditName : undefined,
      });
      setShowPayModal(false);
      const methodLabel = PAYMENT_METHODS.find(m => m.id === payMethod)?.label || payMethod;
      const creditMsg = payMethod === 'credit' ? `\nArdoise créée pour ${creditName} (${creditPhone})` : '';
      Alert.alert('Paiement enregistré', fmt(total) + ' encaissé via ' + methodLabel + creditMsg, [
        { text: 'OK', onPress: () => navigation.navigate('Home') }
      ]);
      setCreditPhone('');
      setCreditName('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
        : (typeof detail === 'string' ? detail : 'Paiement impossible.');
      Alert.alert('Erreur paiement', msg);
    } finally {
      setPaying(false);
    }
  };

  const handleSendToKitchen = async () => {
    const online = await checkConnectivity();
    if (!online) {
      await enqueueAction('UPDATE_STATUS', { orderId: order.id, status: 'SENT' });
      Alert.alert('📶 Hors-ligne', 'Statut sauvegardé — sera envoyé à la cuisine dès le retour de la connexion.');
      return;
    }
    try {
      await ordersService.updateStatus(order.id, 'SENT');
      await loadOrder();
    } catch {
      await enqueueAction('UPDATE_STATUS', { orderId: order.id, status: 'SENT' });
      Alert.alert('Sauvegardé hors-ligne', 'Le statut sera synchronisé automatiquement.');
    }
  };

  const [serving, setServing] = useState(false);
  const handleServe = async () => {
    setServing(true);
    const online = await checkConnectivity();
    if (!online) {
      await enqueueAction('UPDATE_STATUS', { orderId: order.id, status: 'SERVED' });
      Alert.alert('📶 Hors-ligne', 'Statut sauvegardé localement.');
      setServing(false);
      return;
    }
    try {
      await ordersService.updateStatus(order.id, 'SERVED');
      await loadOrder();
      Alert.alert('Servi !', 'Le plat a été servi au client.');
    } catch {
      await enqueueAction('UPDATE_STATUS', { orderId: order.id, status: 'SERVED' });
      Alert.alert('Sauvegardé hors-ligne', 'Le statut sera synchronisé automatiquement.');
    } finally {
      setServing(false);
    }
  };

  // Génère le texte de la facture
  const buildReceiptText = () => {
    const tableNum  = order.table_number || order.table_id;
    const estName   = user?.establishment_name || 'SOKORA';
    const now       = new Date();
    const dateStr   = now.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr   = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const itemLines = (order.items || []).map(
      i => `${i.product_name || 'Article'} x${i.quantity}   ${fmt(i.unit_price * i.quantity)}`
    );
    return [
      `🍽️ *${estName}*`,
      `📅 ${dateStr} à ${timeStr}`,
      `─────────────────`,
      `🧾 *Facture — Commande #${order.id}*`,
      `Table ${tableNum}`,
      ``,
      ...itemLines,
      `─────────────────`,
      `*TOTAL : ${fmt(total)}*`,
      ``,
      `Merci pour votre visite ! 🙏`,
      `_${estName} — Powered by SOKORA_`,
    ].join('\n');
  };

  // Partage natif (sans numéro)
  const handleShareBill = async () => {
    setShowWAModal(true);
  };

  // Envoi WhatsApp avec numéro
  const sendWhatsApp = async () => {
    // Normalisation numéro CI : 0XXXXXXXXX → 2250XXXXXXXXX
    let phone = clientPhone.replace(/\s/g, '').replace(/[^0-9+]/g, '');
    if (phone.startsWith('00')) {
      phone = phone.substring(2); // 00225... → 225...
    } else if (phone.startsWith('+')) {
      phone = phone.substring(1); // +225... → 225...
    } else if (phone.startsWith('0')) {
      phone = '225' + phone; // 07... → 22507...
    }
    // Si déjà en format international sans 225
    if (!phone.startsWith('225') && phone.length <= 10) {
      phone = '225' + phone;
    }
    const msg   = encodeURIComponent(buildReceiptText());
    const url   = `whatsapp://send?phone=${phone}&text=${msg}`;
    try {
      await Linking.openURL(url);
    } catch {
      // WhatsApp non dispo → partage natif
      await Share.share({ message: buildReceiptText() });
    }
    setShowWAModal(false);
    setClientPhone('');
  };

  // Partage natif sans WhatsApp
  const handleShareNative = async () => {
    await Share.share({ message: buildReceiptText() });
    setShowWAModal(false);
    setClientPhone('');
  };

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#F97316" />
    </View>
  );

  if (!order) return null;

  const st        = OrderStatus[order.status] || OrderStatus.open;
  const canPay    = !['paid','PAID','cancelled','CANCELLED'].includes(order.status);
  const canAddItems = order.status === 'open' || order.status === 'OPEN';
  const tableNum  = order.table_number || order.table_id;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Commande #{order.id}</Text>
          <Text style={styles.headerSub}>Table {tableNum} · {fmtDate(order.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {isNew && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            <Text style={styles.successText}>Commande créée avec succès !</Text>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Articles commandés</Text>
            {canAddItems && (
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => navigation.navigate('NewOrder', {
                  table: { id: order.table_id, number: tableNum },
                  addToOrder: order.id
                })}
              >
                <Ionicons name="add" size={16} color="#F97316" />
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
                <Text style={styles.itemName}>{item.product_name || ('Article #' + item.product_id)}</Text>
                <View style={styles.itemRight}>
                  <Text style={styles.itemPrice}>{fmt(item.unit_price * item.quantity)}</Text>
                  <Text style={styles.itemUnitPrice}>{fmt(item.unit_price)} / u</Text>
                </View>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>{fmt(total)}</Text>
            </View>
          </View>
        </View>

        {canPay && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionsRow}>
              {(order.status === 'open' || order.status === 'OPEN') && (
                <TouchableOpacity style={styles.actionBtn} onPress={handleSendToKitchen}>
                  <Ionicons name="flame-outline" size={20} color="#8B5CF6" />
                  <Text style={[styles.actionBtnText, { color: '#8B5CF6' }]}>En cuisine</Text>
                </TouchableOpacity>
              )}
              {(order.status === 'ready' || order.status === 'READY') && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#14B8A6' + '20', borderRadius: 10, padding: 10 }]}
                  onPress={handleServe}
                  disabled={serving}
                >
                  <Ionicons name="checkmark-done-outline" size={20} color="#14B8A6" />
                  <Text style={[styles.actionBtnText, { color: '#14B8A6', fontWeight: '700' }]}>
                    {serving ? 'En cours...' : 'Servir le client'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionBtn} onPress={handleShareBill}>
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                <Text style={[styles.actionBtnText, { color: '#25D366' }]}>Partager facture</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() => setShowPayModal(true)}
              >
                <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>Encaisser</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {(order.status === 'served' || order.status === 'SERVED') && (
          <View style={[styles.paidBanner, { backgroundColor: '#f0fdf4' }]}>
            <Ionicons name="restaurant-outline" size={28} color="#22C55E" />
            <Text style={[styles.paidText, { color: '#22C55E' }]}>Plat servi</Text>
            <Text style={[styles.paidAmount, { color: '#22C55E' }]}>En attente de paiement</Text>
          </View>
        )}
        {(order.status === 'paid' || order.status === 'PAID') && (
          <View style={styles.paidBanner}>
            <Ionicons name="checkmark-circle" size={28} color="#14B8A6" />
            <Text style={styles.paidText}>Commande payée</Text>
            <Text style={styles.paidAmount}>{fmt(total)}</Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── MODAL PAIEMENT ── */}
      {showPayModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Encaissement</Text>
              <TouchableOpacity onPress={() => setShowPayModal(false)}>
                <Ionicons name="close" size={24} color="#1A2E4A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalTotal}>{fmt(total)}</Text>
            <Text style={styles.modalLabel}>MODE DE PAIEMENT</Text>
            <View style={styles.payMethods}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.payMethod, payMethod === m.id && { borderColor: m.color, backgroundColor: m.color + '15' }]}
                  onPress={() => setPayMethod(m.id)}
                >
                  <Ionicons name={m.icon} size={20} color={payMethod === m.id ? m.color : '#94A3B8'} />
                  <Text style={[styles.payMethodText, payMethod === m.id && { color: m.color, fontWeight: '700' }]}>
                    {m.label}
                  </Text>
                  {payMethod === m.id && (
                    <Ionicons name="checkmark-circle" size={16} color={m.color} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {/* Champs ardoise si credit sélectionné */}
            {payMethod === 'credit' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.modalLabel, { marginBottom: 8 }]}>INFORMATIONS CLIENT ARDOISE</Text>
                <TextInput
                  style={[styles.walletInput, { marginBottom: 8 }]}
                  placeholder="Nom du client *"
                  value={creditName}
                  onChangeText={setCreditName}
                />
                <TextInput
                  style={styles.walletInput}
                  placeholder="Téléphone du client *"
                  keyboardType="phone-pad"
                  value={creditPhone}
                  onChangeText={setCreditPhone}
                />
                <Text style={{ fontSize: 11, color: '#6366F1', marginTop: 6 }}>
                  Une ardoise sera créée automatiquement pour ce client
                </Text>
              </View>
            )}

            {/* Champ téléphone si wallet sélectionné */}
            {payMethod === 'wallet' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.modalLabel, { marginBottom: 8 }]}>NUMÉRO CLIENT WALLET</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.walletInput, { flex: 1 }]}
                    placeholder="Ex: 0789844202"
                    keyboardType="phone-pad"
                    value={walletPhone}
                    onChangeText={(t) => { setWalletPhone(t); checkWalletBalance(t); }}
                  />
                  {walletChecking && <ActivityIndicator size="small" color='#14B8A6' />}
                </View>
                {walletBalance !== null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <Ionicons
                      name={walletBalance >= total ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={walletBalance >= total ? '#22C55E' : '#EF4444'}
                    />
                    <Text style={{ fontSize: 13, color: walletBalance >= total ? '#22C55E' : '#EF4444', fontWeight: '700' }}>
                      Solde: {fmt(walletBalance)} {walletBalance < total ? '— Insuffisant' : '— OK'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmPayBtn, paying && { opacity: 0.7 }, payMethod === 'wallet' && { backgroundColor: '#14B8A6' }, payMethod === 'credit' && { backgroundColor: '#6366F1' }]}
              onPress={handlePayment}
              disabled={paying}
            >
              {paying
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmPayBtnText}>
                    {payMethod === 'wallet' ? '💚 Payer via Wallet' : 'Confirmer le paiement'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── MODAL WHATSAPP ── */}
      <Modal visible={showWAModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📲 Partager la facture</Text>
              <TouchableOpacity onPress={() => setShowWAModal(false)}>
                <Ionicons name="close" size={24} color="#1A2E4A" />
              </TouchableOpacity>
            </View>

            {/* Aperçu facture */}
            <View style={styles.receiptPreview}>
              <Text style={styles.receiptPreviewTitle}>
                🍽️ {user?.establishment_name || 'SOKORA'}
              </Text>
              <Text style={styles.receiptPreviewDate}>
                {new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}
              </Text>
              <Text style={styles.receiptPreviewTotal}>
                Table {tableNum} — {fmt(total)}
              </Text>
            </View>

            {/* Saisie numéro */}
            <Text style={styles.waLabel}>Numéro WhatsApp client</Text>
            <TextInput
              style={styles.waInput}
              placeholder="Ex: 0700000000"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={clientPhone}
              onChangeText={setClientPhone}
              autoFocus
            />

            {/* Boutons */}
            <View style={styles.waButtons}>
              <TouchableOpacity style={styles.waNativeBtn} onPress={handleShareNative}>
                <Ionicons name="share-outline" size={18} color="#64748B" />
                <Text style={styles.waNativeBtnText}>Partage natif</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.waBtn, clientPhone.length < 8 && { opacity: 0.5 }]}
                onPress={sendWhatsApp}
                disabled={clientPhone.length < 8}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={styles.waBtnText}>Envoyer WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    backgroundColor: '#1A2E4A', paddingTop: 54, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', margin: 20,
    borderRadius: 10, padding: 12,
    borderLeftWidth: 4, borderLeftColor: '#22C55E',
  },
  successText: { fontSize: 13, color: '#22C55E', fontWeight: '600' },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1A2E4A' },
  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF7ED', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addItemBtnText: { fontSize: 13, fontWeight: '700', color: '#F97316' },
  itemsCard: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  itemQtyBadge: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center',
  },
  itemQty: { fontSize: 13, fontWeight: '800', color: '#F97316' },
  itemName: { flex: 1, fontSize: 15, color: '#1A2E4A', fontWeight: '500' },
  itemRight: { alignItems: 'flex-end' },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#1A2E4A' },
  itemUnitPrice: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#1A2E4A',
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  totalAmount: { fontSize: 22, fontWeight: '800', color: '#FB923C' },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    flex: 1, minWidth: 100, backgroundColor: '#fff',
    borderRadius: 12, padding: 12, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  actionBtnPrimary: { backgroundColor: '#F97316', borderColor: '#F97316' },
  actionBtnText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  paidBanner: {
    margin: 20, backgroundColor: '#F0FDFA', borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#14B8A644',
  },
  paidText: { fontSize: 16, fontWeight: '700', color: '#14B8A6' },
  paidAmount: { fontSize: 22, fontWeight: '800', color: '#1A2E4A' },
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(26,46,74,0.7)', justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1A2E4A' },
  modalTotal: {
    fontSize: 36, fontWeight: '800', color: '#F97316',
    textAlign: 'center', marginBottom: 20,
  },
  modalLabel: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 1, marginBottom: 12,
  },
  payMethods: { gap: 8, marginBottom: 20 },
  payMethod: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8FAFC', borderRadius: 12,
    padding: 14, borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  payMethodText: { flex: 1, fontSize: 15, color: '#94A3B8' },
  walletInput: {
    borderWidth: 2, borderColor: '#14B8A6', borderRadius: 12,
    padding: 12, fontSize: 16, fontWeight: '600', color: Colors.navy,
    backgroundColor: '#F0FDFA',
  },
  confirmPayBtn: {
    backgroundColor: '#F97316', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  confirmPayBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  // WhatsApp modal
  receiptPreview: {
    backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14,
    marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#25D366',
  },
  receiptPreviewTitle: { fontSize: 15, fontWeight: '800', color: '#1A2E4A' },
  receiptPreviewDate: { fontSize: 11, color: '#64748B', marginTop: 2 },
  receiptPreviewTotal: { fontSize: 14, fontWeight: '700', color: '#F97316', marginTop: 6 },
  waLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 8 },
  waInput: {
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5,
    borderColor: '#E2E8F0', padding: 14, fontSize: 18, fontWeight: '700',
    color: '#1A2E4A', marginBottom: 16, textAlign: 'center',
  },
  waButtons: { flexDirection: 'row', gap: 10 },
  waNativeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#F8FAFC', borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  waNativeBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  waBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14,
  },
  waBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
