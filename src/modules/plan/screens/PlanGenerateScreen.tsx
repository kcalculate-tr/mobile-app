// G33-S1 md.7 — "Planı benim için oluştur" (FinPlanGenerate · FinPlanGenerating · FinPlanGenResult).
// Kademe: Ücretsiz → şablon önizleme (1. gün açık, kalanı bulanık + Fresh paywall); Fresh → Şablonla
// oluştur (deterministik, "Yeniden oluştur" sınırsız); Balance → Koç'la oluştur (algoritma 3 aday →
// meal-plan-generate sıralar + kısa açıklama, 1 koç mesajı). Makro/kalori DAİMA algoritmadan.
// Alerjen seçimi sağlık verisi: ilk kullanımda açık rıza kartı; rıza yoksa alerjen çipleri kapalı.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming, cancelAnimation } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppText, CURVE, PLAN_MOTION, REDUCED, SPRING, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { ArrowCounterClockwise, CaretRight, Check, CircleDashed, Lock, Minus, Plus, Sparkle, SquaresFour, X } from '../../../components/icons';
import { useNutritionSummary } from '../../../hooks/useNutritionSummary';
import { useTier } from '../../../lib/subscription/purchases';
import { readAllergenConsent, recordAllergenConsent } from '../../../lib/consent/store';
import { dayKey } from '../../gun/track/dayClock';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import type { AllergenKey, DietKey, EatkcalOption } from '../types';
import { ALLERGENS, DIETS } from '../types';
import { planAccess } from '../access';
import { candidatePlans, generatePlan, type GenerateResult } from '../generate';
import { askCoachToRank } from '../coach';
import { usePlanStore } from '../store';
import { dayShort, dayTitle, spanLabel, weekDays, weekStartOf } from '../week';
import { loadEatkcalOptions, userInIzmir } from '../actions';
import { GLASS, MiniChip, Thumb, usePlanTones } from '../ui/parts';

type Nav = { goBack: () => void; navigate: (n: string, p?: object) => void; replace?: (n: string, p?: object) => void };
export type PlanGenerateParams = { weekStart?: string } | undefined;
type Phase = 'form' | 'generating' | 'result';

const KCAL_STEP = 50;
const PROTEIN_STEP = 5;

export default function PlanGenerateScreen() {
  const nav = useNavigation() as unknown as Nav;
  const params = (useRoute().params ?? {}) as NonNullable<PlanGenerateParams>;
  const c = usePlanTones();
  const { t: tr, lang: rawLang } = useT();
  const lang: 'tr' | 'en' = rawLang === 'en' ? 'en' : 'tr';
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { user } = useAuth();
  const { tier } = useTier();
  const access = planAccess(tier);
  const coachMode = access.mode === 'coach';
  const { summary } = useNutritionSummary();

  const today = dayKey();
  const ws = params.weekStart ?? weekStartOf(today);
  const allDays = useMemo(() => weekDays(ws), [ws]);
  const catalog = usePlanStore((s) => s.catalog);
  const loadCatalog = usePlanStore((s) => s.loadCatalog);
  const entry = usePlanStore((s) => s.weeks[ws]);
  const applyItems = usePlanStore((s) => s.applyItems);
  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // ── Form durumu ──
  const [kcal, setKcal] = useState(0);
  const [protein, setProtein] = useState(0);
  useEffect(() => {
    if (summary?.targetKcal && !kcal) setKcal(Math.round(summary.targetKcal / 10) * 10);
    if (summary?.targetProtein && !protein) setProtein(Math.round(summary.targetProtein));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.targetKcal, summary?.targetProtein]);
  const tKcal = kcal || 2000;
  const tProtein = protein || 100;
  const [diet, setDiet] = useState<DietKey>('all');
  const [avoid, setAvoid] = useState<AllergenKey[]>([]);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  useEffect(() => {
    void readAllergenConsent().then(setConsent);
  }, []);
  const [days, setDays] = useState<string[]>(() => allDays.filter((d) => d >= today));
  const [izmir, setIzmir] = useState(false);
  const [eatkcalOpts, setEatkcalOpts] = useState<EatkcalOption[]>([]);
  const [withEatkcal, setWithEatkcal] = useState(true);
  const [keep, setKeep] = useState(true);
  useEffect(() => {
    let alive = true;
    void userInIzmir(user?.id ?? null).then((v) => {
      if (!alive) return;
      setIzmir(v);
      if (v) void loadEatkcalOptions().then((o) => alive && setEatkcalOpts(o));
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // ── Oluşturma ──
  const [phase, setPhase] = useState<Phase>('form');
  const [variant, setVariant] = useState(0);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cancelled = useRef(false);
  const [steps, setSteps] = useState(0);

  const input = (v: number) => ({
    recipes: catalog?.recipes ?? [],
    days,
    target: { kcal: tKcal, protein: tProtein },
    diet,
    avoid: consent ? avoid : [],
    eatkcal: izmir && withEatkcal ? eatkcalOpts : null,
    keep: entry?.items ?? [],
    keepPlanned: keep,
    variant: v,
    lang,
  });

  const stepList = useMemo(() => {
    const out = [tr('plan.step_target', { kcal: tKcal, protein: tProtein })];
    if (consent && avoid.length) out.push(tr('plan.step_allergen', { list: avoid.map((a) => tr(`plan.allergen.${a}`)).join(', ') }));
    if (izmir && withEatkcal) out.push(tr('plan.step_eatkcal'));
    out.push(tr('plan.step_days', { days: spanLabel(days, lang) }));
    return out;
  }, [avoid, consent, days, izmir, lang, tKcal, tProtein, tr, withEatkcal]);

  const run = async (v: number) => {
    cancelled.current = false;
    setNotice(null);
    setNote(null);
    setSteps(0);
    setPhase('generating');
    const gap = reduced ? REDUCED.duration : coachMode ? PLAN_MOTION.genRowGapBalance : PLAN_MOTION.genRowGapFresh;
    const rows = stepList.length;
    // Satırlar sırayla akar (Balance 550 · Fresh 330 aralık); koç isteği aynı anda gider.
    const ticker = (async () => {
      for (let i = 1; i <= rows; i++) {
        await new Promise((r) => setTimeout(r, gap));
        if (cancelled.current) return;
        setSteps(i);
      }
    })();
    let chosen: GenerateResult;
    let coachNote: string | null = null;
    if (coachMode) {
      const cands = candidatePlans(input(v), 3);
      const out = await askCoachToRank(cands, { lang, target: { kcal: tKcal, protein: tProtein }, avoid: consent ? avoid : [], diet });
      if (out.ok) {
        chosen = cands[out.index];
        coachNote = out.note;
      } else {
        chosen = cands[0];
        setNotice(tr(out.reason === 'quota' ? 'plan.coach_quota' : 'plan.coach_fallback'));
      }
    } else {
      chosen = generatePlan(input(v));
    }
    await ticker;
    if (cancelled.current) return;
    haptic(coachMode ? 'success' : 'light');
    setResult(chosen);
    setNote(coachNote);
    setPhase('result');
  };

  const apply = async () => {
    if (!result) return;
    if (!access.canApply) {
      nav.navigate('SubPaywall', { from: 'meal_plan', plan: 'fresh' });
      return;
    }
    const ok = await applyItems(ws, result.items, coachMode && note ? 'coach' : 'template', note);
    if (ok) {
      haptic('success');
      nav.goBack();
      // Planı uygula: haftanın doluluk noktaları kademeli dolar (MealPlan `applied` ile).
      setTimeout(() => nav.navigate('MealPlan', { weekStart: ws, applied: Date.now() }), 0);
    } else setNotice(tr('plan.toast_failed'));
  };

  const regen = () => {
    haptic('light');
    if (!access.canApply && access.mode === 'preview') {
      nav.navigate('SubPaywall', { from: 'meal_plan', plan: 'fresh' });
      return;
    }
    const v = variant + (coachMode ? 3 : 1);
    setVariant(v);
    void run(v);
  };

  const noRecipes = (catalog?.recipes.length ?? 0) === 0;
  const close = () => {
    cancelled.current = true;
    nav.goBack();
  };

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]} testID="plan-generate">
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <AppText style={[styles.title, { color: c.ink }]} accessibilityRole="header">
          {tr('plan.gen_title')}
        </AppText>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={tr('common.close')} style={[styles.close, { backgroundColor: c.nested }]} testID="plan-generate-close">
          <X size={18} color={c.ink} />
        </Pressable>
      </View>

      {phase === 'form' ? (
        <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
          {coachMode ? (
            <View style={[styles.modeCard, { backgroundColor: c.card }]} testID="plan-mode-coach">
              <Image source={GLASS.bowl} style={styles.modeBowl} resizeMode="contain" />
              <View style={styles.flex1}>
                <AppText style={[styles.modeTitle, { color: c.ink }]}>{tr('plan.gen_coach_h')}</AppText>
                <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.gen_coach_sub')}</AppText>
              </View>
              <MiniChip text="Balance" lime />
            </View>
          ) : (
            <View style={[styles.modeGroup, { backgroundColor: c.card }]} testID="plan-mode-template">
              <View style={styles.modeRow}>
                <View style={[styles.modeIcon, { backgroundColor: c.nested }]}>
                  <SquaresFour size={18} color={c.ink} />
                </View>
                <View style={styles.flex1}>
                  <AppText style={[styles.modeTitle, { color: c.ink }]}>{tr('plan.gen_template_h')}</AppText>
                  <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.gen_template_sub')}</AppText>
                </View>
                <MiniChip text="Fresh" lime />
              </View>
              <Pressable onPress={() => nav.navigate('SubPaywall', { from: 'meal_plan', plan: 'balance' })} accessibilityRole="button" style={[styles.upsellRow, { borderTopColor: c.line }]} testID="plan-upsell-balance">
                <Image source={GLASS.bowl} style={styles.upsellBowl} resizeMode="contain" />
                <AppText style={[styles.upsellText, { color: c.ink }]}>{tr('plan.gen_upsell')}</AppText>
                <CaretRight size={16} color={c.sec} />
              </Pressable>
            </View>
          )}

          <Section title={tr('plan.daily_target')} right={tr('plan.from_profile')} />
          <View style={[styles.group, { backgroundColor: c.card }]}>
            <Stepper icon={GLASS.flame} label={tr('plan.kcal')} value={`${tKcal} kcal`} onMinus={() => setKcal(Math.max(1200, tKcal - KCAL_STEP))} onPlus={() => setKcal(Math.min(4500, tKcal + KCAL_STEP))} minusLabel={tr('plan.kcal_minus_a11y')} plusLabel={tr('plan.kcal_plus_a11y')} />
            <Stepper icon={GLASS.trophy} label={tr('plan.protein')} value={`${tProtein} g`} onMinus={() => setProtein(Math.max(30, tProtein - PROTEIN_STEP))} onPlus={() => setProtein(Math.min(300, tProtein + PROTEIN_STEP))} minusLabel={tr('plan.protein_minus_a11y')} plusLabel={tr('plan.protein_plus_a11y')} border />
          </View>

          <Section title={tr('plan.diet_h')} />
          <View style={styles.chipsWrap}>
            {DIETS.map((d) => (
              <Choice key={d} label={tr(`plan.diet.${d}`)} selected={diet === d} onPress={() => setDiet(d)} testID={`plan-diet-${d}`} />
            ))}
          </View>

          <Section title={tr('plan.allergens_h')} />
          {consent === false && consentOpen ? (
            <View style={[styles.consent, { backgroundColor: c.card, borderColor: c.line2 }]} testID="plan-allergen-consent">
              <AppText style={[styles.modeTitle, { color: c.ink }]} accessibilityRole="header">
                {tr('plan.consent_title')}
              </AppText>
              <AppText style={[styles.small, { color: c.sec, lineHeight: 19 }]}>{tr('plan.consent_body')}</AppText>
              <Pressable
                onPress={() => {
                  haptic('light');
                  setConsent(true);
                  setConsentOpen(false);
                  void recordAllergenConsent(true);
                }}
                accessibilityRole="button"
                style={[styles.blackBtn, { backgroundColor: c.chipSel }]}
                testID="plan-consent-accept"
              >
                <AppText style={[styles.blackBtnText, { color: c.chipSelInk }]}>{tr('plan.consent_accept')}</AppText>
              </Pressable>
              <Pressable onPress={() => setConsentOpen(false)} accessibilityRole="button" style={styles.textBtn} testID="plan-consent-skip">
                <AppText style={[styles.textBtnText, { color: c.ink }]}>{tr('plan.consent_skip')}</AppText>
              </Pressable>
            </View>
          ) : null}
          <View style={[styles.chipsWrap, consent ? null : { opacity: 0.45 }]}>
            {ALLERGENS.map((a) => (
              <Choice
                key={a}
                label={tr(`plan.allergen.${a}`)}
                selected={!!consent && avoid.includes(a)}
                check
                disabledLook={!consent}
                onPress={() => {
                  if (!consent) {
                    setConsentOpen(true);
                    return;
                  }
                  setAvoid((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
                }}
                testID={`plan-allergen-${a}`}
              />
            ))}
          </View>
          <AppText style={[styles.foot, { color: c.sec }]}>{consent ? tr('plan.allergens_foot') : tr('plan.allergens_locked')}</AppText>

          <Section title={tr('plan.days_h')} right={tr('plan.days_n', { n: days.length })} />
          <View style={styles.daysRow}>
            {allDays.map((d) => {
              const past = d < today;
              const on = days.includes(d);
              return (
                <Pressable
                  key={d}
                  disabled={past}
                  onPress={() => {
                    haptic('selection');
                    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: past }}
                  accessibilityLabel={dayTitle(d, lang)}
                  style={[styles.dayBtn, { backgroundColor: on ? c.chipSel : c.card, opacity: past ? 0.4 : 1 }]}
                  testID={`plan-gen-day-${d}`}
                >
                  <AppText style={[styles.dayBtnText, { color: on ? c.chipSelInk : c.sec }]}>{dayShort(d, lang)}</AppText>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.group, { backgroundColor: c.card }]}>
            <Toggle
              label={tr('plan.include_eatkcal')}
              sub={izmir ? tr('plan.include_eatkcal_sub') : tr('plan.include_eatkcal_off')}
              value={izmir && withEatkcal}
              disabled={!izmir}
              onChange={setWithEatkcal}
              testID="plan-toggle-eatkcal"
            />
            <Toggle label={tr('plan.keep_planned')} sub={tr('plan.keep_planned_sub')} value={keep} onChange={setKeep} border testID="plan-toggle-keep" />
          </View>
          {noRecipes ? <AppText style={[styles.foot, { color: c.sec }]}>{tr('plan.offline')}</AppText> : null}
        </ScrollView>
      ) : null}

      {phase === 'generating' ? (
        <Generating coach={coachMode} steps={stepList} shown={steps} days={days} lang={lang} onCancel={() => {
          cancelled.current = true;
          setPhase('form');
        }} />
      ) : null}

      {phase === 'result' && result ? (
        <Result
          result={result}
          coach={coachMode}
          note={note}
          notice={notice}
          days={days}
          openDays={access.openDays}
          lang={lang}
          onUnlock={() => nav.navigate('SubPaywall', { from: 'meal_plan', plan: 'fresh' })}
          onUpsell={() => nav.navigate('SubPaywall', { from: 'meal_plan', plan: 'balance' })}
        />
      ) : null}

      {phase !== 'generating' ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 10, backgroundColor: c.bg }]}>
          {phase === 'form' ? (
            <Pressable
              disabled={!days.length || noRecipes}
              onPress={() => void run(variant)}
              accessibilityRole="button"
              accessibilityState={{ disabled: !days.length || noRecipes }}
              style={[styles.cta, { backgroundColor: c.lime, opacity: !days.length || noRecipes ? 0.5 : 1 }]}
              testID="plan-generate-cta"
            >
              <Sparkle size={18} color={c.onLime} weight="fill" />
              <AppText style={[styles.ctaText, { color: c.onLime }]}>{coachMode ? tr('plan.gen_coach_cta') : tr('plan.gen_template_cta')}</AppText>
            </Pressable>
          ) : (
            <View style={styles.resultBtns}>
              <Pressable onPress={regen} accessibilityRole="button" style={[styles.outline, { borderColor: c.line2 }]} testID="plan-regenerate">
                <ArrowCounterClockwise size={16} color={c.ink} />
                <AppText style={[styles.outlineText, { color: c.ink }]}>{tr('plan.regenerate')}</AppText>
              </Pressable>
              <Pressable onPress={() => void apply()} accessibilityRole="button" style={[styles.ctaHalf, { backgroundColor: c.lime }]} testID="plan-apply">
                {!access.canApply ? <Lock size={16} color={c.onLime} weight="bold" /> : null}
                <AppText style={[styles.ctaText, { color: c.onLime }]}>{access.canApply ? tr('plan.apply') : tr('plan.preview_cta')}</AppText>
              </Pressable>
            </View>
          )}
          <AppText style={[styles.disclaimer, { color: c.sec }]} testID="plan-disclaimer">
            {tr('plan.disclaimer')}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, right }: { title: string; right?: string }) {
  const c = usePlanTones();
  return (
    <View style={styles.section}>
      <AppText style={[styles.sectionTitle, { color: c.ink }]} accessibilityRole="header">
        {title}
      </AppText>
      {right ? <AppText style={[styles.small, { color: c.sec }]}>{right}</AppText> : null}
    </View>
  );
}

function Stepper({ icon, label, value, onMinus, onPlus, minusLabel, plusLabel, border }: { icon: number; label: string; value: string; onMinus: () => void; onPlus: () => void; minusLabel: string; plusLabel: string; border?: boolean }) {
  const c = usePlanTones();
  return (
    <View style={[styles.stepper, border ? { borderTopWidth: 1, borderTopColor: c.line } : null]}>
      <Image source={icon} style={styles.stepIcon} resizeMode="contain" />
      <AppText style={[styles.stepLabel, { color: c.ink }]}>{label}</AppText>
      <Pressable onPress={() => { haptic('selection'); onMinus(); }} accessibilityRole="button" accessibilityLabel={minusLabel} style={[styles.round, { borderColor: c.line2 }]}>
        <Minus size={16} color={c.ink} />
      </Pressable>
      <AppText style={[styles.stepVal, { color: c.ink }]} accessibilityLiveRegion="polite">
        {value}
      </AppText>
      <Pressable onPress={() => { haptic('selection'); onPlus(); }} accessibilityRole="button" accessibilityLabel={plusLabel} style={[styles.round, { borderColor: c.line2 }]}>
        <Plus size={16} color={c.ink} />
      </Pressable>
    </View>
  );
}

function Choice({ label, selected, onPress, check, disabledLook, testID }: { label: string; selected: boolean; onPress: () => void; check?: boolean; disabledLook?: boolean; testID?: string }) {
  const c = usePlanTones();
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole={check ? 'checkbox' : 'radio'}
      accessibilityState={check ? { checked: selected, disabled: disabledLook } : { selected }}
      style={[styles.choice, selected ? { backgroundColor: c.chipSel, borderColor: c.chipSel } : { backgroundColor: c.card, borderColor: c.line2 }]}
      testID={testID}
    >
      {selected && check ? <Check size={14} color={c.chipSelInk} weight="bold" /> : null}
      <AppText style={[styles.choiceText, { color: selected ? c.chipSelInk : c.ink }]}>{label}</AppText>
    </Pressable>
  );
}

function Toggle({ label, sub, value, onChange, disabled, border, testID }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; border?: boolean; testID?: string }) {
  const c = usePlanTones();
  return (
    <View style={[styles.toggle, border ? { borderTopWidth: 1, borderTopColor: c.line } : null]}>
      <View style={styles.flex1}>
        <AppText style={[styles.toggleLabel, { color: c.ink }]}>{label}</AppText>
        <AppText style={[styles.small, { color: c.sec }]}>{sub}</AppText>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          haptic('selection');
          onChange(v);
        }}
        trackColor={{ true: c.lime, false: c.track }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
        testID={testID}
      />
    </View>
  );
}

// ── Koç oluşturuyor (iskelet) ──────────────────────────────────────────────
function Generating({ coach, steps, shown, days, lang, onCancel }: { coach: boolean; steps: string[]; shown: number; days: string[]; lang: 'tr' | 'en'; onCancel: () => void }) {
  const c = usePlanTones();
  const { t: tr } = useT();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const ring = useSharedValue(0);
  const bowl = useSharedValue(reduced ? 1 : PLAN_MOTION.genBowlFrom);
  useEffect(() => {
    if (reduced) return;
    // Kase AI yayıyla 0,9 → 1; halka 990 döngü (yalnız işlem sürerken).
    bowl.value = withSpring(1, SPRING.ai);
    ring.value = withRepeat(withTiming(1, { duration: PLAN_MOTION.genRing, easing: CURVE.standard }), -1, false);
    return () => cancelAnimation(ring);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  const ringSt = useAnimatedStyle(() => ({ transform: [{ rotate: `${ring.value * 360}deg` }] }));
  const bowlSt = useAnimatedStyle(() => ({ transform: [{ scale: bowl.value }] }));
  const rowIn = () => (reduced ? FadeIn.duration(REDUCED.duration) : FadeInDown.duration(PLAN_MOTION.genRow));
  return (
    <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]} testID="plan-generating" accessibilityLiveRegion="polite">
      <View style={styles.genHead}>
        <View style={styles.genBowlWrap}>
          {coach ? (
            <Animated.View style={[styles.genRing, { borderColor: c.lime, borderTopColor: 'transparent' }, ringSt]} />
          ) : null}
          <Animated.View style={bowlSt}>
            {coach ? <Image source={GLASS.bowl} style={styles.genBowl} resizeMode="contain" /> : <SquaresFour size={26} color={c.ink} />}
          </Animated.View>
        </View>
        <View style={styles.flex1}>
          <AppText style={[styles.modeTitle, { color: c.ink }]}>{coach ? tr('plan.generating_h') : tr('plan.gen_template_h')}</AppText>
          <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.generating_sub')}</AppText>
        </View>
      </View>
      <View style={[styles.group, { backgroundColor: c.card, padding: 14, gap: 10 }]}>
        {steps.map((s, i) =>
          i < shown ? (
            <Animated.View key={s} entering={rowIn()} style={styles.stepRow}>
              <View style={[styles.stepCheck, { backgroundColor: c.lime }]}>
                <Check size={12} color={c.onLime} weight="bold" />
              </View>
              <AppText style={[styles.stepText, { color: c.ink }]}>{s}</AppText>
            </Animated.View>
          ) : i === shown ? (
            <View key={s} style={styles.stepRow}>
              <CircleDashed size={20} color={c.line2} />
              <AppText style={[styles.stepText, { color: c.sec }]}>{s}</AppText>
            </View>
          ) : null,
        )}
      </View>
      {days.map((d) => (
        <View key={d} style={[styles.skel, { backgroundColor: c.card }]}>
          <AppText style={[styles.skelDay, { color: c.ink }]}>{dayShort(d, lang)}</AppText>
          <View style={[styles.skelBar, { backgroundColor: c.track, width: '40%' }]} />
          <View style={styles.flex1} />
          <View style={[styles.skelBar, { backgroundColor: c.track, width: 44 }]} />
        </View>
      ))}
      <Pressable onPress={onCancel} accessibilityRole="button" style={[styles.outlineWide, { borderColor: c.line2 }]} testID="plan-generating-cancel">
        <AppText style={[styles.outlineText, { color: c.ink }]}>{tr('plan.cancel')}</AppText>
      </Pressable>
    </ScrollView>
  );
}

// ── Sonuç ──────────────────────────────────────────────────────────────────
function Result({ result, coach, note, notice, days, openDays, lang, onUnlock, onUpsell }: { result: GenerateResult; coach: boolean; note: string | null; notice: string | null; days: string[]; openDays: number | null; lang: 'tr' | 'en'; onUnlock: () => void; onUpsell: () => void }) {
  const c = usePlanTones();
  const { t: tr } = useT();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const enter = reduced ? FadeIn.duration(REDUCED.duration) : FadeIn.duration(PLAN_MOTION.genRow);
  return (
    <Animated.ScrollView {...SCROLL_KEYBOARD} entering={enter} exiting={FadeOut.duration(reduced ? REDUCED.duration : PLAN_MOTION.regen)} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 140 }]} testID="plan-result">
      <AppText style={[styles.resultH, { color: c.ink }]} accessibilityRole="header">
        {tr('plan.result_h')}
      </AppText>
      <AppText style={[styles.small, { color: c.sec, marginTop: -8 }]}>{spanLabel(days, lang)}</AppText>
      {notice ? <AppText style={[styles.notice, { color: c.ink, backgroundColor: c.nested }]} testID="plan-result-notice">{notice}</AppText> : null}
      {coach && note ? (
        <View style={styles.noteRow} testID="plan-coach-note">
          <Image source={GLASS.bowl} style={styles.noteBowl} resizeMode="contain" />
          <View style={[styles.noteBubble, { backgroundColor: c.card }]}>
            <AppText style={[styles.noteText, { color: c.ink }]}>{note}</AppText>
          </View>
        </View>
      ) : !coach ? (
        <View style={[styles.templNote, { backgroundColor: c.card }]}>
          <MiniChip text={tr('plan.result_template_badge')} />
          <AppText style={[styles.noteText, { color: c.ink }]}>{tr('plan.result_template_note')}</AppText>
        </View>
      ) : null}
      {result.days.map((d, i) => {
        const its = result.items.filter((x) => x.date === d.date);
        const locked = openDays != null && i >= openDays;
        return (
          <View key={d.date} style={[styles.resDay, { backgroundColor: c.card }]} testID={`plan-result-day-${d.date}`} accessibilityElementsHidden={locked} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}>
            <View style={styles.resHead}>
              <AppText style={[styles.resTitle, { color: c.ink }]}>{dayTitle(d.date, lang)}</AppText>
              <View style={styles.flex1} />
              <MiniChip text={tr('plan.day_kcal', { n: d.kcal })} />
              <MiniChip text={tr('plan.day_protein', { n: d.protein })} />
            </View>
            <View style={styles.resBody}>
              <View style={styles.thumbs}>
                {its.map((x) => (
                  <View key={x.id} style={styles.thumbOverlap}>
                    <Thumb size={30} />
                  </View>
                ))}
              </View>
              <AppText style={[styles.resNames, { color: c.sec }]} numberOfLines={3}>
                {its.map((x) => x.name).join(', ')}
              </AppText>
            </View>
            {locked ? <BlurView intensity={18} tint={c.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
          </View>
        );
      })}
      {openDays != null ? (
        <View style={[styles.lock, { backgroundColor: c.card, borderColor: c.lime }]} testID="plan-result-lock">
          <AppText style={[styles.modeTitle, { color: c.ink }]}>{tr('plan.preview_lock')}</AppText>
          <AppText style={[styles.small, { color: c.sec, lineHeight: 19 }]}>{tr('plan.preview_lock_sub')}</AppText>
          <Pressable onPress={onUnlock} accessibilityRole="button" style={[styles.blackBtn, { backgroundColor: c.chipSel }]} testID="plan-result-unlock">
            <AppText style={[styles.blackBtnText, { color: c.chipSelInk }]}>{tr('plan.preview_cta')}</AppText>
          </Pressable>
        </View>
      ) : !coach ? (
        <Pressable onPress={onUpsell} accessibilityRole="button" style={[styles.upsellCard, { backgroundColor: c.card, borderColor: c.lime }]} testID="plan-result-upsell">
          <Image source={GLASS.bowl} style={styles.modeBowl} resizeMode="contain" />
          <View style={styles.flex1}>
            <AppText style={[styles.modeTitle, { color: c.ink }]}>{tr('plan.gen_upsell')}</AppText>
            <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.gen_upsell_sub')}</AppText>
          </View>
          <CaretRight size={16} color={c.sec} />
        </Pressable>
      ) : null}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, gap: 12 },
  small: { fontSize: 13 },
  modeCard: { borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeGroup: { borderRadius: 20, overflow: 'hidden' },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  modeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeBowl: { width: 44, height: 30 },
  modeTitle: { fontSize: 16, fontWeight: '700' },
  upsellRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 48, borderTopWidth: 1 },
  upsellBowl: { width: 26, height: 18 },
  upsellText: { flex: 1, fontSize: 14, fontWeight: '600' },
  section: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  group: { borderRadius: 20, overflow: 'hidden' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 60 },
  stepIcon: { width: 22, height: 22 },
  stepLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepVal: { minWidth: 86, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  choiceText: { fontSize: 14, fontWeight: '600' },
  foot: { fontSize: 13, lineHeight: 18 },
  consent: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 10 },
  blackBtn: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  blackBtnText: { fontSize: 15, fontWeight: '700' },
  textBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  textBtnText: { fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  daysRow: { flexDirection: 'row', gap: 6 },
  dayBtn: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayBtnText: { fontSize: 13, fontWeight: '700' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 64, paddingVertical: 8 },
  toggleLabel: { fontSize: 15, fontWeight: '600' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  cta: { minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaHalf: { flex: 1.2, minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ctaText: { fontSize: 17, fontWeight: '700' },
  resultBtns: { flexDirection: 'row', gap: 10 },
  outline: { flex: 1, minHeight: 56, borderRadius: 28, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  outlineWide: { minHeight: 52, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  outlineText: { fontSize: 15, fontWeight: '600' },
  disclaimer: { fontSize: 12, textAlign: 'center' },
  genHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  genBowlWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  genRing: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 3 },
  genBowl: { width: 40, height: 28 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  stepCheck: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, fontSize: 14 },
  skel: { borderRadius: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  skelDay: { width: 36, fontSize: 13, fontWeight: '700' },
  skelBar: { height: 14, borderRadius: 7 },
  resultH: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24, lineHeight: 30 },
  notice: { borderRadius: 14, padding: 12, fontSize: 14, lineHeight: 19, overflow: 'hidden' },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteBowl: { width: 28, height: 20, marginTop: 6 },
  noteBubble: { flex: 1, borderRadius: 18, padding: 12 },
  noteText: { fontSize: 14, lineHeight: 20 },
  templNote: { borderRadius: 18, padding: 12, gap: 8, alignItems: 'flex-start' },
  resDay: { borderRadius: 18, padding: 12, gap: 8, overflow: 'hidden' },
  resHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resTitle: { fontSize: 15, fontWeight: '700' },
  resBody: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  thumbs: { flexDirection: 'row' },
  thumbOverlap: { marginRight: -8 },
  resNames: { flex: 1, fontSize: 13, lineHeight: 18, marginLeft: 8 },
  lock: { borderRadius: 20, borderWidth: 1.5, padding: 16, gap: 10 },
  upsellCard: { borderRadius: 20, borderWidth: 1.5, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
