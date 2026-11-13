// eatkcal v2 (G13-S2 md.1–2) — Ana sayfa / Mağaza kartları (FinEkHome,
// FinEkStore). Opak akış içi kartlar; renk yalnız tema rolü; dokunma ≥44.
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { CachedImage } from '../../../../../components/CachedImage';
import { Plus } from '../../../../../components/icons';
import { transformImageUrl, ImagePreset } from '../../../../../lib/imageUrl';
import { yorumTarihi, type VitrinYorumu } from '../../../../../lib/socialProofRules';
import { fontFamily, haptic } from '../../../../../core/design';
import { EkRatingLine, EkStars, ekType, money, useEk } from '../kit';
import { cardKcal, cardPrice } from '../../model/homeData';
import { SCROLL_KEYBOARD } from '../../../../../core/design/keyboard';

/** Kart üstü kcal rozeti / fotoğraf zemini — açık temada beyaz %90, koyuda koyu yüzey. */
function useOverlayBg() {
  const { theme } = useEk();
  return theme.isDark ? 'rgba(28,28,30,0.88)' : 'rgba(255,255,255,0.9)';
}

/** Yatay kayan satır (.hs) — 16 kenar boşluğu, 10 aralık. */
export function HRow({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <ScrollView {...SCROLL_KEYBOARD}
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
  hidePrice,
}: {
  product: EkCardProduct;
  width?: number;
  photoHeight: number;
  onPress: () => void;
  onAdd?: () => void;
  adding?: boolean;
  /** G43-S1: tanıtım (kayıt onboarding'i) — gerçek fiyat bilinmiyorsa fiyat satırı çizilmez. */
  hidePrice?: boolean;
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
      accessibilityLabel={hidePrice ? product.name : `${product.name}, ${money(price.now)}`}
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
      {hidePrice ? null : <View style={styles.priceRow}>
        {price.before != null ? (
          <Text style={[ekType.c13, ekType.num, { color: c.secondary, textDecorationLine: 'line-through' }]}>
            {money(price.before)}
          </Text>
        ) : null}
        <Text style={[styles.price, ekType.num, { color: c.ink }]}>{money(price.now)}</Text>
      </View>}
    </Pressable>
  );
}

/**
 * Mağaza kartı (236 geniş). G32-S1 md.1: görsel ~%75 (150), alt bant ~%25 (~50):
 * ad tek satır; puan (tek yıldız) + süre aynı satırda — sığmazsa süre alt satıra
 * iner (iki kısa satır), metin kırpılmaz. Alt satır yalnız gerçek veriyle.
 */
export const STORE_CARD = { width: 236, photo: 150 } as const;

export function StoreCard({
  name,
  imageUri,
  subtitle,
  rating,
  onPress,
}: {
  name: string;
  imageUri?: string | null;
  subtitle?: string | null;
  /** G22-S1 md.6: son 3 ay puanı (kompakt); <10 → "Yeni". */
  rating?: { average: number | null; count: number; isNew: boolean } | null;
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
      accessibilityLabel={subtitle ? `${name}, ${subtitle}` : name}
      style={({ pressed }) => [styles.store, { backgroundColor: c.surface, borderColor: c.line }, pressed && { opacity: 0.85 }]}
      testID="ek-store-card"
    >
      {src ? (
        <CachedImage uri={src} style={styles.storePhoto} />
      ) : (
        <View style={[styles.storePhoto, { backgroundColor: c.line }]} testID="ek-store-card-photo" />
      )}
      <View style={styles.storeBody} testID="ek-store-card-body">
        <Text style={[styles.storeName, { color: c.ink }]} numberOfLines={1}>
          {name}
        </Text>
        {rating || subtitle ? (
          <View style={styles.storeMeta}>
            {rating ? (
              <EkRatingLine average={rating.average} count={rating.count} isNew={rating.isNew} mini testID="ek-store-card-rating" />
            ) : null}
            {rating && subtitle ? <Text style={[ekType.c13, { color: c.secondary }]}>·</Text> : null}
            {subtitle ? (
              <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Kampanya kartı (300×104): bannerın TAMAMI dokunulabilir, kendi bağlantısını açar.
 * G17-S1 md.11: soluk siyah katman ve "İncele" düğmesi kalktı — görsel olduğu gibi
 * (banner görselleri kendi metnini taşır). Başlık erişilebilirlik etiketinde.
 */
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
  // Tur 26 md.11 (FinEkHome): banner yalnız görsel (karartma / "İncele" yok), tamamı
  // dokunulur; "Kampanya" + başlık görselin ALTINDA.
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="link"
      accessibilityLabel={title ? `${t('eatkcal.v2.home.campaign')}: ${title}` : t('eatkcal.v2.home.campaign')}
      style={({ pressed }) => [styles.campaign, pressed && { opacity: 0.85 }]}
      testID="ek-campaign-card"
    >
      <View style={styles.campaignImg}>
        <CachedImage uri={src} style={StyleSheet.absoluteFill as never} />
      </View>
      <View style={styles.campaignText}>
        <Text style={[ekType.c13s, { color: c.secondary }]}>{t('eatkcal.v2.home.campaign')}</Text>
        {title ? (
          <Text style={[styles.campaignTitle, { color: c.ink }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
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
  store: { width: STORE_CARD.width, borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  storePhoto: { width: STORE_CARD.width, height: STORE_CARD.photo },
  storeBody: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8, gap: 1 },
  storeName: { fontFamily: ekType.h20.fontFamily, fontSize: 16, lineHeight: 20 },
  storeMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6 },
  campaign: { width: 300, gap: 8 },
  campaignImg: { width: 300, height: 104, borderRadius: 20, overflow: 'hidden' },
  campaignText: { gap: 2, paddingHorizontal: 2 },
  campaignTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 19 },
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
