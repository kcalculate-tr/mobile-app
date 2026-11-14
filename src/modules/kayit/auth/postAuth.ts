// G47-S1 md.1 — Giriş katmanı (AuthSheet / E1–E2 giriş kipi) başarılı olunca nereye gidilir.
//  · Sipariş akışından gelen giriş (redirectTo Checkout/Addresses) → o ekran (eatkcal serbest).
//  · Uygulama içinde bir ekranın üstünden açıldıysa (sepet, gönderi, profil kartı…) → katman kapanır, kullanıcı kaldığı
//    yerde devam eder (takip eylemlerinde profil kapısı ayrıca çalışır).
//  · Onboarding / kayıt yığını / sekme kökünden: profil VARSA Ana sayfa; YOKSA kayıt akışı (P1'den, K1 atlanır).
import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../core/AuthContext';
import { navigationRef } from '../../../navigation/navigationRef';
import { gateCtx, isFreshAccount, kayitRouteFor, refreshProfileStatus, useKayitFlow, type AuthMethod } from '../profileGate';
import { postAuthTarget, type PostAuth } from '../gateLogic';

export { ENTRY_ROUTES, postAuthTarget, type PostAuth } from '../gateLogic';

type Nav = {
  getState: () => { index: number; routes: { name: string }[] } | undefined;
  replace: (name: string, params?: object) => void;
  goBack: () => void;
};

export async function routeAfterAuth(navigation: Nav, i: { userId: string; method: AuthMethod; fresh: boolean; redirectTo?: string }): Promise<PostAuth> {
  const st = navigation.getState();
  const below = st && st.index > 0 ? st.routes[st.index - 1]?.name : undefined;
  const status = i.redirectTo ? 'unknown' : await refreshProfileStatus(i.userId);
  const target = postAuthTarget({ redirectTo: i.redirectTo, below, status });
  if (target === 'redirect') {
    navigation.replace(i.redirectTo as string);
    return target;
  }
  if (target === 'back') {
    navigation.goBack();
    return target;
  }
  if (!navigationRef.isReady()) return target;
  const home = { name: 'Tabs' as never, params: { screen: 'Tracker' } as never };
  if (target === 'home') {
    navigationRef.reset({ index: 0, routes: [home] });
    return target;
  }
  useKayitFlow.getState().setFlow({ origin: 'auth', method: i.method, fresh: i.fresh, returnTo: null });
  const r = kayitRouteFor(gateCtx().kisiselPlan, 'auth', null);
  navigationRef.reset({ index: 1, routes: [home, { name: r.name as never, params: r.params as never }] });
  return target;
}

/**
 * Giriş başarılı olunca (sosyal girişte oturum async gelir) bir kez yönlendir.
 * Dönüş: `mark(method, newUser?)` — oturum açma isteğinden ÖNCE çağrılır.
 */
export function useAuthSuccess(redirectTo?: string): (method: AuthMethod, newUser?: boolean) => void {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const pending = useRef<{ method: AuthMethod; newUser?: boolean } | null>(null);
  const done = useRef(false);
  const created = useRef<string | undefined>(undefined);
  created.current = (user as { created_at?: string } | null)?.created_at;
  useEffect(() => {
    if (!user?.id || !pending.current || done.current) return;
    done.current = true;
    const { method, newUser } = pending.current;
    void routeAfterAuth(navigation, { userId: user.id, method, fresh: !!newUser || isFreshAccount(created.current), redirectTo });
  }, [user?.id, navigation, redirectTo]);
  return (method, newUser) => {
    pending.current = { method, newUser };
  };
}
