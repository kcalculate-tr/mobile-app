// G42-S1 md.4 / G43-S1 — L1 hesaplama + L2 plan sonucu. Hesap MEVCUT kişisel plan motoru (G34 computePlan; plan.ts).
// L1: maskot (orta boy, sabit; yalnız göz kırpar) + "Planın hazırlanıyor" + 3 satırlık onay listesi sırayla
// işaretlenir; toplam ≤ 2 sn (geri dönüşte cevap değiştiyse kısa sürüm; değişmediyse doğrudan L2). Ağ yoksa
// liste durur + kart. L2: beyaz kartlarda sade bölümler — günlük kalori (statik büyük rakam) + 3 makro (ince
// çubuk), kilo tahmini (tek çizgi, muted aralık bandı; söz değil), öğün dağılımı (liste), uygun 3 tarif (yatay
// kart), koşullu eatkcal kartı, sağlık verisi açık rızası + "Planımı kaydet". Sayarak artan rakam / çizim YOK.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { recordHealthConsent } from '../../../lib/consent/store';
import { healthConsentGiven } from '../../personalPlan/api';
import { GLASS } from '../../personalPlan/ui/parts';
import { fetchRecipeCatalog } from '../../plan/client';
import { loadEatkcalProducts, productToOption } from '../../plan/actions';
import type { RecipeInfo } from '../../plan/types';
import { CheckBoxRow, FONT, KButton, KCard, KFooter, KTitle, Mascot, NoticeCard, RadioMark, TopBar } from '../ui/parts';
import { useEdgeBack } from '../ui/edge';
import { K_MOTION, useK } from '../ui/theme';
import { computeKayitPlan, pickRecipes, planSignature, type KPlan } from '../plan';
import { mealsSplit } from '../model';
import { fmtDec1, fmtInt, monthRange } from '../format';
import { flushDraft, useKayit } from '../store';
import { readMuscleSurplus } from '../settings';
import { kTrack } from '../events';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

const todayIso = () => new Date().toISOString().slice(0, 10);

// ─── L1 ───────────────────────────────────────────────────────────────────────
export function CalcScreen() {
  const { t, lang } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const navigation = useNavigation<any>();
  // YALNIZ __DEV__ vitrini: L1 ilk satırda bekler (ekran görüntüsü).
  const hold = __DEV__ && !!((useRoute().params ?? {}) as { vitrinHold?: boolean }).vitrinHold;
  const answers = useKayit((s) => s.answers);
  const calcDone = useKayit((s) => s.calcDone);
  const planSig = useKayit((s) => s.planSig);
  const sig = planSignature(answers);
  const shortRun = calcDone && planSig !== sig;
  const total = reduced ? 600 : shortRun ? K_MOTION.calcShort : K_MOTION.calcFull;
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
      const step = total / 4;
      if (hold) {
        setRow(1);
        return;
      }
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

  const rows = [
    { done: row >= 1, active: row === 0, idle: 'kayit.plan.calc_kcal', act: 'kayit.plan.calc_kcal', ok: 'kayit.plan.calc_kcal_done' },
    { done: row >= 2, active: row === 1, idle: 'kayit.plan.calc_macros', act: 'kayit.plan.calc_macros_active', ok: 'kayit.plan.calc_macros_done' },
    { done: row >= 3, active: row === 2, idle: 'kayit.plan.calc_meals', act: 'kayit.plan.calc_meals_active', ok: 'kayit.plan.calc_meals_done' },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: P.bg }} testID="kayit-calc">
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1, paddingTop: insets.top + 4 }}>
        <TopBar onBack={null} />
        <View style={styles.calcBody}>
          <Mascot size={120} blink />
          <KTitle title={t('kayit.plan.calc_title')} center style={{ marginTop: 20, alignSelf: 'stretch' }} />
          <View style={[styles.calcList, { backgroundColor: P.surface }]}>
            {rows.map((r, i) => (
              <View
                key={i}
                style={[styles.calcRow, i > 0 && { borderTopWidth: 1, borderTopColor: P.line }]}
                accessible
                accessibilityLiveRegion={r.active ? 'polite' : 'none'}
                accessibilityLabel={t(r.done ? r.ok : r.active ? r.act : r.idle)}
              >
                <View style={styles.calcMark}>{r.active && !offline ? <ActivityIndicator size="small" color={P.sec} /> : <RadioMark on={r.done} />}</View>
                <AppText maxFontSizeMultiplier={1.4} style={[styles.calcRowText, { color: r.done || r.active ? P.ink : P.sec }]}>
                  {t(r.done ? r.ok : r.active ? r.act : r.idle)}
                </AppText>
              </View>
            ))}
          </View>
          {offline ? (
            <View style={{ alignSelf: 'stretch', marginTop: 14 }}>
              <NoticeCard testID="kayit-calc-offline" title={t('kayit.plan.offline_title')} sub={t('kayit.plan.offline_sub')} action={{ label: t('kayit.plan.retry'), onPress: () => setRun((r) => r + 1) }} />
            </View>
          ) : null}
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
    <View style={{ flex: 1, backgroundColor: P.bg }} {...edge} testID="kayit-result">
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1, paddingTop: insets.top + 4 }}>
        <TopBar onBack={back} />
        <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <KTitle testID="kayit-result-title" title={t('kayit.plan.ready_title')} style={{ marginTop: 12 }} />
          <View style={{ paddingHorizontal: 20, gap: 12, marginTop: 20 }}>
            <DailyCard plan={plan} />
            {plan.rangeFrom && plan.rangeTo && answers.weightKg ? (
              <WeightCard from={answers.weightKg} to={answers.targetWeightKg ?? answers.weightKg} range={monthRange(plan.rangeFrom, plan.rangeTo, lang, true)} units={answers.units} />
            ) : null}
            <MealSplitCard plan={plan} />
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
              <ScrollView {...SCROLL_KEYBOARD} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                {recipes.map((r) => (
                  <View key={r.key} testID={`kayit-recipe-${r.key}`} accessible accessibilityLabel={`${lang === 'en' ? r.nameEn : r.nameTr}, ${Math.round(r.macros.kcal)} ${t('kayit.plan.kcal')}`} style={[styles.recipe, { backgroundColor: P.surface }]}>
                    <View style={[styles.recipeImg, { backgroundColor: P.isDark ? P.track : P.bg }]}>
                      <Image source={GLASS.bowl} style={{ width: 64, height: 64 }} resizeMode="contain" />
                    </View>
                    <View style={{ padding: 12, gap: 2 }}>
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
          <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
            <View testID="kayit-eatkcal" style={[styles.eat, { backgroundColor: P.surface }]} accessible accessibilityLabel={`${t('kayit.plan.eatkcal_title')}. ${eat ? t('kayit.plan.eatkcal_sub', { name: eat.name, kcal: eat.kcal }) : t('kayit.plan.eatkcal_fallback')}`}>
              <View style={[styles.eatImg, { backgroundColor: P.isDark ? P.track : P.bg }]}>
                {eat?.img ? <Image source={{ uri: eat.img }} style={{ width: 64, height: 64, borderRadius: 12 }} /> : <Image source={GLASS.bowl} style={{ width: 44, height: 44 }} resizeMode="contain" />}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
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
        <KFooter bottom={insets.bottom}>
          <KButton testID="kayit-save-plan" label={t('kayit.plan.save')} onPress={() => void save()} disabled={!okConsent} />
        </KFooter>
      </View>
    </View>
  );
}

function DailyCard({ plan }: { plan: KPlan }) {
  const { t, lang } = useT();
  const P = useK();
  const tot = Math.max(1, plan.protein * 4 + plan.carbs * 4 + plan.fat * 9);
  const macros = [
    { k: 'protein', v: plan.protein, r: (plan.protein * 4) / tot },
    { k: 'carbs', v: plan.carbs, r: (plan.carbs * 4) / tot },
    { k: 'fat', v: plan.fat, r: (plan.fat * 9) / tot },
  ];
  return (
    <KCard style={{ gap: 14 }}>
      <View accessible accessibilityLabel={`${t('kayit.plan.daily')}: ${fmtInt(plan.calories, lang)} ${t('kayit.plan.kcal')}`}>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
          {t('kayit.plan.daily')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
          <AppText testID="kayit-result-kcal" maxFontSizeMultiplier={1.15} style={[styles.kcal, { color: P.ink }]}>
            {fmtInt(plan.calories, lang)}
          </AppText>
          <AppText maxFontSizeMultiplier={1.2} style={[styles.kcalUnit, { color: P.sec }]}>
            {t('kayit.plan.kcal')}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {macros.map((m) => (
          <View key={m.k} style={{ flex: 1, gap: 6 }} accessible accessibilityLabel={`${t(`kayit.plan.${m.k}`)} ${m.v} g`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <AppText maxFontSizeMultiplier={1.3} style={[styles.small, { color: P.sec }]}>
                {t(`kayit.plan.${m.k}`)}
              </AppText>
              <AppText maxFontSizeMultiplier={1.3} style={[styles.macroNum, { color: P.ink }]}>
                {`${m.v} g`}
              </AppText>
            </View>
            <View style={[styles.macroBar, { backgroundColor: P.track }]}>
              <View style={{ width: `${Math.round(Math.max(0.06, m.r) * 100)}%`, height: 4, borderRadius: 2, backgroundColor: P.ink }} />
            </View>
          </View>
        ))}
      </View>
    </KCard>
  );
}

function WeightCard({ from, to, range, units }: { from: number; to: number; range: string; units: 'metric' | 'imperial' }) {
  const { t, lang } = useT();
  const P = useK();
  const { width } = useWindowDimensions();
  const w = width - 40 - 32;
  const h = 100;
  const down = to < from;
  const y0 = down ? 12 : h - 14;
  const y1 = down ? h - 22 : 22;
  const line = `M 6 ${y0} C ${w * 0.35} ${y0 + (y1 - y0) * 0.35}, ${w * 0.6} ${y1 - (y1 - y0) * 0.08}, ${w - 6} ${y1}`;
  const band = `M 6 ${y0} C ${w * 0.35} ${y0 + (y1 - y0) * 0.25}, ${w * 0.6} ${y1 - (y1 - y0) * 0.2}, ${w - 6} ${y1 - 12} L ${w - 6} ${y1 + 12} C ${w * 0.6} ${y1 + 4}, ${w * 0.35} ${y0 + (y1 - y0) * 0.45}, 6 ${y0} Z`;
  const kg = (v: number) => (units === 'imperial' ? `${fmtDec1(v * 2.2046226218, lang)} lb` : `${Number.isInteger(v) ? v : fmtDec1(v, lang)} kg`);
  return (
    <KCard testID="kayit-weight-card">
      <View accessible accessibilityLabel={`${t('kayit.plan.weight_title')}, ${t('kayit.plan.weight_note')}. ${t('kayit.plan.today_kg', { kg: kg(from) })}. ${t('kayit.plan.range_kg', { range, kg: kg(to) })}`}>
        <View style={styles.sectionHeadInner}>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.h3, { color: P.ink }]}>
            {t('kayit.plan.weight_title')}
          </AppText>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
            {t('kayit.plan.weight_note')}
          </AppText>
        </View>
        <Svg width={w} height={h} style={{ marginTop: 10 }}>
          <Path d={band} fill={P.sec} fillOpacity={0.16} />
          <Path d={line} stroke={P.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
          <Circle cx={6} cy={y0} r={4} fill={P.ink} />
          <Circle cx={w - 6} cy={y1} r={4} fill={P.ink} />
        </Svg>
        <View style={[styles.sectionHeadInner, { marginTop: 8 }]}>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
            {t('kayit.plan.today_kg', { kg: kg(from) })}
          </AppText>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
            {t('kayit.plan.range_kg', { range, kg: kg(to) })}
          </AppText>
        </View>
      </View>
    </KCard>
  );
}

function MealSplitCard({ plan }: { plan: KPlan }) {
  const { t, lang } = useT();
  const P = useK();
  return (
    <KCard testID="kayit-meal-split" style={{ paddingVertical: 6 }}>
      <AppText accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.h3, { color: P.ink, paddingVertical: 10 }]}>
        {t('kayit.plan.meal_split')}
      </AppText>
      {plan.meals.map((m) => (
        <View key={m.slot} style={[styles.splitRow, { borderTopColor: P.line }]} accessible accessibilityLabel={`${t(`kayit.plan.slot_${m.slot}`)}, ${fmtInt(m.kcal, lang)} ${t('kayit.plan.kcal')}`}>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.splitName, { color: P.ink }]}>
            {t(`kayit.plan.slot_${m.slot}`)}
          </AppText>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.small, { color: P.sec }]}>
            {`${fmtInt(m.kcal, lang)} ${t('kayit.plan.kcal')}`}
          </AppText>
        </View>
      ))}
    </KCard>
  );
}

const styles = StyleSheet.create({
  h2: { fontFamily: FONT.display, fontSize: 20 },
  h3: { fontFamily: FONT.semi, fontSize: 16 },
  small: { fontFamily: FONT.body, fontSize: 14, lineHeight: 19 },
  note: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  calcBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 60 },
  calcList: { alignSelf: 'stretch', borderRadius: 16, marginTop: 24, overflow: 'hidden' },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 56 },
  calcMark: { width: 24, alignItems: 'center' },
  calcRowText: { fontFamily: FONT.medium, fontSize: 16, flex: 1 },
  kcal: { fontFamily: FONT.display, fontSize: 44, lineHeight: 50, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  kcalUnit: { fontFamily: FONT.medium, fontSize: 17, lineHeight: 24, marginBottom: 6 },
  macroNum: { fontFamily: FONT.semi, fontSize: 14 },
  macroBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10, flexWrap: 'wrap' },
  sectionHeadInner: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, borderTopWidth: 1 },
  splitName: { fontFamily: FONT.medium, fontSize: 15 },
  recipe: { width: 160, borderRadius: 16, overflow: 'hidden' },
  recipeImg: { height: 96, alignItems: 'center', justifyContent: 'center' },
  recipeName: { fontFamily: FONT.semi, fontSize: 15 },
  eat: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 14 },
  eatImg: { width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  eatTitle: { fontFamily: FONT.semi, fontSize: 15 },
});
