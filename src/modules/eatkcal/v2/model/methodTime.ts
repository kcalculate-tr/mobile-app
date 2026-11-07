// G17-S1 md.6 — Sipariş özeti "Yöntem · Zaman" seçim durumu (SAF, görünüm katmanı).
// useEkCheckout'un varsayılanları (home_delivery + immediate) ve sipariş/ödeme
// mantığı DEĞİŞMEZ; bu yalnız kullanıcının AÇIKÇA seçip seçmediğini ve seçimin
// hâlâ geçerli olup olmadığını hesaplar. "Öde" yalnız ready=true iken etkin.

export type PickedMethod = 'home_delivery' | 'pickup' | null;
export type PickedTime = 'immediate' | 'scheduled' | null;

export interface MethodTimeInput {
  pickedMethod: PickedMethod;
  pickedTime: PickedTime;
  deliveryMethod: 'home_delivery' | 'pickup';
  deliveryTimeType: 'immediate' | 'scheduled';
  rulesSettled: boolean;
  canPickImmediate: boolean;
  canPickScheduled: boolean;
  hasScheduledDate: boolean;
  /** Seçili dilim var ve dolu değil. */
  hasOpenSlot: boolean;
}

export interface MethodTimeState {
  methodReady: boolean;
  /** Seçilen zaman türü hâlâ mantığın türüyle aynı ve izinli mi (değilse seçim düşer). */
  timeStillValid: boolean;
  ready: boolean;
}

export function methodTimeState(i: MethodTimeInput): MethodTimeState {
  const methodReady = i.pickedMethod !== null && i.pickedMethod === i.deliveryMethod;
  const timeStillValid =
    i.pickedTime !== null &&
    i.pickedTime === i.deliveryTimeType &&
    (i.pickedTime === 'immediate'
      ? !(i.rulesSettled && !i.canPickImmediate)
      : !(i.rulesSettled && !i.canPickScheduled));
  const timeReady =
    i.deliveryMethod === 'pickup' ||
    (timeStillValid && (i.pickedTime === 'immediate' || (i.hasScheduledDate && i.hasOpenSlot)));
  return { methodReady, timeStillValid, ready: methodReady && timeReady };
}
