import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Sentry — hata/çökme izleme.
 *
 * 23.09.2026'ya kadar hiçbir izleme yoktu: bir müşterinin telefonunda
 * uygulama çöküyorsa bunu ancak o müşteri bize yazarsa öğreniyorduk.
 *
 * DSN `EXPO_PUBLIC_SENTRY_DSN` ile geliyor. DSN YOKSA Sentry hiç
 * başlatılmaz ve buradaki tüm fonksiyonlar sessizce no-op olur —
 * yapılandırma eksikse uygulama çalışmaya devam eder (fail-open).
 *
 * Kaynak haritası yüklemesi app.config.js'teki @sentry/react-native/expo
 * eklentisiyle, SENTRY_ORG + SENTRY_PROJECT + SENTRY_AUTH_TOKEN varsa yapılır.
 */

function readDsn(): string | undefined {
  const fromExtra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.EXPO_PUBLIC_SENTRY_DSN;
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  // expo/no-dynamic-env-var: anahtar SABİT yazılmak zorunda — Metro build
  // zamanında değiştiriyor, dinamik erişim derlenmiş pakette boş kalır.
  const fromProcess = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (typeof fromProcess === 'string' && fromProcess.trim()) return fromProcess.trim();
  return undefined;
}

const DSN = readDsn();

let baslatildi = false;

export function initSentry(): void {
  if (baslatildi || !DSN) return;
  baslatildi = true;
  Sentry.init({
    dsn: DSN,
    // __DEV__'de olay GÖNDERİLMEZ; yerelde zaten konsol var ve kotayı yakar.
    enabled: !__DEV__,
    // Sürüm eşleşmesi: app.config.js version + native build numarası.
    release: `kcal-mobile@${Constants.expoConfig?.version ?? 'bilinmiyor'}`,
    dist: String(
      Constants.expoConfig?.ios?.buildNumber ??
        Constants.expoConfig?.android?.versionCode ??
        '0',
    ),
    // Performans örneklemesi düşük başlasın; açılış süresi ölçümü için yeter.
    tracesSampleRate: 0.1,
    // Kişisel veri GÖNDERİLMEZ. E-posta/telefon/adres/beslenme verisi
    // Sentry'ye gitmemeli — Meta SDK'sında da aynı kural uygulanıyor.
    sendDefaultPii: false,
  });
}

export function sentryHazir(): boolean {
  return baslatildi;
}

/** Yakalanmış ama yutulmaması gereken hatalar için. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!baslatildi) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Kullanıcı kimliği — e-posta/telefon DEĞİL, yalnız uuid. */
export function setSentryUser(userId: string | null): void {
  if (!baslatildi) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

export { Sentry };
