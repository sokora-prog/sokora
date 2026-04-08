import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Modal, Alert, ActivityIndicator, ScrollView, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../../utils/constants';
import * as SecureStore from 'expo-secure-store';
import { notificationService } from '../../services/notifications';
import { Platform } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';

const C = {
  navy:    '#0f1e35',
  orange:  '#f07d1a',
  teal:    '#19a99d',
  green:   '#25D366',
  red:     '#e84040',
  bg:      '#f0f4fb',
  surface: '#ffffff',
  border:  '#dde4f0',
  muted:   '#7a8fab',
  faint:   '#b8c4d8',
};

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

async function getHeaders() {
  let token;
  if (Platform.OS === 'web') {
    token = localStorage.getItem('sokora_token');
  } else {
    token = await SecureStore.getItemAsync('sokora_token');
  }
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const PAYMENT_METHODS = [
  { id: 'cash',         label: 'Espèces',      icon: '💵' },
  { id: 'orange_money', label: 'Orange Money', icon: '🟠' },
  { id: 'wave',         label: 'Wave',         icon: '🌊' },
  { id: 'mtn',          label: 'MTN MoMo',     icon: '🟡' },
  { id: 'wallet',       label: 'Wallet Sokora',icon: '💳' },
];

export default function ArdoiseScreen({ navigation }) {
  const [accounts,   setAccounts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [view,       setView]       = useState('list'); // list | detail
  const [selected,   setSelected]   = useState(null);
  const [txList,     setTxList]     = useState([]);
  const [showNew,    setShowNew]    = useState(false);
  const [showTx,     setShowTx]     = useState(false);
  const [newForm,    setNewForm]    = useState({ client_name: '', client_phone: '', credit_limit: '' });
  const [txForm,     setTxForm]     = useState({ transaction_type: 'credit', amount: '', description: '', payment_method: 'cash' });
  const [saving,     setSaving]     = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/credit/accounts`, { headers });
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch { setAccounts([]); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadAccounts(); }, [loadAccounts]));

  const loadDetail = async (acc) => {
    setSelected(acc);
    setView('detail');
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/credit/accounts/${acc.id}/transactions`, { headers });
      const data = await res.json();
      setTxList(Array.isArray(data) ? data : []);
    } catch { setTxList([]); }
  };

  const reloadSelected = async (accId) => {
    try {
      const headers = await getHeaders();
      // Reload from accounts list to get updated totals
      const res = await fetch(`${API_URL}/credit/accounts`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        const updated = data.find(a => a.id === accId);
        if (updated) {
          setSelected(updated);
          setAccounts(data);
        }
      }
      // Also reload tx history
      const txRes = await fetch(`${API_URL}/credit/accounts/${accId}/transactions`, { headers });
      const txData = await txRes.json();
      setTxList(Array.isArray(txData) ? txData : []);
    } catch {}
  };

  const handleCreate = async () => {
    if (!newForm.client_name.trim()) {
      Alert.alert('Erreur', 'Le nom du client est requis');
      return;
    }
    setSaving(true);
    try {
      const headers = await getHeaders();
      const payload = {
        client_name: newForm.client_name,
        client_phone: newForm.client_phone,
        credit_limit: newForm.credit_limit ? Number(newForm.credit_limit) : null,
      };
      const res = await fetch(`${API_URL}/credit/accounts`, {
        method: 'POST', headers,
        body: JSON.stringify(payload),
      });
      setShowNew(false);
      setNewForm({ client_name: '', client_phone: '', credit_limit: '' });
      loadAccounts();
      Alert.alert('✅ Ardoise créée', `Ardoise de ${newForm.client_name} ouverte.`);
    } catch { Alert.alert('Erreur', 'Impossible de créer l\'ardoise'); }
    finally { setSaving(false); }
  };

  const handleTx = async () => {
    if (!txForm.amount || !selected) {
      Alert.alert('Erreur', 'Veuillez saisir un montant');
      return;
    }
    setSaving(true);
    const accId = selected.id;
    try {
      const headers = await getHeaders();
      const payload = {
        transaction_type: txForm.transaction_type,
        amount: Number(txForm.amount),
        description: txForm.description || undefined,
        payment_method: txForm.transaction_type === 'payment' ? txForm.payment_method : undefined,
      };
      await fetch(`${API_URL}/credit/accounts/${accId}/transactions`, {
        method: 'POST', headers,
        body: JSON.stringify(payload),
      });
      if (txForm.transaction_type === 'payment') {
        notificationService.ardoisePayment(selected?.client_name, parseFloat(txForm.amount));
      }
      setShowTx(false);
      setTxForm({ transaction_type: 'credit', amount: '', description: '', payment_method: 'cash' });
      await reloadSelected(accId);
      Alert.alert(
        txForm.transaction_type === 'credit' ? '💳 Consommation ajoutée' : '✅ Paiement enregistré',
        `Montant : ${fmt(Number(txForm.amount))}`
      );
    } catch { Alert.alert('Erreur', 'Transaction échouée'); }
    finally { setSaving(false); }
  };

  const handleWhatsApp = (acc) => {
    if (!acc.client_phone) {
      Alert.alert('Pas de numéro', 'Ce client n\'a pas de numéro WhatsApp enregistré.');
      return;
    }
    let phone = acc.client_phone.replace(/\s/g, '');
    if (phone.startsWith('0')) phone = '225' + phone;
    else if (!phone.startsWith('225') && !phone.startsWith('+')) phone = '225' + phone;
    phone = phone.replace('+', '');

    const message = encodeURIComponent(
      `Bonjour ${acc.client_name} 👋\n\n` +
      `Voici votre solde ardoise :\n\n` +
      `💳 *Total consommé :* ${fmt(acc.total_credit)}\n` +
      `✅ *Total payé :* ${fmt(acc.total_paid)}\n` +
      `⚠️ *Solde dû :* ${fmt(acc.balance)}\n\n` +
      (acc.credit_limit ? `📊 *Plafond :* ${fmt(acc.credit_limit)}\n\n` : '') +
      `Merci de régulariser votre situation 🙏\n` +
      `_Powered by SOKORA_`
    );
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${message}`);
  };

  const limitPct = (acc) => {
    if (!acc.credit_limit || acc.credit_limit <= 0) return 0;
    return Math.min((acc.balance / acc.credit_limit) * 100, 100);
  };

  const filtered = accounts.filter(a =>
    !search.trim() ||
    a.client_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.client_phone || '').includes(search)
  );

  // ── VUE DÉTAIL ──────────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const pct = limitPct(selected);
    const overLimit = selected.credit_limit && selected.balance >= selected.credit_limit;
    return (
      <View style={styles.container}>
        {/* Header */}
        <ScreenHeader
          navigation={navigation}
          title="Ardoise crédit"
          subtitle={selected.client_name}
          dark={true}
          onBack={() => setView('list')}
        />
        <View style={styles.detailHeader}>
          <Text style={styles.detailName}>{selected.client_name}</Text>
          <Text style={styles.detailPhone}>{selected.client_phone || 'Pas de numéro'}</Text>
          {selected.credit_limit ? (
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, color: C.muted, fontWeight: '600' }}>
                  Plafond : {fmt(selected.credit_limit)}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: pct >= 90 ? C.red : pct >= 70 ? C.orange : C.teal }}>
                  {Math.round(pct)}% utilisé
                </Text>
              </View>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: C.border }}>
                <View style={{ height: '100%', borderRadius: 3, width: `${pct}%`, backgroundColor: pct >= 90 ? C.red : pct >= 70 ? C.orange : C.teal }} />
              </View>
              {overLimit && (
                <Text style={{ fontSize: 11, color: C.red, fontWeight: '700', marginTop: 4 }}>
                  ⚠️ Plafond atteint — ne plus accorder de crédit
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {/* Soldes */}
        <View style={styles.balanceRow}>
          <View style={[styles.balanceCard, { backgroundColor: '#fff4ea' }]}>
            <Text style={[styles.balanceLbl, { color: C.orange }]}>Consommé</Text>
            <Text style={[styles.balanceVal, { color: C.orange }]}>{fmt(selected.total_credit)}</Text>
          </View>
          <View style={[styles.balanceCard, { backgroundColor: '#edfaf8' }]}>
            <Text style={[styles.balanceLbl, { color: C.teal }]}>Payé</Text>
            <Text style={[styles.balanceVal, { color: C.teal }]}>{fmt(selected.total_paid)}</Text>
          </View>
          <View style={[styles.balanceCard, { backgroundColor: selected.balance > 0 ? '#fff0f0' : '#edfaf8' }]}>
            <Text style={[styles.balanceLbl, { color: selected.balance > 0 ? C.red : C.teal }]}>Solde dû</Text>
            <Text style={[styles.balanceVal, { color: selected.balance > 0 ? C.red : C.teal }]}>{fmt(selected.balance)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: overLimit ? C.muted : C.orange }]}
            onPress={() => { setTxForm({ transaction_type: 'credit', amount: '', description: '', payment_method: 'cash' }); setShowTx(true); }}
            disabled={!!overLimit}
          >
            <Text style={styles.actionBtnTxt}>💳 Ardoise</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.teal }]} onPress={() => { setTxForm({ transaction_type: 'payment', amount: '', description: '', payment_method: 'cash' }); setShowTx(true); }}>
            <Text style={styles.actionBtnTxt}>✅ Paiement</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.green }]} onPress={() => handleWhatsApp(selected)}>
            <Text style={styles.actionBtnTxt}>📲 WA</Text>
          </TouchableOpacity>
        </View>

        {/* Historique */}
        <Text style={styles.sectionTitle}>Historique</Text>
        <FlatList
          data={txList}
          keyExtractor={i => String(i.id)}
          ListEmptyComponent={<Text style={styles.empty}>Aucune transaction</Text>}
          renderItem={({ item }) => {
            const isCredit = item.type === 'credit';
            const pmLabel = PAYMENT_METHODS.find(p => p.id === item.payment_method)?.label;
            return (
              <View style={styles.txRow}>
                <View style={[styles.txBadge, { backgroundColor: isCredit ? '#fff4ea' : '#edfaf8' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isCredit ? C.orange : C.teal }}>
                    {isCredit ? '💳 Ardoise' : '✅ Paiement'}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.txDesc}>{item.description || '—'}</Text>
                  {pmLabel && !isCredit && (
                    <Text style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>via {pmLabel}</Text>
                  )}
                  <Text style={styles.txDate}>{new Date(item.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <Text style={[styles.txAmt, { color: isCredit ? C.red : C.teal }]}>
                  {isCredit ? '+' : '-'}{fmt(item.amount)}
                </Text>
              </View>
            );
          }}
        />

        {/* Modal transaction */}
        <Modal visible={showTx} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {txForm.transaction_type === 'credit' ? '💳 Ajouter à l\'ardoise' : '✅ Enregistrer un paiement'}
              </Text>
              <Text style={styles.modalSub}>{selected.client_name} — Solde actuel : {fmt(selected.balance)}</Text>

              <Text style={styles.label}>Montant (F CFA)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="0"
                value={txForm.amount}
                onChangeText={v => setTxForm({ ...txForm, amount: v })}
              />

              {txForm.transaction_type === 'payment' && (
                <>
                  <Text style={styles.label}>Mode de paiement</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                    {PAYMENT_METHODS.map(pm => (
                      <TouchableOpacity
                        key={pm.id}
                        style={[styles.pmBtn, txForm.payment_method === pm.id && styles.pmBtnActive]}
                        onPress={() => setTxForm({ ...txForm, payment_method: pm.id })}
                      >
                        <Text style={{ fontSize: 14 }}>{pm.icon}</Text>
                        <Text style={[styles.pmBtnTxt, txForm.payment_method === pm.id && { color: '#fff' }]}>
                          {pm.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>Description (optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder={txForm.transaction_type === 'credit' ? 'ex: Repas midi, Boissons...' : 'ex: Règlement semaine'}
                value={txForm.description}
                onChangeText={v => setTxForm({ ...txForm, description: v })}
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: txForm.transaction_type === 'credit' ? C.orange : C.teal, opacity: saving ? 0.6 : 1 }]}
                  onPress={handleTx} disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalBtnTxt}>Enregistrer</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.border }]} onPress={() => setShowTx(false)}>
                  <Text style={[styles.modalBtnTxt, { color: C.navy }]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── VUE LISTE ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScreenHeader navigation={navigation} title="Ardoise crédit" dark={true} />
      {/* Barre recherche + nouveau */}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Rechercher un client..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={C.faint}
        />
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowNew(true)}>
          <Text style={styles.newBtnTxt}>＋</Text>
        </TouchableOpacity>
      </View>

      {loading
        ? <ActivityIndicator color={C.orange} size="large" style={{ marginTop: 40 }} />
        : <FlatList
            data={filtered.sort((a, b) => b.balance - a.balance)}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={{ paddingBottom: 30 }}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTxt}>Aucune ardoise</Text>
                <Text style={styles.emptySub}>Appuyez sur ＋ pour ouvrir une ardoise</Text>
              </View>
            }
            renderItem={({ item }) => {
              const pct = limitPct(item);
              const overLimit = item.credit_limit && item.balance >= item.credit_limit;
              return (
                <TouchableOpacity style={styles.card} onPress={() => loadDetail(item)} activeOpacity={0.8}>
                  {/* Avatar + Nom */}
                  <View style={[styles.avatar, { backgroundColor: overLimit ? C.red : item.balance > 0 ? C.orange : C.teal }]}>
                    <Text style={styles.avatarTxt}>{item.client_name[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.clientName}>{item.client_name}</Text>
                    <Text style={styles.clientPhone}>{item.client_phone || 'Pas de numéro'}</Text>
                    {item.credit_limit ? (
                      <View style={{ marginTop: 5 }}>
                        <View style={{ height: 3, borderRadius: 2, backgroundColor: C.border }}>
                          <View style={{ height: '100%', borderRadius: 2, width: `${pct}%`, backgroundColor: pct >= 90 ? C.red : pct >= 70 ? C.orange : C.teal }} />
                        </View>
                        <Text style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
                          {Math.round(pct)}% du plafond ({fmt(item.credit_limit)})
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {/* Solde */}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.balance, { color: item.balance > 0 ? C.red : C.teal }]}>
                      {fmt(item.balance)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: overLimit ? '#fff0f0' : item.balance > 0 ? '#fff4ea' : '#edfaf8' }]}>
                      <Text style={[styles.statusTxt, { color: overLimit ? C.red : item.balance > 0 ? C.orange : C.teal }]}>
                        {overLimit ? '🚨 Dépassé' : item.balance > 0 ? '⚠️ Doit' : '✅ Soldé'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
      }

      {/* Modal nouvelle ardoise */}
      <Modal visible={showNew} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>📋 Nouvelle ardoise</Text>

            <Text style={styles.label}>Nom du client *</Text>
            <TextInput
              style={styles.input}
              placeholder="Konan Aya"
              value={newForm.client_name}
              onChangeText={v => setNewForm({ ...newForm, client_name: v })}
              autoFocus
            />
            <Text style={styles.label}>Téléphone WhatsApp</Text>
            <TextInput
              style={styles.input}
              placeholder="0700000000"
              keyboardType="phone-pad"
              value={newForm.client_phone}
              onChangeText={v => setNewForm({ ...newForm, client_phone: v })}
            />
            <Text style={styles.label}>Plafond de crédit (F CFA — optionnel)</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: 50000"
              keyboardType="numeric"
              value={newForm.credit_limit}
              onChangeText={v => setNewForm({ ...newForm, credit_limit: v })}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.orange, opacity: saving ? 0.6 : 1 }]}
                onPress={handleCreate} disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalBtnTxt}>Créer</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.border }]} onPress={() => setShowNew(false)}>
                <Text style={[styles.modalBtnTxt, { color: C.navy }]}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg, padding: 14 },
  toolbar:      { flexDirection: 'row', gap: 10, marginBottom: 14 },
  searchInput:  { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 12, fontSize: 14, color: C.navy, borderWidth: 1.5, borderColor: C.border },
  newBtn:       { width: 46, height: 46, backgroundColor: C.orange, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  newBtnTxt:    { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: -2 },
  card:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  avatar:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:    { color: '#fff', fontWeight: '800', fontSize: 18 },
  clientName:   { fontWeight: '700', fontSize: 15, color: C.navy },
  clientPhone:  { fontSize: 12, color: C.muted, marginTop: 2 },
  balance:      { fontWeight: '800', fontSize: 16 },
  statusBadge:  { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 3 },
  statusTxt:    { fontSize: 11, fontWeight: '700' },
  emptyBox:     { alignItems: 'center', marginTop: 60 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyTxt:     { fontSize: 16, fontWeight: '700', color: C.navy },
  emptySub:     { fontSize: 13, color: C.muted, marginTop: 4 },
  // Detail
  detailHeader: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12 },
  backBtn:      { marginBottom: 8 },
  backTxt:      { color: C.orange, fontWeight: '700', fontSize: 14 },
  detailName:   { fontSize: 20, fontWeight: '800', color: C.navy },
  detailPhone:  { fontSize: 13, color: C.muted, marginTop: 2 },
  balanceRow:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  balanceCard:  { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  balanceLbl:   { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  balanceVal:   { fontSize: 15, fontWeight: '800', marginTop: 4 },
  actionRow:    { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionBtn:    { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  actionBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.navy, marginBottom: 10 },
  txRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 8 },
  txBadge:      { borderRadius: 8, padding: 6 },
  txDesc:       { fontSize: 13, color: C.navy, fontWeight: '600' },
  txDate:       { fontSize: 11, color: C.muted, marginTop: 2 },
  txAmt:        { fontWeight: '800', fontSize: 14 },
  empty:        { textAlign: 'center', color: C.muted, marginTop: 20, fontSize: 13 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,30,53,.6)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: C.navy, marginBottom: 4 },
  modalSub:     { fontSize: 13, color: C.muted, marginBottom: 20 },
  label:        { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:        { backgroundColor: C.bg, borderRadius: 10, padding: 12, fontSize: 15, color: C.navy, marginBottom: 14, borderWidth: 1.5, borderColor: C.border },
  modalBtns:    { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalBtn:     { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnTxt:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Payment methods
  pmBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg },
  pmBtnActive:  { backgroundColor: C.teal, borderColor: C.teal },
  pmBtnTxt:     { fontSize: 12, fontWeight: '600', color: C.navy },
});
