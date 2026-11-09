// eatkcal v2 (G18-S3 md.6) — "Siparişin alındı" kararları (SAF; birim testli).
//
// Kutlama (cam kase + nokta yağmuru, 900 ms) YALNIZ doğrulanmış siparişte oynar.
// Doğrulama kuralı EkPaymentScreen'in ödeme sonucu yoklamasıyla AYNI:
// `status === 'confirmed' || payment_status === 'paid'` (EkPaymentScreen.tsx).
// Tahmini süre yalnız gerçek veri varsa: randevulu siparişte seçilen gün + dilim,
// hemen teslimde adresin bölge tahmini (Ana sayfa çipiyle aynı kaynak); Gel-Al ya
// da veri yoksa satır gösterilmez (uydurma süre yok).

export interface SuccessOrderRow {
  status?: string | null;
  payment_status?: string | null;
  delivery_method?: string | null;
  delivery_time_type?: string | null;
  delivery_type?: string | null;
  scheduled_date?: string | null;
  scheduled_slot?: string | null;
  scheduled_time?: string | null;
}

export function isVerifiedOrder(row: SuccessOrderRow | null | undefined): boolean {
  if (!row) return false;
  return row.status === 'confirmed' || row.payment_status === 'paid';
}

/** "2026-11-10" → "10 Kas" / "10 Nov" (yerel ay kısaltması dışarıdan). */
function shortDate(iso: string, months: readonly string[]): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const mi = Number(m[2]) - 1;
  if (mi < 0 || mi > 11) return null;
  return `${Number(m[3])} ${months[mi]}`;
}

export function successEta(
  row: SuccessOrderRow | null | undefined,
  zoneEstimate: string | null,
  months: readonly string[],
): string | null {
  if (!row) return null;
  if (row.delivery_method === 'pickup') return null;
  const scheduled = row.delivery_time_type === 'scheduled' || row.delivery_type === 'scheduled';
  if (scheduled) {
    const day = row.scheduled_date ? shortDate(row.scheduled_date, months) : null;
    const slot = (row.scheduled_slot || (row.scheduled_time ? String(row.scheduled_time).slice(0, 5) : '') || '').trim();
    if (!day && !slot) return null;
    return [day, slot].filter(Boolean).join(', ');
  }
  return zoneEstimate && zoneEstimate.trim() ? zoneEstimate.trim() : null;
}

/** Kısa ay adları (yerel tarih biçimi verisi). */
export const MONTHS_SHORT = {
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
} as const;

/** Nokta yağmuru (Final FinEkOrderSuccess .rain): x, y, çap, düşüş — 393 genişliğe göre. */
export const RAIN_DOTS: readonly { x: number; y: number; d: number; fall: number }[] = [
  { x: 24, y: -10, d: 8, fall: 420 },
  { x: 58, y: 40, d: 6, fall: 360 },
  { x: 92, y: -24, d: 10, fall: 480 },
  { x: 128, y: 20, d: 7, fall: 300 },
  { x: 160, y: -30, d: 9, fall: 440 },
  { x: 196, y: 10, d: 6, fall: 500 },
  { x: 228, y: -16, d: 11, fall: 380 },
  { x: 262, y: 34, d: 7, fall: 460 },
  { x: 296, y: -8, d: 9, fall: 320 },
  { x: 330, y: 24, d: 6, fall: 420 },
  { x: 360, y: -20, d: 10, fall: 480 },
  { x: 76, y: 70, d: 6, fall: 260 },
  { x: 244, y: 80, d: 8, fall: 280 },
  { x: 344, y: 90, d: 7, fall: 240 },
];
