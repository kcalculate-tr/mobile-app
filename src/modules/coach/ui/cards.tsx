// G24-S1 md.3 — kcalAI Koç zengin kartları (FinCoachChat): öğün önerisi (Günüme ekle), tarif
// (Tarifi aç), eatkcal ürünü (Sepete ekle — yalnız İzmir; sunucu yalnız İzmir'deki kullanıcıya
// gönderir), haftalık grafik (Kalori/Protein sekmesi), uzmana danış (güvenlik).
// VoiceOver: her kart TEK öğe + eylem düğmesi ayrı; dokunma ≥ 44 pt. Kart açılışı ölçek 0.96 → 1 +
// opaklık 330 enter (azaltılmışta 220 opaklık), çok kart 55 ms kademeli (FinMoCoach).
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { AppText, CURVE, DURATION, REDUCED, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CaretRight, Check, Heartbeat, Plus, ShoppingCart } from '../../../components/icons';
import { formatPrice } from '../../../lib/money';
import { chartBars, weekdayIndex } from '../model';
import type { CoachCard } from '../types';
import { BOWL, LIME, LIME_INK, useCoachTones } from './parts';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

type MealCard = Extract<CoachCard, { type: 'meal_suggestion' }>;
type RecipeCard = Extract<CoachCard, { type: 'recipe' }>;
type ProductCard = Extract<CoachCard, { type: 'eatkcal_product' }>;
type ChartCard = Extract<CoachCard, { type: 'weekly_chart' }>;

export interface CardHandlers {
  onAddMeal: (card: MealCard, index: number) => Promise<boolean>;
  onOpenRecipe: (postId: string) => void;
  onAddProduct: (productId: number) => Promise<'added' | 'opened' | 'failed'>;
}

function useEnter(i: number) {
  const reduced = useReducedMotion();
  if (reduced) return FadeIn.duration(REDUCED.duration);
  return ZoomIn.duration(DURATION.base).delay(i * 55).easing(CURVE.enter).withInitialValues({ transform: [{ scale: 0.96 }], opacity: 0 });
}

export function CardList({ cards, animate, handlers }: { cards: CoachCard[]; animate: boolean; handlers: CardHandlers }) {
  const meals = cards.filter((c): c is MealCard => c.type === 'meal_suggestion');
  const rest = cards.filter((c) => c.type !== 'meal_suggestion');
  return (
    <View style={styles.list}>
      {meals.length ? <Meals cards={meals} animate={animate} onAdd={handlers.onAddMeal} /> : null}
      {rest.map((c, i) => {
        const key = `${c.type}-${i}`;
        const body =
          c.type === 'recipe' ? (
            <Recipe card={c} onOpen={handlers.onOpenRecipe} />
          ) : c.type === 'eatkcal_product' ? (
            <Product card={c} onAdd={handlers.onAddProduct} />
          ) : c.type === 'weekly_chart' ? (
            <WeeklyChart card={c} />
          ) : c.type === 'safety' ? (
            <Safety variant={c.variant} />
          ) : null;
        if (!body) return null;
        return animate ? (
          <EnterView key={key} i={i + (meals.length ? 1 : 0)}>
            {body}
          </EnterView>
        ) : (
          <View key={key}>{body}</View>
        );
      })}
    </View>
  );
}

function EnterView({ i, children }: { i: number; children: React.ReactNode }) {
  const entering = useEnter(i);
  return <Animated.View entering={entering}>{children}</Animated.View>;
}

// ── Öğün önerisi ────────────────────────────────────────────────────────────
function Meals({ cards, animate, onAdd }: { cards: MealCard[]; animate: boolean; onAdd: CardHandlers['onAddMeal'] }) {
  const { t: tr } = useT();
  const entering = useEnter(0);
  const inner = (
    <ScrollView {...SCROLL_KEYBOARD} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealsRow} accessibilityLabel={tr('coach.meals_a11y')} testID="coach-meals">
      {cards.map((c, i) => (
        <Meal key={`${c.name}-${i}`} card={c} index={i} onAdd={onAdd} />
      ))}
    </ScrollView>
  );
  return animate ? <Animated.View entering={entering}>{inner}</Animated.View> : inner;
}

function Meal({ card, index, onAdd }: { card: MealCard; index: number; onAdd: CardHandlers['onAddMeal'] }) {
  const { t: tr } = useT();
  const c = useCoachTones();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = added ? tr('coach.added') : tr('coach.add');
  const press = async () => {
    if (added || busy) return;
    setBusy(true);
    const ok = await onAdd(card, index);
    setBusy(false);
    if (ok) {
      haptic('success');
      setAdded(true);
    }
  };
  const macro = (k: string, v: number) => `${k} ${v} g`;
  return (
    <View style={[styles.card, styles.mealCard, { backgroundColor: c.card, borderColor: c.line }]} testID={`coach-meal-${index}`}>
      <View
        accessible
        accessibilityLabel={`${tr('coach.idea', { n: index + 1 })}. ${card.name}, ${card.kcal} kcal, ${macro(tr('coach.macro_p'), card.p)}, ${macro(tr('coach.macro_c'), card.c)}, ${macro(tr('coach.macro_f'), card.f)}`}
        style={styles.gap8}
      >
        <View style={styles.rowC}>
          <Image source={BOWL} style={styles.miniBowl} resizeMode="contain" />
          <AppText style={[styles.tag, { color: c.sec }]}>{tr('coach.idea', { n: index + 1 })}</AppText>
        </View>
        <AppText style={[styles.mealName, { color: c.text }]}>{card.name}</AppText>
        <View style={styles.macroRow}>
          <AppText style={[styles.kcal, { color: c.text }]}>{card.kcal} kcal</AppText>
          {[macro(tr('coach.macro_p'), card.p), macro(tr('coach.macro_c'), card.c), macro(tr('coach.macro_f'), card.f)].map((m) => (
            <View key={m} style={[styles.macroChip, { backgroundColor: c.nested }]}>
              <AppText style={[styles.macroText, { color: c.text }]}>{m}</AppText>
            </View>
          ))}
        </View>
      </View>
      <Pressable
        onPress={() => void press()}
        accessibilityRole="button"
        accessibilityLabel={tr('coach.add_a11y', { label, name: card.name, kcal: card.kcal, p: card.p, c: card.c, f: card.f })}
        accessibilityState={{ selected: added, busy, disabled: added }}
        style={[styles.cta, added ? { borderWidth: 1, borderColor: c.line2 } : { backgroundColor: LIME }]}
        testID={`coach-meal-add-${index}`}
      >
        {added ? <Check size={18} color={c.text} weight="bold" /> : <Plus size={18} color={LIME_INK} weight="bold" />}
        <AppText style={[styles.ctaText, { color: added ? c.text : LIME_INK }]}>{label}</AppText>
      </Pressable>
    </View>
  );
}

// ── Tarif ───────────────────────────────────────────────────────────────────
function Recipe({ card, onOpen }: { card: RecipeCard; onOpen: (id: string) => void }) {
  const { t: tr } = useT();
  const c = useCoachTones();
  const name = card.name ?? '';
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line, padding: 0, overflow: 'hidden' }]} testID="coach-recipe">
      <View accessible accessibilityLabel={tr('coach.recipe_a11y', { name, kcal: card.kcal ?? '' })}>
        {card.photo_url ? <Image source={{ uri: card.photo_url }} style={styles.recipeImg} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
        <View style={styles.recipeBody}>
          <AppText style={[styles.tag, { color: c.sec }]}>{tr('coach.recipe_tag')}</AppText>
          <AppText style={[styles.mealName, { color: c.text }]}>{name}</AppText>
          <View style={styles.macroRow}>
            {card.kcal != null ? <Chip text={`${Math.round(card.kcal)} kcal`} /> : null}
            {card.protein != null ? <Chip text={`P ${Math.round(card.protein)} g`} /> : null}
          </View>
        </View>
      </View>
      <View style={styles.recipeFoot}>
        <Pressable onPress={() => onOpen(card.post_id)} accessibilityRole="button" style={[styles.cta, { borderWidth: 1, borderColor: c.line2 }]} testID="coach-recipe-open">
          <AppText style={[styles.ctaText, { color: c.text }]}>{tr('coach.open_recipe')}</AppText>
          <CaretRight size={16} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

function Chip({ text }: { text: string }) {
  const c = useCoachTones();
  return (
    <View style={[styles.macroChip, { backgroundColor: c.nested }]}>
      <AppText style={[styles.macroText, { color: c.text }]}>{text}</AppText>
    </View>
  );
}

// ── eatkcal ürünü (yalnız İzmir) ────────────────────────────────────────────
function Product({ card, onAdd }: { card: ProductCard; onAdd: CardHandlers['onAddProduct'] }) {
  const { t: tr } = useT();
  const c = useCoachTones();
  const [inCart, setInCart] = useState(false);
  const [busy, setBusy] = useState(false);
  const price = card.price != null ? formatPrice(card.price) : '';
  const press = async () => {
    if (busy || inCart) return;
    setBusy(true);
    const r = await onAdd(card.product_id);
    setBusy(false);
    if (r === 'added') {
      haptic('light');
      setInCart(true);
    }
  };
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]} testID="coach-product">
      <View style={styles.prodRow} accessible accessibilityLabel={tr('coach.product_a11y', { name: card.name ?? '', price, kcal: card.kcal ?? '' })}>
        {card.img ? <Image source={{ uri: card.img }} style={styles.prodImg} resizeMode="cover" accessibilityIgnoresInvertColors /> : <View style={[styles.prodImg, { backgroundColor: c.nested }]} />}
        <View style={styles.flex1}>
          <View style={styles.rowC}>
            <AppText style={[styles.brand, { color: c.text }]}>eatkcal</AppText>
            <View style={[styles.izmir, { backgroundColor: c.nested }]}>
              <AppText style={[styles.izmirText, { color: c.sec }]}>İzmir</AppText>
            </View>
          </View>
          <AppText style={[styles.mealName, { color: c.text }]}>{card.name}</AppText>
          <View style={styles.macroRow}>
            {price ? <AppText style={[styles.kcal, { color: c.text }]}>{price}</AppText> : null}
            {card.kcal != null ? <Chip text={`${Math.round(card.kcal)} kcal`} /> : null}
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => void press()}
        accessibilityRole="button"
        accessibilityState={{ selected: inCart, busy }}
        style={[styles.cta, inCart ? { borderWidth: 1, borderColor: c.line2 } : { backgroundColor: LIME }]}
        testID="coach-product-add"
      >
        {inCart ? <Check size={18} color={c.text} weight="bold" /> : <ShoppingCart size={18} color={LIME_INK} />}
        <AppText style={[styles.ctaText, { color: inCart ? c.text : LIME_INK }]}>{inCart ? tr('coach.in_cart') : tr('coach.cart')}</AppText>
      </Pressable>
    </View>
  );
}

// ── Haftalık grafik ─────────────────────────────────────────────────────────
const BAR_H = 120;
function WeeklyChart({ card }: { card: ChartCard }) {
  const { t: tr } = useT();
  const c = useCoachTones();
  const [metric, setMetric] = useState<'kcal' | 'protein'>(card.metric);
  const { bars, goal, goalRatio, avg } = chartBars(card, metric);
  const days = tr('coach.days').split(',');
  const prot = metric === 'protein';
  const list = bars.map((b) => `${days[weekdayIndex(b.date)] ?? b.date} ${Math.round(b.value)}`).join(', ');
  const tab = (m: 'kcal' | 'protein', label: string) => {
    const on = metric === m;
    return (
      <Pressable
        onPress={() => {
          haptic('selection');
          setMetric(m);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={[styles.seg, on ? { backgroundColor: c.card, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null]}
        testID={`coach-chart-${m}`}
      >
        <AppText style={[styles.segText, { color: on ? c.text : c.sec }]}>{label}</AppText>
      </Pressable>
    );
  };
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]} testID="coach-chart">
      <View style={styles.chartHead}>
        <AppText style={[styles.chartTitle, { color: c.text }]} accessibilityRole="header">
          {tr('coach.last7')}
        </AppText>
        <AppText style={[styles.tag, { color: c.sec }]}>{prot ? tr('coach.avg_prot', { n: avg }) : tr('coach.avg_kcal', { n: avg })}</AppText>
      </View>
      <View style={[styles.segWrap, { backgroundColor: c.nested }]} accessibilityRole="tablist" accessibilityLabel={tr('coach.metric')}>
        {tab('kcal', tr('coach.kcal_tab'))}
        {tab('protein', tr('coach.prot_tab'))}
      </View>
      <View accessible accessibilityLabel={prot ? tr('coach.chart_a11y_prot', { list }) : tr('coach.chart_a11y_kcal', { list })} testID="coach-chart-bars">
        <View style={{ height: BAR_H + 4, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          {goalRatio != null ? (
            <View style={[styles.goalLine, { bottom: goalRatio * BAR_H, borderColor: c.line2 }]}>
              <AppText style={[styles.goalLbl, { color: c.sec }]}>{prot ? tr('coach.goal_prot', { n: goal ?? '' }) : tr('coach.goal_kcal', { n: goal ?? '' })}</AppText>
            </View>
          ) : null}
          {bars.map((b) => (
            <View key={b.date} style={styles.barCol}>
              <View style={[styles.bar, { height: Math.max(4, b.ratio * BAR_H), backgroundColor: b.good ? LIME : c.barOff }]} />
            </View>
          ))}
        </View>
        <View style={styles.daysRow}>
          {bars.map((b) => (
            <AppText key={b.date} style={[styles.day, { color: c.sec }]}>
              {days[weekdayIndex(b.date)] ?? ''}
            </AppText>
          ))}
        </View>
      </View>
      <View style={styles.legend}>
        <Legend color={LIME} text={prot ? tr('coach.leg_prot_in') : tr('coach.leg_in')} />
        <Legend color={c.barOff} text={prot ? tr('coach.leg_prot_low') : tr('coach.leg_over')} />
      </View>
    </View>
  );
}
function Legend({ color, text }: { color: string; text: string }) {
  const c = useCoachTones();
  return (
    <View style={styles.rowC}>
      <View style={[styles.legDot, { backgroundColor: color }]} />
      <AppText style={[styles.tag, { color: c.sec }]}>{text}</AppText>
    </View>
  );
}

// ── Uzmana danış (FinCoachSafety) ───────────────────────────────────────────
function Safety({ variant }: { variant: 'medical' | 'ed' }) {
  const { t: tr } = useT();
  const c = useCoachTones();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]} accessible testID={`coach-safety-${variant}`}>
      <View style={styles.rowC}>
        <View style={[styles.safeIcon, { backgroundColor: c.nested }]}>
          <Heartbeat size={22} color={c.text} />
        </View>
        <AppText style={[styles.chartTitle, { color: c.text, flex: 1 }]}>{tr('coach.safe_title')}</AppText>
      </View>
      <AppText style={[styles.safeBody, { color: c.sec }]}>{variant === 'ed' ? tr('coach.safe_body_ed') : tr('coach.safe_body')}</AppText>
      <View style={[styles.urgent, { backgroundColor: c.nested }]}>
        <AppText style={[styles.urgentText, { color: c.text }]}>{tr('coach.safe_urgent')}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  flex1: { flex: 1 },
  gap8: { gap: 8 },
  rowC: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 12 },
  mealsRow: { gap: 10, paddingRight: 16 },
  mealCard: { width: 232 },
  miniBowl: { width: 28, height: 20 },
  tag: { fontSize: 13, fontWeight: '500' },
  mealName: { fontSize: 16, fontWeight: '700', lineHeight: 21 },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  kcal: { fontSize: 17, fontWeight: '700', marginRight: 2 },
  macroChip: { borderRadius: 10, paddingHorizontal: 8, minHeight: 24, justifyContent: 'center' },
  macroText: { fontSize: 13, fontWeight: '600' },
  cta: { minHeight: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14 },
  ctaText: { fontSize: 15, fontWeight: '700' },
  recipeImg: { width: '100%', height: 150 },
  recipeBody: { padding: 14, gap: 6 },
  recipeFoot: { paddingHorizontal: 14, paddingBottom: 14 },
  prodRow: { flexDirection: 'row', gap: 12 },
  prodImg: { width: 76, height: 76, borderRadius: 14 },
  brand: { fontSize: 13, fontWeight: '700' },
  izmir: { borderRadius: 8, paddingHorizontal: 6, minHeight: 20, justifyContent: 'center' },
  izmirText: { fontSize: 12 },
  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chartTitle: { fontSize: 17, fontWeight: '700' },
  segWrap: { flexDirection: 'row', borderRadius: 14, padding: 3 },
  seg: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 15, fontWeight: '600' },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  goalLbl: { position: 'absolute', left: 0, bottom: 2, fontSize: 11 },
  barCol: { flex: 1, alignItems: 'center' },
  bar: { width: 18, borderRadius: 9 },
  daysRow: { flexDirection: 'row', marginTop: 6 },
  day: { flex: 1, textAlign: 'center', fontSize: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legDot: { width: 10, height: 10, borderRadius: 3 },
  safeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  safeBody: { fontSize: 15, lineHeight: 21 },
  urgent: { borderRadius: 14, padding: 12 },
  urgentText: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
});
