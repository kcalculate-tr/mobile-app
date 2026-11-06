import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';

/**
 * Boş / hata kartı — FinComponents: başlık · açıklama · TEK aksiyon.
 * Örn. "Henüz siparişin yok · İlk siparişin burada görünecek. · eatkcal'e göz at".
 * Hata durumunda da aynı iskelet; renk/animasyon eklenmez (koreografi kuralı:
 * hata sarsıntısız). İsteğe bağlı tek düğme.
 */
export function EmptyErrorCard({
  title,
  description,
  actionLabel,
  onAction,
  tone = 'empty',
  icon,
  style,
  testID,
}: {
  title: string;
  /** G14-S1: Final boş/hata kartı ikonu (48'lik gri daire içinde, 24 ikon). */
  icon?: React.ReactNode;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** G15-S2: Final (FinEkErrors, FinStressDark, FinScanError) hata kartında da başlık mürekkep; 'error' yalnız anlamsal. */
  tone?: 'empty' | 'error';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      accessible={false}
      style={[
        styles.wrap,
        {
          backgroundColor: t.color.surface,
          borderRadius: 20,
          paddingTop: 20,
          paddingHorizontal: 16,
          paddingBottom: 16,
          gap: 8,
        },
        style,
      ]}
    >
      {icon ? <View style={[styles.icon, { backgroundColor: t.color.line }]}>{icon}</View> : null}
      <AppText textRole="section" tone="ink" style={[styles.center, styles.title]}>
        {title}
      </AppText>
      {description ? (
        <AppText textRole="bodySm" tone="secondary" style={styles.center}>
          {description}
        </AppText>
      ) : null}
      {actionLabel ? (
        <Button
          label={actionLabel}
          variant="primary"
          tone="ink"
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  center: { textAlign: 'center' },
  action: { marginTop: 8, alignSelf: 'stretch' },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 4 },
});
