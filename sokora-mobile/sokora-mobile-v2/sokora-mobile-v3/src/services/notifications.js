import { Alert } from 'react-native';

// Service de notifications SOKORA
// expo-notifications retiré d'Expo Go depuis SDK 53.
// → Alertes natives (Alert.alert) dans Expo Go
// → Pour les vraies notifications système : builder un development build (npx expo run:android)

const fmt = n => new Intl.NumberFormat('fr-FR').format(n);

export const notificationService = {
  setup: async () => true,

  send: async (title, body) => {
    // Silencieux en arrière-plan — Alert uniquement si appelé explicitement
  },

  alert: (title, body) => Alert.alert(title, body, [{ text: 'OK' }]),

  orderReady:      (tableNumber)      => notificationService.alert('🍽️ Commande prête !', `Table ${tableNumber} — prête à être servie.`),
  ardoisePayment:  (clientName, amt)  => notificationService.alert('💳 Paiement reçu', `${clientName} a remboursé ${fmt(amt)} F CFA.`),
  promo:           (message)          => notificationService.alert('🏷️ Offre SOKORA', message),
  walletTopup:     (amount)           => notificationService.alert('✅ Wallet crédité', `+${fmt(amount)} F CFA sur votre wallet.`),
  boarding:        (route, departure) => notificationService.alert('🚌 Embarquement', `${route} · Départ à ${departure}`),
};
