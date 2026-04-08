/**
 * RegisterArtisanScreen — SOKORA
 * Inscription artisan en 2 étapes
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Animated, StatusBar,
  Alert, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../services/AuthContext';
import CityPicker from '../../components/CityPicker';
import { API_URL } from '../../utils/constants';

const O  = '#FF6B35';
const OD = '#E85520';
const N  = '#0F1E35';
const W  = '#FFFFFF';
const WD = '#FFF9F6';
const MT = '#7A8FAB';

const PRICE_UNITS = [
  'par heure',
  'par prestation',
  'par jour',
  'forfait',
  'sur devis',
];

export default function RegisterArtisanScreen({ navigation }) {
  const { login } = useAuth();

  // Étape courante
  const [step, setStep] = useState(1);

  // Step 1 — Infos personnelles
  const [fullName,   setFullName]   = useState('');
  const [phone,      setPhone]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [showConf,   setShowConf]   = useState(false);

  // Step 2 — Profil métier
  const [categories,    setCategories]    = useState([]);
  const [categoryId,    setCategoryId]    = useState(null);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [catModalOpen,  setCatModalOpen]  = useState(false);
  const [city,          setCity]          = useState('');
  const [neighborhood,  setNeighborhood]  = useState('');
  const [description,   setDescription]  = useState('');
  const [basePrice,     setBasePrice]     = useState('');
  const [priceUnit,     setPriceUnit]     = useState('par prestation');
  const [unitModalOpen, setUnitModalOpen] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/services/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : data.categories || []);
      }
    } catch {
      // silencieux — on garde la liste vide
    }
  };

  // ── Validation step 1 ────────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!fullName.trim()) { setError('Veuillez saisir votre nom complet'); return false; }
    if (!phone.trim())    { setError('Veuillez saisir votre numéro de téléphone'); return false; }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères'); return false; }
    if (password !== confirmPwd) { setError('Les mots de passe ne correspondent pas'); return false; }
    return true;
  };

  const goToStep2 = () => {
    setError('');
    if (validateStep1()) setStep(2);
  };

  // ── Soumission finale ─────────────────────────────────────────────────────────
  const handleRegister = async () => {
    setError('');
    if (!categoryId) { setError('Veuillez sélectionner une catégorie de métier'); return; }
    if (!city)       { setError('Veuillez sélectionner votre ville'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/artisan/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:    fullName.trim(),
          phone_number: phone.trim(),
          password,
          category_id:  categoryId,
          city,
          neighborhood: neighborhood.trim(),
          description:  description.trim(),
          base_price:   basePrice ? parseFloat(basePrice) : null,
          price_unit:   priceUnit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erreur lors de l\'inscription');

      // Login automatique si token retourné
      if (data.access_token) {
        // Naviguer directement — AppNavigator gérera le routage par rôle
        Alert.alert('Compte créé !', 'Bienvenue sur SOKORA Artisan 🔧', [
          { text: 'Continuer', onPress: () => login(phone.trim(), password) },
        ]);
      } else {
        Alert.alert('Compte créé !', 'Vous pouvez maintenant vous connecter.', [
          { text: 'Se connecter', onPress: () => navigation.navigate('LoginArtisan') },
        ]);
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={O} />

      <View style={s.bgOrange} />
      <View style={s.orb1} />
      <View style={s.orb2} />
      <View style={s.bgWave} />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Bouton retour */}
        <TouchableOpacity style={s.backBtn} onPress={() => step === 2 ? setStep(1) : navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={W} />
          <Text style={s.backText}>{step === 2 ? 'Étape précédente' : 'Retour'}</Text>
        </TouchableOpacity>

        {/* En-tête */}
        <Animated.View style={[s.header, { opacity: fadeAnim }]}>
          <View style={s.logoRing}>
            <View style={s.logoInner}>
              <Ionicons name="build" size={28} color={O} />
            </View>
          </View>
          <Text style={s.wordmark}>S<Text style={{ color: 'rgba(255,255,255,0.7)' }}>O</Text>KORA</Text>
          <Text style={s.headerTitle}>Devenir Artisan</Text>

          {/* Indicateur d'étape */}
          <View style={s.stepRow}>
            <View style={[s.stepDot, step >= 1 && s.stepDotActive]} />
            <View style={[s.stepLine, step >= 2 && s.stepLineActive]} />
            <View style={[s.stepDot, step >= 2 && s.stepDotActive]} />
          </View>
          <Text style={s.stepLabel}>Étape {step} / 2 — {step === 1 ? 'Infos personnelles' : 'Profil métier'}</Text>
        </Animated.View>

        {/* Card */}
        <Animated.View style={[s.card, { opacity: fadeAnim }]}>

          {/* Erreur */}
          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#E84040" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* ── ÉTAPE 1 ── */}
          {step === 1 && (
            <>
              <Text style={s.cardTitle}>Vos informations</Text>
              <Text style={s.cardSub}>Créez votre profil d'artisan SOKORA</Text>

              <Field label="NOM COMPLET" icon="person-outline">
                <TextInput
                  style={s.input}
                  value={fullName}
                  onChangeText={v => { setFullName(v); setError(''); }}
                  placeholder="Jean Kouamé"
                  placeholderTextColor={MT}
                  autoCapitalize="words"
                />
              </Field>

              <Field label="TÉLÉPHONE" icon="call-outline">
                <TextInput
                  style={s.input}
                  value={phone}
                  onChangeText={v => { setPhone(v); setError(''); }}
                  placeholder="+225 07 00 00 00 00"
                  placeholderTextColor={MT}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Field>

              <Field label="MOT DE PASSE" icon="lock-closed-outline">
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={v => { setPassword(v); setError(''); }}
                  placeholder="Minimum 6 caractères"
                  placeholderTextColor={MT}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 10 }}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={MT} />
                </TouchableOpacity>
              </Field>

              <Field label="CONFIRMER MDP" icon="lock-closed-outline">
                <TextInput
                  style={s.input}
                  value={confirmPwd}
                  onChangeText={v => { setConfirmPwd(v); setError(''); }}
                  placeholder="Répétez le mot de passe"
                  placeholderTextColor={MT}
                  secureTextEntry={!showConf}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowConf(!showConf)} style={{ padding: 10 }}>
                  <Ionicons name={showConf ? 'eye-off-outline' : 'eye-outline'} size={18} color={MT} />
                </TouchableOpacity>
              </Field>

              <TouchableOpacity style={s.mainBtn} onPress={goToStep2} activeOpacity={0.85}>
                <Text style={s.mainBtnText}>Suivant — Profil métier</Text>
                <Ionicons name="arrow-forward" size={18} color={W} />
              </TouchableOpacity>
            </>
          )}

          {/* ── ÉTAPE 2 ── */}
          {step === 2 && (
            <>
              <Text style={s.cardTitle}>Votre métier</Text>
              <Text style={s.cardSub}>Décrivez vos services pour être trouvé par les clients</Text>

              {/* Catégorie */}
              <View style={s.inputGroup}>
                <Text style={s.label}>CATÉGORIE DE MÉTIER *</Text>
                <TouchableOpacity
                  style={s.selectBtn}
                  onPress={() => setCatModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="construct-outline" size={18} color={O} />
                  <Text style={[s.selectTxt, !categoryId && { color: MT }]}>
                    {categoryLabel || 'Choisir une catégorie'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={MT} />
                </TouchableOpacity>
              </View>

              {/* Ville via CityPicker */}
              <View style={s.inputGroup}>
                <Text style={s.label}>VILLE *</Text>
                <CityPicker
                  value={city}
                  onChange={v => { setCity(v); setError(''); }}
                  placeholder="Sélectionner votre ville"
                  iconColor={O}
                />
              </View>

              {/* Quartier */}
              <Field label="QUARTIER / ZONE" icon="location-outline">
                <TextInput
                  style={s.input}
                  value={neighborhood}
                  onChangeText={v => { setNeighborhood(v); setError(''); }}
                  placeholder="Cocody, Zone 4..."
                  placeholderTextColor={MT}
                  autoCapitalize="words"
                />
              </Field>

              {/* Description */}
              <View style={s.inputGroup}>
                <Text style={s.label}>DESCRIPTION DE VOS SERVICES</Text>
                <TextInput
                  style={[s.input, s.inputMulti]}
                  value={description}
                  onChangeText={v => { setDescription(v); setError(''); }}
                  placeholder="Décrivez vos compétences, spécialités, années d'expérience..."
                  placeholderTextColor={MT}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Prix de base */}
              <Field label="PRIX DE BASE (FCFA)" icon="cash-outline">
                <TextInput
                  style={s.input}
                  value={basePrice}
                  onChangeText={v => setBasePrice(v.replace(/\D/g, ''))}
                  placeholder="5000"
                  placeholderTextColor={MT}
                  keyboardType="numeric"
                />
              </Field>

              {/* Unité de prix */}
              <View style={s.inputGroup}>
                <Text style={s.label}>UNITÉ DE PRIX</Text>
                <TouchableOpacity
                  style={s.selectBtn}
                  onPress={() => setUnitModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={18} color={O} />
                  <Text style={s.selectTxt}>{priceUnit}</Text>
                  <Ionicons name="chevron-down" size={16} color={MT} />
                </TouchableOpacity>
              </View>

              {/* Bouton créer */}
              <TouchableOpacity
                style={[s.mainBtn, loading && { opacity: 0.8 }]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={W} />
                  : <>
                      <Ionicons name="checkmark-circle-outline" size={20} color={W} />
                      <Text style={s.mainBtnText}>Créer mon compte</Text>
                    </>
                }
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        <Text style={s.footer}>SOKORA © 2026 — Plateforme HoReCa Africaine</Text>
      </ScrollView>

      {/* Modal catégories */}
      <Modal visible={catModalOpen} animationType="slide" transparent onRequestClose={() => setCatModalOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Catégorie de métier</Text>
              <TouchableOpacity onPress={() => setCatModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={MT} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={categories}
              keyExtractor={item => String(item.id || item.name || item)}
              renderItem={({ item }) => {
                const name  = item.name  || item.label || String(item);
                const id    = item.id    || item.name  || item;
                const isActive = categoryId === id;
                return (
                  <TouchableOpacity
                    style={[s.modalRow, isActive && s.modalRowActive]}
                    onPress={() => {
                      setCategoryId(id);
                      setCategoryLabel(name);
                      setCatModalOpen(false);
                      setError('');
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="construct-outline" size={16} color={isActive ? O : MT} />
                    <Text style={[s.modalRowTxt, isActive && { color: O, fontWeight: '700' }]}>{name}</Text>
                    {isActive && <Ionicons name="checkmark" size={18} color={O} />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={s.sep} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <ActivityIndicator color={O} />
                  <Text style={{ color: MT, marginTop: 10 }}>Chargement des catégories...</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal unité de prix */}
      <Modal visible={unitModalOpen} animationType="slide" transparent onRequestClose={() => setUnitModalOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: 320 }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Unité de prix</Text>
              <TouchableOpacity onPress={() => setUnitModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={MT} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={PRICE_UNITS}
              keyExtractor={item => item}
              renderItem={({ item }) => {
                const isActive = priceUnit === item;
                return (
                  <TouchableOpacity
                    style={[s.modalRow, isActive && s.modalRowActive]}
                    onPress={() => { setPriceUnit(item); setUnitModalOpen(false); }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="time-outline" size={16} color={isActive ? O : MT} />
                    <Text style={[s.modalRowTxt, isActive && { color: O, fontWeight: '700' }]}>{item}</Text>
                    {isActive && <Ionicons name="checkmark" size={18} color={O} />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={s.sep} />}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// Composant champ de saisie réutilisable
function Field({ label, icon, children }) {
  return (
    <View style={s.inputGroup}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputRow}>
        <View style={s.inputIcon}>
          <Ionicons name={icon} size={18} color={O} />
        </View>
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: O },

  bgOrange: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: O,
  },
  orb1: {
    position: 'absolute', top: -50, right: -60,
    width: 230, height: 230, borderRadius: 115,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  orb2: {
    position: 'absolute', top: 80, left: -80,
    width: 250, height: 250, borderRadius: 125,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  bgWave: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
    backgroundColor: WD,
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 40,
  },

  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 14,
  },
  backText: { color: W, fontSize: 14, fontWeight: '600' },

  // Header
  header: { alignItems: 'center', marginBottom: 24 },
  logoRing: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoInner: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: W, alignItems: 'center', justifyContent: 'center',
    shadowColor: OD, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  wordmark: { fontSize: 34, fontWeight: '900', color: W, letterSpacing: -1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: W, marginTop: 6 },

  stepRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 0,
  },
  stepDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  stepDotActive: { backgroundColor: W },
  stepLine: {
    width: 50, height: 3, backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 4,
  },
  stepLineActive: { backgroundColor: W },
  stepLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 8, letterSpacing: 0.3,
  },

  // Card
  card: {
    backgroundColor: W, borderRadius: 28, padding: 26,
    shadowColor: N, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 10,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: N, marginBottom: 4 },
  cardSub:   { fontSize: 13, color: MT, marginBottom: 20 },

  // Erreur
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F0', borderRadius: 10,
    padding: 12, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: '#E84040',
  },
  errorText: { flex: 1, fontSize: 13, color: '#E84040' },

  // Inputs
  inputGroup: { marginBottom: 14 },
  label: {
    fontSize: 10, fontWeight: '700', color: MT,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 7,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WD, borderWidth: 1.5, borderColor: '#F0D8CC',
    borderRadius: 13, overflow: 'hidden',
  },
  inputIcon: {
    width: 44, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: '#F0D8CC',
    backgroundColor: '#FFF0E8',
  },
  input: {
    flex: 1, paddingHorizontal: 13, paddingVertical: 13,
    fontSize: 14, color: N,
  },
  inputMulti: {
    height: 80, paddingTop: 12,
    borderWidth: 1.5, borderColor: '#F0D8CC', borderRadius: 13,
    backgroundColor: WD, marginTop: 0,
  },

  // Select custom
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: WD, borderWidth: 1.5, borderColor: '#F0D8CC',
    borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13,
  },
  selectTxt: { flex: 1, fontSize: 14, color: N, fontWeight: '500' },

  // Bouton principal
  mainBtn: {
    backgroundColor: O, borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: 10,
    shadowColor: OD, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  mainBtnText: { fontSize: 15, fontWeight: '800', color: W, letterSpacing: 0.3 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15,30,53,0.6)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: W, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '80%', paddingTop: 6,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20,
    shadowOffset: { width: 0, height: -5 }, elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F2F8',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: N },
  modalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  modalRowActive: { backgroundColor: '#FFF4EF' },
  modalRowTxt: { flex: 1, fontSize: 14, color: N, fontWeight: '500' },
  sep: { height: 1, backgroundColor: '#F0F2F8', marginHorizontal: 20 },

  footer: {
    textAlign: 'center', fontSize: 11, color: 'rgba(15,30,53,0.35)',
    marginTop: 24,
  },
});
