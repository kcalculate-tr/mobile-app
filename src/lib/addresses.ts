import type { Address } from '../types';
import { getSupabaseClient } from './supabase';

/**
 * Adres satırının TEK normalize edici kaynağı.
 *
 * 24.09.2026: bu fonksiyonun İKİ ayrı kopyası vardı — CheckoutScreen ve
 * AddressesScreen. Checkout'taki kopya `first_name`, `last_name`, `street`,
 * `building_no`, `floor`, `apartment_no`, `building_name` alanlarını SESSİZCE
 * düşürüyordu; Sipariş Özeti'nden seçilen adres store'a eksik yazılıyor,
 * sonradan o store'dan okuyan ekranlarda bina/kat bilgisi kayboluyordu.
 * Tam sürüm (AddressesScreen'inki) tek kaynak olarak buraya alındı.
 */
export const normalizeAddress = (row: Record<string, unknown>): Address => ({
  id: String(row.id ?? '').trim(),
  user_id: String(row.user_id ?? '').trim() || undefined,
  title: String(row.title ?? 'Adres').trim(),
  contact_name: String(row.contact_name ?? '').trim(),
  first_name: String(row.first_name ?? '').trim() || undefined,
  last_name: String(row.last_name ?? '').trim() || undefined,
  contact_phone: String(row.contact_phone ?? '').trim(),
  contact_email: String(row.contact_email ?? '').trim(),
  full_address: String(row.full_address ?? '').trim(),
  city: String(row.city ?? 'İzmir').trim() || 'İzmir',
  district: String(row.district ?? '').trim(),
  // Sütun adı veri kaynağına göre değişiyor (neighborhood / neighbourhood /
  // mahalle) — üçü de kabul edilir.
  neighbourhood:
    String(row.neighborhood ?? row.neighbourhood ?? row.mahalle ?? '').trim() || null,
  street: String(row.street ?? '').trim() || undefined,
  building_no: String(row.building_no ?? '').trim() || undefined,
  floor: String(row.floor ?? '').trim() || undefined,
  apartment_no: String(row.apartment_no ?? '').trim() || undefined,
  building_name: String(row.building_name ?? '').trim() || undefined,
  is_default: Boolean(row.is_default),
  latitude:
    typeof row.latitude === 'number' ? row.latitude : row.latitude != null ? Number(row.latitude) : null,
  longitude:
    typeof row.longitude === 'number' ? row.longitude : row.longitude != null ? Number(row.longitude) : null,
  verified_at: row.verified_at ? String(row.verified_at) : null,
  created_at: String(row.created_at ?? '').trim() || undefined,
  updated_at: String(row.updated_at ?? '').trim() || undefined,
});

/**
 * Gösterilecek adres: DB'deki varsayılan (is_default) tek doğruluk kaynağı;
 * yoksa en yeni adres. AddressesScreen ve Sipariş Özeti aynı kuralı kullanır.
 */
export const pickDefaultAddress = (addresses: readonly Address[]): Address | null => {
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  return addresses.find((a) => a.is_default) ?? addresses[0];
};

/** Kullanıcının adresleri — en yeni önce. */
export const fetchUserAddresses = async (userId: string): Promise<Address[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : [])
    .map((row) => normalizeAddress(row as Record<string, unknown>))
    .filter((a) => a.id);
};

/**
 * Oturum açıldığında adres göstergesini doldurur.
 *
 * 24.09.2026 hatası: `selectedAddress` yalnızca Sipariş Özeti veya Adreslerim
 * ekranı açıldığında yazılıyordu; çıkışta ise temizleniyordu. Sonuç: e-posta
 * ile sıfırdan giriş yapan, kayıtlı ve VARSAYILAN adresi olan kullanıcı
 * anasayfada "Adres seçin" görüyordu — o iki ekrandan birine girene kadar.
 *
 * Sessiz: hata olursa gösterge boş kalır, akış etkilenmez.
 */
export const hydrateSelectedAddress = async (
  userId: string,
  setSelectedAddress: (address: Address | null) => void,
): Promise<void> => {
  try {
    const varsayilan = pickDefaultAddress(await fetchUserAddresses(userId));
    if (varsayilan) setSelectedAddress(varsayilan);
  } catch {
    // sessiz — gösterge boş kalır, kullanıcı yine adres seçebilir
  }
};
