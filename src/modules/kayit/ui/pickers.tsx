// G42-S1 md.3 — Kayıt soru bileşenleri (Design `Bilesenler` / `Proto*`): 2×2 seçim kartları, liste kartı,
// tekerlek seçici, yatay cetvel, fark hapı, tempo seçici + tarih aralığı kartı, yana kaydırmalı hareket
// kartları, gün hapları, ikonlu çipler, aramalı etiket bulutu, tabak adımlayıcı.
// Erişilebilirlik: tekerlek/cetvel/adımlayıcı `adjustable` (VoiceOver yukarı/aşağı), kartlar radio/checkbox.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { AppText, CURVE, REDUCED, SPRING, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Check, MagnifyingGlass, Minus, Plus, Sneaker, X, type Icon } from '../../../components/icons';
import { FONT } from './parts';
import { K_MOTION, useK } from './theme';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

// ─── Seçim kartı (2×2 ızgara + geniş) ─────────────────────────────────────────
export function ChoiceTile({
  label,
  sub,
  icon: Ico,
  selected,
  dimmed,
  onPress,
  wide,
  testID,
  delay = 0,
}: {
  label: string;
  sub?: string;
  icon?: Icon;
  selected: boolean;
  dimmed: boolean;
  onPress: () => void;
  wide?: boolean;
  testID?: string;
  delay?: number;
}) {
  const P = useK();
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    o.value = withTiming(1, { duration: reduced ? REDUCED.duration : K_MOTION.shared, easing: CURVE.enter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (reduced) return;
    s.value = selected ? withSpring(K_MOTION.pickScale, SPRING.bouncy) : withTiming(dimmed ? K_MOTION.dimScale : 1, { duration: K_MOTION.fast });
  }, [selected, dimmed, reduced, s]);
  const rise = useAnimatedStyle(() => ({
    opacity: o.value * (dimmed ? K_MOTION.dimOpacity : 1),
    transform: [{ translateY: reduced ? 0 : (1 - o.value) * (16 + delay / 20) }, { scale: s.value }],
  }));
  return (
    <Animated.View style={[wide ? { width: '100%' } : { flex: 1 }, rise]}>
      <Pressable
        testID={testID}
        onPress={() => {
          haptic(selected ? 'selection' : 'light');
          onPress();
        }}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={sub ? `${label}, ${sub}` : label}
        style={[
          wide ? styles.tileWide : styles.tile,
          { backgroundColor: selected ? P.accent : P.card, borderColor: selected ? P.accent : P.cardEdge },
        ]}
      >
        {Ico ? (
          <View style={[styles.tileIcon, { backgroundColor: selected ? 'rgba(255,255,255,0.35)' : P.accentSoft }]}>
            <Ico size={26} color={selected ? '#10301D' : P.ink} weight="bold" />
          </View>
        ) : null}
        <View style={wide ? { flex: 1 } : { marginTop: 'auto' }}>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.tileLabel, { color: selected ? '#10301D' : P.ink }]}>
            {label}
          </AppText>
          {sub ? (
            <AppText maxFontSizeMultiplier={1.4} style={[styles.tileSub, { color: selected ? 'rgba(16,48,29,0.72)' : P.sec }]}>
              {sub}
            </AppText>
          ) : null}
        </View>
        {selected ? <CheckBadge /> : null}
      </Pressable>
    </Animated.View>
  );
}

function CheckBadge() {
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0.4);
  useEffect(() => {
    if (!reduced) s.value = withSpring(1, SPRING.bouncy);
  }, [reduced, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[styles.badge, st]}>
      <Check size={16} color="#10301D" weight="bold" />
    </Animated.View>
  );
}

/** Liste kartı (P13/P14): başlık + açıklama + onay rozeti; seçimde diğerleri %70 opaklık. */
export function OptionCard({ label, sub, icon: Ico, selected, dimmed, onPress, testID }: { label: string; sub?: string; icon?: Icon; selected: boolean; dimmed: boolean; onPress: () => void; testID?: string }) {
  const P = useK();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: selected ? P.accent : P.card, borderColor: selected ? P.accent : P.cardEdge, opacity: dimmed ? 0.7 : 1 },
        pressed ? { transform: [{ scale: 0.98 }] } : null,
      ]}
    >
      {Ico ? (
        <View style={[styles.optIcon, { backgroundColor: selected ? 'rgba(255,255,255,0.35)' : P.accentSoft }]}>
          <Ico size={22} color={selected ? '#10301D' : P.ink} weight="bold" />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText maxFontSizeMultiplier={1.5} style={[styles.optLabel, { color: selected ? '#10301D' : P.ink }]}>
          {label}
        </AppText>
        {sub ? (
          <AppText maxFontSizeMultiplier={1.5} style={[styles.optSub, { color: selected ? 'rgba(16,48,29,0.72)' : P.sec }]}>
            {sub}
          </AppText>
        ) : null}
      </View>
      {selected ? <CheckBadge /> : null}
    </Pressable>
  );
}

// ─── Tekerlek seçici (yıl) ────────────────────────────────────────────────────
const WHEEL_ROW = 52;
const WHEEL_VISIBLE = 5;

export function WheelPicker({ values, value, onChange, format, label, testID }: { values: number[]; value: number; onChange: (v: number) => void; format?: (v: number) => string; label: string; testID?: string }) {
  const P = useK();
  const ref = useRef<FlatList<number>>(null);
  const idx = Math.max(0, values.indexOf(value));
  const last = useRef(idx);
  const [center, setCenter] = useState(idx);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollToOffset({ offset: idx * WHEEL_ROW, animated: false }), 0);
    return () => clearTimeout(id);
    // yalnız açılışta konumlan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / WHEEL_ROW)));
    if (i !== last.current) {
      last.current = i;
      setCenter(i);
      haptic('selection');
    }
  };
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / WHEEL_ROW)));
    onChange(values[i]);
  };
  const step = (d: number) => {
    const i = Math.min(values.length - 1, Math.max(0, idx + d));
    ref.current?.scrollToOffset({ offset: i * WHEEL_ROW, animated: true });
    onChange(values[i]);
  };
  const fmt = format ?? String;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: fmt(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={{ height: WHEEL_ROW * WHEEL_VISIBLE, alignSelf: 'stretch' }}
    >
      <View pointerEvents="none" style={[styles.wheelBand, { top: WHEEL_ROW * 2, backgroundColor: P.card, borderColor: P.cardEdge }]} />
      <FlatList {...SCROLL_KEYBOARD}
        ref={ref}
        data={values}
        keyExtractor={(v) => String(v)}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ROW}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => {
          if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.y) < 0.05) settle(e);
        }}
        getItemLayout={(_, i) => ({ length: WHEEL_ROW, offset: WHEEL_ROW * i, index: i })}
        initialNumToRender={20}
        contentContainerStyle={{ paddingVertical: WHEEL_ROW * 2 }}
        renderItem={({ item, index }) => {
          const d = Math.abs(index - center);
          return (
            <View style={{ height: WHEEL_ROW, alignItems: 'center', justifyContent: 'center' }} importantForAccessibility="no-hide-descendants">
              <AppText
                maxFontSizeMultiplier={1.2}
                style={{
                  fontFamily: d === 0 ? FONT.display : FONT.semi,
                  fontSize: d === 0 ? 34 : d === 1 ? 24 : 20,
                  color: P.ink,
                  opacity: d === 0 ? 1 : d === 1 ? 0.55 : 0.28,
                }}
              >
                {fmt(item)}
              </AppText>
            </View>
          );
        }}
      />
    </View>
  );
}

// ─── Yatay cetvel ─────────────────────────────────────────────────────────────
/**
 * Değer = min + adım × çentik. Her öğe `perMajor` çentiklik bir parça (etiket başta) → sanallaştırılmış.
 * Her çentikte seçim titreşimi, ana çentikte hafif titreşim. `resetKey` değişince (birim anahtarı) yeniden konumlanır.
 */
export function Ruler({
  min,
  max,
  step,
  perMajor,
  gap = 10,
  value,
  onChange,
  formatMajor,
  label,
  valueText,
  resetKey,
  testID,
}: {
  min: number;
  max: number;
  step: number;
  perMajor: number;
  gap?: number;
  value: number;
  onChange: (v: number) => void;
  formatMajor: (v: number) => string;
  label: string;
  valueText: string;
  resetKey?: string;
  testID?: string;
}) {
  const P = useK();
  const { width } = useWindowDimensions();
  const ref = useRef<FlatList<number>>(null);
  const ticks = Math.round((max - min) / step);
  const segments = useMemo(() => Array.from({ length: Math.ceil((ticks + 1) / perMajor) }, (_, i) => i), [ticks, perMajor]);
  const segW = perMajor * gap;
  const toTick = (v: number) => Math.min(ticks, Math.max(0, Math.round((v - min) / step)));
  const fromTick = useCallback((t: number) => Math.round((min + t * step) * 100) / 100, [min, step]);
  const lastTick = useRef(toTick(value));
  const dragging = useRef(false);

  useEffect(() => {
    const t = toTick(value);
    lastTick.current = t;
    const id = setTimeout(() => ref.current?.scrollToOffset({ offset: t * gap, animated: false }), 0);
    return () => clearTimeout(id);
    // açılışta ve birim değişince
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!dragging.current) return;
    const t = Math.min(ticks, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / gap)));
    if (t !== lastTick.current) {
      lastTick.current = t;
      haptic(t % perMajor === 0 ? 'light' : 'selection');
      onChange(fromTick(t));
    }
  };
  const nudge = (d: number) => {
    const t = Math.min(ticks, Math.max(0, toTick(value) + d));
    lastTick.current = t;
    ref.current?.scrollToOffset({ offset: t * gap, animated: true });
    onChange(fromTick(t));
  };
  const pad = width / 2;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={[styles.ruler, { backgroundColor: P.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)', borderColor: P.cardEdge }]}
    >
      <FlatList {...SCROLL_KEYBOARD}
        ref={ref}
        horizontal
        data={segments}
        keyExtractor={(i) => String(i)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={gap}
        decelerationRate="fast"
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onMomentumScrollEnd={() => {
          dragging.current = false;
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: segW, offset: segW * i, index: i })}
        initialNumToRender={12}
        windowSize={7}
        contentContainerStyle={{ paddingHorizontal: pad }}
        renderItem={({ item }) => (
          <View style={{ width: segW, height: 112 }} importantForAccessibility="no-hide-descendants">
            {Array.from({ length: perMajor }, (_, k) => {
              const t = item * perMajor + k;
              if (t > ticks) return null;
              const major = k === 0;
              return (
                <View
                  key={k}
                  style={{
                    position: 'absolute',
                    left: k * gap - (major ? 1.5 : 1),
                    top: 18,
                    width: major ? 3 : 2,
                    height: major ? 52 : 32,
                    borderRadius: 2,
                    backgroundColor: major ? P.tickMajor : P.tick,
                  }}
                />
              );
            })}
            {item * perMajor <= ticks ? (
              <AppText maxFontSizeMultiplier={1.1} style={[styles.rulerLabel, { color: P.sec, left: -30 }]}>
                {formatMajor(fromTick(item * perMajor))}
              </AppText>
            ) : null}
          </View>
        )}
      />
      <View pointerEvents="none" style={[styles.rulerNeedle, { left: pad - 3, backgroundColor: P.accent }]} />
    </View>
  );
}

/** Fark hapı (P6): "−6 kg" — cetvelle canlı güncellenir. */
export function DiffPill({ text, testID }: { text: string; testID?: string }) {
  const P = useK();
  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: P.accent }]}>
      <AppText maxFontSizeMultiplier={1.3} style={[styles.pillText, { color: '#10301D' }]}>
        {text}
      </AppText>
    </View>
  );
}

// ─── Tempo seçici ─────────────────────────────────────────────────────────────
export function PaceSelector<T extends number>({ options, value, onChange, label }: { options: readonly { key: T; title: string; sub: string; level: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  const P = useK();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.paceWrap, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={String(o.key)}
            testID={`kayit-pace-${o.key}`}
            onPress={() => {
              if (!on) haptic('selection');
              onChange(o.key);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${o.title}, ${o.sub}`}
            style={[styles.paceItem, on && { backgroundColor: P.accent }]}
          >
            <AppText maxFontSizeMultiplier={1.2} style={[styles.paceChev, { color: on ? '#10301D' : P.ink }]}>
              {'›'.repeat(o.level)}
            </AppText>
            <AppText maxFontSizeMultiplier={1.3} style={[styles.paceTitle, { color: on ? '#10301D' : P.ink }]}>
              {o.title}
            </AppText>
            <AppText maxFontSizeMultiplier={1.3} style={[styles.paceSub, { color: on ? 'rgba(16,48,29,0.75)' : P.sec }]}>
              {o.sub}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tahmini tarih aralığı kartı; içerik değişince çapraz geçiş (220 ms). */
export function RangeCard({ label, range, note, testID }: { label: string; range: string; note: string; testID?: string }) {
  const P = useK();
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  const prev = useRef(range);
  useEffect(() => {
    if (prev.current === range) return;
    prev.current = range;
    if (reduced) return;
    o.value = 0.2;
    o.value = withTiming(1, { duration: K_MOTION.fast });
  }, [range, reduced, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}: ${range}. ${note}`} style={[styles.rangeCard, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <AppText maxFontSizeMultiplier={1.4} style={[styles.rangeLabel, { color: P.sec }]}>
        {label}
      </AppText>
      <Animated.View style={st}>
        <AppText maxFontSizeMultiplier={1.3} style={[styles.rangeValue, { color: P.ink }]}>
          {range}
        </AppText>
      </Animated.View>
      <AppText maxFontSizeMultiplier={1.4} style={[styles.rangeNote, { color: P.sec }]}>
        {note}
      </AppText>
    </View>
  );
}

// ─── Hareket galerisi ─────────────────────────────────────────────────────────
export interface CarouselItem<T> {
  key: T;
  title: string;
  sub: string;
  steps: string;
  icon: Icon;
}

export function ActivityCarousel<T extends string>({ items, value, onChange, label }: { items: readonly CarouselItem<T>[]; value: T | null; onChange: (v: T) => void; label: string }) {
  const P = useK();
  const { width } = useWindowDimensions();
  const cardW = Math.min(280, width - 120);
  const gapW = 16;
  const itemW = cardW + gapW;
  const ref = useRef<FlatList<CarouselItem<T>>>(null);
  // Seçim yoksa tasarımdaki gibi ikinci kart (Hafif) ortada açılır.
  const found = items.findIndex((i) => i.key === value);
  const initial = found >= 0 ? found : Math.min(1, items.length - 1);
  const [active, setActive] = useState(initial);
  const lastRef = useRef(initial);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollToOffset({ offset: initial * itemW, animated: false }), 0);
    if (value == null && items[initial]) onChange(items[initial].key);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = (i: number) => {
    if (i === lastRef.current) return;
    lastRef.current = i;
    setActive(i);
    haptic('selection');
    onChange(items[i].key);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    pick(Math.min(items.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / itemW))));
  };
  const go = (i: number) => {
    const c = Math.min(items.length - 1, Math.max(0, i));
    ref.current?.scrollToOffset({ offset: c * itemW, animated: true });
    pick(c);
  };
  return (
    <View>
      <FlatList {...SCROLL_KEYBOARD}
        ref={ref}
        horizontal
        data={items as CarouselItem<T>[]}
        keyExtractor={(i) => i.key}
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemW}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: itemW, offset: itemW * i, index: i })}
        contentContainerStyle={{ paddingHorizontal: (width - cardW) / 2 - gapW / 2 }}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        renderItem={({ item, index }) => {
          const on = index === active;
          const Ico = item.icon;
          return (
            <Pressable
              testID={`kayit-act-${item.key}`}
              onPress={() => go(index)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${item.title}. ${item.sub} ${item.steps}`}
              style={{ width: itemW, paddingHorizontal: gapW / 2 }}
            >
              <View style={[styles.actCard, { backgroundColor: on ? P.accent : P.card, borderColor: on ? P.accent : P.cardEdge, opacity: on ? 1 : K_MOTION.dimOpacity, transform: [{ scale: on ? 1 : 0.92 }] }]}>
                <View style={[styles.actIcon, { backgroundColor: on ? 'rgba(255,255,255,0.35)' : P.accentSoft }]}>
                  <Ico size={34} color={on ? '#10301D' : P.ink} weight="bold" />
                </View>
                <AppText maxFontSizeMultiplier={1.3} style={[styles.actTitle, { color: on ? '#10301D' : P.ink }]}>
                  {item.title}
                </AppText>
                <AppText maxFontSizeMultiplier={1.4} style={[styles.actSub, { color: on ? 'rgba(16,48,29,0.75)' : P.sec }]}>
                  {item.sub}
                </AppText>
                <View style={[styles.stepPill, { backgroundColor: on ? 'rgba(255,255,255,0.7)' : P.field }]}>
                  <Sneaker size={18} color={on ? '#10301D' : P.ink} weight="fill" />
                  <AppText maxFontSizeMultiplier={1.3} style={[styles.stepText, { color: '#10301D' }, !on && { color: P.ink }]}>
                    {item.steps}
                  </AppText>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        {items.map((it, i) => (
          <View key={it.key} style={{ width: i === active ? 30 : 10, height: 10, borderRadius: 5, backgroundColor: i === active ? (P.isDark ? P.accent : '#2E5B12') : P.ringTrack }} />
        ))}
      </View>
    </View>
  );
}

// ─── Gün hapları ──────────────────────────────────────────────────────────────
export function DayPills({ labels, longLabels, value, onToggle, disabled }: { labels: string[]; longLabels: string[]; value: number[]; onToggle: (d: number) => void; disabled?: boolean }) {
  const P = useK();
  return (
    <View style={styles.days}>
      {labels.map((l, i) => {
        const on = value.includes(i);
        return <DayPill key={i} label={l} longLabel={longLabels[i]} on={on} disabled={disabled} onPress={() => onToggle(i)} accent={P.accent} card={P.card} edge={P.cardEdge} ink={P.ink} />;
      })}
    </View>
  );
}

function DayPill({ label, longLabel, on, onPress, disabled, accent, card, edge, ink }: { label: string; longLabel: string; on: boolean; onPress: () => void; disabled?: boolean; accent: string; card: string; edge: string; ink: string }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[{ flex: 1, alignItems: 'center' }, st]}>
      <Pressable
        testID={`kayit-day-${label}-${longLabel}`}
        onPress={() => {
          haptic('selection');
          if (!reduced) {
            s.value = 0.86;
            s.value = withSpring(1, SPRING.bouncy);
          }
          onPress();
        }}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, disabled: !!disabled }}
        accessibilityLabel={longLabel}
        style={[styles.day, { backgroundColor: on ? accent : card, borderColor: on ? accent : edge, opacity: disabled ? 0.45 : 1 }]}
      >
        <AppText maxFontSizeMultiplier={1.2} style={[styles.dayText, { color: on ? '#10301D' : ink }]}>
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

// ─── Çipler ───────────────────────────────────────────────────────────────────
export function ChipToggle({ label, icon: Ico, on, onPress, testID, disabled }: { label: string; icon?: Icon; on: boolean; onPress: () => void; testID?: string; disabled?: boolean }) {
  const P = useK();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled: !!disabled }}
      accessibilityLabel={label}
      style={[styles.chip, { backgroundColor: on ? P.accent : P.card, borderColor: on ? P.accent : P.cardEdge, opacity: disabled ? 0.45 : 1 }]}
    >
      {Ico ? <Ico size={18} color={on ? '#10301D' : P.ink} weight="bold" /> : null}
      <AppText maxFontSizeMultiplier={1.4} style={[styles.chipText, { color: on ? '#10301D' : P.ink }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

// ─── Aramalı etiket bulutu ────────────────────────────────────────────────────
export function TagCloud<T extends string>({
  all,
  cloud,
  selected,
  onToggle,
  labelOf,
  search,
  testID,
}: {
  all: (q: string) => T[];
  cloud: readonly T[];
  selected: T[];
  onToggle: (k: T) => void;
  labelOf: (k: T) => string;
  search: { placeholder: string; selectedTitle: string; emptyTitle: string; emptySub: string; removeLabel: (n: string) => string };
  testID?: string;
}) {
  const P = useK();
  const [q, setQ] = useState('');
  const results = q.trim() ? all(q) : [...cloud];
  const visible = results.filter((k) => !selected.includes(k));
  return (
    <View testID={testID} style={{ gap: 14 }}>
      <View style={[styles.search, { backgroundColor: P.field, borderColor: P.cardEdge }]}>
        <MagnifyingGlass size={20} color={P.sec} />
        <TextInput
          testID="kayit-dislike-search"
          value={q}
          onChangeText={setQ}
          placeholder={search.placeholder}
          placeholderTextColor={P.sec}
          accessibilityLabel={search.placeholder}
          autoCorrect={false}
          style={[styles.searchInput, { color: P.ink }]}
          maxFontSizeMultiplier={1.4}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel={search.removeLabel(q)} hitSlop={10} style={{ minWidth: 32, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
            <X size={16} color={P.sec} />
          </Pressable>
        ) : null}
      </View>
      {selected.length ? (
        <View style={{ gap: 8 }}>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.groupTitle, { color: P.sec }]}>
            {search.selectedTitle}
          </AppText>
          <View style={styles.wrap}>
            {selected.map((k) => (
              <Pressable
                key={k}
                testID={`kayit-dislike-sel-${k}`}
                onPress={() => {
                  haptic('selection');
                  onToggle(k);
                }}
                accessibilityRole="button"
                accessibilityLabel={search.removeLabel(labelOf(k))}
                style={[styles.chip, { backgroundColor: P.accent, borderColor: P.accent }]}
              >
                <AppText maxFontSizeMultiplier={1.4} style={[styles.chipText, { color: '#10301D' }]}>
                  {labelOf(k)}
                </AppText>
                <X size={14} color="#10301D" weight="bold" />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {q.trim() && results.length === 0 ? (
        <View testID="kayit-dislike-empty" accessibilityLiveRegion="polite" style={[styles.emptyCard, { borderColor: P.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(16,48,29,0.25)' }]}>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.optLabel, { color: P.ink }]}>
            {search.emptyTitle}
          </AppText>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.optSub, { color: P.sec }]}>
            {search.emptySub}
          </AppText>
        </View>
      ) : (
        <View style={styles.wrap}>
          {visible.map((k) => (
            <ChipToggle key={k} testID={`kayit-dislike-${k}`} label={labelOf(k)} on={false} onPress={() => onToggle(k)} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Tabak adımlayıcı ─────────────────────────────────────────────────────────
export function PlateStepper({ value, min, max, onChange, sub, lessLabel, moreLabel, label }: { value: number; min: number; max: number; onChange: (v: number) => void; sub: string; lessLabel: string; moreLabel: string; label: string }) {
  const P = useK();
  const set = (v: number) => {
    const c = Math.min(max, Math.max(min, v));
    if (c !== value) haptic('selection');
    onChange(c);
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      style={{ alignItems: 'center', gap: 22 }}
    >
      <View style={styles.stepRow}>
        <StepBtn testID="kayit-meals-less" label={lessLabel} disabled={value <= min} onPress={() => set(value - 1)}>
          <Minus size={26} color={value <= min ? P.disabledText : '#10301D'} weight="bold" />
        </StepBtn>
        <AppText testID="kayit-meals-value" maxFontSizeMultiplier={1.2} style={[styles.stepValue, { color: P.ink }]}>
          {String(value)}
        </AppText>
        <StepBtn testID="kayit-meals-more" label={moreLabel} disabled={value >= max} onPress={() => set(value + 1)}>
          <Plus size={26} color={value >= max ? P.disabledText : '#10301D'} weight="bold" />
        </StepBtn>
      </View>
      <View style={styles.plates} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: max }, (_, i) => (
          <Plate key={i} on={i < value} />
        ))}
      </View>
      <AppText maxFontSizeMultiplier={1.4} style={[styles.optSub, { color: P.sec }]}>
        {sub}
      </AppText>
    </View>
  );
}

function StepBtn({ children, onPress, disabled, label, testID }: { children: React.ReactNode; onPress: () => void; disabled: boolean; label: string; testID?: string }) {
  const P = useK();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.stepBtn, { backgroundColor: disabled ? P.disabled : P.accent }]}
    >
      {children}
    </Pressable>
  );
}

function Plate({ on }: { on: boolean }) {
  const P = useK();
  const reduced = useReducedMotion();
  const s = useSharedValue(on ? 1 : 0.6);
  useEffect(() => {
    s.value = reduced ? (on ? 1 : 0.6) : on ? withSpring(1, SPRING.bouncy) : withTiming(0.6, { duration: K_MOTION.fast });
  }, [on, reduced, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[styles.plate, { backgroundColor: on ? P.accent : 'transparent', borderColor: on ? P.accent : P.ringTrack }, st]}>
      <View style={[styles.plateInner, { borderColor: on ? 'rgba(16,48,29,0.25)' : P.ringTrack }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { minHeight: 148, borderRadius: 26, borderWidth: 1, padding: 18, gap: 12 },
  tileWide: { minHeight: 92, borderRadius: 26, borderWidth: 1, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  tileIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: FONT.display, fontSize: 19, lineHeight: 23 },
  tileSub: { fontFamily: FONT.body, fontSize: 14, lineHeight: 19, marginTop: 2 },
  badge: { position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 24, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 16, minHeight: 76 },
  optIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  optLabel: { fontFamily: FONT.display, fontSize: 18, lineHeight: 23 },
  optSub: { fontFamily: FONT.body, fontSize: 14, lineHeight: 19 },
  wheelBand: { position: 'absolute', left: 24, right: 24, height: WHEEL_ROW, borderRadius: 18, borderWidth: 1 },
  ruler: { height: 112, borderTopWidth: 1, borderBottomWidth: 1 },
  rulerLabel: { position: 'absolute', top: 76, width: 60, textAlign: 'center', fontFamily: FONT.semi, fontSize: 15 },
  rulerNeedle: { position: 'absolute', top: 10, width: 6, height: 66, borderRadius: 3 },
  pill: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  pillText: { fontFamily: FONT.bold, fontSize: 16 },
  paceWrap: { flexDirection: 'row', borderRadius: 26, borderWidth: 1, padding: 8, gap: 6 },
  paceItem: { flex: 1, borderRadius: 20, alignItems: 'center', paddingVertical: 16, minHeight: 96, justifyContent: 'center' },
  paceChev: { fontFamily: FONT.bold, fontSize: 26, lineHeight: 28 },
  paceTitle: { fontFamily: FONT.display, fontSize: 18, marginTop: 4 },
  paceSub: { fontFamily: FONT.semi, fontSize: 13, marginTop: 4, textAlign: 'center' },
  rangeCard: { borderRadius: 26, borderWidth: 1, padding: 22, gap: 6 },
  rangeLabel: { fontFamily: FONT.semi, fontSize: 14 },
  rangeValue: { fontFamily: FONT.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  rangeNote: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20 },
  actCard: { borderRadius: 30, borderWidth: 1, padding: 24, minHeight: 360, gap: 10 },
  actIcon: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  actTitle: { fontFamily: FONT.display, fontSize: 28 },
  actSub: { fontFamily: FONT.body, fontSize: 16, lineHeight: 22 },
  stepPill: { marginTop: 'auto', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  stepText: { fontFamily: FONT.bold, fontSize: 15 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18 },
  days: { flexDirection: 'row', gap: 6 },
  day: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: FONT.bold, fontSize: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, minHeight: 44 },
  chipText: { fontFamily: FONT.semi, fontSize: 15 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupTitle: { fontFamily: FONT.semi, fontSize: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, minHeight: 50 },
  searchInput: { flex: 1, fontFamily: FONT.body, fontSize: 16, minHeight: 44 },
  emptyCard: { borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', padding: 18, gap: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 36 },
  stepBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontFamily: FONT.display, fontSize: 88, lineHeight: 96, minWidth: 64, textAlign: 'center' },
  plates: { flexDirection: 'row', gap: 10 },
  plate: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  plateInner: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5 },
});
