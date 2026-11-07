// eatkcal v2 (G13-S2 md.1–2) — Ana sayfa / Mağaza kartları (FinEkHome,
// FinEkStore). Opak akış içi kartlar; renk yalnız tema rolü; dokunma ≥44.
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { CachedImage } from '../../../../../components/CachedImage';
import { Plus } from '../../../../../components/icons';
import { transformImageUrl, ImagePreset } from '../../../../../lib/imageUrl';
import { yorumTarihi, type VitrinYorumu } from '../../../../../lib/socialProofRules';
import { haptic } from '../../../../../core/design';
import { EkStars, ekType, money, useEk } from '../kit';
import { cardKcal, cardPrice } from '../../model/homeData';

/** Kart üstü kcal rozeti / fotoğraf zemini — açık temada beyaz %90, koyuda koyu yüzey. */
function useOverlayBg() {
  const { theme } = useEk();
  return theme.isDark ? 'rgba(28,28,30,0.88)' : 'rgba(255,255,255,0.9)';
}

/** Yatay kayan satır (.hs) — 16 kenar boşluğu, 10 aralık. */
export function HRow({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.hrow}
      accessibilityLabel={label}
    >
      {children}
    </ScrollView>
  );
}

export interface EkCardProduct {
  id: number | string;
  name: string;
  price: number;
  img?: string | null;
  calories?: number | null;
  discount_type?: string | null;
  discount_value?: number | null;
}

function Photo({ uri, style }: { uri?: string | null; style: StyleProp<ViewStyle> }) {
  const { c } = useEk();
  const src = uri ? transformImageUrl(uri, ImagePreset.productCard) : '';
  if (!src) return <View style={[style, { backgroundColor: c.line }]} />;
  return <CachedImage uri={src} style={style as never} />;
}

/** Ürün kartı: fotoğraf + kcal rozeti (+ mağazada "Sepete ekle" 36 görsel / 44 dokunma) · ad · fiyat. */
export function ProductCard({
  product,
  width,
  photoHeight,
  onPress,
  onAdd,
  adding,
}: {
  product: EkCardProduct;
  width?: number;
  photoHeight: number;
  onPress: () => void;
  onAdd?: () => void;
  adding?: boolean;
}) {
  const { c, t } = useEk();
  const overlay = useOverlayBg();
  const kcal = cardKcal(product);
  const price = cardPrice(product);
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${money(price.now)}`}
      style={({ pressed }) => [{ width, gap: 6 }, !width && { flex: 1, minWidth: 0 }, pressed && { opacity: 0.85 }]}
    >
      <View>
        <Photo uri={product.img} style={[styles.photo, { height: photoHeight }]} />
        {kcal != null ? (
          <View style={[styles.kcal, { backgroundColor: overlay }]}>
            <Text style={[ekType.c13s, ekType.num, { color: c.ink }]}>{`${kcal} ${t('eatkcal.v2.common.kcal')}`}</Text>
          </View>
        ) : null}
        {onAdd ? (
          <Pressable
            onPress={() => {
              haptic('light');
              onAdd();
            }}
            disabled={adding}
            accessibilityRole="button"
            accessibilityLabel={t('eatkcal.v2.store.add')}
            hitSlop={4}
            style={styles.addHit}
          >
            <View style={[styles.add, { backgroundColor: c.ink }]}>
              {adding ? <ActivityIndicator size="small" color={c.surface} /> : <Plus size={18} color={c.surface} weight="bold" />}
            </View>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.name, { color: c.ink }]} numberOfLines={2}>
        {product.name}
      </Text>
      <View style={styles.priceRow}>
        {price.before != null ? (
          <Text style={[ekType.c13, ekType.num, { color: c.secondary, textDecorationLine: 'line-through' }]}>
            {money(price.before)}
          </Text>
        ) : null}
        <Text style={[styles.price, ekType.num, { color: c.ink }]}>{money(price.now)}</Text>
      </View>
    </Pressable>
  );
}

/** Mağaza kartı (236 geniş, 92 fotoğraf). Alt satır yalnız gerçek veriyle. */
export function StoreCard({
  name,
  imageUri,
  subtitle,
  onPress,
}: {
  name: string;
  imageUri?: string | null;
  subtitle?: string | null;
  onPress: () => void;
}) {
  const { c } = useEk();
  const src = imageUri ? transformImageUrl(imageUri, ImagePreset.bannerMedium) : '';
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [styles.store, { backgroundColor: c.surface, borderColor: c.line }, pressed && { opacity: 0.85 }]}
    >
      {src ? <CachedImage uri={src} style={styles.storePhoto} /> : <View style={[styles.storePhoto, { backgroundColor: c.line }]} />}
      <View style={styles.storeBody}>
        <Text style={[styles.storeName, { color: c.ink }]} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Kampanya kartı (300×104): banner görseli + "Kampanya" + başlık + "İncele". */
export function CampaignCard({
  imageUri,
  title,
  onPress,
}: {
  imageUri: string;
  title?: string | null;
  onPress: () => void;
}) {
  const { c, t } = useEk();
  const src = transformImageUrl(imageUri, ImagePreset.bannerMedium) || imageUri;
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={title ? `${t('eatkcal.v2.home.campaign')}: ${title}` : t('eatkcal.v2.home.campaign')}
      style={({ pressed }) => [styles.campaign, pressed && { opacity: 0.85 }]}
    >
      <CachedImage uri={src} style={StyleSheet.absoluteFill as never} />
      {/* Fotoğraf üstü metin okunurluğu için soldan koyu geçiş (pano: linear-gradient). */}
      <View style={[StyleSheet.absoluteFill, styles.campaignShade]} />
      {title ? (
        <View style={styles.campaignText}>
          <Text style={[ekType.c13s, { color: '#FFFFFF', opacity: 0.85 }]}>{t('eatkcal.v2.home.campaign')}</Text>
          <Text style={[styles.campaignTitle]} numberOfLines={2}>
            {title}
          </Text>
        </View>
      ) : null}
      <View style={[styles.campaignCta, { backgroundColor: c.accent }]}>
        <Text style={[ekType.c13s, { color: c.onAccent }]}>{t('eatkcal.v2.home.campaign_cta')}</Text>
      </View>
    </Pressable>
  );
}

/** Yorum kartı (260 geniş): yıldız · ad · tarih · alıntı. Veri: vitrin_yorumlari (onaylı). */
export function ReviewCard({ review }: { review: VitrinYorumu }) {
  const { c } = useEk();
  const date = yorumTarihi(review.tarih);
  return (
    <View style={[styles.review, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.reviewHead}>
        <EkStars value={review.rating} size={13} />
        <Text style={[ekType.c13, { color: c.secondary, flex: 1 }]} numberOfLines={1}>
          {date ? `${review.ad}, ${date}` : review.ad}
        </Text>
      </View>
      <Text style={[styles.quote, { color: c.ink }]} numberOfLines={4}>
        {`“${review.yorum}”`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hrow: { paddingHorizontal: 16, gap: 10 },
  photo: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  kcal: { position: 'absolute', left: 8, top: 8, height: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: 'center' },
  addHit: { position: 'absolute', right: 4, bottom: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  add: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: ekType.b15s.fontFamily, fontSize: 14, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { fontFamily: ekType.c13s.fontFamily, fontSize: 14, fontWeight: '700' },
  store: { width: 236, borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  storePhoto: { width: 236, height: 92 },
  storeBody: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, gap: 2 },
  storeName: { ...ekType.b17, fontFamily: ekType.h20.fontFamily },
  campaign: { width: 300, height: 104, borderRadius: 20, overflow: 'hidden' },
  campaignShade: { backgroundColor: 'rgba(0,0,0,0.38)' },
  campaignText: { position: 'absolute', left: 14, top: 12, right: 110, gap: 2 },
  campaignTitle: { fontFamily: ekType.h20.fontFamily, fontSize: 17, lineHeight: 20, color: '#FFFFFF' },
  campaignCta: { position: 'absolute', right: 12, bottom: 12, minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  review: { width: 260, padding: 14, borderRadius: 20, borderWidth: 1, gap: 8 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quote: { fontFamily: ekType.b15.fontFamily, fontSize: 14, lineHeight: 20 },
});

/** Kategori çipi — seçili lime dolgu (üstünde koyu metin), diğerleri beyaz + çizgi. 44 yükseklik, 15 metin. */
export function CategoryPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { c } = useEk();
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        pillStyle,
        selected ? { backgroundColor: c.accent, borderColor: c.accent } : { backgroundColor: c.surface, borderColor: c.line },
      ]}
    >
      <Text style={[ekType.b15s, { color: selected ? c.onAccent : c.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}


const pillStyle = { height: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, justifyContent: 'center' as const };
