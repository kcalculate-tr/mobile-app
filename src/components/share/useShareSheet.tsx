// G61-S1 md.5 — paylaş sayfası giriş kancası (FinShareEntry'nin 6 giriş noktası bunu kullanır).
//
// Bayraklar (KARAR, G61-S1 LOG): yeni sayfa YALNIZ `paylasim_karti` VE `paylasim_baglanti` ikisi de
// açıkken. Biri kapalıysa `enabled=false`, `node=null` → çağıran bugünkü davranışını AYNEN sürdürür
// (karti açık + bağlantı kapalı = eski ShareMealCard / PlateXRay modalları; bağlantı açık + karti
// kapalı = bugünkü Share.share). Gerekçe: `paylasim_karti` G5'ten beri var ve canlı durumu bu
// oturumda okunamadı — OTA ile eski modalların kendiliğinden değişmemesi için ikinci anahtar şart.
import React, { useCallback, useState } from 'react';
import { useFeature } from '../../core/flags';
import type { ShareCardInput } from '../../lib/share/cardModel';
import { sanitizeCard } from '../../lib/share/cardModel';
import ShareSheet from './ShareSheet';

type Req = { input: ShareCardInput; linkId: string | null };

export function useShareSheet(surface: string): {
  enabled: boolean;
  linkEnabled: boolean;
  open: (input: ShareCardInput, linkId?: string | null) => void;
  node: React.ReactNode;
} {
  const karti = useFeature('paylasim_karti');
  const linkEnabled = useFeature('paylasim_baglanti');
  const enabled = karti && linkEnabled;
  const [req, setReq] = useState<Req | null>(null);
  const [visible, setVisible] = useState(false);

  const open = useCallback((input: ShareCardInput, linkId?: string | null) => {
    // Her giriş beyaz listeden geçer (çağıran fazla alan verse de karta gitmez).
    const clean = { kind: input.kind, data: sanitizeCard(input.kind, input.data as Record<string, unknown>) } as ShareCardInput;
    setReq({ input: clean, linkId: linkId ?? null });
    setVisible(true);
  }, []);

  const node = enabled ? (
    <ShareSheet
      visible={visible && req != null}
      onClose={() => setVisible(false)}
      input={req?.input ?? null}
      linkId={req?.linkId ?? null}
      linkEnabled={linkEnabled}
      surface={surface}
    />
  ) : null;

  return { enabled, linkEnabled, open, node };
}

/** Keşfet gönderisi → kart girdisi (yalnız herkese açık alanlar; sayaçlar yok). */
export function postShareInput(post: {
  author: { display_name?: string | null; handle?: string | null };
  body?: string | null;
  media?: { url: string; kind?: string | null }[] | null;
}): ShareCardInput {
  const img = (post.media ?? []).find((m) => !m.kind || m.kind === 'image');
  return {
    kind: 'post',
    data: {
      authorName: post.author.display_name ?? '',
      handle: post.author.handle ?? null,
      text: post.body ?? '',
      imageUri: img?.url ?? null,
    },
  };
}
