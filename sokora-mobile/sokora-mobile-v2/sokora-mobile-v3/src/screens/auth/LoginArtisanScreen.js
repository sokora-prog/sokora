/**
 * LoginArtisanScreen — SOKORA
 * Connexion ARTISAN via téléphone + mot de passe
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Animated, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../services/AuthContext';

const O  = '#FF6B35'; // Orange SOKORA
const OL = '#FF8C5A'; // Orange clair
const OD = '#E85520'; // Orange foncé
const N  = '#0F1E35'; // Navy
const W  = '#FFFFFF';
const WD = '#FFF9F6';
const MT = '#7A8FAB';

export default function LoginArtisanScreen({ navigation }) {
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
        Animated.timing(floatAnim, { toValue: -9, duration: 2100, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,  duration: 2100, useNativeDriver: true }),
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
      // Vérifier que le rôle est bien ARTISAN
      if (user && user.role && user.role.toLowerCase() !== 'artisan') {
        await logout();
        Alert.alert(
          'Accès refusé',
          'Ce compte n\'est pas un compte artisan. Utilisez l\'espace correspondant à votre rôle.',
          [{ text: 'OK' }]
        );
        return;
      }
      // La navigation se fait automatiquement via AppNavigator (user change)
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
      <StatusBar barStyle="light-content" backgroundColor={O} />

      {/* Fond orange + orbes */}
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
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={W} />
          <Text style={s.backText}>Retour</Text>
        </TouchableOpacity>

        {/* Logo animé */}
        <Animated.View style={[s.logoSection, { opacity: fadeAnim, transform: [{ translateY: floatAnim }] }]}>
          <View style={s.logoRing}>
            <View style={s.logoInner}>
              <Ionicons name="build" size={30} color={O} />
            </View>
          </View>
          <Text style={s.wordmark}>
            S<Text style={{ color: OL }}>O</Text>KORA
          </Text>
          <Text style={s.titleMain}>Espace Artisan SOKORA</Text>
          <Text style={s.subtitle}>Gérez vos RDV · Scannez les QR · Recevez vos paiements</Text>
        </Animated.View>

        {/* Card blanche */}
        <Animated.View style={[s.card, { opacity: fadeAnim }]}>
          <Text style={s.cardTitle}>Connexion Artisan 🔧</Text>
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

          {/* S'inscrire */}
          <TouchableOpacity
            style={s.registerBtn}
            onPress={() => navigation.navigate('RegisterArtisan')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={16} color={O} />
            <Text style={s.registerBtnText}>Pas encore artisan ? S'inscrire</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Badge rôle */}
        <Animated.View style={[s.rolesBadge, { opacity: fadeAnim }]}>
          <View style={s.rolePill}>
            <Text style={s.rolePillEmoji}>🔧</Text>
            <Text style={s.rolePillText}>Espace réservé aux Artisans SOKORA</Text>
          </View>
        </Animated.View>

        <Text style={s.footer}>SOKORA © 2026 — Plateforme HoReCa Africaine</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: O },

  bgOrange: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '58%',
    backgroundColor: O,
  },
  orb1: {
    position: 'absolute', top: -55, right: -65,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  orb2: {
    position: 'absolute', top: 90, left: -85,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  bgWave: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '46%',
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
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  logoInner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: W,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: OD, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  wordmark: {
    fontSize: 40, fontWeight: '900', color: W, letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.15)', textShadowRadius: 8,
  },
  titleMain: {
    fontSize: 18, fontWeight: '800', color: W, marginTop: 8,
  },
  subtitle: {
    fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4,
    letterSpacing: 0.2, textAlign: 'center',
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
    backgroundColor: WD, borderWidth: 1.5, borderColor: '#F0D8CC',
    borderRadius: 14, overflow: 'hidden',
  },
  inputErr: { borderColor: '#E84040' },
  inputIcon: {
    width: 46, height: 50, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: '#F0D8CC',
    backgroundColor: '#FFF0E8',
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
    shadowColor: OD, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  mainBtnText: { fontSize: 16, fontWeight: '800', color: W, letterSpacing: 0.3 },

  // Bouton inscription
  registerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#F0D8CC',
    backgroundColor: '#FFF9F5',
  },
  registerBtnText: { fontSize: 14, fontWeight: '700', color: O },

  // Badge rôle
  rolesBadge: { alignItems: 'center', marginTop: 20 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)',
  },
  rolePillEmoji: { fontSize: 16 },
  rolePillText: { fontSize: 12, fontWeight: '700', color: W },

  footer: {
    textAlign: 'center', fontSize: 11, color: 'rgba(15,30,53,0.4)',
    marginTop: 20,
  },
});
