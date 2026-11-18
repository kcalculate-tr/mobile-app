// G62-S1 — Sipariş değerlendirme vitrini (YALNIZ __DEV__; üretim paketine girmez).
//  • g62Rate: FinEkRateSheet hâlleri (Bos / Dolu / Gonderildi / Dusuk) — arkada tasarımdaki gibi "Siparişlerim"
//    + teslim edilen sipariş kartı; `Kart`: Ana sayfadaki giriş kartı (sayfa kapalı).
// Örnek veri yer tutucu (tasarımın [KCAL-XXXX] / [Tarih] alanları). Gerçek veri / ağ YOK (deps sahte).
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../core/design/components/FinText';
import { fontFamily, useTheme } from '../core/design';
import { OrderRateSheet, type OrderRateDeps, type OrderRateInitial } from '../modules/eatkcal/v2/ui/rate/OrderRateSheet';
import { OrderRateCard } from '../modules/eatkcal/v2/ui/rate/OrderRateCard';
import type { RatePromptOrder } from '../modules/eatkcal/v2/model/orderRateData';
import { VITRIN_PHOTO } from './vitrinKesfet';

export type G62State = 'empty' | 'filled' | 'sent' | 'low' | 'card';

function sampleOrder(en: boolean): RatePromptOrder {
  return {
    id: 4821,
    orderCode: 'KCAL-4821',
    deliveredAt: '2026-11-18T12:30:00.000Z',
    items: [
      { productId: 1, name: en ? 'Chicken and quinoa bowl' : 'Tavuklu kinoa kasesi' },
      { productId: 2, name: en ? 'Red lentil soup' : 'Mercimek çorbası' },
    ],
    firstProductId: '1',
  };
}

const DEPS: OrderRateDeps = {
  submit: async () => ({ ok: false, error: 'unknown' }),
  upload: async () => null,
  pickPhoto: async () => null,
};

export function G62RateScene({ state = 'empty', en = false }: { state?: G62State; en?: boolean }) {
  const theme = useTheme();
  const c = theme.color;
  const order = sampleOrder(en);
  const img = (id: string) => (id === '1' ? VITRIN_PHOTO.tavukKinoa : id === '2' ? VITRIN_PHOTO.mercimek : null);
  const initial: OrderRateInitial | undefined =
    state === 'filled'
      ? { dims: { delivery: 5, calorie_fit: 4, taste: 5 }, comment: en ? 'Arrived warm and the portion was right.' : 'Sıcak geldi, porsiyon tam kararındaydı.', photoUri: VITRIN_PHOTO.tavukKinoa, votes: { 1: { liked: true, tags: ['lezzetli', 'doyurucu'] } } }
      : state === 'sent'
        ? { dims: { delivery: 5, calorie_fit: 4, taste: 5 }, sent: true }
        : state === 'low'
          ? { dims: { delivery: 1, calorie_fit: 2, taste: 2 }, sent: true }
          : undefined;
  const label = order.orderCode ?? '';
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.bg}>
        <Text style={[styles.h, { color: c.ink }]}>{en ? 'My orders' : 'Siparişlerim'}</Text>
        <OrderRateCard orderLabel={label} imageUrl={VITRIN_PHOTO.tavukKinoa} onRate={() => {}} onDismiss={state === 'card' ? () => {} : undefined} />
        {state === 'card' ? (
          <OrderRateCard orderLabel="#4790" imageUrl={null} onRate={() => {}} testID="order-rate-card-nophoto" />
        ) : null}
      </ScrollView>
      {state !== 'card' ? (
        <OrderRateSheet
          visible
          order={order}
          dateLabel={en ? '18 November 2026' : '18 Kasım 2026'}
          onClose={() => {}}
          onSent={() => {}}
          onSupport={() => {}}
          deps={DEPS}
          initial={initial}
          productImage={img}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { paddingTop: 62, paddingHorizontal: 16, gap: 12 },
  h: { fontFamily: fontFamily.headingBold, fontSize: 24, lineHeight: 29 },
});
