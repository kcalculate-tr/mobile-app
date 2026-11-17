// G59-S1 — Hikâye çıkartması (tasarım docs/g59/design/FinStorySticker.dc.html: `kind` × `skin`). Ölçüler birebir:
// öğün 240 · halka 150 · seri 96 · su 84 · adım 96 · tarif 200 · anket 250; köşe 22–24, gölge 0 8 24 / %22.
// Müzik / soru / challenge türleri YOK (kapsam dışı). Cam: rgba(20,20,22,0.58); Reduce Transparency → #1C1C1E.
// Anket: oy verince sonuç yüzdeleri (oy veren + sahibi görür), dokunma 44 pt; Katıl animasyonu yok (challenge yok).
import React from 'react';
import { Image as RNImage, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import { fontFamily, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { colorHex, isLightColor } from '../overlays';
import { pollPercents } from '../rules';
import { mealTypeLabelKey, ringPercent } from '../dayKit';
import type { StoryOverlay, TextData } from '../types';
import { LIME, LIME_INK, STICKER_SHADOW, skinTokens } from './tokens';

const GLASS = {
  trophy: require('../../../../assets/glass/trophy.png'),
  drop: require('../../../../assets/glass/drop.png'),
  foot: require('../../../../assets/glass/foot.png'),
  bowl: require('../../../../assets/glass/bowl.png'),
};

const P_PIN = 'M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z';
const P_CLOCK = 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm56,112H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z';
const P_CARET = 'M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z';

/** Yazı tipi (tasarım fontDefs): Fraunces/JetBrains Mono uygulamada yok → sistem serif / mono (KARAR). */
export function storyFontStyle(font: TextData['font']): { fontFamily?: string; fontWeight?: '500' | '600' | '700'; letterSpacing?: number; upper?: boolean } {
  switch (font) {
    case 'bold':
      return { fontFamily: fontFamily.headingBold, letterSpacing: -0.32 };
    case 'classic':
      return { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '600' };
    case 'type':
      return { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '500' };
    case 'caps':
      return { fontFamily: fontFamily.bodyBold, letterSpacing: 2.56, upper: true };
    default:
      return { fontFamily: fontFamily.bodyBold };
  }
}

/** Yazı katmanı (32 pt, satır 1,15; kutu: dolgu 6×12, köşe 12; kutusuzda gölge 0 1 8 / %45). */
export function StoryTextView({ data, maxWidth }: { data: TextData; maxWidth: number }) {
  const f = storyFontStyle(data.font);
  const hex = colorHex(data.color);
  const fg = data.box ? (isLightColor(data.color) ? '#0A0A0A' : '#FFFFFF') : hex;
  return (
    <View style={{ maxWidth, alignItems: data.align === 'left' ? 'flex-start' : data.align === 'right' ? 'flex-end' : 'center' }}>
      <Text
        allowFontScaling={false}
        style={[
          styles.text,
          {
            color: fg,
            fontFamily: f.fontFamily,
            fontWeight: f.fontWeight,
            letterSpacing: f.letterSpacing ?? 0,
            textAlign: data.align,
            backgroundColor: data.box ? hex : 'transparent',
            paddingHorizontal: data.box ? 12 : 0,
            paddingVertical: data.box ? 6 : 0,
            borderRadius: data.box ? 12 : 0,
            overflow: 'hidden',
          },
          !data.box && styles.textShadow,
        ]}
      >
        {f.upper ? data.text.toLocaleUpperCase('tr-TR') : data.text}
      </Text>
    </View>
  );
}

export interface StickerInteract {
  /** Anket: kendi oyum + sonuçlar (sahibi ya da oy veren görür). */
  myVote?: number | null;
  results?: number[] | null;
  onVote?: (option: number) => void;
  onMealPress?: () => void;
  mealExpanded?: boolean;
  onRecipePress?: () => void;
  onMentionPress?: (handle: string) => void;
  /** Düzenleyicide true: dokunmalar sürüklemeye bırakılır (anket düğmeleri pasif). */
  editing?: boolean;
}

export function StorySticker({
  overlay,
  reduceTransparency = false,
  interact = {},
}: {
  overlay: StoryOverlay;
  reduceTransparency?: boolean;
  interact?: StickerInteract;
}) {
  const { t, lang, fmt } = useT();
  const o = overlay;
  if (o.kind === 'text') return <StoryTextView data={o.data} maxWidth={345} />;
  if (o.kind === 'draw') return null;
  const skin = 'skin' in o.data ? o.data.skin : 'light';
  const k = skinTokens(skin, reduceTransparency);
  const card = { backgroundColor: k.bg, ...STICKER_SHADOW };

  switch (o.kind) {
    case 'meal': {
      const d = o.data;
      const type = t(`hikaye.${mealTypeLabelKey(d.meal_type)}`);
      const a11y =
        t('hikaye.meal_a11y', { type, name: d.name, kcal: fmt(d.kcal) }) +
        (d.show_macros && d.protein_g != null ? t('hikaye.meal_macros_a11y', { p: fmt(d.protein_g), c: fmt(d.carbs_g ?? 0), f: fmt(d.fat_g ?? 0) }) : '');
      const body = (
        <View style={[styles.meal, card]} accessibilityLabel={a11y} accessible={!interact.onMealPress || !!interact.editing}>
          <View style={styles.row10}>
            <View style={[styles.mealChip, { backgroundColor: k.chip }]}>
              {d.image_url ? (
                <Image source={{ uri: d.image_url }} style={styles.mealImg} contentFit="cover" />
              ) : (
                <RNImage source={GLASS.bowl} style={styles.mealGlass} resizeMode="contain" />
              )}
            </View>
            <View style={styles.flex1}>
              <Text allowFontScaling={false} style={[styles.t12s, { color: k.sec }]} numberOfLines={1}>{type}</Text>
              <Text allowFontScaling={false} style={[styles.t14b, { color: k.text }]} numberOfLines={2}>{d.name}</Text>
              <Text allowFontScaling={false} style={[styles.kcal, { color: k.text }]}>
                {fmt(d.kcal)} <Text style={styles.kcalUnit}>kcal</Text>
              </Text>
            </View>
          </View>
          {d.show_macros && (d.protein_g != null || d.carbs_g != null || d.fat_g != null) ? (
            <MacroRow p={d.protein_g ?? 0} c={d.carbs_g ?? 0} f={d.fat_g ?? 0} k={k} labels={[t('hikaye.macro_p'), t('hikaye.macro_c'), t('hikaye.macro_f')]} fmt={fmt} />
          ) : null}
        </View>
      );
      if (!interact.onMealPress || interact.editing) return body;
      return (
        <Pressable
          onPress={() => {
            haptic('light');
            interact.onMealPress?.();
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: !!interact.mealExpanded }}
          accessibilityLabel={t('hikaye.meal_tap_a11y', { name: d.name, kcal: fmt(d.kcal) })}
        >
          {body}
        </Pressable>
      );
    }
    case 'ring': {
      const d = o.data;
      const pct = ringPercent(d.kcal, d.goal);
      const C = 2 * Math.PI * 37;
      return (
        <View style={[styles.ring, card]} accessible accessibilityRole="image" accessibilityLabel={t('hikaye.ring_a11y', { n: pct, kcal: fmt(d.kcal), goal: fmt(d.goal) })}>
          <Text allowFontScaling={false} style={[styles.t12b, { color: k.sec }]}>{t('hikaye.my_day')}</Text>
          <View style={styles.ring88}>
            <Svg width={88} height={88} viewBox="0 0 88 88" style={StyleSheet.absoluteFill}>
              <Circle cx={44} cy={44} r={37} fill="none" stroke={k.track} strokeWidth={9} />
              {pct > 0 ? (
                <Circle cx={44} cy={44} r={37} fill="none" stroke={LIME} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${(C * Math.min(100, pct)) / 100} ${C}`} transform="rotate(-90 44 44)" />
              ) : null}
            </Svg>
            <Text allowFontScaling={false} style={[styles.big20, { color: k.text }]}>{t('hikaye.ring_pct', { n: pct })}</Text>
          </View>
          <Text allowFontScaling={false} style={[styles.t13b, { color: k.text }]}>{t('hikaye.ring_kcal', { kcal: fmt(d.kcal), goal: fmt(d.goal) })}</Text>
        </View>
      );
    }
    case 'streak':
      return (
        <View style={[styles.small, { width: 96, paddingHorizontal: 8 }, card]} accessible accessibilityRole="image" accessibilityLabel={t('hikaye.streak_a11y', { n: o.data.days })}>
          <RNImage source={GLASS.trophy} style={{ width: 48, height: 48 }} resizeMode="contain" />
          <Text allowFontScaling={false} style={[styles.big20, { color: k.text }]}>{t('hikaye.days', { n: o.data.days })}</Text>
          <Text allowFontScaling={false} style={[styles.t12s, { color: k.sec }]}>{t('hikaye.streak')}</Text>
        </View>
      );
    case 'water': {
      const l = Math.round((o.data.ml / 1000) * 10) / 10;
      const ls = lang === 'tr' ? String(l).replace('.', ',') : String(l);
      return (
        <View style={[styles.small, { width: 84 }, card]} accessible accessibilityRole="image" accessibilityLabel={t('hikaye.water_a11y', { n: ls })}>
          <RNImage source={GLASS.drop} style={{ width: 40, height: 40 }} resizeMode="contain" />
          <Text allowFontScaling={false} style={[styles.big18, { color: k.text }]}>{ls} L</Text>
          <Text allowFontScaling={false} style={[styles.t12s, { color: k.sec }]}>{t('hikaye.water')}</Text>
        </View>
      );
    }
    case 'steps':
      return (
        <View style={[styles.small, { width: 96 }, card]} accessible accessibilityRole="image" accessibilityLabel={t('hikaye.steps_a11y', { n: fmt(o.data.steps) })}>
          <RNImage source={GLASS.foot} style={{ width: 40, height: 40 }} resizeMode="contain" />
          <Text allowFontScaling={false} style={[styles.big18, { color: k.text }]}>{fmt(o.data.steps)}</Text>
          <Text allowFontScaling={false} style={[styles.t12s, { color: k.sec }]}>{t('hikaye.steps')}</Text>
        </View>
      );
    case 'recipe': {
      const d = o.data;
      return (
        <View style={[styles.recipe, card]}>
          <View>
            {d.image_url ? (
              <Image source={{ uri: d.image_url }} style={styles.recipeImg} contentFit="cover" accessibilityLabel={d.name} />
            ) : (
              <View style={[styles.recipeImg, { backgroundColor: k.chip, alignItems: 'center', justifyContent: 'center' }]}>
                <RNImage source={GLASS.bowl} style={{ width: 56, height: 56 }} resizeMode="contain" />
              </View>
            )}
            <View style={styles.recipeBadge}>
              <RNImage source={GLASS.bowl} style={{ width: 16, height: 16 }} resizeMode="contain" />
              <Text allowFontScaling={false} style={styles.recipeBadgeT}>{t('hikaye.recipe')}</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 2 }}>
            <Text allowFontScaling={false} style={[styles.t15b, { color: k.text }]} numberOfLines={2}>{d.name}</Text>
            <View style={{ marginTop: 6, flexDirection: 'row', gap: 6 }}>
              <View style={[styles.chip24, { backgroundColor: k.chip }]}>
                <Text allowFontScaling={false} style={[styles.t12b, { color: k.text }]}>{fmt(d.kcal)} kcal</Text>
              </View>
            </View>
            <Pressable
              disabled={!interact.onRecipePress || interact.editing}
              onPress={interact.onRecipePress}
              accessibilityRole="button"
              style={styles.seeRecipe}
            >
              <Text allowFontScaling={false} style={[styles.t14b, { color: k.text }]}>{t('hikaye.see_recipe')}</Text>
              <Svg width={16} height={16} viewBox="0 0 256 256"><Path d={P_CARET} fill={k.text} /></Svg>
            </Pressable>
          </View>
        </View>
      );
    }
    case 'poll': {
      const d = o.data;
      const voted = interact.myVote != null;
      const pct = interact.results && interact.results.length === d.options.length ? pollPercents(interact.results) : null;
      return (
        <View style={[styles.poll, card]} accessibilityLabel={t('hikaye.poll_a11y', { q: d.question })}>
          <Text allowFontScaling={false} style={[styles.pollQ, { color: k.text }]}>{d.question}</Text>
          <View style={styles.pollRow} accessibilityRole="radiogroup">
            {d.options.map((opt, i) => {
              const on = interact.myVote === i;
              const showPct = pct != null && (voted || !interact.onVote);
              return (
                <Pressable
                  key={`${o.id}-${i}`}
                  disabled={!interact.onVote || voted || interact.editing}
                  onPress={() => {
                    haptic('selection');
                    interact.onVote?.(i);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: !interact.onVote || voted }}
                  accessibilityLabel={showPct ? t('hikaye.poll_result_a11y', { opt, n: pct![i] }) : opt}
                  style={[styles.pollOpt, { backgroundColor: on ? LIME : k.chip }]}
                >
                  {showPct ? (
                    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 14, overflow: 'hidden' }]}>
                      <View style={{ width: `${pct![i]}%`, height: '100%', backgroundColor: on ? LIME : k.track }} />
                    </View>
                  ) : null}
                  <Text allowFontScaling={false} numberOfLines={1} style={[styles.t15b, { color: on ? LIME_INK : k.text }]}>
                    {showPct ? `${opt} · ${pct![i]}%` : opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }
    case 'location':
    case 'mention':
    case 'hashtag':
    case 'time': {
      const label = o.data.text;
      const glyph = o.kind === 'location' ? P_PIN : o.kind === 'time' ? P_CLOCK : null;
      const handle = o.kind === 'mention' ? o.data.handle ?? null : null;
      const pill = (
        <View style={[styles.pill, card]}>
          {glyph ? (
            <Svg width={18} height={18} viewBox="0 0 256 256"><Path d={glyph} fill={k.acc} /></Svg>
          ) : null}
          <Text allowFontScaling={false} style={[styles.pillT, { color: o.kind === 'mention' || o.kind === 'hashtag' ? k.acc : k.text }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      );
      if (handle && interact.onMentionPress && !interact.editing) {
        return (
          <Pressable onPress={() => interact.onMentionPress?.(handle)} accessibilityRole="link" accessibilityLabel={label}>
            {pill}
          </Pressable>
        );
      }
      return pill;
    }
    default:
      return null;
  }
}

function MacroRow({ p, c, f, k, labels, fmt }: { p: number; c: number; f: number; k: ReturnType<typeof skinTokens>; labels: string[]; fmt: (n: number) => string }) {
  // Donut: makro kalorisi oranı (P·4, K·4, Y·9) — çevre 106,8 (r=17).
  const C = 2 * Math.PI * 17;
  const kc = [p * 4, c * 4, f * 9];
  const total = kc.reduce((a, b) => a + b, 0) || 1;
  const segs = kc.map((v) => (v / total) * C);
  const colors = [k.acc, k.m2, k.m3];
  let off = 0;
  return (
    <View style={styles.macroRow}>
      <Svg width={30} height={30} viewBox="0 0 44 44">
        <Circle cx={22} cy={22} r={17} fill="none" stroke={k.track} strokeWidth={6} />
        {segs.map((s, i) => {
          const el = s > 0.5 ? (
            <Circle key={i} cx={22} cy={22} r={17} fill="none" stroke={colors[i]} strokeWidth={6} strokeDasharray={`${Math.max(0, s - 1)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 22 22)" />
          ) : null;
          off += s;
          return el;
        })}
      </Svg>
      {[p, c, f].map((v, i) => (
        <View key={i} style={[styles.macroChip, { backgroundColor: k.chip }]}>
          <View style={[styles.dot7, { backgroundColor: colors[i] }]} />
          <Text allowFontScaling={false} style={[styles.t12b, { color: k.text }]}>{`${labels[i]} ${fmt(Math.round(v))} g`}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  row10: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontSize: 32, lineHeight: 37 },
  textShadow: { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  meal: { width: 240, padding: 12, borderRadius: 22 },
  mealChip: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mealImg: { width: 52, height: 52 },
  mealGlass: { width: 46, height: 46 },
  t12s: { fontFamily: fontFamily.bodySemibold, fontSize: 12, lineHeight: 16 },
  t12b: { fontFamily: fontFamily.bodyBold, fontSize: 12, lineHeight: 16 },
  t13b: { fontFamily: fontFamily.bodyBold, fontSize: 13, lineHeight: 18 },
  t14b: { fontFamily: fontFamily.bodyBold, fontSize: 14, lineHeight: 17 },
  t15b: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 18 },
  kcal: { fontFamily: fontFamily.headingBold, fontSize: 20, lineHeight: 22 },
  kcalUnit: { fontFamily: fontFamily.bodySemibold, fontSize: 13 },
  big20: { fontFamily: fontFamily.headingBold, fontSize: 20, lineHeight: 22 },
  big18: { fontFamily: fontFamily.headingBold, fontSize: 18, lineHeight: 21 },
  macroRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroChip: { flexGrow: 1, flexShrink: 1, height: 26, borderRadius: 13, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  dot7: { width: 7, height: 7, borderRadius: 4 },
  ring: { width: 150, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 12, borderRadius: 24, alignItems: 'center', gap: 6 },
  ring88: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  small: { paddingVertical: 10, paddingHorizontal: 6, borderRadius: 22, alignItems: 'center' },
  recipe: { width: 200, padding: 8, borderRadius: 22 },
  recipeImg: { width: '100%', height: 104, borderRadius: 16 },
  recipeBadge: { position: 'absolute', left: 8, top: 8, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 4 },
  recipeBadgeT: { fontFamily: fontFamily.bodyBold, fontSize: 12, color: '#0A0A0A' },
  chip24: { height: 24, paddingHorizontal: 8, borderRadius: 12, justifyContent: 'center' },
  seeRecipe: { marginTop: 4, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  poll: { width: 250, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 12, borderRadius: 22 },
  pollQ: { textAlign: 'center', fontFamily: fontFamily.headingBold, fontSize: 18, lineHeight: 22 },
  pollRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  pollOpt: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, overflow: 'hidden' },
  pill: { height: 44, paddingHorizontal: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 300 },
  pillT: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
});
