// G42-S1 md.4 — L1 hesaplama + L2 plan sonucu. Hesap MEVCUT kişisel plan motoru (G34 computePlan; plan.ts).
// L1: büyük halka dolar, sayı artar, satır halkaları sırayla (her satırda hafif titreşim, sonda başarı);
// geri dönüşte cevap değiştiyse 1,5 sn kısa sürüm; değişmediyse doğrudan L2. Ağ yoksa halkalar durur + kart.
// L2: kalori sayarak gelir (990 ms), makro halkaları, kilo tahmini ARALIK bandı (söz değil), öğün dağılımı,
// Keşfet/G33 kataloğundan uygun 3 tarif, koşullu eatkcal kartı ("İzmir'deysen…"), sağlık verisi açık rızası.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { recordHealthConsent } from '../../../lib/consent/store';
import { healthConsentGiven } from '../../personalPlan/api';
import { DrawPath, RingProgress, useCountUp } from '../../personalPlan/ui/motion';
import { GLASS } from '../../personalPlan/ui/parts';
import { fetchRecipeCatalog } from '../../plan/client';
import { loadEatkcalProducts, productToOption } from '../../plan/actions';
import type { RecipeInfo } from '../../plan/types';
import { CheckBoxRow, FONT, KBackdrop, KButton, Mascot, NoticeCard, Rise, TopBar } from '../ui/parts';
import { useEdgeBack } from '../ui/edge';
import { K_MOTION, useK } from '../ui/theme';
import { computeKayitPlan, pickRecipes, planSignature, type KPlan } from '../plan';
import { mealsSplit } from '../model';
import { fmtDec1, fmtInt, monthRange } from '../format';
import { flushDraft, useKayit } from '../store';
import { readMuscleSurplus } from '../settings';
import { kTrack } from '../events';

const todayIso = () => new Date().toISOString().slice(0, 10);

// ─── L1 ───────────────────────────────────────────────────────────────────────
export function CalcScreen() {
  const { t, lang } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const navigation = useNavigation<any>();
  const answers = useKayit((s) => s.answers);
  const calcDone = useKayit((s) => s.calcDone);
  const planSig = useKayit((s) => s.planSig);
  const sig = planSignature(answers);
  const shortRun = calcDone && planSig !== sig;
  const total = reduced ? 600 : shortRun ? K_MOTION.calcShort : K_MOTION.calcFull;
  const [plan, setPlan] = useState<KPlan | null>(null);
  const [offline, setOffline] = useState(false);
  const [row, setRow] = useState(0); // 0..3 tamamlanan satır
  const [run, setRun] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Cevap değişmediyse doğrudan L2 (kısa sürüm bile gerekmez).
    if (calcDone && planSig === sig && useKayit.getState().plan) {
      navigation.replace('KResult');
      return;
    }
    let alive = true;
    (async () => {
      const net = await NetInfo.fetch().catch(() => null);
      if (!alive) return;
      if (net && net.isConnected === false) {
        setOffline(true);
        return;
      }
      setOffline(false);
      const surplus = await readMuscleSurplus();
      const p = computeKayitPlan(useKayit.getState().answers, { currentYear: new Date().getFullYear(), startIso: todayIso(), muscleSurplus: surplus });
      if (!alive) return;
      setPlan(p);
      const step = total / 4;
      [1, 2, 3].forEach((i) => {
        timers.current.push(
          setTimeout(() => {
            setRow(i);
            haptic('light');
          }, step * i),
        );
      });
      timers.current.push(
        setTimeout(() => {
          haptic('success');
          const st = useKayit.getState();
          st.setPlan(p, sig);
          st.setCalcDone(true);
          kTrack.planReady(shortRun);
          void flushDraft('result');
          navigation.replace('KResult');
        }, total),
      );
    })();
    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const kcal = useCountUp(plan?.calories ?? 0, !!plan && !offline);
  const rows = [
    { done: row >= 1, active: row === 0, idle: 'kayit.plan.calc_kcal', act: 'kayit.plan.calc_kcal', ok: 'kayit.plan.calc_kcal_done' },
    { done: row >= 2, active: row === 1, idle: 'kayit.plan.calc_macros', act: 'kayit.plan.calc_macros_active', ok: 'kayit.plan.calc_macros_done' },
    { done: row >= 3, active: row === 2, idle: 'kayit.plan.calc_meals', act: 'kayit.plan.calc_meals_active', ok: 'kayit.plan.calc_meals_done' },
  ];
  return (
    <View style={{ flex: 1 }} testID="kayit-calc">
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <KBackdrop shift={20} />
      <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <TopBar onBack={null} right={<Mascot size={64} react={row} />} />
        <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
          <AppText accessibilityRole="header" maxFontSizeMultiplier={1.35} style={[styles.h1, { color: P.ink }]}>
            {t('kayit.plan.calc_title')}
          </AppText>
        </View>
        <View style={{ alignItems: 'center', marginTop: 28 }} accessible accessibilityLabel={`${fmtInt(kcal, lang)} ${t('kayit.plan.kcal')}`}>
          <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
            <View style={StyleSheet.absoluteFill}>
              <RingProgress size={220} stroke={14} progress={offline ? 0.15 : Math.min(1, (row + 1) / 3)} color={P.accent} track={P.ringTrack} />
            </View>
            <AppText maxFontSizeMultiplier={1.15} style={[styles.calcNum, { color: P.ink }]}>
              {fmtInt(kcal, lang)}
            </AppText>
            <AppText maxFontSizeMultiplier={1.2} style={[styles.calcUnit, { color: P.sec }]}>
              {t('kayit.plan.kcal')}
            </AppText>
          </View>
        </View>
        <View style={{ paddingHorizontal: 24, marginTop: 28, gap: 12 }}>
          {offline ? (
            <NoticeCard testID="kayit-calc-offline" title={t('kayit.plan.offline_title')} sub={t('kayit.plan.offline_sub')} action={{ label: t('kayit.plan.retry'), onPress: () => setRun((r) => r + 1) }} />
          ) : null}
          {rows.map((r, i) => (
            <View key={i} style={[styles.calcRow, { backgroundColor: P.card, borderColor: P.cardEdge }]} accessible accessibilityLabel={t(r.done ? r.ok : r.active ? r.act : r.idle)}>
              <RingProgress size={28} stroke={4} progress={r.done ? 1 : r.active && !offline ? 0.5 : 0} color={P.ringFill} track={P.ringTrack} />
              <AppText maxFontSizeMultiplier={1.4} style={[styles.calcRowText, { color: r.done || r.active ? P.ink : P.sec }]}>
                {t(r.done ? r.ok : r.active ? r.act : r.idle)}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── L2 ───────────────────────────────────────────────────────────────────────
type EatPick = { name: string; kcal: number; img: string | null } | null;

export function ResultScreen() {
  const { t, lang } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const answers = useKayit((s) => s.answers);
  const stored = useKayit((s) => s.plan);
  const healthOk = useKayit((s) => s.healthOk);
  const setHealthOk = useKayit((s) => s.setHealthOk);
  const plan = useMemo(() => stored ?? computeKayitPlan(answers, { currentYear: new Date().getFullYear(), startIso: todayIso() }), [stored, answers]);
  const [recipes, setRecipes] = useState<RecipeInfo[]>([]);
  const [eat, setEat] = useState<EatPick>(null);
  const [consentKnown, setConsentKnown] = useState(false);
  const back = () => navigation.goBack();
  const edge = useEdgeBack(back);

  useEffect(() => {
    void healthConsentGiven().then(setConsentKnown);
    if (!plan) return;
    let alive = true;
    void fetchRecipeCatalog().then((c) => {
      if (alive) setRecipes(pickRecipes(c.recipes, answers, plan));
    });
    void loadEatkcalProducts().then((list) => {
      if (!alive) return;
      const dinner = plan.meals.find((m) => m.slot === 'dinner')?.kcal ?? plan.calories / 3;
      const best = list
        .map((p) => ({ p, o: productToOption(p) }))
        .filter((x) => x.o)
        .sort((x, y) => Math.abs(x.o!.kcal - dinner) - Math.abs(y.o!.kcal - dinner))[0];
      setEat(best ? { name: best.o!.name, kcal: Math.round(best.o!.kcal), img: best.p.img ?? null } : null);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.calories]);

  if (!plan) return null;
  const split = mealsSplit(answers.meals);
  const okConsent = consentKnown || healthOk;
  const save = async () => {
    if (healthOk && !consentKnown) void recordHealthConsent(true, 'personal_plan').catch(() => {});
    await flushDraft('signup');
    navigation.navigate('KSignup', { path: 'a' });
  };

  return (
    <View style={{ flex: 1 }} {...edge} testID="kayit-result">
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <KBackdrop shift={21} />
      <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <TopBar onBack={back} progress={{ index: 0, total: 1 }} />
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <AppText testID="kayit-result-title" accessibilityRole="header" maxFontSizeMultiplier={1.35} style={[styles.h1, { color: P.ink, flex: 1 }]}>
              {t('kayit.plan.ready_title')}
            </AppText>
            <Mascot size={92} />
          </View>
          <View style={{ paddingHorizontal: 20, gap: 14, marginTop: 8 }}>
            <Rise delay={0}>
              <DailyCard plan={plan} />
            </Rise>
            {plan.rangeFrom && plan.rangeTo && answers.weightKg ? (
              <Rise delay={K_MOTION.stagger}>
                <WeightCard from={answers.weightKg} to={answers.targetWeightKg ?? answers.weightKg} range={monthRange(plan.rangeFrom, plan.rangeTo, lang, true)} units={answers.units} />
              </Rise>
            ) : null}
            <Rise delay={K_MOTION.stagger * 2}>
              <MealSplitCard plan={plan} />
            </Rise>
            {plan.muscle ? (
              <AppText maxFontSizeMultiplier={1.4} style={[styles.note, { color: P.sec }]}>
                {t('kayit.plan.muscle_note', { kcal: plan.result.steps.requestedDelta * -1 })}
              </AppText>
            ) : null}
            <AppText maxFontSizeMultiplier={1.4} style={[styles.note, { color: P.sec }]}>
              {t('kayit.plan.estimate_note')}
            </AppText>
          </View>
          {recipes.length ? (
            <View style={{ marginTop: 20 }}>
              <View style={styles.sectionHead}>
                <AppText accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.h2, { color: P.ink }]}>
                  {t('kayit.plan.recipes_title')}
                </AppText>
                <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
                  {split.snack ? t('kayit.plan.meals_summary', { main: split.main, snack: split.snack }) : t('kayit.plan.meals_summary_nosnack', { main: split.main })}
                </AppText>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                {recipes.map((r) => (
                  <View key={r.key} testID={`kayit-recipe-${r.key}`} accessible accessibilityLabel={`${lang === 'en' ? r.nameEn : r.nameTr}, ${Math.round(r.macros.kcal)} ${t('kayit.plan.kcal')}`} style={[styles.recipe, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
                    <View style={[styles.recipeImg, { backgroundColor: P.accentSoft }]}>
                      <Image source={GLASS.bowl} style={{ width: 72, height: 72 }} resizeMode="contain" />
                    </View>
                    <View style={{ padding: 12 }}>
                      <AppText numberOfLines={2} maxFontSizeMultiplier={1.3} style={[styles.recipeName, { color: P.ink }]}>
                        {lang === 'en' ? r.nameEn : r.nameTr}
                      </AppText>
                      <AppText maxFontSizeMultiplier={1.3} style={[styles.small, { color: P.sec }]}>
                        {fmtInt(r.macros.kcal, lang)} {t('kayit.plan.kcal')}
                      </AppText>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 14 }}>
            <View testID="kayit-eatkcal" style={[styles.eat, { backgroundColor: P.card, borderColor: P.cardEdge }]} accessible accessibilityLabel={`${t('kayit.plan.eatkcal_title')}. ${eat ? t('kayit.plan.eatkcal_sub', { name: eat.name, kcal: eat.kcal }) : t('kayit.plan.eatkcal_fallback')}`}>
              <View style={[styles.eatImg, { backgroundColor: P.accentSoft }]}>
                {eat?.img ? <Image source={{ uri: eat.img }} style={{ width: 64, height: 64, borderRadius: 14 }} /> : <Image source={GLASS.bowl} style={{ width: 48, height: 48 }} resizeMode="contain" />}
              </View>
              <View style={{ flex: 1 }}>
                <AppText maxFontSizeMultiplier={1.4} style={[styles.eatTitle, { color: P.ink }]}>
                  {t('kayit.plan.eatkcal_title')}
                </AppText>
                <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
                  {eat ? t('kayit.plan.eatkcal_sub', { name: eat.name, kcal: eat.kcal }) : t('kayit.plan.eatkcal_fallback')}
                </AppText>
              </View>
            </View>
            {!consentKnown ? <CheckBoxRow testID="kayit-health-consent" checked={healthOk} onToggle={() => setHealthOk(!healthOk)} label={t('kayit.q.health_consent')} /> : null}
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          <KButton testID="kayit-save-plan" label={t('kayit.plan.save')} onPress={() => void save()} disabled={!okConsent} />
        </View>
      </View>
    </View>
  );
}

function DailyCard({ plan }: { plan: KPlan }) {
  const { t, lang } = useT();
  const P = useK();
  const kcal = useCountUp(plan.calories);
  const tot = Math.max(1, plan.protein * 4 + plan.carbs * 4 + plan.fat * 9);
  const macros = [
    { k: 'protein', v: plan.protein, r: (plan.protein * 4) / tot, c: P.isDark ? '#D8FF5A' : '#10301D' },
    { k: 'carbs', v: plan.carbs, r: (plan.carbs * 4) / tot, c: P.isDark ? P.accent : '#4A6B00' },
    { k: 'fat', v: plan.fat, r: (plan.fat * 9) / tot, c: P.isDark ? 'rgba(255,255,255,0.7)' : '#5B6B5F' },
  ];
  return (
    <View style={[styles.card, styles.daily, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <View accessible accessibilityLabel={`${t('kayit.plan.daily')}: ${fmtInt(plan.calories, lang)} ${t('kayit.plan.kcal')}`}>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
          {t('kayit.plan.daily')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <AppText testID="kayit-result-kcal" maxFontSizeMultiplier={1.15} style={[styles.kcal, { color: P.ink }]}>
            {fmtInt(kcal, lang)}
          </AppText>
          <AppText maxFontSizeMultiplier={1.2} style={[styles.kcalUnit, { color: P.sec }]}>
            {t('kayit.plan.kcal')}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginLeft: 'auto' }}>
        {macros.map((m) => (
          <View key={m.k} style={{ alignItems: 'center', gap: 4 }} accessible accessibilityLabel={`${t(`kayit.plan.${m.k}`)} ${m.v} g`}>
            <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
              <View style={StyleSheet.absoluteFill}>
                <RingProgress size={52} stroke={6} progress={Math.max(0.08, m.r)} color={m.c} track={P.ringTrack} />
              </View>
              <AppText maxFontSizeMultiplier={1.1} style={[styles.macroNum, { color: P.ink }]}>
                {String(m.v)}
              </AppText>
            </View>
            <AppText maxFontSizeMultiplier={1.2} style={[styles.small, { color: P.sec }]}>
              {t(`kayit.plan.${m.k}`)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function WeightCard({ from, to, range, units }: { from: number; to: number; range: string; units: 'metric' | 'imperial' }) {
  const { t, lang } = useT();
  const P = useK();
  const { width } = useWindowDimensions();
  const w = width - 40 - 44;
  const h = 110;
  const down = to < from;
  const y0 = down ? 12 : h - 22;
  const y1 = down ? h - 30 : 24;
  const line = `M 6 ${y0} C ${w * 0.35} ${y0 + (y1 - y0) * 0.35}, ${w * 0.6} ${y1 - (y1 - y0) * 0.08}, ${w - 6} ${y1}`;
  const band = `M 6 ${y0} C ${w * 0.35} ${y0 + (y1 - y0) * 0.25}, ${w * 0.6} ${y1 - (y1 - y0) * 0.2}, ${w - 6} ${y1 - 14} L ${w - 6} ${y1 + 14} C ${w * 0.6} ${y1 + 4}, ${w * 0.35} ${y0 + (y1 - y0) * 0.45}, 6 ${y0} Z`;
  const kg = (v: number) => (units === 'imperial' ? `${fmtDec1(v * 2.2046226218, lang)} lb` : `${Number.isInteger(v) ? v : fmtDec1(v, lang)} kg`);
  return (
    <View testID="kayit-weight-card" style={[styles.card, { backgroundColor: P.card, borderColor: P.cardEdge }]} accessible accessibilityLabel={`${t('kayit.plan.weight_title')}, ${t('kayit.plan.weight_note')}. ${t('kayit.plan.today_kg', { kg: kg(from) })}. ${t('kayit.plan.range_kg', { range, kg: kg(to) })}`}>
      <View style={styles.sectionHeadInner}>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.h3, { color: P.ink }]}>
          {t('kayit.plan.weight_title')}
        </AppText>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
          {t('kayit.plan.weight_note')}
        </AppText>
      </View>
      <Svg width={w} height={h} style={{ marginTop: 8 }}>
        <Path d={band} fill={P.accent} fillOpacity={0.55} />
        <DrawPath d={line} length={w * 1.15} color={P.isDark ? '#FFFFFF' : '#10301D'} width={3} />
        <Circle cx={6} cy={y0} r={6} fill={P.isDark ? '#FFFFFF' : '#10301D'} />
        <Circle cx={w - 6} cy={y1} r={7} fill={P.accent} stroke={P.isDark ? '#FFFFFF' : '#10301D'} strokeWidth={2.5} />
      </Svg>
      <View style={[styles.sectionHeadInner, { marginTop: 6 }]}>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
          {t('kayit.plan.today_kg', { kg: kg(from) })}
        </AppText>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
          {t('kayit.plan.range_kg', { range, kg: kg(to) })}
        </AppText>
      </View>
    </View>
  );
}

function MealSplitCard({ plan }: { plan: KPlan }) {
  const { t, lang } = useT();
  const P = useK();
  return (
    <View testID="kayit-meal-split" style={[styles.card, { backgroundColor: P.card, borderColor: P.cardEdge, gap: 10 }]}>
      <AppText accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.h3, { color: P.ink }]}>
        {t('kayit.plan.meal_split')}
      </AppText>
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }} importantForAccessibility="no-hide-descendants">
        {plan.meals.map((m, i) => (
          <View key={m.slot} style={{ flex: m.pct, backgroundColor: i % 2 === 0 ? P.accent : P.ringFill }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 }}>
        {plan.meals.map((m) => (
          <AppText key={m.slot} maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
            {t(`kayit.plan.slot_${m.slot}`)} {fmtInt(m.kcal, lang)}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: FONT.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.8 },
  h2: { fontFamily: FONT.display, fontSize: 20 },
  h3: { fontFamily: FONT.display, fontSize: 18 },
  small: { fontFamily: FONT.body, fontSize: 14, lineHeight: 19 },
  note: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  calcNum: { fontFamily: FONT.display, fontSize: 52, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  calcUnit: { fontFamily: FONT.semi, fontSize: 18 },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, minHeight: 56 },
  calcRowText: { fontFamily: FONT.semi, fontSize: 16, flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 8 },
  card: { borderRadius: 26, borderWidth: 1, padding: 18 },
  daily: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  kcal: { fontFamily: FONT.display, fontSize: 48, lineHeight: 54, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  kcalUnit: { fontFamily: FONT.semi, fontSize: 18, marginBottom: 8, marginLeft: 2 },
  macroNum: { fontFamily: FONT.bold, fontSize: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10, flexWrap: 'wrap' },
  sectionHeadInner: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  recipe: { width: 168, borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  recipeImg: { height: 104, alignItems: 'center', justifyContent: 'center' },
  recipeName: { fontFamily: FONT.semi, fontSize: 16 },
  eat: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 24, borderWidth: 1, padding: 14 },
  eatImg: { width: 72, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  eatTitle: { fontFamily: FONT.semi, fontSize: 16 },
});
