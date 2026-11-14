// G50-S1 md.1 — Ana sayfa ek bölümleri (kullanıcıyı içeri çekmek ve uygulamayı anlatmak için).
//  · 6a HomeFirstDayTasks — "İlk gün görevlerin" + ince ilerleme çubuğu + 3 satır (Plan · İlk tarama · Su).
//  · 6c HomeTodayRecipes — Keşfet'ten kalorisi + görseli olan tarifler (yatay, ≤ 8); "Güne ekle" (+).
//  · 6d HomeCoachPrompts — "Koç'a sor" altında 3 hazır soru çipi.
//  · 6e HomeStreakWeek — seri + bu haftanın 7 günlük mini sütunları (YALNIZ profilli kullanıcı; çağıran karar verir).
// Hepsi mevcut kart dili (useHomeTokens: kart zemini, çizgi, yarıçap 20) ve G49 md.3 giriş animasyonu (8 pt + fade,
// HOME_GATE_MOTION; azaltılmış harekette yalnız opaklık). Gerçek veri yoksa bölüm HİÇ çizilmez.
// Gezinme / profil kapısı çağıranda (TrackerScreen). Ölçüm: home_<bölüm>_view (bir kez) / _tap.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppText } from '../../../core/design/components/AppText';
import { DURATION, HOME_GATE_MOTION, REDUCED, haptic, useReducedMotion } from '../../../core/design/motion';
import { palette } from '../../../core/design/tokens';
import { useT } from '../../../core/i18n';
import { getSupabaseClient } from '../../../core/supabase';
import { track } from '../../../lib/analytics';
import { CachedImage } from '../../../components/CachedImage';
import { CaretRight, ChatCircleDots, Check, Plus } from '../../../components/icons';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { BRICOLAGE_SEMI, useHomeTokens } from '../../onboarding/first/homeTokens';
import { GLASS } from '../../personalPlan/ui/parts';
import { devFrozenAt, frozenEnter } from '../../kayit/ui/homeGateDev';
import { getKesfetClient } from '../../kesfet/client';
import { useKesfetStore } from '../../kesfet/store';
import { AddToDaySheet } from '../../kesfet/ui/AddToDaySheet';
import type { FeedPost, MealType } from '../../kesfet/types';
import { logTrace } from '../../shell/logTrace';
import { trackEvent } from '../track/events';
import {
  COACH_PROMPTS,
  homeStreak,
  recipesFromFeed,
  taskRows,
  tasksDismissKey,
  tasksView,
  weekColumns,
  withinFirstDays,
  type CoachPrompt,
  type DayBucketLike,
  type FirstTask,
  type HomeRecipe,
} from './homeSectionRules';

// ─── Veri sağlayıcı (vitrin / test değiştirebilir) ───────────────────────────
export type HomeExtrasProvider = {
  /** İlk `ai_scan` öğün kaydı ve ilk su kaydı var mı (sunucu). Hata → null (kart gizli). */
  firstRecords: (userId: string) => Promise<{ scan: boolean; water: boolean } | null>;
  /** Keşfet akışı (tarifler buradan süzülür). */
  feed: (lang: string) => Promise<FeedPost[]>;
};

async function realFirstRecords(userId: string): Promise<{ scan: boolean; water: boolean } | null> {
  try {
    const sb = getSupabaseClient();
    const [scan, water] = await Promise.all([
      sb.from('meal_consumptions').select('id').eq('user_id', userId).eq('source', 'ai_scan').limit(1),
      sb.from('water_daily').select('day').eq('user_id', userId).gt('ml', 0).limit(1),
    ]);
    if (scan.error || water.error || !Array.isArray(scan.data) || !Array.isArray(water.data)) return null;
    return { scan: scan.data.length > 0, water: water.data.length > 0 };
  } catch {
    return null;
  }
}

const realProvider: HomeExtrasProvider = {
  firstRecords: realFirstRecords,
  feed: async (lang) => (await getKesfetClient().getFeed({ tab: 'for_you', lang, limit: 30 })).items,
};
let provider: HomeExtrasProvider = realProvider;
/** Yalnız vitrin / test. */
export function setHomeExtrasProvider(p: Partial<HomeExtrasProvider> | null): void {
  provider = p ? { ...realProvider, ...p } : realProvider;
}

// ─── Ortak: G49 md.3 giriş animasyonu + bölüm başlığı + bir kez görüntülenme ──
export function HomeEnter({ index = 0, style, children, testID }: { index?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode; testID?: string }) {
  const reduced = useReducedMotion();
  const frozen = devFrozenAt();
  const o = useSharedValue(frozen != null ? frozenEnter(frozen, index) : 0);
  useEffect(() => {
    const M = HOME_GATE_MOTION;
    if (frozen != null) return;
    if (reduced) o.value = withTiming(1, { duration: REDUCED.duration });
    else o.value = withDelay(index * M.actStagger, withTiming(1, { duration: M.actEnter, easing: M.actCurve }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const enter = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: reduced ? 0 : (1 - o.value) * HOME_GATE_MOTION.actShift }],
  }));
  return (
    <Animated.View testID={testID} style={[style, enter]}>
      {children}
    </Animated.View>
  );
}

function useViewOnce(fire: () => void, when: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!when || done.current) return;
    done.current = true;
    fire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when]);
}

function SectionTitle({ title, onAll, allLabel }: { title: string; onAll?: () => void; allLabel?: string }) {
  const k = useHomeTokens();
  return (
    <View style={styles.headRow}>
      <AppText accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.h2, { color: k.text }]}>
        {title}
      </AppText>
      {onAll && allLabel ? (
        <Pressable onPress={onAll} accessibilityRole="link" accessibilityLabel={allLabel} hitSlop={4} style={styles.all} testID="home-recipes-all">
          <AppText maxFontSizeMultiplier={1.3} style={[styles.allText, { color: k.text }]}>
            {allLabel}
          </AppText>
          <CaretRight size={14} color={k.text} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── 6a İlk gün görevleri ────────────────────────────────────────────────────
const DONE_RING = 44;
const DONE_STROKE = 5;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface FirstDayTasksProps {
  userId: string | null;
  createdAt: string | null | undefined;
  /** Profil var mı (bilinmiyorsa null → kart gizli). */
  planDone: boolean | null;
  /** Su takibi (sunucu `water_daily`) açık mı; kapalıysa su görevi listede yok. */
  waterOn: boolean;
  /** Bu oturumdaki yerel sinyaller (bugün ai_scan kaydı / bugün su) — sunucu yanıtını beklemeden işaretler. */
  localScan?: boolean;
  localWater?: boolean;
  /** Değişince sunucu yeniden okunur (odak / yeni kayıt). */
  refreshKey?: number | string;
  onTask: (task: FirstTask) => void;
}

function useFirstRecords(userId: string | null, enabled: boolean, refreshKey: number | string | undefined) {
  const [rec, setRec] = useState<{ scan: boolean; water: boolean } | null>(null);
  useEffect(() => {
    if (!enabled || !userId) return;
    let alive = true;
    Promise.resolve()
      .then(() => provider.firstRecords(userId))
      .then((r) => alive && r && setRec(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, enabled, refreshKey]);
  return rec;
}

function useDismissed(userId: string | null) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setDismissed(null);
    AsyncStorage.getItem(tasksDismissKey(userId))
      .then((v) => alive && setDismissed(v === '1'))
      .catch(() => alive && setDismissed(false));
    return () => {
      alive = false;
    };
  }, [userId]);
  const dismiss = useCallback(() => {
    setDismissed(true);
    if (userId) void AsyncStorage.setItem(tasksDismissKey(userId), '1').catch(() => {});
  }, [userId]);
  return { dismissed, dismiss };
}

function TaskCheck({ done }: { done: boolean }) {
  const k = useHomeTokens();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[styles.check, done ? { backgroundColor: palette.lime, borderColor: palette.lime } : { borderColor: k.line2 }]}
    >
      {done ? <Check size={14} color={palette.limeInk} weight="bold" /> : null}
    </View>
  );
}

function ProgressBar({ k: frac }: { k: number }) {
  const t = useHomeTokens();
  const reduced = useReducedMotion();
  const w = useSharedValue(frac);
  useEffect(() => {
    w.value = reduced ? frac : withTiming(frac, { duration: DURATION.base });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frac, reduced]);
  const st = useAnimatedStyle(() => ({ width: `${Math.round(w.value * 1000) / 10}%` }));
  return (
    <View style={[styles.bar, { backgroundColor: t.track }]} testID="home-tasks-bar">
      <Animated.View style={[styles.barFill, { backgroundColor: t.limeLine }, st]} />
    </View>
  );
}

/** 3/3: halka dolar + "Harika başlangıç!" (konfeti yok), kısa bekleme, sonra kart kaybolur. */
function TasksCelebrate({ onDone }: { onDone: () => void }) {
  const k = useHomeTokens();
  const { t } = useT();
  const reduced = useReducedMotion();
  const d = useSharedValue(reduced ? 1 : 0);
  const o = useSharedValue(1);
  useEffect(() => {
    if (!reduced) d.value = withTiming(1, { duration: HOME_GATE_MOTION.draw, easing: HOME_GATE_MOTION.drawCurve });
    haptic('success');
    const id = setTimeout(() => {
      o.value = withTiming(0, { duration: reduced ? REDUCED.duration : DURATION.fast });
      setTimeout(onDone, reduced ? REDUCED.duration : DURATION.fast);
    }, HOME_GATE_MOTION.celebrateHold);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const r = (DONE_RING - DONE_STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const ring = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - d.value) }));
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[styles.card, styles.celebrate, { backgroundColor: k.card, borderColor: k.line }, fade]}
      testID="home-tasks-celebrate"
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${t('home.x_tasks_done')} ${t('home.x_tasks_done_sub')}`}
    >
      <Svg width={DONE_RING} height={DONE_RING} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={DONE_RING / 2} cy={DONE_RING / 2} r={r} stroke={k.track} strokeWidth={DONE_STROKE} fill="none" />
        <AnimatedCircle
          cx={DONE_RING / 2}
          cy={DONE_RING / 2}
          r={r}
          stroke={k.limeLine}
          strokeWidth={DONE_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={ring}
          testID="home-tasks-ring"
        />
      </Svg>
      <View style={styles.flex}>
        <AppText maxFontSizeMultiplier={1.3} style={[styles.rowTitle, { color: k.text }]}>
          {t('home.x_tasks_done')}
        </AppText>
        <AppText maxFontSizeMultiplier={1.3} style={[styles.small, { color: k.sec }]}>
          {t('home.x_tasks_done_sub')}
        </AppText>
      </View>
    </Animated.View>
  );
}

export function HomeFirstDayTasks({ userId, createdAt, planDone, waterOn, localScan = false, localWater = false, refreshKey, onTask }: FirstDayTasksProps) {
  const k = useHomeTokens();
  const { t } = useT();
  const { dismissed, dismiss } = useDismissed(userId);
  const eligible = !!userId && dismissed === false && withinFirstDays(createdAt);
  const rec = useFirstRecords(userId, eligible, refreshKey);
  const rows = taskRows({
    plan: planDone,
    scan: rec ? rec.scan || localScan : null,
    water: !waterOn ? 'off' : rec ? rec.water || localWater : null,
  });
  const view = tasksView({ createdAt, rows, dismissed });
  const doneCount = rows ? rows.filter((r) => r.done).length : 0;
  const total = rows?.length ?? 0;
  useViewOnce(() => track('home_tasks_view', { done: doneCount, total }), view !== 'hidden');
  if (view === 'hidden' || !rows) return null;
  if (view === 'celebrate') {
    return (
      <View style={styles.section} testID="home-tasks">
        <TasksCelebrate onDone={dismiss} />
      </View>
    );
  }
  return (
    <HomeEnter style={styles.section} testID="home-tasks">
      <View style={[styles.card, { backgroundColor: k.card, borderColor: k.line }]}>
        <View accessible accessibilityRole="header" accessibilityLabel={t('home.x_tasks_a11y', { done: doneCount, total })} style={styles.tasksHead}>
          <AppText maxFontSizeMultiplier={1.3} style={[styles.cardTitle, { color: k.text }]}>
            {t('home.x_tasks_title')}
          </AppText>
          <AppText maxFontSizeMultiplier={1.3} style={[styles.count, { color: k.sec }]} testID="home-tasks-count">
            {t('home.x_tasks_count', { done: doneCount, total })}
          </AppText>
        </View>
        <ProgressBar k={total > 0 ? doneCount / total : 0} />
        <View style={styles.taskList}>
          {rows.map((r) => {
            const label = t(`home.x_task_${r.key}`);
            return (
              <Pressable
                key={r.key}
                testID={`home-task-${r.key}`}
                onPress={() => {
                  haptic('light');
                  track('home_tasks_tap', { task: r.key, done: r.done });
                  onTask(r.key);
                }}
                accessibilityRole="button"
                accessibilityState={{ checked: r.done }}
                accessibilityLabel={`${label}, ${t(r.done ? 'home.x_task_done' : 'home.x_task_todo')}`}
                style={({ pressed }) => [styles.taskRow, { transform: [{ scale: pressed ? HOME_GATE_MOTION.pressScale : 1 }] }]}
              >
                <TaskCheck done={r.done} />
                {/* Tamamlanan satır soluk DEĞİL, üstü çizili DEĞİL: yalnız işaret dolar. */}
                <AppText maxFontSizeMultiplier={1.3} style={[styles.rowTitle, styles.flex, { color: k.text }]}>
                  {label}
                </AppText>
                <CaretRight size={16} color={k.sec} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </HomeEnter>
  );
}

// ─── 6e Seri ve haftalık özet ────────────────────────────────────────────────
const COL_H = 36;

export interface StreakWeekProps {
  days: readonly DayBucketLike[];
  todayKey: string;
  todayCount: number;
  targetKcal: number | null;
  /** false → veri yükleniyor / yok: kart çizilmez. */
  ready: boolean;
  onOpen: () => void;
}

export function HomeStreakWeek({ days, todayKey, todayCount, targetKcal, ready, onOpen }: StreakWeekProps) {
  const k = useHomeTokens();
  const { t } = useT();
  const has = ready && days.length > 0;
  useViewOnce(() => track('home_streak_view'), has);
  const cols = useMemo(() => (has ? weekColumns(days, todayKey, targetKcal) : []), [has, days, todayKey, targetKcal]);
  if (!has) return null;
  const streak = homeStreak(days, todayKey, todayCount);
  const title = streak > 0 ? t('home.x_streak_on', { count: streak }) : t('home.x_streak_zero');
  const letters = t('home.x_week_days').split(',');
  const logged = cols.filter((c) => c.logged || (c.today && todayCount > 0)).length;
  return (
    <HomeEnter style={styles.section} testID="home-streak">
      <Pressable
        onPress={() => {
          haptic('light');
          track('home_streak_tap');
          onOpen();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('home.x_streak_a11y', { title, logged })}
        style={({ pressed }) => [
          styles.card,
          styles.streakCard,
          { backgroundColor: k.card, borderColor: k.line, transform: [{ scale: pressed ? HOME_GATE_MOTION.pressScale : 1 }] },
        ]}
      >
        <Image source={GLASS.trophy} style={styles.cup} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
        <View style={styles.flex}>
          <AppText maxFontSizeMultiplier={1.3} style={[styles.rowTitle, { color: k.text }]} testID="home-streak-title">
            {title}
          </AppText>
          <AppText maxFontSizeMultiplier={1.3} style={[styles.small, { color: k.sec }]}>
            {t('home.x_streak_week')}
          </AppText>
        </View>
        <View style={styles.weekCols} importantForAccessibility="no-hide-descendants">
          {cols.map((c, i) => (
            <View key={c.key} style={styles.weekCol}>
              <View style={[styles.colTrack, { backgroundColor: k.track }]}>
                <View
                  testID="home-streak-col"
                  style={[
                    styles.colFill,
                    { height: c.kcal > 0 ? Math.max(4, Math.round(COL_H * c.k)) : 0, backgroundColor: c.today ? palette.lime : k.limeLine },
                  ]}
                />
              </View>
              <AppText maxFontSizeMultiplier={1.1} style={[styles.dayLetter, { color: c.today ? k.text : k.sec }]}>
                {letters[i] ?? ''}
              </AppText>
            </View>
          ))}
        </View>
      </Pressable>
    </HomeEnter>
  );
}

// ─── 6d Koç hazır soruları ───────────────────────────────────────────────────
export function HomeCoachPrompts({ onPrompt }: { onPrompt: (p: CoachPrompt, text: string) => void }) {
  const k = useHomeTokens();
  const { t } = useT();
  useViewOnce(() => track('home_coach_prompts_view'), true);
  return (
    <View style={styles.section} testID="home-coach-prompts">
      <SectionTitle title={t('home.x_coach_title')} />
      <View style={styles.chips}>
        {COACH_PROMPTS.map((p, i) => {
          const q = t(`home.x_coach_${p}`);
          return (
            <HomeEnter key={p} index={i}>
              <Pressable
                testID={`home-coach-${p}`}
                onPress={() => {
                  haptic('light');
                  track('home_coach_prompts_tap', { prompt: p });
                  onPrompt(p, q);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('home.x_coach_a11y', { q })}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: k.card, borderColor: k.line, transform: [{ scale: pressed ? HOME_GATE_MOTION.pressScale : 1 }] },
                ]}
              >
                <ChatCircleDots size={16} color={k.text} weight="bold" />
                <AppText maxFontSizeMultiplier={1.3} style={[styles.chipText, { color: k.text }]}>
                  {q}
                </AppText>
              </Pressable>
            </HomeEnter>
          );
        })}
      </View>
    </View>
  );
}

// ─── 6c Bugünün tarifleri ────────────────────────────────────────────────────
const RECIPE_W = 168;
const RECIPE_PHOTO = 120;

export interface TodayRecipesProps {
  onOpen: (postId: string) => void;
  onAll: () => void;
  /** Profil kapısı: kayıt akışına yönlendirdiyse true (sheet açılmaz; dönüşte `openSignal`). */
  requireGate: (postId: string) => boolean;
  /** Kayıt akışından dönüşte "Güne ekle" sheet'ini bu tarif için aç. */
  openSignal?: string | null;
  onOpenSignalUsed?: () => void;
}

function RecipeCard({ r, index, onOpen, onAdd }: { r: HomeRecipe; index: number; onOpen: () => void; onAdd: () => void }) {
  const k = useHomeTokens();
  const { t, fmt } = useT();
  const meta = r.protein != null ? t('home.x_recipe_meta', { kcal: fmt(r.kcal), protein: fmt(r.protein) }) : t('home.x_recipe_kcal', { kcal: fmt(r.kcal) });
  return (
    <HomeEnter index={Math.min(index, 3)} style={styles.recipe}>
      <Pressable
        testID={`home-recipe-${r.id}`}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${r.name}, ${meta}`}
        style={({ pressed }) => [{ transform: [{ scale: pressed ? HOME_GATE_MOTION.pressScale : 1 }] }]}
      >
        <View style={[styles.recipePhoto, { backgroundColor: k.ph }]}>
          <CachedImage uri={r.photo} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.recipeText}>
          <AppText maxFontSizeMultiplier={1.3} numberOfLines={2} style={[styles.recipeName, { color: k.text }]}>
            {r.name}
          </AppText>
          <AppText maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.small, { color: k.sec }]}>
            {meta}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        testID={`home-recipe-add-${r.id}`}
        onPress={() => {
          haptic('light');
          onAdd();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('home.x_recipe_add_a11y', { name: r.name })}
        style={styles.addHit}
      >
        <View style={styles.addBtn}>
          <Plus size={18} color={palette.limeInk} weight="bold" />
        </View>
      </Pressable>
    </HomeEnter>
  );
}

export function HomeTodayRecipes({ onOpen, onAll, requireGate, openSignal, onOpenSignalUsed }: TodayRecipesProps) {
  const { t, lang } = useT();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [sheet, setSheet] = useState<FeedPost | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => provider.feed(lang))
      .then((items) => alive && setPosts(items ?? []))
      .catch(() => alive && setPosts([]));
    return () => {
      alive = false;
    };
  }, [lang]);
  const recipes = useMemo(() => recipesFromFeed(posts), [posts]);
  const byId = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  useViewOnce(() => track('home_recipes_view', { count: recipes.length }), recipes.length > 0);
  // Kayıt akışından dönüş: sheet bu tarif için bir kez açılır.
  useEffect(() => {
    if (!openSignal) return;
    const p = byId.get(openSignal);
    if (!p) return;
    setSheet(p);
    onOpenSignalUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal, byId]);
  const onAdd = useCallback(async (mealType: MealType, portion: number) => {
    const post = sheet;
    setSheet(null);
    if (!post?.meal_card) return;
    seq.current += 1;
    const key = `home-recipe-${post.id}-${mealType}-${portion}-${seq.current}`;
    const id = await useKesfetStore.getState().addToDay(post.id, mealType, portion, key);
    if (!id) return;
    const kcal = Math.round(post.meal_card.kcal * portion);
    trackEvent({ name: 'log_add', props: { source: 'kesfet', slot: mealType, kcal, offline: false } });
    void logTrace({
      rect: null,
      imageUri: post.meal_card.photo_url ?? null,
      mealLabel: t(`meal.${mealType}`),
      source: 'kesfet',
      kcal,
      name: post.meal_card.name,
      id,
      undo: async () => {
        const ok = await useKesfetStore.getState().undoAddToDay(post.id, id, key);
        if (ok) trackEvent({ name: 'log_delete', props: { source: 'kesfet', slot: mealType, undone: false } });
      },
    });
  }, [sheet, t]);
  if (recipes.length === 0) return null;
  return (
    <View style={styles.section} testID="home-recipes">
      <SectionTitle
        title={t('home.x_recipes_title')}
        allLabel={t('home.ek_all')}
        onAll={() => {
          track('home_recipes_tap', { action: 'all' });
          onAll();
        }}
      />
      <ScrollView {...SCROLL_KEYBOARD} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipeRow} style={styles.bleed}>
        {recipes.map((r, i) => (
          <RecipeCard
            key={r.id}
            r={r}
            index={i}
            onOpen={() => {
              track('home_recipes_tap', { action: 'open' });
              onOpen(r.id);
            }}
            onAdd={() => {
              track('home_recipes_tap', { action: 'add' });
              if (requireGate(r.id)) return;
              const p = byId.get(r.id);
              if (p) setSheet(p);
            }}
          />
        ))}
      </ScrollView>
      <AddToDaySheet visible={sheet != null} onClose={() => setSheet(null)} meal={sheet?.meal_card ?? null} authorHandle={sheet?.author.handle ?? ''} onAdd={onAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 20 },
  bleed: { marginHorizontal: -16 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  h2: { flexShrink: 1, fontFamily: BRICOLAGE_SEMI, fontSize: 20, lineHeight: 26 },
  all: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  allText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, lineHeight: 18 },
  card: { borderRadius: 20, borderWidth: 1, padding: 14 },
  flex: { flex: 1, minWidth: 0 },
  cardTitle: { flexShrink: 1, fontFamily: BRICOLAGE_SEMI, fontSize: 18, lineHeight: 23 },
  count: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, lineHeight: 17, fontVariant: ['tabular-nums'] },
  tasksHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  bar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  taskList: { marginTop: 6 },
  taskRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, lineHeight: 20 },
  small: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, lineHeight: 17 },
  celebrate: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76 },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76 },
  cup: { width: 40, height: 35 },
  weekCols: { flexDirection: 'row', gap: 5, alignItems: 'flex-end' },
  weekCol: { alignItems: 'center', gap: 3 },
  colTrack: { width: 8, height: COL_H, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  colFill: { width: 8, borderRadius: 4 },
  dayLetter: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, lineHeight: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, lineHeight: 18, flexShrink: 1 },
  recipeRow: { gap: 12, paddingHorizontal: 16 },
  recipe: { width: RECIPE_W },
  recipePhoto: { height: RECIPE_PHOTO, borderRadius: 16, overflow: 'hidden' },
  recipeText: { paddingHorizontal: 2, paddingTop: 8, gap: 2 },
  recipeName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 18 },
  // "+" görsel 32 pt, dokunma alanı 44 pt (görselin sağ alt köşesinde).
  addHit: { position: 'absolute', top: RECIPE_PHOTO - 44, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.lime, alignItems: 'center', justifyContent: 'center' },
});
