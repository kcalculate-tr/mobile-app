// G34-S1 · Tur 26o — soru adımları 1–8 (01-akis-adimlar.png). Tek ekranda tek soru,
// büyük seçim kartları; "Devam et" cevap tamamlanınca etkin. Güvenlik dalları:
// VKİ < 18,5 → "Kilo ver" kapalı + nazik açıklama; 0,75 kg yalnız ≤ %1; kalori tabanı.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText } from '../../../../core/design/components/AppText';
import { useT } from '../../../../core/i18n';
import { CaretDown } from '../../../../components/icons';
import { WheelPicker } from '../../../onboarding/takibe/TbParts';
import {
  bmi,
  canOfferLose,
  clampPace,
  computePlan,
  goalNeedsTarget,
  isoDay,
  maxWeeklyKg,
  paceAllowed,
  paceOptions,
  suggestTarget,
  targetRange,
  type PpActivity,
  type PpGender,
  type PpGoal,
  type PpPace,
} from '../../calc';
import { fmtDate, fmtKg, fmtNum, fmtPace, type Lang } from '../../format';
import { stepComplete, type QuestionStep } from '../../flow';
import { usePpFlow } from '../../store';
import { PP_DIETS, PP_DISLIKES, PP_EXERCISES, PP_EXERCISE_MINUTES, PP_ALLERGENS, mealSlots, shiftTime, defaultTime, type MealSlot, type PpFasting, type Weekday, type PpMeasures } from '../../types';
import { Chip, ChoiceCard, CheckRow, Note, Panel, PpButton, PpCard, Row, Section, Stepper, TargetCurve, Toggle, usePp } from '../../ui/parts';

export interface StepNav {
  next: () => void;
  /** Bildiklerimiz'den düzenleme: "Devam et" Bildiklerimiz'e döner. */
  continueLabel?: string;
  /** İzmir'de mi (eatkcal anahtarı yalnız orada). */
  izmir?: boolean;
}

const YEAR = () => new Date().getFullYear();
const LB = 2.20462;

function useLang(): Lang {
  return useT().lang === 'en' ? 'en' : 'tr';
}

function Footer({ step, next, label }: { step: QuestionStep; next: () => void; label?: string }) {
  const i18n = useT();
  const answers = usePpFlow((s) => s.answers);
  const ok = stepComplete(step, answers, YEAR());
  return <PpButton label={label ?? i18n.t('pp.continue')} onPress={next} disabled={!ok} testID={`pp-next-${step}`} />;
}

// ── 1 Hedef ─────────────────────────────────────────────────────────────────
export function GoalStep({ next, continueLabel }: StepNav) {
  const i18n = useT();
  const lang = useLang();
  const { goal, weightKg, heightCm } = usePpFlow((s) => s.answers);
  const set = usePpFlow((s) => s.set);
  const loseOk = canOfferLose(weightKg, heightCm);
  const lowBmi = !loseOk;
  const GOALS: PpGoal[] = ['lose', 'maintain', 'gain', 'balanced'];
  return (
    <PpCard
      title={i18n.t('pp.goal_title')}
      sub={i18n.t('pp.goal_sub')}
      glass="trophy"
      hint={!goal || (goal === 'lose' && !loseOk) ? i18n.t('pp.goal_pick') : undefined}
      footer={<Footer step="goal" next={next} label={continueLabel} />}
    >
      {lowBmi ? <Note testID="pp-lowbmi" text={i18n.t('pp.lowbmi_note', { bmi: fmtNum(bmi(weightKg!, heightCm!), lang, 1) })} /> : null}
      <View style={{ marginTop: lowBmi ? 12 : 0 }}>
        {GOALS.map((g) => {
          if (g === 'lose' && lowBmi) return null; // VKİ < 18,5: "Kilo ver" sunulmaz
          return (
            <ChoiceCard
              key={g}
              testID={`pp-goal-${g}`}
              title={i18n.t(`pp.goal_${g}`)}
              sub={i18n.t(`pp.goal_${g}_sub`)}
              selected={goal === g}
              badge={lowBmi && (g === 'maintain' || g === 'balanced') ? i18n.t('pp.suggested') : undefined}
              onPress={() => {
                const patch: Record<string, unknown> = { goal: g };
                if (goalNeedsTarget(g) && weightKg && heightCm) {
                  patch.targetWeightKg = suggestTarget(g, weightKg, heightCm);
                  patch.pace = clampPace(g, 0.5, weightKg);
                }
                set(patch);
              }}
            />
          );
        })}
      </View>
      <Note text={i18n.t('pp.safety_note')} />
    </PpCard>
  );
}

// ── 2 Temel bilgiler ───────────────────────────────────────────────────────
function ExpandRow({ label, value, open, onToggle, children, testID }: { label: string; value: string; open: boolean; onToggle: () => void; children: React.ReactNode; testID?: string }) {
  const P = usePp();
  return (
    <View style={[styles.exRow, { backgroundColor: P.field }]}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${label}, ${value}`} style={styles.exHead} testID={testID}>
        <AppText textRole="bodySm" style={{ color: P.ink, flex: 1 }}>
          {label}
        </AppText>
        <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {value}
        </AppText>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }], marginLeft: 6 }}>
          <CaretDown size={14} color={P.sec} />
        </View>
      </Pressable>
      {open ? <View style={{ paddingBottom: 12 }}>{children}</View> : null}
    </View>
  );
}

function UnitSwitch({ units, onChange, a, b }: { units: 'metric' | 'imperial'; onChange: (u: 'metric' | 'imperial') => void; a: string; b: string }) {
  return (
    <View style={{ gap: 8, width: 64 }}>
      <Chip label={a} selected={units === 'metric'} onPress={() => onChange('metric')} />
      <Chip label={b} selected={units === 'imperial'} onPress={() => onChange('imperial')} />
    </View>
  );
}

const range = (from: number, to: number, step = 1) => {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
  return out;
};

export function BasicsStep({ next, continueLabel }: StepNav) {
  const i18n = useT();
  const lang = useLang();
  const a = usePpFlow((s) => s.answers);
  const set = usePpFlow((s) => s.set);
  const [open, setOpen] = useState<'birth' | 'height' | 'weight' | null>(a.birthYear ? null : 'birth');
  const y = YEAR();
  const years = useMemo(() => range(y - 90, y - 13).reverse(), [y]);
  const heights = useMemo(() => range(120, 220), []);
  const kgs = useMemo(() => range(35, 200, 0.5), []);
  const lbs = useMemo(() => range(77, 440), []);
  const imperial = a.units === 'imperial';
  const GENDERS: PpGender[] = ['female', 'male', 'unspecified'];
  const weightShown = a.weightKg ? (imperial ? `${Math.round(a.weightKg * LB)} ${i18n.t('pp.lb')}` : `${fmtKg(a.weightKg, lang)} ${i18n.t('pp.kg')}`) : '–';
  return (
    <PpCard title={i18n.t('pp.basics_title')} sub={i18n.t('pp.basics_sub')} glass="drop" footer={<Footer step="basics" next={next} label={continueLabel} />}>
      <AppText textRole="helper" style={{ color: usePp().sec, marginBottom: 8 }}>
        {i18n.t('pp.gender_label')}
      </AppText>
      <View style={styles.row3}>
        {GENDERS.map((g) => (
          <Chip key={g} flex label={i18n.t(`pp.gender_${g}`)} selected={a.gender === g} onPress={() => set({ gender: g })} />
        ))}
      </View>
      <View style={{ gap: 10, marginTop: 14 }}>
        <ExpandRow
          testID="pp-birth"
          label={i18n.t('pp.birth_label')}
          value={a.birthYear ? `${a.birthYear}  ${i18n.t('pp.age_suffix', { age: y - a.birthYear })}` : '–'}
          open={open === 'birth'}
          onToggle={() => setOpen(open === 'birth' ? null : 'birth')}
        >
          <WheelPicker label={i18n.t('pp.birth_label')} values={years} value={a.birthYear ?? y - 30} onChange={(v) => set({ birthYear: v })} />
        </ExpandRow>
        <ExpandRow
          testID="pp-height"
          label={i18n.t('pp.height_label')}
          value={a.heightCm ? `${a.heightCm} ${i18n.t('pp.cm')}` : '–'}
          open={open === 'height'}
          onToggle={() => setOpen(open === 'height' ? null : 'height')}
        >
          <WheelPicker label={i18n.t('pp.height_label')} values={heights} value={a.heightCm ?? 168} onChange={(v) => set({ heightCm: v })} />
        </ExpandRow>
        <ExpandRow testID="pp-weight" label={i18n.t('pp.weight_label')} value={weightShown} open={open === 'weight'} onToggle={() => setOpen(open === 'weight' ? null : 'weight')}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {imperial ? (
              <WheelPicker label={i18n.t('pp.weight_label')} values={lbs} value={Math.round((a.weightKg ?? 70) * LB)} onChange={(v) => set({ weightKg: Math.round((v / LB) * 10) / 10 })} />
            ) : (
              <WheelPicker label={i18n.t('pp.weight_label')} values={kgs} value={Math.round((a.weightKg ?? 70) * 2) / 2} onChange={(v) => set({ weightKg: v })} />
            )}
            <UnitSwitch units={a.units} onChange={(u) => set({ units: u })} a={i18n.t('pp.kg')} b={i18n.t('pp.lb')} />
          </View>
        </ExpandRow>
      </View>
      <AppText textRole="helper" style={{ color: usePp().sec, marginTop: 12 }}>
        {i18n.t('pp.basics_note')}
      </AppText>
    </PpCard>
  );
}

// ── 3 Hedef kilo ve hız (+ Kalori tabanı hâli) ──────────────────────────────
export function TargetStep({ next, continueLabel }: StepNav) {
  const i18n = useT();
  const lang = useLang();
  const P = usePp();
  const { width } = useWindowDimensions();
  const a = usePpFlow((s) => s.answers);
  const set = usePpFlow((s) => s.set);
  const goal = a.goal ?? 'lose';
  const w = a.weightKg ?? 70;
  const h = a.heightCm ?? 168;
  const rg = targetRange(goal, w, h);
  const values = useMemo(() => range(rg.min, rg.max, 0.5), [rg.min, rg.max]);
  const target = a.targetWeightKg ?? suggestTarget(goal, w, h) ?? w;
  const today = isoDay(new Date());
  const imperial = a.units === 'imperial';
  // Hareket henüz sorulmadıysa (b yolu) taban hesabı Sonuç'ta gösterilir.
  const plan = useMemo(
    () =>
      computePlan(
        { goal, gender: a.gender ?? 'female', birthYear: a.birthYear ?? YEAR() - 30, heightCm: h, weightKg: w, activity: (a.activity ?? 'light') as PpActivity, targetWeightKg: target, pace: a.pace },
        YEAR(),
        today,
      ),
    [goal, a.gender, a.birthYear, h, w, a.activity, target, a.pace, today],
  );
  const showFloor = !!a.activity && !!plan?.steps.floored;
  const weeksFor = (p: PpPace) => Math.ceil(Math.abs(w - target) / p - 1e-9);
  const offPace = paceOptions(goal).find((p) => !paceAllowed(goal, p, w));
  return (
    <PpCard
      title={i18n.t('pp.target_title')}
      sub={i18n.t('pp.target_sub', { kg: fmtKg(w, lang) })}
      glass="trophy"
      footer={<Footer step="target" next={next} label={continueLabel} />}
    >
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {imperial ? (
          <WheelPicker
            label={i18n.t('pp.target_title')}
            values={values.map((v) => Math.round(v * LB))}
            value={Math.round(target * LB)}
            onChange={(v) => set({ targetWeightKg: Math.round(((v / LB) * 2)) / 2 })}
          />
        ) : (
          <WheelPicker label={i18n.t('pp.target_title')} values={values} value={Math.min(rg.max, Math.max(rg.min, target))} onChange={(v) => set({ targetWeightKg: v })} />
        )}
        <UnitSwitch units={a.units} onChange={(u) => set({ units: u })} a={i18n.t('pp.kg')} b={i18n.t('pp.lb')} />
      </View>
      <Section title={i18n.t('pp.pace_label')}>
        <View style={styles.row3}>
          {paceOptions(goal).map((p) => {
            const allowed = paceAllowed(goal, p, w);
            return (
              <Chip
                key={p}
                flex
                label={i18n.t('pp.pace_opt', { kg: fmtPace(p, lang) })}
                sub={allowed ? i18n.t('pp.pace_weeks', { n: weeksFor(p) }) : i18n.t('pp.pace_off')}
                selected={a.pace === p && allowed}
                disabled={!allowed}
                onPress={() => set({ pace: p })}
              />
            );
          })}
        </View>
        {offPace ? <Note text={i18n.t('pp.pace_off_note', { pace: fmtPace(offPace, lang), kg: fmtKg(w, lang), max: fmtPace(maxWeeklyKg(w), lang) })} /> : null}
      </Section>
      {plan ? (
        <Panel style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.target_date')}
              </AppText>
              <AppText textRole="section" style={{ color: P.ink }} testID="pp-target-date">
                {plan.targetDate ? fmtDate(plan.targetDate, lang) : '–'}
              </AppText>
            </View>
            {plan.weeks ? (
              <View style={[styles.badge, { backgroundColor: P.accent }]}>
                <AppText textRole="helper" style={{ color: P.onAccent, fontWeight: '700' }}>
                  {showFloor ? i18n.t('pp.floor_badge', { n: plan.weeks }) : i18n.t('pp.weeks_short', { n: plan.weeks })}
                </AppText>
              </View>
            ) : null}
          </View>
          <TargetCurve
            width={width - 24 - 40 - 28}
            fromKg={w}
            toKg={target}
            topLabel={`${fmtKg(w, lang)} ${i18n.t('pp.kg')}`}
            endLabel=""
            leftLabel={i18n.t('pp.today_kg', { kg: fmtKg(w, lang) })}
            rightLabel={plan.targetDate ? `${fmtDate(plan.targetDate, lang)}, ${fmtKg(target, lang)} ${i18n.t('pp.kg')}` : `${fmtKg(target, lang)} ${i18n.t('pp.kg')}`}
            a11y={`${i18n.t('pp.target_date')}: ${plan.targetDate ? fmtDate(plan.targetDate, lang) : '–'}`}
          />
        </Panel>
      ) : null}
      {showFloor && plan ? (
        <Note
          testID="pp-floor-note"
          text={
            plan.unreachable
              ? i18n.t('pp.floor_unreachable', { floor: plan.steps.floor })
              : i18n.t('pp.floor_note', {
                  raw: Math.round(plan.steps.rawCalories),
                  floor: plan.steps.floor,
                  pace: fmtPace(plan.effectivePace, lang),
                  from: fmtDate(plan.requestedTargetDate, lang),
                  to: fmtDate(plan.targetDate, lang),
                })
          }
        />
      ) : null}
      <Note text={i18n.t('pp.safety_note')} />
    </PpCard>
  );
}

// ── 4 Hareket ───────────────────────────────────────────────────────────────
export function ActivityStep({ next, continueLabel }: StepNav) {
  const i18n = useT();
  const lang = useLang();
  const a = usePpFlow((s) => s.answers);
  const set = usePpFlow((s) => s.set);
  const ACTS: { k: PpActivity; f: number }[] = [
    { k: 'sedentary', f: 1.2 },
    { k: 'light', f: 1.375 },
    { k: 'moderate', f: 1.55 },
    { k: 'active', f: 1.725 },
  ];
  return (
    <PpCard title={i18n.t('pp.activity_title')} sub={i18n.t('pp.activity_sub')} glass="foot" footer={<Footer step="activity" next={next} label={continueLabel} />}>
      {ACTS.map(({ k, f }) => (
        <ChoiceCard
          key={k}
          testID={`pp-act-${k}`}
          title={i18n.t(`pp.act_${k}`)}
          sub={i18n.t(`pp.act_${k}_sub`)}
          trailing={i18n.t('pp.factor', { f: fmtNum(f, lang, 3) })}
          selected={a.activity === k}
          onPress={() => set({ activity: k })}
        />
      ))}
      <Section title={i18n.t('pp.steps_label')}>
        <Stepper label={i18n.t('pp.steps_label')} value={a.steps ?? 6000} onChange={(v) => set({ steps: v })} min={0} max={30000} step={500} />
        <AppText textRole="helper" style={{ color: usePp().sec, marginTop: 8 }}>
          {i18n.t('pp.steps_hint')}
        </AppText>
      </Section>
    </PpCard>
  );
}

// ── 5 Egzersiz ──────────────────────────────────────────────────────────────
export function ExerciseStep({ next, continueLabel }: StepNav) {
  const i18n = useT();
  const P = usePp();
  const a = usePpFlow((s) => s.answers);
  const set = usePpFlow((s) => s.set);
  const none = a.exercise.includes('none');
  const toggle = (e: (typeof PP_EXERCISES)[number]) => {
    if (e === 'none') return set({ exercise: none ? [] : ['none'], exerciseDays: none ? a.exerciseDays : 0 });
    const cur = a.exercise.filter((x) => x !== 'none');
    set({ exercise: cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e], exerciseDays: a.exerciseDays || 3 });
  };
  const toggleDay = (d: Weekday) => {
    const has = a.exerciseWeekdays.includes(d);
    const days = (has ? a.exerciseWeekdays.filter((x) => x !== d) : [...a.exerciseWeekdays, d]).sort() as Weekday[];
    set({ exerciseWeekdays: days, exerciseDays: days.length });
  };
  return (
    <PpCard title={i18n.t('pp.exercise_title')} sub={i18n.t('pp.exercise_sub')} glass="foot" footer={<Footer step="exercise" next={next} label={continueLabel} />}>
      <View style={styles.grid2}>
        {PP_EXERCISES.map((e) => (
          <View key={e} style={styles.cell2}>
            <Chip label={i18n.t(`pp.ex_${e}`)} selected={a.exercise.includes(e)} onPress={() => toggle(e)} />
          </View>
        ))}
      </View>
      {!none && a.exercise.length > 0 ? (
        <>
          <Row label={i18n.t('pp.ex_days')}>
            <Stepper
              label={i18n.t('pp.ex_days')}
              value={a.exerciseDays}
              min={1}
              max={7}
              onChange={(v) => {
                const all: Weekday[] = [0, 2, 4, 1, 3, 5, 6];
                set({ exerciseDays: v, exerciseWeekdays: all.slice(0, v).sort() as Weekday[] });
              }}
            />
          </Row>
          <Section title={i18n.t('pp.ex_minutes')}>
            <View style={styles.row5}>
              {PP_EXERCISE_MINUTES.map((m) => (
                <Chip key={m} flex label={i18n.t('pp.ex_min', { n: m })} selected={a.exerciseMinutes === m} onPress={() => set({ exerciseMinutes: m })} />
              ))}
            </View>
          </Section>
          <Panel style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.ex_calendar')}
              </AppText>
              <AppText textRole="helper" style={{ color: P.ink, fontWeight: '700' }}>
                {i18n.t('pp.ex_calendar_sum', { days: a.exerciseWeekdays.length, min: a.exerciseWeekdays.length * a.exerciseMinutes })}
              </AppText>
            </View>
            <View style={styles.row7}>
              {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => (
                <Chip
                  key={d}
                  flex
                  label={i18n.t(`pp.wd_${d}`)}
                  sub={a.exerciseWeekdays.includes(d) ? i18n.t('pp.ex_min', { n: a.exerciseMinutes }) : undefined}
                  selected={a.exerciseWeekdays.includes(d)}
                  onPress={() => toggleDay(d)}
                />
              ))}
            </View>
          </Panel>
          <AppText textRole="helper" style={{ color: P.sec, marginTop: 10 }}>
            {i18n.t('pp.ex_note')}
          </AppText>
        </>
      ) : null}
    </PpCard>
  );
}

// ── 6 Ölçüler (isteğe bağlı) ────────────────────────────────────────────────
type MKey = keyof PpMeasures;
const M_DEFAULT: Record<MKey, number> = { waistCm: 80, hipCm: 100, chestCm: 95, armCm: 30, bodyFatPct: 25 };
const M_RANGE: Record<MKey, [number, number, number]> = { waistCm: [40, 200, 1], hipCm: [50, 200, 1], chestCm: [50, 200, 1], armCm: [15, 70, 1], bodyFatPct: [3, 60, 0.5] };
const M_LABEL: Record<MKey, string> = { waistCm: 'm_waist', hipCm: 'm_hip', chestCm: 'm_chest', armCm: 'm_arm', bodyFatPct: 'm_fat' };

export function MeasureStep({ next, continueLabel }: StepNav) {
  const i18n = useT();
  const lang = useLang();
  const P = usePp();
  const a = usePpFlow((s) => s.answers);
  const set = usePpFlow((s) => s.set);
  const [sel, setSel] = useState<MKey | null>(a.measures.waistCm != null ? 'waistCm' : null);
  const unit = (k: MKey) => (k === 'bodyFatPct' ? i18n.t('pp.m_fat_unit') : i18n.t('pp.cm'));
  const show = (k: MKey) => {
    const v = a.measures[k];
    return v == null ? i18n.t('pp.m_add') : k === 'bodyFatPct' ? `${fmtNum(v, lang, 1)} ${unit(k)}` : `${v} ${unit(k)}`;
  };
  const setM = (k: MKey, v: number | null) => set({ measures: { ...a.measures, [k]: v }, measuresSkipped: false });
  return (
    <PpCard title={i18n.t('pp.measure_title')} sub={i18n.t('pp.measure_sub')} glass="foot" footer={<Footer step="measure" next={next} label={continueLabel} />}>
      <View style={{ gap: 8 }}>
        {(Object.keys(M_LABEL) as MKey[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              if (a.measures[k] == null) setM(k, M_DEFAULT[k]);
              setSel(k);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: sel === k }}
            accessibilityLabel={`${i18n.t(`pp.${M_LABEL[k]}`)}, ${show(k)}`}
            style={[styles.mRow, sel === k ? { backgroundColor: P.accent } : { backgroundColor: P.field }]}
          >
            <AppText textRole="bodySm" style={{ color: sel === k ? P.onAccent : P.ink, flex: 1, fontWeight: sel === k ? '700' : '400' }}>
              {i18n.t(`pp.${M_LABEL[k]}`)}
            </AppText>
            <AppText textRole="bodySm" style={{ color: sel === k ? P.onAccent : a.measures[k] == null ? P.sec : P.ink, fontVariant: ['tabular-nums'] }}>
              {show(k)}
            </AppText>
          </Pressable>
        ))}
      </View>
      {sel && a.measures[sel] != null ? (
        <Panel style={{ marginTop: 14 }}>
          <Row label={i18n.t(`pp.${M_LABEL[sel]}`)} sub={sel === 'waistCm' ? i18n.t('pp.m_waist_hint') : undefined} last>
            <Stepper
              label={i18n.t(`pp.${M_LABEL[sel]}`)}
              value={a.measures[sel] as number}
              display={sel === 'bodyFatPct' ? `${fmtNum(a.measures[sel] as number, lang, 1)} ${unit(sel)}` : `${a.measures[sel]} ${unit(sel)}`}
              min={M_RANGE[sel][0]}
              max={M_RANGE[sel][1]}
              step={M_RANGE[sel][2]}
              onChange={(v) => setM(sel, v)}
            />
          </Row>
          <PpButton kind="link" label={i18n.t('common.delete')} onPress={() => { setM(sel, null); setSel(null); }} />
        </Panel>
      ) : null}
      <Note text={i18n.t('pp.m_note')} />
    </PpCard>
  );
}

// ── 7 Beslenme ──────────────────────────────────────────────────────────────
export function DietStep({ next, continueLabel }: StepNav) {
  const i18n = useT();
  const P = usePp();
  const a = usePpFlow((s) => s.answers);
  const set = usePpFlow((s) => s.set);
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <PpCard title={i18n.t('pp.diet_title')} sub={i18n.t('pp.diet_sub')} glass="bowl" footer={<Footer step="diet" next={next} label={continueLabel} />}>
      <View style={styles.grid2}>
        {PP_DIETS.map((d) => (
          <View key={d} style={styles.cell2}>
            <Chip label={i18n.t(`pp.diet_${d}`)} selected={a.diet === d} onPress={() => set({ diet: d })} />
          </View>
        ))}
      </View>
      <Section title={i18n.t('pp.dislikes')}>
        <View style={styles.wrap}>
          {PP_DISLIKES.map((d) => (
            <Chip key={d} label={i18n.t(`pp.dl_${d}`)} selected={a.dislikes.includes(d)} onPress={() => set({ dislikes: toggleIn(a.dislikes, d) })} />
          ))}
        </View>
      </Section>
      <Section title={i18n.t('pp.allergy_title')}>
        <AppText textRole="helper" style={{ color: P.sec, marginBottom: 8 }}>
          {i18n.t('pp.allergy_sub')}
        </AppText>
        <CheckRow
          testID="pp-allergy-consent"
          checked={a.consentAllergy}
          onToggle={() => set({ consentAllergy: !a.consentAllergy, allergens: a.consentAllergy ? [] : a.allergens })}
          label={i18n.t('pp.consent_allergy')}
          draftLabel={i18n.t('pp.consent_draft')}
        />
        <View style={[styles.wrap, { marginTop: 10 }]}>
          {PP_ALLERGENS.map((al) => (
            <Chip key={al} label={i18n.t(`pp.al_${al}`)} selected={a.allergens.includes(al)} disabled={!a.consentAllergy} onPress={() => set({ allergens: toggleIn(a.allergens, al) })} />
          ))}
        </View>
        {!a.consentAllergy ? (
          <AppText textRole="helper" style={{ color: P.sec, marginTop: 8 }}>
            {i18n.t('pp.allergy_locked')}
          </AppText>
        ) : null}
      </Section>
    </PpCard>
  );
}

// ── 8 Öğün düzeni ───────────────────────────────────────────────────────────
export function MealsStep({ next, izmir }: StepNav) {
  const i18n = useT();
  const P = usePp();
  const a = usePpFlow((s) => s.answers);
  const set = usePpFlow((s) => s.set);
  const m = a.meals;
  const slots = mealSlots(m.main, m.snack);
  const setMeals = (patch: Partial<typeof m>) => {
    const nm = { ...m, ...patch };
    const times = { ...nm.times };
    for (const s of mealSlots(nm.main, nm.snack)) if (!times[s]) times[s] = defaultTime(s);
    set({ meals: { ...nm, times } });
  };
  const FAST: PpFasting[] = ['off', '14:10', '16:8'];
  return (
    <PpCard
      title={i18n.t('pp.meals_title')}
      sub={i18n.t('pp.meals_sub')}
      glass="bowl"
      footer={<Footer step="meals" next={next} label={i18n.t('pp.calc_cta')} />}
    >
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ flex: 1 }}>
          <AppText textRole="helper" style={{ color: P.sec, marginBottom: 6 }}>
            {i18n.t('pp.main_meals')}
          </AppText>
          <Stepper label={i18n.t('pp.main_meals')} value={m.main} min={2} max={3} onChange={(v) => setMeals({ main: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText textRole="helper" style={{ color: P.sec, marginBottom: 6 }}>
            {i18n.t('pp.snacks')}
          </AppText>
          <Stepper label={i18n.t('pp.snacks')} value={m.snack} min={0} max={2} onChange={(v) => setMeals({ snack: v })} />
        </View>
      </View>
      <Section title={i18n.t('pp.times')}>
        <Panel style={{ paddingVertical: 4 }}>
          {slots.map((s: MealSlot, i) => {
            const t = m.times[s] ?? defaultTime(s);
            const label = i18n.t(`pp.slot_${s}`);
            return (
              <Row key={s} label={label} last={i === slots.length - 1}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessible accessibilityRole="adjustable" accessibilityLabel={i18n.t('pp.time_a11y', { slot: label, time: t })}
                  accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                  onAccessibilityAction={(e) => setMeals({ times: { ...m.times, [s]: shiftTime(t, e.nativeEvent.actionName === 'increment' ? 15 : -15) } })}
                >
                  <Pressable onPress={() => setMeals({ times: { ...m.times, [s]: shiftTime(t, -15) } })} style={styles.timeBtn} accessibilityRole="button" accessibilityLabel={i18n.t('pp.time_earlier', { slot: label })}>
                    <AppText style={{ color: P.ink, fontSize: 18 }}>−</AppText>
                  </Pressable>
                  <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'center' }}>
                    {t}
                  </AppText>
                  <Pressable onPress={() => setMeals({ times: { ...m.times, [s]: shiftTime(t, 15) } })} style={styles.timeBtn} accessibilityRole="button" accessibilityLabel={i18n.t('pp.time_later', { slot: label })}>
                    <AppText style={{ color: P.ink, fontSize: 18 }}>+</AppText>
                  </Pressable>
                </View>
              </Row>
            );
          })}
        </Panel>
      </Section>
      <Section title={i18n.t('pp.fasting')}>
        <View style={styles.row3}>
          {FAST.map((f) => (
            <Chip key={f} flex label={f === 'off' ? i18n.t('pp.fasting_off') : f} selected={m.fasting === f} onPress={() => setMeals({ fasting: f })} />
          ))}
        </View>
      </Section>
      {izmir ? (
        <Panel style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
              {i18n.t('pp.eatkcal_toggle')}
            </AppText>
            <AppText textRole="helper" style={{ color: P.sec, marginTop: 2 }}>
              {i18n.t('pp.eatkcal_sub')}
            </AppText>
          </View>
          <Toggle value={m.eatkcal} onChange={(v) => setMeals({ eatkcal: v })} label={i18n.t('pp.eatkcal_toggle')} />
        </Panel>
      ) : null}
    </PpCard>
  );
}

const styles = StyleSheet.create({
  row3: { flexDirection: 'row', gap: 8 },
  row5: { flexDirection: 'row', gap: 6 },
  row7: { flexDirection: 'row', gap: 4 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  cell2: { width: '50%', padding: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exRow: { borderRadius: 14, paddingHorizontal: 14 },
  exHead: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  mRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderRadius: 12, paddingHorizontal: 14 },
  timeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
