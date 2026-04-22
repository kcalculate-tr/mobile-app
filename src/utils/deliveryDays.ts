export const DAY_NAMES_TR: Record<number, string> = {
  0: 'Pazar', 1: 'Pazartesi', 2: 'Salı', 3: 'Çarşamba',
  4: 'Perşembe', 5: 'Cuma', 6: 'Cumartesi',
};

export const DAY_NAMES_SHORT: Record<number, string> = {
  0: 'Paz', 1: 'Pzt', 2: 'Sal', 3: 'Çar', 4: 'Per', 5: 'Cum', 6: 'Cmt',
};

export function formatDeliveryDays(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return 'Belirtilmemiş';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Her gün';
  if (JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])) return 'Hafta içi';
  if (JSON.stringify(sorted) === JSON.stringify([0, 6])) return 'Hafta sonu';
  return sorted.map((d) => DAY_NAMES_SHORT[d]).join(', ');
}

export function isDeliveryDay(date: Date, deliveryDays: number[] | null | undefined): boolean {
  if (!deliveryDays || deliveryDays.length === 0) return true;
  return deliveryDays.includes(date.getDay());
}
