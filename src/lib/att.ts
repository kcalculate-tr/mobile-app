// G41-S1 md.1 — iOS App Tracking Transparency (ATT) tek giriş.
//
// KURAL (İlter 13 Kas): ATT sorusu uygulama açılışında ASLA sorulmaz. Yalnız:
//   • kayıt/giriş ekranındaki isteğe bağlı Meta kutusu işaretlendikten hemen sonra, bir kez;
//   • Profil › Gizlilik › "Meta reklam ölçümü" açılırken (yine kullanıcı eylemiyle);
//   • önceki sürümde Meta anahtarı açık olan mevcut kullanıcıya, bir sonraki açılışta TEK SEFER
//     bilgi kartındaki "Devam" düğmesinden sonra (AttNoticeCard).
// Okuma (`getAttStatus`) soru göstermez; yalnız `requestAttOnce` sorabilir ve o da durum
// 'undetermined' değilse sistemi çağırmaz (iOS zaten bir kez sorar).
//
// Yerel modül TEMBEL yüklenir: `expo-tracking-transparency` 6.x `requireNativeModule` kullanır
// ve modül derlemede yoksa (eski dev build / Android'de iOS çağrısı) içe aktarma anında
// fırlatır. Yoksa durum 'undetermined' okunur ve soru sorulamaz → Meta iOS'ta kapalı kalır.
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { toAttStatus, type AttStatus } from './metrics/consent';

type AttModule = {
  getTrackingPermissionsAsync: () => Promise<{ status: string }>;
  requestTrackingPermissionsAsync: () => Promise<{ status: string }>;
};

let cached: AttModule | null | undefined;
function attModule(): AttModule | null {
  if (cached !== undefined) return cached;
  try {
    // Önce yerel modül var mı (fırlatmadan) — yoksa paketi HİÇ yükleme: Metro, modül başlatma
    // hatasını try/catch'e rağmen LogBox'a "Uncaught Error" olarak düşürür (G41 vitrin çekiminde
    // görüldü: modülsüz eski dev build). Aynı koruma, bu modülü içermeyen eski 1.1.0 derlemesine
    // gelebilecek bir OTA'yı da güvenli tutar.
    if (!requireOptionalNativeModule('ExpoTrackingTransparency')) {
      cached = null;
      return cached;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-tracking-transparency') as AttModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** Testler için: modül önbelleğini sıfırla. */
export function __resetAttModuleForTests(): void {
  cached = undefined;
}

/** Mevcut ATT durumu — SORU GÖSTERMEZ. iOS dışı 'unavailable'. */
export async function getAttStatus(): Promise<AttStatus> {
  if (Platform.OS !== 'ios') return 'unavailable';
  const m = attModule();
  if (!m) return 'undetermined';
  try {
    const { status } = await m.getTrackingPermissionsAsync();
    return toAttStatus(Platform.OS, status);
  } catch {
    return 'undetermined';
  }
}

export type AttOutcome = { status: AttStatus; asked: boolean };

/**
 * ATT sorusu — YALNIZ kullanıcı eylemiyle çağrılır (kutu / Gizlilik satırı / bilgi kartı).
 * Durum zaten belirlenmişse sistem penceresi açılmaz, mevcut durum döner.
 */
export async function requestAttOnce(): Promise<AttOutcome> {
  if (Platform.OS !== 'ios') return { status: 'unavailable', asked: false };
  const m = attModule();
  if (!m) return { status: 'undetermined', asked: false };
  const cur = await getAttStatus();
  if (cur !== 'undetermined') return { status: cur, asked: false };
  try {
    const { status } = await m.requestTrackingPermissionsAsync();
    return { status: toAttStatus(Platform.OS, status), asked: true };
  } catch {
    return { status: 'undetermined', asked: false };
  }
}
