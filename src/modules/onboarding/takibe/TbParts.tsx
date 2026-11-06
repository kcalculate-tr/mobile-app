// Takibe başla yapı taşları (G15-S1 · FinTb*): kg/hafta kaydırıcısı (FinTbPace),
// tekerlek seçici (FinTbAbout), makro kartı (FinTbResult), ikonlu satır (FinTbFirst).
// Yeni paket YOK: PanResponder + ScrollView (snapToInterval).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityActionEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AppText } from '../../../core/design/components/AppText';
import { haptic } from '../../../core/design/motion';
import { CaretRight } from '../../../components/icons';
import { useOnb } from '../components/onbTheme';

// ── kg / hafta kaydırıcısı ──────────────────────────────────────────────────
const THUMB = 28;

export function PaceSlider<T extends number>({
  options,
  value,
  onChange,
  format,
  unit,
  minLabel,
  maxLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
  unit: string;
  minLabel: string;
  maxLabel: string;
}) {
  const P = useOnb();
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.indexOf(value));
  const last = options.length - 1;
  const usable = Math.max(1, w - THUMB);
  const thumbX = (idx / last) * usable;

  // PanResponder kapanışında güncel değerler için ref.
  const live = useRef({ usable, idx, onChange, options });
  live.current = { usable, idx, onChange, options };
  const startX = useRef(0);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const { usable: u, options: o } = live.current;
          const x = Math.min(u, Math.max(0, e.nativeEvent.locationX - THUMB / 2));
          startX.current = x;
          setFromX(x, u, o);
        },
        onPanResponderMove: (_e, g) => {
          const { usable: u, options: o } = live.current;
          const x = Math.min(u, Math.max(0, startX.current + g.dx));
          setFromX(x, u, o);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function setFromX(x: number, u: number, o: readonly T[]) {
    const i = Math.round((x / u) * (o.length - 1));
    if (i !== live.current.idx) {
      haptic('selection');
      live.current.idx = i;
      live.current.onChange(o[i]);
    }
  }

  const onAction = (e: AccessibilityActionEvent) => {
    const d = e.nativeEvent.actionName === 'increment' ? 1 : -1;
    const i = Math.min(last, Math.max(0, idx + d));
    if (i !== idx) onChange(options[i]);
  };

  return (
    <View style={[styles.card, { backgroundColor: P.chip, borderColor: P.chipEdge }]}>
      <View style={styles.paceHead}>
        <AppText style={[styles.paceNum, { color: P.ink }]}>{format(value)}</AppText>
        <AppText textRole="helper" style={{ color: P.sec, marginLeft: 8, marginBottom: 6 }}>
          {unit}
        </AppText>
      </View>
      <View
        style={styles.sliderBox}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={unit}
        accessibilityValue={{ text: `${format(value)} ${unit}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
        {...pan.panHandlers}
      >
        <View pointerEvents="none" style={[styles.track, { backgroundColor: P.track }]} />
        <View pointerEvents="none" style={[styles.fill, { width: thumbX + THUMB / 2, backgroundColor: P.accent }]} />
        <View pointerEvents="none" style={[styles.thumb, { left: thumbX, backgroundColor: P.isDark ? P.ink : '#0A0A0A' }]} />
      </View>
      <View style={styles.paceLabels}>
        <AppText textRole="helper" style={{ color: P.sec, fontWeight: '600' }}>
          {minLabel}
        </AppText>
        <AppText textRole="helper" style={{ color: P.sec, fontWeight: '600' }}>
          {maxLabel}
        </AppText>
      </View>
    </View>
  );
}

/** "Bu tempoyla hedefine · [Tarih]" satırı. */
export function PaceDateRow({ label, value }: { label: string; value: string }) {
  const P = useOnb();
  return (
    <View style={[styles.dateRow, { backgroundColor: P.chip, borderColor: P.chipEdge }]}>
      <AppText textRole="bodySm" style={{ color: P.sec }}>
        {label}
      </AppText>
      <AppText textRole="body" style={{ color: P.ink, fontFamily: 'PlusJakartaSans_700Bold' }}>
        {value}
      </AppText>
    </View>
  );
}

// ── Tekerlek seçici ─────────────────────────────────────────────────────────
const ITEM_H = 42;

export function WheelPicker({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly number[];
  value: number;
  onChange: (v: number) => void;
}) {
  const P = useOnb();
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, values.indexOf(value));
  const [cur, setCur] = useState(idx);
  const lastIdx = useRef(idx);

  // İlk konum: seçili değere kaydır (contentOffset iOS'ta güvenilir).
  useEffect(() => {
    ref.current?.scrollTo({ y: idx * ITEM_H, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = useCallback(
    (y: number) => {
      const i = Math.min(values.length - 1, Math.max(0, Math.round(y / ITEM_H)));
      setCur(i);
      if (values[i] !== value) onChange(values[i]);
    },
    [values, value, onChange],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (i !== lastIdx.current) {
      lastIdx.current = i;
      setCur(i);
      haptic('selection');
    }
  };

  const onAction = (e: AccessibilityActionEvent) => {
    const d = e.nativeEvent.actionName === 'increment' ? 1 : -1;
    const i = Math.min(values.length - 1, Math.max(0, cur + d));
    ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
    setCur(i);
    onChange(values[i]);
  };

  return (
    <View style={{ flex: 1 }}>
      <AppText textRole="helper" style={[styles.wheelLabel, { color: P.sec }]}>
        {label}
      </AppText>
      <View
        style={[styles.wheel, { backgroundColor: P.chip, borderColor: P.chipEdge }]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: String(values[cur]) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
      >
        <View
          pointerEvents="none"
          style={[styles.wheelBand, { backgroundColor: P.isDark ? 'rgba(198,240,79,0.22)' : 'rgba(198,240,79,0.42)' }]}
        />
        <ScrollView
          ref={ref}
          style={{ height: ITEM_H * 3 }}
          contentContainerStyle={{ paddingVertical: ITEM_H }}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
          onScrollEndDrag={(e) => settle(e.nativeEvent.contentOffset.y)}
          nestedScrollEnabled
        >
          {values.map((v, i) => (
            <View key={v} style={styles.wheelItem}>
              <AppText
                style={
                  i === cur
                    ? [styles.wheelOn, { color: P.ink }]
                    : [styles.wheelOff, { color: P.sec }]
                }
              >
                {v}
              </AppText>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ── Makro kartı (FinTbResult) ───────────────────────────────────────────────
export function MacroCard({ label, value }: { label: string; value: string }) {
  const P = useOnb();
  return (
    <View style={[styles.macro, { backgroundColor: P.chip, borderColor: P.chipEdge }]}>
      <AppText textRole="helper" style={{ color: P.sec }}>
        {label}
      </AppText>
      <AppText textRole="body" style={{ color: P.ink, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 17 }}>
        {value}
      </AppText>
    </View>
  );
}

// ── İkonlu satır (FinTbFirst) ───────────────────────────────────────────────
export function IconRow({
  title,
  desc,
  icon,
  onPress,
}: {
  title: string;
  desc?: string;
  icon: (color: string) => React.ReactNode;
  onPress: () => void;
}) {
  const P = useOnb();
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={desc ? `${title}. ${desc}` : title}
      style={[styles.iconRow, { backgroundColor: P.chip, borderColor: P.chipEdge }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: P.accent }]}>{icon(P.onAccent)}</View>
      <View style={{ flex: 1 }}>
        <AppText textRole="body" style={{ color: P.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, lineHeight: 20 }}>
          {title}
        </AppText>
        {desc ? (
          <AppText textRole="helper" style={{ color: P.sec, marginTop: 2 }}>
            {desc}
          </AppText>
        ) : null}
      </View>
      <CaretRight size={16} color={P.sec} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  paceHead: { flexDirection: 'row', alignItems: 'flex-end' },
  paceNum: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 38, lineHeight: 44 },
  sliderBox: { height: 44, justifyContent: 'center', marginTop: 4 },
  track: { height: 8, borderRadius: 4 },
  fill: { position: 'absolute', left: 0, height: 8, borderRadius: 4 },
  thumb: { position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, top: (44 - THUMB) / 2 },
  paceLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dateRow: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wheelLabel: { textAlign: 'center', marginBottom: 6 },
  wheel: { borderRadius: 22, borderWidth: 1, overflow: 'hidden', height: ITEM_H * 3 },
  wheelBand: { position: 'absolute', left: 6, right: 6, top: ITEM_H, height: ITEM_H, borderRadius: 12 },
  wheelItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  wheelOn: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24, lineHeight: 28 },
  wheelOff: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, lineHeight: 20 },
  macro: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  iconRow: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
