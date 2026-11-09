// G18-S1 md.3 — FinOnbAccountEmail + FinOnbAccountKeyboard: "E-posta ile devam et"
// kaydırılabilir sheet'i. Apple/Google Hesap sayfasında sabit kalır; e-posta alanı +
// "Kod gönder" formun İÇİNDE. Klavye açılınca sheet klavyenin üstüne oturur (alt
// köşeler düz, alan 2 pt mürekkep halka). Kod gönderilince aynı sheet'te kod adımı
// ("Doğrula ve devam et" · "E-postayı değiştir").
//
// AUTH MANTIĞI AYNEN: AuthContext.signInWithOtp / verifyEmailOtp (LoginV2 ile aynı
// çağrılar, aynı e-posta kuralı `isValidEmail`, aynı kod temizliği `sanitizeCode`).
// Hareket: sheet base 300 enter / fast 200 exit, scrim 0→0.32; azaltılmış 200 ms opaklık.
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../core/design/components/AppText';
import { CURVE, DURATION, REDUCED, useReducedMotion } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { KeyboardLiftView } from '../../../core/design/components/KeyboardLiftView';
import { useAuth } from '../../../core/AuthContext';
import { isCodeComplete, isValidEmail, sanitizeCode } from '../v2/loginLogic';
import { OnbButton } from '../components/pieces';
import { ConsentBlock } from '../consent/ConsentBlock';
import { acceptPolicies, holdGate } from '../../../lib/consent/store';
import { useOnb } from '../components/onbTheme';

const X_D =
  'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z';

export function AccountEmailSheet({
  adOn = true,
  onAdChange,
  accepted: acceptedProp,
  onAcceptedChange,
  visible,
  onClose,
  onVerified,
  onClosed,
  vitrinFocus,
}: {
  /** G20-S1: reklam ölçümü (Meta) — Hesap ekranıyla ortak durum. */
  adOn?: boolean;
  onAdChange?: (v: boolean) => void;
  /** G20-S3 md.2b: Hesap ekranıyla ORTAK zorunlu kutu (verilmezse sheet kendi tutar). */
  accepted?: boolean;
  onAcceptedChange?: (v: boolean) => void;
  visible: boolean;
  onClose: () => void;
  /** Kod doğrulandı (oturum açıldı) → Ana sayfa. */
  onVerified: () => void;
  /** Kapanış animasyonu bitip Modal kalktığında (G18-S5: gezinme bundan SONRA yapılır). */
  onClosed?: () => void;
  /** YALNIZ vitrin: klavye açık hâli (FinOnbAccountKeyboard). */
  vitrinFocus?: boolean;
}) {
  const P = useOnb();
  const i18n = useT();
  const reduced = useReducedMotion();
  const { signInWithOtp, verifyEmailOtp } = useAuth();
  const [mounted, setMounted] = useState(visible);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  // G20-S1 md.1: Koşullar + Gizlilik kabulü zorunlu (onay kutusu), "Kod gönder" öncesi.
  const [acceptedOwn, setAcceptedOwn] = useState(false);
  const accepted = acceptedProp ?? acceptedOwn;
  const setAccepted = (v: boolean) => {
    if (onAcceptedChange) onAcceptedChange(v);
    else setAcceptedOwn(v);
  };
  const [showRequired, setShowRequired] = useState(false);
  const releaseRef = useRef<(() => void) | null>(null);
  const release = () => {
    releaseRef.current?.();
    releaseRef.current = null;
  };
  useEffect(() => release, []);
  const inputRef = useRef<TextInput>(null);

  const y = useSharedValue(1);
  const o = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduced) {
        y.value = 0;
        o.value = withTiming(1, { duration: REDUCED.duration });
      } else {
        o.value = withTiming(1, { duration: DURATION.base, easing: CURVE.enter });
        y.value = withTiming(0, { duration: DURATION.base, easing: CURVE.enter });
      }
    } else if (mounted) {
      const end = () => {
        setMounted(false);
        setSent(false);
        setCode('');
        setError('');
        setShowRequired(false);
        release();
        onClosed?.();
      };
      if (reduced) {
        o.value = withTiming(0, { duration: REDUCED.duration }, (ok) => ok && runOnJS(end)());
      } else {
        o.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.exit });
        y.value = withTiming(1, { duration: DURATION.fast, easing: CURVE.exit }, (ok) => ok && runOnJS(end)());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible && __DEV__ && vitrinFocus) setTimeout(() => inputRef.current?.focus(), 350);
  }, [visible, vitrinFocus]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: o.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduced ? o.value : 1,
    transform: [{ translateY: y.value * 520 }],
  }));

  const send = async () => {
    if (busy) return;
    if (!accepted) {
      setShowRequired(true);
      return;
    }
    if (!isValidEmail(email)) {
      setError(i18n.t('onboarding.email.err_email'));
      return;
    }
    setError('');
    setBusy(true);
    const { error: err } = await signInWithOtp(email.trim());
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    // Kod doğrulanınca oturum, kabul kaydından önce açılır → kapı beklesin.
    if (!releaseRef.current) releaseRef.current = holdGate();
    setSent(true);
  };

  const verify = async () => {
    if (busy || !isCodeComplete(code)) return;
    setBusy(true);
    setError('');
    const { error: err } = await verifyEmailOtp(email.trim(), code);
    setBusy(false);
    if (err) {
      setError(i18n.t('onboarding.email.err_code'));
      return;
    }
    await acceptPolicies({ source: 'signup_email', adOn, ageOk: true }).catch(() => {});
    release();
    onVerified();
  };

  if (!mounted) return null;

  // Pano: rgba(255,255,255,0.78) + 30 px bulanıklık, %32 karartma üstünde → görünen yüzey.
  // Bulanıklık arkadaki kartı lekeliyordu (vitrin çekimi) → aynı görünen tonda düz yüzey.
  const sheetBg = P.isDark ? '#1C1C1E' : '#F2F2F2';
  const sheetEdge = P.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)';
  const fieldBg = P.isDark ? '#1C1C1E' : '#FFFFFF';
  const xBg = P.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,10,0.06)';
  const ring = (on: boolean) =>
    on ? { borderWidth: 2, borderColor: P.ink } : { borderWidth: 1, borderColor: P.line2 };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,10,0.32)' }, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('onboarding.email.close')}
        />
      </Animated.View>
      {/* G21-S1 md.10: KAV (Android'de davranışsız) yerine ortak KeyboardLiftView. */}
      <View style={styles.kav} pointerEvents="box-none">
        <KeyboardLiftView limitHeight testID="email-sheet-lift">
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              borderTopColor: sheetEdge,
            },
            sheetStyle,
          ]}
          testID="fin-onb-email-sheet"
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: sheetBg }]} />
          <View style={styles.head}>
            <AppText style={[styles.title, { color: P.ink }]} accessibilityRole="header">
              {i18n.t('onboarding.email.title')}
            </AppText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('onboarding.email.close')}
              style={styles.xHit}
            >
              <View style={[styles.xDot, { backgroundColor: xBg }]}>
                <Svg width={18} height={18} viewBox="0 0 256 256">
                  <Path d={X_D} fill={P.ink} />
                </Svg>
              </View>
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!sent ? (
              <>
                <AppText style={[styles.lead, { color: P.sec }]}>{i18n.t('onboarding.email.sub')}</AppText>
                <View style={{ gap: 6 }}>
                  <AppText style={[styles.label, { color: P.sec }]}>{i18n.t('onboarding.email.label')}</AppText>
                  <View style={[styles.field, { backgroundColor: fieldBg }, ring(focused)]}>
                    <TextInput
                      ref={inputRef}
                      value={email}
                      onChangeText={(v) => {
                        setEmail(v);
                        if (error) setError('');
                      }}
                      placeholder={i18n.t('onboarding.email.placeholder')}
                      placeholderTextColor={P.sec}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="send"
                      onSubmitEditing={send}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      accessibilityLabel={i18n.t('onboarding.email.label')}
                      style={[styles.input, { color: P.ink }]}
                      testID="fin-onb-email-input"
                    />
                  </View>
                </View>
                {error ? (
                  <AppText textRole="helper" style={styles.err} accessibilityLiveRegion="polite">
                    {error}
                  </AppText>
                ) : null}
                <ConsentBlock
                  withAge
                  accepted={accepted}
                  onAcceptedChange={(v) => {
                    setAccepted(v);
                    if (v) setShowRequired(false);
                  }}
                  showRequired={showRequired}
                  adOn={adOn}
                  onAdChange={(v) => onAdChange?.(v)}
                  testID="fin-onb-email-consent"
                />
                <OnbButton kind="lime" label={i18n.t('onboarding.email.send')} onPress={send} disabled={busy} />
              </>
            ) : (
              <>
                <AppText style={[styles.lead, { color: P.ink }]} accessibilityLiveRegion="polite">
                  {i18n.t('onboarding.email.sent')}
                </AppText>
                <View style={{ gap: 6 }}>
                  <AppText style={[styles.label, { color: P.sec }]}>{i18n.t('onboarding.email.code_label')}</AppText>
                  <View style={[styles.field, { backgroundColor: fieldBg }, ring(focused)]}>
                    <TextInput
                      value={code}
                      onChangeText={(v) => {
                        setCode(sanitizeCode(v));
                        if (error) setError('');
                      }}
                      placeholder={i18n.t('onboarding.email.code_placeholder')}
                      placeholderTextColor={P.sec}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      accessibilityLabel={i18n.t('onboarding.email.code_label')}
                      style={[styles.input, { color: P.ink }]}
                      testID="fin-onb-email-code"
                    />
                  </View>
                </View>
                {error ? (
                  <AppText textRole="helper" style={styles.err} accessibilityLiveRegion="polite">
                    {error}
                  </AppText>
                ) : null}
                <OnbButton
                  kind="lime"
                  label={i18n.t('onboarding.email.verify')}
                  onPress={verify}
                  disabled={busy || !isCodeComplete(code)}
                />
                <Pressable
                  onPress={() => {
                    setSent(false);
                    setCode('');
                    setError('');
                  }}
                  accessibilityRole="button"
                  style={styles.change}
                >
                  <AppText style={[styles.changeText, { color: P.ink }]}>{i18n.t('onboarding.email.change')}</AppText>
                </Pressable>
              </>
            )}
          </ScrollView>
        </Animated.View>
        </KeyboardLiftView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: 720,
    flexShrink: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingRight: 8, paddingBottom: 4, paddingLeft: 20 },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, lineHeight: 25, flex: 1 },
  xHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  xDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
  lead: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 13, lineHeight: 17, fontFamily: 'PlusJakartaSans_600SemiBold' },
  field: { height: 52, borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center' },
  input: { fontSize: 16, padding: 0, fontFamily: 'PlusJakartaSans_400Regular' },
  err: { color: '#E5484D' },
  change: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  changeText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', textDecorationLine: 'underline' },
});
