/**
 * ArtisanScanScreen — Scanner QR client pour libérer les fonds escrow
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { API_URL } from '../../utils/constants';
import { useGeolocation } from '../../hooks/useGeolocation';
import ScreenHeader from '../../components/ScreenHeader';

const C = { navy: '#0F1E35', orange: '#FF6B35', teal: '#00D4AA', bg: '#F4F6F9', white: '#FFFFFF', text: '#1A1A2E', muted: '#8892A4' };

export default function ArtisanScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned,    setScanned]        = useState(false);
  const { coords } = useGeolocation({ autoRequest: true });
  const [loading,    setLoading]        = useState(false);
  const [result,     setResult]         = useState(null);

  const getToken = async () => {
    const { Platform } = require('react-native');
    if (Platform.OS === 'web') return localStorage.getItem('sokora_token');
    try { return await require('expo-secure-store').getItemAsync('sokora_token'); } catch { return null; }
  };

  const handleScan = async ({ data }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/services/artisan/scan-release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          qr_token: data,
          ...(coords ? { scan_lat: coords.latitude, scan_lng: coords.longitude } : {}),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ success: true, ...json });
      } else {
        setResult({ success: false, message: json.detail || 'QR invalide ou déjà utilisé' });
      }
    } catch {
      setResult({ success: false, message: 'Erreur réseau' });
    }
    setLoading(false);
  };

  if (!permission) return <View style={s.root}><ActivityIndicator color={C.orange} /></View>;

  if (!permission.granted) {
    return (
      <View style={[s.root, s.center]}>
        <Ionicons name="camera-outline" size={60} color={C.muted} />
        <Text style={s.permTxt}>Caméra requise pour scanner le QR</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnTxt}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Overlay */}
      <View style={s.overlay}>
        {/* Top */}
        <ScreenHeader
          navigation={navigation}
          title="Scanner QR client"
          subtitle="Libérez les fonds après la prestation"
          dark={true}
        />

        {/* Cadre */}
        <View style={s.frameContainer}>
          <View style={s.frame}>
            <View style={[s.corner, s.tl]} />
            <View style={[s.corner, s.tr]} />
            <View style={[s.corner, s.bl]} />
            <View style={[s.corner, s.br]} />
          </View>
          <Text style={s.frameHint}>Placez le QR du client dans le cadre</Text>
        </View>

        {/* Info */}
        <View style={s.infoBar}>
          <Ionicons name="shield-checkmark" size={16} color={C.teal} />
          <Text style={s.infoTxt}>Les fonds seront libérés immédiatement dans votre wallet</Text>
        </View>
      </View>

      {/* Loading */}
      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={C.orange} />
          <Text style={{ color: '#fff', marginTop: 12, fontWeight: '700' }}>Validation en cours...</Text>
        </View>
      )}

      {/* Résultat */}
      <Modal visible={!!result} transparent animationType="fade">
        <View style={s.resultOverlay}>
          <View style={s.resultCard}>
            <Text style={{ fontSize: 60 }}>{result?.success ? '✅' : '❌'}</Text>
            <Text style={[s.resultTitle, { color: result?.success ? C.teal : '#EF4444' }]}>
              {result?.success ? 'Paiement reçu !' : 'Échec'}
            </Text>
            {result?.success ? (
              <>
                <Text style={s.resultAmount}>{Number(result.amount_received || 0).toLocaleString('fr-FR')} FCFA</Text>
                <Text style={s.resultSub}>Crédités dans votre wallet</Text>
                <Text style={s.resultClient}>Client : {result.client_name}</Text>
              </>
            ) : (
              <Text style={s.resultSub}>{result?.message}</Text>
            )}
            <TouchableOpacity
              style={[s.btn, { marginTop: 20, backgroundColor: result?.success ? C.teal : C.orange }]}
              onPress={() => { setResult(null); setScanned(false); if (result?.success) navigation.navigate('ArtisanHome'); }}
            >
              <Text style={s.btnTxt}>{result?.success ? 'Retour au dashboard' : 'Réessayer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CORNER = 24;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: C.bg },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  frameContainer: { alignItems: 'center', gap: 16 },
  frame: { width: 280, height: 280, position: 'relative' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: C.orange, borderWidth: 4 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  frameHint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  infoBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', padding: 16, margin: 16, borderRadius: 12 },
  infoTxt: { flex: 1, fontSize: 12, color: '#fff', lineHeight: 18 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  resultOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  resultCard: { backgroundColor: '#fff', borderRadius: 28, padding: 32, alignItems: 'center', width: '85%', gap: 8 },
  resultTitle: { fontSize: 24, fontWeight: '900' },
  resultAmount: { fontSize: 36, fontWeight: '900', color: C.navy },
  resultSub:    { fontSize: 14, color: C.muted, textAlign: 'center' },
  resultClient: { fontSize: 14, fontWeight: '700', color: C.text },
  btn: { backgroundColor: C.orange, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  btnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  permTxt: { fontSize: 15, color: C.muted, textAlign: 'center' },
});
