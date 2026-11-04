// Hangi kutlamanin gosterilecegini seceen + her birinin OMUR BOYU bir kez
// atesleneceeini garanti eden mantik. "Gosterildi" haritasi AsyncStorage'da
// `@kcal_celebrate_shown` altinda tutulur.
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CelebrateMoment } from './types';

const STORAGE_KEY = '@kcal_celebrate_shown';

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

async function loadShown(): Promise<ShownMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ShownMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // Depolama yoksa/okunamazsa (test/SSR) bos harita ile devam.
    return {};
  }
}

async function saveShown(map: ShownMap): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
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
}

/**
 * Kutlama durumu hook'u. Mount'ta "gosterildi" haritasini yukler; evaluate()
 * pickCelebration ile pending'i belirler; dismiss() an'i kalici olarak
 * isaretler ve pending'i temizler. Depolama try/catch ile korunur (test/SSR).
 */
export function useCelebrations(): CelebrationsApi {
  const shownRef = useRef<ShownMap>({});
  const [pending, setPending] = useState<CelebrateMoment | null>(null);

  useEffect(() => {
    let alive = true;
    loadShown().then((m) => {
      if (alive) shownRef.current = m;
    });
    return () => {
      alive = false;
    };
  }, []);

  const evaluate = useCallback<CelebrationsApi['evaluate']>(async (input) => {
    // Her degerlendirmede en guncel haritayi oku (baska sekme/olay yazmis olabilir).
    shownRef.current = await loadShown();
    const next = pickCelebration({ ...input, shown: shownRef.current });
    setPending(next);
  }, []);

  const dismiss = useCallback<CelebrationsApi['dismiss']>(async (moment) => {
    const next = { ...shownRef.current, [moment]: true };
    shownRef.current = next;
    setPending((cur) => (cur === moment ? null : cur));
    await saveShown(next);
  }, []);

  return { pending, evaluate, dismiss };
}
