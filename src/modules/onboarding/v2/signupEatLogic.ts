// G15-S1 (Ek karar) — FinSignupEat v2 SAF mantık: adım makinesi, adres adımı
// kapısı (harita doğrulaması), telefon doğrulama/biçimleme. YENİ iş kuralı YOK:
// şehir kapısı useEatkcalRegistration'a, adres kuralları eatkcal/v2/model/
// addressModel'e (AddressesScreen kuralları) bırakılır; burada yalnız bu üç
// panelin sırası ve "devam edilebilir mi" soruları. Native import YOK → node:test.
import {
  zoneKey,
  type AddressFormV2,
  type ZoneIndex,
} from '../../eatkcal/v2/model/addressModel';

export type SignupEatStep = 'city' | 'address' | 'phone';

/** Şehir kapısı listesi (SignupEatScreen.CITIES ile aynı içerik). */
export const SIGNUP_EAT_CITIES: readonly { name: string; allowed: boolean }[] = [
  { name: 'İzmir', allowed: true },
  { name: 'İstanbul', allowed: false },
  { name: 'Ankara', allowed: false },
  { name: 'Antalya', allowed: false },
];

/** Şehir adımında "Devam" açık mı (SignupEatScreen: yalnız seçili + izinli şehir). */
export function canContinueCity(selected: string | null, checking: boolean): boolean {
  if (!selected || checking) return false;
  return SIGNUP_EAT_CITIES.some((c) => c.name === selected && c.allowed);
}

/**
 * Adım geçişi. Şehir onaylanınca kayıtlı/seçili adres VARSA adres+telefon
 * panelleri atlanır (EkCityGateScreen.onAllowed ile aynı: `hasAddress` → doğrudan
 * devam; yoksa önce adres).
 */
export function nextStep(step: SignupEatStep, hasAddress: boolean): SignupEatStep | 'done' {
  if (step === 'city') return hasAddress ? 'done' : 'address';
  if (step === 'address') return 'phone';
  return 'done';
}

/** Geri: telefon → adres → şehir → (akıştan çık = null). */
export function prevStep(step: SignupEatStep): SignupEatStep | null {
  if (step === 'phone') return 'address';
  if (step === 'address') return 'city';
  return null;
}

// ── Adres adımı kapısı ──────────────────────────────────────────────────────
export type AddressStepError =
  | 'needs_pin' // haritada konum doğrulanmadı
  | 'needs_zone' // ilçe/mahalle teslimat bölgeleriyle eşleşmedi
  | 'needs_street' // sokak / bina no eksik
  | null;

export interface AddressStepInput {
  form: Pick<AddressFormV2, 'district' | 'neighborhood' | 'street' | 'building_no'>;
  index: ZoneIndex;
  /** Harita pini (kullanıcı/otomatik ortalama sonrası) — yoksa null. */
  pinCoords: { latitude: number; longitude: number } | null;
  /** Harita yüklenemedi (FinEkAddressNoMap) → mevcut akıştaki gibi elle bölge seçimi. */
  mapFailed: boolean;
}

/**
 * Adres panelinde "Devam" kapısı. HARİTA DOĞRULAMASI ZORUNLU: pin yoksa
 * ilerlemez (mevcut akışta koordinat yalnız haritadan gelir → `verified_at`).
 * Tek istisna mevcut davranış: harita hiç açılamadıysa (mapFailed) pin aranmaz,
 * ilçe/mahalle elle seçilir (EkAddressAddScreen mapMode 'nomap').
 */
export function validateAddressStep(i: AddressStepInput): AddressStepError {
  if (!i.mapFailed && !i.pinCoords) return 'needs_pin';
  const d = i.form.district.trim();
  const n = i.form.neighborhood.trim();
  const opts = i.index.neighbourhoodsByDistrict[d] || [];
  if (
    !d ||
    !n ||
    !i.index.districtOptions.some((o) => o.value === d) ||
    !opts.some((o) => o.value === n)
  ) {
    return 'needs_zone';
  }
  if (!i.form.street.trim() || !i.form.building_no.trim()) return 'needs_street';
  return null;
}

/** Seçilen ilçe/mahalle aktif teslimat bölgesi dışında mı (kaydı ENGELLEMEZ, uyarı) — addressModel.isOutOfZone ile aynı anahtar. */
export function zoneIsActive(form: Pick<AddressFormV2, 'district' | 'neighborhood'>, index: ZoneIndex): boolean {
  return index.activeKeys.has(zoneKey(form.district.trim(), form.neighborhood.trim()));
}

// ── Telefon ─────────────────────────────────────────────────────────────────
/** Girdiden yalnız ulusal 10 hane (5XXXXXXXXX): +90 / 90 / 0 önekleri atılır, en çok 10 hane. */
export function phoneDigits(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
}

/** Geçerli TR cep: 10 hane, 5 ile başlar. */
export function isValidTrMobile(raw: string): boolean {
  const d = phoneDigits(raw);
  return d.length === 10 && d.startsWith('5');
}

/** Alan görünümü: "+90 5XX XXX XX XX" (yazıldıkça maske). */
export function formatPhoneMask(raw: string): string {
  const d = phoneDigits(raw);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return parts.length ? `+90 ${parts.join(' ')}` : '+90 ';
}

/**
 * `addresses.contact_phone` / profil telefonu için saklanan biçim: "05XXXXXXXXX"
 * (mevcut kayıtlar/testler yerel biçimle — örn. '05550000000'). Geçersizse boş.
 */
export function phoneForStorage(raw: string): string {
  return isValidTrMobile(raw) ? `0${phoneDigits(raw)}` : '';
}
