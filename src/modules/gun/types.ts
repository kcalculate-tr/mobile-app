// Gün halkası tipleri — G5-CONTRACT.md "Gün halkası (S2)" bölümünü birebir yansıtır.
import type { MealType } from '../kesfet/types';

export interface DayRingUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface DayRing {
  user: DayRingUser;
  progress: number; // 0–1
  streak: number;
  has_new: boolean;
}

export interface DayCard {
  id: string;
  consumption_id: string;
  name: string;
  meal_type: MealType;
  consumed_at: string; // ISO
  photo_url: string | null;
  kcal: number;
  protein_g: number;
  // SORU (G6-S1'e): G5-CONTRACT.md'deki get_day_cards imzasında yok — GunViewer
  // tasarımı (T20GunView) P/K/Y'nin HER ZAMAN göründüğünü gösteriyor. Sunucu
  // ekleyene kadar İSTEĞE BAĞLI; UI alan yoksa "—" gösterir.
  carbs_g?: number | null;
  fat_g?: number | null;
}

// İstemci arayüzü — gerçek RPC (client.ts) ve mock (mock.ts) uygular.
export interface GunClient {
  // get_day_rings() → ilk öğe daima "ben".
  getDayRings(): Promise<DayRing[]>;
  // get_day_cards(p_user) → erişim süresi SUNUCUDA denetlenir (son 24 saat).
  getDayCards(params: { user: string }): Promise<DayCard[]>;
  // share_meal_to_day(p_consumption) → void.
  shareMealToDay(params: { consumption: string }): Promise<void>;
  // add_day_card_to_day(p_card, p_meal_type, p_portion, p_idempotency_key)
  // → { consumption_id } (G6-CONTRACT "G7 ekleri", migration 20261104001100).
  // Kartı görebilen kullanıcı başkasının paylaştığı kartı kendi günlüğüne ekler;
  // değerler karttaki anlık değerlerin porsiyonla ölçeği; source='day_card'.
  // `mealType` istemci kodudur; client.ts sunucu koduna çevirir. idempotencyKey
  // zorunlu (source_ref). portion verilmezse 1.
  addDayCardToDay(params: {
    card: string;
    mealType: string;
    portion?: number;
    idempotencyKey: string;
  }): Promise<{ consumption_id: string }>;
}
