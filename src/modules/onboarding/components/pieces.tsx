import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '../../../core/design/components/AppText';
import { haptic } from '../../../core/design/motion';

/** Onboarding koyu paleti — bu modül daima koyu zeminde çalışır. */
export const ONB = {
  ink: '#F5F5F5',
  sub: 'rgba(245,245,245,0.72)',
  glass: 'rgba(255,255,255,0.08)',
  glassEdge: 'rgba(255,255,255,0.14)',
  glassSel: 'rgba(198,240,79,0.14)',
  accent: '#C6F04F',
  onAccent: '#0A0A0A',
} as const;

/** Cam seçenek kartı (FinOnbIntent): başlık + açıklama, dokunma ≥44. */
export function GlassOption({
  title,
  desc,
  selected = false,
  onPress,
}: {
  title: string;
  desc: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${desc}`}
      style={[
        styles.option,
        { backgroundColor: selected ? ONB.glassSel : ONB.glass, borderColor: selected ? ONB.accent : ONB.glassEdge },
      ]}
    >
      <AppText textRole="section" style={{ color: ONB.ink, marginBottom: 4 }}>
        {title}
      </AppText>
      <AppText textRole="bodySm" style={{ color: ONB.sub }}>
        {desc}
      </AppText>
    </Pressable>
  );
}

/** Hesap adımı auth butonu (Apple/Google/E-posta) — FinOnbAccount. */
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
  const light = kind !== 'email';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[
        styles.authBtn,
        light
          ? { backgroundColor: '#FFFFFF' }
          : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: ONB.glassEdge },
        disabled ? { opacity: 0.5 } : null,
      ]}
    >
      {kind === 'apple' ? <AppleLogo /> : kind === 'google' ? <GoogleLogo /> : null}
      <AppText textRole="body" style={[styles.authLabel, { color: light ? '#000000' : ONB.ink }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

// Apple'ın onaylı tek-renk logosu (SocialAuthButtons ile aynı path).
function AppleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#000000"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.9-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"
      />
    </Svg>
  );
}

// Google'ın resmi 4 renkli "G" logosu (SocialAuthButtons ile aynı path).
function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path fill="#4285F4" d="M17.64 9.20455c0-.63864-.05727-1.25182-.16363-1.84091H9v3.48181h4.84364c-.20864 1.125-.84273 2.07819-1.79637 2.71592v2.25878h2.90862c1.70274-1.56802 2.68407-3.87668 2.68407-6.5142z" />
      <Path fill="#34A853" d="M9 18c2.43 0 4.46727-.80591 5.95682-2.17545l-2.90862-2.25878c-.80591.54-1.83674.86182-3.0482.86182-2.34273 0-4.32819-1.58318-5.03728-3.71014H.95728v2.33182C2.43818 15.9825 5.48182 18 9 18z" />
      <Path fill="#FBBC05" d="M3.96273 10.71c-.18-.54-.28091-1.11682-.28091-1.71s.10091-1.17.28091-1.71V4.95818H.95728C.34773 6.17318 0 7.54773 0 9s.34773 2.82682.95727 4.04182L3.96273 10.71z" />
      <Path fill="#EA4335" d="M9 3.57955c1.32136 0 2.50727.45409 3.44045 1.34590l2.58136-2.58135C13.46318.891818 11.4245 0 9 0 5.48182 0 2.43818 2.0175.95727 4.95818l3.00546 2.33182C4.67182 5.16273 6.65727 3.57955 9 3.57955z" />
    </Svg>
  );
}

/** Birincil lime buton (onboarding). */
export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.authBtn, { backgroundColor: ONB.accent }]}
    >
      <AppText textRole="body" style={[styles.authLabel, { color: ONB.onAccent }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** İkincil (çizgisiz) metin buton. */
export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.ghost}
    >
      <AppText textRole="body" style={{ color: ONB.ink }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  authBtn: {
    minHeight: 52,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  authLabel: { fontWeight: '600' },
  // G14-S1 — Final ikincil düğme: dolu koyu hap (çerçevesiz düz metin değil).
  ghost: {
    minHeight: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
});
