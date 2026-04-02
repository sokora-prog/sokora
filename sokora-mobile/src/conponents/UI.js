import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing, Typography } from '../utils/constants';

// ─── LOGO SOKORA ──────────────────────────────────────────────────────────────
export const SokoraLogo = ({ size = 32, color = 'light' }) => {
  const textColor = color === 'light' ? Colors.surface : Colors.navy;
  const fontSize = size * 0.7;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{
        width: size, height: size, borderRadius: size * 0.25,
        backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center',
        marginRight: 8,
        ...Shadow.orange,
      }}>
        <Ionicons name="wifi" size={size * 0.5} color={Colors.surface} />
      </View>
      <Text style={{
        fontSize, fontWeight: '800', letterSpacing: -0.5,
        color: textColor,
      }}>
        S<Text style={{ color: Colors.orange }}>O</Text>KORA
      </Text>
    </View>
  );
};

// ─── BOUTON PRIMAIRE ──────────────────────────────────────────────────────────
export const Button = ({ title, onPress, loading, variant = 'primary', icon, disabled, style }) => {
  const variants = {
    primary: {
      bg: Colors.orange, textColor: Colors.surface,
      shadow: Shadow.orange,
    },
    secondary: {
      bg: Colors.navy, textColor: Colors.surface,
      shadow: Shadow.md,
    },
    outline: {
      bg: 'transparent', textColor: Colors.navy,
      borderWidth: 1.5, borderColor: Colors.border,
    },
    ghost: {
      bg: Colors.bg, textColor: Colors.navy,
    },
    danger: {
      bg: Colors.red, textColor: Colors.surface,
    },
    teal: {
      bg: Colors.teal, textColor: Colors.surface,
    },
  };
  const v = variants[variant] || variants.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[{
        backgroundColor: v.bg,
        borderRadius: Radius.lg,
        paddingVertical: 14,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: (disabled || loading) ? 0.6 : 1,
        borderWidth: v.borderWidth || 0,
        borderColor: v.borderColor || 'transparent',
        ...v.shadow,
      }, style]}
    >
      {loading
        ? <ActivityIndicator size="small" color={v.textColor} />
        : <>
            {icon && <Ionicons name={icon} size={18} color={v.textColor} />}
            <Text style={{ color: v.textColor, fontSize: 15, fontWeight: '700' }}>
              {title}
            </Text>
          </>
      }
    </TouchableOpacity>
  );
};

// ─── INPUT ────────────────────────────────────────────────────────────────────
export const Input = ({
  label, value, onChangeText, placeholder,
  secureTextEntry, keyboardType, icon, error, autoFocus
}) => (
  <View style={{ marginBottom: Spacing.md }}>
    {label && (
      <Text style={{
        fontSize: Typography.xs, fontWeight: '700', color: Colors.textMuted,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
      }}>
        {label}
      </Text>
    )}
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: Colors.surface,
      borderWidth: 1.5, borderColor: error ? Colors.red : Colors.border,
      borderRadius: Radius.md, paddingHorizontal: 14,
      ...Shadow.sm,
    }}>
      {icon && (
        <Ionicons name={icon} size={18} color={Colors.textMuted} style={{ marginRight: 10 }} />
      )}
      <Input.Native
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textFaint}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        autoFocus={autoFocus}
        style={{
          flex: 1, paddingVertical: 14,
          fontSize: Typography.base, color: Colors.text,
        }}
      />
    </View>
    {error && (
      <Text style={{ fontSize: Typography.xs, color: Colors.red, marginTop: 4 }}>
        {error}
      </Text>
    )}
  </View>
);

// Patch pour éviter erreur d'import circulaire
import { TextInput } from 'react-native';
Input.Native = TextInput;

// ─── CARD ─────────────────────────────────────────────────────────────────────
export const Card = ({ children, style, onPress }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.9}
      style={[{
        backgroundColor: Colors.surface,
        borderRadius: Radius.xl,
        padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.border,
        ...Shadow.sm,
      }, style]}
    >
      {children}
    </Wrapper>
  );
};

// ─── BADGE STATUS ─────────────────────────────────────────────────────────────
export const StatusBadge = ({ status, config }) => {
  const s = config[status] || { label: status, bg: Colors.bg, color: Colors.textMuted };
  return (
    <View style={{
      backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: Radius.full, alignSelf: 'flex-start',
    }}>
      <Text style={{ fontSize: Typography.xs, fontWeight: '700', color: s.color }}>
        {s.label}
      </Text>
    </View>
  );
};

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
export const KpiCard = ({ label, value, sub, icon, color, bg }) => (
  <Card style={{ flex: 1, minWidth: 150 }}>
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
      backgroundColor: color, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    }} />
    <View style={{
      width: 40, height: 40, borderRadius: 11,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
      marginBottom: 12,
    }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
    </View>
    <Text style={{ fontSize: Typography.xs, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </Text>
    <Text style={{ fontSize: Typography.xl, fontWeight: '800', color, marginTop: 4 }}>
      {value}
    </Text>
    {sub && (
      <Text style={{ fontSize: Typography.xs, color: Colors.textFaint, marginTop: 2 }}>
        {sub}
      </Text>
    )}
  </Card>
);

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
export const LoadingScreen = ({ message = 'Chargement...' }) => (
  <View style={{
    flex: 1, backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center', gap: 16,
  }}>
    <ActivityIndicator size="large" color={Colors.orange} />
    <Text style={{ fontSize: Typography.base, color: Colors.textMuted }}>{message}</Text>
  </View>
);

// ─── ERROR BOX ────────────────────────────────────────────────────────────────
export const ErrorBox = ({ message, onRetry }) => (
  <View style={{
    backgroundColor: Colors.redPale, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderLeftWidth: 4, borderLeftColor: Colors.red,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  }}>
    <Text style={{ flex: 1, fontSize: Typography.sm, color: Colors.red }}>{message}</Text>
    {onRetry && (
      <TouchableOpacity onPress={onRetry}>
        <Ionicons name="refresh" size={18} color={Colors.red} />
      </TouchableOpacity>
    )}
  </View>
);

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
export const EmptyState = ({ icon, title, subtitle, action }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['3xl'] }}>
    <View style={{
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
      marginBottom: Spacing.lg, ...Shadow.sm,
    }}>
      <Ionicons name={icon || 'cube-outline'} size={36} color={Colors.textFaint} />
    </View>
    <Text style={{ fontSize: Typography.lg, fontWeight: '700', color: Colors.text, textAlign: 'center' }}>
      {title}
    </Text>
    {subtitle && (
      <Text style={{ fontSize: Typography.base, color: Colors.textMuted, textAlign: 'center', marginTop: 8 }}>
        {subtitle}
      </Text>
    )}
    {action && (
      <View style={{ marginTop: Spacing.xl }}>
        <Button title={action.label} onPress={action.onPress} icon={action.icon} />
      </View>
    )}
  </View>
);

// ─── HEADER ───────────────────────────────────────────────────────────────────
export const ScreenHeader = ({ title, subtitle, onBack, rightElement, light = false }) => (
  <View style={{
    backgroundColor: light ? Colors.surface : Colors.navy,
    paddingTop: 50, paddingBottom: 16,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: light ? Colors.border : 'rgba(255,255,255,0.1)',
  }}>
    {onBack && (
      <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
        <Ionicons
          name="arrow-back"
          size={24}
          color={light ? Colors.navy : Colors.surface}
        />
      </TouchableOpacity>
    )}
    <View style={{ flex: 1 }}>
      <Text style={{
        fontSize: Typography.xl, fontWeight: '800',
        color: light ? Colors.navy : Colors.surface,
      }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{
          fontSize: Typography.sm,
          color: light ? Colors.textMuted : 'rgba(255,255,255,0.6)',
          marginTop: 2,
        }}>
          {subtitle}
        </Text>
      )}
    </View>
    {rightElement}
  </View>
);

// ─── SEPARATOR ────────────────────────────────────────────────────────────────
export const Separator = () => (
  <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm }} />
);

// ─── AVATAR ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [Colors.orange, Colors.teal, Colors.purple, Colors.green];
export const Avatar = ({ name = '', size = 40, index = 0 }) => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        color: Colors.surface, fontSize: size * 0.35, fontWeight: '800',
      }}>
        {initials}
      </Text>
    </View>
  );
};
