// G54-S1 md.1 — Satın alma başarılı → tebrik ekranı (T1 kayıt teklifi + ana paywall ortak; SubResult başarı hâli).
// Kayıt ekranlarının görsel dili: aynı degrade zemin (KBackdrop) + cam yüzey kart, kupa cam nesnesi kısa kutlama
// (yukarı süzülme + parlama; konfeti YOK), başlık "Hoş geldin, Kcalculate AI [Fresh/Balance]!", plana göre 2–3 satır
// GERÇEK hak listesi (günlük AI tarama sayısı app_settings'ten; Balance'ta Koç yalnız Koç açıksa; ücretli planda
// barkod/elle kayıt sınırsız — limits.ts kuralı), deneme varsa bitiş tarihi + iptal notu, lime "Başlayalım".
// Azaltılmış harekette kutlama yok (her şey ilk karede yerinde).
import React, { useEffect } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CURVE, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Check } from '../../../components/icons';
import { FONT, KBackdrop, KButton, KText as AppText, Rise } from '../../kayit/ui/parts';
import { K_MOTION, useK } from '../../kayit/ui/theme';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

const TROPHY = require('../../../../assets/glass/trophy.png');

/** Kutlama zamanlaması (ms) — yukarı süzülme + parlama; tek sahne, döngü yok. */
export const WELCOME_MOTION = { rise: 520, riseDy: 36, glowIn: 360, glowOut: 700 } as const;

export interface WelcomeRight {
  key: 'ai' | 'coach' | 'barcode';
  text: string;
}

/** Saf: plana göre hak satırları (2–3). `aiPerDay` null → sayı gizlenir (bilinmiyor). */
export function welcomeRights(i: { tier: 'fresh' | 'balance'; aiPerDay: number | null | undefined; coachOn: boolean }, t: (k: string, p?: Record<string, string | number>) => string): WelcomeRight[] {
  const rows: WelcomeRight[] = [{ key: 'ai', text: typeof i.aiPerDay === 'number' ? t('sub_welcome.ai_per_day', { n: i.aiPerDay }) : t('sub_welcome.ai_more') }];
  if (i.tier === 'balance' && i.coachOn) rows.push({ key: 'coach', text: t('sub_welcome.coach') });
  rows.push({ key: 'barcode', text: t('sub_welcome.barcode') });
  return rows;
}

export default function SubWelcome({
  tier,
  rights,
  trialUntil,
  renewsOn,
  note,
  extra,
  onStart,
  secondary,
  testID = 'sub-welcome',
}: {
  tier: 'fresh' | 'balance';
  rights: WelcomeRight[];
  /** Biçimlenmiş deneme bitiş tarihi (deneme varsa). */
  trialUntil?: string | null;
  /** Biçimlenmiş yenileme tarihi (deneme yoksa). */
  renewsOn?: string | null;
  /** Ek bilgi satırı (ör. sunucu doğrulaması bekleniyor). */
  note?: string | null;
  /** Kartın altına ek içerik (ör. "Kişisel planımı oluştur" satırı). */
  extra?: React.ReactNode;
  onStart: () => void;
  secondary?: { label: string; onPress: () => void } | null;
  testID?: string;
}) {
  const { t } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const plan = tier === 'balance' ? 'Balance' : 'Fresh';
  return (
    <View style={{ flex: 1 }} testID={testID}>
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <KBackdrop shift={31} />
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
        <TrophyCelebrate />
        <Rise delay={K_MOTION.stagger * 2}>
          <AppText testID={`${testID}-title`} accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.title, { color: P.ink }]}>
            {t('sub_welcome.title', { plan })}
          </AppText>
        </Rise>
        <Rise delay={K_MOTION.stagger * 3}>
          <View accessible accessibilityLabel={`${t('sub_welcome.rights_a11y')}: ${rights.map((r) => r.text).join(', ')}`} style={[styles.card, { backgroundColor: P.card, borderColor: P.cardEdge }]} testID={`${testID}-rights`}>
            {rights.map((r, i) => (
              <View key={r.key} testID={`${testID}-right-${r.key}`} style={[styles.row, i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.ringTrack } : null]}>
                <View style={[styles.dot, { backgroundColor: P.accent }]}>
                  <Check size={14} color={P.limeInk} weight="bold" />
                </View>
                <AppText maxFontSizeMultiplier={1.5} style={[styles.rowText, { color: P.ink }]}>
                  {r.text}
                </AppText>
              </View>
            ))}
          </View>
        </Rise>
        {trialUntil || renewsOn ? (
          <AppText testID={`${testID}-terms`} maxFontSizeMultiplier={1.5} style={[styles.terms, { color: P.sec }]}>
            {trialUntil ? t('sub_welcome.trial', { date: trialUntil }) : t('sub_welcome.renews', { date: renewsOn ?? '' })}
          </AppText>
        ) : null}
        {note ? (
          <AppText maxFontSizeMultiplier={1.5} style={[styles.terms, { color: P.sec, marginTop: 6 }]}>
            {note}
          </AppText>
        ) : null}
        {extra ? <View style={{ marginTop: 16 }}>{extra}</View> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 6 }}>
        <KButton testID={`${testID}-start`} label={t('sub_welcome.cta')} onPress={onStart} />
        {secondary ? <KButton testID={`${testID}-secondary`} variant="ghost" label={secondary.label} onPress={secondary.onPress} /> : null}
      </View>
    </View>
  );
}

/** Kupa: yukarı süzülme + bir kez parlama (hale büyür, söner). Azaltılmışta sabit, parlama yok. */
function TrophyCelebrate() {
  const { t } = useT();
  const P = useK();
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? 1 : 0);
  const glow = useSharedValue(reduced ? 0.22 : 0);
  useEffect(() => {
    if (reduced) return;
    v.value = withTiming(1, { duration: WELCOME_MOTION.rise, easing: CURVE.enter });
    glow.value = withDelay(WELCOME_MOTION.rise - 160, withSequence(withTiming(0.7, { duration: WELCOME_MOTION.glowIn }), withTiming(0.22, { duration: WELCOME_MOTION.glowOut })));
    // tek seferlik
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * WELCOME_MOTION.riseDy }] }));
  const gst = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.8 + glow.value * 0.45 }] }));
  return (
    <View style={styles.trophyBox} accessible accessibilityRole="image" accessibilityLabel={t('sub_welcome.trophy')} testID="sub-welcome-trophy">
      <Animated.View pointerEvents="none" style={[styles.glow, { backgroundColor: P.isDark ? 'rgba(185,239,20,0.55)' : 'rgba(185,239,20,0.75)' }, gst]} />
      <Animated.View style={st}>
        <Image source={TROPHY} style={styles.trophy} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 24, alignItems: 'stretch' },
  trophyBox: { alignSelf: 'center', width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 170, height: 170, borderRadius: 85 },
  trophy: { width: 172, height: 172 },
  title: { fontFamily: FONT.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, textAlign: 'center', marginTop: 8 },
  card: { marginTop: 22, borderRadius: 24, borderWidth: 1, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingVertical: 10 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontFamily: FONT.semi, fontSize: 16, lineHeight: 21 },
  terms: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 14, paddingHorizontal: 8 },
});
