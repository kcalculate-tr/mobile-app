import Constants from 'expo-constants';

type PaymentProvider = 'tosla' | 'paytr_iframe' | 'paynkolay';

// 21.09.2026: PayTR ve Tosla ile calisma tamamen sona erdi — tek saglayici
// PaynKolay. Env degeri artik OKUNMUYOR; EAS/eas.json arasindaki
// EXPO_PUBLIC_PAYMENT_PROVIDER celiskisi build'i PayTR'ye dusuremez.
// 23.09.2026: PaymentScreen'deki PayTR/Tosla akislari ve PAYTR_* URL'leri
// silindi. CheckoutScreen'deki inline kart formu + 3DS modali hala duruyor
// (webViewHtml state'ine bagli); o temizlik ayri bir is olarak bekliyor.
const FALLBACK: PaymentProvider = 'paynkolay';

function readEnv(): string | undefined {
  const fromExtra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.EXPO_PUBLIC_PAYMENT_PROVIDER;
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  const fromProcess = process.env.EXPO_PUBLIC_PAYMENT_PROVIDER;
  if (typeof fromProcess === 'string' && fromProcess.trim()) return fromProcess.trim();
  return undefined;
}

function resolveProvider(): PaymentProvider {
  // Env bilerek yok sayiliyor: saglayici tek ve sabit.
  void readEnv;
  return FALLBACK;
}

export const PAYMENT_PROVIDER: PaymentProvider = resolveProvider();

// Paynkolay hosted (Ortak Odeme) — init Edge Function + WebView baseUrl.
export const PAYNKOLAY_INIT_URL =
  'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/paynkolay-payment-init';
// PRODUCTION VPOS origin'i (formHtml form-POST baseUrl'i). Server PAYNKOLAY_VPOS_URL
// (https://paynkolay.nkolayislem.com.tr/Vpos) ile AYNI ortam — origin = scheme+host.
export const PAYNKOLAY_VPOS_ORIGIN = 'https://paynkolay.nkolayislem.com.tr';
