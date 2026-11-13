// G42-S1 md.3/md.9 — Kayıt soruları. A yolu P1–P14 (+ I1, I2, P3b) → L1; B yolu kısa profil (B-P1/P2/P3/P4/
// P5/P8, halka 6 üzerinden, son düğme "Takibe başla") → MEVCUT takip kapısı kaydı (saveTakibeProfile) → HB2.
// Her soru tek ekran; soru → soru native iOS yığın geçişi hissi (yeni içerik sağdan, eskisi %30 sola; 330 ms
// standart eğri; geri kaydırma / Android geri bir önceki soruya, tersi yönde). Arkadaki ışık lekeleri 3 katman
// yavaş kayar (yarı genlik); maskot her cevapta tek küçük baş sallar. G44: paylaşılan öğe taklidi yok, seçim
// soluklaştırması yok.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Localization from 'expo-localization';
import { AppText, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import {
  ArrowDown,
  ArrowUp,
  Armchair,
  Barbell,
  Carrot,
  Clock,
  Cookie,
  CookingPot,
  Equals,
  Fish,
  ForkKnife,
  Leaf,
  Moon,
  Package,
  PersonSimpleRun,
  PersonSimpleTaiChi,
  PersonSimpleWalk,
  Plant,
  SoccerBall,
  Storefront,
  SwimmingPool,
  Timer,
  Lightning,
} from '../../../components/icons';
import { recordHealthConsent } from '../../../lib/consent/store';
import { healthConsentGiven } from '../../personalPlan/api';
import { saveTakibeProfile } from '../../onboarding/takibe/save';
import { CheckBoxRow, FONT, KBackdrop, KButton, Mascot, QuestionHead, Rise, Segment, TopBar, type BubbleLayout } from '../ui/parts';
import { ActivityCarousel, ChipToggle, ChoiceTile, DayPills, DiffPill, OptionCard, PaceSelector, PlateStepper, RangeCard, Ruler, TagCloud, WheelPicker } from '../ui/pickers';
import { useEdgeBack } from '../ui/edge';
import { StackSwap } from '../ui/motion';
import { K_MOTION, useK } from '../ui/theme';
import {
  K_COOKING,
  K_DIETS,
  K_DISLIKE_CLOUD,
  K_GOALS,
  K_SPORTS,
  K_STRUGGLES,
  MEALS_MAX,
  MEALS_MIN,
  PANO,
  canContinue,
  cmToInches,
  defaultTarget,
  defaultUnits,
  inchesToCm,
  kgToLb,
  lbToKg,
  nextStep,
  paceOptionsFor,
  prevStep,
  progressOf,
  searchDislikes,
  targetOptional,
  type KDislike,
  type KPath,
  type KQuestion,
  type KStep,
  type KWeekday,
} from '../model';
import { computeKayitPlan, toTakibeDraft } from '../plan';
import { fmtDec1, fmtDiff, fmtHeight, fmtPace, fmtWeight, monthRange } from '../format';
import { kv, useKayit } from '../store';
import { setShortPending } from '../storage';
import { dropDraft } from '../store';
import { kTrack } from '../events';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

const LAYOUT: Record<KQuestion, BubbleLayout> = {
  goal: 'title',
  gender: 'left',
  birth: 'right',
  height: 'left',
  weight: 'right',
  target: 'left',
  pace: 'right',
  activity: 'left',
  sport: 'right',
  diet: 'left',
  dislikes: 'right',
  meals: 'left',
  cooking: 'right',
  struggle: 'left',
};
const GOAL_ICON = { lose: ArrowDown, maintain: Equals, gain: ArrowUp, muscle: Barbell, balanced: Leaf } as const;
const DIET_ICON = { all: ForkKnife, vegetarian: Carrot, vegan: Plant, pescatarian: Fish } as const;
const SPORT_ICON = { weights: Barbell, run: PersonSimpleRun, walk: PersonSimpleWalk, yoga: PersonSimpleTaiChi, swim: SwimmingPool, team: SoccerBall, other: Lightning } as const;
const COOK_ICON = { daily: CookingPot, sometimes: Timer, ready: Package } as const;
const STRUGGLE_ICON = { evening_snack: Moon, eating_out: Storefront, no_time: Clock, sweet: Cookie } as const;
const ACT_ICON = { sedentary: Armchair, light: PersonSimpleWalk, moderate: PersonSimpleWalk, active: PersonSimpleRun } as const;

type Params = { path?: KPath; mode?: 'short'; vitrinStep?: KStep; vitrinPick?: (typeof K_GOALS)[number] } | undefined;

export default function QuestionsScreen() {
  const { t, lang } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as NonNullable<Params>;
  const short = params.mode === 'short';
  const path: KPath = short ? 'b' : (params.path ?? 'a');
  const { user } = useAuth();
  const a = useKayit((s) => s.answers);
  const step = useKayit((s) => s.step);
  const patch = useKayit((s) => s.patch);
  const setStep = useKayit((s) => s.setStep);
  const setUnits = useKayit((s) => s.setUnits);
  const healthOk = useKayit((s) => s.healthOk);
  const setHealthOk = useKayit((s) => s.setHealthOk);
  const year = new Date().getFullYear();
  const [dir, setDir] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const [consentKnown, setConsentKnown] = useState(false);
  const firstMount = useRef(true);

  // Açılış: kısa profil / vitrin adımı; EN'de birim cihaz bölgesine göre.
  useEffect(() => {
    if (!firstMount.current) return;
    firstMount.current = false;
    const s = useKayit.getState();
    if (short) {
      s.reset(defaultUnits(lang, Localization.getLocales?.()[0]?.regionCode));
      s.setPath('b');
    } else if (s.answers.goal == null && s.answers.heightCm == null) {
      s.setUnits(defaultUnits(lang, Localization.getLocales?.()[0]?.regionCode));
    }
    if (__DEV__ && params.vitrinStep) s.setStep(params.vitrinStep);
    else if (short || s.answers.goal == null) s.setStep('goal');
    if (short) void healthConsentGiven().then((v) => setConsentKnown(v));
    // YALNIZ __DEV__ vitrini (G44 seçim geçişi dizisi): P1 seçimsiz açılır, 6 sn sonra seçim yapılır (vitrin açılış örtüsü kalktıktan sonra).
    if (__DEV__ && params.vitrinPick) {
      const pick = params.vitrinPick;
      s.patch({ goal: null });
      const id = setTimeout(() => {
        haptic('selection');
        useKayit.getState().patch({ goal: pick });
      }, 6000);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (target: KStep, d: 1 | -1) => {
    setDir(d);
    setStep(target);
  };

  const back = () => {
    const p = prevStep(step, a, path);
    if (p) go(p, -1);
    else navigation.goBack();
  };
  const edge = useEdgeBack(back);

  const next = async () => {
    if (step !== 'i1' && step !== 'i2' && step !== 'minor') kTrack.answer(PANO[step as KQuestion], path);
    const n = nextStep(step, a, year, path);
    if (n === 'plan') {
      navigation.navigate('KCalc');
      return;
    }
    if (n === 'done') {
      if (step === 'minor') {
        // Mevcut kural (FinOnbUnderage): hedefsiz öğün takibi açık; cevaplar KAYDEDİLMEZ.
        await dropDraft();
        if (short) await setShortPending(kv, false);
        useKayit.getState().reset(a.units);
        navigation.getParent()?.reset?.({ index: 0, routes: [{ name: 'Tabs' }] }) ?? navigation.navigate('Tabs');
        return;
      }
      await finishShort();
      return;
    }
    go(n, 1);
  };

  const finishShort = async () => {
    if (!user?.id) return;
    setSaving(true);
    const consent = consentKnown || healthOk;
    if (healthOk && !consentKnown) void recordHealthConsent(true, 'takibe').catch(() => {});
    const r = await saveTakibeProfile(user.id, toTakibeDraft(a, consent), year);
    setSaving(false);
    if (!r.ok) return;
    haptic('success');
    await setShortPending(kv, false);
    // HB2: ana sayfa, takip açık (kısa profil hedefiyle).
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs');
  };

  const prog = step === 'i1' || step === 'i2' || step === 'minor' ? null : progressOf(step, a, path);
  const lastA = path === 'a' && step === 'struggle';
  const lastB = path === 'b' && step === 'activity';
  const needsConsent = lastB && !consentKnown;
  const can = canContinue(step, a) && (!needsConsent || healthOk);
  const label = lastA ? t('kayit.q.make_plan') : lastB ? t('kayit.q.short_start') : step === 'minor' ? t('kayit.q.minor_cta') : t('kayit.q.next');

  const stepIdx = useMemo(() => ['goal', 'gender', 'birth', 'height', 'weight', 'i1', 'target', 'pace', 'activity', 'sport', 'diet', 'i2', 'dislikes', 'meals', 'cooking', 'struggle', 'minor'].indexOf(step), [step]);

  return (
    <View style={styles.root} {...edge} testID={`kayit-q-${step}`} onAccessibilityEscape={back}>
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <KBackdrop shift={stepIdx} />
      <View style={{ paddingTop: insets.top + 8, flex: 1 }}>
        <TopBar onBack={back} progress={prog} glow={lastA} />
        <QCtx.Provider value={{ a, patch, setUnits, t: t as QCtxValue['t'], lang, P, year }}>
        <StackSwap k={step} dir={dir}>
          {step === 'i1' || step === 'i2' ? (
            <Interstitial step={step} onNext={next} />
          ) : step === 'minor' ? (
            <MinorView />
          ) : (
            <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              <View style={{ marginTop: 12 }}>
                <QuestionHead
                  testID="kayit-q-title"
                  title={titleFor(step as KQuestion, a.goal, t as QCtxValue['t'])}
                  layout={LAYOUT[step as KQuestion]}
                  react={JSON.stringify(a)}
                />
              </View>
              <View style={{ marginTop: 28 }}>
                <Body step={step as KQuestion} />
              </View>
              {needsConsent ? (
                <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
                  <CheckBoxRow testID="kayit-health-consent" checked={healthOk} onToggle={() => setHealthOk(!healthOk)} label={t('kayit.q.health_consent')} />
                </View>
              ) : null}
            </ScrollView>
          )}
        </StackSwap>
        </QCtx.Provider>
        {step !== 'i1' && step !== 'i2' ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            {step === 'target' && targetOptional(a.goal) ? (
              <Pressable
                testID="kayit-skip"
                onPress={() => {
                  patch({ targetSkipped: true, targetWeightKg: null });
                  kTrack.answer('P6k_skip', path);
                  const n = nextStep('target', { ...a, targetSkipped: true }, year, path);
                  if (n !== 'plan' && n !== 'done') go(n, 1);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('kayit.q.skip')}
                style={styles.skip}
              >
                <AppText maxFontSizeMultiplier={1.3} style={[styles.skipText, { color: P.ink }]}>
                  {t('kayit.q.skip')}
                </AppText>
              </Pressable>
            ) : null}
            <KButton testID="kayit-next" label={label} onPress={() => void next()} disabled={!can} loading={saving} />
          </View>
        ) : null}
      </View>
    </View>
  );

}


// ─── Soru gövdeleri (modül düzeyi: her render'da yeniden kurulmaz → cetvel/tekerlek konumu korunur) ───────
type QCtxValue = {
  a: ReturnType<typeof useKayit.getState>['answers'];
  patch: (p: Partial<ReturnType<typeof useKayit.getState>['answers']>) => void;
  setUnits: (u: 'metric' | 'imperial') => void;
  t: (k: string, p?: Record<string, unknown>) => string;
  lang: string;
  P: ReturnType<typeof useK>;
  year: number;
};
const QCtx = React.createContext<QCtxValue | null>(null);
function useQ(): QCtxValue {
  const v = React.useContext(QCtx);
  if (!v) throw new Error('QCtx');
  return v;
}

function Body({ step: s }: { step: KQuestion }) {
  switch (s) {
    case 'goal':
      return <GoalBody />;
    case 'gender':
      return <GenderBody />;
    case 'birth':
      return <BirthBody />;
    case 'height':
      return <HeightBody />;
    case 'weight':
      return <WeightBody target={false} />;
    case 'target':
      return <WeightBody target />;
    case 'pace':
      return <PaceBody />;
    case 'activity':
      return <ActivityBody />;
    case 'sport':
      return <SportBody />;
    case 'diet':
      return <DietBody />;
    case 'dislikes':
      return <DislikeBody />;
    case 'meals':
      return <MealsBody />;
    case 'cooking':
      return <CookingBody />;
    case 'struggle':
      return <StruggleBody />;
  }
}

function GoalBody() {
  const { a, patch, t } = useQ();
  const pick = (g: (typeof K_GOALS)[number]) => {
    const extra = g !== a.goal ? { targetWeightKg: null, targetSkipped: false, pace: 0.5 as const } : {};
    patch({ goal: g, ...extra });
  };
  const tile = (g: (typeof K_GOALS)[number], i: number, wide = false) => (
    <ChoiceTile key={g} testID={`kayit-goal-${g}`} wide={wide} delay={i * K_MOTION.stagger} icon={GOAL_ICON[g]} label={t(`kayit.q.goal_${g}`)} selected={a.goal === g} onPress={() => pick(g)} />
  );
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('kayit.q.goal_title')} style={styles.grid}>
      <View style={styles.row}>
        {tile('lose', 0)}
        {tile('maintain', 1)}
      </View>
      <View style={styles.row}>
        {tile('gain', 2)}
        {tile('muscle', 3)}
      </View>
      {tile('balanced', 4, true)}
    </View>
  );
}

function GenderBody() {
  const { a, patch, t } = useQ();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('kayit.q.gender_title')} style={styles.grid}>
      <View style={styles.row}>
        {(['female', 'male'] as const).map((g, i) => (
          <ChoiceTile key={g} testID={`kayit-gender-${g}`} delay={i * K_MOTION.stagger} label={t(`kayit.q.gender_${g}`)} selected={a.gender === g} onPress={() => patch({ gender: g })} />
        ))}
      </View>
      <View style={{ alignItems: 'center' }}>
        <ChipToggle testID="kayit-gender-unspecified" label={t('kayit.q.gender_unspecified')} on={a.gender === 'unspecified'} onPress={() => patch({ gender: 'unspecified' })} />
      </View>
    </View>
  );
}

function BirthBody() {
  const { a, patch, t, P, year } = useQ();
  const years = useMemo(() => Array.from({ length: 91 }, (_, i) => year - 100 + i), []);
  const value = a.birthYear ?? year - 31;
  useEffect(() => {
    if (a.birthYear == null) patch({ birthYear: year - 31 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ alignItems: 'center', gap: 18, paddingHorizontal: 20 }}>
      <WheelPicker testID="kayit-wheel" values={years} value={value} onChange={(v) => patch({ birthYear: v })} label={t('kayit.q.birth_title')} />
      <View style={[styles.agePill, { backgroundColor: P.accent }]}>
        <AppText maxFontSizeMultiplier={1.3} style={styles.agePillText}>
          {t('kayit.q.age', { age: year - value })}
        </AppText>
      </View>
    </View>
  );
}

function UnitSwitch({ kind }: { kind: 'len' | 'mass' }) {
  const { a, setUnits, t } = useQ();
  return (
    <Segment
      testID={`kayit-unit-${kind}`}
      label={t('kayit.q.unit_group')}
      width={200}
      value={a.units}
      onChange={(u) => setUnits(u)}
      options={
        kind === 'len'
          ? [
              { key: 'metric', label: t('kayit.q.unit_cm') },
              { key: 'imperial', label: t('kayit.q.unit_ftin') },
            ]
          : [
              { key: 'metric', label: t('kayit.q.unit_kg') },
              { key: 'imperial', label: t('kayit.q.unit_lb') },
            ]
      }
    />
  );
}

function BigValue({ value, unit, testID }: { value: string; unit: string; testID?: string }) {
  const { P } = useQ();
  return (
    <View style={styles.bigRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <AppText testID={testID} maxFontSizeMultiplier={1.15} style={[styles.big, { color: P.ink }]}>
        {value}
      </AppText>
      {unit ? (
        <AppText maxFontSizeMultiplier={1.2} style={[styles.bigUnit, { color: P.sec }]}>
          {unit}
        </AppText>
      ) : null}
    </View>
  );
}

function HeightBody() {
  const { a, patch, t } = useQ();
  const cm = a.heightCm ?? 170;
  useEffect(() => {
    if (a.heightCm == null) patch({ heightCm: 170 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const h = fmtHeight(cm, a.units);
  const imperial = a.units === 'imperial';
  return (
    <View style={{ gap: 22 }}>
      <UnitSwitch kind="len" />
      <BigValue testID="kayit-height-value" value={h.value} unit={h.unit} />
      <Ruler
        testID="kayit-ruler-height"
        resetKey={a.units}
        min={imperial ? 39 : 100}
        max={imperial ? 98 : 250}
        step={1}
        perMajor={imperial ? 6 : 5}
        gap={12}
        value={imperial ? cmToInches(cm) : cm}
        onChange={(v) => patch({ heightCm: imperial ? inchesToCm(v) : v })}
        formatMajor={(v) => (imperial ? `${Math.floor(v / 12)}′${v % 12}″` : String(v))}
        label={t('kayit.q.height_title')}
        valueText={`${h.value} ${h.unit}`}
      />
    </View>
  );
}

function WeightBody({ target }: { target: boolean }) {
  const { a, patch, t, lang } = useQ();
  const cur = a.weightKg ?? 72;
  const kg = target ? (a.targetWeightKg ?? defaultTarget(a.goal, cur)) : cur;
  useEffect(() => {
    if (!target && a.weightKg == null) patch({ weightKg: 72 });
    if (target && a.targetWeightKg == null) patch({ targetWeightKg: defaultTarget(a.goal, cur), targetSkipped: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const imperial = a.units === 'imperial';
  const w = fmtWeight(kg, a.units, lang);
  const set = (v: number) => (target ? patch({ targetWeightKg: v, targetSkipped: false }) : patch({ weightKg: v }));
  return (
    <View style={{ gap: 18 }}>
      <UnitSwitch kind="mass" />
      <BigValue testID={target ? 'kayit-target-value' : 'kayit-weight-value'} value={w.value} unit={w.unit} />
      {target ? <DiffPill testID="kayit-diff" text={fmtDiff(kg - cur, a.units, lang)} /> : null}
      <Ruler
        testID={target ? 'kayit-ruler-target' : 'kayit-ruler-weight'}
        resetKey={a.units}
        min={imperial ? 66 : 30}
        max={imperial ? 660 : 300}
        step={imperial ? 0.5 : 0.1}
        perMajor={10}
        gap={8}
        value={imperial ? kgToLb(kg) : kg}
        onChange={(v) => set(imperial ? lbToKg(v) : Math.round(v * 10) / 10)}
        formatMajor={(v) => (imperial ? String(Math.round(v)) : String(Math.round(v)))}
        label={target ? titleFor('target', a.goal, t) : t('kayit.q.weight_title')}
        valueText={`${w.value} ${w.unit}`}
      />
    </View>
  );
}

function PaceBody() {
  const { a, patch, t, lang, year } = useQ();
  const opts = paceOptionsFor(a.goal);
  const gain = a.goal === 'gain';
  useEffect(() => {
    if (!opts.includes(a.pace)) patch({ pace: 0.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const plan = computeKayitPlan(a, { currentYear: year, startIso: new Date().toISOString().slice(0, 10) });
  const range = plan?.rangeFrom && plan.rangeTo ? monthRange(plan.rangeFrom, plan.rangeTo, lang) : '—';
  const titles = [t('kayit.q.pace_slow'), t('kayit.q.pace_mid'), t('kayit.q.pace_fast')];
  return (
    <View style={{ gap: 14, paddingHorizontal: 20 }}>
      <PaceSelector
        label={t('kayit.q.pace_title')}
        value={a.pace}
        onChange={(v) => patch({ pace: v })}
        options={opts.map((p, i) => ({ key: p, level: i + 1, title: titles[i], sub: t(gain ? 'kayit.q.pace_unit_gain' : 'kayit.q.pace_unit', { v: fmtPace(p, lang) }) }))}
      />
      <RangeCard testID="kayit-range" label={t('kayit.q.range_label')} range={range} note={t('kayit.q.range_note', { v: fmtPace(plan?.result.effectivePace || a.pace, lang) })} />
    </View>
  );
}

function ActivityBody() {
  const { a, patch, t } = useQ();
  return (
    <ActivityCarousel
      label={t('kayit.q.activity_title')}
      value={a.activity}
      onChange={(v) => patch({ activity: v })}
      items={(['sedentary', 'light', 'moderate', 'active'] as const).map((k) => ({ key: k, title: t(`kayit.q.act_${k}`), sub: t(`kayit.q.act_${k}_sub`), steps: t(`kayit.q.steps_${k}`), icon: ACT_ICON[k] }))}
    />
  );
}

function SportBody() {
  const { a, patch, t, P } = useQ();
  const days = t('kayit.q.days').split(',');
  const longs = t('kayit.q.days_long').split(',');
  const toggle = (d: number) => {
    const has = a.sportDays.includes(d as KWeekday);
    const next = (has ? a.sportDays.filter((x) => x !== d) : [...a.sportDays, d as KWeekday]).sort();
    patch({ sportDays: next, noSport: false });
  };
  return (
    <View style={{ gap: 16, paddingHorizontal: 20 }}>
      {/* G44: "Spor yapmıyorum" seçiliyken günler/çipler soluklaşmaz; dokunmak o seçimi kaldırır. */}
      <DayPills labels={days} longLabels={longs} value={a.sportDays} onToggle={toggle} />
      <AppText accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.4} style={[styles.center, styles.semi, { color: P.sec }]}>
        {a.sportDays.length ? t('kayit.q.days_count', { n: a.sportDays.length }) : t('kayit.q.days_none')}
      </AppText>
      <AppText maxFontSizeMultiplier={1.4} style={[styles.semi, { color: P.ink, marginTop: 6 }]}>
        {t('kayit.q.sport_what')}
      </AppText>
      <View style={styles.wrap}>
        {K_SPORTS.map((s) => (
          <ChipToggle
            key={s}
            testID={`kayit-sport-${s}`}
            icon={SPORT_ICON[s]}
            label={t(`kayit.q.sport_${s}`)}
            on={a.sports.includes(s)}
            onPress={() => patch({ sports: a.sports.includes(s) ? a.sports.filter((x) => x !== s) : [...a.sports, s], noSport: false })}
          />
        ))}
      </View>
      <ChipToggle testID="kayit-no-sport" label={t('kayit.q.no_sport')} on={a.noSport} onPress={() => patch({ noSport: !a.noSport, sportDays: [], sports: [] })} />
    </View>
  );
}

function DietBody() {
  const { a, patch, t } = useQ();
  const tile = (d: (typeof K_DIETS)[number], i: number) => (
    <ChoiceTile key={d} testID={`kayit-diet-${d}`} delay={i * K_MOTION.stagger} icon={DIET_ICON[d]} label={t(`kayit.q.diet_${d}`)} sub={t(`kayit.q.diet_${d}_sub`)} selected={a.diet === d} onPress={() => patch({ diet: d })} />
  );
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('kayit.q.diet_title')} style={styles.grid}>
      <View style={styles.row}>
        {tile('all', 0)}
        {tile('vegetarian', 1)}
      </View>
      <View style={styles.row}>
        {tile('vegan', 2)}
        {tile('pescatarian', 3)}
      </View>
    </View>
  );
}

function DislikeBody() {
  const { a, patch, t } = useQ();
  const labelOf = (k: KDislike) => t(`kayit.q.dl_${k}`);
  return (
    <View style={{ gap: 14, paddingHorizontal: 20 }}>
      <TagCloud<KDislike>
        testID="kayit-dislikes"
        all={(q) => searchDislikes(q, labelOf)}
        cloud={K_DISLIKE_CLOUD}
        selected={a.dislikes}
        labelOf={labelOf}
        onToggle={(k) => patch({ dislikes: a.dislikes.includes(k) ? a.dislikes.filter((x) => x !== k) : [...a.dislikes, k], eatsAll: false })}
        search={{
          placeholder: t('kayit.q.dislikes_search'),
          selectedTitle: t('kayit.q.dislikes_selected'),
          emptyTitle: t('kayit.q.dislikes_empty_title'),
          emptySub: t('kayit.q.dislikes_empty_sub'),
          removeLabel: (n) => t('kayit.q.dislikes_remove', { name: n }),
        }}
      />
      <ChipToggle testID="kayit-eats-all" label={t('kayit.q.eats_all')} on={a.eatsAll} onPress={() => patch({ eatsAll: !a.eatsAll, dislikes: [] })} />
    </View>
  );
}

function MealsBody() {
  const { a, patch, t } = useQ();
  return (
    <PlateStepper
      label={t('kayit.q.meals_title')}
      value={a.meals}
      min={MEALS_MIN}
      max={MEALS_MAX}
      onChange={(v) => patch({ meals: v })}
      sub={t('kayit.q.meals_sub')}
      lessLabel={t('kayit.q.meals_less')}
      moreLabel={t('kayit.q.meals_more')}
    />
  );
}

function CookingBody() {
  const { a, patch, t } = useQ();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('kayit.q.cooking_title')} style={[styles.grid, { gap: 12 }]}>
      {K_COOKING.map((c, i) => (
        <OptionCard key={c} delay={i * K_MOTION.stagger} testID={`kayit-cook-${c}`} icon={COOK_ICON[c]} label={t(`kayit.q.cook_${c}`)} sub={t(`kayit.q.cook_${c}_sub`)} selected={a.cooking === c} onPress={() => patch({ cooking: c })} />
      ))}
    </View>
  );
}

function StruggleBody() {
  const { a, patch, t } = useQ();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('kayit.q.struggle_title')} style={[styles.grid, { gap: 12 }]}>
      {K_STRUGGLES.map((c, i) => (
        <OptionCard key={c} delay={i * K_MOTION.stagger} testID={`kayit-st-${c}`} icon={STRUGGLE_ICON[c]} label={t(`kayit.q.st_${c}`)} sub={t(`kayit.q.st_${c}_sub`)} selected={a.struggle === c} onPress={() => patch({ struggle: c })} />
      ))}
    </View>
  );
}

function MinorView() {
  const { t, P } = useQ();
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 22 }}>
      <View style={{ alignItems: 'center' }}>
        <Mascot size={120} calm />
      </View>
      <AppText testID="kayit-minor-title" accessibilityRole="header" maxFontSizeMultiplier={1.35} style={[styles.minorTitle, { color: P.ink }]}>
        {t('kayit.q.minor_title')}
      </AppText>
      <View style={[styles.card, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.cardTitle, { color: P.ink }]}>
          {t('kayit.q.minor_card')}
        </AppText>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.cardSub, { color: P.sec }]}>
          {t('kayit.q.minor_sub')}
        </AppText>
      </View>
    </View>
  );
}

function titleFor(s: KQuestion, goal: string | null, t: (k: string, p?: Record<string, unknown>) => string): string {
  if (s === 'target') return t(goal === 'muscle' ? 'kayit.q.target_title_optional' : 'kayit.q.target_title');
  return t(`kayit.q.${s}_title`);
}

function Interstitial({ step, onNext }: { step: 'i1' | 'i2'; onNext: () => void }) {
  const { t } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (step === 'i2') haptic('success');
  }, [step]);
  return (
    <Pressable testID={`kayit-${step}`} onPress={onNext} accessibilityRole="button" accessibilityLabel={`${t(`kayit.q.${step}_title`)} ${t(`kayit.q.${step}_sub`)}`} style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Mascot size={150} react={step} />
      </View>
      <Rise>
        <View style={[styles.card, { backgroundColor: P.card, borderColor: P.cardEdge, paddingVertical: 28 }]}>
          <AppText maxFontSizeMultiplier={1.35} style={[styles.interTitle, { color: P.ink }]}>
            {t(`kayit.q.${step}_title`)}
          </AppText>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.cardSub, { color: P.sec, textAlign: 'center' }]}>
            {t(`kayit.q.${step}_sub`)}
          </AppText>
        </View>
      </Rise>
      <View style={{ position: 'absolute', left: 24, right: 24, bottom: Math.max(insets.bottom, 16) + 8 }}>
        <KButton testID="kayit-next" label={t('kayit.q.next')} onPress={onNext} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  skip: { alignSelf: 'center', minHeight: 44, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontFamily: FONT.bold, fontSize: 16, textDecorationLine: 'underline' },
  grid: { paddingHorizontal: 20, gap: 14 },
  row: { flexDirection: 'row', gap: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  center: { textAlign: 'center' },
  semi: { fontFamily: FONT.semi, fontSize: 15 },
  agePill: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  agePillText: { fontFamily: FONT.bold, fontSize: 16, color: '#10301D' },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
  big: { fontFamily: FONT.display, fontSize: 88, lineHeight: 96, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  bigUnit: { fontFamily: FONT.semi, fontSize: 24, lineHeight: 30, marginBottom: 16 },
  card: { borderRadius: 28, borderWidth: 1, padding: 22, gap: 8 },
  cardTitle: { fontFamily: FONT.display, fontSize: 20 },
  cardSub: { fontFamily: FONT.body, fontSize: 15, lineHeight: 21 },
  minorTitle: { fontFamily: FONT.display, fontSize: 28, lineHeight: 33, textAlign: 'center' },
  interTitle: { fontFamily: FONT.display, fontSize: 26, lineHeight: 31, textAlign: 'center' },
});

void Platform;
void fmtDec1;
