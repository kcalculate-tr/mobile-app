// G25-S1 md.4 (A5) — Macro ödül kuponu "Kullan" → sepet. Sepet boşken kod burada bekler; sepete
// ürün eklenip sepet açıldığında bir kez doğrulanıp uygulanır (validate_coupon_v2). SAF modül.
let pending: string | null = null;

export function setPendingCoupon(code: string | null | undefined): void {
  const c = typeof code === 'string' ? code.trim() : '';
  pending = c ? c : null;
}

export function peekPendingCoupon(): string | null {
  return pending;
}

/** Bekleyen kodu alır ve temizler (bir kez uygulanır). */
export function takePendingCoupon(): string | null {
  const c = pending;
  pending = null;
  return c;
}
