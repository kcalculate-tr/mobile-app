// Hangi kutlamanin gosterilecegini seceen + her birinin OMUR BOYU bir kez
// atesleneceeini garanti eden mantik. "Gosterildi" haritasi AsyncStorage'da
// `@kcal_celebrate_shown` altinda tutulur.
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CelebrateMoment } from './types';
import { celebrateStorageKey, markShown } from '../gun/track/streak';

// G19-S2 md.4: anahtar kullanıcıya özel (`@kcal_celebrate_shown:<uid>`); eski
// ortak anahtar (G13) okunur ve birleştirilir → yükseltmede kutlama tekrar çıkmaz.
const LEGACY_KEY = '@kcal_celebrate_shown';

/** AsyncStorage'da tutulan "gosterildi" haritasi (an -> true). */
type ShownMap = Record<string, boolean>;

/**
 * SAF secici — yan etki yok, test edilebilir.
 * Oncelik: first > streak7 > streak3 > null.
 *  - isFirstMeal && !shown.first                 -> 'first'
 *  - streak >= 7 && !shown.streak7               -> 'streak7'  (streak3'ten once)
 *  - streak >= 3 && !shown.streak3               -> 'streak3'
 *  - aksi halde                                  -> null
 */
export function pickCelebration(input: {
  isFirstMeal: boolean;
  streak: number;
  shown: ShownMap;
}): CelebrateMoment | null {
  const { isFirstMeal, streak, shown } = input;
  if (isFirstMeal && !shown.first) return 'first';
  if (streak >= 7 && !shown.streak7) return 'streak7';
  if (streak >= 3 && !shown.streak3) return 'streak3';
  return null;
}

async function readMap(key: string): Promise<ShownMap> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ShownMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // Depolama yoksa/okunamazsa (test/SSR) bos harita ile devam.
    return {};
  }
}

async function loadShown(userId: string | null): Promise<ShownMap> {
  const own = await readMap(celebrateStorageKey(userId));
  if (!userId) return own;
  return { ...(await readMap(LEGACY_KEY)), ...own };
}

async function saveShown(userId: string | null, map: ShownMap): Promise<void> {
  try {
    await AsyncStorage.setItem(celebrateStorageKey(userId), JSON.stringify(map));
  } catch {
    // Yazilamazsa sessizce gec — kutlama yine de tek sefer bellekte isaretli.
  }
}

export interface CelebrationsApi {
  /** Siradaki kutlama (yoksa null). CelebrateOverlay bunu dinler. */
  pending: CelebrateMoment | null;
  /** Girdiyi degerlendir, uygun kutlamayi pending'e koy. */
  evaluate(input: { isFirstMeal: boolean; streak: number }): Promise<void>;
  /** Kutlamayi gosterildi isaretle + kalici yap + pending'i temizle. */
  dismiss(moment: CelebrateMoment): Promise<void>;
  /** G19-S2: kutlama ekrana geldigi AN kalici isaret (kapatmayi beklemeden). */
  markSeen(moment: CelebrateMoment): Promise<void>;
}

/**
 * Kutlama durumu hook'u. Mount'ta "gosterildi" haritasini yukler; evaluate()
 * pickCelebration ile pending'i belirler; dismiss() an'i kalici olarak
 * isaretler ve pending'i temizler. Depolama try/catch ile korunur (test/SSR).
 */
export function useCelebrations(userId: string | null = null): CelebrationsApi {
  const shownRef = useRef<ShownMap>({});
  const [pending, setPending] = useState<CelebrateMoment | null>(null);

  useEffect(() => {
    let alive = true;
    loadShown(userId).then((m) => {
      if (alive) shownRef.current = m;
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const evaluate = useCallback<CelebrationsApi['evaluate']>(async (input) => {
    // Her degerlendirmede en guncel haritayi oku (baska sekme/olay yazmis olabilir).
    shownRef.current = await loadShown(userId);
    const next = pickCelebration({ ...input, shown: shownRef.current });
    setPending(next);
  }, [userId]);

  const markSeen = useCallback<CelebrationsApi['markSeen']>(async (moment) => {
    const next = markShown(shownRef.current, moment);
    shownRef.current = next;
    await saveShown(userId, next);
  }, [userId]);

  const dismiss = useCallback<CelebrationsApi['dismiss']>(async (moment) => {
    const next = markShown(shownRef.current, moment);
    shownRef.current = next;
    setPending((cur) => (cur === moment ? null : cur));
    await saveShown(userId, next);
  }, [userId]);

  return { pending, evaluate, dismiss, markSeen };
}
