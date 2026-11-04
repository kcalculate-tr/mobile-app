// logFlight — sekmeler arası "uçuş" olayı (G12 sözleşmesi "Bağlar").
//
// Keşfet / Tara / eatkcal bir öğün loglayınca `kcal:logFlight` yayar
// ({x,y,w,h,imageUri,mealLabel}); tab bar (S1) uçan rozet + "+N", Ana sayfa
// (S3) o öğünü vurgular (hl) + zaman hapı. Geri al: `kcal:logUndo` ({id}).
//
// Bu dosya S3'e ait (gun modülü). YAYINLAYAN taraflar (Keşfet/Tara/eatkcal) ayrı
// oturumlar; S6 entegrasyonunda `emitLogFlight`'ı çağırırlar. S3 burada yalnız
// DİNLEME + yardımcıları sağlar. Native DeviceEventEmitter kullanır; testte
// olay yoksa abonelik sessizce no-op döner.
import { DeviceEventEmitter, type EmitterSubscription } from 'react-native';

export const LOG_FLIGHT_EVENT = 'kcal:logFlight';
export const LOG_UNDO_EVENT = 'kcal:logUndo';

/** Uçuş olayı yükü — loglanan öğünün ekran koordinatı + küçük önizleme. */
export interface LogFlightPayload {
  /** Kaynak öğenin ekran x/y/w/h'si (tab bar uçuşu için). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Loglanan öğünün fotoğrafı (varsa) — koleksiyon kartı + vurgu için. */
  imageUri?: string | null;
  /** Hedef öğün etiketi, ör. "Öğle". Zaman hapında gösterilir. */
  mealLabel?: string | null;
  /** İlişkili consumption id (geri al eşleşmesi için). */
  id?: string | null;
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
