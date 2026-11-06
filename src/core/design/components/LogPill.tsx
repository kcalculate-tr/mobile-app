import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';
import { haptic } from '../motion';
import { touch } from '../tokens';

/**
 * LogPill — tek dokunuşla loglama.
 *
 * Davranış (spec):
 *  - Pill'in TAMAMINA dokunmak loglar (`onLog`) + light haptik (log geri bildirimi).
 *  - Sağda AYRI 44pt bir ⌄ bölmesi (`onExpand`) — detay/düzenleme açar, selection haptik.
 *  - UZUN BASIŞ öğün seçimi (`onLongPress`) — selection haptik.
 *
 * Görsel: lime dolgu + siyah yazı (lime yalnız dolgu kuralı). Başarı
 * geri bildirimi için küçük pop (hero DEĞİL, light haptik; success yalnız
 * kutlamada). Dynamic Type'ta yükseklik minHeight ile büyür.
 */
export function LogPill({
  label,
  caption,
  onLog,
  onExpand,
  onLongPress,
}: {
  label: string;
  caption?: string;
  onLog?: () => void;
  onExpand?: () => void;
  onLongPress?: () => void;
}) {
  const t = useTheme();

  // Loglama bir KUTLAMA değil GERİ BİLDİRİM: light haptik (log/geri bildirim
  // sözlüğü). success haptik ve pop yalnız hero kutlamalara ayrılmıştır.
  const handleLog = () => {
    haptic('light');
    onLog?.();
  };

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: t.color.accent, borderRadius: t.radius.pill },
      ]}
    >
        <Pressable
          onPress={handleLog}
          onLongPress={() => {
            haptic('selection');
            onLongPress?.();
          }}
          // G16-S2: Android ripple yok — basma hâli iOS ile aynı (Final; haptik + pop).
          style={styles.main}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Dokun: logla. Uzun bas: öğün seç."
        >
          <View style={styles.texts}>
            <AppText variant="heading" tone="onAccent" numberOfLines={1}>
              {label}
            </AppText>
            {caption ? (
              <AppText variant="caption" tone="onAccent" numberOfLines={1} style={styles.caption}>
                {caption}
              </AppText>
            ) : null}
          </View>
        </Pressable>

        {/* Ayrı 44pt ⌄ bölmesi — ince ayırıcı çizgiyle ayrılır. */}
        <View style={[styles.divider, { backgroundColor: 'rgba(0,0,0,0.12)' }]} />
        <Pressable
          onPress={() => {
            haptic('selection');
            onExpand?.();
          }}
          style={styles.chevron}
          accessibilityRole="button"
          accessibilityLabel="Seçenekler"
          hitSlop={4}
        >
          <AppText variant="heading" tone="onAccent">
            ⌄
          </AppText>
        </Pressable>
      </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: touch.minTarget + 8,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingLeft: 20,
    paddingRight: 12,
    minHeight: touch.minTarget,
  },
  texts: { gap: 2 },
  caption: { opacity: 0.8 },
  divider: { width: StyleSheet.hairlineWidth },
  chevron: {
    width: touch.minTarget,
    minHeight: touch.minTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
