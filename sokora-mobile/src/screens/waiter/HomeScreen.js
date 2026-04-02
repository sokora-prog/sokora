import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { tablesService, ordersService } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { Colors, Spacing, Radius, Shadow, Typography, TableStatus as StatusConfig } from '../../utils/constants';
import { LoadingScreen, StatusBadge, Avatar } from '../../components/UI';
import { Ionicons } from '@expo/vector-icons';

export default function WaiterHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await tablesService.list();
      setTables(res.data);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleTablePress = async (table) => {
    if (table.status === 'occupied') {
      try {
        setLoading(true);
        // On récupère uniquement la commande OUVERTE de CETTE table
        const res = await ordersService.list({ table_id: table.id, status: 'open' });
        if (res.data && res.data.length > 0) {
          navigation.navigate('TableOrders', { table, orders: res.data });
        } else {
          // Si la table est marquée occupée mais pas de commande trouvée
          navigation.navigate('NewOrder', { table });
        }
      } catch (e) {
        Alert.alert("Erreur", "Impossible de récupérer le détail.");
      } finally {
        setLoading(false);
      }
    } else {
      navigation.navigate('NewOrder', { table });
    }
  };

  if (loading && !refreshing) return <LoadingScreen />;

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadData();}} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Bonjour,</Text>
          <Text style={styles.name}>{user?.full_name}</Text>
        </View>
        <Avatar name={user?.full_name} size={45} />
      </View>

      <View style={styles.grid}>
        {tables.map(table => (
          <TouchableOpacity 
            key={table.id} 
            style={[styles.tableCard, { borderColor: table.status === 'free' ? Colors.border : Colors.orange }]}
            onPress={() => handleTablePress(table)}
          >
            <View style={[styles.statusDot, { backgroundColor: table.status === 'free' ? Colors.teal : Colors.orange }]} />
            <Ionicons name="restaurant-outline" size={24} color={Colors.navy} />
            <Text style={styles.tableNum}>Table {table.number}</Text>
            <Text style={styles.tableStatus}>{table.status === 'free' ? 'Libre' : 'Occupée'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 40, backgroundColor: Colors.surface },
  welcome: { fontSize: 14, color: Colors.textMuted },
  name: { fontSize: 18, fontWeight: 'bold', color: Colors.navy },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'space-between' },
  tableCard: { width: '47%', backgroundColor: Colors.surface, padding: 20, borderRadius: 15, marginBottom: 15, alignItems: 'center', borderWidth: 1, ...Shadow.sm },
  statusDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
  tableNum: { fontSize: 16, fontWeight: 'bold', marginTop: 10, color: Colors.navy },
  tableStatus: { fontSize: 12, color: Colors.textMuted, marginTop: 4 }
});