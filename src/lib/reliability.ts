/**
 * 🛡️ KCAL Reliability Layer
 * Apple-Grade Crash Prevention & Error Handling
 */

import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { Alert } from 'react-native';

/**
 * Network Connectivity Check
 * Kritik işlemlerden önce internet bağlantısını kontrol eder
 */
export async function checkNetworkConnection(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch (error) {
    console.warn('[Network Check] Error:', error);
    return false;
  }
}

/**
 * Network-Safe Wrapper
 * Async fonksiyonları internet kontrolü ile sarmallar
 */
export async function withNetworkCheck<T>(
  operation: () => Promise<T>,
  errorMessage = 'İnternet bağlantısı gerekiyor',
): Promise<T> {
  const isConnected = await checkNetworkConnection();
  
  if (!isConnected) {
    throw new Error(errorMessage);
  }
  
  return operation();
}

/**
 * Safe Async Wrapper
 * Tüm async işlemleri try/catch ile sarmallar ve kullanıcıya hata gösterir
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  options?: {
    fallbackValue?: T;
    errorMessage?: string;
    showAlert?: boolean;
    onError?: (error: Error) => void;
  },
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    
    console.error('[SafeAsync] Error:', err.message);
    
    if (options?.onError) {
      options.onError(err);
    }
    
    if (options?.showAlert) {
      Alert.alert(
        'Hata',
        options.errorMessage || err.message || 'Bir hata oluştu',
        [{ text: 'Tamam', style: 'default' }],
      );
    }
    
    return options?.fallbackValue;
  }
}

/**
 * AppState Listener
 * Uygulamanın background/foreground geçişlerini dinler
 */
export function setupAppStateListener(
  onForeground?: () => void,
  onBackground?: () => void,
): () => void {
  let previousState: AppStateStatus = AppState.currentState;

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    // Background → Foreground
    if (
      previousState.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      onForeground?.();
    }

    // Foreground → Background
    if (
      previousState === 'active' &&
      nextAppState.match(/inactive|background/)
    ) {
      onBackground?.();
    }

    previousState = nextAppState;
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    subscription.remove();
  };
}

/**
 * Retry Logic
 * Network hatalarında otomatik retry yapar
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.warn(`[Retry] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Timeout Wrapper
 * Async işlemlere timeout ekler
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs = 10000,
  timeoutMessage = 'İşlem zaman aşımına uğradı',
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs),
    ),
  ]);
}

/**
 * Global Error Handler
 * Unhandled promise rejections'ı yakalar
 */
export function setupGlobalErrorHandler() {
  // Unhandled promise rejections — React Native uses ErrorUtils (Hermes)
  const prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('[Unhandled Error]', isFatal ? '(fatal)' : '', error);
    if (!__DEV__) {
      // TODO: Send to Sentry/Crashlytics
    }
    prevHandler?.(error, isFatal);
  });

  return () => {
    ErrorUtils.setGlobalHandler(prevHandler);
  };
}

/**
 * Memory Leak Prevention
 * useEffect cleanup helper
 */
export function createCleanupTracker() {
  const cleanups: (() => void)[] = [];

  return {
    add: (cleanup: () => void) => cleanups.push(cleanup),
    cleanup: () => {
      cleanups.forEach(fn => {
        try {
          fn();
        } catch (error) {
          console.warn('[Cleanup] Error:', error);
        }
      });
      cleanups.length = 0;
    },
  };
}
