// G24-S1 md.3 — Koç ölçüm olayları (coach_open · coach_send · coach_limit · coach_upsell · coach_feedback).
// Kişisel veri YOK: mesaj metni gönderilmez. track() tembel require (Node testleri).
type CoachEvent = 'coach_open' | 'coach_send' | 'coach_limit' | 'coach_upsell' | 'coach_feedback';

export function trackCoach(name: CoachEvent, props: Record<string, unknown> = {}): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { track } = require('../../lib/analytics') as typeof import('../../lib/analytics');
    track(name as never, props as never);
  } catch {
    // ölçüm akışı bozmaz
  }
}
