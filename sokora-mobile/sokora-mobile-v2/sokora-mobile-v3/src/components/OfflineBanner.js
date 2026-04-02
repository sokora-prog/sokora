/**
 * OfflineBanner — SOKORA
 * Bandeau affiché en haut de l'écran quand l'appareil est hors-ligne
 * ou que des actions sont en attente de synchronisation.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  offline: { bg: '#E84040', text: '#fff', icon: 'wifi-outline' },
  pending: { bg: '#F07D1A', text: '#fff', icon: 'cloud-upload-outline' },
  syncing: { bg: '#19A99D', text: '#fff', icon: 'sync-outline' },
  back:    { bg: '#4CAF6E', text: '#fff', icon: 'checkmark-circle-outline' },
};

export default function OfflineBanner({ isOnline, syncing, queueSize, onFlush }) {
  const slideAnim = useRef(new Animated.Value(-56)).current;

  const visible = !isOnline || syncing || queueSize > 0;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue:         visible ? 0 : -56,
      duration:        300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;

  let scheme, label;
  if (syncing) {
    scheme = COLORS.syncing;
    label  = 'Synchronisation en cours…';
  } else if (!isOnline) {
    scheme = COLORS.offline;
    label  = queueSize > 0
      ? `Hors-ligne — ${queueSize} action${queueSize > 1 ? 's' : ''} en attente`
      : 'Hors-ligne — mode lecture seule';
  } else {
    scheme = COLORS.pending;
    label  = `${queueSize} action${queueSize > 1 ? 's' : ''} à synchroniser`;
  }

  return (
    <Animated.View
      style={[styles.banner, { backgroundColor: scheme.bg, transform: [{ translateY: slideAnim }] }]}
    >
      <Ionicons name={scheme.icon} size={16} color={scheme.text} />
      <Text style={[styles.label, { color: scheme.text }]}>{label}</Text>
      {isOnline && queueSize > 0 && !syncing && (
        <TouchableOpacity onPress={onFlush} style={styles.syncBtn}>
          <Text style={styles.syncBtnTxt}>Sync →</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    zIndex:         999,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    paddingHorizontal: 16,
    paddingVertical:   10,
    paddingTop:        54, // espace pour la status bar
  },
  label: {
    flex:       1,
    fontSize:   13,
    fontWeight: '600',
  },
  syncBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius:    20,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  syncBtnTxt: {
    color:      '#fff',
    fontSize:   12,
    fontWeight: '700',
  },
});
