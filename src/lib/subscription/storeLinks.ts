// G25-S1 md.2 / md.6 — mağaza bağlantıları (tek kaynak, SAF: RN importu yok → tsx --test).
//  • EULA (A2, 3.1.2): iOS → Apple standart EULA; Android → uygulamadaki Kullanım Koşulları sayfası.
//  • Aboneliği yönet (A9, hesap silme uyarısı): iOS App Store abonelikleri; Android Play abonelikler
//    derin bağlantısı (paket adıyla → doğrudan uygulamanın aboneliği).

export const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const ANDROID_PACKAGE = 'com.kcalmobile.app';
export const MANAGE_SUB_URL_IOS = 'https://apps.apple.com/account/subscriptions';
export const MANAGE_SUB_URL_ANDROID = `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`;

export type EulaTarget = { kind: 'url'; url: string } | { kind: 'terms' };

/** "Kullanım Koşulları (EULA)" nereye gider: iOS Apple EULA (tarayıcı), Android uygulama içi Koşullar. */
export function eulaTarget(os: string): EulaTarget {
  return os === 'ios' ? { kind: 'url', url: APPLE_EULA_URL } : { kind: 'terms' };
}

/** Mağazanın abonelik yönetimi adresi (iOS App Store, diğerleri Google Play). */
export function manageSubUrl(os: string): string {
  return os === 'ios' ? MANAGE_SUB_URL_IOS : MANAGE_SUB_URL_ANDROID;
}
