// G15-S1 (Ek karar) — Final form ekranları (FinSignupAI 2./3. adım, FinSignupEat
// 2./3. adım, Giriş): tema bağlı zemin, geri oku (+ başlık), sağda "Atla" benzeri
// eylem, 2 parçalı ilerleme çubuğu, Bricolage başlık, alt birincil düğme, klavye
// kaçınma. SALT GÖRÜNÜM — mantık çağıran bileşende.

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SCREEN_KEYBOARD_BEHAVIOR } from '../../../core/design/keyboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '../../../core/design/components/AppText';
import { useOnb } from '../components/onbTheme';
import { OnbLead, OnbTitle } from '../components/pieces';

export function BackArrow({ onPress, label = 'Geri' }: { onPress: () => void; label?: string }) {
  const P = useOnb();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={styles.back}
    >
      <Svg width={24} height={24} viewBox="0 0 256 256">
        <Path
          fill={P.ink}
          d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"
        />
      </Svg>
    </Pressable>
  );
}

export function FormScreen({
  onBack,
  barTitle,
  topRight,
  progress,
  title,
  subtitle,
  footer,
  fixedFooter,
  scroll = true,
  children,
}: {
  onBack?: () => void;
  /** Geri okunun yanında küçük başlık (ör. "Teslimat adresi"). */
  barTitle?: string;
  topRight?: { label: string; onPress: () => void };
  /** İlerleme çubuğu: toplam parça + dolu parça sayısı. */
  progress?: { total: number; done: number };
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  /**
   * G17-S1 md.3: klavyeyle YÜKSELMEYEN alt alan (ör. Apple/Google). Sayfada sabit
   * durur; klavye açılınca altında kalır — klavye araç çubuğu gibi yapışmaz.
   * Klavyeden kaçınma yalnız üst çubuk + kaydırılabilir gövdeye uygulanır.
   */
  fixedFooter?: React.ReactNode;
  scroll?: boolean;
  children?: React.ReactNode;
}) {
  const P = useOnb();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  const content = (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: P.bg, paddingTop: insets.top }]}
      behavior={SCREEN_KEYBOARD_BEHAVIOR}
    >
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <View style={styles.bar}>
        {onBack ? <BackArrow onPress={onBack} /> : <View style={styles.back} />}
        {barTitle ? (
          <AppText textRole="body" style={{ color: P.ink, fontFamily: 'PlusJakartaSans_700Bold', flex: 1 }}>
            {barTitle}
          </AppText>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {topRight ? (
          <Pressable onPress={topRight.onPress} accessibilityRole="button" hitSlop={8} style={styles.topRight}>
            <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '600' }}>
              {topRight.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {progress ? (
        <View style={styles.progress} accessibilityElementsHidden>
          {Array.from({ length: progress.total }).map((_, i) => (
            <View
              key={i}
              style={[styles.seg, { backgroundColor: i < progress.done ? P.ink : P.track }]}
            />
          ))}
        </View>
      ) : null}
      <Body
        style={styles.body}
        {...(scroll
          ? { contentContainerStyle: { paddingHorizontal: 20, paddingBottom: 16 }, keyboardShouldPersistTaps: 'handled' as const, showsVerticalScrollIndicator: false }
          : {})}
      >
        <View style={scroll ? undefined : { flex: 1, paddingHorizontal: 20 }}>
          {title ? <OnbTitle style={{ marginTop: 14, fontSize: 28, lineHeight: 30 }}>{title}</OnbTitle> : null}
          {subtitle ? <OnbLead>{subtitle}</OnbLead> : null}
          {children}
        </View>
      </Body>
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
  if (!fixedFooter) return content;
  return (
    <View style={[styles.root, { backgroundColor: P.bg }]}>
      {content}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>{fixedFooter}</View>
    </View>
  );
}

/** Final metin alanı: etiket üstte, beyaz/yüzey kutu, odakta ink çerçeve, sağda isteğe bağlı durum. */
export function OnbField({
  label,
  hint,
  error,
  right,
  prefix,
  focusedOverride,
  style,
  ...input
}: {
  label?: string;
  hint?: string;
  error?: string;
  right?: React.ReactNode;
  prefix?: string;
  focusedOverride?: boolean;
  style?: object;
} & TextInputProps) {
  const P = useOnb();
  const [focus, setFocus] = React.useState(false);
  const on = focusedOverride ?? focus;
  return (
    <View style={[{ marginTop: 18 }, style]}>
      {label ? (
        <AppText textRole="helper" style={{ color: P.sec, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 6 }}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: P.isDark ? P.chip : '#FFFFFF',
            borderColor: error ? '#E5484D' : on ? P.ink : P.isDark ? P.chipEdge : P.line,
            borderWidth: on || error ? 1.5 : 1,
          },
        ]}
      >
        {prefix ? (
          <AppText textRole="body" style={{ color: P.sec, marginRight: 2 }}>
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          placeholderTextColor={P.sec}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[styles.input, { color: P.ink }]}
          {...input}
        />
        {right}
      </View>
      {error ? (
        <AppText textRole="helper" style={{ color: '#E5484D', marginTop: 6 }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText textRole="helper" style={{ color: P.sec, marginTop: 6 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', height: 48, paddingRight: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topRight: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginTop: 4 },
  seg: { flex: 1, height: 3, borderRadius: 2 },
  body: { flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
  field: { minHeight: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  input: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, paddingVertical: 12 },
});
