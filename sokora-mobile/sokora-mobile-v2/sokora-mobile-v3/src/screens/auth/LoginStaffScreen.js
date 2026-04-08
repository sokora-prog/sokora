/**
 * LoginStaffScreen — SOKORA
 * Connexion pour Gérant / Serveur / Réception / Chauffeur
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Animated, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../services/AuthContext';

const N  = '#0F1E35'; // Navy
const NM = '#1A2E4A'; // Navy mid
const O  = '#FF6B35'; // Orange
const OL = '#FF8C5A'; // Orange clair
const W  = '#FFFFFF';
const WD = '#F4F6F9';
const MT = '#7A8FAB';

const STAFF_ROLES = [
  { icon: 'settings-outline',    label: 'Gérant',    color: O },
  { icon: 'restaurant-outline',  label: 'Serveur',   color: '#00D4AA' },
  { icon: 'bed-outline',         label: 'Réception', color: '#3B82F6' },
  { icon: 'car-outline',         label: 'Chauffeur', color: '#22C55E' },
];

const CLIENT_ROLES = ['client'];

export default function LoginStaffScreen({ navigation }) {
  const { login, logout } = useAuth();
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,  duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await login(phone.trim(), password);
      // Interdire l'accès staff aux clients
      if (user && user.role && CLIENT_ROLES.includes(user.role.toLowerCase())) {
        await logout();
        Alert.alert(
          'Espace incorrect',
          'Votre compte est un compte client. Utilisez l\'espace client pour vous connecter.',
          [{ text: 'OK' }]
        );
      }
      // Pour les rôles staff valides, AppNavigator redirige automatiquement
    } catch (err) {
      const msg = err.response?.data?.detail || 'Identifiants incorrects. Vérifiez votre numéro et mot de passe.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={N} />

      {/* Fond navy + orbes */}
      <View style={s.bgNavy} />
      <View style={s.orb1} />
      <View style={s.orb2} />
      <View style={s.bgWave} />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Bouton retour */}
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={W} />
          <Text style={s.backText}>Retour</Text>
        </TouchableOpacity>

        {/* Logo animé */}
        <Animated.View style={[s.logoSection, { opacity: fadeAnim, transform: [{ translateY: floatAnim }] }]}>
          <View style={s.logoRing}>
            <View style={s.logoInner}>
              <Ionicons name="flash" size={32} color={O} />
            </View>
          </View>
          <Text style={s.wordmark}>
            S<Text style={{ color: O }}>O</Text>KORA
          </Text>
          <Text style={s.titleMain}>Espace Pro SOKORA</Text>
          <Text style={s.subtitle}>Gérant · Serveur · Réception · Chauffeur</Text>
        </Animated.View>

        {/* Card blanche */}
        <Animated.View style={[s.card, { opacity: fadeAnim }]}>
          <Text style={s.cardTitle}>Connexion Pro 👔</Text>
          <Text style={s.cardSub}>Entrez vos identifiants professionnels</Text>

          {/* Erreur */}
          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#E84040" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* Input téléphone */}
          <View style={s.inputGroup}>
            <Text style={s.label}>NUMÉRO DE TÉLÉPHONE</Text>
            <View style={[s.inputRow, !!error && s.inputErr]}>
              <View style={s.inputIcon}>
                <Ionicons name="call-outline" size={18} color={O} />
              </View>
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
            </View>
          </View>

          {/* Input mot de passe */}
          <View style={s.inputGroup}>
            <Text style={s.label}>MOT DE PASSE</Text>
            <View style={[s.inputRow, !!error && s.inputErr]}>
              <View style={s.inputIcon}>
                <Ionicons name="lock-closed-outline" size={18} color={O} />
              </View>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={v => { setPassword(v); setError(''); }}
                placeholder="••••••••"
                placeholderTextColor={MT}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 10 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={MT} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bouton Se connecter */}
          <TouchableOpacity
            style={[s.mainBtn, loading && { opacity: 0.8 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={W} />
              : <>
                  <Ionicons name="log-in-outline" size={20} color={W} />
                  <Text style={s.mainBtnText}>Se connecter</Text>
                </>
            }
          </TouchableOpacity>

          {/* Séparateur */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>Rôles acceptés</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Tags des rôles */}
          <View style={s.rolesRow}>
            {STAFF_ROLES.map(r => (
              <View key={r.label} style={s.roleTag}>
                <Ionicons name={r.icon} size={11} color={r.color} />
                <Text style={[s.roleTagTxt, { color: r.color }]}>{r.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Text style={s.footer}>SOKORA © 2026 — Plateforme HoReCa Africaine</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: N },

  bgNavy: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '58%',
    backgroundColor: N,
  },
  orb1: {
    position: 'absolute', top: -60, right: -70,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(255,107,53,0.10)',
  },
  orb2: {
    position: 'absolute', top: 100, left: -90,
    width: 270, height: 270, borderRadius: 135,
    backgroundColor: 'rgba(0,212,170,0.06)',
  },
  bgWave: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
    backgroundColor: WD,
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 40,
  },

  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 16,
  },
  backText: { color: W, fontSize: 14, fontWeight: '600' },

  // Logo
  logoSection: { alignItems: 'center', marginBottom: 28 },
  logoRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  logoInner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: W,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: O, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  wordmark: {
    fontSize: 40, fontWeight: '900', color: W, letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 8,
  },
  titleMain: {
    fontSize: 18, fontWeight: '800', color: W, marginTop: 8,
  },
  subtitle: {
    fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4, letterSpacing: 0.3,
  },

  // Card
  card: {
    backgroundColor: W,
    borderRadius: 28,
    padding: 28,
    shadowColor: N,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: N, marginBottom: 4 },
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
  inputGroup: { marginBottom: 16 },
  label: {
    fontSize: 10, fontWeight: '700', color: MT,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WD, borderWidth: 1.5, borderColor: '#DDE4F0',
    borderRadius: 14, overflow: 'hidden',
  },
  inputErr: { borderColor: '#E84040' },
  inputIcon: {
    width: 46, height: 50, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: '#DDE4F0',
    backgroundColor: '#FFF4EA',
  },
  input: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: N,
  },

  // Bouton principal
  mainBtn: {
    backgroundColor: O, borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: 8,
    shadowColor: O, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  mainBtnText: { fontSize: 16, fontWeight: '800', color: W, letterSpacing: 0.3 },

  // Divider
  divider: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#DDE4F0' },
  dividerText: { fontSize: 11, color: MT, fontWeight: '600', marginHorizontal: 10 },

  // Rôles tags
  rolesRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
  },
  roleTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: WD, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#DDE4F0',
  },
  roleTagTxt: { fontSize: 11, fontWeight: '700' },

  footer: {
    textAlign: 'center', fontSize: 11, color: 'rgba(15,30,53,0.35)',
    marginTop: 24,
  },
});
