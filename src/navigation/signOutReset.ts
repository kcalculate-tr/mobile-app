// G21-S1 md.8 (#D4): yeni kabukta çıkış / hesap silme sonrası yığın, oturumsuz soğuk
// açılışla AYNI ilk ekrana sıfırlanır (yeni_onboarding → Onboarding, değilse WelcomeGate).
// Önce Profil sekmesi oturumsuz kalıyor, üstüne Login itiliyordu; Login'den geri
// basınca boş/oturumsuz Profil'e dönülüyordu. Eski kabuk bu yardımcıyı çağırmaz (parite).
import { navigationRef } from './navigationRef';

export function signedOutRoute(yeniOnboarding: boolean): 'Onboarding' | 'WelcomeGate' {
  return yeniOnboarding ? 'Onboarding' : 'WelcomeGate';
}

export function resetToSignedOut(yeniOnboarding: boolean): void {
  if (!navigationRef.isReady()) return;
  navigationRef.reset({ index: 0, routes: [{ name: signedOutRoute(yeniOnboarding) as never }] });
}
