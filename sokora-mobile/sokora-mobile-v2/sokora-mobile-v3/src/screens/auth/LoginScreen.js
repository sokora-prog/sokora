/**
 * LoginScreen — SOKORA v3
 * Charte orange/blanc premium — élégant, accueillant, moderne
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Animated, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../services/AuthContext';

const O = '#F26D21';   // SOKORA Orange officiel
const OL = '#F9A050';  // Orange clair
const OD = '#D45C10';  // Orange foncé
const N  = '#1A2E4A';  // Navy
const W  = '#FFFFFF';
const WD = '#F8F9FC';
const MT = '#8A9BB0';

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Float animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,  duration: 1800, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(phone.trim(), password);
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

      {/* ── Fond orange ── */}
      <View style={s.bgOrange} />
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />
      <View style={s.bgWave} />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo ── */}
        <Animated.View style={[s.logoSection, { opacity: fadeAnim, transform: [{ translateY: floatAnim }] }]}>
          {/* Icône */}
          <View style={s.logoRing}>
            <View style={s.logoInner}>
              <Ionicons name="flash" size={32} color={O} />
            </View>
          </View>

          {/* Wordmark */}
          <Text style={s.wordmark}>
            S<Text style={{ color: OL }}>O</Text>KORA
          </Text>
          <Text style={s.tagline}>Vis l'instant. Paye malin. Explore Abidjan. 🌍</Text>
        </Animated.View>

        {/* ── Card blanche ── */}
        <Animated.View style={[s.card, { opacity: fadeAnim }]}>
          <Text style={s.cardTitle}>Bienvenue 👋</Text>
          <Text style={s.cardSub}>Connectez-vous à votre espace SOKORA</Text>

          {/* Erreur */}
          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#E84040" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* Téléphone */}
          <View style={s.inputGroup}>
            <Text style={s.label}>NUMÉRO DE TÉLÉPHONE</Text>
            <View style={[s.inputRow, error ? s.inputErr : null]}>
              <View style={s.inputIcon}>
                <Ionicons name="call-outline" size={18} color={O} />
              </View>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={t => { setPhone(t); setError(''); }}
                placeholder="+225 07 00 00 00 00"
                placeholderTextColor={MT}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Mot de passe */}
          <View style={s.inputGroup}>
            <Text style={s.label}>MOT DE PASSE</Text>
            <View style={[s.inputRow, error ? s.inputErr : null]}>
              <View style={s.inputIcon}>
                <Ionicons name="lock-closed-outline" size={18} color={O} />
              </View>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={t => { setPassword(t); setError(''); }}
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
            style={[s.loginBtn, loading && { opacity: 0.8 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={W} />
              : <>
                  <Ionicons name="log-in-outline" size={20} color={W} />
                  <Text style={s.loginBtnText}>Se connecter</Text>
                </>
            }
          </TouchableOpacity>

          {/* Séparateur */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>Accès par rôle</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Tags rôles */}
          <View style={s.rolesRow}>
            {[
              { icon: 'settings-outline', label: 'Gérant',    color: O },
              { icon: 'restaurant-outline',label: 'Serveur',  color: '#19A99D' },
              { icon: 'bed-outline',       label: 'Réception',color: '#6366F1' },
              { icon: 'person-outline',    label: 'Client',   color: N },
            ].map(r => (
              <View key={r.label} style={s.roleTag}>
                <Ionicons name={r.icon} size={11} color={r.color} />
                <Text style={[s.roleTagTxt, { color: r.color }]}>{r.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Footer */}
        <Text style={s.footer}>SOKORA © 2026 — Plateforme HoReCa Africaine</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: O },

  // Fond déco
  bgOrange: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '60%',
    backgroundColor: O,
  },
  bgCircle1: {
    position: 'absolute', top: -50, right: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bgCircle2: {
    position: 'absolute', top: 80, left: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bgWave: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
    backgroundColor: WD,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 40,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  logoInner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: W,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  wordmark: {
    fontSize: 40, fontWeight: '900', color: W, letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.15)', textShadowRadius: 8,
  },
  tagline: {
    fontSize: 13, color: 'rgba(255,255,255,0.8)',
    marginTop: 6, letterSpacing: 0.2, textAlign: 'center',
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
  cardTitle: {
    fontSize: 26, fontWeight: '800', color: N, marginBottom: 4,
  },
  cardSub: {
    fontSize: 14, color: MT, marginBottom: 24,
  },

  // Erreur
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F0', borderRadius: 10,
    padding: 12, marginBottom: 16,
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

  // Bouton
  loginBtn: {
    backgroundColor: O, borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: 8,
    shadowColor: O, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  loginBtnText: {
    fontSize: 16, fontWeight: '800', color: W, letterSpacing: 0.3,
  },

  // Divider
  divider: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#DDE4F0' },
  dividerText: { fontSize: 11, color: MT, fontWeight: '600', marginHorizontal: 10 },

  // Roles
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
    textAlign: 'center', fontSize: 11, color: 'rgba(26,46,74,0.4)',
    marginTop: 24,
  },
});
