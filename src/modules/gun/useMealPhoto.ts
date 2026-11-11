// G28-S1 md.2 — satır küçük görseli: yol → imzalı URL (önbellekli). Durum: 'ready' | 'loading' | 'none'.
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../core/supabase';
import { hasMealPhotoFailed, peekMealPhoto, resolveMealPhoto, type SignerClient } from './mealPhoto';

export type MealPhotoState = { status: 'ready'; uri: string } | { status: 'loading' } | { status: 'none' };

export function useMealPhoto(path: string | null | undefined): MealPhotoState {
  const [state, setState] = useState<MealPhotoState>(() => {
    const hit = peekMealPhoto(path);
    if (hit) return { status: 'ready', uri: hit };
    return path && !hasMealPhotoFailed(path) ? { status: 'loading' } : { status: 'none' };
  });
  useEffect(() => {
    if (!path || hasMealPhotoFailed(path)) {
      setState({ status: 'none' });
      return;
    }
    const hit = peekMealPhoto(path);
    if (hit) {
      setState({ status: 'ready', uri: hit });
      return;
    }
    let alive = true;
    setState({ status: 'loading' });
    resolveMealPhoto(getSupabaseClient() as unknown as SignerClient, path)
      .then((uri) => {
        if (alive) setState(uri ? { status: 'ready', uri } : { status: 'none' });
      })
      .catch(() => {
        if (alive) setState({ status: 'none' });
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return state;
}
