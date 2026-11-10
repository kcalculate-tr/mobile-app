// G22-S1 md.1 — Sesle ekleme: SAF durum mantığı (native bağımlılık yok, Node testi).
//
// Hâller (FinScanVoice): idle · perm · listening · paused · processing · empty · denied ·
// offline · limit (+ failed: analiz hatası, unavailable: cihazda tanıma yok).
// Ses SUNUCUYA GİTMEZ: telefonun konuşma tanıması (expo-speech-recognition) metne çevirir,
// analize yalnız metin gider (analyze-ai-scan mode:'text').
export type VoicePhase =
  | 'idle'
  | 'perm'
  | 'listening'
  | 'paused'
  | 'processing'
  | 'empty'
  | 'denied'
  | 'offline'
  | 'limit'
  | 'failed'
  | 'unavailable';

/** Alt sheet ile gösterilen hâller (FinScanVoice sheet). */
export const SHEET_PHASES: readonly VoicePhase[] = ['perm', 'empty', 'denied', 'offline', 'limit', 'failed'];
export function isSheetPhase(p: VoicePhase): boolean {
  return SHEET_PHASES.includes(p);
}

/** Konuşma tanıma dili: cihaz dili TR → tr-TR, diğerleri en-US (uygulama TR/EN). */
export function speechLocale(deviceLang: string | null | undefined, appLang?: string | null): 'tr-TR' | 'en-US' {
  const d = (deviceLang ?? '').toLowerCase();
  if (d.startsWith('tr')) return 'tr-TR';
  if (d) return 'en-US';
  return (appLang ?? '').toLowerCase().startsWith('en') ? 'en-US' : 'tr-TR';
}

/** Kesinleşmiş metin + sürmekte olan (ara) sonuç. Boşluk sadeleşir. */
export function joinTranscript(committed: string, interim: string): string {
  return `${committed ?? ''} ${interim ?? ''}`.replace(/\s+/g, ' ').trim();
}

/** Ekranda: kesinleşmemiş SON kelime ikincil renkte (FinMoScanVoice "metin akışı"). */
export function splitTail(text: string, interimActive: boolean): { head: string; tail: string } {
  const t = text.trim();
  if (!interimActive || !t) return { head: t, tail: '' };
  const i = t.lastIndexOf(' ');
  return i < 0 ? { head: '', tail: t } : { head: t.slice(0, i + 1), tail: t.slice(i + 1) };
}

/** Tanıma hatası → hâl. Metin varsa duraklat (kaybetme); yoksa duyulmadı/izin/cihaz. */
export function phaseAfterError(code: string | null | undefined, hasTranscript: boolean): VoicePhase {
  switch (code) {
    case 'not-allowed':
      return 'denied';
    case 'service-not-allowed':
    case 'language-not-supported':
      return hasTranscript ? 'paused' : 'unavailable';
    case 'aborted':
      return hasTranscript ? 'paused' : 'idle';
    default:
      // no-speech · nomatch · network · audio-capture · interrupted · busy
      return hasTranscript ? 'paused' : 'empty';
  }
}

/** İzin yanıtı → hâl (granted → dinlemeye hazır; tekrar sorulabilir → kendi açıklama sheet'imiz). */
export function phaseForPermission(p: { granted?: boolean; canAskAgain?: boolean } | null | undefined): 'idle' | 'perm' | 'denied' {
  if (p?.granted) return 'idle';
  if (p && p.canAskAgain === false) return 'denied';
  return 'perm';
}

/** "Bitti": boş metin → duyulmadı (hak düşmez); çevrimdışı → sakla; aksi analiz. */
export function phaseOnDone(text: string, offline: boolean): 'empty' | 'offline' | 'processing' {
  if (!text.trim()) return 'empty';
  return offline ? 'offline' : 'processing';
}

/**
 * Ses seviyesi (expo-speech-recognition volumechange: −2…10) → 0…1. 0'ın altı sessiz.
 * Dalga çubukları yalnız KAYIT SÜRERKEN bu seviyeyi izler (FinMoScanVoice "Dalga").
 */
export function levelFromVolume(v: number | null | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return 0;
  return Math.min(1, v / 10);
}

/** Dalga çubuk yükseklikleri (pt): ortada yüksek, kenarda alçak zarf × seviye; sessizken 6. */
export const WAVE_BARS = 33;
export function waveHeights(level: number, phase: number, n: number = WAVE_BARS, maxH = 76, minH = 6): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // −1…1
    const env = Math.cos((x * Math.PI) / 2) ** 1.5; // merkezde 1
    const jitter = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + phase));
    out.push(Math.round(minH + (maxH - minH) * env * jitter * Math.max(0, Math.min(1, level))));
  }
  return out;
}

/** Analiz sürerken gösterilen öğe çipleri: virgül / "ve" / "and" ile bölünmüş döküm (en çok 6). */
export function splitSpokenItems(text: string): string[] {
  return text
    .split(/,|;| ve | and | ile /i)
    .map((s) => s.replace(/[.!?]+$/g, '').trim())
    .filter(Boolean)
    .slice(0, 6);
}

/** Ses girdisinin kuyruk/rezervasyon anahtarı (kayıt source_ref'i de olur). */
export function voiceScanKey(userId: string | null | undefined, now: number = Date.now(), rnd: number = Math.random()): string {
  return `voice-${userId ?? 'anon'}-${now.toString(36)}-${Math.floor(rnd * 1e8).toString(36)}`;
}
