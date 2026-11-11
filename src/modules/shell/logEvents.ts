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
  /**
   * G29-S1 md.1: görsel bir ÇIKARTMA (şeffaf zemin, nesneye kırpılmış) — uçuşta kırpma /
   * köşe yuvarlama yok, oran korunur (contain). Yoksa normal fotoğraf (yuvarlatılmış, cover).
   */
  cutout?: boolean;
  /**
   * G30-S1 md.1: kaynak görsel uçuş kutusundan BÜYÜK çiziliyorsa (ör. tam ekran fotoğrafın
   * tabak bölgesi) görselin tamamının ekran kutusu. Uçan kopya bu kutudaki pikselleri
   * kendi kutusuna kırparak başlar → ilk karede alttaki görselle birebir (sıçrama yok).
   */
  imageRect?: { x: number; y: number; w: number; h: number } | null;
  /** G30-S1 md.1: uçuş başlangıç köşe yarıçapı (kaynakla aynı; varsayılan 16). */
  radius?: number;
  /**
   * G30-S1 md.1: uçan kopya ekranda GÖRÜNDÜĞÜNDE (görsel yüklendi, ilk kare çizildi) kabuk
   * çağırır; uçuş yoksa (azaltılmış hareket / konum yok) hemen. Kaynak ekran ancak bundan
   * sonra kapanır → görsel bir an kaybolup yeniden belirmez.
   */
  onStart?: (() => void) | null;
  /** Rozet/toast metni için öğün etiketi, ör. "Öğle". */
  mealLabel?: string | null;
  /** Kaynak: 'kesfet' | 'scan' | 'eatkcal' — vurgu etiketi için. */
  source?: string | null;
  /** Öğün adı (koleksiyon kartı için). */
  name?: string | null;
  /** Kalori (koleksiyon/vurgu için). */
  kcal?: number | null;
  /**
   * G20-S1 md.4: kaynak ekran kendi toast'ını gösteriyorsa (Keşfet: "<Öğün>'ye
   * loglandı · Geri al · Gör") kabuk yalnız uçuş + rozet çizer, İKİNCİ toast YOK.
   */
  ownToast?: boolean;
  /**
   * G20-S1 md.4: kaydı GERÇEKTEN silen geri alma. Kabuk toast'ı "Geri al"ı yalnız
   * bu verilirse gösterir (önceden yalnız rozeti azaltıyor, kaydı silmiyordu).
   * Süreç içi olay (DeviceEventEmitter) → fonksiyon referansı taşınabilir.
   */
  undo?: (() => void | Promise<void>) | null;
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
