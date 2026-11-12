// G22-S2 md.5 (Tur 26j, G21 T2 — FinShareDay + FinShareDaySuccess) — "Günümü
// Keşfet’te paylaş" SAF mantığı: önizleme kartı verisi + gönderim. Native/ağ yok
// (istemci dışarıdan verilir) → tsx --test.
//
// Paylaşım YOLU: tasarım metni "Bugünün özeti, Keşfet’in üstündeki Günüm halkanda
// görünür" — Günüm halkası `day_shares` tablosundan beslenir (get_day_rings /
// get_day_cards). Bu yüzden gün paylaşımı = bugünün her öğünü için mevcut
// `share_meal_to_day` RPC'si (idempotent: on conflict süre yenilenir). `create_post`
// akış GÖNDERİSİ üretir (halkaya düşmez, görünürlük alanı yok) → kullanılmadı.
//
// Görünürlük / makro gizleme / not: sunucuda alan YOK (day_shares yalnız
// user_id+consumption_id; görünürlük profil gizliliğinden — feed_can_view_author).
// Bu seçenekler SHARE_DAY_SERVER_OPTIONS açılana kadar sheet'te GİZLİ (kullanıcıya
// işlemeyen bir seçim gösterilmez). Bkz. G22-S2 SORULAR.
import { toClientMealType, type ClientMealType } from '../../core/meal/mealType';
import type { ActivityType, DayActivity } from '../kesfet/types';

/** Sunucu görünürlük/makro/not alanlarını destekleyince true (migration + RPC). */
export const SHARE_DAY_SERVER_OPTIONS = false;

export const SHARE_NOTE_MAX = 80;

export type ShareAudience = 'public' | 'followers';

export interface ShareDayMealInput {
  id: string;
  meal_type: string | null;
  kcal: number;
  consumed_at: string;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  photo_url?: string | null;
}

/** `useNutritionSummary` alt kümesi (sunucu özeti — gün toplamının tek kaynağı). */
export interface ShareDaySummary {
  targetKcal: number;
  consumedKcal: number;
  consumedProtein: number;
  consumedCarb: number;
  consumedFat: number;
}

export interface ShareDayMealTile {
  meal: ClientMealType;
  photo_url: string | null;
  kcal: number;
}

export interface ShareDayCard {
  consumptionIds: string[];
  kcal: number;
  targetKcal: number | null;
  /** 0–1, halka dolumu (hedef yoksa 0). */
  progress: number;
  /** Yuvarlanmış yüzde; hedef yoksa null (yüzde gösterilmez). */
  pct: number | null;
  macros: { p: number; c: number; f: number } | null;
  meals: ShareDayMealTile[];
  activity: { type: ActivityType; minutes: number } | null;
}

const MEAL_ORDER: ClientMealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const n = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Önizleme kartı verisi. Gün toplamı varsa SUNUCU özetinden, yoksa öğünlerin toplamından. */
export function buildShareDayCard(input: {
  meals: ShareDayMealInput[];
  summary?: ShareDaySummary | null;
  activity?: DayActivity | null;
}): ShareDayCard {
  const meals = input.meals ?? [];
  const summary = input.summary ?? null;

  const sumKcal = meals.reduce((a, m) => a + n(m.kcal), 0);
  const kcal = Math.round(summary && summary.consumedKcal > 0 ? summary.consumedKcal : sumKcal);
  const targetKcal = summary && summary.targetKcal > 0 ? Math.round(summary.targetKcal) : null;
  const progress = targetKcal ? Math.max(0, Math.min(kcal / targetKcal, 1)) : 0;
  const pct = targetKcal ? Math.round((kcal / targetKcal) * 100) : null;

  let macros: ShareDayCard['macros'] = null;
  if (summary && (summary.consumedProtein > 0 || summary.consumedCarb > 0 || summary.consumedFat > 0)) {
    macros = { p: Math.round(summary.consumedProtein), c: Math.round(summary.consumedCarb), f: Math.round(summary.consumedFat) };
  } else if (meals.some((m) => m.protein_g != null || m.carbs_g != null || m.fat_g != null)) {
    macros = {
      p: Math.round(meals.reduce((a, m) => a + n(m.protein_g), 0)),
      c: Math.round(meals.reduce((a, m) => a + n(m.carbs_g), 0)),
      f: Math.round(meals.reduce((a, m) => a + n(m.fat_g), 0)),
    };
  }

  // Öğün kutucukları: öğün türü başına bir kutucuk (Kahvaltı · Öğle · Akşam · Ara),
  // o türün ilk fotoğrafı; kcal türün toplamı.
  const byMeal = new Map<ClientMealType, ShareDayMealTile>();
  const sorted = [...meals].sort((a, b) => Date.parse(a.consumed_at) - Date.parse(b.consumed_at));
  for (const m of sorted) {
    const meal = toClientMealType(m.meal_type ?? 'snack');
    const tile = byMeal.get(meal) ?? { meal, photo_url: null, kcal: 0 };
    tile.kcal += n(m.kcal);
    if (!tile.photo_url && m.photo_url) tile.photo_url = m.photo_url;
    byMeal.set(meal, tile);
  }
  const tiles = MEAL_ORDER.filter((k) => byMeal.has(k)).map((k) => {
    const tile = byMeal.get(k)!;
    return { ...tile, kcal: Math.round(tile.kcal) };
  });

  // Etkinlik satırı: günün en uzun etkinliği ("Koşu 45 dk").
  let activity: ShareDayCard['activity'] = null;
  for (const it of input.activity?.items ?? []) {
    if (it.minutes > 0 && (!activity || it.minutes > activity.minutes)) activity = { type: it.type, minutes: Math.round(it.minutes) };
  }

  return {
    consumptionIds: meals.map((m) => m.id),
    kcal,
    targetKcal,
    progress,
    pct,
    macros,
    meals: tiles,
    activity,
  };
}

/** Paylaşılacak bir şey var mı? (Öğün yoksa Günüm halkasına düşecek kart yok.) */
export function canShareDay(card: ShareDayCard | null): boolean {
  return !!card && card.consumptionIds.length > 0;
}

/** Başarı bildirimi anahtarı (FinShareDaySuccess): kitleye göre. */
export function shareDayToastKey(audience: ShareAudience): string {
  return audience === 'public' ? 'share_day.toast_pub' : 'share_day.toast_fol';
}

/** Not alanı: en çok SHARE_NOTE_MAX karakter. */
export function clampShareNote(note: string): string {
  return note.slice(0, SHARE_NOTE_MAX);
}

/**
 * Günü paylaş: bugünkü her öğün için `share_meal_to_day`. Herhangi biri başarısızsa
 * FIRLATIR (çağıran satır içi hata + "Tekrar dene" gösterir; RPC idempotent olduğu
 * için yeniden deneme hepsini güvenle tekrar gönderir).
 */
export async function submitShareDay(
  client: { shareMealToDay(params: { consumption: string }): Promise<void> },
  consumptionIds: string[],
): Promise<{ shared: number }> {
  if (consumptionIds.length === 0) throw new Error('share_day_empty');
  const results = await Promise.allSettled(consumptionIds.map((id) => client.shareMealToDay({ consumption: id })));
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed > 0) throw new Error(`share_day_failed:${failed}/${consumptionIds.length}`);
  return { shared: consumptionIds.length };
}
