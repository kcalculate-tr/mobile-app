/**
 * G12-S4 — Çevrimdışı bekleyen fotoğraf kuyruğu (FinScanOffline).
 *
 * En fazla TEK bekleyen fotoğraf tutulur (spec: "%{count} fotoğraf" hep 1).
 * Dedup kuralı: bağlantı dönüşü OTOMATİK analiz ile elle giriş birbirini
 * DIŞLAR — hangisi önce olursa kuyruk hemen temizlenir, diğeri tekrar
 * işlem yapmaz (bkz. `pending_single_note`: "Tek kayıt: bağlantı gelince
 * fotoğraf ayrıca eklenmez.").
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@kcal_ai_scan_pending_photo';

export interface PendingScanPhoto {
  /** Rezervasyon/idempotency anahtarı — reserveScan ile aynı. */
  id: string;
  imageUri: string;
  mealType: string;
  queuedAt: string; // ISO
}

export async function getPendingScanPhoto(): Promise<PendingScanPhoto | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingScanPhoto) : null;
  } catch {
    return null;
  }
}

export async function setPendingScanPhoto(entry: PendingScanPhoto): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
}

/** Elle giriş yapıldığında VEYA bağlantı dönüşünde analiz başladığında çağrılır. */
export async function clearPendingScanPhoto(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
