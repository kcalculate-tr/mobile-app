// Onboarding akışı (G12-S1 · FinOnb*, G15-S1 Final eşleşmesi). Yalnız `yeni_onboarding`
// açık + oturumsuz soğuk açılışta AppNavigator bu iç yığını `Onboarding` rotasına
// kurar. Kapalıyken HİÇ kaydolmaz → WelcomeGate bugünküyle aynı.
//
// G18-S1 (Tur 26): FinOpen (yalnız ilk açılış, Karşılama'nın üstünde) → Karşılama →
// Hesap → Ana sayfa (HER hesapta). Bildirim izni onboarding'de YOK: ilk öğün
// kaydından SONRA bir kez (HomeCelebrations → FinSheetNotify). Hedef kurulumu Ana
// sayfadaki "Profilini oluşturalım" kartından (HomeOnboardingSlot) açılır. OnbNotify
// rotası kayıtlı kalır (vitrin/özellik kaybı yok) ama akıştan hiçbir düğme gitmez.
//
// Önceki akış (Final): Karşılama → Hesap → Bildirim → Takibe başla. G17-S1 md.4: "Seni
// buraya ne getirdi?" (Niyet) adımı akıştan çıktı — bileşen ve rota kayıtlı
// kalır ama hiçbir düğme oraya gitmez; mevcut müşteri sipariş geçmişinden
// sessizce tanınır (IntroOverlay). Dönen kullanıcı → Ana sayfa (yeni kabukta Tracker). Hesap mevcut auth fonksiyonlarını (AuthContext +
// postSocialAuth) ÇAĞIRIR, auth dosyalarına dokunmaz. Yeni kullanıcı → Bildirim →
// Takibe başla; dönen kullanıcı → Tabs. 18 yaş engeli (FinOnbUnderage) Takibe
// başla'nın yaş adımından gelir; burada paylaşılan ekran olarak da kayıtlıdır.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../../core/design/components/AppText';
import { BrandLogo } from '../../core/design/components/BrandLogo';
import { DURATION } from '../../core/design/motion';
import { useT } from '../../core/i18n';
import { useAuth } from '../../core/AuthContext';
import { useFeature } from '../../core/flags';
import { postAuthShellTab } from '../shell/tabs';
import { resolvePostSocialAuth } from '../../lib/postSocialAuth';
import type { RootStackParamList } from '../../navigation/types';
import { CameraIcon, Plus, ShoppingBag } from '../../components/icons';
import { OnbScaffold } from './components/OnbScaffold';
import { AuthButton, OnbButton, OnbLead, OnbTitle, OptionRow } from './components/pieces';
import { UnderageView } from './components/UnderageView';
import { useOnb } from './components/onbTheme';
import { OpenSignature } from './first/OpenSignature';
import { AccountEmailSheet } from './first/AccountEmailSheet';
import { MetaConsentRow, PolicyAcceptRow } from './consent/ConsentBlock';
import { acceptPolicies, holdGate } from '../../lib/consent/store';
import { welcomeVariant } from './first/state';
import { writeIntroSeen } from './intro/storage';
import { track } from '../../lib/analytics';
import NetInfo from '@react-native-community/netinfo';
import { AuthAlert } from './components/AuthAlert';
import { classifySocialAuthError, shouldShowAuthAlert } from './socialAuthError';

export type OnbIntent = 'track' | 'order' | 'both';

export type OnbParamList = {
  /** `vitrinOpen`: YALNIZ vitrin — FinOpen'ı bayrağa bakmadan oynat / kareyi dondur. */
  OnbWelcome: { vitrinOpen?: boolean; vitrinOpenAt?: number } | undefined;
  OnbIntent: undefined;
  OnbNotify: { intent: Exclude<OnbIntent, 'order'> };
  /** `vitrinSheet`: YALNIZ vitrin — e-posta sheet'i açık (FinOnbAccountEmail/Keyboard). */
  OnbAccount: {
    intent: Exclude<OnbIntent, 'order'>;
    vitrinSheet?: 'email' | 'keyboard';
    /** YALNIZ vitrin — FinOnbAccountError satır içi uyarısı açık (G22-S2 md.5). */
    vitrinAuthError?: { kind: 'network' | 'account'; provider: 'apple' | 'google' };
  };
  OnbUnderage: undefined;
};

const Stack = createNativeStackNavigator<OnbParamList>();

function useRootNav(
  navigation: NativeStackNavigationProp<OnbParamList, keyof OnbParamList>,
) {
  return navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
}

// Final cam nesne konumları (393 tasarım koordinatı).
const GLASS = {
  bowl: { source: require('../../../assets/glass/bowl.png'), x: 69, y: 170, w: 255, h: 190 },
  foot: { source: require('../../../assets/glass/foot.png'), x: 230, y: 118, w: 72, h: 120 },
  drop: { source: require('../../../assets/glass/drop.png'), x: 148, y: 120, w: 96, h: 130 },
  flame: { source: require('../../../assets/glass/flame.png'), x: 127, y: 140, w: 138, h: 170 },
  // G21-S1 md.1 (Tur 26f): FinOnbAccount damla → kase (damla yuvasında, kase oranı);
  // FinOnbNotify alev → kupa (alev yuvasının merkezinde, kupa oranı).
  bowlAccount: { source: require('../../../assets/glass/bowl.png'), x: 126, y: 133, w: 140, h: 104 },
  trophyNotify: { source: require('../../../assets/glass/trophy.png'), x: 121, y: 160, w: 151, h: 130 },
};

// ── Karşılama ─────────────────────────────────────────────────────────────────
function WelcomeScreen({ navigation, route }: NativeStackScreenProps<OnbParamList, 'OnbWelcome'>) {
  const i18n = useT();
  const P = useOnb();
  const root = useRootNav(navigation);
  // G18-S1 md.2: başlık varyantı uzaktan (`onb_welcome_variant_b/_c`), varsayılan A.
  const variant = welcomeVariant({ b: useFeature('onb_welcome_variant_b'), c: useFeature('onb_welcome_variant_c') });
  const headlineKey = variant === 'a' ? 'headline' : `headline_${variant}`;
  const vOpen = __DEV__ && route.params?.vitrinOpen === true;
  // G18-S5 (uçtan uca akışta bulundu): "Kcalculate'e yeni şeyler geldi" tanıtımı YALNIZ
  // yükseltme kullanıcısı içindir; Karşılama'yı gören kurulum yeni deneyimle başladı →
  // tanıtım görülmüş sayılır (yükseltme kullanıcısı Karşılama'yı hiç görmez, değişmez).
  useEffect(() => {
    void writeIntroSeen();
  }, []);
  return (
    <View style={{ flex: 1 }}>
    <OnbScaffold
      glass={GLASS.bowl}
      cardTop={430}
      cardPad={[28, 20, 20]}
      dots={{ count: 2, index: 0 }}
      footer={
        <View style={{ gap: 8 }}>
          <OnbButton kind="lime" label={i18n.t('onboarding.welcome.start')} onPress={() => navigation.navigate('OnbAccount', { intent: 'track' })} />
          <OnbButton kind="chip" label={i18n.t('onboarding.welcome.haveAccount')} onPress={() => root?.navigate('Login')} />
        </View>
      }
    >
      <BrandLogo name="kcal" height={20} color={P.ink} style={styles.brand} />
      <AppText style={[styles.headline, { color: P.ink }]}>{i18n.t(`onboarding.welcome.${headlineKey}`)}</AppText>
      <OnbLead style={{ marginTop: 10, fontSize: 15, lineHeight: 21 }}>{i18n.t('onboarding.welcome.sub')}</OnbLead>
    </OnbScaffold>
    {/* G18-S1 md.1 — FinOpen: yalnız ilk açılış; Karşılama'ya erir. */}
    <OpenSignature forcePlay={vOpen} frozenAt={__DEV__ ? route.params?.vitrinOpenAt : undefined} />
    </View>
  );
}

// ── Niyet ─────────────────────────────────────────────────────────────────────
function IntentScreen({ navigation }: NativeStackScreenProps<OnbParamList, 'OnbIntent'>) {
  const i18n = useT();
  const P = useOnb();
  const root = useRootNav(navigation);
  // Final: "Takip etmek" önceden seçili; "Devam et" ile ilerler.
  const [sel, setSel] = useState<OnbIntent>('track');

  const go = () => {
    if (sel === 'order') {
      root?.navigate('Tabs', { screen: 'Home' });
      return;
    }
    navigation.navigate('OnbAccount', { intent: sel });
  };

  return (
    <OnbScaffold
      glass={GLASS.foot}
      cardTop={213}
      onBack={() => navigation.goBack()}
      dots={{ count: 4, index: 1 }}
      topRight={{ label: i18n.t('onboarding.intent.skip'), onPress: () => root?.navigate('Tabs', { screen: 'Home' }) }}
      footer={<OnbButton label={i18n.t('tb.continue')} onPress={go} />}
    >
      <OnbTitle>{i18n.t('onboarding.intent.title')}</OnbTitle>
      <OnbLead style={{ marginBottom: 16 }}>{i18n.t('onboarding.intent.sub')}</OnbLead>
      <View style={{ gap: 10 }}>
        <OptionRow
          title={i18n.t('onboarding.intent.track')}
          desc={i18n.t('onboarding.intent.track_desc')}
          selected={sel === 'track'}
          icon={(c) => <CameraIcon size={22} color={c} />}
          onPress={() => setSel('track')}
        />
        <OptionRow
          title={i18n.t('onboarding.intent.order')}
          desc={i18n.t('onboarding.intent.order_desc')}
          selected={sel === 'order'}
          icon={(c) => <ShoppingBag size={22} color={c} />}
          onPress={() => setSel('order')}
        />
        <OptionRow
          title={i18n.t('onboarding.intent.both')}
          desc={i18n.t('onboarding.intent.both_desc')}
          selected={sel === 'both'}
          icon={(c) => <Plus size={22} color={c} />}
          onPress={() => setSel('both')}
        />
      </View>
      <AppText textRole="helper" style={{ color: P.sec, marginTop: 16 }}>
        {i18n.t('onboarding.intent.note')}
      </AppText>
    </OnbScaffold>
  );
}

// ── Hesap ──────────────────────────────────────────────────────────────────────
function AccountScreen({ navigation, route }: NativeStackScreenProps<OnbParamList, 'OnbAccount'>) {
  const i18n = useT();
  const P = useOnb();
  const root = useRootNav(navigation);
  const { signInWithApple, signInWithGoogle } = useAuth();
  const yeniKabuk = useFeature('yeni_kabuk');
  const [busy, setBusy] = useState(false);
  // G18-S1 md.3: "E-posta ile devam et" → kaydırılabilir sheet (eski Login ekranı yerine).
  const vSheet = __DEV__ ? route.params?.vitrinSheet : undefined;
  const [emailOpen, setEmailOpen] = useState(vSheet != null);
  const homeAfterClose = useRef(false);
  // G27-S1 (İlter 11 Kas): reklam ölçümü (Meta) KAPALI gelir — yalnız kullanıcı açıkça
  // açarsa (KVKK açık rıza). G41-S1 md.2: düğmelerin altında İŞARETSİZ isteğe bağlı kutu
  // (MetaConsentRow; iOS'ta işaretlenince ATT). E-posta sheet'indeki blok aynı durumu değiştirir.
  const [adOn, setAdOn] = useState(false);
  // G20-S3 md.2b (İlter kararı): Apple/Google/e-posta — ZORUNLU onay kutusu
  // (Koşullar + Gizlilik + 18+ beyanı); işaretlenmeden düğmeler pasif. E-posta
  // sheet'i ve ayrıntı sheet'i AYNI durumu gösterir/değiştirir.
  const [accepted, setAccepted] = useState(false);
  // G22-S2 md.5 (FinOnbAccountError): ağ / hesap hatası → Apple–Google altında satır
  // içi uyarı + "Tekrar dene" (aynı sağlayıcı). İptal SESSİZ → uyarı yok.
  const [authFail, setAuthFail] = useState<{ kind: 'network' | 'account'; provider: 'apple' | 'google' } | null>(
    __DEV__ ? route.params?.vitrinAuthError ?? null : null,
  );
  const goHome = () => root?.navigate('Tabs', { screen: postAuthShellTab(yeniKabuk) });

  const afterAuth = async (result: {
    error: string | null;
    cancelled?: boolean;
    email?: string;
    givenName?: string;
    familyName?: string;
  }): Promise<string | null> => {
    if (result.cancelled || result.error) return null;
    const post = await resolvePostSocialAuth({
      email: result.email,
      givenName: result.givenName,
      familyName: result.familyName,
    });
    // G22-S2 md.5: oturum sonrası profil çözümü başarısız → çağıran uyarı gösterir.
    if (post.outcome === 'error') return post.error ?? 'post_social_auth_failed';
    // G18-S1 md.4: yeni ya da dönen HER hesap → Ana sayfa (Niyet/Bildirim adımı yok;
    // hedef kurulumu Ana sayfa profil kartından, bildirim izni ilk kayıttan sonra).
    goHome();
    return null;
  };

  // Hata sonucunu sınıfla → uyarı (ağ/hesap) ya da sessiz (iptal). NetInfo yalnız
  // hata dalında okunur: çevrimdışıysa her hata "Bağlanamadık" sayılır.
  const showFailure = async (
    provider: 'apple' | 'google',
    outcome: { cancelled?: boolean; error?: string | null; errorCode?: string },
  ) => {
    const net = await NetInfo.fetch().catch(() => null);
    const kind = classifySocialAuthError({ ...outcome, online: net ? net.isConnected !== false : null });
    if (shouldShowAuthAlert(kind)) setAuthFail({ kind, provider });
  };

  const run = async (provider: 'apple' | 'google') => {
    if (busy || !accepted) return;
    setBusy(true);
    // Oturum, kabul kaydı yazılmadan açılabilir → kapı bu sırada "mevcut kullanıcı"
    // sheet'i / ATT göstermesin.
    const release = holdGate();
    setAuthFail(null);
    try {
      const result = await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
      if (result.cancelled || result.error) {
        await showFailure(provider, result);
        return;
      }
      // Onay kutusu (Koşullar + Gizlilik + 18+) + reklam ölçümü tercihi.
      await acceptPolicies({ source: 'signup_social', adOn, ageOk: true });
      const postError = await afterAuth(result);
      if (postError) await showFailure(provider, { error: postError });
    } catch (e) {
      await showFailure(provider, { error: e instanceof Error ? e.message : 'social_auth_failed' });
    } finally {
      release();
      setBusy(false);
    }
  };

  return (
    <OnbScaffold
      glass={GLASS.bowlAccount}
      cardTop={262}
      onBack={() => navigation.goBack()}
      dots={{ count: 2, index: 1 }}
      footer={
        <View>
          <View style={{ gap: 10 }}>
            <AuthButton kind="apple" label={i18n.t('onboarding.account.apple')} disabled={busy || !accepted} onPress={() => run('apple')} />
            <AuthButton kind="google" label={i18n.t('onboarding.account.google')} disabled={busy || !accepted} onPress={() => run('google')} />
            {authFail ? (
              <AuthAlert kind={authFail.kind} provider={authFail.provider} busy={busy} onRetry={() => void run(authFail.provider)} />
            ) : null}
            <AuthButton kind="email" label={i18n.t('onboarding.account.email')} disabled={busy || !accepted} onPress={() => setEmailOpen(true)} />
          </View>
          {/* G20-S3 md.2b: "Devam ederek … kabul edersin" satırı yerine zorunlu kutu (aynı yer, aynı helper dili). */}
          <View style={styles.legalBox}>
            <PolicyAcceptRow accepted={accepted} onAcceptedChange={setAccepted} withAge testID="onb-account-consent" />
          </View>
          {/* G41-S1 md.2: isteğe bağlı Meta kutusu (işaretsiz). Eski "Reklam ölçümü kapalı · Ayrıntılar" satırı kalktı. */}
          <View style={styles.legalAds}>
            <MetaConsentRow value={adOn} onChange={setAdOn} testID="onb-account-meta" />
          </View>
        </View>
      }
    >
      <OnbTitle>{i18n.t('onboarding.account.title')}</OnbTitle>
      <OnbLead>{i18n.t('onboarding.account.sub')}</OnbLead>
      <AccountEmailSheet
        adOn={adOn}
        onAdChange={setAdOn}
        accepted={accepted}
        onAcceptedChange={setAccepted}
        visible={emailOpen}
        onClose={() => setEmailOpen(false)}
        onVerified={() => {
          // G18-S5 düzeltme (uçtan uca akışta bulundu): önce sheet kapanır, Modal kalkınca
          // Ana sayfaya geçilir. Aynı anda gezinince Hesap ekranı donduruluyor, kapanış geri
          // çağrısı işlenmiyor ve şeffaf Modal bütün dokunuşları yutuyordu.
          homeAfterClose.current = true;
          setEmailOpen(false);
        }}
        onClosed={() => {
          if (!homeAfterClose.current) return;
          homeAfterClose.current = false;
          goHome();
        }}
        vitrinFocus={vSheet === 'keyboard'}
      />
    </OnbScaffold>
  );
}

// ── Bildirim izni (ön ekran) ────────────────────────────────────────────────
function NotifyScreen({ navigation }: NativeStackScreenProps<OnbParamList, 'OnbNotify'>) {
  const i18n = useT();
  const root = useRootNav(navigation);
  // Final: Bildirim → Takibe başla (yeni kullanıcı hesabı az önce oluştu).
  const next = () => root?.navigate('TakibeBasla');

  // G26-S1 (İlter 11 Kas): onboarding'de SİSTEM PENCERESİ YOK — bu ön ekran (akışta
  // erişilmiyor) izin istemez; bildirim izni ilk öğün sonrası tek açıklama ekranında.
  const allow = () => next();

  return (
    <OnbScaffold
      glass={GLASS.trophyNotify}
      cardTop={400}
      onBack={() => navigation.goBack()}
      dots={{ count: 3, index: 2 }}
      footer={
        <View style={styles.row}>
          <OnbButton kind="chip" style={styles.half} label={i18n.t('onboarding.notify.later')} onPress={next} />
          <OnbButton kind="chip" style={styles.half} label={i18n.t('onboarding.notify.allow')} onPress={allow} />
        </View>
      }
    >
      <OnbTitle style={{ fontSize: 28, lineHeight: 30 }}>{i18n.t('onboarding.notify.title')}</OnbTitle>
      <OnbLead>{i18n.t('onboarding.notify.sub')}</OnbLead>
    </OnbScaffold>
  );
}

// ── 18 yaş engeli ─────────────────────────────────────────────────────────────
function UnderageScreen({ navigation }: NativeStackScreenProps<OnbParamList, 'OnbUnderage'>) {
  const root = useRootNav(navigation);
  return (
    <UnderageView
      onFix={() => navigation.goBack()}
      onOk={() => root?.navigate('Tabs', { screen: 'Home' })}
    />
  );
}

const ONB_STEPS: string[] = ['OnbWelcome', 'OnbIntent', 'OnbAccount', 'OnbNotify', 'OnbUnderage'];

export default function OnboardingNavigator() {
  const P = useOnb();
  return (
    <Stack.Navigator
      // G19-S3: onb_step — her adım odaklandığında (geri dönüş dahil) bir kez.
      screenListeners={({ route }) => ({
        focus: () => track('onb_step', { flow: 'first', step: route.name, index: ONB_STEPS.indexOf(route.name) }),
      })}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: DURATION.base,
        contentStyle: { backgroundColor: P.bg },
      }}
    >
      <Stack.Screen name="OnbWelcome" component={WelcomeScreen} />
      <Stack.Screen name="OnbIntent" component={IntentScreen} />
      <Stack.Screen name="OnbAccount" component={AccountScreen} />
      <Stack.Screen name="OnbNotify" component={NotifyScreen} />
      <Stack.Screen
        name="OnbUnderage"
        component={UnderageScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  // FinOnbWelcome: kart içi dikey 14 boşluk; "kcal." 700/18; başlık 700/40, satır 1.08.
  brand: { marginBottom: 14 },
  headline: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 40, lineHeight: 43 },
  legalBox: { marginTop: 14 },
  legalAds: { marginTop: 4 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, paddingHorizontal: 8 },
});
