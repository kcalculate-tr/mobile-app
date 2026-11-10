// G22-S1 md.1 — expo-speech-recognition sarmalayıcısı (telefonun konuşma tanıması).
//
// Native modül (ExpoSpeechRecognition) YOKSA (eski derleme / OTA) null döner → Ses modu
// mod çubuğunda gizlenir; çökme yok. Tanıma mümkünse CİHAZDA yapılır
// (requiresOnDeviceRecognition, cihaz destekliyorsa); desteklemiyorsa işletim sisteminin
// konuşma hizmeti (Apple/Google) kullanılır — her iki durumda da ses BİZİM sunucumuza gitmez.
import { requireOptionalNativeModule } from 'expo';

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
    S.start({
      lang,
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: onDevice,
      addsPunctuation: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      // Ses kaydı saklanmaz (recordingOptions verilmez).
    });
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
