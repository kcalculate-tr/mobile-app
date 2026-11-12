// G34-S1 · Tur 26o — Kişisel plan akışı (05-akis-haritasi.png BAĞLAYICI). Tek rota; adımlar
// içeride (yalnız içerik kayar, Geri + ilerleme çubuğu sabit). Sol kenardan kaydırma = Geri
// (Giriş ve Hesaplanıyor'da kapalı). Her cevap adımında ilerleme kaydedilir (Kaldığın yerden).
// Onboarding'de YOK; 4 giriş noktası (Profil, Ana sayfa kartı, Koç ilk açılış, satın alma sonrası).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../../core/AuthContext';
import { useT } from '../../../core/i18n';
import { Toast } from '../../../core/design/components/Toast';
import { track } from '../../../lib/analytics';
import type { RootStackParamList } from '../../../navigation/types';
import { isoDay, withCustom, type PpResult } from '../calc';
import { nextStep, prevStep, progressOf, resumable, type FlowCtx, type FlowStep, type QuestionStep } from '../flow';
import { clearProgress, grantHealthConsent, hasKnown, healthConsentGiven, loadKnown, readProgress, savePlan } from '../api';
import { flushProgressNow, usePpFlow, type PpOrigin } from '../store';
import type { PpSaved } from '../types';
import { StepTransition } from '../ui/motion';
import { PpBackdrop } from '../ui/parts';
import { PpHeader } from '../ui/flowHeader';
import { ActivityStep, BasicsStep, DietStep, ExerciseStep, GoalStep, MealsStep, MeasureStep, TargetStep } from './flow/questions';
import { ExitSheet, IntroStep, KnownStep, MinorStep, ResumeStep } from './flow/entry';
import { CalcStep, ResultStep } from './flow/result';
import { PreviewStep } from './flow/preview';
import { RemindStep } from './flow/remind';
import { recordAllergyConsent, useInIzmir } from '../bridge';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalPlan'>;

const YEAR = () => new Date().getFullYear();

export default function PersonalPlanFlowScreen({ navigation, route }: Props) {
  const i18n = useT();
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const origin: PpOrigin = route.params?.origin ?? 'profile';
  const izmir = useInIzmir();
  const step = usePpFlow((s) => s.step);
  const dir = usePpFlow((s) => s.dir);
  const known = usePpFlow((s) => s.known);
  const answers = usePpFlow((s) => s.answers);
  const editingFromKnown = usePpFlow((s) => s.editingFromKnown);
  const { begin, go, set, setResult, setEditingFromKnown, reset } = usePpFlow.getState();

  const [boot, setBoot] = useState<'loading' | 'resume' | 'ready'>('loading');
  const [consentDone, setConsentDone] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [drag, setDrag] = useState(0);
  const [saving, setSaving] = useState(false);
  const [calcKey, setCalcKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // ── Açılış: bildiklerimiz + kayıtlı ilerleme + rıza ───────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const year = YEAR();
      const [k, consent, rec] = await Promise.all([
        uid ? loadKnown(uid, year) : Promise.resolve(null),
        healthConsentGiven(),
        uid ? readProgress(uid) : Promise.resolve(null),
      ]);
      if (!alive) return;
      setConsentDone(consent);
      if (rec && resumable(rec.step) && route.params?.restart !== true) {
        begin({ userId: uid, origin, known: rec.known, answers: rec.answers, step: rec.step });
        setBoot('resume');
        track('pp_resume', { step: rec.step, action: 'shown' });
        return;
      }
      const isKnown = !!k && hasKnown(k);
      const prev = k?.saved?.answers;
      begin({
        userId: uid,
        origin,
        known: isKnown,
        answers: {
          ...(prev ?? {}),
          ...(k ? { goal: k.goal, gender: k.gender, birthYear: k.birthYear, heightCm: k.heightCm, weightKg: k.weightKg, activity: k.activity } : {}),
          consentHealth: consent,
        },
        step: 'intro',
      });
      setBoot('ready');
      track('pp_open', { origin, known: isKnown });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ctx: FlowCtx = useMemo(
    () => ({ known, currentYear: YEAR(), answers: { goal: answers.goal, birthYear: answers.birthYear, heightCm: answers.heightCm, weightKg: answers.weightKg, activity: answers.activity, gender: answers.gender } }),
    [known, answers.goal, answers.birthYear, answers.heightCm, answers.weightKg, answers.activity, answers.gender],
  );

  const leave = useCallback(() => {
    const s = usePpFlow.getState().step;
    if (resumable(s)) {
      setExitOpen(true);
      return;
    }
    navigation.goBack();
  }, [navigation]);

  const next = useCallback(() => {
    const s = usePpFlow.getState();
    if (s.step === 'intro' && s.answers.consentHealth && !consentDone) {
      void grantHealthConsent();
      setConsentDone(true);
    }
    if (s.step === 'diet' && s.answers.consentAllergy) void recordAllergyConsent(true);
    if (s.editingFromKnown && s.step !== 'known') {
      setEditingFromKnown(false);
      go('known', -1);
      return;
    }
    const n = nextStep(s.step, ctx);
    // VKİ dalı Temel bilgilerden Hedef'e GERİ döner.
    go(n, s.step === 'basics' && n === 'goal' ? -1 : 1);
    track('pp_step', { from: s.step, to: n });
  }, [ctx, consentDone, go, setEditingFromKnown]);

  const back = useCallback(() => {
    const s = usePpFlow.getState();
    if (s.step === 'calc') return; // hesap sırasında geri yok
    if (s.editingFromKnown && s.step !== 'known') {
      setEditingFromKnown(false);
      go('known', -1);
      return;
    }
    const p = prevStep(s.step, ctx);
    // İlk sorudan (ya da Bildiklerimiz'den) geri → Çıkış onayı (Giriş'e dönülmez; 01 "Çıkış").
    if (p === null || p === 'intro') {
      leave();
      return;
    }
    go(p, -1);
  }, [ctx, go, leave, setEditingFromKnown]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitOpen) {
        setExitOpen(false);
        return true;
      }
      back();
      return true;
    });
    return () => sub.remove();
  }, [back, exitOpen]);

  const finish = useCallback(() => {
    track('pp_done', { origin });
    navigation.replace('PersonalPlanMine', { fresh: true });
  }, [navigation, origin]);

  // ── Planı başlat: kaydet (sunucu; migration yoksa yalnız mevcut kolonlar + cihaz) ──
  const startPlan = useCallback(async () => {
    const s = usePpFlow.getState();
    if (!s.result || !uid) return;
    setSaving(true);
    const today = isoDay(new Date());
    const { consentHealth: _c, consentAllergy: _a, ...rest } = s.answers;
    void _c;
    void _a;
    const saved: PpSaved = {
      v: 1,
      answers: rest,
      result: s.result,
      custom: s.custom,
      startedAt: today,
      startWeightKg: s.answers.weightKg ?? 0,
      targetDate: withCustom(s.result, s.answers, s.custom?.calories ?? null, today).date,
      updatedAt: new Date().toISOString(),
    };
    const res = await savePlan(uid, saved, YEAR());
    setSaving(false);
    if (!res.ok) {
      setToast(i18n.t('pp.medit_failed'));
      return;
    }
    await clearProgress(uid);
    track('pp_saved', { goal: s.answers.goal ?? 'maintain', custom: !!s.custom, local_only: !!res.localOnly });
    go('preview', 1);
  }, [uid, go, i18n]);

  const editFromKnown = useCallback(
    (q: QuestionStep) => {
      setEditingFromKnown(true);
      go(q, 1);
    },
    [go, setEditingFromKnown],
  );

  if (boot === 'loading') {
    return (
      <View style={styles.root}>
        <PpBackdrop />
      </View>
    );
  }

  const progress = progressOf(step, ctx);
  const qNav = { next, continueLabel: editingFromKnown ? i18n.t('pp.done') : undefined, izmir };
  const renderStep = (st: FlowStep) => {
    switch (st) {
      case 'intro':
        return <IntroStep next={next} consentDone={consentDone} />;
      case 'known':
        return <KnownStep next={next} edit={editFromKnown} ctx={ctx} />;
      case 'goal':
        return <GoalStep {...qNav} />;
      case 'basics':
        return <BasicsStep {...qNav} />;
      case 'target':
        return <TargetStep {...qNav} />;
      case 'activity':
        return <ActivityStep {...qNav} />;
      case 'exercise':
        return <ExerciseStep {...qNav} />;
      case 'measure':
        return <MeasureStep {...qNav} />;
      case 'diet':
        return <DietStep {...qNav} />;
      case 'meals':
        return <MealsStep {...qNav} />;
      case 'calc':
        return (
          <CalcStep
            key={calcKey}
            onDone={(r: PpResult) => {
              setResult(r);
              go('result', 1);
            }}
            onError={() => setCalcKey((k) => k + 1)}
          />
        );
      case 'result':
        return <ResultStep onStart={() => void startPlan()} saving={saving} />;
      case 'preview':
        return <PreviewStep next={() => go('remind', 1)} origin={origin} />;
      case 'remind':
        return <RemindStep onDone={() => finish()} />;
      case 'minor':
        return <MinorStep onDone={() => navigation.goBack()} />;
      default:
        return null;
    }
  };

  if (boot === 'resume') {
    return (
      <View style={styles.root}>
        <PpBackdrop />
        <PpHeader right={{ kind: 'close', label: i18n.t('pp.close'), onPress: () => navigation.goBack() }} />
        <ResumeStep
          step={step}
          ctx={ctx}
          onContinue={() => {
            track('pp_resume', { step, action: 'continue' });
            setBoot('ready');
          }}
          onRestart={() => {
            track('pp_resume', { step, action: 'restart' });
            reset();
            begin({ userId: uid, origin, known, answers: { consentHealth: consentDone }, step: 'intro' });
            setBoot('ready');
          }}
        />
      </View>
    );
  }

  const right =
    step === 'intro'
      ? { kind: 'close' as const, label: i18n.t('pp.close'), onPress: () => navigation.goBack() }
      : step === 'measure'
        ? {
            kind: 'text' as const,
            label: i18n.t('pp.skip_for_now'),
            onPress: () => {
              set({ measures: {}, measuresSkipped: true });
              next();
            },
          }
        : undefined;
  const showBack = step !== 'intro' && step !== 'calc' && step !== 'minor';

  return (
    <View style={styles.root} testID="pp-flow">
      <PpBackdrop />
      <PpHeader onBack={showBack ? back : undefined} progress={progress} dragBack={drag} right={right} />
      <StepTransition stepKey={step} dir={dir} onSwipeBack={back} swipeEnabled={showBack} onProgress={setDrag}>
        {renderStep(step)}
      </StepTransition>
      <ExitSheet
        visible={exitOpen}
        onStay={() => setExitOpen(false)}
        onLeave={() => {
          setExitOpen(false);
          flushProgressNow();
          track('pp_exit', { step });
          navigation.goBack();
        }}
      />
      <Toast visible={!!toast} message={toast ?? ''} tone="error" onRetry={() => { setToast(null); void startPlan(); }} onDismiss={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
