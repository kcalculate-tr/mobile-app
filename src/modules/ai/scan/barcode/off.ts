// G21-S1 md.2 — Barkod → Open Food Facts (İlter 10 Kas 00:45). SAF: native import yok;
// fetch / depolama / saat / sürüm enjekte edilir (birim testi: __tests__/g21Barcode.test.ts).
//
//  • İstek: GET https://world.openfoodfacts.org/api/v2/product/<kod>.json?fields=…
//    başlık `User-Agent: Kcalculate/<sürüm> (support@eatkcal.com)` (OFF API kuralı).
//  • Zaman aşımı 6 sn (AbortController) → { status:'error', reason:'timeout' }.
//  • Önbellek: cihazda kod → ürün, 30 gün (yalnız BULUNAN ürün; bulunamayan kod
//    yeniden sorulur — OFF'a sonradan eklenebilir).
//  • Ürün yok / kcal yok → not_found (sahte değer YOK). AI hakkı hiç dokunulmaz.
//  • Veri lisansı ODbL: sonuç ekranında "Veri: Open Food Facts (ODbL)" atfı (FinBarcodeResult) + Profil › Sözleşmeler.

export const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product/';
export const OFF_FIELDS =
  'code,product_name,product_name_tr,product_name_en,brands,nutriments,serving_size,serving_quantity,image_front_small_url';
export const OFF_TIMEOUT_MS = 6000;
export const OFF_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const OFF_CACHE_PREFIX = 'kcal.off.v1:';
export const OFF_CONTACT = 'support@eatkcal.com';

export interface OffPer100 {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export interface OffProduct {
  code: string;
  /** Ad adayları (dil seçimi okumada yapılır — önbellek dilden bağımsız). */
  names: { tr: string | null; en: string | null; generic: string | null };
  brand: string | null;
  imageUrl: string | null;
  per100: OffPer100;
  /** serving_quantity (g) — yoksa null (porsiyon varsayılanı 100 g). */
  servingGrams: number | null;
}

export type BarcodeLookup =
  | { status: 'found'; product: OffProduct; cached: boolean }
  | { status: 'not_found'; reason: 'missing' | 'no_kcal' }
  | { status: 'error'; reason: 'timeout' | 'network' | 'http' | 'offline' };

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

type FetchLike = (
  url: string,
  init: { method: 'GET'; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface LookupDeps {
  fetch?: FetchLike;
  storage?: KeyValueStore | null;
  now?: () => number;
  version?: string;
  timeoutMs?: number;
  /** Cihaz çevrimdışı (NetInfo): yalnız önbellek; yoksa error·offline (istek yok). */
  offline?: boolean;
}

export function offUserAgent(version: string | null | undefined): string {
  return `Kcalculate/${version && version.trim() ? version.trim() : '0.0.0'} (${OFF_CONTACT})`;
}

export function offUrl(code: string): string {
  return `${OFF_ENDPOINT}${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const nonNeg = (v: unknown): number => {
  const n = num(v);
  return n != null && n > 0 ? n : 0;
};
const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s : null;
};

/** 100 g başına kcal: `energy-kcal_100g`; yoksa kJ'den (÷ 4,184). Yoksa null. */
export function kcalPer100(n: Record<string, unknown>): number | null {
  const kcal = num(n['energy-kcal_100g']);
  if (kcal != null && kcal > 0) return kcal;
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
  if (kj != null && kj > 0) return kj / 4.184;
  return null;
}

/** OFF yanıtı → ürün; ürün yok / kcal yok → not_found nedeni. */
export function parseOffResponse(
  code: string,
  body: unknown,
): { product: OffProduct } | { reason: 'missing' | 'no_kcal' } {
  const b = (body ?? {}) as { status?: unknown; product?: Record<string, unknown> };
  const p = b.product;
  if (!p || typeof p !== 'object' || b.status === 0 || b.status === '0') return { reason: 'missing' };
  const nutr = (p.nutriments ?? {}) as Record<string, unknown>;
  const kcal = kcalPer100(nutr);
  if (kcal == null) return { reason: 'no_kcal' };
  // Adsız ürün de kabul (ad düzenlenebilir; gösterimde kod — productDisplayName).
  const names = { tr: str(p.product_name_tr), en: str(p.product_name_en), generic: str(p.product_name) };
  const brand = str(p.brands)?.split(',')[0]?.trim() || null;
  const sq = num(p.serving_quantity);
  const servingGrams = sq != null && sq > 0 && sq <= 2000 ? Math.round(sq) : null;
  return {
    product: {
      code: str(p.code) ?? code,
      names,
      brand,
      imageUrl: str(p.image_front_small_url),
      per100: {
        kcal: Math.round(kcal * 10) / 10,
        p: Math.round(nonNeg(nutr.proteins_100g) * 10) / 10,
        c: Math.round(nonNeg(nutr.carbohydrates_100g) * 10) / 10,
        f: Math.round(nonNeg(nutr.fat_100g) * 10) / 10,
      },
      servingGrams,
    },
  };
}

/** Gösterilecek ad: cihaz dili önce, sonra genel ad, sonra öbür dil; hiçbiri yoksa kod. */
export function productDisplayName(p: OffProduct, lang: 'tr' | 'en'): string {
  const n = p.names;
  return (lang === 'en' ? n.en ?? n.generic ?? n.tr : n.tr ?? n.generic ?? n.en) ?? p.code;
}

function defaultStorage(): KeyValueStore | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@react-native-async-storage/async-storage');
    return (m.default ?? m) as KeyValueStore;
  } catch {
    return null;
  }
}

function defaultVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const C = require('expo-constants');
    return ((C.default ?? C)?.expoConfig?.version as string | undefined) ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export async function readCachedProduct(
  code: string,
  storage: KeyValueStore | null,
  now: number,
): Promise<OffProduct | null> {
  if (!storage) return null;
  try {
    const raw = await storage.getItem(OFF_CACHE_PREFIX + code);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at?: number; product?: OffProduct };
    if (!v?.product || typeof v.at !== 'number' || now - v.at > OFF_CACHE_TTL_MS || now < v.at - 60_000) return null;
    return v.product;
  } catch {
    return null;
  }
}

async function writeCache(code: string, product: OffProduct, storage: KeyValueStore | null, now: number): Promise<void> {
  if (!storage) return;
  try {
    await storage.setItem(OFF_CACHE_PREFIX + code, JSON.stringify({ at: now, product }));
  } catch {
    // önbellek yazılamadı — sonuç yine gösterilir
  }
}

/**
 * Barkod → ürün. Önce önbellek (30 gün), sonra OFF. Asla fırlatmaz.
 * Bulunamadı (`status:0` / 404) → not_found·missing; kcal yok → not_found·no_kcal;
 * zaman aşımı / ağ / 5xx → error.
 */
export async function lookupBarcode(code: string, deps: LookupDeps = {}): Promise<BarcodeLookup> {
  const now = (deps.now ?? Date.now)();
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const cached = await readCachedProduct(code, storage, now);
  if (cached) return { status: 'found', product: cached, cached: true };
  if (deps.offline) return { status: 'error', reason: 'offline' };

  const doFetch = deps.fetch ?? (globalThis.fetch as unknown as FetchLike | undefined);
  if (!doFetch) return { status: 'error', reason: 'network' };
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      ctrl?.abort();
      resolve('timeout');
    }, deps.timeoutMs ?? OFF_TIMEOUT_MS);
  });
  try {
    const res = await Promise.race([
      doFetch(offUrl(code), {
        method: 'GET',
        headers: { 'User-Agent': offUserAgent(deps.version ?? defaultVersion()), Accept: 'application/json' },
        ...(ctrl ? { signal: ctrl.signal } : {}),
      }),
      timeout,
    ]);
    if (res === 'timeout') return { status: 'error', reason: 'timeout' };
    if (res.status === 404) return { status: 'not_found', reason: 'missing' };
    if (!res.ok) return { status: 'error', reason: 'http' };
    const body = await Promise.race([res.json(), timeout]);
    if (body === 'timeout') return { status: 'error', reason: 'timeout' };
    const parsed = parseOffResponse(code, body);
    if ('reason' in parsed) return { status: 'not_found', reason: parsed.reason };
    await writeCache(code, parsed.product, storage, now);
    return { status: 'found', product: parsed.product, cached: false };
  } catch {
    return { status: 'error', reason: timedOut ? 'timeout' : 'network' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Bulunan ürün → mevcut Tara sonuç ekranının tahmin biçimi (tek öğe, porsiyon
 * gram = serving_quantity ya da 100 g). Değerler 100 g başına × gram / 100.
 */
export function barcodeEstimate(
  name: string,
  per100: OffPer100,
  grams: number,
): { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; portion: number; ingredients: { name: string; grams: number; kcal: number }[]; photo_url: null } {
  const g = Number.isFinite(grams) && grams > 0 ? grams : 0;
  const f = g / 100;
  const r = (v: number) => Math.max(0, Math.round(v * f));
  const nm = name.replace(/\s+/g, ' ').trim().slice(0, 80) || '—';
  return {
    name: nm,
    kcal: r(per100.kcal),
    protein_g: r(per100.p),
    carbs_g: r(per100.c),
    fat_g: r(per100.f),
    portion: 1,
    ingredients: [{ name: nm, grams: Math.round(g), kcal: r(per100.kcal) }],
    photo_url: null,
  };
}
