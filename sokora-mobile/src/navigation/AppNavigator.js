import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../services/AuthContext';
import { Colors, Radius, Shadow } from '../utils/constants';

// ─── SCREENS AUTH ─────────────────────────────────────────────────────────────
import LoginScreen from '../screens/auth/LoginScreen';

// ─── SCREENS WAITER ───────────────────────────────────────────────────────────
import WaiterHomeScreen    from '../screens/waiter/HomeScreen';
import ScannerScreen       from '../screens/waiter/ScannerScreen';
import NewOrderScreen      from '../screens/waiter/NewOrderScreen';
import OrderDetailScreen   from '../screens/waiter/OrderDetailScreen';
import WaiterStatsScreen   from '../screens/waiter/StatsScreen';

// ─── SCREENS CLIENT — WALLET & VOYAGE ─────────────────────────────────────────
import WalletScreen         from '../screens/client/WalletScreen';
import VoyageSearchScreen   from '../screens/client/VoyageSearchScreen';
import SeatPickerScreen     from '../screens/client/SeatPickerScreen';
import BookingConfirmScreen from '../screens/client/BookingConfirmScreen';

// ─── SCREENS CHAUFFEUR ────────────────────────────────────────────────────────
import DriverScanScreen from '../screens/driver/DriverScanScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── LOADING ──────────────────────────────────────────────────────────────────
const SplashScreen = () => (
  <View style={{ flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator size="large" color={Colors.orange} />
  </View>
);

// ─── TAB NAVIGATOR SERVEUR ────────────────────────────────────────────────────
function WaiterTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.orange,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
          ...Shadow.md,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            'Accueil':     focused ? 'grid'           : 'grid-outline',
            'Commandes':   focused ? 'receipt'        : 'receipt-outline',
            'Mon profil':  focused ? 'person'         : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Accueil"    component={WaiterHomeStack} />
      <Tab.Screen name="Commandes"  component={OrdersStack} />
      <Tab.Screen name="Mon profil" component={WaiterStatsScreen} />
    </Tab.Navigator>
  );
}

// ─── STACK ACCUEIL SERVEUR ────────────────────────────────────────────────────
function WaiterHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home"        component={WaiterHomeScreen} />
      <Stack.Screen name="Scanner"     component={ScannerScreen} />
      <Stack.Screen name="NewOrder"    component={NewOrderScreen} />
      <Stack.Screen name="TableDetail" component={OrderDetailScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      {/* Wallet client */}
      <Stack.Screen name="Wallet"         component={WalletScreen} />
      {/* Voyage */}
      <Stack.Screen name="VoyageSearch"   component={VoyageSearchScreen} />
      <Stack.Screen name="SeatPicker"     component={SeatPickerScreen} />
      <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
      {/* Chauffeur */}
      <Stack.Screen name="DriverScan"     component={DriverScanScreen} />
    </Stack.Navigator>
  );
}

// ─── STACK COMMANDES ──────────────────────────────────────────────────────────
function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrdersList"  component={OrdersListScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
    </Stack.Navigator>
  );
}

// ─── LISTE COMMANDES (écran inline simple) ────────────────────────────────────
import { View as V, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ordersService } from '../services/api';
import { useAuth as useAuthHook } from '../services/AuthContext';
import { OrderStatus } from '../utils/constants';

function OrdersListScreen({ navigation }) {
  const { user } = useAuthHook();
  const [orders, setOrders]     = React.useState([]);
  const [loading, setLoading]   = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter]     = React.useState('open');

  const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

  const load = React.useCallback(async () => {
    try {
      const { data } = await ordersService.list({ status: filter === 'all' ? undefined : filter });
      setOrders(data);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const FILTERS = [
    { id: 'open',  label: 'En cours' },
    { id: 'sent',  label: 'Cuisine' },
    { id: 'paid',  label: 'Payées' },
    { id: 'all',   label: 'Toutes' },
  ];

  return (
    <V style={{ flex: 1, backgroundColor: Colors.bg }}>
      <V style={{ backgroundColor: Colors.navy, paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.surface }}>Mes commandes</Text>
      </V>

      {/* FILTRES */}
      <V style={{ flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 }}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.id}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
              backgroundColor: filter === f.id ? Colors.orange : Colors.surface,
              borderWidth: 1, borderColor: filter === f.id ? Colors.orange : Colors.border,
            }}
            onPress={() => setFilter(f.id)}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: filter === f.id ? Colors.surface : Colors.textMuted }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </V>

      <FlatList
        data={orders}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.orange} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => {
          const st = OrderStatus[item.status] || OrderStatus.open;
          const total = (item.items || []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
          return (
            <TouchableOpacity
              style={{
                backgroundColor: Colors.surface, borderRadius: 14,
                padding: 16, borderWidth: 1, borderColor: Colors.border,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                ...Shadow.sm,
              }}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
            >
              <V style={{
                width: 44, height: 44, borderRadius: 10,
                backgroundColor: Colors.orangePale, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.orange }}>
                  T{item.table_id}
                </Text>
              </V>
              <V style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.navy }}>
                  Commande #{item.id}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>
                  {item.items?.length || 0} article(s)
                </Text>
              </V>
              <V style={{ alignItems: 'flex-end', gap: 4 }}>
                <V style={{ backgroundColor: st.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: st.color }}>{st.label}</Text>
                </V>
                <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.orange }}>{fmt(total)}</Text>
              </V>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <V style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textFaint} />
            <Text style={{ color: Colors.textMuted, marginTop: 12, fontSize: 15 }}>Aucune commande</Text>
          </V>
        }
      />
    </V>
  );
}

// ─── TAB NAVIGATOR GÉRANT ─────────────────────────────────────────────────────
// Sera développé dans le prochain bloc (Phase 2 - App Gérant)
function ManagerTabs() {
  // Placeholder — redirige vers WaiterTabs pour l'instant
  // sera remplacé par les écrans gérant complets
  return <WaiterTabs />;
}

// ─── NAVIGATION PRINCIPALE ────────────────────────────────────────────────────
export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <SplashScreen />;

  if (!user) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Routage selon le rôle
  const isManager = ['manager', 'super_admin'].includes(user.role);
  const isWaiter  = user.role === 'waiter';

  return (
    <NavigationContainer>
      {isManager ? <ManagerTabs /> : <WaiterTabs />}
    </NavigationContainer>
  );
}
