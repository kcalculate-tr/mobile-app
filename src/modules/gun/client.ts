// Gün halkası gerçek RPC istemcisi. Erişim/gizlilik SUNUCUDA denetlenir.
// `core/supabase` tembel require ile yüklenir (kesfet/client.ts ile aynı neden:
// Node testlerinde modül import'u Supabase istemcisini kurmasın).
import type { DayCard, DayRing, GunClient } from './types';

type SupabaseModule = typeof import('../../core/supabase');
function sb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../core/supabase') as SupabaseModule).getSupabaseClient();
}

function rpcError(name: string, error: { message: string }): never {
  throw new Error(`${name}: ${error.message}`);
}

export const realGunClient: GunClient = {
  async getDayRings(): Promise<DayRing[]> {
    const { data, error } = await sb().rpc('get_day_rings');
    if (error) rpcError('get_day_rings', error);
    return Array.isArray(data) ? (data as DayRing[]) : [];
  },

  async getDayCards({ user }): Promise<DayCard[]> {
    const { data, error } = await sb().rpc('get_day_cards', { p_user: user });
    if (error) rpcError('get_day_cards', error);
    return Array.isArray(data) ? (data as DayCard[]) : [];
  },

  async shareMealToDay({ consumption }): Promise<void> {
    const { error } = await sb().rpc('share_meal_to_day', { p_consumption: consumption });
    if (error) rpcError('share_meal_to_day', error);
  },

  // SORU (G6-S1'e): bkz. types.ts — `add_day_card_to_day` sözleşmede henüz yok.
  async addDayCardToDay({ card, idempotencyKey }): Promise<{ consumption_id: string }> {
    const { data, error } = await sb().rpc('add_day_card_to_day', {
      p_card: card,
      p_idempotency_key: idempotencyKey,
    });
    if (error) rpcError('add_day_card_to_day', error);
    return data as { consumption_id: string };
  },
};

let activeClient: GunClient = realGunClient;

export function getGunClient(): GunClient {
  return activeClient;
}

export function setGunClient(client: GunClient): void {
  activeClient = client;
}

export function resetGunClient(): void {
  activeClient = realGunClient;
}
