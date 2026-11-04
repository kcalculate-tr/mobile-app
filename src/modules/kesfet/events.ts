// Uygulama içi uçuş olayları (G12 sözleşmesi "Bağlar"). Keşfet/Tara/eatkcal bir
// öğünü loglayınca `kcal:logFlight` yayar; kabuğun tab barı (S1) yemeği yakalayıp
// "Ana sayfa"ya uçurur ve "+N" rozetini sıçratır. "Geri al" `kcal:logUndo` yayar;
// dinleyenler (tab bar sayacı, Ana sayfa vurgusu) tek kaydı geri alır.
//
// Olay ADLARI sözleşmede sabittir (`kcal:logFlight`, `kcal:logUndo`): Tara ve
// eatkcal da aynı adlarla yayar, kabuk tek yerden dinler. Burada yalnız tipli
// yardımcılar var; DeviceEventEmitter süreç içi, köprüsüz ve senkron çalışır.
import { DeviceEventEmitter } from 'react-native';

export const LOG_FLIGHT_EVENT = 'kcal:logFlight';
export const LOG_UNDO_EVENT = 'kcal:logUndo';

/** Uçuşun başlangıç karesi (loglanan görselin ekrandaki yeri) + öğün etiketi. */
export interface LogFlightPayload {
  x: number;
  y: number;
  w: number;
  h: number;
  imageUri: string | null;
  mealLabel: string;
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
