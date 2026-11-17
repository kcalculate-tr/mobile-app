// G56-S1 md.6 — Arkadaşını davet et: SAF istemci kuralları (RPC yanıtı ayrıştırma, hata → metin,
// paylaşım metni, kod biçimi). Sunucu: my_referral() / apply_referral_code(p_code) (migration
// 20261116200100_g56_eatkcal_growth.sql).

export type ReferralStatus = 'pending' | 'earned' | 'void';

export interface ReferralHistoryRow {
  id: string;
  name: string | null;
  status: ReferralStatus;
  createdAt: string;
  earnedAt: string | null;
}

export interface MyReferral {
  code: string;
  rewardTl: number | null;
  minOrderTl: number | null;
  history: ReferralHistoryRow[];
}

export type ApplyError =
  | 'invalid_code'
  | 'own_code'
  | 'already_applied'
  | 'has_orders'
  | 'same_person'
  | 'disabled'
  | 'not_signed_in'
  | 'error';
export type ApplyResult = { ok: true } | { ok: false; error: ApplyError };

const APPLY_ERRORS: readonly ApplyError[] = ['invalid_code', 'own_code', 'already_applied', 'has_orders', 'same_person', 'disabled', 'not_signed_in', 'error'];

/** Kod alfabesi (sunucuyla aynı): I, L, O, 0, 1 yok; 6–8 karakter. */
export const REFERRAL_CODE_RE = /^[A-HJKMNP-Z2-9]{6,8}$/;

/** Kullanıcı girişini sunucu biçimine getirir (boşluk yok, büyük harf). */
export function normalizeReferralCode(input: string): string {
  return String(input ?? '').replace(/\s+/g, '').toUpperCase();
}

export function referralCodeLooksValid(input: string): boolean {
  return REFERRAL_CODE_RE.test(normalizeReferralCode(input));
}

const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function parseMyReferral(raw: unknown): MyReferral | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.ok !== true || typeof r.code !== 'string' || !r.code) return null;
  const hist = Array.isArray(r.history) ? r.history : [];
  return {
    code: r.code,
    rewardTl: numOrNull(r.reward_tl),
    minOrderTl: numOrNull(r.min_order_tl),
    history: hist
      .map((h) => {
        const x = (h ?? {}) as Record<string, unknown>;
        const status = x.status === 'earned' || x.status === 'void' ? x.status : 'pending';
        return {
          id: String(x.id ?? ''),
          name: typeof x.name === 'string' && x.name.trim() ? x.name.trim() : null,
          status: status as ReferralStatus,
          createdAt: String(x.created_at ?? ''),
          earnedAt: typeof x.earned_at === 'string' ? x.earned_at : null,
        };
      })
      .filter((h) => h.id),
  };
}

export function parseApplyResult(raw: unknown): ApplyResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.ok === true) return { ok: true };
  const e = String(r.error ?? 'error') as ApplyError;
  return { ok: false, error: APPLY_ERRORS.includes(e) ? e : 'error' };
}

/** Geçmiş satırının hapı: kazanıldı / bekliyor (void satırlar listede gösterilmez). */
export function visibleHistory(rows: readonly ReferralHistoryRow[]): ReferralHistoryRow[] {
  return rows.filter((r) => r.status !== 'void');
}

export const STORE_LINKS = {
  ios: 'https://apps.apple.com/app/id6763964912',
  android: 'https://play.google.com/store/apps/details?id=com.kcalmobile.app',
} as const;

/** Sistem paylaşımı metni (TR/EN): kod + mağaza bağlantıları. `t` = useT().t. */
export function referralShareText(t: (k: string, p?: Record<string, string | number>) => string, code: string): string {
  // G58-S2 md.4: ödül "ikimize de 1 öğün" — tutar yok.
  return [
    t('ek56.invite.share_text', { code }),
    `iPhone: ${STORE_LINKS.ios}`,
    `Android: ${STORE_LINKS.android}`,
  ].join('\n');
}
