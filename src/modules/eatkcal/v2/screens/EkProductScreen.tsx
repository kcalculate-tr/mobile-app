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
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, X } from '../../../../components/icons';
import { CachedImage } from '../../../../components/CachedImage';
import { transformImageUrl, ImagePreset } from '../../../../lib/imageUrl';
import { getSupabaseClient } from '../../../../core/supabase';
import { haptic } from '../../../../core/design';
import { mapSupabaseErrorToUserMessage } from '../../../../lib/supabaseErrors';
import { fetchProductImagesByName, fetchProductOptionGroups, getGroupSelectionLimits, mapProductRow } from '../../../../lib/products';
import { fetchProductOptionLinks } from '../../../../lib/productOptions';
import { logEvent, track } from '../../../../lib/analytics';
import { getEffectivePrice } from '../../../../utils/price';
import { useCartStore } from '../../../../store/cartStore';
import type { OptionGroup, Product, ProductOptionLink } from '../../../../types';
import { EkButton, EkSkeleton, ekType, useEk } from '../ui/kit';
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
import { LiveMacroStrip, MacroRings } from '../ui/product/MacroRings';
import { ProductBottomBar } from '../ui/product/ProductBottomBar';

const HERO_H = 330;
const BAR_H = 96;
/** FinMoCart: "Sepette ✓" anı → geri dönüş. */
const ADDED_HOLD_MS = 650;

export default function EkProductScreen() {
  const route = useRoute<RouteProp<EkNavList, 'EkProduct'>>();
  const navigation = useEkNav();
  const { c, t, insets, theme } = useEk();
  const addItem = useCartStore((s) => s.addItem);
  const productId = route.params?.productId;
  // YALNIZ __DEV__ vitrini (FinEkProductScroll): seçimlere kaydırılmış başlar.
  const vitrinScroll = __DEV__ ? (route.params as { vitrinScroll?: boolean } | undefined)?.vitrinScroll : undefined;

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
  const [quantity, setQuantity] = useState(1);
  const [tried, setTried] = useState(false);
  const [added, setAdded] = useState(false);
  const [stripVisible, setStripVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const bodyY = useRef(0);
  const macroBottom = useRef(0);
  const sectionY = useRef<Record<string, number>>({});
  const addTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (addTimer.current) clearTimeout(addTimer.current);
  }, []);

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
    logEvent.viewContent(String(product.id), product.name ?? '', price);
    track('product_view', {
      product_id: String(product.id),
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

  useEffect(() => {
    if (!vitrinScroll || loading) return;
    const h = setTimeout(() => {
      const y = bodyY.current + macroBottom.current + 24;
      scrollRef.current?.scrollTo({ y, animated: false });
      if (derived?.macroCardEnabled) setStripVisible(true);
    }, 600);
    return () => clearTimeout(h);
  }, [vitrinScroll, loading, derived?.macroCardEnabled]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (macroBottom.current <= 0 || !derived?.macroCardEnabled) return;
    const show = e.nativeEvent.contentOffset.y > bodyY.current + macroBottom.current;
    if (show !== stripVisible) setStripVisible(show);
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
    setAdded(true);
    addTimer.current = setTimeout(() => {
      if (navigation.canGoBack()) navigation.goBack();
    }, ADDED_HOLD_MS);
  };

  // ── Durumlar ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: c.bg }]} testID="ek-product-skeleton">
        <EkSkeleton height={HERO_H} radius={0} />
        <View style={{ padding: 16, gap: 12 }}>
          <EkSkeleton height={14} width="30%" />
          <EkSkeleton height={26} width="70%" />
          <EkSkeleton height={84} radius={20} />
          <EkSkeleton height={184} width={136} radius={18} />
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
  const originalPrice = derived.hasDiscount ? addTotal(derived, quantity, 'original') : null;
  const kcalTotal = derived.macroCardEnabled ? Math.round(derived.macros.kcal * quantity) : null;
  const subline = ready
    ? kcalTotal != null
      ? t('eatkcal.v2.product.total_kcal', { n: kcalTotal })
      : ''
    : tried
      ? t('eatkcal.v2.product.missing_list', { names: missing.map((m) => m.name).join(', ') })
      : t('eatkcal.v2.product.complete_required');
  const roundBtn = [styles.roundBtn, { backgroundColor: theme.isDark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.85)' }];

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]} testID="ek-product">
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: BAR_H + insets.bottom + 56 }}
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
              <ArrowLeft size={20} color={c.ink} />
            </Pressable>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t('eatkcal.v2.product.close')}
              style={roundBtn}
            >
              <X size={20} color={c.ink} />
            </Pressable>
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
            {product.desc ? <Text style={[ekType.b15, { color: c.secondary }]}>{product.desc}</Text> : null}
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
        </View>
      </ScrollView>

      {derived.macroCardEnabled ? (
        <LiveMacroStrip macros={derived.macros} visible={stripVisible} bottom={BAR_H + insets.bottom + 4} />
      ) : null}

      <ProductBottomBar
        quantity={quantity}
        onQuantity={setQuantity}
        price={price}
        originalPrice={originalPrice}
        discountBadge={derived.hasDiscount ? derived.discountBadge : null}
        subline={subline}
        ready={ready}
        added={added}
        onAdd={handleAdd}
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
  body: {
    marginTop: -24,
    paddingTop: 18,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 16,
  },
});
