/**
 * G12-S4 — Final tasarım ortak bileşenleri (yerel).
 *
 * Final `FinComponents` panosunun ölçülerini (tipografi 24/20/17/15/13, boşluk
 * 4·8·12·16·24·32, buton 52/44, dokunma ≥44, kart 20 köşe/14 iç, satır 52)
 * uygulamanın mevcut `useTheme()` token'larıyla eşler. Paralel aşamada S1'in
 * yeni ortak bileşenleri import EDİLEMEZ (G12 sözleşmesi) — bu dosya S4'ün
 * kendi yerel kopyasıdır; S6 entegrasyonda ortak bileşene geçirir.
 *
 * Renkler ekranlarda hex yazılmadan buradan/`useTheme()`'den gelir; lime yalnız
 * dolgu, üstünde koyu metin.
 */
import React, { useCallback, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { FinText as Text } from '../../../core/design/components/FinText';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PREMIUM, RN_CURVE, useTheme } from '../../../core/design';
import { FinErrorReveal } from '../../../core/design/components/FinTransitions';
import { SlidingIndicator, useRowWidth } from '../../../core/design/sectionSlide';
import type { Theme } from '../../../core/design';
import { fontFamily } from '../../../core/design/typography';
import { SCREEN_KEYBOARD_BEHAVIOR } from '../../../core/design/keyboard';
import { ArrowLeft, CaretRight } from '../../../components/icons';

/** Final panolarında geçen ama anlamsal temada olmayan yardımcı tonlar. */
export function finExtras(t: Theme) {
  return t.isDark
    ? {
        line2: '#48484A',
        track: '#2C2C2E',
        nested: '#2C2C2E',
        placeholder: '#3A3A3C',
        placeholderText: '#C7C7CC',
        glass: 'rgba(28,28,30,0.72)',
        glassText: '#F5F5F5',
        scrim: 'rgba(0,0,0,0.5)',
        toastBg: '#F5F5F5',
        toastFg: '#0A0A0A',
      }
    : {
        line2: '#C3C7CC',
        track: '#DCDEE2',
        nested: '#F3F4F6',
        placeholder: '#DCDEE2',
        placeholderText: '#45454A',
        glass: 'rgba(255,255,255,0.82)',
        glassText: '#0A0A0A',
        scrim: 'rgba(10,10,10,0.32)',
        toastBg: '#0A0A0A',
        toastFg: '#FFFFFF',
      };
}

export type FinExtras = ReturnType<typeof finExtras>;

export const heading = fontFamily.headingBold;
export const headingSemibold = fontFamily.headingSemibold;
export const body = fontFamily.bodyRegular;
export const bodyMedium = fontFamily.bodyMedium;
export const bodySemibold = fontFamily.bodySemibold;
export const bodyBold = fontFamily.bodyBold;

/** Ekran kabuğu — güvenli alan + zemin. */
export function FinScreen({
  children,
  scroll,
  contentStyle,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<any>;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // G21-S1 md.10 — klavye: iOS'ta ScrollView kendi içeriğini klavye kadar içeri
  // alır ve odaklı alanı görünür tutar (`automaticallyAdjustKeyboardInsets`);
  // Android kenar-kenar pencerede `adjustResize` çalışmadığından kap padding'le
  // küçülür (FIN_SCREEN_KEYBOARD). İkisi aynı anda devrede değil → çift boşluk yok.
  if (scroll) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.color.bg }} behavior={FIN_SCREEN_KEYBOARD}>
        <ScrollView
          style={{ flex: 1, backgroundColor: t.color.bg }}
          contentContainerStyle={[{ paddingBottom: insets.bottom + 40 }, contentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          testID="fin-screen-scroll"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
  return (
    <KeyboardAvoidingView style={[{ flex: 1, backgroundColor: t.color.bg }, contentStyle]} behavior={FIN_SCREEN_KEYBOARD}>
      {children}
    </KeyboardAvoidingView>
  );
}

/**
 * FinScreen klavye davranışı: Android'de 'padding' (SCREEN_KEYBOARD_BEHAVIOR),
 * iOS'ta yok — orada içerideki ScrollView'lar `automaticallyAdjustKeyboardInsets`
 * ile kayar (FIN_SCROLL_KEYBOARD). Kendi ScrollView'ını çizen Fin ekranları bu
 * özellikleri `FIN_SCROLL_KEYBOARD` ile alır.
 */
export const FIN_SCREEN_KEYBOARD = Platform.OS === 'android' ? SCREEN_KEYBOARD_BEHAVIOR : undefined;
export const FIN_SCROLL_KEYBOARD = {
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: 'interactive',
  automaticallyAdjustKeyboardInsets: true,
} as const;

/** Üst başlık — 44 geri + ortalı başlık (20). */
export function FinHeader({
  title,
  onBack,
  right,
  align = 'center',
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** FinPrivacySettings başlığı sola dayalı; diğerleri ortalı. */
  align?: 'center' | 'left';
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        marginTop: insets.top + 6,
        height: 44,
        paddingHorizontal: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Geri"
          hitSlop={8}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={t.color.ink} weight="bold" />
        </Pressable>
      ) : (
        <View style={{ width: 44 }} />
      )}
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          textAlign: align,
          fontFamily: heading,
          fontSize: 20,
          color: t.color.ink,
        }}
      >
        {title}
      </Text>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/** Bölüm etiketi — 13 ikincil kalın. */
export function FinSectionLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text
      style={{
        marginHorizontal: 4,
        fontFamily: bodyBold,
        fontSize: 13,
        color: t.color.secondary,
      }}
    >
      {children}
    </Text>
  );
}

/** Opak kart — 20 köşe, 14 iç boşluk. */
export function FinCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        { backgroundColor: t.color.surface, borderRadius: 20, padding: 14 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Liste satırı — min 52, sol ikon, etiket, sağ değer + chevron. İlk satırda üst çizgi yok. */
export function FinRow({
  icon,
  label,
  value,
  onPress,
  first,
  chevron = true,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  first?: boolean;
  chevron?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: 52,
        paddingHorizontal: 14,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.color.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon ? <View style={{ width: 22, alignItems: 'center' }}>{icon}</View> : null}
      <Text style={{ flex: 1, fontFamily: bodyMedium, fontSize: 15, color: t.color.ink }}>{label}</Text>
      {value ? (
        <Text style={{ fontFamily: bodyMedium, fontSize: 14, color: t.color.secondary }}>{value}</Text>
      ) : null}
      {chevron && onPress ? <CaretRight size={16} color={t.color.secondary} weight="bold" /> : null}
    </Pressable>
  );
}

/** Satırları saran kart (overflow hidden, 20 köşe). */
export function FinRowGroup({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ borderRadius: 20, backgroundColor: t.color.surface, overflow: 'hidden' }}>{children}</View>
  );
}

/** Birincil buton — 52, lime dolgu + koyu metin (varsayılan) ya da ink. */
export function FinPrimaryButton({
  label,
  onPress,
  icon,
  tone = 'ink',
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  tone?: 'ink' | 'lime';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = tone === 'lime' ? t.color.accent : t.color.ink;
  const fg = tone === 'lime' ? t.color.onAccent : t.color.bg === '#000000' ? '#0A0A0A' : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: 26,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text style={{ fontFamily: bodySemibold, fontSize: 16, color: fg }}>{label}</Text>
    </Pressable>
  );
}

/** İkincil buton — 44/52, kenarlıklı. */
export function FinSecondaryButton({
  label,
  onPress,
  icon,
  height = 44,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const x = finExtras(t);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: 16,
          borderRadius: height / 2,
          borderWidth: 1,
          borderColor: x.line2,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Segment denetimi (tab) — eşit sütunlar, seçili beyaz/ink. G21-S1 md.9: seçili
 * hap yeni sekmeye KAYAR (FinMoTokens; azaltılmışta 200 ms opaklık). Satır
 * ölçülene kadar seçili düğme kendi zeminini çizer (ilk karede boşluk yok).
 */
export function FinSegmented({
  options,
  index,
  onChange,
}: {
  options: string[];
  index: number;
  onChange: (i: number) => void;
}) {
  const t = useTheme();
  const [rowW, onRowLayout] = useRowWidth();
  const measured = rowW > 0;
  return (
    <View
      onLayout={onRowLayout}
      accessibilityRole="tablist"
      testID="fin-segmented"
      style={{
        flexDirection: 'row',
        padding: 4,
        borderRadius: 22,
        backgroundColor: t.color.line,
        gap: 4,
      }}
    >
      <SlidingIndicator
        testID="fin-segmented-indicator"
        index={index}
        count={options.length}
        containerWidth={rowW}
        inset={4}
        gap={4}
        style={{ top: 4, height: 40, borderRadius: 18, backgroundColor: t.color.surface }}
      />
      {options.map((o, i) => {
        const on = i === index;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on && !measured ? t.color.surface : 'transparent',
            }}
          >
            <Text style={{ fontFamily: bodySemibold, fontSize: 14, color: t.color.ink }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Seçilebilir çip (44 yüksek). Seçili = lime dolgu + koyu metin. */
export function FinChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  const x = finExtras(t);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? t.color.accent : t.color.surface,
        borderWidth: selected ? 0 : 1,
        borderColor: t.color.line,
      }}
    >
      <Text
        style={{
          fontFamily: bodySemibold,
          fontSize: 14,
          color: selected ? t.color.onAccent : t.color.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * FinMoShake — yalnız form alanı doğrulama hatasında (ağ/limit/red: titreşim
 * yok). Alan ±8px bir kez sallanır + uyarı haptiği. `style`'ı sallanacak
 * View/Animated.View'e, `shake()`'i doğrulama başarısız olduğunda çağır.
 */
export function useFinShake() {
  const anim = useRef(new Animated.Value(0)).current;
  const shake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // PREMIUM.shake: tek geçiş base 300 · standard; ±8 → 0 (yerel süre yok).
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: PREMIUM.shake.duration,
      easing: RN_CURVE.standard,
      useNativeDriver: true,
    }).start();
  }, [anim]);
  const a = PREMIUM.shake.amplitude;
  const style = {
    transform: [
      {
        translateX: anim.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, a, -a, a * 0.6, 0],
        }),
      },
    ],
  };
  return { style, shake };
}

/** Form alanı hata metni — FinMoShake ile birlikte, alanın altında. */
export function FinFieldError({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  // PREMIUM.error: alanın altında fast 200 (opaklık + y 4→0).
  return (
    <FinErrorReveal>
      <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.danger, marginTop: 2 }}>
        {children}
      </Text>
    </FinErrorReveal>
  );
}

/** Bricolage büyük sayı/başlık. */
export function FinDisplay({
  children,
  size = 24,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTheme();
  return (
    <Text style={[{ fontFamily: heading, fontSize: size, color: t.color.ink }, style]}>{children}</Text>
  );
}
