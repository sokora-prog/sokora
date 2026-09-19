/** Utilitaires de formatage partagés par toutes les vues. */

export const nf = (value, digits = 2) =>
  value === null || value === undefined || Number.isNaN(value)
    ? '—'
    : Number(value).toLocaleString('fr-FR', {
        minimumFractionDigits: digits, maximumFractionDigits: digits,
      });

export const money = (value, digits = 2) =>
  value === null || value === undefined ? '—' : `${nf(value, digits)} €`;

export const pct = (value, digits = 1) =>
  value === null || value === undefined ? '—' : `${nf(value * 100, digits)} %`;

export const signed = (value, digits = 2) => {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${nf(value, digits)}`;
};

export const odds = value => (value ? nf(value, 2) : '—');

export const dateShort = value => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
};

export const dateTime = value => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fr-FR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      });
};

/** Libellé lisible d'un couple marché / sélection. */
export function marketLabel(market, selection) {
  const m = (market || '').toUpperCase();
  const s = (selection || '').toUpperCase();
  const sides = { HOME: 'Domicile', AWAY: 'Extérieur', DRAW: 'Nul' };

  if (m === '1X2') return sides[s] || s;
  if (m === 'DOUBLE_CHANCE') {
    return { '1X': 'Domicile ou nul', 12: 'Domicile ou extérieur', X2: 'Nul ou extérieur' }[s] || s;
  }
  if (m === 'BTTS') return s === 'YES' ? 'Les deux marquent' : 'Un seul (ou aucun) marque';
  if (m === 'ODD_EVEN') return s === 'ODD' ? 'Total impair' : 'Total pair';
  if (m === 'CLEAN_SHEET') return `${sides[s] || s} sans encaisser`;
  if (m === 'TO_SCORE') return `${sides[s] || s} marque`;
  if (m === 'WIN_TO_NIL') return `${sides[s] || s} gagne sans encaisser`;
  if (m === 'CORRECT_SCORE') return `Score ${s}`;
  if (m.startsWith('HOME_OU_')) return `Domicile ${s === 'OVER' ? '+' : '−'} de ${m.slice(8)}`;
  if (m.startsWith('AWAY_OU_')) return `Extérieur ${s === 'OVER' ? '+' : '−'} de ${m.slice(8)}`;
  if (m.startsWith('OU_')) return `${s === 'OVER' ? 'Plus' : 'Moins'} de ${m.slice(3)} buts`;
  if (m.startsWith('AH_')) return `Handicap ${m.slice(3)} — ${sides[s] || s}`;
  return `${m} ${s}`;
}

/** Nom lisible d'un marché seul (sans sélection). */
export function marketName(market) {
  const m = (market || '').toUpperCase();
  if (m === '1X2') return 'Vainqueur (1X2)';
  if (m === 'BTTS') return 'Les deux marquent';
  if (m === 'DOUBLE_CHANCE') return 'Double chance';
  if (m === 'ODD_EVEN') return 'Pair / impair';
  if (m === 'CORRECT_SCORE') return 'Score exact';
  if (m === 'CLEAN_SHEET') return 'Sans encaisser';
  if (m === 'TO_SCORE') return 'Marque un but';
  if (m === 'WIN_TO_NIL') return 'Gagne sans encaisser';
  if (m.startsWith('HOME_OU_')) return `Buts domicile ${m.slice(8)}`;
  if (m.startsWith('AWAY_OU_')) return `Buts extérieur ${m.slice(8)}`;
  if (m.startsWith('OU_')) return `Total ${m.slice(3)} buts`;
  if (m.startsWith('AH_')) return `Handicap ${m.slice(3)}`;
  return m;
}

export const statusLabel = {
  PENDING: 'En cours', WON: 'Gagné', LOST: 'Perdu', VOID: 'Remboursé',
  HALF_WON: 'Demi-gain', HALF_LOST: 'Demi-perte', CASHOUT: 'Cash-out',
};

export const statusTone = {
  WON: 'good', HALF_WON: 'good', LOST: 'critical', HALF_LOST: 'serious',
  VOID: '', CASHOUT: '', PENDING: 'warning',
};

export const confidenceTone = {
  'ÉLEVÉE': 'good', 'BONNE': 'good', 'MOYENNE': 'warning',
  'FAIBLE': 'critical', 'AUCUNE DONNÉE': 'critical',
};
