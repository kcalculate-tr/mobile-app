// G19-S3 — meal_consumptions.source → log_* olaylarındaki `source` değeri (saf).
export type LogSource = 'scan' | 'manual' | 'order' | 'pantry' | 'post' | 'quick';

export function logSourceOf(raw: string | null | undefined): LogSource {
  switch (raw) {
    case 'ai_scan':
    case 'scan':
      return 'scan';
    case 'pantry':
      return 'pantry';
    case 'order':
      return 'order';
    case 'post':
    case 'kesfet':
      return 'post';
    case 'quick':
    case 'quick_add':
      return 'quick';
    default:
      return 'manual';
  }
}
