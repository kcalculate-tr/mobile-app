// G34-S1 md.4 · Tur 26o — Haftalık check-in (03 panosu: Haftalık tartı, Plan güncellendi, Kilo arttı,
// Hızlı kayıp; 05 FinPlanCheckin, ücretsiz). Kalori OTOMATİK DÜŞMEZ: öneri kartı yeni değerleri
// gösterir, "Uygula" / "Eski planımı koru". Yalnız hedef tarihi kendiliğinden güncellenir.
// Grafik: gerçek kilo çizgisi soldan sağa 990 ms çizilir; plan çizgisi kesikli, hedef sabit.
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Line as SvgLine, Path } from 'react-native-svg';
import { AppText } from '../../../core/design/components/AppText';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { Sheet } from '../../../core/design/components/Sheet';
import { Toast } from '../../../core/design/components/Toast';
import { haptic } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { track } from '../../../lib/analytics';
import type { RootStackParamList } from '../../../navigation/types';
import { WheelPicker } from '../../onboarding/takibe/TbParts';
import { addDays, checkinSuggestion, computeMacros, isoDay, weekIndex, weeksBetween, withCustom, type CheckinSuggestion } from '../calc';
import { fmtDate, fmtKg, fmtPace, fmtShort, fmtSigned, type Lang } from '../format';
import { saveMeasurement } from '../api';
import { effectiveTargets, type PpMeasures, type PpSaved } from '../types';
import { useMyPlan, weighedThisWeek } from '../useMyPlan';
import { DrawPath, Expand, Rise } from '../ui/motion';
import { GLASS, Note, Panel, PpBackdrop, PpButton, Row, ScreenHeader, Stepper, usePp } from '../ui/parts';
import { palette } from '../../../core/design/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalPlanCheckin'>;

const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
  return out;
};

export default function CheckinScreen({ navigation }: Props) {
  const i18n = useT();
  const lang: Lang = i18n.lang === 'en' ? 'en' : 'tr';
  const P = usePp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { uid, saved, weighIns, save, setWeighIns } = useMyPlan();
  const today = isoDay(new Date());
  const [sheet, setSheet] = useState(false);
  const [measOpen, setMeasOpen] = useState(false);
  const last = weighIns[weighIns.length - 1];
  const [kg, setKg] = useState<number>(() => Math.round((last?.weightKg ?? saved?.answers.weightKg ?? 70) * 10) / 10);
  const [meas, setMeas] = useState<PpMeasures>({});
  const [sugg, setSugg] = useState<CheckinSuggestion | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: 'default' | 'error' } | null>(null);
  const values = useMemo(() => range(Math.max(30, kg - 15), kg + 15, 0.1), [sheet]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!saved) {
    return (
      <View style={{ flex: 1 }}>
        <PpBackdrop glow={false} />
        <ScreenHeader title={i18n.t('pp.ci_title')} onBack={() => navigation.goBack()} />
      </View>
    );
  }

  const a = saved.answers;
  const t = effectiveTargets(saved);
  const goal = a.goal ?? 'maintain';
  const wk = saved.startedAt ? weekIndex(saved.startedAt, today) : 1;
  const done = weighedThisWeek(weighIns, today);
  const prev = weighIns.filter((w) => w.date < today).slice(-1)[0];
  const planPace = withCustom(saved.result, a, saved.custom?.calories ?? null, today).pace;
  const planNow = goal === 'lose' ? saved.startWeightKg - planPace * Math.max(0, weeksBetween(saved.startedAt || today, today)) : goal === 'gain' ? saved.startWeightKg + planPace * Math.max(0, weeksBetween(saved.startedAt || today, today)) : saved.startWeightKg;

  const submit = async () => {
    if (!uid || busy) return;
    setBusy(true);
    const ok = await saveMeasurement(uid, { date: today, weightKg: kg, measures: meas });
    if (!ok) {
      setBusy(false);
      setToast({ msg: i18n.t('pp.ci_failed'), tone: 'error' });
      return;
    }
    const list = [...weighIns.filter((w) => w.date !== today), { date: today, weightKg: kg }].sort((x, y) => x.date.localeCompare(y.date));
    setWeighIns(list);
    const s = checkinSuggestion(list, { goal, calories: t.calories, pace: planPace, targetWeightKg: a.targetWeightKg, gender: a.gender ?? 'female', heightCm: a.heightCm ?? 168 }, today);
    // Yalnız hedef tarihi ve güncel kilo kendiliğinden güncellenir (kalori DEĞİŞMEZ).
    const p: PpSaved = { ...saved, answers: { ...a, weightKg: kg, measures: { ...a.measures, ...meas } }, targetDate: s.autoTargetDate ?? saved.targetDate, updatedAt: new Date().toISOString() };
    await save(uid, p);
    setBusy(false);
    setSheet(false);
    setSugg(s);
    haptic('success');
    track('pp_checkin', { kind: s.kind, action: 'saved' });
  };

  const apply = async () => {
    if (!uid || !sugg?.newCalories) return;
    const macros = computeMacros(sugg.newCalories, kg);
    const p: PpSaved = {
      ...saved,
      custom: { calories: sugg.newCalories, protein: macros.protein, fat: macros.fat, carbs: macros.carbs },
      targetDate: sugg.newTargetDate ?? saved.targetDate,
      updatedAt: new Date().toISOString(),
    };
    const r = await save(uid, p);
    track('pp_checkin', { kind: sugg.kind, action: 'apply' });
    if (!r.ok) {
      setToast({ msg: i18n.t('pp.ci_failed'), tone: 'error' });
      return;
    }
    haptic('success');
    setToast({ msg: i18n.t('pp.ci_applied'), tone: 'default' });
    setSugg(null);
  };

  const keep = () => {
    track('pp_checkin', { kind: sugg?.kind ?? 'none', action: 'keep' });
    setToast({ msg: i18n.t('pp.ci_kept'), tone: 'default' });
    setSugg(null);
  };

  // ── Grafik ──
  const chartW = width - 32 - 32;
  const chartH = 120;
  const pts = weighIns.filter((w) => !saved.startedAt || w.date >= addDays(saved.startedAt, -7));
  const endDate = saved.targetDate ?? addDays(today, 28);
  const x0 = saved.startedAt || pts[0]?.date || today;
  const span = Math.max(7, (new Date(`${endDate}T12:00:00`).getTime() - new Date(`${x0}T12:00:00`).getTime()) / 86400000);
  const target = a.targetWeightKg ?? saved.startWeightKg;
  const vals = [saved.startWeightKg, target, ...pts.map((p) => p.weightKg)];
  const vMin = Math.min(...vals) - 0.5;
  const vMax = Math.max(...vals) + 0.5;
  const X = (d: string) => 8 + ((new Date(`${d}T12:00:00`).getTime() - new Date(`${x0}T12:00:00`).getTime()) / 86400000 / span) * (chartW - 16);
  const Y = (v: number) => 8 + ((vMax - v) / (vMax - vMin || 1)) * (chartH - 16);
  const real = pts.map((p, i) => `${i ? 'L' : 'M'} ${X(p.date).toFixed(1)} ${Y(p.weightKg).toFixed(1)}`).join(' ');
  const realLen = pts.reduce((s, p, i) => (i ? s + Math.hypot(X(p.date) - X(pts[i - 1].date), Y(p.weightKg) - Y(pts[i - 1].weightKg)) : 0), 0);
  const planD = `M ${X(x0)} ${Y(saved.startWeightKg)} L ${X(endDate)} ${Y(target)}`;
  const cur = pts[pts.length - 1];
  const delta = cur && pts.length > 1 ? cur.weightKg - pts[pts.length - 2].weightKg : null;

  const Card = ({ s }: { s: CheckinSuggestion }) => {
    const titleKey = s.kind === 'slow' ? 'pp.ci_slow_title' : s.kind === 'fast' ? 'pp.ci_fast_title' : s.kind === 'fluctuation' ? 'pp.ci_fluct_title' : 'pp.ci_ok_title';
    const body =
      s.kind === 'slow'
        ? i18n.t('pp.ci_slow_body', { rate: fmtPace(Math.max(0, s.avgRate ?? 0), lang), pace: fmtPace(planPace, lang) })
        : s.kind === 'fast'
          ? i18n.t('pp.ci_fast_body', { rate: fmtPace(s.avgRate ?? 0, lang), max: fmtPace(s.safeMax, lang), pace: fmtPace(planPace, lang) })
          : s.kind === 'fluctuation'
            ? i18n.t('pp.ci_fluct_body', { d: fmtKg(Math.abs(s.weekDelta ?? 0), lang) })
            : i18n.t('pp.ci_ok_body');
    const hasOffer = (s.kind === 'slow' || s.kind === 'fast') && s.newCalories != null;
    return (
      <Rise>
        <View style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]} testID={`pp-ci-${s.kind}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image source={GLASS.drop} style={{ width: 26, height: 34 }} resizeMode="contain" />
            <AppText textRole="section" style={{ color: P.ink, flex: 1 }} accessibilityRole="header">
              {i18n.t(titleKey)}
            </AppText>
          </View>
          <AppText textRole="bodySm" style={{ color: P.sec, marginTop: 8 }}>
            {body}
          </AppText>
          {hasOffer ? (
            <View style={{ marginTop: 10 }}>
              <Row label={i18n.t('pp.ci_daily_kcal')}>
                <AppText textRole="bodySm" style={{ color: P.sec, textDecorationLine: 'line-through', marginRight: 6 }}>
                  {t.calories}
                </AppText>
                <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '800' }}>
                  → {s.newCalories} {i18n.t('pp.kcal')}
                </AppText>
              </Row>
              {goal === 'lose' || goal === 'gain' ? (
                <Row label={i18n.t('pp.ci_tempo')}>
                  <AppText textRole="bodySm" style={{ color: P.sec, textDecorationLine: 'line-through', marginRight: 6 }}>
                    {fmtPace(planPace, lang)}
                  </AppText>
                  <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '800' }}>
                    → {i18n.t('pp.pace_v', { pace: fmtPace(s.newPace ?? 0, lang) })}
                  </AppText>
                </Row>
              ) : null}
              {s.newTargetDate ? (
                <Row label={i18n.t('pp.ci_target_date')}>
                  <AppText textRole="bodySm" style={{ color: P.sec, textDecorationLine: 'line-through', marginRight: 6 }}>
                    {fmtShort(saved.targetDate, lang)}
                  </AppText>
                  <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '800' }}>
                    → {fmtDate(s.newTargetDate, lang)}
                  </AppText>
                </Row>
              ) : null}
              {s.newMacros ? (
                <View style={styles.macroRow}>
                  {[
                    { k: i18n.t('pp.protein'), v: s.newMacros.protein },
                    { k: i18n.t('pp.carbs'), v: s.newMacros.carbs },
                    { k: i18n.t('pp.fat'), v: s.newMacros.fat },
                  ].map((m) => (
                    <View key={m.k} style={[styles.macro, { backgroundColor: P.field }]}>
                      <AppText textRole="helper" style={{ color: P.sec }}>
                        {m.k}
                      </AppText>
                      <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                        {m.v} {i18n.t('pp.g')}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
              {s.estTdee ? (
                <AppText textRole="helper" style={{ color: P.sec, marginTop: 8 }}>
                  {i18n.t(s.kind === 'fast' ? 'pp.ci_est_high' : 'pp.ci_est_low', { n: s.estTdee })}
                </AppText>
              ) : null}
              {s.kind === 'fast' ? <Note tone="warn" text={i18n.t('pp.ci_fast_warn')} /> : null}
              <PpButton label={i18n.t('pp.ci_apply')} onPress={() => void apply()} style={{ marginTop: 12 }} testID="pp-ci-apply" />
              <PpButton kind="link" label={i18n.t('pp.ci_keep')} onPress={keep} testID="pp-ci-keep" />
            </View>
          ) : (
            <>
              {s.kind === 'fluctuation' ? (
                <>
                  <Row label={i18n.t('pp.ci_daily_kcal')}>
                    <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                      {t.calories} {i18n.t('pp.kcal')}
                    </AppText>
                  </Row>
                  {saved.targetDate ? (
                    <Row label={i18n.t('pp.ci_target_date')} last>
                      <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                        {fmtDate(s.autoTargetDate ?? saved.targetDate, lang)}
                      </AppText>
                    </Row>
                  ) : null}
                  <AppText textRole="helper" style={{ color: P.sec, marginTop: 8 }}>
                    {i18n.t('pp.ci_fluct_tip')}
                  </AppText>
                </>
              ) : null}
              <PpButton label={i18n.t('pp.ci_ok')} onPress={() => setSugg(null)} style={{ marginTop: 12 }} testID="pp-ci-ok" />
            </>
          )}
        </View>
      </Rise>
    );
  };

  return (
    <View style={{ flex: 1 }} testID="pp-checkin">
      <PpBackdrop glow={false} />
      <ScreenHeader title={i18n.t('pp.ci_title')} onBack={() => navigation.goBack()} />
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 12 }} showsVerticalScrollIndicator={false}>
        {!done && !skipped ? (
          <View style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]} testID="pp-ci-banner">
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Image source={GLASS.trophy} style={{ width: 34, height: 30 }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                  {i18n.t('pp.ci_banner')}
                </AppText>
                <AppText textRole="helper" style={{ color: P.sec }}>
                  {i18n.t('pp.ci_banner_sub', { n: wk })}
                </AppText>
              </View>
            </View>
            <View style={styles.macroRow}>
              <View style={[styles.macro, { backgroundColor: P.field, alignItems: 'flex-start' }]}>
                <AppText textRole="helper" style={{ color: P.sec }}>
                  {i18n.t('pp.ci_last_week')}
                </AppText>
                <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                  {prev ? `${fmtKg(prev.weightKg, lang)} ${i18n.t('pp.kg')}` : '–'}
                </AppText>
              </View>
              <View style={[styles.macro, { backgroundColor: P.field, alignItems: 'flex-start' }]}>
                <AppText textRole="helper" style={{ color: P.sec }}>
                  {i18n.t('pp.ci_plan_week')}
                </AppText>
                <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                  {fmtKg(Math.round(planNow * 10) / 10, lang)} {i18n.t('pp.kg')}
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <PpButton label={i18n.t('pp.ci_weigh_cta')} onPress={() => setSheet(true)} style={{ flex: 1 }} testID="pp-ci-weigh" />
              <PpButton
                kind="link"
                label={i18n.t('pp.ci_skip_week')}
                onPress={() => {
                  setSkipped(true);
                  track('pp_checkin', { kind: 'none', action: 'skip' });
                }}
              />
            </View>
          </View>
        ) : null}
        <View style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
          <AppText textRole="helper" style={{ color: P.sec }}>
            {i18n.t('pp.ci_this_week')}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <AppText variant="title" style={{ color: P.ink, fontVariant: ['tabular-nums'] }} testID="pp-ci-current">
              {cur ? `${fmtKg(cur.weightKg, lang)} ${i18n.t('pp.kg')}` : '–'}
            </AppText>
            {delta != null ? (
              <View style={[styles.badge, { backgroundColor: P.field }]}>
                <AppText textRole="helper" style={{ color: P.ink }}>
                  {i18n.t('pp.ci_delta', { d: fmtSigned(delta, lang) })}
                </AppText>
              </View>
            ) : null}
          </View>
          <View accessible accessibilityRole="image" accessibilityLabel={i18n.t('pp.ci_chart_a11y', { n: pts.length, kg: cur ? fmtKg(cur.weightKg, lang) : '–', target: fmtKg(target, lang) })} style={{ marginTop: 8 }}>
            <Svg width={chartW} height={chartH}>
              <SvgLine x1={8} x2={chartW - 8} y1={Y(target)} y2={Y(target)} stroke={P.line2} strokeWidth={1} strokeDasharray="2 4" />
              <Path d={planD} stroke={P.sec} strokeWidth={1.5} fill="none" strokeDasharray="4 4" />
              {pts.length > 1 ? <DrawPath d={real} length={Math.max(1, realLen)} color={P.isDark ? palette.lime : '#5E7A12'} width={2.5} /> : null}
              {pts.map((p, i) => (
                <Circle key={p.date} cx={X(p.date)} cy={Y(p.weightKg)} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? palette.lime : P.surface} stroke={P.ink} strokeWidth={1.5} />
              ))}
              <Circle cx={X(endDate)} cy={Y(target)} r={4} fill={P.surface} stroke={P.sec} strokeWidth={1.5} />
            </Svg>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {fmtShort(x0, lang)}
              </AppText>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.ci_week_n', { n: wk })}
              </AppText>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {fmtShort(endDate, lang)}
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
              <AppText textRole="helper" style={{ color: P.sec }}>━ {i18n.t('pp.ci_real')}</AppText>
              <AppText textRole="helper" style={{ color: P.sec }}>╌ {i18n.t('pp.ci_plan')}</AppText>
            </View>
          </View>
        </View>
        {sugg && sugg.kind !== 'none' ? <Card s={sugg} /> : null}
        {done && !sugg ? <PpButton kind="ghost" label={i18n.t('pp.ci_weigh_cta')} onPress={() => setSheet(true)} /> : null}
      </ScrollView>
      <Sheet visible={sheet} onClose={() => setSheet(false)} title={i18n.t('pp.ci_sheet_title')} testID="pp-ci-sheet" scroll>
        <AppText textRole="helper" style={{ color: P.sec, marginBottom: 10 }}>
          {i18n.t('pp.ci_sheet_sub', { date: fmtDate(today, lang), n: wk })}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Stepper label={i18n.t('pp.ci_sheet_title')} value={kg} display={`${fmtKg(kg, lang)}`} min={30} max={300} step={0.1} onChange={(v) => setKg(Math.round(v * 10) / 10)} />
        </View>
        <View style={{ marginTop: 10 }}>
          <WheelPicker label={i18n.t('pp.ci_sheet_title')} values={values} value={kg} onChange={(v) => setKg(v)} />
        </View>
        {prev ? (
          <AppText textRole="helper" style={{ color: P.sec, marginTop: 8 }}>
            {i18n.t('pp.ci_prev', { kg: fmtKg(prev.weightKg, lang) })}
          </AppText>
        ) : null}
        <Row label={i18n.t('pp.ci_add_measure')} sub={i18n.t('pp.ci_optional')} onPress={() => setMeasOpen(!measOpen)} />
        <Expand open={measOpen}>
          <Panel>
            {(['waistCm', 'hipCm', 'chestCm', 'armCm'] as const).map((k, i, arr) => (
              <Row key={k} label={i18n.t(k === 'waistCm' ? 'pp.m_waist' : k === 'hipCm' ? 'pp.m_hip' : k === 'chestCm' ? 'pp.m_chest' : 'pp.m_arm')} last={i === arr.length - 1}>
                <Stepper
                  label={k}
                  value={meas[k] ?? a.measures[k] ?? (k === 'armCm' ? 30 : k === 'waistCm' ? 80 : 95)}
                  display={`${meas[k] ?? a.measures[k] ?? (k === 'armCm' ? 30 : k === 'waistCm' ? 80 : 95)} ${i18n.t('pp.cm')}`}
                  min={15}
                  max={200}
                  onChange={(v) => setMeas((m) => ({ ...m, [k]: v }))}
                />
              </Row>
            ))}
          </Panel>
        </Expand>
        <PpButton label={i18n.t('pp.ci_save')} onPress={() => void submit()} disabled={busy} style={{ marginTop: 14 }} testID="pp-ci-save" />
        <PpButton
          kind="link"
          label={i18n.t('pp.ci_skip_week')}
          onPress={() => {
            setSheet(false);
            setSkipped(true);
          }}
        />
      </Sheet>
      <Toast visible={!!toast} message={toast?.msg ?? ''} tone={toast?.tone ?? 'default'} onDismiss={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  macroRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  macro: { flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
});
