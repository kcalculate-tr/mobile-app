// G42-S1 md.11 — Birinci taraf huni olayları. Sağlık değerleri (kilo, boy, yaş, hedef, kalori) olaylara
// GİTMEZ: `reg_q_answer` yalnız soru kimliğini (P1…P14) taşır. track() tembel require (Node testleri).
import type { KPath, KStart } from './model';

type Sent = { name: string; props: Record<string, unknown> };
/** Test kancası: gönderilen olaylar (yalnız test). */
export const __sent: Sent[] = [];

function send(name: string, props: Record<string, unknown>): void {
  __sent.push({ name, props });
  if (__sent.length > 200) __sent.shift();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { track } = require('../../lib/analytics') as typeof import('../../lib/analytics');
    track(name as never, props as never);
  } catch {
    // ölçüm akışı bozmaz
  }
}

export const kTrack = {
  onbStep: (step: number, lang: 'tr' | 'en') => send('onb_step_view', { step, lang }),
  pathChoice: (path: KPath, start: KStart) => send('onb_path_choice', { path, start }),
  answer: (q: string, path: KPath) => send('reg_q_answer', { q, path }),
  planReady: (recalc: boolean) => send('plan_ready', { recalc }),
  signupMethod: (method: 'apple' | 'google' | 'email', path: KPath) => send('reg_signup_method', { method, path }),
  metaConsent: (granted: boolean, att: 'granted' | 'denied' | 'undetermined' | 'unavailable') => send('meta_consent', { granted, att }),
  paywallView: (period: 'yearly' | 'monthly') => send('paywall_view_reg', { period }),
  trialStart: (plan: string, result: 'success' | 'cancelled' | 'pending' | 'error') => send('trial_start_reg', { plan, result }),
  /** G46 md.3: T1 kapatma onayı — stay (Denemeye başla / sayfayı kapat) · leave (Yine de çık). */
  dismissConfirm: (choice: 'stay' | 'leave') => send('paywall_dismiss_confirm', { choice }),
};

/** Olay prop'larında sağlık değeri anahtarı var mı (test + savunma). */
export const HEALTH_KEYS = ['weight', 'weight_kg', 'height', 'height_cm', 'age', 'birth_year', 'target', 'kcal', 'calories', 'bmi', 'value', 'answer', 'goal'] as const;
