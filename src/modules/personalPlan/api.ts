// G34-S1 · Tur 26o — Kişisel plan kayıt/okuma. Mevcut `user_nutrition_profiles` (+ g34 kolonları)
// ve `body_measurements`. Migration canlıya uygulanmadan önce de GÜVENLİ: yeni kolonlar reddedilirse
// (PGRST204 / 42703) yalnız mevcut kolonlarla yazılır ve plan cihazda saklanır; uygulanınca bir
// sonraki kayıtta sunucuya gider. Akış ilerlemesi `personal_plan_progress` (yoksa yalnız yerel).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../../core/supabase';
import { readHealthConsent, recordHealthConsent } from '../../lib/consent/store';
import { calorieFloor, isoDay, type PpActivity, type PpGender, type PpGoal, type PpResult } from './calc';
import { parseSaved, type PpAnswers, type PpSaved, type PpMeasures } from './types';
import type { FlowStep } from './flow';

export const PLAN_CACHE_KEY = (uid: string) => `@kcal_pp_plan_${uid}`;
export const PROGRESS_KEY = (uid: string) => `@kcal_pp_progress_${uid}`;

/** Yeni kolon yok hatası (migration uygulanmamış). */
export function isMissingColumn(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  return e.code === 'PGRST204' || e.code === '42703' || e.code === 'PGRST205' || e.code === '42P01' || /column|schema cache|does not exist/i.test(e.message ?? '');
}

// ─── Takibe başla verisi (a yolu) ─────────────────────────────────────────────
export interface KnownData {
  goal: PpGoal | null;
  gender: PpGender | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: PpActivity | null;
  /** Kayıtlı kişisel plan (varsa). */
  saved: PpSaved | null;
}

export function mapGoal(g: unknown): PpGoal | null {
  if (g === 'lose_weight') return 'lose';
  if (g === 'gain_weight') return 'gain';
  if (g === 'maintain') return 'maintain';
  return null;
}

export function mapActivity(a: unknown): PpActivity | null {
  if (a === 'sedentary' || a === 'light' || a === 'moderate' || a === 'active') return a;
  if (a === 'very_active') return 'active';
  if (a === 'low') return 'sedentary';
  if (a === 'medium') return 'moderate';
  if (a === 'high') return 'active';
  return null;
}

/** Sunucu satırı → bildiklerimiz. Beşi birden yoksa (eksik) a yolu açılmaz. */
export function knownFromRow(row: Record<string, unknown> | null, currentYear: number): KnownData {
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN);
  const r = row ?? {};
  const age = num(r.age);
  const by = num(r.birth_year);
  const gc = r.gender_choice;
  const gender: PpGender | null =
    gc === 'female' || gc === 'male' || gc === 'unspecified' ? gc : r.gender === 'male' ? 'male' : r.gender === 'female' ? 'female' : null;
  const h = num(r.height);
  const w = num(r.weight);
  return {
    goal: mapGoal(r.goal),
    gender,
    birthYear: Number.isFinite(by) && by > 1900 ? by : Number.isFinite(age) && age > 0 ? currentYear - age : null,
    heightCm: Number.isFinite(h) && h > 0 ? h : null,
    weightKg: Number.isFinite(w) && w > 0 ? Math.round(w * 10) / 10 : null,
    activity: mapActivity(r.activity_level),
    saved: parseSaved(r.personal_plan),
  };
}

export function hasKnown(k: KnownData): boolean {
  return !!(k.goal && k.gender && k.birthYear && k.heightCm && k.weightKg && k.activity);
}

export async function loadProfileRow(userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await getSupabaseClient().from('user_nutrition_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? null;
}

export async function loadKnown(userId: string, currentYear: number): Promise<KnownData> {
  let row: Record<string, unknown> | null = null;
  try {
    row = await loadProfileRow(userId);
  } catch {
    row = null;
  }
  const k = knownFromRow(row, currentYear);
  if (!k.saved) k.saved = await readCachedPlan(userId);
  return k;
}

// ─── Plan kaydı ───────────────────────────────────────────────────────────────
export async function readCachedPlan(userId: string): Promise<PpSaved | null> {
  try {
    const raw = await AsyncStorage.getItem(PLAN_CACHE_KEY(userId));
    return raw ? parseSaved(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function cachePlan(userId: string, p: PpSaved | null): Promise<void> {
  try {
    if (p) await AsyncStorage.setItem(PLAN_CACHE_KEY(userId), JSON.stringify(p));
    else await AsyncStorage.removeItem(PLAN_CACHE_KEY(userId));
  } catch {
    /* yerel önbellek yazılamadı */
  }
}

export function toServiceGoal(g: PpGoal): string {
  return g === 'lose' ? 'lose_weight' : g === 'gain' ? 'gain_weight' : 'maintain';
}

/** PpSaved → user_nutrition_profiles satırı (mevcut + g34 kolonları). */
export function profileRows(userId: string, p: PpSaved, currentYear: number) {
  const a = p.answers;
  const t = p.custom ?? { calories: p.result.calories, protein: p.result.macros.protein, fat: p.result.macros.fat, carbs: p.result.macros.carbs };
  const weight = a.weightKg ?? p.startWeightKg;
  const legacy = {
    user_id: userId,
    gender: a.gender === 'male' ? 'male' : 'female',
    age: a.birthYear ? currentYear - a.birthYear : null,
    height: a.heightCm ? Math.round(a.heightCm) : null,
    weight,
    goal: toServiceGoal(a.goal ?? 'maintain'),
    activity_level: a.activity,
    target_calories: Math.max(calorieFloor(a.gender ?? 'female'), t.calories),
    target_protein: t.protein,
    target_carbs: t.carbs,
    target_fat: t.fat,
    target_water: Number(((weight * 33) / 1000).toFixed(1)),
    use_custom_macros: false,
    waist_cm: a.measures.waistCm ?? null,
    hip_cm: a.measures.hipCm ?? null,
    chest_cm: a.measures.chestCm ?? null,
    updated_at: new Date().toISOString(),
  };
  const full = {
    ...legacy,
    birth_year: a.birthYear,
    gender_choice: a.gender,
    target_weight_kg: a.targetWeightKg,
    pace_kg_week: a.goal === 'lose' || a.goal === 'gain' ? a.pace : 0,
    body_fat_pct: a.measures.bodyFatPct ?? null,
    arm_cm: a.measures.armCm ?? null,
    plan_target_date: p.targetDate,
    plan_started_at: p.startedAt ? `${p.startedAt}T00:00:00Z` : null,
    plan_version: p.result.algoVersion,
    plan_updated_at: p.updatedAt,
    personal_plan: p,
  };
  return { legacy, full };
}

export interface SaveOutcome {
  ok: boolean;
  /** Sunucuda yalnız mevcut kolonlar yazıldı (migration yok) — plan cihazda. */
  localOnly?: boolean;
  error?: string;
}

export async function savePlan(userId: string, p: PpSaved, currentYear: number): Promise<SaveOutcome> {
  await cachePlan(userId, p);
  const sb = getSupabaseClient();
  const { legacy, full } = profileRows(userId, p, currentYear);
  try {
    const r1 = await sb.from('user_nutrition_profiles').upsert(full, { onConflict: 'user_id' });
    if (!r1.error) {
      await saveMeasurement(userId, { date: isoDay(new Date()), weightKg: legacy.weight, measures: p.answers.measures });
      return { ok: true };
    }
    if (!isMissingColumn(r1.error)) throw r1.error;
    const r2 = await sb.from('user_nutrition_profiles').upsert(legacy, { onConflict: 'user_id' });
    if (r2.error) throw r2.error;
    await saveMeasurement(userId, { date: isoDay(new Date()), weightKg: legacy.weight, measures: p.answers.measures });
    return { ok: true, localOnly: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'save_failed' };
  }
}

export async function loadPlan(userId: string, currentYear: number): Promise<{ saved: PpSaved | null; row: Record<string, unknown> | null }> {
  let row: Record<string, unknown> | null = null;
  try {
    row = await loadProfileRow(userId);
  } catch {
    row = null;
  }
  const fromServer = parseSaved(row?.personal_plan);
  const saved = fromServer ?? (await readCachedPlan(userId));
  if (fromServer) await cachePlan(userId, fromServer);
  void currentYear;
  return { saved, row };
}

// ─── Haftalık tartı / ölçü (body_measurements) ────────────────────────────────
export interface MeasurementRow {
  date: string;
  weightKg: number | null;
  measures?: PpMeasures;
}

export async function saveMeasurement(userId: string, m: { date: string; weightKg: number | null; measures?: PpMeasures }): Promise<boolean> {
  const sb = getSupabaseClient();
  const base: Record<string, unknown> = { user_id: userId, date: m.date };
  if (m.weightKg != null) base.weight_kg = m.weightKg;
  const ms = m.measures ?? {};
  if (ms.waistCm != null) base.waist_cm = Math.round(ms.waistCm);
  if (ms.hipCm != null) base.hip_cm = Math.round(ms.hipCm);
  if (ms.chestCm != null) base.chest_cm = Math.round(ms.chestCm);
  const extra: Record<string, unknown> = { ...base };
  if (ms.armCm != null) extra.arm_cm = Math.round(ms.armCm);
  if (ms.bodyFatPct != null) extra.body_fat_pct = ms.bodyFatPct;
  try {
    const r1 = await sb.from('body_measurements').upsert(extra, { onConflict: 'user_id,date' });
    if (!r1.error) return true;
    if (!isMissingColumn(r1.error)) return false;
    const r2 = await sb.from('body_measurements').upsert(base, { onConflict: 'user_id,date' });
    return !r2.error;
  } catch {
    return false;
  }
}

export async function loadWeighIns(userId: string, sinceIso: string): Promise<{ date: string; weightKg: number }[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('body_measurements')
      .select('date,weight_kg')
      .eq('user_id', userId)
      .gte('date', sinceIso)
      .order('date', { ascending: true })
      .limit(200);
    if (error) return [];
    return ((data as { date: string; weight_kg: number | string | null }[]) ?? [])
      .map((r) => ({ date: r.date, weightKg: Number(r.weight_kg) }))
      .filter((r) => Number.isFinite(r.weightKg) && r.weightKg > 0);
  } catch {
    return [];
  }
}

// ─── Akış ilerlemesi (Kaldığın yerden) ────────────────────────────────────────
export interface ProgressRecord {
  step: FlowStep;
  answers: PpAnswers;
  known: boolean;
  at: string;
}

export function parseProgress(raw: unknown): ProgressRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<ProgressRecord>;
  if (typeof o.step !== 'string' || !o.answers || typeof o.answers !== 'object') return null;
  return { step: o.step as FlowStep, answers: o.answers as PpAnswers, known: !!o.known, at: typeof o.at === 'string' ? o.at : '' };
}

export async function readProgress(userId: string): Promise<ProgressRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY(userId));
    const local = raw ? parseProgress(JSON.parse(raw)) : null;
    if (local) return local;
  } catch {
    /* yerel yok */
  }
  try {
    const { data, error } = await getSupabaseClient().from('personal_plan_progress').select('step,answers,updated_at').eq('user_id', userId).maybeSingle();
    if (error || !data) return null;
    const d = data as { step: string; answers: Record<string, unknown>; updated_at: string };
    const ans = (d.answers ?? {}) as Record<string, unknown>;
    return parseProgress({ step: d.step, answers: ans.answers ?? ans, known: !!ans.known, at: d.updated_at });
  } catch {
    return null;
  }
}

export async function writeProgress(userId: string, rec: ProgressRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(PROGRESS_KEY(userId), JSON.stringify(rec));
  } catch {
    /* yerel yazılamadı */
  }
  try {
    await getSupabaseClient()
      .from('personal_plan_progress')
      .upsert({ user_id: userId, step: rec.step, answers: { answers: rec.answers, known: rec.known }, updated_at: rec.at }, { onConflict: 'user_id' });
  } catch {
    /* tablo yoksa (migration uygulanmadı) yalnız yerel */
  }
}

export async function clearProgress(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROGRESS_KEY(userId));
  } catch {
    /* yok */
  }
  try {
    await getSupabaseClient().from('personal_plan_progress').delete().eq('user_id', userId);
  } catch {
    /* tablo yok */
  }
}

// ─── Rıza ─────────────────────────────────────────────────────────────────────
/**
 * G36-S1 md.8 (İlter 12 Kas): geçerli sağlık rızası (Takibe başla ya da önceki kişisel plan) varsa
 * Giriş'te "Onaylandı" gösterilir ve YENİ satır yazılmaz; yeniden onay istenmez.
 */
export async function healthConsentGiven(): Promise<boolean> {
  return readHealthConsent();
}

/** Kişisel plan sağlık rızası — G27 altyapısı (kind 'health_data'), AYRI kaynak 'personal_plan'. */
export async function grantHealthConsent(): Promise<void> {
  await recordHealthConsent(true, 'personal_plan');
}

export function resultSummary(r: PpResult) {
  return { kcal: r.calories, p: r.macros.protein, c: r.macros.carbs, f: r.macros.fat };
}
