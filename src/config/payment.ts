import Constants from 'expo-constants';

type PaymentProvider = 'tosla' | 'paytr_iframe';

const FALLBACK: PaymentProvider = 'tosla';

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
  if (raw === 'paytr_iframe' || raw === 'paytr') return 'paytr_iframe';
  if (raw === 'tosla') return 'tosla';
  return FALLBACK;
}

export const PAYMENT_PROVIDER: PaymentProvider = resolveProvider();

export const PAYTR_INIT_URL =
  'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/paytr-payment-init';

export const PAYTR_OK_URL = 'https://eatkcal.com/payment/success';
export const PAYTR_FAIL_URL = 'https://eatkcal.com/payment/fail';
