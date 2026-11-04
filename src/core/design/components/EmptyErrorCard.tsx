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
  style,
  testID,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** 'error' başlığı danger tonuyla yazar; kart yine opak ve sarsıntısız. */
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
          borderColor: t.color.line,
          borderWidth: t.stroke.hairline,
          borderRadius: t.radius.lg,
          padding: t.space['2xl'],
          gap: t.space.md,
        },
        style,
      ]}
    >
      <AppText textRole="section" tone={tone === 'error' ? 'danger' : 'ink'} style={styles.center}>
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
          variant="secondary"
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
  action: { marginTop: 4 },
});
