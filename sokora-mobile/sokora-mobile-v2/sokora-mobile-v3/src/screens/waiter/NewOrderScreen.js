import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, FlatList, Alert, ActivityIndicator,
  TextInput, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { productsService, ordersService } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { Colors, Spacing, Radius, Shadow, Typography } from '../../utils/constants';
import { checkConnectivity, enqueueAction } from '../../services/offlineQueue';
import api from '../../services/api';

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

export default function NewOrderScreen({ navigation, route }) {
  const { table } = route.params || {};
  const { user } = useAuth();

  const [categories, setCategories] = useState([]);
  const [products,   setProducts]   = useState([]);
  const [cart,       setCart]        = useState({});       // { product_id: { qty, complimentary, reason } }
  const [activeTab,  setActiveTab]   = useState('all');
  const [search,     setSearch]      = useState('');
  const [loading,    setLoading]     = useState(true);
  const [submitting, setSubmitting]  = useState(false);
  const [notes,      setNotes]       = useState('');

  // Modal offert
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerProductId, setOfferProductId] = useState(null);
  const [offerReason,    setOfferReason]    = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          productsService.categories(),
          productsService.list(),
        ]);
        setCategories(catRes.data);
        setProducts(prodRes.data.filter(p => p.is_available));
      } catch (e) {
        Alert.alert('Erreur', e?.response?.data?.detail || e?.message || 'Impossible de charger le menu.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = products.filter(p => {
    const matchCat    = activeTab === 'all' || p.category_id === activeTab;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // PANIER
  const getItem   = (id) => cart[id] || { qty: 0, complimentary: false, reason: '' };
  const addItem   = (id) => setCart(c => ({ ...c, [id]: { ...getItem(id), qty: (c[id]?.qty || 0) + 1 } }));
  const removeItem = (id) => setCart(c => {
    const n = { ...c };
    if ((n[id]?.qty || 0) > 1) n[id] = { ...n[id], qty: n[id].qty - 1 };
    else delete n[id];
    return n;
  });

  const openOfferModal = (id) => {
    setOfferProductId(id);
    setOfferReason(cart[id]?.reason || '');
    setShowOfferModal(true);
  };

  const toggleComplimentary = (isComp) => {
    setCart(c => ({
      ...c,
      [offerProductId]: { ...getItem(offerProductId), complimentary: isComp, reason: isComp ? offerReason : '' }
    }));
    setShowOfferModal(false);
    setOfferReason('');
  };

  const cartEntries = Object.entries(cart).filter(([, v]) => v.qty > 0);
  const cartItems   = cartEntries.map(([id, v]) => ({
    product: products.find(p => p.id === parseInt(id)),
    ...v,
  })).filter(i => i.product);

  const cartTotal  = cartItems.reduce((s, i) => s + (i.complimentary ? 0 : i.product.price * i.qty), 0);
  const cartCount  = cartEntries.reduce((s, [, v]) => s + v.qty, 0);
  const offerCount = cartItems.filter(i => i.complimentary).length;

  const handleSubmit = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez au moins un article avant de valider.');
      return;
    }
    setSubmitting(true);

    const orderPayload = {
      table_id: table?.id,
      notes,
      items: cartItems.map(i => ({
        product_id:           i.product.id,
        quantity:             i.qty,
        unit_price:           i.complimentary ? 0 : i.product.price,
        is_complimentary:     i.complimentary,
        complimentary_reason: i.reason || '',
      })),
    };

    // ── Vérifier la connectivité avant d'envoyer ────────────────────────────
    const online = await checkConnectivity();

    if (!online) {
      // Mode hors-ligne : mettre en file d'attente
      await enqueueAction('CREATE_ORDER', orderPayload);
      Alert.alert(
        '📶 Mode hors-ligne',
        'La commande a été sauvegardée localement.\nElle sera envoyée automatiquement dès le retour de la connexion.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
      setSubmitting(false);
      return;
    }

    // ── Mode en ligne : envoi normal ─────────────────────────────────────────
    try {
      const { data: order } = await ordersService.create(orderPayload);

      // Marquer les articles offerts via l'API
      for (const i of cartItems.filter(x => x.complimentary)) {
        const item = order.items?.find(oi => oi.product_id === i.product.id);
        if (item) {
          await api.patch(`/order-items/${item.id}/complimentary`, {
            is_complimentary: true,
            reason: i.reason || '',
          }).catch(() => {});
        }
      }

      navigation.replace('OrderDetail', { orderId: order.id, isNew: true });
    } catch (err) {
      // Réseau perdu pendant l'envoi → mettre en file
      await enqueueAction('CREATE_ORDER', orderPayload);
      Alert.alert(
        'Sauvegardé hors-ligne',
        'La connexion a été perdue. La commande sera synchronisée automatiquement.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={Colors.orange} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.surface} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{table ? `Table ${table.number}` : 'Nouvelle commande'}</Text>
          {table?.label && <Text style={styles.headerSub}>{table.label}</Text>}
        </View>
        <View style={styles.cartBadgeWrap}>
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
          {offerCount > 0 && (
            <View style={[styles.cartBadge, { backgroundColor: Colors.teal }]}>
              <Text style={styles.cartBadgeText}>ðŸŽ{offerCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* BARRE RECHERCHE */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un produit..."
          placeholderTextColor={Colors.textFaint}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ONGLETS CATÃ‰GORIES */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: Spacing.sm }}>
        <TouchableOpacity style={[styles.catTab, activeTab === 'all' && styles.catTabActive]} onPress={() => setActiveTab('all')}>
          <Text style={[styles.catTabText, activeTab === 'all' && styles.catTabTextActive]}>Tout ({products.length})</Text>
        </TouchableOpacity>
        {categories.map(cat => {
          const count = products.filter(p => p.category_id === cat.id).length;
          return (
            <TouchableOpacity key={cat.id} style={[styles.catTab, activeTab === cat.id && styles.catTabActive]} onPress={() => setActiveTab(cat.id)}>
              <Text style={[styles.catTabText, activeTab === cat.id && styles.catTabTextActive]}>{cat.name} ({count})</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* LISTE PRODUITS */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 300 }}
        renderItem={({ item }) => {
          const entry = cart[item.id];
          const qty   = entry?.qty || 0;
          const isComp = entry?.complimentary || false;
          return (
            <View style={[styles.productRow, qty > 0 && styles.productRowSelected, isComp && styles.productRowOffer]}>
              <View style={styles.productInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.productName}>{item.name}</Text>
                  {isComp && <View style={styles.offerBadge}><Text style={styles.offerBadgeText}>ðŸŽ Offert</Text></View>}
                </View>
                <Text style={[styles.productPrice, isComp && { textDecorationLine: 'line-through', color: Colors.textFaint }]}>
                  {fmt(item.price)}
                </Text>
                {isComp && <Text style={{ fontSize: 10, color: Colors.teal, fontWeight: '600' }}>Gratuit Â· {entry?.reason || 'Offert'}</Text>}
                {!isComp && item.stock_quantity < 5 && item.stock_quantity > 0 && (
                  <Text style={styles.lowStockWarning}>âš ï¸ Stock faible ({item.stock_quantity})</Text>
                )}
              </View>
              <View style={styles.qtyControl}>
                {qty > 0 && (
                  <>
                    {/* Bouton offert */}
                    <TouchableOpacity
                      style={[styles.offerBtn, isComp && styles.offerBtnActive]}
                      onPress={() => openOfferModal(item.id)}
                    >
                      <Text style={{ fontSize: 14 }}>ðŸŽ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => removeItem(item.id)}>
                      <Ionicons name="remove" size={18} color={Colors.orange} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{qty}</Text>
                  </>
                )}
                <TouchableOpacity
                  style={[styles.addBtn, qty > 0 && styles.addBtnActive]}
                  onPress={() => addItem(item.id)}
                >
                  <Ionicons name="add" size={20} color={Colors.surface} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Ionicons name="search-outline" size={40} color={Colors.textFaint} />
            <Text style={{ color: Colors.textMuted, marginTop: 12 }}>Aucun produit trouvÃ©</Text>
          </View>
        }
      />

      {/* PANNEAU PANIER */}
      {cartCount > 0 && (
        <View style={styles.cartPanel}>
          <ScrollView style={styles.cartItemsScroll} showsVerticalScrollIndicator={false}>
            {cartItems.map(i => (
              <View key={i.product.id} style={styles.cartItem}>
                <Text style={styles.cartItemName}>
                  {i.complimentary ? 'ðŸŽ ' : ''}{i.product.name} Ã— {i.qty}
                </Text>
                <Text style={[styles.cartItemPrice, i.complimentary && { color: Colors.teal }]}>
                  {i.complimentary ? 'Offert' : fmt(i.product.price * i.qty)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <TextInput
            style={styles.notesInput}
            placeholder="Note pour la cuisine (optionnel)..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <View style={styles.cartFooter}>
            <View>
              <Text style={styles.cartTotalLabel}>{cartCount} article(s){offerCount > 0 ? ` Â· ${offerCount} offert(s)` : ''}</Text>
              <Text style={styles.cartTotal}>{fmt(cartTotal)}</Text>
            </View>
            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color={Colors.surface} size="small" />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={Colors.surface} />
                    <Text style={styles.submitBtnText}>Envoyer en cuisine</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* â”€â”€ MODAL OFFERT â”€â”€ */}
      <Modal visible={showOfferModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ðŸŽ Marquer comme offert</Text>
              <TouchableOpacity onPress={() => setShowOfferModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              {products.find(p => p.id === offerProductId)?.name}
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Motif (ex: client fidÃ¨le, anniversaire...)"
              placeholderTextColor={Colors.textFaint}
              value={offerReason}
              onChangeText={setOfferReason}
            />

            <TouchableOpacity style={[styles.offerConfirmBtn, { backgroundColor: Colors.teal }]} onPress={() => toggleComplimentary(true)}>
              <Text style={styles.offerConfirmText}>âœ… Marquer comme offert</Text>
            </TouchableOpacity>

            {cart[offerProductId]?.complimentary && (
              <TouchableOpacity style={[styles.offerConfirmBtn, { backgroundColor: Colors.bg, marginTop: 8 }]} onPress={() => toggleComplimentary(false)}>
                <Text style={[styles.offerConfirmText, { color: Colors.red }]}>âŒ Retirer l'offre</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.navy, paddingTop: 54, paddingBottom: 16, paddingHorizontal: Spacing.xl, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: Typography.xl, fontWeight: '800', color: Colors.surface },
  headerSub: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  cartBadgeWrap: { flexDirection: 'row', gap: 6 },
  cartBadge: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, ...Shadow.orange },
  cartBadgeText: { fontSize: Typography.sm, fontWeight: '800', color: Colors.surface },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, margin: Spacing.xl, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: Typography.base, color: Colors.text },
  catScroll: { flexShrink: 0, marginBottom: Spacing.sm },
  catTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  catTabActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  catTabText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textMuted },
  catTabTextActive: { color: Colors.surface },
  productRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  productRowSelected: { borderColor: Colors.orange + '66', backgroundColor: Colors.orangePale },
  productRowOffer: { borderColor: Colors.teal + '88', backgroundColor: Colors.tealPale },
  productInfo: { flex: 1 },
  productName: { fontSize: Typography.base, fontWeight: '600', color: Colors.navy },
  productPrice: { fontSize: Typography.md, fontWeight: '800', color: Colors.orange, marginTop: 2 },
  offerBadge: { backgroundColor: Colors.tealPale, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  offerBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.teal },
  lowStockWarning: { fontSize: Typography.xs, color: Colors.orange, marginTop: 2 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  offerBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  offerBtnActive: { backgroundColor: Colors.tealPale, borderColor: Colors.teal },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.orangePale, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: Typography.md, fontWeight: '800', color: Colors.navy, minWidth: 20, textAlign: 'center' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.navyLight, alignItems: 'center', justifyContent: 'center' },
  addBtnActive: { backgroundColor: Colors.orange, ...Shadow.orange },
  cartPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.navy, borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'], padding: Spacing.xl, paddingBottom: 32, maxHeight: 320, ...Shadow.lg },
  cartItemsScroll: { maxHeight: 120, marginBottom: Spacing.sm },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  cartItemName: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.75)' },
  cartItemPrice: { fontSize: Typography.sm, fontWeight: '700', color: Colors.orangeLight },
  notesInput: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.sm, color: Colors.surface, marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxHeight: 60 },
  cartFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartTotalLabel: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.5)' },
  cartTotal: { fontSize: Typography['2xl'], fontWeight: '800', color: Colors.surface },
  submitBtn: { backgroundColor: Colors.orange, borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 8, ...Shadow.orange },
  submitBtnText: { fontSize: Typography.base, fontWeight: '700', color: Colors.surface },
  // Modal offert
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing['3xl'] },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  modalTitle: { fontSize: Typography.xl, fontWeight: '800', color: Colors.navy },
  modalSub: { fontSize: Typography.base, color: Colors.textMuted, marginBottom: Spacing.xl, fontWeight: '600' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  reasonInput: { backgroundColor: Colors.bg, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, padding: 12, fontSize: Typography.base, color: Colors.navy, marginBottom: Spacing.lg },
  offerConfirmBtn: { borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center' },
  offerConfirmText: { fontSize: Typography.base, fontWeight: '800', color: Colors.surface },
});


