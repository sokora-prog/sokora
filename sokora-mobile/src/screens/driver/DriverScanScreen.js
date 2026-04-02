/**
 * DriverScanScreen — SOKORA Chauffeur
 * Scanner QR embarquement des passagers.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Vibration, Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../utils/constants';
import { API_URL } from '../../utils/constants';

export default function DriverScanScreen({ route }) {
  const { driverToken } = route?.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Animation ligne de scan
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [slideAnim]);

  const handleScan = async ({ data }) => {
    if (!scanning || loading) return;
    setScanning(false);
    setLoading(true);
    setError(null);
    setResult(null);

    Vibration.vibrate(200);

    try {
      const res = await fetch(`${API_URL}/voyage/driver/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Driver-Token': driverToken,
        },
        body: JSON.stringify({ qr_token: data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'QR invalide');
      setResult(json);
      Vibration.vibrate([0, 100, 50, 100]);
    } catch (e) {
      setError(e.message);
      Vibration.vibrate(500);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setScanning(true);
  };

  if (!permission) {
    return <View style={styles.center}><Text>Chargement...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-off" size={48} color={Colors.textFaint} />
        <Text style={styles.permText}>Caméra requise pour scanner</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Scanner QR Embarquement</Text>
        <Text style={styles.subtitle}>Pointez la caméra sur le billet du passager</Text>
      </View>

      {/* ── Caméra ── */}
      <View style={styles.cameraWrapper}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanning && !loading ? handleScan : undefined}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />

        {/* Overlay viseur */}
        <View style={styles.overlay}>
          <View style={styles.viewfinder}>
            {/* Coins */}
            {['tl', 'tr', 'bl', 'br'].map(c => (
              <View key={c} style={[styles.corner, styles[c]]} />
            ))}
            {/* Ligne de scan animée */}
            {scanning && (
              <Animated.View style={[
                styles.scanLine,
                {
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1], outputRange: [0, 180]
                    })
                  }]
                }
              ]} />
            )}
          </View>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Validation en cours...</Text>
          </View>
        )}
      </View>

      {/* ── Résultat succès ── */}
      {result && (
        <View style={[styles.resultCard, styles.successCard]}>
          <View style={styles.resultIcon}>
            <Ionicons name="checkmark-circle" size={40} color={Colors.green} />
          </View>
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>✅ Embarquement validé</Text>
            <Text style={styles.resultName}>{result.passenger_name}</Text>
            <Text style={styles.resultDetail}>Siège #{result.seat_number}</Text>
            <Text style={styles.resultRoute}>{result.origin} → {result.destination}</Text>
          </View>
          <TouchableOpacity style={styles.nextBtn} onPress={handleReset}>
            <Text style={styles.nextBtnText}>Suivant</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Résultat erreur ── */}
      {error && (
        <View style={[styles.resultCard, styles.errorCard]}>
          <Ionicons name="close-circle" size={40} color={Colors.red} />
          <Text style={styles.errorTitle}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleReset}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryBtnText}>Scanner à nouveau</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Status scanning ── */}
      {scanning && !result && !error && (
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, { backgroundColor: Colors.green }]} />
          <Text style={styles.statusText}>Prêt à scanner</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.bg, gap: Spacing.md, padding: Spacing.xl,
  },

  header:   { padding: Spacing.xl, backgroundColor: Colors.navy },
  title:    { fontSize: Typography.lg, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  cameraWrapper: { flex: 1, position: 'relative' },
  camera:        { flex: 1 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  viewfinder: {
    width: 240, height: 240,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute', width: 24, height: 24,
    borderColor: Colors.orange, borderWidth: 3,
  },
  tl: { top: 0,    left: 0,   borderRightWidth: 0,  borderBottomWidth: 0 },
  tr: { top: 0,    right: 0,  borderLeftWidth: 0,   borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0,   borderRightWidth: 0,  borderTopWidth: 0 },
  br: { bottom: 0, right: 0,  borderLeftWidth: 0,   borderTopWidth: 0 },

  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: Colors.orange,
    shadowColor: Colors.orange, shadowOpacity: 0.8, shadowRadius: 4,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { color: '#fff', fontSize: Typography.md, fontWeight: '600' },

  resultCard: {
    margin: Spacing.lg, borderRadius: Radius.xl,
    padding: Spacing.xl, flexDirection: 'row',
    alignItems: 'center', gap: Spacing.md,
    ...Shadow.lg,
  },
  successCard: { backgroundColor: Colors.greenPale, borderWidth: 2, borderColor: Colors.green },
  errorCard: {
    backgroundColor: Colors.redPale, borderWidth: 2, borderColor: Colors.red,
    flexDirection: 'column', alignItems: 'center', gap: Spacing.sm,
  },

  resultIcon:  {},
  resultInfo:  { flex: 1 },
  resultTitle: { fontSize: Typography.sm, fontWeight: '700', color: Colors.green },
  resultName:  { fontSize: Typography.lg, fontWeight: '800', color: Colors.navy },
  resultDetail:{ fontSize: Typography.sm, color: Colors.textMuted },
  resultRoute: { fontSize: Typography.xs, color: Colors.textMuted },

  nextBtn: {
    backgroundColor: Colors.green, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.sm },

  errorTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.red, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.red, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.sm },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: Spacing.md, backgroundColor: Colors.navy,
  },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: Typography.sm, fontWeight: '500' },

  permText:    { fontSize: Typography.base, color: Colors.textMuted, textAlign: 'center' },
  permBtn:     { backgroundColor: Colors.orange, borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  permBtnText: { color: '#fff', fontWeight: '700' },
});
