// G42-S1 md.5 — K1 kayıt (A: "Planını kaydedelim" · B: "Hemen başlayalım") + E1/E2 e-posta kodu.
// MEVCUT kimlik doğrulama (useAuth: Apple, Google, e-posta OTP; inceleme adresi için şifre girişi korunur).
// G43-S1: Apple = expo-apple-authentication `AppleAuthenticationButton` (native, yalnız iOS; açıkta siyah, koyuda
// beyaz), Google = resmî beyaz stil, e-posta ikincil (kenarlı); Koşullar · Gizlilik ayrı 44 pt bağlantı satırı;
// OTP kutuları uygulamanın standart giriş alanı stilinde. İki İSTEĞE BAĞLI işaretsiz kutu:
// Meta onayı (G41 requestMetaOptIn; iOS'ta işaretlenince ATT, reddedilirse kutu boşalır + K1d notu) ve
// pazarlama e-postası onayı (notification_preferences.marketing_enabled). B yolunda doğum yılı sorulmadığı
// için mevcut 18+ beyan kutusu (LoginV2 kuralı) zorunlu ve işaretsiz gelir.
// Durumlar: yükleniyor (basılan düğmede halka, diğerleri %50) · ağ yok (hata kartı + Yeniden dene) ·
// iptal (nötr kart, 6 sn sonra kalkar). E2: 6 kutu (yapıştırma, otomatik ilerleme, 6. hanede doğrular),
// yeniden gönderme sayacı = mevcut 60 sn; yanlış kod → ince hata çizgisi + kart + hata titreşimi; süresi
// doldu → kutular boşalır, "Yeni kod gönder".
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
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
import { GoogleLogo } from '../../onboarding/components/pieces';
import { CODE_LENGTH, RESEND_SECONDS, formatCountdown, interpretSocialResult, isValidEmail, sanitizeCode } from '../../onboarding/v2/loginLogic';
import { CheckBoxRow, FONT, KButton, KFooter, KTitle, NoticeCard, TopBar } from '../ui/parts';
import { useEdgeBack } from '../ui/edge';
import { K_MOTION, useK } from '../ui/theme';
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
  const openTerms = () => void openLegalWeb('terms', lang, () => navigation.navigate('ProfileContracts', { slug: LEGAL_SLUG.terms }));
  const openPrivacy = () => void openLegalWeb('privacy', lang, () => navigation.navigate('ProfileContracts', { slug: LEGAL_SLUG.privacy }));
  return (
    <View style={{ flex: 1, backgroundColor: P.bg }} {...edge} testID={`kayit-signup-${path}`}>
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1, paddingTop: insets.top + 4 }}>
        <TopBar onBack={back} />
        <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }} showsVerticalScrollIndicator={false}>
          <KTitle title={path === 'a' ? t('kayit.signup.title_a') : t('kayit.signup.title_b')} style={{ marginTop: 12 }} />
          <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 12 }}>
            {notice === 'offline' ? <NoticeCard testID="kayit-signup-offline" tone="error" title={t('kayit.signup.offline_title')} sub={t('kayit.signup.offline_sub')} action={{ label: t('kayit.signup.retry'), onPress: () => setNotice(null) }} /> : null}
            {notice === 'cancelled' ? <NoticeCard testID="kayit-signup-cancelled" title={t('kayit.signup.cancelled_title')} sub={t('kayit.signup.cancelled_sub')} /> : null}
            {notice === 'error' ? <NoticeCard tone="error" title={t('kayit.signup.error_title')} sub={errMsg} /> : null}
            <AppleButton dark={P.isDark} label={t('kayit.signup.apple')} busy={busy === 'apple'} disabled={(!!busy && busy !== 'apple') || blocked} onPress={() => void runSocial('apple')} />
            <GoogleButton testID="kayit-google" label={t('kayit.signup.google')} busy={busy === 'google'} disabled={(!!busy && busy !== 'google') || blocked} onPress={() => void runSocial('google')} />
            <Pressable
              testID="kayit-email"
              onPress={openEmail}
              disabled={!!busy || blocked}
              accessibilityRole="button"
              accessibilityLabel={t('kayit.signup.email')}
              accessibilityState={{ disabled: !!busy || blocked }}
              style={({ pressed }) => [styles.social, { backgroundColor: 'transparent', borderColor: P.line2, borderWidth: 1, opacity: busy || blocked ? 0.5 : pressed ? 0.7 : 1 }]}
            >
              <AppText maxFontSizeMultiplier={1.3} style={[styles.socialText, { color: P.ink }]}>
                {t('kayit.signup.email')}
              </AppText>
            </Pressable>
            <AppText maxFontSizeMultiplier={1.4} style={[styles.legal, { color: P.sec }]}>
              {t('kayit.signup.legal_1')}
              <AppText accessibilityRole="link" onPress={openTerms} style={[styles.legalLink, { color: P.ink }]}>
                {t('kayit.signup.terms')}
              </AppText>
              {t('kayit.signup.legal_2')}
              <AppText accessibilityRole="link" onPress={openPrivacy} style={[styles.legalLink, { color: P.ink }]}>
                {t('kayit.signup.privacy')}
              </AppText>
              {t('kayit.signup.legal_3')}
            </AppText>
            <View style={styles.legalRow}>
              <Pressable testID="kayit-terms" onPress={openTerms} accessibilityRole="link" accessibilityLabel={t('kayit.signup.terms')} style={styles.legalBtn}>
                <AppText maxFontSizeMultiplier={1.4} style={[styles.legalBtnText, { color: P.ink }]}>
                  {t('kayit.signup.terms')}
                </AppText>
              </Pressable>
              <AppText importantForAccessibility="no" accessibilityElementsHidden style={[styles.legalBtnText, { color: P.sec }]}>
                ·
              </AppText>
              <Pressable testID="kayit-privacy" onPress={openPrivacy} accessibilityRole="link" accessibilityLabel={t('kayit.signup.privacy')} style={styles.legalBtn}>
                <AppText maxFontSizeMultiplier={1.4} style={[styles.legalBtnText, { color: P.ink }]}>
                  {t('kayit.signup.privacy')}
                </AppText>
              </Pressable>
            </View>
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
}

/**
 * Apple ile giriş: YALNIZ iOS'ta native `AppleAuthenticationButton` (App Store 4.8 / HIG; açık temada siyah,
 * koyuda beyaz). Android'de hiç çizilmez. Yükleniyor/devre dışı: native düğme dokunmaya kapanır; yüklenirken
 * aynı ölçüde halka gösterilir.
 */
export function AppleButton({ dark, label, busy, disabled, onPress }: { dark: boolean; label: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  if (Platform.OS !== 'ios') return null;
  if (busy) {
    return (
      <View testID="kayit-apple" accessible accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: true, disabled: true }} style={[styles.social, { backgroundColor: dark ? '#FFFFFF' : '#000000' }]}>
        <ActivityIndicator color={dark ? '#000000' : '#FFFFFF'} />
      </View>
    );
  }
  return (
    <View testID="kayit-apple" pointerEvents={disabled ? 'none' : 'auto'} accessibilityState={{ disabled }} style={{ opacity: disabled ? 0.5 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        testID="kayit-apple-native"
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={27}
        onPress={onPress}
        style={styles.apple}
      />
    </View>
  );
}

/** Google ile giriş — resmî beyaz stil (beyaz zemin, #747775 kenar, #1F1F1F yazı, renkli "G"). */
function GoogleButton({ label, busy, disabled, onPress, testID }: { label: string; busy: boolean; disabled: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [styles.social, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#747775', opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      <View style={{ width: 24, alignItems: 'center' }}>{busy ? <ActivityIndicator color="#1F1F1F" /> : <GoogleLogo />}</View>
      <AppText maxFontSizeMultiplier={1.3} style={[styles.socialText, { color: '#1F1F1F' }]}>
        {label}
      </AppText>
    </Pressable>
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
      <View style={{ flex: 1, backgroundColor: P.bg }} {...edge} testID="kayit-e1">
        <StatusBar style={P.isDark ? 'light' : 'dark'} />
        <View style={{ flex: 1, paddingTop: insets.top + 4 }}>
          <TopBar onBack={back} />
          <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: 24 }}>
            <KTitle title={t('kayit.signup.email_title')} style={{ marginTop: 12 }} />
            <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 10 }}>
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
                style={[styles.field, { backgroundColor: P.surface, borderColor: P.line, color: P.ink }]}
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
                  style={[styles.field, { backgroundColor: P.surface, borderColor: P.line, color: P.ink }]}
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
          <KFooter bottom={insets.bottom}>
            {review.active ? (
              <KButton testID="kayit-review-login" label={t('kayit.signup.review_login')} onPress={() => void reviewLogin()} disabled={!review.password} loading={review.busy} />
            ) : (
              <KButton testID="kayit-send-code" label={t('kayit.signup.send_code')} onPress={() => void send()} disabled={!valid} loading={sending} />
            )}
          </KFooter>
        </View>
      </View>
    );
  }

  const expired = err === 'expired';
  return (
    <View style={{ flex: 1, backgroundColor: P.bg }} {...edge} testID="kayit-e2">
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1, paddingTop: insets.top + 4 }}>
        <TopBar onBack={back} />
        <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: 24 }}>
          <KTitle title={t('kayit.signup.code_title')} sub={t('kayit.signup.code_sub')} style={{ marginTop: 12 }} />
          <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 16 }}>
            {err === 'wrong' ? <NoticeCard testID="kayit-code-wrong" tone="error" title={t('kayit.signup.code_wrong_title')} sub={t('kayit.signup.code_wrong_sub')} /> : null}
            {expired ? <NoticeCard testID="kayit-code-expired" title={t('kayit.signup.code_expired_title')} sub={t('kayit.signup.code_expired_sub')} /> : null}
            <Pressable onPress={() => inputRef.current?.focus()} accessibilityRole="button" accessibilityLabel={t('kayit.signup.code_label')} accessibilityValue={{ text: `${code.length}/${CODE_LENGTH}` }} accessibilityHint={t('kayit.signup.code_sub')} style={styles.codeRow} disabled={expired || verifying}>
              {Array.from({ length: CODE_LENGTH }).map((_, i) => {
                const active = !expired && i === Math.min(code.length, CODE_LENGTH - 1);
                return (
                  <View
                    key={i}
                    style={[
                      styles.codeBox,
                      {
                        backgroundColor: expired ? P.disabled : P.surface,
                        borderColor: err === 'wrong' ? P.danger : active ? P.ink : P.line,
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
        <KFooter bottom={insets.bottom}>
          <KButton testID="kayit-verify" label={verifying ? t('kayit.signup.verifying') : t('kayit.signup.verify')} onPress={() => void verify(code)} disabled={code.length < CODE_LENGTH || expired} loading={verifying} />
        </KFooter>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  social: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  apple: { height: 54, width: '100%' },
  socialText: { fontFamily: FONT.semi, fontSize: 17 },
  legal: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 4 },
  legalLink: { fontFamily: FONT.semi, textDecorationLine: 'underline' },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginTop: -6 },
  legalBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  legalBtnText: { fontFamily: FONT.semi, fontSize: 14 },
  optional: { fontFamily: FONT.semi, fontSize: 13, marginTop: 10 },
  fieldLabel: { fontFamily: FONT.semi, fontSize: 13 },
  field: { minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, fontFamily: FONT.medium, fontSize: 16 },
  hint: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  codeBox: { flex: 1, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  codeDigit: { fontFamily: FONT.display, fontSize: 24 },
  codeHidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontFamily: FONT.semi, fontSize: 15 },
});
