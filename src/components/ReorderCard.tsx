import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowCounterClockwise, Fire, ShoppingCart, X } from 'phosphor-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { DURATION, EASING, PRESS_SCALE, SPRING } from '../constants/motion';
import Shimmer from './ui/Shimmer';
import type { PastOrder } from '../lib/reorder';

interface ReorderCardProps {
  order: PastOrder;
  busy?: boolean;
  onPress: () => void;
  /** Kartı kapat. Verilmezse kapatma butonu hiç çizilmez. */
  onDismiss?: () => void;
}

/** En fazla 3 görsel yan yana; kalanlar "+N" ile özetlenir. */
const MAX_THUMBS = 3;

export function reorderSummary(order: PastOrder): string {
  return order.items
    .map((it) => (it.quantity > 1 ? `${it.quantity}× ${it.name}` : it.name))
    .join(', ');
}

export function reorderDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

/** `1.640 kcal` — binlik ayraçlı; 0 ise gösterilmez. */
export function reorderCalorieLabel(kcal: number): string | null {
  const n = Math.round(Number(kcal) || 0);
  if (n <= 0) return null;
  return `${n.toLocaleString('tr-TR')} kcal`;
}

/**
 * Anasayfadaki "Yine aynısı?" kartı — son siparişi tek dokunuşla sepete ekler.
 *
 * Faz 1 / frekans motoru: yeniden sipariş özelliği vardı ama YALNIZCA sepet
 * boşken Sepet sekmesinde görünüyordu; yani müşterinin onu bulması için önce
 * boş bir sepete gitmesi gerekiyordu.
 *
 * 24.09.2026 tasarım revizyonu: kart siyahtı. Siyah zemin anasayfada yalnız
 * CANLI SİPARİŞ kartının dili — "şu an olan bir şey var" demek. Bu kart ise
 * bir davet, acil bir durum bildirmiyor; siyah kullanmak o ayrımı siliyordu.
 * Artık beyaz kart + ince çerçeve, yani katalog kartlarıyla aynı dil.
 *
 * Canlı sipariş kartıyla AYNI yuvayı paylaşır (ikisi aynı anda görünmez):
 * siparişi yolda olan birine "yine aynısını ister misin" demek gürültü.
 */
export default function ReorderCard({ order, busy = false, onPress, onDismiss }: ReorderCardProps) {
  const thumbs = order.items.slice(0, MAX_THUMBS);
  const extraCount = order.items.length - thumbs.length;
  const itemCount = order.items.reduce((n, it) => n + it.quantity, 0);
  const kaloriEtiketi = reorderCalorieLabel(order.totalCalories);

  const basiliOlcek = useRef(new Animated.Value(1)).current;
  const bas = () =>
    Animated.spring(basiliOlcek, { toValue: PRESS_SCALE, useNativeDriver: true, ...SPRING.press }).start();
  const birak = () =>
    Animated.spring(basiliOlcek, { toValue: 1, useNativeDriver: true, ...SPRING.press }).start();

  const girisOlcek = useRef(new Animated.Value(0.98)).current;
  const girisOpaklik = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(girisOlcek, { toValue: 1, useNativeDriver: true, ...SPRING.enter }),
      Animated.timing(girisOpaklik, {
        toValue: 1,
        duration: DURATION.base,
        easing: EASING.enter,
        useNativeDriver: true,
      }),
    ]).start();
  }, [girisOlcek, girisOpaklik]);

  return (
    <Animated.View
      style={[s.card, { opacity: girisOpaklik, transform: [{ scale: girisOlcek }] }]}
    >
      <View style={s.ust}>
        <View style={s.gorseller}>
          {thumbs.map((it, i) => (
            <View key={`${order.id}_${it.id}_${i}`} style={s.gorselSarmal}>
              {it.imageUrl ? (
                <Image source={{ uri: it.imageUrl }} style={s.gorsel} resizeMode="cover" />
              ) : (
                <View style={[s.gorsel, s.gorselBos]}>
                  <ShoppingCart size={16} color={COLORS.text.tertiary} />
                </View>
              )}
              {it.quantity > 1 ? (
                <View style={s.adetRozet}>
                  <Text style={s.adetRozetMetin}>{it.quantity}</Text>
                </View>
              ) : null}
            </View>
          ))}
          {extraCount > 0 ? (
            <View style={[s.gorsel, s.gorselFazla]}>
              <Text style={s.gorselFazlaMetin}>+{extraCount}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.metinBlok}>
          <View style={s.baslikSatir}>
            <Text style={s.baslik}>Yine aynısı?</Text>
            {/* Kapatma: bu kart bir öneri, zorunluluk değil. Kapatma yolu
                olmayan öneri bir süre sonra rahatsız edici oluyor. Kapatılan
                sipariş bu oturumda bir daha gösterilmiyor; YENİ bir sipariş
                verildiğinde kart yeniden çıkıyor (başka bir sipariş, başka
                bir öneri). */}
            {onDismiss ? (
              <TouchableOpacity
                onPress={onDismiss}
                hitSlop={12}
                style={s.kapatBtn}
                accessibilityRole="button"
                accessibilityLabel="Bu öneriyi kapat"
              >
                <X size={14} color={COLORS.text.tertiary} weight="bold" />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={s.ozet} numberOfLines={2}>{reorderSummary(order)}</Text>
          <View style={s.metaSatir}>
            <Text style={s.meta} numberOfLines={1}>
              {reorderDateLabel(order.createdAt)} · {itemCount} ürün
            </Text>
            {kaloriEtiketi ? (
              <View style={s.kaloriRozet}>
                <Fire size={11} color={COLORS.text.secondary} weight="fill" />
                <Text style={s.kaloriMetin}>{kaloriEtiketi}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <Animated.View style={{ transform: [{ scale: basiliOlcek }] }}>
        <TouchableOpacity
          style={[s.buton, busy && s.butonMesgul]}
          onPress={onPress}
          onPressIn={bas}
          onPressOut={birak}
          disabled={busy}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Son siparişi sepete ekle"
        >
          {/* Kupon kartındaki ışığın aynısı. Orada beş kez oynayıp duruyor
              (bir kereye mahsus bir olayı kutluyor); burada durmuyor, çünkü
              kart ekranda kaldığı sürece davet de sürüyor. */}
          {!busy ? <Shimmer repeat="sonsuz" gapMs={2600} strength={0.55} /> : null}
          {busy ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <>
              <ArrowCounterClockwise size={15} color="#000000" weight="bold" />
              <Text style={s.butonMetin}>Sepete Ekle</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const THUMB = 46;

const s = StyleSheet.create({
  // Yuva ölçüleri ActiveOrderCard ile BİREBİR aynı — hangisi görünürse
  // görünsün anasayfanın dikey ritmi değişmiyor.
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },

  ust: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },

  gorseller: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gorselSarmal: { position: 'relative' },
  gorsel: {
    width: THUMB,
    height: THUMB,
    borderRadius: RADIUS.xs,
    backgroundColor: '#f2f2f2',
  },
  gorselBos: { alignItems: 'center', justifyContent: 'center' },
  gorselFazla: { alignItems: 'center', justifyContent: 'center' },
  gorselFazlaMetin: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.text.secondary,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  adetRozet: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adetRozetMetin: {
    fontSize: 10,
    color: '#ffffff',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },

  metinBlok: { flex: 1, gap: 3 },
  baslikSatir: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  kapatBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f2f2',
  },
  baslik: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  ozet: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.text.secondary,
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  metaSatir: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 1 },
  meta: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  kaloriRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    backgroundColor: '#f5f5f5',
  },
  kaloriMetin: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.text.secondary,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  buton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.brand.green,
    // Işık bandı kenardan taşmasın.
    overflow: 'hidden',
  },
  butonMesgul: { opacity: 0.7 },
  butonMetin: {
    fontSize: TYPOGRAPHY.size.md,
    color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
