// Sosyal kanıt — ağ çağrıları. Saf mantık socialProofRules.ts'te.
import { getSupabaseClient } from './supabase';
import { EN_AZ_OY, type BegeniOrani, type VitrinYorumu } from './socialProofRules';

export * from './socialProofRules';

/**
 * Anasayfa vitrini — İKİ KAYNAK BİRLEŞİK:
 *   · reviews   → sipariş sonrası değerlendirmeler
 *   · feedback  → Profil ▸ Destek ▸ Geri Bildirim'den gelen yorumlar
 *
 * Her ikisi de sunucuda `is_approved = true` + 4 yıldız eşiğinden geçiyor
 * (vitrin_yorumlari). Onaylanmamış hiçbir metin buraya düşmez.
 */
export async function vitrinYorumlariniGetir(limit = 12): Promise<VitrinYorumu[]> {
  try {
    const { data, error } = await getSupabaseClient().rpc('vitrin_yorumlari', { p_limit: limit });
    if (error) throw error;
    return (Array.isArray(data) ? data : [])
      .filter((y) => typeof y?.yorum === 'string' && y.yorum.trim() !== '')
      .map((y) => ({
        id: String(y.id),
        rating: Number(y.rating) || 0,
        yorum: String(y.yorum),
        ad: String(y.ad ?? 'kcal. müşterisi'),
        tarih: String(y.tarih ?? ''),
        kaynak: y.kaynak === 'uygulama' ? 'uygulama' : 'siparis',
      }));
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
