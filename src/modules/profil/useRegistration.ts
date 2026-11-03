// İki kayıt şablonunun AKIŞ MANTIĞI — bayrak arkasında, yeni dosyalarda.
// Mevcut UnifiedLoginScreen ve checkout DEĞİŞMEZ: bu hook'lar o ekranlara
// bağlı değil; yalnız yeni akış / __DEV__ deneme ekranı kullanır.
//
// (a) Kcalculate AI: kimlik (e-posta/Apple/Google — mevcut auth) + ad + @handle;
//     kalori/hedef İSTEĞE BAĞLI ("Takibe başla" ile ayrıca girilir).
// (b) eatkcal: ilk siparişte şehir kapısı (check_delivery_city) + mevcut
//     adres/telefon akışı (o akış korunur; burada yalnız şehir kapısı eklenir).
import { useCallback, useState } from 'react';

import { useFeature } from '../../core/flags';
import { getProfilClient } from './client';
import { validateHandle } from './handle';
import { useHandleClaim, type UseHandleClaim } from './useHandleClaim';

// ── (a) Kcalculate AI profili ────────────────────────────────────────────────
export interface KcalculateAiRegistration {
  enabled: boolean;
  displayName: string;
  setDisplayName: (v: string) => void;
  handle: UseHandleClaim;
  wantsTracking: boolean;
  setWantsTracking: (v: boolean) => void;
  submitting: boolean;
  error: string | null;
  canSubmit: boolean;
  /** Handle'ı claim + açık profili güncelle. Dönüş: başarı + takip isteği. */
  submit: () => Promise<{ ok: boolean; startTracking: boolean }>;
}

export function useKcalculateAiRegistration(): KcalculateAiRegistration {
  // Profil/sosyal taraf Keşfet bayrağına bağlı (kayıt da onunla açılır).
  const enabled = useFeature('kesfet');
  const [displayName, setDisplayName] = useState('');
  const [wantsTracking, setWantsTracking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handle = useHandleClaim('');

  const canSubmit =
    enabled &&
    displayName.trim().length > 0 &&
    validateHandle(handle.value).ok &&
    !submitting;

  const submit = useCallback(async (): Promise<{ ok: boolean; startTracking: boolean }> => {
    if (!enabled) return { ok: false, startTracking: false };
    const v = validateHandle(handle.value);
    if (displayName.trim().length === 0 || !v.ok) {
      setError('profil.handle_invalid');
      return { ok: false, startTracking: false };
    }
    setSubmitting(true);
    setError(null);
    try {
      const claim = await getProfilClient().claimHandle({ handle: v.normalized });
      if (!claim.ok) {
        setError(claim.reason === 'taken' ? 'profil.handle_taken' : 'profil.handle_invalid');
        return { ok: false, startTracking: false };
      }
      await getProfilClient().updatePublicProfile({
        displayName: displayName.trim(),
        bio: null,
        avatarUrl: null,
      });
      // "Takibe başla" → çağıran NutritionProfile'a yönlendirir (kalori ZORUNLU değil).
      return { ok: true, startTracking: wantsTracking };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'submit_failed');
      return { ok: false, startTracking: false };
    } finally {
      setSubmitting(false);
    }
  }, [enabled, displayName, handle.value, wantsTracking]);

  return {
    enabled,
    displayName,
    setDisplayName,
    handle,
    wantsTracking,
    setWantsTracking,
    submitting,
    error,
    canSubmit,
    submit,
  };
}

// ── (b) eatkcal ilk sipariş şehir kapısı ──────────────────────────────────────
export type CityGateStatus = 'idle' | 'checking' | 'allowed' | 'blocked' | 'error';

export interface EatkcalRegistration {
  enabled: boolean;
  city: string;
  setCity: (v: string) => void;
  status: CityGateStatus;
  /** 'blocked' durumunda i18n anahtarı (profil.city_gate_*), aksi halde null. */
  messageKey: string | null;
  /** Şehri doğrula. true → mevcut adres/telefon akışı devam edebilir. */
  checkCity: () => Promise<boolean>;
}

export function useEatkcalRegistration(): EatkcalRegistration {
  // eatkcal kapısı "restoran yakında" bayrağına bağlı.
  const enabled = useFeature('restoran_yakinda');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState<CityGateStatus>('idle');
  const [messageKey, setMessageKey] = useState<string | null>(null);

  const checkCity = useCallback(async (): Promise<boolean> => {
    if (!enabled || city.trim().length === 0) {
      setStatus('idle');
      return false;
    }
    setStatus('checking');
    setMessageKey(null);
    try {
      const res = await getProfilClient().checkDeliveryCity({ city: city.trim() });
      if (res.ok) {
        setStatus('allowed');
        setMessageKey(null);
        return true;
      }
      setStatus('blocked');
      setMessageKey('profil.city_gate_only_izmir');
      return false;
    } catch {
      setStatus('error');
      setMessageKey(null);
      return false;
    }
  }, [enabled, city]);

  return { enabled, city, setCity, status, messageKey, checkCity };
}
