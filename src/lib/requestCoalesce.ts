// İSTEK TEKİLLEŞTİRME (coalescing) — S2 performans
//
// Soğuk açılışta aynı veriyi (addresses/settings/products) birden fazla yerden
// çeken istekler, AYNI anahtarla yapıldığında tek ağ isteğine indirgenir. Her
// çağıran yine aynı sonucu alır → davranış korunur, yalnızca yinelenen ağ
// trafiği önlenir.
//
// Küçük bir TTL yalnızca açılış patlamasını birleştirmek içindir; uzun süreli
// bayatlama yaratmaz. Hata sonucu ÖNBELLEĞE ALINMAZ (bir sonraki çağrı yeniden
// dener). AbortSignal'li çağrılar burada coalesce EDİLMEMELİDİR — bir çağıranın
// iptali diğerlerini etkilemesin.

type Entry<T> = { at: number; promise: Promise<T> };

const store = new Map<string, Entry<unknown>>();

export function coalesce<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as Entry<T> | undefined;
  if (existing && now - existing.at < ttlMs) return existing.promise;

  const promise = (async () => {
    try {
      return await fn();
    } catch (err) {
      // Başarısız sonucu tutma — anahtar hâlâ BU çağrıya aitse (daha yeni bir
      // çağrı üzerine yazmadıysa) temizle ki bir sonraki çağrı yeniden denesin.
      if (store.get(key)?.at === now) store.delete(key);
      throw err;
    }
  })();

  store.set(key, { at: now, promise });
  return promise;
}

/** Belirli bir anahtarın önbelleğini zorla boşalt (ör. mutasyon sonrası). */
export function invalidateCoalesced(key: string): void {
  store.delete(key);
}
