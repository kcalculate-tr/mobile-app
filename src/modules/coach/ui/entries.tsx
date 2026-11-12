// G24-S1 md.3 — kcalAI Koç girişleri. Hepsi `useCoachEnabled()` (bayrak `koc` + coach-chat var)
// false iken null döner (gizli). Soru önceden doldurulmuş açılır (gönderilmez).
//  • CoachHomeCard (FinHomeR3): gün alanından sonra, topluluk akışından önce; bir öneri satırı.
//  • CoachScanButton (FinPhotoR1): Tara sonucunda sessiz çerçeveli "Koça sor" (asla lime değil).
//  • CoachProfileRow (FinPrProfile): Profil › kcalAI'da "AI Koç" satırı + Balance rozeti.
//  • CoachRecipeButton (FinRecipe): "Bu tarif bana uyar mı?".
import React, { useContext } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as RNav from '@react-navigation/native';
import { AppText, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CaretRight, ChatCircleDots } from '../../../components/icons';
import { useTier } from '../../../lib/subscription/purchases';
import { useSubscriptionStore } from '../../../lib/subscription/purchases';
import { useCoachEnabled } from '../access';
import { openCoach } from '../actions';
import { COACH_TRIAL_FALLBACK, homeLine } from '../model';
import type { CoachRef } from '../types';
import { BOWL, LIME, LIME_INK, useCoachTones } from './parts';

type Nav = { navigate: (n: string, p?: object) => void };

/** Navigatör dışında (izole bileşen testi) atmayan gezinme: yoksa no-op. */
const NavCtx = (RNav as { NavigationContext?: React.Context<unknown> }).NavigationContext ?? React.createContext<unknown>(undefined);
function useNavSafe(): Nav {
  const nav = useContext(NavCtx) as Nav | undefined;
  return nav ?? { navigate: () => {} };
}

export function CoachHomeCard(props: { consumedKcal: number | null; targetKcal: number | null; proteinLeft: number | null }) {
  const enabled = useCoachEnabled();
  return enabled ? <CoachHomeCardInner {...props} /> : null;
}

function CoachHomeCardInner({ consumedKcal, targetKcal, proteinLeft }: { consumedKcal: number | null; targetKcal: number | null; proteinLeft: number | null }) {
  const nav = useNavSafe();
  const { t: tr } = useT();
  const c = useCoachTones();
  const { tier } = useTier();
  const trial = useSubscriptionStore((s) => s.limits?.coach?.trial) ?? COACH_TRIAL_FALLBACK;
  const { line, question } = homeLine(consumedKcal, targetKcal, proteinLeft, tr);
  return (
    <View style={[styles.home, { backgroundColor: c.card, borderColor: c.line }]} accessibilityLabel={tr('coach.name')} testID="coach-home-card">
      <View style={styles.homeTop}>
        <Image source={BOWL} style={styles.homeBowl} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
        <View style={styles.flex1}>
          <AppText style={[styles.homeName, { color: c.sec }]}>{tr('coach.name')}</AppText>
          <AppText style={[styles.homeLine, { color: c.text }]}>{line}</AppText>
        </View>
      </View>
      <View style={styles.homeBottom}>
        {tier !== 'balance' ? <AppText style={[styles.homeTrial, { color: c.sec }]}>{tr('coach.home_trial', { n: trial })}</AppText> : null}
        <Pressable
          onPress={() => {
            haptic('light');
            void openCoach(nav, { from: 'home', prefill: question });
          }}
          accessibilityRole="button"
          accessibilityLabel={tr('coach.home_a11y', { line })}
          style={[styles.homeBtn, { backgroundColor: c.text }]}
          testID="coach-home-open"
        >
          <AppText style={[styles.homeBtnText, { color: c.bg }]}>{tr('coach.home_cta')}</AppText>
          <CaretRight size={16} color={c.bg} />
        </Pressable>
      </View>
    </View>
  );
}

export function CoachScanButton(props: { meal: { name: string; kcal: number; protein: number; carbs: number; fat: number }; compact?: boolean }) {
  const enabled = useCoachEnabled();
  return enabled ? <CoachScanButtonInner {...props} /> : null;
}

function CoachScanButtonInner({ meal, compact }: { meal: { name: string; kcal: number; protein: number; carbs: number; fat: number }; compact?: boolean }) {
  const nav = useNavSafe();
  const { t: tr } = useT();
  const c = useCoachTones();
  const ref: CoachRef = { type: 'scan', name: meal.name, kcal: Math.round(meal.kcal), protein: Math.round(meal.protein), carbs: Math.round(meal.carbs), fat: Math.round(meal.fat) };
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        void openCoach(nav, { from: 'scan', prefill: tr('coach.scan_q', { name: meal.name, kcal: Math.round(meal.kcal) }), ref });
      }}
      accessibilityRole="button"
      accessibilityLabel={tr('coach.scan_a11y')}
      style={[compact ? styles.scanCompact : styles.scan, { borderColor: c.line2, backgroundColor: compact ? c.card : 'transparent' }]}
      testID="coach-scan-open"
    >
      <Image source={BOWL} style={styles.scanBowl} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
      <AppText style={[styles.scanText, { color: c.text }]}>{tr('coach.scan_cta')}</AppText>
    </Pressable>
  );
}

export function CoachProfileRow(props: { first?: boolean }) {
  const enabled = useCoachEnabled();
  return enabled ? <CoachProfileRowInner {...props} /> : null;
}

function CoachProfileRowInner({ first }: { first?: boolean }) {
  const nav = useNavSafe();
  const { t: tr } = useT();
  const c = useCoachTones();
  return (
    <Pressable
      onPress={() => void openCoach(nav, { from: 'profile' })}
      accessibilityRole="button"
      accessibilityLabel={tr('coach.profile_a11y')}
      style={[styles.prow, first ? null : { borderTopWidth: 1, borderTopColor: c.line }]}
      testID="coach-profile-row"
    >
      <View style={[styles.picon, { backgroundColor: c.nested }]}>
        <ChatCircleDots size={18} color={c.text} />
      </View>
      <View style={styles.flex1}>
        <AppText style={[styles.ptitle, { color: c.text }]}>{tr('coach.profile_row')}</AppText>
        <AppText style={[styles.psub, { color: c.sec }]}>{tr('coach.profile_sub')}</AppText>
      </View>
      <View style={styles.badge}>
        <AppText style={styles.badgeText}>Balance</AppText>
      </View>
      <CaretRight size={16} color={c.sec} />
    </Pressable>
  );
}

export function CoachRecipeButton(props: { postId: string; name: string }) {
  const enabled = useCoachEnabled();
  return enabled ? <CoachRecipeButtonInner {...props} /> : null;
}

function CoachRecipeButtonInner({ postId, name }: { postId: string; name: string }) {
  const nav = useNavSafe();
  const { t: tr } = useT();
  const c = useCoachTones();
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        void openCoach(nav, { from: 'recipe', prefill: tr('coach.recipe_q', { name }), ref: { type: 'recipe', post_id: postId } });
      }}
      accessibilityRole="button"
      accessibilityLabel={tr('coach.recipe_fit_a11y')}
      style={[styles.recipe, { borderTopColor: c.line }]}
      testID="coach-recipe-fit"
    >
      <Image source={BOWL} style={styles.scanBowl} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
      <AppText style={[styles.recipeText, { color: c.text }]}>{tr('coach.recipe_fit')}</AppText>
      <CaretRight size={16} color={c.sec} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  home: { marginTop: 24, marginHorizontal: 16, padding: 16, borderRadius: 20, borderWidth: 1, gap: 12 },
  homeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  homeBowl: { width: 44, height: 44 },
  homeName: { fontSize: 13, fontWeight: '600' },
  homeLine: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  homeBottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  homeTrial: { fontSize: 13 },
  homeBtn: { marginLeft: 'auto', minHeight: 44, borderRadius: 22, paddingLeft: 16, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  homeBtnText: { fontSize: 14, fontWeight: '600' },
  scan: { minHeight: 48, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  scanCompact: { minHeight: 44, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 14 },
  scanBowl: { width: 24, height: 24 },
  scanText: { fontSize: 14, fontWeight: '600' },
  prow: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 12 },
  picon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ptitle: { fontSize: 15, fontWeight: '500' },
  psub: { fontSize: 13 },
  badge: { backgroundColor: LIME, borderRadius: 12, paddingHorizontal: 10, minHeight: 24, justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '700', color: LIME_INK },
  recipe: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  recipeText: { flex: 1, fontSize: 15, fontWeight: '600' },
});
