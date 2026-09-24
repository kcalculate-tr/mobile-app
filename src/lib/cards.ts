import { supabase } from './supabase';
import { VerificationStatus } from './cardVerification';

const SUPABASE_ANON_KEY = 'sb_publishable_tjeQHxsEgZIObTyf1UHz5Q_Bh4jqS29';
const CARDS_URL = 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/paynkolay-cards';

export type SavedCard = {
  id: string;
  last4: string | null;
  brand: string | null;
  bank_name: string | null;
  /** Kullanicinin PaynKolay sayfasinda verdigi kart adi ("Enpara", "Bonus garanti"). */
  card_alias: string | null;
  is_default: boolean;
  created_at: string;
};

type CardsAction = 'status' | 'sync' | 'pay' | 'delete' | 'set_default' | 'verify_start' | 'verify_status' | 'verify_cancel';

async function callCards<T>(
  action: CardsAction,
  params: Record<string, unknown> = {},
  opts: { throwOnFailure?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Oturum bulunamadı');

  const controller = opts.timeoutMs ? new AbortController() : undefined;
  const timer = opts.timeoutMs ? setTimeout(() => controller!.abort(), opts.timeoutMs) : undefined;

  let res: Response;
  try {
    res = await fetch(CARDS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action, ...params }),
      signal: controller?.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error('Sunucudan geçersiz yanıt alındı.');
  }

  // pay: business-logic sonuçları (basarisiz/pending) exception DEGIL, veri
  // olarak dondurulur — caller .success/.pending/.error'a bakarak karar verir.
  const throwOnFailure = opts.throwOnFailure ?? true;
  if (throwOnFailure && (!res.ok || json?.success === false)) {
    throw new Error(json?.error || 'İşlem tamamlanamadı.');
  }
  return json as T;
}

// 24.09.2026 — ust sureler gercekle hizalandi. ESKI DURUM tersiydi:
// 'status' (tek DB okumasi, ucuz) 3 sn ile sinirliydi, 'sync' (PaynKolay
// CardStorageCardList'e CANLI istek + birkac DB turu) HIC sinirli degildi.
// Sonuc: edge function soguk baslangici 3 sn'yi asinca status "hata" sayilip
// Odeme Yontemi bolumu hic gorunmuyordu; PaynKolay yavaslayinca da sync
// sonsuza kadar asili kaliyordu.
//
// 8 sn: bu cagri Siparis Ozeti ACILIRKEN yapiliyor, odeme aninda degil —
// kullaniciyi bekleten bir sey yok, soguk baslangica yer birakmak dogru.
export const getCardsFeatureStatus = () =>
  callCards<{ enabled: boolean }>('status', {}, { timeoutMs: 8000 });

// 12 sn: PaynKolay'a canli istek var. Sinirsiz birakilirsa kart listesi
// "sonsuza kadar yukleniyor" durumunda kalir.
export const syncSavedCards = () =>
  callCards<{ success: true; cards: SavedCard[]; synced: boolean; procReturnCode?: string; errMsg?: string }>(
    'sync', {}, { timeoutMs: 12000 },
  );

export const setDefaultCard = (cardId: string) =>
  callCards<{ success: true }>('set_default', { cardId });

export const deleteSavedCard = (cardId: string) =>
  callCards<{ success: true }>('delete', { cardId });

export type PayWithSavedCardResult = {
  success: boolean;
  requires3D?: boolean;
  formHtml?: string;
  alreadyPaid?: boolean;
  pending?: boolean;
  error?: string;
};

export const payWithSavedCard = (orderId: string | number, cardId: string) =>
  callCards<PayWithSavedCardResult>(
    'pay',
    { orderId: String(orderId), cardId },
    // Üst süre: sağlayıcı takılırsa "ödeme sayfası hazırlanıyor" sonsuza kadar sürmez (AbortError -> Türkçe mesaj).
    { throwOnFailure: false, timeoutMs: 25000 },
  );

// ── Kart Ekle (1 TL doğrulama + iade) ─────────────────────────────────────────
export type StartVerificationResult =
  | { kind: 'started'; verificationId: string; formHtml: string }
  | { kind: 'in_progress'; verificationId?: string; retryAfterSeconds?: number }
  | { kind: 'limit' }
  | { kind: 'error'; message: string };

/** 409/429 iş kuralı yanıtları exception DEĞİL, veri olarak döner. */
export async function startCardVerification(): Promise<StartVerificationResult> {
  const json = await callCards<{
    success?: boolean;
    verificationId?: string;
    formHtml?: string;
    inProgress?: boolean;
    limitReached?: boolean;
    retryAfterSeconds?: number;
    error?: string;
  }>('verify_start', {}, { throwOnFailure: false, timeoutMs: 20000 });
  if (json.inProgress) {
    return { kind: 'in_progress', verificationId: json.verificationId, retryAfterSeconds: json.retryAfterSeconds };
  }
  if (json.limitReached) return { kind: 'limit' };
  if (json.success === true && json.verificationId && typeof json.formHtml === 'string') {
    return { kind: 'started', verificationId: json.verificationId, formHtml: json.formHtml };
  }
  return { kind: 'error', message: json.error || 'İşlem başlatılamadı. Lütfen tekrar dene.' };
}

export const getVerificationStatus = (verificationId: string) =>
  callCards<{ success: true } & VerificationStatus>('verify_status', { verificationId }, { timeoutMs: 10000 });

/**
 * Kendi açık doğrulamasını iptal eder (kayıt failed/cancelled olur). Kayıt bu arada
 * tamamlandıysa `cancelled=false` ve gerçek durum alanları döner.
 */
export const cancelCardVerification = (verificationId?: string) =>
  callCards<{ success: true; cancelled: boolean } & Partial<VerificationStatus>>(
    'verify_cancel',
    verificationId ? { verificationId } : {},
    { timeoutMs: 10000 },
  );
