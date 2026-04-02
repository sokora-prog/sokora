import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Alert, ActivityIndicator, ScrollView, Share, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Shadow } from '../../utils/constants';
import { API_URL } from '../../utils/constants';
import * as SecureStore from 'expo-secure-store';

const fmt  = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';
const fmtN = n => new Intl.NumberFormat('fr-FR').format(n ?? 0);

async function getHeaders() {
  const token = await SecureStore.getItemAsync('sokora_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export default function InventoryScreen({ navigation }) {
  const [stock,      setStock]      = useState([]);
  const [counts,     setCounts]     = useState({});  // { product_id: counted_qty }
  const [broken,     setBroken]     = useState({});  // { product_id: broken_qty }
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]     = useState(null);
  const [orderList,  setOrderList]  = useState(null);
  const [view,       setView]       = useState('count'); // count | result | order
  const [activeEdit, setActiveEdit] = useState(null);   // { id, field }

  const load = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/stock`, { headers });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setStock(arr);
      const initCounts = {}, initBroken = {};
      arr.forEach(p => { initCounts[p.id] = p.stock_quantity; initBroken[p.id] = 0; });
      setCounts(initCounts);
      setBroken(initBroken);
    } catch { setStock([]); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setCount  = (id, val) => setCounts(prev => ({ ...prev, [id]: Math.max(0, Number(val) || 0) }));
  const setBrok   = (id, val) => setBroken(prev => ({ ...prev, [id]: Math.max(0, Number(val) || 0) }));

  const handleSubmit = () => {
    Alert.alert(
      'Valider l\'inventaire',
      'Le stock sera mis à jour avec les quantités saisies. Continuer ?',
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Valider', onPress: doSubmit }]
    );
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const headers = await getHeaders();
      const items = stock.map(p => ({
        product_id:  p.id,
        counted_qty: Number(counts[p.id] ?? p.stock_quantity),
        broken_qty:  Number(broken[p.id] ?? 0),
      }));
      const res = await fetch(`${API_URL}/stock/inventory`, {
        method: 'POST', headers,
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      setResult(data);
      setView('result');
    } catch { Alert.alert('Erreur', 'Inventaire impossible'); }
    finally { setSubmitting(false); }
  };

  const loadOrderList = async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/stock/order-list`, { headers });
      const data = await res.json();
      setOrderList(data);
      setView('order');
    } catch { Alert.alert('Erreur', 'Impossible de générer la liste'); }
  };

  const buildWhatsAppMsg = () => {
    if (!orderList) return '';
    const lines = [
      `*COMMANDE FOURNISSEUR — SOKORA*`,
      `Date : ${orderList.date}`,
      `─────────────────────`,
      ...(orderList.items || []).map((item, i) =>
        `${i + 1}. *${item.product_name}*\n   Stock actuel : ${fmtN(item.current_stock)} ${item.stock_unit}\n   A commander : *${fmtN(item.reorder_qty)} ${item.stock_unit}*\n   Cout : ${fmt(item.estimated_cost)}`
      ),
      `─────────────────────`,
      `*TOTAL ESTIME : ${fmt(orderList.total_estimated_cost)}*`,
      `_Genere par SOKORA_`,
    ].join('\n');
    return lines;
  };

  const sendWhatsApp = async () => {
    const msg = buildWhatsAppMsg();
    try { await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`); }
    catch { await Share.share({ message: msg }); }
  };

  // ── VUE RÉSULTAT ──────────────────────────────────────────────
  if (view === 'result' && result) return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { setView('count'); load(); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Résultat inventaire</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>

        {/* Résumé global */}
        <View style={styles.resultCard}>
          <Text style={styles.resultDate}>{result.date_label}</Text>
          <View style={styles.resultKpis}>
            <View style={[styles.resultKpi, { borderTopColor: '#22C55E' }]}>
              <Text style={[styles.resultKpiVal, { color: '#22C55E' }]}>{result.total_sold}</Text>
              <Text style={styles.resultKpiLbl}>Vendus</Text>
            </View>
            <View style={[styles.resultKpi, { borderTopColor: '#F97316' }]}>
              <Text style={[styles.resultKpiVal, { color: '#F97316' }]}>{result.total_broken}</Text>
              <Text style={styles.resultKpiLbl}>Cassés</Text>
            </View>
            <View style={[styles.resultKpi, { borderTopColor: '#EF4444' }]}>
              <Text style={[styles.resultKpiVal, { color: '#EF4444' }]}>{result.deficit_count}</Text>
              <Text style={styles.resultKpiLbl}>Déficits</Text>
            </View>
            <View style={[styles.resultKpi, { borderTopColor: '#8B5CF6' }]}>
              <Text style={[styles.resultKpiVal, { color: '#8B5CF6' }]}>{result.to_order_count}</Text>
              <Text style={styles.resultKpiLbl}>À commander</Text>
            </View>
          </View>
          {result.total_variance_value !== 0 && (
            <View style={[styles.varianceRow, { backgroundColor: result.total_variance_value < 0 ? '#FEF2F2' : '#F0FDF4' }]}>
              <Text style={styles.varianceLbl}>Écart de valeur</Text>
              <Text style={[styles.varianceVal, { color: result.total_variance_value < 0 ? '#EF4444' : '#22C55E' }]}>
                {result.total_variance_value >= 0 ? '+' : ''}{fmt(result.total_variance_value)}
              </Text>
            </View>
          )}
        </View>

        {/* Casses */}
        {result.broken_items?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🍾 Casses / Pertes</Text>
            <View style={styles.card}>
              {result.broken_items.map((item, i) => (
                <View key={i} style={[styles.varRow, i > 0 && styles.varRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.varName}>{item.product_name}</Text>
                    <Text style={styles.varDetail}>
                      Vendu : {item.sold_qty} • Cassé : {item.broken_qty} {item.stock_unit}
                    </Text>
                  </View>
                  <Text style={[styles.varAmount, { color: '#F97316' }]}>
                    -{item.broken_qty} {item.stock_unit}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Déficits inexpliqués */}
        {result.deficit_items?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Déficits inexpliqués</Text>
            <View style={styles.card}>
              {result.deficit_items.map((item, i) => (
                <View key={i} style={[styles.varRow, i > 0 && styles.varRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.varName}>{item.product_name}</Text>
                    <Text style={styles.varDetail}>
                      Avant : {item.stock_before} → Compté : {item.counted_qty} {item.stock_unit}
                    </Text>
                  </View>
                  <Text style={[styles.varAmount, { color: '#EF4444' }]}>
                    {item.variance} {item.stock_unit}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Surplus */}
        {result.surplus_items?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✅ Surplus</Text>
            <View style={styles.card}>
              {result.surplus_items.map((item, i) => (
                <View key={i} style={[styles.varRow, i > 0 && styles.varRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.varName}>{item.product_name}</Text>
                    <Text style={styles.varDetail}>
                      Avant : {item.stock_before} → Compté : {item.counted_qty} {item.stock_unit}
                    </Text>
                  </View>
                  <Text style={[styles.varAmount, { color: '#22C55E' }]}>
                    +{item.variance} {item.stock_unit}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* À commander */}
        {result.to_order?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛒 Produits à commander ({result.to_order_count})</Text>
            <View style={styles.card}>
              {result.to_order.map((item, i) => (
                <View key={i} style={[styles.varRow, i > 0 && styles.varRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.varName}>{item.product_name}</Text>
                    <Text style={styles.varDetail}>
                      Stock : {item.counted_qty} • Seuil réappro : {item.reorder_qty + item.counted_qty}
                    </Text>
                  </View>
                  <Text style={[styles.varAmount, { color: Colors.orange }]}>
                    +{item.reorder_qty}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.orderBtn} onPress={loadOrderList}>
          <Ionicons name="cart-outline" size={20} color="#fff" />
          <Text style={styles.orderBtnText}>Générer liste fournisseur complète</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ── VUE LISTE FOURNISSEUR ─────────────────────────────────────
  if (view === 'order' && orderList) return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('result')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Commande fournisseur</Text>
          <Text style={styles.headerSub}>{orderList.total_items} produit(s)</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={() => Share.share({ message: buildWhatsAppMsg() })}>
          <Ionicons name="share-outline" size={20} color={Colors.orange} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 60 }}>
        <View style={styles.orderSummary}>
          <Text style={styles.orderSummaryLabel}>COÛT ESTIMÉ TOTAL</Text>
          <Text style={styles.orderSummaryAmount}>{fmt(orderList.total_estimated_cost)}</Text>
        </View>

        {orderList.total_items === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
            <Text style={styles.emptyTitle}>Stock suffisant</Text>
            <Text style={styles.emptySub}>Tous les produits sont au-dessus du seuil de réappro</Text>
          </View>
        ) : (
          orderList.items.map((item, i) => (
            <View key={i} style={[styles.orderItem, { borderLeftColor: item.status === 'out' ? '#EF4444' : '#F97316' }]}>
              <View style={styles.orderItemTop}>
                <View style={[styles.urgencyBadge, { backgroundColor: item.status === 'out' ? '#FEF2F2' : '#FFF7ED' }]}>
                  <Text style={[styles.urgencyText, { color: item.status === 'out' ? '#EF4444' : '#F97316' }]}>
                    {item.status === 'out' ? 'RUPTURE' : 'STOCK BAS'}
                  </Text>
                </View>
                <Text style={styles.orderItemName}>{item.product_name}</Text>
              </View>
              <View style={styles.orderItemDetails}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderItemStock}>
                    Stock : <Text style={{ color: '#EF4444', fontWeight: '700' }}>{fmtN(item.current_stock)}</Text> {item.stock_unit}
                  </Text>
                  <Text style={styles.orderItemSuggested}>
                    Commander : <Text style={{ color: Colors.orange, fontWeight: '800' }}>{fmtN(item.reorder_qty)}</Text> {item.stock_unit}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.orderItemCost}>{fmt(item.estimated_cost)}</Text>
                  <Text style={styles.orderItemUnit}>{fmt(item.purchase_price)}/u</Text>
                </View>
              </View>
            </View>
          ))
        )}

        {orderList.total_items > 0 && (
          <TouchableOpacity style={[styles.orderBtn, { backgroundColor: '#25D366' }]} onPress={sendWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.orderBtnText}>Envoyer par WhatsApp</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );

  // ── VUE COMPTAGE ──────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Inventaire</Text>
          <Text style={styles.headerSub}>Compté + Cassé par produit</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={loadOrderList}>
          <Ionicons name="cart-outline" size={20} color={Colors.orange} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : (
        <>
          <FlatList
            data={stock}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
            ListHeaderComponent={
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.orange }]} />
                  <Text style={styles.legendText}>Compté = quantité physique réelle</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendText}>Cassé = bouteilles/unités perdues</Text>
                </View>
              </View>
            }
            renderItem={({ item }) => {
              const counted = Number(counts[item.id] ?? item.stock_quantity);
              const brok    = Number(broken[item.id] ?? 0);
              const sold    = Math.max(0, item.stock_quantity - counted - brok);
              const isEditCount  = activeEdit?.id === item.id && activeEdit?.field === 'count';
              const isEditBroken = activeEdit?.id === item.id && activeEdit?.field === 'broken';

              return (
                <View style={styles.countCard}>
                  <View style={styles.countCardTop}>
                    <Text style={styles.countName}>{item.name}</Text>
                    <View style={styles.stockBeforeTag}>
                      <Text style={styles.stockBeforeText}>Stock : {fmtN(item.stock_quantity)} {item.stock_unit}</Text>
                    </View>
                  </View>

                  <View style={styles.fieldsRow}>
                    {/* Compté */}
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>COMPTÉ</Text>
                      <View style={styles.fieldInputRow}>
                        <TouchableOpacity
                          style={styles.stepMinus}
                          onPress={() => setCount(item.id, counted - 1)}
                        >
                          <Ionicons name="remove" size={16} color="#EF4444" />
                        </TouchableOpacity>
                        {isEditCount ? (
                          <TextInput
                            style={styles.fieldInput}
                            value={String(counted)}
                            keyboardType="numeric"
                            autoFocus
                            onChangeText={v => setCount(item.id, v)}
                            onBlur={() => setActiveEdit(null)}
                            onSubmitEditing={() => setActiveEdit(null)}
                          />
                        ) : (
                          <TouchableOpacity onPress={() => setActiveEdit({ id: item.id, field: 'count' })}>
                            <Text style={[styles.fieldVal, { color: Colors.orange }]}>{fmtN(counted)}</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.stepPlus}
                          onPress={() => setCount(item.id, counted + 1)}
                        >
                          <Ionicons name="add" size={16} color={Colors.orange} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Cassé */}
                    <View style={[styles.fieldBlock, { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' }]}>
                      <Text style={[styles.fieldLabel, { color: '#EF4444' }]}>CASSÉ</Text>
                      <View style={styles.fieldInputRow}>
                        <TouchableOpacity
                          style={styles.stepMinus}
                          onPress={() => setBrok(item.id, brok - 1)}
                        >
                          <Ionicons name="remove" size={16} color="#EF4444" />
                        </TouchableOpacity>
                        {isEditBroken ? (
                          <TextInput
                            style={styles.fieldInput}
                            value={String(brok)}
                            keyboardType="numeric"
                            autoFocus
                            onChangeText={v => setBrok(item.id, v)}
                            onBlur={() => setActiveEdit(null)}
                            onSubmitEditing={() => setActiveEdit(null)}
                          />
                        ) : (
                          <TouchableOpacity onPress={() => setActiveEdit({ id: item.id, field: 'broken' })}>
                            <Text style={[styles.fieldVal, { color: brok > 0 ? '#EF4444' : Colors.textFaint }]}>
                              {fmtN(brok)}
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.stepPlus}
                          onPress={() => setBrok(item.id, brok + 1)}
                        >
                          <Ionicons name="add" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Calculé automatiquement */}
                  <View style={styles.calcRow}>
                    <View style={styles.calcItem}>
                      <Text style={styles.calcLabel}>Vendus estimés</Text>
                      <Text style={[styles.calcVal, { color: '#22C55E' }]}>{sold}</Text>
                    </View>
                    {brok > 0 && (
                      <View style={styles.calcItem}>
                        <Text style={styles.calcLabel}>Perte casse</Text>
                        <Text style={[styles.calcVal, { color: '#F97316' }]}>{fmt(brok * item.purchase_price)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.submitBar}>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>Valider l'inventaire ({stock.length} produits)</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    backgroundColor: Colors.navy, paddingTop: 54, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  legend: {
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, gap: 6, marginBottom: 6,
  },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontSize: 12, color: '#3B82F6' },

  countCard: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
    padding: 14, gap: 12, ...Shadow.sm,
  },
  countCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countName:    { fontSize: 15, fontWeight: '700', color: Colors.navy, flex: 1 },
  stockBeforeTag: {
    backgroundColor: '#F1F5F9', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  stockBeforeText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  fieldsRow:   { flexDirection: 'row', gap: 0 },
  fieldBlock:  { flex: 1, alignItems: 'center', paddingHorizontal: 8, gap: 6 },
  fieldLabel:  { fontSize: 10, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1 },
  fieldInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepMinus:   { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  stepPlus:    { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  fieldVal:    { fontSize: 22, fontWeight: '800', minWidth: 40, textAlign: 'center' },
  fieldInput:  { fontSize: 22, fontWeight: '800', color: Colors.orange, minWidth: 50, textAlign: 'center' },

  calcRow:     { flexDirection: 'row', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  calcItem:    { flex: 1, alignItems: 'center' },
  calcLabel:   { fontSize: 10, color: Colors.textMuted },
  calcVal:     { fontSize: 14, fontWeight: '800', marginTop: 2 },

  submitBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16,
    borderTopWidth: 1, borderTopColor: '#E2E8F0',
  },
  submitBtn: {
    backgroundColor: Colors.orange, borderRadius: 16,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Résultat
  resultCard: {
    backgroundColor: Colors.navy, borderRadius: 20, padding: 20, gap: 16,
  },
  resultDate:    { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  resultKpis:    { flexDirection: 'row', gap: 8 },
  resultKpi: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 10, alignItems: 'center', borderTopWidth: 3,
  },
  resultKpiVal:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  resultKpiLbl:  { fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2, textAlign: 'center' },
  varianceRow: {
    borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  varianceLbl:   { fontSize: 13, fontWeight: '700', color: Colors.navy },
  varianceVal:   { fontSize: 18, fontWeight: '800' },
  section:       { gap: 8 },
  sectionTitle:  { fontSize: 15, fontWeight: '800', color: Colors.navy },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden',
  },
  varRow:        { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  varRowBorder:  { borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  varName:       { fontSize: 14, fontWeight: '700', color: Colors.navy },
  varDetail:     { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  varAmount:     { fontSize: 16, fontWeight: '800' },
  orderBtn: {
    backgroundColor: Colors.orange, borderRadius: 16,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  orderBtnText:  { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Commande fournisseur
  orderSummary:  { backgroundColor: Colors.navy, borderRadius: 16, padding: 20, alignItems: 'center' },
  orderSummaryLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 },
  orderSummaryAmount: { fontSize: 32, fontWeight: '800', color: Colors.orange, marginTop: 4 },
  orderItem: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 4,
    padding: 14, gap: 8,
  },
  orderItemTop:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  urgencyBadge:      { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  urgencyText:       { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  orderItemName:     { fontSize: 15, fontWeight: '700', color: Colors.navy, flex: 1 },
  orderItemDetails:  { flexDirection: 'row', alignItems: 'center' },
  orderItemStock:    { fontSize: 12, color: Colors.textMuted },
  orderItemSuggested:{ fontSize: 13, fontWeight: '600', color: Colors.navy, marginTop: 2 },
  orderItemCost:     { fontSize: 15, fontWeight: '800', color: Colors.navy },
  orderItemUnit:     { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  emptyBox:          { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTitle:        { fontSize: 18, fontWeight: '800', color: Colors.navy },
  emptySub:          { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
