// Tara ölçüm olayları — TEK modül (G19-S1 md.6 + G19-S3 sözlüğü, G19-S4 birleştirme).
//
// Adlar G19-S3 istemci sözlüğünün (src/lib/metrics/events.ts) KANONİK adlarıdır;
// D-S1'in eski adları (scan_start, scan_failed, log_meal) sözlükte `aliasOf` ile
// bağlı, istemci onları YAZMAZ.
//
//   olay           props                                         ne zaman
//   scan_open      { camera: live | fallback | legacy }          Tara ekranı açıldı (bir kez)
//   scan_capture   { via, has_hint, retry, offline }             foto çekildi/seçildi
//   scan_success   { n_items, kcal, via, cached }                analiz sonuç verdi
//   scan_fail      { code, stage, via }                          analiz/rezervasyon/yerel hata
//   scan_limit     { via }                                       günlük hak bitti
//   scan_offline   { pending }                                   çevrimdışı kuyruğa alındı
//   scan_log       { n_items, kcal, edited, meal_type }          sonuç güne kaydedildi
//
// `log_add{source:'scan'}` scan_log ile AYNI ANDA buradan (scanTrack.trackScanLog)
// gider; `kcal:logFlight` köprüsü (gun/track/logEventsBridge) source='scan' uçuşlarını
// SAYMAZ → her Tara kaydı tam 1 log_add.
//
// KİŞİSEL VERİ YOK: foto yolu, not metni, yemek adı, kullanıcı kimliği gönderilmez.
// Gönderim: `src/lib/analytics` › track() (tembel require — bu dosya native import
// yapmaz; Node testleri sink'i değiştirir). track() ayrıca sözlük beyaz listesini uygular.

export type ScanEventName =
  | 'scan_open'
  | 'scan_capture'
  | 'scan_success'
  | 'scan_fail'
  | 'scan_limit'
  | 'scan_offline'
  | 'scan_log';

export const SCAN_EVENT_NAMES: readonly ScanEventName[] = [
  'scan_open',
  'scan_capture',
  'scan_success',
  'scan_fail',
  'scan_limit',
  'scan_offline',
  'scan_log',
];

type Props = Record<string, string | number | boolean | null>;
type Sink = (name: ScanEventName, props: Props) => void;

const defaultSink: Sink = (name, props) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { track } = require('../../../lib/analytics') as typeof import('../../../lib/analytics');
    track(name, props as never);
  } catch {
    // ölçüm akışı asla bozmaz
  }
};

let sink: Sink = defaultSink;

/** Test/vitrin: olayları yakala. `null` → varsayılan (analytics_events). */
export function setScanEventSink(next: Sink | null): void {
  sink = next ?? defaultSink;
}

/** Yalnız bilinen, kişisel olmayan alanlar geçer (beyaz liste = sözlükle aynı). */
const ALLOWED: Record<ScanEventName, readonly string[]> = {
  scan_open: ['camera'],
  scan_capture: ['via', 'has_hint', 'retry', 'offline'],
  scan_success: ['n_items', 'kcal', 'via', 'cached'],
  scan_fail: ['code', 'stage', 'via'],
  scan_limit: ['via'],
  scan_offline: ['pending'],
  scan_log: ['n_items', 'kcal', 'edited', 'meal_type'],
};

export function scanEventProps(name: ScanEventName, props: Record<string, unknown>): Props {
  const out: Props = {};
  for (const key of ALLOWED[name]) {
    const v = props[key];
    if (typeof v === 'string') out[key] = v.slice(0, 40);
    else if (typeof v === 'number' && Number.isFinite(v)) out[key] = Math.round(v);
    else if (typeof v === 'boolean') out[key] = v;
  }
  return out;
}

export function trackScan(name: ScanEventName, props: Record<string, unknown> = {}): void {
  try {
    sink(name, scanEventProps(name, props));
  } catch {
    // ölçüm akışı asla bozmaz
  }
}
