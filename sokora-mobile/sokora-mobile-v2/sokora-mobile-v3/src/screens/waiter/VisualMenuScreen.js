/**
 * VisualMenuScreen — SOKORA Commande Visuelle 🖼️
 * Prise de commande par images pour serveurs analphabètes
 * Design : grandes images, prix en gros chiffres, boutons XXL, aucune lecture requise
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, Image, Animated, Alert, Dimensions,
  ActivityIndicator, Modal, Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';
import { productsService, ordersService } from '../../services/api';

const { width: W } = Dimensions.get('window');
const ITEM_W = (W - Spacing.lg * 2 - Spacing.sm) / 2;

// ── Catégories visuelles (emojis = universels) ───────────────────────────────
const CATEGORIES_VISUAL = [
  { id: 'all',      emoji: '🌟', label: 'TOUT',     color: Colors.navy   },
  { id: 'food',     emoji: '🍽️', label: 'PLATS',    color: '#E67E22'     },
  { id: 'drink',    emoji: '🥤', label: 'BOISSONS', color: Colors.teal   },
  { id: 'dessert',  emoji: '🍰', label: 'SUCRÉ',    color: '#E91E8C'     },
  { id: 'alcohol',  emoji: '🍺', label: 'ALCOOL',   color: '#F59E0B'     },
  { id: 'special',  emoji: '⭐', label: 'SPÉCIAL',  color: Colors.purple },
];

// ── Données démo ──────────────────────────────────────────────────────────────
const DEMO_PRODUCTS = [
  { id: 1, name: 'Poulet Braisé',     category: 'food',    price: 2500, emoji: '🍗', color: '#FFF4EA', unit: 'pièce' },
  { id: 2, name: 'Attiéké',           category: 'food',    price: 500,  emoji: '🍚', color: '#F0FAF2', unit: 'assiette' },
  { id: 3, name: 'Alloco',            category: 'food',    price: 500,  emoji: '🍌', color: '#FFFBEB', unit: 'portion' },
  { id: 4, name: 'Riz Sauce Graine',  category: 'food',    price: 1500, emoji: '🍲', color: '#FFF4EA', unit: 'assiette' },
  { id: 5, name: 'Eau Minérale',      category: 'drink',   price: 500,  emoji: '💧', color: '#EFF6FF', unit: 'bouteille' },
  { id: 6, name: 'Jus de Fruits',     category: 'drink',   price: 800,  emoji: '🥤', color: '#F0FAF2', unit: 'verre' },
  { id: 7, name: 'Coca-Cola',         category: 'drink',   price: 600,  emoji: '🥫', color: '#FFF0F0', unit: 'canette' },
  { id: 8, name: 'Bissap',            category: 'drink',   price: 400,  emoji: '🫖', color: '#FDF2F8', unit: 'verre' },
  { id: 9, name: 'Bière Castel',      category: 'alcohol', price: 800,  emoji: '🍺', color: '#FFFBEB', unit: 'bouteille' },
  { id: 10, name: 'Bière 33 Export',  category: 'alcohol', price: 700,  emoji: '🍻', color: '#FFF8E1', unit: 'bouteille' },
  { id: 11, name: 'Plateau Spécial',  category: 'special', price: 5000, emoji: '🎁', color: '#EEF0FF', unit: 'plateau' },
  { id: 12, name: 'Dessert du Jour',  category: 'dessert', price: 1000, emoji: '🍰', color: '#FDF2F8', unit: 'portion' },
];

// ── Composant ProductCard ────────────────────────────────────────────────────
function ProductCard({ item, quantity, onAdd, onRemove }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const addAnim   = useRef(new Animated.Value(1)).current;

  const handleAdd = () => {
    Vibration.vibrate(40);
    Animated.sequence([
      Animated.timing(addAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(addAnim,  { toValue: 1, useNativeDriver: true }),
    ]).start();
    onAdd();
  };

  const handleRemove = () => {
    Vibration.vibrate(20);
    onRemove();
  };

  return (
    <Animated.View style={[styles.productCard, { transform: [{ scale: scaleAnim }] }]}>
      {/* Image / Emoji ── BIG */}
      <TouchableOpacity
        style={[styles.productImageBox, { backgroundColor: item.color }]}
        onPress={handleAdd}
        activeOpacity={0.9}
      >
        <Text style={styles.productEmoji}>{item.emoji}</Text>

        {/* Compteur overlay */}
        {quantity > 0 && (
          <View style={styles.qtyOverlay}>
            <Text style={styles.qtyOverlayText}>×{quantity}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Prix — TRÈS GRAND et LISIBLE */}
      <View style={styles.productInfo}>
        <Text style={styles.productPrice}>
          {item.price.toLocaleString('fr-FR')} <Text style={styles.productPriceCurrency}>F</Text>
        </Text>

        {/* Boutons +/- XXL */}
        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={[styles.qtyBtn, styles.qtyBtnMinus, quantity === 0 && styles.qtyBtnDisabled]}
            onPress={handleRemove}
            disabled={quantity === 0}
          >
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>

          <View style={styles.qtyDisplay}>
            <Text style={styles.qtyNum}>{quantity}</Text>
          </View>

          <Animated.View style={{ transform: [{ scale: addAnim }] }}>
            <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnPlus]} onPress={handleAdd}>
              <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Composant CartBar ─────────────────────────────────────────────────────────
function CartBar({ cart, total, onSend, tableId }) {
  const totalItems = Object.values(cart).reduce((s, q) => s + q, 0);
  const bounceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (totalItems > 0) {
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 1.05, duration: 100, useNativeDriver: true }),
        Animated.spring(bounceAnim,  { toValue: 1,    useNativeDriver: true }),
      ]).start();
    }
  }, [totalItems]);

  if (totalItems === 0) return null;

  return (
    <Animated.View style={[styles.cartBar, { transform: [{ scale: bounceAnim }] }]}>
      <View style={styles.cartInfo}>
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{totalItems}</Text>
        </View>
        <View>
          <Text style={styles.cartItems}>{totalItems} article{totalItems > 1 ? 's' : ''}</Text>
          <Text style={styles.cartTotal}>{total.toLocaleString('fr-FR')} FCFA</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.cartSendBtn} onPress={onSend}>
        <Ionicons name="checkmark-circle" size={22} color="#fff" />
        <Text style={styles.cartSendText}>ENVOYER</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Composant CartSummaryModal ───────────────────────────────────────────────
function CartSummaryModal({ visible, cart, products, total, tableId, onConfirm, onCancel }) {
  const cartItems = Object.entries(cart)
    .filter(([_, q]) => q > 0)
    .map(([id, qty]) => {
      const product = products.find(p => String(p.id) === id);
      return product ? { ...product, quantity: qty, subtotal: product.price * qty } : null;
    }).filter(Boolean);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalTableBadge}>
            <Text style={styles.modalTableText}>TABLE {tableId || '?'}</Text>
          </View>
          <Text style={styles.modalTitle}>Résumé commande</Text>
          <TouchableOpacity onPress={onCancel} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Liste */}
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
          {cartItems.map(item => (
            <View key={item.id} style={styles.summaryItem}>
              <Text style={styles.summaryEmoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryName}>{item.name}</Text>
                <Text style={styles.summaryUnit}>{item.unit}</Text>
              </View>
              <View style={styles.summaryRight}>
                <Text style={styles.summaryQty}>×{item.quantity}</Text>
                <Text style={styles.summaryPrice}>{item.subtotal.toLocaleString('fr-FR')} F</Text>
              </View>
            </View>
          ))}

          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalLabel}>TOTAL</Text>
            <Text style={styles.summaryTotalAmount}>{total.toLocaleString('fr-FR')} FCFA</Text>
          </View>
        </ScrollView>

        {/* Boutons */}
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel}>
            <Ionicons name="arrow-back" size={20} color={Colors.navy} />
            <Text style={styles.modalCancelText}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalConfirmBtn} onPress={onConfirm}>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.modalConfirmText}>CONFIRMER</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Écran principal ──────────────────────────────────────────────────────────
export default function VisualMenuScreen({ navigation, route }) {
  const { tableId, tableNumber } = route?.params || {};
  const [products, setProducts]   = useState(DEMO_PRODUCTS);
  const [category, setCategory]   = useState('all');
  const [cart, setCart]           = useState({});
  const [loading, setLoading]     = useState(false);
  const [showModal, setModal]     = useState(false);
  const [sending, setSending]     = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const { data } = await productsService.list();
      if (Array.isArray(data) && data.length > 0) {
        setProducts(data.map(p => ({
          ...p,
          emoji: CATEGORIES_VISUAL.find(c => c.id === p.category_name?.toLowerCase())?.emoji || '🍽️',
          color: CATEGORIES_VISUAL.find(c => c.id === p.category_name?.toLowerCase())?.color?.replace('#', '') || Colors.orangePale,
        })));
      }
    } catch {
      // keep demo
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProducts(); }, [loadProducts]));

  const filtered = category === 'all'
    ? products
    : products.filter(p => p.category === category);

  const total = Object.entries(cart).reduce((s, [id, qty]) => {
    const p = products.find(p => String(p.id) === id);
    return s + (p ? p.price * qty : 0);
  }, 0);

  const addToCart   = (id) => setCart(prev => ({ ...prev, [String(id)]: (prev[String(id)] || 0) + 1 }));
  const removeFromCart = (id) => setCart(prev => {
    const q = (prev[String(id)] || 0) - 1;
    if (q <= 0) { const n = { ...prev }; delete n[String(id)]; return n; }
    return { ...prev, [String(id)]: q };
  });

  const handleSendOrder = async () => {
    setSending(true);
    try {
      const items = Object.entries(cart)
        .filter(([_, q]) => q > 0)
        .map(([id, qty]) => {
          const p = products.find(p => String(p.id) === id);
          return { product_id: parseInt(id), quantity: qty, unit_price: p?.price || 0 };
        });

      if (tableId) {
        const { data: order } = await ordersService.create({ table_id: tableId });
        await ordersService.addItems(order.id, items);
        Alert.alert('✅ Commande envoyée !', `Commande pour Table ${tableNumber || tableId} envoyée en cuisine.`,
          [{ text: 'OK', onPress: () => { setCart({}); setModal(false); navigation?.goBack(); } }]
        );
      } else {
        Alert.alert('✅ Prêt !', 'Commande enregistrée.',
          [{ text: 'OK', onPress: () => { setCart({}); setModal(false); } }]
        );
      }
    } catch (e) {
      Alert.alert('❌ Erreur', 'Réessayez.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {tableNumber ? `TABLE ${tableNumber}` : 'COMMANDE'}
          </Text>
          <Text style={styles.headerSub}>Touchez les images pour ajouter</Text>
        </View>
        {/* Icône panier avec badge */}
        <TouchableOpacity
          style={styles.cartIconBtn}
          onPress={() => Object.keys(cart).length > 0 && setModal(true)}
        >
          <Ionicons name="cart" size={24} color="#fff" />
          {Object.values(cart).reduce((s, q) => s + q, 0) > 0 && (
            <View style={styles.cartIconBadge}>
              <Text style={styles.cartIconBadgeText}>
                {Object.values(cart).reduce((s, q) => s + q, 0)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Catégories visuelles (GRANDS boutons avec emoji) ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        {CATEGORIES_VISUAL.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catBtn, category === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
            onPress={() => setCategory(cat.id)}
          >
            <Text style={styles.catBtnEmoji}>{cat.emoji}</Text>
            <Text style={[styles.catBtnLabel, category === cat.id && { color: '#fff' }]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Grille produits ── */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ProductCard
            item={item}
            quantity={cart[String(item.id)] || 0}
            onAdd={() => addToCart(item.id)}
            onRemove={() => removeFromCart(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🍽️</Text>
            <Text style={styles.emptyText}>Aucun produit</Text>
          </View>
        }
      />

      {/* ── Barre panier flottante ── */}
      <CartBar
        cart={cart}
        total={total}
        tableId={tableNumber || tableId}
        onSend={() => setModal(true)}
      />

      {/* ── Modal résumé commande ── */}
      <CartSummaryModal
        visible={showModal}
        cart={cart}
        products={products}
        total={total}
        tableId={tableNumber || tableId}
        onConfirm={handleSendOrder}
        onCancel={() => setModal(false)}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    backgroundColor: Colors.navy,
    paddingTop: 54, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  backBtn: { padding: Spacing.sm },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: Typography['2xl'], fontWeight: '900', color: '#fff', letterSpacing: 2 },
  headerSub: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  cartIconBtn: { padding: Spacing.sm, position: 'relative' },
  cartIconBadge: {
    position: 'absolute', top: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.navy,
  },
  cartIconBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },

  // Catégories
  catRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm },
  catBtn: {
    alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.xl, minWidth: 72,
    backgroundColor: Colors.surface,
    borderWidth: 2, borderColor: Colors.border,
    ...Shadow.sm,
  },
  catBtnEmoji: { fontSize: 26 },
  catBtnLabel: { fontSize: Typography.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.5 },

  // Grid
  row: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  gridContent: { paddingBottom: 140, paddingTop: Spacing.sm },

  // Product Card
  productCard: {
    width: ITEM_W,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    ...Shadow.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  productImageBox: {
    height: ITEM_W * 0.85,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  productEmoji: { fontSize: ITEM_W * 0.45 },
  qtyOverlay: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: Colors.orange,
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    ...Shadow.orange,
  },
  qtyOverlayText: { fontSize: Typography.sm, fontWeight: '900', color: '#fff' },

  productInfo: { padding: Spacing.md, gap: Spacing.sm },
  productPrice: { fontSize: Typography.xl, fontWeight: '900', color: Colors.navy, textAlign: 'center' },
  productPriceCurrency: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textMuted },

  // Qty controls — VERY BIG
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  qtyBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    ...Shadow.sm,
  },
  qtyBtnMinus: { backgroundColor: Colors.bg, borderWidth: 2, borderColor: Colors.border },
  qtyBtnPlus:  { backgroundColor: Colors.orange, ...Shadow.orange },
  qtyBtnDisabled: { opacity: 0.3 },
  qtyBtnText: { fontSize: Typography['2xl'], fontWeight: '900', color: Colors.navy, lineHeight: 30 },

  qtyDisplay: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  qtyNum: { fontSize: Typography.xl, fontWeight: '900', color: Colors.navy },

  // Cart Bar
  cartBar: {
    position: 'absolute', bottom: 20, left: Spacing.lg, right: Spacing.lg,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.navy,
    borderRadius: Radius.xl, padding: Spacing.md,
    ...Shadow.lg,
  },
  cartInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cartBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
  },
  cartBadgeText: { fontSize: Typography.md, fontWeight: '900', color: '#fff' },
  cartItems: { fontSize: Typography.sm, fontWeight: '700', color: '#fff' },
  cartTotal: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.6)' },
  cartSendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.orange,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    ...Shadow.orange,
  },
  cartSendText: { fontSize: Typography.md, fontWeight: '900', color: '#fff', letterSpacing: 1 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.lg, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  modalTableBadge: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 6,
  },
  modalTableText: { fontSize: Typography.md, fontWeight: '900', color: '#fff' },
  modalTitle: { flex: 1, fontSize: Typography.lg, fontWeight: '800', color: Colors.navy },
  modalClose: { padding: Spacing.sm },

  summaryItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: Spacing.md,
    ...Shadow.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  summaryEmoji: { fontSize: 32 },
  summaryName: { fontSize: Typography.md, fontWeight: '700', color: Colors.navy },
  summaryUnit: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  summaryRight: { alignItems: 'flex-end', gap: 2 },
  summaryQty: { fontSize: Typography.lg, fontWeight: '900', color: Colors.orange },
  summaryPrice: { fontSize: Typography.md, fontWeight: '700', color: Colors.navy },

  summaryTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.navy,
    borderRadius: Radius.xl, padding: Spacing.xl,
    marginTop: Spacing.md,
  },
  summaryTotalLabel: { fontSize: Typography.lg, fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: 2 },
  summaryTotalAmount: { fontSize: Typography['2xl'], fontWeight: '900', color: '#fff' },

  modalActions: {
    flexDirection: 'row', gap: Spacing.md,
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  modalCancelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md,
    backgroundColor: Colors.bg,
    borderRadius: Radius.xl,
    borderWidth: 2, borderColor: Colors.border,
  },
  modalCancelText: { fontSize: Typography.md, fontWeight: '700', color: Colors.navy },
  modalConfirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md,
    backgroundColor: Colors.green,
    borderRadius: Radius.xl,
    ...Shadow.md,
  },
  modalConfirmText: { fontSize: Typography.lg, fontWeight: '900', color: '#fff', letterSpacing: 1 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
  emptyText: { fontSize: Typography.lg, fontWeight: '600', color: Colors.textMuted },
});
