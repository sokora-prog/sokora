/**
 * SOKORA — Système i18n FR/EN
 * Usage :
 *   const { t, lang, setLang } = useTranslation();
 *   t('wallet.balance') → "Solde" (FR) ou "Balance" (EN)
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
//  TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  fr: {
    // ── Général ───────────────────────────────────────────────────────────────
    app_name:       'SOKORA',
    loading:        'Chargement…',
    error:          'Erreur',
    retry:          'Réessayer',
    close:          'Fermer',
    confirm:        'Confirmer',
    cancel:         'Annuler',
    save:           'Enregistrer',
    back:           'Retour',
    share:          'Partager',
    continue:       'Continuer',
    success:        'Succès',
    no_results:     'Aucun résultat',

    // ── Auth ──────────────────────────────────────────────────────────────────
    'auth.login':       'Se connecter',
    'auth.logout':      'Se déconnecter',
    'auth.phone':       'Numéro de téléphone',
    'auth.password':    'Mot de passe',
    'auth.welcome':     'Bienvenue',
    'auth.connect':     'Connexion',
    'auth.role_staff':  'Espace staff',
    'auth.role_client': 'Espace client',
    'auth.enter_code':  'Entrez votre code OTP',

    // ── Navigation ────────────────────────────────────────────────────────────
    'nav.home':         'Accueil',
    'nav.orders':       'Commandes',
    'nav.profile':      'Mon profil',
    'nav.wallet':       'Wallet',
    'nav.bookings':     'Réservations',
    'nav.trips':        'Voyages',

    // ── Wallet ────────────────────────────────────────────────────────────────
    'wallet.title':           'Mon Wallet SOKORA',
    'wallet.balance':         'Solde',
    'wallet.points':          'Points fidélité',
    'wallet.qr_code':         'QR Code de paiement',
    'wallet.qr_refresh':      'Rafraîchi dans',
    'wallet.qr_hint':         'Présentez ce QR à la caisse',
    'wallet.tx_history':      'Historique des transactions',
    'wallet.tx_empty':        'Aucune transaction',
    'wallet.tx_earn':         'Gain',
    'wallet.tx_spend':        'Dépense',
    'wallet.tx_topup':        'Recharge',
    'wallet.all_services':    'Tous les services',
    'wallet.topup':           'Recharger',
    'wallet.redeem':          'Utiliser mes points',
    'wallet.error_load':      'Impossible de charger le wallet',

    // ── Hôtel ──────────────────────────────────────────────────────────────────
    'hotel.search':           'Rechercher un hôtel',
    'hotel.search_hint':      'Ville, pays…',
    'hotel.checkin':          "Date d'arrivée",
    'hotel.checkout':         'Date de départ',
    'hotel.guests':           'Voyageurs',
    'hotel.rooms':            'Chambres',
    'hotel.available':        'Disponible',
    'hotel.book':             'Réserver',
    'hotel.booking_confirm':  'Confirmation de réservation',
    'hotel.my_bookings':      'Mes réservations',
    'hotel.booking_empty':    'Aucune réservation',
    'hotel.qr_checkin':       "QR Code d'entrée",
    'hotel.status_confirmed': 'Confirmée',
    'hotel.status_pending':   'En attente',
    'hotel.status_cancelled': 'Annulée',
    'hotel.status_checked_in':'Enregistré',
    'hotel.cancel':           'Annuler la réservation',
    'hotel.total':            'Total',
    'hotel.per_night':        'par nuit',

    // ── Voyage ────────────────────────────────────────────────────────────────
    'voyage.search':          'Rechercher un trajet',
    'voyage.from':            'Départ',
    'voyage.to':              'Arrivée',
    'voyage.date':            'Date de départ',
    'voyage.passengers':      'Passagers',
    'voyage.seats':           'Sièges disponibles',
    'voyage.pick_seat':       'Choisir mon siège',
    'voyage.my_trips':        'Mes voyages',
    'voyage.trip_empty':      'Aucun voyage',
    'voyage.qr_boarding':     "QR Code d'embarquement",
    'voyage.status_booked':   'Réservé',
    'voyage.status_confirmed':'Confirmé',
    'voyage.status_boarded':  'Embarqué',
    'voyage.status_cancelled':'Annulé',
    'voyage.departure':       'Départ',
    'voyage.arrival':         'Arrivée',
    'voyage.seat':            'Siège',
    'voyage.price':           'Prix',
    'voyage.book':            'Réserver ce siège',

    // ── Commandes ─────────────────────────────────────────────────────────────
    'order.my_orders':        'Mes commandes',
    'order.empty':            'Aucune commande',
    'order.status_open':      'En attente',
    'order.status_kitchen':   'En cuisine',
    'order.status_ready':     'Prêt',
    'order.status_served':    'Servi',
    'order.status_paid':      'Payée',
    'order.filter_open':      'En cours',
    'order.filter_paid':      'Payées',
    'order.filter_all':       'Toutes',

    // ── Profil ────────────────────────────────────────────────────────────────
    'profile.title':          'Mon profil',
    'profile.language':       'Langue',
    'profile.french':         'Français',
    'profile.english':        'English',
  },

  en: {
    // ── General ───────────────────────────────────────────────────────────────
    app_name:       'SOKORA',
    loading:        'Loading…',
    error:          'Error',
    retry:          'Retry',
    close:          'Close',
    confirm:        'Confirm',
    cancel:         'Cancel',
    save:           'Save',
    back:           'Back',
    share:          'Share',
    continue:       'Continue',
    success:        'Success',
    no_results:     'No results',

    // ── Auth ──────────────────────────────────────────────────────────────────
    'auth.login':       'Sign in',
    'auth.logout':      'Sign out',
    'auth.phone':       'Phone number',
    'auth.password':    'Password',
    'auth.welcome':     'Welcome',
    'auth.connect':     'Connect',
    'auth.role_staff':  'Staff space',
    'auth.role_client': 'Client space',
    'auth.enter_code':  'Enter your OTP code',

    // ── Navigation ────────────────────────────────────────────────────────────
    'nav.home':         'Home',
    'nav.orders':       'Orders',
    'nav.profile':      'My profile',
    'nav.wallet':       'Wallet',
    'nav.bookings':     'Bookings',
    'nav.trips':        'Trips',

    // ── Wallet ────────────────────────────────────────────────────────────────
    'wallet.title':           'My SOKORA Wallet',
    'wallet.balance':         'Balance',
    'wallet.points':          'Loyalty points',
    'wallet.qr_code':         'Payment QR Code',
    'wallet.qr_refresh':      'Refreshed in',
    'wallet.qr_hint':         'Show this QR at checkout',
    'wallet.tx_history':      'Transaction history',
    'wallet.tx_empty':        'No transactions yet',
    'wallet.tx_earn':         'Earned',
    'wallet.tx_spend':        'Spent',
    'wallet.tx_topup':        'Top-up',
    'wallet.all_services':    'All services',
    'wallet.topup':           'Top up',
    'wallet.redeem':          'Redeem points',
    'wallet.error_load':      'Unable to load wallet',

    // ── Hotel ─────────────────────────────────────────────────────────────────
    'hotel.search':           'Search a hotel',
    'hotel.search_hint':      'City, country…',
    'hotel.checkin':          'Check-in date',
    'hotel.checkout':         'Check-out date',
    'hotel.guests':           'Guests',
    'hotel.rooms':            'Rooms',
    'hotel.available':        'Available',
    'hotel.book':             'Book',
    'hotel.booking_confirm':  'Booking confirmation',
    'hotel.my_bookings':      'My bookings',
    'hotel.booking_empty':    'No bookings yet',
    'hotel.qr_checkin':       'Check-in QR Code',
    'hotel.status_confirmed': 'Confirmed',
    'hotel.status_pending':   'Pending',
    'hotel.status_cancelled': 'Cancelled',
    'hotel.status_checked_in':'Checked in',
    'hotel.cancel':           'Cancel booking',
    'hotel.total':            'Total',
    'hotel.per_night':        'per night',

    // ── Voyage ────────────────────────────────────────────────────────────────
    'voyage.search':          'Search a trip',
    'voyage.from':            'From',
    'voyage.to':              'To',
    'voyage.date':            'Departure date',
    'voyage.passengers':      'Passengers',
    'voyage.seats':           'Available seats',
    'voyage.pick_seat':       'Choose my seat',
    'voyage.my_trips':        'My trips',
    'voyage.trip_empty':      'No trips yet',
    'voyage.qr_boarding':     'Boarding QR Code',
    'voyage.status_booked':   'Booked',
    'voyage.status_confirmed':'Confirmed',
    'voyage.status_boarded':  'Boarded',
    'voyage.status_cancelled':'Cancelled',
    'voyage.departure':       'Departure',
    'voyage.arrival':         'Arrival',
    'voyage.seat':            'Seat',
    'voyage.price':           'Price',
    'voyage.book':            'Book this seat',

    // ── Orders ────────────────────────────────────────────────────────────────
    'order.my_orders':        'My orders',
    'order.empty':            'No orders',
    'order.status_open':      'Pending',
    'order.status_kitchen':   'In kitchen',
    'order.status_ready':     'Ready',
    'order.status_served':    'Served',
    'order.status_paid':      'Paid',
    'order.filter_open':      'Active',
    'order.filter_paid':      'Paid',
    'order.filter_all':       'All',

    // ── Profile ───────────────────────────────────────────────────────────────
    'profile.title':          'My profile',
    'profile.language':       'Language',
    'profile.french':         'Français',
    'profile.english':        'English',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
const I18nContext = createContext(null);
const STORAGE_KEY = 'sokora_lang';

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('fr');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(v => { if (v === 'en' || v === 'fr') setLangState(v); })
      .catch(() => {});
  }, []);

  const setLang = async (l) => {
    setLangState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  };

  const t = (key, fallback) => {
    const dict = T[lang] || T.fr;
    return dict[key] ?? T.fr[key] ?? fallback ?? key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback silencieux si appelé hors provider
    return { lang: 'fr', setLang: () => {}, t: (k, fb) => T.fr[k] ?? fb ?? k };
  }
  return ctx;
}
