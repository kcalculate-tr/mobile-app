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
  testID,
}: {
  label: string;
  onPress: () => void;
  kind?: OnbButtonKind;
  icon?: (color: string) => React.ReactNode;
  disabled?: boolean;
  style?: object;
  testID?: string;
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
      testID={testID}
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
  disabled = false,
}: {
  title: string;
  desc?: string;
  selected?: boolean;
  icon?: (color: string) => React.ReactNode;
  onPress: () => void;
  /** G33-S1: seçilemez seçenek (ör. BMI < 18,5'te "Kilo ver"); soluk + VoiceOver "devre dışı". */
  disabled?: boolean;
}) {
  const P = useOnb();
  const fg = selected ? P.onAccent : P.ink;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={desc ? `${title}. ${desc}` : title}
      style={[
        styles.option,
        selected
          ? { backgroundColor: P.accent, borderColor: 'transparent' }
          : { backgroundColor: P.chip, borderColor: P.chipEdge },
        disabled ? { opacity: 0.45 } : null,
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
          <AppleLogo color={fg} />
        ) : kind === 'google' ? (
          <GoogleLogo />
        ) : (
          <EnvelopeSimple size={22} color={P.ink} />
        )
      }
    />
  );
}

// G18-S5 md.7 (İlter kararı, G18-S1 SORULAR 2): RESMÎ "Sign in with Apple" / "Sign in with Google"
// işaretleri (Apple HIG + Google marka kuralları; App Review riski). Path'ler `4dceffb` sürümünden
// (SocialAuthButtons ile aynı). Kutu 22 pt = Final düğmedeki ikon alanı; düğme ölçü/yerleşimi Final.
// Apple'ın onaylı tek-renk logosu — düğme metin rengiyle.
export function AppleLogo({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.9-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"
      />
    </Svg>
  );
}

// Google'ın resmî 4 renkli "G" logosu (renkleri değiştirilmez).
export function GoogleLogo({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path fill="#4285F4" d="M17.64 9.20455c0-.63864-.05727-1.25182-.16363-1.84091H9v3.48181h4.84364c-.20864 1.125-.84273 2.07819-1.79637 2.71592v2.25878h2.90862c1.70274-1.56802 2.68407-3.87668 2.68407-6.5142z" />
      <Path fill="#34A853" d="M9 18c2.43 0 4.46727-.80591 5.95682-2.17545l-2.90862-2.25878c-.80591.54-1.83674.86182-3.0482.86182-2.34273 0-4.32819-1.58318-5.03728-3.71014H.95728v2.33182C2.43818 15.9825 5.48182 18 9 18z" />
      <Path fill="#FBBC05" d="M3.96273 10.71c-.18-.54-.28091-1.11682-.28091-1.71s.10091-1.17.28091-1.71V4.95818H.95728C.34773 6.17318 0 7.54773 0 9s.34773 2.82682.95727 4.04182L3.96273 10.71z" />
      <Path fill="#EA4335" d="M9 3.57955c1.32136 0 2.50727.45409 3.44045 1.34590l2.58136-2.58135C13.46318.891818 11.4245 0 9 0 5.48182 0 2.43818 2.0175.95727 4.95818l3.00546 2.33182C4.67182 5.16273 6.65727 3.57955 9 3.57955z" />
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
