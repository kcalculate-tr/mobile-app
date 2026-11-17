// G59-S1 — Profil fotoğrafı halkası (kendi profili + PublicProfile): aktif hikâye var mı, görülmemiş mi?
// Bayrak kapalıyken istek atılmaz, halka yok. Paylaşım sonrası (tepsi deposu `postedAt`) yeniden okunur.
import { useCallback, useEffect, useState } from 'react';
import { getStoryClient } from './client';
import { useStoryTray } from './store';
import type { RingState } from './rules';

export function ringFromCounts(count: number, unseen: number, isMe: boolean): RingState {
  if (count <= 0) return 'none';
  if (isMe) return 'seen';
  return unseen > 0 ? 'unseen' : 'seen';
}

export function useStoryRing(userId: string | null | undefined, enabled: boolean, isMe = false): { state: RingState; refresh: () => void } {
  const [state, setState] = useState<RingState>('none');
  const postedAt = useStoryTray((s) => s.postedAt);
  const trayItem = useStoryTray((s) => (userId ? s.items.find((i) => i.user_id === userId) : undefined));
  const refresh = useCallback(() => {
    if (!enabled || !userId) {
      setState('none');
      return;
    }
    getStoryClient()
      .getStoryRing({ user: userId })
      .then((r) => setState(ringFromCounts(r.count, r.unseen, isMe)))
      .catch(() => setState('none'));
  }, [enabled, userId, isMe]);
  useEffect(() => {
    refresh();
  }, [refresh, postedAt]);
  // Tepside görüldü işareti düşünce halka griye döner (ek istek yok).
  useEffect(() => {
    if (trayItem && enabled) setState(ringFromCounts(trayItem.story_count, trayItem.unseen_count, isMe));
  }, [trayItem, enabled, isMe]);
  return { state, refresh };
}
