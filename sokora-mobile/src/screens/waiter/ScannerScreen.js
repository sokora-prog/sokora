import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Vibration, Alert, Animated
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../utils/constants';

export default function ScannerScreen({ navigation, route }) {
  const { mode = 'order' } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const frameAnim = useRef(new Animated.Value(0)).current;

  // Animation du cadre de scan
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(frameAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(frameAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const scanLineY = frameAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180],
  });

  const handleScan = ({ type, data }) => {
    if (scanned) return;
    setScanned(true);
    Vibration.vibrate(100);

    try {
      // Le QR code d'une table contient : {"type":"table","id":1,"number":5,"label":"Terrasse"}
      // Le QR code de pointage contient : {"type":"checkin","establishment_id":1}
      const parsed = JSON.parse(data);

      if (mode === 'order' && parsed.type === 'table') {
        navigation.replace('NewOrder', {
          table: {
            id: parsed.id,
            number: parsed.number,
            label: parsed.label,
            capacity: parsed.capacity,
          }
        });
      } else if (mode === 'checkin' && parsed.type === 'checkin') {
        navigation.replace('CheckIn', { establishmentId: parsed.establishment_id });
      } else {
        Alert.alert(
          'QR Code non reconnu',
          'Ce QR code ne correspond pas à une table SOKORA.',
          [{ text: 'Réessayer', onPress: () => setScanned(false) }]
        );
      }
    } catch {
      // QR code texte simple (ex: "TABLE:5")
      if (data.startsWith('TABLE:')) {
        const number = parseInt(data.split(':')[1]);
        navigation.replace('NewOrder', { table: { number, id: null } });
      } else {
        Alert.alert(
          'Format invalide',
          'QR code non reconnu par SOKORA.',
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
      }
    }
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <Ionicons name="camera-outline" size={60} color={Colors.textFaint} />
        <Text style={styles.permTitle}>Accès caméra requis</Text>
        <Text style={styles.permText}>
          SOKORA a besoin de la caméra pour scanner les QR codes des tables.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const modeConfig = {
    order:   { title: 'Scanner une table',  subtitle: 'Pointez la caméra vers le QR code de la table', color: Colors.orange },
    checkin: { title: 'Pointage service',    subtitle: 'Scannez le QR code de votre établissement',    color: Colors.teal },
  };
  const cfg = modeConfig[mode] || modeConfig.order;

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchOn}
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* OVERLAY SOMBRE */}
      <View style={styles.overlay}>
        {/* HAUT */}
        <View style={styles.overlayTop}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={Colors.surface} />
          </TouchableOpacity>
          <Text style={[styles.modeTitle, { color: cfg.color }]}>{cfg.title}</Text>
          <Text style={styles.modeSub}>{cfg.subtitle}</Text>
        </View>

        {/* FENÊTRE DE SCAN */}
        <View style={styles.scanWindow}>
          {/* COINS */}
          <View style={[styles.corner, styles.cornerTL, { borderColor: cfg.color }]} />
          <View style={[styles.corner, styles.cornerTR, { borderColor: cfg.color }]} />
          <View style={[styles.corner, styles.cornerBL, { borderColor: cfg.color }]} />
          <View style={[styles.corner, styles.cornerBR, { borderColor: cfg.color }]} />

          {/* LIGNE DE SCAN ANIMÉE */}
          <Animated.View style={[styles.scanLine, {
            backgroundColor: cfg.color,
            transform: [{ translateY: scanLineY }]
          }]} />
        </View>

        {/* BAS */}
        <View style={styles.overlayBottom}>
          <TouchableOpacity
            style={[styles.torchBtn, torchOn && { backgroundColor: Colors.gold + '33' }]}
            onPress={() => setTorchOn(!torchOn)}
          >
            <Ionicons
              name={torchOn ? 'flashlight' : 'flashlight-outline'}
              size={24}
              color={torchOn ? Colors.gold : Colors.surface}
            />
          </TouchableOpacity>

          {scanned && (
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: cfg.color }]}
              onPress={() => setScanned(false)}
            >
              <Ionicons name="refresh-outline" size={18} color={Colors.surface} />
              <Text style={styles.retryBtnText}>Scanner à nouveau</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.manualHint}>
            Pas de QR code ?{' '}
            <Text
              style={{ color: cfg.color, fontWeight: '700' }}
              onPress={() => navigation.navigate(mode === 'order' ? 'TablesList' : 'CheckIn')}
            >
              Sélection manuelle
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const SCAN_SIZE = 220;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permContainer: {
    flex: 1, backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing['3xl'],
  },
  permTitle: {
    fontSize: Typography['2xl'], fontWeight: '800', color: Colors.navy,
    marginTop: Spacing.xl, marginBottom: Spacing.sm,
  },
  permText: {
    fontSize: Typography.base, color: Colors.textMuted,
    textAlign: 'center', marginBottom: Spacing['2xl'],
  },
  permBtn: {
    backgroundColor: Colors.orange, borderRadius: Radius.lg,
    paddingVertical: 14, paddingHorizontal: Spacing['2xl'],
  },
  permBtnText: { fontSize: Typography.md, fontWeight: '700', color: Colors.surface },
  overlay: { flex: 1 },
  overlayTop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 40, paddingTop: 54,
  },
  closeBtn: {
    position: 'absolute', top: 54, left: Spacing.xl,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  modeTitle: {
    fontSize: Typography['2xl'], fontWeight: '800',
    color: Colors.surface, marginBottom: 8,
  },
  modeSub: {
    fontSize: Typography.sm, color: 'rgba(255,255,255,0.65)',
    textAlign: 'center', paddingHorizontal: Spacing['3xl'],
  },
  scanWindow: {
    width: SCAN_SIZE, height: SCAN_SIZE,
    alignSelf: 'center', overflow: 'hidden',
  },
  corner: {
    position: 'absolute', width: 30, height: 30, borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scanLine: {
    height: 2, marginHorizontal: 10, borderRadius: 1, opacity: 0.85,
  },
  overlayBottom: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', paddingTop: 40, gap: Spacing.lg,
  },
  torchBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
  },
  retryBtnText: { fontSize: Typography.base, fontWeight: '700', color: Colors.surface },
  manualHint: {
    fontSize: Typography.sm, color: 'rgba(255,255,255,0.55)',
  },
});
