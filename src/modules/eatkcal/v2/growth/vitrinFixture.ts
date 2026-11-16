// G56-S1 — YALNIZ __DEV__ vitrini (ekran görüntüleri): `vitrinGrowth` parametresiyle açılan ana sayfa için
// örnek kullanıcı verisi. Ürünler GERÇEK katalogdan (fetchProducts) seçilir; siparişler, haftalık adetler,
// kalori hedefi ve plan ÖRNEKTİR. Üretimde EkHomeScreen bu dosyayı yalnız `__DEV__ && params.vitrinGrowth`
// iken kullanır.
import type { PastOrder } from '../../../../lib/reorder';
import type { Product } from '../../../../types';
import { productKcal, type PlanItemLike, type TopRpcRow } from './rules';

export type VitrinGrowthKind = 'full' | 'yeni' | 'skel';

export interface GrowthFixture {
  orders: PastOrder[];
  top: TopRpcRow[];
  plan: PlanItemLike[];
  targetKcal: number | null;
  consumedKcal: number;
  rewardTl: number | null;
}

export function growthFixture(kind: VitrinGrowthKind, products: readonly Product[], today: string): GrowthFixture {
  const meals = products.filter((p) => productKcal(p) != null && p.category !== 'Soslar');
  const pick = (i: number) => meals[i % Math.max(meals.length, 1)];
  const day = (d: number) => {
    const x = new Date();
    x.setDate(x.getDate() - d);
    return x.toISOString();
  };
  const order = (id: number, idx: number[], d: number): PastOrder => {
    const items = idx.map((i) => pick(i)).filter(Boolean).map((p) => ({
      id: String(p.id),
      name: p.name,
      quantity: 1,
      options: {},
      calories: productKcal(p) ?? 0,
      imageUrl: p.img ?? null,
    }));
    return {
      id,
      orderCode: `KCAL-${1000 + id}`,
      createdAt: day(d),
      totalAmount: items.reduce((n, it) => n + (Number(products.find((p) => String(p.id) === it.id)?.price) || 0), 0),
      items,
      totalCalories: items.reduce((n, it) => n + it.calories, 0),
    };
  };
  if (kind !== 'full') {
    return { orders: [], top: topFrom(meals), plan: [], targetKcal: null, consumedKcal: 0, rewardTl: 100 };
  }
  const near = (k: number) =>
    [...meals].sort((a, b) => Math.abs((productKcal(a) ?? 0) - k) - Math.abs((productKcal(b) ?? 0) - k))[0];
  const plan: PlanItemLike[] = [
    { id: 'v1', date: today, slot: 'breakfast', source: 'eatkcal', refId: String(near(320)?.id ?? ''), name: '', kcal: 320 },
    { id: 'v2', date: today, slot: 'lunch', source: 'eatkcal', refId: String(near(540)?.id ?? ''), name: '', kcal: 540 },
    { id: 'v3', date: today, slot: 'dinner', source: 'eatkcal', refId: String(near(480)?.id ?? ''), name: '', kcal: 480 },
  ];
  return {
    orders: [order(3, [1, 4, 7], 4), order(2, [2, 5], 8), order(1, [3, 6, 8], 14)],
    top: topFrom(meals),
    plan,
    targetKcal: 2000,
    consumedKcal: 1240,
    rewardTl: 100,
  };
}

function topFrom(meals: readonly Product[]): TopRpcRow[] {
  const counts = [18, 14, 11, 9, 7, 6];
  return meals.slice(0, counts.length).map((p, i) => ({ product_id: p.id, rank: i + 1, order_count: counts[i] }));
}
