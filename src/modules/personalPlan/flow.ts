// G34-S1 · Tur 26o — akış haritası (05-akis-haritasi.png, BAĞLAYICI) saf durum makinesi.
// Numaralı soru adımları ilerleme çubuğunda sayılır; giriş/onay/hesap/sonuç ve sonrası sayılmaz.
// a yolu (Takibe başla verisi var): Giriş → Bildiklerimiz → yalnız yeni sorular
//   (Hedef kilo ve hız, Egzersiz, Ölçüler, Beslenme, Öğün düzeni; hedef kilosuz hedefte 4 soru).
// b yolu (veri yok): Giriş → 1 Hedef … 8 Öğün düzeni (8 soru; hedef kilosuzda 7).
// VKİ dalı: Temel bilgilerden sonra VKİ < 18,5 ve hedef "Kilo ver" ise Hedef'e geri döner
// (Düşük VKİ hâli). 18 yaş altı → Bilgi ekranı (akış kapalı).
import { canOfferLose, goalNeedsTarget, isMinor } from './calc';
import type { PpAnswers } from './types';

export type QuestionStep = 'goal' | 'basics' | 'target' | 'activity' | 'exercise' | 'measure' | 'diet' | 'meals';
export type FlowStep = 'intro' | 'known' | QuestionStep | 'calc' | 'result' | 'preview' | 'remind' | 'done' | 'minor';

export const FULL_QUESTIONS: readonly QuestionStep[] = ['goal', 'basics', 'target', 'activity', 'exercise', 'measure', 'diet', 'meals'];
export const KNOWN_QUESTIONS: readonly QuestionStep[] = ['target', 'exercise', 'measure', 'diet', 'meals'];

export interface FlowCtx {
  /** Takibe başla verisi var mı (a yolu). */
  known: boolean;
  answers: Pick<PpAnswers, 'goal' | 'birthYear' | 'heightCm' | 'weightKg' | 'activity' | 'gender'>;
  currentYear: number;
}

/** Bu yoldaki numaralı soru adımları (hedef kilosuz hedefte "target" düşer). */
export function questionSteps(ctx: FlowCtx): QuestionStep[] {
  const base = ctx.known ? KNOWN_QUESTIONS : FULL_QUESTIONS;
  return base.filter((s) => s !== 'target' || goalNeedsTarget(ctx.answers.goal));
}

/** İlerleme: { index (1'den), total } — soru adımı değilse null. */
export function progressOf(step: FlowStep, ctx: FlowCtx): { index: number; total: number } | null {
  const qs = questionSteps(ctx);
  const i = qs.indexOf(step as QuestionStep);
  if (i < 0) return null;
  return { index: i + 1, total: qs.length };
}

/** Bir sonraki adım. VKİ ve 18 yaş dalları burada. */
export function nextStep(step: FlowStep, ctx: FlowCtx): FlowStep {
  if (step === 'intro') return ctx.known ? 'known' : 'goal';
  if (step === 'known') {
    if (isMinor(ctx.answers.birthYear, ctx.currentYear)) return 'minor';
    if (ctx.answers.goal === 'lose' && !canOfferLose(ctx.answers.weightKg, ctx.answers.heightCm)) return 'goal';
    return questionSteps(ctx)[0] ?? 'calc';
  }
  if (step === 'basics') {
    if (isMinor(ctx.answers.birthYear, ctx.currentYear)) return 'minor';
    if (ctx.answers.goal === 'lose' && !canOfferLose(ctx.answers.weightKg, ctx.answers.heightCm)) return 'goal';
  }
  const qs = questionSteps(ctx);
  const i = qs.indexOf(step as QuestionStep);
  if (i >= 0) {
    if (i < qs.length - 1) return qs[i + 1];
    return 'calc';
  }
  // Hedef a yolunda (VKİ ile geri dönüş) sorulduysa: kalan sorulara devam.
  if (step === 'goal' && ctx.known) return questionSteps(ctx)[0] ?? 'calc';
  if (step === 'calc') return 'result';
  if (step === 'result') return 'preview';
  if (step === 'preview') return 'remind';
  if (step === 'remind') return 'done';
  return 'done';
}

/** Geri: ileri gitmenin tersi. Giriş/Bildiklerimiz'den geri → null (akıştan çıkış). */
export function prevStep(step: FlowStep, ctx: FlowCtx): FlowStep | null {
  if (step === 'intro') return null;
  if (step === 'known') return 'intro';
  if (step === 'minor') return ctx.known ? 'known' : 'basics';
  const qs = questionSteps(ctx);
  const i = qs.indexOf(step as QuestionStep);
  if (i > 0) return qs[i - 1];
  if (i === 0) return ctx.known ? 'known' : 'intro';
  if (step === 'goal') return ctx.known ? 'known' : 'intro';
  if (step === 'calc') return qs[qs.length - 1] ?? 'intro';
  if (step === 'result') return qs[qs.length - 1] ?? 'intro';
  if (step === 'preview') return 'result';
  if (step === 'remind') return 'preview';
  return null;
}

/** Devam noktası olarak saklanabilir mi? (Hesap/Hata/Bitti saklanmaz → son soruya döner.) */
export function resumable(step: FlowStep): boolean {
  return step !== 'calc' && step !== 'done' && step !== 'minor' && step !== 'intro';
}

/** "Kaldığın yerden": kalan soru sayısı (o adım dahil). */
export function remainingQuestions(step: FlowStep, ctx: FlowCtx): number {
  const qs = questionSteps(ctx);
  const i = qs.indexOf(step as QuestionStep);
  if (i < 0) return step === 'known' || step === 'intro' ? qs.length : 0;
  return qs.length - i;
}

/** Soru adımının "Devam et" koşulu (cevap tam mı). */
export function stepComplete(step: QuestionStep, a: PpAnswers, currentYear: number): boolean {
  switch (step) {
    case 'goal':
      return !!a.goal && (a.goal !== 'lose' || canOfferLose(a.weightKg, a.heightCm));
    case 'basics':
      return !!a.gender && !!a.birthYear && !!a.heightCm && !!a.weightKg && a.birthYear <= currentYear;
    case 'target':
      return a.targetWeightKg != null;
    case 'activity':
      return !!a.activity;
    case 'exercise':
      return a.exercise.length > 0;
    case 'measure':
      return true; // isteğe bağlı
    case 'diet':
      return !!a.diet;
    case 'meals':
      return a.meals.main >= 2 && a.meals.main <= 4 && a.meals.snack >= 0 && a.meals.snack <= 3;
    default:
      return true;
  }
}
