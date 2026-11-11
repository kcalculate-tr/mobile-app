// G34-S1 md.3 · Tur 26o — Tek ekranda düzenle (03 panosu; 05 FinPlanMineEdit). Bütün cevaplar tek
// listede; "Hedefi yeniden hesapla" → eski ve yeni değerler YAN YANA (kaydetmeden önce) →
// Kaydet / Eski planımı koru. Güvenlik kuralları aynı (VKİ, %1, taban, 18 yaş).
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../core/design/components/AppText';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { Sheet } from '../../../core/design/components/Sheet';
import { Toast } from '../../../core/design/components/Toast';
import { haptic } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import type { RootStackParamList } from '../../../navigation/types';
import {
  canOfferLose,
  clampPace,
  computePlan,
  isMinor,
  isoDay,
  maxWeeklyKg,
  paceAllowed,
  paceOptions,
  suggestTarget,
  targetRange,
  type PpActivity,
  type PpGender,
  type PpGoal,
  type PpResult,
} from '../calc';
import { fmtDate, fmtKg, fmtPace, type Lang } from '../format';
import { effectiveTargets, PP_DIETS, type PpSaved } from '../types';
import { useMyPlan } from '../useMyPlan';
import { syncPlanReminders } from '../reminders';
import { Chip, Note, Panel, PpBackdrop, PpButton, Row, ScreenHeader, Stepper, usePp } from '../ui/parts';
import { inputFrom } from './flow/result';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalPlanEdit'>;

const YEAR = () => new Date().getFullYear();

export default function MyPlanEditScreen({ navigation }: Props) {
  const i18n = useT();
  const lang: Lang = i18n.lang === 'en' ? 'en' : 'tr';
  const P = usePp();
  const insets = useSafeAreaInsets();
  const { uid, saved, save } = useMyPlan();
  const [a, setA] = useState(() => (saved ? { ...saved.answers, weightKg: saved.answers.weightKg ?? saved.startWeightKg } : null));
  const [compare, setCompare] = useState<PpResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: 'default' | 'error' } | null>(null);
  const today = isoDay(new Date());

  const upd = (patch: Partial<NonNullable<typeof a>>) => setA((prev) => (prev ? { ...prev, ...patch } : prev));
  const minor = a ? isMinor(a.birthYear, YEAR()) : false;
  const next = useMemo(() => {
    if (!a) return null;
    const inp = inputFrom({ ...a, consentHealth: true, consentAllergy: false });
    return inp ? computePlan(inp, YEAR(), today) : null;
  }, [a, today]);

  if (!saved || !a) {
    return (
      <View style={{ flex: 1 }}>
        <PpBackdrop glow={false} />
        <ScreenHeader title={i18n.t('pp.medit_title')} onBack={() => navigation.goBack()} />
      </View>
    );
  }

  const goal = a.goal ?? 'maintain';
  const w = a.weightKg ?? 70;
  const h = a.heightCm ?? 168;
  const loseOk = canOfferLose(w, h);
  const rg = targetRange(goal, w, h);
  const old = effectiveTargets(saved);
  const offPace = paceOptions(goal).find((p) => !paceAllowed(goal, p, w));

  const setGoal = (g: PpGoal) => {
    const patch: Partial<typeof a> = { goal: g };
    if ((g === 'lose' || g === 'gain') && (a.targetWeightKg == null || (g === 'lose' ? a.targetWeightKg >= w : a.targetWeightKg <= w))) patch.targetWeightKg = suggestTarget(g, w, h);
    if (g === 'lose' || g === 'gain') patch.pace = clampPace(g, a.pace, w);
    upd(patch);
  };

  const doSave = async () => {
    if (!next || !uid) return;
    setBusy(true);
    const p: PpSaved = {
      ...saved,
      answers: a,
      result: next,
      custom: null,
      startWeightKg: a.weightKg ?? saved.startWeightKg,
      startedAt: today,
      targetDate: next.targetDate,
      updatedAt: new Date().toISOString(),
    };
    const r = await save(uid, p);
    setBusy(false);
    if (!r.ok) {
      setToast({ msg: i18n.t('pp.medit_failed'), tone: 'error' });
      return;
    }
    void syncPlanReminders(a.meals, a.reminders, lang);
    haptic('success');
    setCompare(null);
    navigation.goBack();
  };

  const CompareRow = ({ label, o, n }: { label: string; o: string; n: string }) => (
    <View style={[styles.cmpRow, { borderBottomColor: P.line }]} accessible accessibilityLabel={`${label}: ${i18n.t('pp.medit_old')} ${o}, ${i18n.t('pp.medit_new')} ${n}`}>
      <AppText textRole="helper" style={{ color: P.sec, flex: 1.2 }}>
        {label}
      </AppText>
      <AppText textRole="bodySm" style={{ color: P.sec, flex: 1, textAlign: 'right', textDecorationLine: o !== n ? 'line-through' : 'none' }}>
        {o}
      </AppText>
      <AppText textRole="bodySm" style={{ color: P.ink, flex: 1, textAlign: 'right', fontWeight: '700' }}>
        {n}
      </AppText>
    </View>
  );

  return (
    <View style={{ flex: 1 }} testID="pp-edit-screen">
      <PpBackdrop glow={false} />
      <ScreenHeader title={i18n.t('pp.medit_title')} onBack={() => navigation.goBack()} />
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Panel style={{ backgroundColor: P.surface }}>
          <AppText textRole="bodySm" style={[styles.h, { color: P.ink }]} accessibilityRole="header">
            {i18n.t('pp.known_goal')}
          </AppText>
          <View style={styles.wrap}>
            {(['lose', 'maintain', 'gain', 'balanced'] as PpGoal[]).map((g) =>
              g === 'lose' && !loseOk ? null : <Chip key={g} label={i18n.t(`pp.goal_${g}`)} selected={goal === g} onPress={() => setGoal(g)} />,
            )}
          </View>
          {!loseOk ? <Note text={i18n.t('pp.lowbmi_note', { bmi: fmtKg((w / ((h / 100) * (h / 100))), lang) })} /> : null}
        </Panel>
        <Panel style={{ backgroundColor: P.surface }}>
          <AppText textRole="bodySm" style={[styles.h, { color: P.ink }]} accessibilityRole="header">
            {i18n.t('pp.medit_you')}
          </AppText>
          <AppText textRole="helper" style={{ color: P.sec, marginBottom: 6 }}>
            {i18n.t('pp.known_gender')}
          </AppText>
          <View style={styles.wrap}>
            {(['female', 'male', 'unspecified'] as PpGender[]).map((g) => (
              <Chip key={g} label={i18n.t(`pp.gender_${g}`)} selected={a.gender === g} onPress={() => upd({ gender: g })} />
            ))}
          </View>
          <Row label={i18n.t('pp.birth_label')}>
            <Stepper label={i18n.t('pp.birth_label')} value={a.birthYear ?? YEAR() - 30} min={YEAR() - 90} max={YEAR() - 13} onChange={(v) => upd({ birthYear: v })} />
          </Row>
          <Row label={i18n.t('pp.height_label')}>
            <Stepper label={i18n.t('pp.height_label')} value={h} display={`${h} ${i18n.t('pp.cm')}`} min={120} max={220} onChange={(v) => upd({ heightCm: v })} />
          </Row>
          <Row label={i18n.t('pp.weight_label')} last>
            <Stepper label={i18n.t('pp.weight_label')} value={w} display={`${fmtKg(w, lang)} ${i18n.t('pp.kg')}`} min={35} max={200} step={0.5} onChange={(v) => upd({ weightKg: v, pace: clampPace(goal, a.pace, v) })} />
          </Row>
          {minor ? <Note tone="warn" text={i18n.t('pp.minor_title')} /> : null}
        </Panel>
        {goal === 'lose' || goal === 'gain' ? (
          <Panel style={{ backgroundColor: P.surface }}>
            <AppText textRole="bodySm" style={[styles.h, { color: P.ink }]} accessibilityRole="header">
              {i18n.t('pp.medit_target')}
            </AppText>
            <Row label={i18n.t('pp.medit_target_kg')}>
              <Stepper
                label={i18n.t('pp.medit_target_kg')}
                value={Math.min(rg.max, Math.max(rg.min, a.targetWeightKg ?? rg.max))}
                display={`${fmtKg(Math.min(rg.max, Math.max(rg.min, a.targetWeightKg ?? rg.max)), lang)} ${i18n.t('pp.kg')}`}
                min={rg.min}
                max={rg.max}
                step={0.5}
                onChange={(v) => upd({ targetWeightKg: v })}
              />
            </Row>
            <AppText textRole="helper" style={{ color: P.sec, marginVertical: 6 }}>
              {i18n.t('pp.medit_pace')}
            </AppText>
            <View style={styles.wrap}>
              {paceOptions(goal).map((p) => (
                <Chip key={p} label={i18n.t('pp.pace_opt', { kg: fmtPace(p, lang) })} selected={a.pace === p && paceAllowed(goal, p, w)} disabled={!paceAllowed(goal, p, w)} onPress={() => upd({ pace: p })} />
              ))}
            </View>
            {offPace ? <Note text={i18n.t('pp.pace_off_note', { pace: fmtPace(offPace, lang), kg: fmtKg(w, lang), max: fmtPace(maxWeeklyKg(w), lang) })} /> : null}
          </Panel>
        ) : null}
        <Panel style={{ backgroundColor: P.surface }}>
          <AppText textRole="bodySm" style={[styles.h, { color: P.ink }]} accessibilityRole="header">
            {i18n.t('pp.medit_move')}
          </AppText>
          <View style={styles.wrap}>
            {(['sedentary', 'light', 'moderate', 'active'] as PpActivity[]).map((k) => (
              <Chip key={k} label={i18n.t(`pp.act_${k}`)} selected={a.activity === k} onPress={() => upd({ activity: k })} />
            ))}
          </View>
          <Row label={i18n.t('pp.medit_ex_days')} last>
            <Stepper label={i18n.t('pp.medit_ex_days')} value={a.exerciseDays} display={i18n.t('pp.medit_ex_v', { n: a.exerciseDays })} min={0} max={7} onChange={(v) => upd({ exerciseDays: v })} />
          </Row>
        </Panel>
        <Panel style={{ backgroundColor: P.surface }}>
          <AppText textRole="bodySm" style={[styles.h, { color: P.ink }]} accessibilityRole="header">
            {i18n.t('pp.medit_food')}
          </AppText>
          <View style={styles.wrap}>
            {PP_DIETS.map((d) => (
              <Chip key={d} label={i18n.t(`pp.diet_${d}`)} selected={a.diet === d} onPress={() => upd({ diet: d })} />
            ))}
          </View>
          <Row label={i18n.t('pp.main_meals')}>
            <Stepper label={i18n.t('pp.main_meals')} value={a.meals.main} min={2} max={3} onChange={(v) => upd({ meals: { ...a.meals, main: v } })} />
          </Row>
          <Row label={i18n.t('pp.snacks')} last>
            <Stepper label={i18n.t('pp.snacks')} value={a.meals.snack} min={0} max={2} onChange={(v) => upd({ meals: { ...a.meals, snack: v } })} />
          </Row>
        </Panel>
        <PpButton label={i18n.t('pp.medit_recalc')} onPress={() => next && setCompare(next)} disabled={!next || minor} testID="pp-recalc" />
        <AppText textRole="helper" style={{ color: P.sec, textAlign: 'center' }}>
          {i18n.t('pp.medit_recalc_foot')}
        </AppText>
      </ScrollView>
      <Sheet visible={!!compare} onClose={() => setCompare(null)} title={i18n.t('pp.medit_compare')} testID="pp-compare">
        {compare ? (
          <View>
            <View style={[styles.cmpRow, { borderBottomColor: P.line }]}>
              <View style={{ flex: 1.2 }} />
              <AppText textRole="helper" style={{ color: P.sec, flex: 1, textAlign: 'right' }}>
                {i18n.t('pp.medit_old')}
              </AppText>
              <AppText textRole="helper" style={{ color: P.ink, flex: 1, textAlign: 'right', fontWeight: '700' }}>
                {i18n.t('pp.medit_new')}
              </AppText>
            </View>
            <CompareRow label={i18n.t('pp.daily_kcal')} o={`${old.calories} ${i18n.t('pp.kcal')}`} n={`${compare.calories} ${i18n.t('pp.kcal')}`} />
            <CompareRow label={i18n.t('pp.protein')} o={`${old.protein} ${i18n.t('pp.g')}`} n={`${compare.macros.protein} ${i18n.t('pp.g')}`} />
            <CompareRow label={i18n.t('pp.carbs')} o={`${old.carbs} ${i18n.t('pp.g')}`} n={`${compare.macros.carbs} ${i18n.t('pp.g')}`} />
            <CompareRow label={i18n.t('pp.fat')} o={`${old.fat} ${i18n.t('pp.g')}`} n={`${compare.macros.fat} ${i18n.t('pp.g')}`} />
            <CompareRow label={i18n.t('pp.target_date_label')} o={fmtDate(saved.targetDate, lang)} n={fmtDate(compare.targetDate, lang)} />
            <CompareRow label={i18n.t('pp.pace')} o={i18n.t('pp.pace_v', { pace: fmtPace(saved.result.effectivePace, lang) })} n={i18n.t('pp.pace_v', { pace: fmtPace(compare.effectivePace, lang) })} />
            {compare.steps.floored ? <Note text={i18n.t('pp.floor_note', { raw: Math.round(compare.steps.rawCalories), floor: compare.steps.floor, pace: fmtPace(compare.effectivePace, lang), from: fmtDate(compare.requestedTargetDate, lang), to: fmtDate(compare.targetDate, lang) })} /> : null}
            <PpButton label={i18n.t('pp.medit_save')} onPress={() => void doSave()} disabled={busy} style={{ marginTop: 16 }} testID="pp-compare-save" />
            <PpButton kind="link" label={i18n.t('pp.medit_keep')} onPress={() => { setCompare(null); navigation.goBack(); }} testID="pp-compare-keep" />
          </View>
        ) : null}
      </Sheet>
      <Toast visible={!!toast} message={toast?.msg ?? ''} tone={toast?.tone ?? 'default'} onDismiss={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  h: { fontWeight: '700', marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  cmpRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
});
