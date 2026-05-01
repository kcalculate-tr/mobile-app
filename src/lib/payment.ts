import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { apiRequestJson, isApiBaseUrlConfigured } from './api';
import { supabase } from './supabase';

const SUPABASE_ANON_KEY = 'sb_publishable_tjeQHxsEgZIObTyf1UHz5Q_Bh4jqS29';

WebBrowser.maybeCompleteAuthSession();

const REQUEST_TIMEOUT_MS = 12000;

const toSafeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const readEnvValue = (key: string) =>
  toSafeString(
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[key] ??
      process.env[key],
  );

// GUVENLI FALLBACK: env okunamasa bile (EAS update / build cache / extra propagation
// bug) PayTR yolu varsayilan olarak aktif kalsin. Iframe akisi tek aktif provider.
const PAYMENT_PROVIDER_FALLBACK = 'paytr_iframe' as const;

const normalizePath = (value: string) => {
  const trimmed = toSafeString(value);
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const INIT_PATH = '/payment-init';
const VERIFY_PATH = '/payment-verify';
const PAYMENT_INIT_URL = 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/tosla-payment-init';

export type PaymentConfigStatus = {
  provider: string;
  isPaymentEnabled: boolean;
  isConfigured: boolean;
  missingKeys: string[];
  initPath: string;
  verifyPath: string;
  redirectUrl: string;
};

export type PaymentInitInput = {
  orderId: string;
  amount: number;
  currency?: 'TRY';
  customerEmail?: string;
  customerPhone?: string;
};

export type PaymentInitResult = {
  paymentUrl: string;
  paymentToken: string | null;
  redirectUrl: string;
};

export type PaymentVerifyInput = {
  orderId: string;
  callbackUrl?: string;
  paymentToken?: string | null;
};

export type PaymentVerifyResult = {
  paid: boolean;
  status: string;
  message: string;
};

let __paymentConfigLoggedOnce = false;

export const getPaymentConfigStatus = (): PaymentConfigStatus => {
  const fromExtra = toSafeString(
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.EXPO_PUBLIC_PAYMENT_PROVIDER,
  );
  const fromProcess = toSafeString(process.env.EXPO_PUBLIC_PAYMENT_PROVIDER);
  // Env okunabildiyse onu kullan; aksi halde guvenli fallback ('paytr_iframe').
  const rawProvider = fromExtra || fromProcess || PAYMENT_PROVIDER_FALLBACK;
  const provider = rawProvider.toLowerCase();

  const redirectUrl = Linking.createURL('payment-callback');
  const isPaymentEnabled = provider === 'tosla' || provider === 'paytr_iframe' || provider === 'paytr';

  const missingKeys: string[] = [];
  // PayTR iframe runs via dedicated edge function, not the legacy API base URL.
  if (provider === 'tosla' && !isApiBaseUrlConfigured()) {
    missingKeys.push('EXPO_PUBLIC_API_BASE_URL');
  }

  // Tek seferlik defansif log — production'da config sorunlarini tespit icin.
  if (!__paymentConfigLoggedOnce) {
    __paymentConfigLoggedOnce = true;
    console.log('[PAYMENT] config', {
      processEnv: fromProcess || null,
      constantsExtra: fromExtra || null,
      usedFallback: !fromExtra && !fromProcess,
      finalProvider: provider,
      isPaymentEnabled,
    });
  }

  return {
    provider,
    isPaymentEnabled,
    isConfigured: !isPaymentEnabled || missingKeys.length === 0,
    missingKeys,
    initPath: INIT_PATH,
    verifyPath: VERIFY_PATH,
    redirectUrl,
  };
};

export const mapPaymentErrorToMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return 'Ödeme işlemi sırasında bir sorun oluştu. Lütfen tekrar deneyin.';
  }

  const text = error.message.toLowerCase();
  if (text.includes('api_timeout')) {
    return 'Ödeme servisi zaman aşımına uğradı. Lütfen tekrar deneyin.';
  }
  if (text.includes('request_aborted')) {
    return 'Ödeme isteği iptal edildi.';
  }
  if (text.includes('network request failed') || text.includes('failed to fetch')) {
    return 'Ödeme servisine bağlanılamadı. İnternetinizi kontrol edip tekrar deneyin.';
  }
  if (text.includes('payment_cancelled')) {
    return 'Ödeme işlemi kullanıcı tarafından iptal edildi.';
  }
  if (text.includes('payment_dismissed')) {
    return 'Ödeme penceresi kapatıldı.';
  }
  return error.message || 'Ödeme işlemi tamamlanamadı.';
};

export const initPayment = async (
  orderId: string | number,
  amount: number,
): Promise<{ success: boolean; paymentUrl?: string; threeDSessionId?: string; error?: string }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Oturum bulunamadı' };

    const res = await fetch(PAYMENT_INIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        orderId: String(orderId),
        amount,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Network error');
      console.error('[Payment] Init failed:', errorText);
      return { success: false, error: 'Ödeme servisi ile bağlantı kurulamadı' };
    }

    const data = await res.json();

    if (!data.success || !data.threeDSessionId) {
      return { success: false, error: data.error ?? 'Ödeme başlatılamadı' };
    }

    return { success: true, threeDSessionId: data.threeDSessionId };
  } catch (err) {
    console.error('[Payment] Init error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Ödeme başlatılamadı';
    return { success: false, error: errorMessage };
  }
};

export async function openPaymentWebView(
  paymentUrl: string,
  onSuccess: (orderId: string) => void,
  onFail: () => void,
) {
  try {
    const result = await WebBrowser.openAuthSessionAsync(
      paymentUrl,
      'kcal://payment-callback',
    );

    if (result.type === 'cancel') {
      onFail();
    } else {
      onSuccess('');
    }
  } catch (error) {
    console.error('[Payment WebView] Error:', error);
    onFail();
  }
}

export const openPaymentSession = async ({
  paymentUrl,
  returnUrl,
}: {
  paymentUrl: string;
  returnUrl: string;
}) => {
  const result = await WebBrowser.openAuthSessionAsync(paymentUrl, returnUrl);

  if (result.type === 'cancel') {
    throw new Error('PAYMENT_CANCELLED');
  }
  if (result.type === 'dismiss') {
    throw new Error('PAYMENT_DISMISSED');
  }
  if (result.type !== 'success') {
    throw new Error('Ödeme tamamlanamadı.');
  }

  return {
    callbackUrl: toSafeString((result as { url?: string }).url) || returnUrl,
  };
};

export const verifyPayment = async ({
  orderId,
  callbackUrl,
}: PaymentVerifyInput): Promise<PaymentVerifyResult> => {
  const config = getPaymentConfigStatus();
  if (!config.isPaymentEnabled) {
    throw new Error('Ödeme özelliği kapalı.');
  }
  if (!config.isConfigured) {
    throw new Error('Ödeme yapılandırılmadı.');
  }

  // Callback URL'den status'u parse et (deep link: kcal://payment-callback?status=success)
  let status = 'unknown';
  if (callbackUrl) {
    try {
      const parsed = new URL(callbackUrl);
      status = parsed.searchParams.get('status') ?? 'unknown';
    } catch {
      // URL parse edilemezse status unknown kalır
    }
  }

  const { ok, data } = await apiRequestJson<Record<string, unknown>>({
    path: config.verifyPath,
    method: 'POST',
    body: { orderId: String(orderId), status },
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  if (!ok) {
    throw new Error(
      toSafeString(data.error) || toSafeString(data.message) || 'Ödeme doğrulaması başarısız oldu.',
    );
  }

  const paid = data.success === true;

  if (!paid) {
    throw new Error('Ödeme doğrulanamadı. Lütfen tekrar deneyin.');
  }

  return {
    paid: true,
    status: 'paid',
    message: 'Ödeme başarılı.',
  };
};
