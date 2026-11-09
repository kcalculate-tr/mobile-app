// G18-S2 md.4 — Ana sayfa eatkcal bölge bölümü.
//  • İzmir (FinHomeIzmir): başlık "eatkcal" + "İzmir'de <süre>" (gerçek teslim
//    süresi varsa) + TEK öneri kartı (görsel 168, metin 12/16/16: gerekçe 13 ·
//    ad 17/600 · "520 kcal  285 TL"). Menü verisi yoksa bölüm yok.
//  • İzmir dışı (FinHomeOutside): "eatkcal · Şimdilik yalnız İzmir'de" + iki satır
//    (72 yükseklik, 44 ikon kutusu, sağ ok): "Restoranını eatkcal'a ekle" ·
//    "Bize çevrendeki restoranları öner" → S3'ün FinWaitlistAdd / FinWaitlistSuggest
//    sheet'leri (bağlantı çağıranda tek satır: `onWaitlist`).
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../core/design/components/AppText';
import { useT } from '../../../core/i18n';
import { CachedImage } from '../../../components/CachedImage';
import { fetchProducts } from '../../../lib/products';
import type { Product } from '../../../types';
import { formatPrice } from '../../../utils/formatPrice';
import { useDeliveryChip } from '../../eatkcal/v2/ui/home/useDeliveryChip';
import { BRICOLAGE_SEMI, useHomeTokens } from '../../onboarding/first/homeTokens';
import type { SlotKey } from '../homeData';
import type { HomeRegion as Region } from './region';
import { pickEatkcalSuggestion, type EkSuggestion } from './suggest';

const STORE_D =
  'M232,96a7.89,7.89,0,0,0-.3-2.2L217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.8A7.89,7.89,0,0,0,24,96h0v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96ZM54,48H202l11.42,40H42.61Zm50,56h48v8a24,24,0,0,1-48,0Zm-16,0v8a24,24,0,0,1-35.12,21.26,7.88,7.88,0,0,0-1.82-1.06A24,24,0,0,1,40,112v-8ZM200,208H56V151.2a40.57,40.57,0,0,0,8,.8,40,40,0,0,0,32-16,40,40,0,0,0,64,0,40,40,0,0,0,32,16,40.57,40.57,0,0,0,8-.8Zm4.93-75.8a8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48v8A24,24,0,0,1,204.93,132.2Z';
const PIN_D =
  'M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z';
const CARET_D =
  'M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z';

type Provider = { products: () => Promise<Product[]>; eta?: string | null };
const realProvider: Provider = { products: () => fetchProducts() };
let provider: Provider = realProvider;
/** Yalnız vitrin/test. */
export function setHomeRegionProvider(p: Provider | null): void {
  provider = p ?? realProvider;
}

function Head({ sub }: { sub: string | null }) {
  const k = useHomeTokens();
  return (
    <View style={styles.head}>
      <AppText accessibilityRole="header" style={[styles.h2, { color: k.text }]}>
        eatkcal
      </AppText>
      {sub ? (
        <AppText numberOfLines={1} style={[styles.sub, { color: k.sec }]}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

export function HomeIzmirCard({
  slot,
  proteinLeft,
  proteinTarget,
  kcalLeft,
  onOpen,
}: {
  slot: SlotKey;
  proteinLeft: number;
  proteinTarget: number;
  kcalLeft: number;
  onOpen: (productId: string) => void;
}) {
  const k = useHomeTokens();
  const { t: tt, lang } = useT();
  const { chip } = useDeliveryChip();
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    let alive = true;
    provider
      .products()
      .then((p) => alive && setProducts(p))
      .catch(() => alive && setProducts([]));
    return () => {
      alive = false;
    };
  }, []);
  const s: EkSuggestion | null = pickEatkcalSuggestion(products, { proteinLeft, proteinTarget, kcalLeft, slot });
  if (!s) return null;
  const eta = provider.eta !== undefined ? provider.eta : chip?.estimate ?? null;
  const meal = tt(`home.for_${slot}`);
  const why = s.reason === 'protein' ? tt('home.ek_why_protein', { meal }) : tt(`home.slot_for_${slot}`);
  const meta = [s.kcal != null ? `${s.kcal} kcal` : null, s.price != null ? formatPrice(s.price, { lang: lang === 'en' ? 'en' : 'tr' }) : null].filter(
    Boolean,
  ) as string[];
  return (
    <View style={styles.section} accessibilityLabel={tt('home.ek_region')} testID="home-region-izmir">
      <Head sub={eta ? tt('home.ek_eta', { eta }) : null} />
      <Pressable
        onPress={() => onOpen(s.id)}
        accessibilityRole="link"
        accessibilityLabel={`${why}. ${s.name}. ${meta.join(', ')}`}
        style={[styles.ekCard, { backgroundColor: k.card, borderColor: k.line }]}
      >
        <View style={[styles.ekPhoto, { backgroundColor: k.ph }]}>
          <CachedImage uri={s.image} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.ekText}>
          <AppText numberOfLines={1} style={[styles.small, { color: k.sec }]}>
            {why}
          </AppText>
          <AppText numberOfLines={1} style={[styles.ekName, { color: k.text }]}>
            {s.name}
          </AppText>
          {meta.length > 0 ? (
            <View style={styles.metaRow}>
              {meta.map((m) => (
                <AppText key={m} style={[styles.small, { color: k.sec }]}>
                  {m}
                </AppText>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function WaitRow({ icon, title, sub, onPress, testID }: { icon: string; title: string; sub: string; onPress: () => void; testID: string }) {
  const k = useHomeTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${sub}`}
      style={[styles.wait, { backgroundColor: k.card, borderColor: k.line }]}
      testID={testID}
    >
      <View style={[styles.waitIcon, { backgroundColor: k.track }]}>
        <Svg width={22} height={22} viewBox="0 0 256 256">
          <Path d={icon} fill={k.text} />
        </Svg>
      </View>
      <View style={styles.flex}>
        <AppText numberOfLines={2} style={[styles.waitTitle, { color: k.text }]}>
          {title}
        </AppText>
        <AppText numberOfLines={2} style={[styles.small, { color: k.sec }]}>
          {sub}
        </AppText>
      </View>
      <Svg width={18} height={18} viewBox="0 0 256 256">
        <Path d={CARET_D} fill={k.sec} />
      </Svg>
    </Pressable>
  );
}

export function HomeOutsideCards({ onWaitlist }: { onWaitlist: (kind: 'add' | 'suggest') => void }) {
  const { t: tt } = useT();
  return (
    <View style={[styles.section, styles.pad]} accessibilityLabel="eatkcal" testID="home-region-outside">
      <Head sub={tt('home.ek_only')} />
      <View style={styles.waitList}>
        <WaitRow icon={STORE_D} title={tt('home.wait_add')} sub={tt('home.wait_add_sub')} onPress={() => onWaitlist('add')} testID="home-wait-add" />
        <WaitRow icon={PIN_D} title={tt('home.wait_suggest')} sub={tt('home.wait_suggest_sub')} onPress={() => onWaitlist('suggest')} testID="home-wait-suggest" />
      </View>
    </View>
  );
}

/** Bölgeye göre İzmir kartı ya da İzmir dışı satırları ('unknown' → dışı; bkz. region.ts). */
export function HomeRegionSection(props: {
  region: Region;
  slot: SlotKey;
  proteinLeft: number;
  proteinTarget: number;
  kcalLeft: number;
  onOpenProduct: (productId: string) => void;
  onWaitlist: (kind: 'add' | 'suggest') => void;
}) {
  if (props.region === 'izmir') {
    return (
      <View style={styles.pad}>
        <HomeIzmirCard
          slot={props.slot}
          proteinLeft={props.proteinLeft}
          proteinTarget={props.proteinTarget}
          kcalLeft={props.kcalLeft}
          onOpen={props.onOpenProduct}
        />
      </View>
    );
  }
  return <HomeOutsideCards onWaitlist={props.onWaitlist} />;
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  pad: { paddingHorizontal: 16 },
  head: { height: 44, paddingTop: 10, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  h2: { fontFamily: BRICOLAGE_SEMI, fontSize: 20, lineHeight: 26 },
  sub: { fontSize: 13, lineHeight: 17, flexShrink: 1 },
  ekCard: { marginTop: 4, borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  ekPhoto: { height: 168, overflow: 'hidden' },
  ekText: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 16, gap: 2 },
  ekName: { fontSize: 17, lineHeight: 22, fontFamily: 'PlusJakartaSans_600SemiBold' },
  metaRow: { flexDirection: 'row', gap: 12 },
  small: { fontSize: 13, lineHeight: 18 },
  waitList: { marginTop: 4, gap: 8 },
  wait: {
    minHeight: 72,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  waitIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  waitTitle: { fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
