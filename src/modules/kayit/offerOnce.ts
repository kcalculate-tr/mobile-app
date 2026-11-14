// G46-S1 md.3 / G54-S1 md.1 — T1 kayıt teklifi kararı ve "bir kez" işareti.
// Kural (G54, KESİN): kayıt akışı (A yolu L2 kaydı ya da B kısa profil son adımı) başarıyla bitince AKTİF ABONELİĞİ
// OLMAYAN herkese T1 açılır. Hesabın yaşı / giriş yöntemi / akışın açıldığı yer fark etmez (`isFreshAccount`
// kullanılmaz). Aktif abonelik (Fresh/Balance, deneme dahil) → T1 yok. "Bir kez": T1 açıldığı anda hesaba
// (`auth.updateUser({ data: { kayit_offer_shown_at } })` → user_metadata; şema değişikliği yok) ve cihaz yedeğine
// (AsyncStorage, anahtar kullanıcı kimliğiyle) yazılır. Düzenleme özeti (G54 md.5) bu yolu hiç çağırmaz.
import { getSupabaseClient } from '../../core/supabase';
import { useSubscriptionStore } from '../../lib/subscription/purchases';
import { resolveTier } from '../../lib/subscription/plans';
import { OFFER_META_KEY, accountOfferShown, isOfferShownOnDevice, markOfferShownOnDevice, shouldShowOffer } from './storage';
import { kv } from './store';

/** Aktif abonelik (Fresh/Balance, deneme dahil) var mı — RevenueCat + sunucu hakkının yüksek olanı. */
export function hasActiveSubscription(): boolean {
  const s = useSubscriptionStore.getState();
  return resolveTier(s.rc?.tier ?? null, s.server?.tier ?? null).tier !== 'free';
}

/** Kayıt bitince: T1'e mi (true) yoksa doğrudan dokunulan eyleme mi. */
export async function offerAllowed(userId: string | null | undefined, userMeta: Record<string, unknown> | null | undefined): Promise<boolean> {
  const device = await isOfferShownOnDevice(kv, userId);
  return shouldShowOffer({ subscribed: hasActiveSubscription(), device, account: accountOfferShown(userMeta) });
}

/** T1 göründü: cihaza ve hesaba işaretle (hesap yazımı başarısızsa cihaz işareti yine korur). */
export async function markOfferShown(userId?: string | null, now: number = Date.now()): Promise<void> {
  await markOfferShownOnDevice(kv, userId, now);
  try {
    await getSupabaseClient().auth.updateUser({ data: { [OFFER_META_KEY]: new Date(now).toISOString() } });
  } catch {
    /* çevrimdışı vb. — cihaz işareti yeterli */
  }
}

/** Kayıt sonu dönüş hedefi (kök yığın rotası) — T1 kapanınca / tebrikten sonra kullanıcı buraya döner. */
export type OfferReturn = { name: string; params?: Record<string, unknown> } | null;

/**
 * G54 md.1 — kayıt akışı başarıyla bitti: T1 izinliyse kök `KayitOffer` modalını (dönüş hedefiyle) açar ve true döner;
 * değilse false (çağıran doğrudan dokunulan eyleme / Ana sayfaya gider).
 */
export async function openOfferIfAllowed(
  nav: { navigate: (name: string, params?: object) => void },
  i: { userId: string | null | undefined; meta: Record<string, unknown> | null | undefined; returnTo: OfferReturn },
): Promise<boolean> {
  if (!(await offerAllowed(i.userId, i.meta))) return false;
  nav.navigate('KayitOffer', { returnTo: i.returnTo });
  return true;
}
