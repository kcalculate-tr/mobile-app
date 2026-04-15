import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  visible: boolean;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
  });

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearHideTimeout();
    setToast((prev) => ({ ...prev, visible: false }));
  }, [clearHideTimeout]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', durationMs = 2600) => {
      const safeMessage = String(message || '').trim();
      if (!safeMessage) return;

      clearHideTimeout();

      setToast({
        visible: true,
        message: safeMessage,
        type,
      });

      if (durationMs > 0) {
        hideTimeoutRef.current = setTimeout(() => {
          hideToast();
        }, durationMs);
      }
    },
    [clearHideTimeout, hideToast],
  );

  useEffect(() => {
    return () => {
      clearHideTimeout();
    };
  }, [clearHideTimeout]);

  const value = useMemo(
    () => ({
      showToast,
      hideToast,
    }),
    [showToast, hideToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast.visible ? (
        <View
          pointerEvents="box-none"
          style={[styles.overlay, { bottom: Math.max(12, insets.bottom + 8) }]}
        >
          <Pressable
            style={[
              styles.toast,
              toast.type === 'success' && styles.toastSuccess,
              toast.type === 'error' && styles.toastError,
              toast.type === 'info' && styles.toastInfo,
            ]}
            onPress={hideToast}
          >
            <Text style={styles.toastText}>{toast.message}</Text>
          </Pressable>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast sadece ToastProvider içinde kullanılabilir.');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  toastText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  toastSuccess: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
  },
  toastError: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
  },
  toastInfo: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
});
