// G22-S1 md.1 — Sesle ekleme durumu: dinle → canlı döküm → "Bitti" → metin analizi.
//
// Ses telefonda kalır (expo-speech-recognition); analize YALNIZ METİN gider
// (runAiTextScan → analyze-ai-scan mode:'text'). Hak fotoğrafla ORTAK (reserve_ai_scan).
// Çevrimdışıyken metin kuyruğa alınır (offlineQueue, text alanı) ve bağlantı gelince
// fotoğraf kuyruğu gibi işlenir.
import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getAiScanClient } from '../client';
import { runAiTextScan } from '../runScan';
import { getPendingScanCount, setPendingScanPhoto } from '../offlineQueue';
import { trackScanOutcome } from '../scanTrack';
import type { AiScanOutcome, ScanEstimate } from '../types';
import {
  joinTranscript,
  phaseAfterError,
  phaseForPermission,
  phaseOnDone,
  speechLocale,
  voiceScanKey,
  levelFromVolume,
  type VoicePhase,
} from './voiceCore';
import { abortListening, requestSpeechPermission, speechPermission, startListening, stopListening } from './speech';

type Track = (name: 'voice_start' | 'voice_done' | 'voice_empty', props?: Record<string, unknown>) => void;
const track: Track = (name, props) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const a = require('../../../../lib/analytics') as typeof import('../../../../lib/analytics');
    a.track(name as never, (props ?? {}) as never);
  } catch {
    // ölçüm akışı bozmaz
  }
};

function deviceLang(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('expo-localization') as typeof import('expo-localization');
    return L.getLocales?.()[0]?.languageCode ?? null;
  } catch {
    return null;
  }
}

export interface VoiceScanOptions {
  active: boolean;
  userId: string | null;
  lang: 'tr' | 'en';
  mealType: string;
  /** AI izni yoksa sheet açar ve true döner (analiz bekler; onaydan sonra `resume`). */
  aiBlocked: () => Promise<boolean>;
  onResult: (r: { estimate: Omit<ScanEstimate, 'isEstimate'>; key: string; transcript: string; outcome: AiScanOutcome }) => void;
  onOutcome?: (o: AiScanOutcome) => void;
  /** Acil kapatma / genel tavan — Tara'nın mevcut "kullanılamıyor" sayfası. */
  onUnavailable?: () => void;
}

export function useVoiceScan(o: VoiceScanOptions) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState(false);
  const [level, setLevel] = useState(0);
  const [offlineCount, setOfflineCount] = useState(1);

  const committed = useRef('');
  const session = useRef('');
  const unsub = useRef<(() => void) | null>(null);
  const phaseRef = useRef<VoicePhase>('idle');
  const doneRequested = useRef(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runToken = useRef(0);
  const last = useRef<{ key: string; text: string } | null>(null);
  const pendingText = useRef<string | null>(null);
  const optsRef = useRef(o);
  optsRef.current = o;

  const set = useCallback((p: VoicePhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const currentText = () => joinTranscript(committed.current, session.current);

  const detach = () => {
    unsub.current?.();
    unsub.current = null;
    setLevel(0);
    setInterim(false);
  };

  // Mod açılınca izin durumu (izin yoksa kendi açıklama sheet'imiz — FinScanVoicePerm).
  useEffect(() => {
    if (!o.active) {
      abortListening();
      detach();
      return;
    }
    let alive = true;
    void speechPermission().then((perm) => {
      if (!alive) return;
      if (perm == null) {
        set('unavailable');
        return;
      }
      const p = phaseForPermission(perm);
      if (phaseRef.current === 'idle' || phaseRef.current === 'unavailable') set(p);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.active]);

  useEffect(
    () => () => {
      abortListening();
      unsub.current?.();
      if (doneTimer.current) clearTimeout(doneTimer.current);
    },
    [],
  );

  // ── Analiz ────────────────────────────────────────────────────────────────
  const analyze = useCallback(
    async (text: string) => {
      const opts = optsRef.current;
      const net = await NetInfo.fetch().catch(() => null);
      const next = phaseOnDone(text, net?.isConnected === false);
      if (next === 'empty') {
        track('voice_empty');
        set('empty');
        return;
      }
      // Aynı metin yeniden denenirse AYNI anahtar (iade edilen hak yeniden ayrılır,
      // sunucuda tamamlanmışsa önbellekten — hak düşmeden).
      const key = last.current && last.current.text === text ? last.current.key : voiceScanKey(opts.userId);
      last.current = { key, text };
      if (next === 'offline') {
        await setPendingScanPhoto({ id: key, imageUri: '', text, mealType: opts.mealType, queuedAt: new Date().toISOString(), lang: opts.lang });
        setOfflineCount(await getPendingScanCount().catch(() => 1));
        set('offline');
        return;
      }
      if (await opts.aiBlocked()) {
        pendingText.current = text;
        set('paused');
        return;
      }
      set('processing');
      track('voice_done', { chars: text.length });
      const token = ++runToken.current;
      let outcome: AiScanOutcome;
      try {
        outcome = await runAiTextScan(getAiScanClient(), { idempotencyKey: key, text, lang: opts.lang });
      } catch {
        if (token === runToken.current) set('failed');
        return;
      }
      if (token !== runToken.current) return; // İptal edildi
      trackScanOutcome(outcome, 'voice');
      opts.onOutcome?.(outcome);
      if (outcome.status === 'ok') {
        opts.onResult({ estimate: outcome.estimate, key, transcript: text, outcome });
        set('idle');
        return;
      }
      if (outcome.status === 'quota_exhausted') {
        set('limit');
        return;
      }
      if (outcome.status === 'unavailable') {
        set('paused');
        opts.onUnavailable?.();
        return;
      }
      set('failed');
    },
    [set],
  );

  const finishNow = useCallback(() => {
    if (doneTimer.current) clearTimeout(doneTimer.current);
    doneTimer.current = null;
    doneRequested.current = false;
    if (session.current) {
      committed.current = currentText();
      session.current = '';
    }
    detach();
    const text = committed.current;
    setTranscript(text);
    void analyze(text);
  }, [analyze]);

  // ── Dinleme ───────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    const perm = await speechPermission();
    if (perm == null) {
      set('unavailable');
      return;
    }
    const p = phaseForPermission(perm);
    if (p !== 'idle') {
      set(p);
      return;
    }
    const locale = speechLocale(deviceLang(), optsRef.current.lang);
    detach();
    session.current = '';
    const stop = startListening(locale, {
      onResult: (text, isFinal) => {
        session.current = text;
        if (isFinal) {
          committed.current = currentText();
          session.current = '';
        }
        setInterim(!isFinal);
        setTranscript(currentText());
      },
      onEnd: () => {
        detach();
        if (doneRequested.current) {
          finishNow();
          return;
        }
        if (phaseRef.current === 'listening') {
          if (session.current) {
            committed.current = currentText();
            session.current = '';
          }
          const has = !!committed.current.trim();
          set(has ? 'paused' : 'empty');
          if (!has) track('voice_empty');
        }
      },
      onError: (code) => {
        detach();
        if (doneRequested.current) {
          finishNow();
          return;
        }
        if (session.current) {
          committed.current = currentText();
          session.current = '';
        }
        const next = phaseAfterError(code, !!committed.current.trim());
        if (next === 'empty') track('voice_empty');
        set(next);
      },
      onVolume: (v) => setLevel(levelFromVolume(v)),
    });
    if (!stop) {
      set('unavailable');
      return;
    }
    unsub.current = stop;
    track('voice_start', { lang: locale.startsWith('tr') ? 'tr' : 'en' });
    set('listening');
  }, [finishNow, set]);

  const mic = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'listening') {
      // Durdur → duraklat (metin korunur; mikrofona yeniden dokununca devam eder).
      stopListening();
      set('paused');
      return;
    }
    if (p === 'processing') return;
    if (p === 'empty' || p === 'failed') {
      committed.current = '';
      setTranscript('');
    }
    void start();
  }, [set, start]);

  const done = useCallback(() => {
    if (phaseRef.current === 'listening') {
      doneRequested.current = true;
      stopListening();
      // 'end' gelmezse (bazı Android servisleri) 1,5 sn sonra elimizdekiyle devam.
      doneTimer.current = setTimeout(() => {
        if (doneRequested.current) finishNow();
      }, 1500);
      return;
    }
    finishNow();
  }, [finishNow]);

  const cancel = useCallback(() => {
    runToken.current++;
    set(committed.current.trim() ? 'paused' : 'idle');
  }, [set]);

  const permContinue = useCallback(async () => {
    const r = await requestSpeechPermission();
    const p = phaseForPermission(r);
    if (p === 'idle') {
      set('idle');
      void start();
    } else set(p === 'perm' ? 'denied' : p);
  }, [set, start]);

  const retry = useCallback(() => {
    if (phaseRef.current === 'failed' && committed.current.trim()) {
      void analyze(committed.current);
      return;
    }
    committed.current = '';
    session.current = '';
    setTranscript('');
    void start();
  }, [analyze, start]);

  const submitText = useCallback(
    (text: string) => {
      abortListening();
      detach();
      committed.current = text.trim();
      session.current = '';
      setTranscript(committed.current);
      void analyze(committed.current);
    },
    [analyze],
  );

  /** AI izni onaylandıktan sonra bekleyen metni analiz et. */
  const resume = useCallback(() => {
    const t = pendingText.current;
    pendingText.current = null;
    if (t) void analyze(t);
  }, [analyze]);

  const reset = useCallback(() => {
    runToken.current++;
    abortListening();
    detach();
    committed.current = '';
    session.current = '';
    pendingText.current = null;
    setTranscript('');
    set('idle');
  }, [set]);

  const dismiss = useCallback(() => {
    // Sheet kapat → metin varsa duraklat, yoksa hazır.
    set(committed.current.trim() ? 'paused' : 'idle');
  }, [set]);

  return { phase, transcript, interim, level, offlineCount, mic, done, cancel, permContinue, retry, submitText, resume, reset, dismiss, setPhase: set };
}
