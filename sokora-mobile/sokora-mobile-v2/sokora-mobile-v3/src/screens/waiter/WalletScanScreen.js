import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, FlatList, RefreshControl, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { walletService } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { Colors, Spacing, Radius, Shadow } from '../../utils/constants';

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

const AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

export default function WalletScanScreen({ navigation }) {
  const { user } = useAuth();
  const [pendingTopups, setPendingTopups] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  // Scanner
  const [showScanner, setShowScanner]     = useState(false);
  const [permission, requestPermission]   = useCameraPermissions();

  // Express topup
  const [showExpress, setShowExpress]     = useState(false);
  const [clientPhone, setClientPhone]     = useState('');
  const [amount, setAmount]               = useState('');
  const [customAmount, setCustomAmount]   = useState('');
  const [method, setMethod]               = useState('cash');
  const [saving, setSaving]               = useState(false);
  const [clientInfo, setClientInfo]       = useState(null);
  const [checkingClient, setCheckingClient] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await walletService.getPendingTopups();
      setPendingTopups(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const requestScanPermission = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission refusée', 'Autorisez l\'accès à la caméra dans les paramètres.');
        return;
      }
    }
    setShowScanner(true);
  };

  const handleScan = async ({ data: scannedData }) => {
    setShowScanner(false);
    // Le QR code wallet contient le numéro de téléphone du client
    const phone = scannedData.replace(/^sokora:wallet:/, '').trim();
    setClientPhone(phone);
    setShowExpress(true);
    checkClient(phone);
  };

  const checkClient = async (phone) => {
    if (!phone || phone.length < 8) return;
    setCheckingClient(true);
    try {
      const { data } = await walletService.checkClientBalance(phone);
      setClientInfo(data);
    } catch {
      setClientInfo(null);
    } finally {
      setCheckingClient(false);
    }
  };

  const handleExpressTopup = async () => {
    const finalAmount = parseFloat(customAmount || amount);
    if (!clientPhone) return Alert.alert('Erreur', 'Numéro client requis');
    if (!finalAmount || finalAmount <= 0) return Alert.alert('Erreur', 'Montant invalide');

    setSaving(true);
    try {
      await walletService.expressTopup({
        client_phone:     clientPhone,
        amount:           finalAmount,
        method,
        establishment_id: user?.establishment_id,
      });
      Alert.alert('✅ Recharge effectuée', `${fmt(finalAmount)} crédités sur le wallet de ${clientInfo?.name || clientPhone}`);
      setShowExpress(false);
      setClientPhone('');
      setAmount('');
      setCustomAmount('');
      setClientInfo(null);
      load();
    } catch (e) {
      Alert.alert('Erreur', e?.response?.data?.detail || 'Échec de la recharge');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (id) => {
    try {
      await walletService.confirmTopup(id);
      load();
    } catch {
      Alert.alert('Erreur', 'Impossible de valider la recharge');
    }
  };

  const handleReject = async (id) => {
    Alert.alert('Rejeter', 'Confirmer le rejet de cette demande ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Rejeter', style: 'destructive', onPress: async () => {
        try { await walletService.rejectTopup(id); load(); } catch {}
      }},
    ]);
  };

  const METHODS = [
    { id: 'cash',         label: 'Espèces',      icon: '💵' },
    { id: 'wave',         label: 'Wave',         icon: '🌊' },
    { id: 'orange_money', label: 'Orange Money', icon: '🟠' },
    { id: 'mtn_money',    label: 'MTN Money',    icon: '💛' },
    { id: 'card',         label: 'Carte',        icon: '💳' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.surface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet Caisse</Text>
        <TouchableOpacity onPress={requestScanPermission} style={styles.scanBtn}>
          <Ionicons name="qr-code-outline" size={22} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.orange} />}
      >
        {/* Actions rapides */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={requestScanPermission}>
            <Ionicons name="qr-code" size={26} color={Colors.orange} />
            <Text style={styles.actionLabel}>Scanner QR</Text>
            <Text style={styles.actionSub}>Identifier le client</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowExpress(true)}>
            <Ionicons name="flash" size={26} color={Colors.orange} />
            <Text style={styles.actionLabel}>Saisie rapide</Text>
            <Text style={styles.actionSub}>Entrer le numéro</Text>
          </TouchableOpacity>
        </View>

        {/* Demandes en attente */}
        <Text style={styles.sectionTitle}>
          Demandes en attente {pendingTopups.length > 0 && `(${pendingTopups.length})`}
        </Text>

        {pendingTopups.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={40} color={Colors.textFaint} />
            <Text style={styles.emptyText}>Aucune demande en attente</Text>
          </View>
        ) : (
          pendingTopups.map(topup => (
            <View key={topup.id} style={styles.topupCard}>
              <View style={styles.topupInfo}>
                <View style={styles.topupAvatar}>
                  <Text style={{ fontSize: 18 }}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topupName}>{topup.client_name || topup.client_phone}</Text>
                  <Text style={styles.topupPhone}>{topup.client_phone}</Text>
                  <Text style={styles.topupMethod}>{topup.method} · {new Date(topup.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <Text style={styles.topupAmount}>{fmt(topup.amount)}</Text>
              </View>
              <View style={styles.topupActions}>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(topup.id)}>
                  <Ionicons name="close" size={16} color={Colors.error || '#EF4444'} />
                  <Text style={[styles.btnText, { color: Colors.error || '#EF4444' }]}>Rejeter</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={() => handleConfirm(topup.id)}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={[styles.btnText, { color: '#fff' }]}>Valider</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Scanner Modal */}
      <Modal visible={showScanner} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            onBarcodeScanned={handleScan}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={StyleSheet.absoluteFillObject}
          />
          <TouchableOpacity
            style={{ position: 'absolute', top: 54, left: 20, padding: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 99 }}
            onPress={() => setShowScanner(false)}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={{ position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Scannez le QR code du wallet client</Text>
          </View>
        </View>
      </Modal>

      {/* Express Topup Modal */}
      <Modal visible={showExpress} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recharge Wallet</Text>
              <TouchableOpacity onPress={() => { setShowExpress(false); setClientPhone(''); setAmount(''); setCustomAmount(''); setClientInfo(null); }}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Numéro client */}
            <Text style={styles.fieldLabel}>Numéro client</Text>
            <View style={styles.phoneRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="07 XX XX XX XX"
                value={clientPhone}
                onChangeText={setClientPhone}
                keyboardType="phone-pad"
                onBlur={() => checkClient(clientPhone)}
              />
              <TouchableOpacity style={styles.checkBtn} onPress={() => checkClient(clientPhone)}>
                <Ionicons name="search" size={18} color={Colors.orange} />
              </TouchableOpacity>
            </View>

            {/* Info client */}
            {checkingClient && <Text style={styles.checkingText}>Vérification...</Text>}
            {clientInfo && (
              <View style={styles.clientInfoBox}>
                <Text style={styles.clientName}>👤 {clientInfo.name || 'Client SOKORA'}</Text>
                <Text style={styles.clientBalance}>Solde actuel : {fmt(clientInfo.balance)}</Text>
              </View>
            )}

            {/* Montant */}
            <Text style={styles.fieldLabel}>Montant</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                {AMOUNTS.map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.amountChip, amount === String(a) && styles.amountChipActive]}
                    onPress={() => { setAmount(String(a)); setCustomAmount(''); }}
                  >
                    <Text style={[styles.amountChipText, amount === String(a) && styles.amountChipTextActive]}>
                      {fmt(a)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TextInput
              style={styles.input}
              placeholder="Ou saisir un montant personnalisé"
              value={customAmount}
              onChangeText={(v) => { setCustomAmount(v); setAmount(''); }}
              keyboardType="numeric"
            />

            {/* Méthode */}
            <Text style={styles.fieldLabel}>Moyen de paiement</Text>
            <View style={styles.methodsRow}>
              {METHODS.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.methodChip, method === m.id && styles.methodChipActive]}
                  onPress={() => setMethod(m.id)}
                >
                  <Text style={{ fontSize: 16 }}>{m.icon}</Text>
                  <Text style={[styles.methodLabel, method === m.id && { color: Colors.orange }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handleExpressTopup}
              disabled={saving}
            >
              <Text style={styles.submitBtnText}>
                {saving ? 'Validation...' : `Recharger ${fmt(parseFloat(customAmount || amount) || 0)}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.bg },
  header:          { backgroundColor: Colors.navy, paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:     { fontSize: 18, fontWeight: '800', color: Colors.surface, flex: 1, textAlign: 'center' },
  backBtn:         { padding: 4 },
  scanBtn:         { padding: 4 },
  content:         { padding: 16, paddingBottom: 40 },
  actionsRow:      { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionBtn:       { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  actionLabel:     { fontSize: 14, fontWeight: '700', color: Colors.navy },
  actionSub:       { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  sectionTitle:    { fontSize: 16, fontWeight: '800', color: Colors.navy, marginBottom: 12 },
  emptyBox:        { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText:       { color: Colors.textMuted, fontSize: 14 },
  topupCard:       { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  topupInfo:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  topupAvatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.orangePale, alignItems: 'center', justifyContent: 'center' },
  topupName:       { fontSize: 15, fontWeight: '700', color: Colors.navy },
  topupPhone:      { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  topupMethod:     { fontSize: 11, color: Colors.textFaint, marginTop: 2 },
  topupAmount:     { fontSize: 18, fontWeight: '800', color: Colors.orange },
  topupActions:    { flexDirection: 'row', gap: 8 },
  rejectBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#EF4444' },
  confirmBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, backgroundColor: Colors.orange },
  btnText:         { fontSize: 13, fontWeight: '700' },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle:      { fontSize: 18, fontWeight: '800', color: Colors.navy },
  fieldLabel:      { fontSize: 13, fontWeight: '700', color: Colors.navy, marginBottom: 8 },
  phoneRow:        { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input:           { backgroundColor: Colors.bg, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.navy, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  checkBtn:        { backgroundColor: Colors.orangePale, borderRadius: 10, padding: 12, justifyContent: 'center', alignItems: 'center' },
  checkingText:    { fontSize: 12, color: Colors.textMuted, marginBottom: 8, fontStyle: 'italic' },
  clientInfoBox:   { backgroundColor: Colors.orangePale, borderRadius: 10, padding: 12, marginBottom: 12 },
  clientName:      { fontSize: 14, fontWeight: '700', color: Colors.navy },
  clientBalance:   { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  amountChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border },
  amountChipActive:{ backgroundColor: Colors.orangePale, borderColor: Colors.orange },
  amountChipText:  { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  amountChipTextActive: { color: Colors.orange },
  methodsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  methodChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border },
  methodChipActive:{ backgroundColor: Colors.orangePale, borderColor: Colors.orange },
  methodLabel:     { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  submitBtn:       { backgroundColor: Colors.orange, borderRadius: 12, padding: 16, alignItems: 'center' },
  submitBtnText:   { fontSize: 15, fontWeight: '800', color: '#fff' },
});
