// G56-S1 md.1 — Filtrelenmiş liste (EkScr scr="liste"). Kategori çipi ya da banner kategorisi açar.
// Kurallar: growth/config (tek yapılandırma) + growth/rules.applyListSource. Ürünler mevcut
// fetchProducts (satışta olanlar, şube filtresi dahil).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { CachedImage } from '../../../../components/CachedImage';
import { CaretLeft, Plus } from '../../../../components/icons';
import { transformImageUrl, ImagePreset } from '../../../../lib/imageUrl';
import { fetchProducts } from '../../../../lib/products';
import { EmptyErrorCard, fontFamily, haptic } from '../../../../core/design';
import { EkScreen, EkSkeleton, EkToastLayer, ekType, money, useEk } from '../ui/kit';
import { useEkNav, type EkV2ParamList } from '../nav';
import { ChipsRow, AddedToast } from '../ui/growth/sections';
import { useGrowthTokens } from '../ui/growth/tokens';
import { useQuickAdd } from '../ui/growth/useQuickAdd';
import { applyListSource, filterRule, productKcal, type ListSource } from '../growth/rules';
import type { FilterKey } from '../growth/config';
import { cardPrice } from '../model/homeData';
import type { Product } from '../../../../types';

const SCALE = 1.3;

export default function EkListScreen() {
  const { t, insets } = useEk();
  const k = useGrowthTokens();
  const navigation = useEkNav();
  const params = (useRoute().params ?? {}) as EkV2ParamList['EkList'];
  const [source, setSource] = useState<ListSource>(
    params.category
      ? { category: params.category }
      : params.ids
        ? { ids: params.ids }
        : params.maxKcal != null
          ? { maxKcal: params.maxKcal }
          : { filter: params.filter ?? 'all' },
  );
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<number>(0);

  const load = useCallback(() => {
    setError(false);
    fetchProducts()
      .then(setProducts)
      .catch(() => {
        setError(true);
        setProducts([]);
      });
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(0), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const openProduct = useCallback((id: string) => navigation.navigate('EkProduct', { productId: id }), [navigation]);
  const { addingId, quickAdd } = useQuickAdd(openProduct, setToast);

  const list = useMemo(() => (products ? applyListSource(products, source) : []), [products, source]);
  const title = 'category' in source ? source.category : 'filter' in source ? t(filterRule(source.filter).labelKey) : params.title ?? t('ek56.chips.all');
  const active: FilterKey | null = 'filter' in source ? source.filter : null;

  const header = (
    <View style={styles.nav}>
      <Pressable
        onPress={() => {
          haptic('selection');
          navigation.goBack();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('ek56.list.back')}
        style={styles.back}
        testID="ek56-list-back"
      >
        <CaretLeft size={22} color={k.ink} weight="bold" />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.h1, { color: k.ink }]} accessibilityRole="header" numberOfLines={2} maxFontSizeMultiplier={SCALE}>
          {title}
        </Text>
        {products ? (
          <Text style={[ekType.c13, { color: k.sec }]} maxFontSizeMultiplier={SCALE}>
            {t('ek56.list.count', { n: list.length })}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <EkScreen
      header={header}
      testID="ek56-list"
      overlay={
        toast ? (
          <EkToastLayer bottom={Math.max(insets.bottom, 12) + 24}>
            <AddedToast count={toast} onCart={() => navigation.navigate('EkCart')} />
          </EkToastLayer>
        ) : null
      }
    >
      <View style={{ paddingTop: 10, gap: 10 }}>
        <ChipsRow active={active} onPick={(key) => setSource({ filter: key })} testID="ek56-list-chips" />
        <View style={{ paddingHorizontal: 16 }}>
          {products == null ? (
            <View style={[styles.card, { backgroundColor: k.card, borderColor: k.line }]} accessible accessibilityLabel={t('ek56.loading')}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: k.line }]}>
                  <EkSkeleton width={76} height={76} radius={14} style={{ backgroundColor: k.skel }} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <EkSkeleton width={180} height={16} radius={6} style={{ backgroundColor: k.skel }} />
                    <EkSkeleton width={120} height={14} radius={6} style={{ backgroundColor: k.skel }} />
                  </View>
                </View>
              ))}
            </View>
          ) : error || list.length === 0 ? (
            <EmptyErrorCard
              tone={error ? 'error' : 'empty'}
              title={error ? t('eatkcal.v2.home.error_title') : t('ek56.list.empty_title')}
              description={error ? t('eatkcal.v2.home.error_body') : t('ek56.list.empty_body')}
              actionLabel={error ? t('eatkcal.v2.home.retry') : undefined}
              onAction={error ? load : undefined}
            />
          ) : (
            <View style={[styles.card, { backgroundColor: k.card, borderColor: k.line }]} accessibilityRole="list" testID="ek56-list-rows">
              {list.map((p, i) => {
                const kcal = productKcal(p);
                const price = cardPrice(p);
                const mac =
                  p.protein != null || p.carbs != null || p.fats != null
                    ? t('ek56.card.mac', { p: Math.round(Number(p.protein) || 0), k: Math.round(Number(p.carbs) || 0), y: Math.round(Number(p.fats) || 0) })
                    : null;
                const d = [kcal ? t('ek56.card.kcal', { n: kcal }) : null, mac].filter(Boolean).join(', ');
                const src = p.img ? transformImageUrl(p.img, ImagePreset.productCard) : '';
                return (
                  <View key={String(p.id)} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: k.line }]}>
                    <Pressable
                      onPress={() => openProduct(String(p.id))}
                      accessibilityRole="button"
                      accessibilityLabel={[p.name, d, money(price.now)].filter(Boolean).join(', ')}
                      style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.85 }]}
                    >
                      {src ? <CachedImage uri={src} style={styles.img} /> : <View style={[styles.img, { backgroundColor: k.nest }]} />}
                      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                        <Text style={[styles.name, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
                          {p.name}
                        </Text>
                        {d ? (
                          <Text style={[ekType.c13, ekType.num, { color: k.sec }]} maxFontSizeMultiplier={SCALE}>
                            {d}
                          </Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
                          {price.before != null ? (
                            <Text style={[ekType.c13, ekType.num, { color: k.sec, textDecorationLine: 'line-through' }]} maxFontSizeMultiplier={SCALE}>
                              {money(price.before)}
                            </Text>
                          ) : null}
                          <Text style={[styles.price, ekType.num, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
                            {money(price.now)}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        haptic('light');
                        void quickAdd(p);
                      }}
                      disabled={addingId === String(p.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('ek56.card.add')}: ${p.name}`}
                      style={styles.addHit}
                      testID="ek56-list-add"
                    >
                      <View style={[styles.add, { backgroundColor: k.lime }]}>
                        {addingId === String(p.id) ? <ActivityIndicator size="small" color={k.limeInk} /> : <Plus size={16} color={k.limeInk} weight="bold" />}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </EkScreen>
  );
}

const styles = StyleSheet.create({
  nav: { minHeight: 44, paddingTop: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fontFamily.headingBold, fontSize: 24, lineHeight: 29 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: 60, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  img: { width: 76, height: 76, borderRadius: 14 },
  name: { fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 19.5 },
  price: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  addHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  add: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
