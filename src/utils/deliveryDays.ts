export const DAY_NAMES_FULL = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi',
] as const;

export const DAY_NAMES_SHORT = [
  'Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt',
] as const;

// Legacy alias — kept so older imports keep compiling until all call sites migrate.
export const DAY_NAMES_TR: Record<number, string> = {
  0: DAY_NAMES_FULL[0], 1: DAY_NAMES_FULL[1], 2: DAY_NAMES_FULL[2],
  3: DAY_NAMES_FULL[3], 4: DAY_NAMES_FULL[4], 5: DAY_NAMES_FULL[5],
  6: DAY_NAMES_FULL[6],
};

// Day numbering convention: 0=Pazar (Sunday) … 6=Cumartesi (Saturday), matching
// JavaScript's Date.prototype.getDay(). Weekdays are [1,2,3,4,5] (Pzt–Cum).
function formatWithNames(
  days: number[] | null | undefined,
  names: readonly string[],
): string {
  if (!days || days.length === 0) return 'Belirtilmemiş';
  const unique = Array.from(new Set(days.map((v) => Number(v))))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);
  if (unique.length === 0) return 'Belirtilmemiş';

  // Shortcut cascade — first match wins.
  if (unique.length === 7) return 'Her gün';
  if (unique.length === 2 && unique[0] === 0 && unique[1] === 6) return 'Hafta sonu';

  const weekdays = [1, 2, 3, 4, 5];
  const hasAllWeekdays = weekdays.every((d) => unique.includes(d));
  if (hasAllWeekdays) {
    if (unique.length === 5) return 'Hafta içi her gün';
    if (unique.length === 6) {
      if (unique.includes(6)) return 'Hafta içi her gün ve Cumartesi';
      if (unique.includes(0)) return 'Hafta içi her gün ve Pazar';
    }
  }

  return unique.map((d) => names[d]).join(', ');
}

export function formatDeliveryDaysFull(days: number[] | null | undefined): string {
  return formatWithNames(days, DAY_NAMES_FULL);
}

export function formatDeliveryDaysShort(days: number[] | null | undefined): string {
  return formatWithNames(days, DAY_NAMES_SHORT);
}

// Legacy alias — defaults to short form; use the explicit Full/Short variants for new code.
export const formatDeliveryDays = formatDeliveryDaysShort;

export function isDeliveryDay(
  date: Date,
  deliveryDays: number[] | null | undefined,
): boolean {
  if (!deliveryDays || deliveryDays.length === 0) return true;
  return deliveryDays.includes(date.getDay());
}
