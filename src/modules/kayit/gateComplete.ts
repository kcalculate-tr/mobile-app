// G47-S1 md.3 — Kayıt akışı sonu: kullanıcı dokunduğu eyleme döner. (navigationRef yalnız burada; Ana sayfa
// bileşen testleri gezinme modülünü kısmi taklit ettiği için kancalardan ayrı dosya.)
import { navigationRef } from '../../navigation/navigationRef';
import { useKayitFlow, type GateTarget } from './profileGate';
import { completionRoutes } from './gateLogic';

export { completionRoutes };

/** Kayıt akışı (A ya da kısa profil) bitti → kullanıcı dokunduğu eyleme döner (ör. Tara açılır). */
export function completeGateFlow(returnTo: GateTarget | null): void {
  useKayitFlow.getState().setFlow({ origin: 'onb', returnTo: null, method: null, fresh: false });
  if (!navigationRef.isReady()) return;
  const { reset, then } = completionRoutes(returnTo);
  navigationRef.reset({ index: reset.length - 1, routes: reset.map((r) => ({ name: r.name as never, params: r.params as never })) });
  if (then) {
    requestAnimationFrame(() => {
      if (navigationRef.isReady()) (navigationRef.navigate as (n: string, p?: object) => void)(then.name, then.params);
    });
  }
}

