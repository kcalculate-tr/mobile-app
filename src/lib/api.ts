import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { CouponValidationResult } from '../types';

const REQUEST_TIMEOUT_MS = 12000;

const toSafeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export const getApiBaseUrl = () => {
  const fromConfig = toSafeString(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL,
  );
  const fromEnv = toSafeString(process.env.EXPO_PUBLIC_API_BASE_URL);
  return fromConfig || fromEnv;
};

export const isApiBaseUrlConfigured = () => Boolean(getApiBaseUrl());

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const joinBaseAndPath = (baseUrl: string, path: string) => {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

export const resolveApiUrl = (pathOrUrl: string) => {
  const trimmed = toSafeString(pathOrUrl);
  if (!trimmed) {
    throw new Error('API path gerekli.');
  }

  if (isAbsoluteHttpUrl(trimmed)) {
    return trimmed;
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error('API base URL yapılandırması eksik.');
  }

  return joinBaseAndPath(baseUrl, trimmed);
};

const attachAbortListener = (
  externalSignal: AbortSignal | null | undefined,
  internalAbort: () => void,
) => {
  if (!externalSignal) {
    return () => undefined;
  }

  if (externalSignal.aborted) {
    internalAbort();
    return () => undefined;
  }

  externalSignal.addEventListener('abort', internalAbort);
  return () => {
    externalSignal.removeEventListener('abort', internalAbort);
  };
};

const fetchJsonWithTimeout = async (
  url: string,
  init: RequestInit & { timeoutMs?: number },
) => {
  const timeoutMs = Number(init.timeoutMs || REQUEST_TIMEOUT_MS);
  const timeoutController = new AbortController();
  let didTimeout = false;

  const detachAbortListener = attachAbortListener(init.signal, () => {
    timeoutController.abort();
  });

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    timeoutController.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: timeoutController.signal,
    });

    const rawText = await response.text();
    let payload: Record<string, unknown> = {};

    if (rawText) {
      try {
        payload = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        throw new Error('API_INVALID_JSON');
      }
    }

    return { response, payload };
  } catch (error: unknown) {
    if (didTimeout) {
      throw new Error('API_TIMEOUT');
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('REQUEST_ABORTED');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    detachAbortListener();
  }
};

type ApiRequestJsonOptions = {
  path?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type ApiJsonResponse<T> = {
  ok: boolean;
  status: number;
  data: T;
};

export const apiRequestJson = async <T = Record<string, unknown>>({
  path,
  url,
  method = 'GET',
  headers,
  body,
  signal,
  timeoutMs = REQUEST_TIMEOUT_MS,
}: ApiRequestJsonOptions): Promise<ApiJsonResponse<T>> => {
  const target = url ? resolveApiUrl(url) : resolveApiUrl(path || '');
  const hasBody = body !== undefined && body !== null;

  const requestHeaders: Record<string, string> = {
    ...(headers || {}),
  };

  if (hasBody && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const { response, payload } = await fetchJsonWithTimeout(target, {
    method,
    headers: requestHeaders,
    body: hasBody ? JSON.stringify(body) : undefined,
    signal,
    timeoutMs,
  });

  return {
    ok: response.ok,
    status: response.status,
    data: payload as T,
  };
};

const mapCouponErrorToUserMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return 'Kupon doğrulaması şu anda yapılamıyor.';
  }

  if (error.message === 'API_TIMEOUT') {
    return 'Kupon servisi zaman aşımına uğradı. Lütfen tekrar deneyin.';
  }

  if (error.message === 'API_INVALID_JSON') {
    return 'Kupon servisi geçersiz yanıt verdi. Lütfen daha sonra tekrar deneyin.';
  }

  if (error.message === 'REQUEST_ABORTED') {
    return 'Kupon doğrulama isteği iptal edildi.';
  }

  const lowered = error.message.toLowerCase();
  if (
    lowered.includes('network request failed') ||
    lowered.includes('failed to fetch')
  ) {
    if (Platform.OS === 'android') {
      return 'Kupon servisine erişilemiyor. Android ağ/CORS kısıtı olabilir.';
    }
    return 'Kupon servisine bağlanılamadı. İnternetinizi kontrol edip tekrar deneyin.';
  }

  if (lowered.includes('cors')) {
    return 'Kupon servisine erişim kısıtlandı (CORS). Lütfen daha sonra tekrar deneyin.';
  }

  return error.message || 'Kupon doğrulaması şu anda yapılamıyor.';
};

export const validateCoupon = async ({
  code,
  cartSubtotal,
  signal,
}: {
  code: string;
  cartSubtotal: number;
  signal?: AbortSignal;
}): Promise<CouponValidationResult> => {
  if (!isApiBaseUrlConfigured()) {
    throw new Error('Kupon servisi yapılandırması eksik.');
  }

  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) {
    throw new Error('Kupon kodu gerekli.');
  }

  try {
    const { ok, data } = await apiRequestJson<CouponValidationResult>({
      path: '/api/validate-coupon',
      method: 'POST',
      body: {
        code: normalizedCode,
        cart_subtotal: Number(cartSubtotal || 0),
      },
      signal,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    if (!ok) {
      const backendMessage = toSafeString(data.message);
      throw new Error(backendMessage || 'Kupon doğrulaması başarısız.');
    }

    return {
      valid: Boolean(data.valid),
      message: toSafeString(data.message) || undefined,
      discountAmount: Number(data.discountAmount || 0),
      campaign:
        data.campaign && typeof data.campaign === 'object'
          ? (data.campaign as CouponValidationResult['campaign'])
          : null,
    };
  } catch (error: unknown) {
    throw new Error(mapCouponErrorToUserMessage(error));
  }
};
