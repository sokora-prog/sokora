/**
 * AppNavigator — SOKORA v3
 * Navigation complète : Client | Serveur | Manager | Chauffeur
 */
import React from 'react';
import { View, ActivityIndicator, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../services/AuthContext';
import { useTranslation } from '../services/i18n';
import { Colors, Radius, Shadow, OrderStatus } from '../utils/constants';
import { ordersService } from '../services/api';
import { notificationService } from '../services/notifications';

// ── AUTH ────────────────────────────────────────────────────────────────────
import LoginScreen from '../screens/auth/LoginScreen';

// ── WAITER ──────────────────────────────────────────────────────────────────
import WaiterHomeScreen  from '../screens/waiter/HomeScreen';
import ScannerScreen     from '../screens/waiter/ScannerScreen';
import NewOrderScreen    from '../screens/waiter/NewOrderScreen';
import OrderDetailScreen from '../screens/waiter/OrderDetailScreen';
import WaiterStatsScreen from '../screens/waiter/StatsScreen';
import TableOrdersScreen from '../screens/waiter/TableOrdersScreen';
import ArdoiseScreen     from '../screens/waiter/ArdoiseScreen';
import ClosingScreen     from '../screens/waiter/ClosingScreen';
import StockScreen       from '../screens/waiter/StockScreen';
import InventoryScreen   from '../screens/waiter/InventoryScreen';
import KPIScreen         from '../screens/waiter/KPIScreen';
import CaisseScreen      from '../screens/waiter/CaisseScreen';
import WalletScanScreen  from '../screens/waiter/WalletScanScreen';
import VisualMenuScreen  from '../screens/waiter/VisualMenuScreen';

// ── CLIENT ──────────────────────────────────────────────────────────────────
import ClientHomeScreen        from '../screens/client/ClientHomeScreen';
import WalletScreen            from '../screens/client/WalletScreen';
import WalletPayScreen         from '../screens/client/WalletPayScreen';
import VoyageSearchScreen      from '../screens/client/VoyageSearchScreen';
import SeatPickerScreen        from '../screens/client/SeatPickerScreen';
import BookingConfirmScreen    from '../screens/client/BookingConfirmScreen';
import PromoFeedScreen         from '../screens/client/PromoFeedScreen';
import SokoraReelsScreen       from '../screens/client/SokoraReelsScreen';
import DiscoverScreen          from '../screens/client/DiscoverScreen';
import EstablishmentPageScreen from '../screens/client/EstablishmentPageScreen';
import PremiumProfileScreen    from '../screens/client/PremiumProfileScreen';
import HotelSearchScreen         from '../screens/client/HotelSearchScreen';
import HotelDetailScreen         from '../screens/client/HotelDetailScreen';
import MyBookingsScreen          from '../screens/client/MyBookingsScreen';
import MyTripsScreen             from '../screens/client/MyTripsScreen';
import PaymentRequestScreen      from '../screens/client/PaymentRequestScreen';
import LoyaltyScreen             from '../screens/client/LoyaltyScreen';

// ── CHAUFFEUR ────────────────────────────────────────────────────────────────
import DriverScanScreen from '../screens/driver/DriverScanScreen';

// ── HÔTEL ─────────────────────────────────────────────────────────────────────
import ReceptionScreen from '../screens/hotel/ReceptionScreen';

// ── ARTISAN ───────────────────────────────────────────────────────────────────
import ArtisanHomeScreen from '../screens/artisan/ArtisanHomeScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// ── LOADING ──────────────────────────────────────────────────────────────────
const SplashScreen = () => (
  <View style={{ flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator size="large" color={Colors.orange} />
  </View>
);

// ════════════════════════════════════════════════════════════════════════════
// 🛒 NAVIGATION CLIENT
// ════════════════════════════════════════════════════════════════════════════

function ClientHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientHome"         component={ClientHomeScreen} />
      <Stack.Screen name="EstablishmentPage"  component={EstablishmentPageScreen} />
      <Stack.Screen name="VoyageSearch"       component={VoyageSearchScreen} />
      <Stack.Screen name="SeatPicker"         component={SeatPickerScreen} />
      <Stack.Screen name="BookingConfirm"     component={BookingConfirmScreen} />
      <Stack.Screen name="Wallet"             component={WalletScreen} />
      <Stack.Screen name="WalletPay"          component={WalletPayScreen} />
      <Stack.Screen name="PremiumProfile"     component={PremiumProfileScreen} />
      <Stack.Screen name="HotelSearch"        component={HotelSearchScreen} />
      <Stack.Screen name="HotelDetail"        component={HotelDetailScreen} />
      <Stack.Screen name="MyBookings"         component={MyBookingsScreen} />
      <Stack.Screen name="MyTrips"            component={MyTripsScreen} />
      <Stack.Screen name="PaymentRequest"     component={PaymentRequestScreen} />
      <Stack.Screen name="Loyalty"            component={LoyaltyScreen} />
    </Stack.Navigator>
  );
}

function ClientDiscoverStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Discover"           component={DiscoverScreen} />
      <Stack.Screen name="EstablishmentPage"  component={EstablishmentPageScreen} />
      <Stack.Screen name="PromoFeed"          component={SokoraReelsScreen} />
      <Stack.Screen name="VoyageSearch"       component={VoyageSearchScreen} />
      <Stack.Screen name="SeatPicker"         component={SeatPickerScreen} />
      <Stack.Screen name="BookingConfirm"     component={BookingConfirmScreen} />
      <Stack.Screen name="MyTrips"            component={MyTripsScreen} />
      <Stack.Screen name="HotelSearch"        component={HotelSearchScreen} />
      <Stack.Screen name="HotelDetail"        component={HotelDetailScreen} />
      <Stack.Screen name="MyBookings"         component={MyBookingsScreen} />
      <Stack.Screen name="WalletPay"          component={WalletPayScreen} />
      <Stack.Screen name="WalletMain"         component={WalletPayScreen} />
      <Stack.Screen name="Wallet"             component={WalletScreen} />
      <Stack.Screen name="PaymentRequest"     component={PaymentRequestScreen} />
    </Stack.Navigator>
  );
}

function ClientPulseStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PromoFeedMain"      component={SokoraReelsScreen} />
      <Stack.Screen name="Discover"           component={DiscoverScreen} />
      <Stack.Screen name="EstablishmentPage"  component={EstablishmentPageScreen} />
      <Stack.Screen name="HotelSearch"        component={HotelSearchScreen} />
      <Stack.Screen name="HotelDetail"        component={HotelDetailScreen} />
      <Stack.Screen name="WalletPay"          component={WalletPayScreen} />
      <Stack.Screen name="WalletMain"         component={WalletPayScreen} />
      <Stack.Screen name="PaymentRequest"     component={PaymentRequestScreen} />
      <Stack.Screen name="VoyageSearch"       component={VoyageSearchScreen} />
      <Stack.Screen name="SeatPicker"         component={SeatPickerScreen} />
      <Stack.Screen name="BookingConfirm"     component={BookingConfirmScreen} />
    </Stack.Navigator>
  );
}

function ClientWalletStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WalletMain"     component={WalletPayScreen} />
      <Stack.Screen name="Wallet"         component={WalletScreen} />
      <Stack.Screen name="PremiumProfile" component={PremiumProfileScreen} />
    </Stack.Navigator>
  );
}

function ClientProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PremiumMain"    component={PremiumProfileScreen} />
      <Stack.Screen name="WalletPay"      component={WalletPayScreen} />
      <Stack.Screen name="Wallet"         component={WalletScreen} />
      <Stack.Screen name="HotelSearch"    component={HotelSearchScreen} />
      <Stack.Screen name="HotelDetail"   component={HotelDetailScreen} />
      <Stack.Screen name="MyBookings"    component={MyBookingsScreen} />
      <Stack.Screen name="MyTrips"       component={MyTripsScreen} />
      <Stack.Screen name="Loyalty"       component={LoyaltyScreen} />
    </Stack.Navigator>
  );
}

function ClientTabs() {
  const { t } = useTranslation();
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
          height: 66,
          paddingBottom: 12,
          paddingTop: 8,
          ...Shadow.md,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            'Accueil':  focused ? 'home'                  : 'home-outline',
            'Explorer': focused ? 'compass'               : 'compass-outline',
            'PULSE':    focused ? 'radio-button-on'       : 'radio-button-off',
            'Wallet':   focused ? 'wallet'                : 'wallet-outline',
            'Profil':   focused ? 'person-circle'         : 'person-circle-outline',
          };
          const icon = icons[route.name] || 'ellipse-outline';
          // Tab PULSE — bouton spécial central
          if (route.name === 'PULSE') {
            return (
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: focused ? Colors.orange : Colors.navy,
                justifyContent: 'center', alignItems: 'center',
                marginBottom: 16,
                shadowColor: Colors.orange,
                shadowOpacity: focused ? 0.5 : 0.2,
                shadowRadius: 10, elevation: 8,
                borderWidth: 3, borderColor: focused ? Colors.orangeLight : Colors.navyLight,
              }}>
                <Text style={{ fontSize: 20 }}>📡</Text>
              </View>
            );
          }
          return <Ionicons name={icon} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Accueil"  component={ClientHomeStack}    options={{ tabBarLabel: t('nav.home')    }} />
      <Tab.Screen name="Explorer" component={ClientDiscoverStack} options={{ tabBarLabel: 'Explorer'      }} />
      <Tab.Screen name="PULSE"    component={ClientPulseStack}   options={{ tabBarLabel: 'PULSE'         }} />
      <Tab.Screen name="Wallet"   component={ClientWalletStack}  options={{ tabBarLabel: t('nav.wallet') }} />
      <Tab.Screen name="Profil"   component={ClientProfileStack} options={{ tabBarLabel: t('nav.profile')}} />
    </Tab.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 👨‍🍳 NAVIGATION SERVEUR
// ════════════════════════════════════════════════════════════════════════════

function WaiterHomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home"          component={WaiterHomeScreen} />
      <Stack.Screen name="Scanner"       component={ScannerScreen} />
      <Stack.Screen name="NewOrder"      component={NewOrderScreen} />
      <Stack.Screen name="VisualMenu"    component={VisualMenuScreen} />
      <Stack.Screen name="TableDetail"   component={OrderDetailScreen} />
      <Stack.Screen name="OrderDetail"   component={OrderDetailScreen} />
      <Stack.Screen name="TableOrders"   component={TableOrdersScreen} />
      <Stack.Screen name="Closing"       component={ClosingScreen} />
      <Stack.Screen name="Stock"         component={StockScreen} />
      <Stack.Screen name="Inventory"     component={InventoryScreen} />
      <Stack.Screen name="KPI"           component={KPIScreen} />
      <Stack.Screen name="Caisse"        component={CaisseScreen} />
      <Stack.Screen name="WalletScan"    component={WalletScanScreen} />
      <Stack.Screen name="Wallet"        component={WalletScreen} />
      <Stack.Screen name="VoyageSearch"  component={VoyageSearchScreen} />
      <Stack.Screen name="SeatPicker"    component={SeatPickerScreen} />
      <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
      <Stack.Screen name="DriverScan"    component={DriverScanScreen} />
    </Stack.Navigator>
  );
}

function ArdoiseStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ArdoiseList" component={ArdoiseScreen} />
    </Stack.Navigator>
  );
}

function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrdersList"  component={OrdersListScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
    </Stack.Navigator>
  );
}

// ── Liste commandes inline ───────────────────────────────────────────────────
function OrdersListScreen({ navigation }) {
  const [orders, setOrders]         = React.useState([]);
  const [loading, setLoading]       = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter]         = React.useState('open');

  const fmt = n => new Intl.NumberFormat('fr-FR').format(n ?? 0) + ' F';

  const load = React.useCallback(async () => {
    try {
      const { data } = await ordersService.list({
        status: filter === 'all' ? undefined : filter.toUpperCase()
      });
      setOrders(data);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const FILTERS = [
    { id: 'open',  label: 'En cours' },
    { id: 'sent',  label: 'Cuisine'  },
    { id: 'ready', label: 'Prêtes'   },
    { id: 'paid',  label: 'Payées'   },
    { id: 'all',   label: 'Toutes'   },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={{ backgroundColor: Colors.navy, paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.surface }}>Mes commandes</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, padding: 12, paddingBottom: 6 }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.id} style={{
            flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
            backgroundColor: filter === f.id ? Colors.orange : Colors.surface,
            borderWidth: 1, borderColor: filter === f.id ? Colors.orange : Colors.border,
          }} onPress={() => setFilter(f.id)}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: filter === f.id ? '#fff' : Colors.textMuted }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={orders}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.orange} />}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => {
          const st = OrderStatus[item.status?.toLowerCase()] || OrderStatus.open;
          const total = (item.items || []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
          return (
            <TouchableOpacity style={{
              backgroundColor: Colors.surface, borderRadius: 14,
              padding: 14, borderWidth: 1, borderColor: Colors.border,
              flexDirection: 'row', alignItems: 'center', gap: 10,
              ...Shadow.sm,
            }} onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}>
              <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.orangePale, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.orange }}>T{item.table_number || item.table_id}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.navy }}>Commande #{item.id}</Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 1 }}>{item.items?.length || 0} article(s)</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={{ backgroundColor: st.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: st.color }}>{st.label}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.orange }}>{fmt(total)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textFaint} />
            <Text style={{ color: Colors.textMuted, marginTop: 12, fontSize: 15 }}>Aucune commande</Text>
          </View>
        }
      />
    </View>
  );
}

function WaiterTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.orange,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1, borderTopColor: Colors.border,
          height: 64, paddingBottom: 10, paddingTop: 8,
          ...Shadow.md,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            'Accueil':     focused ? 'grid'    : 'grid-outline',
            'Commandes':   focused ? 'receipt' : 'receipt-outline',
            'Ardoise':     focused ? 'card'    : 'card-outline',
            'Mon profil':  focused ? 'person'  : 'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Accueil"    component={WaiterHomeStack} />
      <Tab.Screen name="Commandes"  component={OrdersStack} />
      <Tab.Screen name="Ardoise"    component={ArdoiseStack} />
      <Tab.Screen name="Mon profil" component={WaiterStatsScreen} />
    </Tab.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 🚗 NAVIGATION CHAUFFEUR
// ════════════════════════════════════════════════════════════════════════════

function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.orange,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, height: 64, paddingBottom: 10, paddingTop: 8, ...Shadow.md },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const icons = { 'Scanner': focused ? 'qr-code' : 'qr-code-outline', 'Profil': focused ? 'person' : 'person-outline' };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Scanner" component={DriverScanStack} />
      <Tab.Screen name="Profil"  component={WaiterStatsScreen} />
    </Tab.Navigator>
  );
}

function DriverScanStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverScanMain" component={DriverScanScreen} />
    </Stack.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 🏨 NAVIGATION RÉCEPTION HÔTEL
// ════════════════════════════════════════════════════════════════════════════

function HotelTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.teal,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, height: 64, paddingBottom: 10, paddingTop: 8, ...Shadow.md },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const icons = { 'Accueil': focused ? 'home' : 'home-outline', 'Mon profil': focused ? 'person' : 'person-outline' };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Accueil"    component={ReceptionScreen} />
      <Tab.Screen name="Mon profil" component={WaiterStatsScreen} />
    </Tab.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 🔨 NAVIGATION ARTISAN
// ════════════════════════════════════════════════════════════════════════════

function ArtisanTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.purple || '#6366f1',
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, height: 64, paddingBottom: 10, paddingTop: 8, ...Shadow.md },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            'Accueil':    focused ? 'construct'    : 'construct-outline',
            'Mon profil': focused ? 'person'        : 'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Accueil"    component={ArtisanHomeScreen} />
      <Tab.Screen name="Mon profil" component={WaiterStatsScreen} />
    </Tab.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 🏢 NAVIGATION MANAGER (inclut accès client + waiter + admin)
// ════════════════════════════════════════════════════════════════════════════

function ManagerTabs() {
  // Les managers voient les tabs serveur avec accès aux fonctions avancées
  return <WaiterTabs />;
}

// ════════════════════════════════════════════════════════════════════════════
// 🚀 NAVIGATION PRINCIPALE
// ════════════════════════════════════════════════════════════════════════════

export default function AppNavigator() {
  const { user, loading } = useAuth();

  React.useEffect(() => {
    notificationService.setup();
  }, []);

  if (loading) return <SplashScreen />;

  // ── Pas connecté ──
  if (!user) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // ── Routage par rôle (normalise majuscules/minuscules) ──
  const renderNav = () => {
    const role = (user.role || '').toLowerCase();
    const estType = (user.establishment_type || '').toLowerCase();
    switch (role) {
      case 'super_admin':
      case 'manager':
        return <ManagerTabs />;
      case 'waiter':
        // Le personnel d'un hôtel voit l'interface réception, pas restaurant
        if (estType === 'hotel') return <HotelTabs />;
        return <WaiterTabs />;
      case 'driver':
        return <DriverTabs />;
      case 'artisan':
        return <ArtisanTabs />;
      case 'client':
      default:
        return <ClientTabs />;
    }
  };

  return (
    <NavigationContainer>
      {renderNav()}
    </NavigationContainer>
  );
}
