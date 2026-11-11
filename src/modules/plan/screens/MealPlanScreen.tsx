// G33-S1 md.6 — Haftalık plan (FinPlanWeek / FinPlanWeekLogged / Boş plan). `ogun_plani` bayrağı arkasında.
// Gün çipleri (doluluk noktaları + kcal) · gün kartı (Kalori/Protein: Loglandı + Planlandı) · öğün yuvaları
// (Logla → mevcut günlük takip kuyruğu) · Logla izi + "Öğle'ye loglandı · Geri al" · Ekle sayfası ·
// hafta geçişi (kayan 4 hafta) · "Planı benim için oluştur". Elle planlama ve Logla ÜCRETSİZ.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppText, PLAN_MOTION, REDUCED, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { ArrowLeft, CaretLeft, CaretRight, Sparkle } from '../../../components/icons';
import { useNutritionSummary } from '../../../hooks/useNutritionSummary';
import { dayKey } from '../../gun/track/dayClock';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import type { EatkcalOption, PlanItem, Slot } from '../types';
import { SLOTS } from '../types';
import { usePlanStore, itemAt } from '../store';
import { dayTitle, rollingWeeks, weekDays, weekRange, weekStartOf } from '../week';
import { loadEatkcalOptions, logPlanItem, unlogPlanItem, userInIzmir } from '../actions';
import { AddSheet } from '../ui/AddSheet';
import { DayCard, DayChips, GLASS, LogDot, PlanToast, SlotRow, usePlanTones } from '../ui/parts';

type Nav = { goBack: () => void; navigate: (n: string, p?: object) => void; canGoBack: () => boolean };
export type MealPlanParams = { weekStart?: string; date?: string; applied?: number } | undefined;

const DEFAULT_TARGET = { kcal: 2000, protein: 100 };

export default function MealPlanScreen() {
  const nav = useNavigation() as unknown as Nav;
  const params = (useRoute().params ?? {}) as NonNullable<MealPlanParams>;
  const c = usePlanTones();
  const { t: tr, lang: rawLang } = useT();
  const lang: 'tr' | 'en' = rawLang === 'en' ? 'en' : 'tr';
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { user } = useAuth();
  const { summary } = useNutritionSummary();
  const target = summary?.targetKcal ? { kcal: Math.round(summary.targetKcal), protein: Math.round(summary.targetProtein || DEFAULT_TARGET.protein) } : DEFAULT_TARGET;

  const today = dayKey();
  const weeks = useMemo(() => rollingWeeks(today), [today]);
  const [wi, setWi] = useState(() => Math.max(0, weeks.indexOf(params.weekStart ?? weekStartOf(today))));
  const ws = weeks[wi] ?? weeks[0];
  const days = useMemo(() => weekDays(ws), [ws]);
  const [sel, setSel] = useState(() => params.date ?? (days.includes(today) ? today : days[0]));
  useEffect(() => {
    if (!days.includes(sel)) setSel(days.includes(today) ? today : days[0]);
  }, [days, sel, today]);

  const setUser = usePlanStore((s) => s.setUser);
  const loadWeek = usePlanStore((s) => s.loadWeek);
  const loadCatalog = usePlanStore((s) => s.loadCatalog);
  const entry = usePlanStore((s) => s.weeks[ws]);
  const catalog = usePlanStore((s) => s.catalog);
  const putItem = usePlanStore((s) => s.putItem);
  const removeItem = usePlanStore((s) => s.removeItem);
  const setLogged = usePlanStore((s) => s.setLogged);
  const items = useMemo(() => entry?.items ?? [], [entry?.items]);

  useEffect(() => {
    setUser(user?.id ?? null);
  }, [user?.id, setUser]);
  useEffect(() => {
    if (user?.id) void loadWeek(ws);
  }, [user?.id, ws, loadWeek]);
  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const [izmir, setIzmir] = useState(false);
  const [eatkcal, setEatkcal] = useState<EatkcalOption[]>([]);
  useEffect(() => {
    let alive = true;
    void userInIzmir(user?.id ?? null).then((v) => {
      if (!alive) return;
      setIzmir(v);
      if (v) void loadEatkcalOptions().then((o) => alive && setEatkcal(o));
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // ── Ekle ──
  const [addSlot, setAddSlot] = useState<Slot | null>(null);
  // ── Toast ──
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; key: number } | null>(null);
  // ── Logla izi ──
  const logRefs = useRef<Partial<Record<Slot, View | null>>>({});
  const targetRef = useRef<View | null>(null);
  const [dot, setDot] = useState<{ from: { x: number; y: number }; to: { x: number; y: number }; token: number } | null>(null);
  const [pulse, setPulse] = useState(0);
  const [reveal, setReveal] = useState(params.applied ?? 0);
  useEffect(() => {
    if (params.applied) setReveal(params.applied);
  }, [params.applied]);

  const dayItems = items.filter((x) => x.date === sel);
  const empty = entry?.status !== 'loading' && items.length === 0;

  // Konum ölçümü en çok 1 kare beklenir; gelmezse iz atlanır (kayıt yine yazılır, değer nabzı oynar).
  const measure = (v: View | null | undefined) =>
    new Promise<{ x: number; y: number } | null>((res) => {
      if (!v || typeof v.measureInWindow !== 'function') return res(null);
      const to = setTimeout(() => res(null), 60);
      v.measureInWindow((x, y, w, h) => {
        clearTimeout(to);
        res(Number.isFinite(x) ? { x: x + w / 2, y: y + h / 2 } : null);
      });
    });

  const onLog = useCallback(
    async (it: PlanItem) => {
      haptic('success');
      const [from, to, id] = await Promise.all([measure(logRefs.current[it.slot]), measure(targetRef.current), logPlanItem(it)]);
      if (!id) {
        setToast({ msg: tr('plan.toast_failed'), key: Date.now() });
        return;
      }
      await setLogged(ws, it.id, id);
      if (from && to && !reduced) setDot({ from, to, token: Date.now() });
      else setPulse((p) => p + 1);
      const slotTo = tr(`plan.slot_to.${it.slot}`);
      setToast({
        msg: tr('plan.toast_logged', { slot: slotTo }),
        key: Date.now(),
        undo: async () => {
          setToast(null);
          await unlogPlanItem(id);
          await setLogged(ws, it.id, null);
        },
      });
    },
    [reduced, setLogged, tr, ws],
  );

  const onAdd = useCallback(
    async (it: PlanItem) => {
      setAddSlot(null);
      const prev = itemAt(items, it.date, it.slot);
      const ok = await putItem(ws, it);
      const slotTo = tr(`plan.slot_to.${it.slot}`);
      if (!ok) {
        setToast({ msg: tr('plan.toast_failed'), key: Date.now() });
        return;
      }
      setToast({
        msg: tr('plan.toast_added', { slot: slotTo }),
        key: Date.now(),
        undo: async () => {
          setToast(null);
          const cur = usePlanStore.getState().week(ws).items.find((x) => x.date === it.date && x.slot === it.slot);
          if (cur) await removeItem(ws, cur.id);
          if (prev) await putItem(ws, prev);
        },
      });
    },
    [items, putItem, removeItem, tr, ws],
  );

  const onRemove = useCallback(
    async (it: PlanItem) => {
      haptic('light');
      const ok = await removeItem(ws, it.id);
      if (ok)
        setToast({
          msg: `${it.name} · ${tr('plan.remove')}`,
          key: Date.now(),
          undo: async () => {
            setToast(null);
            await putItem(ws, it);
          },
        });
    },
    [putItem, removeItem, tr, ws],
  );

  const weekLabel = wi === 0 ? tr('plan.this_week') : wi === 1 ? tr('plan.next_week') : tr('plan.week_n', { n: wi + 1 });
  const fade = reduced ? FadeIn.duration(REDUCED.duration) : FadeIn.duration(PLAN_MOTION.dayCrossfade);
  const fadeOut = reduced ? FadeOut.duration(REDUCED.duration) : FadeOut.duration(PLAN_MOTION.dayCrossfade);
  const openGenerate = () => nav.navigate('MealPlanGenerate', { weekStart: ws });

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]} testID="meal-plan">
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 96, paddingHorizontal: 16, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs'))} accessibilityRole="button" accessibilityLabel={tr('common.back')} style={styles.iconBtn} hitSlop={6}>
            <ArrowLeft size={24} color={c.ink} />
          </Pressable>
          <AppText style={[styles.title, { color: c.ink }]} accessibilityRole="header">
            {tr('plan.title')}
          </AppText>
        </View>

        <View style={styles.weekRow}>
          <AppText style={[styles.weekLabel, { color: c.ink }]}>{weekLabel}</AppText>
          <AppText style={[styles.weekRange, { color: c.sec }]}>{weekRange(ws, lang)}</AppText>
          <View style={styles.flex1} />
          <Pressable disabled={wi === 0} onPress={() => setWi((i) => Math.max(0, i - 1))} accessibilityRole="button" accessibilityLabel={tr('plan.prev_week_a11y')} accessibilityState={{ disabled: wi === 0 }} style={[styles.iconBtn, { opacity: wi === 0 ? 0.35 : 1 }]} testID="plan-week-prev">
            <CaretLeft size={20} color={c.ink} />
          </Pressable>
          <Pressable disabled={wi === weeks.length - 1} onPress={() => setWi((i) => Math.min(weeks.length - 1, i + 1))} accessibilityRole="button" accessibilityLabel={tr('plan.next_week_a11y')} accessibilityState={{ disabled: wi === weeks.length - 1 }} style={[styles.iconBtn, { opacity: wi === weeks.length - 1 ? 0.35 : 1 }]} testID="plan-week-next">
            <CaretRight size={20} color={c.ink} />
          </Pressable>
        </View>

        <Animated.View key={`chips-${ws}`} entering={fade}>
          <DayChips days={days} selected={sel} today={today} items={items} lang={lang} onSelect={setSel} dotsReveal={reveal} />
        </Animated.View>

        {empty ? (
          <Animated.View key={`empty-${ws}`} entering={fade} style={[styles.emptyCard, { backgroundColor: c.card }]} testID="plan-empty">
            <View style={[styles.emptyGlass, { backgroundColor: c.nested }]}>
              <Image source={GLASS.bowl} style={styles.emptyImg} resizeMode="contain" />
            </View>
            <AppText style={[styles.emptyTitle, { color: c.ink }]} accessibilityRole="header">
              {tr('plan.empty_title')}
            </AppText>
            <AppText style={[styles.emptyBody, { color: c.sec }]}>{tr('plan.empty_body')}</AppText>
            <Pressable onPress={openGenerate} accessibilityRole="button" style={[styles.blackBtn, { backgroundColor: c.chipSel }]} testID="plan-empty-generate">
              <Sparkle size={16} color={c.chipSelInk} weight="fill" />
              <AppText style={[styles.blackBtnText, { color: c.chipSelInk }]}>{tr('plan.empty_generate')}</AppText>
            </Pressable>
            <Pressable onPress={() => setAddSlot('breakfast')} accessibilityRole="button" style={[styles.outlineBtn, { borderColor: c.line2 }]} testID="plan-empty-manual">
              <AppText style={[styles.outlineText, { color: c.ink }]}>{tr('plan.empty_manual')}</AppText>
            </Pressable>
            <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.empty_foot')}</AppText>
          </Animated.View>
        ) : (
          <Animated.View key={`day-${sel}`} entering={fade} exiting={fadeOut} style={styles.dayWrap}>
            <DayCard ref={targetRef} title={dayTitle(sel, lang)} isToday={sel === today} items={dayItems} target={target} pulse={pulse} />
            <View style={styles.mealsHead}>
              <AppText style={[styles.mealsH, { color: c.ink }]} accessibilityRole="header">
                {tr('plan.meals_h')}
              </AppText>
              <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.meals_hint')}</AppText>
            </View>
            <View style={[styles.group, { backgroundColor: c.card }]}>
              {SLOTS.map((s, i) => (
                <SlotRow
                  key={s}
                  slot={s}
                  first={i === 0}
                  item={itemAt(items, sel, s)}
                  canLog={sel <= today}
                  onLog={(it) => void onLog(it)}
                  onAdd={(slot) => setAddSlot(slot)}
                  onLongPress={(it) => void onRemove(it)}
                  logRef={(slot, v) => (logRefs.current[slot] = v)}
                />
              ))}
            </View>
            <Pressable onPress={openGenerate} accessibilityRole="button" style={[styles.genCard, { backgroundColor: c.card }]} testID="plan-generate-card">
              <Image source={GLASS.bowl} style={styles.genImg} resizeMode="contain" />
              <View style={styles.flex1}>
                <AppText style={[styles.genTitle, { color: c.ink }]}>{tr('plan.generate_cta')}</AppText>
                <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.generate_cta_sub')}</AppText>
              </View>
              <CaretRight size={18} color={c.sec} />
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {dot ? <LogDot from={dot.from} to={dot.to} token={dot.token} onArrive={() => setPulse((p) => p + 1)} /> : null}

      <AddSheet
        visible={addSlot != null}
        slot={addSlot ?? 'breakfast'}
        date={sel}
        dateLabel={dayTitle(sel, lang)}
        recipes={catalog?.recipes ?? []}
        eatkcal={eatkcal}
        izmir={izmir}
        lang={lang}
        onClose={() => setAddSlot(null)}
        onAdd={(it) => void onAdd(it)}
      />
      <PlanToast
        visible={!!toast}
        message={toast?.msg ?? ''}
        onUndo={toast?.undo}
        onHide={() => setToast(null)}
        bottom={insets.bottom + 16}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24, lineHeight: 30 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekLabel: { fontSize: 16, fontWeight: '700' },
  weekRange: { fontSize: 14 },
  dayWrap: { gap: 14 },
  mealsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  mealsH: { fontSize: 18, fontWeight: '700' },
  small: { fontSize: 13 },
  group: { borderRadius: 20, overflow: 'hidden' },
  genCard: { borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  genImg: { width: 44, height: 30 },
  genTitle: { fontSize: 15, fontWeight: '700' },
  emptyCard: { borderRadius: 24, padding: 22, alignItems: 'center', gap: 10 },
  emptyGlass: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyImg: { width: 52, height: 36 },
  emptyTitle: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  blackBtn: { alignSelf: 'stretch', minHeight: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  blackBtnText: { fontSize: 16, fontWeight: '700' },
  outlineBtn: { alignSelf: 'stretch', minHeight: 50, borderRadius: 25, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontSize: 16, fontWeight: '600' },
});
