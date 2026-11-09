// G19-S2 md.7 — Günlük takip ölçüm olayları. Tek yerden, tipli, KİŞİSEL VERİ YOK
// (öğün adı / not / kullanıcı adı gönderilmez; yalnız kaynak, yuva, sayılar).
//
// Gönderim: `src/lib/analytics.ts` › `track()` (analytics_events, kuyruklu).
// G19-S3 (`night19/metrics`) tek `track()` API'sini kurduğunda yalnız `sink`
// değişir; ad/özellik sözleşmesi burada.
// D-S1 sözlüğü (analytics_event_names) eşlemesi: log_add → alias log_meal,
// water_add → alias log_water, activity_add → alias log_activity
// (supabase/migrations/20261109200200_g19_s2_track_events.sql, UYGULANMADI).

export type LogSource = 'scan' | 'manual' | 'kesfet' | 'order' | 'day_card';
export type SlotName = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type TrackEvent =
  | { name: 'log_add'; props: { source: LogSource; slot: SlotName; kcal: number; offline: boolean } }
  | { name: 'log_edit'; props: { field: 'portion' | 'meal'; slot: SlotName; factor?: number } }
  | { name: 'log_delete'; props: { source: LogSource; slot: SlotName; undone: boolean } }
  | { name: 'water_add'; props: { ml: number; total_ml: number; undo: boolean } }
  | { name: 'activity_add'; props: { type: string; minutes: number; undo: boolean } }
  | { name: 'streak_day'; props: { streak: number } }
  | { name: 'ring_complete'; props: { kcal: number; target: number } };

export const TRACK_EVENT_NAMES = [
  'log_add',
  'log_edit',
  'log_delete',
  'water_add',
  'activity_add',
  'streak_day',
  'ring_complete',
] as const;

/** İzinli özellik anahtarları (PII beyaz listesi — testli). */
export const TRACK_PROP_WHITELIST: Record<(typeof TRACK_EVENT_NAMES)[number], readonly string[]> = {
  log_add: ['source', 'slot', 'kcal', 'offline'],
  log_edit: ['field', 'slot', 'factor'],
  log_delete: ['source', 'slot', 'undone'],
  water_add: ['ml', 'total_ml', 'undo'],
  activity_add: ['type', 'minutes', 'undo'],
  streak_day: ['streak'],
  ring_complete: ['kcal', 'target'],
};

/** Ham `meal_consumptions.source` → olay kaynağı. */
export function logSourceOf(raw: string | null | undefined): LogSource {
  switch (raw) {
    case 'ai_scan':
    case 'scan':
      return 'scan';
    case 'post':
    case 'kesfet':
    case 'feed':
      return 'kesfet';
    case 'pantry':
    case 'order':
    case 'eatkcal':
      return 'order';
    case 'day_card':
      return 'day_card';
    default:
      return 'manual';
  }
}

type Sink = (name: string, props: Record<string, unknown>) => void;
let sink: Sink | null = null;

/** Testler / G19-S3 için gönderim noktası. */
export function setTrackSink(s: Sink | null): void {
  sink = s;
}

function defaultSink(): Sink {
  // Tembel require: Node testlerinde Supabase/AsyncStorage yüklenmesin.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../../lib/analytics') as typeof import('../../../lib/analytics')).track;
}

/** Beyaz liste dışı anahtarlar atılır; sayılar yuvarlanır. */
export function sanitize(ev: TrackEvent): Record<string, unknown> {
  const allow = TRACK_PROP_WHITELIST[ev.name];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ev.props)) {
    if (!allow.includes(k) || v === undefined) continue;
    out[k] = typeof v === 'number' ? Math.round(v * 100) / 100 : v;
  }
  return out;
}

export function trackEvent(ev: TrackEvent): void {
  try {
    (sink ?? defaultSink())(ev.name, sanitize(ev));
  } catch {
    /* ölçüm uygulamayı asla bozmaz */
  }
}
