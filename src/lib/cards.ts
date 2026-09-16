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

type CardsAction = 'sync' | 'pay' | 'delete' | 'set_default';

async function callCards<T>(action: CardsAction, params: Record<string, unknown> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Oturum bulunamadı');

  const res = await fetch(CARDS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...params }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || 'İşlem tamamlanamadı.');
  }
  return json as T;
}

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
  error?: string;
};

export const payWithSavedCard = (orderId: string | number, cardId: string, deviceId: string) =>
  callCards<PayWithSavedCardResult>('pay', { orderId: String(orderId), cardId, deviceId });
