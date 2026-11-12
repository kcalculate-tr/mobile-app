// G22-S1 md.3 — RevenueCat yapılandırma + oturum bağlama (App kökünde bir kez).
// Girişte Purchases.logIn(userId) (app_user_id = Supabase user id → webhook eşlemesi),
// çıkışta logOut. Bayrak kapalıyken de yapılandırılır (anahtar varsa) ki yetki önceden
// bilinsin; abonelik GİRİŞLERİ `useSubscriptionEnabled()` (bayrak + available) ile açılır.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../../core/AuthContext';
import { useFeature } from '../../core/flags';
import { initPurchases, purchasesLogIn, purchasesLogOut, refreshEntitlement, useSubscriptionStore } from './purchases';

export function useSubscriptionBootstrap(): void {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const prev = useRef<string | null>(null);

  useEffect(() => {
    initPurchases();
  }, []);

  useEffect(() => {
    if (uid && uid !== prev.current) {
      prev.current = uid;
      void purchasesLogIn(uid).then(() => refreshEntitlement());
    } else if (!uid && prev.current) {
      prev.current = null;
      void purchasesLogOut();
    }
  }, [uid]);

  // Öne gelince yeniden doğrula (mağazada iptal/yenileme, gece yarısı sıfırlama).
  useEffect(() => {
    if (!uid) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshEntitlement();
    });
    return () => sub.remove();
  }, [uid]);
}

/** Abonelik girişleri görünür mü: `abonelik` bayrağı AÇIK + RevenueCat yapılandırıldı. */
export function useSubscriptionEnabled(): boolean {
  const flag = useFeature('abonelik');
  const available = useSubscriptionStore((s) => s.available);
  return flag && available;
}
