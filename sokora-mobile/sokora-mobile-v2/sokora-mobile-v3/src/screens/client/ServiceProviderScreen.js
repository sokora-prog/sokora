/**
 * ServiceProviderScreen — Profil artisan + réservation RDV
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../services/AuthContext';
import { API_URL } from '../../utils/constants';
import CityPicker from '../../components/CityPicker';
import DatePickerModal from '../../components/DatePickerModal';
import ScreenHeader from '../../components/ScreenHeader';
import ReceiptModal from '../../components/ReceiptModal';

const C = {
  navy: '#0F1E35', orange: '#FF6B35', teal: '#00D4AA',
  bg: '#F4F6F9', white: '#FFFFFF', text: '#1A1A2E', muted: '#8892A4',
  border: '#DDE4F0', gold: '#F59E0B',
};

// Champs spécialisés par catégorie
const SPECIALTY_FIELDS = {
  'Plomberie':           [{ key: 'urgence', label: 'Urgence ?', type: 'bool' }, { key: 'type_panne', label: 'Type de panne', type: 'select', options: ['Fuite d\'eau', 'Robinet', 'WC bouché', 'Chauffe-eau', 'Autre'] }],
  'Électricité':         [{ key: 'urgence', label: 'Urgence ?', type: 'bool' }, { key: 'type', label: 'Type d\'intervention', type: 'select', options: ['Panne générale', 'Installation', 'Prise/interrupteur', 'Tableau électrique', 'Autre'] }],
  'Lavage auto':         [{ key: 'vehicule', label: 'Type de véhicule', type: 'select', options: ['Voiture', 'SUV/4x4', 'Moto', 'Camionnette'] }, { key: 'formule', label: 'Formule', type: 'select', options: ['Lavage simple', 'Lavage complet', 'Détailing intérieur', 'Détailing complet'] }],
  'Pressing':            [{ key: 'nb_pieces', label: 'Nombre de pièces', type: 'number' }, { key: 'type_vetement', label: 'Type de vêtement', type: 'select', options: ['Chemise/chemisier', 'Pantalon', 'Costume/tailleur', 'Robe', 'Linge de maison', 'Mixte'] }, { key: 'delai', label: 'Délai souhaité', type: 'select', options: ['Express (24h)', '2-3 jours', '1 semaine'] }],
  'Coiffure à domicile': [{ key: 'type_coiffure', label: 'Type de coiffure', type: 'select', options: ['Tresses', 'Défrisage', 'Coupe homme', 'Coupe femme', 'Soins', 'Coloration'] }, { key: 'duree', label: 'Durée estimée', type: 'select', options: ['< 1h', '1-2h', '2-3h', '3h+'] }],
  'Mécanique auto':      [{ key: 'type_vehicule', label: 'Type de véhicule', type: 'select', options: ['Voiture essence', 'Voiture diesel', 'Moto', 'Camion'] }, { key: 'panne', label: 'Problème', type: 'text' }],
  'Baby-sitting':        [{ key: 'nb_enfants', label: 'Nombre d\'enfants', type: 'number' }, { key: 'age_enfants', label: 'Âge(s)', type: 'text' }],
  'Coursier / Livraison':[{ key: 'type_colis', label: 'Type de colis', type: 'select', options: ['Document', 'Petit colis', 'Grand colis', 'Courses alimentaires', 'Autre'] }, { key: 'urgence', label: 'Urgence ?', type: 'bool' }],
  'Jardinage':           [{ key: 'type_travaux', label: 'Type de travaux', type: 'select', options: ['Tonte de pelouse', 'Taille de haie', 'Entretien jardin', 'Création espace vert', 'Autre'] }, { key: 'surface', label: 'Surface estimée', type: 'select', options: ['< 50 m²', '50-100 m²', '100-200 m²', '> 200 m²'] }],
  'Peinture':            [{ key: 'type_travaux', label: 'Type de travaux', type: 'select', options: ['Peinture intérieure', 'Peinture extérieure', 'Décoration murale', 'Ravalement de façade'] }, { key: 'surface', label: 'Surface à peindre', type: 'select', options: ['< 20 m²', '20-50 m²', '50-100 m²', '> 100 m²'] }],
  'Informatique':        [{ key: 'type_panne', label: 'Type de problème', type: 'select', options: ['Panne PC/laptop', 'Virus/logiciel', 'Installation OS', 'Réseau/WiFi', 'Récupération données', 'Autre'] }, { key: 'urgence', label: 'Urgence ?', type: 'bool' }],
  'Nettoyage':           [{ key: 'type_nettoyage', label: 'Type de nettoyage', type: 'select', options: ['Ménage domicile', 'Nettoyage bureau', 'Nettoyage post-travaux', 'Nettoyage de vitres', 'Grand ménage'] }, { key: 'surface', label: 'Surface', type: 'select', options: ['< 50 m²', '50-100 m²', '100-200 m²', '> 200 m²'] }],
  'Cuisine / Traiteur':  [{ key: 'type_service', label: 'Type de service', type: 'select', options: ['Repas quotidien', 'Traiteur événement', 'Cuisine à domicile', 'Préparation plats', 'Buffet'] }, { key: 'nb_personnes', label: 'Nombre de personnes', type: 'number' }],
};

export default function ServiceProviderScreen({ route, navigation }) {
  const { provider } = route.params;
  const { user } = useAuth();

  const [showBook, setShowBook] = useState(false);
  const [date,     setDate]     = useState('');
  const [address,  setAddress]  = useState('');
  const [desc,     setDesc]     = useState('');
  const [price,    setPrice]    = useState(String(provider.base_price || ''));
  const [specialty, setSpecialty] = useState({});
  const [saving,   setSaving]   = useState(false);
  const [receipt,     setReceipt]     = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const specialtyFields = SPECIALTY_FIELDS[provider.category_name] || [];

  const handleBook = async () => {
    if (!date) { Alert.alert('Date requise', 'Veuillez choisir une date de RDV'); return; }
    if (!address.trim()) { Alert.alert('Adresse requise', 'Indiquez l\'adresse de la prestation'); return; }
    setSaving(true);
    try {
      const token = user ? (require('expo-secure-store').getItemAsync?.('sokora_token') || null) : null;
      const res = await fetch(`${API_URL}/services/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name:    user?.full_name || 'Client',
          client_phone:   user?.phone_number || '',
          provider_id:    provider.id,
          description:    desc,
          address:        address,
          scheduled_at:   date ? `${date}T08:00:00` : null,
          agreed_price:   price ? Number(price) : provider.base_price,
          payment_method: 'wallet',
          specialty_data: JSON.stringify(specialty),
        }),
      });
      if (!res.ok) throw new Error('Erreur lors de la réservation');
      const data = await res.json();
      setShowBook(false);
      setReceipt({
        client_name:   data.client_name,
        provider_name: provider.name,
        category:      provider.category_name,
        address:       address,
        scheduled_at:  date,
        amount:        data.agreed_price || provider.base_price,
        qr_token:      data.qr_release_token,
      });
      setShowReceipt(true);
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = n => n ? `${Number(n).toLocaleString('fr-FR')} F` : '—';
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(provider.rating) ? '⭐' : '☆').join('');

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader
          navigation={navigation}
          title={provider?.name || 'Artisan'}
          subtitle={provider?.category_name || ''}
          dark={true}
          rightIcon="share-outline"
          onRightPress={() => {}}
        />
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroAvatar}>
            <Text style={{ fontSize: 40 }}>{provider.category_icon}</Text>
          </View>
          <Text style={s.heroName}>{provider.name}</Text>
          <Text style={s.heroCat}>{provider.category_name}</Text>
          {provider.is_verified && (
            <View style={s.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={C.teal} />
              <Text style={s.verifiedTxt}>Vérifié SOKORA</Text>
            </View>
          )}
        </View>

        <View style={s.body}>
          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statVal}>{stars}</Text>
              <Text style={s.statLbl}>{provider.rating.toFixed(1)} ({provider.reviews_count} avis)</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={[s.statVal, { color: C.orange }]}>{fmt(provider.base_price)}</Text>
              <Text style={s.statLbl}>par {provider.price_unit}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Ionicons name="location-outline" size={18} color={C.teal} />
              <Text style={s.statLbl}>{provider.city}</Text>
            </View>
          </View>

          {/* À propos */}
          {provider.description && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>À propos</Text>
              <Text style={s.descTxt}>{provider.description}</Text>
            </View>
          )}

          {/* Contact */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Contact</Text>
            <View style={s.contactRow}>
              <Ionicons name="call-outline" size={18} color={C.orange} />
              <Text style={s.contactTxt}>{provider.phone}</Text>
            </View>
            {provider.neighborhood && (
              <View style={s.contactRow}>
                <Ionicons name="location-outline" size={18} color={C.orange} />
                <Text style={s.contactTxt}>{provider.neighborhood}, {provider.city}</Text>
              </View>
            )}
          </View>

          {/* Info paiement sécurisé */}
          <View style={s.escrowInfo}>
            <Ionicons name="shield-checkmark" size={20} color={C.teal} />
            <View style={{ flex: 1 }}>
              <Text style={s.escrowTitle}>Paiement sécurisé SOKORA</Text>
              <Text style={s.escrowSub}>Votre paiement est bloqué jusqu'à la fin de la prestation. L'artisan reçoit les fonds uniquement après validation.</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bouton réserver */}
      <View style={s.footer}>
        <TouchableOpacity style={s.bookBtn} onPress={() => setShowBook(true)} activeOpacity={0.85}>
          <Ionicons name="calendar-outline" size={20} color="#fff" />
          <Text style={s.bookBtnTxt}>Prendre rendez-vous</Text>
        </TouchableOpacity>
      </View>

      <ReceiptModal
        visible={showReceipt}
        onClose={() => { setShowReceipt(false); navigation.navigate('MyServices'); }}
        receipt={receipt}
        type="service"
      />

      {/* Modal réservation */}
      <Modal visible={showBook} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>📅 Réserver {provider.name}</Text>
            <TouchableOpacity onPress={() => setShowBook(false)}>
              <Ionicons name="close" size={24} color={C.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">

            <DatePickerModal
              value={date}
              onChange={setDate}
              placeholder="Choisir la date du RDV"
              label="Date du rendez-vous"
              minDate={new Date().toISOString().split('T')[0]}
            />

            <View>
              <Text style={s.fieldLabel}>Adresse de la prestation *</Text>
              <TextInput
                style={s.fieldInput}
                placeholder="Ex: Cocody, Rue des Jardins, Villa 12"
                placeholderTextColor={C.muted}
                value={address}
                onChangeText={setAddress}
                multiline
              />
            </View>

            {/* Champs spécialisés */}
            {specialtyFields.map(field => (
              <View key={field.key}>
                <Text style={s.fieldLabel}>{field.label}</Text>
                {field.type === 'bool' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {['Oui', 'Non'].map(opt => (
                      <TouchableOpacity
                        key={opt}
                        style={[s.optBtn, specialty[field.key] === opt && s.optBtnActive]}
                        onPress={() => setSpecialty(sp => ({ ...sp, [field.key]: opt }))}
                      >
                        <Text style={[s.optBtnTxt, specialty[field.key] === opt && s.optBtnTxtActive]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {field.type === 'select' && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {field.options.map(opt => (
                      <TouchableOpacity
                        key={opt}
                        style={[s.optBtn, specialty[field.key] === opt && s.optBtnActive]}
                        onPress={() => setSpecialty(sp => ({ ...sp, [field.key]: opt }))}
                      >
                        <Text style={[s.optBtnTxt, specialty[field.key] === opt && s.optBtnTxtActive]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {(field.type === 'text' || field.type === 'number') && (
                  <TextInput
                    style={s.fieldInput}
                    placeholder={field.label}
                    placeholderTextColor={C.muted}
                    keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                    value={specialty[field.key] || ''}
                    onChangeText={v => setSpecialty(sp => ({ ...sp, [field.key]: v }))}
                  />
                )}
              </View>
            ))}

            <View>
              <Text style={s.fieldLabel}>Description du besoin</Text>
              <TextInput
                style={[s.fieldInput, { height: 80 }]}
                placeholder="Décrivez votre besoin..."
                placeholderTextColor={C.muted}
                value={desc}
                onChangeText={setDesc}
                multiline
              />
            </View>

            <View>
              <Text style={s.fieldLabel}>Prix convenu (FCFA)</Text>
              <TextInput
                style={s.fieldInput}
                placeholder={String(provider.base_price || '')}
                placeholderTextColor={C.muted}
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </ScrollView>

          <View style={s.modalFooter}>
            <TouchableOpacity style={s.bookBtn} onPress={handleBook} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="send-outline" size={18} color="#fff" />
                  <Text style={s.bookBtnTxt}>Envoyer la demande</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  hero: { backgroundColor: C.navy, padding: 24, paddingTop: 20, alignItems: 'center' },
  heroAvatar: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroName: { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center' },
  heroCat:  { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: 'rgba(0,212,170,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  verifiedTxt:   { fontSize: 11, fontWeight: '700', color: C.teal },

  body: { padding: 16 },

  statsRow: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 16 },
  stat:     { flex: 1, alignItems: 'center', gap: 4 },
  statVal:  { fontSize: 14, fontWeight: '800', color: C.text },
  statLbl:  { fontSize: 10, color: C.muted, textAlign: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: C.border },

  section:      { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 10 },
  descTxt:  { fontSize: 14, color: C.muted, lineHeight: 22 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  contactTxt: { fontSize: 14, color: C.text, fontWeight: '500' },

  escrowInfo: { flexDirection: 'row', gap: 12, backgroundColor: '#00D4AA15', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#00D4AA30', marginBottom: 16 },
  escrowTitle: { fontSize: 13, fontWeight: '800', color: C.teal, marginBottom: 4 },
  escrowSub:   { fontSize: 12, color: C.muted, lineHeight: 18 },

  footer:  { padding: 16, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
  bookBtn: { backgroundColor: C.orange, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: C.orange, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  bookBtnTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },

  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  modalFooter: { padding: 16, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  fieldInput: { backgroundColor: C.white, borderRadius: 12, padding: 13, fontSize: 14, color: C.text, borderWidth: 1.5, borderColor: C.border },
  optBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border },
  optBtnActive: { backgroundColor: C.orange, borderColor: C.orange },
  optBtnTxt:    { fontSize: 13, fontWeight: '600', color: C.muted },
  optBtnTxtActive: { color: '#fff' },
});
