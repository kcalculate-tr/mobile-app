// eatkcal v2 (G15-S5 md.5) — sipariş değişiklik talebi KURALLARI (SAF; birim testli).
// src/screens/profile/OrderDetailScreen.tsx:144-163 (getHoursUntilDelivery) ve
// :311-331 (canCancel / canChangeDate / canChangeAddress / showSupportFallback)
// ile BİREBİR — o dosya bir ekran olduğu (1.0.7 BottomSheet'i içe aktarır) için
// v2 görünüme import edilmez, kurallar buraya taşındı (İLTER'E: tek kaynağa indirme).

export function hoursUntilDelivery(
  scheduledDate: string | null | undefined,
  scheduledTime: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!scheduledDate) return null;
  const time = (scheduledTime && scheduledTime.trim()) || '12:00';
  const timeParts = time.split(':');
  const hh = Number(timeParts[0] || 12);
  const mm = Number(timeParts[1] || 0);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const [y, m, d] = scheduledDate.split('-').map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const target = new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
  if (Number.isNaN(target.getTime())) return null;
  return (target.getTime() - now) / (1000 * 60 * 60);
}

export interface ChangeOptions {
  canCancel: boolean;
  canChangeDate: boolean;
  canChangeAddress: boolean;
  showSupportFallback: boolean;
}

export function changeOptions(
  order: { status: string; scheduled_date: string | null; scheduled_time: string | null; created_at: string },
  now: number = Date.now(),
): ChangeOptions {
  const isCancelled = order.status === 'cancelled' || order.status === 'payment_failed';
  const isTerminal = isCancelled || order.status === 'delivered' || order.status === 'refunded';
  const hasScheduled = !!order.scheduled_date;
  const hoursUntil = hoursUntilDelivery(order.scheduled_date, order.scheduled_time, now);
  const isImmediate = !hasScheduled;
  const minutesSinceOrder = order.created_at
    ? (now - new Date(order.created_at).getTime()) / 60000
    : Number.POSITIVE_INFINITY;
  return {
    canCancel: !isTerminal && hasScheduled && hoursUntil !== null && hoursUntil >= 48,
    canChangeDate: !isTerminal && hasScheduled && hoursUntil !== null && hoursUntil >= 48,
    canChangeAddress: !isTerminal && (hasScheduled || (isImmediate && minutesSinceOrder <= 30)),
    showSupportFallback: !isTerminal && isImmediate && minutesSinceOrder > 30,
  };
}

/** Teslimat günleri (delivery_zones.delivery_days_scheduled ?? delivery_days) → 0..6 listesi; boşsa null. */
export function parseDeliveryDays(raw: unknown): number[] | null {
  const parsed = Array.isArray(raw)
    ? (raw as unknown[]).map((v) => Number(v)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
    : [];
  return parsed.length > 0 ? parsed : null;
}

/** YYYY-MM-DD (yerel) — tarih değişikliği talebinin biçimi. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
