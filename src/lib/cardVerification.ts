// "Kart Ekle" (1 TL doğrulama + iade) — istemci tarafı saf iş kuralları.
// Import'suz: Node testlerinde (node:test) doğrudan çalışır. Ekran (AddCardScreen)
// yalnız bunları çağırır; metinler/durum eşlemesi/polling burada test edilir.

/** verify_status / verify_cancel yanıtının kullanıcıya açık alanları (token/kart YOK). */
export type VerificationStatus = {
  status: string;
  card_saved: boolean;
  note: string | null;
  refunded: boolean;
};

export type ResultTone = 'success' | 'info' | 'error';

export type VerificationResult = {
  tone: ResultTone;
  message: string;
  /** Kullanıcı "Tekrar dene" görebilir mi (kart eklenmedi ve deneme mantıklı). */
  canRetry: boolean;
};

// ── Polling ayarları: 2.5 sn aralık, en fazla 60 sn ──────────────────────────
export const POLL_INTERVAL_MS = 2500;
export const POLL_MAX_MS = 60_000;

export const TIMEOUT_MESSAGE = 'Sonuç birazdan görünecek, kartlarını yenileyebilirsin.';
export const LIMIT_MESSAGE = 'Bugünlük deneme hakkın doldu, yarın tekrar dene.';
export const CLOSED_MESSAGE =
  'Kart doğrulaması tamamlanmadı. Ödeme ekranını kapattığın için işlem yarım kaldı ve açık bir doğrulama kaydın duruyor. ' +
  'Yeniden denemek için önce bu kaydı iptal edebilirsin.';

/** Sunucunun retryAfterSeconds değerinden kullanıcıya gösterilecek dakika (en az 1). */
export const minutesFromSeconds = (seconds: unknown): number => {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.ceil(n / 60)) : 1;
};

export const inProgressMessage = (retryAfterSeconds: unknown): string =>
  `Devam eden bir kart doğrulaman var. ${minutesFromSeconds(retryAfterSeconds)} dakika sonra tekrar deneyebilirsin.`;

/** Sonuç ekranı için nihai durum mu? (initiated/succeeded geçici: iade/kart işleme sürüyor.) */
export const isTerminalStatus = (status: string): boolean =>
  status === 'refunded' || status === 'refund_pending' || status === 'refund_failed' || status === 'failed';

/**
 * Durum -> kullanıcı mesajı. KURAL: "iade edildi" YALNIZ status === 'refunded' iken
 * söylenir; iade sürüyorsa ("refund_pending") "kısa süre içinde iade edilecek",
 * 72 saatlik denemeler bittiyse ("refund_failed") "ekibimiz takip ediyor" denir.
 * Başarılı kart kaydı (card_saved) diğer notlara (ör. amount_mismatch) baskındır.
 * Terminal olmayan durum için null döner (polling sürer).
 */
export function resultForStatus(s: VerificationStatus): VerificationResult | null {
  if (s.status === 'failed') {
    if (s.note === 'declined') return { tone: 'error', message: 'Kart doğrulanamadı, tutar çekilmedi.', canRetry: true };
    if (s.note === 'cancelled') return { tone: 'info', message: 'Kart doğrulaması iptal edildi.', canRetry: true };
    // timeout/init_error/bilinmeyen: para çekilmiş olabilir; çekildiyse sistem otomatik iade eder.
    return {
      tone: 'error',
      message: 'Kart doğrulaması tamamlanamadı. Tutar çekildiyse otomatik olarak iade edilir.',
      canRetry: true,
    };
  }
  if (s.status !== 'refunded' && s.status !== 'refund_pending' && s.status !== 'refund_failed') return null;

  const duplicate = !s.card_saved && (s.note === 'duplicate_card' || s.note === 'duplicate_card_delete_failed');
  const notListed = !s.card_saved && s.note === 'card_not_listed';

  if (s.status === 'refunded') {
    if (s.card_saved) return { tone: 'success', message: 'Kartın kaydedildi. 1 TL doğrulama tutarı iade edildi.', canRetry: false };
    if (duplicate) return { tone: 'info', message: 'Bu kart zaten kayıtlı. 1 TL doğrulama tutarı iade edildi.', canRetry: false };
    if (notListed) return { tone: 'error', message: 'Kart kaydedilemedi, tutar iade edildi.', canRetry: true };
    return { tone: 'info', message: 'Doğrulama tamamlandı. 1 TL doğrulama tutarı iade edildi.', canRetry: false };
  }

  // refund_pending | refund_failed — henüz iade edilmedi: "iade edildi" DEME.
  const refundLine =
    s.status === 'refund_pending'
      ? '1 TL doğrulama tutarı kısa süre içinde iade edilecek.'
      : '1 TL doğrulama tutarının iadesi ekibimiz tarafından takip ediliyor.';
  if (s.card_saved) return { tone: 'success', message: `Kartın kaydedildi. ${refundLine}`, canRetry: false };
  if (duplicate) return { tone: 'info', message: `Bu kart zaten kayıtlı. ${refundLine}`, canRetry: false };
  if (notListed) return { tone: 'error', message: `Kart kaydedilemedi. ${refundLine}`, canRetry: false };
  return { tone: 'info', message: `Doğrulama tamamlandı. ${refundLine}`, canRetry: false };
}

// ── Polling ───────────────────────────────────────────────────────────────────
export type PollOutcome =
  | { kind: 'terminal'; status: VerificationStatus; result: VerificationResult }
  | { kind: 'timeout' }
  | { kind: 'aborted' };

export type PollDeps = {
  fetchStatus: () => Promise<VerificationStatus>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  isAborted?: () => boolean;
  intervalMs?: number;
  maxMs?: number;
};

/**
 * verify_status'u aralıkla sorgular; nihai duruma ya da süre sonuna kadar sürer.
 * Geçici ağ/sunucu hatası polling'i DURDURMAZ (bir sonraki turda tekrar denenir) —
 * kullanıcının kartı/parası sunucuda ilerlemeye devam eder.
 * İlk sorgu BEKLEMEDEN yapılır (callback zaten sonuçlanmış olabilir).
 */
export async function pollVerification(deps: PollDeps): Promise<PollOutcome> {
  const interval = deps.intervalMs ?? POLL_INTERVAL_MS;
  const maxMs = deps.maxMs ?? POLL_MAX_MS;
  const startedAt = deps.now();
  for (;;) {
    if (deps.isAborted?.()) return { kind: 'aborted' };
    try {
      const status = await deps.fetchStatus();
      if (deps.isAborted?.()) return { kind: 'aborted' };
      const result = resultForStatus(status);
      if (result) return { kind: 'terminal', status, result };
    } catch {
      // geçici hata: sonraki turda tekrar dene
    }
    if (deps.now() - startedAt + interval > maxMs) return { kind: 'timeout' };
    await deps.sleep(interval);
  }
}

// ── Kart listesi tazeleme bayrağı ─────────────────────────────────────────────
// AddCardScreen bir doğrulama başlattıysa Kayıtlı Kartlar ekranı geri dönüşte
// (buton, geri hareketi ya da donanım geri tuşu fark etmez) listeyi yeniler.
let cardsStale = false;
export const markCardsStale = () => { cardsStale = true; };
export const consumeCardsStale = (): boolean => {
  const v = cardsStale;
  cardsStale = false;
  return v;
};
