// G42-S1 md.9 — B yolu kısa profil kapısı: "Sonra oluştur" ile kayıt olan kullanıcının İLK kalori kaydında
// kısa profil (B-P1/P2/P3/P4/P5/P8) açılır; bu, mevcut takip kapısıdır (kayıt saveTakibeProfile ile).
// Yalnız `yeni_kayit` açık + kısa profil beklemesi işaretli + hesapta hedef yokken devreye girer.
import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../core/AuthContext';
import { useFeature } from '../../core/flags';
import { getSupabaseClient } from '../../core/supabase';
import { hasNutritionGoal, type GoalClient } from '../onboarding/v2/loginLogic';
import { isShortPending, setShortPending } from './storage';
import { kv } from './store';

/** Saf karar: kısa profile yönlendirilsin mi. */
export function shouldGateShort(i: { flag: boolean; pending: boolean; hasGoal: boolean | null }): boolean {
  return i.flag && i.pending && i.hasGoal === false;
}

/**
 * `gate(navigate)`: yönlendirdiyse true (çağıran kaydı başlatmaz). Bayrak kapalıyken hiçbir sorgu atmaz
 * ve daima false döner → bugünkü davranış aynı.
 */
export function useShortProfileGate(): (navigate: (name: string, params?: object) => void) => boolean {
  const flag = useFeature('yeni_kayit');
  const { user } = useAuth();
  const state = useRef<{ pending: boolean; hasGoal: boolean | null }>({ pending: false, hasGoal: null });

  useFocusEffect(
    useCallback(() => {
      if (!flag || !user?.id) return;
      let alive = true;
      void (async () => {
        const pending = await isShortPending(kv);
        if (!pending) {
          if (alive) state.current = { pending: false, hasGoal: null };
          return;
        }
        const hasGoal = await hasNutritionGoal(async () => getSupabaseClient() as unknown as GoalClient, user.id);
        // Hedef zaten varsa (ör. başka cihazda tamamlandı) bekleme kalkar.
        if (hasGoal) await setShortPending(kv, false);
        if (alive) state.current = { pending: !hasGoal, hasGoal };
      })();
      return () => {
        alive = false;
      };
    }, [flag, user?.id]),
  );

  useEffect(() => {
    if (!flag) state.current = { pending: false, hasGoal: null };
  }, [flag]);

  return (navigate) => {
    if (!shouldGateShort({ flag, ...state.current })) return false;
    navigate('KayitShort', { mode: 'short' });
    return true;
  };
}
