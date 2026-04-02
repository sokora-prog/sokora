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
  free:     { label: 'Libre',     bg: '#EDFAF8', color: '#19A99D', icon: 'check-circle' },
  occupied: { label: 'Occupée',   bg: '#FFF4EA', color: '#F07D1A', icon: 'people' },
  reserved: { label: 'Réservée',  bg: '#EEF0FF', color: '#6366F1', icon: 'time' },
};

// ─── ORDER STATUS ─────────────────────────────────────────────────────────────
export const OrderStatus = {
  open:        { label: 'Ouverte',     bg: '#FFF4EA', color: '#F07D1A' },
  sent:        { label: 'En cuisine',  bg: '#EEF0FF', color: '#6366F1' },
  in_progress: { label: 'En prép.',    bg: '#FFF0EE', color: '#E25C3B' },
  ready:       { label: 'Prêt',        bg: '#F0FAF2', color: '#4CAF6E' },
  served:      { label: 'Servi',       bg: '#EDFAF8', color: '#19A99D' },
  paid:        { label: 'Payée',       bg: '#EDFAF8', color: '#19A99D' },
  cancelled:   { label: 'Annulée',     bg: '#FFF0F0', color: '#E84040' },
};

// Helper : normalise un statut backend (UPPERCASE) vers la clé du OrderStatus
export const getOrderStatus = (status) => {
  const key = (status || 'open').toLowerCase();
  return OrderStatus[key] || OrderStatus.open;
};

// ─── API URL ──────────────────────────────────────────────────────────────────
// En dev : IP de votre machine sur le réseau local
// En prod : https://api.sokora.app
export const API_URL = __DEV__
  ? 'http://10.217.105.43:8081'   // ← remplacer par votre IP locale
  : 'https://api.sokora.app';
