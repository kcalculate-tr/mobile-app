// G28-S1 md.5 — inceleme hesabı şifreyle giriş (giriş ekranları ortak mantığı).
// Yalnız `isReviewEmail(email)` iken etkin; şifre yalnız bellekte (kaydedilmez, loglanmaz).
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../core/AuthContext';
import { isReviewEmail, reviewEmailOf } from './reviewLogin';

export function useReviewPasswordLogin(email: string) {
  const { signIn } = useAuth();
  const active = isReviewEmail(email);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Adres değişip inceleme adresi olmaktan çıkınca şifre bellekten silinir.
  useEffect(() => {
    if (!active) {
      setPassword('');
      setFailed(false);
    }
  }, [active]);

  /** true → oturum açıldı (çağıran normal giriş sonrası akışa geçer). */
  const submit = useCallback(async (): Promise<boolean> => {
    if (!active || busy || !password) return false;
    setBusy(true);
    setFailed(false);
    const { error } = await signIn(reviewEmailOf(email), password);
    setBusy(false);
    if (error) {
      setFailed(true);
      return false;
    }
    setPassword('');
    return true;
  }, [active, busy, password, email, signIn]);

  return {
    active,
    password,
    setPassword: (v: string) => {
      setPassword(v);
      if (failed) setFailed(false);
    },
    busy,
    failed,
    submit,
  };
}
