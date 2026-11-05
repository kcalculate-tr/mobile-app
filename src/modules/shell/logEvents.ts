// "Logla izi" olay sözleşmesi — TEK KAYNAK (G12-CONTRACT "Bağlar", G13-S1 m.4).
//
// Keşfet / Tara / eatkcal bir öğün loglayınca `kcal:logFlight` yayınlar; kabuk
// (TabBarR3) uçuş + "+N" rozeti + toast çizer, Ana sayfa (TrackerScreen yeni
// kabuk) yeni kaydı bir kez vurgular. "Geri al" `kcal:logUndo` yayınlar; rozet
// azalır, Ana sayfa vurguyu geri alır.
//
// Olay adları, yük tipleri ve yayın/dinleme yardımcıları YALNIZ burada.
// `gun/logFlight.ts`, `kesfet/events.ts`, `ai/scan/logFlight.ts` bu dosyayı
// yeniden dışa verir (string/tip tekrarı yok). Yeni sorgu/mantık YOK — yalnız
// cihaz içi olay köprüsü (DeviceEventEmitter: süreç içi, köprüsüz, senkron).

import { DeviceEventEmitter, type EmitterSubscription } from 'react-native';

export const LOG_FLIGHT_EVENT = 'kcal:logFlight';
export const LOG_UNDO_EVENT = 'kcal:logUndo';

/**
 * Loglanan öğenin ekrandaki kaynak konumu (uçuşun başladığı yer) + kimlik ve
 * etiket. `x/y` sayfa (ekran) koordinatıdır (`measureInWindow`); `w/h` öğenin
 * boyutu (bilinmiyorsa 0 — kabuk uçuşsuz rozet + toast gösterir). `id`
 * (consumption id) verilirse Ana sayfa vurguyu tam o kayda, Geri al'ı tam o
 * kayda eşler; verilmezse kabuk bir tane üretir, Ana sayfa en yeni kaydı seçer.
 */
export interface LogFlightPayload {
  /** İlişkili consumption id (Geri al + vurgu eşleşmesi için). */
  id?: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Uçan küçük görsel (varsa); yoksa lime nokta uçar. */
  imageUri?: string | null;
  /** Rozet/toast metni için öğün etiketi, ör. "Öğle". */
  mealLabel?: string | null;
  /** Kaynak: 'kesfet' | 'scan' | 'eatkcal' — vurgu etiketi için. */
  source?: string | null;
  /** Öğün adı (koleksiyon kartı için). */
  name?: string | null;
  /** Kalori (koleksiyon/vurgu için). */
  kcal?: number | null;
}

export interface LogUndoPayload {
  id: string;
}

export function emitLogFlight(payload: LogFlightPayload): void {
  DeviceEventEmitter.emit(LOG_FLIGHT_EVENT, payload);
}

export function emitLogUndo(payload: LogUndoPayload): void {
  DeviceEventEmitter.emit(LOG_UNDO_EVENT, payload);
}

export function onLogFlight(handler: (p: LogFlightPayload) => void): EmitterSubscription {
  return DeviceEventEmitter.addListener(LOG_FLIGHT_EVENT, handler);
}

export function onLogUndo(handler: (p: LogUndoPayload) => void): EmitterSubscription {
  return DeviceEventEmitter.addListener(LOG_UNDO_EVENT, handler);
}
