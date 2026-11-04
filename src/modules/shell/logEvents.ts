// "Logla izi" olay sözleşmesi (G12-S1 · G12-CONTRACT "Bağlar").
//
// Keşfet (S2) / Tara (S4) / eatkcal (S5) bir öğün loglayınca `kcal:logFlight`
// yayınlar; kabuk (TabBarR3) uçuş + "+N" rozeti + toast çizer, Ana sayfa (S3)
// vurgu yapar. "Geri al" ise `kcal:logUndo` yayınlar; rozet azalır.
//
// Yeni sorgu/mantık YOK — yalnız cihaz içi olay köprüsü. Emitter'lar bu
// dosyadan `emitLogFlight`/`emitLogUndo` import eder, string tekrarı olmaz.

import { DeviceEventEmitter } from 'react-native';

export const LOG_FLIGHT_EVENT = 'kcal:logFlight';
export const LOG_UNDO_EVENT = 'kcal:logUndo';

/**
 * Loglanan öğenin ekrandaki kaynak konumu (uçuşun başladığı yer) + kimlik ve
 * etiket. `x/y` sayfa (ekran) koordinatıdır (`measureInWindow`); `w/h` öğenin
 * boyutu. `id` verilmezse kabuk bir tane üretir ama Geri al'ın eşleşmesi için
 * emitter'ın SABİT bir id vermesi önerilir.
 */
export interface LogFlightPayload {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Uçan küçük görsel (varsa); yoksa lime nokta uçar. */
  imageUri?: string;
  /** Rozet/toast metni için öğün etiketi, ör. "Öğle'ye". */
  mealLabel?: string;
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
