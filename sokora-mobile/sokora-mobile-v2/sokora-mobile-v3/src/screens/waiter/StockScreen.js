import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, TextInput, Alert, ActivityIndicator,
  RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, Shadow } from '../../utils/constants';
import { API_URL } from '../../utils/constants';
import * as SecureStore from 'expo-secure-store';

const fmt  = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';
const fmtN = n => new Intl.NumberFormat('fr-FR').format(n ?? 0);

async function getHeaders() {
  const token = await SecureStore.getItemAsync('sokora_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const STATUS_CONFIG = {
  ok:  { label: 'OK',       color: '#22C55E', bg: '#F0FDF4', icon: 'checkmark-circle' },
  low: { label: 'Bas',      color: '#F97316', bg: '#FFF7ED', icon: 'warning' },
  out: { label: 'Rupture',  color: '#EF4444', bg: '#FEF2F2', icon: 'close-circle' },
};

export default function StockScreen({ navigation }) {
  const [stock,      setStock]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('all'); // all | low | out
  const [search,     setSearch]     = useState('');

  // Modal ajustement stock
  const [showModal,  setShowModal]  = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [adjQty,     setAdjQty]     = useState('');
  const [adjType,    setAdjType]    = useState('add'); // add | set | remove
  const [adjNote,    setAdjNote]    = useState('');
  const [saving,     setSaving]     = useState(false);

  // Modal seuil alerte
  const [showSettings, setShowSettings] = useState(false);
  const [threshold,    setThreshold]    = useState('');
  const [unit,         setUnit]         = useState('pcs');

  const load = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/stock`, { headers });
      const data = await res.json();
      setStock(Array.isArray(data) ? data : []);
    } catch { setStock([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdjust = async () => {
    if (!adjQty || !selected) return;
    const qty = Number(adjQty);
    if (isNaN(qty) || qty <= 0) { Alert.alert('Erreur', 'Quantité invalide'); return; }
    setSaving(true);
    try {
      const headers = await getHeaders();
      let newQty = selected.stock_quantity;
      if (adjType === 'add')    newQty = selected.stock_quantity + qty;
      else if (adjType === 'remove') newQty = Math.max(0, selected.stock_quantity - qty);
      else newQty = qty;

      await fetch(`${API_URL}/stock/${selected.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ stock_quantity: newQty }),
      });
      setShowModal(false);
      setAdjQty(''); setAdjNote('');
      load();
      Alert.alert('Stock mis à jour', `${selected.name} : ${fmtN(newQty)} ${selected.stock_unit}`);
    } catch { Alert.alert('Erreur', 'Impossible de mettre à jour le stock'); }
    finally { setSaving(false); }
  };

  const handleSaveSettings = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const headers = await getHeaders();
      await fetch(`${API_URL}/stock/${selected.id}/settings`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          stock_alert_threshold: Number(threshold) || 5,
          stock_unit: unit,
        }),
      });
      setShowSettings(false);
      load();
      Alert.alert('Paramètres sauvegardés', `Seuil alerte : ${threshold} ${unit}`);
    } catch { Alert.alert('Erreur', 'Impossible de sauvegarder'); }
    finally { setSaving(false); }
  };

  const openAdjust = (item) => {
    setSelected(item);
    setAdjQty('');
    setAdjType('add');
    setAdjNote('');
    setShowModal(true);
  };

  const openSettings = (item) => {
    setSelected(item);
    setThreshold(String(item.stock_alert_threshold || 5));
    setUnit(item.stock_unit || 'pcs');
    setShowSettings(true);
  };

  // Stats rapides
  const totalItems   = stock.length;
  const lowItems     = stock.filter(s => s.status === 'low').length;
  const outItems     = stock.filter(s => s.status === 'out').length;
  const totalValue   = stock.reduce((s, i) => s + ((i.stock_quantity||0) * (i.purchase_price||0)), 0);

  const filtered = stock
    .filter(s => filter === 'all' || s.status === filter)
    .filter(s => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
      <ActivityIndicator size="large" color={Colors.orange} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Stock & Inventaire</Text>
          <Text style={styles.headerSub}>{totalItems} produits</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8, marginRight: 8 }}
            onPress={() => navigation.navigate('Inventory')}
          >
            <Ionicons name="clipboard-outline" size={20} color="#fff" />
          </TouchableOpacity>
          {(lowItems + outItems) > 0 && (
            <View style={styles.alertBadge}>
              <Ionicons name="warning" size={14} color="#fff" />
              <Text style={styles.alertBadgeText}>{lowItems + outItems}</Text>
            </View>
          )}
        </View>
      </View>

      {/* KPIs */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { borderTopColor: Colors.orange }]}>
          <Text style={styles.kpiVal}>{fmtN(totalValue)} F</Text>
          <Text style={styles.kpiLbl}>Valeur stock</Text>
        </View>
        <View style={[styles.kpiCard, { borderTopColor: '#22C55E' }]}>
          <Text style={[styles.kpiVal, { color: '#22C55E' }]}>{totalItems - lowItems - outItems}</Text>
          <Text style={styles.kpiLbl}>En stock</Text>
        </View>
        <View style={[styles.kpiCard, { borderTopColor: '#F97316' }]}>
          <Text style={[styles.kpiVal, { color: '#F97316' }]}>{lowItems}</Text>
          <Text style={styles.kpiLbl}>Stock bas</Text>
        </View>
        <View style={[styles.kpiCard, { borderTopColor: '#EF4444' }]}>
          <Text style={[styles.kpiVal, { color: '#EF4444' }]}>{outItems}</Text>
          <Text style={styles.kpiLbl}>Rupture</Text>
        </View>
      </View>

      {/* FILTRES + RECHERCHE */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor={Colors.textFaint}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>
      <View style={styles.filterRow}>
        {[
          { id: 'all', label: 'Tous' },
          { id: 'low', label: 'Stock bas' },
          { id: 'out', label: 'Rupture' },
        ].map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterBtn, filter === f.id && styles.filterBtnActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterBtnText, filter === f.id && styles.filterBtnTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LISTE */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.orange} />}
        contentContainerStyle={{ padding: Spacing.xl, gap: 10, paddingBottom: 60 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="cube-outline" size={48} color={Colors.textFaint} />
            <Text style={{ color: Colors.textMuted, marginTop: 12, fontSize: 15 }}>Aucun produit</Text>
          </View>
        }
        renderItem={({ item }) => {
          const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.ok;
          const margin = item.price - item.purchase_price;
          const marginPct = item.purchase_price > 0 ? Math.round((margin / item.purchase_price) * 100) : 0;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                {/* Status icon */}
                <View style={[styles.statusIcon, { backgroundColor: st.bg }]}>
                  <Ionicons name={st.icon} size={20} color={st.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceAchat}>Achat: {fmt(item.purchase_price)}</Text>
                    <Text style={styles.priceSell}>Vente: {fmt(item.price)}</Text>
                    <Text style={[styles.margin, { color: marginPct >= 50 ? '#22C55E' : '#F97316' }]}>
                      +{marginPct}%
                    </Text>
                  </View>
                </View>
                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.settingsBtn} onPress={() => openSettings(item)}>
                    <Ionicons name="settings-outline" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.cardBottom}>
                {/* Stock bar */}
                <View style={styles.stockBarWrap}>
                  <View style={[styles.stockBar, {
                    width: `${Math.min(100, (item.stock_quantity / Math.max(item.stock_quantity, item.stock_alert_threshold * 4)) * 100)}%`,
                    backgroundColor: st.color,
                  }]} />
                </View>
                <View style={styles.stockRow}>
                  <Text style={[styles.stockQty, { color: st.color }]}>
                    {fmtN(item.stock_quantity)} {item.stock_unit}
                  </Text>
                  <Text style={styles.stockThreshold}>seuil: {item.stock_alert_threshold}</Text>
                  <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusPillText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                {/* Boutons ajustement */}
                <View style={styles.adjRow}>
                  <TouchableOpacity
                    style={[styles.adjBtn, { backgroundColor: '#FEF2F2' }]}
                    onPress={() => { setSelected(item); setAdjQty('1'); setAdjType('remove'); setAdjNote(''); setShowModal(true); }}
                  >
                    <Ionicons name="remove" size={18} color="#EF4444" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.adjBtn, styles.adjBtnPrimary]}
                    onPress={() => openAdjust(item)}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.adjBtnText}>Ajuster</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* MODAL AJUSTEMENT */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajuster le stock</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={Colors.navy} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalProduct}>{selected?.name}</Text>
            <Text style={styles.modalCurrent}>
              Stock actuel : <Text style={{ color: Colors.orange, fontWeight: '800' }}>{fmtN(selected?.stock_quantity)} {selected?.stock_unit}</Text>
            </Text>

            {/* Type d'ajustement */}
            <Text style={styles.modalLabel}>TYPE D'AJUSTEMENT</Text>
            <View style={styles.adjTypeRow}>
              {[
                { id: 'add',    label: 'Ajouter',   color: '#22C55E' },
                { id: 'remove', label: 'Retirer',   color: '#EF4444' },
                { id: 'set',    label: 'Définir',   color: '#8B5CF6' },
              ].map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.adjTypeBtn, adjType === t.id && { backgroundColor: t.color, borderColor: t.color }]}
                  onPress={() => setAdjType(t.id)}
                >
                  <Text style={[styles.adjTypeBtnText, adjType === t.id && { color: '#fff' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>QUANTITÉ</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0"
              keyboardType="numeric"
              value={adjQty}
              onChangeText={setAdjQty}
              autoFocus
            />

            <Text style={styles.modalLabel}>NOTE (optionnel)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Livraison fournisseur, casse..."
              value={adjNote}
              onChangeText={setAdjNote}
            />

            <TouchableOpacity
              style={[styles.confirmBtn, saving && { opacity: 0.7 }]}
              onPress={handleAdjust}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Confirmer</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL PARAMÈTRES */}
      <Modal visible={showSettings} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Paramètres stock</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={Colors.navy} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalProduct}>{selected?.name}</Text>

            <Text style={styles.modalLabel}>SEUIL D'ALERTE</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="5"
              keyboardType="numeric"
              value={threshold}
              onChangeText={setThreshold}
              autoFocus
            />

            <Text style={styles.modalLabel}>UNITÉ</Text>
            <View style={styles.unitRow}>
              {['pcs', 'kg', 'L', 'bouteille', 'portion'].map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, saving && { opacity: 0.7 }]}
              onPress={handleSaveSettings}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Sauvegarder</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    backgroundColor: Colors.navy, paddingTop: 54, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
  },
  headerTitle:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  headerRight:  { marginLeft: 'auto' },
  alertBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EF4444', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  alertBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  kpiRow:   { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  kpiCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10,
    alignItems: 'center', borderTopWidth: 3, ...Shadow.sm,
  },
  kpiVal:   { fontSize: 14, fontWeight: '800', color: Colors.navy },
  kpiLbl:   { fontSize: 9, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },

  toolbar:  { paddingHorizontal: 16, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.navy },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
  },
  filterBtnActive:     { backgroundColor: Colors.orange, borderColor: Colors.orange },
  filterBtnText:       { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  filterBtnTextActive: { color: '#fff' },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
    overflow: 'hidden', ...Shadow.sm,
  },
  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
  statusIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  productName:{ fontSize: 15, fontWeight: '700', color: Colors.navy },
  priceRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  priceAchat: { fontSize: 11, color: Colors.textMuted },
  priceSell:  { fontSize: 11, color: Colors.textMuted },
  margin:     { fontSize: 11, fontWeight: '700' },
  cardActions:{ alignItems: 'center' },
  settingsBtn:{ padding: 6 },

  cardBottom:   { borderTopWidth: 1, borderTopColor: '#F1F5F9', padding: 14, paddingTop: 10, gap: 8 },
  stockBarWrap: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, overflow: 'hidden' },
  stockBar:     { height: 4, borderRadius: 2 },
  stockRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stockQty:     { fontSize: 15, fontWeight: '800', flex: 1 },
  stockThreshold: { fontSize: 11, color: Colors.textMuted },
  statusPill:   { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText:{ fontSize: 11, fontWeight: '700' },

  adjRow:       { flexDirection: 'row', gap: 8 },
  adjBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  adjBtnPrimary: {
    flex: 1, flexDirection: 'row', gap: 6,
    backgroundColor: Colors.orange, borderRadius: 10,
  },
  adjBtnText:   { color: '#fff', fontWeight: '700', fontSize: 13 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(26,46,74,0.7)', justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 44,
  },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: Colors.navy },
  modalProduct: { fontSize: 16, fontWeight: '700', color: Colors.orange, marginBottom: 4 },
  modalCurrent: { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },
  modalLabel:   { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 8 },
  modalInput: {
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5,
    borderColor: '#E2E8F0', padding: 14, fontSize: 16,
    color: Colors.navy, marginBottom: 16,
  },
  adjTypeRow:   { flexDirection: 'row', gap: 8, marginBottom: 16 },
  adjTypeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  adjTypeBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  unitRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  unitBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  unitBtnActive:    { backgroundColor: Colors.navy, borderColor: Colors.navy },
  unitBtnText:      { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  unitBtnTextActive:{ color: '#fff' },
  confirmBtn: {
    backgroundColor: Colors.orange, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
