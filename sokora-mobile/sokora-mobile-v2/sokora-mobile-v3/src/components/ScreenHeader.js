/**
 * ScreenHeader — Composant réutilisable SOKORA
 * Header avec flèche retour, titre, sous-titre et action optionnelle à droite.
 *
 * Props:
 *   navigation   — objet navigation React Navigation
 *   title        — string, titre principal
 *   subtitle     — string optionnel, sous-titre
 *   onBack       — fonction custom (optionnel, sinon navigation.goBack())
 *   rightIcon    — nom icône Ionicons (optionnel)
 *   onRightPress — handler du bouton droit (optionnel)
 *   dark         — bool (défaut true) : fond navy. false = fond blanc
 *   children     — contenu supplémentaire sous le titre
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAVY   = '#0F1E35';
const ORANGE = '#FF6B35';
const WHITE  = '#FFFFFF';

export default function ScreenHeader({
  navigation,
  title,
  subtitle,
  onBack,
  rightIcon,
  onRightPress,
  dark = true,
  children,
  style,
}) {
  // Essaie d'utiliser les safe area insets si disponibles, sinon valeur fixe
  let topPad = 50;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const insets = useSafeAreaInsets();
    topPad = Math.max(insets.top + 8, 50);
  } catch {}

  const bg       = dark ? NAVY   : WHITE;
  const textColor = dark ? WHITE  : NAVY;
  const subColor  = dark ? 'rgba(255,255,255,0.55)' : '#8892A4';
  const iconBg    = dark ? 'rgba(255,255,255,0.12)' : '#F4F6F9';
  const iconColor = dark ? WHITE  : NAVY;

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    if (navigation?.canGoBack?.()) navigation.goBack();
    else if (navigation?.goBack) navigation.goBack();
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: bg, paddingTop: topPad }, style]}>
      <StatusBar
        barStyle={dark ? 'light-content' : 'dark-content'}
        backgroundColor={bg}
      />
      <View style={styles.row}>
        {/* Flèche retour */}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: iconBg }]}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color={iconColor} />
        </TouchableOpacity>

        {/* Titre + sous-titre */}
        <View style={styles.titleBlock}>
          {title ? (
            <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={[styles.subtitle, { color: subColor }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Bouton droit optionnel */}
        {rightIcon ? (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: iconBg }]}
            onPress={onRightPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={rightIcon} size={20} color={iconColor} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {/* Contenu supplémentaire (géoloc badge, etc.) */}
      {children ? <View style={styles.extra}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  extra: {
    marginTop: 8,
    paddingLeft: 2,
  },
});
