// G22-S2 md.5 (Tur 26j, G21 T4 — FinFollowError) — iyimser takip + geri alma.
// SAF mantık (native/ağ yok; çağrı dışarıdan verilir) → tsx --test.
//
// Akış: dokununca düğme ANINDA hedef duruma geçer (açık hesap → "Takip ediliyor",
// gizli → "İstek gönderildi", bırakırken → "Takip et"); takipçi sayısı da iyimser
// ±1. Sunucu başarılıysa SUNUCUNUN döndürdüğü durum yazılır (gizli hesapta istek
// vb.). Başarısızsa ÖNCEKİ durum aynen geri gelir (iyimser "Takip ediliyor" geride
// kalmaz) ve çağıran kısa uyarıyı ("Takip edilemedi." · Tekrar dene) gösterir.
import type { FollowState } from './types';

export interface FollowSnapshot {
  me_following: FollowState;
  followers: number;
  is_private: boolean;
}

/** Dokunuş takibi açıyor mu? ('none' → aç; 'following' / 'requested' → bırak). */
export function isTurningOn(current: FollowState): boolean {
  return current === 'none';
}

/** İyimser hedef: açarken gizli hesapta 'requested', açıkta 'following'; bırakırken 'none'. */
export function optimisticFollow(s: FollowSnapshot): FollowSnapshot {
  if (isTurningOn(s.me_following)) {
    const next: FollowState = s.is_private ? 'requested' : 'following';
    return { ...s, me_following: next, followers: next === 'following' ? s.followers + 1 : s.followers };
  }
  const wasFollowing = s.me_following === 'following';
  return { ...s, me_following: 'none', followers: wasFollowing ? Math.max(0, s.followers - 1) : s.followers };
}

/** Sunucu yanıtını öncekine göre uzlaştır (sayaç öncekinden yeniden hesaplanır). */
export function settleFollow(prev: FollowSnapshot, serverState: FollowState): FollowSnapshot {
  let followers = prev.followers;
  if (prev.me_following !== 'following' && serverState === 'following') followers += 1;
  if (prev.me_following === 'following' && serverState !== 'following') followers = Math.max(0, followers - 1);
  return { ...prev, me_following: serverState, followers };
}

export type FollowRunResult = { ok: true; state: FollowState; turningOn: boolean } | { ok: false; turningOn: boolean };

/**
 * İyimser takip çalıştırıcısı. `apply` her durum değişiminde çağrılır (iyimser →
 * sunucu ya da geri alma). Hata FIRLATMAZ; `{ ok:false }` döner.
 */
export async function runOptimisticFollow(
  prev: FollowSnapshot,
  call: (on: boolean) => Promise<{ state: FollowState }>,
  apply: (next: FollowSnapshot) => void,
): Promise<FollowRunResult> {
  const turningOn = isTurningOn(prev.me_following);
  apply(optimisticFollow(prev));
  try {
    const res = await call(turningOn);
    apply(settleFollow(prev, res.state));
    return { ok: true, state: res.state, turningOn };
  } catch {
    apply(prev);
    return { ok: false, turningOn };
  }
}
