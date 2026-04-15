import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

export function useToast() {
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false, message: '', type: 'success',
  });

  const show = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

  const hide = useCallback(() => {
    setToast(t => ({ ...t, visible: false }));
  }, []);

  return { toast, show, hide };
}
