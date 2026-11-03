// Gizli hesap içerik görünürlüğü — SAF mantık (native/ağ yok). Kendi profilin
// her zaman görünür; gizli hesaplarda yalnız onaylı takipçi ("following")
// içeriği görür (G5-CONTRACT.md "Gizlilik her yerde aynı").
import type { FollowState } from './types';

export function canViewProfileContent(
  profile: { is_private: boolean },
  meFollowing: FollowState,
  isMe: boolean,
): boolean {
  if (isMe) return true;
  if (!profile.is_private) return true;
  return meFollowing === 'following';
}
