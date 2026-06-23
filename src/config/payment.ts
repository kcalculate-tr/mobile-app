import Constants from 'expo-constants';

type PaymentProvider = 'tosla' | 'paytr_iframe' | 'paynkolay';

// GUVENLI FALLBACK: env okunamasa bile PayTR iframe yolu varsayilan.
// Bkz. src/lib/payment.ts PAYMENT_PROVIDER_FALLBACK ile aynidir.
const FALLBACK: PaymentProvider = 'paytr_iframe';

function readEnv(): string | undefined {
  const fromExtra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.EXPO_PUBLIC_PAYMENT_PROVIDER;
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  const fromProcess = process.env.EXPO_PUBLIC_PAYMENT_PROVIDER;
  if (typeof fromProcess === 'string' && fromProcess.trim()) return fromProcess.trim();
  return undefined;
}

function resolveProvider(): PaymentProvider {
  const raw = readEnv()?.toLowerCase();
  if (raw === 'paynkolay') return 'paynkolay';
  if (raw === 'paytr_iframe' || raw === 'paytr') return 'paytr_iframe';
  if (raw === 'tosla') return 'tosla';
  return FALLBACK;
}

export const PAYMENT_PROVIDER: PaymentProvider = resolveProvider();

export const PAYTR_INIT_URL =
  'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/paytr-payment-init';

export const PAYTR_OK_URL = 'https://eatkcal.com/payment/success';
export const PAYTR_FAIL_URL = 'https://eatkcal.com/payment/fail';

// Paynkolay hosted (Ortak Odeme) — init Edge Function + WebView baseUrl.
export const PAYNKOLAY_INIT_URL =
  'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/paynkolay-payment-init';
// PRODUCTION VPOS origin'i (formHtml form-POST baseUrl'i). Server PAYNKOLAY_VPOS_URL
// (https://paynkolay.nkolayislem.com.tr/Vpos) ile AYNI ortam — origin = scheme+host.
export const PAYNKOLAY_VPOS_ORIGIN = 'https://paynkolay.nkolayislem.com.tr';
