// eatkcal v2 (G13-S2 md.5) — `addresses` tablosu yazma işlemleri.
//
// BİREBİR kopya: src/screens/AddressesScreen.tsx
//  - ekle/güncelle + eksik kolon geri dönüşü (6 deneme)  → :709-806
//  - sil                                                  → :810-841
//  - varsayılan yap (önce hepsi false, sonra seçilen true) → :237-289
//  - profil iletişim bilgisi (best-effort)                → :691-707
// Aynı tablo/sütun/filtreler (`eq('user_id')`). İstemci parametre olarak
// alınır (testte sahte istemci); native import YOK.
// `normalizeAddress` (src/lib/addresses.ts) Supabase istemcisini import ettiği
// için burada çağrılmaz; ham satır döner, ekran normalize eder.
import { getMissingColumnName } from './addressModel';

type QueryResult = { data: unknown; error: { message?: string; details?: string } | null };
/** Supabase istemcisinin burada kullanılan en küçük yüzeyi. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = { from: (table: string) => any };

const MAX_ATTEMPTS = 6;

async function withColumnFallback(
  payload: Record<string, unknown>,
  run: (p: Record<string, unknown>) => PromiseLike<QueryResult>,
  failMessage: string,
): Promise<{ row: Record<string, unknown>; droppedColumns: string[] }> {
  const working = { ...payload };
  const dropped: string[] = [];
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await run(working);
    if (!error && data) {
      return { row: data as Record<string, unknown>, droppedColumns: dropped };
    }
    const errorText = `${error?.message || ''} ${error?.details || ''}`;
    const missing = getMissingColumnName(errorText);
    lastError = error;
    if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
      dropped.push(missing);
      delete working[missing];
      continue;
    }
    throw error;
  }
  throw lastError || new Error(failMessage);
}

/** Yeni adres. `isFirstAddress` → is_default true (AddressesScreen:758-760). */
export function insertAddress(
  supabase: SupabaseLike,
  payload: Record<string, unknown>,
  isFirstAddress: boolean,
) {
  const p = { ...payload };
  if (isFirstAddress) p.is_default = true;
  return withColumnFallback(
    p,
    (w) => supabase.from('addresses').insert([w]).select('*').single(),
    'Adres kaydedilemedi.',
  );
}

/** Adres güncelleme — `user_id` payload'dan çıkarılır (AddressesScreen:710-711). */
export function updateAddress(
  supabase: SupabaseLike,
  payload: Record<string, unknown>,
  addressId: string,
  userId: string,
) {
  const p = { ...payload };
  delete p.user_id;
  return withColumnFallback(
    p,
    (w) =>
      supabase
        .from('addresses')
        .update(w)
        .eq('id', addressId)
        .eq('user_id', userId)
        .select('*')
        .single(),
    'Adres güncellenemedi.',
  );
}

export async function deleteAddress(supabase: SupabaseLike, addressId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('addresses').delete().eq('id', addressId).eq('user_id', userId);
  if (error) throw error;
}

export async function setDefaultAddress(supabase: SupabaseLike, addressId: string, userId: string): Promise<void> {
  const clearRes = await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
  if (clearRes.error) throw clearRes.error;
  const setRes = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('user_id', userId);
  if (setRes.error) throw setRes.error;
}

/** Kullanıcının adresleri (ham satır) — AddressesScreen:327-331 ile aynı sorgu. */
export async function fetchUserAddressRows(supabase: SupabaseLike, userId: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as Record<string, unknown>[];
}

/** Profil iletişim bilgisi — AddressesScreen:183-197 ile aynı sorgu. */
export async function fetchProfileContact(
  supabase: SupabaseLike,
  userId: string,
): Promise<{ fullName: string; phone: string }> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, first_name, last_name, phone')
    .eq('id', userId)
    .maybeSingle();
  const fullName =
    String(data?.full_name || '').trim() ||
    [data?.first_name, data?.last_name].filter(Boolean).join(' ').trim();
  return { fullName, phone: String(data?.phone || '').trim() };
}

/** Profilde ad/telefon yoksa formdakini yaz — best-effort, kaydı bloklamaz (AddressesScreen:691-707). */
export function backfillProfileContact(
  supabase: SupabaseLike,
  userId: string,
  first: string,
  last: string,
  phone: string,
): void {
  supabase
    .from('profiles')
    .update({
      full_name: `${first.trim()} ${last.trim()}`.trim(),
      first_name: first.trim() || null,
      last_name: last.trim() || null,
      phone: phone.trim(),
    })
    .eq('id', userId)
    .then(({ error }: QueryResult) => {
      if (error) console.error('[EkAddress] profil iletişim güncellemesi başarısız:', error.message);
    });
}
