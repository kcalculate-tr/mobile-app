// Derin bağlantı iniş ekranı — ortak sunum (G5-S4 md.2).
//
// `/p/<post_id>` ve `/u/<handle>` bağlantıları uygulamayı açtığında gösterilen
// hafif, HERKESE AÇIK karşılama. Sosyal katman (Keşfet/gönderi/profil) henüz
// kurulmadığı için içerik yer tutucudur; bağlantının çözüldüğünü, hedefin
// korunduğunu gösterir ve kullanıcıyı uygulamaya yönlendirir. Giriş zorlamaz
// (web önizlemesiyle parite). Üretimde yalnız derin bağlantıyla erişilir.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Icon } from '../icons';

const C = {
  bg: '#0A0A0A',
  surface: '#141414',
  border: '#232323',
  accent: '#B9EF14',
  accentText: '#0A0A0A',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.70)',
  textMuted: 'rgba(255,255,255,0.45)',
};

type Props = {
  IconComponent: Icon;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  onPrimary: () => void;
};

export default function DeepLinkLanding({
  IconComponent,
  eyebrow,
  title,
  subtitle,
  primaryLabel,
  onPrimary,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <IconComponent size={48} color={C.accent} weight="duotone" />
        </View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onPrimary} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
        </TouchableOpacity>
        <Text style={styles.brand}>Kcalculate</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  eyebrow: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    letterSpacing: 2,
    color: C.accent,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 26,
    lineHeight: 32,
    color: C.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: C.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: { alignItems: 'center' },
  primaryBtn: {
    backgroundColor: C.accent,
    borderRadius: 100,
    height: 54,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: C.accentText,
  },
  brand: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: C.textMuted,
    marginTop: 18,
    letterSpacing: 0.5,
  },
});
