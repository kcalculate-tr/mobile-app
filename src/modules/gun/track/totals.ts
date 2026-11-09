// G19-S2 md.1 — Gün toplamı = kayıtların toplamı. YUVARLAMA TEK YERDE (burada).
// Saf modül; tsx ile birim testli.
//
// Kural:
//  · kcal: her satır `roundKcal` ile TAM SAYIYA yuvarlanır (DB `calories int4`,
//    ama porsiyon/çoklu kaynak ondalık üretebilir), gün ve yuva toplamı bu tam
//    sayıların toplamıdır → "Bugün 1.240 kcal" = yuva toplamları = satırlar.
//  · P/K/Y: ham değerler toplanır, gösterimde BİR KEZ `roundMacro` (tam gram).
//    Satır başına yuvarlayıp toplamak (0,4 + 0,4 + 0,4 → 0) kaybı önlenir.
//  · Negatif / NaN / sonsuz → 0 (bozuk satır toplamı bozmaz).
//  · Hedef yoksa (null/0/geçersiz) `goalState` → { has: false } ve arayüz
//    "Hedef belirlenmedi" gösterir; 2000 gibi uydurma varsayılan YOK.

export interface MacroRow {
  calories?: number | string | null;
  protein?: number | string | null;
  carbs?: number | string | null;
  fat?: number | string | null;
}

export interface DayTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Satır kcal'ı → tam sayı (tek kural). */
export function roundKcal(v: unknown): number {
  return Math.round(num(v));
}

/** Gösterilecek makro gramı → tam sayı (tek kural). */
export function roundMacro(v: unknown): number {
  return Math.round(num(v));
}

/** Porsiyon çarpımı sonrası saklanacak makro (0,1 g hassasiyet). */
export function storeMacro(v: unknown): number {
  return Math.round(num(v) * 10) / 10;
}

/** Ham toplam (makrolar yuvarlanmamış; kcal satır başına tam sayı). */
export function sumRows(rows: readonly MacroRow[]): DayTotals {
  const t: DayTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
  for (const r of rows) {
    t.kcal += roundKcal(r.calories);
    t.protein += num(r.protein);
    t.carbs += num(r.carbs);
    t.fat += num(r.fat);
    t.count += 1;
  }
  return t;
}

/** Gösterime hazır toplam (her alan tam sayı). */
export function dayTotals(rows: readonly MacroRow[]): DayTotals {
  const t = sumRows(rows);
  return {
    kcal: t.kcal,
    protein: roundMacro(t.protein),
    carbs: roundMacro(t.carbs),
    fat: roundMacro(t.fat),
    count: t.count,
  };
}

export interface GoalState {
  has: boolean;
  /** Hedef kcal (has=false ise 0). */
  kcal: number;
}

/**
 * Hedef var mı. Sunucu özeti önce, profil sonra; ikisi de yoksa YOK.
 * `use_custom_macros` çözümlemesi sunucuda (get_nutrition_summary) yapılır.
 */
export function goalState(...candidates: (number | null | undefined)[]): GoalState {
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return { has: true, kcal: Math.round(n) };
  }
  return { has: false, kcal: 0 };
}

/** Gün halkası tamamlandı mı (hedefin %100'ü). Hedef yoksa asla. */
export function ringComplete(kcal: number, goal: GoalState): boolean {
  return goal.has && goal.kcal > 0 && kcal >= goal.kcal;
}
