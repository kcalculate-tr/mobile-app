// G56-S1 — eatkcal ana sayfa sipariş artırma bölümleri (EkSec: banners · chips · reorder · kcal · plan ·
// top · invite + toast / skel). Ölçü, renk ve metinler docs/g56/design/EkSec.dc.html'den; ürün kartı,
// kampanya kartı, yatay satır mevcut bileşenlerden (cards.tsx). Kalan kalori bölümü dışında akış içi
// kartlar opak; cam yalnız kalan kalori bölümünde ve yüzen bildirimde (tasarım kuralı).
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { CachedImage } from '../../../../../components/CachedImage';
import { Plus, Info, Check, Repeat } from '../../../../../components/icons';
import { transformImageUrl, ImagePreset } from '../../../../../lib/imageUrl';
import { fontFamily, haptic } from '../../../../../core/design';
import { track } from '../../../../../lib/analytics';
import { SCROLL_KEYBOARD } from '../../../../../core/design/keyboard';
import { useReduceTransparency } from '../../../../personalPlan/bridge';
import { EkSkeleton, ekType, money, useEk } from '../kit';
import { CampaignCard } from '../home/cards';
import { cardPrice } from '../../model/homeData';
import { filterChips, productKcal, type GrowthProduct, type KcalState, type PlanRow, type TopRow } from '../../growth/rules';
import type { FilterKey } from '../../growth/config';
import type { PastOrder } from '../../../../../lib/reorder';
import { SEC, useGrowthTokens, type GrowthTokens } from './tokens';

const FLAME = require('../../../../../../assets/glass/flame.png');
const BOWL = require('../../../../../../assets/glass/bowl.png');

export type EkSecKey = 'banners' | 'chips' | 'reorder' | 'kcal' | 'plan' | 'top' | 'invite';

/** Bölüm bir kez görününce `eatkcal_sec_view` (sec + hâl). */
export function useSecView(sec: EkSecKey, st: string, visible: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!visible || done.current) return;
    done.current = true;
    track('eatkcal_sec_view', { sec, st });
  }, [visible, sec, st]);
}

export function secTap(sec: EkSecKey, action: string) {
  track('eatkcal_sec_tap', { sec, action });
}

// ── Ortak parçalar ──────────────────────────────────────────────────────────
const SCALE = 1.3;

function SecHead({ title, sub, flame, allLabel, onAll, testID }: { title: string; sub?: string; flame?: boolean; allLabel?: string; onAll?: () => void; testID?: string }) {
  const k = useGrowthTokens();
  return (
    <View style={styles.head} testID={testID}>
      <View style={styles.headLeft}>
        {flame ? <Image source={FLAME} style={styles.flame30} accessibilityIgnoresInvertColors accessible={false} /> : null}
        <View style={{ flexShrink: 1 }}>
          <Text style={[styles.h2, { color: k.ink }]} accessibilityRole="header" maxFontSizeMultiplier={SCALE}>
            {title}
          </Text>
          {sub ? (
            <Text style={[ekType.c13, { color: k.sec }]} maxFontSizeMultiplier={SCALE}>
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
      {allLabel && onAll ? (
        <Pressable onPress={onAll} accessibilityRole="button" hitSlop={4} style={styles.allBtn}>
          <Text style={[styles.all, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
            {allLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Yatay satır (.ek-hs): 16 kenar, 10 aralık. `inset` → kalan kalori zemininde 8 (tasarım hsM/hsP). */
function HScroll({ children, label, inset = 16, onScroll }: { children: React.ReactNode; label?: string; inset?: number; onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void }) {
  return (
    <ScrollView
      {...SCROLL_KEYBOARD}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: inset, gap: SEC.gap }}
      accessibilityLabel={label}
      onScroll={onScroll}
      scrollEventThrottle={32}
    >
      {children}
    </ScrollView>
  );
}

function LimeButton({ label, onPress, busy, height = 44, full, testID, a11y }: { label: string; onPress: () => void; busy?: boolean; height?: number; full?: boolean; testID?: string; a11y?: string }) {
  const k = useGrowthTokens();
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ busy: !!busy }}
      style={({ pressed }) => [
        { minHeight: height, borderRadius: height / 2, paddingHorizontal: 16, backgroundColor: k.lime, alignItems: 'center', justifyContent: 'center' },
        full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' },
        pressed && { opacity: 0.85 },
      ]}
      testID={testID}
    >
      {busy ? (
        <ActivityIndicator size="small" color={k.limeInk} />
      ) : (
        <Text style={[{ fontFamily: fontFamily.bodyBold, fontSize: height >= 48 ? 15 : 14, color: k.limeInk }]} maxFontSizeMultiplier={SCALE}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Cam yüzey: yarı saydam dolgu + bulanıklık. "Saydamlığı azalt" açıkken opak kart. */
function Glass({ children, style, radius, fill, edge, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; radius: number; fill: string; edge: string; testID?: string }) {
  const k = useGrowthTokens();
  const reduce = useReduceTransparency();
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]} testID={testID}>
      {reduce ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: k.card }]} />
      ) : (
        <>
          <BlurView intensity={24} tint={k.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
        </>
      )}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1, borderColor: reduce ? k.line : edge }]} />
      {children}
    </View>
  );
}

/** rgba(...)/#hex → aynı renk, alfa 0 (gradyan saydama giderken siyaha kaymasın). */
function clearOf(color: string): string {
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (m) {
    const [r, g, b] = m[1].split(',').map((x) => x.trim());
    return `rgba(${r}, ${g}, ${b}, 0)`;
  }
  return 'rgba(255, 255, 255, 0)';
}

/**
 * Yumuşak renk lekesi (tasarımdaki `filter: blur(48–56px)` daireler): radyal gradyan, iki platformda aynı.
 * `size` = bulanık dairenin kapladığı alan (daire çapı + 2 × bulanıklık).
 */
function SoftBlob({ size, color, style }: { size: number; color: string; style: StyleProp<ViewStyle> }) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          experimental_backgroundImage: `radial-gradient(circle closest-side, ${color} 0%, ${color} 38%, ${clearOf(color)} 100%)`,
        } as ViewStyle,
        style,
      ]}
    />
  );
}

// ── Ürün kartı (EkSec `pcs`) ─────────────────────────────────────────────────
export function GrowthProductCard({
  product,
  width,
  tag,
  mac,
  rank,
  count,
  glass,
  onPress,
  onAdd,
  adding,
}: {
  product: GrowthProduct;
  width: number;
  tag?: string;
  mac?: string;
  rank?: number;
  count?: string;
  glass?: boolean;
  onPress: () => void;
  onAdd: () => void;
  adding?: boolean;
}) {
  const k = useGrowthTokens();
  const { t } = useEk();
  // Büyük yazıda (Dynamic Type) kart yazıyla büyür, ad kırpılmaz (G50 kuralı: en çok 1,3×).
  const { fontScale } = useWindowDimensions();
  const scale = Math.min(Math.max(fontScale || 1, 1), SCALE);
  width = Math.round(width * scale);
  const kcal = productKcal(product);
  const price = cardPrice(product);
  const src = product.img ? transformImageUrl(product.img, ImagePreset.productCard) : '';
  const a11y = [product.name, kcal ? t('ek56.card.kcal', { n: kcal }) : null, rank ? t('ek56.top.rank_a11y', { n: rank }) : null, count, money(price.now)]
    .filter(Boolean)
    .join(', ');
  return (
    <View style={{ width, gap: 6 }}>
      <Pressable
        onPress={() => {
          haptic('selection');
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => [{ gap: 6 }, pressed && { opacity: 0.85 }]}
      >
        <View>
          {src ? (
            <CachedImage uri={src} style={{ width, height: width, borderRadius: 16 }} />
          ) : (
            <View style={{ width, height: width, borderRadius: 16, backgroundColor: k.nest }} />
          )}
          {kcal ? (
            <View style={[styles.kcalBadge]}>
              <Text style={styles.kcalText} maxFontSizeMultiplier={SCALE}>
                {t('ek56.card.kcal', { n: kcal })}
              </Text>
            </View>
          ) : null}
          {tag ? (
            <View style={[styles.tag, { backgroundColor: k.lime }]}>
              <Text style={[styles.tagText, { color: k.limeInk }]} maxFontSizeMultiplier={SCALE}>
                {tag}
              </Text>
            </View>
          ) : null}
          {rank ? (
            <View style={styles.rank} accessible={false}>
              <Text style={styles.rankText} maxFontSizeMultiplier={1.15}>
                {rank}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.pname, { color: k.ink }]} numberOfLines={scale > 1 ? 3 : 2} maxFontSizeMultiplier={SCALE}>
          {product.name}
        </Text>
        {mac ? (
          <View style={[styles.mac, { backgroundColor: glass ? k.glow.nest : k.nest }]}>
            <Text style={[styles.macText, ekType.num, { color: k.ink }]} numberOfLines={1} maxFontSizeMultiplier={SCALE}>
              {mac}
            </Text>
          </View>
        ) : null}
        {count ? (
          <Text style={[styles.cnt, { color: k.sec }]} maxFontSizeMultiplier={SCALE}>
            {count}
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.priceRow}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6, flex: 1, minWidth: 0 }}>
          {price.before != null ? (
            <Text style={[ekType.c13, ekType.num, { color: k.sec, textDecorationLine: 'line-through' }]} maxFontSizeMultiplier={SCALE}>
              {money(price.before)}
            </Text>
          ) : null}
          <Text style={[styles.price, ekType.num, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
            {money(price.now)}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            haptic('light');
            onAdd();
          }}
          disabled={adding}
          accessibilityRole="button"
          accessibilityLabel={`${t('ek56.card.add')}: ${product.name}`}
          style={styles.addHit}
        >
          <View style={[styles.add, { backgroundColor: k.lime }]}>
            {adding ? <ActivityIndicator size="small" color={k.limeInk} /> : <Plus size={16} color={k.limeInk} weight="bold" />}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

// ── 0) Kampanya şeridi ───────────────────────────────────────────────────────
export interface StripCell {
  id: string;
  image: string;
  title: string | null;
}

export function BannerStrip({ cells, onPress }: { cells: StripCell[]; onPress: (id: string) => void }) {
  const k = useGrowthTokens();
  const { t } = useEk();
  const [page, setPage] = useState(0);
  useSecView('banners', 'full', cells.length > 0);
  if (cells.length === 0) return null;
  const step = SEC.bannerW + SEC.gap;
  return (
    <View style={{ gap: 10 }} testID="ek56-banners">
      <HScroll label={t('ek56.banners.a11y')} onScroll={(e) => setPage(Math.max(0, Math.min(cells.length - 1, Math.round(e.nativeEvent.contentOffset.x / step))))}>
        {cells.map((cell) => (
          <CampaignCard
            key={cell.id}
            imageUri={cell.image}
            title={cell.title}
            onPress={() => {
              secTap('banners', 'open');
              onPress(cell.id);
            }}
          />
        ))}
      </HScroll>
      {cells.length > 1 ? (
        <View style={styles.dots} accessible accessibilityRole="image" accessibilityLabel={t('ek56.banners.dots', { n: page + 1, total: cells.length })}>
          {cells.map((c, i) => (
            <View key={c.id} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? k.limeLine : k.line2 }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── 1) Kategori çipleri ─────────────────────────────────────────────────────
export function ChipsRow({ active, onPick, testID = 'ek56-chips', inset = 16 }: { active?: FilterKey | null; onPick: (key: FilterKey) => void; testID?: string; inset?: number }) {
  const k = useGrowthTokens();
  const { t } = useEk();
  useSecView('chips', active ? 'sel' : 'full', true);
  return (
    <View testID={testID}>
      <HScroll label={t('ek56.cats')} inset={inset}>
        {filterChips().map((f) => {
          const on = active === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                haptic('selection');
                secTap('chips', f.key);
                onPick(f.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on ? { backgroundColor: k.lime, borderColor: k.lime } : { backgroundColor: k.card, borderColor: k.line }]}
              testID={`ek56-chip-${f.key}`}
            >
              <Text style={[ekType.b15s, { color: on ? k.limeInk : k.ink }]} numberOfLines={1} maxFontSizeMultiplier={SCALE}>
                {t(f.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </HScroll>
    </View>
  );
}

// ── 2) Tekrar sipariş ver ───────────────────────────────────────────────────
export interface ReorderCardModel {
  order: PastOrder;
  date: string;
  names: string;
  total: string;
  /** Satışta olmayan kalem sayısı / kalan kalem sayısı (st="oos"). */
  oos: { n: number; m: number } | null;
}

export function ReorderSection({ cards, busyId, onReorder }: { cards: ReorderCardModel[]; busyId: number | null; onReorder: (order: PastOrder) => void }) {
  const k = useGrowthTokens();
  const { t } = useEk();
  const hasOos = cards.some((c) => !!c.oos);
  useSecView('reorder', hasOos ? 'oos' : 'full', cards.length > 0);
  if (cards.length === 0) return null;
  return (
    <View style={{ gap: 10 }} testID="ek56-reorder">
      <View style={styles.gutter}>
        <SecHead title={t('ek56.reorder.title')} />
      </View>
      <HScroll label={t('ek56.reorder.title')}>
        {cards.map((c) => {
          // 16 Kas: dar kart — en çok 3 yuvarlak (fazlası "+N").
          const many = c.order.items.length > 3;
          const imgs = c.order.items.slice(0, many ? 2 : 3);
          const extra = c.order.items.length - imgs.length;
          const allOos = !!c.oos && c.oos.m === 0;
          return (
            <View key={c.order.id} style={[styles.reCard, { backgroundColor: k.card, borderColor: k.line }]} testID="ek56-reorder-card">
              <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {imgs.map((it, j) => (
                  <View key={`${it.id}-${j}`} style={[styles.reImgWrap, { marginLeft: j ? -20 : 0, zIndex: 10 - j, borderColor: k.card, backgroundColor: k.nest }]}>
                    {it.imageUrl ? <CachedImage uri={transformImageUrl(it.imageUrl, ImagePreset.productCard) || it.imageUrl} style={styles.reImg} /> : null}
                  </View>
                ))}
                {extra > 0 ? (
                  <View style={[styles.reImgWrap, styles.reMore, { marginLeft: -20, borderColor: k.card }]}>
                    <Text style={styles.reMoreText} maxFontSizeMultiplier={SCALE}>{`+${extra}`}</Text>
                  </View>
                ) : null}
              </View>
              <View accessible accessibilityLabel={t('ek56.reorder.card_a11y', { date: c.date, names: c.names, total: c.total })}>
                <Text style={[styles.reName, { color: k.sec }]} numberOfLines={1} maxFontSizeMultiplier={SCALE}>
                  {c.names}
                </Text>
              </View>
              {c.oos ? (
                <View style={[styles.oos, { backgroundColor: k.nest }]} accessibilityRole="alert" testID="ek56-reorder-oos">
                  <Info size={16} color={k.ink} />
                  <Text style={[ekType.c13, { color: k.ink, flex: 1 }]} maxFontSizeMultiplier={SCALE}>
                    {allOos ? t('ek56.reorder.oos_all') : t(c.oos.n === 1 ? 'ek56.reorder.oos_one' : 'ek56.reorder.oos_other', { n: c.oos.n, m: c.oos.m })}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.between, { gap: 10 }]}>
                <View style={{ flexShrink: 1 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <Text style={[styles.c12, { color: k.sec }]} numberOfLines={1} maxFontSizeMultiplier={SCALE}>
                    {c.date}
                  </Text>
                  <Text style={[styles.total, ekType.num, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
                    {c.total}
                  </Text>
                </View>
                {allOos ? null : (
                  <Pressable
                    onPress={() => {
                      haptic('light');
                      onReorder(c.order);
                    }}
                    disabled={busyId === c.order.id}
                    accessibilityRole="button"
                    accessibilityLabel={t('ek56.reorder.btn')}
                    accessibilityState={{ busy: busyId === c.order.id }}
                    style={({ pressed }) => [styles.reBtn, { backgroundColor: k.lime }, pressed && { opacity: 0.85 }]}
                    testID="ek56-reorder-btn"
                  >
                    {busyId === c.order.id ? <ActivityIndicator size="small" color={k.limeInk} /> : <Repeat size={22} color={k.limeInk} weight="bold" />}
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </HScroll>
    </View>
  );
}

// ── 3) Kalan kalorine uygun öğünler (öne çıkan: bulanık renkli zemin + cam) ──
export function KcalSection({
  state,
  remaining,
  picks,
  addingId,
  onOpen,
  onAdd,
  onGoal,
  onAll,
  macLabel,
}: {
  state: KcalState;
  remaining: number;
  picks: GrowthProduct[];
  addingId: string | null;
  onOpen: (p: GrowthProduct) => void;
  onAdd: (p: GrowthProduct) => void;
  onGoal: () => void;
  onAll: () => void;
  macLabel: (p: GrowthProduct) => string | undefined;
}) {
  const k = useGrowthTokens();
  const { t } = useEk();
  const show = state === 'empty' || picks.length > 0;
  useSecView('kcal', state, show);
  if (!show) return null;
  const title = state === 'done' ? t('ek56.kcal.done_title') : state === 'empty' ? t('ek56.kcal.empty_title') : t('ek56.kcal.left_title', { n: remaining });
  const sub = state === 'done' ? t('ek56.kcal.done_sub') : state === 'empty' ? undefined : t('ek56.kcal.left_sub');
  const tag = state === 'done' ? t('ek56.kcal.light') : t('ek56.kcal.fits');
  return (
    <View style={styles.glowWrap} testID={`ek56-kcal-${state}`}>
      <GlowBg k={k} />
      <SecHead
        title={title}
        sub={sub}
        flame={state === 'full'}
        allLabel={state !== 'empty' ? t('ek56.all') : undefined}
        onAll={() => {
          secTap('kcal', 'all');
          onAll();
        }}
      />
      {state === 'empty' ? (
        <Glass radius={20} fill={k.glow.glass} edge={k.glow.glassEdge} style={styles.emptyCta} testID="ek56-kcal-empty-cta">
          <Image source={FLAME} style={styles.flame56} accessibilityIgnoresInvertColors accessible={false} />
          <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
            <Text style={[styles.emptyText, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
              {t('ek56.kcal.empty_body')}
            </Text>
            <LimeButton
              label={t('ek56.kcal.empty_btn')}
              onPress={() => {
                secTap('kcal', 'goal');
                onGoal();
              }}
              testID="ek56-kcal-goal"
            />
          </View>
        </Glass>
      ) : (
        <View style={{ marginHorizontal: -8 }}>
          <HScroll label={title} inset={8}>
            {picks.map((p) => (
              <GrowthProductCard
                key={String(p.id)}
                product={p}
                width={SEC.kcalCardW}
                tag={tag}
                mac={macLabel(p)}
                glass
                adding={addingId === String(p.id)}
                onPress={() => {
                  secTap('kcal', 'open');
                  onOpen(p);
                }}
                onAdd={() => {
                  secTap('kcal', 'add');
                  onAdd(p);
                }}
              />
            ))}
          </HScroll>
        </View>
      )}
    </View>
  );
}

function GlowBg({ k }: { k: GrowthTokens }) {
  return (
    <View pointerEvents="none" style={[styles.glowBg, { backgroundColor: k.glow.base, borderColor: k.glow.edge }]}>
      <SoftBlob size={300} color={k.glow.a} style={{ left: -90, top: -100 }} />
      <SoftBlob size={330} color={k.glow.b} style={{ right: -105, top: 25 }} />
      <SoftBlob size={340} color={k.glow.c} style={{ left: 60, bottom: -170 }} />
    </View>
  );
}

// ── 4) Planından sipariş et ─────────────────────────────────────────────────
export function PlanSection({ rows, busy, onOpen, onAddAll }: { rows: PlanRow[]; busy: boolean; onOpen: (p: GrowthProduct) => void; onAddAll: () => void }) {
  const k = useGrowthTokens();
  const { t } = useEk();
  useSecView('plan', 'full', rows.length > 0);
  if (rows.length === 0) return null;
  return (
    <View style={[styles.gutter, { gap: 10 }]} testID="ek56-plan">
      <SecHead title={t('ek56.plan.title')} sub={t('ek56.plan.sub')} />
      <View style={[styles.planCard, { backgroundColor: k.card, borderColor: k.line }]}>
        {rows.map((r, i) => {
          const kcal = productKcal(r.product);
          const price = cardPrice(r.product);
          const meal = t(`ek56.plan.${r.item.slot}`);
          return (
            <Pressable
              key={r.item.id}
              onPress={() => {
                secTap('plan', 'open');
                onOpen(r.product);
              }}
              accessibilityRole="button"
              accessibilityLabel={[meal, r.product.name, kcal ? t('ek56.card.kcal', { n: kcal }) : null, money(price.now)].filter(Boolean).join(', ')}
              style={({ pressed }) => [styles.planRow, i > 0 && { borderTopWidth: 1, borderTopColor: k.line }, pressed && { opacity: 0.85 }]}
              testID="ek56-plan-row"
            >
              {r.product.img ? (
                <CachedImage uri={transformImageUrl(r.product.img, ImagePreset.productCard) || r.product.img} style={styles.planImg} />
              ) : (
                <View style={[styles.planImg, { backgroundColor: k.nest }]} />
              )}
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text style={[styles.c12b, { color: k.sec }]} maxFontSizeMultiplier={SCALE}>
                  {meal}
                </Text>
                <Text style={[ekType.b15s, { color: k.ink }]} numberOfLines={2} maxFontSizeMultiplier={SCALE}>
                  {r.product.name}
                </Text>
                {kcal ? (
                  <Text style={[ekType.c13, ekType.num, { color: k.sec }]} maxFontSizeMultiplier={SCALE}>
                    {t('ek56.card.kcal', { n: kcal })}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.price15, ekType.num, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
                {money(price.now)}
              </Text>
            </Pressable>
          );
        })}
        <View style={[styles.planFoot, { borderTopColor: k.line }]}>
          <LimeButton
            label={t('ek56.plan.btn')}
            height={48}
            full
            busy={busy}
            onPress={() => {
              secTap('plan', 'add_all');
              onAddAll();
            }}
            testID="ek56-plan-add-all"
          />
        </View>
      </View>
    </View>
  );
}

// ── 5) Bu hafta en çok sipariş edilenler ────────────────────────────────────
export function TopSection({ rows, addingId, onOpen, onAdd, onAll }: { rows: TopRow[]; addingId: string | null; onOpen: (p: GrowthProduct) => void; onAdd: (p: GrowthProduct) => void; onAll: () => void }) {
  const { t } = useEk();
  useSecView('top', 'full', rows.length > 0);
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: 10 }} testID="ek56-top">
      <View style={styles.gutter}>
        <SecHead
          title={t('ek56.top.title')}
          allLabel={t('ek56.all')}
          onAll={() => {
            secTap('top', 'all');
            onAll();
          }}
        />
      </View>
      <HScroll label={t('ek56.top.title')}>
        {rows.map((r) => (
          <GrowthProductCard
            key={String(r.product.id)}
            product={r.product}
            width={SEC.topCardW}
            rank={r.rank}
            adding={addingId === String(r.product.id)}
            onPress={() => {
              secTap('top', 'open');
              onOpen(r.product);
            }}
            onAdd={() => {
              secTap('top', 'add');
              onAdd(r.product);
            }}
          />
        ))}
      </HScroll>
    </View>
  );
}

// ── 6) Arkadaşını davet et (banner biçimi) ──────────────────────────────────
export function InviteBanner({ rewardTl, onPress }: { rewardTl: number; onPress: () => void }) {
  const k = useGrowthTokens();
  const { t } = useEk();
  useSecView('invite', 'full', true);
  const title = t('ek56.invite.title');
  const desc = t('ek56.invite.hero', { n: Math.round(rewardTl) });
  return (
    <View style={styles.gutter} testID="ek56-invite">
      <Pressable
        onPress={() => {
          haptic('selection');
          secTap('invite', 'open');
          onPress();
        }}
        accessibilityRole="link"
        accessibilityLabel={`${t('ek56.banners.invite_tag')}: ${title}. ${desc}`}
        style={({ pressed }) => [{ gap: 8 }, pressed && { opacity: 0.85 }]}
      >
        {/* Görsel Claude Design'dan gelecek; o zamana kadar opak yüzey + cam nesne (kase = sipariş). */}
        <View style={[styles.inviteImg, { backgroundColor: k.card, borderColor: k.line2 }]}>
          <Image source={BOWL} style={styles.bowl} accessibilityIgnoresInvertColors accessible={false} />
          <View style={[styles.invitePill, { backgroundColor: k.lime }]}>
            <Text style={[styles.tagText, { color: k.limeInk, fontSize: 14 }]} maxFontSizeMultiplier={SCALE}>
              {t('ek56.invite.banner_cta')}
            </Text>
          </View>
        </View>
        <View style={{ gap: 2, paddingHorizontal: 2 }}>
          <Text style={[ekType.c13s, { color: k.sec }]} maxFontSizeMultiplier={SCALE}>
            {t('ek56.banners.invite_tag')}
          </Text>
          <Text style={[styles.bTitle, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
            {title}
          </Text>
          <Text style={[ekType.c13, { color: k.sec }]} maxFontSizeMultiplier={SCALE}>
            {desc}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

// ── Bildirim (st="toast"): "N ürün sepete eklendi" + "Sepete git" ──────────
export function AddedToast({ count, onCart }: { count: number; onCart: () => void }) {
  const k = useGrowthTokens();
  const { t } = useEk();
  return (
    <View style={styles.toastWrap} pointerEvents="box-none">
      <Glass radius={26} fill={k.glass} edge={k.glassEdge} style={[styles.toast, { shadowColor: k.glassSh }]} testID="ek56-toast">
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.toastInner}>
          <View style={[styles.check, { backgroundColor: k.lime }]}>
            <Check size={14} color={k.limeInk} weight="bold" />
          </View>
          <Text style={[styles.toastText, { color: k.ink }]} maxFontSizeMultiplier={SCALE}>
            {t(count === 1 ? 'ek56.toast_one' : 'ek56.toast_other', { n: count })}
          </Text>
          <Pressable onPress={onCart} accessibilityRole="button" style={styles.toastBtnHit}>
            <View style={[styles.toastBtn, { backgroundColor: k.ink }]}>
              <Text style={[styles.toastBtnText, { color: k.bg }]} maxFontSizeMultiplier={SCALE}>
                {t('ek56.to_cart')}
              </Text>
            </View>
          </Pressable>
        </View>
      </Glass>
    </View>
  );
}

// ── İskelet (st="skel") — EkSec SK ölçüleri ─────────────────────────────────
const SK: Record<EkSecKey, number[][][]> = {
  banners: [[[300, 104, 20], [300, 104, 20]], [[70, 14, 6], [220, 14, 6], [70, 14, 6]], [[200, 16, 6], [90, 16, 6], [200, 16, 6]]],
  chips: [[[110, 44, 22], [130, 44, 22], [120, 44, 22], [90, 44, 22]]],
  reorder: [[[180, 22, 8]], [[156, 150, 18], [156, 150, 18], [156, 150, 18]]],
  kcal: [[[220, 22, 8]], [[164, 164, 16], [164, 164, 16], [164, 164, 16]], [[120, 16, 6], [44, 16, 6], [120, 16, 6]]],
  plan: [[[200, 22, 8]], [[398, 268, 20]]],
  top: [[[280, 22, 8]], [[148, 148, 16], [148, 148, 16], [148, 148, 16]], [[110, 16, 6], [48, 16, 6], [110, 16, 6]]],
  invite: [[[398, 104, 20]], [[60, 14, 6]], [[200, 16, 6]]],
};

export function SecSkeleton({ sec }: { sec: EkSecKey }) {
  const k = useGrowthTokens();
  const glow = sec === 'kcal';
  const rows = SK[sec];
  const body = (
    <View style={{ gap: 10 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, overflow: 'hidden', paddingHorizontal: glow ? 0 : 16 }}>
          {row.map(([w, h, r], j) =>
            w >= 398 ? (
              <EkSkeleton key={j} height={h} radius={r} style={{ flex: 1, backgroundColor: glow ? k.glow.skel : k.skel }} />
            ) : (
              <EkSkeleton key={j} width={w} height={h} radius={r} style={{ backgroundColor: glow ? k.glow.skel : k.skel }} />
            ),
          )}
        </View>
      ))}
    </View>
  );
  if (!glow) return <View testID={`ek56-skel-${sec}`}>{body}</View>;
  return (
    <View style={styles.glowWrap} testID={`ek56-skel-${sec}`}>
      <GlowBg k={k} />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: 16 },
  head: { minHeight: SEC.headMin, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  h2: { fontFamily: fontFamily.headingBold, fontSize: 20, lineHeight: 24, letterSpacing: -0.2 },
  allBtn: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  all: { fontFamily: fontFamily.bodySemibold, fontSize: 14 },
  flame30: { width: 30, height: 30, resizeMode: 'contain' },
  flame56: { width: 56, height: 56, resizeMode: 'contain' },
  chip: { height: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 2 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reCard: { width: SEC.reorderCardW, padding: 10, borderRadius: 18, borderWidth: 1, gap: 4 },
  reImgWrap: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, overflow: 'hidden' },
  reImg: { width: 46, height: 46, borderRadius: 23 },
  reMore: { backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  reMoreText: { fontFamily: fontFamily.headingBold, fontSize: 15, color: '#FFFFFF' },
  reBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  oos: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  c12: { fontFamily: fontFamily.bodyMedium, fontSize: 12, lineHeight: 16 },
  c12b: { fontFamily: fontFamily.bodyBold, fontSize: 12, lineHeight: 16 },
  total: { fontFamily: fontFamily.bodyBold, fontSize: 14, lineHeight: 18 },
  reName: { fontFamily: fontFamily.bodyMedium, fontSize: 12, lineHeight: 15 },
  kcalBadge: { position: 'absolute', left: 8, top: 8, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center' },
  kcalText: { fontFamily: fontFamily.bodyBold, fontSize: 13, color: '#0A0A0A' },
  tag: { position: 'absolute', left: 8, bottom: 8, height: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center' },
  tagText: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  rank: { position: 'absolute', left: 8, bottom: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: fontFamily.headingBold, fontSize: 18, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  pname: { fontFamily: fontFamily.bodySemibold, fontSize: 14, lineHeight: 17.5, minHeight: 35 },
  mac: { alignSelf: 'flex-start', height: 24, paddingHorizontal: 8, borderRadius: 12, justifyContent: 'center' },
  macText: { fontFamily: fontFamily.bodySemibold, fontSize: 12 },
  cnt: { fontFamily: fontFamily.bodyMedium, fontSize: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  price15: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  addHit: { width: 44, height: 44, marginVertical: -4, marginRight: -6, alignItems: 'center', justifyContent: 'center' },
  add: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  glowWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 10 },
  glowBg: { position: 'absolute', left: 8, right: 8, top: 0, bottom: 0, borderRadius: 28, overflow: 'hidden', borderWidth: 1 },
  emptyCta: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  emptyText: { fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 19.5 },
  planCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  planRow: { paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76 },
  planImg: { width: 56, height: 56, borderRadius: 14 },
  planFoot: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1 },
  inviteImg: { height: SEC.bannerH, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, overflow: 'hidden' },
  bowl: { width: 76, height: 76, resizeMode: 'contain' },
  invitePill: { height: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center' },
  bTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 19 },
  toastWrap: { alignItems: 'center' },
  toast: { minHeight: 52, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  toastInner: { minHeight: 52, paddingVertical: 6, paddingRight: 8, paddingLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toastText: { fontFamily: fontFamily.bodyBold, fontSize: 14, flexShrink: 1 },
  toastBtnHit: { minHeight: 44, justifyContent: 'center' },
  toastBtn: { height: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center' },
  toastBtnText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
});
