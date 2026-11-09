// FinTopBlock — G18-S2 md.1 (Tur 26): FinHomeR3 varyant (a) "Gün çekirdeği" üst blok
// (yeni kabuk). Yalnız TrackerDayHeader (bayrak `yeni_kabuk` açık) çizer.
//
//  • Hero (pano `section ringRegion`): 152'lik Gün halkası (r70, kontur 12; iz
//    #E3E5E9/#2C2C2E, dolgu #4A6B00/lime), merkezde soyut cam form = ALEV (G18-ORTAK
//    #14; Final'de damla) 64×86; hedef yoksa iz kesikli (4 8), alev 44×59 + "Hedef
//    belirlenmedi". Sağda: Enerji · sayı (Bricolage 700/28) · birim; Protein ve Su
//    satırları (13 pt, değer 600, 4 pt çubuk). Aralık 20.
//  • FinMoFocus (a): girişte alev −8°→0° + ölçek 0.96→1, opaklık ilk %30'da 0→1,
//    900 ms enter (köken %50 %62). Kayıtta halka eski değerden yeniye 500 ms
//    standard dolar; çekirdek kıpırdamaz. Boşta döngü YOK. Ekran odaktan çıkınca
//    giriş son karesine atlar (geri gelince baştan oynamaz). Azaltılmış: 200 ms
//    opaklık, dönme/ölçek yok; halka geçişsiz atlar. Giriş uygulama oturumu
//    başına bir kez (sekme dönüşünde tekrar etmez).
//  • Gün boşken (FinHomeEmptyR1): hero altında S1'in "İlk öğününü ekle" kartı.
//  • Profil kartı yuvası (S1) → makro çipleri (44'lük halka, "%59", ad + "82 / 140 g").
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';

import { AppText, useTheme, haptic, CURVE, DURATION, REDUCED, useReducedMotion } from '../../core/design';
import { useT } from '../../core/i18n';
import { TrophyIcon } from '../../components/icons';
import { RollingNumber } from '../../modules/gun/ui';
import type { NumLang } from '../../modules/gun/motion';
import { WATER_STEP_ML, formatLiters, pctLabel } from '../../modules/gun/waterFormat';
import { HomeFirstMealCard, HomeOnboardingSlot, useOrientTarget } from '../../modules/onboarding/first'; // G18-S1: profil kartı yuvası, ilk öğün kartı, Orient3 hedefi

export { pctLabel };

/** FinHomeR3 renkleri (pano tokens()): iz, iç dolgu, Enerji konturu, ikincil. */
export function finTokens(isDark: boolean) {
  return isDark
    ? { track: '#2C2C2E', nested: '#2C2C2E', limeLine: '#C6F04F', sec: '#A1A1A6' }
    : { track: '#E3E5E9', nested: '#FFFFFF', limeLine: '#4A6B00', sec: '#6B6B70' };
}

const BRICOLAGE_BOLD = 'BricolageGrotesque_700Bold';
const FLAME = require('../../../assets/glass/flame.png');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING = 152;
const R = 70;
const CIRC = 2 * Math.PI * R;

// Uygulama oturumu başına bir kez (FinMoFocus: "bir kez oynar ve son karede durur").
let focusPlayed = false;
/** Yalnız test: giriş oynatma durumunu sıfırlar. */
export function __resetFocusPlayed(): void {
  focusPlayed = false;
}

function useFocusEntry() {
  const reduced = useReducedMotion();
  const op = useSharedValue(focusPlayed ? 1 : 0);
  const rot = useSharedValue(focusPlayed || reduced ? 0 : -8);
  const sc = useSharedValue(focusPlayed || reduced ? 1 : 0.96);
  useEffect(() => {
    if (focusPlayed) return;
    focusPlayed = true;
    if (reduced) {
      op.value = withTiming(1, { duration: REDUCED.duration });
      return;
    }
    // Opaklık ilk ~%30'da dolar (pano 270 ms → en yakın token base 300); dönme + ölçek 900 ms enter.
    op.value = withTiming(1, { duration: DURATION.base, easing: CURVE.enter });
    rot.value = withTiming(0, { duration: DURATION.story, easing: CURVE.enter });
    sc.value = withTiming(1, { duration: DURATION.story, easing: CURVE.enter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Ekran dışı: animasyon son karesine atlar.
  useFocusEffect(
    useCallback(
      () => () => {
        cancelAnimation(op);
        cancelAnimation(rot);
        cancelAnimation(sc);
        op.value = 1;
        rot.value = 0;
        sc.value = 1;
      },
      [op, rot, sc],
    ),
  );
  return useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ rotate: `${rot.value}deg` }, { scale: sc.value }],
  }));
}

function HeroRing({ progress, hasTarget, color, track }: { progress: number; hasTarget: boolean; color: string; track: string }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(progress);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      p.value = progress;
      return;
    }
    p.value = reduced ? progress : withTiming(progress, { duration: DURATION.slow, easing: CURVE.standard });
  }, [progress, reduced, p]);
  const arc = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - Math.min(Math.max(p.value, 0), 1)),
    strokeOpacity: p.value > 0 ? 1 : 0,
  }));
  return (
    <Svg width={RING} height={RING} viewBox="0 0 152 152" style={StyleSheet.absoluteFill}>
      <Circle cx={76} cy={76} r={R} fill="none" stroke={track} strokeWidth={12} strokeDasharray={hasTarget ? undefined : '4 8'} />
      {hasTarget ? (
        <AnimatedCircle
          cx={76}
          cy={76}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${CIRC} ${CIRC}`}
          animatedProps={arc}
          transform="rotate(-90 76 76)"
        />
      ) : null}
    </Svg>
  );
}

function StatRow({
  name,
  label,
  bar,
  onPress,
  accessibilityLabel,
}: {
  name: string;
  label: string;
  bar: number | null;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const k = finTokens(t.isDark);
  const body = (
    <>
      <View style={styles.statHead}>
        <AppText style={[styles.statName, { color: k.sec }]} numberOfLines={1}>
          {name}
        </AppText>
        <AppText style={styles.statVal} numberOfLines={1}>
          {label}
        </AppText>
      </View>
      {bar != null ? (
        <View style={[styles.statTrack, { backgroundColor: k.track }]}>
          <View style={[styles.statFill, { width: `${Math.round(Math.min(Math.max(bar, 0), 1) * 100)}%`, backgroundColor: t.color.ink }]} />
        </View>
      ) : null}
    </>
  );
  if (!onPress) return <View style={styles.stat}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={styles.stat}>
      {body}
    </Pressable>
  );
}

function MacroChip({ label, value, target, hasTarget, lang }: { label: string; value: number; target: number; hasTarget: boolean; lang: string }) {
  const t = useTheme();
  const k = finTokens(t.isDark);
  const p = hasTarget && target > 0 ? value / target : 0;
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <View style={styles.chip}>
      <View style={styles.chipRing}>
        <Svg width={44} height={44} viewBox="0 0 48 48" style={StyleSheet.absoluteFill}>
          <Circle cx={24} cy={24} r={r} fill={k.nested} />
          <Circle cx={24} cy={24} r={r} fill="none" stroke={k.track} strokeWidth={3} />
          {p > 0 ? (
            <Circle
              cx={24}
              cy={24}
              r={r}
              fill="none"
              stroke={t.color.ink}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${Math.min(p, 1) * c} ${c}`}
              transform="rotate(-90 24 24)"
            />
          ) : null}
        </Svg>
        <AppText style={styles.chipPct} numberOfLines={1} maxFontSizeMultiplier={1}>
          {hasTarget ? pctLabel(p, lang) : '—'}
        </AppText>
      </View>
      <View style={styles.chipText}>
        <AppText style={[styles.chipName, { color: k.sec }]} numberOfLines={1}>
          {label}
        </AppText>
        <AppText style={styles.chipVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {hasTarget ? `${Math.round(value)} / ${Math.round(target)} g` : `${Math.round(value)} g`}
        </AppText>
      </View>
    </View>
  );
}

export interface FinTopBlockProps {
  kcal: number;
  target: number;
  macros: { protein: number; carbs: number; fat: number };
  macroTargets: { protein: number; carbs: number; fat: number };
  water?: { ml: number | null; targetMl: number } | null;
  onWaterAdd?: () => void;
  /** Gün boşken "İlk öğününü ekle" → Tara. */
  onFirstLog?: () => void;
  /** Gün boşken "İlk öğününü ekle" → Elle gir (verilmezse onFirstLog). */
  onFirstManual?: () => void;
  onOpenMacros?: () => void;
  popStyle?: object;
  streak?: number;
  /** Kullanıcının kayıtlı hedefi var mı (yoksa "Hedef belirlenmedi"). Varsayılan true. */
  hasTarget?: boolean;
}

export function FinTopBlock({
  kcal,
  target,
  macros,
  macroTargets,
  water,
  onWaterAdd,
  onFirstLog,
  onFirstManual,
  onOpenMacros,
  popStyle,
  streak = 0,
  hasTarget = true,
}: FinTopBlockProps) {
  const t = useTheme();
  const { t: tt, lang } = useT();
  const k = finTokens(t.isDark);
  const numLang = (lang === 'en' ? 'en' : 'tr') as NumLang;
  const empty = kcal <= 0 && macros.protein <= 0 && macros.carbs <= 0 && macros.fat <= 0;
  const over = hasTarget && !empty && target > 0 && kcal > target;
  const p = hasTarget && target > 0 ? kcal / target : 0;
  const group = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, numLang === 'tr' ? '.' : ',');
  const coreStyle = useFocusEntry();

  const orientRing = useOrientTarget('ring', { ready: !empty }); // G18-S1 temas: Orient3 (ilk kayıttan sonra)
  const energyUnit = !hasTarget
    ? tt('home.kcal_today')
    : empty
      ? tt('home.kcal_goal_today')
      : over
        ? tt('gun.kcal_over')
        : tt('gun.kcal_left');
  const energyNum = !hasTarget ? group(Math.max(0, kcal)) : empty ? group(target) : over ? `+${group(kcal - target)}` : null;
  const left = Math.max(0, Math.round(target - kcal));
  const wMl = water?.ml ?? 0;
  const ringA11y = !hasTarget
    ? tt('home.ring_a11y_nogoal', { num: energyNum ?? '', unit: energyUnit })
    : tt('home.ring_a11y', { num: energyNum ?? group(left), unit: energyUnit, pct: Math.round(Math.min(p, 9.99) * 100) });

  return (
    <View style={styles.block}>
      <View style={styles.hero} accessibilityLabel={tt('home.ring_region')}>
        <Pressable
          onPress={onOpenMacros}
          disabled={!onOpenMacros}
          accessibilityRole={onOpenMacros ? 'button' : 'image'}
          accessibilityLabel={ringA11y}
          style={styles.ringBox}
          testID="home-hero-ring"
          {...orientRing}
        >
          <Animated.View style={[StyleSheet.absoluteFill, popStyle]}>
            <HeroRing progress={Math.min(p, 1)} hasTarget={hasTarget} color={k.limeLine} track={k.track} />
            <View style={styles.core} pointerEvents="none">
              <Animated.Image
                source={FLAME}
                resizeMode="contain"
                style={[hasTarget ? styles.flameBig : styles.flameSmall, styles.flameOrigin, coreStyle]}
                testID="home-hero-flame"
              />
              {!hasTarget ? (
                <AppText style={[styles.noGoal, { color: k.sec }]} numberOfLines={2}>
                  {tt('home.no_goal')}
                </AppText>
              ) : null}
            </View>
          </Animated.View>
        </Pressable>
        <View style={styles.side}>
          <View>
            <AppText style={[styles.small, { color: k.sec }]}>{tt('gun.status_energy')}</AppText>
            {energyNum != null ? (
              <AppText style={styles.num} numberOfLines={1}>
                {energyNum}
              </AppText>
            ) : (
              <RollingNumber
                value={left}
                lang={numLang}
                fontSize={28}
                fontFamily={BRICOLAGE_BOLD}
                slotRatio={0.56}
                color={t.color.ink}
                accessibilityLabel={tt('gun.goal_kcal', { kcal, target })}
              />
            )}
            <AppText style={[styles.small, { color: k.sec }]} numberOfLines={1}>
              {energyUnit}
            </AppText>
          </View>
          <StatRow
            name={tt('gun.macro_protein')}
            label={hasTarget ? `${Math.round(macros.protein)} / ${Math.round(macroTargets.protein)} g` : `${Math.round(macros.protein)} g`}
            bar={hasTarget && macroTargets.protein > 0 ? macros.protein / macroTargets.protein : null}
          />
          {water ? (
            <StatRow
              name={tt('gun.macro_water')}
              label={
                hasTarget
                  ? `${formatLiters(wMl, numLang)} / ${formatLiters(water.targetMl, numLang)} L`
                  : `${formatLiters(wMl, numLang)} L`
              }
              bar={hasTarget && water.targetMl > 0 ? wMl / water.targetMl : null}
              onPress={
                onWaterAdd
                  ? () => {
                      haptic('light');
                      onWaterAdd();
                    }
                  : undefined
              }
              accessibilityLabel={tt('gun.water_a11y', {
                ml: formatLiters(wMl, numLang),
                target: formatLiters(water.targetMl, numLang),
                step: WATER_STEP_ML,
              })}
            />
          ) : null}
        </View>
      </View>

      {/* FinHomeEmptyR1: gün boşken hero altında "İlk öğününü ekle" (S1 bileşeni). */}
      {empty && onFirstLog ? <HomeFirstMealCard onScan={onFirstLog} onManual={onFirstManual ?? onFirstLog} /> : null}

      {/* G18-S1 temas — FinHomeProfileCard / FinHomeEmptyR1: kart hero (+ İlk öğün) ile makro satırı arasında. */}
      <HomeOnboardingSlot />

      <Pressable
        onPress={onOpenMacros}
        disabled={!onOpenMacros}
        accessibilityRole={onOpenMacros ? 'button' : undefined}
        accessibilityLabel={tt('gun.macros')}
        style={[styles.chipRow, { borderBottomColor: t.color.line }]}
      >
        <MacroChip label={tt('gun.macro_protein')} value={macros.protein} target={macroTargets.protein} hasTarget={hasTarget} lang={lang} />
        <MacroChip label={tt('gun.macro_carbs')} value={macros.carbs} target={macroTargets.carbs} hasTarget={hasTarget} lang={lang} />
        <MacroChip label={tt('gun.macro_fat')} value={macros.fat} target={macroTargets.fat} hasTarget={hasTarget} lang={lang} />
      </Pressable>

      {streak > 0 ? (
        <View style={[styles.streakChip, { backgroundColor: t.color.accent }]}>
          <TrophyIcon size={14} color={t.color.onAccent} weight="fill" />
          <AppText variant="caption" tone="onAccent">
            {tt('gun.streak', { count: streak })}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {},
  hero: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringBox: { width: RING, height: RING },
  core: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 4 },
  flameBig: { width: 64, height: 86 },
  flameSmall: { width: 44, height: 59 },
  flameOrigin: { transformOrigin: ['50%', '62%', 0] },
  noGoal: { maxWidth: 100, textAlign: 'center', fontSize: 13, lineHeight: 16, fontFamily: 'PlusJakartaSans_600SemiBold' },
  side: { flex: 1, minWidth: 0, gap: 12 },
  small: { fontSize: 13, lineHeight: 17 },
  num: { fontFamily: BRICOLAGE_BOLD, fontSize: 28, lineHeight: 31 },
  stat: { gap: 4 },
  statHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  statName: { fontSize: 13, lineHeight: 17, flexShrink: 1 },
  statVal: { fontSize: 13, lineHeight: 17, fontFamily: 'PlusJakartaSans_600SemiBold' },
  statTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  statFill: { height: 4, borderRadius: 2 },
  chipRow: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
  },
  chip: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipRing: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chipPct: { fontSize: 13, fontWeight: '600' },
  chipText: { flex: 1, minWidth: 0 },
  chipName: { fontSize: 13, lineHeight: 17 },
  chipVal: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  streakChip: {
    alignSelf: 'center',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
});
