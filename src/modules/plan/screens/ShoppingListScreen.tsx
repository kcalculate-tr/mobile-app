// G33-S1 md.8 — Alışveriş listesi (02-alisveris-listesi): plandaki tarif malzemeleri kategoriye göre
// birleşik (aynı malzeme toplanır) · işaretle → Alındı · Temizle · Düzenle (sil) · Elle ekle · Paylaş ·
// Plan yok hâli · "Bu hafta N öğün eatkcal'dan" kartı → eatkcal sepeti → sepete ekle → "Sepete git".
// Fresh ve üstü (Ücretsiz → paywall). `ogun_plani` bayrağı arkasında.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { AppText, PLAN_MOTION, REDUCED, SHEET, Sheet, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { ArrowLeft, CaretRight, Check, Export, MapPin, MinusCircle, Plus, ShoppingCart } from '../../../components/icons';
import { formatPrice } from '../../../lib/money';
import { useTier } from '../../../lib/subscription/purchases';
import { dayKey } from '../../gun/track/dayClock';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { CountPill } from '../../../core/design/components/CountPill';
import type { PlanItem, ShopCategory } from '../types';
import { usePlanStore } from '../store';
import { buildShoppingList, eatkcalMeals, groupShopping, recipeCountOf, type ShopLine } from '../shopping';
import { dayName, weekRange, weekStartOf } from '../week';
import { planAccess } from '../access';
import { addPlanMealsToCart, type BasketChoice } from '../actions';
import { localId } from '../generate';
import { GLASS, PlanToast, Thumb, usePlanTones } from '../ui/parts';

type Nav = { goBack: () => void; navigate: (n: string, p?: object) => void; canGoBack: () => boolean };
export type ShoppingListParams = { weekStart?: string } | undefined;

export default function ShoppingListScreen() {
  const nav = useNavigation() as unknown as Nav;
  const params = (useRoute().params ?? {}) as NonNullable<ShoppingListParams>;
  const c = usePlanTones();
  const { t: tr, lang: rawLang } = useT();
  const lang: 'tr' | 'en' = rawLang === 'en' ? 'en' : 'tr';
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { user } = useAuth();
  const { tier } = useTier();
  const allowed = planAccess(tier).shopping;
  const ws = params.weekStart ?? weekStartOf(dayKey());

  const setUser = usePlanStore((s) => s.setUser);
  const loadWeek = usePlanStore((s) => s.loadWeek);
  const loadCatalog = usePlanStore((s) => s.loadCatalog);
  const entry = usePlanStore((s) => s.weeks[ws]);
  const catalog = usePlanStore((s) => s.catalog);
  const setShopState = usePlanStore((s) => s.setShopState);
  const addManual = usePlanStore((s) => s.addManual);
  const patchManual = usePlanStore((s) => s.patchManual);
  useEffect(() => {
    setUser(user?.id ?? null);
    if (user?.id) void loadWeek(ws);
    void loadCatalog();
  }, [user?.id, ws, setUser, loadWeek, loadCatalog]);

  useEffect(() => {
    if (!allowed) nav.navigate('SubPaywall', { from: 'shopping_list', plan: 'fresh' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const items = useMemo(() => entry?.items ?? [], [entry?.items]);
  const lines = useMemo(
    () => (catalog ? buildShoppingList(items, catalog.recipeMap, catalog.ingredients, entry?.shopState ?? [], entry?.manual ?? []) : []),
    [catalog, items, entry?.shopState, entry?.manual],
  );
  const { groups, done, remaining } = groupShopping(lines);
  const eatMeals = eatkcalMeals(items);
  const nRecipes = recipeCountOf(items);
  const hasPlan = items.length > 0;

  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [basket, setBasket] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [toast, setToast] = useState<{ msg: string; action?: 'cart' | 'next' } | null>(null);
  // G36 md.5: seçim (gramaj / zorunlu seçenek) isteyen öğünler atlanmaz — sırayla ürün sayfası açılır.
  const pendingChoice = useRef<BasketChoice[]>([]);
  const openProduct = useCallback(
    (p: BasketChoice, delay = 0) => {
      const go = () => nav.navigate('ProductDetail', { productId: p.id });
      if (delay > 0) setTimeout(go, delay);
      else go();
    },
    [nav],
  );
  const openNextChoice = useCallback(() => {
    const next = pendingChoice.current.shift();
    setToast(null);
    if (next) openProduct(next);
  }, [openProduct]);
  // Ürün sayfasından dönünce sıradaki seçim bekleyen öğün hatırlatılır.
  useFocusEffect(
    useCallback(() => {
      const next = pendingChoice.current[0];
      if (next) setToast({ msg: tr('plan.basket_next_msg', { name: next.name }), action: 'next' });
    }, [tr]),
  );

  const name = (l: ShopLine) => (lang === 'en' ? l.nameEn : l.nameTr);
  const qty = (l: ShopLine) => `${l.quantity} ${tr(`plan.unit.${l.unit}`)}`;

  const toggle = (l: ShopLine) => {
    haptic('selection');
    if (l.source === 'manual') void patchManual(ws, l.id.replace(/^manual:/, ''), { checked: !l.checked });
    else void setShopState(ws, { ingredientKey: l.ingredientKey as string, checked: !l.checked, removed: false, name: l.nameTr, category: l.category });
  };
  const remove = (l: ShopLine) => {
    haptic('light');
    if (l.source === 'manual') void patchManual(ws, l.id.replace(/^manual:/, ''), { removed: true });
    else void setShopState(ws, { ingredientKey: l.ingredientKey as string, checked: l.checked, removed: true, name: l.nameTr, category: l.category });
  };
  const clearDone = () => {
    haptic('light');
    for (const l of done) remove(l);
  };
  const submitManual = () => {
    const n = draft.trim();
    if (!n) {
      setAdding(false);
      return;
    }
    haptic('light');
    void addManual(ws, { id: newUuid(), name: n, quantity: 1, unit: 'paket', category: 'other', checked: false });
    setDraft('');
    setAdding(false);
  };
  const share = () => {
    const body = groups
      .map((g) => `${tr(`plan.shop_cat.${g.category}`)}\n${g.lines.map((l) => `• ${name(l)} — ${qty(l)}`).join('\n')}`)
      .join('\n\n');
    void Share.share({ message: `${tr('plan.share_text')} (${weekRange(ws, lang)})\n\n${body}` }).catch(() => {});
  };

  const enter = reduced ? FadeIn.duration(REDUCED.duration) : FadeIn.duration(PLAN_MOTION.dayCrossfade);
  const layout = reduced ? undefined : LinearTransition.duration(PLAN_MOTION.segment);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]} testID="shopping-list">
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs'))} accessibilityRole="button" accessibilityLabel={tr('common.back')} style={styles.iconBtn}>
          <ArrowLeft size={24} color={c.ink} />
        </Pressable>
        <View style={styles.flex1} />
        {hasPlan ? (
          <>
            <Pressable onPress={() => setEdit((v) => !v)} accessibilityRole="button" style={styles.textBtn} testID="shop-edit">
              <AppText style={[styles.textBtnText, { color: c.ink }]}>{edit ? tr('plan.shop_done') : tr('plan.shop_edit')}</AppText>
            </Pressable>
            <Pressable onPress={share} accessibilityRole="button" accessibilityLabel={tr('plan.shop_share')} style={styles.iconBtn} testID="shop-share">
              <Export size={22} color={c.ink} />
            </Pressable>
          </>
        ) : null}
      </View>
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90, gap: 12 }} showsVerticalScrollIndicator={false}>
        <AppText style={[styles.title, { color: c.ink }]} accessibilityRole="header">
          {tr('plan.shop_title')}
        </AppText>
        <View style={styles.metaRow}>
          <AppText style={[styles.small, { color: c.sec }]}>{weekRange(ws, lang)}</AppText>
          {hasPlan ? <AppText style={[styles.smallBold, { color: c.ink }]}>{tr('plan.shop_left', { n: remaining })}</AppText> : null}
        </View>
        {hasPlan ? (
          <Pressable onPress={() => nav.navigate('MealPlan', { weekStart: ws })} accessibilityRole="link" style={styles.fromRow} testID="shop-from">
            <AppText style={[styles.fromText, { color: c.ink }]}>{tr('plan.shop_from', { n: nRecipes })}</AppText>
            <CaretRight size={14} color={c.ink} />
          </Pressable>
        ) : null}

        {!hasPlan ? (
          <>
            <AddRow adding={adding} draft={draft} setDraft={setDraft} onOpen={() => setAdding(true)} onSubmit={submitManual} />
            <Animated.View entering={enter} style={styles.empty} testID="shop-empty">
              <View style={[styles.emptyGlass, { backgroundColor: c.card }]}>
                <Image source={GLASS.bowl} style={styles.emptyImg} resizeMode="contain" />
              </View>
              <AppText style={[styles.emptyTitle, { color: c.ink }]}>{tr('plan.shop_empty_title')}</AppText>
              <AppText style={[styles.emptyBody, { color: c.sec }]}>{tr('plan.shop_empty_body')}</AppText>
              <Pressable onPress={() => nav.navigate('MealPlanGenerate', { weekStart: ws })} accessibilityRole="button" style={[styles.blackBtn, { backgroundColor: c.chipSel }]} testID="shop-empty-cta">
                <AppText style={[styles.blackBtnText, { color: c.chipSelInk }]}>{tr('plan.shop_empty_cta')}</AppText>
              </Pressable>
            </Animated.View>
          </>
        ) : (
          <>
            {eatMeals.length ? (
              <View style={[styles.eatCard, { backgroundColor: c.card }]} testID="shop-eatkcal-card">
                <View style={styles.eatHead}>
                  <View style={styles.thumbs}>
                    {eatMeals.slice(0, 5).map((m) => (
                      <View key={m.id} style={styles.thumbOverlap}>
                        <Thumb size={34} />
                      </View>
                    ))}
                  </View>
                  <View style={styles.flex1}>
                    <AppText style={[styles.eatTitle, { color: c.ink }]}>{tr('plan.shop_eatkcal_h', { n: eatMeals.length })}</AppText>
                    <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.shop_eatkcal_sub')}</AppText>
                  </View>
                </View>
                <View style={styles.eatFoot}>
                  <MapPin size={14} color={c.sec} />
                  <AppText style={[styles.small, { color: c.sec, flex: 1 }]}>{tr('plan.shop_izmir')}</AppText>
                  {inCart ? (
                    <View style={[styles.cartPill, { borderColor: c.line2 }]} testID="shop-in-cart">
                      <Check size={14} color={c.ink} weight="bold" />
                      <AppText style={[styles.cartPillText, { color: c.ink }]}>{tr('plan.shop_in_cart')}</AppText>
                    </View>
                  ) : (
                    <Pressable onPress={() => setBasket(true)} accessibilityRole="button" style={[styles.cartBtn, { backgroundColor: c.lime }]} testID="shop-add-cart">
                      <ShoppingCart size={16} color={c.onLime} />
                      <AppText style={[styles.cartPillText, { color: c.onLime }]}>{tr('plan.shop_add_cart')}</AppText>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : null}

            <AddRow adding={adding} draft={draft} setDraft={setDraft} onOpen={() => setAdding(true)} onSubmit={submitManual} />

            {groups.map((g) => (
              <Animated.View key={g.category} layout={layout} style={styles.groupWrap}>
                {/* G38 md.4: "Sebze (3)" yerine başlık + sayı hapı. */}
                <View
                  style={styles.doneTitle}
                  accessible
                  accessibilityRole="header"
                  accessibilityLabel={`${tr(`plan.shop_cat.${g.category}`)}, ${g.lines.length}`}
                >
                  <AppText style={[styles.groupH, { color: c.ink }]}>{tr(`plan.shop_cat.${g.category}`)}</AppText>
                  <CountPill count={g.lines.length} bg={c.line} fg={c.ink} testID={`shop-cat-count-${g.category}`} />
                </View>
                <View style={[styles.group, { backgroundColor: c.card }]}>
                  {g.lines.map((l, i) => (
                    <Line key={l.id} l={l} first={i === 0} edit={edit} name={name(l)} qty={qty(l)} onToggle={() => toggle(l)} onRemove={() => remove(l)} />
                  ))}
                </View>
              </Animated.View>
            ))}

            {done.length ? (
              <Animated.View layout={layout} style={styles.groupWrap}>
                <View style={styles.doneHead}>
                  {/* G38 md.4: "Alındı (3)" yerine başlık + sayı hapı. */}
                  <View
                    style={styles.doneTitle}
                    accessible
                    accessibilityRole="header"
                    accessibilityLabel={tr('plan.shop_bought_a11y', { n: done.length })}
                  >
                    <AppText style={[styles.groupH, { color: c.ink }]}>{tr('plan.shop_bought')}</AppText>
                    <CountPill count={done.length} bg={c.ink} fg={c.card} testID="shop-bought-count" />
                  </View>
                  <Pressable onPress={clearDone} accessibilityRole="button" style={styles.textBtn} testID="shop-clear">
                    <AppText style={[styles.clearText, { color: c.ink }]}>{tr('plan.shop_clear')}</AppText>
                  </Pressable>
                </View>
                <View style={[styles.group, { backgroundColor: c.card }]}>
                  {done.map((l, i) => (
                    <Line key={l.id} l={l} first={i === 0} edit={false} name={name(l)} qty={qty(l)} onToggle={() => toggle(l)} onRemove={() => remove(l)} sub={tr(`plan.shop_cat.${l.category as ShopCategory}`)} />
                  ))}
                </View>
              </Animated.View>
            ) : null}
          </>
        )}
      </ScrollView>

      <BasketSheet
        visible={basket}
        meals={eatMeals}
        lang={lang}
        onClose={() => setBasket(false)}
        onAdd={async () => {
          const r = await addPlanMealsToCart(eatMeals);
          setBasket(false);
          haptic('success');
          if (r.added > 0) setInCart(true);
          const parts = [
            r.added > 0 ? tr('plan.basket_added', { n: r.added }) : null,
            r.choice.length > 0 ? tr('plan.basket_choice', { n: r.choice.length }) : null,
            r.missing > 0 ? tr('plan.basket_missing', { n: r.missing }) : null,
          ].filter(Boolean);
          const msg = parts.length ? parts.join(', ') : tr('plan.basket_failed');
          const [first, ...rest] = r.choice;
          pendingChoice.current = rest;
          // Sayfa kapanma hareketi bitince ürün sayfası (seçim sonrası sepete orada eklenir).
          if (first) openProduct(first, SHEET.eat.closeDuration + 50);
          setToast({ msg, action: rest.length ? 'next' : r.added > 0 || first ? 'cart' : undefined });
        }}
      />
      <PlanToast
        visible={!!toast}
        message={toast?.msg ?? ''}
        actionLabel={toast?.action === 'next' ? tr('plan.basket_next') : tr('plan.basket_go')}
        onAction={toast?.action === 'next' ? openNextChoice : toast?.action === 'cart' ? () => nav.navigate('EkCart') : undefined}
        onHide={() => setToast(null)}
        bottom={insets.bottom + 16}
      />
    </View>
  );
}

function newUuid(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newRowId } = require('../../gun/track/logQueueNative') as typeof import('../../gun/track/logQueueNative');
  try {
    return newRowId();
  } catch {
    return localId('manual');
  }
}

function AddRow({ adding, draft, setDraft, onOpen, onSubmit }: { adding: boolean; draft: string; setDraft: (s: string) => void; onOpen: () => void; onSubmit: () => void }) {
  const c = usePlanTones();
  const { t: tr } = useT();
  return adding ? (
    <View style={[styles.addRow, { backgroundColor: c.card }]}>
      <Plus size={16} color={c.sec} />
      <TextInput
        autoFocus
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={onSubmit}
        onBlur={onSubmit}
        placeholder={tr('plan.shop_add_ph')}
        placeholderTextColor={c.sec}
        returnKeyType="done"
        maxLength={80}
        style={[styles.addInput, { color: c.ink }]}
        accessibilityLabel={tr('plan.shop_add')}
        testID="shop-add-input"
      />
    </View>
  ) : (
    <Pressable onPress={onOpen} accessibilityRole="button" style={[styles.addRow, { backgroundColor: c.card }]} testID="shop-add">
      <Plus size={16} color={c.sec} />
      <AppText style={[styles.addText, { color: c.sec }]}>{tr('plan.shop_add')}</AppText>
    </Pressable>
  );
}

function Line({ l, first, edit, name, qty, onToggle, onRemove, sub }: { l: ShopLine; first: boolean; edit: boolean; name: string; qty: string; onToggle: () => void; onRemove: () => void; sub?: string }) {
  const c = usePlanTones();
  const { t: tr } = useT();
  const subText = sub ?? (l.source === 'manual' ? tr('plan.shop_manual') : l.recipeCount > 1 ? tr('plan.shop_recipes', { n: l.recipeCount }) : '');
  return (
    <View style={[styles.line, first ? null : { borderTopWidth: 1, borderTopColor: c.line }]} testID={`shop-line-${l.id}`}>
      {edit ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`${tr('plan.shop_delete')}: ${name}`} style={styles.box} testID={`shop-del-${l.id}`}>
          <MinusCircle size={24} color={c.t.color.danger} weight="fill" />
        </Pressable>
      ) : (
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: l.checked }}
          accessibilityLabel={tr('plan.shop_check_a11y', { name, qty })}
          style={styles.box}
          testID={`shop-check-${l.id}`}
        >
          <View style={[styles.check, l.checked ? { backgroundColor: c.lime, borderColor: c.lime } : { borderColor: c.line2 }]}>
            {l.checked ? <Check size={14} color={c.onLime} weight="bold" /> : null}
          </View>
        </Pressable>
      )}
      <View style={styles.flex1}>
        <AppText style={[styles.lineName, { color: l.checked ? c.sec : c.ink }, l.checked ? styles.strike : null]}>{name}</AppText>
        {subText ? <AppText style={[styles.lineSub, { color: c.sec }]}>{subText}</AppText> : null}
      </View>
      <AppText style={[styles.lineQty, { color: l.checked ? c.sec : c.ink }, l.checked ? styles.strike : null]}>{qty}</AppText>
    </View>
  );
}

function BasketSheet({ visible, meals, lang, onClose, onAdd }: { visible: boolean; meals: PlanItem[]; lang: 'tr' | 'en'; onClose: () => void; onAdd: () => void }) {
  const c = usePlanTones();
  const { t: tr } = useT();
  const total = meals.reduce((s, m) => s + (m.price ?? 0), 0);
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('plan.basket_title')} product="eat" testID="shop-basket" scroll>
      <AppText style={[styles.small, { color: c.sec, marginTop: -6, marginBottom: 10 }]}>{tr('plan.basket_sub')}</AppText>
      <View style={[styles.group, { backgroundColor: c.card }]}>
        {meals.map((m, i) => (
          <View key={m.id} style={[styles.line, i ? { borderTopWidth: 1, borderTopColor: c.line } : null]}>
            <View style={[styles.check, { backgroundColor: c.lime, borderColor: c.lime }]}>
              <Check size={14} color={c.onLime} weight="bold" />
            </View>
            <Thumb size={36} />
            <View style={styles.flex1}>
              <AppText style={[styles.lineName, { color: c.ink }]} numberOfLines={1}>
                {m.name}
              </AppText>
              <AppText style={[styles.lineSub, { color: c.sec }]}>
                {dayName(m.date, lang)}, {tr(`plan.slot.${m.slot}`).toLocaleLowerCase(lang === 'en' ? 'en' : 'tr')}
              </AppText>
            </View>
            <AppText style={[styles.lineQty, { color: c.ink }]}>{m.price != null ? formatPrice(m.price) : '—'}</AppText>
          </View>
        ))}
      </View>
      <View style={styles.totalRow}>
        <View>
          <AppText style={[styles.groupH, { color: c.ink }]}>{tr('plan.basket_total')}</AppText>
          <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.basket_meals', { n: meals.length })}</AppText>
        </View>
        <AppText style={[styles.groupH, { color: c.ink }]}>{formatPrice(total)}</AppText>
      </View>
      <AppText style={[styles.small, { color: c.sec }]}>{tr('plan.basket_note')}</AppText>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={tr('plan.basket_cta_a11y', { price: formatPrice(total) })}
        style={[styles.basketCta, { backgroundColor: c.lime }]}
        testID="shop-basket-add"
      >
        {/* G38 md.4: "Sepete ekle (285 TL)" yerine etiket + ayrı kalın fiyat. */}
        <AppText style={[styles.basketCtaText, { color: c.onLime }]}>{tr('plan.basket_cta')}</AppText>
        <AppText style={[styles.basketCtaPrice, { color: c.onLime }]} testID="shop-basket-price">{formatPrice(total)}</AppText>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  textBtn: { minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  textBtnText: { fontSize: 15, fontWeight: '600' },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 26, lineHeight: 32 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -6 },
  small: { fontSize: 13 },
  smallBold: { fontSize: 13, fontWeight: '700' },
  fromRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  fromText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  eatCard: { borderRadius: 20, padding: 14, gap: 12 },
  eatHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumbs: { flexDirection: 'row', marginRight: 6 },
  thumbOverlap: { marginRight: -10 },
  eatTitle: { fontSize: 15, fontWeight: '700' },
  eatFoot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartBtn: { minHeight: 44, borderRadius: 22, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartPill: { minHeight: 44, borderRadius: 22, paddingHorizontal: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartPillText: { fontSize: 14, fontWeight: '700' },
  addRow: { minHeight: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  addText: { fontSize: 15 },
  addInput: { flex: 1, fontSize: 15, minHeight: 44 },
  groupWrap: { gap: 6 },
  groupH: { fontSize: 15, fontWeight: '700' },
  doneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  group: { borderRadius: 18, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 14, paddingLeft: 4, minHeight: 56 },
  box: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  lineName: { fontSize: 15, fontWeight: '500' },
  lineSub: { fontSize: 12 },
  lineQty: { fontSize: 14, fontWeight: '600' },
  strike: { textDecorationLine: 'line-through' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 30, paddingHorizontal: 12 },
  emptyGlass: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  emptyImg: { width: 54, height: 38 },
  emptyTitle: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  blackBtn: { minHeight: 48, borderRadius: 24, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  blackBtnText: { fontSize: 15, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  basketCta: { marginTop: 12, minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  basketCtaText: { fontSize: 16, fontWeight: '700' },
  basketCtaPrice: { fontSize: 17, fontWeight: '800' },
  doneTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
