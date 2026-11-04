/**
 * G12-S4 — "Logla uçuşu" olayı.
 *
 * Tara (ve Keşfet/eatkcal) bir öğün logladığında kaynağın ekran konumundan
 * tab bar'daki "+" rozetine doğru küçük bir uçuş animasyonu tetiklenir. Olayı
 * yayan taraf biziz; dinleyen taraf yeni kabuğun tab bar'ı (G12-S1). Bayrak
 * kapalıyken yeni tab bar yok, olay dinlenmez — zararsızdır.
 *
 * Sözleşme (G12-CONTRACT "Bağlar"): `kcal:logFlight` → {x,y,w,h,imageUri,mealLabel}
 * Geri al: `kcal:logUndo` → {id}
 */
import { DeviceEventEmitter } from 'react-native';

export const LOG_FLIGHT_EVENT = 'kcal:logFlight';
export const LOG_UNDO_EVENT = 'kcal:logUndo';

export interface LogFlightPayload {
  x: number;
  y: number;
  w: number;
  h: number;
  imageUri?: string | null;
  mealLabel?: string | null;
}

export function emitLogFlight(payload: LogFlightPayload): void {
  DeviceEventEmitter.emit(LOG_FLIGHT_EVENT, payload);
}

export function emitLogUndo(id: string): void {
  DeviceEventEmitter.emit(LOG_UNDO_EVENT, { id });
}
