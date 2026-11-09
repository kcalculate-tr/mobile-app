// G19-S3 + G19-S4 — meal_consumptions.source (ya da logFlight kaynağı) → log_* olaylarındaki
// `source` değeri (saf). TEK eşleme: G19-S2 takip olayları da bunu kullanır
// (gun/track/events.ts yeniden dışa verir). Küme sözlükteki LOG_SOURCES ile aynı.
export type LogSource = 'scan' | 'manual' | 'order' | 'pantry' | 'kesfet' | 'day_card' | 'quick';

export function logSourceOf(raw: string | null | undefined): LogSource {
  switch (raw) {
    case 'ai_scan':
    case 'scan':
      return 'scan';
    case 'pantry':
      return 'pantry';
    case 'order':
    case 'eatkcal':
      return 'order';
    case 'post':
    case 'kesfet':
    case 'feed':
      return 'kesfet';
    case 'day_card':
      return 'day_card';
    case 'quick':
    case 'quick_add':
      return 'quick';
    default:
      return 'manual';
  }
}
