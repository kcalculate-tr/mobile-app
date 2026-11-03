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
}

// İstemci arayüzü — gerçek RPC (client.ts) ve mock (mock.ts) uygular.
export interface GunClient {
  // get_day_rings() → ilk öğe daima "ben".
  getDayRings(): Promise<DayRing[]>;
  // get_day_cards(p_user) → erişim süresi SUNUCUDA denetlenir (son 24 saat).
  getDayCards(params: { user: string }): Promise<DayCard[]>;
  // share_meal_to_day(p_consumption) → void.
  shareMealToDay(params: { consumption: string }): Promise<void>;
}
