// Kullanıcı adı seçimi hook'u — anında BİÇİM denetimi + gecikmeli (debounce)
// canlı müsaitlik kontrolü (`check_handle`, SALT OKUR — rezervasyon yapmaz).
// Gerçek rezervasyon yalnız kayıt akışının `submit()` adımında `claim_handle`
// ile olur (G6-CONTRACT.md). Bu hook hiçbir canlı ekrana bağlı değil; yalnız
// yeni kayıt akışı / __DEV__ ekranı.
import { useCallback, useEffect, useRef, useState } from 'react';

import { getProfilClient } from './client';
import { normalizeHandle, validateHandle, handleReasonI18nKey } from './handle';

export type HandleStatus =
  | 'idle'
  | 'invalid'
  | 'checking'
  | 'available'
  | 'taken'
  | 'error';

export interface UseHandleClaim {
  value: string;
  normalized: string;
  status: HandleStatus;
  /** 'invalid' durumunda i18n anahtarı (profil.*), aksi halde null. */
  messageKey: string | null;
  setValue: (next: string) => void;
}

const DEBOUNCE_MS = 450;

export function useHandleClaim(initial = ''): UseHandleClaim {
  const [value, setValueState] = useState(initial);
  const [status, setStatus] = useState<HandleStatus>('idle');
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Yarış koşulu koruması: yalnız en son isteğin sonucunu uygula.
  const reqId = useRef(0);

  const setValue = useCallback((next: string) => {
    setValueState(next);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const v = validateHandle(value);
    if (value.trim().length === 0) {
      setStatus('idle');
      setMessageKey(null);
      return;
    }
    if (!v.ok) {
      setStatus('invalid');
      setMessageKey(v.reason ? handleReasonI18nKey(v.reason) : 'profil.handle_invalid');
      return;
    }
    // Biçim geçerli → gecikmeli canlı kontrol.
    setStatus('checking');
    setMessageKey(null);
    const id = ++reqId.current;
    timer.current = setTimeout(() => {
      getProfilClient()
        .claimHandle({ handle: v.normalized })
        .then((res) => {
          if (id !== reqId.current) return; // eski istek — yok say
          if (res.ok) {
            setStatus('available');
            setMessageKey('profil.handle_available');
          } else {
            setStatus('taken');
            setMessageKey('profil.handle_taken');
          }
        })
        .catch(() => {
          if (id !== reqId.current) return;
          setStatus('error');
          setMessageKey(null);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  return { value, normalized: normalizeHandle(value), status, messageKey, setValue };
}
