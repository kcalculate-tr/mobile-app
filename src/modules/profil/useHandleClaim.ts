// Kullanıcı adı seçimi hook'u — anında BİÇİM denetimi + gecikmeli (debounce)
// canlı müsaitlik kontrolü. Benzersizlik SUNUCUDA. Bu hook hiçbir canlı ekrana
// bağlı değil; yalnız yeni kayıt akışı / __DEV__ ekranı.
//
// G6: canlı kontrol SALT OKUR `check_handle` ile yapılır (rezerve etmez); nihai
// sahiplenme yalnız kayıt akışının `submit()` adımında `claim_handle` ile olur
// (idempotent, G6-CONTRACT.md). Böylece debounce'lu her duraklama gereksiz
// rezervasyon yapmaz.
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
      // Rezerve adlar için ayrı mesaj (G11-S4 madde 6): handle.ts (S1) 'reserved'ı
      // handle_taken'a eşliyor; burada ayrımı koruyup "ayrılmış" mesajını veriyoruz.
      if (v.reason === 'reserved') {
        setMessageKey('profil.handle_reserved');
      } else {
        setMessageKey(v.reason ? handleReasonI18nKey(v.reason) : 'profil.handle_invalid');
      }
      return;
    }
    // Biçim geçerli → gecikmeli canlı kontrol.
    setStatus('checking');
    setMessageKey(null);
    const id = ++reqId.current;
    timer.current = setTimeout(() => {
      getProfilClient()
        .checkHandle({ handle: v.normalized })
        .then((res) => {
          if (id !== reqId.current) return; // eski istek — yok say
          if (res.available) {
            setStatus('available');
            setMessageKey('profil.handle_available');
          } else {
            setStatus('taken');
            // Sunucu ayrılmış adı 'reserved' ile ayırır → farklı mesaj.
            setMessageKey(res.reason === 'reserved' ? 'profil.handle_reserved' : 'profil.handle_taken');
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
