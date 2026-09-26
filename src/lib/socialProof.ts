// Sosyal kanıt — ağ çağrıları. Saf mantık socialProofRules.ts'te.
import { getSupabaseClient } from './supabase';
import { EN_AZ_OY, type BegeniOrani, type VitrinYorumu } from './socialProofRules';

export * from './socialProofRules';

export async function vitrinYorumlariniGetir(limit = 12): Promise<VitrinYorumu[]> {
  try {
    const { data, error } = await getSupabaseClient().rpc('en_iyi_yorumlar', { p_limit: limit });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).filter(
      (y) => typeof y?.yorum === 'string' && y.yorum.trim() !== '',
    );
  } catch (e) {
    if (__DEV__) console.warn('[sosyal kanıt] yorumlar okunamadı:', e);
    return [];
  }
}

export async function begeniOranlariniGetir(enAzOy = EN_AZ_OY): Promise<Map<number, BegeniOrani>> {
  const harita = new Map<number, BegeniOrani>();
  try {
    const { data, error } = await getSupabaseClient().rpc('urun_begeni_oranlari', {
      p_min_oy: enAzOy,
    });
    if (error) throw error;
    for (const satir of Array.isArray(data) ? data : []) {
      const pid = Number(satir?.product_id);
      if (!Number.isFinite(pid)) continue;
      harita.set(pid, {
        productId: pid,
        toplam: Number(satir.toplam) || 0,
        begenen: Number(satir.begenen) || 0,
        oran: Number(satir.oran) || 0,
      });
    }
  } catch (e) {
    if (__DEV__) console.warn('[sosyal kanıt] beğeni oranları okunamadı:', e);
  }
  return harita;
}
