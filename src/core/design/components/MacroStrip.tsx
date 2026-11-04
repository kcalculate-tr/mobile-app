import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';

/**
 * Makro şeridi — FinComponents: her yerde SIRA kcal · P · K · Y.
 * Her alan: büyük sayı + küçük etiket. Değerler gerçek veriden gelir; sayı
 * verilmezse "—" gösterilir (uydurma sayı yok).
 */
export interface MacroValues {
  kcal?: number | null;
  /** Protein (g). */
  p?: number | null;
  /** Karbonhidrat (g). */
  k?: number | null;
  /** Yağ (g). */
  y?: number | null;
}

function fmt(n: number | null | undefined): string {
  return n == null || Number.isNaN(n) ? '—' : String(Math.round(n));
}

export function MacroStrip({
  values,
  style,
  compact = false,
  testID,
}: {
  values: MacroValues;
  style?: StyleProp<ViewStyle>;
  /** true → tek satır, küçük (kart içi). */
  compact?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  // Sıra SABİT: kcal · P · K · Y (FinComponents "Makro sırası").
  const cells: { label: string; value: string }[] = [
    { label: 'kcal', value: fmt(values.kcal) },
    { label: 'P', value: fmt(values.p) },
    { label: 'K', value: fmt(values.k) },
    { label: 'Y', value: fmt(values.y) },
  ];

  const a11y = `${cells[0].value} kalori, protein ${cells[1].value}, karbonhidrat ${cells[2].value}, yağ ${cells[3].value}`;

  return (
    <View
      style={[styles.row, { gap: compact ? t.space.lg : t.space['2xl'] }, style]}
      accessible
      accessibilityLabel={a11y}
      testID={testID}
    >
      {cells.map((c) => (
        <View key={c.label} style={styles.cell}>
          <AppText textRole={compact ? 'bodySm' : 'section'} style={styles.value}>
            {c.value}
          </AppText>
          <AppText textRole="helper" tone="secondary">
            {c.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  cell: { alignItems: 'center' },
  value: { fontVariant: ['tabular-nums'] },
});
