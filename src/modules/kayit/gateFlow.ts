// G47-S1 md.1/md.3 — Profil kapısının uygulama tarafı: kancalar ve akış sonu yönlendirmesi.
import { useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../core/AuthContext';
import { gateDecision, kayitRouteFor, refreshProfileStatus, setGateRuntime, useProfileGateStore, type GateTarget, type ProfileStatus } from './profileGate';

/** Kök (AppNavigator) — bağlamı depoya yazar, oturum değişince profil durumunu yeniler. */
export function useProfileGateHost(flag: boolean, kisiselPlan: boolean): void {
  const { user, session } = useAuth();
  const setCtx = useProfileGateStore((s) => s.setCtx);
  const setStatus = useProfileGateStore((s) => s.setStatus);
  // Yönlendirici eylemleri senkron okur → bağlam render sırasında (reaktif olmayan) çalışma nesnesine yazılır.
  setGateRuntime({ flag, kisiselPlan, session: !!session });
  useEffect(() => {
    setCtx({ flag, kisiselPlan, session: !!session });
  }, [flag, kisiselPlan, session, setCtx]);
  useEffect(() => {
    if (!flag || !user?.id) {
      setStatus(user?.id ?? null, 'unknown');
      return;
    }
    if (useProfileGateStore.getState().userId !== user.id) setStatus(user.id, 'unknown');
    void refreshProfileStatus(user.id);
  }, [flag, user?.id, setStatus]);
}

/** Ekran içi takip eylemleri için kapı. `require(target)`: kayıt akışına yönlendirdiyse true. */
export function useProfileGate(navigate: (name: string, params?: object) => void): {
  status: ProfileStatus;
  blocked: boolean;
  require: (target: GateTarget | null) => boolean;
} {
  const { user } = useAuth();
  const flag = useProfileGateStore((s) => s.flag);
  const kisiselPlan = useProfileGateStore((s) => s.kisiselPlan);
  const session = useProfileGateStore((s) => s.session);
  const status = useProfileGateStore((s) => (s.userId === (user?.id ?? null) ? s.status : 'unknown'));
  // Odakta sessiz yenileme (başka cihazda oluşturulmuş profil / akış sonrası).
  useFocusEffect(
    useCallback(() => {
      if (flag && user?.id) void refreshProfileStatus(user.id);
    }, [flag, user?.id]),
  );
  const blocked = gateDecision({ flag, kisiselPlan, session, status }) === 'kayit';
  const require = (target: GateTarget | null) => {
    if (!blocked) return false;
    const r = kayitRouteFor(kisiselPlan, 'gate', target);
    navigate(r.name, r.params);
    return true;
  };
  return { status, blocked, require };
}
