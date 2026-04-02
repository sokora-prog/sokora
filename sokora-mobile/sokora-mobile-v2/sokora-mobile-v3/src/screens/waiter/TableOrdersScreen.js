import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Modal,
  TextInput, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { useFocusEffect } from '@react-navigation/native';
import { ordersService, paymentsService, tablesService, staffService, walletService } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { Colors, Spacing, Radius, Shadow, Typography } from '../../utils/constants';
import api from '../../services/api';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../../utils/constants';

const getToken = async () => {
  try {
    if (Platform.OS === 'web') return localStorage.getItem('sokora_token');
    return await SecureStore.getItemAsync('sokora_token');
  } catch { return null; }
};

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

const PAYMENT_METHODS = [
  { key: 'cash',         label: 'Espèces',       icon: 'cash-outline' },
  { key: 'wave',         label: 'Wave',           icon: 'phone-portrait-outline' },
  { key: 'orange_money', label: 'Orange Money',   icon: 'phone-portrait-outline' },
  { key: 'mtn_money',    label: 'MTN Money',      icon: 'phone-portrait-outline' },
  { key: 'card',         label: 'Carte bancaire', icon: 'card-outline' },
  { key: 'wallet',       label: 'Wallet SOKORA',  icon: 'wallet-outline' },
  { key: 'credit',       label: 'À crédit',       icon: 'time-outline' },
];

export default function TableOrdersScreen({ navigation, route }) {
  const { table } = route.params || {};
  const { user } = useAuth();

  const [orders,       setOrders]       = useState([]);
  const [tables,       setTables]       = useState([]);
  const [waiters,      setWaiters]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [paying,       setPaying]       = useState(false);

  // Modals
  const [showPayModal,      setShowPayModal]      = useState(false);
  const [showActionsModal,  setShowActionsModal]  = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWaiterModal,   setShowWaiterModal]   = useState(false);

  const [payMethod,     setPayMethod]     = useState('cash');
  const [walletPhone,   setWalletPhone]   = useState('');
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletChecking, setWalletChecking] = useState(false);
  const [showQRScanner,  setShowQRScanner]  = useState(false);
  const [qrScanned,      setQrScanned]      = useState(false);
  const [camPermission,  requestCamPermission] = useCameraPermissions();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // WhatsApp
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [clientPhone,       setClientPhone]       = useState('');
  const [lastPaidAmount,    setLastPaidAmount]     = useState(0);
  const [lastPaidMethod,    setLastPaidMethod]     = useState('');

  // Ardoise
  const [showArdoiseModal,  setShowArdoiseModal]  = useState(false);
  const [ardoiseOrder,      setArdoiseOrder]      = useState(null); // null = toute la table
  const [ardoiseSearch,     setArdoiseSearch]     = useState('');
  const [ardoiseResults,    setArdoiseResults]    = useState([]);
  const [ardoiseSearching,  setArdoiseSearching]  = useState(false);
  const [ardoiseNewName,    setArdoiseNewName]    = useState('');
  const [ardoiseNewPhone,   setArdoiseNewPhone]   = useState('');
  const [ardoiseStep,       setArdoiseStep]       = useState('search'); // search | new
  const [ardoiseSaving,     setArdoiseSaving]     = useState(false);

  const getHdr = async () => {
    const token = await getToken();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  };

  const openArdoise = (order = null) => {
    setArdoiseOrder(order);
    setArdoiseSearch('');
    setArdoiseResults([]);
    setArdoiseNewName('');
    setArdoiseNewPhone('');
    setArdoiseStep('search');
    setShowArdoiseModal(true);
  };

  const searchArdoise = async (q) => {
    setArdoiseSearch(q);
    if (q.length < 2) { setArdoiseResults([]); return; }
    setArdoiseSearching(true);
    try {
      const hdr = await getHdr();
      const res = await fetch(`${API_URL}/credit/accounts/search?q=${encodeURIComponent(q)}`, { headers: hdr });
      const data = await res.json();
      setArdoiseResults(Array.isArray(data) ? data : []);
    } catch { setArdoiseResults([]); }
    finally { setArdoiseSearching(false); }
  };

  const confirmArdoise = async (account) => {
    setArdoiseSaving(true);
    try {
      const hdr = await getHdr();
      const ordersToProcess = ardoiseOrder ? [ardoiseOrder] : orders;
      for (const o of ordersToProcess) {
        const orderTotal = (o.items || [])
          .filter(i => !i.is_complimentary)
          .reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 1), 0);
        if (orderTotal <= 0) continue;
        // Marquer la commande comme payée
        await paymentsService.process({ order_id: o.id, amount: orderTotal, method: 'credit' });
        // Ajouter à l'ardoise
        await fetch(`${API_URL}/credit/accounts/${account.id}/transactions`, {
          method: 'POST', headers: hdr,
          body: JSON.stringify({
            transaction_type: 'credit',
            amount: orderTotal,
            description: `Table ${table?.number} — Commande #${o.id}`,
            order_id: o.id,
          }),
        });
      }
      setShowArdoiseModal(false);
      const totalArdoise = ordersToProcess.reduce((s, o) =>
        s + (o.items || []).filter(i => !i.is_complimentary).reduce((ss, i) => ss + (i.unit_price || 0) * (i.quantity || 1), 0), 0);
      Alert.alert('📋 Ardoise mise à jour', `${fmt(totalArdoise)} ajoutés à l'ardoise de ${account.client_name}\nSolde total : ${fmt((account.balance || 0) + totalArdoise)}`, [
        { text: 'OK', onPress: () => loadOrders() }
      ]);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de mettre en ardoise');
    } finally { setArdoiseSaving(false); }
  };

  const createAndConfirmArdoise = async () => {
    if (!ardoiseNewName.trim()) { Alert.alert('Erreur', 'Le nom est requis'); return; }
    setArdoiseSaving(true);
    try {
      const hdr = await getHdr();
      const res = await fetch(`${API_URL}/credit/accounts`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({ client_name: ardoiseNewName, client_phone: ardoiseNewPhone }),
      });
      const account = await res.json();
      await confirmArdoise(account);
    } catch { Alert.alert('Erreur', 'Création ardoise impossible'); setArdoiseSaving(false); }
  };

  // QR Payment
  const [showQRPayModal,  setShowQRPayModal]  = useState(false);
  const [qrPayToken,      setQrPayToken]      = useState('');
  const [qrPayStatus,     setQrPayStatus]     = useState('idle'); // idle / generating / pending / paid
  const [qrPayInterval,   setQrPayInterval]   = useState(null);
  const [qrChangePhone,   setQrChangePhone]   = useState('');
  const [qrChangeAmount,  setQrChangeAmount]  = useState('');
  const [sendingChange,   setSendingChange]   = useState(false);

  // Offert commande entière
  const [showOfferOrderModal, setShowOfferOrderModal] = useState(false);
  const [offerOrderTarget,    setOfferOrderTarget]    = useState(null);
  const [offerOrderReason,    setOfferOrderReason]    = useState('');

  // Action en cours: 'transfer' | 'merge'
  const [pendingAction, setPendingAction] = useState(null);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      // Charger toutes les commandes non payees/annulees
      const [resOpen, resSent, resInProgress, resReady, resServed] = await Promise.all([
        ordersService.list({ status: 'OPEN' }),
        ordersService.list({ status: 'SENT' }),
        ordersService.list({ status: 'IN_PROGRESS' }),
        ordersService.list({ status: 'READY' }),
        ordersService.list({ status: 'SERVED' }),
      ]);
      const allActive = [
        ...(resOpen.data || []),
        ...(resSent.data || []),
        ...(resInProgress.data || []),
        ...(resReady.data || []),
        ...(resServed.data || []),
      ];
      const tableOrders = allActive.filter(o => o.table_id === table.id);
      const detailed = await Promise.all(
        tableOrders.map(o => ordersService.getById(o.id).then(r => r.data).catch(() => o))
      );
      setOrders(detailed);
    } catch(e) {
      console.log('ERROR loadOrders:', e.message);
    } finally {
      setLoading(false);
    }
  }, [table]);

  const loadTables = useCallback(async () => {
    try {
      const res = await tablesService.list();
      // Exclure la table actuelle
      setTables(res.data.filter(t => t.id !== table.id));
    } catch(e) { console.log(e); }
  }, [table]);

  const loadWaiters = useCallback(async () => {
    try {
      const res = await staffService.list();
      // Exclure le serveur actuel
      setWaiters(res.data.filter(w => w.id !== user?.id));
    } catch(e) { console.log(e); }
  }, [user]);

  useFocusEffect(useCallback(() => { loadOrders(); }, [loadOrders]));

  const grandTotal  = orders.reduce((sum, o) => sum + (o.items || []).reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 1), 0), 0);
  const totalItems  = orders.reduce((sum, o) => sum + (o.items?.length || 0), 0);
  const amountToPay = selectedOrder
    ? (selectedOrder.items || []).reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 1), 0)
    : grandTotal;

  // ── PAIEMENT ────────────────────────────────────────────────────────────────
  const openPayAll    = () => { setSelectedOrder(null); setPayMethod('cash'); setWalletPhone(''); setWalletBalance(null); setShowPayModal(true); };
  const openPaySingle = (o) => { setSelectedOrder(o); setPayMethod('cash'); setWalletPhone(''); setWalletBalance(null); setShowPayModal(true); };

  const checkWalletBalance = async (phone) => {
    if (!phone || phone.length < 8) { setWalletBalance(null); return; }
    setWalletChecking(true);
    try {
      const { data } = await walletService.checkClientBalance(phone);
      setWalletBalance(data?.balance ?? data);
    } catch { setWalletBalance(null); }
    finally { setWalletChecking(false); }
  };

  const handleQRScan = async ({ data }) => {
    if (qrScanned) return;
    if (!data.startsWith('SOKORA_WALLET:')) {
      Alert.alert('QR invalide', 'Ce QR ne correspond pas à un wallet SOKORA.');
      return;
    }
    setQrScanned(true);
    setShowQRScanner(false);
    const parts = data.split(':');
    const phone = parts[2];
    setWalletPhone(phone);
    checkWalletBalance(phone);
  };

  const openQRScanner = async () => {
    if (!camPermission?.granted) {
      const { granted } = await requestCamPermission();
      if (!granted) { Alert.alert('Permission caméra requise'); return; }
    }
    setQrScanned(false);
    setShowQRScanner(true);
  };

  const handleConfirmPayment = async () => {
    // Paiement wallet
    if (payMethod === 'wallet') {
      if (!walletPhone) { Alert.alert('Numéro requis', 'Entrez le numéro du client.'); return; }
      if (walletBalance !== null && walletBalance < amountToPay) {
        Alert.alert('Solde insuffisant', `Solde: ${fmt(walletBalance)}\nTotal: ${fmt(amountToPay)}`);
        return;
      }
      setPaying(true);
      setShowPayModal(false);
      try {
        const ordersToPay = selectedOrder ? [selectedOrder] : orders;
        for (const o of ordersToPay) {
          const orderTotal = (o.items || []).reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 1), 0);
          await walletService.payWithWallet({ order_id: o.id, establishment_id: user?.establishment_id, amount: orderTotal, client_phone: walletPhone });
        }
        // Libérer la table
        try { await tablesService.updateStatus(table.id, 'free'); } catch {}
        setLastPaidAmount(amountToPay);
        setLastPaidMethod('Wallet SOKORA');
        if (walletPhone) setClientPhone(walletPhone);
        setShowWhatsAppModal(true);
      } catch (err) {
        Alert.alert('Erreur Wallet', err.response?.data?.detail || 'Paiement wallet impossible.');
        loadOrders();
      } finally { setPaying(false); }
      return;
    }
    setPaying(true);
    setShowPayModal(false);
    try {
      const ordersToPay = selectedOrder ? [selectedOrder] : orders;
      const methodLabel = PAYMENT_METHODS.find(m => m.key === payMethod)?.label || payMethod;
      for (const o of ordersToPay) {
        const orderTotal = (o.items || []).reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 1), 0);
        await paymentsService.process({ order_id: o.id, amount: orderTotal, method: payMethod.toUpperCase() });
      }
      const res = await ordersService.list();
      const remaining = (res.data || []).filter(o => o.table_id === table.id && !['PAID','CANCELLED','paid','cancelled'].includes(o.status));
      if (remaining.length === 0) {
        // Table libérée — proposer WhatsApp
        setLastPaidAmount(amountToPay);
        setLastPaidMethod(methodLabel);
        if (walletPhone) setClientPhone(walletPhone);
        setShowWhatsAppModal(true);
      } else {
        const restTotal = remaining.reduce((sum, o) => sum + (o.items || []).reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 1), 0), 0);
        Alert.alert('Paiement enregistré', `${fmt(amountToPay)} encaissés via ${methodLabel}\n\nSolde restant : ${fmt(restTotal)}`, [
          { text: 'OK', onPress: () => loadOrders() }
        ]);
      }
    } catch (err) {
      const det = err.response?.data?.detail; const msg = Array.isArray(det) ? det.map(d=>d.msg||JSON.stringify(d)).join(', ') : (typeof det==='string' ? det : 'Paiement impossible.'); Alert.alert('Erreur paiement', msg);
    } finally {
      setPaying(false);
    }
  };

  // ── QR PAYMENT ───────────────────────────────────────────────────────────────
  const openQRPayment = async () => {
    setQrPayStatus('generating');
    setQrPayToken('');
    setShowQRPayModal(true);
    try {
      const ordersToPay = selectedOrder ? [selectedOrder] : orders;
      const orderIds = ordersToPay.map(o => o.id);
      const hdr = await getHdr();
      const res = await fetch(`${API_URL}/payment-requests`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({ order_ids: orderIds, table_number: table?.number, table_id: table?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Erreur', data.detail || 'Impossible de créer la demande');
        setShowQRPayModal(false);
        return;
      }
      setQrPayToken(data.token);
      setQrPayStatus('pending');
      // Poll every 3s
      const iv = setInterval(async () => {
        try {
          const sr = await fetch(`${API_URL}/payment-requests/${data.token}/status`, { headers: hdr });
          const sd = await sr.json();
          if (sd.status === 'paid') {
            clearInterval(iv);
            setQrPayInterval(null);
            setQrPayStatus('paid');
            try { await tablesService.updateStatus(table.id, 'free'); } catch {}
            loadOrders();
          }
        } catch {}
      }, 3000);
      setQrPayInterval(iv);
    } catch {
      Alert.alert('Erreur réseau', 'Impossible de générer le QR de paiement');
      setShowQRPayModal(false);
      setQrPayStatus('idle');
    }
  };

  const closeQRPayModal = () => {
    if (qrPayInterval) { clearInterval(qrPayInterval); setQrPayInterval(null); }
    setShowQRPayModal(false);
    setQrPayStatus('idle');
    setQrPayToken('');
  };

  const handleSendChange = async () => {
    if (!qrPayToken || !qrChangePhone || !qrChangeAmount) return;
    setSendingChange(true);
    try {
      const hdr = await getHdr();
      const res = await fetch(`${API_URL}/payment-requests/${qrPayToken}/send-change`, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({ change_amount: parseFloat(qrChangeAmount), client_phone: qrChangePhone }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert('Erreur', data.detail || 'Impossible d\'envoyer la monnaie'); return; }
      Alert.alert('✅ Monnaie envoyée', `${fmt(parseFloat(qrChangeAmount))} crédités sur le wallet de ${data.client_name}\nNouveau solde: ${fmt(data.new_balance)}`, [
        { text: 'OK', onPress: () => { closeQRPayModal(); navigation.goBack(); } }
      ]);
    } catch {
      Alert.alert('Erreur réseau', 'Envoi de monnaie impossible');
    } finally { setSendingChange(false); }
  };

  // ── WHATSAPP ─────────────────────────────────────────────────────────────────
  const sendWhatsApp = async () => {
    let phone = clientPhone.replace(/\s/g, '').replace(/[^0-9+]/g, '');
    if (phone.startsWith('00')) {
      phone = phone.substring(2);
    } else if (phone.startsWith('+')) {
      phone = phone.substring(1);
    } else if (phone.startsWith('0')) {
      phone = '225' + phone;
    }
    if (!phone.startsWith('225') && phone.length <= 10) {
      phone = '225' + phone;
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    const estName = user?.establishment_name || 'SOKORA';
    const msg = encodeURIComponent(
      `🍽️ *${estName}*\n` +
      `📅 ${dateStr} à ${timeStr}\n` +
      `─────────────────\n` +
      `🧾 *Reçu de paiement*\n\n` +
      `Table ${table?.number} — ${table?.label || ''}\n` +
      `Montant : *${fmt(lastPaidAmount)}*\n` +
      `Mode : ${lastPaidMethod}\n` +
      `─────────────────\n` +
      `Merci pour votre visite ! 🙏\n` +
      `_${estName} — Powered by SOKORA_`
    );
    const url = `whatsapp://send?phone=${phone}&text=${msg}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erreur', 'WhatsApp n\'est pas installé sur cet appareil.');
    }
    setShowWhatsAppModal(false);
    setClientPhone('');
    setWalletPhone('');
    navigation.goBack();
  };

  // ── OFFRIR COMMANDE ENTIÈRE ───────────────────────────────────────────────────
  const openOfferOrder = (order) => {
    setOfferOrderTarget(order);
    setOfferOrderReason('');
    setShowOfferOrderModal(true);
  };

  const confirmOfferOrder = async () => {
    setShowOfferOrderModal(false);
    try {
      await api.patch(`/orders/${offerOrderTarget.id}/complimentary`, {
        is_complimentary: true,
        reason: offerOrderReason || 'Offert',
      });
      Alert.alert('✅ Commande offerte', `La commande #${offerOrderTarget.id} est marquée comme offerte.`);
      loadOrders();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.detail || 'Impossible de marquer comme offert.');
    }
  };

  // ── ACTIONS MULTI-TABLES ─────────────────────────────────────────────────────
  const openActions = () => {
    setShowActionsModal(true);
  };

  const handleTransferOrMerge = (action) => {
    // action: 'transfer' ou 'merge'
    setPendingAction(action);
    setShowActionsModal(false);
    loadTables();
    setTimeout(() => setShowTransferModal(true), 300);
  };

  const handleTransferWaiter = () => {
    setShowActionsModal(false);
    loadWaiters();
    setTimeout(() => setShowWaiterModal(true), 300);
  };

  const confirmTransferTable = async (targetTable) => {
    setShowTransferModal(false);
    setActionLoading(true);
    try {
      const endpoint = pendingAction === 'merge' ? '/tables/merge' : '/tables/transfer';
      const res = await api.post(endpoint, {
        from_table_id: table.id,
        to_table_id:   targetTable.id,
      });
      const label = pendingAction === 'merge' ? 'Fusion' : 'Transfert';
      Alert.alert(
        `${label} réussi ✅`,
        res.data.message,
        [{ text: 'OK', onPress: () => navigation.navigate('Accueil') }]
      );
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.detail || 'Opération impossible.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmTransferWaiter = async (newWaiter) => {
    setShowWaiterModal(false);
    setActionLoading(true);
    try {
      const res = await api.post('/tables/transfer-waiter', {
        table_id:      table.id,
        new_waiter_id: newWaiter.id,
      });
      Alert.alert('Transfert réussi ✅', res.data.message, [
        { text: 'OK', onPress: () => navigation.navigate('Accueil') }
      ]);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.detail || 'Opération impossible.');
    } finally {
      setActionLoading(false);
    }
  };

  const TABLE_STATUS_COLORS = { free: Colors.teal, occupied: Colors.orange, reserved: Colors.purple };
  const TABLE_STATUS_LABELS = { free: 'Libre', occupied: 'Occupée', reserved: 'Réservée' };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.surface} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Table {table?.number}</Text>
          <Text style={styles.headerSub}>{table?.label} · {orders.length} commande(s)</Text>
        </View>
        <TouchableOpacity onPress={loadOrders} style={styles.headerBtn}>
          <Ionicons name="refresh-outline" size={20} color={Colors.surface} />
        </TouchableOpacity>
        <TouchableOpacity onPress={openActions} style={[styles.headerBtn, { backgroundColor: Colors.orange, marginLeft: 6 }]}>
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* TOTAL */}
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total table</Text>
            <Text style={styles.totalAmount}>{fmt(grandTotal)}</Text>
          </View>
          <Text style={styles.totalSub}>{totalItems} article(s) · {orders.length} commande(s)</Text>
        </View>

        {/* ACTIONS RAPIDES */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => handleTransferOrMerge('transfer')}>
            <Ionicons name="swap-horizontal-outline" size={18} color={Colors.teal} />
            <Text style={styles.quickBtnText}>Transférer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => handleTransferOrMerge('merge')}>
            <Ionicons name="git-merge-outline" size={18} color={Colors.purple} />
            <Text style={[styles.quickBtnText, { color: Colors.purple }]}>Fusionner</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={handleTransferWaiter}>
            <Ionicons name="person-outline" size={18} color={Colors.orange} />
            <Text style={[styles.quickBtnText, { color: Colors.orange }]}>Serveur</Text>
          </TouchableOpacity>
        </View>

        {/* COMMANDES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détail des commandes</Text>
          {loading && <ActivityIndicator color={Colors.orange} style={{ marginVertical: 20 }} />}
          {orders.map((order, idx) => {
            const orderTotal = (order.items || []).reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 1), 0);
            return (
              <View key={order.id} style={styles.orderCard}>
                <TouchableOpacity
                  style={styles.orderCardHeader}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                  activeOpacity={0.85}
                >
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderBadgeText}>#{order.id}</Text>
                  </View>
                  <Text style={styles.orderCardTitle}>Commande {idx + 1}</Text>
                  <Text style={styles.orderCardTotal}>{fmt(orderTotal)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />
                </TouchableOpacity>
                {(order.items || []).map(item => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemQtyBadge}>
                      <Text style={styles.itemQty}>{item.quantity}</Text>
                    </View>
                    <Text style={styles.itemName}>{item.product_name || `Article #${item.product_id}`}</Text>
                    <Text style={styles.itemPrice}>{fmt((item.unit_price || 0) * (item.quantity || 1))}</Text>
                  </View>
                ))}
                {orders.length > 1 && (
                  <TouchableOpacity style={styles.payPartialBtn} onPress={() => openPaySingle(order)}>
                    <Ionicons name="card-outline" size={14} color={Colors.teal} />
                    <Text style={styles.payPartialText}>Encaisser cette commande ({fmt(orderTotal)})</Text>
                  </TouchableOpacity>
                )}
                {/* Bouton offrir commande */}
                <TouchableOpacity
                  style={[styles.payPartialBtn, { backgroundColor: '#fff9e6', marginTop: 4 }]}
                  onPress={() => openOfferOrder(order)}
                >
                  <Text style={{ fontSize: 13 }}>🎁</Text>
                  <Text style={[styles.payPartialText, { color: Colors.gold }]}>Offrir cette commande</Text>
                </TouchableOpacity>
                {/* Bouton ardoise */}
                <TouchableOpacity
                  style={[styles.payPartialBtn, { backgroundColor: '#f0f4fb', marginTop: 4 }]}
                  onPress={() => openArdoise(order)}
                >
                  <Text style={{ fontSize: 13 }}>📋</Text>
                  <Text style={[styles.payPartialText, { color: '#0f1e35' }]}>Mettre en ardoise ({fmt(orderTotal)})</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FOOTER PAIEMENT */}
      {orders.length > 0 && (
        <View style={styles.footer}>
          {actionLoading
            ? <ActivityIndicator color={Colors.orange} size="large" />
            : <View style={{ gap: 8 }}>
                {/* Bouton ajouter commande dans le footer */}
                <TouchableOpacity
                  style={styles.addOrderBtn}
                  onPress={() => navigation.navigate('NewOrder', { table, existingOrders: orders })}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colors.orange} />
                  <Text style={styles.addOrderBtnText}>+ Ajouter une commande</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[styles.payAllBtn, { flex: 1 }]} onPress={openPayAll} disabled={paying} activeOpacity={0.85}>
                    {paying
                      ? <ActivityIndicator color={Colors.surface} size="small" />
                      : <>
                          <Ionicons name="checkmark-circle-outline" size={20} color={Colors.surface} />
                          <Text style={[styles.payAllBtnText, { fontSize: 14 }]}>Encaisser {fmt(grandTotal)}</Text>
                        </>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.payAllBtn, { backgroundColor: Colors.teal, paddingHorizontal: 16 }]}
                    onPress={() => { setSelectedOrder(null); openQRPayment(); }}
                    disabled={paying}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="qr-code" size={22} color={Colors.surface} />
                    <Text style={[styles.payAllBtnText, { fontSize: 13 }]}>QR</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.payAllBtn, { backgroundColor: '#1a2e4a' }]}
                  onPress={() => openArdoise(null)}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 16 }}>📋</Text>
                  <Text style={styles.payAllBtnText}>Tout mettre en ardoise</Text>
                </TouchableOpacity>
              </View>
          }
        </View>
      )}

      {/* ── MODAL QR SCANNER ── */}
      <Modal visible={showQRScanner} animationType="slide" onRequestClose={() => setShowQRScanner(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={qrScanned ? undefined : handleQRScan}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
          <View style={{ position: 'absolute', top: '30%', alignSelf: 'center', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 240, height: 240, borderWidth: 3, borderColor: '#19A99D', borderRadius: 16, backgroundColor: 'transparent' }} />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
              Scannez le QR Wallet du client
            </Text>
          </View>
          <TouchableOpacity
            style={{ position: 'absolute', bottom: 60, alignSelf: 'center' }}
            onPress={() => { setShowQRScanner(false); setQrScanned(false); }}
          >
            <Ionicons name="close-circle" size={56} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── MODAL PAIEMENT ── */}
      <Modal visible={showPayModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Mode de paiement</Text>
            <Text style={styles.modalAmount}>{fmt(amountToPay)}</Text>
            {selectedOrder && <Text style={styles.modalSub}>Commande #{selectedOrder.id} uniquement</Text>}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity key={m.key} style={[styles.methodBtn, payMethod === m.key && styles.methodBtnActive]} onPress={() => setPayMethod(m.key)}>
                <Ionicons name={m.icon} size={20} color={payMethod === m.key ? Colors.orange : Colors.textMuted} />
                <Text style={[styles.methodLabel, payMethod === m.key && styles.methodLabelActive]}>{m.label}</Text>
                {payMethod === m.key && <Ionicons name="checkmark-circle" size={20} color={Colors.orange} />}
              </TouchableOpacity>
            ))}
            {/* Champ téléphone si Wallet sélectionné */}
            {payMethod === 'wallet' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 6 }}>NUMÉRO CLIENT</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    style={{ flex: 1, borderWidth: 2, borderColor: '#19A99D', borderRadius: 10, padding: 10, fontSize: 15, fontWeight: '600', color: Colors.navy, backgroundColor: '#EDFAF8' }}
                    placeholder="Ex: 0789844202"
                    keyboardType="phone-pad"
                    value={walletPhone}
                    onChangeText={(t) => { setWalletPhone(t); checkWalletBalance(t); }}
                  />
                  {walletChecking && <ActivityIndicator size="small" color="#19A99D" />}
                  <TouchableOpacity
                    style={{ backgroundColor: '#19A99D', borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center' }}
                    onPress={openQRScanner}
                  >
                    <Ionicons name="qr-code-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
                {walletBalance !== null && (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: walletBalance >= amountToPay ? '#4CAF6E' : '#E84040', marginTop: 6 }}>
                    {walletBalance >= amountToPay ? '✓' : '✗'} Solde: {fmt(walletBalance)}
                    {walletBalance < amountToPay ? ' — Insuffisant' : ' — OK'}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPayModal(false)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, payMethod === 'wallet' && { backgroundColor: '#19A99D' }]} onPress={handleConfirmPayment} disabled={paying}>
                <Text style={styles.confirmBtnText}>{payMethod === 'wallet' ? '💚 Wallet' : 'Confirmer'}</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL ACTIONS ── */}
      <Modal visible={showActionsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowActionsModal(false)} activeOpacity={1}/>
          <View style={[styles.modalCard, { paddingBottom: 24 }]}>
            <Text style={styles.modalTitle}>Actions — Table {table?.number}</Text>
            <Text style={styles.modalSub}>Que voulez-vous faire ?</Text>

            <TouchableOpacity style={styles.actionBtn} onPress={() => handleTransferOrMerge('transfer')}>
              <View style={[styles.actionIcon, { backgroundColor: Colors.teal + '22' }]}>
                <Ionicons name="swap-horizontal-outline" size={22} color={Colors.teal} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Transférer la table</Text>
                <Text style={styles.actionDesc}>Déplacer le client vers une autre table</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => handleTransferOrMerge('merge')}>
              <View style={[styles.actionIcon, { backgroundColor: Colors.purple + '22' }]}>
                <Ionicons name="git-merge-outline" size={22} color={Colors.purple} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Fusionner avec une table</Text>
                <Text style={styles.actionDesc}>Regrouper deux tables en une addition</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleTransferWaiter}>
              <View style={[styles.actionIcon, { backgroundColor: Colors.orange + '22' }]}>
                <Ionicons name="person-outline" size={22} color={Colors.orange} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Changer de serveur</Text>
                <Text style={styles.actionDesc}>Réassigner la table à un collègue</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 12 }]} onPress={() => setShowActionsModal(false)}>
              <Text style={styles.cancelBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL SÉLECTION TABLE (transfert / fusion) ── */}
      <Modal visible={showTransferModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '75%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pendingAction === 'merge' ? '🔀 Fusionner avec' : '↔️ Transférer vers'}
              </Text>
              <TouchableOpacity onPress={() => setShowTransferModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              {pendingAction === 'merge'
                ? `Les commandes de T${table?.number} seront regroupées`
                : `Les commandes de T${table?.number} seront déplacées`}
            </Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {tables.map(t => {
                const stColor = TABLE_STATUS_COLORS[t.status] || Colors.teal;
                const stLabel = TABLE_STATUS_LABELS[t.status] || t.status;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.tableSelectBtn}
                    onPress={() => confirmTransferTable(t)}
                  >
                    <View style={[styles.tableSelectNum, { backgroundColor: stColor + '22' }]}>
                      <Text style={[styles.tableSelectNumText, { color: stColor }]}>T{t.number}</Text>
                    </View>
                    <View style={styles.tableSelectInfo}>
                      <Text style={styles.tableSelectLabel}>{t.label || `Table ${t.number}`}</Text>
                      <Text style={styles.tableSelectSub}>{t.capacity} pers.</Text>
                    </View>
                    <View style={[styles.tablePill, { backgroundColor: stColor + '22' }]}>
                      <Text style={[styles.tablePillText, { color: stColor }]}>{stLabel}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {tables.length === 0 && (
                <Text style={{ textAlign: 'center', color: Colors.textMuted, padding: 20 }}>
                  Aucune autre table disponible
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL SÉLECTION SERVEUR ── */}
      <Modal visible={showWaiterModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '65%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>👤 Changer de serveur</Text>
              <TouchableOpacity onPress={() => setShowWaiterModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Table {table?.number} — Choisir un collègue</Text>
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {waiters.map((w, i) => {
                const avatarColors = [Colors.orange, Colors.teal, Colors.purple, Colors.green];
                const bg = avatarColors[i % 4];
                const initials = w.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
                return (
                  <TouchableOpacity key={w.id} style={styles.waiterSelectBtn} onPress={() => confirmTransferWaiter(w)}>
                    <View style={[styles.waiterAvatar, { backgroundColor: bg }]}>
                      <Text style={styles.waiterAvatarText}>{initials}</Text>
                    </View>
                    <View style={styles.tableSelectInfo}>
                      <Text style={styles.tableSelectLabel}>{w.full_name}</Text>
                      <Text style={styles.tableSelectSub}>{w.phone_number}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
                  </TouchableOpacity>
                );
              })}
              {waiters.length === 0 && (
                <Text style={{ textAlign: 'center', color: Colors.textMuted, padding: 20 }}>
                  Aucun autre serveur disponible
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* ── MODAL WHATSAPP ── */}
      <Modal visible={showWhatsAppModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✅ Encaissé !</Text>
            <Text style={styles.modalAmount}>{fmt(lastPaidAmount)}</Text>
            <Text style={styles.modalSub}>via {lastPaidMethod}</Text>

            <Text style={styles.waLabel}>📲 Envoyer le reçu par WhatsApp ?</Text>
            <TextInput
              style={styles.waInput}
              placeholder="Numéro WhatsApp client (optionnel)"
              placeholderTextColor={Colors.textFaint}
              keyboardType="phone-pad"
              value={clientPhone}
              onChangeText={setClientPhone}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowWhatsAppModal(false); setClientPhone(''); navigation.navigate('Accueil'); }}
              >
                <Text style={styles.cancelBtnText}>Passer</Text>
              </TouchableOpacity>
              {clientPhone.length >= 8 && (
                <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#25D366' }]} onPress={sendWhatsApp}>
                  <Text style={styles.confirmBtnText}>📲 Envoyer</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL OFFRIR COMMANDE ── */}
      <Modal visible={showOfferOrderModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎁 Offrir la commande</Text>
              <TouchableOpacity onPress={() => setShowOfferOrderModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Commande #{offerOrderTarget?.id}</Text>
            <TextInput
              style={styles.waInput}
              placeholder="Motif (ex: anniversaire, client VIP...)"
              placeholderTextColor={Colors.textFaint}
              value={offerOrderReason}
              onChangeText={setOfferOrderReason}
            />
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: Colors.gold, flex: 0, paddingVertical: 14 }]}
              onPress={confirmOfferOrder}
            >
              <Text style={styles.confirmBtnText}>🎁 Confirmer l'offre</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL ARDOISE ── */}
      <Modal visible={showArdoiseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 Mettre en ardoise</Text>
              <TouchableOpacity onPress={() => setShowArdoiseModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              {ardoiseOrder
                ? `Commande #${ardoiseOrder.id} — ${fmt((ardoiseOrder.items||[]).reduce((s,i)=>s+(i.unit_price||0)*(i.quantity||1),0))}`
                : `Table ${table?.number} — Total : ${fmt(grandTotal)}`
              }
            </Text>

            {ardoiseStep === 'search' ? (
              <>
                <TextInput
                  style={styles.waInput}
                  placeholder="🔍 Rechercher un client..."
                  placeholderTextColor={Colors.textFaint}
                  value={ardoiseSearch}
                  onChangeText={searchArdoise}
                  autoFocus
                />
                {ardoiseSearching && <ActivityIndicator color={Colors.orange} style={{ marginBottom: 8 }} />}
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  {ardoiseResults.map(acc => (
                    <TouchableOpacity
                      key={acc.id}
                      style={{ flexDirection:'row', alignItems:'center', padding:12, borderRadius:10, backgroundColor:'#f0f4fb', marginBottom:8 }}
                      onPress={() => confirmArdoise(acc)}
                      disabled={ardoiseSaving}
                    >
                      <View style={{ width:36, height:36, borderRadius:18, backgroundColor:Colors.orange, alignItems:'center', justifyContent:'center', marginRight:10 }}>
                        <Text style={{ color:'#fff', fontWeight:'800' }}>{acc.client_name[0]}</Text>
                      </View>
                      <View style={{ flex:1 }}>
                        <Text style={{ fontWeight:'700', color:'#0f1e35' }}>{acc.client_name}</Text>
                        <Text style={{ fontSize:11, color:Colors.textMuted }}>Solde actuel : {fmt(acc.balance)}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />
                    </TouchableOpacity>
                  ))}
                  {ardoiseSearch.length >= 2 && ardoiseResults.length === 0 && !ardoiseSearching && (
                    <Text style={{ textAlign:'center', color:Colors.textMuted, fontSize:13, marginBottom:8 }}>Aucun client trouvé</Text>
                  )}
                </ScrollView>
                <TouchableOpacity
                  style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', padding:12, borderRadius:10, borderWidth:1.5, borderColor:Colors.orange, marginTop:8 }}
                  onPress={() => setArdoiseStep('new')}
                >
                  <Ionicons name="add-circle-outline" size={18} color={Colors.orange} />
                  <Text style={{ color:Colors.orange, fontWeight:'700', marginLeft:6 }}>Nouveau client</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setArdoiseStep('search')} style={{ marginBottom:12 }}>
                  <Text style={{ color:Colors.orange, fontWeight:'700' }}>← Retour</Text>
                </TouchableOpacity>
                <Text style={{ fontSize:12, fontWeight:'600', color:Colors.textMuted, marginBottom:6, textTransform:'uppercase' }}>Nom du client *</Text>
                <TextInput
                  style={styles.waInput}
                  placeholder="Konan Aya"
                  placeholderTextColor={Colors.textFaint}
                  value={ardoiseNewName}
                  onChangeText={setArdoiseNewName}
                  autoFocus
                />
                <Text style={{ fontSize:12, fontWeight:'600', color:Colors.textMuted, marginBottom:6, textTransform:'uppercase' }}>Téléphone WhatsApp</Text>
                <TextInput
                  style={styles.waInput}
                  placeholder="0700000000"
                  placeholderTextColor={Colors.textFaint}
                  keyboardType="phone-pad"
                  value={ardoiseNewPhone}
                  onChangeText={setArdoiseNewPhone}
                />
                <TouchableOpacity
                  style={[styles.confirmBtn, { opacity: ardoiseSaving ? 0.6 : 1, flex:0, paddingVertical:14, marginTop:8 }]}
                  onPress={createAndConfirmArdoise}
                  disabled={ardoiseSaving}
                >
                  {ardoiseSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.confirmBtnText}>Créer et mettre en ardoise</Text>
                  }
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[styles.cancelBtn, { marginTop:8 }]} onPress={() => setShowArdoiseModal(false)}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL QR PAYMENT ── */}
      <Modal visible={showQRPayModal} transparent animationType="slide" onRequestClose={closeQRPayModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 28, margin: 20, alignItems: 'center', maxWidth: 360, width: '90%' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.navy }}>
                {qrPayStatus === 'paid' ? '✅ Paiement reçu !' : '📲 QR de paiement'}
              </Text>
              <TouchableOpacity onPress={closeQRPayModal} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Status: Generating */}
            {qrPayStatus === 'generating' && (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <ActivityIndicator size="large" color={Colors.teal} />
                <Text style={{ marginTop: 16, color: Colors.textMuted, fontSize: 14 }}>Génération du QR…</Text>
              </View>
            )}

            {/* Status: Pending — show QR */}
            {qrPayStatus === 'pending' && !!qrPayToken && (
              <View style={{ alignItems: 'center' }}>
                <View style={{ padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: Colors.teal + '40' }}>
                  <QRCode
                    value={`sokora://pay/${qrPayToken}`}
                    size={200}
                    color={Colors.navy}
                    backgroundColor="#fff"
                  />
                </View>
                <View style={{ backgroundColor: Colors.tealPale, borderRadius: 12, padding: 12, marginTop: 16, width: '100%', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: Colors.textMuted, fontWeight: '700' }}>TOTAL À PAYER</Text>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: Colors.navy, marginTop: 4 }}>
                    {fmt(selectedOrder
                      ? (selectedOrder.items || []).reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 1), 0)
                      : grandTotal
                    )}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4 }}>
                    Table {table?.number} • {table?.label || ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
                  <ActivityIndicator size="small" color={Colors.teal} />
                  <Text style={{ fontSize: 13, color: Colors.teal, fontWeight: '600' }}>En attente du paiement…</Text>
                </View>
                <Text style={{ fontSize: 11, color: Colors.textFaint, marginTop: 8, textAlign: 'center' }}>
                  Le client scanne ce code avec son app SOKORA
                </Text>
                <Text style={{ fontSize: 10, color: Colors.textFaint, marginTop: 4, fontFamily: 'monospace' }}>
                  Réf: {qrPayToken}
                </Text>
              </View>
            )}

            {/* Status: Paid */}
            {qrPayStatus === 'paid' && (
              <View style={{ alignItems: 'center', width: '100%' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Ionicons name="checkmark" size={36} color="#fff" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.green, marginBottom: 4 }}>Paiement confirmé !</Text>
                <Text style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 20 }}>La table a été libérée</Text>

                {/* Envoi de monnaie */}
                <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16, width: '100%' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginBottom: 10 }}>
                    Rendre la monnaie au wallet ?
                  </Text>
                  <TextInput
                    style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.text, marginBottom: 8 }}
                    placeholder="Téléphone client SOKORA"
                    keyboardType="phone-pad"
                    value={qrChangePhone}
                    onChangeText={setQrChangePhone}
                  />
                  <TextInput
                    style={{ borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.text, marginBottom: 12 }}
                    placeholder="Montant monnaie (F CFA)"
                    keyboardType="numeric"
                    value={qrChangeAmount}
                    onChangeText={setQrChangeAmount}
                  />
                  <TouchableOpacity
                    style={[{ backgroundColor: Colors.teal, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }, sendingChange && { opacity: 0.7 }]}
                    onPress={handleSendChange}
                    disabled={sendingChange || !qrChangePhone || !qrChangeAmount}
                  >
                    {sendingChange
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>💸 Envoyer la monnaie</Text>
                    }
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={{ marginTop: 12, paddingVertical: 10, alignItems: 'center' }}
                  onPress={() => { closeQRPayModal(); navigation.goBack(); }}
                >
                  <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Fermer sans envoyer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.navy, paddingTop: 54, paddingBottom: 20,
    paddingHorizontal: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: Typography.xl, fontWeight: '800', color: Colors.surface },
  headerSub: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  totalCard: {
    margin: Spacing.xl, backgroundColor: Colors.navy,
    borderRadius: Radius.xl, padding: Spacing.xl, ...Shadow.lg,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: Typography.lg, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  totalAmount: { fontSize: 28, fontWeight: '900', color: Colors.orange },
  totalSub: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.5)', marginTop: 6 },

  quickActions: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg,
  },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    paddingVertical: 10, borderWidth: 1.5, borderColor: Colors.border,
  },
  quickBtnText: { fontSize: 11, fontWeight: '700', color: Colors.teal },

  section: { paddingHorizontal: Spacing.xl },
  sectionTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.navy, marginBottom: Spacing.md },
  orderCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  orderCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  orderBadge: { backgroundColor: Colors.orangePale, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  orderBadgeText: { fontSize: Typography.xs, fontWeight: '800', color: Colors.orange },
  orderCardTitle: { flex: 1, fontSize: Typography.base, fontWeight: '700', color: Colors.navy },
  orderCardTotal: { fontSize: Typography.base, fontWeight: '800', color: Colors.teal },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  itemQtyBadge: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.orangePale, alignItems: 'center', justifyContent: 'center' },
  itemQty: { fontSize: Typography.xs, fontWeight: '800', color: Colors.orange },
  itemName: { flex: 1, fontSize: Typography.sm, color: Colors.text },
  itemPrice: { fontSize: Typography.sm, fontWeight: '700', color: Colors.navy },
  addOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff4ea',
    borderWidth: 1.5,
    borderColor: Colors.orange + '66',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    marginHorizontal: 0,
  },
  addOrderBtnText: {
    color: Colors.orange,
    fontWeight: '700',
    fontSize: 14,
  },
  payPartialBtn: { marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#edfaf8', borderRadius: Radius.md },
  payPartialText: { fontSize: Typography.sm, color: Colors.teal, fontWeight: '700' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.border, ...Shadow.lg },
  payAllBtn: { backgroundColor: Colors.orange, borderRadius: Radius.xl, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, ...Shadow.orange },
  payAllBtnText: { fontSize: Typography.lg, fontWeight: '800', color: Colors.surface },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  waLabel: { fontSize: Typography.sm, fontWeight: '700', color: Colors.navy, marginBottom: Spacing.sm },
  waInput: { backgroundColor: Colors.bg, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, padding: 12, fontSize: Typography.base, color: Colors.navy, marginBottom: Spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing['3xl'] },
  modalTitle: { fontSize: Typography.xl, fontWeight: '800', color: Colors.navy, marginBottom: 4 },
  modalAmount: { fontSize: 28, fontWeight: '900', color: Colors.orange, marginBottom: 4 },
  modalSub: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: '500', marginBottom: Spacing.lg },
  methodBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.lg, marginBottom: Spacing.sm, backgroundColor: Colors.bg, borderWidth: 2, borderColor: 'transparent' },
  methodBtnActive: { borderColor: Colors.orange, backgroundColor: Colors.orangePale },
  methodLabel: { flex: 1, fontSize: Typography.base, color: Colors.textMuted, fontWeight: '600' },
  methodLabelActive: { color: Colors.orange },
  modalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.xl, backgroundColor: Colors.bg, alignItems: 'center' },
  cancelBtnText: { fontSize: Typography.md, fontWeight: '700', color: Colors.textMuted },
  confirmBtn: { flex: 2, paddingVertical: 14, borderRadius: Radius.xl, backgroundColor: Colors.orange, alignItems: 'center', ...Shadow.orange },
  confirmBtnText: { fontSize: Typography.md, fontWeight: '800', color: Colors.surface },

  // Actions modal
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.bg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1 },
  actionTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.navy },
  actionDesc: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  // Table select
  tableSelectBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.bg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  tableSelectNum: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tableSelectNumText: { fontSize: Typography.md, fontWeight: '800' },
  tableSelectInfo: { flex: 1 },
  tableSelectLabel: { fontSize: Typography.base, fontWeight: '600', color: Colors.navy },
  tableSelectSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  tablePill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.full },
  tablePillText: { fontSize: 10, fontWeight: '700' },

  // Waiter select
  waiterSelectBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.bg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  waiterAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  waiterAvatarText: { fontSize: Typography.base, fontWeight: '800', color: Colors.surface },
});
