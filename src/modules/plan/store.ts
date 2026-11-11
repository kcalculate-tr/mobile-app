// G33-S1 — Öğün planı durumu (haftalık). İyimser güncelleme: ekran anında değişir, sunucu yazımı
// arkadan gider; hata olursa satır geri alınır ve çağırana false döner. Hafta önbelleği cihazda
// (AsyncStorage) tutulur → çevrimdışı açılışta son görülen plan.
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlanItem, Slot } from './types';
import type { ManualLine, ShopState } from './shopping';
import * as api from './client';
import type { RecipeCatalog } from './client';

const CACHE = (uid: string, ws: string) => `@kcal_plan_week:${uid}:${ws}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Algoritmanın yerel kimliği (gen-…) sunucuya yazılmadan önce uuid olur. */
export function withUuid(it: PlanItem): PlanItem {
  if (UUID.test(it.id)) return it;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newRowId } = require('../gun/track/logQueueNative') as typeof import('../gun/track/logQueueNative');
  return { ...it, id: newRowId() };
}

interface WeekEntry {
  planId: string | null;
  note: string | null;
  items: PlanItem[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  shopState: ShopState[];
  manual: ManualLine[];
}

const EMPTY: WeekEntry = { planId: null, note: null, items: [], status: 'idle', shopState: [], manual: [] };

interface PlanStore {
  userId: string | null;
  weeks: Record<string, WeekEntry>;
  catalog: RecipeCatalog | null;
  setUser: (uid: string | null) => void;
  loadCatalog: () => Promise<RecipeCatalog>;
  loadWeek: (ws: string) => Promise<void>;
  week: (ws: string) => WeekEntry;
  putItem: (ws: string, it: PlanItem) => Promise<boolean>;
  removeItem: (ws: string, id: string) => Promise<boolean>;
  setLogged: (ws: string, id: string, loggedId: string | null) => Promise<boolean>;
  applyItems: (ws: string, items: PlanItem[], source: 'template' | 'coach', note: string | null) => Promise<boolean>;
  setShopState: (ws: string, s: ShopState & { name: string; category: import('./types').ShopCategory }) => Promise<boolean>;
  addManual: (ws: string, m: ManualLine) => Promise<boolean>;
  patchManual: (ws: string, id: string, patch: { checked?: boolean; removed?: boolean }) => Promise<boolean>;
}

function persistWeek(uid: string | null, ws: string, e: WeekEntry) {
  if (!uid) return;
  void AsyncStorage.setItem(CACHE(uid, ws), JSON.stringify({ planId: e.planId, note: e.note, items: e.items, shopState: e.shopState, manual: e.manual })).catch(() => {});
}

export const usePlanStore = create<PlanStore>((set, get) => {
  const patch = (ws: string, fn: (e: WeekEntry) => WeekEntry) => {
    const cur = get().weeks[ws] ?? EMPTY;
    const next = fn(cur);
    set({ weeks: { ...get().weeks, [ws]: next } });
    persistWeek(get().userId, ws, next);
    return { cur, next };
  };
  const planIdFor = async (ws: string, source: 'manual' | 'template' | 'coach' = 'manual', note: string | null = null) => {
    const uid = get().userId;
    if (!uid) throw new Error('plan: oturum yok');
    const e = get().weeks[ws];
    if (e?.planId && source === 'manual') return e.planId;
    const id = await api.ensurePlan(uid, ws, source, note);
    patch(ws, (x) => ({ ...x, planId: id, note: source === 'manual' ? x.note : note }));
    return id;
  };

  return {
    userId: null,
    weeks: {},
    catalog: null,
    setUser: (uid) => {
      if (uid !== get().userId) set({ userId: uid, weeks: {} });
    },
    loadCatalog: async () => {
      const have = get().catalog;
      if (have && have.origin !== 'none') return have;
      const c = await api.fetchRecipeCatalog();
      set({ catalog: c });
      return c;
    },
    week: (ws) => get().weeks[ws] ?? EMPTY,
    loadWeek: async (ws) => {
      const uid = get().userId;
      if (!uid) return;
      if (!get().weeks[ws]) {
        try {
          const raw = await AsyncStorage.getItem(CACHE(uid, ws));
          if (raw) {
            const c = JSON.parse(raw) as Partial<WeekEntry>;
            set({ weeks: { ...get().weeks, [ws]: { ...EMPTY, ...c, status: 'loading' } } });
          }
        } catch {
          /* önbellek yok */
        }
      }
      patch(ws, (e) => ({ ...e, status: e.items.length ? e.status : 'loading' }));
      try {
        const [w, shop] = await Promise.all([api.fetchWeek(uid, ws), api.fetchShop(uid, ws).catch(() => null)]);
        patch(ws, (e) => ({ ...e, planId: w.planId, note: w.note, items: w.items, status: 'ready', shopState: shop?.state ?? e.shopState, manual: shop?.manual ?? e.manual }));
      } catch {
        patch(ws, (e) => ({ ...e, status: e.items.length ? 'ready' : 'error' }));
      }
    },
    putItem: async (ws, raw) => {
      const it = withUuid(raw);
      const { cur } = patch(ws, (e) => ({ ...e, status: 'ready', items: [...e.items.filter((x) => !(x.date === it.date && x.slot === it.slot)), it] }));
      try {
        const uid = get().userId as string;
        await api.upsertItem(uid, await planIdFor(ws), it);
        return true;
      } catch {
        patch(ws, (e) => ({ ...e, items: cur.items }));
        return false;
      }
    },
    removeItem: async (ws, id) => {
      const { cur } = patch(ws, (e) => ({ ...e, items: e.items.filter((x) => x.id !== id) }));
      try {
        await api.deleteItem(get().userId as string, id);
        return true;
      } catch {
        patch(ws, (e) => ({ ...e, items: cur.items }));
        return false;
      }
    },
    setLogged: async (ws, id, loggedId) => {
      const { cur } = patch(ws, (e) => ({ ...e, items: e.items.map((x) => (x.id === id ? { ...x, loggedId } : x)) }));
      try {
        await api.setItemLogged(get().userId as string, id, loggedId);
        return true;
      } catch {
        patch(ws, (e) => ({ ...e, items: cur.items }));
        return false;
      }
    },
    applyItems: async (ws, rawItems, source, note) => {
      const items = rawItems.map(withUuid);
      const keys = new Set(items.map((x) => `${x.date}:${x.slot}`));
      const { cur } = patch(ws, (e) => ({ ...e, status: 'ready', note, items: [...e.items.filter((x) => !keys.has(`${x.date}:${x.slot}`)), ...items] }));
      try {
        const uid = get().userId as string;
        await api.applyItems(uid, await planIdFor(ws, source, note), items);
        return true;
      } catch {
        patch(ws, (e) => ({ ...e, items: cur.items, note: cur.note }));
        return false;
      }
    },
    setShopState: async (ws, s) => {
      const { cur } = patch(ws, (e) => ({ ...e, shopState: [...e.shopState.filter((x) => x.ingredientKey !== s.ingredientKey), { ingredientKey: s.ingredientKey, checked: s.checked, removed: s.removed }] }));
      try {
        await api.upsertShopState(get().userId as string, ws, s);
        return true;
      } catch {
        patch(ws, (e) => ({ ...e, shopState: cur.shopState }));
        return false;
      }
    },
    addManual: async (ws, m) => {
      const { cur } = patch(ws, (e) => ({ ...e, manual: [...e.manual, m] }));
      try {
        await api.insertManual(get().userId as string, ws, m);
        return true;
      } catch {
        patch(ws, (e) => ({ ...e, manual: cur.manual }));
        return false;
      }
    },
    patchManual: async (ws, id, p) => {
      const { cur } = patch(ws, (e) => ({
        ...e,
        manual: p.removed ? e.manual.filter((x) => x.id !== id) : e.manual.map((x) => (x.id === id ? { ...x, checked: p.checked ?? x.checked } : x)),
      }));
      try {
        await api.updateManual(get().userId as string, id, p);
        return true;
      } catch {
        patch(ws, (e) => ({ ...e, manual: cur.manual }));
        return false;
      }
    },
  };
});

/** Gün + yuva → satır. */
export function itemAt(items: readonly PlanItem[], date: string, slot: Slot): PlanItem | undefined {
  return items.find((x) => x.date === date && x.slot === slot);
}
