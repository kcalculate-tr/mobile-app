// G47-S1 — Profil kapısı / giriş katmanı SAF mantığı (RN ve ağ importu YOK → node:test ile sınanır).
// Uygulama tarafı: profileGate.ts (depo + sorgu), gateFlow.ts (kancalar), gateComplete.ts (akış sonu),
// navigation/gateRouter.ts (yönlendirici), auth/postAuth.ts (giriş sonrası).

export type ProfileStatus = 'unknown' | 'has' | 'none';
export type GateOrigin = 'onb' | 'gate' | 'auth';
export type AuthMethod = 'apple' | 'google' | 'email';

/** Kayıt akışı bitince açılacak hedef (kök yığın rotası). */
export interface GateTarget {
  name: string;
  params?: Record<string, unknown>;
}

/** Takip rotaları: oturum + profil şart. */
export const TRACK_ROUTES = ['AiScan', 'AiScanOffline', 'CoachIntro', 'CoachChat', 'CoachHistory', 'MeasurementHistory', 'PersonalPlanCheckin'] as const;
/** Hedef/plan rotaları: profil yoksa kayıt akışı; varsa mevcut düzenleme ekranı (eski "Takibe başla" AÇILMAZ). */
export const GOAL_ROUTES = ['TakibeBasla', 'NutritionProfile', 'PersonalPlanMine', 'PersonalPlan'] as const;

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN);

/** Saf: satırda profil var mı. */
export function rowHasProfile(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  const tc = num(row.target_calories);
  const cc = num(row.custom_calories);
  if (Number.isFinite(tc) && tc > 0) return true;
  if (Number.isFinite(cc) && cc > 0) return true;
  const pp = row.personal_plan;
  return pp != null && typeof pp === 'object';
}

export interface GateCtx {
  /** `yeni_kayit` (soğuk açılışta dondurulmuş — kayıt rotalarının kaydıyla aynı değer). */
  flag: boolean;
  kisiselPlan: boolean;
  session: boolean;
  status: ProfileStatus;
}

export type GateDecision = 'pass' | 'kayit' | 'login';

/** Saf: takip eylemi için karar. Bilinmiyorsa geçer (fail-open). */
export function gateDecision(c: GateCtx): GateDecision {
  if (!c.flag) return 'pass';
  if (!c.session) return 'login';
  return c.status === 'none' ? 'kayit' : 'pass';
}

/** Saf: kayıt akışının kök rotası (kisisel_plan açık → A yolu P1…L2; kapalı → yeni kısa profil). */
export function kayitRouteFor(kisiselPlan: boolean, origin: Exclude<GateOrigin, 'onb'>, returnTo: GateTarget | null): GateTarget {
  if (kisiselPlan) return { name: 'Kayit', params: { entry: origin, returnTo } };
  return { name: 'KayitShort', params: { mode: 'short', origin, returnTo } };
}

/** Saf: hesap yeni mi (ilk kayıt — T1 yalnız bunda). */
export function isFreshAccount(createdAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && now - t >= -60_000 && now - t < 15 * 60_000;
}

// ─── Yönlendirici (navigation/gateRouter.ts) ─────────────────────────────────
export type AnyAction = { type: string; payload?: { name?: string; params?: Record<string, unknown> } & Record<string, unknown>; [k: string]: unknown };

const ROUTE_ACTIONS = new Set(['NAVIGATE', 'NAVIGATE_DEPRECATED', 'PUSH', 'REPLACE']);
const TRACK = new Set<string>(TRACK_ROUTES);
const GOAL = new Set<string>(GOAL_ROUTES);

function withTarget(a: AnyAction, t: GateTarget): AnyAction {
  return { ...a, payload: { ...(a.payload ?? {}), name: t.name, params: t.params } };
}

/** Saf: eylemin yönlendirilmiş hâli; değişiklik yoksa null. */
export function redirectGateAction(a: AnyAction, c: GateCtx): AnyAction | null {
  if (!c.flag || !ROUTE_ACTIONS.has(a.type)) return null;
  const name = a.payload?.name;
  if (!name) return null;
  const params = a.payload?.params as Record<string, unknown> | undefined;
  if (TRACK.has(name)) {
    const d = gateDecision(c);
    if (d === 'login') return withTarget(a, { name: 'Login' });
    if (d === 'kayit') return withTarget(a, kayitRouteFor(c.kisiselPlan, 'gate', { name, params }));
    return null;
  }
  if (GOAL.has(name)) {
    if (!c.session) return null;
    if (c.status === 'none') return withTarget(a, kayitRouteFor(c.kisiselPlan, 'gate', null));
    // Profil varken hedef düzenleme: kişisel plan açık → Kişisel planım (düzenleme orada); kapalı → yeni tasarımlı kısa
    // profil (cevaplar yeniden, hedef üstüne yazılır). Eski NutritionProfile / Takibe başla ekranları açılmaz.
    if (name === 'TakibeBasla' || name === 'NutritionProfile') {
      return withTarget(a, c.kisiselPlan ? { name: 'PersonalPlanMine' } : { name: 'KayitShort', params: { mode: 'short', origin: 'gate', returnTo: null } });
    }
    return null;
  }
  return null;
}

// ─── Giriş sonrası (auth/postAuth.ts) ─────────────────────────────────────────
export type PostAuth = 'redirect' | 'back' | 'home' | 'kayit';

/** Katmanın altındaki bu rotalar "giriş noktası" sayılır → profil kuralı uygulanır. */
export const ENTRY_ROUTES = new Set(['Kayit', 'KayitShort', 'Onboarding', 'WelcomeGate', 'Tabs']);

/** Saf karar. */
export function postAuthTarget(i: { redirectTo?: string; below?: string; status: ProfileStatus }): PostAuth {
  if (i.redirectTo === 'Checkout' || i.redirectTo === 'Addresses') return 'redirect';
  if (i.below && !ENTRY_ROUTES.has(i.below)) return 'back';
  return i.status === 'none' ? 'kayit' : 'home';
}

// ─── Akış sonu (gateComplete.ts) ──────────────────────────────────────────────
/** Saf: akış bitince kök yığın — dönüş hedefi Ana sayfa parametresiyse doğrudan ona, değilse Ana sayfa + hedef. */
export function completionRoutes(returnTo: GateTarget | null): { reset: GateTarget[]; then: GateTarget | null } {
  const home: GateTarget = { name: 'Tabs', params: { screen: 'Tracker' } };
  if (!returnTo) return { reset: [home], then: null };
  if (returnTo.name === 'Tabs') return { reset: [{ name: 'Tabs', params: returnTo.params ?? { screen: 'Tracker' } }], then: null };
  return { reset: [home], then: returnTo };
}
