// G47-S1 md.3/md.4/md.5 — Profil kapısı (takip için kayıt şart). Yalnız `yeni_kayit` açıkken etkili.
// "Profil var" = `user_nutrition_profiles` satırında günlük kalori hedefi dolu (target_calories ya da
// custom_calories > 0) ya da `personal_plan` dolu. Sorgu başarısız / bilinmiyorsa kapı AÇIK kalır
// (profili olan eski kullanıcı hiçbir değişiklik görmez — md.5).
//
// Kapı iki yerden uygulanır:
//  · Kök yığın yönlendiricisi (navigation/gateRouter.ts): takip ROTALARINA (Tara, Koç, ilerleme…) giden her
//    navigate/push/replace, profil yoksa doğrudan kayıt akışına çevrilir (çağrı noktası fark etmez).
//  · Ekran içi eylemler (Elle gir, su, öğün kaydı — Ana sayfa): `useProfileGate().require(target)`.
// Akış bitince kullanıcı dokunduğu eyleme döner (`returnTo`).
import { create } from 'zustand';
import { getSupabaseClient } from '../../core/supabase';

export {
  GOAL_ROUTES,
  TRACK_ROUTES,
  gateDecision,
  isFreshAccount,
  kayitRouteFor,
  rowHasProfile,
} from './gateLogic';
export type { AuthMethod, GateCtx, GateDecision, GateOrigin, GateTarget, ProfileStatus } from './gateLogic';
import { rowHasProfile, type AuthMethod, type GateCtx, type GateOrigin, type GateTarget, type ProfileStatus } from './gateLogic';

interface GateState extends GateCtx {
  userId: string | null;
  setCtx: (p: Partial<Pick<GateState, 'flag' | 'kisiselPlan' | 'session'>>) => void;
  setStatus: (userId: string | null, status: ProfileStatus) => void;
}

export const useProfileGateStore = create<GateState>((set) => ({
  flag: false,
  kisiselPlan: false,
  session: false,
  status: 'unknown',
  userId: null,
  setCtx: (p) => set(p),
  setStatus: (userId, status) => set({ userId, status }),
}));

/** Yönlendiricinin senkron okuduğu bağlam (AppNavigator render'ında yazılır; reaktif değil). */
const runtime: Pick<GateCtx, 'flag' | 'kisiselPlan' | 'session'> = { flag: false, kisiselPlan: false, session: false };
export function setGateRuntime(p: Pick<GateCtx, 'flag' | 'kisiselPlan' | 'session'>): void {
  runtime.flag = p.flag;
  runtime.kisiselPlan = p.kisiselPlan;
  runtime.session = p.session;
}

export function gateCtx(): GateCtx {
  const s = useProfileGateStore.getState();
  return { ...runtime, status: s.status };
}

/** Sunucudan profil durumu. Hata → 'unknown' (kapı açık). */
export async function fetchProfileStatus(userId: string): Promise<ProfileStatus> {
  try {
    const { data, error } = await getSupabaseClient().from('user_nutrition_profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error) return 'unknown';
    return rowHasProfile(data as Record<string, unknown> | null) ? 'has' : 'none';
  } catch {
    return 'unknown';
  }
}

let inflight: Promise<ProfileStatus> | null = null;
/** markProfileCreated sayacı: kaydetmeden önce başlamış bir sorgunun 'none' sonucu yeni 'has'ı ezmesin. */
let markSeq = 0;
/** Durumu yenile ve depoya yaz. Bilinen 'has' bilgisi hata ile 'unknown'a düşürülmez. */
export async function refreshProfileStatus(userId: string): Promise<ProfileStatus> {
  const seq = markSeq;
  if (!inflight) {
    inflight = fetchProfileStatus(userId).finally(() => {
      inflight = null;
    });
  }
  const st = await inflight;
  const cur = useProfileGateStore.getState();
  if (st === 'unknown' && cur.userId === userId && cur.status !== 'unknown') return cur.status;
  if (st === 'none' && seq !== markSeq && cur.userId === userId && cur.status === 'has') return 'has';
  useProfileGateStore.getState().setStatus(userId, st);
  return st;
}

/** Kayıt akışı planı / kısa profili kaydetti → kapı hemen açılır. */
export function markProfileCreated(): void {
  markSeq += 1;
  const s = useProfileGateStore.getState();
  s.setStatus(s.userId, 'has');
}

/** Akış kökeni + dönüş hedefi (kayıt cevap deposundan ayrı: `useKayit.reset` bunu silmez). */
interface FlowState {
  origin: GateOrigin;
  returnTo: GateTarget | null;
  method: AuthMethod | null;
  /** Giriş yapan hesap bu oturumda oluşturuldu (T1 yalnız ilk kayıtta). */
  fresh: boolean;
  setFlow: (p: Partial<Omit<FlowState, 'setFlow'>>) => void;
}

export const useKayitFlow = create<FlowState>((set) => ({
  origin: 'onb',
  returnTo: null,
  method: null,
  fresh: false,
  setFlow: (p) => set(p),
}));
