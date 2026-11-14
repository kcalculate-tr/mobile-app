// G47-S1 md.1 — Tek giriş katmanı (AuthSheet). `yeni_kayit` açıkken kök yığındaki `Login` rotası BU katmandır
// (saydam modal): uygulamadaki tüm "Giriş yap / Zaten hesabım var" girişleri (onboarding 5, Profil oturumsuz,
// eatkcal oturum isteyen eylemler, takip rotaları oturumsuzken) aynı alttan açılan katmanı açar; ayrı tam ekran
// giriş sayfası yok. Görsel dil kayıt ekranlarıyla (K1) aynı: cam zemin (KBackdrop), lime, 56 pt düğmeler.
// Arkası bulanık karartma; aşağı kaydırarak, karartmaya dokunarak, X ile ya da Android geri ile kapanır.
// Geçiş 300 ms (enter/exit eğrisi); azaltılmış harekette yalnız 200 ms opaklık.
// E-posta → E1 → E2 (KEmail ekranları, giriş kipi; inceleme adresleri için şifre alanı AYNEN).
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, PanResponder, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as AppleAuthentication from 'expo-apple-authentication';
import NetInfo from '@react-native-community/netinfo';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CURVE, DURATION, PREMIUM, REDUCED, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { resolvePostSocialAuth } from '../../../lib/postSocialAuth';
import { LEGAL_SLUG } from '../../../lib/legal/slugs';
import { openLegalWeb } from '../../../lib/legal/openLegal';
import { X } from '../../../components/icons';
import { interpretSocialResult } from '../../onboarding/v2/loginLogic';
import { FONT, KBackdrop, KText, NoticeCard } from '../ui/parts';
import { PressScale } from '../ui/motion';
import { useK } from '../ui/theme';
import { SocialButton } from '../screens/SignupScreens';
import { useAuthSuccess } from './postAuth';

/** Katman geçişi — brif "300 ms modern sheet": açılış PREMIUM.sheet.enter (base 300 · enter), kapanış sheet token'ı
 *  (fast 200 · exit); azaltılmış harekette REDUCED (200 ms) yalnız opaklık. */
export const AUTH_SHEET_MS = PREMIUM.sheet.enter;
export const AUTH_SHEET_CLOSE_MS = PREMIUM.sheet.exit;
export const AUTH_SHEET_REDUCED_MS = REDUCED.duration;
/** Aşağı kaydırma: bu kadar pt ya da hızlı fırlatma kapatır. */
export const DISMISS_DY = 120;
export const DISMISS_VY = 1.1;

type Params = { redirectTo?: string; vitrinBusy?: 'apple' | 'google' } | undefined;

export default function AuthSheet() {
  const { t, lang } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const reduced = useReducedMotion();
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as NonNullable<Params>;
  const { signInWithApple, signInWithGoogle } = useAuth();
  const mark = useAuthSuccess(params.redirectTo);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(__DEV__ && params.vitrinBusy ? params.vitrinBusy : null);
  const [notice, setNotice] = useState<'offline' | 'cancelled' | 'error' | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const open = useSharedValue(0);
  const drag = useSharedValue(0);
  const closing = useRef(false);

  useEffect(() => {
    open.value = withTiming(1, { duration: reduced ? AUTH_SHEET_REDUCED_MS : AUTH_SHEET_MS, easing: reduced ? CURVE.standard : CURVE.enter });
  }, [open, reduced]);

  const after = useRef<(() => void) | null>(null);
  const finish = () => {
    const then = after.current;
    after.current = null;
    if (then) then();
    else if (navigation.canGoBack()) navigation.goBack();
  };
  /** Katmanı kapat (animasyonlu); `then` verilirse goBack yerine o çalışır (ör. E1'e geçiş). */
  const close = (then?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    after.current = then ?? null;
    open.value = withTiming(0, { duration: reduced ? AUTH_SHEET_REDUCED_MS : AUTH_SHEET_CLOSE_MS, easing: reduced ? CURVE.standard : CURVE.exit }, (ok) => {
      if (ok) runOnJS(finish)();
    });
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_e, g) => {
        drag.value = Math.max(0, g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > DISMISS_DY || g.vy > DISMISS_VY) close();
        else drag.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.standard });
      },
      onPanResponderTerminate: () => {
        drag.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.standard });
      },
    }),
  ).current;

  const scrim = useAnimatedStyle(() => ({ opacity: open.value * Math.max(0, 1 - drag.value / 600) }));
  const card = useAnimatedStyle(() =>
    reduced ? { opacity: open.value, transform: [{ translateY: drag.value }] } : { transform: [{ translateY: (1 - open.value) * H * 0.6 + drag.value }] },
  );

  const runSocial = async (m: 'apple' | 'google') => {
    if (busy) return;
    setNotice(null);
    const net = await NetInfo.fetch().catch(() => null);
    if (net && net.isConnected === false) {
      haptic('warning');
      setNotice('offline');
      return;
    }
    setBusy(m);
    mark(m);
    try {
      const result = await (m === 'apple' ? signInWithApple() : signInWithGoogle());
      const out = await interpretSocialResult(result, resolvePostSocialAuth);
      if (out.kind === 'done') mark(m, out.newUser);
      else if (out.kind === 'cancelled') setNotice('cancelled');
      else {
        setErrMsg(out.message);
        setNotice('error');
        haptic('warning');
      }
    } finally {
      setBusy(null);
    }
  };

  const openEmail = () => {
    if (busy) return;
    close(() => navigation.replace('AuthEmail', { mode: 'login', redirectTo: params.redirectTo }));
  };

  const iosApple = Platform.OS === 'ios';
  return (
    <View style={StyleSheet.absoluteFill} testID="auth-sheet-root">
      <Animated.View style={[StyleSheet.absoluteFill, scrim]}>
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable testID="auth-sheet-scrim" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.38)' }]} onPress={() => close()} accessibilityRole="button" accessibilityLabel={t('kayit.auth.close')} />
      </Animated.View>
      <Animated.View
        testID="auth-sheet"
        accessibilityViewIsModal
        {...pan.panHandlers}
        style={[styles.card, { borderColor: P.cardEdge, paddingBottom: Math.max(insets.bottom, 16) + 8 }, card]}
      >
        <KBackdrop shift={5} />
        <View style={styles.grabWrap} accessible={false}>
          <View style={[styles.grabber, { backgroundColor: P.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(16,48,29,0.25)' }]} />
        </View>
        <View style={styles.head}>
          <KText testID="auth-sheet-title" accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.title, { color: P.ink }]}>
            {t('kayit.auth.title')}
          </KText>
          <Pressable testID="auth-sheet-close" onPress={() => close()} accessibilityRole="button" accessibilityLabel={t('kayit.auth.close')} hitSlop={6} style={[styles.closeBtn, { backgroundColor: P.circle }]}>
            <X size={18} color={P.ink} weight="bold" />
          </Pressable>
        </View>
        <View style={styles.body}>
          {notice === 'offline' ? <NoticeCard testID="auth-offline" tone="error" title={t('kayit.signup.offline_title')} sub={t('kayit.auth.offline_sub')} action={{ label: t('kayit.signup.retry'), onPress: () => setNotice(null) }} /> : null}
          {notice === 'cancelled' ? <NoticeCard testID="auth-cancelled" title={t('kayit.signup.cancelled_title')} sub={t('kayit.signup.cancelled_sub')} /> : null}
          {notice === 'error' ? <NoticeCard testID="auth-error" tone="error" title={t('kayit.signup.error_title')} sub={errMsg} /> : null}
          {iosApple ? (
            <View testID="auth-apple" style={{ opacity: busy && busy !== 'apple' ? 0.5 : 1 }} pointerEvents={busy ? 'none' : 'auto'}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={P.isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={28}
                style={styles.apple}
                onPress={() => void runSocial('apple')}
              />
              {busy === 'apple' ? (
                <View style={[StyleSheet.absoluteFill, styles.appleBusy]}>
                  <ActivityIndicator color={P.isDark ? '#000' : '#FFF'} />
                </View>
              ) : null}
            </View>
          ) : __DEV__ ? (
            <SocialButton testID="auth-apple" kind="apple" label={t('kayit.signup.apple')} dark={!P.isDark} busy={busy === 'apple'} disabled={!!busy && busy !== 'apple'} onPress={() => void runSocial('apple')} />
          ) : null}
          <SocialButton testID="auth-google" kind="google" label={t('kayit.signup.google')} dark={false} busy={busy === 'google'} disabled={!!busy && busy !== 'google'} onPress={() => void runSocial('google')} />
          <PressScale
            testID="auth-email"
            onPress={openEmail}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityLabel={t('kayit.signup.email')}
            accessibilityState={{ disabled: !!busy }}
            style={[styles.secondary, { backgroundColor: P.card, borderColor: P.cardEdge, opacity: busy ? 0.5 : 1 }]}
          >
            <KText maxFontSizeMultiplier={1.3} style={[styles.secondaryText, { color: P.ink }]}>
              {t('kayit.signup.email')}
            </KText>
          </PressScale>
          <View style={styles.legalRow}>
            <Pressable testID="auth-terms" accessibilityRole="link" onPress={() => void openLegalWeb('terms', lang, () => navigation.navigate('ProfileContracts', { slug: LEGAL_SLUG.terms }))} hitSlop={8} style={styles.legalHit}>
              <KText maxFontSizeMultiplier={1.4} style={[styles.legal, { color: P.sec }]}>
                {t('kayit.auth.terms')}
              </KText>
            </Pressable>
            <KText importantForAccessibility="no" accessibilityElementsHidden style={[styles.legal, { color: P.sec, textDecorationLine: 'none' }]}>
              ·
            </KText>
            <Pressable testID="auth-privacy" accessibilityRole="link" onPress={() => void openLegalWeb('privacy', lang, () => navigation.navigate('ProfileContracts', { slug: LEGAL_SLUG.privacy }))} hitSlop={8} style={styles.legalHit}>
              <KText maxFontSizeMultiplier={1.4} style={[styles.legal, { color: P.sec }]}>
                {t('kayit.auth.privacy')}
              </KText>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderTopWidth: 1, overflow: 'hidden' },
  grabWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  title: { flex: 1, fontFamily: FONT.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  apple: { height: 56, width: '100%' },
  appleBusy: { alignItems: 'center', justifyContent: 'center' },
  secondary: { height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  secondaryText: { fontFamily: FONT.semi, fontSize: 17, lineHeight: 22 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4 },
  legalHit: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  legal: { fontFamily: FONT.medium, fontSize: 12, lineHeight: 16, textDecorationLine: 'underline' },
});
