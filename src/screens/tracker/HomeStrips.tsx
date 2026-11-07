// HomeStrips — FinHomeR3 alt bölümleri (yeni kabuk, G15-S2 m.2):
//  • eatkcal yatay şeridi: başlık "eatkcal" + teslim süresi (seçili adresin
//    bölgesinden, varsa) + "Tümü"; 248×160 foto kartlar, ad, "kcal · ₺fiyat".
//  • Keşfet video şeridi: başlık "Keşfet" + "Tümü"; 3 sütun 9:16 kare, oynat
//    rozeti, başlık (gönderi metninin ilk satırı).
//
// Veri GERÇEK: eatkcal → mevcut fetchProducts (menü, salt okuma) + mevcut
// useDeliveryChip; Keşfet → mevcut Keşfet istemcisi getFeed. Veri yoksa
// bölüm HİÇ çizilmez (uydurma yok). Bayrak KAPALIYKEN TrackerScreen bu
// bileşenleri render etmez.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { CachedImage } from '../../components/CachedImage';
import { fetchProducts } from '../../lib/products';
import { getEffectivePrice } from '../../utils/price';
import { getKesfetClient, type FeedPost } from '../../modules/kesfet';
import { useDeliveryChip } from '../../modules/eatkcal/v2/ui/home/useDeliveryChip';
import type { Product } from '../../types';

export interface HomeDish {
  id: string;
  name: string;
  kcal: number | null;
  price: number | null;
  photo: string | null;
}
export interface HomeVideo {
  id: string;
  title: string;
  thumb: string | null;
}

/** Ürün listesinden şerit kartları (aktif, fiyatlı; sıralı ilk 6). SAF. */
export function dishesFromProducts(list: Product[], max = 6): HomeDish[] {
  return (list ?? [])
    .filter((p) => p && (p as { is_active?: boolean }).is_active !== false && p.is_available !== false && Number(p.price) > 0)
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
    .slice(0, max)
    .map((p) => {
      const kcal = Number(p.calories ?? p.cal);
      return {
        id: String(p.id),
        name: p.name,
        kcal: Number.isFinite(kcal) && kcal > 0 ? Math.round(kcal) : null,
        price: getEffectivePrice(p) || null,
        photo: p.img || null,
      };
    });
}

/** Akıştan video kareleri: önce video gönderileri, yoksa medyalı gönderiler; en çok 3. SAF. */
export function videosFromFeed(items: FeedPost[], max = 3): HomeVideo[] {
  const withMedia = (items ?? []).filter((p) => p.media && p.media.length > 0);
  const videos = withMedia.filter((p) => p.media[0].kind === 'video');
  const pick = (videos.length > 0 ? videos : withMedia).slice(0, max);
  return pick.map((p) => ({
    id: p.id,
    title: (p.body || p.meal_card?.name || '').split('\n')[0].trim(),
    thumb: p.media[0].kind === 'video' ? p.media[0].thumb_path ?? null : p.media[0].url,
  }));
}

// Vitrin (yalnız __DEV__) Final örneğini besleyebilsin diye veri sağlayıcı.
type Provider = {
  dishes: () => Promise<HomeDish[]>;
  videos: (lang: string) => Promise<HomeVideo[]>;
  /** Yalnız vitrin: teslim süresi + şehir (gerçekte seçili adresin bölgesinden). */
  eta?: string | null;
  city?: string | null;
};
const realProvider: Provider = {
  dishes: async () => dishesFromProducts(await fetchProducts()),
  videos: async (lang) => videosFromFeed((await getKesfetClient().getFeed({ tab: 'for_you', lang, limit: 12 })).items),
};
let provider: Provider = realProvider;
export function setHomeStripsProvider(p: Provider | null): void {
  provider = p ?? realProvider;
}

function SectionHead({ title, sub, onAll }: { title: string; sub?: string | null; onAll: () => void }) {
  const { t: tt } = useT();
  return (
    <View style={styles.head}>
      <View style={styles.headLeft}>
        <AppText textRole="section" accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
        {sub ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.headSub}>
            {sub}
          </AppText>
        ) : null}
      </View>
      <Pressable onPress={onAll} accessibilityRole="link" hitSlop={4} style={styles.all}>
        <AppText style={styles.allText}>{tt('gun.see_all')}</AppText>
      </Pressable>
    </View>
  );
}

export function HomeEatkcalStrip({ onAll, onOpen }: { onAll: () => void; onOpen: (productId: string) => void }) {
  const t = useTheme();
  const { t: tt, lang } = useT();
  const [dishes, setDishes] = useState<HomeDish[]>([]);
  const { address, chip } = useDeliveryChip();
  useEffect(() => {
    let alive = true;
    provider
      .dishes()
      .then((d) => alive && setDishes(d))
      .catch(() => alive && setDishes([]));
    return () => {
      alive = false;
    };
  }, []);
  if (dishes.length === 0) return null;
  const eta = provider.eta !== undefined ? provider.eta : chip?.estimate ?? null;
  const city = provider.city !== undefined ? provider.city : (address as { city?: string | null } | null)?.city || null;
  const sub = eta ? (city ? tt('gun.eat_eta_city', { city, eta }) : eta) : null;
  const ph = t.isDark ? '#3A3A3C' : '#DCDEE2';
  const nf = (n: number) => groupNum(n, lang === 'en' ? 'en' : 'tr');
  return (
    <View style={styles.section} accessibilityLabel="eatkcal">
      <SectionHead title="eatkcal" sub={sub} onAll={onAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dishRow}>
        {dishes.map((d) => {
          const meta = [d.kcal != null ? tt('gun.item_kcal', { kcal: nf(d.kcal) }) : null, d.price != null ? `₺${nf(Math.round(d.price))}` : null]
            .filter(Boolean)
            .join(', ');
          return (
            <Pressable key={d.id} onPress={() => onOpen(d.id)} accessibilityRole="button" accessibilityLabel={`${d.name}, ${meta}`} style={styles.dish}>
              <View style={[styles.dishPhoto, { backgroundColor: ph }]}>
                {d.photo ? <CachedImage uri={d.photo} style={StyleSheet.absoluteFill} /> : null}
              </View>
              <View style={styles.dishText}>
                <AppText numberOfLines={1} style={styles.dishName}>
                  {d.name}
                </AppText>
                {meta ? (
                  <AppText variant="caption" tone="secondary" numberOfLines={1}>
                    {meta}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function HomeExploreStrip({ onAll, onOpen }: { onAll: () => void; onOpen: (postId: string) => void }) {
  const t = useTheme();
  const { t: tt, lang } = useT();
  const [videos, setVideos] = useState<HomeVideo[]>([]);
  useEffect(() => {
    let alive = true;
    provider
      .videos(lang)
      .then((v) => alive && setVideos(v))
      .catch(() => alive && setVideos([]));
    return () => {
      alive = false;
    };
  }, [lang]);
  if (videos.length === 0) return null;
  const ph = t.isDark ? '#3A3A3C' : '#DCDEE2';
  const card = t.isDark ? '#1C1C1E' : '#FFFFFF';
  return (
    <View style={styles.section} accessibilityLabel={tt('gun.explore')}>
      <SectionHead title={tt('gun.explore')} onAll={onAll} />
      <View style={styles.grid}>
        {videos.map((v) => (
          <Pressable key={v.id} onPress={() => onOpen(v.id)} accessibilityRole="button" accessibilityLabel={v.title} style={styles.cell}>
            <View style={[styles.video, { backgroundColor: ph }]}>
              {v.thumb ? <CachedImage uri={v.thumb} style={StyleSheet.absoluteFill} /> : null}
              <View style={[styles.play, { backgroundColor: card }]}>
                <Svg width={12} height={12} viewBox="0 0 24 24">
                  <Path d="M7 4.5v15l13-7.5Z" fill={t.color.ink} />
                </Svg>
              </View>
            </View>
            <AppText numberOfLines={2} style={styles.videoTitle}>
              {v.title}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function groupNum(n: number, lang: 'tr' | 'en'): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'tr' ? '.' : ',');
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  head: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8 },
  headLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
  headSub: { flexShrink: 1 },
  all: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center' },
  allText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  dishRow: { gap: 12, paddingHorizontal: 16, paddingTop: 4 },
  dish: { width: 248, gap: 8 },
  dishPhoto: { height: 160, borderRadius: 20, overflow: 'hidden' },
  dishText: { paddingHorizontal: 4 },
  dishName: { fontSize: 15, fontWeight: '600' },
  grid: { flexDirection: 'row', gap: 2 },
  cell: { flex: 1, minWidth: 0, gap: 6 },
  video: { aspectRatio: 9 / 16, overflow: 'hidden' },
  play: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  videoTitle: { paddingHorizontal: 8, fontSize: 13, lineHeight: 17, fontWeight: '500' },
});
