// G22-S1 md.3/md.4 — günlük haklar: SAF mantık. Değerler sunucudan (app_settings /
// my_entitlement / reserve_* yanıtı) gelir; burada SAYI SABİTİ YOK.
import type { Tier } from './plans';

/** Kademe başına günlük limit; null = sınırsız (ücretli barkod). */
export interface TierLimits {
  ai: Record<Tier, number | null>;
  barcode: Record<Tier, number | null>;
  /** G24-S1 kcalAI Koç: Balance günlük mesaj (coach_daily_balance) + Free/Fresh ömür boyu deneme (coach_trial_free). */
  coach?: { daily: number | null; trial: number | null };
}

/** app_settings satırları → limitler. Eksik anahtar → null (bilinmiyor: arayüz sayıyı gizler). */
export function limitsFromSettings(rows: readonly { key: string; value: unknown }[] | null | undefined): TierLimits {
  const m = new Map<string, number>();
  for (const r of rows ?? []) {
    const n = Number(typeof r.value === 'string' ? r.value : (r.value as number));
    if (Number.isFinite(n) && n >= 0) m.set(r.key, Math.floor(n));
  }
  const g = (k: string) => (m.has(k) ? (m.get(k) as number) : null);
  return {
    ai: { free: g('ai_daily_free'), fresh: g('ai_daily_fresh'), balance: g('ai_daily_balance') },
    // Fresh/Balance barkod sınırsız (kural) — null.
    barcode: { free: g('barcode_daily_free'), fresh: null, balance: null },
    coach: { daily: g('coach_daily_balance'), trial: g('coach_trial_free') },
  };
}

export const LIMIT_SETTING_KEYS = ['ai_daily_free', 'ai_daily_fresh', 'ai_daily_balance', 'barcode_daily_free', 'coach_daily_balance', 'coach_trial_free'] as const;

/** reserve_ai_scan / reserve_barcode_scan / my_entitlement ortak alt kümesi. */
export interface QuotaSnapshot {
  kind: 'ai' | 'barcode';
  tier: Tier | null;
  remaining: number | null;
  limit: number | null;
  unlimited: boolean;
  resetAt: string | null;
}

/** Sunucu yanıtı → anlık hak. G19 yanıtında (migration öncesi) tier/limit yok → null. */
export function quotaFromReserve(kind: 'ai' | 'barcode', r: unknown): QuotaSnapshot {
  const o = (r ?? {}) as Record<string, unknown>;
  const tier = o.tier === 'free' || o.tier === 'fresh' || o.tier === 'balance' ? (o.tier as Tier) : null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    kind,
    tier,
    remaining: num(o.remaining),
    limit: num(o.limit),
    unlimited: o.unlimited === true,
    resetAt: typeof o.reset_at === 'string' ? o.reset_at : null,
  };
}

/**
 * FinSubPill metni: "Bugün N/2" · "Bugün N/10" · "Bugün N/50" (G23-S1: AI hiçbir kademede
 * sınırsız değil; "Sınırsız" yalnız ücretli barkod hakkında, limit null). Limit bilinmiyorsa
 * (G19 yanıtı) eski G19 tavanına düşülmez → yalnız N bilinirse `cap` ile, değilse null (hap gizli).
 */
export function pillLabel(
  q: Pick<QuotaSnapshot, 'remaining' | 'limit' | 'unlimited'> | null,
  t: (key: string, opts?: Record<string, string | number>) => string,
  fallbackCap?: number | null,
): string | null {
  if (!q) return null;
  const cap = q.limit ?? fallbackCap ?? null;
  if (q.unlimited && cap == null) return t('sub.pill.unlimited');
  if (q.remaining == null || cap == null) return null;
  return t('sub.pill.today', { n: Math.max(0, Math.min(q.remaining, cap)), cap });
}

/** VoiceOver etiketi ("Bugün 2 AI taramadan 1 hakkın kaldı"). */
export function pillA11y(
  q: Pick<QuotaSnapshot, 'kind' | 'remaining' | 'limit' | 'unlimited'> | null,
  t: (key: string, opts?: Record<string, string | number>) => string,
  fallbackCap?: number | null,
): string | null {
  if (!q) return null;
  const cap = q.limit ?? fallbackCap ?? null;
  if (q.unlimited && cap == null && q.kind === 'barcode') return t('sub.pill.unlimited_a11y_barcode');
  if (q.remaining == null || cap == null) return null;
  return t(q.kind === 'ai' ? 'sub.pill.a11y_ai' : 'sub.pill.a11y_barcode', { n: Math.max(0, q.remaining), cap });
}

/**
 * Hak bitti mi? Barkod RPC'si yoksa (migration öncesi) ya da ağ hatası → izin ver
 * (fail-open: barkod ücretsiz ve istemci tarafı; yanlış "hakkın bitti" göstermekten güvenli).
 */
export function barcodeAllowed(res: { ok?: unknown } | null | undefined, rpcFailed: boolean): boolean {
  if (rpcFailed || !res) return true;
  return res.ok !== false;
}

/** Plan karşılaştırma karoları (FinSubLimitSheet): Ücretsiz · Fresh · Balance. */
export function limitTiles(kind: 'ai' | 'barcode', limits: TierLimits, current: Tier) {
  const rows = kind === 'ai' ? limits.ai : limits.barcode;
  return (['free', 'fresh', 'balance'] as const).map((tier) => {
    const v = rows[tier];
    // G23-S1: AI her kademede sayılı (2 · 10 · 50); yalnız ücretli barkod null = sınırsız.
    const unlimited = kind === 'barcode' && v == null && tier !== 'free';
    return { tier, value: unlimited ? null : v, unlimited, current: tier === current };
  });
}
