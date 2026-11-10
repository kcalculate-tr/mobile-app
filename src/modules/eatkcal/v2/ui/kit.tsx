// eatkcal v2 (G13-S2) — ekranların paylaştığı küçük yapı taşları.
//
// Ölçüler FinComponents'tan: tipografi 24 / 20 / 20 / 17 / 15 / 13, boşluk
// 4·8·12·16·24·32, buton 52 / 44, kart 20 köşe · 14 iç boşluk, dokunma ≥ 44.
// Renkler yalnız `useTheme().color.*` (açık + koyu); lime YALNIZ dolgu.
// Cam yalnız yüzen katmanlarda (alt sabit bar, sheet) — akış içi kartlar opak.
// Ortak bileşenler `src/core/design` (S1) — burada yalnız onların üstüne ince
// eatkcal sarmalayıcıları var; yeni renk/hareket sistemi YOK.
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { SCREEN_KEYBOARD_BEHAVIOR } from '../../../../core/design/keyboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme, useReducedMotion, fontFamily, haptic, Button, DURATION, RN_CURVE } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { ArrowLeft, CaretLeft, Star, StarHalf } from '../../../../components/icons';
import { formatPrice, reformatLegacyTl } from '../../../../lib/money';

// ── Tipografi rolleri (FinComponents) ──────────────────────────────────────
export const ekType = {
  /** Ana başlık 24 */
  h24: { fontFamily: fontFamily.headingBold, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 } as TextStyle,
  /** Bölüm / alt sayfa 20 */
  h20: { fontFamily: fontFamily.headingBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 } as TextStyle,
  /** Gövde 17 */
  b17: { fontFamily: fontFamily.bodySemibold, fontSize: 17, lineHeight: 22 } as TextStyle,
  /** Gövde 15 */
  b15: { fontFamily: fontFamily.bodyRegular, fontSize: 15, lineHeight: 20 } as TextStyle,
  b15m: { fontFamily: fontFamily.bodyMedium, fontSize: 15, lineHeight: 20 } as TextStyle,
  b15s: { fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 20 } as TextStyle,
  /** Yardımcı 13 (en küçük metin) */
  c13: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 17 } as TextStyle,
  c13s: { fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 17 } as TextStyle,
  /** Sayılar */
  num: { fontVariant: ['tabular-nums'] } as TextStyle,
} as const;

/** Para biçimi tek kaynaktan (src/lib/money.ts formatPrice — G18: `285 TL`, `285,50 TL`). */
export const money = (v: number) => formatPrice(v);
/** Mantık katmanından gelen hazır metindeki eski `300.00 TL` tutarlarını Final biçimine çevirir (yalnız görünüm). */
export const refmtTl = reformatLegacyTl;

/** Tema + çeviri + güvenli alan — her v2 ekranının ilk satırı. */
export function useEk() {
  const theme = useTheme();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  return { theme, c: theme.color, t, lang, insets };
}

// ── Ekran iskeleti ─────────────────────────────────────────────────────────
export function EkScreen({
  children,
  scroll = true,
  footer,
  overlay,
  header,
  refreshControl,
  contentStyle,
  bottomInset = 24,
  testID,
  onScroll,
  scrollRef,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  /** Alt sabit bar (EkStickyBar). İçerik altına onun yüksekliği kadar boşluk bırakılır. */
  footer?: React.ReactNode;
  /** Kaydırmanın ÜSTÜNDE yüzen katman (ör. lime sepet çubuğu, mutlak konumlu). */
  overlay?: React.ReactNode;
  header?: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  bottomInset?: number;
  testID?: string;
  onScroll?: React.ComponentProps<typeof ScrollView>['onScroll'];
  scrollRef?: React.Ref<ScrollView>;
}) {
  const { c, insets } = useEk();
  const pad = footer ? 96 + insets.bottom : bottomInset + insets.bottom;
  return (
    // G16-S2: Android kenar-kenar pencerede adjustResize çalışmaz → ödeme notu/kupon gibi
    // alanlar klavyenin altında kalmasın (bkz. core/design/keyboard). iOS'ta davranış
    // verilmez → düz View gibi, bugünküyle aynı.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'android' ? SCREEN_KEYBOARD_BEHAVIOR : undefined}
      style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top }]}
      testID={testID}
    >
      {header}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={styles.fill}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[{ paddingBottom: pad }, contentStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, contentStyle]}>{children}</View>
      )}
      {footer}
      {overlay}
    </KeyboardAvoidingView>
  );
}

/** Üst bar: geri (44×44) · başlık 20 · sağ öğe. */
export function EkHeader({
  title,
  onBack,
  right,
  large = false,
}: {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Ana başlık 24 (eatkcal ana sayfa / mağaza). */
  large?: boolean;
}) {
  const { c, t } = useEk();
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={() => {
            haptic('selection');
            onBack();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('eatkcal.v2.common.back')}
          hitSlop={4}
          style={styles.iconBtn}
        >
          {large ? <ArrowLeft size={22} color={c.ink} /> : <CaretLeft size={22} color={c.ink} />}
        </Pressable>
      ) : null}
      <Text
        style={[
          large ? ekType.h24 : ekType.h20,
          { color: c.ink, flex: 1 },
          // G14-S1 (FinEkCart/Checkout/Addresses/Orders): alt sayfa başlığı ortalı.
          !large ? { textAlign: 'center' } : null,
        ]}
        numberOfLines={1}
        accessibilityRole="header"
        maxFontSizeMultiplier={1.3}
      >
        {title}
      </Text>
      {right ?? (!large ? <View style={styles.iconBtn} /> : null)}
    </View>
  );
}

/** Bölüm başlığı 20 + isteğe bağlı metin düğme (≥44). */
export function EkSection({
  title,
  action,
  onAction,
  children,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useEk();
  return (
    <View style={[{ marginTop: 24 }, style]}>
      <View style={styles.sectionHead}>
        <Text style={[ekType.h20, { color: c.ink, flex: 1 }]} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        {action && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" style={styles.textBtn} hitSlop={4}>
            <Text style={[ekType.c13s, { color: c.accentLine }]}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Kart — 20 köşe · 14 iç boşluk · opak. */
export function EkCard({
  children,
  style,
  onPress,
  accessibilityLabel,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { c } = useEk();
  const base = [styles.card, { backgroundColor: c.surface }, style];
  if (!onPress) return <View style={base} testID={testID}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

/** Birincil 52 / ikincil 44 — ortak Button'ın eatkcal tonu. */
export function EkButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  testID,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      variant={variant}
      tone={variant === 'primary' ? 'accent' : 'ink'}
      disabled={disabled}
      style={style}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

/**
 * G16-S2 — Toast için yüzen katman. Final `Toast` akış içi bir kutudur; ekranın
 * kök sütununa doğrudan konunca gizliyken bile ~69 pt yer kaplıyordu (yığın
 * ekranlarında en alttaki "yer tutucu" + içerik kesilmesi). Katman absolute,
 * `bottom` güvenli alan dahil verilir; dokunmayı yalnız Toast alır.
 */
export function EkToastLayer({ bottom, children }: { bottom: number; children: React.ReactNode }) {
  return (
    <View pointerEvents="box-none" style={[styles.toastLayer, { bottom }]}>
      {children}
    </View>
  );
}

/** Alt sabit bar — yüzen katman olduğu için cam (expo-blur). */
export function EkStickyBar({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { c, theme, insets } = useEk();
  return (
    <View style={[styles.sticky, { paddingBottom: Math.max(insets.bottom, 12) }]} testID={testID}>
      <BlurView
        intensity={40}
        tint={theme.isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.isDark ? 'rgba(28,28,30,0.72)' : 'rgba(255,255,255,0.78)', borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth },
        ]}
      />
      <View style={styles.stickyInner}>{children}</View>
    </View>
  );
}

/** İskelet blok — 1800 ms nabız (FinEk*Skeleton `.sk`), azaltılmış harekette sabit .7. */
export function EkSkeleton({
  width,
  height,
  radius = 14,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useEk();
  const reduced = useReducedMotion();
  const o = useRef(new Animated.Value(reduced ? 0.7 : 0.55)).current;
  useEffect(() => {
    if (reduced) {
      o.setValue(0.7);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: DURATION.story, easing: RN_CURVE.standard, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.55, duration: DURATION.story, easing: RN_CURVE.standard, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o, reduced]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: width ?? '100%', height, borderRadius: radius, backgroundColor: c.line, opacity: o }, style]}
    />
  );
}

/** Yıldızlar (puan gösterimi; dokunulmaz). G22-S1 md.6: `half` → 0,5 adımı (yarım yıldız). */
export function EkStars({ value, size = 14, half = false }: { value: number; size?: number; half?: boolean }) {
  const { c } = useEk();
  const v = Math.max(0, Math.min(5, value));
  const r = half ? Math.round(v * 2) / 2 : Math.round(v);
  const full = Math.floor(r);
  const hasHalf = r - full >= 0.5;
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${value}/5`}>
      {[0, 1, 2, 3, 4].map((i) =>
        i === full && hasHalf ? (
          <View key={i} style={{ width: size, height: size }}>
            <Star size={size} color={c.line} weight="fill" style={{ position: 'absolute' }} />
            <StarHalf size={size} color={c.ink} weight="fill" style={{ position: 'absolute' }} />
          </View>
        ) : (
          <Star key={i} size={size} color={i < full ? c.ink : c.line} weight="fill" />
        ),
      )}
    </View>
  );
}

/**
 * G22-S1 md.6 — Restoran puanı satırı: "★★★★½ 4,5 · son 3 ay · 23 değerlendirme";
 * 10'dan az değerlendirme → "Yeni" rozeti (koleksiyon rozet dili: lime zemin, 12/700).
 */
export function EkRatingLine({
  average,
  count,
  isNew,
  compact = false,
  testID = 'ek-rating',
}: {
  average: number | null;
  count: number;
  isNew: boolean;
  compact?: boolean;
  testID?: string;
}) {
  const { c, t, lang } = useEk();
  if (isNew || average == null) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }} accessible accessibilityLabel={t('eatkcal.v2.reviews.new_a11y')} testID={testID}>
        <View style={{ backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: c.onAccent }}>{t('eatkcal.v2.reviews.is_new')}</Text>
        </View>
      </View>
    );
  }
  const r = Math.round(Math.max(0, Math.min(5, average)) * 2) / 2;
  const shown = (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', lang === 'en' ? '.' : ',');
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
      accessible
      accessibilityLabel={t('eatkcal.v2.reviews.rating_a11y', { avg: shown, n: count })}
      testID={testID}
    >
      <EkStars value={r} size={compact ? 12 : 14} half />
      <Text style={[ekType.c13, { color: c.ink, fontWeight: '700' }]}>{shown}</Text>
      {compact ? null : <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.reviews.last3m', { n: count })}</Text>}
    </View>
  );
}

/** Seçilebilir çip (≥44 yükseklik). */
export function EkChip({
  label,
  selected,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const { c } = useEk();
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        haptic('selection');
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      testID={testID}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: c.ink, borderColor: c.ink }
          : { backgroundColor: c.surface, borderColor: c.line },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[ekType.c13s, { color: selected ? c.surface : c.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Satır: sol etiket · sağ değer (özet tabloları). */
export function EkKV({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'ok' | 'secondary';
}) {
  const { c } = useEk();
  const color = tone === 'ok' ? c.accentLine : tone === 'secondary' ? c.secondary : c.ink;
  return (
    <View style={styles.kv}>
      <Text style={[strong ? ekType.b17 : ekType.b15, { color: strong ? c.ink : c.secondary, flex: 1 }]}>{label}</Text>
      <Text style={[strong ? ekType.b17 : ekType.b15m, ekType.num, { color }]}>{value}</Text>
    </View>
  );
}

export const ekStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  gutter: { paddingHorizontal: 16 },
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 8, gap: 4 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, minHeight: 44 },
  textBtn: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  card: { borderRadius: 20, padding: 14 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  toastLayer: { position: 'absolute', left: 16, right: 16 },
  stickyInner: { paddingHorizontal: 16, paddingTop: 12 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kv: { flexDirection: 'row', alignItems: 'center', minHeight: 28 },
});
