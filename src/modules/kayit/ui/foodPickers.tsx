// G54-S1 md.4 — Kayıt soruları: (a) "Yemediğin bir şey var mı?" gruplu çipler + gerçek arama + özel öğe;
// (b) "Hangi mutfakları seversin?" yatay kaydırılan büyük görsel kartlar (ikon/emoji YOK).
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '../../../core/design';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { Check, MagnifyingGlass, Plus, X } from '../../../components/icons';
import { FONT, KText as AppText } from './parts';
import { ChipToggle } from './pickers';
import { PressScale, mixColor, useSelectTween } from './motion';
import { useK } from './theme';
import { K_CUISINES, type KCuisine } from '../model';
import { CUISINE_IMAGES } from '../cuisineImages';
import { DISLIKE_GROUPS, DISLIKE_GROUP_LABEL, DISLIKE_MAX, canAddCustom, dislikeLabel, isCustom, searchFoods } from '../foods';

type T = (k: string, p?: Record<string, unknown>) => string;

// ─── (b) Mutfak kartları ──────────────────────────────────────────────────────
/** Görsel yokken kart zemini: mutfağa özel sakin degrade (yalnız mevcut kayıt paletinden; yeni renk yok). */
const PAIRS: readonly [string, string][] = [
  ['#3A5C1B', '#0D2617'], // koyu: bgTop → bgBottom
  ['#6E9A08', '#173A20'], // blobA → bgMid
  ['#24553A', '#0D2617'], // blobB → bgBottom
  ['#FFB98F', '#3A5C1B'], // açık blobB → koyu bgTop
  ['#FCCDB0', '#24553A'], // açık bgTop → koyu blobB
  ['#2E5B12', '#10301D'], // ringFill → ink
];
export const CUISINE_GRADIENT: Record<KCuisine, [string, string]> = Object.fromEntries(K_CUISINES.map((k, i) => [k, PAIRS[i % PAIRS.length]])) as Record<KCuisine, [string, string]>;

/** Kart ölçüsü: ~260×320 pt (dar ekranda ekranın %68'i), yarıçap 24; yandakiler kenardan görünür. */
export function cuisineCardSize(screenW: number): { w: number; h: number; gap: number; pad: number } {
  const w = Math.round(Math.min(260, screenW * 0.68));
  const h = Math.round((w * 320) / 260);
  const gap = 14;
  return { w, h, gap, pad: Math.round((screenW - w) / 2) };
}

export function CuisineCards({ value, onToggle, t, testID = 'kayit-cuisines' }: { value: readonly KCuisine[]; onToggle: (k: KCuisine) => void; t: T; testID?: string }) {
  const P = useK();
  const { width } = useWindowDimensions();
  const s = cuisineCardSize(width);
  return (
    <View style={{ gap: 12 }}>
      <ScrollView
        {...SCROLL_KEYBOARD}
        testID={testID}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={s.w + s.gap}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: s.pad, gap: s.gap }}
        accessibilityRole="list"
        accessibilityLabel={t('kayit.q.cuisines_title')}
      >
        {K_CUISINES.map((k) => (
          <CuisineCard key={k} k={k} w={s.w} h={s.h} selected={value.includes(k)} onPress={() => onToggle(k)} t={t} />
        ))}
      </ScrollView>
      <AppText testID={`${testID}-count`} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.4} style={[styles.count, { color: P.sec }]}>
        {t('kayit.q.cuisines_count', { n: value.length })}
      </AppText>
    </View>
  );
}

function CuisineCard({ k, w, h, selected, onPress, t }: { k: KCuisine; w: number; h: number; selected: boolean; onPress: () => void; t: T }) {
  const P = useK();
  const tw = useSelectTween(selected, 150);
  const img = CUISINE_IMAGES[k];
  const name = t(`kayit.q.cuisine_${k}`);
  const ex = t(`kayit.q.cuisine_${k}_ex`);
  return (
    <PressScale
      testID={`kayit-cuisine-${k}`}
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t('kayit.q.cuisines_a11y', { name, ex })}
      style={[styles.card, { width: w, height: h, borderColor: mixColor('rgba(255,255,255,0)', P.accent, tw) }]}
    >
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        {img ? (
          <Image testID={`kayit-cuisine-${k}-img`} source={img} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient testID={`kayit-cuisine-${k}-gradient`} colors={CUISINE_GRADIENT[k]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.cardText}>
        <AppText maxFontSizeMultiplier={1.25} style={styles.cardName}>
          {name}
        </AppText>
        <AppText numberOfLines={1} maxFontSizeMultiplier={1.25} style={styles.cardEx}>
          {ex}
        </AppText>
      </View>
      {tw > 0 ? (
        <View testID={`kayit-cuisine-${k}-check`} style={[styles.check, { backgroundColor: P.accent, opacity: tw }]}>
          <Check size={16} color={P.limeInk} weight="bold" />
        </View>
      ) : null}
    </PressScale>
  );
}

// ─── (a) Yemediklerin ─────────────────────────────────────────────────────────
export function DislikePicker({
  value,
  eatsAll,
  lang,
  t,
  onToggle,
  onAddCustom,
  onEatsAll,
}: {
  value: readonly string[];
  eatsAll: boolean;
  lang: string;
  t: T;
  onToggle: (k: string) => void;
  onAddCustom: (text: string) => void;
  onEatsAll: () => void;
}) {
  const P = useK();
  const [q, setQ] = useState('');
  const query = q.trim();
  const hits = query ? searchFoods(query).filter((k) => !value.includes(k)) : [];
  const addable = query ? canAddCustom(query, value) : false;
  const full = value.length >= DISLIKE_MAX;
  const label = (k: string) => dislikeLabel(k, lang);
  return (
    <View testID="kayit-dislikes" style={{ gap: 16 }}>
      <View style={[styles.search, { backgroundColor: P.field, borderColor: P.cardEdge }]}>
        <MagnifyingGlass size={20} color={P.sec} />
        <TextInput
          testID="kayit-dislike-search"
          value={q}
          onChangeText={setQ}
          placeholder={t('kayit.q.dislikes_search')}
          placeholderTextColor={P.sec}
          accessibilityLabel={t('kayit.q.dislikes_search')}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (addable) {
              onAddCustom(query);
              setQ('');
            }
          }}
          style={[styles.searchInput, { color: P.ink }]}
          maxFontSizeMultiplier={1.4}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel={t('kayit.q.dislikes_remove', { name: q })} hitSlop={10} style={styles.clear}>
            <X size={16} color={P.sec} />
          </Pressable>
        ) : null}
      </View>

      {value.length ? (
        <View style={{ gap: 8 }} testID="kayit-dislike-selected">
          <AppText accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.groupTitle, { color: P.sec }]}>
            {t('kayit.q.dislikes_selected')}
          </AppText>
          <View style={styles.wrap}>
            {value.map((k) => (
              <PressScale
                key={k}
                testID={`kayit-dislike-sel-${isCustom(k) ? 'custom' : k}`}
                onPress={() => {
                  haptic('selection');
                  onToggle(k);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('kayit.q.dislikes_remove', { name: label(k) })}
                style={[styles.chip, { backgroundColor: P.accent, borderColor: P.accent }]}
              >
                <AppText maxFontSizeMultiplier={1.4} style={[styles.chipText, { color: P.limeInk }]}>
                  {label(k)}
                </AppText>
                <X size={14} color={P.limeInk} weight="bold" />
              </PressScale>
            ))}
          </View>
          {full ? (
            <AppText testID="kayit-dislike-max" accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.4} style={[styles.note, { color: P.sec }]}>
              {t('kayit.q.dislikes_max')}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {query ? (
        <View testID="kayit-dislike-results" style={[styles.results, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
          {hits.map((k, i) => (
            <Pressable
              key={k}
              testID={`kayit-dislike-hit-${k}`}
              disabled={full}
              onPress={() => {
                haptic('selection');
                onToggle(k);
                setQ('');
              }}
              accessibilityRole="button"
              accessibilityLabel={label(k)}
              style={[styles.hit, i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.ringTrack } : null]}
            >
              <AppText maxFontSizeMultiplier={1.4} style={[styles.hitText, { color: P.ink }]}>
                {label(k)}
              </AppText>
              <Plus size={16} color={P.sec} />
            </Pressable>
          ))}
          {addable ? (
            <Pressable
              testID="kayit-dislike-add"
              onPress={() => {
                haptic('selection');
                onAddCustom(query);
                setQ('');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('kayit.q.dislikes_add', { text: query })}
              style={[styles.hit, hits.length ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.ringTrack } : null]}
            >
              <AppText maxFontSizeMultiplier={1.4} style={[styles.hitText, { color: P.ink, fontFamily: FONT.semi }]}>
                {t('kayit.q.dislikes_add', { text: query })}
              </AppText>
              <Plus size={16} color={P.ink} weight="bold" />
            </Pressable>
          ) : null}
          {!hits.length && !addable ? (
            <View testID="kayit-dislike-empty" style={styles.hit}>
              <AppText maxFontSizeMultiplier={1.4} style={[styles.hitText, { color: P.sec }]}>
                {full ? t('kayit.q.dislikes_max') : t('kayit.q.dislikes_empty_title')}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : (
        DISLIKE_GROUPS.map((g) => {
          const items = g.items.filter((k) => !value.includes(k));
          if (!items.length) return null;
          return (
            <View key={g.key} style={{ gap: 8 }} testID={`kayit-dislike-group-${g.key}`}>
              <AppText accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.groupTitle, { color: P.sec }]}>
                {lang === 'en' ? DISLIKE_GROUP_LABEL[g.key].en : DISLIKE_GROUP_LABEL[g.key].tr}
              </AppText>
              <View style={styles.wrap}>
                {items.map((k) => (
                  <ChipToggle key={k} testID={`kayit-dislike-${k}`} label={label(k)} on={false} disabled={full} onPress={() => onToggle(k)} />
                ))}
              </View>
            </View>
          );
        })
      )}
      <ChipToggle testID="kayit-eats-all" label={t('kayit.q.eats_all')} on={eatsAll} onPress={onEatsAll} />
    </View>
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: FONT.semi, fontSize: 15, lineHeight: 20, textAlign: 'center' },
  card: { borderRadius: 24, borderWidth: 3, overflow: 'visible', justifyContent: 'flex-end' },
  clip: { borderRadius: 21, overflow: 'hidden' },
  cardText: { paddingHorizontal: 18, paddingBottom: 18, gap: 2 },
  cardName: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, lineHeight: 27, color: '#FFFFFF' },
  cardEx: { fontFamily: FONT.body, fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.86)' },
  check: { position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, minHeight: 52 },
  searchInput: { flex: 1, fontFamily: FONT.body, fontSize: 16, minHeight: 44 },
  clear: { minWidth: 32, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  groupTitle: { fontFamily: FONT.semi, fontSize: 13, lineHeight: 18, letterSpacing: 0.2, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14 },
  chipText: { fontFamily: FONT.semi, fontSize: 15, lineHeight: 20 },
  note: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
  results: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  hit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 16, gap: 12 },
  hitText: { flex: 1, fontFamily: FONT.body, fontSize: 16, lineHeight: 21 },
});
