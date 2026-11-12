// G22-S1 md.4 — abonelik ölçüm olayları (paywall_view · sub_purchase · sub_restore · barcode_limit).
// Kişisel veri YOK: yalnız ürün kimliği ve sonuç. track() tembel require (Node testleri).
type SubEvent = 'paywall_view' | 'sub_purchase' | 'sub_restore' | 'barcode_limit';

export function trackSub(name: SubEvent, props: Record<string, unknown> = {}): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { track } = require('../../lib/analytics') as typeof import('../../lib/analytics');
    track(name as never, props as never);
  } catch {
    // ölçüm akışı bozmaz
  }
}
