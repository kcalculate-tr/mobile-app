// G24-S1 md.3 — FinCoachIntro: kcalAI Koç ilk açılış (bir kez). Ne yapar / ne yapmaz, erişim
// satırı (Balance günde N · Free/Fresh N deneme), "Başla" → sohbet (push; açılan parametreler
// — önceden doldurulmuş soru, bağlam — sohbete aynen geçer). Kapat → geri.
// Hareket: sayfa alttan (navigatör AI_MODAL); kase + alev 110 gecikmeyle 0.9 → 1 (azaltılmışta 220 opaklık).
// G33-S1 md.3 (Tur 26n "Koç tanıtımı"): sayfa tutamacı + küçük kapat; başlık 26, alt satır 15; "Ne yapar /
// Ne yapmaz" kartları küçük başlık (13) + 15 pt satırlar; erişim satırı ortada; "Başla" en altta (boşluk
// esner), altında "Koç tıbbi tavsiye vermez." Egzersiz satırı ve "Yakında" çipi YOK (G31).
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppText, DURATION, REDUCED, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Check, X } from '../../../components/icons';
import { useSubscriptionStore } from '../../../lib/subscription/purchases';
import { markIntroSeen } from '../access';
import { COACH_DAILY_FALLBACK, COACH_TRIAL_FALLBACK } from '../model';
import type { CoachChatParams } from '../types';
import { CoachGlass, Disclaimer, LIME, LIME_INK, useCoachTones } from '../ui/parts';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

type Nav = { goBack: () => void; replace?: (n: string, p?: object) => void; navigate: (n: string, p?: object) => void };

export default function CoachIntroScreen() {
  const nav = useNavigation() as unknown as Nav;
  const params = (useRoute().params ?? {}) as CoachChatParams;
  const { t: tr } = useT();
  const c = useCoachTones();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const limits = useSubscriptionStore((s) => s.limits);
  const daily = limits?.coach?.daily ?? COACH_DAILY_FALLBACK;
  const trial = limits?.coach?.trial ?? COACH_TRIAL_FALLBACK;

  const start = () => {
    haptic('light');
    void markIntroSeen();
    if (nav.replace) nav.replace('CoachChat', params);
    else nav.navigate('CoachChat', params);
  };

  return (
    <View style={[styles.fill, { backgroundColor: c.card }]} testID="coach-intro">
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={[styles.body, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.grabber, { backgroundColor: c.line2 }]} accessibilityElementsHidden importantForAccessibility="no" />
        <View style={styles.top}>
          <Pressable onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel={tr('coach.close')} style={styles.close} testID="coach-intro-close">
            <View style={[styles.closeDot, { backgroundColor: c.chip }]}>
              <X size={14} color={c.text} />
            </View>
          </Pressable>
        </View>
        <Animated.View entering={reduced ? FadeIn.duration(REDUCED.duration) : ZoomIn.delay(DURATION.instant).duration(DURATION.slow).springify().stiffness(260).damping(24)} style={styles.center}>
          <CoachGlass size={104} />
        </Animated.View>
        <AppText style={[styles.title, { color: c.text }]} accessibilityRole="header">
          {tr('coach.name')}
        </AppText>
        <AppText style={[styles.line, { color: c.sec }]}>{tr('coach.intro_line')}</AppText>

        <View style={[styles.group, { backgroundColor: c.nested }]}>
          <AppText style={[styles.groupH, { color: c.sec }]} accessibilityRole="header">
            {tr('coach.intro_do')}
          </AppText>
          {['coach.intro_do1', 'coach.intro_do2', 'coach.intro_do3'].map((k) => (
            <View key={k} style={styles.item} accessible accessibilityLabel={tr(k)}>
              <View style={[styles.mark, { backgroundColor: LIME }]}>
                <Check size={12} color={LIME_INK} weight="bold" />
              </View>
              <AppText style={[styles.itemText, { color: c.text }]}>{tr(k)}</AppText>
            </View>
          ))}
        </View>

        <View style={[styles.group, { backgroundColor: c.nested }]}>
          <AppText style={[styles.groupH, { color: c.sec }]} accessibilityRole="header">
            {tr('coach.intro_dont')}
          </AppText>
          {/* G31-S1 md.1: "Egzersiz programı yazmaz · Yakında" satırı kalktı. */}
          {(['coach.intro_dont1', 'coach.intro_dont3'] as const).map((k) => (
            <View key={k} style={styles.item} accessible accessibilityLabel={tr(k)}>
              <View style={[styles.mark, { borderWidth: 1.5, borderColor: c.line2 }]}>
                <X size={10} color={c.text} />
              </View>
              <AppText style={[styles.itemText, { color: c.text }]}>{tr(k)}</AppText>
            </View>
          ))}
        </View>

        <AppText style={[styles.access, { color: c.sec }]}>{tr('coach.intro_access', { daily, trial })}</AppText>
        <View style={styles.grow} />

        <Pressable onPress={start} accessibilityRole="button" style={[styles.cta, { backgroundColor: LIME }]} testID="coach-intro-start">
          <AppText style={styles.ctaText}>{tr('coach.intro_start')}</AppText>
        </Pressable>
        <Disclaimer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { flexGrow: 1, paddingHorizontal: 20, gap: 12 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginTop: -2 },
  top: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: -14, marginBottom: -18 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 26, lineHeight: 32, textAlign: 'center', marginTop: -4 },
  line: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: -6, paddingHorizontal: 12 },
  group: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  groupH: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  mark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '400' },
  access: { fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 18 },
  grow: { flexGrow: 1, minHeight: 16 },
  cta: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 17, fontWeight: '700', color: LIME_INK },
});
