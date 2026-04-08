/**
 * LoginClientScreen — SOKORA
 * Connexion CLIENT via OTP WhatsApp / SMS
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Animated, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../../utils/constants';
import { useAuth } from '../../services/AuthContext';

const T  = '#00D4AA'; // Teal principal
const TL = '#33DEB8'; // Teal clair
const TD = '#00A888'; // Teal foncé
const N  = '#0F1E35'; // Navy
const W  = '#FFFFFF';
const WD = '#F4F9F8';
const MT = '#7A8FAB';

export default function LoginClientScreen({ navigation }) {
  const { loginAsClient } = useAuth();
  const [phone,      setPhone]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 1900, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,  duration: 1900, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  // ── Comptes démo offline ──────────────────────────────
  const DEMO_ACCOUNTS = {
    '0700000001': { password: 'Sokora2026', full_name: 'Moussa Koné',   wallet: 'SKW-PRO-0001', balance: 2850000 },
    '0700000002': { password: 'Sokora2026', full_name: 'Aïcha Traoré',  wallet: 'SKW-PRO-0002', balance: 1420000 },
    '0700000003': { password: 'Sokora2026', full_name: 'Ibrahim Bamba', wallet: 'SKW-PRO-0003', balance: 980000  },
  };

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    setLoading(true);
    setError('');

    // Mode démo offline
    const demo = DEMO_ACCOUNTS[phone.trim()];
    if (demo && demo.password === password.trim()) {
      const demoToken = `demo-client-${phone.trim()}`;
      const demoClient = { id: Date.now(), full_name: demo.full_name, phone_number: phone.trim(), role: 'client', wallet: demo.wallet, balance: demo.balance };
      await loginAsClient(demoClient, demoToken);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Numéro ou mot de passe incorrect');
      await loginAsClient(data.user, data.access_token);
    } catch (err) {
      setError(err.message || 'Numéro ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={T} />

      {/* Fond teal + orbes blancs semi-transparents */}
      <View style={s.bgTeal} />
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
              <Ionicons name="wallet" size={30} color={T} />
            </View>
          </View>
          <Text style={s.wordmark}>
            S<Text style={{ color: W, opacity: 0.85 }}>O</Text>KORA
          </Text>
          <Text style={s.titleMain}>Espace Client SOKORA</Text>
          <Text style={s.subtitle}>Wallet · Hôtels · Transport · Services</Text>
        </Animated.View>

        {/* Card blanche */}
        <Animated.View style={[s.card, { opacity: fadeAnim }]}>

          <Text style={s.cardTitle}>Espace Client</Text>
          <Text style={s.cardSub}>Wallet · Hôtels · Transport · Services</Text>

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
                <Ionicons name="call-outline" size={18} color={T} />
              </View>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={v => { setPhone(v); setError(''); }}
                placeholder="0700000000"
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
                <Ionicons name="lock-closed-outline" size={18} color={T} />
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

          <TouchableOpacity
            style={[s.mainBtn, loading && { opacity: 0.8 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={W} />
              : <>
                  <Ionicons name="log-in-outline" size={19} color={W} />
                  <Text style={s.mainBtnText}>Se connecter</Text>
                </>
            }
          </TouchableOpacity>
        </Animated.View>

        <Text style={s.footer}>SOKORA © 2026 — Plateforme HoReCa Africaine</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T },

  bgTeal: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '55%',
    backgroundColor: T,
  },
  orb1: {
    position: 'absolute', top: -60, right: -70,
    width: 230, height: 230, borderRadius: 115,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  orb2: {
    position: 'absolute', top: 110, left: -90,
    width: 270, height: 270, borderRadius: 135,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  bgWave: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '48%',
    backgroundColor: '#F4F6F9',
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
  logoSection: { alignItems: 'center', marginBottom: 30 },
  logoRing: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  logoInner: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: W,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  wordmark: {
    fontSize: 36, fontWeight: '900', color: N, letterSpacing: -1,
  },
  titleMain: {
    fontSize: 18, fontWeight: '800', color: N, marginTop: 8,
  },
  subtitle: {
    fontSize: 12, color: 'rgba(15,30,53,0.6)', marginTop: 4, letterSpacing: 0.3,
  },

  // Card
  card: {
    backgroundColor: W,
    borderRadius: 28,
    padding: 28,
    shadowColor: N,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: N, marginBottom: 4 },
  cardSub:   { fontSize: 13, color: MT, marginBottom: 20 },

  // Debug banner
  debugBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF9C4',
    borderRadius: 10, padding: 12, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: '#F59E0B',
  },
  debugText: { fontSize: 13, color: '#856404' },

  // Erreur
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F0', borderRadius: 10,
    padding: 12, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: '#E84040',
  },
  errorText: { flex: 1, fontSize: 13, color: '#E84040' },

  // Inputs
  inputGroup: { marginBottom: 18 },
  label: {
    fontSize: 10, fontWeight: '700', color: MT,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F4F9F8', borderWidth: 1.5, borderColor: '#C8EDE9',
    borderRadius: 14, overflow: 'hidden',
  },
  inputErr: { borderColor: '#E84040' },
  inputIcon: {
    width: 46, height: 50, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: '#C8EDE9',
    backgroundColor: '#E8FAF7',
  },
  input: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: N,
  },
  inputOtp: {
    fontSize: 22, fontWeight: '700', letterSpacing: 6, textAlign: 'center',
  },

  // Bouton principal
  mainBtn: {
    backgroundColor: T, borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: 4,
    shadowColor: T, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  mainBtnText: { fontSize: 16, fontWeight: '800', color: W, letterSpacing: 0.3 },

  // Bouton outline
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, borderWidth: 1.5, borderColor: T,
    paddingVertical: 14, marginTop: 12,
  },
  outlineBtnDisabled: { borderColor: '#C8EDE9' },
  outlineBtnText: { fontSize: 14, fontWeight: '700', color: T },

  linkBtn: { alignItems: 'center', marginTop: 12 },
  linkBtnText: { fontSize: 13, color: MT, textDecorationLine: 'underline' },

  footer: {
    textAlign: 'center', fontSize: 11, color: 'rgba(15,30,53,0.35)',
    marginTop: 24,
  },
});
