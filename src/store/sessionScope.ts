// G48-S1 md.1 — Oturuma bağlı yerel depolar (sepet + seçili adres) tek noktadan oturum sahibine çevrilir.
// AuthContext her oturum değişiminde (soğuk açılış, giriş, çıkış, süre dolması, hesap değişimi) çağırır.
// Depolar AsyncStorage'dan geç yüklenebilir: geçiş, yükleme bitince EN SON istenen sahiple uygulanır
// (yükleme önce biterse eski sahibin kaydı yeni kullanıcının üstüne yazılamaz).
// Vitrin (__DEV__) bellek içi depoya geçtiyse (storeSandbox) gerçek oturum vitrin sepetine dokunmaz.
import { useCartStore } from './cartStore';
import { useAddressStore } from './addressStore';
import { isStoreSandboxed } from './storeSandbox';

type Persisted = {
  persist?: {
    hasHydrated?: () => boolean;
    onFinishHydration?: (fn: () => void) => () => void;
  };
};

function whenHydrated(store: Persisted, fn: () => void): Promise<void> {
  const p = store.persist;
  if (!p?.hasHydrated || !p.onFinishHydration || p.hasHydrated()) {
    fn();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const unsub = p.onFinishHydration!(() => {
      unsub();
      fn();
      resolve();
    });
  });
}

let desired: string | null = null;

/** Oturum kullanıcısı (null = oturumsuz). Depolar hazır olunca çözülür. */
export function applySessionUser(userId: string | null): Promise<void> {
  if (isStoreSandboxed()) return Promise.resolve();
  desired = userId ?? null;
  return Promise.all([
    whenHydrated(useCartStore as unknown as Persisted, () => useCartStore.getState().switchOwner(desired)),
    whenHydrated(useAddressStore as unknown as Persisted, () => useAddressStore.getState().switchOwner(desired)),
  ]).then(() => undefined);
}

/** Hesap silindi: o hesabın cihazdaki sepeti ve seçili adresi silinir. */
export function forgetSessionUser(userId: string): void {
  useCartStore.getState().forgetOwner(userId);
  const a = useAddressStore.getState();
  if (a.ownerKey === userId) a.setSelectedAddress(null);
}
