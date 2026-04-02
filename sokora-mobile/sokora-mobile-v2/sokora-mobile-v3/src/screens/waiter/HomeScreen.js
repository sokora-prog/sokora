import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, StyleSheet, Modal, TextInput, Alert,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { tablesService, ordersService, dashboardService } from '../../services/api';
import { notificationService } from '../../services/notifications';
import { useAuth } from '../../services/AuthContext';
import { Colors, Spacing, Radius, Shadow, Typography, TableStatus, API_URL } from '../../utils/constants';
import { Card, LoadingScreen, ErrorBox, StatusBadge, Avatar } from '../../components/UI';
import OfflineBanner from '../../components/OfflineBanner';
import { useOfflineSync } from '../../services/offlineQueue';
import * as SecureStore from 'expo-secure-store';

const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

export default function WaiterHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [staffToken, setStaffToken] = React.useState(null);
  React.useEffect(() => {
    SecureStore.getItemAsync('sokora_token').then(t => setStaffToken(t)).catch(() => {});
  }, []);
  const { isOnline, syncing, queueSize, flush } = useOfflineSync(staffToken);
  const [tables,     setTables]     = useState([]);
  const [myOrders,   setMyOrders]   = useState([]);
  const [myStats,    setMyStats]    = useState(null);
  const [caisse,     setCaisse]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  // Saisie manuelle
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualNum,       setManualNum]       = useState('');

  // Notification commandes prêtes
  const [readyOrders,     setReadyOrders]     = useState([]);
  const notifiedIdsRef = React.useRef([]);
  const [readyTableIds,   setReadyTableIds]   = useState([]);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // Chat IA
  const [showChat,    setShowChat]    = useState(false);
  const [chatInput,   setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatContext, setChatContext] = useState(null);
  const [messages,    setMessages]    = useState([
    { role: 'assistant', content: ' Bonjour ! Je suis votre assistant SOKORA.\n\nJe peux vous aider sur le menu, les ardoises clients, ou répondre à vos questions.\n\nQue souhaitez-vous savoir ?' }
  ]);
  const flatListRef = useRef(null);

  const loadChatContext = async () => {
    try {
      const token = await SecureStore.getItemAsync('sokora_token');
      const hdr = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const [stats, stock, credit] = await Promise.all([
        fetch(`${API_URL}/dashboard/stats?period=today`, { headers: hdr }).then(r => r.json()).catch(() => ({})),
        fetch(`${API_URL}/stock/waiter`, { headers: hdr }).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/credit/stats`, { headers: hdr }).then(r => r.json()).catch(() => ({})),
      ]);
      setChatContext({ stats, stock, credit });
    } catch {}
  };

  const buildSystemPrompt = () => {
    const s = chatContext?.stats || {};
    const stockAlerts = Array.isArray(chatContext?.stock) ? chatContext.stock : [];
    const cr = chatContext?.credit || {};
    return `Tu es l'assistant IA de SOKORA, intégré dans l'app mobile du serveur.
Tu parles dans la langue de l'utilisateur (français ou anglais).
Tu es concis, utile et amical. Réponds en 2-4 phrases max sauf si plus de détails sont nécessaires.

DONNÉES DU RESTAURANT :
- CA aujourd'hui : ${s.revenue_today ?? 'N/A'} F CFA
- Commandes aujourd'hui : ${s.orders_today ?? 'N/A'}
- Produits en alerte stock : ${stockAlerts.length} (${stockAlerts.map(p => p.name).join(', ') || 'aucun'})
- Ardoises : ${cr.accounts_in_debt ?? 0} clients doivent ${cr.total_balance_due ?? 0} F CFA

Tu peux conseiller le serveur sur : le menu, les articles disponibles, les ardoises clients, et les bonnes pratiques de service.`;
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: 'user', content: chatInput.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          system: buildSystemPrompt(),
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || 'Désolé, je n\'ai pas pu répondre.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erreur de connexion.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const openChat = () => {
    loadChatContext();
    setShowChat(true);
  };

  const loadData = useCallback(async () => {
    try {
      setError('');
      const isManager = ['manager','super_admin'].includes(user?.role);
      const promises = [
        tablesService.list(),
        ordersService.list({ status: 'open', waiter_id: user?.id }),
        dashboardService.myStats(),
        isManager ? dashboardService.caisse('today') : Promise.resolve(null),
        // Récupérer les commandes ready du serveur connecté
        ordersService.list({ status: 'ready', waiter_id: user?.id }),
      ];
      const [tablesRes, ordersRes, statsRes, caisseRes, readyRes] = await Promise.all(promises);
      setTables(tablesRes.data);
      setMyOrders(ordersRes.data);
      setMyStats(statsRes.data);
      if (caisseRes) setCaisse(caisseRes.data);

      // Détecter les nouvelles commandes prêtes et notifier
      const newReady = (readyRes?.data || []);
      setReadyOrders(newReady);
      // Mettre à jour les table_ids avec commandes prêtes
      setReadyTableIds(newReady.map(o => o.table_id));

      const toNotify = newReady.filter(o => !notifiedIdsRef.current.includes(o.id));
      if (toNotify.length > 0) {
        const tableNums = toNotify.map(o => `Table ${o.table_id}`).join(', ');
        Alert.alert(
          '✅ Commande(s) prête(s) !',
          `${tableNums} ${toNotify.length > 1 ? 'sont prêtes' : 'est prête'} à être servie(s).`,
          [{ text: 'OK', style: 'default' }]
        );
        toNotify.forEach(order => {
          notificationService.orderReady(order.table_number || order.table_id);
        });
        notifiedIdsRef.current = [...notifiedIdsRef.current, ...toNotify.map(o => o.id)];
      }
    } catch (err) {
      setError('Impossible de charger les données. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const openCount    = myStats?.occupied_tables ?? tables.filter(t => t.status === 'occupied' || t.status === 'OCCUPIED').length;
  const myOpenOrders = myStats?.active_orders ?? myOrders.length;
  const myDayRevenue = myStats?.revenue_today ?? 0;
  const readyCount   = readyOrders.length;

  // Animation pulse pour les tables prêtes
  React.useEffect(() => {
    if (readyTableIds.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [readyTableIds.length]);

  // Saisie manuelle — trouver la table par numéro
  const handleManualTable = async () => {
    const num = parseInt(manualNum);
    if (!num || isNaN(num)) {
      Alert.alert('Numéro invalide', 'Entrez un numéro de table valide.');
      return;
    }
    const table = tables.find(t => t.number === num);
    if (!table) {
      Alert.alert('Table introuvable', `La table ${num} n'existe pas.`);
      return;
    }
    setShowManualModal(false);
    setManualNum('');
    const isFree = (table.status === 'free' || table.status === 'FREE') || table.status === 'TableStatus.FREE';
    if (isFree) {
      navigation.navigate('NewOrder', { table });
    } else {
      // Chercher toutes les commandes actives de cette table
      try {
        const token = await SecureStore.getItemAsync('sokora_token');
        const res = await fetch(`${API_URL}/orders/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const allOrders = await res.json();
        const activeOrders = Array.isArray(allOrders)
          ? allOrders.filter(o => o.table_id === table.id && !['PAID','CANCELLED','paid','cancelled'].includes(o.status))
          : [];
        if (activeOrders.length > 0) {
          navigation.navigate('TableOrders', { table, orders: activeOrders });
        } else {
          navigation.navigate('NewOrder', { table });
        }
      } catch {
        navigation.navigate('NewOrder', { table });
      }
    }
  };

  if (loading) return <LoadingScreen message="Chargement des tables..." />;

  return (
    <View style={styles.container}>
      {/* OFFLINE BANNER */}
      <OfflineBanner
        isOnline={isOnline}
        syncing={syncing}
        queueSize={queueSize}
        onFlush={flush}
      />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour 👋</Text>
          <Text style={styles.userName}>{user?.full_name || 'Serveur'}</Text>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' })}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {/* KPI — manager only */}
          {['manager','super_admin'].includes(user?.role) && (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: '#14B8A6' }]}
              onPress={() => navigation.navigate('Caisse')}
            >
              <Ionicons name="wallet-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          {['manager','super_admin'].includes(user?.role) && user?.has_kitchen && (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: '#06B6D4' }]}
              onPress={() => navigation.navigate('KPI')}
            >
              <Ionicons name="stats-chart-outline" size={20} color={Colors.surface} />
            </TouchableOpacity>
          )}
          {['manager','super_admin'].includes(user?.role) && (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: '#10B981' }]}
              onPress={() => navigation.navigate('WalletScan')}
            >
              <Ionicons name="wallet-outline" size={20} color={Colors.surface} />
            </TouchableOpacity>
          )}
          {/* Stock — manager only */}
          {['manager','super_admin'].includes(user?.role) && (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: '#8B5CF6' }]}
              onPress={() => navigation.navigate('Stock')}
            >
              <Ionicons name="cube-outline" size={20} color={Colors.surface} />
            </TouchableOpacity>
          )}
          {/* Clôture caisse — manager only */}
          {['manager','super_admin'].includes(user?.role) && (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: '#14B8A6' }]}
              onPress={() => navigation.navigate('Closing')}
            >
              <Ionicons name="calculator-outline" size={20} color={Colors.surface} />
            </TouchableOpacity>
          )}
          {/* Saisie manuelle */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowManualModal(true)}
          >
            <Ionicons name="create-outline" size={20} color={Colors.surface} />
          </TouchableOpacity>
          {/* Scanner QR */}
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: Colors.orange }]}
            onPress={() => navigation.navigate('Scanner', { mode: 'checkin' })}
          >
            <Ionicons name="qr-code-outline" size={20} color={Colors.surface} />
          </TouchableOpacity>
          <Avatar name={user?.full_name || ''} size={40} />
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
        showsVerticalScrollIndicator={false}
      >
        {error && <ErrorBox message={error} onRetry={loadData} />}

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderTopColor: Colors.orange }]}>
            <Ionicons name="restaurant-outline" size={20} color={Colors.orange} />
            <Text style={[styles.kpiValue, { color: Colors.orange }]}>{openCount}</Text>
            <Text style={styles.kpiLabel}>Tables occupées</Text>
          </View>
          <View style={[styles.kpiCard, { borderTopColor: Colors.teal }]}>
            <Ionicons name="receipt-outline" size={20} color={Colors.teal} />
            <Text style={[styles.kpiValue, { color: Colors.teal }]}>{myOpenOrders}</Text>
            <Text style={styles.kpiLabel}>Mes commandes</Text>
          </View>
          {readyCount > 0 && (
            <View style={[styles.kpiCard, { borderTopColor: '#22C55E', backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#22C55E" />
              <Text style={[styles.kpiValue, { color: '#22C55E' }]}>{readyCount}</Text>
              <Text style={styles.kpiLabel}>Prêtes ✓</Text>
            </View>
          )}
          <View style={[styles.kpiCard, { borderTopColor: Colors.purple }]}>
            <Ionicons name="cash-outline" size={20} color={Colors.purple} />
            <Text style={[styles.kpiValue, { color: Colors.purple, fontSize: 15 }]}>{fmt(myDayRevenue)}</Text>
            <Text style={styles.kpiLabel}>CA aujourd'hui</Text>
          </View>
        </View>

        {/* BOUTONS D'ACTION */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.orange, flex: 2 }]}
            onPress={() => navigation.navigate('Scanner', { mode: 'order' })}
            activeOpacity={0.85}
          >
            <Ionicons name="scan-outline" size={20} color={Colors.surface} />
            <Text style={styles.actionBtnText}>Scanner une table</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.navy, flex: 1 }]}
            onPress={() => setShowManualModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="keypad-outline" size={20} color={Colors.surface} />
            <Text style={styles.actionBtnText}>Manuel</Text>
          </TouchableOpacity>
        </View>

        {/* PLAN DES TABLES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Plan des tables</Text>
            <View style={styles.legendRow}>
              {Object.entries(TableStatus).map(([key, val]) => (
                <View key={key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: val.color }]} />
                  <Text style={styles.legendText}>{val.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.tablesGrid}>
            {tables.map(table => {
              const st = TableStatus[table.status] || TableStatus[(table.status||"").toLowerCase()] || TableStatus.occupied;
              const isMyTable = myOrders.some(o => o.table_id === table.id);
              return (
                <TouchableOpacity
                  key={table.id}
                  style={[
                    styles.tableCard,
                    { borderColor: readyTableIds.includes(table.id) ? '#22C55E' : st.color + '66' },
                    isMyTable && !readyTableIds.includes(table.id) && styles.tableCardMine,
                    readyTableIds.includes(table.id) && { backgroundColor: '#f0fdf4', borderWidth: 2, borderColor: '#22C55E' },
                  ]}
                  onPress={async () => {
                    if ((table.status === 'free' || table.status === 'FREE') && !readyTableIds.includes(table.id)) {
                      navigation.navigate('NewOrder', { table });
                    } else {
                      try {
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
                        const activeOrders = allActive.filter(o => o.table_id === table.id);
                        if (activeOrders.length > 0) {
                          navigation.navigate('TableOrders', { table, orders: activeOrders });
                        } else {
                          navigation.navigate('NewOrder', { table });
                        }
                      } catch {
                        navigation.navigate('NewOrder', { table });
                      }
                    }
                  }}
                  activeOpacity={0.8}
                >
                  {readyTableIds.includes(table.id) && (
                    <Animated.View style={[styles.readyBadge, { opacity: pulseAnim }]}>
                      <Text style={styles.readyBadgeText}>✓ Prête</Text>
                    </Animated.View>
                  )}
                  {isMyTable && !readyTableIds.includes(table.id) && (
                    <View style={styles.myTableBadge}>
                      <Text style={styles.myTableBadgeText}>Moi</Text>
                    </View>
                  )}
                  <View style={[styles.tableIconBg, { backgroundColor: st.bg }]}>
                    <Ionicons name={st.icon} size={20} color={st.color} />
                  </View>
                  <Text style={[styles.tableNum, { color: st.color }]}>T{table.number}</Text>
                  <Text style={styles.tableLabel}>{table.label || '--'}</Text>
                  <View style={[styles.tablePill, { backgroundColor: st.bg }]}>
                    <Text style={[styles.tablePillText, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <Text style={styles.tableCap}>{table.capacity} pers.</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CAISSE DU JOUR — manager only */}
        {['manager','super_admin'].includes(user?.role) && caisse && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Caisse du jour</Text>
            {/* Total */}
            <View style={{ backgroundColor: '#14B8A6', borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' }}>TOTAL ENCAISSÉ</Text>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 }}>{fmt(caisse.grand_total)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>{caisse.total_count} paiement{caisse.total_count > 1 ? 's' : ''}</Text>
            </View>
            {/* Breakdown */}
            {(caisse.breakdown || []).length === 0 ? (
              <Text style={{ color: Colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>
                Aucun encaissement aujourd'hui
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(caisse.breakdown || []).map(m => {
                  const COLORS = {
                    cash: '#F97316', wave: '#0EA5E9', orange_money: '#F59E0B',
                    mtn_money: '#FACC15', card: '#8B5CF6', wallet: '#14B8A6', credit: '#6B7280'
                  };
                  const LABELS = {
                    cash: 'Espèces', wave: 'Wave', orange_money: 'Orange',
                    mtn_money: 'MTN', card: 'Carte', wallet: 'Wallet', credit: 'Ardoise'
                  };
                  const color = COLORS[m.method] || '#6B7280';
                  const pct = caisse.grand_total > 0 ? Math.round((m.total / caisse.grand_total) * 100) : 0;
                  return (
                    <View key={m.method} style={{
                      flex: 1, minWidth: '45%',
                      backgroundColor: color + '15',
                      borderRadius: 10, padding: 10,
                      borderWidth: 1, borderColor: color + '33',
                    }}>
                      <Text style={{ fontSize: 10, color: Colors.muted, fontWeight: '600', marginBottom: 2 }}>
                        {LABELS[m.method] || m.method}
                      </Text>
                      <Text style={{ fontSize: 15, fontWeight: '800', color }}>{fmt(m.total)}</Text>
                      <Text style={{ fontSize: 10, color: Colors.muted, marginTop: 1 }}>{pct}% · {m.count} pmt</Text>
                      <View style={{ marginTop: 6, height: 3, backgroundColor: color + '33', borderRadius: 3 }}>
                        <View style={{ height: 3, backgroundColor: color, borderRadius: 3, width: `${pct}%` }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* MES COMMANDES EN COURS */}
        {myOrders.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mes commandes actives</Text>
            {myOrders.map(order => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                activeOpacity={0.85}
              >
                <View style={styles.orderCardLeft}>
                  <View style={styles.orderTableBadge}>
                    <Text style={styles.orderTableText}>T{tables.find(t => t.id === order.table_id)?.number || order.table_id}</Text>
                  </View>
                  <View>
                    <Text style={styles.orderCardTitle}>Commande #{order.id}</Text>
                    <Text style={styles.orderCardSub}>{order.items?.length || 0} article(s)</Text>
                  </View>
                </View>
                <View style={styles.orderCardRight}>
                  <Text style={styles.orderTotal}>
                    {fmt((order.items || []).reduce((s, i) => s + i.unit_price * i.quantity, 0))}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── MODAL SAISIE MANUELLE ──â‚¬ */}
      <Modal visible={showManualModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}> Saisie manuelle</Text>
              <TouchableOpacity onPress={() => { setShowManualModal(false); setManualNum(''); }} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Entrez le numéro de la table</Text>

            {/* Champ numéro */}
            <TextInput
              style={styles.manualInput}
              placeholder="Ex: 3"
              placeholderTextColor={Colors.textFaint}
              keyboardType="number-pad"
              value={manualNum}
              onChangeText={setManualNum}
              autoFocus
              maxLength={3}
            />

            {/* Raccourcis tables rapides */}
            <Text style={styles.quickLabel}>Tables disponibles</Text>
            <View style={styles.quickGrid}>
              {tables.filter(t => t.status === 'free').slice(0, 8).map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.quickTableBtn}
                  onPress={() => {
                    setManualNum(String(t.number));
                  }}
                >
                  <Text style={styles.quickTableNum}>T{t.number}</Text>
                  <Text style={styles.quickTableLbl}>{t.label || 'Libre'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleManualTable}>
              <Ionicons name="arrow-forward-circle-outline" size={20} color={Colors.surface} />
              <Text style={styles.confirmBtnText}>Accéder à la table</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── BOUTON FLOTTANT IA ──â‚¬ */}
      <TouchableOpacity style={styles.fabChat} onPress={openChat} activeOpacity={0.85}>
        <Ionicons name="chatbubble-ellipses-outline" size={24} color="#fff" />
      </TouchableOpacity>

      {/* ── MODAL CHAT IA ──â‚¬ */}
      <Modal visible={showChat} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.chatOverlay}>
            <View style={styles.chatContainer}>
              {/* Header */}
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <View style={styles.chatAvatar}><Ionicons name="sparkles-outline" size={18} color="#fff" /></View>
                  <View>
                    <Text style={styles.chatTitle}>Assistant SOKORA</Text>
                    <Text style={styles.chatSub}>IA · Données en temps réel</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowChat(false)} style={styles.chatCloseBtn}>
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Messages */}
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={{ padding: 16, gap: 12 }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                renderItem={({ item }) => (
                  <View style={{ flexDirection: 'row', justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                    {item.role === 'assistant' && (
                      <View style={[styles.chatAvatar, { width: 28, height: 28 }]}><Ionicons name="sparkles-outline" size={13} color="#fff" /></View>
                    )}
                    <View style={[
                      styles.chatBubble,
                      item.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleBot
                    ]}>
                      <Text style={[styles.chatBubbleText, item.role === 'user' && { color: '#fff' }]}>
                        {item.content}
                      </Text>
                    </View>
                  </View>
                )}
                ListFooterComponent={chatLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <View style={[styles.chatAvatar, { width: 28, height: 28 }]}><Ionicons name="sparkles-outline" size={13} color="#fff" /></View>
                    <View style={styles.chatBubbleBot}>
                      <ActivityIndicator size="small" color={Colors.orange} />
                    </View>
                  </View>
                ) : null}
              />

              {/* Input */}
              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Posez votre question..."
                  placeholderTextColor={Colors.textFaint}
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.chatSendBtn, { opacity: chatInput.trim() ? 1 : 0.4 }]}
                  onPress={sendChat}
                  disabled={!chatInput.trim() || chatLoading}
                >
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.navy, paddingTop: 54, paddingBottom: 20,
    paddingHorizontal: Spacing.xl, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  greeting: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.55)', marginBottom: 2 },
  userName: { fontSize: Typography.xl, fontWeight: '800', color: Colors.surface },
  headerDate: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.4)', marginTop: 3, fontStyle: 'italic' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBtn: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  kpiRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, marginBottom: Spacing.lg },
  kpiCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderTopWidth: 3, alignItems: 'center', ...Shadow.sm },
  kpiIcon: { fontSize: 20, marginBottom: 6 },
  kpiValue: { fontSize: Typography.xl, fontWeight: '800', color: Colors.navy },
  kpiLabel: { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  actionBtn: { borderRadius: Radius.xl, paddingVertical: 15, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, ...Shadow.orange },
  actionBtnText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.surface },
  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sectionHeader: { marginBottom: Spacing.md },
  sectionTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.navy, marginBottom: 8 },
  legendRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: Typography.xs, color: Colors.textMuted },
  tablesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tableCard: { width: '30%', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', borderWidth: 2, ...Shadow.sm, position: 'relative' },
  tableCardMine: { borderColor: Colors.orange + '88', backgroundColor: Colors.orangePale },
  readyBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#22C55E', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, zIndex: 10 },
  readyBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  myTableBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: Colors.orange, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  myTableBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.surface },
  tableIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tableNum: { fontSize: Typography.xl, fontWeight: '800' },
  tableLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 6 },
  tablePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  tablePillText: { fontSize: 9, fontWeight: '700' },
  tableCap: { fontSize: Typography.xs, color: Colors.textFaint, marginTop: 4 },
  orderCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  orderCardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  orderTableBadge: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.orangePale, alignItems: 'center', justifyContent: 'center' },
  orderTableText: { fontSize: Typography.sm, fontWeight: '800', color: Colors.orange },
  orderCardTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.navy },
  orderCardSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  orderCardRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  orderTotal: { fontSize: Typography.base, fontWeight: '800', color: Colors.orange },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing['3xl'], paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  modalTitle: { fontSize: Typography.xl, fontWeight: '800', color: Colors.navy },
  modalSub: { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: Spacing.xl },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  manualInput: {
    backgroundColor: Colors.bg, borderRadius: Radius.lg, borderWidth: 2,
    borderColor: Colors.orange, padding: 16, fontSize: 32, fontWeight: '800',
    color: Colors.navy, textAlign: 'center', marginBottom: Spacing.lg,
  },
  quickLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  quickTableBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.lg, backgroundColor: Colors.tealPale, borderWidth: 1.5, borderColor: Colors.teal + '44', alignItems: 'center' },
  quickTableNum: { fontSize: Typography.base, fontWeight: '800', color: Colors.teal },
  quickTableLbl: { fontSize: 9, color: Colors.teal, marginTop: 1 },
  confirmBtn: { backgroundColor: Colors.orange, borderRadius: Radius.xl, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, ...Shadow.orange },
  confirmBtnText: { fontSize: Typography.md, fontWeight: '800', color: Colors.surface },
  // Floating button
  fabChat: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  // Chat modal
  chatOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  chatContainer:  { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%' },
  chatHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  chatTitle:      { fontSize: 15, fontWeight: '800', color: Colors.navy },
  chatSub:        { fontSize: 11, color: Colors.textMuted },
  chatCloseBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  chatBubble:     { maxWidth: '80%', borderRadius: 16, padding: 12 },
  chatBubbleUser: { backgroundColor: Colors.orange, borderBottomRightRadius: 4 },
  chatBubbleBot:  { backgroundColor: Colors.bg, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  chatBubbleText: { fontSize: 14, color: Colors.navy, lineHeight: 20 },
  chatInputRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  chatInput:      { flex: 1, backgroundColor: Colors.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.navy, maxHeight: 80, borderWidth: 1.5, borderColor: Colors.border },
  chatSendBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
});





