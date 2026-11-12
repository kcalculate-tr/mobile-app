// G34-S1 md.3 · Tur 26o — Kişisel planım (03 panosu; 05 FinPlanMine). Özet: hedef, kalori ve
// makrolar, hedef tarihi eğrisi + haftalık tartı, cevaplar; "Düzenle" (Tek ekranda düzenle),
// "Koçla planımı düzenle" (Balance; değilse Balance paywall), Öğün planı / Alışveriş listesi
// (G33 `ogun_plani` bayrağı), "Nasıl hesapladık?". Akış bitince burada açılır.
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../core/design/components/AppText';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { useT } from '../../../core/i18n';
import { useFeature } from '../../../core/flags';
import { CaretRight, PencilSimple } from '../../../components/icons';
import { useTier } from '../../../lib/subscription/purchases';
import type { RootStackParamList } from '../../../navigation/types';
import { hasCoachConsent } from '../../coach/access';
import { isoDay, weekIndex } from '../calc';
import { fmtDate, fmtKg, fmtPace, type Lang } from '../format';
import { effectiveTargets } from '../types';
import { nextWeighDay, useMyPlan } from '../useMyPlan';
import { GLASS, PpBackdrop, PpButton, ScreenHeader, TargetCurve, usePp } from '../ui/parts';
import { HowCalc, KcalCard } from './flow/result';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalPlanMine'>;

export default function MyPlanScreen({ navigation, route }: Props) {
  const i18n = useT();
  const lang: Lang = i18n.lang === 'en' ? 'en' : 'tr';
  const P = usePp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { tier } = useTier();
  const planOn = useFeature('ogun_plani');
  const kocOn = useFeature('koc');
  const { saved, loaded } = useMyPlan();
  const today = isoDay(new Date());

  if (!saved) {
    return (
      <View style={{ flex: 1 }}>
        <PpBackdrop />
        <ScreenHeader title={i18n.t('pp.mine_title')} onBack={() => navigation.goBack()} />
        {loaded ? (
          <View style={styles.empty}>
            <Image source={GLASS.trophy} style={{ width: 110, height: 96 }} resizeMode="contain" />
            <AppText textRole="bodySm" style={{ color: P.sec, textAlign: 'center', marginVertical: 12 }}>
              {i18n.t('pp.mine_empty')}
            </AppText>
            <PpButton label={i18n.t('pp.mine_create')} onPress={() => navigation.replace('PersonalPlan', { origin: 'mine' })} testID="pp-mine-create" />
          </View>
        ) : null}
      </View>
    );
  }

  const a = saved.answers;
  const t = effectiveTargets(saved);
  const goal = a.goal ?? 'maintain';
  const hasTarget = (goal === 'lose' || goal === 'gain') && a.targetWeightKg != null;
  const weeksTotal = saved.result.weeks ?? null;
  const wk = saved.startedAt ? weekIndex(saved.startedAt, today) : 1;
  const nextWeigh = nextWeighDay(today, a.reminders.weighDay);
  const goalLine =
    goal === 'lose' || goal === 'gain'
      ? i18n.t(goal === 'lose' ? 'pp.result_sub_lose' : 'pp.result_sub_gain', { from: fmtKg(saved.startWeightKg, lang), to: fmtKg(a.targetWeightKg ?? 0, lang) }).split(': ')[1] ?? ''
      : '';
  const pace = saved.custom && hasTarget ? null : saved.result.effectivePace;

  const coachEdit = async () => {
    if (tier !== 'balance') {
      navigation.navigate('PlanPaywall', { from: 'personal_plan_coach', plan: 'balance' });
      return;
    }
    // Profil Koç'la YALNIZ AI izni varsa paylaşılır; yoksa yalnız genel istek (sayısız), izin Koç'ta sorulur.
    const consent = await hasCoachConsent();
    const prefill = consent
      ? i18n.t('pp.mine_coach_prompt', {
          goal: i18n.t(`pp.goal_${goal}`),
          kcal: t.calories,
          p: t.protein,
          c: t.carbs,
          f: t.fat,
          pace: fmtPace(a.pace, lang),
          meals: i18n.t('pp.mine_meals_v', { main: a.meals.main, snack: a.meals.snack }),
          diet: i18n.t(`pp.diet_${a.diet}`),
        })
      : i18n.t('pp.mine_coach');
    navigation.navigate('CoachChat', { from: 'profile', prefill });
  };

  const Line = ({ label, value }: { label: string; value: string }) => (
    <View style={[styles.line, { borderBottomColor: P.line }]} accessible accessibilityLabel={`${label}, ${value}`}>
      <AppText textRole="bodySm" style={{ color: P.sec, flex: 1 }}>
        {label}
      </AppText>
      <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '600' }}>
        {value}
      </AppText>
    </View>
  );

  const Nav = ({ label, sub, onPress, testID, glass }: { label: string; sub?: string; onPress: () => void; testID?: string; glass?: keyof typeof GLASS }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={sub ? `${label}. ${sub}` : label} style={[styles.nav, { borderBottomColor: P.line }]} testID={testID}>
      {glass ? <Image source={GLASS[glass]} style={{ width: 26, height: 22 }} resizeMode="contain" /> : null}
      <View style={{ flex: 1 }}>
        <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '600' }}>
          {label}
        </AppText>
        {sub ? (
          <AppText textRole="helper" style={{ color: P.sec }}>
            {sub}
          </AppText>
        ) : null}
      </View>
      <CaretRight size={16} color={P.sec} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }} testID="pp-mine">
      <PpBackdrop glow={false} />
      <ScreenHeader title={i18n.t('pp.mine_title')} onBack={() => navigation.goBack()} />
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 12 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          <Image source={GLASS.trophy} style={{ width: 40, height: 36 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <AppText textRole="helper" style={{ color: P.sec }}>
              {i18n.t('pp.mine_goal')}
            </AppText>
            <AppText textRole="section" style={{ color: P.ink }}>
              {i18n.t(`pp.goal_${goal}`)}
            </AppText>
            {goalLine ? (
              <AppText textRole="helper" style={{ color: P.sec }}>
                {goalLine}
              </AppText>
            ) : null}
          </View>
        </View>
        <KcalCard calories={t.calories} protein={t.protein} carbs={t.carbs} fat={t.fat} animate={!!route.params?.fresh} />
        {hasTarget && saved.targetDate ? (
          <View style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
              <View style={{ flex: 1 }}>
                <AppText textRole="helper" style={{ color: P.sec }}>
                  {i18n.t('pp.target_date_label')}
                </AppText>
                <AppText textRole="section" style={{ color: P.ink }} testID="pp-mine-date">
                  {fmtDate(saved.targetDate, lang)}
                </AppText>
              </View>
              {weeksTotal ? (
                <View style={[styles.badge, { backgroundColor: P.field }]}>
                  <AppText textRole="helper" style={{ color: P.ink }}>
                    {i18n.t('pp.mine_week', { n: Math.min(wk, weeksTotal), total: weeksTotal })}
                  </AppText>
                </View>
              ) : null}
            </View>
            <TargetCurve
              width={width - 32 - 32}
              dashed
              fromKg={a.weightKg ?? saved.startWeightKg}
              toKg={a.targetWeightKg ?? 0}
              topLabel={`${i18n.t('pp.mine_now')} ${fmtKg(a.weightKg ?? saved.startWeightKg, lang)} ${i18n.t('pp.kg')}`}
              endLabel={`${i18n.t('pp.goal_label')} ${fmtKg(a.targetWeightKg ?? 0, lang)} ${i18n.t('pp.kg')}`}
              leftLabel={fmtDate(saved.startedAt, lang)}
              rightLabel={fmtDate(saved.targetDate, lang)}
              a11y={`${i18n.t('pp.target_date_label')} ${fmtDate(saved.targetDate, lang)}`}
            />
            <Nav label={i18n.t('pp.mine_weigh')} sub={i18n.t('pp.mine_weigh_next', { date: `${fmtDate(nextWeigh, lang)} ${i18n.t(`pp.wd_long_${a.reminders.weighDay}`)}` })} onPress={() => navigation.navigate('PersonalPlanCheckin')} testID="pp-mine-checkin" />
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge, paddingVertical: 4 }]}>
            <Nav label={i18n.t('pp.mine_weigh')} sub={i18n.t('pp.mine_weigh_next', { date: `${fmtDate(nextWeigh, lang)} ${i18n.t(`pp.wd_long_${a.reminders.weighDay}`)}` })} onPress={() => navigation.navigate('PersonalPlanCheckin')} testID="pp-mine-checkin" />
          </View>
        )}
        <View style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge, paddingVertical: 4 }]}>
          <Line label={i18n.t('pp.mine_activity')} value={a.activity ? i18n.t(`pp.act_${a.activity}`) : '–'} />
          <Line label={i18n.t('pp.mine_exercise')} value={a.exercise.includes('none') || !a.exercise.length ? i18n.t('pp.ex_none') : i18n.t('pp.mine_exercise_v', { n: a.exerciseDays })} />
          <Line label={i18n.t('pp.mine_diet')} value={i18n.t(`pp.diet_${a.diet}`)} />
          <Line label={i18n.t('pp.mine_meals')} value={i18n.t('pp.mine_meals_v', { main: a.meals.main, snack: a.meals.snack })} />
          {hasTarget && pace != null ? <Line label={i18n.t('pp.mine_pace')} value={i18n.t('pp.mine_pace_v', { pace: fmtPace(pace, lang) })} /> : null}
        </View>
        <Pressable onPress={() => navigation.navigate('PersonalPlanEdit')} accessibilityRole="button" accessibilityLabel={i18n.t('pp.edit')} style={[styles.editBtn, { backgroundColor: P.ink }]} testID="pp-mine-edit">
          <PencilSimple size={16} color={P.onInk} />
          <AppText textRole="body" style={{ color: P.onInk, fontWeight: '700' }}>
            {i18n.t('pp.edit')}
          </AppText>
        </Pressable>
        <View style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge, paddingVertical: 4 }]}>
          {kocOn ? <Nav glass="trophy" label={i18n.t('pp.mine_coach')} sub={i18n.t('pp.mine_coach_sub')} onPress={() => void coachEdit()} testID="pp-mine-coach" /> : null}
          {planOn ? <Nav label={i18n.t('pp.mine_meal_plan')} onPress={() => navigation.navigate('MealPlan', { from: 'personal_plan' } as never)} testID="pp-mine-mealplan" /> : null}
          {planOn ? (
            <Nav
              label={i18n.t('pp.mine_shopping')}
              onPress={() => (tier === 'free' ? navigation.navigate('PlanPaywall', { from: 'personal_plan_shopping' }) : navigation.navigate('ShoppingList', undefined as never))}
              testID="pp-mine-shopping"
            />
          ) : null}
        </View>
        <HowCalc result={saved.result} answers={{ ...a, weightKg: saved.startWeightKg, consentHealth: true, consentAllergy: false }} startIso={saved.startedAt || today} testID="pp-mine-how" />
        <AppText textRole="helper" style={{ color: P.sec, textAlign: 'center', marginTop: 4 }}>
          {i18n.t('pp.brand_line')}
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  line: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  editBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 26 },
});
