// G43-S1 — Kayıt akışı temel parçaları, uygulamanın mevcut diliyle: düz zemin, sabit maskot (göz kırpma
// yalnız L1), üst çubuk (geri + ince ilerleme çubuğu), tek renk başlık + muted alt metin, ana düğme (54 pt,
// lime, siyah yazı, gölgesiz), standart segment (FinSegmented dili), onay kutusu satırı, bilgi kartı.
// Panorama, paralaks, ışık katmanı, süzülme/zıplama, harf harf yazma, kademeli giriş YOK.
// Dokunma alanları ≥ 44 pt, VoiceOver etiketleri, Dynamic Type tavanı; azaltılmış harekette her şey anlık.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppText, CURVE, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CaretLeft, Check } from '../../../components/icons';
import { K_MOTION, useK } from './theme';

/* eslint-disable @typescript-eslint/no-require-imports */
const MASCOT_OPEN = require('../../../../assets/coach/koc-acik.png');
const MASCOT_CLOSED = require('../../../../assets/coach/koc-kapali.png');
/* eslint-enable @typescript-eslint/no-require-imports */

/** Yazı aileleri: başlık Bricolage 700; gövde Plus Jakarta. */
export const FONT = {
  display: 'BricolageGrotesque_700Bold',
  bold: 'PlusJakartaSans_700Bold',
  semi: 'PlusJakartaSans_600SemiBold',
  medium: 'PlusJakartaSans_500Medium',
  body: 'PlusJakartaSans_400Regular',
} as const;

// ─── Zemin ────────────────────────────────────────────────────────────────────
/** Düz uygulama zemini (color.bg). */
export function KBackdrop({ style }: { style?: StyleProp<ViewStyle> }) {
  const P = useK();
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: P.bg }, style]} />;
}

// ─── Maskot ───────────────────────────────────────────────────────────────────
/**
 * kcalAI Koç maskotu (assets/coach), SABİT. `blink` yalnız L1'de: 4–6 sn'de bir göz kırpar; azaltılmış
 * harekette kırpma da yok.
 */
export function Mascot({ size = 96, blink = false, label, style }: { size?: number; blink?: boolean; label?: string; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const { t } = useT();
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!blink || reduced) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const wait = K_MOTION.blinkMin + Math.random() * (K_MOTION.blinkMax - K_MOTION.blinkMin);
      timer = setTimeout(() => {
        if (!alive) return;
        setClosed(true);
        timer = setTimeout(() => {
          if (!alive) return;
          setClosed(false);
          loop();
        }, K_MOTION.blinkHold);
      }, wait);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [blink, reduced]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label ?? t('kayit.onb.mascot')} style={[{ width: size, height: size }, style]}>
      <Image source={closed ? MASCOT_CLOSED : MASCOT_OPEN} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

// ─── İlerleme çubuğu ──────────────────────────────────────────────────────────
/** İnce ilerleme çubuğu (4 pt, lime dolu / iz boş). Dolma 220 ms; azaltılmışta anında. */
export function ProgressBar({ index, total }: { index: number; total: number }) {
  const P = useK();
  const { t } = useT();
  const reduced = useReducedMotion();
  const ratio = total > 0 ? Math.min(1, Math.max(0, index / total)) : 0;
  const v = useSharedValue(ratio);
  useEffect(() => {
    v.value = reduced ? ratio : withTiming(ratio, { duration: K_MOTION.fade, easing: CURVE.standard });
  }, [ratio, reduced, v]);
  const fill = useAnimatedStyle(() => ({ width: `${v.value * 100}%` as `${number}%` }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('kayit.q.progress', { index, total })}
      accessibilityValue={{ min: 0, max: total, now: index }}
      style={[styles.bar, { backgroundColor: P.track }]}
    >
      <Animated.View style={[styles.barFill, { backgroundColor: P.accent }, fill]} />
    </View>
  );
}

// ─── Üst çubuk ────────────────────────────────────────────────────────────────
/** Simge düğmesi (44 pt, zeminsiz). */
export function IconButton({ onPress, label, children, testID, disabled }: { onPress: () => void; label: string; children: React.ReactNode; testID?: string; disabled?: boolean }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.iconBtn, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

/** Solda geri · ortada ince ilerleme çubuğu · sağda boş (ya da `right`). Her ekranda aynı yer. */
export function TopBar({ onBack, progress, right }: { onBack?: (() => void) | null; progress?: { index: number; total: number } | null; right?: React.ReactNode }) {
  const P = useK();
  const { t } = useT();
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <IconButton testID="kayit-back" onPress={onBack} label={t('kayit.q.back')}>
          <CaretLeft size={24} color={P.ink} weight="bold" />
        </IconButton>
      ) : (
        <View style={styles.side} />
      )}
      <View style={styles.barSlot}>{progress ? <ProgressBar index={progress.index} total={progress.total} /> : null}</View>
      {right ?? <View style={styles.side} />}
    </View>
  );
}

// ─── Başlık ───────────────────────────────────────────────────────────────────
/** Başlık (Bricolage 700, 28 pt, ink) + isteğe bağlı tek satır açıklama (Plus Jakarta 15, muted). */
export function KTitle({ title, sub, testID, center = false, style }: { title: string; sub?: string | null; testID?: string; center?: boolean; style?: StyleProp<ViewStyle> }) {
  const P = useK();
  return (
    <View style={[styles.head, style]}>
      <AppText testID={testID} accessibilityRole="header" maxFontSizeMultiplier={1.35} style={[styles.title, { color: P.ink }, center && styles.center]}>
        {title}
      </AppText>
      {sub ? (
        <AppText maxFontSizeMultiplier={1.4} style={[styles.sub, { color: P.sec }, center && styles.center]}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

// ─── Ana düğme ────────────────────────────────────────────────────────────────
/**
 * `primary`: 54 pt, yarıçap 27, lime dolgu, siyah yazı, gölgesiz. Devre dışı: dolgu + yazı rengiyle ayrılır.
 * `loading`: aynı boyutta halka. `text`: ikincil eylem — 44 pt metin düğmesi.
 */
export function KButton({ label, onPress, disabled, loading, testID, variant = 'primary' }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; testID?: string; variant?: 'primary' | 'text' }) {
  const P = useK();
  const off = !!disabled && !loading;
  if (variant === 'text') {
    return (
      <Pressable
        testID={testID}
        onPress={() => {
          if (off || loading) return;
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: off || !!loading, busy: !!loading }}
        style={({ pressed }) => [styles.textBtn, { opacity: off ? 0.4 : pressed ? 0.6 : 1 }]}
      >
        <AppText numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.textBtnLabel, { color: P.ink }]}>
          {label}
        </AppText>
      </Pressable>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (off || loading) return;
        haptic('light');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off || !!loading, busy: !!loading }}
      style={({ pressed }) => [styles.btn, { backgroundColor: off ? P.disabled : P.accent, opacity: pressed && !off ? 0.85 : 1 }]}
    >
      {loading ? (
        <ActivityIndicator color={P.onAccent} />
      ) : (
        <AppText numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.btnText, { color: off ? P.disabledText : P.onAccent }]}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

/** Alt alan: ana düğme güvenli alanın üstünde (+ isteğe bağlı ikincil metin düğmesi). */
export function KFooter({ children, bottom }: { children: React.ReactNode; bottom: number }) {
  return <View style={[styles.footer, { paddingBottom: Math.max(bottom, 16) + 8 }]}>{children}</View>;
}

// ─── Segment ──────────────────────────────────────────────────────────────────
/**
 * Uygulamanın standart segment dili (Profil FinSegmented): iz = ayraç rengi, seçili = yüzey hapı, yazı ink.
 * Seçenekler 44 pt; seçili hap 220 ms kayar (azaltılmışta anında). VoiceOver: radyo grubu.
 */
export function Segment<T extends string>({
  options,
  value,
  onChange,
  label,
  width,
  testID,
  labelledBy,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  /** Verilmezse kabın genişliğine yayılır. */
  width?: number;
  testID?: string;
  labelledBy?: string;
}) {
  const P = useK();
  const reduced = useReducedMotion();
  const [rowW, setRowW] = useState(width ?? 0);
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  const x = useSharedValue(idx);
  useEffect(() => {
    x.value = reduced ? idx : withTiming(idx, { duration: K_MOTION.fade, easing: CURVE.standard });
  }, [idx, reduced, x]);
  const seg = rowW > 0 ? (rowW - 8) / options.length : 0;
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * seg }] }));
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      accessibilityLabelledBy={labelledBy}
      onLayout={(e) => setRowW(e.nativeEvent.layout.width)}
      style={[styles.seg, { backgroundColor: P.line }, width ? { width, alignSelf: 'center' } : { alignSelf: 'stretch' }]}
    >
      {seg > 0 ? <Animated.View style={[styles.segThumb, { width: seg, backgroundColor: P.surface }, thumb]} /> : null}
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            testID={testID ? `${testID}-${o.key}` : undefined}
            onPress={() => {
              if (!on) haptic('selection');
              onChange(o.key);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            style={[styles.segItem, on && seg === 0 ? { backgroundColor: P.surface } : null]}
          >
            <AppText numberOfLines={1} maxFontSizeMultiplier={1.25} style={[styles.segText, { color: P.ink }]}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Seçim işareti ────────────────────────────────────────────────────────────
/** Sağdaki seçim işareti: seçili = lime dolu daire + siyah tik; seçilmemiş = boş daire. */
export function RadioMark({ on, square = false }: { on: boolean; square?: boolean }) {
  const P = useK();
  return (
    <View style={[styles.mark, square && styles.markSquare, on ? { backgroundColor: P.accent, borderColor: P.accent } : { borderColor: P.line2 }]}>
      {on ? <Check size={14} color={P.onAccent} weight="bold" /> : null}
    </View>
  );
}

// ─── Onay kutusu satırı ───────────────────────────────────────────────────────
export function CheckBoxRow({ checked, onToggle, label, note, testID, disabled }: { checked: boolean; onToggle: () => void; label: string; note?: string | null; testID?: string; disabled?: boolean }) {
  const P = useK();
  return (
    <Pressable
      testID={testID}
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={label}
      accessibilityHint={note ?? undefined}
      style={[styles.checkRow, { backgroundColor: P.surface }]}
    >
      <RadioMark on={checked} square />
      <View style={{ flex: 1, gap: 4 }}>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.checkText, { color: P.ink }]}>
          {label}
        </AppText>
        {note ? (
          <AppText maxFontSizeMultiplier={1.4} style={[styles.checkNote, { color: P.sec }]}>
            {note}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Uyarı / bilgi kartı (ağ yok, iptal, kod yanlış…). tone: info = beyaz yüzey, error = hata tonu. */
export function NoticeCard({ title, sub, tone = 'info', action, testID }: { title: string; sub?: string; tone?: 'info' | 'error'; action?: { label: string; onPress: () => void }; testID?: string }) {
  const P = useK();
  return (
    <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: tone === 'error' ? P.dangerBg : P.surface }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.noticeTitle, { color: tone === 'error' ? P.danger : P.ink }]}>
          {title}
        </AppText>
        {sub ? (
          <AppText maxFontSizeMultiplier={1.4} style={[styles.noticeSub, { color: P.sec }]}>
            {sub}
          </AppText>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} style={styles.noticeBtn}>
          <AppText maxFontSizeMultiplier={1.3} style={[styles.noticeAction, { color: P.ink }]}>
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Beyaz kart (yarıçap 16). */
export function KCard({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const P = useK();
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: P.surface }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 4, borderRadius: 2, overflow: 'hidden', alignSelf: 'stretch' },
  barFill: { height: 4, borderRadius: 2 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 48, gap: 8 },
  side: { width: 44, height: 44 },
  barSlot: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  head: { paddingHorizontal: 20, gap: 8 },
  title: { fontFamily: FONT.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  sub: { fontFamily: FONT.body, fontSize: 15, lineHeight: 21 },
  center: { textAlign: 'center' },
  btn: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, alignSelf: 'stretch' },
  btnText: { fontFamily: FONT.bold, fontSize: 17 },
  textBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, alignSelf: 'center' },
  textBtnLabel: { fontFamily: FONT.semi, fontSize: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 24 },
  segThumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 20 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 20, paddingHorizontal: 8 },
  segText: { fontFamily: FONT.semi, fontSize: 15 },
  mark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  markSquare: { borderRadius: 7 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, minHeight: 64 },
  checkText: { fontFamily: FONT.medium, fontSize: 15, lineHeight: 21 },
  checkNote: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  noticeTitle: { fontFamily: FONT.semi, fontSize: 15 },
  noticeSub: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
  noticeBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  noticeAction: { fontFamily: FONT.bold, fontSize: 14, textDecorationLine: 'underline' },
  card: { borderRadius: 16, padding: 16 },
});
