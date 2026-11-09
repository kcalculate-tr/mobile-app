// G19-S2 md.7 — Günlük takip ölçüm olayları. Tek yerden, tipli, KİŞİSEL VERİ YOK
// (öğün adı / not / kullanıcı adı gönderilmez; yalnız kaynak, yuva, sayılar).
//
// Gönderim: G19-S4 birleştirmesinde App.tsx `setTrackSink(track)` ile G19-S3'ün tek
// `track()`'ine bağlandı (sözlük beyaz listesi ikinci kapı). Sink kurulmadan önce
// gelen olay da aynı `track()`'e tembel require ile gider (varsayılan).
// D-S1 sözlüğü (analytics_event_names) eşlemesi: log_add → alias log_meal,
// water_add → alias log_water, activity_add → alias log_activity
// (supabase/migrations/20261109200200_g19_s2_track_events.sql, UYGULANMADI).

// G19-S4: kaynak kümesi ve eşleme TEK yerde (lib/metrics/logSource — G19-S3 sözlüğüyle aynı).
import { logSourceOf, type LogSource } from '../../../lib/metrics/logSource';
export { logSourceOf, type LogSource };
export type SlotName = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type TrackEvent =
  | { name: 'log_add'; props: { source: LogSource; slot: SlotName; kcal: number; offline: boolean } }
  | { name: 'log_edit'; props: { field: 'portion' | 'meal'; slot: SlotName; factor?: number } }
  | { name: 'log_delete'; props: { source: LogSource; slot: SlotName; undone: boolean } }
  | { name: 'water_add'; props: { ml: number; total_ml: number; undo: boolean } }
  | { name: 'activity_add'; props: { type: string; minutes: number; undo: boolean } }
  | { name: 'streak_day'; props: { days: number } }
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
  streak_day: ['days'],
  ring_complete: ['kcal', 'target'],
};

type Sink = (name: string, props: Record<string, unknown>) => void;
let sink: Sink | null = null;

/** Testler / G19-S3 için gönderim noktası. */
export function setTrackSink(s: Sink | null): void {
  sink = s;
}

function defaultSink(): Sink {
  // Tembel require: Node testlerinde Supabase/AsyncStorage yüklenmesin.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { track } = require('../../../lib/analytics') as typeof import('../../../lib/analytics');
  return (name, props) => track(name as never, props as never);
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
