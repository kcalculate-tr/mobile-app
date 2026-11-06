// Onboarding akışı (G12-S1 · FinOnb*, G15-S1 Final eşleşmesi). Yalnız `yeni_onboarding`
// açık + oturumsuz soğuk açılışta AppNavigator bu iç yığını `Onboarding` rotasına
// kurar. Kapalıyken HİÇ kaydolmaz → WelcomeGate bugünküyle aynı.
//
// Akış (Final): Karşılama → Niyet → (Sipariş: eatkcal'e) / (Takip·İkisi: Hesap →
// Bildirim → Takibe başla). Hesap mevcut auth fonksiyonlarını (AuthContext +
// postSocialAuth) ÇAĞIRIR, auth dosyalarına dokunmaz. Yeni kullanıcı → Bildirim →
// Takibe başla; dönen kullanıcı → Tabs. 18 yaş engeli (FinOnbUnderage) Takibe
// başla'nın yaş adımından gelir; burada paylaşılan ekran olarak da kayıtlıdır.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../../core/design/components/AppText';
import { DURATION } from '../../core/design/motion';
import { useT } from '../../core/i18n';
import { useAuth } from '../../core/AuthContext';
import { resolvePostSocialAuth } from '../../lib/postSocialAuth';
import { registerForPushNotifications } from '../../core/notifications';
import type { RootStackParamList } from '../../navigation/types';
import { CameraIcon, Plus, ShoppingBag } from '../../components/icons';
import { OnbScaffold } from './components/OnbScaffold';
import { AuthButton, OnbButton, OnbLead, OnbTitle, OptionRow } from './components/pieces';
import { UnderageView } from './components/UnderageView';
import { useOnb } from './components/onbTheme';

export type OnbIntent = 'track' | 'order' | 'both';

export type OnbParamList = {
  OnbWelcome: undefined;
  OnbIntent: undefined;
  OnbNotify: { intent: Exclude<OnbIntent, 'order'> };
  OnbAccount: { intent: Exclude<OnbIntent, 'order'> };
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
};

// ── Karşılama ─────────────────────────────────────────────────────────────────
function WelcomeScreen({ navigation }: NativeStackScreenProps<OnbParamList, 'OnbWelcome'>) {
  const i18n = useT();
  const P = useOnb();
  const root = useRootNav(navigation);
  return (
    <OnbScaffold
      glass={GLASS.bowl}
      cardTop={430}
      dots={{ count: 4, index: 0 }}
      footer={
        <View style={{ gap: 8 }}>
          <OnbButton kind="lime" label={i18n.t('onboarding.welcome.start')} onPress={() => navigation.navigate('OnbIntent')} />
          <OnbButton kind="chip" label={i18n.t('onboarding.welcome.haveAccount')} onPress={() => root?.navigate('Login')} />
        </View>
      }
    >
      <AppText style={[styles.brand, { color: P.ink }]}>{i18n.t('onboarding.welcome.brand')}</AppText>
      <AppText style={[styles.headline, { color: P.ink }]}>{i18n.t('onboarding.welcome.headline')}</AppText>
      <OnbLead style={{ marginTop: 12 }}>{i18n.t('onboarding.welcome.sub')}</OnbLead>
    </OnbScaffold>
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
  const [busy, setBusy] = useState(false);

  const afterAuth = async (result: {
    error: string | null;
    cancelled?: boolean;
    email?: string;
    givenName?: string;
    familyName?: string;
  }) => {
    if (result.cancelled || result.error) return;
    const post = await resolvePostSocialAuth({
      email: result.email,
      givenName: result.givenName,
      familyName: result.familyName,
    });
    if (post.outcome === 'error') return;
    // Yeni kullanıcı → Bildirim → Takibe başla; dönen kullanıcı → eatkcal/Tabs.
    if (post.outcome === 'new_user') navigation.navigate('OnbNotify', { intent: route.params.intent });
    else root?.navigate('Tabs');
  };

  const run = async (provider: 'apple' | 'google') => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
      await afterAuth(result);
    } finally {
      setBusy(false);
    }
  };

  const link = { color: P.ink, textDecorationLine: 'underline' as const };
  return (
    <OnbScaffold
      glass={GLASS.drop}
      cardTop={262}
      onBack={() => navigation.goBack()}
      dots={{ count: 4, index: 2 }}
      footer={
        <View>
          <View style={{ gap: 10 }}>
            <AuthButton kind="apple" label={i18n.t('onboarding.account.apple')} disabled={busy} onPress={() => run('apple')} />
            <AuthButton kind="google" label={i18n.t('onboarding.account.google')} disabled={busy} onPress={() => run('google')} />
            <AuthButton kind="email" label={i18n.t('onboarding.account.email')} disabled={busy} onPress={() => root?.navigate('Login')} />
          </View>
          <AppText textRole="helper" style={[styles.legal, { color: P.sec }]}>
            {i18n.t('onboarding.account.legal_pre')}
            <AppText textRole="helper" style={link}>{i18n.t('onboarding.account.terms')}</AppText>
            {i18n.t('onboarding.account.legal_mid')}
            <AppText textRole="helper" style={link}>{i18n.t('onboarding.account.privacy')}</AppText>
            {i18n.t('onboarding.account.legal_post')}
          </AppText>
        </View>
      }
    >
      <OnbTitle>{i18n.t('onboarding.account.title')}</OnbTitle>
      <OnbLead>{i18n.t('onboarding.account.sub')}</OnbLead>
    </OnbScaffold>
  );
}

// ── Bildirim izni (ön ekran) ────────────────────────────────────────────────
function NotifyScreen({ navigation }: NativeStackScreenProps<OnbParamList, 'OnbNotify'>) {
  const i18n = useT();
  const root = useRootNav(navigation);
  const [busy, setBusy] = useState(false);
  // Final: Bildirim → Takibe başla (yeni kullanıcı hesabı az önce oluştu).
  const next = () => root?.navigate('TakibeBasla');

  const allow = async () => {
    setBusy(true);
    try {
      await registerForPushNotifications();
    } catch {
      // izin reddi/akış hatası: sessizce ilerle (ön ekran bloklamaz).
    } finally {
      setBusy(false);
      next();
    }
  };

  return (
    <OnbScaffold
      glass={GLASS.flame}
      cardTop={400}
      onBack={() => navigation.goBack()}
      dots={{ count: 4, index: 3 }}
      footer={
        <View style={styles.row}>
          <OnbButton kind="chip" style={styles.half} label={i18n.t('onboarding.notify.later')} onPress={next} />
          <OnbButton kind="chip" style={styles.half} label={i18n.t('onboarding.notify.allow')} onPress={busy ? () => {} : allow} />
        </View>
      }
    >
      <OnbTitle>{i18n.t('onboarding.notify.title')}</OnbTitle>
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

export default function OnboardingNavigator() {
  const P = useOnb();
  return (
    <Stack.Navigator
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
  brand: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, lineHeight: 24, marginBottom: 12 },
  headline: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
  legal: { marginTop: 14, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, paddingHorizontal: 8 },
});
