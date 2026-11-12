// G22-S1 md.4 — FinSubPill: hak hapı ("✦ Bugün 1/2" · "Bugün 9/15" · "Sınırsız").
// Tara/Ses/Barkod üstünde ve Profil › Abonelik kartında. Barkod kipinde çubuk ikonu.
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { AppText, useTheme } from '../../../core/design';
import { Barcode, Sparkle } from '../../../components/icons';

export default function SubPill({
  label,
  a11y,
  kind = 'ai',
  onPress,
  bg,
  style,
  testID = 'sub-pill',
}: {
  label: string;
  a11y?: string | null;
  kind?: 'ai' | 'barcode';
  onPress?: () => void;
  /** Zemin (kamera üstünde cam, kartta iç içe gri). */
  bg?: string;
  style?: ViewStyle;
  testID?: string;
}) {
  const t = useTheme();
  const body = (
    <View style={[styles.pill, { backgroundColor: bg ?? (t.isDark ? '#1C1C1E' : '#FFFFFF') }, style]}>
      {kind === 'barcode' ? <Barcode size={14} color={t.color.ink} /> : <Sparkle size={14} color={t.color.ink} weight="fill" />}
      <AppText style={styles.text} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11y ?? label} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label} hitSlop={4} testID={testID}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { minHeight: 44, borderRadius: 22, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  text: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
