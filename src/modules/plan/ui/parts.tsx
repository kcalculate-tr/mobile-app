// G33-S1 md.6/md.9 — Öğün planı yapı taşları (04-haftalik-plan + 01-ogun-plani-hareket).
// Renkler tema rollerinden; lime yalnız dolgu (üstünde siyah). Süreler PLAN_MOTION'dan.
import React, { forwardRef, useEffect } from 'react';
import { Image, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText, CURVE, PLAN_MOTION, REDUCED, SPRING, haptic, useReducedMotion, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Check, CheckCircle, Plus } from '../../../components/icons';
import type { PlanItem, Slot } from '../types';
import { SLOTS } from '../types';
import { dayOfMonth, dayShort, type Lang } from '../week';


export const GLASS = {
  bowl: require('../../../../assets/glass/bowl.png'),
  flame: require('../../../../assets/glass/flame.png'),
  trophy: require('../../../../assets/glass/trophy.png'),
};

export function usePlanTones() {
  const t = useTheme();
  const dark = t.isDark;
  return {
    t,
    dark,
    bg: t.color.bg,
    card: t.color.surface,
    nested: dark ? '#2C2C2E' : '#F3F4F6',
    line: t.color.line,
    line2: dark ? '#48484A' : '#C3C7CC',
    ink: t.color.ink,
    sec: t.color.secondary,
    lime: t.color.accent,
    onLime: t.color.onAccent,
    limeSoft: dark ? 'rgba(198,240,79,0.32)' : '#E5F7B5',
    limeLine: t.color.accentLine,
    track: dark ? '#2C2C2E' : '#ECEEF1',
    chipSel: dark ? '#F5F5F5' : '#0A0A0A',
    chipSelInk: dark ? '#0A0A0A' : '#FFFFFF',
  };
}

export type PlanTones = ReturnType<typeof usePlanTones>;

/** Küçük bilgi çipi (Keşfet · eatkcal · P 18 g). `lime` → eatkcal kaynak çipi. */
export function MiniChip({ text, lime, testID }: { text: string; lime?: boolean; testID?: string }) {
  const c = usePlanTones();
  return (
    <View style={[styles.mini, { backgroundColor: lime ? c.lime : c.nested }]} testID={testID}>
      <AppText style={[styles.miniText, { color: lime ? c.onLime : c.ink }]}>{text}</AppText>
    </View>
  );
}

/** Tarif/öğün küçük görseli: tarifler cam kase (kase = öğün/tarif), eatkcal ürün fotoğrafı. */
export function Thumb({ uri, size = 48 }: { uri?: string | null; size?: number }) {
  const c = usePlanTones();
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.nested }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={uri ? { uri } : GLASS.bowl} style={uri ? { width: size, height: size } : { width: size * 0.8, height: size * 0.56 }} resizeMode={uri ? 'cover' : 'contain'} />
    </View>
  );
}

// ── Gün çipleri ─────────────────────────────────────────────────────────────
export function DayChips({
  days,
  selected,
  today,
  items,
  lang,
  onSelect,
  dotsReveal,
}: {
  days: string[];
  selected: string;
  today: string;
  items: readonly PlanItem[];
  lang: Lang;
  onSelect: (d: string) => void;
  /** Planı uygula: doluluk noktaları soldan sağa kademeli (değiştikçe yeniden oynar). */
  dotsReveal?: number;
}) {
  const c = usePlanTones();
  const { t: tr } = useT();
  return (
    <View style={styles.chips} accessibilityRole="tablist">
      {days.map((d, i) => {
        const sel = d === selected;
        const dayItems = items.filter((x) => x.date === d);
        const kcal = dayItems.reduce((s, x) => s + x.kcal, 0);
        const filled = new Set(dayItems.map((x) => x.slot));
        return (
          <Pressable
            key={d}
            onPress={() => {
              if (sel) return;
              haptic('selection');
              onSelect(d);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={tr('plan.day_chip_a11y', { day: `${dayShort(d, lang)} ${dayOfMonth(d)}`, kcal, n: filled.size })}
            style={[styles.chip, { backgroundColor: sel ? c.chipSel : c.card }, d === today && !sel ? { borderWidth: 1.5, borderColor: c.line2 } : null]}
            testID={`plan-day-${d}`}
          >
            <AppText style={[styles.chipDay, { color: sel ? c.chipSelInk : c.sec }]} maxFontSizeMultiplier={1.3}>
              {dayShort(d, lang)}
            </AppText>
            <AppText style={[styles.chipNum, { color: sel ? c.chipSelInk : c.ink }]} maxFontSizeMultiplier={1.3}>
              {dayOfMonth(d)}
            </AppText>
            <View style={styles.dots}>
              {SLOTS.map((s, k) => (
                <FillDot key={s} on={filled.has(s)} sel={sel} order={i * 4 + k} reveal={dotsReveal ?? 0} />
              ))}
            </View>
            <AppText style={[styles.chipKcal, { color: sel ? c.chipSelInk : c.sec }]} maxFontSizeMultiplier={1.2}>
              {kcal > 0 ? kcal : ' '}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function FillDot({ on, sel, order, reveal }: { on: boolean; sel: boolean; order: number; reveal: number }) {
  const c = usePlanTones();
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!reveal || !on) return;
    // Planı uygula: noktalar soldan sağa 220, 55 kademe (azaltılmışta kademe yok, 220 opaklık).
    o.value = 0;
    o.value = reduced
      ? withTiming(1, { duration: REDUCED.duration })
      : withDelay(order * PLAN_MOTION.applyStagger, withTiming(1, { duration: PLAN_MOTION.applyDot, easing: CURVE.standard }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  const color = on ? (sel ? c.lime : c.dark ? c.lime : '#7FA51E') : sel ? 'rgba(255,255,255,0.28)' : c.line2;
  return <Animated.View style={[styles.dot, { backgroundColor: color }, st]} />;
}

// ── Gün kartı (Kalori / Protein çubukları: Loglandı + Planlandı) ────────────
export const DayCard = forwardRef<View, {
  title: string;
  isToday: boolean;
  items: readonly PlanItem[];
  target: { kcal: number; protein: number };
  pulse?: number;
  style?: ViewStyle;
}>(function DayCard({ title, isToday, items, target, pulse = 0, style }, ref) {
  const c = usePlanTones();
  const { t: tr } = useT();
  const planned = items.reduce((s, x) => s + x.kcal, 0);
  const plannedP = Math.round(items.reduce((s, x) => s + x.protein, 0));
  const logged = items.filter((x) => x.loggedId).reduce((s, x) => s + x.kcal, 0);
  const loggedP = Math.round(items.filter((x) => x.loggedId).reduce((s, x) => s + x.protein, 0));
  return (
    <View style={[styles.dayCard, { backgroundColor: c.card }, style]} testID="plan-day-card">
      <View style={styles.dayHead}>
        <AppText style={[styles.dayTitle, { color: c.ink }]} accessibilityRole="header">
          {title}
        </AppText>
        {isToday ? <MiniChip text={tr('plan.today')} lime /> : null}
        <View style={styles.flex1} />
        <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.meals_count', { n: new Set(items.map((x) => x.slot)).size })}</AppText>
      </View>
      <Bar icon={GLASS.flame} label={tr('plan.kcal')} value={planned} target={target.kcal} unit="kcal" logged={logged} pulse={pulse} />
      <Bar icon={GLASS.trophy} label={tr('plan.protein')} value={plannedP} target={target.protein} unit="g" logged={loggedP} pulse={pulse} />
      <View style={styles.legend}>
        <View style={[styles.legendSq, { backgroundColor: c.lime }]} />
        <AppText style={[styles.small, { color: c.sec }]}>
          {tr('plan.logged')}{' '}
          <PulseNum value={`${logged} kcal`} pulse={pulse} ref={ref} />
        </AppText>
        <View style={[styles.legendSq, { backgroundColor: c.limeSoft, marginLeft: 14 }]} />
        <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.planned')}</AppText>
      </View>
    </View>
  );
});

const PulseNum = forwardRef<View, { value: string; pulse: number }>(function PulseNum({ value, pulse }, ref) {
  const c = usePlanTones();
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const o = useSharedValue(1);
  useEffect(() => {
    if (!pulse) return;
    if (reduced) {
      o.value = 0.4;
      o.value = withTiming(1, { duration: REDUCED.duration });
      return;
    }
    // Varış: 1 → 1,14 → 1 (AI yayı 260/24).
    s.value = withSequence(withTiming(PLAN_MOTION.logValuePeak, { duration: PLAN_MOTION.logButton, easing: CURVE.enter }), withSpring(1, SPRING.ai));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: o.value }));
  return (
    <Animated.View ref={ref as never} style={[styles.pulseWrap, st]} collapsable={false}>
      <AppText style={[styles.smallBold, { color: c.ink }]}>{value}</AppText>
    </Animated.View>
  );
});

function Bar({ icon, label, value, target, unit, logged, pulse }: { icon: number; label: string; value: number; target: number; unit: string; logged: number; pulse: number }) {
  const c = usePlanTones();
  const reduced = useReducedMotion();
  const pct = (n: number) => Math.max(0, Math.min(1, target > 0 ? n / target : 0));
  const lw = useSharedValue(pct(logged));
  useEffect(() => {
    lw.value = withTiming(pct(logged), { duration: reduced ? REDUCED.duration : PLAN_MOTION.logDot, easing: CURVE.enter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logged, target, pulse]);
  const st = useAnimatedStyle(() => ({ width: `${lw.value * 100}%` }));
  return (
    <View style={styles.bar} accessible accessibilityLabel={`${label}, ${value} / ${target} ${unit}`}>
      <View style={styles.barHead}>
        <Image source={icon} style={styles.barIcon} resizeMode="contain" />
        <AppText style={[styles.barLabel, { color: c.ink }]}>{label}</AppText>
        <View style={styles.flex1} />
        <AppText style={[styles.barVal, { color: c.ink }]}>{value}</AppText>
        <AppText style={[styles.small, { color: c.sec }]}> / {target} {unit}</AppText>
      </View>
      <View style={[styles.track, { backgroundColor: c.track }]}>
        <View style={[styles.fill, { width: `${pct(value) * 100}%`, backgroundColor: c.limeSoft }]} />
        <Animated.View style={[styles.fill, { backgroundColor: c.lime }, st]} />
      </View>
    </View>
  );
}

// ── Öğün yuvası ─────────────────────────────────────────────────────────────
export function SlotRow({
  slot,
  item,
  canLog,
  onLog,
  onAdd,
  onLongPress,
  logRef,
  first,
}: {
  slot: Slot;
  item?: PlanItem;
  canLog: boolean;
  onLog: (it: PlanItem) => void;
  onAdd: (slot: Slot) => void;
  onLongPress?: (it: PlanItem) => void;
  logRef?: (slot: Slot, v: View | null) => void;
  first?: boolean;
}) {
  const c = usePlanTones();
  const { t: tr } = useT();
  const slotName = tr(`plan.slot.${slot}`);
  return (
    <View style={[styles.slot, first ? null : { borderTopWidth: 1, borderTopColor: c.line }]} testID={`plan-slot-${slot}`}>
      <View style={styles.slotHead}>
        <AppText style={[styles.small, { color: c.sec }]}>{slotName}</AppText>
        <View style={styles.flex1} />
        {item ? <AppText style={[styles.small, { color: c.sec }]}>{item.kcal} kcal</AppText> : null}
      </View>
      {item ? (
        <Pressable
          onLongPress={onLongPress ? () => onLongPress(item) : undefined}
          style={styles.itemRow}
          accessibilityHint={onLongPress ? tr('plan.remove') : undefined}
          // HIG: uzun basma tek yol olmasın — VoiceOver'da "Kaldır" eylemi.
          accessibilityActions={onLongPress ? [{ name: 'delete', label: tr('plan.remove') }] : undefined}
          onAccessibilityAction={onLongPress ? (e) => e.nativeEvent.actionName === 'delete' && onLongPress(item) : undefined}
        >
          <Thumb uri={null} />
          <View style={styles.flex1}>
            <AppText style={[styles.itemName, { color: c.ink }]} numberOfLines={2}>
              {item.name}
            </AppText>
            <View style={styles.chipRow}>
              <MiniChip text={tr(`plan.source.${item.source}`)} lime={item.source === 'eatkcal'} />
              <MiniChip text={`P ${Math.round(item.protein)} g`} />
              {item.portion !== 1 ? <MiniChip text={tr('plan.portion', { n: String(item.portion).replace('.', ',') })} /> : null}
            </View>
          </View>
          {item.loggedId ? (
            <View style={styles.loggedBtn} accessible accessibilityLabel={`${item.name}, ${tr('plan.logged_btn')}`} testID={`plan-logged-${slot}`}>
              <CheckCircle size={22} color={c.limeLine} weight="fill" />
              <AppText style={[styles.loggedText, { color: c.ink }]}>{tr('plan.logged_btn')}</AppText>
            </View>
          ) : canLog ? (
            <Pressable
              ref={(v) => logRef?.(slot, v)}
              onPress={() => onLog(item)}
              accessibilityRole="button"
              accessibilityLabel={tr('plan.log_a11y', { name: item.name, slot: slotName })}
              style={[styles.logBtn, { backgroundColor: c.lime }]}
              testID={`plan-log-${slot}`}
            >
              <Plus size={16} color={c.onLime} weight="bold" />
              <AppText style={[styles.logText, { color: c.onLime }]}>{tr('plan.log')}</AppText>
            </Pressable>
          ) : null}
        </Pressable>
      ) : (
        <Pressable
          onPress={() => {
            haptic('light');
            onAdd(slot);
          }}
          accessibilityRole="button"
          accessibilityLabel={tr('plan.add_a11y', { slot: slotName })}
          style={[styles.addRow, { borderColor: c.line2 }]}
          testID={`plan-add-${slot}`}
        >
          <Plus size={18} color={c.ink} />
          <AppText style={[styles.addText, { color: c.ink }]}>{tr('plan.add')}</AppText>
        </Pressable>
      )}
    </View>
  );
}

// ── Cam bildirim + Geri al ─────────────────────────────────────────────────
export function PlanToast({
  visible,
  message,
  onUndo,
  actionLabel,
  onAction,
  onHide,
  bottom,
}: {
  visible: boolean;
  message: string;
  onUndo?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  onHide: () => void;
  bottom: number;
}) {
  const c = usePlanTones();
  const { t: tr } = useT();
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = visible
      ? reduced
        ? withTiming(1, { duration: REDUCED.duration })
        : withDelay(PLAN_MOTION.toastDelay, withTiming(1, { duration: PLAN_MOTION.toastIn, easing: CURVE.enter }))
      : withTiming(0, { duration: reduced ? REDUCED.duration : PLAN_MOTION.toastOut, easing: CURVE.exit });
    if (!visible) return;
    const id = setTimeout(onHide, PLAN_MOTION.toastHold);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, message]);
  const st = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * (reduced ? 0 : PLAN_MOTION.toastShift) }] }));
  return (
    <Animated.View pointerEvents={visible ? 'box-none' : 'none'} style={[styles.toastLayer, { bottom }, st]} testID="plan-toast">
      <View style={[styles.toast, { backgroundColor: c.card, borderColor: c.line }]} accessibilityLiveRegion="polite">
        <View style={[styles.toastCheck, { backgroundColor: c.lime }]}>
          <Check size={14} color={c.onLime} weight="bold" />
        </View>
        <AppText style={[styles.toastMsg, { color: c.ink }]} numberOfLines={2}>
          {message}
        </AppText>
        {onUndo ? (
          <Pressable
            onPress={() => {
              haptic('light');
              onUndo();
            }}
            accessibilityRole="button"
            style={styles.toastBtn}
            testID="plan-toast-undo"
          >
            <AppText style={[styles.toastUndo, { color: c.ink }]}>{tr('plan.undo')}</AppText>
          </Pressable>
        ) : null}
        {onAction && actionLabel ? (
          <Pressable onPress={onAction} accessibilityRole="button" style={[styles.toastPill, { backgroundColor: c.chipSel }]} testID="plan-toast-action">
            <AppText style={[styles.toastPillText, { color: c.chipSelInk }]}>{actionLabel}</AppText>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ── Logla izi: butondan gün toplamına yay çizen lime nokta ────────────────────
export function LogDot({ from, to, token, onArrive }: { from: { x: number; y: number } | null; to: { x: number; y: number } | null; token: number; onArrive: () => void }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const o = useSharedValue(0);
  useEffect(() => {
    if (!token || !from || !to) return;
    if (reduced) {
      // Azaltılmış: nokta yok; değer ve çubuk 220 opaklıkla değişir.
      onArrive();
      return;
    }
    p.value = 0;
    o.value = 1;
    p.value = withTiming(1, { duration: PLAN_MOTION.logDot, easing: CURVE.enter }, (fin) => {
      if (fin) {
        o.value = withTiming(0, { duration: PLAN_MOTION.logButton });
        runOnJS(onArrive)();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  const fx = from?.x ?? 0;
  const fy = from?.y ?? 0;
  const tx = to?.x ?? 0;
  const ty = to?.y ?? 0;
  const arc = Math.max(60, Math.abs(fy - ty) * 0.35);
  const st = useAnimatedStyle(() => {
    const k = p.value;
    const x = fx + (tx - fx) * k;
    const y = fy + (ty - fy) * k - arc * Math.sin(Math.PI * k);
    const s = 1 + (PLAN_MOTION.logDotScaleTo - 1) * k;
    return { opacity: o.value, transform: [{ translateX: x - PLAN_MOTION.logDotSize / 2 }, { translateY: y - PLAN_MOTION.logDotSize / 2 }, { scale: s }] };
  });
  if (reduced) return null;
  return <Animated.View pointerEvents="none" style={[styles.logDot, st]} testID="plan-log-dot" />;
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  mini: { borderRadius: 8, paddingHorizontal: 8, minHeight: 22, justifyContent: 'center' },
  miniText: { fontSize: 12, fontWeight: '600' },
  thumb: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { flex: 1, minHeight: 72, borderRadius: 16, alignItems: 'center', paddingVertical: 6, gap: 2 },
  chipDay: { fontSize: 11, fontWeight: '500' },
  chipNum: { fontSize: 17, fontWeight: '700', lineHeight: 21 },
  chipKcal: { fontSize: 11, fontWeight: '500' },
  dots: { flexDirection: 'row', gap: 2, height: 5, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dayCard: { borderRadius: 20, padding: 16, gap: 12 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayTitle: { fontSize: 17, fontWeight: '700' },
  small: { fontSize: 13 },
  smallBold: { fontSize: 13, fontWeight: '700' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSq: { width: 10, height: 10, borderRadius: 3 },
  pulseWrap: { alignSelf: 'flex-start' },
  bar: { gap: 6 },
  barHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barIcon: { width: 20, height: 20 },
  barLabel: { fontSize: 15, fontWeight: '500' },
  barVal: { fontSize: 15, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  slot: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  slotHead: { flexDirection: 'row', alignItems: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemName: { fontSize: 16, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  logBtn: { minHeight: 44, minWidth: 88, borderRadius: 22, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  logText: { fontSize: 15, fontWeight: '700' },
  loggedBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  loggedText: { fontSize: 15, fontWeight: '500' },
  addRow: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addText: { fontSize: 15, fontWeight: '600' },
  toastLayer: { position: 'absolute', left: 16, right: 16, zIndex: 40 },
  toast: { minHeight: 56, borderRadius: 28, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 6, gap: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  toastCheck: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toastMsg: { flex: 1, fontSize: 15, fontWeight: '600' },
  toastBtn: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  toastUndo: { fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  toastPill: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  toastPillText: { fontSize: 14, fontWeight: '700' },
  logDot: { position: 'absolute', left: 0, top: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#C6F04F', shadowColor: '#C6F04F', shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, zIndex: 50 },
});
