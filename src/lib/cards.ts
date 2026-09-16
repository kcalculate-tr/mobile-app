import { supabase } from './supabase';

const SUPABASE_ANON_KEY = 'sb_publishable_tjeQHxsEgZIObTyf1UHz5Q_Bh4jqS29';
const CARDS_URL = 'https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/paynkolay-cards';

export type SavedCard = {
  id: string;
  last4: string | null;
  brand: string | null;
  bank_name: string | null;
  is_default: boolean;
  created_at: string;
};

type CardsAction = 'status' | 'sync' | 'pay' | 'delete' | 'set_default';

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

// 3sn timeout: yavas ag/soguk-baslangicta status cevabi geciktirmesin —
// timeout/hata durumunda caller (try/catch ile) enabled=false varsayip
// normal odemeyi HEMEN baslatir.
export const getCardsFeatureStatus = () =>
  callCards<{ enabled: boolean }>('status', {}, { timeoutMs: 3000 });

export const syncSavedCards = () =>
  callCards<{ success: true; cards: SavedCard[] }>('sync');

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

export const payWithSavedCard = (orderId: string | number, cardId: string, deviceId: string) =>
  callCards<PayWithSavedCardResult>(
    'pay',
    { orderId: String(orderId), cardId, deviceId },
    { throwOnFailure: false },
  );
