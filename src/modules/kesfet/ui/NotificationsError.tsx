// G22-S2 md.5 (Tur 26j, G21 T4 — FinNotificationsError) — bildirimler yüklenemedi.
// Ortada: 72 px daire (kart zemini + 1 px çizgi) içinde Wi-Fi yok ikonu, başlık
// "Bildirimler yüklenemedi" (VoiceOver duyurur), açıklama, mürekkep hap "↻ Tekrar
// dene". Yeniden denerken satır iskeleti (FinListSkeleton) çağıran tarafından çizilir.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText, FinErrorReveal, fontFamily, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { WifiSlash } from '../../../components/icons';

// Phosphor ArrowClockwise (regular) — tasarımdaki yenile ikonu.
const ARROW_CW =
  'M240,56v48a8,8,0,0,1-8,8H184a8,8,0,0,1,0-16H211.4L184.81,71.64l-.25-.24a80,80,0,1,0-1.67,114.78,8,8,0,0,1,11,11.63A95.44,95.44,0,0,1,128,224h-1.32A96,96,0,1,1,195.75,60L224,85.8V56a8,8,0,1,1,16,0Z';

export function NotificationsError({ onRetry }: { onRetry: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const onInk = t.color.bg;
  return (
    <FinErrorReveal style={styles.wrap}>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[styles.iconCircle, { backgroundColor: t.color.surfaceRaised, borderColor: t.color.line }]}
      >
        <WifiSlash size={32} color={t.color.ink} />
      </View>
      <AppText
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={[styles.title, { color: t.color.ink }]}
        testID="notif-error-title"
      >
        {tr('notif_error.title')}
      </AppText>
      <AppText style={[styles.body, { color: t.color.secondary }]}>{tr('notif_error.body')}</AppText>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={tr('notif_error.retry')}
        testID="notif-error-retry"
        style={({ pressed }) => [styles.retry, { backgroundColor: t.color.ink, opacity: pressed ? 0.9 : 1 }]}
      >
        <Svg width={18} height={18} viewBox="0 0 256 256" accessible={false}>
          <Path d={ARROW_CW} fill={onInk} />
        </Svg>
        <AppText style={[styles.retryText, { color: onInk }]}>{tr('notif_error.retry')}</AppText>
      </Pressable>
    </FinErrorReveal>
  );
}

const styles = StyleSheet.create({
  // Final: ortada, yatay 32, alttan 120 (görsel merkez biraz yukarıda), aralık 10.
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32, paddingBottom: 120 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 8, fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 26, textAlign: 'center' },
  body: { fontFamily: fontFamily.bodyRegular, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  retry: {
    marginTop: 10,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retryText: { fontFamily: fontFamily.bodySemibold, fontSize: 16 },
});
