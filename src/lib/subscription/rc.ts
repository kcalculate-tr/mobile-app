// G22-S1 md.3 — RevenueCat yanıtlarının SAF eşlemesi (native bağımlılık yok, Node testi).
import { tierFromEntitlements, type Tier } from './plans';

export interface RcSnapshot {
  tier: Tier;
  productId: string | null;
  expiresAt: string | null;
  willRenew: boolean;
  trial: boolean;
  store: string | null;
  managementURL: string | null;
}

export type PurchaseResult = 'success' | 'cancelled' | 'pending' | 'error';

export type CustomerInfoLike = {
  entitlements?: { active?: Record<string, { identifier?: string; productIdentifier?: string; expirationDate?: string | null; willRenew?: boolean; periodType?: string; store?: string }> };
  managementURL?: string | null;
};

/** RevenueCat CustomerInfo → kademe özeti (SAF; test eder). */
export function rcSnapshot(info: CustomerInfoLike | null | undefined): RcSnapshot {
  const active = info?.entitlements?.active ?? {};
  const ids = Object.keys(active);
  const tier = tierFromEntitlements(ids);
  const e = tier === 'free' ? null : active[tier] ?? null;
  return {
    tier,
    productId: e?.productIdentifier ?? null,
    expiresAt: e?.expirationDate ?? null,
    willRenew: e?.willRenew ?? false,
    trial: (e?.periodType ?? '').toUpperCase() === 'TRIAL',
    store: e?.store ?? null,
    managementURL: info?.managementURL ?? null,
  };
}

/** RevenueCat hata kodu → sonuç (SAF; test eder). 1=iptal, 20=ödeme bekliyor. */
export function purchaseErrorResult(e: unknown): PurchaseResult {
  const o = (e ?? {}) as { code?: unknown; userCancelled?: unknown };
  const code = String(o.code ?? '');
  if (o.userCancelled === true || code === '1' || code === 'PURCHASE_CANCELLED_ERROR') return 'cancelled';
  if (code === '20' || code === 'PAYMENT_PENDING_ERROR') return 'pending';
  return 'error';
}

