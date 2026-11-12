// G28-S1 md.2 — öğün fotoğrafı (meal_consumptions.photo_path → user-media özel kova).
// Ana sayfa / Gün satırı küçük görseli için kısa ömürlü imzalı URL, ÖNBELLEKLİ (aynı yol
// için süresi dolana dek tek istek; eşzamanlı istekler tek uçuşta birleşir).
// Sonuç → liste geçişinde AYNI görsel: Tara kaydı yazılınca yerel foto URI'si yola eşlenir
// (`rememberLocalMealPhoto`) → satır ağ beklemeden aynı kareyi çizer.
// Saf çekirdek (istemci enjekte) — birim testi: __tests__/g28MealPhoto.test.ts

export const MEAL_PHOTO_BUCKET = 'user-media';
/** İmzalı URL ömrü (sn) ve önbellekte tutulma payı. */
export const MEAL_PHOTO_TTL_S = 60 * 60;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export interface SignerClient {
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number): PromiseLike<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
}

type Entry = { uri: string; expiresAt: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();
const local = new Map<string, string>();
/** Başarısız yol: bu oturumda tekrar denenmez (satır kase nesnesine düşer). */
const failed = new Set<string>();

/** Tara kaydı yazıldı: bu yolun görseli şimdilik cihazdaki foto (aynı kare, ağ yok). */
export function rememberLocalMealPhoto(path: string | null | undefined, localUri: string | null | undefined): void {
  if (path && localUri) local.set(path, localUri);
}

/** Önbellekte hazır URI (yerel ya da süresi dolmamış imzalı) — yoksa null. Senkron (ilk çizim). */
export function peekMealPhoto(path: string | null | undefined, now: number = Date.now()): string | null {
  if (!path) return null;
  const l = local.get(path);
  if (l) return l;
  const c = cache.get(path);
  return c && c.expiresAt - REFRESH_MARGIN_MS > now ? c.uri : null;
}

export function hasMealPhotoFailed(path: string | null | undefined): boolean {
  return !!path && failed.has(path);
}

export async function resolveMealPhoto(
  client: SignerClient,
  path: string | null | undefined,
  now: number = Date.now(),
): Promise<string | null> {
  if (!path || failed.has(path)) return null;
  const hit = peekMealPhoto(path, now);
  if (hit) return hit;
  const running = inflight.get(path);
  if (running) return running;
  const p = (async () => {
    try {
      const { data, error } = await client.storage.from(MEAL_PHOTO_BUCKET).createSignedUrl(path, MEAL_PHOTO_TTL_S);
      if (error || !data?.signedUrl) {
        failed.add(path);
        return null;
      }
      cache.set(path, { uri: data.signedUrl, expiresAt: now + MEAL_PHOTO_TTL_S * 1000 });
      return data.signedUrl;
    } catch {
      // ağ hatası: kalıcı sayılmaz (sonraki çizimde yeniden denenir)
      return null;
    } finally {
      inflight.delete(path);
    }
  })();
  inflight.set(path, p);
  return p;
}

/** Yalnız testler. */
export function __resetMealPhotoCache(): void {
  cache.clear();
  inflight.clear();
  local.clear();
  failed.clear();
}
