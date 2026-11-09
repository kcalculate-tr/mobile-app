import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '../../../core/design/components/AppText';
import { haptic } from '../../../core/design/motion';
import { Check, EnvelopeSimple } from '../../../components/icons';
import { useOnb } from './onbTheme';

/** Final başlık: Bricolage 700 · 30/32. */
export function OnbTitle({ children, style }: { children: React.ReactNode; style?: object }) {
  const P = useOnb();
  return (
    <AppText style={[styles.title, { color: P.ink }, style]}>{children}</AppText>
  );
}

/** Final alt açıklama: ikincil renk · 15. */
export function OnbLead({ children, style }: { children: React.ReactNode; style?: object }) {
  const P = useOnb();
  return (
    <AppText textRole="bodySm" style={[styles.lead, { color: P.sec }, style]}>
      {children}
    </AppText>
  );
}

export type OnbButtonKind = 'ink' | 'lime' | 'chip';

/**
 * Onboarding düğmesi (pill, 52). `ink` = tema mürekkebi (Light'ta siyah, Dark'ta
 * beyaz), `lime` = lime dolgu + koyu metin, `chip` = yarı saydam çerçeveli.
 * `disabled` → Final'in pasif gri hali.
 */
export function OnbButton({
  label,
  onPress,
  kind = 'ink',
  icon,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: OnbButtonKind;
  icon?: (color: string) => React.ReactNode;
  disabled?: boolean;
  style?: object;
}) {
  const P = useOnb();
  const bg = disabled ? P.dis : kind === 'ink' ? P.ink : kind === 'lime' ? P.accent : P.chip;
  const fg = disabled ? P.disText : kind === 'ink' ? P.onInk : kind === 'lime' ? P.onAccent : P.ink;
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[
        styles.btn,
        { backgroundColor: bg },
        kind === 'chip' && !disabled ? { borderWidth: 1, borderColor: P.chipEdge } : null,
        style,
      ]}
    >
      {icon ? icon(fg) : null}
      <AppText textRole="body" style={[styles.btnLabel, { color: fg }]} numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Seçenek satırı (FinOnbIntent / FinTb*): seçiliyse lime dolgu + sağda tik,
 * değilse yarı saydam çip kartı. İsteğe bağlı baş ikon (Intent).
 */
export function OptionRow({
  title,
  desc,
  selected = false,
  icon,
  onPress,
}: {
  title: string;
  desc?: string;
  selected?: boolean;
  icon?: (color: string) => React.ReactNode;
  onPress: () => void;
}) {
  const P = useOnb();
  const fg = selected ? P.onAccent : P.ink;
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={desc ? `${title}. ${desc}` : title}
      style={[
        styles.option,
        selected
          ? { backgroundColor: P.accent, borderColor: 'transparent' }
          : { backgroundColor: P.chip, borderColor: P.chipEdge },
      ]}
    >
      {icon ? (
        <View style={[styles.optIcon, { backgroundColor: selected ? P.accentIcon : 'transparent' }]}>
          {icon(fg)}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText textRole="body" style={[styles.optTitle, { color: fg }]}>
          {title}
        </AppText>
        {desc ? (
          <AppText textRole="helper" style={{ color: selected ? P.accentSub : P.sec, marginTop: 2 }}>
            {desc}
          </AppText>
        ) : null}
      </View>
      {selected ? <Check size={20} color={P.onAccent} /> : null}
    </Pressable>
  );
}

/** Hesap adımı auth düğmesi (Apple siyah / Google·E-posta çerçeveli) — FinOnbAccount. */
export function AuthButton({
  label,
  kind,
  onPress,
  disabled = false,
}: {
  label: string;
  kind: 'apple' | 'google' | 'email';
  onPress: () => void;
  disabled?: boolean;
}) {
  const P = useOnb();
  return (
    <OnbButton
      label={label}
      kind={kind === 'apple' ? 'ink' : 'chip'}
      disabled={false}
      onPress={disabled ? () => {} : onPress}
      style={disabled ? { opacity: 0.5 } : undefined}
      icon={(fg) =>
        kind === 'apple' ? (
          <GlyphIcon d={APPLE_D} color={fg} />
        ) : kind === 'google' ? (
          <GlyphIcon d={GOOGLE_D} color={fg} />
        ) : (
          <EnvelopeSimple size={22} color={P.ink} />
        )
      }
    />
  );
}

// FinOnbAccount düğme ikonları — panodaki Phosphor "regular" glifleri (22 pt, metin rengi).
// Not (LOG › SORULAR 2): Apple/Google marka kuralları resmî işaret ister; pano bunu çiziyor.
const APPLE_D =
  'M223.3,169.59a8.07,8.07,0,0,0-2.8-3.4C203.53,154.53,200,134.64,200,120c0-17.67,13.47-33.06,21.5-40.67a8,8,0,0,0,0-11.62C208.82,55.74,187.82,48,168,48a72.2,72.2,0,0,0-40,12.13,71.56,71.56,0,0,0-90.71,9.09A74.63,74.63,0,0,0,16,123.4a127.06,127.06,0,0,0,40.14,89.73A39.8,39.8,0,0,0,83.59,224h87.68a39.84,39.84,0,0,0,29.12-12.57,125,125,0,0,0,17.82-24.6C225.23,174,224.33,172,223.3,169.59Zm-34.63,30.94a23.76,23.76,0,0,1-17.4,7.47H83.59a23.82,23.82,0,0,1-16.44-6.51A111.14,111.14,0,0,1,32,123,58.5,58.5,0,0,1,48.65,80.47,54.81,54.81,0,0,1,88,64h.78A55.45,55.45,0,0,1,123,76.28a8,8,0,0,0,10,0A55.44,55.44,0,0,1,168,64a70.64,70.64,0,0,1,36,10.35c-13,14.52-20,30.47-20,45.65,0,23.77,7.64,42.73,22.18,55.3A105.82,105.82,0,0,1,188.67,200.53ZM128.23,30A40,40,0,0,1,167,0h1a8,8,0,0,1,0,16h-1a24,24,0,0,0-23.24,18,8,8,0,1,1-15.5-4Z';
const GOOGLE_D = 'M224,128a96,96,0,1,1-21.95-61.09,8,8,0,1,1-12.33,10.18A80,80,0,1,0,207.6,136H128a8,8,0,0,1,0-16h88A8,8,0,0,1,224,128Z';

function GlyphIcon({ d, color, size = 22 }: { d: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Path fill={color} d={d} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Final FinOnb*/FinTb* h1: Bricolage 700 · 30 · satır 1.08; p: 15 · 1.4, başlıkla arası 14 − 4 = 10.
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, lineHeight: 32 },
  lead: { marginTop: 10, fontSize: 15, lineHeight: 21 },
  btn: {
    minHeight: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  btnLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, lineHeight: 20, textAlign: 'center' },
  option: {
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, lineHeight: 20 },
});
