// Gün halkası mock sağlayıcı — __DEV__ deneme ekranı ve testler için. Bellek içi,
// deterministik. share → ilgili consumption'ı "paylaşıldı" sayar ve yeni kart üretir.
import type { DayCard, DayRing, GunClient } from './types';
import type { MealType } from '../kesfet/types';

function sampleRing(i: number, isMe: boolean): DayRing {
  return {
    user: {
      id: isMe ? 'me' : `user-${i}`,
      display_name: isMe ? 'Ben' : ['Elif', 'Can', 'Deniz'][i % 3],
      avatar_url: null,
    },
    progress: Math.min(1, 0.3 + i * 0.2),
    streak: i,
    has_new: i % 2 === 1,
  };
}

function sampleCard(user: string, i: number): DayCard {
  const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  return {
    id: `daycard-${user}-${i}`,
    consumption_id: `consumption-${user}-${i}`,
    name: ['Yulaf', 'Izgara tavuk', 'Somon', 'Badem'][i % 4],
    meal_type: meals[i % 4],
    consumed_at: `2026-11-03T0${(i % 8) + 1}:30:00.000Z`,
    photo_url: null,
    kcal: 180 + i * 40,
    protein_g: 8 + i * 3,
  };
}

export function createMockGunClient(options: { ringCount?: number; cardCount?: number } = {}): GunClient & {
  _shared: Set<string>;
} {
  const ringCount = options.ringCount ?? 4;
  const cardCount = options.cardCount ?? 3;
  const rings: DayRing[] = Array.from({ length: ringCount }, (_, i) => sampleRing(i, i === 0));
  const shared = new Set<string>();

  return {
    _shared: shared,

    async getDayRings(): Promise<DayRing[]> {
      return rings.map((r) => ({ ...r, user: { ...r.user } }));
    },

    async getDayCards({ user }): Promise<DayCard[]> {
      const base = Array.from({ length: cardCount }, (_, i) => sampleCard(user, i));
      // Paylaşılan ek consumption'lar da görünür.
      const extra: DayCard[] = Array.from(shared)
        .filter((c) => c.startsWith(`consumption-${user}`))
        .map((c, i) => ({ ...sampleCard(user, cardCount + i), consumption_id: c }));
      return [...base, ...extra];
    },

    async shareMealToDay({ consumption }): Promise<void> {
      shared.add(consumption);
    },
  };
}

export const mockGunClient = createMockGunClient();
