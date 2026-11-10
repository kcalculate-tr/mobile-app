// G18-S2 md.3 + md.6b — "Öne çıkanlar" banner şeridi (FinHomeR3 varyant a,
// FinMoBanner). Enerji halkası + makroların ALTINDA; kullanıcı kaydırır,
// otomatik ilerleme YOK. Kart 361×256 (görsel 180 + metin 76), köşe 20, aralık 12,
// kenar 16; karartma yok, "İncele" yok, tüm kart tek dokunuş. Gösterge çubukları
// 8×4 (etkin 20×4), 200 ms standard. Giriş bir kez: 300 ms enter, opaklık 0→1 +
// y 8→0 (azaltılmışta 200 ms yalnız opaklık). Veri yoksa bölüm HİÇ çizilmez.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '../../../core/design/components/AppText';
import { CURVE, DURATION, REDUCED, useReducedMotion } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { CachedImage } from '../../../components/CachedImage';
import { getKesfetClient } from '../../kesfet';
import type { FeedPost } from '../../kesfet/types';
import { supabase } from '../../../core/supabase';
import { fetchActiveAppBanner } from '../../../lib/appBanners';
import { fetchBannerRows } from '../../../lib/banners';
import { useHomeTokens, BRICOLAGE_SEMI } from '../../onboarding/first/homeTokens';
import { bannerIndexFromOffset, buildHomeBanners, type CampaignSource, type HomeBannerItem } from './banner';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

type Provider = {
  posts: (lang: string) => Promise<FeedPost[]>;
  campaign: () => Promise<CampaignSource | null>;
};

const realProvider: Provider = {
  posts: async (lang) => (await getKesfetClient().getFeed({ tab: 'for_you', lang, limit: 20 })).items,
  campaign: async () => {
    const one = await fetchActiveAppBanner(supabase).catch(() => null);
    if (one && one.imageUrl) {
      return { id: one.id, title: one.title, subtitle: one.subtitle, image: one.imageUrl, link: one.deeplink };
    }
    const rows = await fetchBannerRows().catch(() => null);
    const cell = rows ? [...rows.hero, ...rows.promo].flatMap((r) => r.cells).find((c) => !!c.image_url && !!(c.title || '').trim()) : null;
    return cell ? { id: cell.id, title: cell.title, subtitle: null, image: cell.image_url, link: cell.navigate_to ?? cell.link } : null;
  },
};
let provider: Provider = realProvider;
/** Yalnız vitrin/test: veri sağlayıcıyı değiştirir (null → gerçek). */
export function setHomeBannerProvider(p: Provider | null): void {
  provider = p ?? realProvider;
}

export function useHomeBanners(enabled: boolean, izmir: boolean, isNew: boolean): HomeBannerItem[] {
  const { lang } = useT();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [campaign, setCampaign] = useState<CampaignSource | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    provider
      .posts(lang)
      .then((p) => alive && setPosts(p))
      .catch(() => alive && setPosts([]));
    return () => {
      alive = false;
    };
  }, [enabled, lang]);
  useEffect(() => {
    if (!enabled || !izmir || isNew) return;
    let alive = true;
    provider
      .campaign()
      .then((c) => alive && setCampaign(c))
      .catch(() => alive && setCampaign(null));
    return () => {
      alive = false;
    };
  }, [enabled, izmir, isNew]);
  return enabled ? buildHomeBanners({ posts, campaign, izmir, isNew }) : [];
}

const GAP = 12;
const SIDE = 16;

function Bar({ on, color, offColor, reduced }: { on: boolean; color: string; offColor: string; reduced: boolean }) {
  const w = useSharedValue(on ? 20 : 8);
  useEffect(() => {
    w.value = reduced ? (on ? 20 : 8) : withTiming(on ? 20 : 8, { duration: DURATION.fast, easing: CURVE.standard });
  }, [on, reduced, w]);
  const st = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[styles.bar, { backgroundColor: on ? color : offColor }, st]} />;
}

export function HomeBanner({
  items,
  onOpen,
  initialIndex = 0,
}: {
  items: HomeBannerItem[];
  onOpen: (item: HomeBannerItem) => void;
  /** Yalnız vitrin (__DEV__): kaydırılmış başlangıç kartı (FinMoBanner 2 / 4). */
  initialIndex?: number;
}) {
  const k = useHomeTokens();
  const { t: tt } = useT();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const cardW = Math.max(240, width - SIDE * 2);
  const step = cardW + GAP;
  const [index, setIndex] = useState(initialIndex);

  // Giriş bir kez (bileşen ömrü boyunca); kaydırınca tekrar oynamaz.
  const op = useSharedValue(0);
  const y = useSharedValue(reduced ? 0 : 8);
  const shown = items.length > 0;
  useEffect(() => {
    if (!shown) return;
    if (reduced) {
      y.value = 0;
      op.value = withTiming(1, { duration: REDUCED.duration });
    } else {
      op.value = withTiming(1, { duration: DURATION.base, easing: CURVE.enter });
      y.value = withTiming(0, { duration: DURATION.base, easing: CURVE.enter });
    }
  }, [shown, reduced, op, y]);
  const enter = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: y.value }] }));

  if (!shown) return null;
  const n = items.length;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = bannerIndexFromOffset(e.nativeEvent.contentOffset.x, step, n);
    if (i !== index) setIndex(i);
  };
  const eyebrow = (b: HomeBannerItem) => tt(`home.banner_${b.kind}`);
  const meta = (b: HomeBannerItem) => b.meta || tt(`home.banner_${b.kind}_meta`);

  return (
    <Animated.View
      style={[styles.section, enter]}
      accessibilityLabel={tt('home.banner_region')}
      accessibilityHint={tt('home.banner_role')}
      testID="home-banner"
    >
      <ScrollView {...SCROLL_KEYBOARD}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={step}
        snapToAlignment="start"
        disableIntervalMomentum
        contentOffset={initialIndex > 0 ? { x: initialIndex * step, y: 0 } : undefined}
        contentContainerStyle={styles.row}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {items.map((b, i) => (
          <Pressable
            key={b.id}
            onPress={() => onOpen(b)}
            accessibilityRole="link"
            accessibilityLabel={`${eyebrow(b)}: ${b.title}. ${meta(b)} (${i + 1} / ${n})`}
            style={[styles.card, { width: cardW, backgroundColor: k.card, borderColor: k.line }]}
            testID={`home-banner-${b.kind}`}
          >
            <View style={[styles.photo, { backgroundColor: k.ph }]}>
              <CachedImage uri={b.image} style={StyleSheet.absoluteFill} />
            </View>
            <View style={styles.text}>
              <AppText numberOfLines={1} style={[styles.eyebrow, { color: k.sec }]}>
                {eyebrow(b)}
              </AppText>
              <AppText numberOfLines={1} style={[styles.title, { color: k.text }]}>
                {b.title}
              </AppText>
              <AppText numberOfLines={1} style={[styles.meta, { color: k.sec }]}>
                {meta(b)}
              </AppText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.bars} accessibilityRole="image" accessibilityLabel={tt('home.banner_pos', { i: index + 1, n })}>
        {n > 1 ? items.map((b, i) => <Bar key={b.id} on={i === index} color={k.text} offColor={k.line2} reduced={reduced} />) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  row: { gap: GAP, paddingHorizontal: SIDE },
  // 256 = görsel 180 + metin 76; büyük yazıda (FinHomeXL) metin alanı uzar, kırpılmaz.
  card: { minHeight: 256, borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  photo: { height: 180, overflow: 'hidden' },
  text: { minHeight: 76, paddingTop: 10, paddingBottom: 6, paddingHorizontal: 16 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans_600SemiBold' },
  title: { fontSize: 18, lineHeight: 24, fontFamily: BRICOLAGE_SEMI },
  meta: { fontSize: 13, lineHeight: 18 },
  bars: { height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  bar: { height: 4, borderRadius: 2 },
});
