// eatkcal v2 (G32-S1 md.4) — Gel-Al şube kartı saf yardımcıları.
//
// branches tablosunda görsel / semt alanı YOK (canlı şema 9 Kas: id, name, address,
// slug, latitude, longitude …). Görsel: slug'a bağlı yerel cephe fotoğrafı
// (lib/branchBanner), yoksa cam kase yer tutucusu. Semt: adres metninden.

/** "Mansuroğlu Mah. 271. Sk. No:6A Bayraklı İzmir" → "Mansuroğlu, Bayraklı". */
export function branchSemt(address: string | null | undefined): string | null {
  const a = String(address ?? '').replace(/\s+/g, ' ').trim();
  if (!a) return null;
  const mah = a.match(/^(.+?)\s+Mah(?:\.|alles[iı])?(?=\s|$)/i)?.[1]?.trim() ?? null;
  const ilce = a.match(/(?:^|\s)([^\s/,]+)\s*[/,]?\s*(?:İzmir|Izmir)\s*$/i)?.[1]?.trim() ?? null;
  const parts = [mah, ilce].filter((x): x is string => !!x && !/^no:/i.test(x));
  return parts.length ? parts.join(', ') : null;
}

/** "2.4 km" (EN) / "2,4 km" (TR); 10 km ve üstü tam sayı. */
export function branchKm(km: number | null | undefined, lang: string): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  const s = km >= 10 ? String(Math.round(km)) : km.toFixed(1);
  return `${lang === 'en' ? s : s.replace('.', ',')} km`;
}

/** Gel-Al'da şube seçilmeden "Öde" pasif (taslak ödeme varsa seçim zaten yapılmıştır). */
export function needsBranchPick(p: { deliveryMethod: string; selectedBranchId: string | null; hasDraft: boolean }): boolean {
  return !p.hasDraft && p.deliveryMethod === 'pickup' && !p.selectedBranchId;
}
