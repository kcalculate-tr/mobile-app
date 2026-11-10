// G22-S2 md.7 — FinMoLoad iskeleti (tam ekran yükleniyor göstergesinin yerine).
//
// Tasarım: `design/final/FinMoLoad` — nötr iskelet (lime yok): 56'lık yuvarlak kare +
// iki çubuk; nabız story (useBreath, yalnız yüklenirken döner), azaltılmış harekette
// sabit. İçeriğe geçiş FinLoadSwap / FadeIn ile (fast crossfade, aynı yerleşim).
// Dönen yuvarlak gösterge (ActivityIndicator) yalnız düğme içinde küçük kalabilir.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useBreath } from '../motion';
import { useTheme } from '../ThemeProvider';
import { useT } from '../../i18n';

type Breath = ReturnType<typeof useBreath>['style'];

/** Tek iskelet bloğu. `pulse` verilmezse kendi nabzını kurar. */
export function FinSkeletonBlock({
  width = '100%',
  height,
  radius = 8,
  pulse,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  pulse?: Breath;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const own = useBreath({ min: 0.45, max: 0.9 });
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: t.color.line }, pulse ?? own.style, style]}
    />
  );
}

/**
 * Liste iskeleti (FinMoLoad): `rows` satır, her satır 56 kare + 2 çubuk. `header`
 * true ise üstte büyük başlık çubuğu (sayfa başlığı henüz yokken).
 */
export function FinListSkeleton({
  rows = 5,
  header = false,
  style,
  testID = 'fin-skeleton',
}: {
  rows?: number;
  header?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { t: tr } = useT();
  const { style: pulse } = useBreath({ min: 0.45, max: 0.9 });
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={tr('common.loading')}
      style={[styles.wrap, style]}
    >
      {header ? <FinSkeletonBlock width="45%" height={28} radius={10} pulse={pulse} style={styles.header} /> : null}
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <FinSkeletonBlock width={56} height={56} radius={14} pulse={pulse} />
          <View style={styles.lines}>
            <FinSkeletonBlock width="80%" height={14} radius={7} pulse={pulse} />
            <FinSkeletonBlock width="45%" height={12} radius={6} pulse={pulse} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Kart iskeleti — form/ayar sayfaları için (satır grubu biçimi). */
export function FinCardSkeleton({ rows = 4, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const { t: tr } = useT();
  const { style: pulse } = useBreath({ min: 0.45, max: 0.9 });
  return (
    <View
      testID="fin-card-skeleton"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={tr('common.loading')}
      style={[styles.wrap, style]}
    >
      <View style={[styles.card, { backgroundColor: t.color.surface }]}>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={[styles.cardRow, i > 0 && { borderTopWidth: 1, borderTopColor: t.color.line }]}>
            <FinSkeletonBlock width={22} height={22} radius={6} pulse={pulse} />
            <FinSkeletonBlock width="55%" height={14} radius={7} pulse={pulse} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  header: { marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  lines: { flex: 1, gap: 10 },
  card: { borderRadius: 20, overflow: 'hidden' },
  cardRow: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
