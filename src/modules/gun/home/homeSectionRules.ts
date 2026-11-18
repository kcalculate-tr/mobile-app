// G50-S1 md.1 — Ana sayfa ek bölümlerinin SAF kuralları (RN importu YOK → node:test).
// Her bölüm yalnız GERÇEK veriyle görünür; veri yoksa / bilinmiyorsa gizli (uydurma sayı / tarif yok).
//  · 6a İlk gün görevleri: hesap ilk 7 günündeyken ve görevler bitmemişken. Durum sunucudaki gerçek kayıtlardan
//    (profil var mı · ilk `ai_scan` öğün kaydı · ilk su kaydı); cihazda yalnız "kapatıldı" işareti.
//  · 6b Kalan tarama hakkı: abonelik deposundaki AI kotası (my_entitlement / reserve_ai_scan). Gün sınırı geçtiyse
//    ya da bilinmiyorsa rozet yok.
//  · 6c Bugünün tarifleri: Keşfet akışında kalorisi ve görseli olan öğün kartları (en çok 8).
//  · 6e Seri + haftalık özet: `track/streak` (sunucu kuralıyla birebir) + bu haftanın (Pzt–Paz) gerçek kalorisi.
import { addDays } from '../track/dayClock';
import { displayStreak, loggedDays } from '../track/streak';

// ─── 6a İlk gün görevleri ────────────────────────────────────────────────────
export const FIRST_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type FirstTask = 'plan' | 'scan' | 'water';
export const FIRST_TASKS: readonly FirstTask[] = ['plan', 'scan', 'water'];

/** Hesap ilk 7 günü içinde mi (oluşturma zamanı bilinmiyorsa HAYIR → kart gizli). */
export function withinFirstDays(createdAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  const age = now - t;
  return age >= -60_000 && age < FIRST_DAYS * DAY_MS;
}

/** Görev durumu. `water: 'off'` → su takibi kapalı (görev listede yok). null alan = henüz bilinmiyor. */
export interface FirstTaskState {
  plan: boolean | null;
  scan: boolean | null;
  water: boolean | null | 'off';
}

export interface FirstTaskRow {
  key: FirstTask;
  done: boolean;
}

/** Bilinmeyen alan varsa null (kart gizli kalır — yarım/tahmini durum gösterilmez). */
export function taskRows(s: FirstTaskState): FirstTaskRow[] | null {
  const rows: FirstTaskRow[] = [];
  for (const k of FIRST_TASKS) {
    const v = s[k];
    if (v === 'off') continue;
    if (v == null) return null;
    rows.push({ key: k, done: v });
  }
  return rows.length > 0 ? rows : null;
}

export type TasksView = 'hidden' | 'show' | 'celebrate';

/**
 * Kartın hâli: kapatıldıysa / ilk 7 gün dışındaysa / durum bilinmiyorsa gizli; hepsi bittiyse BİR KEZ kutlama
 * (çağıran kutlamadan sonra "kapatıldı" işaretini yazar → bir daha gösterilmez); aksi hâlde liste.
 */
export function tasksView(i: { createdAt: string | null | undefined; now?: number; rows: FirstTaskRow[] | null; dismissed: boolean | null }): TasksView {
  if (i.dismissed !== false) return 'hidden'; // null = işaret henüz okunmadı
  if (!withinFirstDays(i.createdAt, i.now)) return 'hidden';
  if (!i.rows) return 'hidden';
  return i.rows.every((r) => r.done) ? 'celebrate' : 'show';
}

/** Kullanıcıya özel "kapatıldı" işareti (aynı cihazda iki hesap birbirini etkilemez). */
export function tasksDismissKey(userId: string): string {
  return `@kcal_first_tasks_closed:${userId}`;
}

// ─── 6b Kalan tarama hakkı: G54-S1 md.8 ile KALDIRILDI (Ana sayfa rozeti yok). ───

// ─── 6c Bugünün tarifleri ────────────────────────────────────────────────────
export const RECIPE_MAX = 8;

export interface RecipeSourcePost {
  id: string;
  media?: readonly { url: string; kind?: string; thumb_path?: string | null }[] | null;
  meal_card: { name: string; kcal: number; protein_g?: number | null; photo_url?: string | null } | null;
  status?: string;
  /** 18 Kas: yalnız resmi/doğrulanmış hesapların tarifleri; kullanıcıların kendi öğün paylaşımları değil. */
  author?: { role?: string | null; verified?: boolean | null } | null;
  me?: { is_author?: boolean | null } | null;
}

/** "Bugünün tarifleri"ne yalnız resmi (kurum) ya da doğrulanmış hesapların gönderileri girer; kendi gönderin girmez. */
export function isRecipeSource(p: Pick<RecipeSourcePost, 'author' | 'me'>): boolean {
  if (p.me?.is_author) return false;
  if (!p.author) return true; // eski veri / test: yazar bilgisi yoksa önceki kural
  return p.author.role === 'kurum' || p.author.verified === true;
}

export interface HomeRecipe {
  id: string;
  name: string;
  kcal: number;
  protein: number | null;
  photo: string;
}

/** Akıştan tarif kartları: kalorisi (> 0) ve görseli olan öğün kartları, tekrar yok, en çok 8. */
export function recipesFromFeed(items: readonly RecipeSourcePost[] | null | undefined, max = RECIPE_MAX): HomeRecipe[] {
  const out: HomeRecipe[] = [];
  const seen = new Set<string>();
  for (const p of items ?? []) {
    if (out.length >= max) break;
    const m = p?.meal_card;
    if (!m || seen.has(p.id) || (p.status && p.status !== 'published') || !isRecipeSource(p)) continue;
    const kcal = Number(m.kcal);
    if (!Number.isFinite(kcal) || kcal <= 0) continue;
    const first = p.media?.[0];
    const photo = m.photo_url || (first ? (first.kind === 'video' ? first.thumb_path ?? null : first.url) : null);
    if (!photo || !String(m.name ?? '').trim()) continue;
    const prot = Number(m.protein_g);
    seen.add(p.id);
    out.push({ id: p.id, name: String(m.name).trim(), kcal: Math.round(kcal), protein: Number.isFinite(prot) && prot > 0 ? Math.round(prot) : null, photo });
  }
  return out;
}

// ─── 6d Koç hazır soruları ───────────────────────────────────────────────────
export type CoachPrompt = 'dinner' | 'protein' | 'week';
export const COACH_PROMPTS: readonly CoachPrompt[] = ['dinner', 'protein', 'week'];

// ─── 6e Seri ve haftalık özet ────────────────────────────────────────────────
export interface DayBucketLike {
  date: string;
  kcal: number;
  count?: number;
}

export interface WeekCol {
  key: string;
  /** 0 … 1 (hedefe göre; hedef yoksa haftanın en yüksek gününe göre). */
  k: number;
  kcal: number;
  logged: boolean;
  today: boolean;
  future: boolean;
}

/** Bu haftanın (Pazartesi başlangıç) 7 günü; günler 30 günlük kovadan, gelecek günler boş. */
export function weekColumns(days: readonly DayBucketLike[], todayKey: string, targetKcal: number | null | undefined): WeekCol[] {
  const wd = new Date(`${todayKey}T12:00:00Z`).getUTCDay(); // 0 Paz … 6 Cmt
  const monday = addDays(todayKey, -((wd + 6) % 7));
  const byKey = new Map(days.map((d) => [d.date, d]));
  const keys = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const kcals = keys.map((k) => (k > todayKey ? 0 : Math.max(0, Math.round(byKey.get(k)?.kcal ?? 0))));
  const base = targetKcal && targetKcal > 0 ? targetKcal : Math.max(0, ...kcals);
  return keys.map((key, i) => {
    const d = byKey.get(key);
    const logged = key <= todayKey && !!d && (typeof d.count === 'number' ? d.count > 0 : d.kcal > 0);
    return {
      key,
      kcal: kcals[i],
      k: base > 0 ? Math.min(1, kcals[i] / base) : 0,
      logged,
      today: key === todayKey,
      future: key > todayKey,
    };
  });
}

/** Gösterilen seri (bugünün kayıtları kovaya yansımamış olabilir → `todayCount` eklenir). */
export function homeStreak(days: readonly DayBucketLike[], todayKey: string, todayCount: number): number {
  const s = loggedDays(days);
  if (todayCount > 0) s.add(todayKey);
  return displayStreak(s, todayKey);
}
