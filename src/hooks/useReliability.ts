/**
 * 🛡️ useReliability Hook
 * Kritik işlemler için network check, timeout ve error handling
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useToast } from '../context/ToastContext';

interface UseReliabilityOptions {
  enableNetworkCheck?: boolean;
  enableAppStateTracking?: boolean;
  onForeground?: () => void;
  onBackground?: () => void;
}

export function useReliability(options: UseReliabilityOptions = {}) {
  const {
    enableNetworkCheck = true,
    enableAppStateTracking = false,
    onForeground,
    onBackground,
  } = options;

  const { showToast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const appState = useRef(AppState.currentState);
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!enableNetworkCheck) return;

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    cleanupRef.current.push(unsubscribe);

    return () => {
      cleanupRef.current.forEach(cleanup => cleanup());
      cleanupRef.current = [];
    };
  }, [enableNetworkCheck]);

  useEffect(() => {
    if (!enableAppStateTracking) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        onForeground?.();
      }

      if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        onBackground?.();
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    cleanupRef.current.push(() => subscription.remove());

    return () => {
      cleanupRef.current.forEach(cleanup => cleanup());
      cleanupRef.current = [];
    };
  }, [enableAppStateTracking, onForeground, onBackground]);

  const safeAsync = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      options?: {
        requireNetwork?: boolean;
        timeoutMs?: number;
        errorMessage?: string;
        showErrorToast?: boolean;
      },
    ): Promise<{ data?: T; error?: string }> => {
      try {
        if (options?.requireNetwork && !isOnline) {
          const errorMsg = 'İnternet bağlantısı gerekiyor';
          if (options.showErrorToast) {
            showToast(errorMsg, 'error');
          }
          return { error: errorMsg };
        }

        const timeoutMs = options?.timeoutMs ?? 15000;
        
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('İşlem zaman aşımına uğradı')), timeoutMs),
          ),
        ]);

        return { data: result };
      } catch (error) {
        const errorMsg = options?.errorMessage || 
          (error instanceof Error ? error.message : 'Bir hata oluştu');
        
        console.error('[SafeAsync] Error:', errorMsg);

        if (options?.showErrorToast) {
          showToast(errorMsg, 'error');
        }

        return { error: errorMsg };
      }
    },
    [isOnline, showToast],
  );

  return {
    isOnline,
    safeAsync,
  };
}
