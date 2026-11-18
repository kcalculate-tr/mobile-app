// G62-S1 — Sipariş değerlendirme v2: veri katmanı (Supabase). Kurallar orderRate.ts'te (SAF).
//  - İstem: kendi teslim edilmiş siparişleri (RLS) + reviews'ta kaydı olmayanlar; 7 gün penceresi istemcide
//    süzülür, sunucu submit_order_rating aynı kuralı ayrıca uygular (tek kez / 7 gün / teslim).
//  - Gönderim: submit_order_rating RPC (tek yazma yolu) → yorum/fotoğraf varsa moderate-content
//    ('review', moderation_id) BEST-EFFORT; çağrı düşerse pg_cron kuyruğu yeniden dener.
//  - Fotoğraf: mevcut user-media yükleme yolu (AI tarama ile aynı kova, `<uid>/reviews/…`).
//  - Ana sayfa kartını kapatma: cihazda sipariş bazında (AsyncStorage); sipariş detayındaki giriş kalır.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildSubmitArgs,
  pickPromptOrder,
  RATE_WINDOW_MS,
  rateItemsFromOrderItems,
  reviewPhotoPath,
  submitErrorCode,
  type ItemVotes,
  type RateDims,
  type RateItem,
  type SubmitArgs,
  type SubmitError,
} from './orderRate';

type SupabaseModule = typeof import('../../../../core/supabase');
function sb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../../../core/supabase') as SupabaseModule).getSupabaseClient();
}

export interface RatePromptOrder {
  id: number;
  orderCode: string | null;
  deliveredAt: string;
  items: RateItem[];
  /** İlk ürünün id'si (kart görseli için). */
  firstProductId: string | null;
}

const DISMISS_KEY = '@kcal_order_rate_dismissed_v1';

export async function readDismissed(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isFinite(n)) : []);
  } catch {
    return new Set();
  }
}

export async function dismissPrompt(orderId: number): Promise<void> {
  try {
    const cur = await readDismissed();
    cur.add(orderId);
    // Son 50 yeter (7 günlük pencere).
    await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify([...cur].slice(-50)));
  } catch {
    /* kalıcı değilse oturum içinde gizli kalır */
  }
}

type OrderRow = {
  id: number;
  order_code: string | null;
  status: string | null;
  delivered_at: string | null;
  updated_at: string | null;
  items: unknown;
};

function toPrompt(r: OrderRow, fallbackName: string): RatePromptOrder {
  const items = rateItemsFromOrderItems(r.items, fallbackName);
  return {
    id: Number(r.id),
    orderCode: r.order_code ?? null,
    deliveredAt: String(r.delivered_at || r.updated_at || ''),
    items,
    firstProductId: items[0] ? String(items[0].productId) : null,
  };
}

async function reviewedIdsOf(userId: string, ids: number[]): Promise<Set<number> | null> {
  if (ids.length === 0) return new Set();
  const { data, error } = await sb().from('reviews').select('order_id').eq('user_id', userId).in('order_id', ids);
  if (error) return null; // emin değilsek istem gösterilmez
  return new Set((data ?? []).map((r: { order_id: number }) => Number(r.order_id)));
}

/** Ana sayfa: pencere içindeki, değerlendirilmemiş, kapatılmamış en yeni teslim. */
export async function fetchHomeRatePrompt(userId: string, opts: { now?: number; fallbackName?: string } = {}): Promise<RatePromptOrder | null> {
  const now = opts.now ?? Date.now();
  // updated_at ≥ delivered_at → updated_at ile süzmek pencereyi kaçırmaz; kesin kural pickPromptOrder'da.
  const since = new Date(now - RATE_WINDOW_MS).toISOString();
  const { data, error } = await sb()
    .from('orders')
    .select('id, order_code, status, delivered_at, updated_at, items')
    .eq('user_id', userId)
    .eq('status', 'delivered')
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(10);
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const rows = data as OrderRow[];
  const reviewed = await reviewedIdsOf(userId, rows.map((r) => Number(r.id)));
  if (!reviewed) return null;
  const pick = pickPromptOrder(rows, reviewed, now, await readDismissed());
  return pick ? toPrompt(pick, opts.fallbackName ?? 'Ürün') : null;
}

/** Sipariş detayı: bu sipariş için istem (kapatma yok sayılır). */
export async function fetchOrderRatePrompt(
  userId: string,
  orderId: number,
  opts: { now?: number; fallbackName?: string } = {},
): Promise<RatePromptOrder | null> {
  const now = opts.now ?? Date.now();
  const { data, error } = await sb()
    .from('orders')
    .select('id, order_code, status, delivered_at, updated_at, items')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as OrderRow;
  const reviewed = await reviewedIdsOf(userId, [Number(row.id)]);
  if (!reviewed) return null;
  const pick = pickPromptOrder([row], reviewed, now);
  return pick ? toPrompt(pick, opts.fallbackName ?? 'Ürün') : null;
}

export type SubmitResult = { ok: true; args: SubmitArgs; rating: number } | { ok: false; error: SubmitError };

export async function submitOrderRating(input: {
  orderId: number;
  dims: RateDims;
  comment: string;
  photoPath: string | null;
  votes: ItemVotes;
}): Promise<SubmitResult> {
  const args = buildSubmitArgs(input);
  try {
    const { data, error } = await sb().rpc('submit_order_rating', args);
    if (error) return { ok: false, error: submitErrorCode(error.message) };
    const res = (data ?? {}) as { moderation_id?: string; moderation?: boolean; rating?: number };
    if (res.moderation && res.moderation_id) {
      // Best-effort: yanıt beklenmez; düşerse kuyruk (moderate_pending_retry) dener.
      void sb()
        .functions.invoke('moderate-content', { body: { target_type: 'review', target_id: res.moderation_id } })
        .catch(() => {});
    }
    return { ok: true, args, rating: Number(res.rating) || 0 };
  } catch (e) {
    return { ok: false, error: submitErrorCode(e instanceof Error ? e.message : String(e)) };
  }
}

/** Galeriden seçilen fotoğrafı user-media'ya yükler → kova yolu. Hata → null (yorum yine gönderilebilir). */
export async function uploadReviewPhoto(localUri: string, orderId: number): Promise<string | null> {
  try {
    const client = sb();
    const { data: sess } = await client.auth.getSession();
    const userId = sess.session?.user?.id ?? '';
    if (!userId) return null;
    /* eslint-disable @typescript-eslint/no-require-imports */
    const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
    const { decode } = require('base64-arraybuffer') as typeof import('base64-arraybuffer');
    const scan = require('../../../ai/scan/scanPath') as typeof import('../../../ai/scan/scanPath');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) return null;
    if (typeof info.size === 'number' && info.size > scan.MAX_SCAN_IMAGE_BYTES) return null;
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    if (scan.base64Bytes(base64) > scan.MAX_SCAN_IMAGE_BYTES) return null;
    const path = reviewPhotoPath(userId, orderId, Date.now());
    const { error } = await client.storage.from('user-media').upload(path, decode(base64), {
      contentType: scan.sniffImageType(base64),
      upsert: false,
    });
    return error ? null : path;
  } catch {
    return null;
  }
}
