// Sağlayıcı (PaynKolay) yavaşlığına karşı dayanıklılık yardımcıları — Kart Ekle ve
// ödeme WebView'leri ORTAK kullanır. Import'suz: Node testlerinde doğrudan çalışır.
// Amaç: hiçbir koşulda sonsuz "yükleniyor" kalmasın; kullanıcı kilitli kalmasın.

/** Sayfa bu sürede AÇILMAZSA (hazır olmazsa) kullanıcıya hata/yeniden dene gösterilir. */
export const WEBVIEW_LOAD_TIMEOUT_MS = 20_000;
/** Sunucuya giden başlatma isteği (verify_start / ödeme init) üst sınırı. */
export const START_REQUEST_TIMEOUT_MS = 25_000;

export const PAGE_LOAD_FAILED_MESSAGE = 'Sayfa şu an açılamadı, tekrar dene.';
export const PAYMENT_PAGE_LOAD_FAILED_MESSAGE = 'Ödeme sayfası şu an açılamadı. Lütfen tekrar dene.';
export const CONNECTION_ERROR_MESSAGE = 'Bağlantı sorunu yaşandı. Lütfen tekrar dene.';

// ── URL / hazır olma ─────────────────────────────────────────────────────────
const stripSlash = (u: string) => u.replace(/#.*$/, '').replace(/\/+$/, '');

/**
 * Başlangıç form belgesi mi? (source.html + baseUrl: yüklenen URL baseUrl ya da about:blank.)
 * Bu belge yüklenmiş olması sağlayıcı sayfasının açıldığı ANLAMINA GELMEZ; form otomatik
 * POST edilir ve asıl sayfa (hosted / banka 3D) ayrı bir URL'de yüklenir.
 */
export function isFormDocumentUrl(url: string | undefined | null, baseUrl: string): boolean {
  const u = String(url ?? '').trim();
  if (u === '' || u.startsWith('about:') || u.startsWith('data:')) return true;
  return stripSlash(u) === stripSlash(baseUrl);
}

/** Sağlayıcı sayfası gerçekten yüklendi mi (form belgesi dışındaki bir URL'de yükleme bitti)? */
export const isProviderPageReady = (url: string | undefined | null, baseUrl: string): boolean =>
  !isFormDocumentUrl(url, baseUrl);

// ── Hata sınıflandırma ───────────────────────────────────────────────────────
export type WebViewErrorEvent = { code?: number | string; description?: string; url?: string; statusCode?: number };

/**
 * onError: KENDİ engellediğimiz/iptal edilen navigasyonlar (iOS -999, Android ERR_ABORTED)
 * gerçek hata DEĞİLDİR (dönüş URL'i bilerek engelleniyor).
 */
export function isBenignWebViewError(e: WebViewErrorEvent): boolean {
  const code = Number(e.code);
  const d = String(e.description ?? '').toLowerCase();
  return code === -999 || d.includes('cancelled') || d.includes('canceled') || d.includes('err_aborted') || d.includes('nsurlerrorcancelled');
}

/**
 * onHttpError: Android alt kaynak (favicon/script) 404'lerini de bildirebilir — YALNIZ ana
 * belge (o an yüklenen üst düzey URL) 4xx/5xx döndüyse ölümcül say.
 */
export function isFatalHttpError(e: WebViewErrorEvent, mainUrl: string | undefined | null): boolean {
  if (!(Number(e.statusCode) >= 400)) return false;
  if (!mainUrl || !e.url) return false;
  return stripSlash(String(e.url)) === stripSlash(String(mainUrl));
}

// ── Yükleme bekçisi (fake timer ile testlenebilir) ────────────────────────────
export type LoadGuard = { start(): void; markReady(): void; stop(): void; isReady(): boolean };

export function createLoadGuard(opts: {
  onTimeout: () => void;
  timeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
}): LoadGuard {
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let handle: unknown = null;
  let ready = false;
  let finished = false;
  const clear = () => { if (handle !== null) { clearTimer(handle); handle = null; } };
  return {
    start() {
      clear();
      ready = false;
      finished = false;
      handle = setTimer(() => {
        handle = null;
        if (!ready && !finished) { finished = true; opts.onTimeout(); }
      }, opts.timeoutMs ?? WEBVIEW_LOAD_TIMEOUT_MS);
    },
    markReady() { ready = true; clear(); },
    stop() { finished = true; clear(); },
    isReady: () => ready,
  };
}

// ── İstek üst sınırları ──────────────────────────────────────────────────────
export class DeadlineError extends Error {
  constructor() { super('deadline'); this.name = 'DeadlineError'; }
}

/** Promise'e üst süre koyar; süre dolarsa DeadlineError ile reddeder (asıl işlem arka planda sürebilir). */
export function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new DeadlineError()), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** fetch + AbortController zaman aşımı. Aşımda AbortError fırlatır. */
export async function fetchWithTimeout(
  url: string,
  init: Record<string, unknown>,
  ms: number,
  fetchFn: (url: string, init: any) => Promise<any> = (u, i) => (globalThis as any).fetch(u, i),
): Promise<any> {
  const controller = new (globalThis as any).AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Kullanıcıya gösterilecek hata metni: ağ/zaman aşımı/İngilizce teknik mesajlar -> Türkçe genel mesaj. */
export function userMessageForError(err: unknown, fallback = CONNECTION_ERROR_MESSAGE): string {
  const name = String((err as { name?: string })?.name ?? '');
  const msg = String((err as { message?: string })?.message ?? '');
  if (name === 'AbortError' || name === 'DeadlineError') return fallback;
  if (/abort|timeout|timed out|network|fetch|failed to|internet|offline/i.test(msg)) return fallback;
  // Sunucu/uygulama mesajları Türkçe; İngilizce teknik mesaj sızmasın.
  if (msg && /[çğıöşüÇĞİÖŞÜ]|\b(lütfen|tekrar|kart|ödeme|oturum)\b/i.test(msg)) return msg;
  return fallback;
}
