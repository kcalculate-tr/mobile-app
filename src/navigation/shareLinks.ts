// G61-S1 md.3 — paylaşım bağlantılarının uygulama içi rotası (SAF; linking.ts ve testler kullanır).
//
//   l.eatkcal.com/m|d|x/<id> (öğün/gün/röntgen anlık görüntüsü) · /r/<tarif> · /i/<kod> · /s/<UUID>
//   → ShareLink { kind, id }   (mevcut /p/ → SharedPost, /u/ → PublicProfile AYNEN kalır)
//
// `/s/` yalnız UUID ile eşleşir: G20-S2 saha kodu bağlantıları (`/s/<kod>`) React Navigation'a
// girmez (normal açılış + attribution.ts kaynak takibi, bugünkü davranış).
// Rota yalnız `paylasim_baglanti` açıkken kayıtlı; kapalıyken RN bu yolları yok sayar.
import type { ShareKind } from '../lib/share/links';

export const SHARE_LINK_PATH = ':kind(m|d|x|r|i)/:id';
export const SHARE_STORY_PATH = ':kind(s)/:id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})';

export type ShareLinkParams = { kind: string; id: string };

const PREFIX_TO_KIND: Record<string, ShareKind> = { m: 'meal', d: 'day', x: 'xray', r: 'recipe', i: 'invite', s: 'story' };

/** Rota parametresi (önek ya da tür adı) → tür. Bilinmeyen → null. */
export function shareKindFromParam(v: string | null | undefined): ShareKind | null {
  const s = String(v ?? '').toLowerCase();
  if (PREFIX_TO_KIND[s]) return PREFIX_TO_KIND[s];
  return (Object.values(PREFIX_TO_KIND) as string[]).includes(s) ? (s as ShareKind) : null;
}
