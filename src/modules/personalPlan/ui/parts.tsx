// G34-S1 · Tur 26o — Kişisel plan ortak parçaları (01–04 panoları). Light + Dark aynı kod
// (onboarding paleti `useOnb`). HIG: dokunma ≥ 44 pt, Dynamic Type (AppText tavanları, kırpma
// yok — satırlar sarar), VoiceOver etiketleri, Azaltılmış hareket (motion.tsx).
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AppText } from '../../../core/design/components/AppText';
import { haptic } from '../../../core/design/motion';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { useT } from '../../../core/i18n';
import { CaretLeft, Check, Minus, Plus } from '../../../components/icons';
import { useOnb, type OnbPalette } from '../../onboarding/components/onbTheme';
import { MorphSwap, PressCard } from './motion';
import { palette } from '../../../core/design/tokens';

export const GLASS: Record<'trophy' | 'flame' | 'drop' | 'foot' | 'bowl', ImageSourcePropType> = {
  trophy: require('../../../../assets/glass/trophy.png'),
  flame: require('../../../../assets/glass/flame.png'),
  drop: require('../../../../assets/glass/drop.png'),
  foot: require('../../../../assets/glass/foot.png'),
  bowl: require('../../../../assets/glass/bowl.png'),
};

export function usePp(): OnbPalette & { surface: string; surfaceEdge: string; field: string; warnBg: string; warnInk: string } {
  const P = useOnb();
  return {
    ...P,
    surface: P.isDark ? '#1C1C1E' : '#FFFFFF',
    surfaceEdge: P.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,10,0.06)',
    field: P.isDark ? '#2C2C2E' : '#F3F4F6',
    warnBg: P.isDark ? 'rgba(255,196,0,0.14)' : '#FFF6DB',
    warnInk: P.isDark ? '#FFD66B' : '#7A5600',
  };
}

/** Akış zemini: tema zemini + iki yumuşak lime ışık (Onboarding ile aynı dil). */
export function PpBackdrop({ glow = true }: { glow?: boolean }) {
  const P = usePp();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: P.bg }]} />
      {glow ? (
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="ppA" cx="20%" cy="12%" rx="80%" ry="40%">
              <Stop offset="0" stopColor={palette.lime} stopOpacity={P.glowA} />
              <Stop offset="1" stopColor={palette.lime} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="ppB" cx="85%" cy="70%" rx="75%" ry="40%">
              <Stop offset="0" stopColor={palette.lime} stopOpacity={P.glowB * 0.7} />
              <Stop offset="1" stopColor={palette.lime} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#ppA)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#ppB)" />
        </Svg>
      ) : null}
    </View>
  );
}

/** Düz ekran başlığı (Kişisel planım, Planı düzenle, Haftalık tartı): Geri + kalın başlık. */
export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const P = usePp();
  const i18n = useT();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sHead, { paddingTop: insets.top + 4 }]}>
      <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel={i18n.t('pp.back')} style={styles.headBtn}>
        <CaretLeft size={22} color={P.ink} weight="bold" />
      </Pressable>
      <AppText textRole="section" style={{ color: P.ink, flex: 1 }} accessibilityRole="header" numberOfLines={2}>
        {title}
      </AppText>
    </View>
  );
}

/** Beyaz kart (soru gövdesi) + alt düğmeler. İçerik taşarsa kart kayar. */
export function PpCard({
  title,
  sub,
  glass,
  children,
  footer,
  hint,
  scroll = true,
  center = false,
}: {
  title?: string;
  sub?: string;
  glass?: keyof typeof GLASS;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  hint?: string;
  scroll?: boolean;
  center?: boolean;
}) {
  const P = usePp();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <View style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
      <Body
        {...(scroll ? { ...SCROLL_KEYBOARD, contentContainerStyle: [styles.cardBody, center ? styles.center : null], showsVerticalScrollIndicator: false } : { style: [styles.cardBody, { flex: 1 }, center ? styles.center : null] })}
      >
        {title ? (
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <AppText textRole="screenTitle" style={{ color: P.ink }} accessibilityRole="header">
                {title}
              </AppText>
              {sub ? (
                <AppText textRole="bodySm" style={{ color: P.sec, marginTop: 6 }}>
                  {sub}
                </AppText>
              ) : null}
            </View>
            {glass ? <Image source={GLASS[glass]} style={styles.glass} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
          </View>
        ) : null}
        {children}
      </Body>
      {footer || hint ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
          {hint ? (
            <AppText textRole="helper" style={{ color: P.sec, textAlign: 'center', marginBottom: 10 }}>
              {hint}
            </AppText>
          ) : null}
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/** Siyah (Dark'ta beyaz) hap düğme, 52; pasif gri. */
export function PpButton({
  label,
  onPress,
  kind = 'ink',
  disabled = false,
  style,
  testID,
  a11yHint,
}: {
  label: string;
  onPress: () => void;
  kind?: 'ink' | 'lime' | 'ghost' | 'link';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  a11yHint?: string;
}) {
  const P = usePp();
  if (kind === 'link') {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID} style={[styles.link, style]} hitSlop={6}>
        <AppText textRole="bodySm" style={{ color: P.ink, textDecorationLine: 'underline', textAlign: 'center' }}>
          {label}
        </AppText>
      </Pressable>
    );
  }
  const bg = disabled ? P.dis : kind === 'ink' ? P.ink : kind === 'lime' ? P.accent : 'transparent';
  const fg = disabled ? P.disText : kind === 'ink' ? P.onInk : kind === 'lime' ? P.onAccent : P.ink;
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={a11yHint}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: pressed && !disabled ? 0.86 : 1 },
        kind === 'ghost' ? { borderWidth: 1, borderColor: P.line2 } : null,
        style,
      ]}
    >
      <AppText textRole="body" style={{ color: fg, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Büyük seçim kartı (Hedef, Hareket): seçiliyse lime dolgu + tik; "Öneri" rozeti; kapalı (yarı saydam + neden). */
export function ChoiceCard({
  title,
  sub,
  selected,
  onPress,
  badge,
  disabled = false,
  trailing,
  testID,
}: {
  title: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  badge?: string;
  disabled?: boolean;
  trailing?: string;
  testID?: string;
}) {
  const P = usePp();
  const fg = selected ? P.onAccent : P.ink;
  return (
    <PressCard
      onPress={onPress}
      disabled={disabled}
      hapticKind={disabled ? null : 'light'}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={[title, sub, badge].filter(Boolean).join('. ')}
      testID={testID}
      style={[
        styles.choice,
        selected ? { backgroundColor: P.accent, borderColor: 'transparent' } : { backgroundColor: P.field, borderColor: P.surfaceEdge },
        disabled ? { opacity: 0.45 } : null,
      ]}
    >
      <View style={{ flex: 1 }}>
        <AppText textRole="body" style={{ color: fg, fontWeight: '700' }}>
          {title}
        </AppText>
        {sub ? (
          <AppText textRole="helper" style={{ color: selected ? P.accentSub : P.sec, marginTop: 2 }}>
            {sub}
          </AppText>
        ) : null}
      </View>
      {trailing ? (
        <View style={[styles.pill, { backgroundColor: selected ? 'rgba(10,10,10,0.08)' : P.chip, borderColor: P.chipEdge }]}>
          <AppText textRole="helper" style={{ color: fg, fontVariant: ['tabular-nums'] }}>
            {trailing}
          </AppText>
        </View>
      ) : null}
      {badge && !selected ? (
        <View style={[styles.pill, { backgroundColor: P.chip, borderColor: P.chipEdge }]}>
          <AppText textRole="helper" style={{ color: P.ink }}>
            {badge}
          </AppText>
        </View>
      ) : null}
      {selected ? <Check size={18} color={P.onAccent} weight="bold" /> : null}
    </PressCard>
  );
}

/** Çip (çoklu/tekli seçim). */
export function Chip({ label, selected, onPress, disabled, sub, flex }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean; sub?: string; flex?: boolean }) {
  const P = usePp();
  return (
    <PressCard
      onPress={onPress}
      disabled={disabled}
      hapticKind={disabled ? null : 'selection'}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      style={[
        styles.chip,
        flex ? { flex: 1 } : null,
        selected ? { backgroundColor: P.accent, borderColor: 'transparent' } : { backgroundColor: P.field, borderColor: P.surfaceEdge },
        disabled ? { opacity: 0.45 } : null,
      ]}
    >
      <AppText textRole="helper" style={{ color: selected ? P.onAccent : P.ink, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </AppText>
      {sub ? (
        <AppText textRole="helper" style={{ color: selected ? P.accentSub : P.sec, fontSize: 11, textAlign: 'center' }}>
          {sub}
        </AppText>
      ) : null}
    </PressCard>
  );
}

/** −  değer  + (44 pt dokunma), VoiceOver: ayarlanabilir. */
export function Stepper({
  label,
  value,
  display,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  display?: string;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const P = usePp();
  const i18n = useT();
  const set = (v: number) => {
    const n = Math.min(max, Math.max(min, Math.round(v / step) * step));
    if (n !== value) {
      haptic('selection');
      onChange(n);
    }
  };
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: display ?? String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? step : -step))}
    >
      <Pressable onPress={() => set(value - step)} disabled={value <= min} style={[styles.stepBtn, { borderColor: P.line2, opacity: value <= min ? 0.35 : 1 }]} accessibilityRole="button" accessibilityLabel={`${i18n.t('pp.dec')} ${label}`} hitSlop={4}>
        <Minus size={16} color={P.ink} weight="bold" />
      </Pressable>
      <AppText textRole="body" style={[styles.stepVal, { color: P.ink }]}>
        {display ?? String(value)}
      </AppText>
      <Pressable onPress={() => set(value + step)} disabled={value >= max} style={[styles.stepBtn, { borderColor: P.line2, opacity: value >= max ? 0.35 : 1 }]} accessibilityRole="button" accessibilityLabel={`${i18n.t('pp.inc')} ${label}`} hitSlop={4}>
        <Plus size={16} color={P.ink} weight="bold" />
      </Pressable>
    </View>
  );
}

/** Satır: etiket (+alt) solda, sağda içerik. */
export function Row({ label, sub, children, onPress, a11y, last }: { label: string; sub?: string; children?: React.ReactNode; onPress?: () => void; a11y?: string; last?: boolean }) {
  const P = usePp();
  const inner = (
    <View style={[styles.row, !last ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.line } : null]}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <AppText textRole="bodySm" style={{ color: P.ink }}>
          {label}
        </AppText>
        {sub ? (
          <AppText textRole="helper" style={{ color: P.sec, marginTop: 2 }}>
            {sub}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {inner}
    </Pressable>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const P = usePp();
  return (
    <Switch
      value={value}
      onValueChange={(v) => {
        haptic('selection');
        onChange(v);
      }}
      trackColor={{ false: P.track, true: '#9BCB2E' }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={P.track}
      accessibilityLabel={label}
    />
  );
}

/** Onay kutusu satırı (açık rıza). */
export function CheckRow({ checked, onToggle, label, done, doneLabel, draftLabel, testID }: { checked: boolean; onToggle: () => void; label: string; done?: boolean; doneLabel?: string; draftLabel?: string; testID?: string }) {
  const P = usePp();
  if (done) {
    return (
      <View style={[styles.checkRow, { borderColor: P.surfaceEdge, backgroundColor: P.field }]} accessible accessibilityLabel={`${label}. ${doneLabel ?? ''}`}>
        <View style={[styles.box, { backgroundColor: P.accent, borderColor: 'transparent' }]}>
          <Check size={14} color={P.onAccent} weight="bold" />
        </View>
        <View style={{ flex: 1 }}>
          <AppText textRole="helper" style={{ color: P.ink }}>
            {label}
          </AppText>
          <AppText textRole="helper" style={{ color: P.sec, marginTop: 2, fontWeight: '700' }}>
            {doneLabel}
          </AppText>
        </View>
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onToggle();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      testID={testID}
      style={[styles.checkRow, { borderColor: P.surfaceEdge, backgroundColor: P.field }]}
    >
      <View style={[styles.box, checked ? { backgroundColor: P.ink, borderColor: P.ink } : { borderColor: P.line2 }]}>{checked ? <Check size={14} color={P.onInk} weight="bold" /> : null}</View>
      <View style={{ flex: 1 }}>
        <AppText textRole="helper" style={{ color: P.ink }}>
          {label}
        </AppText>
        {draftLabel ? (
          <AppText textRole="helper" style={{ color: P.warnInk, marginTop: 4, fontSize: 11, fontWeight: '700' }}>
            {draftLabel}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Bilgi / güvenlik notu (ⓘ + metin). */
export function Note({ text, tone = 'info', testID }: { text: string; tone?: 'info' | 'warn'; testID?: string }) {
  const P = usePp();
  return (
    <View
      testID={testID}
      style={[styles.note, tone === 'warn' ? { backgroundColor: P.warnBg } : { backgroundColor: P.field }]}
      accessible
      accessibilityLabel={text}
    >
      <View style={[styles.noteDot, { borderColor: tone === 'warn' ? P.warnInk : P.sec }]}>
        <AppText style={{ color: tone === 'warn' ? P.warnInk : P.sec, fontSize: 11, lineHeight: 13, fontWeight: '700' }} importantForAccessibility="no">i</AppText>
      </View>
      <AppText textRole="helper" style={{ flex: 1, color: tone === 'warn' ? P.warnInk : P.sec }}>
        {text}
      </AppText>
    </View>
  );
}

export function Section({ title, children, style }: { title?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const P = usePp();
  return (
    <View style={[{ marginTop: 18 }, style]}>
      {title ? (
        <AppText textRole="helper" style={{ color: P.sec, marginBottom: 8 }} accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

/** Panel (gri yuvarlak kutu). */
export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const P = usePp();
  return <View style={[styles.panel, { backgroundColor: P.field }, style]}>{children}</View>;
}

/**
 * Hedef tarihi eğrisi (FinPlanFlowTarget / Result / Mine): bugünden hedefe yumuşak inen eğri,
 * bitiş noktası lime daire. Morph yerine 330 opaklık geçişi (MorphSwap; yeni paket yok).
 */
export function TargetCurve({
  fromKg,
  toKg,
  leftLabel,
  rightLabel,
  topLabel,
  endLabel,
  width,
  height = 92,
  dashed = false,
  a11y,
}: {
  fromKg: number;
  toKg: number;
  leftLabel: string;
  rightLabel: string;
  topLabel: string;
  endLabel: string;
  width: number;
  height?: number;
  dashed?: boolean;
  a11y: string;
}) {
  const P = usePp();
  const pad = 10;
  const w = Math.max(80, width);
  const down = toKg < fromKg;
  const y0 = down ? pad + 6 : height - pad - 6;
  const y1 = down ? height - pad - 6 : pad + 6;
  const x0 = pad;
  const x1 = w - pad - 6;
  const d = `M ${x0} ${y0} C ${x0 + (x1 - x0) * 0.45} ${y0}, ${x0 + (x1 - x0) * 0.55} ${y1}, ${x1} ${y1}`;
  const area = `${d} L ${x1} ${height} L ${x0} ${height} Z`;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11y}>
      <View style={styles.curveLabels}>
        <AppText textRole="helper" style={{ color: P.sec }}>
          {topLabel}
        </AppText>
        <AppText textRole="helper" style={{ color: P.sec, textAlign: 'right' }}>
          {endLabel}
        </AppText>
      </View>
      <MorphSwap k={`${fromKg}-${toKg}-${rightLabel}`}>
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="ppCurve" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.lime} stopOpacity={P.isDark ? 0.28 : 0.4} />
              <Stop offset="1" stopColor={palette.lime} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#ppCurve)" />
          <Path d={d} stroke={P.isDark ? palette.lime : '#5E7A12'} strokeWidth={2} fill="none" strokeDasharray={dashed ? '4 4' : undefined} />
          <Circle cx={x0} cy={y0} r={4} fill={P.surface} stroke={P.ink} strokeWidth={2} />
          <Circle cx={x1} cy={y1} r={6} fill={palette.lime} stroke={P.ink} strokeWidth={2} />
        </Svg>
      </MorphSwap>
      <View style={styles.curveLabels}>
        <AppText textRole="helper" style={{ color: P.sec }}>
          {leftLabel}
        </AppText>
        <AppText textRole="helper" style={{ color: P.sec, textAlign: 'right' }}>
          {rightLabel}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 48 },
  sHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 6, gap: 2 },
  headBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headMid: { flex: 1, alignItems: 'center' },
  card: { flex: 1, marginHorizontal: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardBody: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  center: { flexGrow: 1, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  glass: { width: 44, height: 52 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
  btn: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, marginBottom: 10 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  chip: { minHeight: 44, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepVal: { minWidth: 56, textAlign: 'center', fontWeight: '700', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, padding: 14, borderWidth: 1, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  note: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 12, marginTop: 12 },
  noteDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  panel: { borderRadius: 16, padding: 14 },
  curveLabels: { flexDirection: 'row', justifyContent: 'space-between' },
});
