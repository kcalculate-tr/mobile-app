// G24-S1 md.3 — kcalAI Koç erişimi: bayrak `koc` + sunucu fonksiyonu var mı (404 → giriş gizli),
// tanıtım bir kez, koç AI izni bir kez (cihaz kaydı + user_consents ai_coach/coach, en iyi çaba).
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { useFeature } from '../../core/flags';
import { probeCoachFunction } from './client';

type Avail = 'unknown' | 'checking' | 'ok' | 'missing';

interface AccessState {
  avail: Avail;
  setAvail: (a: Avail) => void;
}
export const useCoachAccessStore = create<AccessState>((set) => ({
  avail: 'unknown',
  setAvail: (avail) => set({ avail }),
}));

/** Sunucu 404 döndü (gönderimde ya da yoklamada) → oturum boyunca girişler gizli. */
export function markCoachMissing(): void {
  useCoachAccessStore.getState().setAvail('missing');
}

async function probeOnce(): Promise<void> {
  const st = useCoachAccessStore.getState();
  if (st.avail !== 'unknown') return;
  st.setAvail('checking');
  const r = await probeCoachFunction();
  // 'unknown' (ağ yok) → göster; gönderim hatası ayrıca ele alınır.
  useCoachAccessStore.getState().setAvail(r === 'missing' ? 'missing' : 'ok');
}

/**
 * Koç girişleri görünsün mü? Bayrak `koc` kapalı → HAYIR (yoklama da yapılmaz).
 * Açık → fonksiyon yoklanır (oturumda bir kez); 404 → HAYIR. Yoklama sürerken gizli.
 */
export function useCoachEnabled(): boolean {
  const flag = useFeature('koc');
  const avail = useCoachAccessStore((s) => s.avail);
  useEffect(() => {
    if (flag) void probeOnce().catch(() => useCoachAccessStore.getState().setAvail('ok'));
  }, [flag]);
  return flag && avail === 'ok';
}

// ── Tanıtım (bir kez) ─────────────────────────────────────────────────────
export const INTRO_KEY = '@kcal_coach_intro_seen';
export async function introSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(INTRO_KEY)) === '1';
  } catch {
    return false;
  }
}
export async function markIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* bir sonraki açılışta tanıtım yeniden görünür */
  }
}

// ── Koç AI izni (ilk mesajdan önce, bir kez) ──────────────────────────────
export const COACH_CONSENT_KEY = '@kcal_ai_coach_consent';
/** Metin sürümü: İlter onayıyla metin değişirse artır → bir kez yeniden sorulur. */
export const COACH_CONSENT_VERSION = 1;

export async function hasCoachConsent(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(COACH_CONSENT_KEY);
    if (!raw) return false;
    const o = JSON.parse(raw) as { granted?: unknown; v?: unknown };
    return o.granted === true && Number(o.v) >= COACH_CONSENT_VERSION;
  } catch {
    return false;
  }
}

/**
 * Kabul / geri alma. Cihaz kaydı + user_consents satırı (kind ai_coach). Sunucu satırı ortak rıza
 * kuyruğuna KONMAZ (migration uygulanmadıysa CHECK reddeder ve diğer rıza satırlarını tıkardı);
 * doğrudan, en iyi çabayla yazılır.
 */
export async function setCoachConsent(granted: boolean, source: 'coach' | 'settings'): Promise<void> {
  try {
    await AsyncStorage.setItem(COACH_CONSENT_KEY, JSON.stringify({ granted, at: new Date().toISOString(), v: COACH_CONSENT_VERSION }));
  } catch {
    /* yazılamadı: bir sonraki mesajda yeniden sorulur */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseClient } = require('../../core/supabase') as typeof import('../../core/supabase');
    const sb = getSupabaseClient();
    const { data } = await sb.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { consentPlatform, consentAppVersion, emitConsentChange } = require('../../lib/consent/store') as typeof import('../../lib/consent/store');
    await sb.from('user_consents').insert({
      user_id: uid,
      kind: 'ai_coach',
      doc_slug: null,
      doc_version: null,
      granted,
      source,
      platform: consentPlatform(),
      app_version: consentAppVersion(),
      created_at: new Date().toISOString(),
    });
    emitConsentChange();
  } catch {
    /* sunucu kaydı en iyi çaba */
  }
}

/** Ayarlar ekranı için: izin durumu (değişiklikte yenilenir). */
export function useCoachConsent(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const refresh = () => {
    void hasCoachConsent().then(setOn).catch(() => {});
  };
  useEffect(refresh, []);
  return [on, refresh];
}
