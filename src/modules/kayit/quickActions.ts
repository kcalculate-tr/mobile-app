// G49-S1 md.3 — profilsiz Ana sayfa "Neler yapabilirsin" eylemlerinin SAF yönlendirme kuralı (RN importu YOK →
// node:test). Uygulama tarafı TrackerScreen'de bağımlılıkları verir.
//  · Takip eylemleri (Tara, Etkinlik, Koç) G47 profil kapısından geçer: `require(hedef)` kayıt akışına yönlendirdiyse
//    dur (akış bitince dokunulan eyleme dönülür — hedef = returnTo); değilse eylemi doğrudan aç.
//  · Paylaş Keşfet kuralıyla: oturum yoksa giriş katmanı (AuthSheet = `Login`); `kesfet_paylasim` açıksa gönderi
//    oluşturma (Composer), kapalıysa Keşfet sekmesi. Profil kapısına takılmaz.
import type { GateTarget } from './gateLogic';

export type QuickAction = 'scan' | 'activity' | 'share' | 'coach';

export interface QuickDeps {
  /** useProfileGate().require — kayıt akışına yönlendirdiyse true. */
  require: (target: GateTarget | null) => boolean;
  /** Akış sonu dönüş hedefleri (dokunulan eylem). */
  targets: { scan: GateTarget; activity: GateTarget; coach: GateTarget };
  startScan: () => void;
  openActivity: () => void;
  openCoach: () => void;
  signedIn: boolean;
  openLogin: () => void;
  /** null → `kesfet_paylasim` kapalı (Keşfet sekmesi açılır). */
  openComposer: (() => void) | null;
  openKesfet: () => void;
}

export type QuickOutcome = 'kayit' | 'scan' | 'activity' | 'coach' | 'login' | 'composer' | 'kesfet';

export function runQuickAction(a: QuickAction, d: QuickDeps): QuickOutcome {
  if (a === 'share') {
    if (!d.signedIn) {
      d.openLogin();
      return 'login';
    }
    if (d.openComposer) {
      d.openComposer();
      return 'composer';
    }
    d.openKesfet();
    return 'kesfet';
  }
  if (d.require(d.targets[a])) return 'kayit';
  if (a === 'scan') d.startScan();
  else if (a === 'activity') d.openActivity();
  else d.openCoach();
  return a;
}
