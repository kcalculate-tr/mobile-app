// G22-S1 md.1 — expo-speech-recognition sarmalayıcısı (telefonun konuşma tanıması).
//
// Native modül (ExpoSpeechRecognition) YOKSA (eski derleme / OTA) null döner → Ses modu
// mod çubuğunda gizlenir; çökme yok. Tanıma mümkünse CİHAZDA yapılır
// (requiresOnDeviceRecognition, cihaz destekliyorsa); desteklemiyorsa işletim sisteminin
// konuşma hizmeti (Apple/Google) kullanılır — her iki durumda da ses BİZİM sunucumuza gitmez.
//
// G25-S1 md.11 (ses gizliliği) — kütüphane kaynağıyla doğrulandı (expo-speech-recognition):
//  • iOS: `requiresOnDeviceRecognition: true` HER ZAMAN verilir. Kütüphane bunu yalnız
//    `SFSpeechRecognizer.supportsOnDeviceRecognition` true ise isteğe uygular; cihaz/dil
//    desteklemiyorsa bayrak YOK SAYILIR ve tanıma Apple sunucusunda yapılır (hata yok).
//  • Android: `androidIntentOptions.EXTRA_PREFER_OFFLINE: true` HER ZAMAN (çevrimdışı motoru tercih
//    et; uygulamaya göre etkisiz olabilir). `requiresOnDeviceRecognition` yalnız cihazda tanıma
//    varsa (isOnDeviceRecognitionAvailable) true — Android 13+'ta bu, cihaz içi tanıyıcıyı ZORLAR
//    ve model yoksa başlatma hata verirdi; yoksa varsayılan tanıyıcı (Google) kullanılır ve ses
//    Google'ın konuşma hizmetine gidebilir.
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type SpeechModuleType = typeof import('expo-speech-recognition')['ExpoSpeechRecognitionModule'];

let cached: SpeechModuleType | null | undefined;

export function loadSpeech(): SpeechModuleType | null {
  if (cached !== undefined) return cached;
  try {
    if (!requireOptionalNativeModule('ExpoSpeechRecognition')) {
      cached = null;
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = (require('expo-speech-recognition') as typeof import('expo-speech-recognition')).ExpoSpeechRecognitionModule;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export interface SpeechHandlers {
  onResult: (transcript: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (code: string) => void;
  onVolume?: (value: number) => void;
}

/**
 * `start()` seçenekleri (SAF; test edilir). `onDevice` = cihaz cihaz-içi tanımayı destekliyor mu.
 * Ses kaydı saklanmaz (recordingOptions verilmez).
 */
export function speechStartOptions(os: string, lang: string, onDevice: boolean) {
  return {
    lang,
    interimResults: true,
    continuous: true,
    requiresOnDeviceRecognition: os === 'ios' ? true : onDevice,
    addsPunctuation: true,
    volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
    ...(os === 'android' ? { androidIntentOptions: { EXTRA_PREFER_OFFLINE: true } } : {}),
  };
}

/** Dinlemeyi başlatır; kaldırma fonksiyonu döner (dinleyiciler + abort). */
export function startListening(lang: string, h: SpeechHandlers): (() => void) | null {
  const S = loadSpeech();
  if (!S) return null;
  const subs = [
    S.addListener('result', (e) => h.onResult(e.results?.[0]?.transcript ?? '', !!e.isFinal)),
    S.addListener('end', () => h.onEnd()),
    S.addListener('error', (e) => h.onError(String(e.error ?? ''))),
    S.addListener('volumechange', (e) => h.onVolume?.(e.value)),
  ];
  let onDevice = false;
  try {
    onDevice = S.supportsOnDeviceRecognition();
  } catch {
    onDevice = false;
  }
  try {
    S.start(speechStartOptions(Platform.OS, lang, onDevice));
  } catch {
    subs.forEach((s) => s.remove());
    h.onError('service-not-allowed');
    return null;
  }
  return () => subs.forEach((s) => s.remove());
}

export function stopListening(): void {
  try {
    loadSpeech()?.stop();
  } catch {
    // yok say
  }
}

export function abortListening(): void {
  try {
    loadSpeech()?.abort();
  } catch {
    // yok say
  }
}

export async function speechPermission(): Promise<{ granted: boolean; canAskAgain: boolean } | null> {
  const S = loadSpeech();
  if (!S) return null;
  try {
    const r = await S.getPermissionsAsync();
    return { granted: !!r.granted, canAskAgain: r.canAskAgain !== false };
  } catch {
    return null;
  }
}

export async function requestSpeechPermission(): Promise<{ granted: boolean; canAskAgain: boolean } | null> {
  const S = loadSpeech();
  if (!S) return null;
  try {
    const r = await S.requestPermissionsAsync();
    return { granted: !!r.granted, canAskAgain: r.canAskAgain !== false };
  } catch {
    return null;
  }
}

export function speechAvailable(): boolean {
  const S = loadSpeech();
  if (!S) return false;
  try {
    return S.isRecognitionAvailable();
  } catch {
    return false;
  }
}
