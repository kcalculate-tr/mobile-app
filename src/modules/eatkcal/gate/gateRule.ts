// G48-S1 md.2–3 — eatkcal konum kapısı: SAF kurallar (native import yok → node:test).
//
// md.2 Kapı kuralı: oturumlu kullanıcının SUNUCUDA kayıtlı adresi (`addresses`) yoksa ana sayfadan önce
// konum kapısı; varsa kapı hiç yok. Adres sorgusu başarısızsa (ağ yok) son bilinen değer; o da yoksa kapı.
// Cihaz geneli "kapı geçildi" işareti yalnız OTURUMSUZ gezinmede geçerli (oturumlu hesabı atlatmaz).
// md.3 İlçe adımı: Ülke → İl → (yalnız Türkiye › İzmir) İlçe. İzmir ilçeleri `delivery_zones`'tan
// (distinct district, alfabetik; aktif satırı olan ilçe "hizmet var"). Hizmet verilen İzmir ilçesi →
// adres ekleme; hizmet dışı İzmir ilçesi / İzmir dışı il / yabancı şehir → "Çok yakında".
import { foldText, isTurkey } from '../v2/model/geo';

export const IZMIR_NAME = 'İzmir';

// ── md.2 kapı kararı ─────────────────────────────────────────────────────────
export interface GateInput {
  signedIn: boolean;
  /** Sunucudaki adres sayısı; null = sorgu başarısız / bilinmiyor. */
  addressCount: number | null;
  /** Bu hesap için son bilinen "adresi var" (cihaz önbelleği); null = hiç bilinmiyor. */
  lastKnownHasAddress: boolean | null;
  /** Oturumsuz gezinme: bu cihazda kapı daha önce geçildi mi (İzmir hizmet ilçesi seçildi). */
  anonPassed: boolean;
}

export function shouldShowGate(i: GateInput): boolean {
  if (!i.signedIn) return !i.anonPassed;
  if (i.addressCount != null) return i.addressCount <= 0;
  return i.lastKnownHasAddress !== true;
}

// ── md.3 İzmir ilçeleri ──────────────────────────────────────────────────────
export interface DistrictOption {
  name: string;
  served: boolean;
}

const fold = (s: string) => foldText(String(s ?? '').trim());

export function isIzmir(city: string | null | undefined): boolean {
  return !!city && fold(city) === 'izmir';
}

/** delivery_zones satırları → İzmir ilçeleri (distinct, alfabetik TR; aktif satırı olan "hizmet var"). */
export function buildDistrictList(rows: readonly Record<string, unknown>[]): DistrictOption[] {
  const map = new Map<string, DistrictOption>();
  for (const r of rows) {
    const city = r.city == null ? '' : String(r.city);
    if (city && !isIzmir(city)) continue; // şehir boşsa İzmir kabul (tablo bugün yalnız İzmir)
    const name = String(r.district ?? '').trim();
    if (!name) continue;
    const key = fold(name);
    const active = r.is_active !== false;
    const cur = map.get(key);
    if (cur) cur.served = cur.served || active;
    else map.set(key, { name, served: active });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

export function findDistrict(list: readonly DistrictOption[], name: string | null | undefined): DistrictOption | null {
  if (!name) return null;
  const k = fold(name);
  return list.find((d) => fold(d.name) === k) ?? null;
}

// ── md.3 seçim → hedef ───────────────────────────────────────────────────────
export interface GateSelection {
  /** ISO-3166 alfa-2 ('TR' = Türkiye). */
  country: string;
  city: string | null;
  district: string | null;
  postalCode?: string | null;
}

/** G49 md.1: şehir seçimi — ilçe VE posta kodu temizlenir (önceki şehrin posta kodu kalmasın). */
export function withCity(sel: GateSelection, city: string): GateSelection {
  return { ...sel, city, district: null, postalCode: null };
}

// ── G49 md.1: Türkiye posta kodu ↔ il tutarlılığı ───────────────────────────
// TR posta kodu 5 hane; ilk iki hane ilin plaka kodudur (35xxx = İzmir, 34xxx = İstanbul).
const TR_PLATE: readonly string[] = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 'Balıkesir',
  'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli',
  'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari',
  'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir',
  'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir',
  'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat',
  'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman',
  'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce',
];
const PLATE_ALIAS: Record<string, string> = { afyon: 'afyonkarahisar', icel: 'mersin', maras: 'kahramanmaras', urfa: 'sanliurfa', antep: 'gaziantep', izmit: 'kocaeli', adapazari: 'sakarya' };

/** İl adı → plaka kodu ("35"); bilinmiyorsa null. */
export function trPlateCode(city: string | null | undefined): string | null {
  if (!city) return null;
  let k = fold(stripIl(city));
  k = PLATE_ALIAS[k] ?? k;
  const i = TR_PLATE.findIndex((n) => fold(n) === k);
  return i < 0 ? null : String(i + 1).padStart(2, '0');
}

/**
 * Posta kodu seçilen şehirle tutarlı mı: şehir yoksa posta kodu tutulmaz; Türkiye'de il biliniyorsa kodun ilk
 * iki hanesi plakayla eşleşmeli (5 hane). Yabancı şehirde biçim denetimi yok (ülkeye göre değişir).
 */
export function consistentPostal(country: string, city: string | null | undefined, postal: string | null | undefined): string | null {
  const p = (postal ?? '').trim();
  if (!p || !city?.trim()) return null;
  if (isTurkey(country)) {
    if (!/^\d{5}$/.test(p)) return null;
    const plate = trPlateCode(city);
    if (plate && p.slice(0, 2) !== plate) return null;
  }
  return p;
}

/** "Restoranları gör" etkin mi: ülke + şehir şart; Türkiye › İzmir'de ilçe de zorunlu. */
export function canSubmit(sel: GateSelection): boolean {
  if (!sel.country || !sel.city?.trim()) return false;
  if (isTurkey(sel.country) && isIzmir(sel.city)) return !!sel.district?.trim();
  return true;
}

/** İlçe alanı türü: İzmir → liste (delivery_zones); diğer il/şehir → serbest metin. */
export function districtMode(sel: Pick<GateSelection, 'country' | 'city'>): 'list' | 'text' {
  return isTurkey(sel.country) && isIzmir(sel.city) ? 'list' : 'text';
}

export type GateTarget = 'address' | 'soon';

/** Hizmet verilen İzmir ilçesi → adres ekleme; diğer her durum → Çok yakında. */
export function gateTarget(sel: GateSelection, districts: readonly DistrictOption[]): GateTarget {
  if (!isTurkey(sel.country) || !isIzmir(sel.city)) return 'soon';
  const d = findDistrict(districts, sel.district);
  return d?.served ? 'address' : 'soon';
}

/** Konum hapı: "[İlçe], [Şehir]" (ilçe yoksa yalnız şehir). */
export function locationLabel(sel: Pick<GateSelection, 'city' | 'district'>): string {
  return [sel.district?.trim(), sel.city?.trim()].filter(Boolean).join(', ');
}

/** md.4 ölçüm: `eatkcal_gate_select` alanları (kişisel veri yok; uzun metin kırpılır). */
export function gateSelectProps(sel: GateSelection, served: boolean) {
  const clip = (v: string | null | undefined) => (v ?? '').trim().slice(0, 64);
  return { country: clip(sel.country).toUpperCase(), city: clip(sel.city), district: clip(sel.district), served };
}

// ── Konum düğmesi: ters coğrafi kodlama → seçim ──────────────────────────────
export interface ReverseGeoResult {
  isoCountryCode?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  subregion?: string | null;
  district?: string | null;
  postalCode?: string | null;
}

const stripIl = (s: string) => s.replace(/\s+(ili|province|il)$/i, '').trim();

/**
 * expo-location `reverseGeocodeAsync` ilk sonucu → ülke / şehir / ilçe / posta kodu.
 * Türkiye'de il = region (iOS: "İzmir"), ilçe = subregion (iOS) ya da city (Android). İzmir'de ilçe
 * delivery_zones listesinde eşleşirse listedeki yazımla döner.
 */
export function selectionFromGeocode(g: ReverseGeoResult | null | undefined, districts: readonly DistrictOption[]): GateSelection | null {
  if (!g) return null;
  const country = (g.isoCountryCode ?? '').toUpperCase();
  if (!country) return null;
  if (country === 'TR') {
    const city = stripIl(g.region ?? g.city ?? '');
    if (!city) return { country, city: null, district: null, postalCode: null };
    const candidates = [g.subregion, g.city, g.district].filter((v): v is string => !!v && fold(v) !== fold(city));
    let district: string | null = candidates[0] ?? null;
    if (isIzmir(city)) {
      const hit = candidates.map((c) => findDistrict(districts, c)).find(Boolean);
      district = hit ? hit.name : null;
    }
    const outCity = isIzmir(city) ? IZMIR_NAME : city;
    return { country, city: outCity, district, postalCode: consistentPostal(country, outCity, g.postalCode) };
  }
  const city = (g.city ?? g.subregion ?? g.region ?? '').trim() || null;
  const district = g.district && city && fold(g.district) !== fold(city) ? g.district : null;
  return { country, city, district, postalCode: consistentPostal(country, city, g.postalCode) };
}
