// G46-S1 md.3 — T1 kayıt teklifi "bir kez" işareti (cihaz + hesap). Kapatma onayı metni ("bu ekrandan çıkarsan
// bir daha karşına çıkmaz") bu işarete dayanır: T1 açıldığı anda hem cihaza (AsyncStorage) hem hesaba
// (`auth.updateUser({ data: { kayit_offer_shown_at } })` → user_metadata; şema değişikliği yok) yazılır.
// Kayıt sonrası yönlendirme `shouldShowOffer` ile ikisine de bakar. Ana paywall bundan etkilenmez.
import { getSupabaseClient } from '../../core/supabase';
import { OFFER_META_KEY, accountOfferShown, isOfferShownOnDevice, markOfferShownOnDevice, shouldShowOffer } from './storage';
import { kv } from './store';
import type { KPath } from './model';

/** Kayıt bitince: T1'e mi (true) yoksa doğrudan ana sayfaya mı. */
export async function offerAllowed(path: KPath, userMeta: Record<string, unknown> | null | undefined): Promise<boolean> {
  if (path !== 'a') return false;
  const device = await isOfferShownOnDevice(kv);
  return shouldShowOffer({ path, device, account: accountOfferShown(userMeta) });
}

/** T1 göründü: cihaza ve hesaba işaretle (hesap yazımı başarısızsa cihaz işareti yine korur). */
export async function markOfferShown(now: number = Date.now()): Promise<void> {
  await markOfferShownOnDevice(kv, now);
  try {
    await getSupabaseClient().auth.updateUser({ data: { [OFFER_META_KEY]: new Date(now).toISOString() } });
  } catch {
    /* çevrimdışı vb. — cihaz işareti yeterli */
  }
}
