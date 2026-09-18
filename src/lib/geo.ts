// FAZ L — checkout'ta cihaz konumu ile seçili adres arasındaki mesafeyi
// karşılaştırmak için. Repo'da hazır bir Haversine yoktu.

const EARTH_RADIUS_METERS = 6371000;

/**
 * Checkout'ta "Siparişi Ver" anında cihaz konumu ile seçili adres arasındaki
 * fark bu eşiği (metre) aşarsa tek seferlik bir teyit penceresi çıkar.
 * Kolayca değiştirilebilsin diye burada, tek yerde tutuluyor.
 */
export const ORDER_ADDRESS_DISTANCE_WARNING_METERS = 500;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** İki koordinat arasındaki mesafeyi metre cinsinden döner (Haversine formülü). */
export function distanceInMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Türkçe karakter/büyük-küçük harf/noktalama farklarını yutar — ters-geocode
 * (Apple/Google) sonucunu `delivery_zones`'daki resmi mahalle yazımıyla
 * (örn. "B.hayrettin Paşa") eşleştirmek için. `toLocaleLowerCase('tr')` İ→i,
 * I→ı dönüşümünü doğru yapar; "/İzmir" gibi il ekini, "Mahallesi"/"Mah."/
 * "İlçesi" gibi idari sonekleri ve noktalama/çoklu boşluğu atar.
 */
export function normalizeTurkishText(v: string | null | undefined): string {
  return (v || '')
    .split('/')[0] // "Balçova/İzmir" → "Balçova"
    .toLocaleLowerCase('tr')
    .replace(/[.'’]/g, '')
    .replace(/\bmahallesi\b/g, '')
    .replace(/\bmahalle\b/g, '')
    .replace(/\bmah\b/g, '')
    .replace(/\bilçesi\b/g, '')
    .replace(/\bilçe\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ters-geocode'dan gelen ham ilçe/mahalle adını `delivery_zones` listesiyle
 * eşleştirir. Önce tam eşleşme, olmazsa bir yöndeki "içeriyor" eşleşmesi
 * denenir (örn. Apple "Karşıyaka" derken liste "Karşıyaka Mahallesi" gibi
 * farklı bir sonek taşıyorsa). Eşleşme yoksa null — kullanıcı listeden
 * elle seçer, otomatik doldurma sadece bir öneridir.
 */
export function matchToOption(
  raw: string | null | undefined,
  options: { label: string; value: string }[],
): string | null {
  const target = normalizeTurkishText(raw);
  if (!target) return null;
  const exact = options.find((o) => normalizeTurkishText(o.value) === target);
  if (exact) return exact.value;
  const partial = options.find((o) => {
    const norm = normalizeTurkishText(o.value);
    return norm.includes(target) || target.includes(norm);
  });
  return partial ? partial.value : null;
}
