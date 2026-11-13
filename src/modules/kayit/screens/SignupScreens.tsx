// G42-S1 md.5 — K1 kayıt (A: "Planını kaydedelim" · B: "Hemen başlayalım") + E1/E2 e-posta kodu.
// MEVCUT kimlik doğrulama (useAuth: Apple, Google, e-posta OTP; inceleme adresi için şifre girişi korunur).
// Apple/Google düğmeleri resmî logolarla (G18-S5 kararı, pieces.tsx). İki İSTEĞE BAĞLI işaretsiz kutu:
// Meta onayı (G41 requestMetaOptIn; iOS'ta işaretlenince ATT, reddedilirse kutu boşalır + K1d notu) ve
// pazarlama e-postası onayı (notification_preferences.marketing_enabled). B yolunda doğum yılı sorulmadığı
// için mevcut 18+ beyan kutusu (LoginV2 kuralı) zorunlu ve işaretsiz gelir.
// Durumlar: yükleniyor (basılan düğmede halka, diğerleri %50) · ağ yok (hata kartı + Yeniden dene) ·
// iptal (nötr kart, 6 sn sonra kalkar). E2: 6 kutu (yapıştırma, otomatik ilerleme, 6. hanede doğrular),
// yeniden gönderme sayacı = mevcut 60 sn; yanlış kod → ince hata çizgisi + kart + hata titreşimi; süresi
// doldu → kutular boşalır, "Yeni kod gönder".
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { AppText, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { useFeature } from '../../../core/flags';
import { resolvePostSocialAuth } from '../../../lib/postSocialAuth';
import { requestMetaOptIn } from '../../../lib/consent/metaConsent';
import { LEGAL_SLUG } from '../../../lib/legal/slugs';
import { openLegalWeb } from '../../../lib/legal/openLegal';
import { useReviewPasswordLogin } from '../../../lib/auth/useReviewPasswordLogin';
import { AppleLogo, GoogleLogo } from '../../onboarding/components/pieces';
import { CODE_LENGTH, RESEND_SECONDS, formatCountdown, interpretSocialResult, isValidEmail, sanitizeCode } from '../../onboarding/v2/loginLogic';
import { CheckBoxRow, FONT, KBackdrop, KButton, NoticeCard, QuestionHead, TopBar } from '../ui/parts';
import { useEdgeBack } from '../ui/edge';
import { K_MOTION, useK } from '../ui/theme';
import { PressScale, PushIn } from '../ui/motion';
import { firstTabFor, type KPath } from '../model';
import { finishSignup } from '../signup';
import { flushDraft, useKayit } from '../store';
import { kTrack } from '../events';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

type Method = 'apple' | 'google' | 'email';
type Consents = { meta: boolean; marketing: boolean; age: boolean };

/** Oturum açılınca (sosyal girişte session async gelir) kayıt sonrası akışa bir kez geç. */
function useFinishOnAuth(path: KPath) {
  const { user } = useAuth();
  const { lang } = useT();
  const navigation = useNavigation<any>();
  const kesfet = useFeature('kesfet');
  const pending = useRef<{ method: Method; c: Consents } | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (!user?.id || !pending.current || done.current) return;
    done.current = true;
    const { method, c } = pending.current;
    void (async () => {
      const r = await finishSignup({ userId: user.id, method, metaOn: c.meta, marketingOn: c.marketing, lang: lang === 'en' ? 'en' : 'tr', ageOk: path === 'a' ? true : c.age });
      haptic('success');
      if (r.path === 'a') {
        navigation.navigate('KOffer');
        return;
      }
      const tab = firstTabFor(useKayit.getState().start, kesfet);
      const root = navigation.getParent?.() ?? navigation;
      root.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: tab } }] });
    })();
  }, [user?.id, path, lang, navigation, kesfet]);
  return (method: Method, c: Consents) => {
    pending.current = { method, c };
  };
}

// ─── K1 ───────────────────────────────────────────────────────────────────────
export function SignupScreen() {
  const { t, lang } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as { path?: KPath; vitrin?: 'loading' | 'offline' | 'cancelled' | 'denied' };
  const path: KPath = params.path ?? useKayit.getState().path;
  const { user, signInWithApple, signInWithGoogle } = useAuth();
  const [meta, setMeta] = useState(false);
  const [metaDenied, setMetaDenied] = useState(__DEV__ && params.vitrin === 'denied');
  const [marketing, setMarketing] = useState(false);
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState<Method | null>(__DEV__ && params.vitrin === 'loading' ? 'apple' : null);
  const [notice, setNotice] = useState<'offline' | 'cancelled' | 'error' | null>(__DEV__ && (params.vitrin === 'offline' || params.vitrin === 'cancelled') ? params.vitrin : null);
  const [errMsg, setErrMsg] = useState('');
  const markPending = useFinishOnAuth(path);
  const back = () => navigation.goBack();
  const edge = useEdgeBack(back);

  useEffect(() => {
    if (path === 'a') void flushDraft('signup');
  }, [path]);
  useEffect(() => {
    if (notice !== 'cancelled') return;
    const id = setTimeout(() => setNotice(null), K_MOTION.infoHold);
    return () => clearTimeout(id);
  }, [notice]);

  const needsAge = path === 'b';
  const blocked = needsAge && !age;
  const consents = (): Consents => ({ meta, marketing, age: needsAge ? age : true });

  const toggleMeta = async () => {
    if (meta) {
      setMeta(false);
      kTrack.metaConsent(false, 'unavailable');
      return;
    }
    const r = await requestMetaOptIn();
    kTrack.metaConsent(r.granted, r.att);
    if (r.granted) {
      setMeta(true);
      setMetaDenied(false);
    } else {
      setMeta(false);
      setMetaDenied(true);
    }
  };

  const runSocial = async (m: 'apple' | 'google') => {
    if (busy || blocked) return;
    setNotice(null);
    const net = await NetInfo.fetch().catch(() => null);
    if (net && net.isConnected === false) {
      haptic('warning');
      setNotice('offline');
      return;
    }
    kTrack.signupMethod(m, path);
    setBusy(m);
    markPending(m, consents());
    try {
      const result = await (m === 'apple' ? signInWithApple() : signInWithGoogle());
      const out = await interpretSocialResult(result, resolvePostSocialAuth);
      if (out.kind === 'cancelled') setNotice('cancelled');
      else if (out.kind === 'error') {
        setErrMsg(out.message);
        setNotice('error');
        haptic('warning');
      }
    } finally {
      setBusy(null);
    }
  };

  const openEmail = () => {
    if (busy || blocked) return;
    kTrack.signupMethod('email', path);
    navigation.navigate('KEmail', { path, meta, marketing, age: needsAge ? age : true });
  };

  void user;
  const darkBtn = !P.isDark;
  return (
    <View style={{ flex: 1 }} {...edge} testID={`kayit-signup-${path}`}>
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <KBackdrop shift={22} />
      <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <TopBar onBack={back} progress={path === 'a' ? { index: 1, total: 1, hideNumber: true } : null} />
        <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ marginTop: 12 }}>
            <QuestionHead title={path === 'a' ? t('kayit.signup.title_a') : t('kayit.signup.title_b')} layout="left" fade={false} />
          </View>
          <View style={{ paddingHorizontal: 20, marginTop: 28, gap: 12 }}>
            {notice === 'offline' ? <NoticeCard testID="kayit-signup-offline" tone="error" title={t('kayit.signup.offline_title')} sub={t('kayit.signup.offline_sub')} action={{ label: t('kayit.signup.retry'), onPress: () => setNotice(null) }} /> : null}
            {notice === 'cancelled' ? <NoticeCard testID="kayit-signup-cancelled" title={t('kayit.signup.cancelled_title')} sub={t('kayit.signup.cancelled_sub')} /> : null}
            {notice === 'error' ? <NoticeCard tone="error" title={t('kayit.signup.error_title')} sub={errMsg} /> : null}
            {Platform.OS === 'ios' || __DEV__ ? (
              <SocialButton testID="kayit-apple" kind="apple" label={t('kayit.signup.apple')} dark={darkBtn} busy={busy === 'apple'} disabled={(!!busy && busy !== 'apple') || blocked} onPress={() => void runSocial('apple')} />
            ) : null}
            <SocialButton testID="kayit-google" kind="google" label={t('kayit.signup.google')} dark={false} busy={busy === 'google'} disabled={(!!busy && busy !== 'google') || blocked} onPress={() => void runSocial('google')} />
            <PressScale
              testID="kayit-email"
              onPress={openEmail}
              disabled={!!busy || blocked}
              accessibilityRole="button"
              accessibilityLabel={t('kayit.signup.email')}
              accessibilityState={{ disabled: !!busy || blocked }}
              style={[styles.social, { backgroundColor: P.card, borderColor: P.cardEdge, borderWidth: 1, opacity: busy || blocked ? 0.5 : 1 }]}
            >
              <AppText maxFontSizeMultiplier={1.3} style={[styles.socialText, { color: P.ink }]}>
                {t('kayit.signup.email')}
              </AppText>
            </PressScale>
            <LegalLine />
            {needsAge ? <CheckBoxRow testID="kayit-age" checked={age} onToggle={() => setAge(!age)} label={t('kayit.signup.age')} /> : null}
            <AppText accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.optional, { color: P.sec }]}>
              {t('kayit.signup.optional')}
            </AppText>
            <CheckBoxRow testID="kayit-meta" checked={meta} onToggle={() => void toggleMeta()} label={t('kayit.signup.meta')} note={metaDenied && Platform.OS === 'ios' ? t('kayit.signup.meta_denied') : metaDenied && __DEV__ ? t('kayit.signup.meta_denied') : null} />
            <CheckBoxRow testID="kayit-marketing" checked={marketing} onToggle={() => setMarketing(!marketing)} label={t('kayit.signup.marketing')} />
          </View>
        </ScrollView>
      </View>
    </View>
  );

  function LegalLine() {
    const nav = navigation;
    return (
      <AppText maxFontSizeMultiplier={1.4} style={[styles.legal, { color: P.sec }]}>
        {t('kayit.signup.legal_1')}
        <AppText accessibilityRole="link" onPress={() => void openLegalWeb('terms', lang, () => nav.navigate('ProfileContracts', { slug: LEGAL_SLUG.terms }))} style={[styles.legalLink, { color: P.ink }]}>
          {t('kayit.signup.terms')}
        </AppText>
        {t('kayit.signup.legal_2')}
        <AppText accessibilityRole="link" onPress={() => void openLegalWeb('privacy', lang, () => nav.navigate('ProfileContracts', { slug: LEGAL_SLUG.privacy }))} style={[styles.legalLink, { color: P.ink }]}>
          {t('kayit.signup.privacy')}
        </AppText>
        {t('kayit.signup.legal_3')}
      </AppText>
    );
  }
}

function SocialButton({ kind, label, dark, busy, disabled, onPress, testID }: { kind: 'apple' | 'google'; label: string; dark: boolean; busy: boolean; disabled: boolean; onPress: () => void; testID?: string }) {
  const bg = dark ? '#000000' : '#FFFFFF';
  const fg = dark ? '#FFFFFF' : '#1F1F1F';
  return (
    <PressScale
      testID={testID}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      style={[styles.social, { backgroundColor: bg, borderWidth: dark ? 0 : 1, borderColor: '#DADCE0', opacity: disabled ? 0.5 : 1 }]}
    >
      <View style={{ width: 24, alignItems: 'center' }}>{busy ? <ActivityIndicator color={fg} /> : kind === 'apple' ? <AppleLogo color={fg} /> : <GoogleLogo />}</View>
      <AppText maxFontSizeMultiplier={1.3} style={[styles.socialText, { color: fg }]}>
        {label}
      </AppText>
    </PressScale>
  );
}

// ─── E1 / E2 ──────────────────────────────────────────────────────────────────
export function EmailScreen() {
  const { t } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as { path?: KPath; meta?: boolean; marketing?: boolean; age?: boolean; vitrinStep?: 'code'; vitrinState?: 'wrong' | 'expired' | 'verifying' };
  const path: KPath = params.path ?? useKayit.getState().path;
  const { signInWithOtp, verifyEmailOtp } = useAuth();
  const dev = __DEV__ ? params : {};
  const [step, setStep] = useState<'email' | 'code'>(dev.vitrinStep ?? 'email');
  const [email, setEmail] = useState(dev.vitrinStep ? 'elif@ornek.com' : '');
  const [code, setCode] = useState(dev.vitrinState === 'wrong' ? '482917' : dev.vitrinState === 'verifying' ? '482617' : dev.vitrinStep ? '482' : '');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(dev.vitrinState === 'verifying');
  const [err, setErr] = useState<'wrong' | 'expired' | 'send' | null>(dev.vitrinState === 'wrong' || dev.vitrinState === 'expired' ? dev.vitrinState : null);
  const [sendErr, setSendErr] = useState('');
  const [countdown, setCountdown] = useState(dev.vitrinStep ? 59 : 0);
  const review = useReviewPasswordLogin(email);
  const markPending = useFinishOnAuth(path);
  const inputRef = useRef<TextInput>(null);
  const back = () => {
    if (step === 'code') {
      setStep('email');
      setCode('');
      setErr(null);
    } else navigation.goBack();
  };
  const edge = useEdgeBack(back);

  useEffect(() => {
    if (countdown === 0) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const consents = (): Consents => ({ meta: !!params.meta, marketing: !!params.marketing, age: params.age !== false });

  const send = async () => {
    if (!isValidEmail(email) || sending) return;
    setSending(true);
    setSendErr('');
    const { error } = await signInWithOtp(email.trim());
    setSending(false);
    if (error) {
      setSendErr(error);
      return;
    }
    setStep('code');
    setCode('');
    setErr(null);
    setCountdown(RESEND_SECONDS);
  };

  const verify = async (entered: string) => {
    if (err === 'expired') return;
    const v = sanitizeCode(entered);
    if (err === 'wrong' && v.length > 0 && code.length === CODE_LENGTH) {
      // İlk rakam yazılınca kutular temizlenir.
      setErr(null);
      setCode(v.slice(-1));
      return;
    }
    if (v.length > code.length) haptic('selection');
    setCode(v);
    if (v.length < CODE_LENGTH) return;
    setVerifying(true);
    markPending('email', consents());
    const { error } = await verifyEmailOtp(email.trim(), v);
    setVerifying(false);
    if (error) {
      haptic('warning');
      setErr(/expir|süre/i.test(error) ? 'expired' : 'wrong');
      if (/expir|süre/i.test(error)) setCode('');
    }
  };

  const reviewLogin = async () => {
    markPending('email', consents());
    await review.submit();
  };

  if (step === 'email') {
    const valid = isValidEmail(email);
    return (
      <View style={{ flex: 1 }} {...edge} testID="kayit-e1">
        <StatusBar style={P.isDark ? 'light' : 'dark'} />
        <KBackdrop shift={23} />
        {/* G44: E1 ↔ E2 native push hissi (E2 sağdan gelir, geri dönüşte E1 soldan). */}
        <PushIn k={step} dir={-1}>
        <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
          <TopBar onBack={back} />
          <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={{ marginTop: 12 }}>
              <QuestionHead title={t('kayit.signup.email_title')} layout="left" fade={false} />
            </View>
            <View style={{ paddingHorizontal: 20, marginTop: 28, gap: 10 }}>
              <AppText nativeID="kayit-email-label" maxFontSizeMultiplier={1.4} style={[styles.fieldLabel, { color: P.sec }]}>
                {t('kayit.signup.email_label')}
              </AppText>
              <TextInput
                testID="kayit-email-input"
                value={email}
                onChangeText={setEmail}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                accessibilityLabel={t('kayit.signup.email_label')}
                placeholder="ornek@eposta.com"
                placeholderTextColor={P.sec}
                maxFontSizeMultiplier={1.4}
                onSubmitEditing={() => void (review.active ? reviewLogin() : send())}
                style={[styles.field, { backgroundColor: P.field, borderColor: P.cardEdge, color: P.ink }]}
              />
              {review.active ? (
                <TextInput
                  testID="kayit-review-password"
                  value={review.password}
                  onChangeText={review.setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="password"
                  accessibilityLabel={t('kayit.signup.review_password')}
                  placeholder={t('kayit.signup.review_password')}
                  placeholderTextColor={P.sec}
                  maxFontSizeMultiplier={1.4}
                  style={[styles.field, { backgroundColor: P.field, borderColor: P.cardEdge, color: P.ink }]}
                />
              ) : null}
              <AppText maxFontSizeMultiplier={1.4} style={[styles.hint, { color: P.sec }]}>
                {t('kayit.signup.email_hint')}
              </AppText>
              {email.length > 4 && !valid ? (
                <AppText accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.4} style={[styles.hint, { color: P.danger }]}>
                  {t('kayit.signup.email_invalid')}
                </AppText>
              ) : null}
              {sendErr ? <NoticeCard tone="error" title={t('kayit.signup.error_title')} sub={sendErr} /> : null}
            </View>
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
            {review.active ? (
              <KButton testID="kayit-review-login" label={t('kayit.signup.review_login')} onPress={() => void reviewLogin()} disabled={!review.password} loading={review.busy} />
            ) : (
              <KButton testID="kayit-send-code" label={t('kayit.signup.send_code')} onPress={() => void send()} disabled={!valid} loading={sending} />
            )}
          </View>
        </View>
        </PushIn>
      </View>
    );
  }

  const expired = err === 'expired';
  return (
    <View style={{ flex: 1 }} {...edge} testID="kayit-e2">
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <KBackdrop shift={24} />
      <PushIn k={step} dir={1}>
      <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <TopBar onBack={back} />
        <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={{ marginTop: 12 }}>
            <QuestionHead title={t('kayit.signup.code_title')} layout="right" fade={false} />
          </View>
          <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 16 }}>
            {err === 'wrong' ? <NoticeCard testID="kayit-code-wrong" tone="error" title={t('kayit.signup.code_wrong_title')} sub={t('kayit.signup.code_wrong_sub')} /> : null}
            {expired ? <NoticeCard testID="kayit-code-expired" title={t('kayit.signup.code_expired_title')} sub={t('kayit.signup.code_expired_sub')} /> : null}
            <AppText maxFontSizeMultiplier={1.4} style={[styles.hint, { color: P.sec }]}>
              {t('kayit.signup.code_sub')}
            </AppText>
            <Pressable onPress={() => inputRef.current?.focus()} accessibilityRole="button" accessibilityLabel={t('kayit.signup.code_label')} accessibilityValue={{ text: `${code.length}/${CODE_LENGTH}` }} accessibilityHint={t('kayit.signup.code_sub')} style={styles.codeRow} disabled={expired || verifying}>
              {Array.from({ length: CODE_LENGTH }).map((_, i) => {
                const active = !expired && i === Math.min(code.length, CODE_LENGTH - 1);
                return (
                  <View
                    key={i}
                    style={[
                      styles.codeBox,
                      {
                        backgroundColor: expired ? P.disabled : P.field,
                        borderColor: err === 'wrong' ? P.danger : active ? P.ink : P.cardEdge,
                        borderWidth: err === 'wrong' || active ? 1.5 : 1,
                        opacity: verifying ? 0.6 : 1,
                      },
                    ]}
                  >
                    <AppText maxFontSizeMultiplier={1.2} style={[styles.codeDigit, { color: P.ink }]}>
                      {code[i] ?? ''}
                    </AppText>
                  </View>
                );
              })}
              <TextInput
                ref={inputRef}
                testID="kayit-code-input"
                value={code}
                onChangeText={(v) => void verify(v)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoFocus={!expired}
                editable={!expired && !verifying}
                maxLength={CODE_LENGTH}
                caretHidden
                style={styles.codeHidden}
              />
            </Pressable>
            {expired ? (
              <Pressable testID="kayit-code-new" onPress={() => void send()} accessibilityRole="button" style={styles.link}>
                <AppText maxFontSizeMultiplier={1.4} style={[styles.linkText, { color: P.ink }]}>
                  {t('kayit.signup.code_new')}
                </AppText>
              </Pressable>
            ) : (
              <Pressable
                testID="kayit-code-resend"
                onPress={() => countdown === 0 && void send()}
                disabled={countdown > 0}
                accessibilityRole="button"
                accessibilityState={{ disabled: countdown > 0 }}
                accessibilityLabel={countdown > 0 ? t('kayit.signup.resend', { time: formatCountdown(countdown) }) : t('kayit.signup.resend_now')}
                style={styles.link}
              >
                <AppText maxFontSizeMultiplier={1.4} style={[styles.linkText, { color: countdown > 0 ? P.sec : P.ink, textDecorationLine: countdown > 0 ? 'none' : 'underline' }]}>
                  {countdown > 0 ? t('kayit.signup.resend', { time: formatCountdown(countdown) }) : t('kayit.signup.resend_now')}
                </AppText>
              </Pressable>
            )}
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          <KButton testID="kayit-verify" label={verifying ? t('kayit.signup.verifying') : t('kayit.signup.verify')} onPress={() => void verify(code)} disabled={code.length < CODE_LENGTH || expired} loading={verifying} />
        </View>
      </View>
      </PushIn>
    </View>
  );
}

const styles = StyleSheet.create({
  social: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  socialText: { fontFamily: FONT.semi, fontSize: 17 },
  legal: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 4 },
  legalLink: { fontFamily: FONT.bold, textDecorationLine: 'underline' },
  optional: { fontFamily: FONT.semi, fontSize: 15, marginTop: 10 },
  fieldLabel: { fontFamily: FONT.semi, fontSize: 14 },
  field: { minHeight: 56, borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, fontFamily: FONT.body, fontSize: 17 },
  hint: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  codeBox: { flex: 1, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  codeDigit: { fontFamily: FONT.display, fontSize: 26 },
  codeHidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontFamily: FONT.semi, fontSize: 15 },
});
