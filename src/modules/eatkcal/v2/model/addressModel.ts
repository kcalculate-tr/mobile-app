// eatkcal v2 (G13-S2 md.5) — Adres ekle / Adreslerim SAF mantığı.
//
// YENİ MANTIK DEĞİL: bugünkü `src/screens/AddressesScreen.tsx` ve
// `src/components/checkout/AddressVerificationSheet.tsx` içinde INLINE duran
// kuralların BİREBİR saf kopyası (kaynak satırları her fonksiyonun üstünde).
// O iki dosya bu oturumun değil; tek kaynağa indirme "İLTER'E" notunda.
// Kullanılan mevcut yardımcılar: `matchToOption` / `normalizeTurkishText`
// (src/lib/geo.ts), `formatEstimatedDelivery` / `resolveShippingFee`
// (src/lib/deliveryRules.ts). Native import YOK → node:test ile test edilir.
import { matchToOption, normalizeTurkishText } from '../../../../lib/geo';
import {
  formatEstimatedDelivery,
  resolveShippingFee,
  type DeliveryGlobals,
  type DeliveryZoneRow,
} from '../../../../lib/deliveryRules';
import type { Address } from '../../../../types';

export type Option = { label: string; value: string };

// ── Ters geocode (AddressVerificationSheet.tsx:15-27, 46-68, 199-226) ──────
export type ReverseGeo = {
  district?: string;
  neighbourhood?: string;
  neighbourhoodAlt?: string;
  street?: string;
  streetNumber?: string;
  postalCode?: string;
};

type NativeGeo = {
  subregion?: string | null;
  district?: string | null;
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  postalCode?: string | null;
};

/** expo-location `reverseGeocodeAsync` ilk sonucu → ReverseGeo (AVS.tsx:206-214). */
export function fromNativeGeocode(geo: NativeGeo | null | undefined): ReverseGeo | null {
  if (!geo) return null;
  return {
    district: geo.subregion || geo.district || undefined,
    neighbourhood: geo.district || geo.name || undefined,
    street: geo.street || geo.name || undefined,
    streetNumber: geo.streetNumber || undefined,
    postalCode: geo.postalCode || undefined,
  };
}

type GoogleComponent = { long_name: string; types: string[] };

/** Google geocode `address_components` → ilçe/mahalle/sokak (AVS.tsx:57-64). */
export function parseGoogleComponents(components: GoogleComponent[] | null | undefined): ReverseGeo | null {
  if (!components) return null;
  const find = (type: string) => components.find((c) => c.types.includes(type))?.long_name;
  return {
    district: find('administrative_area_level_2'),
    neighbourhood: find('administrative_area_level_4') || find('neighborhood') || find('sublocality'),
    street: find('route'),
    streetNumber: find('street_number'),
    postalCode: find('postal_code'),
  };
}

/** Native + Google birleştirme — Google mahallesi `neighbourhoodAlt` olur (AVS.tsx:216-225). */
export function mergeReverseGeo(native: ReverseGeo | null, google: ReverseGeo | null): ReverseGeo | null {
  if (!google) return native;
  return {
    district: native?.district || google.district,
    neighbourhood: native?.neighbourhood,
    neighbourhoodAlt: google.neighbourhood,
    street: native?.street || google.street,
    streetNumber: native?.streetNumber || google.streetNumber,
    postalCode: native?.postalCode || google.postalCode,
  };
}

// ── Bölge dizini (AddressesScreen.tsx:84-88, 373-410) ───────────────────────
const readZoneDistrict = (row: Record<string, unknown>) => String(row.district ?? '').trim();
const readZoneNeighborhood = (row: Record<string, unknown>) =>
  String(row.neighborhood ?? row.neighbourhood ?? row.mahalle ?? '').trim();

export const zoneKey = (district: string, neighbourhood: string) =>
  `${normalizeTurkishText(district)}|${normalizeTurkishText(neighbourhood)}`;

export interface ZoneIndex {
  districtOptions: Option[];
  neighbourhoodsByDistrict: Record<string, Option[]>;
  /** is_active !== false olan ilçe|mahalle anahtarları (AddressesScreen:388-391). */
  activeKeys: Set<string>;
  /** İlçe|mahalle → ilk delivery_zones satırı (durum hapı için). */
  rowsByKey: Map<string, Record<string, unknown>>;
}

export function buildZoneIndex(rows: readonly Record<string, unknown>[]): ZoneIndex {
  const districtSet = new Set<string>();
  const neighborhoodMap = new Map<string, Set<string>>();
  const activeKeys = new Set<string>();
  const rowsByKey = new Map<string, Record<string, unknown>>();

  rows.forEach((zoneRow) => {
    const district = readZoneDistrict(zoneRow);
    if (!district) return;
    districtSet.add(district);
    const neighborhood = readZoneNeighborhood(zoneRow);
    if (!neighborhood) return;
    const existing = neighborhoodMap.get(district) || new Set<string>();
    existing.add(neighborhood);
    neighborhoodMap.set(district, existing);
    const key = zoneKey(district, neighborhood);
    if (zoneRow.is_active !== false) activeKeys.add(key);
    if (!rowsByKey.has(key)) rowsByKey.set(key, zoneRow);
  });

  const districtOptions = Array.from(districtSet)
    .sort((a, b) => a.localeCompare(b, 'tr'))
    .map((d) => ({ label: d, value: d }));
  const neighbourhoodsByDistrict: Record<string, Option[]> = {};
  Array.from(neighborhoodMap.entries()).forEach(([district, set]) => {
    neighbourhoodsByDistrict[district] = Array.from(set)
      .sort((a, b) => a.localeCompare(b, 'tr'))
      .map((n) => ({ label: n, value: n }));
  });
  return { districtOptions, neighbourhoodsByDistrict, activeKeys, rowsByKey };
}

export const EMPTY_ZONE_INDEX: ZoneIndex = {
  districtOptions: [],
  neighbourhoodsByDistrict: {},
  activeKeys: new Set(),
  rowsByKey: new Map(),
};

/**
 * Ters geocode → ilçe/mahalle eşleşmesi (AddressesScreen.tsx:518-530). Apple
 * mahallesi eşleşmezse Google adayı denenir. İlçe bulunup mahalle bulunamazsa
 * `needsNeighbourhood` (mevcut ipucu metni gösterilir).
 */
export function matchReverseGeo(
  geo: ReverseGeo | null | undefined,
  index: ZoneIndex,
): { district: string | null; neighbourhood: string | null; needsNeighbourhood: boolean } {
  const district = matchToOption(geo?.district, index.districtOptions);
  const options = district ? index.neighbourhoodsByDistrict[district] || [] : [];
  const neighbourhood = district
    ? matchToOption(geo?.neighbourhood, options) || matchToOption(geo?.neighbourhoodAlt, options)
    : null;
  return { district, neighbourhood, needsNeighbourhood: Boolean(district && !neighbourhood) };
}

// ── Bölge durumu hapı (FinEkAddress {{zText}}) ───────────────────────────────
export type ZoneStatusKind = 'now' | 'next_day' | 'none' | 'unknown';
export interface ZoneStatus {
  kind: ZoneStatusKind;
  /** formatEstimatedDelivery(row) — veri yoksa null (uydurma yok). */
  eta: string | null;
  /** Hemen teslimde 0 TL ücret (resolveShippingFee, ara toplam 0). */
  free: boolean;
}

/**
 * Seçili ilçe/mahallenin teslimat durumu. "Aktif" kuralı AddressesScreen ile
 * aynı (`is_active !== false`); hemen/planlı ayrımı CheckoutScreen'in bölge
 * kuralıyla aynı (`allow_immediate` / `allow_scheduled`; ikisi de tanımsızsa
 * ikisine de açık — CheckoutScreen.tsx:1294-1303).
 */
export function zoneStatusFor(
  index: ZoneIndex,
  district: string | null | undefined,
  neighbourhood: string | null | undefined,
  globals: DeliveryGlobals | null,
): ZoneStatus {
  if (!district || !neighbourhood) return { kind: 'unknown', eta: null, free: false };
  const key = zoneKey(district, neighbourhood);
  const row = index.rowsByKey.get(key);
  if (!row || !index.activeKeys.has(key)) return { kind: 'none', eta: null, free: false };
  const hasAllowRule = row.allow_immediate !== undefined || row.allow_scheduled !== undefined;
  const allowImmediate = hasAllowRule ? row.allow_immediate === true : true;
  const allowScheduled = hasAllowRule ? row.allow_scheduled === true : true;
  if (allowImmediate) {
    const zr = row as DeliveryZoneRow;
    return {
      kind: 'now',
      eta: formatEstimatedDelivery(zr),
      free: resolveShippingFee(zr, globals, 'immediate', 0) === 0,
    };
  }
  if (allowScheduled) return { kind: 'next_day', eta: null, free: false };
  return { kind: 'none', eta: null, free: false };
}

// ── Form ────────────────────────────────────────────────────────────────────
export type TitleChip = 'home' | 'work' | 'other';

export interface AddressFormV2 {
  titleChip: TitleChip;
  /** "Diğer" seçiliyken korunacak serbest başlık (düzenlenen adresten). */
  customTitle: string;
  first_name: string;
  last_name: string;
  contact_phone: string;
  contact_email: string;
  district: string;
  neighborhood: string;
  street: string;
  building_no: string;
  floor: string;
  apartment_no: string;
  /** Düzenlemede korunur; v2 formunda alanı yok (pano). */
  building_name: string;
  /** "Adres tarifi" — kuryeye ek tarif. */
  directions: string;
}

export const EMPTY_FORM: AddressFormV2 = {
  titleChip: 'home',
  customTitle: '',
  first_name: '',
  last_name: '',
  contact_phone: '',
  contact_email: '',
  district: '',
  neighborhood: '',
  street: '',
  building_no: '',
  floor: '',
  apartment_no: '',
  building_name: '',
  directions: '',
};

/** Ev / İş / Diğer → `addresses.title` (TR değer yazılır; mevcut kayıtlar TR). */
export const TITLE_VALUES: Record<Exclude<TitleChip, 'other'>, string> = { home: 'Ev', work: 'İş' };

export function titleFromForm(form: Pick<AddressFormV2, 'titleChip' | 'customTitle'>): string {
  if (form.titleChip === 'home') return TITLE_VALUES.home;
  if (form.titleChip === 'work') return TITLE_VALUES.work;
  return form.customTitle.trim() || 'Diğer';
}

export function chipFromTitle(title: string | null | undefined): { titleChip: TitleChip; customTitle: string } {
  const t = normalizeTurkishText(title);
  if (t === 'ev' || t === 'home') return { titleChip: 'home', customTitle: '' };
  if (t === 'iş' || t === 'is' || t === 'work') return { titleChip: 'work', customTitle: '' };
  return { titleChip: 'other', customTitle: String(title ?? '').trim() };
}

/** Ad soyad bölme (AddressesScreen.tsx:460-463). */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

/** Otomatik açık adres (AddressesScreen.tsx:656-662). */
export function buildFullAddressAuto(f: Pick<AddressFormV2, 'street' | 'building_no' | 'floor' | 'apartment_no' | 'building_name'>): string {
  return [
    f.street ? `${f.street}` : '',
    f.building_no ? `No:${f.building_no}` : '',
    f.floor ? `Kat:${f.floor}` : '',
    f.apartment_no ? `D:${f.apartment_no}` : '',
    f.building_name ? f.building_name : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export const DIRECTIONS_SEPARATOR = ' — ';

/**
 * `full_address` = otomatik adres (+ " — " + tarif). Eski ekranda "Açık Adres"
 * doluysa otomatik adresin YERİNE geçiyordu (AddressesScreen:681); v2'de alanın
 * etiketi "Adres tarifi" olduğu için tarif otomatik adresin SONUNA eklenir —
 * sipariş adres metni sokak/no bilgisini kaybetmez. (İLTER'E notu.)
 */
export function composeFullAddress(f: AddressFormV2): string {
  const auto = buildFullAddressAuto(f);
  const dir = f.directions.trim();
  if (!dir) return auto;
  return auto ? `${auto}${DIRECTIONS_SEPARATOR}${dir}` : dir;
}

/** Düzenlemede tarifi geri ayırır: otomatik kısımla eşleşiyorsa ''/kalan, değilse tamamı. */
export function directionsFromFullAddress(address: Address): string {
  const full = String(address.full_address ?? '').trim();
  const auto = buildFullAddressAuto({
    street: address.street || '',
    building_no: address.building_no || '',
    floor: address.floor || '',
    apartment_no: address.apartment_no || '',
    building_name: address.building_name || '',
  });
  if (!full || full === auto) return '';
  if (auto && full.startsWith(auto + DIRECTIONS_SEPARATOR)) return full.slice(auto.length + DIRECTIONS_SEPARATOR.length);
  return full;
}

/** Düzenleme formu (AddressesScreen.tsx:566-590 alan eşlemesi). */
export function formFromAddress(address: Address, userEmail: string | null | undefined): AddressFormV2 {
  return {
    ...chipFromTitle(address.title),
    first_name: address.first_name || '',
    last_name: address.last_name || '',
    contact_phone: address.contact_phone || '',
    contact_email: address.contact_email || userEmail || '',
    district: address.district || '',
    neighborhood: address.neighbourhood || '',
    street: address.street || '',
    building_no: address.building_no || '',
    floor: address.floor || '',
    apartment_no: address.apartment_no || '',
    building_name: address.building_name || '',
    directions: directionsFromFullAddress(address),
  };
}

export type AddressValidationError =
  | 'err_required'
  | 'err_district'
  | 'err_no_neighbourhoods'
  | 'err_neighbourhood';

/** Kayıt doğrulaması — sıra ve kurallar AddressesScreen.tsx:609-643 ile aynı. */
export function validateAddressForm(form: AddressFormV2, index: ZoneIndex): AddressValidationError | null {
  if (
    !form.first_name.trim() ||
    !form.last_name.trim() ||
    !form.contact_phone.trim() ||
    !form.contact_email.trim() ||
    !form.district.trim() ||
    !form.neighborhood.trim() ||
    !form.street.trim() ||
    !form.building_no.trim()
  ) {
    return 'err_required';
  }
  const d = form.district.trim();
  const n = form.neighborhood.trim();
  if (!index.districtOptions.some((o) => o.value === d)) return 'err_district';
  const opts = index.neighbourhoodsByDistrict[d] || [];
  if (opts.length === 0) return 'err_no_neighbourhoods';
  if (!opts.some((o) => o.value === n)) return 'err_neighbourhood';
  return null;
}

/** Kayıt öncesi bölge uyarısı gerekir mi (AddressesScreen.tsx:647-650; kaydı ENGELLEMEZ). */
export function isOutOfZone(form: AddressFormV2, index: ZoneIndex): boolean {
  return !index.activeKeys.has(zoneKey(form.district.trim(), form.neighborhood.trim()));
}

/** `addresses` satırı (AddressesScreen.tsx:664-689). */
export function buildAddressPayload(
  form: AddressFormV2,
  userId: string,
  pendingCoords: { latitude: number; longitude: number } | null,
  nowIso: string = new Date().toISOString(),
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    title: titleFromForm(form),
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    contact_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
    contact_phone: form.contact_phone.trim(),
    contact_email: form.contact_email.trim(),
    district: form.district.trim(),
    neighbourhood: form.neighborhood.trim(),
    street: form.street.trim(),
    building_no: form.building_no.trim(),
    floor: form.floor.trim(),
    apartment_no: form.apartment_no.trim(),
    building_name: form.building_name.trim() || null,
    full_address: composeFullAddress(form),
    city: 'İzmir',
  };
  if (pendingCoords) {
    payload.latitude = pendingCoords.latitude;
    payload.longitude = pendingCoords.longitude;
    payload.verified_at = nowIso;
  }
  return payload;
}

/** Kart satırı: "Kıbrıs Şehitleri Cd. 12, Alsancak, Konak" (FinEkAddresses). */
export function formatAddressLine(a: Pick<Address, 'street' | 'building_no' | 'neighbourhood' | 'district' | 'full_address'>): string {
  const head = [a.street, a.building_no].filter(Boolean).join(' ').trim();
  const parts = [head, a.neighbourhood || '', a.district || ''].map((p) => String(p).trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return String(a.full_address ?? '').trim();
}

/** Supabase "column X does not exist" → X (AddressesScreen.tsx:76-79). */
export function getMissingColumnName(errorText: string): string {
  const match = errorText.match(/column ["']?([a-zA-Z0-9_]+)["']?/i);
  return match?.[1] || '';
}
