// FinTopBlock — G15-S2: FinHomeR3 / FinHomeEmptyR1 / FinHomeEN / FinHomeXL üst
// blok (yeni kabuk). Yalnız TrackerDayHeader (bayrak `yeni_kabuk` açık) çizer.
//
//  • 3 sütun halka (pano ring()): Enerji 92/10 (açıkta #4A6B00, koyuda lime),
//    Protein 64/7 (mürekkep), Su 64/7 (ikincil; yalnız `su_takibi` + hedef
//    varsa). Halka içinde yüzde (TR "%50", EN "50%"), altında etiket, sayı
//    (Bricolage 700 24/17), birim.
//  • Gün boşken: Enerji "Bugünkü hedefin · 2.180 · kcal" + lime 56'lık
//    "İlk öğününü logla" (Bricolage 17).
//  • Makro çipleri: 3 sütun, 44'lük halka (iç dolgu + kontur 3 + yüzde), ad +
//    "82 / 140 g"; altında çizgi.
//  • Su halkasına dokun → +250 ml (hızlı ekleme; TrackerScreen geri al toast'ı).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated from 'react-native-reanimated';

import { AppText, ProgressRing, useTheme, haptic } from '../../core/design';
import { useT } from '../../core/i18n';
import { TrophyIcon } from '../../components/icons';
import { RollingNumber } from '../../modules/gun/ui';
import type { NumLang } from '../../modules/gun/motion';
import { WATER_STEP_ML, formatLiters } from '../../modules/gun/water';

/** Yüzde etiketi: TR "%50", EN "50%" (FinHomeEN). */
export function pctLabel(p: number, lang: string): string {
  const n = Math.round(p * 100);
  return lang === 'en' ? `${n}%` : `%${n}`;
}

/** FinHomeR3 renkleri (pano tokens()): iz, iç dolgu, Enerji konturu, ikincil. */
export function finTokens(isDark: boolean) {
  return isDark
    ? { track: '#2C2C2E', nested: '#2C2C2E', limeLine: '#C6F04F', sec: '#A1A1A6' }
    : { track: '#E3E5E9', nested: '#FFFFFF', limeLine: '#4A6B00', sec: '#6B6B70' };
}

const BRICOLAGE_BOLD = 'BricolageGrotesque_700Bold';
const BRICOLAGE_SEMI = 'BricolageGrotesque_600SemiBold';

const SCAN_D =
  'M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8 M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8 M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16 M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16 M16.92 11.13A5 5 0 1 1 13.71 7.3A2.6 2.6 0 0 0 16.92 11.13Z';

function StatusRing({
  big,
  progress,
  color,
  pct,
  label,
  num,
  numNode,
  unit,
  onPress,
  accessibilityLabel,
  animStyle,
}: {
  big?: boolean;
  progress: number;
  color: string;
  pct: string;
  label: string;
  num?: string;
  numNode?: React.ReactNode;
  unit: string;
  onPress?: () => void;
  accessibilityLabel: string;
  animStyle?: object;
}) {
  const t = useTheme();
  const k = finTokens(t.isDark);
  const size = big ? 92 : 64;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel}
      style={styles.ringCol}
    >
      <Animated.View style={animStyle}>
        <ProgressRing progress={Math.min(progress, 1)} size={size} strokeWidth={big ? 10 : 7} color={color} trackColor={k.track}>
          <AppText style={[styles.ringPct, { fontSize: big ? 15 : 13 }]} numberOfLines={1}>
            {pct}
          </AppText>
        </ProgressRing>
      </Animated.View>
      <View style={styles.ringText}>
        <AppText style={[styles.ringLabel, { color: k.sec }]} numberOfLines={1}>
          {label}
        </AppText>
        {numNode ?? (
          <AppText style={[styles.ringNum, { fontSize: big ? 24 : 17, lineHeight: big ? 28 : 21 }]} numberOfLines={1}>
            {num}
          </AppText>
        )}
        <AppText style={[styles.ringUnit, { color: k.sec }]} numberOfLines={1}>
          {unit}
        </AppText>
      </View>
    </Pressable>
  );
}

function MacroChip({ label, value, target, lang }: { label: string; value: number; target: number; lang: string }) {
  const t = useTheme();
  const k = finTokens(t.isDark);
  const p = target > 0 ? value / target : 0;
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <View style={styles.chip}>
      <View style={styles.chipRing}>
        <Svg width={44} height={44} viewBox="0 0 44 44" style={StyleSheet.absoluteFill}>
          <Circle cx={22} cy={22} r={r} fill={k.nested} />
          <Circle cx={22} cy={22} r={r} fill="none" stroke={k.track} strokeWidth={3} />
          {p > 0 ? (
            <Circle
              cx={22}
              cy={22}
              r={r}
              fill="none"
              stroke={t.color.ink}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${Math.min(p, 1) * c} ${c}`}
              transform="rotate(-90 22 22)"
            />
          ) : null}
        </Svg>
        <AppText style={styles.chipPct} numberOfLines={1} maxFontSizeMultiplier={1}>
          {pctLabel(p, lang)}
        </AppText>
      </View>
      <View style={styles.chipText}>
        <AppText style={[styles.chipName, { color: k.sec }]} numberOfLines={1}>
          {label}
        </AppText>
        <AppText style={styles.chipVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {`${Math.round(value)} / ${Math.round(target)} g`}
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
  onFirstLog?: () => void;
  onOpenMacros?: () => void;
  popStyle?: object;
  streak?: number;
}

export function FinTopBlock({
  kcal,
  target,
  macros,
  macroTargets,
  water,
  onWaterAdd,
  onFirstLog,
  onOpenMacros,
  popStyle,
  streak = 0,
}: FinTopBlockProps) {
  const t = useTheme();
  const { t: tt, lang } = useT();
  const k = finTokens(t.isDark);
  const numLang = (lang === 'en' ? 'en' : 'tr') as NumLang;
  const empty = kcal <= 0 && macros.protein <= 0 && macros.carbs <= 0 && macros.fat <= 0;
  const over = !empty && target > 0 && kcal > target;
  const p = target > 0 ? kcal / target : 0;
  const group = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, numLang === 'tr' ? '.' : ',');

  const energyLabel = empty ? tt('gun.target_today') : tt('gun.status_energy');
  const energyUnit = empty ? 'kcal' : over ? tt('gun.kcal_over') : tt('gun.kcal_left');
  const energyNum = empty ? group(target) : over ? `+${group(kcal - target)}` : null;
  const pP = macroTargets.protein > 0 ? macros.protein / macroTargets.protein : 0;
  const wMl = water?.ml ?? 0;
  const pW = water && water.targetMl > 0 ? wMl / water.targetMl : 0;

  return (
    <View style={styles.block}>
      <View style={styles.ringGrid}>
        <StatusRing
          big
          progress={p}
          color={k.limeLine}
          pct={pctLabel(p, lang)}
          label={energyLabel}
          num={energyNum ?? undefined}
          numNode={
            energyNum == null ? (
              <RollingNumber
                value={Math.max(0, Math.round(target - kcal))}
                lang={numLang}
                fontSize={24}
                color={t.color.ink}
                accessibilityLabel={tt('gun.goal_kcal', { kcal, target })}
              />
            ) : undefined
          }
          unit={energyUnit}
          onPress={onOpenMacros}
          accessibilityLabel={`${energyLabel}: ${energyNum ?? group(Math.max(0, target - kcal))} ${energyUnit}`}
          animStyle={popStyle}
        />
        <StatusRing
          progress={pP}
          color={t.color.ink}
          pct={pctLabel(pP, lang)}
          label={tt('gun.macro_protein')}
          num={String(Math.round(macros.protein))}
          unit={`/ ${Math.round(macroTargets.protein)} g`}
          onPress={onOpenMacros}
          accessibilityLabel={`${tt('gun.macro_protein')}: ${Math.round(macros.protein)} / ${Math.round(macroTargets.protein)} g`}
        />
        {water ? (
          <StatusRing
            progress={pW}
            color={k.sec}
            pct={pctLabel(pW, lang)}
            label={tt('gun.macro_water')}
            num={formatLiters(wMl, numLang)}
            unit={`/ ${formatLiters(water.targetMl, numLang)} L`}
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
        ) : (
          <View style={styles.ringCol} />
        )}
      </View>

      {empty && onFirstLog ? (
        <Pressable
          onPress={() => {
            haptic('light');
            onFirstLog();
          }}
          accessibilityRole="button"
          style={[styles.firstCta, { backgroundColor: t.color.accent }]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d={SCAN_D} stroke={t.color.onAccent} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <AppText tone="onAccent" style={styles.firstCtaText} numberOfLines={1}>
            {tt('gun.first_meal_cta')}
          </AppText>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onOpenMacros}
        disabled={!onOpenMacros}
        accessibilityRole={onOpenMacros ? 'button' : undefined}
        accessibilityLabel={tt('gun.macros')}
        style={[styles.chipRow, { borderBottomColor: t.color.line }]}
      >
        <MacroChip label={tt('gun.macro_protein')} value={macros.protein} target={macroTargets.protein} lang={lang} />
        <MacroChip label={tt('gun.macro_carbs')} value={macros.carbs} target={macroTargets.carbs} lang={lang} />
        <MacroChip label={tt('gun.macro_fat')} value={macros.fat} target={macroTargets.fat} lang={lang} />
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
  block: { paddingTop: 12 },
  ringGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 4, gap: 8, alignItems: 'flex-start' },
  ringCol: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8 },
  ringPct: { fontWeight: '600' },
  ringText: { alignItems: 'center', minWidth: 0, alignSelf: 'stretch' },
  ringLabel: { fontSize: 13, lineHeight: 17 },
  ringNum: { fontFamily: BRICOLAGE_BOLD },
  ringUnit: { fontSize: 13, lineHeight: 16 },
  firstCta: {
    marginTop: 8,
    marginHorizontal: 16,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  firstCtaText: { fontFamily: BRICOLAGE_SEMI, fontSize: 17 },
  chipRow: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
