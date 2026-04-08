/**
 * ReceiptModal — SOKORA
 * Reçu automatique après chaque paiement.
 * Props:
 *   visible      — bool
 *   onClose      — () => void
 *   receipt      — objet avec les données du reçu
 *   type         — 'service' | 'hotel' | 'voyage' | 'wallet'
 */
import React from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Share,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';

const C = {
  navy:   '#0F1E35',
  orange: '#FF6B35',
  teal:   '#00D4AA',
  bg:     '#F4F6F9',
  white:  '#FFFFFF',
  muted:  '#8892A4',
  border: '#DDE4F0',
};

// ── Séparateur pointillés style ticket ───────────────────────────────────────
const DottedLine = () => (
  <View style={{ flexDirection: 'row', marginVertical: 12 }}>
    {Array.from({ length: 30 }).map((_, i) => (
      <View key={i} style={{ width: 8, height: 1, backgroundColor: '#DDE4F0', marginRight: 4 }} />
    ))}
  </View>
);

// ── Ligne de détail ───────────────────────────────────────────────────────────
const DetailRow = ({ icon, label, value, highlight }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Text style={{ fontSize: 13, color: '#8892A4' }}>{icon} {label}</Text>
    <Text style={{
      fontSize: 13,
      fontWeight: highlight ? '800' : '600',
      color: highlight ? '#FF6B35' : '#0F1E35',
      maxWidth: '55%',
      textAlign: 'right',
    }}>
      {value}
    </Text>
  </View>
);

// ── Formatage montant ─────────────────────────────────────────────────────────
const fmtAmount = (n) => {
  if (!n && n !== 0) return '—';
  return `${Number(n).toLocaleString('fr-FR')} F CFA`;
};

// ── Formatage date ────────────────────────────────────────────────────────────
const fmtDate = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    const hh    = String(d.getHours()).padStart(2, '0');
    const mm    = String(d.getMinutes()).padStart(2, '0');
    if (hh === '00' && mm === '00') return `${day}/${month}/${year}`;
    return `${day}/${month}/${year} à ${hh}:${mm}`;
  } catch {
    return String(val);
  }
};

// ── Génère le numéro de référence ─────────────────────────────────────────────
const makeRef = (type) =>
  `REF-${type.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

// ── Contenu selon type ────────────────────────────────────────────────────────
function ReceiptBody({ type, receipt }) {
  if (type === 'service') {
    return (
      <>
        <DetailRow icon="👤" label="Client"           value={receipt.client_name   || '—'} />
        <DetailRow icon="🔧" label="Prestataire"      value={receipt.provider_name || '—'} />
        <DetailRow icon="📋" label="Service"          value={receipt.category      || '—'} />
        <DetailRow icon="📍" label="Adresse"          value={receipt.address       || '—'} />
        <DetailRow icon="📅" label="RDV"              value={fmtDate(receipt.scheduled_at)} />
        <DetailRow icon="💰" label="Montant"          value={fmtAmount(receipt.amount)} highlight />
        <DetailRow icon="🔒" label="Statut paiement"  value="Fonds sécurisés en escrow" />
      </>
    );
  }

  if (type === 'hotel') {
    return (
      <>
        <DetailRow icon="🏨" label="Hôtel"    value={receipt.hotel_name || '—'} />
        <DetailRow icon="🛏️" label="Chambre"  value={`${receipt.room_type || ''} n°${receipt.room_number || '—'}`} />
        <DetailRow icon="📅" label="Arrivée"  value={fmtDate(receipt.checkin_date)} />
        <DetailRow icon="📅" label="Départ"   value={fmtDate(receipt.checkout_date)} />
        <DetailRow icon="🌙" label="Durée"    value={`${receipt.nights || 1} nuit(s)`} />
        <DetailRow icon="💰" label="Montant"  value={fmtAmount(receipt.amount)} highlight />
      </>
    );
  }

  if (type === 'voyage') {
    return (
      <>
        <DetailRow icon="🚌" label="Trajet"   value={`${receipt.origin || '—'} → ${receipt.destination || '—'}`} />
        <DetailRow icon="📅" label="Départ"   value={fmtDate(receipt.departure_at)} />
        <DetailRow icon="💺" label="Siège(s)" value={receipt.seats || receipt.seat_number || '—'} />
        <DetailRow icon="💰" label="Montant"  value={fmtAmount(receipt.amount)} highlight />
      </>
    );
  }

  if (type === 'wallet') {
    return (
      <>
        <DetailRow icon="💳" label="De"      value={receipt.from_name   || '—'} />
        <DetailRow icon="🏪" label="Vers"    value={receipt.to_name     || '—'} />
        <DetailRow icon="💰" label="Montant" value={fmtAmount(receipt.amount)} highlight />
        <DetailRow icon="📝" label="Note"    value={receipt.description || '—'} />
      </>
    );
  }

  return null;
}

// ── QR légende selon type ─────────────────────────────────────────────────────
const QR_HINTS = {
  service: "Montrez à l'artisan après la prestation",
  hotel:   "QR Check-in à l'accueil",
  voyage:  "QR d'embarquement",
  wallet:  "QR de paiement",
};

// ── Texte share ───────────────────────────────────────────────────────────────
function buildShareText(type, receipt, ref) {
  const lines = [
    `🧡 Reçu SOKORA — ${ref}`,
    `Date : ${fmtDate(new Date().toISOString())}`,
    '',
  ];
  if (type === 'service') {
    lines.push(`Client : ${receipt.client_name || '—'}`);
    lines.push(`Prestataire : ${receipt.provider_name || '—'}`);
    lines.push(`Service : ${receipt.category || '—'}`);
    lines.push(`RDV : ${fmtDate(receipt.scheduled_at)}`);
    lines.push(`Montant : ${fmtAmount(receipt.amount)}`);
    lines.push(`Statut : Fonds sécurisés en escrow`);
  } else if (type === 'hotel') {
    lines.push(`Hôtel : ${receipt.hotel_name || '—'}`);
    lines.push(`Chambre : ${receipt.room_type || ''} n°${receipt.room_number || '—'}`);
    lines.push(`Arrivée : ${fmtDate(receipt.checkin_date)}`);
    lines.push(`Départ : ${fmtDate(receipt.checkout_date)}`);
    lines.push(`Durée : ${receipt.nights || 1} nuit(s)`);
    lines.push(`Montant : ${fmtAmount(receipt.amount)}`);
  } else if (type === 'voyage') {
    lines.push(`Trajet : ${receipt.origin || '—'} → ${receipt.destination || '—'}`);
    lines.push(`Départ : ${fmtDate(receipt.departure_at)}`);
    lines.push(`Siège(s) : ${receipt.seats || receipt.seat_number || '—'}`);
    lines.push(`Montant : ${fmtAmount(receipt.amount)}`);
  } else if (type === 'wallet') {
    lines.push(`De : ${receipt.from_name || '—'}`);
    lines.push(`Vers : ${receipt.to_name || '—'}`);
    lines.push(`Montant : ${fmtAmount(receipt.amount)}`);
    lines.push(`Note : ${receipt.description || '—'}`);
  }
  lines.push('');
  lines.push('Merci de faire confiance à SOKORA 🧡');
  return lines.join('\n');
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function ReceiptModal({ visible, onClose, receipt, type = 'service' }) {
  if (!receipt) return null;

  const ref = React.useMemo(() => makeRef(type), []);

  const handleShare = async () => {
    try {
      await Share.share({ message: buildShareText(type, receipt, ref) });
    } catch (_) {}
  };

  const now = new Date();
  const day   = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year  = now.getFullYear();
  const hh    = String(now.getHours()).padStart(2, '0');
  const mm    = String(now.getMinutes()).padStart(2, '0');
  const dateStr = `${day}/${month}/${year} à ${hh}:${mm}`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={st.overlay}>
        <View style={st.sheet}>
          {/* ── Header navy ──────────────────────────────────────────────── */}
          <View style={st.header}>
            <Text style={st.headerLogo}>SOKORA</Text>
            <View style={st.paidBadge}>
              <Text style={st.paidBadgeTxt}>✓ PAYÉ</Text>
            </View>
            <Text style={st.headerRef}>{ref}</Text>
            <Text style={st.headerDate}>{dateStr}</Text>
          </View>

          {/* ── Corps scrollable ─────────────────────────────────────────── */}
          <ScrollView
            style={{ flex: 1, backgroundColor: C.white }}
            contentContainerStyle={st.body}
            showsVerticalScrollIndicator={false}
          >
            {/* Détails selon type */}
            <ReceiptBody type={type} receipt={receipt} />

            <DottedLine />

            {/* QR Code (optionnel) */}
            {receipt.qr_token && (
              <>
                <View style={st.qrSection}>
                  <QRCode
                    value={receipt.qr_token}
                    size={140}
                    color={C.navy}
                    backgroundColor={C.white}
                  />
                  <Text style={st.qrHint}>
                    {QR_HINTS[type] || 'Présentez ce QR code'}
                  </Text>
                </View>
                <DottedLine />
              </>
            )}

            {/* Footer message */}
            <View style={st.footerMsg}>
              <Text style={st.footerText}>Merci de faire confiance à SOKORA 🧡</Text>
              <Text style={st.footerSub}>Conservez ce reçu comme preuve de paiement</Text>
            </View>

            {/* Boutons */}
            <View style={st.btnRow}>
              <TouchableOpacity style={st.btnOutline} onPress={handleShare} activeOpacity={0.8}>
                <Ionicons name="share-outline" size={18} color={C.navy} />
                <Text style={st.btnOutlineTxt}>Partager</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.btnFill} onPress={onClose} activeOpacity={0.85}>
                <Text style={st.btnFillTxt}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    flex: 1,
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },

  // Header navy
  header: {
    backgroundColor: C.navy,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 6,
  },
  headerLogo: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
  },
  paidBadge: {
    backgroundColor: C.teal,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginTop: 4,
  },
  paidBadgeTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  headerRef: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  headerDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },

  // Corps
  body: {
    padding: 20,
    paddingBottom: 32,
  },

  // QR section
  qrSection: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  qrHint: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
    maxWidth: 220,
  },

  // Footer message
  footerMsg: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 4,
  },
  footerText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.navy,
    textAlign: 'center',
  },
  footerSub: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
  },

  // Boutons
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  btnOutlineTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: C.navy,
  },
  btnFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: C.orange,
    shadowColor: C.orange,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  btnFillTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
