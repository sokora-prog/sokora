import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, FlatList, Alert, ActivityIndicator,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { productsService, ordersService } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { Colors, Spacing, Radius, Shadow, Typography } from '../../utils/constants';

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

export default function NewOrderScreen({ navigation, route }) {
  const { table } = route.params || {};
  const { user } = useAuth();

  const [categories, setCategories] = useState([]);
  const [products,   setProducts]   = useState([]);
  const [cart,       setCart]        = useState({});        // { product_id: quantity }
  const [activeTab,  setActiveTab]   = useState('all');
  const [search,     setSearch]      = useState('');
  const [loading,    setLoading]     = useState(true);
  const [submitting, setSubmitting]  = useState(false);
  const [notes,      setNotes]       = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          productsService.categories(),
          productsService.list(),
        ]);
        setCategories(catRes.data);
        setProducts(prodRes.data.filter(p => p.is_available));
      } catch {
        Alert.alert('Erreur', 'Impossible de charger le menu.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // FILTRAGE
  const filtered = products.filter(p => {
    const matchCat  = activeTab === 'all' || p.category_id === activeTab;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // PANIER
  const addItem    = (id) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeItem = (id) => setCart(c => {
    const n = { ...c };
    if (n[id] > 1) n[id]--; else delete n[id];
    return n;
  });
  const cartItems  = Object.entries(cart).map(([id, qty]) => ({
    product: products.find(p => p.id === parseInt(id)),
    quantity: qty,
  })).filter(i => i.product);
  const cartTotal  = cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const cartCount  = Object.values(cart).reduce((s, v) => s + v, 0);

  // SOUMETTRE
  const handleSubmit = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez au moins un article avant de valider.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: order } = await ordersService.create({
        table_id: table?.id,
        notes,
        items: cartItems.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.product.price,
        })),
      });
      navigation.replace('OrderDetail', { orderId: order.id, isNew: true });
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.detail || 'Impossible de créer la commande.');
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
          <Text style={styles.headerTitle}>
            {table ? `Table ${table.number}` : 'Nouvelle commande'}
          </Text>
          {table?.label && (
            <Text style={styles.headerSub}>{table.label}</Text>
          )}
        </View>
        {cartCount > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
        )}
      </View>

      {/* BARRE DE RECHERCHE */}
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

      {/* ONGLETS CATÉGORIES */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: Spacing.sm }}
      >
        <TouchableOpacity
          style={[styles.catTab, activeTab === 'all' && styles.catTabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.catTabText, activeTab === 'all' && styles.catTabTextActive]}>
            Tout ({products.length})
          </Text>
        </TouchableOpacity>
        {categories.map(cat => {
          const count = products.filter(p => p.category_id === cat.id).length;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catTab, activeTab === cat.id && styles.catTabActive]}
              onPress={() => setActiveTab(cat.id)}
            >
              <Text style={[styles.catTabText, activeTab === cat.id && styles.catTabTextActive]}>
                {cat.name} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* LISTE PRODUITS */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 280 }}
        renderItem={({ item }) => {
          const qty = cart[item.id] || 0;
          return (
            <View style={[styles.productRow, qty > 0 && styles.productRowSelected]}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>{fmt(item.price)}</Text>
                {item.stock_quantity < 5 && item.stock_quantity > 0 && (
                  <Text style={styles.lowStockWarning}>⚠️ Stock faible ({item.stock_quantity})</Text>
                )}
              </View>
              <View style={styles.qtyControl}>
                {qty > 0 ? (
                  <>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => removeItem(item.id)}>
                      <Ionicons name="remove" size={18} color={Colors.orange} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{qty}</Text>
                  </>
                ) : null}
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
            <Text style={{ color: Colors.textMuted, marginTop: 12 }}>
              Aucun produit trouvé
            </Text>
          </View>
        }
      />

      {/* PANNEAU RÉCAPITULATIF PANIER */}
      {cartCount > 0 && (
        <View style={styles.cartPanel}>
          {/* APERÇU ARTICLES */}
          <ScrollView
            style={styles.cartItemsScroll}
            showsVerticalScrollIndicator={false}
          >
            {cartItems.map(i => (
              <View key={i.product.id} style={styles.cartItem}>
                <Text style={styles.cartItemName}>{i.product.name} × {i.quantity}</Text>
                <Text style={styles.cartItemPrice}>{fmt(i.product.price * i.quantity)}</Text>
              </View>
            ))}
          </ScrollView>

          {/* NOTES */}
          <TextInput
            style={styles.notesInput}
            placeholder="Note pour la cuisine (optionnel)..."
            placeholderTextColor={Colors.textFaint}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          {/* TOTAL + BOUTON */}
          <View style={styles.cartFooter}>
            <View>
              <Text style={styles.cartTotalLabel}>{cartCount} article(s)</Text>
              <Text style={styles.cartTotal}>{fmt(cartTotal)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
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
  cartBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.orange,
  },
  cartBadgeText: { fontSize: Typography.sm, fontWeight: '800', color: Colors.surface },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, margin: Spacing.xl,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  searchInput: {
    flex: 1, paddingVertical: 12,
    fontSize: Typography.base, color: Colors.text,
  },
  catScroll: { maxHeight: 50, marginBottom: Spacing.sm },
  catTab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  catTabActive: {
    backgroundColor: Colors.orange, borderColor: Colors.orange,
  },
  catTabText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textMuted },
  catTabTextActive: { color: Colors.surface },
  productRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  productRowSelected: {
    borderColor: Colors.orange + '66',
    backgroundColor: Colors.orangePale,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: Typography.base, fontWeight: '600', color: Colors.navy },
  productPrice: { fontSize: Typography.md, fontWeight: '800', color: Colors.orange, marginTop: 2 },
  lowStockWarning: { fontSize: Typography.xs, color: Colors.orange, marginTop: 2 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.orangePale,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { fontSize: Typography.md, fontWeight: '800', color: Colors.navy, minWidth: 20, textAlign: 'center' },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.navyLight,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnActive: { backgroundColor: Colors.orange, ...Shadow.orange },
  cartPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.navy,
    borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
    padding: Spacing.xl, paddingBottom: 32,
    maxHeight: 320,
    ...Shadow.lg,
  },
  cartItemsScroll: { maxHeight: 120, marginBottom: Spacing.sm },
  cartItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4,
  },
  cartItemName: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.75)' },
  cartItemPrice: { fontSize: Typography.sm, fontWeight: '700', color: Colors.orangeLight },
  notesInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.md, padding: Spacing.md,
    fontSize: Typography.sm, color: Colors.surface,
    marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    maxHeight: 60,
  },
  cartFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cartTotalLabel: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.5)' },
  cartTotal: { fontSize: Typography['2xl'], fontWeight: '800', color: Colors.surface },
  submitBtn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: Spacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    ...Shadow.orange,
  },
  submitBtnText: { fontSize: Typography.base, fontWeight: '700', color: Colors.surface },
});
