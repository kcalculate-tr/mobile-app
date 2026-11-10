// eatkcal v2 (G13-S2 md.3) — Ürün detayı (FinEkProduct / FinEkProductScroll).
//
// Veri ve hesap bugünkü ProductDetailScreen ile AYNI çağrılardan:
//   ürün       → supabase `products` select * eq id → mapProductRow (src/lib/products.ts)
//   gruplar    → fetchProductOptionGroups (src/lib/products.ts)
//   template   → fetchProductOptionLinks (src/lib/productOptions.ts)
//   görseller  → fetchProductImagesByName (src/lib/products.ts)
//   fiyat/makro/satır → model/productModel.ts (mevcut price/itemMacros/cart fonksiyonları)
//   sepet      → useCartStore.addItem(product, options, quantity, parentLineKey)
// Yeni fiyat/sipariş mantığı YOK. Yalnız `yeni_siparis` açıkken kayıtlı rota.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  Pressable,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { CaretDown, CaretLeft } from '../../../../components/icons';
import { CachedImage } from '../../../../components/CachedImage';
import { transformImageUrl, ImagePreset } from '../../../../lib/imageUrl';
import { getSupabaseClient } from '../../../../core/supabase';
import { DURATION, RN_CURVE, fontFamily, haptic, useReducedMotion } from '../../../../core/design';
import { mapSupabaseErrorToUserMessage } from '../../../../lib/supabaseErrors';
import { fetchProductImagesByName, fetchProductOptionGroups, getGroupSelectionLimits, mapProductRow } from '../../../../lib/products';
import { fetchProductOptionLinks } from '../../../../lib/productOptions';
import { track } from '../../../../lib/analytics';
import { getEffectivePrice } from '../../../../utils/price';
import { useCartStore } from '../../../../store/cartStore';
import type { OptionGroup, Product, ProductOptionLink } from '../../../../types';
import { EkButton, EkRatingLine, EkSkeleton, ekType, money, useEk } from '../ui/kit';
import { fetchRestaurantRating, type RestaurantRating } from '../../../../lib/restaurantRating';
import { useEkNav, type EkNavList } from '../nav';
import {
  addTotal,
  buildCartAddCalls,
  deriveProduct,
  initialGramajIndex,
  initialGroupSelections,
  initialTemplateSelections,
  isGroupRequired,
  missingSelections,
  normalizeGramajOptions,
  optionKcal,
  toggleGroupSelection,
  toggleTemplateSelection,
  type GroupSelections,
  type TemplateSelections,
} from '../model/productModel';
import { OptionGroupSection, type OptionGroupModel } from '../ui/product/OptionGroupSection';
import { MacroRings } from '../ui/product/MacroRings';
import { ProductBottomBar, STD_EASE } from '../ui/product/ProductBottomBar';

const HERO_H = 330;
/** Final gövde alt boşluğu (tek alt katman açıkken 124 + 20 + pay). */
const BODY_PAD_BOTTOM = 172;
/** Tur 26d: kaydırma > 500 → üst satır açılır; < 40 → seçimle açılan satır kapanır. */
const OPEN_AFTER_Y = 500;
const CLOSE_BEFORE_Y = 40;

export default function EkProductScreen() {
  const route = useRoute<RouteProp<EkNavList, 'EkProduct'>>();
  const navigation = useEkNav();
  const { c, t, insets } = useEk();
  const reduced = useReducedMotion();
  const addItem = useCartStore((s) => s.addItem);
  const productId = route.params?.productId;
  // YALNIZ __DEV__ vitrini (FinEkProductScroll): seçimlere kaydırılmış başlar.
  const vitrinScroll = __DEV__ ? (route.params as { vitrinScroll?: boolean } | undefined)?.vitrinScroll : undefined;
  // YALNIZ __DEV__ vitrini (FinEkProductSelected / FinEkProductAdded): seçim yapılmış / eklendi hâli.
  const vitrinState = __DEV__ ? (route.params as { vitrinState?: 'selected' | 'added' } | undefined)?.vitrinState : undefined;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [heroError, setHeroError] = useState(false);
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [optionsError, setOptionsError] = useState('');
  const [selections, setSelections] = useState<GroupSelections>({});
  const [links, setLinks] = useState<ProductOptionLink[]>([]);
  const [templateSelections, setTemplateSelections] = useState<TemplateSelections>({});
  const [gramajIndex, setGramajIndex] = useState(-1);
  const [images, setImages] = useState<Record<string, string>>({});
  // G22-S1 md.6: restoranın son 3 ay puanı (<10 → "Yeni").
  const [rating, setRating] = useState<RestaurantRating | null>(null);
  useEffect(() => {
    let alive = true;
    fetchRestaurantRating(null)
      .then((r) => alive && setRating(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [quantity, setQuantity] = useState(1);
  const [tried, setTried] = useState(false);
  const [added, setAdded] = useState(false);
  /** Kaydırma > 500 (Final `sv`). */
  const [scrolledOpen, setScrolledOpen] = useState(false);
  /** Seçim yapıldı (Final `sel`) — üste dönünce kapanır. */
  const [selOpen, setSelOpen] = useState(false);
  const [ingOpen, setIngOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const bodyY = useRef(0);
  const macroBottom = useRef(0);
  const sectionY = useRef<Record<string, number>>({});

  // ── Ürün (ProductDetailScreen.tsx:229-279 ile aynı sorgu) ────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const { data, error } = await getSupabaseClient()
          .from('products')
          .select('*')
          .eq('id', productId)
          .maybeSingle();
        if (!mounted) return;
        if (error) throw error;
        if (!data) {
          setProduct(null);
          setErrorMessage(t('eatkcal.v2.product.not_found'));
          return;
        }
        const p = mapProductRow(data as Record<string, unknown>);
        setProduct(p);
        setGramajIndex(initialGramajIndex(normalizeGramajOptions(p)));
      } catch (error: unknown) {
        if (!mounted) return;
        setProduct(null);
        setErrorMessage(mapSupabaseErrorToUserMessage(error, t('eatkcal.v2.product.load_error')));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Görüntülenme olayı — bugünkü ekranla aynı (ProductDetailScreen.tsx:281-294).
  useEffect(() => {
    if (!product?.id) return;
    const price = Number(getEffectivePrice(product)) || 0;
    track('product_view', {
      product_id: String(product.id),
      product_name: product.name ?? '',
      price,
      category: product.category ?? undefined,
      brand: product.brand ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // ── Seçim grupları + template bağlantıları ──────────────────────────────
  useEffect(() => {
    if (!product?.id) return;
    let mounted = true;
    (async () => {
      try {
        setOptionsError('');
        const g = await fetchProductOptionGroups(getSupabaseClient(), String(product.id));
        if (!mounted) return;
        setGroups(g);
        setSelections(initialGroupSelections(g));
      } catch {
        if (!mounted) return;
        setGroups([]);
        setSelections({});
        setOptionsError(t('eatkcal.v2.product.options_error'));
      }
    })();
    (async () => {
      const l = await fetchProductOptionLinks(Number(product.id));
      if (!mounted) return;
      setLinks(l);
      setTemplateSelections(initialTemplateSelections(l));
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const gramajOptions = useMemo(() => normalizeGramajOptions(product), [product]);

  // Seçenek görselleri: seçeneğin adıyla eşleşen ürün fotoğrafı (yoksa çıkartma yer tutucusu).
  useEffect(() => {
    const names = [
      ...groups.flatMap((g) => g.items.map((i) => i.name)),
      ...links.flatMap((l) => l.template?.values.map((v) => v.name) ?? []),
    ];
    if (names.length === 0) return;
    let mounted = true;
    fetchProductImagesByName(names)
      .then((m) => mounted && setImages(m))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [groups, links]);

  const selState = useMemo(
    () =>
      product
        ? { product, groups, selections, links, templateSelections, gramajOptions, gramajIndex }
        : null,
    [product, groups, selections, links, templateSelections, gramajOptions, gramajIndex],
  );
  const derived = useMemo(() => (selState ? deriveProduct(selState) : null), [selState]);
  const missing = useMemo(
    () =>
      missingSelections({
        groups,
        selections,
        links,
        templateSelections,
        gramajCount: gramajOptions.length,
        gramajIndex,
      }),
    [groups, selections, links, templateSelections, gramajOptions.length, gramajIndex],
  );
  const missingKeys = useMemo(() => new Set(missing.map((m) => m.key)), [missing]);
  const ready = missing.length === 0;

  // ── Grupları tek görsel modele çevir (gramaj → uuid grupları → template) ─
  const imageFor = (name: string) => images[name.trim().toLowerCase()] ?? null;
  const groupModels: OptionGroupModel[] = useMemo(() => {
    const out: OptionGroupModel[] = [];
    if (gramajOptions.length > 0) {
      out.push({
        key: 'gramaj',
        title: t('eatkcal.v2.product.gramaj'),
        required: true,
        max: 1,
        multi: false,
        items: gramajOptions.map((g, idx) => ({
          key: String(idx),
          name: g.name,
          priceDelta: g.price_modifier,
          kcal: null,
          kcalDelta: g.calorie_modifier,
          imageUrl: null,
          selected: gramajIndex === idx,
          disabled: false,
        })),
      });
    }
    groups.forEach((group) => {
      const { min, max } = getGroupSelectionLimits(group);
      const sel = new Set(selections[group.id] || []);
      out.push({
        key: `g:${group.id}`,
        title: group.name,
        description: group.description || undefined,
        required: isGroupRequired(group),
        max,
        min,
        multi: max > 1,
        items: group.items.map((item) => ({
          key: item.id,
          name: item.name,
          priceDelta: item.priceAdjustment,
          kcal: optionKcal(item),
          imageUrl: imageFor(item.name),
          selected: sel.has(item.id),
          // ProductDetailScreen.tsx:1052-1054
          disabled: !item.isAvailable || (!sel.has(item.id) && max > 1 && sel.size >= max),
        })),
      });
    });
    links.forEach((link) => {
      const tpl = link.template;
      if (!tpl) return;
      const sel = templateSelections[tpl.id] || [];
      const multi = tpl.selection_type === 'multiple';
      out.push({
        key: `t:${tpl.id}`,
        title: tpl.name,
        description: tpl.description || undefined,
        required: link.effective_required,
        max: multi ? link.effective_max : 1,
        min: link.effective_min,
        multi,
        items: tpl.values.map((v) => ({
          key: String(v.id),
          name: v.name,
          priceDelta: Number(v.price_modifier) || 0,
          kcal: null,
          kcalDelta: Number(v.calorie_modifier) || 0,
          imageUrl: imageFor(v.name),
          selected: sel.includes(v.id),
          // ProductDetailScreen.tsx:1124-1128
          disabled: multi && !sel.includes(v.id) && link.effective_max != null && sel.length >= link.effective_max,
        })),
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gramajOptions, gramajIndex, groups, selections, links, templateSelections, images, t]);

  const scrollToNext = (currentKey: string) => {
    setTimeout(() => {
      const i = groupModels.findIndex((g) => g.key === currentKey);
      const next = groupModels[i + 1];
      if (!next) {
        scrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      const y = sectionY.current[next.key];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    }, 250);
  };

  const onToggle = (groupKey: string, itemKey: string) => {
    // Tur 26d/26e: seçim üst satırı açar; eklendikten sonra değişirse "Sepete ekle" geri gelir.
    setSelOpen(true);
    setAdded(false);
    if (groupKey === 'gramaj') {
      setGramajIndex(Number(itemKey));
      return;
    }
    if (groupKey.startsWith('g:')) {
      const group = groups.find((g) => `g:${g.id}` === groupKey);
      if (!group) return;
      const r = toggleGroupSelection(group, selections[group.id] || [], itemKey);
      if (!r) return;
      setSelections((prev) => ({ ...prev, [group.id]: r.next }));
      if (r.advance) scrollToNext(groupKey);
      return;
    }
    const link = links.find((l) => l.template && `t:${l.template.id}` === groupKey);
    if (!link?.template) return;
    const tplId = link.template.id;
    setTemplateSelections((prev) => ({ ...prev, [tplId]: toggleTemplateSelection(link, prev[tplId] || [], Number(itemKey)) }));
  };

  const { height: winH } = useWindowDimensions();
  const groupsRef = useRef(groupModels);
  groupsRef.current = groupModels;
  useEffect(() => {
    if (!vitrinScroll || loading) return;
    // Seçim grupları ve bölüm konumları yüklemeden sonra ölçülür → ölçülene kadar dene.
    let n = 0;
    const h = setInterval(() => {
      n += 1;
      const firstKey = groupsRef.current[0]?.key;
      const fy = firstKey ? sectionY.current[firstKey] : undefined;
      if (fy == null && n < 15) return;
      clearInterval(h);
      // Final (FinEkProductScroll): ilk seçim grubu üstte, makro halkaları ekran dışında.
      // Ölçümler görsel yüklenince kayabildiğinden en az fotoğraf + başlık + halkalar kadar in.
      const y = Math.max(fy != null ? fy - 8 : 0, bodyY.current + macroBottom.current + 24, Math.round(winH * 1.05));
      scrollRef.current?.scrollTo({ y, animated: false });
      setScrolledOpen(true);
    }, 300);
    return () => clearInterval(h);
  }, [vitrinScroll, loading]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (vitrinScroll || vitrinState) return; // dev vitrini: zorlanan hâl açık kalır
    const y = e.nativeEvent.contentOffset.y;
    const sv = y > OPEN_AFTER_Y;
    if (sv !== scrolledOpen) setScrolledOpen(sv);
    if (y < CLOSE_BEFORE_Y && selOpen) setSelOpen(false);
  };

  const onQuantity = (q: number) => {
    setQuantity(q);
    setAdded(false);
  };

  const handleAdd = () => {
    if (!selState || added) return;
    if (!ready) {
      setTried(true);
      haptic('warning');
      const first = groupModels.find((g) => missingKeys.has(g.key));
      const y = first ? sectionY.current[first.key] : undefined;
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
      return;
    }
    // Bugünkü ekranla aynı addItem çağrıları (ana satır, sonra bağlı satırlar).
    buildCartAddCalls(selState, quantity).forEach((call) =>
      addItem(call.product, call.options, call.quantity, call.parentLineKey),
    );
    haptic('light');
    // Tur 26e: sayfada kalınır, aynı düğme "Sepete git" olur (otomatik geri dönüş yok).
    setAdded(true);
  };

  // YALNIZ __DEV__ vitrini: seçili / eklendi hâli (Final off 330).
  useEffect(() => {
    if (!vitrinState || loading) return;
    const h = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: HERO_H, animated: false });
      setSelOpen(true);
      if (vitrinState === 'added') setAdded(true);
    }, 900);
    return () => clearTimeout(h);
  }, [vitrinState, loading]);

  // ── İçerik (Final "İçerik"): seçili bileşenlerden kısa özet + "Tüm içerik" satırları ──
  const ingredients = useMemo(() => {
    const gram = groupModels.find((g) => g.key === 'gramaj')?.items.find((i) => i.selected);
    const rows: { key: string; name: string; value: string }[] = [];
    groupModels.forEach((g) => {
      if (g.key === 'gramaj') return;
      g.items
        .filter((i) => i.selected)
        .forEach((i) => {
          const kcal = i.kcal != null ? t('eatkcal.v2.product.kcal_n', { n: Math.round(i.kcal) }) : '';
          rows.push({ key: `${g.key}:${i.key}`, name: i.name, value: rows.length === 0 && gram ? gram.name : kcal });
        });
    });
    const names = rows.map((r) => r.name);
    const summary =
      names.length <= 1
        ? names.join('')
        : t('eatkcal.v2.product.list_and', { head: names.slice(0, -1).join(', '), last: names[names.length - 1] });
    return { rows, summary, gram: gram?.name ?? null };
  }, [groupModels, t]);

  // ── Durumlar ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: c.bg }]} testID="ek-product-skeleton">
        <EkSkeleton height={HERO_H} radius={0} />
        <View style={{ padding: 16, gap: 12 }}>
          <EkSkeleton height={14} width="30%" />
          <EkSkeleton height={26} width="70%" />
          <EkSkeleton height={84} radius={20} />
          <EkSkeleton height={166} width={136} radius={18} />
        </View>
      </View>
    );
  }

  if (!product || !derived) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <Text style={[ekType.h20, { color: c.ink, textAlign: 'center' }]}>{t('eatkcal.v2.product.load_error_title')}</Text>
        <Text style={[ekType.b15, { color: c.secondary, textAlign: 'center', marginTop: 8 }]}>{errorMessage}</Text>
        <EkButton label={t('eatkcal.v2.product.go_back')} variant="secondary" onPress={() => navigation.goBack()} style={{ marginTop: 24 }} />
      </View>
    );
  }

  const heroUri = product.img && !heroError ? transformImageUrl(product.img, ImagePreset.productDetail) ?? product.img : null;
  const price = addTotal(derived, quantity);
  // Başlıktaki fiyat satırı (Final): birim fiyat, indirimliyse eski fiyat üstü çizili + rozet.
  const unitPrice = addTotal(derived, 1);
  const unitOriginal = derived.hasDiscount ? addTotal(derived, 1, 'original') : null;
  const layerMacros = derived.macroCardEnabled
    ? {
        kcal: derived.macros.kcal * quantity,
        protein: derived.macros.protein * quantity,
        carbs: derived.macros.carbs * quantity,
        fats: derived.macros.fats * quantity,
      }
    : null;
  const firstPick = ingredients.rows[0]?.name ?? null;
  const infoAmount = ingredients.gram ?? firstPick ?? product.name ?? '';
  const infoName = ingredients.gram ? firstPick ?? product.name : firstPick ? product.name : null;
  const layerOpen = scrolledOpen || selOpen || (tried && !ready);
  // G15-S5 (FinEkProduct-Dark): fotoğraf üstündeki yuvarlak düğmeler iki temada da açık cam + koyu ikon.
  const roundBtn = [styles.roundBtn, { backgroundColor: 'rgba(255,255,255,0.85)' }];

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]} testID="ek-product">
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: BODY_PAD_BOTTOM + Math.max(0, insets.bottom - 34) }}
      >
        <View style={{ height: HERO_H }}>
          {heroUri ? (
            <CachedImage uri={heroUri} style={styles.hero} priority="high" contentFit="cover" onError={() => setHeroError(true)} />
          ) : (
            <View style={[styles.hero, { backgroundColor: c.line }]} />
          )}
          <View style={[styles.heroBar, { top: insets.top + 6 }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t('eatkcal.v2.product.back')}
              style={roundBtn}
              testID="ek-product-back"
            >
              <CaretLeft size={22} color="#0A0A0A" />
            </Pressable>
            {/* G17-S1 md.7: itilen sayfada yalnız sol geri (sağdaki X kalktı). */}
          </View>
        </View>

        <View
          style={[styles.body, { backgroundColor: c.bg }]}
          onLayout={(e: LayoutChangeEvent) => {
            bodyY.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={{ gap: 4 }}>
            {product.brand ? <Text style={[ekType.c13s, { color: c.secondary }]}>{product.brand}</Text> : null}
            <Text style={[ekType.h24, { color: c.ink }]} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              {product.name}
            </Text>
            {rating ? <EkRatingLine average={rating.average} count={rating.count} isNew={rating.isNew} testID="ek-product-rating" /> : null}
            {product.desc ? <Text style={[styles.desc, { color: c.secondary }]}>{product.desc}</Text> : null}
            <View style={styles.priceRow} testID="ek-product-price">
              <Text style={[ekType.b17, ekType.num, styles.bold, { color: c.ink }]}>{money(unitPrice)}</Text>
              {unitOriginal != null ? (
                <Text style={[ekType.c13, ekType.num, { color: c.secondary, textDecorationLine: 'line-through' }]}>
                  {money(unitOriginal)}
                </Text>
              ) : null}
              {derived.hasDiscount && derived.discountBadge ? (
                <View style={[styles.discount, { backgroundColor: c.accent }]}>
                  <Text style={[ekType.c13, styles.bold, { color: c.onAccent }]}>{derived.discountBadge}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {derived.macroCardEnabled ? (
            <View
              onLayout={(e: LayoutChangeEvent) => {
                macroBottom.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
              }}
            >
              <MacroRings macros={derived.macros} />
            </View>
          ) : null}

          {groupModels.map((g) => (
            <OptionGroupSection
              key={g.key}
              group={g}
              highlight={tried && missingKeys.has(g.key)}
              onToggle={(itemKey) => onToggle(g.key, itemKey)}
              onLayout={(e) => {
                sectionY.current[g.key] = bodyY.current + e.nativeEvent.layout.y;
              }}
            />
          ))}

          {optionsError ? <Text style={[ekType.c13, { color: c.danger }]}>{optionsError}</Text> : null}

          {ingredients.rows.length > 0 ? (
            <View style={styles.ingSection} accessibilityLabel={t('eatkcal.v2.product.ingredients')} testID="ek-product-ingredients">
              <Text style={[styles.h16, { color: c.ink }]} accessibilityRole="header">
                {t('eatkcal.v2.product.ingredients')}
              </Text>
              <View style={[styles.ingCard, { backgroundColor: c.surface }]}>
                <Text style={[styles.ingSum, { color: c.ink }]}>{ingredients.summary}</Text>
                {ingOpen ? (
                  <IngredientRows rows={ingredients.rows} reduced={reduced} lineColor={c.line} ink={c.ink} sec={c.secondary} />
                ) : null}
                <Pressable
                  onPress={() => setIngOpen((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: ingOpen }}
                  style={styles.ingToggle}
                  testID="ek-product-ing-toggle"
                >
                  <Text style={[styles.ingToggleText, { color: c.ink }]}>
                    {ingOpen ? t('eatkcal.v2.product.show_less') : t('eatkcal.v2.product.all_ingredients')}
                  </Text>
                  <View style={{ transform: [{ rotate: ingOpen ? '180deg' : '0deg' }] }}>
                    <CaretDown size={16} color={c.ink} />
                  </View>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ProductBottomBar
        quantity={quantity}
        onQuantity={onQuantity}
        price={price}
        ready={ready}
        missing={tried && !ready}
        open={layerOpen}
        added={added && ready}
        infoAmount={infoAmount}
        infoName={infoName}
        macros={layerMacros}
        onAdd={handleAdd}
        onGoCart={() => navigation.navigate('EkCart')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  hero: { width: '100%', height: HERO_H },
  heroBar: { position: 'absolute', left: 4, right: 4, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  desc: { fontFamily: ekType.b15.fontFamily, fontSize: 14, lineHeight: 20 },
  bold: { fontFamily: fontFamily.bodyBold },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  discount: { height: 22, paddingHorizontal: 6, borderRadius: 11, justifyContent: 'center', alignSelf: 'center' },
  h16: { fontFamily: fontFamily.bodyBold, fontSize: 16, lineHeight: 21 },
  ingSection: { gap: 8 },
  ingCard: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 4, borderRadius: 20 },
  ingSum: { fontFamily: ekType.b15.fontFamily, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  ingToggle: { alignSelf: 'flex-start', minHeight: 44, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ingToggleText: { fontFamily: fontFamily.bodyBold, fontSize: 14, lineHeight: 19 },
  ingRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1 },
  ingRowText: { fontFamily: ekType.b15.fontFamily, fontSize: 14, lineHeight: 19 },
  body: {
    marginTop: -24,
    paddingTop: 18,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 16,
  },
});

/** "Tüm içerik" satırları — 200 ms opaklıkla açılır (Final `fadeIn`). */
function IngredientRows({
  rows,
  reduced,
  lineColor,
  ink,
  sec,
}: {
  rows: { key: string; name: string; value: string }[];
  reduced: boolean;
  lineColor: string;
  ink: string;
  sec: string;
}) {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(o, { toValue: 1, duration: DURATION.fast, easing: reduced ? RN_CURVE.linear : STD_EASE, useNativeDriver: true }).start();
  }, [o, reduced]);
  return (
    <Animated.View style={{ opacity: o, marginTop: 4 }} testID="ek-product-ing-rows">
      {rows.map((r) => (
        <View key={r.key} style={[styles.ingRow, { borderTopColor: lineColor }]}>
          <Text style={[styles.ingRowText, { color: ink, flexShrink: 1 }]}>{r.name}</Text>
          {r.value ? <Text style={[styles.ingRowText, ekType.num, { color: sec }]}>{r.value}</Text> : null}
        </View>
      ))}
    </Animated.View>
  );
}
