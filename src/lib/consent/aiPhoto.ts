// G20-S3 md.2 — Yapay zekâ fotoğraf analizi izni (cihaz + user_consents).
// Karar mantığı saf: policy.ts `aiPhotoDecision`.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AI_PHOTO_KEY, aiPhotoDecision, parseAiPhoto, toggleRow, type AiPhotoRecord } from './policy';
import {
  consentAppVersion,
  consentPlatform,
  emitConsentChange,
  fetchServerStatus,
  recordConsentRows,
} from './store';

export async function readAiPhotoLocal(): Promise<AiPhotoRecord | null> {
  try {
    return parseAiPhoto(await AsyncStorage.getItem(AI_PHOTO_KEY));
  } catch {
    return null;
  }
}

/** Yalnız cihaz kaydına bakar (ağ yok) — çevrimdışı kuyruk boşaltma bekçisi. */
export async function hasLocalAiPhotoConsent(): Promise<boolean> {
  return (await readAiPhotoLocal())?.granted === true;
}

async function writeLocal(granted: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AI_PHOTO_KEY, JSON.stringify({ granted, at: new Date().toISOString() }));
  } catch {
    /* cihaz kaydı yazılamadı: bir sonraki taramada yeniden sorulur */
  }
}

/** Tara açılışı: izin var mı? Cihazda yoksa sunucuya (başka cihaz) bakar. */
export async function resolveAiPhotoConsent(): Promise<'ok' | 'ask'> {
  const local = await readAiPhotoLocal();
  if (local) return aiPhotoDecision(local, null);
  const server = await fetchServerStatus();
  const d = aiPhotoDecision(null, server?.ai_photo ?? null);
  if (d === 'ok') await writeLocal(true); // başka cihazda verilmiş → bir daha sorulmaz
  return d;
}

/**
 * İzin ver / reddet / geri al. `scan`: ilk tarama sheet'i (Kabul / Vazgeç) ·
 * `settings`: Profil › Gizlilik › Veri ve reklam izinleri.
 */
export async function setAiPhotoConsent(granted: boolean, source: 'scan' | 'settings'): Promise<void> {
  // Tara'da "Vazgeç" cihaz kaydı YAZMAZ (bir sonraki taramada yeniden sorulur);
  // ayardan kapatma ise kalıcıdır (yine sorulmadan gönderilmez — karar 'ask').
  if (granted || source === 'settings') await writeLocal(granted);
  emitConsentChange();
  await recordConsentRows([
    toggleRow({
      kind: 'ai_photo',
      granted,
      source,
      platform: consentPlatform(),
      appVersion: consentAppVersion(),
      at: new Date().toISOString(),
    }),
  ]);
}
