// G18-S2 md.3 + md.6b — Ana sayfa "Öne çıkanlar" banner şeridi (FinHomeR3 a,
// FinMoBanner) verisi. SAF kurucu + değiştirilebilir sağlayıcı.
//
// Sıra (FinMoBanner "Sıra"): 1 Haftanın tarifi → gönderi detayı (FinDetail; SON_HAL
// İSTİSNA 4) · 2 Keşfet'te öne çıkan → gönderi detayı · 3 Etkinlik → gönderi detayı
// (FinActivityCard) · 4 eatkcal kampanyası → eatkcal (YALNIZ İzmir).
// Yeni kullanıcı (boş gün): yalnız 1 ve 2. Kural: her kartın gerçek görseli olur;
// görsel/veri yoksa kart yok, hiç kart yoksa bölüm yok (uydurma yok).
//
// Kaynaklar (mevcut): Keşfet akışı (get_feed 'for_you') — tarif = görselli 'ogun'
// gönderisi (meal_card'lı), öne çıkan = en çok beğenilen görselli diğer gönderi,
// etkinlik = görselli 'etkinlik' gönderisi; kampanya = app_banners (tek slot, RLS
// tarih penceresi) yoksa BossVitrin banner_cells (hero/promo) görselli ilk hücre.
import type { FeedPost } from '../../kesfet/types';

export type BannerKind = 'recipe' | 'featured' | 'activity' | 'campaign';

export interface HomeBannerItem {
  kind: BannerKind;
  id: string;
  image: string;
  /** Kart başlığı (gerçek içerik). */
  title: string;
  /** Alt satır (gerçek içerik; yoksa i18n varsayılanı). */
  meta: string | null;
  /** Hedef: gönderi detayı ya da eatkcal. */
  target: { type: 'post'; postId: string } | { type: 'eatkcal'; link: string | null };
}

export interface CampaignSource {
  id: string;
  title: string | null;
  subtitle: string | null;
  image: string | null;
  link: string | null;
}

export interface BannerInputs {
  posts: FeedPost[];
  campaign: CampaignSource | null;
  izmir: boolean;
  /** Gün boş / ilk kullanım: yalnız tarif + Keşfet. */
  isNew: boolean;
}

function postImage(p: FeedPost): string | null {
  const m = p.media?.[0];
  if (!m) return null;
  if (m.kind === 'video') return m.thumb_path || null;
  return m.url || null;
}

function firstLine(s: string | null | undefined): string {
  return String(s ?? '')
    .split('\n')[0]
    .trim();
}

const byLikes = (a: FeedPost, b: FeedPost) => (b.stats?.likes ?? 0) - (a.stats?.likes ?? 0);

export function buildHomeBanners({ posts, campaign, izmir, isNew }: BannerInputs): HomeBannerItem[] {
  const usable = (posts ?? []).filter((p) => p && p.status !== 'removed' && p.status !== 'pending' && !!postImage(p));
  const used = new Set<string>();
  const out: HomeBannerItem[] = [];

  const recipe = usable.filter((p) => p.post_type === 'ogun' && p.meal_card && p.meal_card.name).sort(byLikes)[0];
  if (recipe) {
    used.add(recipe.id);
    out.push({
      kind: 'recipe',
      id: `recipe-${recipe.id}`,
      image: postImage(recipe)!,
      title: recipe.meal_card!.name,
      meta: null,
      target: { type: 'post', postId: recipe.id },
    });
  }

  const featured = usable
    .filter((p) => !used.has(p.id) && p.post_type !== 'etkinlik' && (firstLine(p.body) || p.meal_card?.name))
    .sort(byLikes)[0];
  if (featured) {
    used.add(featured.id);
    out.push({
      kind: 'featured',
      id: `featured-${featured.id}`,
      image: postImage(featured)!,
      title: firstLine(featured.body) || featured.meal_card!.name,
      meta: featured.author?.display_name || null,
      target: { type: 'post', postId: featured.id },
    });
  }

  if (!isNew) {
    const activity = usable.filter((p) => !used.has(p.id) && p.post_type === 'etkinlik' && (firstLine(p.body) || p.activity_card)).sort(byLikes)[0];
    if (activity) {
      out.push({
        kind: 'activity',
        id: `activity-${activity.id}`,
        image: postImage(activity)!,
        title: firstLine(activity.body),
        meta: null,
        target: { type: 'post', postId: activity.id },
      });
    }
    if (izmir && campaign && campaign.image && (campaign.title || '').trim()) {
      out.push({
        kind: 'campaign',
        id: `campaign-${campaign.id}`,
        image: campaign.image,
        title: campaign.title!.trim(),
        meta: campaign.subtitle?.trim() || null,
        target: { type: 'eatkcal', link: campaign.link },
      });
    }
  }
  // Başlıksız etkinlik (yalnız kart verisi) gösterilmez — başlık uydurulmaz.
  return out.filter((b) => b.title.length > 0);
}

/** Kaydırma konumundan etkin kart (kart 361 + aralık 12 = 373 adım). SAF. */
export function bannerIndexFromOffset(x: number, step: number, n: number): number {
  if (n <= 0 || step <= 0) return 0;
  return Math.max(0, Math.min(n - 1, Math.round(x / step)));
}
