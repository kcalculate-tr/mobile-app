// G34-S1 · Tur 26o — Öğün planı önizleme (02 panosu "Önizleme Balance" / "Önizleme ücretsiz").
// G33 öğün planı bileşenleri (DayCard + SlotRow) ve G33 deterministik algoritması (generatePlan).
// Ücretsiz: 1. gün açık, 2.–7. gün kilitli/bulanık + bağlamsal paywall (Fresh). Fresh: şablon.
// Balance: aynı algoritmanın 3 adayı + meal-plan-generate sıralar/açıklar (1 koç mesajı); Koç
// ulaşılamazsa şablon etiketine düşer (Koç'a ait olmayan planı "Koç hazırladı" diye göstermeyiz).
// Makro/kalori DAİMA algoritmadan; plan hedefi kişisel plandan.
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { AppText } from '../../../../core/design/components/AppText';
import { haptic, useReducedMotion } from '../../../../core/design/motion';
import { useT } from '../../../../core/i18n';
import { useFeature } from '../../../../core/flags';
import { CaretRight, Lock, ShoppingCart, CalendarBlank } from '../../../../components/icons';
import { useTier } from '../../../../lib/subscription/purchases';
import { usePlanCards } from '../../../../lib/subscription/usePlanCards';
import { useReduceTransparency } from '../../bridge';
import { candidatePlans, generatePlan, type GenerateResult } from '../../../plan/generate';
import { askCoachToRank } from '../../../plan/coach';
import { usePlanStore } from '../../../plan/store';
import { dayShort, dayTitle, dayOfMonth, weekStartOf } from '../../../plan/week';
import { DayCard, SlotRow } from '../../../plan/ui/parts';
import { SLOTS, type PlanItem, type Slot } from '../../../plan/types';
import { addDays, isoDay } from '../../calc';
import { fmtRange, type Lang } from '../../format';
import { usePpFlow, type PpOrigin } from '../../store';
import { UnlockFade } from '../../ui/motion';
import { GLASS, PpButton, PpCard, usePp } from '../../ui/parts';

type Mode = 'free' | 'template' | 'coach';

export function previewDays(startIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i));
}

export function PreviewStep({ next, origin }: { next: () => void; origin: PpOrigin }) {
  const i18n = useT();
  const lang: Lang = i18n.lang === 'en' ? 'en' : 'tr';
  const P = usePp();
  const nav = useNavigation() as unknown as { navigate: (n: string, p?: object) => void };
  const { tier } = useTier();
  const planOn = useFeature('ogun_plani');
  const reduced = useReducedMotion();
  const flatCover = useReduceTransparency();
  const a = usePpFlow((s) => s.answers);
  const result = usePpFlow((s) => s.result);
  const custom = usePpFlow((s) => s.custom);
  const catalog = usePlanStore((s) => s.catalog);
  const loadCatalog = usePlanStore((s) => s.loadCatalog);
  const applyItems = usePlanStore((s) => s.applyItems);
  const { cards } = usePlanCards(tier === 'free');
  const today = isoDay(new Date());
  const days = useMemo(() => previewDays(today), [today]);
  const [sel, setSel] = useState(today);
  const [mode, setMode] = useState<Mode>(tier === 'free' ? 'free' : tier === 'balance' ? 'coach' : 'template');
  const [plan, setPlan] = useState<GenerateResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [unlocked, setUnlocked] = useState(tier !== 'free');

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const targets = useMemo(() => {
    if (!result) return null;
    const t = custom ?? { calories: result.calories, protein: result.macros.protein, fat: result.macros.fat, carbs: result.macros.carbs };
    return { kcal: t.calories, protein: t.protein };
  }, [result, custom]);

  useEffect(() => {
    if (!catalog || !targets) return;
    let alive = true;
    (async () => {
      setBusy(true);
      const input = {
        recipes: catalog.recipes,
        days,
        target: targets,
        diet: a.diet,
        avoid: a.consentAllergy ? a.allergens : [],
        eatkcal: null,
        keep: [] as PlanItem[],
        keepPlanned: false,
        variant: 0,
        lang,
      };
      let out: GenerateResult = generatePlan(input);
      let m: Mode = tier === 'free' ? 'free' : 'template';
      if (tier === 'balance') {
        const cands = candidatePlans(input, 3);
        const r = await askCoachToRank(cands, { lang, target: targets, avoid: input.avoid, diet: a.diet });
        if (r.ok && cands[r.index]) {
          out = cands[r.index];
          m = 'coach';
        }
      }
      if (!alive) return;
      setPlan(out);
      setMode(m);
      setBusy(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, targets?.kcal, targets?.protein, tier]);

  // Satın alma sonrası önizlemeye dönüş: kilitli günler açılır (550, success haptik).
  useEffect(() => {
    if (tier !== 'free' && !unlocked) {
      setUnlocked(true);
      haptic('success');
    }
  }, [tier, unlocked]);

  const items = plan?.items ?? [];
  const dayItems = items.filter((x) => x.date === sel);
  const freeLocked = !unlocked;
  const tagKey = mode === 'coach' ? 'pp.preview_coach_tag' : mode === 'template' ? 'pp.preview_template_tag' : 'pp.preview_free_tag';
  const subKey = mode === 'coach' ? 'pp.preview_coach_sub' : mode === 'template' ? 'pp.preview_template_sub' : 'pp.preview_free_sub';
  const freshYear = cards?.find((c) => c.key === 'fresh_yearly');

  const applyAndGo = async (route: 'MealPlan' | 'ShoppingList' | null) => {
    if (plan && !freeLocked && planOn) {
      const ws = weekStartOf(today);
      await applyItems(ws, plan.items, mode === 'coach' ? 'coach' : 'template', null);
    }
    if (route && planOn) nav.navigate(route, route === 'MealPlan' ? { from: 'personal_plan' } : undefined);
    else next();
  };

  return (
    <PpCard
      title={i18n.t('pp.preview_title')}
      footer={
        freeLocked ? (
          <View style={{ gap: 4 }}>
            <PpButton label={i18n.t('pp.free_continue')} onPress={next} kind="ghost" testID="pp-preview-free" />
            <AppText textRole="helper" style={{ color: P.sec, textAlign: 'center' }}>
              {i18n.t('pp.free_foot')}
            </AppText>
          </View>
        ) : (
          <PpButton label={i18n.t('pp.continue')} onPress={() => void applyAndGo(null)} testID="pp-preview-next" />
        )
      }
    >
      <View style={[styles.tag, { backgroundColor: P.field }]}>
        <Image source={GLASS.bowl} style={{ width: 18, height: 13 }} resizeMode="contain" />
        <AppText textRole="helper" style={{ color: P.ink, fontWeight: '700' }} testID="pp-preview-tag">
          {i18n.t(tagKey)}
        </AppText>
      </View>
      <AppText textRole="helper" style={{ color: P.sec, marginTop: 6 }}>
        {i18n.t(subKey)}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
        <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
          {i18n.t('pp.first_week')}
        </AppText>
        <AppText textRole="helper" style={{ color: P.sec }}>
          {fmtRange(days[0], days[6], lang)}
        </AppText>
      </View>
      {/* Gün çipleri: ücretsizde 2.–7. gün kilitli (kilit simgesi) */}
      <View style={styles.chips} accessibilityRole="tablist">
        {days.map((d, i) => {
          const locked = freeLocked && i > 0;
          const on = d === sel;
          const kcal = items.filter((x) => x.date === d).reduce((s, x) => s + x.kcal, 0);
          return (
            <Pressable
              key={d}
              onPress={() => {
                if (locked) {
                  haptic('light');
                  nav.navigate('PlanPaywall', { from: 'personal_plan_locked_day' });
                  return;
                }
                haptic('selection');
                setSel(d);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on, disabled: locked }}
              accessibilityLabel={locked ? i18n.t('pp.locked_a11y', { day: `${dayShort(d, lang)} ${dayOfMonth(d)}` }) : `${dayShort(d, lang)} ${dayOfMonth(d)}, ${kcal} kcal`}
              style={[styles.chip, { backgroundColor: on ? P.ink : P.field }]}
            >
              <AppText style={[styles.chipDay, { color: on ? P.onInk : P.sec }]} maxFontSizeMultiplier={1.3}>
                {dayShort(d, lang)}
              </AppText>
              <AppText style={[styles.chipNum, { color: on ? P.onInk : P.ink }]} maxFontSizeMultiplier={1.3}>
                {dayOfMonth(d)}
              </AppText>
              {locked ? (
                <Lock size={11} color={P.sec} />
              ) : (
                <AppText style={[styles.chipKcal, { color: on ? P.onInk : P.sec }]} maxFontSizeMultiplier={1.2}>
                  {kcal || ' '}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
      {busy || !plan || !targets ? (
        <View style={[styles.skel, { backgroundColor: P.field }]} accessibilityLabel={i18n.t('common.loading')} />
      ) : dayItems.length === 0 ? (
        <AppText textRole="bodySm" style={{ color: P.sec, marginTop: 12 }}>
          {i18n.t('pp.preview_empty')}
        </AppText>
      ) : (
        <View style={{ marginTop: 12, gap: 10 }}>
          <DayCard title={dayTitle(sel, lang)} isToday={sel === today} items={dayItems} target={targets} />
          <View style={[styles.slots, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
            {SLOTS.filter((s: Slot) => dayItems.some((x) => x.slot === s)).map((s, i) => (
              <SlotRow key={s} slot={s} item={dayItems.find((x) => x.slot === s)} canLog={false} onLog={() => undefined} onAdd={() => undefined} first={i === 0} />
            ))}
          </View>
        </View>
      )}
      {freeLocked ? (
        <>
          {/* 2.–7. gün: bulanık önizleme (azaltılmış saydamlıkta düz örtü + kilit rozeti) */}
          <View style={[styles.lockedBox, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
            <UnlockFade
              locked={freeLocked}
              index={0}
              cover={
                flatCover ? (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: P.field }]} />
                ) : (
                  <BlurView intensity={reduced ? 30 : 24} tint={P.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                )
              }
            >
              <View style={{ padding: 14, gap: 10 }}>
                {[0, 1].map((k) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={[styles.ghost, { backgroundColor: P.field, width: 40, height: 40 }]} />
                    <View style={[styles.ghost, { backgroundColor: P.field, flex: 1, height: 12 }]} />
                    <View style={[styles.ghost, { backgroundColor: P.field, width: 44, height: 12 }]} />
                  </View>
                ))}
              </View>
            </UnlockFade>
            <View style={styles.lockedHead} pointerEvents="none">
              <Lock size={14} color={P.ink} />
              <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                {i18n.t('pp.locked_days')}
              </AppText>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.locked_sub')}
              </AppText>
            </View>
          </View>
          <View style={[styles.unlock, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Image source={GLASS.bowl} style={{ width: 34, height: 24 }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                  {i18n.t('pp.unlock_title')}
                </AppText>
                <AppText textRole="helper" style={{ color: P.sec }}>
                  {i18n.t('pp.unlock_sub')}
                </AppText>
              </View>
            </View>
            {freshYear ? (
              <View style={[styles.price, { backgroundColor: P.field }]}>
                <View style={{ flex: 1 }}>
                  <AppText textRole="helper" style={{ color: P.sec }}>
                    {i18n.t('pp.pw_fresh_year')}
                  </AppText>
                  <AppText textRole="section" style={{ color: P.ink }}>
                    {i18n.t('pp.per_year', { price: freshYear.priceText })}
                  </AppText>
                </View>
                {freshYear.monthlyText ? (
                  <AppText textRole="helper" style={{ color: P.sec, textAlign: 'right' }}>
                    {i18n.t('pp.pw_per_month', { price: freshYear.monthlyText })}
                    {'\n'}
                    {i18n.t('pp.pw_trial')}
                  </AppText>
                ) : null}
              </View>
            ) : null}
            <PpButton kind="lime" label={i18n.t('pp.unlock_cta')} onPress={() => nav.navigate('PlanPaywall', { from: origin === 'purchase' ? 'personal_plan_purchase' : 'personal_plan_preview' })} testID="pp-unlock" />
          </View>
        </>
      ) : planOn ? (
        <View style={[styles.links, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
          <Pressable onPress={() => void applyAndGo('MealPlan')} accessibilityRole="button" style={styles.linkRow}>
            <CalendarBlank size={18} color={P.ink} />
            <View style={{ flex: 1 }}>
              <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                {i18n.t('pp.open_week')}
              </AppText>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.open_week_sub')}
              </AppText>
            </View>
            <CaretRight size={16} color={P.sec} />
          </Pressable>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: P.line }} />
          <Pressable onPress={() => void applyAndGo('ShoppingList')} accessibilityRole="button" style={styles.linkRow}>
            <ShoppingCart size={18} color={P.ink} />
            <View style={{ flex: 1 }}>
              <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                {i18n.t('pp.add_shopping')}
              </AppText>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.add_shopping_sub')}
              </AppText>
            </View>
            <CaretRight size={16} color={P.sec} />
          </Pressable>
        </View>
      ) : null}
    </PpCard>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  chips: { flexDirection: 'row', gap: 4, marginTop: 8 },
  chip: { flex: 1, minHeight: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  chipDay: { fontSize: 11, lineHeight: 13 },
  chipNum: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
  chipKcal: { fontSize: 11, lineHeight: 13 },
  skel: { height: 180, borderRadius: 16, marginTop: 12 },
  slots: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  lockedBox: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginTop: 12, overflow: 'hidden', minHeight: 120 },
  lockedHead: { position: 'absolute', left: 14, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ghost: { borderRadius: 8 },
  unlock: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12, marginTop: 12 },
  price: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12 },
  links: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingHorizontal: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
});
