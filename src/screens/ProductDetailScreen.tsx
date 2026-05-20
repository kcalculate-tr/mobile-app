import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Animated,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { CachedImage } from '../components/CachedImage';
import { transformImageUrl, ImagePreset } from '../lib/imageUrl';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, ShoppingCart, CheckCircle, Check as CheckIcon } from 'phosphor-react-native';
import { MACRO_COLORS, hexToRgba } from '../constants/colors';
import { haptic } from '../utils/haptics';
import { useAnimatedPress } from '../utils/useAnimatedPress';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedNumberText from '../components/AnimatedNumberText';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { getSupabaseClient } from '../lib/supabase';
import { mapSupabaseErrorToUserMessage } from '../lib/supabaseErrors';
import {
  fetchProductOptionGroups,
  getGroupSelectionLimits,
  mapProductRow,
} from '../lib/products';
import { RootStackParamList } from '../navigation/types';
import { BundleSelection, OptionGroup, OptionItem, Product, ProductOptionLink, SelectedOption } from '../types';
import { fetchProductOptionLinks } from '../lib/productOptions';
import {
  calculateOptionsPriceModifier,
  getEffectivePrice,
  hasDiscount,
  formatDiscountBadge,
} from '../utils/price';
import { useCartStore } from '../store/cartStore';
import { buildCartLineKey, normalizeSelectedOptions } from '../lib/cart';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../constants/theme';

type ProductDetailRoute = RouteProp<RootStackParamList, 'ProductDetail'>;
type ProductDetailNavigation = NativeStackNavigationProp<RootStackParamList>;

const toCurrency = (value: number) => `₺${value.toFixed(2)}`;

interface MacroBadgeProps {
  label: string;
  value: number | undefined;
  unit: string;
  color: string;
  trackColor: string;
  percentage: number;
}

const MacroBadge: React.FC<MacroBadgeProps> = ({ label, value, unit, color, trackColor, percentage }) => {
  const v = value ?? 0;
  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(percentage, 1);

  return (
    <View style={styles.macroBadge}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
          />
        </Svg>
        <View style={styles.macroCenter}>
          <Text style={[styles.macroValue, { color }]}>{v}</Text>
          <Text style={styles.macroUnit}>{unit}</Text>
        </View>
      </View>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
};

export default function ProductDetailScreen() {
  const route = useRoute<ProductDetailRoute>();
  const navigation = useNavigation<ProductDetailNavigation>();
  const insets = useSafeAreaInsets();

  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const cartItems = useCartStore((state) => state.items);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [liked, setLiked] = useState(false);

  const addButtonScale  = useRef(new Animated.Value(1)).current
  const successOpacity  = useRef(new Animated.Value(0)).current
  const { animatedScale: cartBtnScale, onPressIn: cartPressIn, onPressOut: cartPressOut } = useAnimatedPress(0.95);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [optionLinks, setOptionLinks] = useState<ProductOptionLink[]>([]);
  const [selectedByTemplate, setSelectedByTemplate] = useState<Record<number, number[]>>({});
  const [selectedGramajIndex, setSelectedGramajIndex] = useState<number>(-1);
  const scrollViewRef = useRef<ScrollView>(null);
  const optionGroupsOffsetY = useRef(0);
  const groupPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', route.params.productId)
          .maybeSingle();

        if (!mounted) return;
        if (error) throw error;

        if (!data) {
          setProduct(null);
          setErrorMessage('Ürün bulunamadı.');
          return;
        }

        setProduct(mapProductRow(data as Record<string, unknown>));
      } catch (error: unknown) {
        if (!mounted) return;
        console.error('Ürün detayı alınamadı:', error);
        setProduct(null);
        setErrorMessage(mapSupabaseErrorToUserMessage(error, 'Ürün bilgisi alınamadı.'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      mounted = false;
    };
  }, [route.params.productId]);

  useEffect(() => {
    if (!product?.id) return;
    let mounted = true;

    const fetchOptions = async () => {
      try {
        setOptionsLoading(true);
        setOptionsError('');

        const supabase = getSupabaseClient();
        const groups = await fetchProductOptionGroups(supabase, String(product.id));

        if (!mounted) return;
        setOptionGroups(groups);

        setSelections({});
      } catch (error: unknown) {
        if (!mounted) return;
        console.error('Ürün opsiyonları alınamadı:', error);
        setOptionGroups([]);
        setSelections({});
        setOptionsError('Seçim grupları şu an yüklenemiyor.');
      } finally {
        if (mounted) {
          setOptionsLoading(false);
        }
      }
    };

    fetchOptions();

    return () => {
      mounted = false;
    };
  }, [product?.id]);

  useEffect(() => {
    if (!product?.id) {
      setOptionLinks([]);
      setSelectedByTemplate({});
      return;
    }
    let mounted = true;
    (async () => {
      const links = await fetchProductOptionLinks(Number(product.id));
      if (!mounted) return;
      setOptionLinks(links);

      const initial: Record<number, number[]> = {};
      links.forEach((link) => {
        const tpl = link.template;
        if (!tpl) return;
        if (tpl.selection_type === 'single') {
          const def = tpl.values.find((v) => v.is_default) ?? tpl.values[0];
          initial[tpl.id] = def ? [def.id] : [];
        } else {
          initial[tpl.id] = tpl.values.filter((v) => v.is_default).map((v) => v.id);
        }
      });
      setSelectedByTemplate(initial);
    })();
    return () => {
      mounted = false;
    };
  }, [product?.id]);

  const toggleTemplateOption = (link: ProductOptionLink, valueId: number) => {
    const tpl = link.template;
    if (!tpl) return;
    setSelectedByTemplate((prev) => {
      const current = prev[tpl.id] || [];
      if (tpl.selection_type === 'single') {
        return { ...prev, [tpl.id]: [valueId] };
      }
      if (current.includes(valueId)) {
        return { ...prev, [tpl.id]: current.filter((id) => id !== valueId) };
      }
      if (link.effective_max != null && current.length >= link.effective_max) {
        return prev;
      }
      return { ...prev, [tpl.id]: [...current, valueId] };
    });
  };

  const builtTemplateOptions = useMemo<SelectedOption[]>(() => {
    const result: SelectedOption[] = [];
    optionLinks.forEach((link) => {
      const tpl = link.template;
      if (!tpl) return;
      const selectedIds = selectedByTemplate[tpl.id] || [];
      selectedIds.forEach((vid) => {
        const v = tpl.values.find((val) => val.id === vid);
        if (!v) return;
        result.push({
          template_id: tpl.id,
          template_name: tpl.name,
          value_id: v.id,
          value_name: v.name,
          price_modifier: Number(v.price_modifier) || 0,
          calorie_modifier: Number(v.calorie_modifier) || 0,
          protein_modifier: Number(v.protein_modifier) || 0,
          carbs_modifier: Number(v.carbs_modifier) || 0,
          fats_modifier: Number(v.fats_modifier) || 0,
        });
      });
    });
    return result;
  }, [optionLinks, selectedByTemplate]);

  const templateOptionsPriceMod = useMemo(
    () => calculateOptionsPriceModifier(builtTemplateOptions),
    [builtTemplateOptions],
  );

  // ── Hooks MUST be above early returns (Rules of Hooks) ─────────────────────
  // Dep on product?.id (stable across re-renders) instead of the array ref —
  // prevents user gramaj selection from being reset by cart-store-triggered re-renders.
  const gramajOptions = useMemo(() => {
    const raw = Array.isArray(product?.gramaj_options) ? product.gramaj_options : [];
    return raw
      .map((g: any, idx: number) => ({
        name: String(g?.name ?? '').trim(),
        price_modifier: Number(g?.price_modifier) || 0,
        calorie_modifier: Number(g?.calorie_modifier) || 0,
        protein_modifier: Number(g?.protein_modifier) || 0,
        carbs_modifier: Number(g?.carbs_modifier) || 0,
        fats_modifier: Number(g?.fats_modifier) || 0,
        is_default: Boolean(g?.is_default),
        display_order: Number(g?.display_order) || idx,
      }))
      .filter((g) => g.name.length > 0)
      .sort((a, b) => a.display_order - b.display_order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const selectedGramaj = useMemo(() => {
    if (!Array.isArray(gramajOptions) || gramajOptions.length === 0) return null;
    if (selectedGramajIndex < 0 || selectedGramajIndex >= gramajOptions.length) return null;
    return gramajOptions[selectedGramajIndex] ?? null;
  }, [gramajOptions, selectedGramajIndex]);

  const gramajPriceMod = useMemo(
    () => (selectedGramaj ? Number(selectedGramaj.price_modifier) || 0 : 0),
    [selectedGramaj],
  );

  const effectiveMacros = useMemo(() => {
    const base = {
      calories: Number(product?.calories ?? product?.cal) || 0,
      protein: Number(product?.protein) || 0,
      carbs: Number(product?.carbs) || 0,
      fats: Number(product?.fats) || 0,
    };
    if (selectedGramaj) {
      base.calories += Number(selectedGramaj.calorie_modifier) || 0;
      base.protein += Number(selectedGramaj.protein_modifier) || 0;
      base.carbs += Number(selectedGramaj.carbs_modifier) || 0;
      base.fats += Number(selectedGramaj.fats_modifier) || 0;
    }
    const opts = Array.isArray(builtTemplateOptions) ? builtTemplateOptions : [];
    opts.forEach((opt) => {
      base.calories += Number(opt?.calorie_modifier) || 0;
      base.protein += Number(opt?.protein_modifier) || 0;
      base.carbs += Number(opt?.carbs_modifier) || 0;
      base.fats += Number(opt?.fats_modifier) || 0;
    });
    base.calories = Math.max(0, Math.round(base.calories));
    base.protein = Math.max(0, base.protein);
    base.carbs = Math.max(0, base.carbs);
    base.fats = Math.max(0, base.fats);
    return base;
  }, [product, builtTemplateOptions, selectedGramaj]);

  // ── Bundle (çoklu ürün) canlı makro toplamı ────────────────────────────────
  // Bundle ürünlerde manuel makro kolonları yoktur; toplam, her slot'ta
  // (option_group) seçilen option_items'ların makrolarından canlı hesaplanır.
  // Tekli ürünlerde bu blok devreye girmez (effectiveMacros korunur).
  const isBundle = Boolean(product?.is_bundle);

  const bundleMacros = useMemo(() => {
    const total = { calories: 0, protein: 0, carbs: 0, fats: 0 };
    if (!isBundle) return total;
    optionGroups.forEach((group) => {
      const selectedIds = new Set(selections[group.id] || []);
      group.items.forEach((item) => {
        if (!selectedIds.has(item.id)) return;
        total.calories += Number(item.calories) || 0;
        total.protein += Number(item.protein) || 0;
        total.carbs += Number(item.carbs) || 0;
        total.fats += Number(item.fats) || 0;
      });
    });
    total.calories = Math.max(0, Math.round(total.calories));
    total.protein = Math.max(0, total.protein);
    total.carbs = Math.max(0, total.carbs);
    total.fats = Math.max(0, total.fats);
    return total;
  }, [isBundle, optionGroups, selections]);

  const secondaryOptionLinks = useMemo(() => {
    return Array.isArray(optionLinks) ? optionLinks : [];
  }, [optionLinks]);

  // Initialize gramaj selection ONLY when product changes — preserve user
  // choice across re-renders triggered by cart store / focus / etc.
  useEffect(() => {
    if (!Array.isArray(gramajOptions) || gramajOptions.length === 0) {
      setSelectedGramajIndex(-1);
      return;
    }
    setSelectedGramajIndex((prev) => {
      if (prev >= 0 && prev < gramajOptions.length) return prev;
      const defaultIdx = gramajOptions.findIndex((g) => g.is_default);
      return defaultIdx >= 0 ? defaultIdx : 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const validateTemplateSelections = (): { valid: boolean; missing: string[] } => {
    const missing: string[] = [];
    optionLinks.forEach((link) => {
      const tpl = link.template;
      if (!tpl) return;
      const selected = selectedByTemplate[tpl.id] || [];
      if (link.effective_required && selected.length === 0) {
        missing.push(tpl.name);
        return;
      }
      if (tpl.selection_type === 'multiple' && link.effective_min > 0 && selected.length < link.effective_min) {
        missing.push(`${tpl.name} (en az ${link.effective_min})`);
      }
    });
    return { valid: missing.length === 0, missing };
  };

  // Bir seçim yapıldığında SADECE bir sonraki opsiyon section'ına kaydır.
  // Atlama (sıradaki "doldurulmamış zorunlu") YOK — bu kullanıcıyı çok
  // aşağı atıyordu. Son grup seçildiyse alt bar görünür olsun diye sona kaydır.
  // ScrollView header'ın ALTINDA ayrı bir bölge; groupPositions içerik
  // koordinatı olduğundan header/safe-area eklemeye gerek yok, sadece
  // küçük bir nefes payı bırakıyoruz.
  const NEXT_SECTION_TOP_GAP = 16;
  const scrollToNextGroup = (currentGroupId: string) => {
    setTimeout(() => {
      const currentIndex = optionGroups.findIndex((g) => g.id === currentGroupId);
      if (currentIndex === -1) return;
      const nextGroup = optionGroups[currentIndex + 1];
      if (!nextGroup) {
        scrollViewRef.current?.scrollToEnd({ animated: true });
        return;
      }
      const y = groupPositions.current[nextGroup.id];
      if (y === undefined) return;
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, y - NEXT_SECTION_TOP_GAP),
        animated: true,
      });
    }, 250);
  };

  const toggleSelection = (group: OptionGroup, itemId: string) => {
    const { max } = getGroupSelectionLimits(group);
    const current = new Set(selections[group.id] || []);
    let shouldAdvance = false;
    let nextSelection: string[];

    if (max === 1) {
      nextSelection = [itemId];
      shouldAdvance = true;
    } else if (current.has(itemId)) {
      current.delete(itemId);
      nextSelection = Array.from(current);
    } else if (current.size < max) {
      current.add(itemId);
      nextSelection = Array.from(current);
      shouldAdvance = nextSelection.length === max;
    } else {
      return;
    }

    setSelections((prev) => ({ ...prev, [group.id]: nextSelection }));

    if (shouldAdvance) {
      scrollToNextGroup(group.id);
    }
  };

  const selectionsValid = useMemo(() => {
    if (!optionGroups.length) return true;

    return optionGroups.every((group) => {
      const { min, max } = getGroupSelectionLimits(group);
      const selectedCount = (selections[group.id] || []).length;
      return selectedCount >= min && selectedCount <= max;
    });
  }, [optionGroups, selections]);

  const extraPrice = useMemo(() => {
    let total = 0;
    optionGroups.forEach((group) => {
      const selectedIds = new Set(selections[group.id] || []);
      group.items.forEach((item) => {
        if (selectedIds.has(item.id)) {
          total += item.priceAdjustment;
        }
      });
    });
    return Number(total.toFixed(2));
  }, [optionGroups, selections]);

  // ── FIX 5: tekli üründe linked_product_id'li seçili opsiyonlar AYRI
  // cart_item olur (her biri kendi fiyatı + makrosu, ayrı silinebilir).
  // Sade opsiyonlar (linkedProductId yok) ve bundle bu mantığın DIŞINDA —
  // mevcut davranışları korunur.
  const splitSelectedItems = useMemo<
    { groupId: string; groupName: string; item: OptionItem }[]
  >(() => {
    if (isBundle) return [];
    const out: { groupId: string; groupName: string; item: OptionItem }[] = [];
    optionGroups.forEach((group) => {
      const selectedIds = new Set(selections[group.id] || []);
      group.items.forEach((item) => {
        if (selectedIds.has(item.id) && item.linkedProductId != null) {
          out.push({ groupId: group.id, groupName: group.name, item });
        }
      });
    });
    return out;
  }, [isBundle, optionGroups, selections]);

  const splitItemIdSet = useMemo(
    () => new Set(splitSelectedItems.map((s) => s.item.id)),
    [splitSelectedItems],
  );

  // Ana cart_item'ın taşıyacağı seçimler = split EDİLMEYEN opsiyonlar.
  // currentLineKey ve ana addItem çağrısı bunu kullanır ki split sonrası
  // inCart/stepper tutarlı kalsın ve mükerrer ekleme olmasın.
  const nonSplitByGroup = useMemo(() => {
    const out: Record<string, string[]> = {};
    Object.entries(selections).forEach(([gid, ids]) => {
      const kept = ids.filter((id) => !splitItemIdSet.has(id));
      if (kept.length > 0) out[gid] = kept;
    });
    return out;
  }, [selections, splitItemIdSet]);

  const effectiveBasePrice = useMemo(() => getEffectivePrice(product), [product]);
  const productHasDiscount = useMemo(() => hasDiscount(product), [product]);
  const totalUnitPrice = Number(
    (effectiveBasePrice + extraPrice + templateOptionsPriceMod + gramajPriceMod).toFixed(2),
  );
  const originalUnitPrice = Number(
    ((product?.price || 0) + extraPrice + templateOptionsPriceMod + gramajPriceMod).toFixed(2),
  );

  // Bu varyant sepette mi?
  const currentLineKey = useMemo(() => {
    if (!product) return null;
    const lineTemplateOptions: SelectedOption[] = [...builtTemplateOptions];
    if (selectedGramaj) {
      lineTemplateOptions.unshift({
        template_id: 0,
        template_name: 'Et Gramajı',
        value_id: selectedGramajIndex,
        value_name: selectedGramaj.name,
        price_modifier: Number(selectedGramaj.price_modifier) || 0,
        calorie_modifier: Number(selectedGramaj.calorie_modifier) || 0,
        protein_modifier: Number(selectedGramaj.protein_modifier) || 0,
        carbs_modifier: Number(selectedGramaj.carbs_modifier) || 0,
        fats_modifier: Number(selectedGramaj.fats_modifier) || 0,
      });
    }
    const normalized = normalizeSelectedOptions({
      byGroup: nonSplitByGroup,
      templateOptions: lineTemplateOptions,
    });
    return buildCartLineKey(
      String(product.id),
      normalized.byGroup,
      normalized.templateOptions,
    );
  }, [product, nonSplitByGroup, builtTemplateOptions, selectedGramaj, selectedGramajIndex]);

  const cartEntry = useMemo(
    () => (currentLineKey ? cartItems.find((i) => i.lineKey === currentLineKey) ?? null : null),
    [cartItems, currentLineKey],
  );
  const inCart = cartEntry != null;

  // Bottom bar state crossfade — Animated.parallel (250ms, opacity + translateX)
  const addBtnOpacity  = useRef(new Animated.Value(inCart ? 0 : 1)).current;
  const stepperOpacity = useRef(new Animated.Value(inCart ? 1 : 0)).current;
  const prevInCartRef  = useRef(inCart);

  useEffect(() => {
    if (prevInCartRef.current === inCart) return;
    prevInCartRef.current = inCart;
    Animated.parallel([
      Animated.timing(addBtnOpacity,  { toValue: inCart ? 0 : 1, duration: 250, useNativeDriver: true }),
      Animated.timing(stepperOpacity, { toValue: inCart ? 1 : 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [inCart, addBtnOpacity, stepperOpacity]);

  const addBtnTx  = addBtnOpacity.interpolate({  inputRange: [0, 1], outputRange: [-30, 0] });
  const stepperTx = stepperOpacity.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  const animateAddToCart = () => {
    Animated.sequence([
      Animated.spring(addButtonScale, { toValue: 0.9, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(addButtonScale, { toValue: 1,   useNativeDriver: true, speed: 20, bounciness: 12 }),
    ]).start()
    Animated.sequence([
      Animated.timing(successOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(800),
      Animated.timing(successOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start()
  }

  const handleAddToCart = () => {
    if (!product) return;
    if (!selectionsValid) {
      setValidationAttempted(true);
      haptic.error();
      return;
    }
    const { valid: tplValid, missing } = validateTemplateSelections();
    const fullMissing = [...missing];
    if (gramajOptions.length > 0 && !selectedGramaj) {
      fullMissing.unshift('Et Gramajı');
    }
    if (!tplValid || fullMissing.length > 0) {
      haptic.error();
      Alert.alert(
        'Eksik Seçim',
        `Lütfen şunları seçin:\n${fullMissing.map((m) => `• ${m}`).join('\n')}`,
      );
      return;
    }

    const cartTemplateOptions: SelectedOption[] = [...builtTemplateOptions];
    if (selectedGramaj) {
      cartTemplateOptions.unshift({
        template_id: 0,
        template_name: 'Et Gramajı',
        value_id: selectedGramajIndex,
        value_name: selectedGramaj.name,
        price_modifier: Number(selectedGramaj.price_modifier) || 0,
        calorie_modifier: Number(selectedGramaj.calorie_modifier) || 0,
        protein_modifier: Number(selectedGramaj.protein_modifier) || 0,
        carbs_modifier: Number(selectedGramaj.carbs_modifier) || 0,
        fats_modifier: Number(selectedGramaj.fats_modifier) || 0,
      });
    }

    // Bundle: her slot'ta seçilen öğünü self-contained (isim + makro) olarak
    // sepete taşı. Makro kaynağı OptionItem (linked product / kolon) — Bug 1
    // ile aynı veri. Tekli ürün için bu dizi boş kalır, davranış değişmez.
    const bundleSelections: BundleSelection[] = isBundle
      ? optionGroups.flatMap((group) => {
          const selectedIds = new Set(selections[group.id] || []);
          return group.items
            .filter((item) => selectedIds.has(item.id))
            .map((item) => ({
              slot_name: group.name,
              option_item_id: item.id,
              linked_product_id: item.linkedProductId ?? null,
              name: item.name,
              calories: Number(item.calories) || 0,
              protein: Number(item.protein) || 0,
              carbs: Number(item.carbs) || 0,
              fat: Number(item.fats) || 0,
            }));
        })
      : [];

    // FIX 5: split EDİLEN opsiyonlar ana item'a girmesin — ana item yalnız
    // base (+ sade opsiyonlar + eski template/gramaj). Split opsiyonlar
    // aşağıda ayrı cart_item olarak eklenir. Bundle bu mantığın dışında.
    let mainExtraPrice = 0;
    const mainLabels: string[] = [];
    optionGroups.forEach((group) => {
      const selectedIds = new Set(selections[group.id] || []);
      group.items.forEach((item) => {
        if (!selectedIds.has(item.id) || splitItemIdSet.has(item.id)) return;
        mainExtraPrice += item.priceAdjustment;
        mainLabels.push(`${group.name}: ${item.name}`);
      });
    });

    addItem(
      product,
      {
        byGroup: nonSplitByGroup,
        extraPrice: Number(mainExtraPrice.toFixed(2)),
        labels: mainLabels,
        templateOptions: cartTemplateOptions.length > 0 ? cartTemplateOptions : undefined,
        bundleSelections: bundleSelections.length > 0 ? bundleSelections : undefined,
      },
      1,
    );

    // Her linked opsiyon = bağlı gerçek ürün gibi AYRI cart_item, ama
    // ana ürüne parentLineKey ile bağlanır → CartScreen'de parent altında
    // indent grup olarak görünür (bundle UI pattern reuse). slot adı
    // child.selectedOptions.labels[0]'a yazılır.
    const parentKey = currentLineKey ?? undefined;
    splitSelectedItems.forEach(({ groupName, item }) => {
      const optProduct: Product = {
        id: item.linkedProductId as number,
        name: item.name,
        price: Number(item.priceAdjustment) || 0,
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        carbs: Number(item.carbs) || 0,
        fats: Number(item.fats) || 0,
        is_bundle: false,
      };
      addItem(optProduct, { labels: [groupName] }, 1, parentKey);
    });

    haptic.light();
    animateAddToCart();
  };

  if (loading) {
    return (
      <View style={[styles.container, { flex: 1, paddingTop: insets.top }]}>
        <SkeletonLoader height={320} borderRadius={0} />
        <View style={{ padding: 16, gap: 14 }}>
          <SkeletonLoader height={26} width="70%" />
          <SkeletonLoader height={18} width="35%" />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <SkeletonLoader height={56} width="31%" borderRadius={14} />
            <SkeletonLoader height={56} width="31%" borderRadius={14} />
            <SkeletonLoader height={56} width="31%" borderRadius={14} />
          </View>
          <SkeletonLoader height={14} width="100%" style={{ marginTop: 8 }} />
          <SkeletonLoader height={14} width="90%" />
          <SkeletonLoader height={14} width="60%" />
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, { flex: 1, paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Ürün Yüklenemedi</Text>
          <Text style={styles.errorText}>{errorMessage || 'Bilinmeyen hata oluştu.'}</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Bundle ise canlı toplam, değilse mevcut effectiveMacros (tekli ürün
  // davranışı birebir korunur — bundleMacros bundle değilse hep 0 döner).
  const displayMacros = isBundle ? bundleMacros : effectiveMacros;

  const totalCalMacros =
    (displayMacros.carbs * 4) +
    (displayMacros.protein * 4) +
    (displayMacros.fats * 9) || 1;

  const macros = [
    {
      label: 'Kalori',
      value: displayMacros.calories,
      unit: 'kcal',
      color: MACRO_COLORS.calories.main,
      trackColor: MACRO_COLORS.calories.track,
      percentage: Math.min(displayMacros.calories / 2000, 1),
    },
    {
      label: 'Karb.',
      value: displayMacros.carbs,
      unit: 'g',
      color: MACRO_COLORS.carbs.main,
      trackColor: MACRO_COLORS.carbs.track,
      percentage: (displayMacros.carbs * 4) / totalCalMacros,
    },
    {
      label: 'Protein',
      value: displayMacros.protein,
      unit: 'g',
      color: MACRO_COLORS.protein.main,
      trackColor: MACRO_COLORS.protein.track,
      percentage: (displayMacros.protein * 4) / totalCalMacros,
    },
    {
      label: 'Yağ',
      value: displayMacros.fats,
      unit: 'g',
      color: MACRO_COLORS.fat.main,
      trackColor: MACRO_COLORS.fat.track,
      percentage: (displayMacros.fats * 9) / totalCalMacros,
    },
  ];

  return (
    <View style={[styles.container, { flex: 1, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptic.selection();
            navigation.goBack();
          }}
          style={styles.iconButton}
          activeOpacity={0.8}
        >
          <ArrowLeft size={20} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ürün Detayı</Text>
        <View style={styles.headerActions} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps="handled"
        style={styles.scrollView}
        contentContainerStyle={{
          paddingBottom: Math.max(180, insets.bottom + 140),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Image */}
        <View style={styles.imageContainer}>
          {product.img && !imageLoadError ? (
            <CachedImage
              uri={transformImageUrl(product.img, ImagePreset.productDetail) ?? product.img}
              style={styles.image}
              priority="high"
              contentFit="contain"
              onError={() => setImageLoadError(true)}
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderEmoji}>🍽️</Text>
              <Text style={styles.imagePlaceholderText}>Görsel Yüklenemedi</Text>
            </View>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.productTitle}>{product.name}</Text>

          {/* Description */}
          {product.desc ? (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionTitle}>Açıklama</Text>
              <Text style={styles.descriptionText}>{product.desc}</Text>
            </View>
          ) : null}

          {/* Et Gramajı — equal-width pill tab row (product.gramaj_options) */}
          {gramajOptions.length > 0 ? (
            <View style={styles.primaryTabSection}>
              <Text style={styles.primaryTabLabel}>
                Et Gramajı
                <Text style={styles.primaryTabRequiredStar}> *</Text>
              </Text>
              <View style={styles.gramajRow}>
                {gramajOptions.map((g, idx) => {
                  const isSelected = selectedGramajIndex === idx;
                  return (
                    <Pressable
                      key={`${g.name}-${idx}`}
                      onPress={() => setSelectedGramajIndex(idx)}
                      style={[styles.tabPill, isSelected && styles.tabPillSelected]}
                    >
                      <Text style={[styles.tabPillText, isSelected && styles.tabPillTextSelected]}>
                        {g.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Macro Badges — tekli: effectiveMacros (opsiyon farkları dahil);
              bundle: seçilen öğünlerin canlı toplamı, panel hep açık (0'dan başlar) */}
          {(isBundle || (product.calories ?? product.cal) != null) && (
            <View style={styles.macroContainer}>
              {macros.map((m) => (
                <MacroBadge key={m.label} {...m} />
              ))}
            </View>
          )}
        </View>

        {optionsLoading ? (
          <View style={styles.optionsLoading}>
            <ActivityIndicator color={COLORS.brand.green} />
          </View>
        ) : null}

        {!optionsLoading && optionGroups.length > 0 ? (
          <View
            onLayout={(e) => {
              optionGroupsOffsetY.current = e.nativeEvent.layout.y;
            }}
          >
            {optionGroups.map((group) => {
              const selected = new Set(selections[group.id] || []);
              const { min, max } = getGroupSelectionLimits(group);
              const selectedCount = selected.size;
              const isGroupInvalid = validationAttempted && selectedCount < min;
              const isMulti = max > 1;

              return (
                <View
                  key={group.id}
                  onLayout={(e) => {
                    groupPositions.current[group.id] =
                      optionGroupsOffsetY.current + e.nativeEvent.layout.y;
                  }}
                  style={[styles.optionGroupCard, isGroupInvalid && styles.optionGroupCardError]}
                >
                  <View style={styles.optionGroupHeader}>
                    <Text style={styles.optionGroupTitle}>{group.name}</Text>
                    {min > 0 && (
                      <View style={[styles.requiredPill, isGroupInvalid && styles.requiredPillError]}>
                        <Text style={[styles.requiredPillText, isGroupInvalid && styles.requiredPillTextError]}>
                          Zorunlu
                        </Text>
                      </View>
                    )}
                  </View>
                  {group.description ? (
                    <Text style={styles.optionGroupDesc}>{group.description}</Text>
                  ) : null}
                  {isGroupInvalid && (
                    <Text style={styles.groupValidationError}>⚠ Lütfen bir seçim yapınız</Text>
                  )}

                  <View style={styles.optionList}>
                    {group.items.map((item, idx) => {
                      const isSelected = selected.has(item.id);
                      const isDisabled =
                        !item.isAvailable ||
                        (!isSelected && max > 1 && selected.size >= max);
                      const isLast = idx === group.items.length - 1;

                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => toggleSelection(group, item.id)}
                          disabled={isDisabled}
                          style={({ pressed }) => [
                            styles.optionRow,
                            !isLast && styles.optionRowDivider,
                            isDisabled && styles.optionRowDisabled,
                            pressed && !isDisabled && styles.optionRowPressed,
                          ]}
                        >
                          {isMulti ? (
                            <View
                              style={[
                                styles.checkbox,
                                isSelected && styles.checkboxSelected,
                              ]}
                            >
                              {isSelected && <CheckIcon size={14} color="#000000" weight="bold" />}
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.radio,
                                isSelected && styles.radioSelected,
                              ]}
                            >
                              {isSelected && <View style={styles.radioInner} />}
                            </View>
                          )}

                          <View style={styles.optionLabelRow}>
                            <Text style={styles.optionName}>{item.name}</Text>
                            {item.priceAdjustment > 0 && (
                              <Text style={styles.optionPriceInline}>
                                {`(+₺${item.priceAdjustment.toFixed(0)})`}
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {!optionsLoading && optionsError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{optionsError}</Text>
          </View>
        ) : null}

        {secondaryOptionLinks.length > 0
          ? secondaryOptionLinks.map((link) => {
              const tpl = link.template;
              if (!tpl) return null;
              const selectedIds = selectedByTemplate[tpl.id] || [];
              const isMulti = tpl.selection_type === 'multiple';
              return (
                <View key={link.id} style={styles.optionGroupCard}>
                  <View style={styles.optionGroupHeader}>
                    <Text style={styles.optionGroupTitle}>{tpl.name}</Text>
                    {link.effective_required ? (
                      <View style={styles.requiredPill}>
                        <Text style={styles.requiredPillText}>Zorunlu</Text>
                      </View>
                    ) : null}
                  </View>
                  {tpl.description ? (
                    <Text style={styles.optionGroupDesc}>{tpl.description}</Text>
                  ) : null}
                  <View style={styles.optionList}>
                    {tpl.values.map((value, idx) => {
                      const isSelected = selectedIds.includes(value.id);
                      const isDisabled =
                        isMulti &&
                        !isSelected &&
                        link.effective_max != null &&
                        selectedIds.length >= link.effective_max;
                      const isLast = idx === tpl.values.length - 1;
                      return (
                        <Pressable
                          key={value.id}
                          onPress={() => toggleTemplateOption(link, value.id)}
                          disabled={isDisabled}
                          style={({ pressed }) => [
                            styles.optionRow,
                            !isLast && styles.optionRowDivider,
                            isDisabled && styles.optionRowDisabled,
                            pressed && !isDisabled && styles.optionRowPressed,
                          ]}
                        >
                          {isMulti ? (
                            <View
                              style={[
                                styles.checkbox,
                                isSelected && styles.checkboxSelected,
                              ]}
                            >
                              {isSelected ? (
                                <CheckIcon size={14} color="#000000" weight="bold" />
                              ) : null}
                            </View>
                          ) : (
                            <View style={[styles.radio, isSelected && styles.radioSelected]}>
                              {isSelected ? <View style={styles.radioInner} /> : null}
                            </View>
                          )}
                          <View style={styles.optionLabelRow}>
                            <Text style={styles.optionName}>{value.name}</Text>
                            {Number(value.price_modifier) !== 0 ? (
                              <Text style={styles.optionPriceInline}>
                                {`(${value.price_modifier > 0 ? '+' : ''}₺${Number(value.price_modifier).toFixed(0)})`}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })
          : null}
      </ScrollView>

      {/* Bottom Bar — iki varyant crossfade ile yer değiştirir */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(14, insets.bottom) }]}>
        <View style={styles.bottomBarContent}>
          {/* Varyant A: sepette yok → Toplam Tutar + Sepete Ekle */}
          <Animated.View
            pointerEvents={inCart ? 'none' : 'auto'}
            style={[
              styles.bottomBarVariant,
              styles.bottomBarVariantNotInCart,
              { opacity: addBtnOpacity, transform: [{ translateX: addBtnTx }] },
            ]}
          >
            <View style={styles.priceSection}>
              <Text style={styles.priceLabel}>Toplam Tutar</Text>
              {productHasDiscount ? (
                <View style={styles.priceRowDiscount}>
                  <Text style={styles.priceValueDiscounted}>{toCurrency(totalUnitPrice)}</Text>
                  <View style={styles.priceMetaCol}>
                    <Text style={styles.priceOriginalStrike}>{toCurrency(originalUnitPrice)}</Text>
                    <Text style={styles.priceDiscountBadge}>{formatDiscountBadge(product?.discount_type, product?.discount_value)}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.priceValue}>{toCurrency(totalUnitPrice)}</Text>
              )}
            </View>
            <Animated.View style={{ transform: [{ scale: addButtonScale }] }}>
              <TouchableOpacity
                style={styles.addToCartButton}
                onPress={handleAddToCart}
                onPressIn={cartPressIn}
                onPressOut={cartPressOut}
                activeOpacity={1}
              >
                <ShoppingBag size={18} color="#000000" />
                <Text style={styles.addToCartText}>Sepete Ekle</Text>
                <Animated.View style={{ position: 'absolute', right: 16, opacity: successOpacity }}>
                  <CheckCircle size={18} color="#000000" weight="fill" />
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* Varyant B: sepette var → Fiyat + Stepper + Sepete Git */}
          <Animated.View
            pointerEvents={inCart ? 'auto' : 'none'}
            style={[
              styles.bottomBarVariant,
              styles.bottomBarVariantInCart,
              { opacity: stepperOpacity, transform: [{ translateX: stepperTx }] },
            ]}
          >
            <AnimatedNumberText
              style={styles.priceCompact}
              value={toCurrency((cartEntry?.unitPrice ?? totalUnitPrice) * (cartEntry?.quantity ?? 1))}
            />

            <View style={styles.stepperCompact}>
              <TouchableOpacity
                onPress={() => {
                  if (!cartEntry) return;
                  haptic.light();
                  updateQuantity(cartEntry.lineKey, cartEntry.quantity - 1);
                }}
                style={styles.stepperBtn}
                activeOpacity={0.85}
              >
                <Minus size={14} color="#000000" />
              </TouchableOpacity>
              <AnimatedNumberText style={styles.stepperQty} value={cartEntry?.quantity ?? 0} />
              <TouchableOpacity
                onPress={() => {
                  if (!cartEntry) return;
                  haptic.light();
                  updateQuantity(cartEntry.lineKey, cartEntry.quantity + 1);
                }}
                style={styles.stepperBtn}
                activeOpacity={0.85}
              >
                <Plus size={14} color="#000000" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                haptic.light();
                navigation.navigate('Tabs', { screen: 'Cart' });
              }}
              style={styles.goToCartBtn}
              activeOpacity={0.9}
            >
              <ShoppingCart size={14} color="#0A1F0F" weight="bold" />
              <Text style={styles.goToCartText}>Sepete Git</Text>
              <ArrowRight size={12} color="#0A1F0F" weight="bold" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    textAlign: 'center',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    // Ürün görseli kaynak boyutu 1350x1080 (5:4). Container aspect'i
    // kaynakla eşleşince cover/contain fark etmez, üst/alt kırpma olmaz.
    aspectRatio: 1350 / 1080,
    padding: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    gap: 6,
  },
  imagePlaceholderEmoji: {
    fontSize: 40,
    opacity: 0.4,
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: '#b0b0b0',
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  infoCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    paddingTop: 20,
    marginBottom: 12,
  },
  productTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
    lineHeight: 26,
    marginBottom: 10,
  },
  macroContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    gap: 0,
    justifyContent: 'space-between',
  },
  macroBadge: {
    alignItems: 'center',
    gap: 8,
  },
  macroCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroValue: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    lineHeight: 17,
  },
  macroUnit: {
    fontSize: 9,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.tertiary,
    lineHeight: 10,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.tertiary,
  },
  descriptionSection: {
    marginBottom: 4,
  },
  descriptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
  optionsLoading: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionGroupCardError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  optionGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionGroupTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  requiredPill: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C6F04F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  requiredPillError: {
    borderColor: '#EF4444',
  },
  requiredPillText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  requiredPillTextError: {
    color: '#EF4444',
  },
  groupValidationError: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#EF4444',
    marginTop: 6,
  },
  optionGroupDesc: {
    marginTop: 3,
    color: '#666',
    fontSize: 13,
  },
  optionList: {
    marginTop: 8,
  },
  optionRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionRowDisabled: {
    opacity: 0.45,
  },
  optionRowPressed: {
    opacity: 0.7,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioSelected: {
    borderColor: '#C6F04F',
    backgroundColor: '#C6F04F',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000000',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    borderColor: '#C6F04F',
    backgroundColor: '#C6F04F',
  },
  optionLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  optionName: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  optionPriceInline: {
    color: '#878787',
    fontSize: 11,
    fontWeight: '400',
    fontFamily: 'PlusJakartaSans_400Regular',
    marginLeft: 6,
  },
  errorBox: {
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorBoxText: {
    color: '#B91C1C',
    fontSize: 13,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    paddingTop: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 8,
  },
  bottomBarContent: {
    position: 'relative',
    minHeight: 56,
    justifyContent: 'center',
  },
  bottomBarVariant: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomBarVariantNotInCart: {
    justifyContent: 'space-between',
  },
  bottomBarVariantInCart: {
    gap: 10,
  },
  priceCompact: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  stepperCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 22,
    paddingHorizontal: 4,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  goToCartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 999,
    backgroundColor: COLORS.brand.green,
    paddingHorizontal: 12,
  },
  goToCartText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0A1F0F',
  },
  priceSection: {
    gap: 2,
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  priceRowDiscount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceValueDiscounted: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#dc2626',
  },
  priceMetaCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  priceOriginalStrike: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  priceDiscountBadge: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#dc2626',
  },
  addToCartButton: {
    height: 52,
    borderRadius: 100,
    backgroundColor: COLORS.brand.green,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  addToCartButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  addToCartText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  errorTitle: {
    fontSize: 22,
    color: COLORS.text.primary,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: 14,
  },
  secondaryButton: {
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  secondaryButtonText: {
    color: COLORS.text.primary,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
  },
  primaryTabSection: {
    marginTop: 12,
    marginBottom: 20,
  },
  primaryTabLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0f172a',
    marginBottom: 10,
  },
  primaryTabRequiredStar: {
    color: '#dc2626',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  gramajRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#ffffff',
  },
  tabPillSelected: {
    borderColor: '#C6F04F',
    backgroundColor: '#C6F04F',
  },
  tabPillText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  tabPillTextSelected: {
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
