// G21-S1 md.4 — Tara kaydını GERÇEKTEN geri alma (G20-S1 SORULAR 6, G19-S4 SORULAR 4).
//
// Tara uçuşu (`kcal:logFlight`) artık kayıt `id`'sini ve bu `undo`'yu taşır → kabuk
// toast'ındaki "Geri al" meal_consumptions satırını siler (önceden Tara uçuşunda id
// yoktu, kabuk Geri al çizmiyordu). Aynı silme Tara sonuç ekranındaki Geri al'da da
// kullanılır. RN importu yok → node:test.

/** Silme için gereken en küçük Supabase yüzeyi (test edilebilir). */
export interface DeletableSupabase {
  from(table: string): {
    delete(): {
      eq(col: string, v: string): { eq(col: string, v: string): PromiseLike<{ error: unknown }> };
    };
  };
}

/** Kullanıcının kendi Tara kaydını siler. true = silindi. */
export async function deleteScanConsumption(client: DeletableSupabase, userId: string, id: string): Promise<boolean> {
  if (!userId || !id) return false;
  try {
    const { error } = await client.from('meal_consumptions').delete().eq('user_id', userId).eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Uçuşa konacak `undo`: id yoksa null (kabuk Geri al çizmez — yanıltıcı geri al yok).
 * `onDone(ok)` silme sonucunu kaynağa bildirir (ör. sonuç ekranı hâlâ açıksa "kaydedildi"
 * durumunu geri çevirmek için).
 */
export function scanFlightUndo(
  client: () => DeletableSupabase,
  userId: string | null | undefined,
  id: string | null | undefined,
  onDone?: (ok: boolean) => void,
): (() => Promise<void>) | null {
  if (!userId || !id) return null;
  let done = false;
  return async () => {
    if (done) return; // iki toast'tan çift basış: tek silme
    done = true;
    const ok = await deleteScanConsumption(client(), userId, id);
    if (!ok) done = false;
    onDone?.(ok);
  };
}

/** saveAiScanEstimate dönüşünden satır id'si. */
export function rowIdOf(row: unknown): string | null {
  const id = (row as { id?: unknown } | null | undefined)?.id;
  return typeof id === 'string' && id.length > 0 ? id : typeof id === 'number' ? String(id) : null;
}
