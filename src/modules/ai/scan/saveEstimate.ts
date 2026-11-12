// AI tarama tahminini güne kaydet. G7-S1 (migration 20261104001100): CHECK'e
// 'ai_scan' eklendi; kayıt `source: 'ai_scan'`, `source_ref: <sourceRef>` ile
// yazılır. sourceRef taramaya özgü BENZERSİZ anahtardır (reservation/idempotency
// anahtarı) — (user_id, source, source_ref) UNIQUE kısıtı yüzünden sabit bir
// source_ref aynı gün ikinci taramada çakışıyordu; benzersiz ref bunu çözer.
// meal_type sunucu koduna (kahvalti|…) çevrilir (bkz. core/meal/mealType).
//
// Bağımlılık enjekte edilir (gerçek Supabase istemcisi çağıran tarafından
// verilir) — bu dosya native import YAPMAZ, saf birim testlerle doğrulanır.
import type { ScanEstimate } from './types';
import { toServerMealType } from '../../../core/meal/mealType';

export interface MealConsumptionRow {
  id: string;
  name: string;
  meal_type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  consumed_at: string;
}

export interface InsertableSupabase {
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(columns: string): {
        // PromiseLike: Supabase'in PostgrestBuilder'ı tam Promise değil (catch/finally
        // yok) ama await ile çalışır; gerçek istemciyle uyumlu olsun diye gevşek tip.
        single(): PromiseLike<{ data: MealConsumptionRow | null; error: { message: string; code?: string } | null }>;
      };
    };
  };
}

const COLUMNS = 'id,name,meal_type,calories,protein,carbs,fat,consumed_at';

type DbError = { message: string; code?: string };

export function isUniqueViolation(error: DbError | null | undefined): boolean {
  if (!error) return false;
  return error.code === '23505' || /duplicate key|unique constraint/i.test(error.message ?? '');
}

type SelectableSupabase = {
  from(table: string): {
    select(columns: string): {
      eq(c: string, v: string): {
        eq(c: string, v: string): {
          eq(c: string, v: string): { maybeSingle(): PromiseLike<{ data: MealConsumptionRow | null; error: DbError | null }> };
        };
      };
    };
  };
};

/** G21-S1 md.2: barkod (Open Food Facts) kaydı `source='barcode'` (migration 20261110000100). */
export type ScanSaveSource = 'ai_scan' | 'barcode';

async function fetchExisting(
  supabase: InsertableSupabase,
  userId: string,
  sourceRef: string,
  src: ScanSaveSource = 'ai_scan',
): Promise<MealConsumptionRow | null> {
  try {
    const db = supabase as unknown as SelectableSupabase;
    const { data } = await db
      .from('meal_consumptions')
      .select(COLUMNS)
      .eq('user_id', userId)
      .eq('source', src)
      .eq('source_ref', sourceRef)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

/** G28-S1 md.4: Logla'nın yazdığı alanlar — TEK hesap (insert ve eşitleme aynı değeri yazar). */
export interface LoggedValues {
  name: string;
  meal_type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function loggedValues(estimate: Omit<ScanEstimate, 'isEstimate'>, mealType: string): LoggedValues {
  return {
    name: estimate.name,
    meal_type: toServerMealType(mealType),
    calories: Math.max(0, Math.round(estimate.kcal)),
    protein: Math.max(0, Math.round(estimate.protein_g)),
    carbs: Math.max(0, Math.round(estimate.carbs_g)),
    fat: Math.max(0, Math.round(estimate.fat_g)),
  };
}

/** Mevcut satır ekranda onaylanan değerlerle birebir aynı mı (ad, öğün, kcal, makro)? */
export function sameLoggedValues(row: MealConsumptionRow, v: LoggedValues): boolean {
  return (
    row.name === v.name &&
    row.meal_type === v.meal_type &&
    Number(row.calories) === v.calories &&
    Number(row.protein) === v.protein &&
    Number(row.carbs) === v.carbs &&
    Number(row.fat) === v.fat
  );
}

type UpdatableSupabase = {
  from(table: string): {
    update(patch: Record<string, unknown>): {
      eq(c: string, v: string): {
        eq(c: string, v: string): {
          select(columns: string): { single(): PromiseLike<{ data: MealConsumptionRow | null; error: DbError | null }> };
        };
      };
    };
  };
};

async function syncExisting(
  supabase: InsertableSupabase,
  userId: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<MealConsumptionRow | null> {
  try {
    const db = supabase as unknown as UpdatableSupabase;
    const { data, error } = await db
      .from('meal_consumptions')
      .update(patch)
      .eq('user_id', userId)
      .eq('id', id)
      .select(COLUMNS)
      .single();
    return error ? null : (data ?? null);
  } catch {
    return null;
  }
}

export async function saveAiScanEstimate(
  supabase: InsertableSupabase,
  params: {
    userId: string;
    mealType: string;
    sourceRef: string;
    estimate: Omit<ScanEstimate, 'isEstimate'>;
    /** Varsayılan 'ai_scan'; Tara › Barkod 'barcode'. */
    source?: ScanSaveSource;
    /**
     * G28-S1 md.2: fotoğrafın user-media yolu (`<uid>/scans/<anahtar>.jpg`, analiz için
     * zaten yüklenen dosya). Ana sayfa satırı bu yoldan imzalı küçük görsel çizer.
     * Ses/barkod kaydında yok.
     */
    photoPath?: string | null;
  },
): Promise<MealConsumptionRow> {
  const { userId, mealType, sourceRef, estimate } = params;
  const src: ScanSaveSource = params.source ?? 'ai_scan';
  const values = loggedValues(estimate, mealType);
  const photo = params.photoPath ? { photo_path: params.photoPath } : {};
  const { data, error } = await supabase
    .from('meal_consumptions')
    .insert({
      user_id: userId,
      source: src,
      source_ref: sourceRef,
      ...values,
      ...photo,
      note: null,
      consumed_at: new Date().toISOString(),
    })
    .select(COLUMNS)
    .single();
  if (error) {
    // G19-S1 md.2: (user_id, source, source_ref) UNIQUE — aynı tarama zaten loglandıysa
    // (çift dokunma, yanıtı kaybolan yeniden deneme, kuyruk + elle aynı anda) hata
    // DEĞİL: mevcut satır döner, ikinci kayıt oluşmaz.
    // G28-S1 md.4: mevcut satır EKRANDAKİNDEN farklıysa (çevrimdışı kuyruk aynı fotoğrafı
    // ikinci kez analiz edip başka ad/kcal yazdı ya da kullanıcı porsiyonu düzeltti)
    // sessizce o satır DÖNMEZ — kullanıcının onayladığı değerlerle güncellenir.
    // Güncellenemezse hata (yanlış kayıt "loglandı" diye gösterilmez; Logla yeniden denenir).
    if (isUniqueViolation(error)) {
      const existing = await fetchExisting(supabase, userId, sourceRef, src);
      if (existing) {
        if (sameLoggedValues(existing, values)) return existing;
        const synced = await syncExisting(supabase, userId, existing.id, { ...values, ...photo });
        if (synced) return synced;
        throw new Error('meal_consumptions.insert: mevcut kayıt ekrandaki değerlerle eşitlenemedi');
      }
    }
    throw new Error(`meal_consumptions.insert: ${error.message}`);
  }
  if (!data) throw new Error('meal_consumptions.insert: boş yanıt');
  return data;
}
