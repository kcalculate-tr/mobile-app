// G21-S1 md.8 (#D4): yeni kabukta çıkış / hesap silme sonrası yığın, oturumsuz soğuk
// açılışla AYNI ilk ekrana sıfırlanır (yeni_onboarding → Onboarding, değilse WelcomeGate).
// Önce Profil sekmesi oturumsuz kalıyor, üstüne Login itiliyordu; Login'den geri
// basınca boş/oturumsuz Profil'e dönülüyordu. Eski kabuk bu yardımcıyı çağırmaz (parite).
// G47-S1 md.2: `yeni_kayit` açıkken (kök yığında `Kayit` kayıtlı) hedef yeni onboarding 1. ekranı
// (`Kayit` · entry 'signedOut'); eski karşılama/onboarding o durumda kayıtlı değil.
import { navigationRef } from './navigationRef';

export type SignedOutRoute = 'Kayit' | 'Onboarding' | 'WelcomeGate';

export function signedOutRoute(yeniOnboarding: boolean, yeniKayit = false): SignedOutRoute {
  if (yeniKayit) return 'Kayit';
  return yeniOnboarding ? 'Onboarding' : 'WelcomeGate';
}

export function resetToSignedOut(yeniOnboarding: boolean): void {
  if (!navigationRef.isReady()) return;
  const root = navigationRef.getRootState?.() as { routeNames?: string[]; routes?: { name: string; params?: { entry?: string } }[] } | undefined;
  const yeniKayit = !!root?.routeNames?.includes('Kayit');
  const name = signedOutRoute(yeniOnboarding, yeniKayit);
  // Aynı sıfırlama iki kez (oturum dinleyicisi + çıkış düğmesi) yapılmasın: zaten tek başına oradaysa dokunma.
  const routes = root?.routes ?? [];
  if (routes.length === 1 && routes[0].name === name && (name !== 'Kayit' || routes[0].params?.entry === 'signedOut')) return;
  navigationRef.reset({
    index: 0,
    routes: [name === 'Kayit' ? { name: name as never, params: { entry: 'signedOut' } as never } : { name: name as never }],
  });
}
