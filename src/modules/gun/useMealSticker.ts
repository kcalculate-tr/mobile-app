// G29-S1 md.1 — öğün satırı çıkartması: yerel (az önce loglandı) → sticker_path (toplu okuma) →
// imzalı URL (mealPhoto önbelleği, aynı kova). Durum: 'ready' | 'loading' | 'none'.
// Yalnız fotoğraflı (Tara) kayıtlarda sorulur — çıkartma başka kayıtta olmaz.
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../core/supabase';
import { hasMealPhotoFailed, peekMealPhoto, resolveMealPhoto, type SignerClient } from './mealPhoto';
import { loadStickerPath, peekLocalSticker, peekStickerPath, type StickerClient } from '../../lib/sticker/stickerStore';

export type MealStickerState = { status: 'ready'; uri: string } | { status: 'loading' } | { status: 'none' };

function initial(rowId: string | null | undefined): MealStickerState {
  if (!rowId) return { status: 'none' };
  const l = peekLocalSticker(rowId);
  if (l) return { status: 'ready', uri: l };
  const p = peekStickerPath(rowId);
  if (p === null) return { status: 'none' };
  if (p) {
    const hit = peekMealPhoto(p);
    if (hit) return { status: 'ready', uri: hit };
    if (hasMealPhotoFailed(p)) return { status: 'none' };
  }
  return { status: 'loading' };
}

export function useMealSticker(rowId: string | null | undefined): MealStickerState {
  const [state, setState] = useState<MealStickerState>(() => initial(rowId));
  useEffect(() => {
    const first = initial(rowId);
    setState(first);
    if (first.status !== 'loading' || !rowId) return;
    let alive = true;
    const client = getSupabaseClient();
    loadStickerPath(client as unknown as StickerClient, rowId)
      .then((path) => {
        if (!path) return null;
        return resolveMealPhoto(client as unknown as SignerClient, path);
      })
      .then((uri) => {
        if (alive) setState(uri ? { status: 'ready', uri } : { status: 'none' });
      })
      .catch(() => {
        if (alive) setState({ status: 'none' });
      });
    return () => {
      alive = false;
    };
  }, [rowId]);
  return state;
}
