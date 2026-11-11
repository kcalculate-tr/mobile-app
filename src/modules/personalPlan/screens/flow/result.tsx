// G34-S1 · Tur 26o — Hesaplanıyor (gerçek zincir, ~2,75 sn), Hata (cevaplar korunur), Planın,
// Düzenle (öneri dışına çıkınca güvenlik uyarısı), "Nasıl hesapladık?" (02 panosu; ara değerler
// computePlan'ın GERÇEK adımlarından — sahte sayı / sahte yüzde sayacı yok).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { AppText } from '../../../../core/design/components/AppText';
import { DURATION, haptic } from '../../../../core/design/motion';
import { useT } from '../../../../core/i18n';
import { CaretDown, Check, PencilSimple } from '../../../../components/icons';
import {
  applyCustom,
  calorieFloor,
  computePlan,
  editWarning,
  isoDay,
  withCustom,
  type PpCalcInput,
  type PpResult,
} from '../../calc';
import { fmtDate, fmtKg, fmtNum, fmtPace, fmtShort, type Lang } from '../../format';
import { usePpFlow } from '../../store';
import type { PpAnswers } from '../../types';
import { Expand, Pulse, Rise, RingProgress, Rotator, useCountUp, PP_MOTION } from '../../ui/motion';
import { GLASS, Note, Panel, PpButton, PpCard, Stepper, TargetCurve, usePp } from '../../ui/parts';

const YEAR = () => new Date().getFullYear();

function useLang(): Lang {
  return useT().lang === 'en' ? 'en' : 'tr';
}

export function inputFrom(a: PpAnswers): PpCalcInput | null {
  if (!a.goal || !a.gender || !a.birthYear || !a.heightCm || !a.weightKg || !a.activity) return null;
  return {
    goal: a.goal,
    gender: a.gender,
    birthYear: a.birthYear,
    heightCm: a.heightCm,
    weightKg: a.weightKg,
    activity: a.activity,
    targetWeightKg: a.targetWeightKg,
    pace: a.pace,
    bodyFatPct: a.measures.bodyFatPct ?? null,
  };
}

// ── Hesaplanıyor ────────────────────────────────────────────────────────────
/** i. satırın görünme anı (ms): başlangıç + i × satır aralığı. */
const rowAt = (i: number) => PP_MOTION.calcStart + i * PP_MOTION.calcGap;
type CalcState = 'running' | 'done' | 'error';

export function CalcStep({ onDone, onError }: { onDone: (r: PpResult) => void; onError: () => void }) {
  const i18n = useT();
  const lang = useLang();
  const P = usePp();
  const answers = usePpFlow((s) => s.answers);
  const [state, setState] = useState<CalcState>('running');
  const [shown, setShown] = useState(0);
  const result = useMemo(() => {
    const inp = inputFrom(answers);
    return inp ? computePlan(inp, YEAR(), isoDay(new Date())) : null;
  }, [answers]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Gerçek zincir: bağlantı (kayıt için gerekli) + hesap. Hesap cihazda, sonuç kaydı "Planı başlat"ta.
      let online = true;
      try {
        const s = await NetInfo.fetch();
        online = s.isConnected !== false && s.isInternetReachable !== false;
      } catch {
        online = true;
      }
      if (cancelled) return;
      if (!result || !online) {
        setState('error');
        haptic('warning');
        return;
      }
      // Satırlar fast (220) sonra başlar, slow (550) arayla (5 × 550 = 2750 ms).
      for (let i = 1; i <= 5; i++) {
        timers.current.push(setTimeout(() => !cancelled && setShown(i), rowAt(i - 1)));
      }
      timers.current.push(
        setTimeout(() => {
          if (cancelled) return;
          setState('done');
          haptic('success');
        }, rowAt(4) + PP_MOTION.calcRow),
      );
      timers.current.push(setTimeout(() => !cancelled && onDone(result), rowAt(5) + PP_MOTION.calcRow));
    })();
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'error') return <ErrorStep onRetry={onError} />;
  if (!result) return null;
  const s = result.steps;
  const deltaAbs = Math.abs(s.requestedDelta);
  const rows = [
    { label: i18n.t('pp.calc_bmr'), sub: s.formula === 'katch' ? i18n.t('pp.calc_bmr_sub_k', { lean: fmtNum(s.leanMassKg ?? 0, lang, 1) }) : i18n.t('pp.calc_bmr_sub_m'), value: `${s.bmr} ${i18n.t('pp.kcal')}` },
    { label: i18n.t('pp.calc_tdee'), sub: i18n.t('pp.calc_tdee_sub', { bmr: s.bmr, f: fmtNum(s.factor, lang, 3), act: i18n.t(`pp.act_${answers.activity}`).toLocaleLowerCase(lang) }), value: `${s.tdee} ${i18n.t('pp.kcal')}` },
    {
      label: s.requestedDelta > 0 ? i18n.t('pp.calc_delta') : s.requestedDelta < 0 ? i18n.t('pp.calc_delta_gain') : i18n.t('pp.calc_delta_none'),
      sub: s.requestedDelta !== 0 ? i18n.t('pp.calc_delta_sub', { pace: fmtPace(result.requestedPace, lang) }) : i18n.t('pp.calc_delta_sub_none'),
      value: s.requestedDelta === 0 ? '0' : `${s.requestedDelta > 0 ? '−' : '+'}${deltaAbs} ${i18n.t('pp.kcal')}`,
    },
    {
      label: i18n.t('pp.calc_kcal'),
      sub: s.floored ? i18n.t('pp.calc_kcal_sub_floor', { floor: s.floor }) : s.requestedDelta < 0 ? i18n.t('pp.calc_kcal_sub_plus', { tdee: s.tdee, delta: deltaAbs }) : i18n.t('pp.calc_kcal_sub', { tdee: s.tdee, delta: deltaAbs }),
      value: `${result.calories} ${i18n.t('pp.kcal')}`,
    },
    { label: i18n.t('pp.calc_macros'), sub: '', value: `P${result.macros.protein} K${result.macros.carbs} Y${result.macros.fat}` },
  ];
  return (
    <PpCard scroll={false}>
      <View style={styles.calcHead}>
        <View style={styles.ringBox}>
          <RingProgress size={132} stroke={10} progress={shown / 5} color="#C6F04F" track={P.track} />
          <View style={StyleSheet.absoluteFill as object}>
            <View style={styles.ringCenter}>
              <Pulse active={state === 'running'} done={state === 'done'}>
                <Image source={GLASS.flame} style={{ width: 62, height: 76 }} resizeMode="contain" />
              </Pulse>
            </View>
          </View>
        </View>
        <AppText textRole="screenTitle" style={{ color: P.ink, textAlign: 'center', marginTop: 12 }} accessibilityRole="header" accessibilityLiveRegion="polite">
          {state === 'done' ? i18n.t('pp.calc_ready') : i18n.t('pp.calc_title')}
        </AppText>
        <AppText textRole="helper" style={{ color: P.sec, textAlign: 'center', marginTop: 4 }}>
          {i18n.t('pp.calc_sub')}
        </AppText>
      </View>
      <Panel style={{ marginTop: 18, paddingVertical: 4 }}>
        {rows.map((r, i) => {
          const on = i < shown;
          return (
            <View key={r.label} style={[styles.calcRow, i < rows.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.line } : null]}>
              <View style={[styles.calcDot, on ? { backgroundColor: P.accent, borderColor: 'transparent' } : { borderColor: P.line2 }]}>{on ? <Check size={12} color={P.onAccent} weight="bold" /> : null}</View>
              {on ? (
                <Rise style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} duration={PP_MOTION.calcRow}>
                  <View style={{ flex: 1 }} accessible accessibilityLabel={i18n.t('pp.calc_a11y', { label: r.label, value: r.value })}>
                    <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                      {r.label}
                    </AppText>
                    {r.sub ? (
                      <AppText textRole="helper" style={{ color: P.sec }}>
                        {r.sub}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                    {r.value}
                  </AppText>
                </Rise>
              ) : (
                <View style={{ flex: 1 }}>
                  <AppText textRole="bodySm" style={{ color: P.sec }}>
                    {r.label}
                  </AppText>
                </View>
              )}
            </View>
          );
        })}
      </Panel>
      <AppText textRole="helper" style={{ color: P.sec, textAlign: 'center', marginTop: 16 }}>
        {i18n.t('pp.brand_line')}
      </AppText>
    </PpCard>
  );
}

// ── Hata ────────────────────────────────────────────────────────────────────
export function ErrorStep({ onRetry, onBack }: { onRetry: () => void; onBack?: () => void }) {
  const i18n = useT();
  const P = usePp();
  return (
    <PpCard
      center
      footer={
        <View style={{ gap: 6 }}>
          <PpButton label={i18n.t('pp.err_retry')} onPress={onRetry} testID="pp-err-retry" />
          {onBack ? <PpButton kind="link" label={i18n.t('pp.err_back')} onPress={onBack} /> : null}
        </View>
      }
    >
      <Image source={GLASS.flame} style={[styles.errGlass, { opacity: 0.45 }]} resizeMode="contain" />
      <AppText textRole="screenTitle" style={{ color: P.ink, textAlign: 'center' }} accessibilityRole="header">
        {i18n.t('pp.err_title')}
      </AppText>
      <AppText textRole="bodySm" style={{ color: P.sec, textAlign: 'center', marginTop: 6 }}>
        {i18n.t('pp.err_sub')}
      </AppText>
      <Panel style={{ marginTop: 18, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={[styles.calcDot, { backgroundColor: P.accent, borderColor: 'transparent' }]}>
          <Check size={12} color={P.onAccent} weight="bold" />
        </View>
        <View style={{ flex: 1 }}>
          <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
            {i18n.t('pp.err_kept')}
          </AppText>
          <AppText textRole="helper" style={{ color: P.sec }}>
            {i18n.t('pp.err_kept_sub')}
          </AppText>
        </View>
      </Panel>
    </PpCard>
  );
}

// ── Nasıl hesapladık? (Sonuç + Kişisel planım) ──────────────────────────────
export function HowCalc({ result, answers, startIso, defaultOpen = false, testID }: { result: PpResult; answers: PpAnswers; startIso: string; defaultOpen?: boolean; testID?: string }) {
  const i18n = useT();
  const lang = useLang();
  const P = usePp();
  const [open, setOpen] = useState(defaultOpen);
  const s = result.steps;
  const w = answers.weightKg ?? 0;
  const f = (n: number, d = 1) => fmtNum(n, lang, d);
  const rows: { label: string; formula: string; value: string }[] = [
    s.formula === 'katch'
      ? { label: i18n.t('pp.how_bmr_k'), formula: `370 + ${f(21.6)} × ${f(s.leanMassKg ?? 0)}`, value: `${s.bmr} ${i18n.t('pp.kcal')}` }
      : {
          label: i18n.t('pp.how_bmr_m', { sex: i18n.t(s.sexConst > 0 ? 'pp.sex_male' : 'pp.sex_female') }),
          formula: `10 × ${f(w)} + ${f(6.25, 2)} × ${answers.heightCm} − 5 × ${s.age} ${s.sexConst > 0 ? '+ 5' : '− 161'}`,
          value: `${s.bmr} ${i18n.t('pp.kcal')}`,
        },
    { label: i18n.t('pp.how_tdee'), formula: `${s.bmr} × ${f(s.factor, 3)} (${i18n.t(`pp.act_${answers.activity}`).toLocaleLowerCase(lang)})`, value: `≈ ${s.tdee} ${i18n.t('pp.kcal')}` },
  ];
  if (s.requestedDelta !== 0) {
    rows.push({
      label: s.requestedDelta > 0 ? i18n.t('pp.how_delta') : i18n.t('pp.how_delta_gain'),
      formula: `${fmtPace(result.requestedPace, lang)} kg × 7700 ÷ 7`,
      value: `${Math.abs(s.requestedDelta)} ${i18n.t('pp.kcal')}/${lang === 'tr' ? 'gün' : 'day'}`,
    });
  }
  rows.push({
    label: i18n.t('pp.how_kcal'),
    formula: s.floored
      ? `${s.tdee} − ${s.requestedDelta} = ${Math.round(s.rawCalories)} → ${i18n.t('pp.how_floor')} ${s.floor}`
      : s.requestedDelta === 0
        ? `${s.tdee}, ${i18n.t('pp.how_rounded')}`
        : `${s.tdee} ${s.requestedDelta > 0 ? '−' : '+'} ${Math.abs(s.requestedDelta)} = ${Math.round(s.rawCalories)}, ${i18n.t('pp.how_rounded')}`,
    value: `${result.calories} ${i18n.t('pp.kcal')}`,
  });
  rows.push({ label: i18n.t('pp.how_protein'), formula: `${f(w)} kg × ${f(1.8)} g`, value: `≈ ${result.macros.protein} g (${result.macros.proteinKcal} ${i18n.t('pp.kcal')})` });
  rows.push({ label: i18n.t('pp.how_fat'), formula: `${result.calories} × %27 ≈ ${result.macros.fatKcal} ${i18n.t('pp.kcal')} ÷ 9`, value: `≈ ${result.macros.fat} g` });
  rows.push({ label: i18n.t('pp.how_carbs'), formula: `(${result.calories} − ${result.macros.proteinKcal} − ${result.macros.fatKcal}) ÷ 4`, value: `≈ ${result.macros.carbs} g` });
  if (result.weeks && answers.targetWeightKg != null) {
    rows.push({
      label: i18n.t('pp.how_date'),
      formula: i18n.t('pp.how_date_v', { diff: f(Math.abs(w - answers.targetWeightKg)), pace: fmtPace(result.effectivePace, lang), weeks: result.weeks, start: fmtDate(startIso, lang) }),
      value: fmtDate(result.targetDate, lang),
    });
  }
  return (
    <View style={[styles.howBox, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]} testID={testID}>
      <Pressable
        onPress={() => {
          haptic('light');
          setOpen(!open);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${i18n.t('pp.how_title')}. ${i18n.t('pp.how_sub')}`}
        style={styles.howHead}
      >
        <View style={{ flex: 1 }}>
          <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
            {i18n.t('pp.how_title')}
          </AppText>
          <AppText textRole="helper" style={{ color: P.sec }}>
            {i18n.t('pp.how_sub')}
          </AppText>
        </View>
        <Rotator open={open}>
          <CaretDown size={16} color={P.ink} />
        </Rotator>
      </Pressable>
      <Expand open={open}>
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          {rows.map((r, i) => (
            <Rise key={r.label} delay={open ? DURATION.instant + i * PP_MOTION.chipStagger : 0} play={open} duration={PP_MOTION.fill}>
              <View style={[styles.howRow, { borderTopColor: P.line }]} accessible accessibilityLabel={`${r.label}. ${r.formula}. ${r.value}`}>
                <AppText textRole="helper" style={{ color: P.sec }}>
                  {r.label}
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                  <AppText textRole="helper" style={{ color: P.ink, flex: 1 }}>
                    {r.formula}
                  </AppText>
                  <AppText textRole="helper" style={{ color: P.ink, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                    {r.value}
                  </AppText>
                </View>
              </View>
            </Rise>
          ))}
          {s.formula === 'mifflin' ? (
            <AppText textRole="helper" style={{ color: P.sec, marginTop: 10 }}>
              {i18n.t('pp.how_katch_note')}
            </AppText>
          ) : null}
          <AppText textRole="helper" style={{ color: P.sec, marginTop: 6 }}>
            {i18n.t('pp.safety_note')}
          </AppText>
        </View>
      </Expand>
    </View>
  );
}

// ── Kalori kartı + hedef tarihi kartı (Sonuç, Kişisel planım) ───────────────
export function KcalCard({ calories, protein, carbs, fat, suggested, onEdit, animate = true }: { calories: number; protein: number; carbs: number; fat: number; suggested?: number | null; onEdit?: () => void; animate?: boolean }) {
  const i18n = useT();
  const P = usePp();
  const n = useCountUp(calories, animate);
  return (
    <View style={[styles.kcalCard, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={[styles.flameRing, { borderColor: '#C6F04F' }]}>
          <Image source={GLASS.flame} style={{ width: 34, height: 42 }} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }} accessible accessibilityLabel={`${i18n.t('pp.daily_kcal')}: ${calories} ${i18n.t('pp.kcal')}`}>
          <AppText textRole="helper" style={{ color: P.sec }}>
            {i18n.t('pp.daily_kcal')}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <AppText variant="display" style={{ color: P.ink, fontVariant: ['tabular-nums'] }} testID="pp-kcal">
              {String(n)}
            </AppText>
            <AppText textRole="helper" style={{ color: P.sec, marginBottom: 8 }}>
              {i18n.t('pp.kcal')}
            </AppText>
          </View>
          {suggested ? (
            <AppText textRole="helper" style={{ color: P.sec }}>
              {i18n.t('pp.edit_suggested', { n: suggested })}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={styles.macroRow}>
        {[
          { k: i18n.t('pp.protein'), v: protein },
          { k: i18n.t('pp.carbs'), v: carbs },
          { k: i18n.t('pp.fat'), v: fat },
        ].map((m, i) => (
          <Rise key={m.k} delay={animate ? PP_MOTION.count + i * PP_MOTION.chipStagger : 0} duration={PP_MOTION.fill} style={{ flex: 1 }}>
            <View style={[styles.macro, { backgroundColor: P.field }]} accessible accessibilityLabel={`${m.k} ${m.v} ${i18n.t('pp.g')}`}>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {m.k}
              </AppText>
              <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {m.v} {i18n.t('pp.g')}
              </AppText>
            </View>
          </Rise>
        ))}
      </View>
      {onEdit ? (
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={i18n.t('pp.edit')} style={[styles.editPill, { borderColor: P.line2 }]} testID="pp-edit">
          <PencilSimple size={14} color={P.ink} />
          <AppText textRole="helper" style={{ color: P.ink, fontWeight: '600' }}>
            {i18n.t('pp.edit')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function DateCard({ answers, result, targetDate, startIso, pace, weeks, compact }: { answers: PpAnswers; result: PpResult; targetDate: string | null; startIso: string; pace: number; weeks: number | null; compact?: boolean }) {
  const i18n = useT();
  const lang = useLang();
  const P = usePp();
  const { width } = useWindowDimensions();
  if (!targetDate || answers.targetWeightKg == null || !answers.weightKg) return null;
  return (
    <View style={[styles.kcalCard, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Image source={GLASS.trophy} style={{ width: 30, height: 28 }} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <AppText textRole="helper" style={{ color: P.sec }}>
            {i18n.t('pp.target_date_label')}
          </AppText>
          <AppText textRole="section" style={{ color: P.ink }} testID="pp-result-date">
            {fmtDate(targetDate, lang)}
          </AppText>
        </View>
      </View>
      <TargetCurve
        width={width - 24 - 32 - 4}
        fromKg={answers.weightKg}
        toKg={answers.targetWeightKg}
        topLabel={`${i18n.t('pp.today')} ${fmtKg(answers.weightKg, lang)} ${i18n.t('pp.kg')}`}
        endLabel={`${i18n.t('pp.goal_label')} ${fmtKg(answers.targetWeightKg, lang)} ${i18n.t('pp.kg')}`}
        leftLabel={fmtShort(startIso, lang)}
        rightLabel={fmtShort(targetDate, lang)}
        a11y={`${i18n.t('pp.target_date_label')} ${fmtDate(targetDate, lang)}`}
      />
      {!compact ? (
        <>
          <View style={styles.macroRow}>
            <View style={[styles.macro, { backgroundColor: P.field, flex: 1 }]}>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.duration')}
              </AppText>
              <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                {weeks ? i18n.t('pp.weeks', { count: weeks }) : '–'}
              </AppText>
            </View>
            <View style={[styles.macro, { backgroundColor: P.field, flex: 1 }]}>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.pace')}
              </AppText>
              <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                {i18n.t('pp.pace_v', { pace: fmtPace(pace, lang) })}
              </AppText>
            </View>
          </View>
          <AppText textRole="helper" style={{ color: P.sec, marginTop: 8 }}>
            {i18n.t('pp.estimate_note')}
          </AppText>
        </>
      ) : null}
    </View>
  );
}

// ── Planın (+ Düzenle) ──────────────────────────────────────────────────────
export function ResultStep({ onStart, saving }: { onStart: () => void; saving: boolean }) {
  const i18n = useT();
  const lang = useLang();
  const P = usePp();
  const a = usePpFlow((s) => s.answers);
  const result = usePpFlow((s) => s.result);
  const custom = usePpFlow((s) => s.custom);
  const setCustom = usePpFlow((s) => s.setCustom);
  const [editing, setEditing] = useState(false);
  const start = isoDay(new Date());
  if (!result) return null;
  const gender = a.gender ?? 'female';
  const t = custom ?? { calories: result.calories, protein: result.macros.protein, fat: result.macros.fat, carbs: result.macros.carbs };
  // Düzenlenmiş kaloride etkin tempo ve hedef tarihi.
  const wc = withCustom(result, a, custom?.calories ?? null, start);
  const effPace = wc.pace;
  const weeks = wc.weeks;
  const date = wc.date;
  const warn = custom ? editWarning(custom, result, gender, a.weightKg ?? 70) : null;
  // Taban: düzenleyici tabanın altına izin vermez; tabana dayanınca da nedenini söyler.
  const atFloor = !!custom && custom.calories <= calorieFloor(gender);
  const warnText =
    warn === 'below_floor' || atFloor
      ? i18n.t(gender === 'female' ? 'pp.warn_below_floor' : 'pp.warn_below_floor_m', { floor: calorieFloor(gender) })
      : warn === 'far_from_suggestion'
        ? i18n.t('pp.warn_far')
        : warn === 'protein_low'
          ? i18n.t('pp.warn_protein')
          : null;
  const sub =
    a.goal === 'lose'
      ? i18n.t('pp.result_sub_lose', { from: fmtKg(a.weightKg ?? 0, lang), to: fmtKg(a.targetWeightKg ?? 0, lang) })
      : a.goal === 'gain'
        ? i18n.t('pp.result_sub_gain', { from: fmtKg(a.weightKg ?? 0, lang), to: fmtKg(a.targetWeightKg ?? 0, lang) })
        : a.goal === 'maintain'
          ? i18n.t('pp.result_sub_maintain', { kg: fmtKg(a.weightKg ?? 0, lang) })
          : i18n.t('pp.result_sub_balanced');
  const edit = (patch: Partial<{ calories: number; protein: number; fat: number }>) => {
    const next = applyCustom({ calories: t.calories, protein: t.protein, fat: t.fat, ...patch }, gender);
    setCustom(next);
  };
  return (
    <PpCard
      title={i18n.t('pp.result_title')}
      sub={sub}
      footer={
        <View>
          <PpButton label={i18n.t('pp.start_plan')} onPress={onStart} disabled={saving || editing} testID="pp-start-plan" />
          <AppText textRole="helper" style={{ color: P.sec, textAlign: 'center', marginTop: 8 }}>
            {i18n.t('pp.free_line')}
          </AppText>
        </View>
      }
    >
      {editing ? (
        <View style={[styles.kcalCard, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]} testID="pp-editor">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 }}>
            <View style={[styles.flameRing, { borderColor: '#C6F04F' }]}>
              <Image source={GLASS.flame} style={{ width: 34, height: 42 }} resizeMode="contain" />
            </View>
            <View>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.daily_kcal')}
              </AppText>
              <AppText variant="display" style={{ color: P.ink, fontVariant: ['tabular-nums'] }}>
                {String(t.calories)}
              </AppText>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.edit_suggested', { n: result.calories })}
              </AppText>
            </View>
          </View>
          {[
            { k: 'calories' as const, label: i18n.t('pp.edit_kcal'), sub: i18n.t('pp.edit_kcal_sub', { n: result.calories }), v: t.calories, unit: i18n.t('pp.kcal'), min: calorieFloor(gender), max: 5000, step: 10 },
            { k: 'protein' as const, label: i18n.t('pp.edit_protein'), sub: i18n.t('pp.edit_protein_sub'), v: t.protein, unit: i18n.t('pp.g'), min: 20, max: 400, step: 5 },
            { k: 'fat' as const, label: i18n.t('pp.edit_fat'), sub: i18n.t('pp.edit_fat_sub'), v: t.fat, unit: i18n.t('pp.g'), min: 20, max: 250, step: 1 },
          ].map((r) => (
            <View key={r.k} style={[styles.editRow, { borderBottomColor: P.line }]}>
              <View style={{ flex: 1 }}>
                <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                  {r.label}
                </AppText>
                <AppText textRole="helper" style={{ color: P.sec }}>
                  {r.sub}
                </AppText>
              </View>
              <Stepper label={r.label} value={r.v} display={`${r.v} ${r.unit}`} min={r.min} max={r.max} step={r.step} onChange={(v) => edit({ [r.k]: v })} />
            </View>
          ))}
          <View style={[styles.editRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                {i18n.t('pp.edit_carbs')}
              </AppText>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.edit_carbs_sub')}
              </AppText>
            </View>
            <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {t.carbs} {i18n.t('pp.g')}
            </AppText>
          </View>
          {warnText ? <Note testID="pp-edit-warn" tone="warn" text={warnText} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <PpButton kind="link" label={i18n.t('pp.back_to_suggested')} onPress={() => setCustom(null)} testID="pp-edit-reset" />
            <PpButton label={i18n.t('pp.done')} onPress={() => setEditing(false)} style={{ minWidth: 110 }} testID="pp-edit-done" />
          </View>
        </View>
      ) : (
        <KcalCard calories={t.calories} protein={t.protein} carbs={t.carbs} fat={t.fat} suggested={custom ? result.calories : null} onEdit={() => setEditing(true)} />
      )}
      <View style={{ height: 12 }} />
      <DateCard answers={a} result={result} targetDate={date} startIso={start} pace={effPace} weeks={weeks} />
      {result.steps.floored && !custom ? (
        <Note
          testID="pp-result-floor"
          text={
            result.unreachable
              ? i18n.t('pp.floor_unreachable', { floor: result.steps.floor })
              : i18n.t('pp.floor_note', {
                  raw: Math.round(result.steps.rawCalories),
                  floor: result.steps.floor,
                  pace: fmtPace(result.effectivePace, lang),
                  from: fmtDate(result.requestedTargetDate, lang),
                  to: fmtDate(result.targetDate, lang),
                })
          }
        />
      ) : null}
      <View style={{ height: 12 }} />
      <HowCalc result={result} answers={a} startIso={start} testID="pp-how" />
      <AppText textRole="helper" style={{ color: P.sec, marginTop: 10 }}>
        {i18n.t('pp.share_note')}
      </AppText>
      <AppText textRole="section" style={{ color: P.ink, textAlign: 'center', marginTop: 16 }}>
        {i18n.t('pp.brand_line')}
      </AppText>
    </PpCard>
  );
}

const styles = StyleSheet.create({
  calcHead: { alignItems: 'center', marginTop: 8 },
  ringBox: { width: 132, height: 132 },
  ringCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 6 },
  calcDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  errGlass: { width: 110, height: 120, alignSelf: 'center', marginBottom: 12 },
  howBox: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  howHead: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 14 },
  howRow: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  kcalCard: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  flameRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  macroRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  macro: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  editPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 12, minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
