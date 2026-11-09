// G19-S1 md.3 — Tara sonucu düzeltmesi (FinPhotoR1): gram · porsiyon · öğe sil ·
// eksik besin (ürün araması ya da ELLE). Logla'ya giden değerin TEK hesabı burada.
// SAF (native yok) — birim testi: __tests__/adjust.test.ts
//
// İlke: hiçbir şey değişmediyse modelin TOPLAMI aynen gider (öğe toplamı modelin
// toplamından farklı olabilir). Değişiklik, her makro için "öğe katkısı oranı" ile
// toplama yansır: ölçek_m = Σ(öğe_m × çarpan) / Σ(öğe_m). Öğe makrosu yoksa kcal
// oranı, kcal de yoksa gram oranı, gram da yoksa öğe sayısı oranı kullanılır.
import type { ScanEstimate, ScanIngredient } from './types';

export type Estimate = Omit<ScanEstimate, 'isEstimate'>;

export interface AdjustRow {
  name: string;
  baseGrams: number;
  baseKcal: number | null;
  baseP: number | null;
  baseC: number | null;
  baseF: number | null;
  grams: number;
  /** ½ · 1 · 1½ çipi; gram elle yazıldıysa 0. */
  portion: number;
  removed: boolean;
  /** Eksik besin (ürün araması ya da elle): 100 g başına makro → kesin katkı. */
  per100?: { kcal: number; p: number; c: number; f: number };
  /** Elle eklenen satır (kullanıcı yazdı). */
  manual?: boolean;
}

const pos = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

export function rowsFromEstimate(estimate: Estimate): AdjustRow[] {
  return estimate.ingredients.map((ing: ScanIngredient) => ({
    name: ing.name,
    baseGrams: pos(ing.grams),
    baseKcal: ing.kcal != null && Number.isFinite(ing.kcal) ? Math.max(0, ing.kcal) : null,
    baseP: ing.protein_g != null ? pos(ing.protein_g) : null,
    baseC: ing.carbs_g != null ? pos(ing.carbs_g) : null,
    baseF: ing.fat_g != null ? pos(ing.fat_g) : null,
    grams: pos(ing.grams),
    portion: 1,
    removed: false,
  }));
}

/** Taranan satırın çarpanı: yazılan gram / taban gram; taban gram yoksa porsiyon. */
export function rowFactor(r: AdjustRow): number {
  if (r.removed) return 0;
  if (r.baseGrams > 0) return Math.max(0, r.grams) / r.baseGrams;
  return r.portion > 0 ? r.portion : 1;
}

/** Satırın ekranda gösterilen kcal'ı. */
export function rowKcal(r: AdjustRow): number {
  if (r.per100) return (r.per100.kcal * Math.max(0, r.grams)) / 100;
  if (r.baseKcal == null) return 0;
  return r.baseKcal * rowFactor({ ...r, removed: false });
}

/** Ürün aramasından eklenen satır (100 g başına makro). */
export function productRow(p: { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }): AdjustRow {
  return {
    name: p.name,
    baseGrams: 100,
    baseKcal: pos(p.kcal),
    baseP: pos(p.protein_g),
    baseC: pos(p.carbs_g),
    baseF: pos(p.fat_g),
    grams: 100,
    portion: 1,
    removed: false,
    per100: { kcal: pos(p.kcal), p: pos(p.protein_g), c: pos(p.carbs_g), f: pos(p.fat_g) },
  };
}

export const MANUAL_NAME_MAX = 60;
export const MANUAL_KCAL_MAX = 3000;
export const MANUAL_GRAMS_MAX = 2000;

/**
 * "Eksik besin ekle" → ELLE: ad + kcal (+ isteğe bağlı gram, varsayılan 100).
 * Geçersizse null (ad boş, kcal ≤ 0 ya da sınır dışı). Makrolar bilinmez → 0.
 */
export function manualRow(name: string, kcalText: string, gramsText = ''): AdjustRow | null {
  const nm = name.replace(/\s+/g, ' ').trim().slice(0, MANUAL_NAME_MAX);
  const kcal = Number(String(kcalText).replace(',', '.').replace(/[^0-9.]/g, ''));
  const gramsRaw = Number(String(gramsText).replace(/[^0-9]/g, ''));
  const grams = gramsText.trim() === '' ? 100 : gramsRaw;
  if (!nm || !Number.isFinite(kcal) || kcal <= 0 || kcal > MANUAL_KCAL_MAX) return null;
  if (!Number.isFinite(grams) || grams <= 0 || grams > MANUAL_GRAMS_MAX) return null;
  return {
    name: nm,
    baseGrams: grams,
    baseKcal: kcal,
    baseP: 0,
    baseC: 0,
    baseF: 0,
    grams,
    portion: 1,
    removed: false,
    per100: { kcal: (kcal * 100) / grams, p: 0, c: 0, f: 0 },
    manual: true,
  };
}

function ratio(scanned: AdjustRow[], pick: (r: AdjustRow) => number | null): number | null {
  let base = 0;
  let now = 0;
  for (const r of scanned) {
    const v = pick(r);
    if (v == null) return null; // bir öğede bile yoksa bu makro için öğe oranı kullanılamaz
    base += v;
    now += v * rowFactor(r);
  }
  return base > 0 ? now / base : null;
}

/**
 * Düzeltilmiş tahmin (Logla'ya giden). `platePortion` yalnız hiç öğe yokken
 * (model tek "Yemek" döndü, satır yok) bütün tabağa uygulanır; öğe varsa
 * porsiyon satırlara zaten yazılmıştır (pickPlatePortion).
 */
export function computeAdjusted(estimate: Estimate, rows: AdjustRow[], platePortion = 1): Estimate {
  const scanned = rows.filter((r) => !r.per100);
  const extra = rows.filter((r) => r.per100 && !r.removed);

  let fallback: number;
  if (scanned.length === 0) {
    fallback = platePortion > 0 ? platePortion : 1;
  } else {
    fallback =
      ratio(scanned, (r) => r.baseKcal) ??
      ratio(scanned, (r) => (r.baseGrams > 0 ? r.baseGrams : null)) ??
      scanned.filter((r) => !r.removed).length / scanned.length;
  }
  const sKcal = scanned.length ? (ratio(scanned, (r) => r.baseKcal) ?? fallback) : fallback;
  const sP = scanned.length ? (ratio(scanned, (r) => r.baseP) ?? sKcal) : fallback;
  const sC = scanned.length ? (ratio(scanned, (r) => r.baseC) ?? sKcal) : fallback;
  const sF = scanned.length ? (ratio(scanned, (r) => r.baseF) ?? sKcal) : fallback;

  const ex = extra.reduce(
    (a, r) => {
      const g = Math.max(0, r.grams) / 100;
      return {
        kcal: a.kcal + (r.per100?.kcal ?? 0) * g,
        p: a.p + (r.per100?.p ?? 0) * g,
        c: a.c + (r.per100?.c ?? 0) * g,
        f: a.f + (r.per100?.f ?? 0) * g,
      };
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  const r0 = (v: number) => Math.max(0, Math.round(v));
  return {
    ...estimate,
    // Silinen öğe addan da düşer, eklenen öğe ada girer (Ana sayfa satırı doğru okunur).
    name: adjustedName(estimate, rows),
    portion: scanned.length === 0 ? fallback : estimate.portion,
    kcal: r0(estimate.kcal * sKcal + ex.kcal),
    protein_g: r0(estimate.protein_g * sP + ex.p),
    carbs_g: r0(estimate.carbs_g * sC + ex.c),
    fat_g: r0(estimate.fat_g * sF + ex.f),
    ingredients: rows
      .filter((r) => !r.removed)
      .map((r) => ({ name: r.name, grams: Math.round(Math.max(0, r.grams)), kcal: Math.round(rowKcal(r)) })),
  };
}

/** Logla'ya giden ad: silinen öğeler addan da düşer; hepsi silindiyse modelin adı. */
export function adjustedName(estimate: Estimate, rows: AdjustRow[]): string {
  const names = rows.filter((r) => !r.removed).map((r) => r.name);
  return names.length ? names.join(', ') : estimate.name;
}
