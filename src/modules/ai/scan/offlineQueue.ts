/**
 * G12-S4 / G16-S1 — Çevrimdışı bekleyen fotoğraf kuyruğu (FinScanOffline).
 *
 * G16-S1: tek fotoğraf yerine SIRALI kuyruk — en fazla 10 fotoğraf, 24 saatten
 * eski girdiler okunurken/yazılırken silinir. Dolu kuyrukta yeni fotoğraf
 * eklenirse EN ESKİSİ düşer. Bağlantı gelince `processPendingQueue`
 * (pendingProcessor.ts) sırayla gönderir; girdi yalnız işlenince/iptalde çıkar.
 *
 * Dedup: bağlantı dönüşü OTOMATİK analiz ile elle giriş birbirini DIŞLAR —
 * elle girişte `clearPendingScanPhoto` tüm kuyruğu boşaltır.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@kcal_ai_scan_pending_queue';
/** G12-S4'ün tek girdili anahtarı — okunurken kuyruğa taşınır. */
const LEGACY_KEY = '@kcal_ai_scan_pending_photo';

export const PENDING_QUEUE_MAX = 10;
export const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingScanPhoto {
  /** Rezervasyon/idempotency anahtarı — reserveScan ile aynı. */
  id: string;
  imageUri: string;
  mealType: string;
  /** G18-S4 md.5: çekimdeki isteğe bağlı not — bağlantı gelince analize `hint` olarak gider. */
  hint?: string;
  queuedAt: string; // ISO
}

function isFresh(e: PendingScanPhoto, now: number): boolean {
  const t = Date.parse(e.queuedAt);
  return Number.isFinite(t) && now - t <= PENDING_MAX_AGE_MS;
}

async function readRaw(): Promise<PendingScanPhoto[]> {
  const out: PendingScanPhoto[] = [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...(parsed as PendingScanPhoto[]));
    }
  } catch {
    /* bozuk kayıt: boş say */
  }
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const e = JSON.parse(legacy) as PendingScanPhoto;
      if (e && !out.some((x) => x.id === e.id)) out.push(e);
      await AsyncStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* yok say */
  }
  return out;
}

async function write(list: PendingScanPhoto[]): Promise<void> {
  if (list.length === 0) await AsyncStorage.removeItem(STORAGE_KEY);
  else await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** Eskimeyen girdiler, en eskiden yeniye. 24 saati aşanlar kalıcı olarak silinir. */
export async function getPendingScanQueue(now: number = Date.now()): Promise<PendingScanPhoto[]> {
  const all = await readRaw();
  const fresh = all.filter((e) => isFresh(e, now)).slice(-PENDING_QUEUE_MAX);
  if (fresh.length !== all.length) await write(fresh);
  return fresh;
}

export async function getPendingScanCount(now: number = Date.now()): Promise<number> {
  return (await getPendingScanQueue(now)).length;
}

/** Geriye uyumlu: kuyruğun en eski girdisi. */
export async function getPendingScanPhoto(now: number = Date.now()): Promise<PendingScanPhoto | null> {
  const q = await getPendingScanQueue(now);
  return q[0] ?? null;
}

/** Kuyruğun sonuna ekler (aynı id varsa yerini günceller); 10'u aşarsa en eskiyi düşürür. */
export async function setPendingScanPhoto(entry: PendingScanPhoto, now: number = Date.now()): Promise<void> {
  const q = (await getPendingScanQueue(now)).filter((e) => e.id !== entry.id);
  q.push(entry);
  await write(q.slice(-PENDING_QUEUE_MAX));
}

/** Tek girdiyi çıkarır (işlendi / iptal). */
export async function removePendingScanPhoto(id: string): Promise<void> {
  const q = (await readRaw()).filter((e) => e.id !== id);
  await write(q);
}

/** Elle giriş yapıldığında tüm kuyruğu boşaltır. */
export async function clearPendingScanPhoto(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(LEGACY_KEY);
}
