import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowCounterClockwise, ShoppingCart } from 'phosphor-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { PastOrder } from '../lib/reorder';

interface ReorderCardProps {
  order: PastOrder;
  busy?: boolean;
  onPress: () => void;
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

/**
 * Anasayfadaki "Yine aynısı?" kartı — son siparişi tek dokunuşla sepete ekler.
 *
 * Faz 1 / frekans motoru: yeniden sipariş özelliği vardı ama YALNIZCA sepet
 * boşken Sepet sekmesinde görünüyordu; yani müşterinin onu bulması için önce
 * boş bir sepete gitmesi gerekiyordu. Tekrar sipariş, dikey entegre bir
 * markada en ucuz siparişin geldiği yer — anasayfada, ilk ekranda olmalı.
 *
 * Canlı sipariş kartıyla AYNI yuvayı paylaşır (ikisi aynı anda görünmez):
 * siparişi yolda olan birine "yine aynısını ister misin" demek gürültü.
 */
export default function ReorderCard({ order, busy = false, onPress }: ReorderCardProps) {
  const thumbs = order.items.slice(0, MAX_THUMBS);
  const extraCount = order.items.length - thumbs.length;
  const itemCount = order.items.reduce((n, it) => n + it.quantity, 0);

  return (
    <View style={s.card}>
      <View style={s.ust}>
        <View style={s.gorseller}>
          {thumbs.map((it, i) => (
            <View key={`${order.id}_${it.id}_${i}`} style={s.gorselSarmal}>
              {it.imageUrl ? (
                <Image source={{ uri: it.imageUrl }} style={s.gorsel} resizeMode="cover" />
              ) : (
                <View style={[s.gorsel, s.gorselBos]}>
                  <ShoppingCart size={16} color="rgba(255,255,255,0.4)" />
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
          <Text style={s.baslik}>Yine aynısı?</Text>
          <Text style={s.ozet} numberOfLines={2}>{reorderSummary(order)}</Text>
        </View>
      </View>

      <View style={s.alt}>
        <Text style={s.meta} numberOfLines={1}>
          {reorderDateLabel(order.createdAt)} · {itemCount} ürün
        </Text>
        <TouchableOpacity
          style={[s.buton, busy && s.butonMesgul]}
          onPress={onPress}
          disabled={busy}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Son siparişi sepete ekle"
        >
          {busy ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <>
              <ArrowCounterClockwise size={14} color="#000000" weight="bold" />
              <Text style={s.butonMetin}>Sepete Ekle</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const THUMB = 42;

const s = StyleSheet.create({
  // Yuva ölçüleri ActiveOrderCard ile BİREBİR aynı — hangisi görünürse
  // görünsün anasayfanın dikey ritmi değişmiyor.
  card: {
    backgroundColor: '#101010',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },

  ust: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },

  gorseller: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gorselSarmal: { position: 'relative' },
  gorsel: {
    width: THUMB,
    height: THUMB,
    borderRadius: RADIUS.xs,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  gorselBos: { alignItems: 'center', justifyContent: 'center' },
  gorselFazla: { alignItems: 'center', justifyContent: 'center' },
  gorselFazlaMetin: {
    fontSize: TYPOGRAPHY.size.xs,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  adetRozet: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adetRozetMetin: {
    fontSize: 10,
    color: '#000000',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },

  metinBlok: { flex: 1, gap: 2 },
  baslik: {
    fontSize: TYPOGRAPHY.size.md,
    color: '#ffffff',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  ozet: {
    fontSize: TYPOGRAPHY.size.sm,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  alt: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  meta: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.xs,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  buton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 132,
    height: 36,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.brand.green,
  },
  butonMesgul: { opacity: 0.7 },
  butonMetin: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
