// Paylaş sayfası hedefleri — yönlendirme mantığı (G61-S1 md.2). SAF: native modüller
// `ShareDeps` ile enjekte edilir (ShareSheet gerçeklerini verir, testler sahte).
//
// Bu sürümdeki davranış (FinShareNotes "Instagram ve hedefler" + brief):
//  • Instagram Hikâye / Gönderi: doğrudan Stories API'si SONRAKİ mağaza sürümünde. Şimdi:
//    bağlantı panoya kopyalanır (varsa) → görsel (hikâye 9:16 / gönderi 4:5) sistem paylaşım
//    sayfasıyla açılır; kullanıcı Instagram'ı seçer. Galeriye kaydet + instagram:// açma
//    YAPILAMIYOR: expo-media-library pakette yok (yeni paket yasak) → KARAR/LOG.
//  • WhatsApp: bağlantı varsa `whatsapp://send?text=` (metin + bağlantı); açılamazsa ya da
//    bağlantı yoksa görsel sistem paylaşımıyla.
//  • X: `https://x.com/intent/post?text=&url=`; açılamazsa sistem metin paylaşımı.
//  • Bağlantıyı kopyala: expo-clipboard (1.1.0 derlemesinde var).
//  • Kaydet: medya kütüphanesi paketi YOK → hedef gizli (KARAR/LOG).
//  • Diğer: görsel sistem paylaşımı; görsel yoksa metin + bağlantı.

import { shareLink, whatsappUrl, xIntentUrl, type ShareKind, type ShareTarget } from './links';

export type TargetKey = 'ig_story' | 'ig_post' | 'whatsapp' | 'x' | 'copy' | 'save' | 'other';

export const ALL_TARGETS: readonly TargetKey[] = ['ig_story', 'ig_post', 'whatsapp', 'x', 'copy', 'save', 'other'];

/** Görsel gerektiren hedefler (görsel hazırlanırken / hatada pasif). */
export const IMAGE_TARGETS: readonly TargetKey[] = ['ig_story', 'ig_post', 'save'];

/** Hedef → utm_source. */
export const TARGET_UTM: Record<TargetKey, ShareTarget> = {
  ig_story: 'instagram',
  ig_post: 'instagram',
  whatsapp: 'whatsapp',
  x: 'x',
  copy: 'copy',
  save: 'save',
  other: 'other',
};

export type TargetAvailability = {
  /** Bağlantı hedefleri açık mı (bayrak `paylasim_baglanti` + kimlik). */
  hasLink: boolean;
  /** Galeriye kaydetme paketi var mı (bu sürümde YOK). */
  canSaveToLibrary: boolean;
};

/** Sayfada gösterilecek hedefler (sıra tasarımdaki gibi). */
export function visibleTargets(a: TargetAvailability): TargetKey[] {
  return ALL_TARGETS.filter((k) => {
    if (k === 'save') return a.canSaveToLibrary;
    if (k === 'copy' || k === 'x') return a.hasLink;
    return true;
  });
}

export function isTargetDisabled(k: TargetKey, imageReady: boolean): boolean {
  return !imageReady && IMAGE_TARGETS.includes(k);
}

export type ShareDeps = {
  openURL: (url: string) => Promise<void>;
  copy: (text: string) => Promise<void>;
  /** Yerel PNG'yi sistem paylaşım sayfasıyla açar. */
  shareImage: (uri: string) => Promise<void>;
  /** Metin (+ bağlantı) sistem paylaşımı. */
  shareText: (message: string, url?: string | null) => Promise<void>;
  /** İstenen ölçüde kart görselini hazırlar → yerel dosya yolu. */
  getImage: (size: 'story' | 'post') => Promise<string>;
};

export type TargetContext = {
  kind: ShareKind;
  /** Bağlantı kimliği (yoksa bağlantı hedefleri çalışmaz). */
  linkId: string | null;
  /** Mesaj metni (bağlantı hariç). */
  text: string;
  /** Sayfada seçili ölçü (Diğer / WhatsApp görseli için). */
  size: 'story' | 'post';
};

export type TargetResult =
  | { ok: true; outcome: 'copied' | 'opened' | 'shared' | 'instagram' }
  | { ok: false; error: string };

export function linkFor(ctx: TargetContext, target: TargetKey): string | null {
  return ctx.linkId ? shareLink(ctx.kind, ctx.linkId, TARGET_UTM[target]) : null;
}

export async function runTarget(target: TargetKey, ctx: TargetContext, deps: ShareDeps): Promise<TargetResult> {
  try {
    const link = linkFor(ctx, target);
    switch (target) {
      case 'copy': {
        if (!link) return { ok: false, error: 'no_link' };
        await deps.copy(link);
        return { ok: true, outcome: 'copied' };
      }
      case 'ig_story':
      case 'ig_post': {
        if (link) await deps.copy(link).catch(() => undefined);
        const uri = await deps.getImage(target === 'ig_story' ? 'story' : 'post');
        await deps.shareImage(uri);
        return { ok: true, outcome: 'instagram' };
      }
      case 'whatsapp': {
        if (link) {
          try {
            await deps.openURL(whatsappUrl(ctx.text, link));
            return { ok: true, outcome: 'opened' };
          } catch {
            /* WhatsApp yok → sistem paylaşımı */
          }
        }
        try {
          const uri = await deps.getImage(ctx.size);
          await deps.shareImage(uri);
        } catch {
          await deps.shareText(ctx.text, link);
        }
        return { ok: true, outcome: 'shared' };
      }
      case 'x': {
        if (!link) return { ok: false, error: 'no_link' };
        try {
          await deps.openURL(xIntentUrl(ctx.text, link));
          return { ok: true, outcome: 'opened' };
        } catch {
          await deps.shareText(ctx.text, link);
          return { ok: true, outcome: 'shared' };
        }
      }
      case 'save':
        return { ok: false, error: 'save_unavailable' };
      case 'other': {
        try {
          const uri = await deps.getImage(ctx.size);
          await deps.shareImage(uri);
        } catch {
          await deps.shareText(ctx.text, link);
        }
        return { ok: true, outcome: 'shared' };
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'share_failed' };
  }
}
