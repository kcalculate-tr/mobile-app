// G47-S1 md.3/md.4 — Kök yığın yönlendirici katmanı (React Navigation `UNSTABLE_router`).
// Takip rotalarına giden her navigate/push/replace eylemi, `yeni_kayit` açık ve hesapta profil yokken
// doğrudan kayıt akışına çevrilir (önce uyarı sayfası yok); oturum yoksa giriş katmanı (AuthSheet) açılır.
// Eski kupa görselli "Takibe başla" (`TakibeBasla`) bayrak açıkken hiçbir yerden açılmaz: profil varsa mevcut
// düzenleme ekranına (kişisel plan → Kişisel planım; değilse hedef düzenleme), yoksa yeni kayıt akışına gider.
// Bayrak kapalıyken hiçbir eylem değişmez (bugünkü davranış).
import type { Router } from '@react-navigation/native';
import { gateCtx } from '../modules/kayit/profileGate';
import { redirectGateAction, type AnyAction } from '../modules/kayit/gateLogic';

export { redirectGateAction };

/** `Stack.Navigator UNSTABLE_router` — modül düzeyinde sabit (her render'da yeni yönlendirici kurulmaz). */
export function gateRouterOverride<S extends { routeNames: string[] }, A extends { type: string }>(original: Router<any, any>): Partial<Router<any, any>> {
  return {
    getStateForAction(state: S, action: A, options: unknown) {
      const r = redirectGateAction(action as unknown as AnyAction, gateCtx());
      const target = r?.payload?.name;
      const use = r && target && state.routeNames.includes(target) ? r : action;
      return (original.getStateForAction as (s: S, a: unknown, o: unknown) => unknown)(state, use, options) as never;
    },
  };
}
