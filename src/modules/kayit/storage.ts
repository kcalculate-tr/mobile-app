// G42-S1 md.2/md.7 — Cihazda saklama (saf; depolama enjekte edilir → tsx --test).
//
//  · Onboarding kaldığı yer: 5 ekranın adımı + başlangıç kartı + yol seçimi (uygulama kapatılıp açılınca
//    kaldığı ekrandan devam).
//  · R1 taslağı: kayıtsız çıkan kullanıcının cevapları + plan özeti 7 GÜN; geri gelince "Planın hazır,
//    kaydetmek ister misin?" kartı; 7 gün dolunca SESSİZ silme (okuma anında).
//    KARAR (LOG): depolama AsyncStorage (uygulama kum havuzu; iOS veri koruma sınıfı). Şifreli depo paketi
//    (expo-secure-store) yüklü değil ve yeni paket yasak → değer yerel ve kum havuzunda; SORULAR'da.
//  · Kayıt sonrası tek seferlik: başlangıç kartı (ilk sekme) + B yolu kısa profil beklemesi.
import type { KAnswers, KPath, KStart, KStep } from './model';

export interface KvStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const ONB_KEY = '@kcal_kayit_onb';
export const DRAFT_KEY = '@kcal_kayit_draft';
export const START_KEY = '@kcal_kayit_start';
export const SHORT_PENDING_KEY = '@kcal_kayit_short_pending';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Onboarding ───────────────────────────────────────────────────────────────
export interface OnbState {
  step: number; // 1–5
  start: KStart | null;
  path: KPath;
}

export function parseOnb(raw: string | null): OnbState | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<OnbState>;
    const step = Math.min(5, Math.max(1, Math.round(Number(o.step) || 1)));
    const start = o.start === 'track' || o.start === 'recipes' || o.start === 'community' ? o.start : null;
    return { step, start, path: o.path === 'b' ? 'b' : 'a' };
  } catch {
    return null;
  }
}

export async function readOnb(s: KvStore): Promise<OnbState | null> {
  try {
    return parseOnb(await s.getItem(ONB_KEY));
  } catch {
    return null;
  }
}
export async function writeOnb(s: KvStore, v: OnbState): Promise<void> {
  try {
    await s.setItem(ONB_KEY, JSON.stringify(v));
  } catch {
    /* yazılamadı — baştan başlar */
  }
}

// ─── R1 taslağı ───────────────────────────────────────────────────────────────
export interface DraftPlanSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface KDraft {
  v: 1;
  savedAt: string; // ISO
  answers: KAnswers;
  step: KStep | 'plan' | 'result' | 'signup';
  start: KStart | null;
  plan: DraftPlanSummary | null;
}

export function draftExpired(savedAtIso: string, now: number): boolean {
  const t = Date.parse(savedAtIso);
  if (!Number.isFinite(t)) return true;
  return now - t >= DRAFT_TTL_MS || t - now > DAY_MS; // gelecekteki zaman damgası da bozuk sayılır
}

/** Kalan gün (yukarı yuvarlı; 7 gün saklama → ilk gün 7, son gün 1). */
export function draftDaysLeft(savedAtIso: string, now: number): number {
  const t = Date.parse(savedAtIso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t + DRAFT_TTL_MS - now) / DAY_MS));
}

export function parseDraft(raw: string | null): KDraft | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<KDraft>;
    if (o.v !== 1 || typeof o.savedAt !== 'string' || !o.answers || typeof o.answers !== 'object') return null;
    return {
      v: 1,
      savedAt: o.savedAt,
      answers: o.answers as KAnswers,
      step: (o.step ?? 'goal') as KDraft['step'],
      start: o.start ?? null,
      plan: o.plan ?? null,
    };
  } catch {
    return null;
  }
}

/** Taslağı oku; 7 gün dolduysa (ya da bozuksa) SESSİZCE sil ve null dön. */
export async function readDraft(s: KvStore, now: number = Date.now()): Promise<KDraft | null> {
  let raw: string | null = null;
  try {
    raw = await s.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;
  const d = parseDraft(raw);
  if (!d || draftExpired(d.savedAt, now)) {
    await clearDraft(s);
    return null;
  }
  return d;
}

/**
 * Taslağı yaz. `savedAt` İLK yazımda konur ve korunur (7 gün ilk çıkıştan sayılır; her cevap süreyi
 * uzatmaz). `fresh` → süre baştan.
 */
export async function writeDraft(s: KvStore, d: Omit<KDraft, 'v' | 'savedAt'>, now: number = Date.now(), fresh = false): Promise<void> {
  try {
    const prev = fresh ? null : await readDraft(s, now);
    const v: KDraft = { v: 1, savedAt: prev?.savedAt ?? new Date(now).toISOString(), ...d };
    await s.setItem(DRAFT_KEY, JSON.stringify(v));
  } catch {
    /* yazılamadı */
  }
}

export async function clearDraft(s: KvStore): Promise<void> {
  try {
    await s.removeItem(DRAFT_KEY);
  } catch {
    /* yut */
  }
}

/** R1 kartı gösterilsin mi: taslakta hesaplanmış plan var (L2'ye ulaşılmış) ve süre dolmamış. */
export function shouldShowReturn(d: KDraft | null): boolean {
  return !!d && d.plan != null;
}

// ─── Kayıt sonrası tek seferlik işaretler ─────────────────────────────────────
export async function rememberStart(s: KvStore, start: KStart | null): Promise<void> {
  try {
    if (start) await s.setItem(START_KEY, start);
  } catch {
    /* yut */
  }
}
/** Başlangıç kartını OKU ve SİL (ilk açılan sekme yalnız bir kez belirlenir). */
export async function takeStart(s: KvStore): Promise<KStart | null> {
  try {
    const v = await s.getItem(START_KEY);
    await s.removeItem(START_KEY);
    return v === 'track' || v === 'recipes' || v === 'community' ? v : null;
  } catch {
    return null;
  }
}

export async function setShortPending(s: KvStore, on: boolean): Promise<void> {
  try {
    if (on) await s.setItem(SHORT_PENDING_KEY, '1');
    else await s.removeItem(SHORT_PENDING_KEY);
  } catch {
    /* yut */
  }
}
export async function isShortPending(s: KvStore): Promise<boolean> {
  try {
    return (await s.getItem(SHORT_PENDING_KEY)) === '1';
  } catch {
    return false;
  }
}
