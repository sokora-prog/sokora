// ─── PALETTE SOKORA ───────────────────────────────────────────────────────────
export const Colors = {
  navy:        '#1A2E4A',
  navyMid:     '#243A5E',
  navyLight:   '#2E4A76',
  orange:      '#F07D1A',
  orangeLight: '#F9A050',
  orangePale:  '#FFF4EA',
  teal:        '#19A99D',
  tealLight:   '#2DCFC2',
  tealPale:    '#EDFAF8',
  green:       '#4CAF6E',
  greenPale:   '#F0FAF2',
  red:         '#E84040',
  redPale:     '#FFF0F0',
  purple:      '#6366F1',
  purplePale:  '#EEF0FF',
  bg:          '#F2F5FB',
  surface:     '#FFFFFF',
  border:      '#DDE4F0',
  text:        '#1A2E4A',
  textMuted:   '#7A8FAB',
  textFaint:   '#B8C4D8',
  gold:        '#F59E0B',
};

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────
export const Typography = {
  // Tailles
  xs:   11,
  sm:   12,
  base: 14,
  md:   15,
  lg:   17,
  xl:   20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 34,
  // Familles (Expo Google Fonts à ajouter)
  regular:  'System',
  medium:   'System',
  semibold: 'System',
  bold:     'System',
};

// ─── SPACING ──────────────────────────────────────────────────────────────────
export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

// ─── BORDER RADIUS ────────────────────────────────────────────────────────────
export const Radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  '2xl': 24,
  full: 999,
};

// ─── SHADOWS ──────────────────────────────────────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor: '#1A2E4A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A2E4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1A2E4A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  orange: {
    shadowColor: '#F07D1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 6,
  },
};

// ─── TABLE STATUS ─────────────────────────────────────────────────────────────
export const TableStatus = {
  free:     { label: 'Libre',     bg: '#EDFAF8', color: '#19A99D', icon: 'checkmark-circle-outline' },
  occupied: { label: 'Occupée',   bg: '#FFF4EA', color: '#F07D1A', icon: 'people' },
  reserved: { label: 'Réservée',  bg: '#EEF0FF', color: '#6366F1', icon: 'time' },
};

// ─── ORDER STATUS ─────────────────────────────────────────────────────────────
export const OrderStatus = {
  open:      { label: 'En cours',  bg: '#FFF4EA', color: '#F07D1A' },
  sent:      { label: 'En cuisine',bg: '#EEF0FF', color: '#6366F1' },
  ready:     { label: 'Prêt',      bg: '#F0FAF2', color: '#4CAF6E' },
  paid:      { label: 'Payée',     bg: '#EDFAF8', color: '#19A99D' },
  cancelled: { label: 'Annulée',   bg: '#FFF0F0', color: '#E84040' },
};

// ─── API URL ──────────────────────────────────────────────────────────────────
// Détection automatique de l'IP via NativeModules.SourceCode (React Native natif)
// ou window.location (Expo Web). Fonctionne sans package supplémentaire.
// En prod : remplacer PROD_URL par 'https://api.sokora.app'
import { NativeModules, Platform } from 'react-native';

const PROD_URL = 'https://api.sokora.fun';
const BACKEND_PORT = 8001;

const _getApiUrl = () => {
  if (!__DEV__) return PROD_URL;

  // Web : même IP que le serveur Expo
  if (Platform.OS === 'web') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host}:${BACKEND_PORT}`;
  }

  // Android / iOS : extraire l'IP depuis l'URL du bundle Metro
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/http:\/\/([\d.]+):/);
    if (match?.[1]) return `http://${match[1]}:${BACKEND_PORT}`;
  } catch {}

  // Fallback si rien ne fonctionne
  return `http://192.168.1.2:${BACKEND_PORT}`;
};

export const API_URL = _getApiUrl();


