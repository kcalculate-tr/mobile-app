// Onboarding akışı (G12-S1 · FinOnb*). Yalnız `yeni_onboarding` açık + oturumsuz
// soğuk açılışta AppNavigator bu iç yığını `Onboarding` rotasına kurar. Kapalıyken
// HİÇ kaydolmaz → WelcomeGate bugünküyle aynı.
//
// Akış: Karşılama → Niyet → (Sipariş: eatkcal'e) / (Takip·İkisi: Bildirim → Hesap).
// Hesap mevcut auth fonksiyonlarını (AuthContext + postSocialAuth) ÇAĞIRIR, auth
// dosyalarına dokunmaz. Yeni kullanıcı → Takibe başla; dönen kullanıcı → Tabs.
// 18 yaş engeli (FinOnbUnderage) Takibe başla'nın yaş adımından gelir; burada
// paylaşılan ekran olarak da kayıtlıdır (vitrin + geri dönüş).

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../../core/design/components/AppText';
import { useEnter, DURATION } from '../../core/design/motion';
import Animated from 'react-native-reanimated';
import { useT } from '../../core/i18n';
import { useAuth } from '../../core/AuthContext';
import { resolvePostSocialAuth } from '../../lib/postSocialAuth';
import { registerForPushNotifications } from '../../core/notifications';
import type { RootStackParamList } from '../../navigation/types';
import { OnbScaffold } from './components/OnbScaffold';
import { ONB, GlassOption, AuthButton, PrimaryButton, GhostButton } from './components/pieces';

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

// ── Karşılama ─────────────────────────────────────────────────────────────────
function WelcomeScreen({ navigation }: NativeStackScreenProps<OnbParamList, 'OnbWelcome'>) {
  const i18n = useT();
  const enter = useEnter();
  const root = useRootNav(navigation);
  return (
    <OnbScaffold glass={require('../../../assets/glass/bowl.png')} glowY={0.34}>
      <View style={styles.flexTop}>
        <AppText textRole="screenTitle" style={[styles.brand, { color: ONB.accent }]}>
          {i18n.t('onboarding.welcome.brand')}
        </AppText>
      </View>
      <Animated.View style={[styles.bottom, enter.style]}>
        <AppText style={[styles.headline, { color: ONB.ink }]}>
          {i18n.t('onboarding.welcome.headline')}
        </AppText>
        <AppText textRole="body" style={[styles.lead, { color: ONB.sub }]}>
          {i18n.t('onboarding.welcome.sub')}
        </AppText>
        <View style={styles.actions}>
          <PrimaryButton label={i18n.t('onboarding.welcome.start')} onPress={() => navigation.navigate('OnbIntent')} />
          <GhostButton
            label={i18n.t('onboarding.welcome.haveAccount')}
            onPress={() => root?.navigate('Login')}
          />
        </View>
      </Animated.View>
    </OnbScaffold>
  );
}

// ── Niyet ─────────────────────────────────────────────────────────────────────
function IntentScreen({ navigation }: NativeStackScreenProps<OnbParamList, 'OnbIntent'>) {
  const i18n = useT();
  const enter = useEnter();
  const root = useRootNav(navigation);
  const [sel, setSel] = useState<OnbIntent | null>(null);

  const go = (intent: OnbIntent) => {
    if (intent === 'order') {
      root?.navigate('Tabs', { screen: 'Home' });
      return;
    }
    navigation.navigate('OnbNotify', { intent });
  };

  return (
    <OnbScaffold glowY={0.16} topRight={{ label: i18n.t('onboarding.intent.skip'), onPress: () => root?.navigate('Tabs', { screen: 'Home' }) }}>
      <Animated.View style={[styles.flexTop, { justifyContent: 'flex-start', paddingTop: 48 }, enter.style]}>
        <AppText textRole="screenTitle" style={[styles.title, { color: ONB.ink }]}>
          {i18n.t('onboarding.intent.title')}
        </AppText>
        <AppText textRole="body" style={[styles.lead, { color: ONB.sub, marginBottom: 20 }]}>
          {i18n.t('onboarding.intent.sub')}
        </AppText>
        <View style={{ gap: 12 }}>
          <GlassOption
            title={i18n.t('onboarding.intent.track')}
            desc={i18n.t('onboarding.intent.track_desc')}
            selected={sel === 'track'}
            onPress={() => {
              setSel('track');
              go('track');
            }}
          />
          <GlassOption
            title={i18n.t('onboarding.intent.order')}
            desc={i18n.t('onboarding.intent.order_desc')}
            selected={sel === 'order'}
            onPress={() => {
              setSel('order');
              go('order');
            }}
          />
          <GlassOption
            title={i18n.t('onboarding.intent.both')}
            desc={i18n.t('onboarding.intent.both_desc')}
            selected={sel === 'both'}
            onPress={() => {
              setSel('both');
              go('both');
            }}
          />
        </View>
      </Animated.View>
    </OnbScaffold>
  );
}

// ── Bildirim izni (ön ekran) ────────────────────────────────────────────────
function NotifyScreen({ navigation, route }: NativeStackScreenProps<OnbParamList, 'OnbNotify'>) {
  const i18n = useT();
  const enter = useEnter();
  const [busy, setBusy] = useState(false);
  const next = () => navigation.navigate('OnbAccount', { intent: route.params.intent });

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
    <OnbScaffold glass={require('../../../assets/glass/flame.png')} glowY={0.28}>
      <View style={styles.flexTop} />
      <Animated.View style={[styles.bottom, enter.style]}>
        <AppText textRole="screenTitle" style={[styles.title, { color: ONB.ink }]}>
          {i18n.t('onboarding.notify.title')}
        </AppText>
        <AppText textRole="body" style={[styles.lead, { color: ONB.sub }]}>
          {i18n.t('onboarding.notify.sub')}
        </AppText>
        <View style={styles.actions}>
          <PrimaryButton label={i18n.t('onboarding.notify.allow')} onPress={busy ? () => {} : allow} />
          <GhostButton label={i18n.t('onboarding.notify.later')} onPress={next} />
        </View>
      </Animated.View>
    </OnbScaffold>
  );
}

// ── Hesap ──────────────────────────────────────────────────────────────────────
function AccountScreen({ navigation }: NativeStackScreenProps<OnbParamList, 'OnbAccount'>) {
  const i18n = useT();
  const enter = useEnter();
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
    // Yeni kullanıcı → Takibe başla; dönen kullanıcı → eatkcal/Tabs.
    if (post.outcome === 'new_user') root?.navigate('TakibeBasla');
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

  return (
    <OnbScaffold glass={require('../../../assets/glass/drop.png')} glowY={0.26}>
      <View style={styles.flexTop} />
      <Animated.View style={[styles.bottom, enter.style]}>
        <AppText textRole="screenTitle" style={[styles.title, { color: ONB.ink }]}>
          {i18n.t('onboarding.account.title')}
        </AppText>
        <AppText textRole="body" style={[styles.lead, { color: ONB.sub, marginBottom: 20 }]}>
          {i18n.t('onboarding.account.sub')}
        </AppText>
        <View style={{ gap: 10 }}>
          <AuthButton kind="apple" label={i18n.t('onboarding.account.apple')} disabled={busy} onPress={() => run('apple')} />
          <AuthButton kind="google" label={i18n.t('onboarding.account.google')} disabled={busy} onPress={() => run('google')} />
          <AuthButton kind="email" label={i18n.t('onboarding.account.email')} disabled={busy} onPress={() => root?.navigate('Login')} />
        </View>
        <AppText textRole="helper" style={[styles.legal, { color: ONB.sub }]}>
          {i18n.t('onboarding.account.legal_pre')}
          <AppText textRole="helper" style={{ color: ONB.ink }}>{i18n.t('onboarding.account.terms')}</AppText>
          {i18n.t('onboarding.account.legal_mid')}
          <AppText textRole="helper" style={{ color: ONB.ink }}>{i18n.t('onboarding.account.privacy')}</AppText>
          {i18n.t('onboarding.account.legal_post')}
        </AppText>
      </Animated.View>
    </OnbScaffold>
  );
}

// ── 18 yaş engeli ─────────────────────────────────────────────────────────────
function UnderageScreen({ navigation }: NativeStackScreenProps<OnbParamList, 'OnbUnderage'>) {
  const i18n = useT();
  const enter = useEnter();
  const root = useRootNav(navigation);
  return (
    <OnbScaffold glowY={0.3}>
      <View style={styles.center}>
        <Animated.View style={enter.style}>
          <AppText textRole="screenTitle" style={[styles.title, { color: ONB.ink, textAlign: 'center' }]}>
            {i18n.t('onboarding.underage.title')}
          </AppText>
          <AppText textRole="body" style={[styles.lead, { color: ONB.sub, textAlign: 'center' }]}>
            {i18n.t('onboarding.underage.sub')}
          </AppText>
          <View style={[styles.actions, { marginTop: 24 }]}>
            <PrimaryButton label={i18n.t('onboarding.underage.fix')} onPress={() => navigation.goBack()} />
            <GhostButton label={i18n.t('onboarding.underage.ok')} onPress={() => root?.navigate('Tabs', { screen: 'Home' })} />
          </View>
        </Animated.View>
      </View>
    </OnbScaffold>
  );
}

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: DURATION.base,
        contentStyle: { backgroundColor: '#000000' },
      }}
    >
      <Stack.Screen name="OnbWelcome" component={WelcomeScreen} />
      <Stack.Screen name="OnbIntent" component={IntentScreen} />
      <Stack.Screen name="OnbNotify" component={NotifyScreen} />
      <Stack.Screen name="OnbAccount" component={AccountScreen} />
      <Stack.Screen
        name="OnbUnderage"
        component={UnderageScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  flexTop: { flex: 1, justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center' },
  bottom: { paddingBottom: 8 },
  brand: { fontSize: 40, lineHeight: 44 },
  headline: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  title: { marginBottom: 8 },
  lead: { marginTop: 8 },
  actions: { marginTop: 24, gap: 8 },
  legal: { marginTop: 16, textAlign: 'center' },
});
