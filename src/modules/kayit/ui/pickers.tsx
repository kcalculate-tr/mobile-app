// G43-S1 — Kayıt soru bileşenleri, uygulamanın liste/kart diliyle: dikey seçim satırı (beyaz yüzey, 1 px kenar,
// yarıçap 16, sol çizgi ikon, başlık + açıklama; seçili = 2 pt lime kenar + sağda lime işaret, zemin beyaz kalır),
// nötr tekerlek ve cetvel (çentikler muted, seçili çentik ink), tempo satırları + tarih aralığı kartı, hareket
// satırları, gün hapları, çipler, aramalı etiket bulutu, öğün adımlayıcı. Yay, ölçek, kademeli giriş YOK.
// Erişilebilirlik: tekerlek/cetvel/adımlayıcı `adjustable` (VoiceOver yukarı/aşağı), satırlar radio/checkbox.
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
import { AppText, haptic } from '../../../core/design';
import { Check, MagnifyingGlass, Minus, Plus, X, type Icon } from '../../../components/icons';
import { FONT, RadioMark } from './parts';
import { useK } from './theme';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

// ─── Seçim satırı ─────────────────────────────────────────────────────────────
/** Dikey liste satırı (64–72 pt). Seçimde hafif seçim titreşimi; görünüm yalnız kenar + işaretle değişir. */
export function OptionRow({
  label,
  sub,
  icon: Ico,
  selected,
  onPress,
  testID,
  role = 'radio',
  disabled,
}: {
  label: string;
  sub?: string;
  icon?: Icon;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  role?: 'radio' | 'checkbox';
  disabled?: boolean;
}) {
  const P = useK();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, selected, disabled: !!disabled }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: P.surface, borderColor: selected ? P.accentLine : P.line, borderWidth: selected ? 2 : 1, padding: selected ? 15 : 16 },
        { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      {Ico ? (
        <View style={styles.rowIcon}>
          <Ico size={28} color={P.ink} weight="regular" />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText maxFontSizeMultiplier={1.5} style={[styles.rowLabel, { color: P.ink }]}>
          {label}
        </AppText>
        {sub ? (
          <AppText maxFontSizeMultiplier={1.5} style={[styles.rowSub, { color: P.sec }]}>
            {sub}
          </AppText>
        ) : null}
      </View>
      <RadioMark on={selected} square={role === 'checkbox'} />
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
      <View pointerEvents="none" style={[styles.wheelBand, { top: WHEEL_ROW * 2, backgroundColor: P.surface }]} />
      <FlatList
        {...SCROLL_KEYBOARD}
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
                  fontFamily: d === 0 ? FONT.display : FONT.medium,
                  fontSize: d === 0 ? 30 : 22,
                  color: d === 0 ? P.ink : P.sec,
                  opacity: d <= 1 ? 1 : 0.6,
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
 * Çentikler muted, seçili çentik (ortadaki ibre) ink. Her çentikte seçim titreşimi. `resetKey` değişince
 * (birim anahtarı) yeniden konumlanır.
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
      haptic('selection');
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
      style={[styles.ruler, { borderColor: P.line }]}
    >
      <FlatList
        {...SCROLL_KEYBOARD}
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
          <View style={{ width: segW, height: 96 }} importantForAccessibility="no-hide-descendants">
            {Array.from({ length: perMajor }, (_, k) => {
              const t = item * perMajor + k;
              if (t > ticks) return null;
              const major = k === 0;
              return (
                <View
                  key={k}
                  style={{
                    position: 'absolute',
                    left: k * gap - 0.75,
                    top: 14,
                    width: 1.5,
                    height: major ? 40 : 24,
                    borderRadius: 1,
                    backgroundColor: P.sec,
                    opacity: major ? 0.9 : 0.45,
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
      <View pointerEvents="none" style={[styles.rulerNeedle, { left: pad - 1.5, backgroundColor: P.ink }]} />
    </View>
  );
}

/** Fark etiketi (P6): "−6 kg" — cetvelle canlı güncellenir. Nötr yüzey. */
export function DiffPill({ text, testID }: { text: string; testID?: string }) {
  const P = useK();
  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: P.surface }]}>
      <AppText maxFontSizeMultiplier={1.3} style={[styles.pillText, { color: P.ink }]}>
        {text}
      </AppText>
    </View>
  );
}

// ─── Tempo seçici ─────────────────────────────────────────────────────────────
/** Tempo kademeleri: dikey satırlar (başlık + "0,5 kg / hafta"). */
export function PaceSelector<T extends number>({ options, value, onChange, label }: { options: readonly { key: T; title: string; sub: string; level: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 10 }}>
      {options.map((o) => (
        <OptionRow key={String(o.key)} testID={`kayit-pace-${o.key}`} label={o.title} sub={o.sub} selected={o.key === value} onPress={() => onChange(o.key)} />
      ))}
    </View>
  );
}

/** Tahmini tarih aralığı kartı (beyaz yüzey, statik). */
export function RangeCard({ label, range, note, testID }: { label: string; range: string; note: string; testID?: string }) {
  const P = useK();
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}: ${range}. ${note}`} style={[styles.rangeCard, { backgroundColor: P.surface }]}>
      <AppText maxFontSizeMultiplier={1.4} style={[styles.rangeLabel, { color: P.sec }]}>
        {label}
      </AppText>
      <AppText maxFontSizeMultiplier={1.3} style={[styles.rangeValue, { color: P.ink }]}>
        {range}
      </AppText>
      <AppText maxFontSizeMultiplier={1.4} style={[styles.rangeNote, { color: P.sec }]}>
        {note}
      </AppText>
    </View>
  );
}

// ─── Hareket düzeyi ───────────────────────────────────────────────────────────
export interface ActivityItem<T> {
  key: T;
  title: string;
  sub: string;
  steps: string;
  icon: Icon;
}

/** Hareket düzeyi satırları. Seçim yoksa (eskisi gibi) ikinci düzey (Hafif) seçili açılır. */
export function ActivityList<T extends string>({ items, value, onChange, label }: { items: readonly ActivityItem<T>[]; value: T | null; onChange: (v: T) => void; label: string }) {
  useEffect(() => {
    const initial = items[Math.min(1, items.length - 1)];
    if (value == null && initial) onChange(initial.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 10 }}>
      {items.map((it) => (
        <OptionRow key={it.key} testID={`kayit-act-${it.key}`} icon={it.icon} label={it.title} sub={`${it.sub} · ${it.steps}`} selected={it.key === value} onPress={() => onChange(it.key)} />
      ))}
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
        return (
          <Pressable
            key={i}
            testID={`kayit-day-${l}-${longLabels[i]}`}
            onPress={() => {
              haptic('selection');
              onToggle(i);
            }}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled: !!disabled }}
            accessibilityLabel={longLabels[i]}
            style={[styles.day, { backgroundColor: P.surface, borderColor: on ? P.accentLine : P.line, borderWidth: on ? 2 : 1, opacity: disabled ? 0.45 : 1 }]}
          >
            <AppText maxFontSizeMultiplier={1.2} style={[styles.dayText, { color: P.ink, fontFamily: on ? FONT.bold : FONT.medium }]}>
              {l}
            </AppText>
          </Pressable>
        );
      })}
    </View>
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
      style={[styles.chip, { backgroundColor: P.surface, borderColor: on ? P.accentLine : P.line, borderWidth: on ? 2 : 1, paddingHorizontal: on ? 13 : 14, opacity: disabled ? 0.45 : 1 }]}
    >
      {on ? <Check size={16} color={P.accentLine} weight="bold" /> : Ico ? <Ico size={18} color={P.ink} weight="regular" /> : null}
      <AppText maxFontSizeMultiplier={1.4} style={[styles.chipText, { color: P.ink }]}>
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
      <View style={[styles.search, { backgroundColor: P.surface, borderColor: P.line }]}>
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
                style={[styles.chip, { backgroundColor: P.surface, borderColor: P.accentLine, borderWidth: 2, paddingHorizontal: 13 }]}
              >
                <AppText maxFontSizeMultiplier={1.4} style={[styles.chipText, { color: P.ink }]}>
                  {labelOf(k)}
                </AppText>
                <X size={14} color={P.ink} weight="bold" />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {q.trim() && results.length === 0 ? (
        <View testID="kayit-dislike-empty" accessibilityLiveRegion="polite" style={[styles.emptyCard, { backgroundColor: P.surface }]}>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.rowLabel, { color: P.ink }]}>
            {search.emptyTitle}
          </AppText>
          <AppText maxFontSizeMultiplier={1.4} style={[styles.rowSub, { color: P.sec }]}>
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

// ─── Öğün adımlayıcı ──────────────────────────────────────────────────────────
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
      style={{ alignItems: 'center', gap: 20 }}
    >
      <View style={styles.stepRow}>
        <StepBtn testID="kayit-meals-less" label={lessLabel} disabled={value <= min} onPress={() => set(value - 1)}>
          <Minus size={24} color={value <= min ? P.disabledText : P.ink} weight="bold" />
        </StepBtn>
        <AppText testID="kayit-meals-value" maxFontSizeMultiplier={1.2} style={[styles.stepValue, { color: P.ink }]}>
          {String(value)}
        </AppText>
        <StepBtn testID="kayit-meals-more" label={moreLabel} disabled={value >= max} onPress={() => set(value + 1)}>
          <Plus size={24} color={value >= max ? P.disabledText : P.ink} weight="bold" />
        </StepBtn>
      </View>
      <View style={styles.plates} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: max }, (_, i) => (
          <View key={i} style={[styles.plate, { borderColor: i < value ? P.ink : P.line2, backgroundColor: i < value ? P.surface : 'transparent' }]} />
        ))}
      </View>
      <AppText maxFontSizeMultiplier={1.4} style={[styles.rowSub, { color: P.sec, textAlign: 'center' }]}>
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
      style={[styles.stepBtn, { backgroundColor: P.surface, borderColor: P.line, opacity: disabled ? 0.6 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, minHeight: 68 },
  rowIcon: { width: 32, alignItems: 'center' },
  rowLabel: { fontFamily: FONT.semi, fontSize: 16, lineHeight: 21 },
  rowSub: { fontFamily: FONT.body, fontSize: 14, lineHeight: 19 },
  wheelBand: { position: 'absolute', left: 0, right: 0, height: WHEEL_ROW, borderRadius: 16 },
  ruler: { height: 96, borderTopWidth: 1, borderBottomWidth: 1 },
  rulerLabel: { position: 'absolute', top: 62, width: 60, textAlign: 'center', fontFamily: FONT.medium, fontSize: 14 },
  rulerNeedle: { position: 'absolute', top: 8, width: 3, height: 56, borderRadius: 1.5 },
  pill: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  pillText: { fontFamily: FONT.semi, fontSize: 15 },
  rangeCard: { borderRadius: 16, padding: 16, gap: 4 },
  rangeLabel: { fontFamily: FONT.medium, fontSize: 14 },
  rangeValue: { fontFamily: FONT.display, fontSize: 24, lineHeight: 30 },
  rangeNote: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20 },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, minHeight: 44 },
  chipText: { fontFamily: FONT.medium, fontSize: 15 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupTitle: { fontFamily: FONT.semi, fontSize: 13 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, minHeight: 50 },
  searchInput: { flex: 1, fontFamily: FONT.body, fontSize: 16, minHeight: 44 },
  emptyCard: { borderRadius: 16, padding: 16, gap: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  stepBtn: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontFamily: FONT.display, fontSize: 48, lineHeight: 56, minWidth: 56, textAlign: 'center' },
  plates: { flexDirection: 'row', gap: 10 },
  plate: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
});
