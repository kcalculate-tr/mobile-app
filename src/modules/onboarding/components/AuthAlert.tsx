// G22-S2 md.5 (Tur 26j, G21 T3) — FinOnbAccountError satır içi uyarısı. Apple ve
// Google düğmelerinin HEMEN altında; ağ hatası ("Bağlanamadık") ya da hesap hatası
// ("Apple ile giriş tamamlanamadı"). VoiceOver duyurur (role=alert). "Tekrar dene"
// aynı sağlayıcıyı yeniden dener; E-posta alternatif olarak açık kalır.
// İPTAL SESSİZ: bu bileşen iptalde HİÇ çizilmez (bkz. socialAuthError).
import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '../../../core/design/components/AppText';
import { fontFamily } from '../../../core/design/typography';
import { useT } from '../../../core/i18n';
import { FinErrorReveal } from '../../../core/design/components/FinTransitions';
import { authAlertKeys } from '../socialAuthError';
import { useOnb } from './onbTheme';

// Phosphor WarningCircle (regular, 256 viewBox) — tasarımdaki ikon.
const WARNING =
  'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z';

export function AuthAlert({
  kind,
  provider,
  onRetry,
  busy = false,
}: {
  kind: 'network' | 'account';
  provider: 'apple' | 'google';
  onRetry: () => void;
  busy?: boolean;
}) {
  const { t } = useT();
  const P = useOnb();
  const keys = authAlertKeys(kind, provider);
  const title = t(keys.title);
  const body = t(keys.body);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`${title}. ${body}`);
  }, [title, body]);

  return (
    <FinErrorReveal>
      <View
        testID="onb-auth-alert"
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={[
          styles.box,
          { backgroundColor: P.isDark ? '#1C1C1E' : '#FFFFFF', borderColor: P.line2 },
        ]}
      >
        <View style={styles.row}>
          <Svg width={22} height={22} viewBox="0 0 256 256" style={styles.icon} accessible={false}>
            <Path d={WARNING} fill={P.ink} />
          </Svg>
          <View style={styles.texts}>
            <AppText style={[styles.title, { color: P.ink }]}>{title}</AppText>
            <AppText style={[styles.body, { color: P.sec }]}>{body}</AppText>
          </View>
        </View>
        <Pressable
          onPress={busy ? undefined : onRetry}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('auth_error.retry')}
          accessibilityState={{ disabled: busy, busy }}
          testID="onb-auth-retry"
          style={({ pressed }) => [styles.retry, { borderColor: P.ink, opacity: busy ? 0.5 : pressed ? 0.85 : 1 }]}
        >
          <AppText style={[styles.retryText, { color: P.ink }]}>
            {busy ? t('auth_error.connecting') : t('auth_error.retry')}
          </AppText>
        </Pressable>
      </View>
    </FinErrorReveal>
  );
}

const styles = StyleSheet.create({
  // Final: radius 18 · iç 1 px line2 · dolgu 14/14/10 · aralık 8.
  box: { borderRadius: 18, borderWidth: 1, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  icon: { marginTop: 1 },
  texts: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 20 },
  body: { marginTop: 2, fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 20 },
  // Final: sağa yaslı, min 44, yatay 18, radius 22, 1.5 px ink çerçeve.
  retry: {
    alignSelf: 'flex-end',
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
});
