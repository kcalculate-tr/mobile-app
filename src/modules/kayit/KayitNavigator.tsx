// G42-S1 — Yeni onboarding + kayıt yığını. Yalnız `yeni_kayit` açıkken kök yığına kaydolur (AppNavigator);
// kapalıyken hiç yüklenmez → bugünkü onboarding bayt bayt aynı.
//   KOnb (5 ekran) → A: KQuestions (P1–P14) → KCalc (L1) → KResult (L2) → KSignup (K1) → KEmail (E1/E2) → KOffer (T1) → Tabs (HA)
//                  → B: KSignup (K1b) → Tabs (HB) → ilk kalori kaydında KayitShort (kısa profil, kök yığında) → HB2
// Açılışta 7 günlük taslakta hesaplanmış plan varsa R1 (KReturn) önce gelir.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useRoute } from '@react-navigation/native';
import { REDUCED, useReducedMotion } from '../../core/design';
import OnboardingScreen from './screens/OnboardingScreen';
import QuestionsScreen from './screens/QuestionsScreen';
import { CalcScreen, ResultScreen } from './screens/PlanScreens';
import { EmailScreen, SignupScreen } from './screens/SignupScreens';
import OfferScreen from './screens/OfferScreen';
import ReturnScreen from './screens/ReturnScreen';
import { readDraft, shouldShowReturn, type KDraft } from './storage';
import { kv, useKayit } from './store';
import { emptyKAnswers, type KAnswers } from './model';
import { computeKayitPlan, planSignature } from './plan';
import { K_MOTION } from './ui/theme';

export type KayitParamList = {
  KOnb: { vitrinStep?: number } | undefined;
  KReturn: { draft: KDraft };
  KQuestions: { path?: 'a' | 'b'; vitrinStep?: string } | undefined;
  KCalc: undefined;
  KResult: undefined;
  KSignup: { path?: 'a' | 'b'; vitrin?: string } | undefined;
  KEmail: { path?: 'a' | 'b'; meta?: boolean; marketing?: boolean; age?: boolean; vitrinStep?: 'code'; vitrinState?: string } | undefined;
  KOffer: { vitrinPhase?: string; vitrinPeriod?: string } | undefined;
};

const Stack = createNativeStackNavigator<KayitParamList>();

/** YALNIZ __DEV__ vitrini: tasarım panolarındaki örnek cevaplar (72 → 66 kg, kilo vermek). */
function vitrinPrefill(screen: keyof KayitParamList, params: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const demo: KAnswers = {
    ...emptyKAnswers(),
    goal: 'lose',
    gender: 'female',
    birthYear: new Date().getFullYear() - 31,
    heightCm: 170,
    weightKg: 72,
    targetWeightKg: 66,
    pace: 0.5,
    activity: 'light',
    sportDays: [0, 2, 4],
    sports: ['walk', 'yoga'],
    diet: 'all',
    dislikes: ['mushroom', 'fish'],
    meals: 4,
    cooking: 'sometimes',
    struggle: 'evening_snack',
  };
  const s = useKayit.getState();
  s.reset();
  s.setPath(screen === 'KSignup' && params?.path === 'b' ? 'b' : 'a');
  s.setStart('track');
  if (screen === 'KOnb') return params;
  s.patch(demo);
  const plan = computeKayitPlan(demo, { currentYear: new Date().getFullYear(), startIso: new Date().toISOString().slice(0, 10) });
  if (screen !== 'KCalc') {
    s.setPlan(plan, planSignature(demo));
    s.setCalcDone(true);
  }
  if (screen === 'KOffer') s.setEmailSent(true);
  if (screen === 'KReturn' && plan) {
    const draft: KDraft = { v: 1, savedAt: new Date(Date.now() - 2 * 86400000).toISOString(), answers: demo, step: 'signup', start: 'track', plan: { calories: plan.calories, protein: plan.protein, carbs: plan.carbs, fat: plan.fat } };
    return { draft };
  }
  return params;
}

function OnbRoute({ route }: { route: { params?: { vitrinStep?: number } } }) {
  return <OnboardingScreen vitrinStep={route.params?.vitrinStep} />;
}
function OfferRoute({ route }: { route: { params?: { vitrinPhase?: string; vitrinPeriod?: string } } }) {
  return <OfferScreen vitrinPhase={route.params?.vitrinPhase as never} vitrinPeriod={route.params?.vitrinPeriod as never} />;
}

export default function KayitNavigator() {
  const reduced = useReducedMotion();
  // YALNIZ __DEV__ vitrini: { screen, params } ile doğrudan bir sahne.
  const p = (useRoute().params ?? {}) as { screen?: keyof KayitParamList; params?: Record<string, unknown> };
  const devScreen = __DEV__ ? p.screen : undefined;
  const [initial, setInitial] = useState<{ name: keyof KayitParamList; params?: Record<string, unknown> } | null>(() =>
    devScreen ? { name: devScreen, params: vitrinPrefill(devScreen, p.params) } : null,
  );

  useEffect(() => {
    if (initial) return;
    let alive = true;
    void readDraft(kv).then((d) => {
      if (!alive) return;
      setInitial(shouldShowReturn(d) ? { name: 'KReturn', params: { draft: d } } : { name: 'KOnb' });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!initial) return <View style={{ flex: 1, backgroundColor: '#0D2617' }} />;
  const push = reduced ? ({ animation: 'fade', animationDuration: REDUCED.duration } as const) : ({ animation: 'slide_from_right', animationDuration: K_MOTION.shared } as const);
  const scene = reduced ? ({ animation: 'fade', animationDuration: REDUCED.duration } as const) : ({ animation: 'fade', animationDuration: K_MOTION.scene } as const);
  return (
    <Stack.Navigator
      initialRouteName={initial.name}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0D2617' }, ...push }}
    >
      <Stack.Screen name="KOnb" component={OnbRoute as never} initialParams={initial.name === 'KOnb' ? (initial.params as never) : undefined} options={{ animation: 'fade' }} />
      <Stack.Screen name="KReturn" component={ReturnScreen} initialParams={initial.name === 'KReturn' ? (initial.params as never) : undefined} options={{ ...scene, animation: reduced ? 'fade' : 'slide_from_bottom' }} />
      {/* O5 → P1: seçilen kart büyüyerek açılır (sahne geçişi 550 ms); sorular kendi içinde kayar (kenar jesti ekranın). */}
      <Stack.Screen name="KQuestions" component={QuestionsScreen} initialParams={initial.name === 'KQuestions' ? (initial.params as never) : undefined} options={{ ...scene, gestureEnabled: false }} />
      <Stack.Screen name="KCalc" component={CalcScreen} options={{ ...scene, gestureEnabled: false }} />
      <Stack.Screen name="KResult" component={ResultScreen} options={{ ...scene, gestureEnabled: false }} />
      <Stack.Screen name="KSignup" component={SignupScreen} initialParams={initial.name === 'KSignup' ? (initial.params as never) : undefined} options={scene} />
      <Stack.Screen name="KEmail" component={EmailScreen} initialParams={initial.name === 'KEmail' ? (initial.params as never) : undefined} />
      <Stack.Screen name="KOffer" component={OfferRoute as never} initialParams={initial.name === 'KOffer' ? (initial.params as never) : undefined} options={{ ...scene, gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
