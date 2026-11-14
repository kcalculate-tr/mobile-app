// G42-S1 — Kayıt akışı sunucu ayarları (app_settings; istemci yalnız OTURUMLU okur).
import { getSupabaseClient } from '../../core/supabase';
import { MUSCLE_SURPLUS_DEFAULT } from './plan';

/** Oturum varsa app_settings `kayit_muscle_surplus_kcal` (yoksa / girişsizse yerel 250). */
export async function readMuscleSurplus(): Promise<number> {
  try {
    const sb = getSupabaseClient();
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) return MUSCLE_SURPLUS_DEFAULT;
    const { data } = await sb.from('app_settings').select('value').eq('key', 'kayit_muscle_surplus_kcal').maybeSingle();
    const v = Number((data as { value?: unknown } | null)?.value);
    return Number.isFinite(v) && v >= 0 && v <= 600 ? v : MUSCLE_SURPLUS_DEFAULT;
  } catch {
    return MUSCLE_SURPLUS_DEFAULT;
  }
}

