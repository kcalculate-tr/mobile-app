// G34-S1 · Tur 26o — Giriş (açık rıza), Bildiklerimiz (a yolu), Kaldığın yerden, Çıkış onayı,
// 18 yaş altı bilgi ekranı (01-akis-adimlar.png).
import React from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../../core/design/components/AppText';
import { Sheet } from '../../../../core/design/components/Sheet';
import { useT } from '../../../../core/i18n';
import { legalWebUrl } from '../../../../lib/legal/urls';
import { fmtKg, type Lang } from '../../format';
import { questionSteps, remainingQuestions, type FlowCtx, type FlowStep, type QuestionStep } from '../../flow';
import { usePpFlow } from '../../store';
import { CheckRow, GLASS, Panel, PpButton, PpCard, usePp } from '../../ui/parts';

const YEAR = () => new Date().getFullYear();

function useLang(): Lang {
  return useT().lang === 'en' ? 'en' : 'tr';
}

// ── Giriş ───────────────────────────────────────────────────────────────────
export function IntroStep({ next, consentDone }: { next: () => void; consentDone: boolean }) {
  const i18n = useT();
  const P = usePp();
  const known = usePpFlow((s) => s.known);
  const consent = usePpFlow((s) => s.answers.consentHealth);
  const set = usePpFlow((s) => s.set);
  const ok = consent || consentDone;
  const Item = ({ glass, title, tag, sub, paid }: { glass: keyof typeof GLASS; title: string; tag?: string; sub?: string; paid?: boolean }) => (
    <View style={[styles.item, { backgroundColor: P.field }]} accessible accessibilityLabel={[title, tag, sub].filter(Boolean).join('. ')}>
      <Image source={GLASS[glass]} style={styles.itemGlass} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
          {title}
        </AppText>
        {tag ? (
          <View style={[styles.tag, { backgroundColor: paid ? P.track : P.accent }]}>
            <AppText textRole="helper" style={{ color: paid ? P.ink : P.onAccent, fontSize: 11, fontWeight: '700' }}>
              {tag}
            </AppText>
          </View>
        ) : null}
        {sub ? (
          <AppText textRole="helper" style={{ color: P.sec, marginTop: 2 }}>
            {sub}
          </AppText>
        ) : null}
      </View>
    </View>
  );
  return (
    <PpCard
      title={i18n.t(known ? 'pp.intro_title_known' : 'pp.intro_title')}
      sub={i18n.t('pp.intro_sub')}
      hint={ok ? undefined : i18n.t('pp.consent_hint')}
      footer={<PpButton label={i18n.t('pp.start')} onPress={next} disabled={!ok} testID="pp-start" />}
    >
      <View style={{ gap: 8 }}>
        <Item glass="flame" title={i18n.t('pp.intro_kcal')} tag={i18n.t('pp.intro_kcal_tag')} />
        <Item glass="bowl" title={i18n.t('pp.intro_week')} tag={i18n.t('pp.intro_week_tag')} paid />
        <Item glass="trophy" title={i18n.t('pp.intro_date')} sub={i18n.t('pp.intro_date_sub')} />
      </View>
      <AppText textRole="section" style={{ color: P.ink, marginTop: 18, marginBottom: 12 }}>
        {i18n.t('pp.brand_line')}
      </AppText>
      <CheckRow
        testID="pp-consent"
        checked={consent}
        done={consentDone}
        doneLabel={i18n.t('pp.consent_health_done')}
        onToggle={() => set({ consentHealth: !consent })}
        label={i18n.t('pp.consent_health')}
        draftLabel={i18n.t('pp.consent_draft')}
      />
      <Pressable onPress={() => void Linking.openURL(legalWebUrl('privacy', i18n.lang))} accessibilityRole="link" style={styles.link} hitSlop={6}>
        <AppText textRole="helper" style={{ color: P.ink, textDecorationLine: 'underline' }}>
          {i18n.t('pp.consent_notice')}
        </AppText>
      </Pressable>
    </PpCard>
  );
}

// ── Bildiklerimiz ───────────────────────────────────────────────────────────
export function KnownStep({ next, edit, ctx }: { next: () => void; edit: (s: QuestionStep) => void; ctx: FlowCtx }) {
  const i18n = useT();
  const lang = useLang();
  const P = usePp();
  const a = usePpFlow((s) => s.answers);
  const left = questionSteps(ctx);
  const names: Record<QuestionStep, string> = {
    goal: i18n.t('pp.known_goal'),
    basics: i18n.t('pp.basics_title'),
    target: i18n.t('pp.target_title').toLocaleLowerCase(lang),
    activity: i18n.t('pp.known_activity').toLocaleLowerCase(lang),
    exercise: i18n.t('pp.exercise_title').toLocaleLowerCase(lang),
    measure: i18n.t('pp.measure_title').toLocaleLowerCase(lang),
    diet: i18n.t('pp.diet_title').toLocaleLowerCase(lang),
    meals: i18n.t('pp.meals_title').toLocaleLowerCase(lang),
  };
  const rows: { label: string; value: string; step: QuestionStep }[] = [
    { label: i18n.t('pp.known_goal'), value: a.goal ? i18n.t(`pp.goal_${a.goal}`) : '–', step: 'goal' },
    { label: i18n.t('pp.known_gender'), value: a.gender ? i18n.t(`pp.gender_${a.gender}`) : '–', step: 'basics' },
    { label: i18n.t('pp.known_birth'), value: a.birthYear ? i18n.t('pp.known_birth_v', { year: a.birthYear, age: YEAR() - a.birthYear }) : '–', step: 'basics' },
    { label: i18n.t('pp.known_height'), value: a.heightCm ? `${a.heightCm} ${i18n.t('pp.cm')}` : '–', step: 'basics' },
    { label: i18n.t('pp.known_weight'), value: a.weightKg ? `${fmtKg(a.weightKg, lang)} ${i18n.t('pp.kg')}` : '–', step: 'basics' },
    { label: i18n.t('pp.known_activity'), value: a.activity ? i18n.t(`pp.act_${a.activity}`) : '–', step: 'activity' },
  ];
  return (
    <PpCard
      title={i18n.t('pp.known_title')}
      sub={i18n.t('pp.known_sub')}
      glass="trophy"
      footer={<PpButton label={i18n.t('pp.continue_ok')} onPress={next} testID="pp-known-next" />}
    >
      <Panel style={{ paddingVertical: 2 }}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.kRow, i < rows.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.line } : null]}>
            <View style={{ flex: 1 }}>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {r.label}
              </AppText>
              <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '600' }}>
                {r.value}
              </AppText>
            </View>
            <Pressable onPress={() => edit(r.step)} accessibilityRole="button" accessibilityLabel={i18n.t('pp.edit_a11y', { label: r.label })} style={styles.editBtn} hitSlop={4}>
              <AppText textRole="helper" style={{ color: P.ink, textDecorationLine: 'underline' }}>
                {i18n.t('pp.edit')}
              </AppText>
            </Pressable>
          </View>
        ))}
      </Panel>
      <AppText textRole="helper" style={{ color: P.sec, marginTop: 12 }}>
        {i18n.t('pp.known_left', { n: left.length, list: left.map((s) => names[s]).join(', ') })}
      </AppText>
    </PpCard>
  );
}

// ── Kaldığın yerden ─────────────────────────────────────────────────────────
export function ResumeStep({ step, ctx, onContinue, onRestart }: { step: FlowStep; ctx: FlowCtx; onContinue: () => void; onRestart: () => void }) {
  const i18n = useT();
  const lang = useLang();
  const P = usePp();
  const a = usePpFlow((s) => s.answers);
  const qs = questionSteps(ctx);
  const idx = qs.indexOf(step as QuestionStep);
  const n = remainingQuestions(step, ctx);
  const titles: Partial<Record<FlowStep, string>> = {
    known: i18n.t('pp.known_title'),
    goal: i18n.t('pp.goal_title'),
    basics: i18n.t('pp.basics_title'),
    target: i18n.t('pp.target_title'),
    activity: i18n.t('pp.activity_title'),
    exercise: i18n.t('pp.exercise_title'),
    measure: i18n.t('pp.measure_title'),
    diet: i18n.t('pp.diet_title'),
    meals: i18n.t('pp.meals_title'),
    result: i18n.t('pp.result_title'),
  };
  const saved: string[] = [];
  if (a.goal) saved.push(i18n.t(`pp.goal_${a.goal}`));
  if (a.targetWeightKg && (a.goal === 'lose' || a.goal === 'gain')) saved.push(`${i18n.t('pp.goal_label')} ${fmtKg(a.targetWeightKg, lang)} ${i18n.t('pp.kg')}`);
  if (a.goal === 'lose' || a.goal === 'gain') saved.push(i18n.t('pp.pace_v', { pace: String(a.pace).replace('.', lang === 'tr' ? ',' : '.') }));
  if (a.activity) saved.push(i18n.t(`pp.act_${a.activity}`));
  return (
    <PpCard
      center
      footer={
        <View style={{ gap: 6 }}>
          <PpButton label={i18n.t('pp.continue')} onPress={onContinue} testID="pp-resume" />
          <PpButton kind="link" label={i18n.t('pp.resume_restart')} onPress={onRestart} a11yHint={i18n.t('pp.resume_restart_sub')} testID="pp-restart" />
          <AppText textRole="helper" style={{ color: P.sec, textAlign: 'center' }}>
            {i18n.t('pp.resume_restart_sub')}
          </AppText>
        </View>
      }
    >
      <Image source={GLASS.trophy} style={styles.bigGlass} resizeMode="contain" />
      <AppText textRole="screenTitle" style={{ color: P.ink }} accessibilityRole="header">
        {i18n.t('pp.resume_title')}
      </AppText>
      <AppText textRole="bodySm" style={{ color: P.sec, marginTop: 6 }}>
        {i18n.t('pp.resume_sub', { n })}
      </AppText>
      <Panel style={{ marginTop: 16 }}>
        <AppText textRole="helper" style={{ color: P.sec }}>
          {i18n.t('pp.resume_next')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700', flex: 1 }}>
            {titles[step] ?? ''}
          </AppText>
          {idx >= 0 ? (
            <View style={[styles.tag, { backgroundColor: P.accent, marginTop: 0 }]}>
              <AppText textRole="helper" style={{ color: P.onAccent, fontWeight: '700' }}>
                {i18n.t('pp.step', { n: idx + 1, total: qs.length })}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText textRole="helper" style={{ color: P.sec, marginTop: 6 }}>
          {i18n.t('pp.resume_time')}
        </AppText>
      </Panel>
      {saved.length ? (
        <View style={{ marginTop: 12 }}>
          <AppText textRole="helper" style={{ color: P.sec, marginBottom: 6 }}>
            {i18n.t('pp.resume_saved')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {saved.map((s) => (
              <View key={s} style={[styles.savedChip, { backgroundColor: P.field }]}>
                <AppText textRole="helper" style={{ color: P.ink }}>
                  {s}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </PpCard>
  );
}

// ── Çıkış onayı ─────────────────────────────────────────────────────────────
export function ExitSheet({ visible, onStay, onLeave }: { visible: boolean; onStay: () => void; onLeave: () => void }) {
  const i18n = useT();
  const P = usePp();
  return (
    <Sheet visible={visible} onClose={onStay} title={i18n.t('pp.exit_title')} testID="pp-exit-sheet">
      <Image source={GLASS.trophy} style={{ width: 40, height: 40, marginBottom: 8 }} resizeMode="contain" />
      <AppText textRole="bodySm" style={{ color: P.sec, marginBottom: 16 }}>
        {i18n.t('pp.exit_body')}
      </AppText>
      <PpButton label={i18n.t('pp.exit_stay')} onPress={onStay} testID="pp-exit-stay" />
      <PpButton kind="link" label={i18n.t('pp.exit_leave')} onPress={onLeave} testID="pp-exit-leave" style={{ marginTop: 6 }} />
    </Sheet>
  );
}

// ── 18 yaş altı ─────────────────────────────────────────────────────────────
export function MinorStep({ onDone }: { onDone: () => void }) {
  const i18n = useT();
  const P = usePp();
  return (
    <PpCard center footer={<PpButton label={i18n.t('pp.minor_cta')} onPress={onDone} testID="pp-minor-done" />}>
      <Image source={GLASS.foot} style={styles.bigGlass} resizeMode="contain" />
      <AppText textRole="screenTitle" style={{ color: P.ink }} accessibilityRole="header">
        {i18n.t('pp.minor_title')}
      </AppText>
      <AppText textRole="bodySm" style={{ color: P.sec, marginTop: 8 }}>
        {i18n.t('pp.minor_body')}
      </AppText>
    </PpCard>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12, minHeight: 56 },
  itemGlass: { width: 34, height: 38 },
  tag: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  kRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 6 },
  editBtn: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  bigGlass: { width: 120, height: 110, alignSelf: 'center', marginBottom: 16 },
  savedChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
});
