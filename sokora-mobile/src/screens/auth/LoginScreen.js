import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../services/AuthContext';
import { Colors, Spacing, Radius, Shadow, Typography } from '../../utils/constants';

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* FOND DÉCORATIF */}
      <View style={styles.bgTop} />
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* LOGO */}
        <View style={styles.logoSection}>
          <View style={styles.logoBox}>
            <Ionicons name="wifi" size={28} color={Colors.surface} />
          </View>
          <Text style={styles.logoText}>
            S<Text style={{ color: Colors.orange }}>O</Text>KORA
          </Text>
          <Text style={styles.tagline}>Gère ton business en temps réel</Text>
        </View>

        {/* CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connexion</Text>
          <Text style={styles.cardSub}>Accédez à votre espace professionnel</Text>

          {/* ERREUR */}
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* TÉLÉPHONE */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Numéro de téléphone</Text>
            <View style={[styles.inputRow, error && styles.inputError]}>
              <Ionicons name="call-outline" size={18} color={Colors.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+225 07 00 00 00 00"
                placeholderTextColor={Colors.textFaint}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* MOT DE PASSE */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mot de passe</Text>
            <View style={[styles.inputRow, error && styles.inputError]}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textFaint}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={18} color={Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* BOUTON LOGIN */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && { opacity: 0.75 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.surface} />
              : <>
                  <Ionicons name="log-in-outline" size={20} color={Colors.surface} />
                  <Text style={styles.loginBtnText}>Se connecter</Text>
                </>
            }
          </TouchableOpacity>

          {/* INFOS RÔLES */}
          <View style={styles.rolesHint}>
            <Text style={styles.rolesHintTitle}>Accès par rôle :</Text>
            <View style={styles.rolesRow}>
              <View style={styles.roleTag}>
                <Ionicons name="settings-outline" size={12} color={Colors.orange} />
                <Text style={[styles.roleTagText, { color: Colors.orange }]}>Gérant</Text>
              </View>
              <View style={styles.roleTag}>
                <Ionicons name="restaurant-outline" size={12} color={Colors.teal} />
                <Text style={[styles.roleTagText, { color: Colors.teal }]}>Serveur</Text>
              </View>
              <View style={styles.roleTag}>
                <Ionicons name="bed-outline" size={12} color={Colors.purple} />
                <Text style={[styles.roleTagText, { color: Colors.purple }]}>Réception</Text>
              </View>
            </View>
          </View>
        </View>

        {/* FOOTER */}
        <Text style={styles.footer}>
          SOKORA © 2026 — Plateforme HoReCa Africaine
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy,
  },
  bgTop: {
    position: 'absolute',
    top: -60, left: -60, right: -60,
    height: 320,
    backgroundColor: Colors.navyMid,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  bgCircle1: {
    position: 'absolute',
    top: 40, right: -40,
    width: 180, height: 180,
    borderRadius: 90,
    backgroundColor: Colors.orange,
    opacity: 0.08,
  },
  bgCircle2: {
    position: 'absolute',
    top: 100, left: -60,
    width: 220, height: 220,
    borderRadius: 110,
    backgroundColor: Colors.teal,
    opacity: 0.06,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: 70,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  logoBox: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    ...Shadow.orange,
  },
  logoText: {
    fontSize: 36, fontWeight: '800',
    color: Colors.surface, letterSpacing: -1,
  },
  tagline: {
    fontSize: Typography.sm,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: Spacing['2xl'],
    ...Shadow.lg,
  },
  cardTitle: {
    fontSize: Typography['2xl'],
    fontWeight: '800',
    color: Colors.navy,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.xl,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.redPale,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.red,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.red,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 7,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    ...Shadow.sm,
  },
  inputError: {
    borderColor: Colors.red + '80',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: Typography.base,
    color: Colors.text,
  },
  loginBtn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
    ...Shadow.orange,
  },
  loginBtnText: {
    fontSize: Typography.md,
    fontWeight: '700',
    color: Colors.surface,
    letterSpacing: 0.3,
  },
  rolesHint: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rolesHintTitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  rolesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.bg,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleTagText: {
    fontSize: Typography.xs,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    fontSize: Typography.xs,
    color: 'rgba(255,255,255,0.3)',
    marginTop: Spacing['2xl'],
  },
});
