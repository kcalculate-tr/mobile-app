// HomeMealSlots — FinHomeR3 "Bugün" dört öğün yuvası (yeni kabuk, G13-S1 m.1).
//
// Bayrak KAPALIYKEN TrackerScreen bu bileşeni HİÇ render etmez (bkz.
// TrackerScreen `yeniKabuk` dalı + bayrak-kapalı snapshot testi).
//
// İçerik (FinHomeR3 / FinHomeEmptyR1 / FinHomeDelivered):
//  • Başlık "Bugün" + gün toplamı "eaten / target kcal".
//  • Gün tamamen boşsa: cam damla + "Bugün henüz boş" + tek "…'e logla ⌄".
//  • Her yuva: ikon · ad · yuva toplamı (boşsa "—"); kayıtlar: 44pt foto/yer
//    tutucu, ad, kaynak etiketi (Tara/Keşfet/eatkcal · teslim edildi/Elle) +
//    saat, kcal. Boş yuvada "…'e logla ⌄".
//  • Kayıt menüsü: eatkcal (otomatik) kayıtta görünür "Düzenle"; diğerlerinde
//    satıra uzun bas. Menü: Porsiyon ½·1·1½·2 (otomatik kayıtta), Paylaş
//    (paylasim_karti), Kaldır.
//  • Logla izi B (FinMoLogB): vurgulanan kayıtta lime nokta iner ('dot') →
//    satır yanar ('row') → halka dolar ('ring', TrackerDayHeader).
//
// Hareket yalnız core/design token/hook'ları; azaltılmış harekette nokta
// animasyonsuz, satır vurgusu doğrudan.
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  AppText,
  CURVE,
  DURATION,
  REDUCED,
  SPRING,
  haptic,
  useReducedMotion,
  useTheme,
} from '../../core/design';
import { useT } from '../../core/i18n';
import { CaretDown, ShareNetwork, Trash } from '../../components/icons';
import { GlassObject } from '../../modules/celebrate';
import {
  groupThousands,
  slotFromHour,
  type HomeMealItem,
  type HomeSlot,
  type SlotKey,
} from '../../modules/gun/homeData';
import type { HighlightPhase } from '../../modules/gun/homeHighlight';
import { MealMenuPopover, useAnchorMeasure } from '../../modules/gun/home/MealMenuPopover';
import { useMealPhoto } from '../../modules/gun/useMealPhoto';
import { useMealSticker } from '../../modules/gun/useMealSticker';

// G28-S1 md.2: görsel yoksa kase cam nesnesi (kase = öğün; durağan png — listede yüzme yok).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BOWL = require('../../../assets/glass/bowl.png');

/**
 * Satır küçük görseli (44 pt, 12 yarıçap):
 * G29-S1: çıkartma (şeffaf zemin, kırpılmış; yalnız fotoğraflı Tara kaydında sorulur) →
 * Tara fotoğrafı (imzalı URL, önbellekli) → yüklenirken iskelet → ürün görseli → kase cam nesnesi.
 */
function MealThumb({
  itemId,
  photoPath,
  image,
  testID,
}: {
  itemId?: string | null;
  photoPath?: string | null;
  image?: string;
  testID?: string;
}) {
  const t = useTheme();
  const sticker = useMealSticker(photoPath ? itemId : null);
  const photo = useMealPhoto(photoPath);
  const bg = t.isDark ? '#3A3A3C' : '#DCDEE2';
  if (sticker.status === 'ready') {
    return (
      <View style={styles.thumb} testID={testID} accessible={false}>
        <Image
          source={{ uri: sticker.uri }}
          style={styles.thumbImg}
          resizeMode="contain"
          testID={testID ? `${testID}-sticker` : undefined}
        />
      </View>
    );
  }
  // Çıkartma sorulurken hazır fotoğraf (yerel / önbellek) beklemeden çizilir; çıkartma gelince değişir.
  const uri = photo.status === 'ready' ? photo.uri : image;
  const waiting = sticker.status === 'loading' || photo.status === 'loading';
  return (
    <View style={[styles.thumb, { backgroundColor: bg }]} testID={testID} accessible={false}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumbImg} testID={testID ? `${testID}-img` : undefined} />
      ) : waiting ? (
        <View style={styles.thumbImg} testID={testID ? `${testID}-skeleton` : undefined} />
      ) : (
        <Image source={BOWL} style={styles.thumbBowl} resizeMode="contain" testID={testID ? `${testID}-bowl` : undefined} />
      )}
    </View>
  );
}
import type { Rect } from '../../modules/gun/home/popoverGeometry';

// FinHomeR3 yuva ikonları (pano SVG yolları, 24×24, stroke 1.75).
const SLOT_ICON: Record<SlotKey, string> = {
  breakfast: 'M4 18h16 M7 18a5 5 0 0 1 10 0 M12 6v3 M5.6 10.6l1.4 1.4 M18.4 10.6 17 12',
  lunch:
    'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6l1.4 1.4 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4',
  dinner: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z',
  snack:
    'M12 7.5c-1.5-1-5-1.3-6 2.5-.9 3.5 1.5 9 4 9 1 0 1.2-.5 2-.5s1 .5 2 .5c2.5 0 4.9-5.5 4-9-1-3.8-4.5-3.5-6-2.5Z M12 7.5c0-2 1-3.5 2.5-4',
};
// Tara ikonu (pano "…'e logla" düğmesi).
const SCAN_ICON =
  'M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8 M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8 M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16 M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16 M16.92 11.13A5 5 0 1 1 13.71 7.3A2.6 2.6 0 0 0 16.92 11.13Z';

const PORTIONS: { label: string; value: number }[] = [
  { label: '½', value: 0.5 },
  { label: '1', value: 1 },
  { label: '1½', value: 1.5 },
  { label: '2', value: 2 },
];

/** FinHomeEN: "0.5 · 1 · 1.5 · 2"; TR "½ · 1 · 1½ · 2". */
function portionLabel(p: { label: string; value: number }, lang: 'tr' | 'en'): string {
  return lang === 'en' ? String(p.value) : p.label;
}

function StrokeIcon({ d, size, color }: { d: string; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export interface HomeMealSlotsProps {
  slots: HomeSlot[];
  /** Bugün tüketilen kcal (gün toplamı). */
  eaten: number;
  /** Günlük hedef kcal. */
  target: number;
  /** Ada göre ürün görseli (varsa). */
  images?: Record<string, string>;
  /** Vurgulanan kayıt + evresi (FinMoLogB). */
  highlight?: { id: string; phase: HighlightPhase } | null;
  /** "…'e logla" (hapın ana yarısı): seçili öğün + yerinde menüdeki porsiyon. */
  onLog: (slot: SlotKey, portion?: number) => void;
  /** Uzun basış — elle giriş (⌄ artık yerinde menü, FinMoPopover). */
  onChangeMeal: (slot: SlotKey) => void;
  onRemove: (item: HomeMealItem) => void;
  onPortion?: (item: HomeMealItem, factor: number) => void;
  /** G19-S2 md.2: kaydı başka öğüne taşı (FinMoPopover; yalnız yeni kabuk). */
  onMoveMeal?: (item: HomeMealItem, slot: SlotKey) => void;
  /** G19-S2 md.1: hedef yoksa başlık "1.240 kcal · Hedef belirlenmedi". */
  hasTarget?: boolean;
  /** Verilirse kayıt menüsünde "Paylaş" görünür (paylasim_karti). */
  onShare?: (item: HomeMealItem) => void;
  /** Vitrin (yalnız __DEV__): ilk eatkcal kaydının porsiyon menüsü açık başlar (FinHomeR3). */
  initialOpenAuto?: boolean;
  /**
   * Loglama anı · önce (FinHomeLogBefore / FinMoLogA): kullanıcı "…'e logla"ya
   * bastı, kayıt henüz gelmedi → o yuvanın başlığında Logla damlası.
   */
  pendingSlot?: SlotKey | null;
  /** Saat (0–23) — boş gün hapının yuvası. Verilmezse yerel saat. */
  nowHour?: number;
  /** G18-S2 md.5: gün boşken "Bugün" başlığının altı (FinHomeEmptyR1 — S1 HomeEmptyToday). */
  emptyContent?: React.ReactNode;
  /** Vitrin (yalnız __DEV__): bu yuvanın yerinde menüsü açık başlar (FinMoPopover). */
  initialMenuSlot?: SlotKey | null;
  /** G18-S5 (FinPush hatırlatma/seri dokunuşu → `finOpenLog`): bu öğünün yerinde menüsünü bir kez açar. */
  openMenuSlot?: SlotKey | null;
  /** Vitrin (yalnız __DEV__): açılan menü 2 sn sonra kapanır (aç/kapa kare dizisi). */
  menuCycle?: boolean;
}

/** FinMoLogA "goo" damlası: r11 baş + r6 kuyruk (pano: #4A6B00, koyuda lime). */
function LogDrop() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const c = t.isDark ? '#C6F04F' : '#4A6B00';
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = reduced ? withTiming(1, { duration: REDUCED.duration }) : withSpring(1, SPRING.ai);
  }, [reduced, s]);
  const style = useAnimatedStyle(() => ({ opacity: s.value, transform: [{ scale: 0.4 + 0.6 * s.value }] }));
  return (
    <Animated.View style={[styles.drop, style]} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width={24} height={34} viewBox="0 0 24 34">
        <Path d="M12 1a11 11 0 0 1 4.6 21 5.6 5.6 0 0 1-2.2 3.6 6 6 0 1 1-4.8 0A5.6 5.6 0 0 1 7.4 22 11 11 0 0 1 12 1Z" fill={c} />
      </Svg>
    </Animated.View>
  );
}

export function HomeMealSlots({
  slots,
  eaten,
  target,
  images,
  highlight,
  onLog,
  onChangeMeal,
  onRemove,
  onPortion,
  onMoveMeal,
  hasTarget = true,
  onShare,
  initialOpenAuto = false,
  pendingSlot = null,
  nowHour,
  emptyContent,
  initialMenuSlot = null,
  openMenuSlot = null,
  menuCycle = false,
}: HomeMealSlotsProps) {
  const t = useTheme();
  const { t: tt, lang } = useT();
  const numLang = lang === 'en' ? 'en' : 'tr';
  const [openId, setOpenId] = useState<string | null>(null);
  const firstAutoId = slots.flatMap((s) => s.items).find((it) => it.auto)?.id ?? null;
  useEffect(() => {
    if (__DEV__ && initialOpenAuto && firstAutoId) setOpenId(firstAutoId);
  }, [initialOpenAuto, firstAutoId]);
  const [portion, setPortion] = useState<Record<string, number>>({});

  const allEmpty = slots.every((s) => s.empty);
  const dayTotal = hasTarget
    ? tt('gun.day_total', {
        eaten: groupThousands(eaten, numLang),
        target: groupThousands(target, numLang),
      })
    : tt('gun.day_total_nogoal', { eaten: groupThousands(eaten, numLang) });

  const toggleMenu = useCallback((id: string) => {
    haptic('selection');
    setOpenId((cur) => (cur === id ? null : id));
  }, []);

  // Gün tamamen boşken tek pill: o anki saatin yuvası (FinHomeEmptyR1).
  const nowSlot = slotFromHour(nowHour ?? new Date().getHours());

  return (
    <View
      accessibilityLabel={tt('gun.today')}
      style={[styles.section, { borderBottomColor: t.color.line }]}
    >
      <View style={styles.head}>
        <AppText textRole="section">{tt('gun.today')}</AppText>
        <AppText variant="caption" style={styles.headTotal}>
          {dayTotal}
        </AppText>
      </View>

      {allEmpty && emptyContent ? (
        emptyContent
      ) : allEmpty ? (
        <View style={[styles.emptyBox, { borderTopColor: t.color.line }]}>
          <View style={styles.emptyGlass}>
            {/* G21-S1 md.1 (Tur 26f): FinHomeXL boş gün damla → kase. */}
            <GlassObject name="bowl" size={104} />
          </View>
          <AppText style={styles.emptyTitle}>{tt('gun.empty_today_title')}</AppText>
          <AppText variant="caption" tone="secondary">
            {tt('gun.empty_today_sub')}
          </AppText>
          <View style={styles.emptyPill}>
            <SlotLogPill
              slot={nowSlot}
              onLog={onLog}
              onChangeMeal={onChangeMeal}
            />
          </View>
        </View>
      ) : (
        slots.map((sl) => (
          <View key={sl.key} style={[styles.slot, { borderTopColor: t.color.line }]}>
            <View style={styles.slotHead}>
              <StrokeIcon d={SLOT_ICON[sl.key]} size={18} color={t.color.secondary} />
              <View style={styles.slotNameWrap}>
                <AppText variant="caption" style={styles.slotNameText}>
                  {tt(`meal.${sl.key}`)}
                </AppText>
                {pendingSlot === sl.key ? <LogDrop /> : null}
              </View>
              <AppText variant="caption" tone="secondary" style={styles.slotKcal}>
                {sl.empty
                  ? tt('gun.slot_empty_kcal')
                  : tt('gun.item_kcal', { kcal: groupThousands(sl.kcal, numLang) })}
              </AppText>
            </View>
            {sl.items.map((it) => (
              <SlotItem
                key={it.id}
                item={it}
                image={images?.[it.name.trim().toLowerCase()] || undefined}
                phase={highlight && highlight.id === it.id ? highlight.phase : null}
                open={openId === it.id}
                portion={portion[it.id] ?? 1}
                onToggleMenu={toggleMenu}
                onPick={(p) => {
                  haptic('selection');
                  setPortion((m) => ({ ...m, [it.id]: p }));
                  onPortion?.(it, p);
                }}
                onRemove={() => {
                  setOpenId(null);
                  onRemove(it);
                }}
                onShare={onShare ? () => onShare(it) : undefined}
                slot={sl.key}
                onMoveMeal={
                  onMoveMeal
                    ? (m) => {
                        setOpenId(null);
                        if (m !== sl.key) onMoveMeal(it, m);
                      }
                    : undefined
                }
                numLang={numLang}
              />
            ))}
            {sl.empty ? (
              <View style={styles.slotEmpty}>
                <SlotLogPill slot={sl.key} onLog={onLog} onChangeMeal={onChangeMeal} autoOpen={(__DEV__ && initialMenuSlot === sl.key) || openMenuSlot === sl.key} autoOpenDelay={openMenuSlot === sl.key ? DURATION.slow : undefined} autoCycle={menuCycle} />
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

function SlotLogPill({
  slot,
  onLog,
  onChangeMeal,
  autoOpen = false,
  autoOpenDelay = 3500,
  autoCycle = false,
}: {
  slot: SlotKey;
  onLog: (slot: SlotKey, portion?: number) => void;
  onChangeMeal: (slot: SlotKey) => void;
  autoOpen?: boolean;
  /** Açılış gecikmesi (vitrin 3500 ms kare çekimi; bildirim dokunuşu DURATION.slow). */
  autoOpenDelay?: number;
  autoCycle?: boolean;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  // G18-S2 md.2 (FinMoPopover): ⌄ yerinde menü açar (öğün + porsiyon); seçilen öğün
  // etiketi günceller, ana yarı o öğüne + porsiyonla loglar. Uzun basış = elle giriş (korundu).
  const [meal, setMeal] = useState<SlotKey>(slot);
  const [portion, setPortion] = useState(1);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const { ref, measure } = useAnchorMeasure();
  useEffect(() => setMeal(slot), [slot]);
  useEffect(() => {
    if (!autoOpen) return;
    const id = setTimeout(() => {
      measure().then((r) => r && setAnchor(r));
    }, autoOpenDelay);
    return () => clearTimeout(id);
  }, [autoOpen, autoOpenDelay, measure]);
  const label = tt(`gun.log_to_${meal}`);
  const open = anchor != null;
  return (
    <View ref={ref} collapsable={false} style={[styles.pill, { backgroundColor: t.color.accent }]}>
      <Pressable
        onPress={() => {
          haptic('light');
          onLog(meal, portion);
        }}
        onLongPress={() => {
          haptic('selection');
          onChangeMeal(meal);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.pillMain}
      >
        <StrokeIcon d={SCAN_ICON} size={18} color={t.color.onAccent} />
        <AppText variant="heading" tone="onAccent" numberOfLines={1} style={styles.pillText}>
          {label}
        </AppText>
      </Pressable>
      <View style={styles.pillDivider} />
      <Pressable
        onPress={async () => {
          haptic('selection');
          if (open) return;
          const r = await measure();
          if (r) setAnchor(r);
        }}
        accessibilityRole="button"
        accessibilityLabel={tt('gun.change_meal', { meal: tt(`meal.${meal}`) })}
        accessibilityState={{ expanded: open }}
        style={styles.pillCaret}
        testID={`log-pill-caret-${slot}`}
      >
        <CaretDown size={16} color={t.color.onAccent} weight="bold" />
      </Pressable>
      <MealMenuPopover
        anchor={anchor}
        meal={meal}
        portion={portion}
        onPickMeal={setMeal}
        onPickPortion={setPortion}
        onClosed={() => setAnchor(null)}
        autoCloseMs={autoOpen && __DEV__ && autoCycle ? 2000 : undefined}
      />
    </View>
  );
}

function SlotItem({
  item,
  image,
  phase,
  open,
  portion,
  onToggleMenu,
  onPick,
  onRemove,
  onShare,
  slot,
  onMoveMeal,
  numLang,
}: {
  slot?: SlotKey;
  onMoveMeal?: (slot: SlotKey) => void;
  item: HomeMealItem;
  image?: string;
  phase: HighlightPhase | null;
  open: boolean;
  portion: number;
  onToggleMenu: (id: string) => void;
  onPick: (p: number) => void;
  onRemove: () => void;
  onShare?: () => void;
  numLang: 'tr' | 'en';
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const reduced = useReducedMotion();
  const lit = phase === 'row' || phase === 'ring';
  const hlBg = t.isDark ? 'rgba(198,240,79,0.16)' : 'rgba(198,240,79,0.28)';

  // Logla izi B: lime nokta satırın soluna iner (dot), satıra oturunca söner.
  const dot = useSharedValue(0);
  useEffect(() => {
    if (phase === 'dot') {
      dot.value = reduced
        ? withTiming(1, { duration: REDUCED.duration })
        : withSpring(1, SPRING.ai);
    } else {
      dot.value = withTiming(0, { duration: reduced ? REDUCED.duration : DURATION.fast, easing: CURVE.out });
    }
  }, [phase, reduced, dot]);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dot.value,
    transform: [
      { translateY: (1 - dot.value) * (reduced ? REDUCED.maxShift : -24) },
      { scale: 0.6 + 0.4 * dot.value },
    ],
  }));

  const sourceLabel = tt(`gun.src_${item.source}`);
  const time = lit ? tt('gun.just_now') : item.time;
  // G19-S2 md.2: "Öğün ⌄" → FinMoPopover (öğün + porsiyon) bu kayıt için.
  const { ref: moveRef, measure: measureMove } = useAnchorMeasure();
  const [moveAnchor, setMoveAnchor] = useState<Rect | null>(null);

  return (
    <View
      testID={`home-item-${item.id}`}
      style={[styles.item, lit ? { backgroundColor: hlBg } : null]}
    >
      <Pressable
        onLongPress={() => onToggleMenu(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${sourceLabel}, ${item.time}, ${tt('gun.item_kcal', { kcal: item.kcal })}`}
        accessibilityHint={tt('gun.record_menu', { name: item.name })}
        accessibilityActions={[{ name: 'activate', label: tt('gun.record_menu', { name: item.name }) }]}
        onAccessibilityAction={() => onToggleMenu(item.id)}
        style={styles.itemRow}
      >
        <MealThumb itemId={item.id} photoPath={item.photoPath} image={image} testID={`home-thumb-${item.id}`} />
        <View style={styles.itemMain}>
          <AppText numberOfLines={1} style={styles.itemName}>
            {item.name}
          </AppText>
          <View style={styles.metaRow}>
            <View
              style={[
                styles.tag,
                lit
                  ? { backgroundColor: t.color.accent, borderColor: t.color.accent }
                  : { borderColor: t.isDark ? '#48484A' : '#C3C7CC' },
              ]}
            >
              <AppText variant="caption" tone={lit ? 'onAccent' : 'ink'} numberOfLines={1} style={styles.tagText}>
                {sourceLabel}
              </AppText>
            </View>
            <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.itemTime}>
              {time}
            </AppText>
          </View>
        </View>
        <AppText style={styles.itemKcal}>
          {tt('gun.item_kcal', { kcal: groupThousands(item.kcal, numLang) })}
        </AppText>
        <Animated.View
          pointerEvents="none"
          testID={phase === 'dot' ? `home-dot-${item.id}` : undefined}
          style={[styles.dot, { backgroundColor: t.color.accent }, dotStyle]}
        />
      </Pressable>

      {item.auto ? (
        <Pressable
          onPress={() => onToggleMenu(item.id)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={styles.editLink}
        >
          <AppText style={styles.editText}>{tt('gun.edit')}</AppText>
        </Pressable>
      ) : null}

      {open ? (
        <View style={styles.menu} accessibilityLabel={tt('gun.record_menu', { name: item.name })}>
          {item.auto ? (
            <>
              <AppText variant="caption" tone="secondary">
                {tt('gun.portion_label')}
              </AppText>
              {PORTIONS.map((p) => {
                const on = p.value === portion;
                return (
                  <Pressable
                    key={p.label}
                    onPress={() => onPick(p.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={tt('gun.portion_pick', { p: portionLabel(p, numLang) })}
                    style={[
                      styles.portion,
                      on
                        ? { backgroundColor: t.color.ink, borderColor: t.color.ink }
                        : { borderColor: t.isDark ? '#48484A' : '#C3C7CC' },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      style={[styles.portionText, { color: on ? t.color.bg : t.color.ink }]}
                    >
                      {portionLabel(p, numLang)}
                    </AppText>
                  </Pressable>
                );
              })}
            </>
          ) : null}
          <View style={styles.menuSpacer} />
          {onMoveMeal && slot ? (
            <View ref={moveRef} collapsable={false}>
              <Pressable
                onPress={async () => {
                  haptic('selection');
                  const r = await measureMove();
                  if (r) setMoveAnchor(r);
                }}
                accessibilityRole="button"
                accessibilityLabel={tt('gun.change_meal', { meal: tt(`meal.${slot}`) })}
                accessibilityState={{ expanded: moveAnchor != null }}
                style={styles.menuBtn}
                testID={`home-item-meal-${item.id}`}
              >
                <AppText variant="caption" style={styles.menuBtnText}>
                  {tt(`meal.${slot}`)}
                </AppText>
                <CaretDown size={14} color={t.color.ink} weight="bold" />
              </Pressable>
              <MealMenuPopover
                anchor={moveAnchor}
                meal={slot}
                portion={portion}
                onPickMeal={(m) => onMoveMeal(m)}
                onPickPortion={onPick}
                onClosed={() => setMoveAnchor(null)}
              />
            </View>
          ) : null}
          {onShare ? (
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel={tt('gun.share_item')}
              style={styles.menuBtn}
            >
              {/* Final satırında Paylaş yok; özellik (paylasim_karti) kalır → yalnız ikon, satır kırılmasın. */}
              <ShareNetwork size={18} color={t.color.ink} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={tt('gun.remove')}
            style={styles.menuBtn}
          >
            <Trash size={16} color={t.color.ink} />
            <AppText variant="caption" style={styles.menuBtnText}>
              {tt('gun.remove')}
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  head: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headTotal: { fontWeight: '600' },
  emptyBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'flex-start',
    gap: 6,
  },
  emptyGlass: { alignSelf: 'center', marginBottom: 6 },
  emptyTitle: { fontWeight: '600' },
  emptyPill: { marginTop: 6 },
  slot: { borderTopWidth: StyleSheet.hairlineWidth },
  slotHead: {
    minHeight: 40,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotNameText: { fontWeight: '600' },
  drop: { marginTop: 8, marginLeft: 4 },
  slotKcal: { fontWeight: '600' },
  slotEmpty: { paddingLeft: 42, paddingRight: 16, paddingBottom: 8 },
  pill: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillMain: {
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: { fontSize: 15 },
  pillDivider: { width: 1, height: 20, backgroundColor: 'rgba(10,10,10,0.28)' },
  pillCaret: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  item: { paddingVertical: 8, paddingHorizontal: 16, gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  thumb: { width: 44, height: 44, borderRadius: 12, overflow: 'hidden' },
  thumbImg: { width: 44, height: 44 },
  thumbBowl: { width: 36, height: 36, margin: 4 },
  itemMain: { flex: 1, minWidth: 0, gap: 2 },
  // G28-S1 md.3 (FinHomeR3/FinHomeLog*): ad 15/500 tek satır kesilir; alt satır 13 kaynak hapı + saat; kcal 15/500.
  itemName: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemTime: { flexShrink: 1 },
  tag: {
    minHeight: 20,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
  },
  tagText: { fontWeight: '600' },
  itemKcal: { fontSize: 15, lineHeight: 21, fontWeight: '500', flexShrink: 0 },
  dot: { position: 'absolute', left: -10, top: 18, width: 8, height: 8, borderRadius: 4 },
  editLink: { alignSelf: 'flex-start', marginLeft: 56, minWidth: 44, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  editText: { fontWeight: '600', textDecorationLine: 'underline' },
  menu: { paddingLeft: 56, flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuSpacer: { flex: 1 },
  portion: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portionText: { fontWeight: '600' },
  menuBtn: { minHeight: 44, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  menuBtnText: { fontWeight: '600' },
});
