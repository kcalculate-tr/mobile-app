// eatkcal v2 (G22-S2 md.3) — konum: Avrupa + Amerika (Kuzey, Orta, Güney) ülke + şehir (SAF).
//
// Türkiye mevcut il/ilçe akışında kalır (provinces.ts → gateTarget; İzmir sipariş).
// Diğer ülkeler: şehir araması `search_cities` RPC'si (supabase/migrations/
// 20261110100100_g22_s2_geo.sql, CANLIYA UYGULANACAK; veri GeoNames cities15000,
// CC BY 4.0). Seçilen yabancı şehir → "Çok yakında [şehir]'deki restoranlar burada
// listelenecek." + Restoran öner / Restoranını ekle (mevcut form sheet'leri).
// Listede şehirlerin yanında "Çok yakında" YAZILMAZ.
import { gateTarget } from './provinces';
import { GEO_COUNTRIES, type GeoCountry } from './geoCountries';

export type { GeoCountry } from './geoCountries';

export const TURKEY = 'TR';
/** Bu kadar karakterden kısa sorgu sunucuya gitmez (RPC de boş döner). */
export const CITY_QUERY_MIN = 2;
/** Sorgu üst sınırı (RPC ile aynı). */
export const CITY_QUERY_MAX = 64;
/** RPC en çok bu kadar satır döner. */
export const CITY_RESULTS_MAX = 20;
/** Yazma duraksaması (ağ isteği seyreltme; hareket süresi DEĞİL). */
export const CITY_SEARCH_DEBOUNCE_MS = 300;

export interface GeoCity {
  geonameid: number;
  name: string;
  country: string;
  population: number;
  /** G23-S1: eyalet / bölge adı (GeoNames admin1) — aynı adlı şehirleri ayırt eder. */
  admin1?: string;
}

/** Arayüz dili kodu ('tr' dışındaki her dil İngilizce ülke adını görür). */
export type Lang = string;

// ── Metin katlama (SQL `geo_fold` ile aynı küme) ────────────────────────────
const FOLD_FROM = 'áàâäãåāăąçćčďđéèêëēėęěğíìîïīįıłñńňóòôöõøōőřśšşșţțťúùûüūůűųýÿžźż';
const FOLD_TO = 'aaaaaaaaacccddeeeeeeeegiiiiiiilnnnoooooooorsssstttuuuuuuuuyyzzz';
const FOLD_MAP: Record<string, string> = (() => {
  const from = Array.from(FOLD_FROM);
  const to = Array.from(FOLD_TO);
  const m: Record<string, string> = { ß: 'ss', æ: 'ae', œ: 'oe', þ: 'th' };
  from.forEach((ch, i) => {
    m[ch] = to[i];
  });
  return m;
})();

/** Küçük harf + Latin aksan katlama ("İzmir" → "izmir", "München" → "munchen"). */
export function foldText(s: string): string {
  const lower = s.replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase();
  let out = '';
  for (const ch of lower) out += FOLD_MAP[ch] ?? ch;
  return out;
}

/** Arama kutusu → RPC sorgusu: kırp, boşlukları tekle, üst sınır; kısa ise boş. */
export function normalizeCityQuery(raw: string): string {
  const q = raw.replace(/\s+/g, ' ').trim().slice(0, CITY_QUERY_MAX).trim();
  return foldText(q).length >= CITY_QUERY_MIN ? q : '';
}

// ── Ülkeler ─────────────────────────────────────────────────────────────────
export function isTurkey(iso2: string | null | undefined): boolean {
  return iso2 === TURKEY;
}

export function findCountry(iso2: string | null | undefined): GeoCountry | undefined {
  return iso2 ? GEO_COUNTRIES.find((c) => c.iso2 === iso2) : undefined;
}

export function countryName(c: GeoCountry, lang: Lang): string {
  return lang === 'tr' ? c.tr : c.en;
}

/** Türkiye başta, diğerleri seçili dilde alfabe sırasında. */
export function orderedCountries(lang: Lang, list: readonly GeoCountry[] = GEO_COUNTRIES): GeoCountry[] {
  const tr = list.filter((c) => isTurkey(c.iso2));
  const rest = list
    .filter((c) => !isTurkey(c.iso2))
    .slice()
    .sort((a, b) => countryName(a, lang).localeCompare(countryName(b, lang), lang));
  return [...tr, ...rest];
}

/** Ülke araması: TR ve EN ad (aksansız) + ISO kodu; ad başı eşleşmeleri önce. */
export function filterCountries(list: readonly GeoCountry[], q: string, lang: Lang): GeoCountry[] {
  const n = foldText(q.trim());
  if (!n) return list.slice();
  const starts: GeoCountry[] = [];
  const contains: GeoCountry[] = [];
  for (const c of list) {
    const names = [foldText(countryName(c, lang)), foldText(c.tr), foldText(c.en)];
    if (names.some((x) => x.startsWith(n)) || c.iso2.toLowerCase() === n) starts.push(c);
    else if (names.some((x) => x.includes(n))) contains.push(c);
  }
  return [...starts, ...contains];
}

// ── Şehir araması ──────────────────────────────────────────────────────────
/** RPC satırları → doğrulanmış şehir listesi (bozuk satırlar atılır, en çok 20). */
export function parseCityRows(data: unknown): GeoCity[] {
  if (!Array.isArray(data)) return [];
  const out: GeoCity[] = [];
  for (const r of data) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;
    const id = Number(row.geonameid);
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const country = typeof row.country_iso2 === 'string' ? row.country_iso2 : '';
    if (!Number.isInteger(id) || id <= 0 || !name || !/^[A-Z]{2}$/.test(country)) continue;
    const pop = Number(row.population);
    const admin1 = typeof row.admin1 === 'string' ? row.admin1.trim().slice(0, 200) : '';
    out.push({
      geonameid: id,
      name,
      country,
      population: Number.isFinite(pop) && pop > 0 ? pop : 0,
      ...(admin1 && admin1 !== name ? { admin1 } : {}),
    });
    if (out.length >= CITY_RESULTS_MAX) break;
  }
  return out;
}

export type CitySearchResult = { status: 'ok'; cities: GeoCity[] } | { status: 'empty' } | { status: 'error' };

type Rpc = (fn: 'search_cities', args: { q: string; country: string | null }) => PromiseLike<{ data: unknown; error: unknown }>;

/** Tek arama: hata (ağ yok / RPC canlıda yok) → 'error', hiç satır → 'empty'. */
export async function searchCities(rpc: Rpc, rawQuery: string, country: string | null): Promise<CitySearchResult> {
  const q = normalizeCityQuery(rawQuery);
  if (!q) return { status: 'empty' };
  try {
    const { data, error } = await rpc('search_cities', { q, country });
    if (error) return { status: 'error' };
    const cities = parseCityRows(data);
    return cities.length ? { status: 'ok', cities } : { status: 'empty' };
  } catch {
    return { status: 'error' };
  }
}

/** Ağ/sonuç yokken yazılan adla devam: kimliksiz (geonameid 0) şehir. */
/** Satır etiketi: "Springfield, Illinois" (admin1 yoksa yalnız ad). */
export function cityLabel(c: Pick<GeoCity, 'name' | 'admin1'>): string {
  return c.admin1 ? `${c.name}, ${c.admin1}` : c.name;
}

export function typedCity(raw: string, country: string): GeoCity | null {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, 80);
  return name.length >= CITY_QUERY_MIN ? { geonameid: 0, name, country, population: 0 } : null;
}

// ── Kapı kararı ────────────────────────────────────────────────────────────
export type GeoGateTarget = 'order' | 'waitlist' | 'soon' | null;

/**
 * Türkiye: bugünkü il akışı AYNEN (İzmir → sipariş, diğer il → bekleme listesi).
 * Diğer ülke: şehir seçildiyse "Çok yakında" (FinEatBerlin), seçilmediyse yok.
 */
export function geoGateTarget(country: string, il: string | null, city: GeoCity | null): GeoGateTarget {
  if (isTurkey(country)) return gateTarget('TR', il);
  return city ? 'soon' : null;
}

// ── Türkçe ek: "[şehir]'deki" ───────────────────────────────────────────────
const BACK = new Set(['a', 'ı', 'o', 'u']);
const FRONT = new Set(['e', 'i', 'ö', 'ü']);
const HARD = new Set(['f', 's', 't', 'k', 'ç', 'ş', 'h', 'p']);

/**
 * Bulunma eki + "ki" (kesme işaretiyle): Berlin'deki, Paris'teki, Roma'daki, New York'taki.
 * Yabancı adlarda yazıma göre (okunuşa değil) — aksanlar katlanarak ünlü uyumu seçilir.
 */
export function trLocativeKi(name: string): string {
  const base = name.trim();
  if (!base) return base;
  const letters = Array.from(base.replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase())
    .map((ch) => (BACK.has(ch) || FRONT.has(ch) || HARD.has(ch) ? ch : FOLD_MAP[ch] ?? ch))
    .filter((ch) => /\p{L}/u.test(ch));
  let vowel: 'a' | 'e' = 'e';
  for (let i = letters.length - 1; i >= 0; i--) {
    const ch = letters[i];
    if (BACK.has(ch)) {
      vowel = 'a';
      break;
    }
    if (FRONT.has(ch)) {
      vowel = 'e';
      break;
    }
  }
  const last = letters[letters.length - 1] ?? '';
  const d = HARD.has(last) ? 't' : 'd';
  return `${base}'${d}${vowel}ki`;
}
