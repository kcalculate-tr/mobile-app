// G48-S1 md.1 — Sepet hesaba özel (SAF; native import yok → node:test ile test edilir).
//
// Kalıcı sepet tek bir zustand kaydında (`kcal-cart`, v6) durur ama içerik bir SAHİBE bağlıdır:
//   ownerKey  — canlı sepetin sahibi: kullanıcı kimliği ya da oturumsuz için 'anon'
//   byOwner   — o an oturumda OLMAYAN hesapların bekleyen sepetleri (çıkış → tekrar giriş: sepet geri gelir)
// Oturum değişince `switchCartOwner` canlı sepeti eski sahibin kutusuna koyar, yeni sahibinkini yükler;
// başkasının sepeti asla görünmez. Uygulanan kupon da aynı kurala tabi (sepetle birlikte taşınır).
// Oturumsuz sepet girişte: hesabın sepeti BOŞSA ona taşınır (kupon düşer — kupon hesap bazlı doğrulanır),
// doluysa oturumsuz sepet ATILIR (birleştirme yok). Oturumsuz sepet hiçbir zaman saklanmaz.
// Kayıt sınırı: en fazla MAX_PARKED hesap (en eskiler düşer; cihazda veri birikmesin).
import type { AppliedCoupon, CartItem } from '../types';

export const ANON_OWNER = 'anon';
export const MAX_PARKED = 5;

export interface CartSnap {
  items: CartItem[];
  appliedCoupon: AppliedCoupon | null;
}

export interface OwnedCart extends CartSnap {
  ownerKey: string;
  byOwner: Record<string, CartSnap>;
}

export const ownerKeyFor = (userId: string | null | undefined): string => (userId ? String(userId) : ANON_OWNER);

const EMPTY: CartSnap = { items: [], appliedCoupon: null };
const hasItems = (s: CartSnap | undefined | null) => !!s && Array.isArray(s.items) && s.items.length > 0;

/** Oturum sahibi değişti → yeni canlı sepet + bekleyen kutular. Aynı sahip → aynı nesne (değişiklik yok). */
export function switchCartOwner(state: OwnedCart, nextKey: string): OwnedCart {
  const from = state.ownerKey || ANON_OWNER;
  if (from === nextKey) return state;
  const parked: Record<string, CartSnap> = { ...(state.byOwner ?? {}) };
  const live: CartSnap = { items: state.items ?? [], appliedCoupon: state.appliedCoupon ?? null };
  let next: CartSnap;

  if (from === ANON_OWNER) {
    // Oturumsuz → hesap: hesabın sepeti boşsa oturumsuz sepet taşınır, doluysa oturumsuz atılır.
    const account = parked[nextKey];
    next = hasItems(account) ? (account as CartSnap) : hasItems(live) ? { items: live.items, appliedCoupon: null } : EMPTY;
  } else {
    // Hesap → (oturumsuz | başka hesap): mevcut hesabın sepeti kutusuna; yeni sahibinki yüklenir.
    if (hasItems(live)) {
      delete parked[from];
      parked[from] = live; // en sona (en yeni)
    } else delete parked[from];
    next = nextKey === ANON_OWNER ? EMPTY : parked[nextKey] ?? EMPTY;
  }
  delete parked[nextKey];
  delete parked[ANON_OWNER];

  const keys = Object.keys(parked);
  for (let i = 0; i < keys.length - MAX_PARKED; i++) delete parked[keys[i]];

  return { ownerKey: nextKey, items: next.items, appliedCoupon: next.appliedCoupon, byOwner: parked };
}

/** Hesap silindi: o hesabın bekleyen sepeti silinir; canlı sepet onunsa boşalır. */
export function forgetCartOwner(state: OwnedCart, userId: string): OwnedCart {
  const key = ownerKeyFor(userId);
  const parked = { ...(state.byOwner ?? {}) };
  delete parked[key];
  if (state.ownerKey === key) return { ownerKey: key, items: [], appliedCoupon: null, byOwner: parked };
  return { ...state, byOwner: parked };
}

/** Kalıcı kayıt sürümü. v6 = sahipli sepet; öncesi (sahipsiz `kcal-cart`) ilk açılışta TEMİZLENİR. */
export const CART_PERSIST_VERSION = 6;

export function migrateCart(_persisted: unknown, _version: number): OwnedCart {
  // v5 ve öncesi kimin olduğu bilinmeyen tek sepet → sahipsiz kabul edilir, atılır.
  return { ownerKey: ANON_OWNER, items: [], appliedCoupon: null, byOwner: {} };
}
