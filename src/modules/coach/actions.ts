// G24-S1 md.3 — kcalAI Koç kart eylemleri ve girişler. Koç kendi kaydı YAPMAZ: "Günüme ekle"
// kullanıcının dokunuşuyla MEVCUT öğün ekleme akışına (çevrimdışı kuyruk, submitLogOp) gider;
// "Sepete ekle" MEVCUT sepete (zorunlu seçimli ürün → ürün ekranı); "Tarifi aç" gönderi ekranı.
import type { CoachCard, CoachChatParams } from './types';
import { introSeen } from './access';

type Nav = { navigate: (name: string, params?: object) => void };

type MealCard = Extract<CoachCard, { type: 'meal_suggestion' }>;

/**
 * Öneriyi güne ekle (kaynak 'manual' — meal_consumptions CHECK'inde koç kaynağı yok; source_ref
 * `coach:<mesaj>:<sıra>` aynı önerinin iki kez eklenmesini (23505 = zaten yazıldı) önler).
 */
/** G28-S1 md.1: Logla izi Geri al — Koç önerisinden eklenen satırı siler (aynı kuyruk). */
export async function removeSuggestionFromDay(id: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { submitLogOp } = require('../gun/track/logQueueNative') as typeof import('../gun/track/logQueueNative');
  try {
    return await submitLogOp({ kind: 'delete', id, at: Date.now() });
  } catch {
    return false;
  }
}

/** Satır id'si ile ekler (Logla izi Geri al için); başarısızsa null. */
export async function addSuggestionToDayWithId(card: MealCard, messageId: string, index: number): Promise<string | null> {
  const r = await addSuggestionRow(card, messageId, index);
  return r.ok ? r.id : null;
}

export async function addSuggestionToDay(card: MealCard, messageId: string, index: number): Promise<boolean> {
  return (await addSuggestionRow(card, messageId, index)).ok;
}

async function addSuggestionRow(card: MealCard, messageId: string, index: number): Promise<{ ok: boolean; id: string }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { submitLogOp, newRowId } = require('../gun/track/logQueueNative') as typeof import('../gun/track/logQueueNative');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { slotFromHour } = require('../gun/homeData') as typeof import('../gun/homeData');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { toServerMealType } = require('../../core/meal/mealType') as typeof import('../../core/meal/mealType');
  const id = newRowId();
  const row = {
    id,
    source: 'manual',
    source_ref: `coach:${messageId}:${index}`,
    name: card.name,
    meal_type: toServerMealType(slotFromHour(new Date().getHours())),
    calories: Math.round(card.kcal),
    protein: card.p,
    carbs: card.c,
    fat: card.f,
    note: null,
    consumed_at: new Date().toISOString(),
  };
  try {
    return { ok: await submitLogOp({ kind: 'insert', id, row, at: Date.now() }), id };
  } catch {
    return { ok: false, id };
  }
}

/** eatkcal ürününü sepete ekle. Zorunlu seçim (gramaj/opsiyon) varsa ürün ekranına gider. */
export async function addProductToCart(productId: number, nav: Nav): Promise<'added' | 'opened' | 'failed'> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseClient } = require('../../core/supabase') as typeof import('../../core/supabase');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mapProductRow, fetchProductOptionGroups } = require('../../lib/products') as typeof import('../../lib/products');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { needsOptionSelection } = require('../../lib/quickAdd') as typeof import('../../lib/quickAdd');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useCartStore } = require('../../store/cartStore') as typeof import('../../store/cartStore');
    const sb = getSupabaseClient();
    const { data, error } = await sb.from('products').select('*').eq('id', productId).maybeSingle();
    if (error || !data) return 'failed';
    const product = mapProductRow(data as Record<string, unknown>);
    let groups: Awaited<ReturnType<typeof fetchProductOptionGroups>> | null = null;
    try {
      groups = await fetchProductOptionGroups(sb, String(productId));
    } catch {
      nav.navigate('ProductDetail', { productId: String(productId) });
      return 'opened';
    }
    if (needsOptionSelection({ gramajOptions: (product as { gramaj_options?: unknown }).gramaj_options, optionGroups: groups })) {
      nav.navigate('ProductDetail', { productId: String(productId) });
      return 'opened';
    }
    useCartStore.getState().addItem(product, {}, 1);
    return 'added';
  } catch {
    return 'failed';
  }
}

export function openRecipe(postId: string, nav: Nav): void {
  nav.navigate('SharedPost', { postId });
}

/** Koçu aç: tanıtım bir kez (FinCoachIntro), sonra sohbet. Soru önceden doldurulmuş açılır. */
export async function openCoach(nav: Nav, params: CoachChatParams = {}): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { trackCoach } = require('./track') as typeof import('./track');
    trackCoach('coach_open', { from: params.from ?? 'other' });
  } catch {
    /* ölçüm yok */
  }
  const seen = await introSeen();
  nav.navigate(seen ? 'CoachChat' : 'CoachIntro', params);
}
