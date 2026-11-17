// G59-S1 — Düzenleyici sayfaları (FinStoryEditor `stickers` · `mealpick` + etiket/anket girişi):
// cam yüzey (açık rgba(255,255,255,0.86) / koyu rgba(28,28,30,0.86); Reduce Transparency → düz), üst köşe 28,
// tutamaç 36×5, başlık Bricolage 22 + kapat 44 (32 daire). Açılış 550 ms enter eğrisi, perde 330 ms;
// Reduce Motion → 200 ms opaklık. Müzik / soru / bağlantı / challenge karoları YOK (kapsam dışı; LOG).
import { SCROLL_KEYBOARD } from '../../../../core/design/keyboard';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CURVE, DURATION, fontFamily, haptic, useReducedMotion, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useMealPhoto } from '../../../gun/useMealPhoto';
import type { TodayConsumption } from '../../../gun/todayConsumptions';
import { mealDataFrom, mealTypeLabelKey } from '../../dayKit';
import type { StickerSkin, StoryOverlay } from '../../types';
import { LIME, LIME_INK, storyTheme } from '../tokens';
import { StorySticker } from '../StorySticker';
import { useReduceTransparency } from '../a11y';

const P_X = 'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z';
const P_SEARCH = 'M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z';
export const P_PIN = 'M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z';
export const P_CHART = 'M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V80H96a8,8,0,0,0-8,8v40H48a8,8,0,0,0-8,8v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM104,96h40V200H104ZM56,144H88v56H56Z';
const P_CLOCK = 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z';

export type LabelKind = 'location' | 'mention' | 'hashtag' | 'poll';

export function EditorSheet({ visible, onClose, top, title, sub, children, footer, testID }: {
  visible: boolean;
  onClose: () => void;
  top: number;
  title: string;
  sub?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  testID?: string;
}) {
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const { t: tr } = useT();
  const reduced = useReducedMotion();
  const solid = useReduceTransparency();
  const { height: H } = useWindowDimensions();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = visible ? withTiming(1, { duration: reduced ? 200 : DURATION.slow, easing: CURVE.enter }) : 0;
  }, [visible, reduced, p]);
  const panel = useAnimatedStyle(() => (reduced ? { opacity: p.value } : { transform: [{ translateY: (1 - p.value) * H }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 1.6) }));
  if (!visible) return null;
  const bg = solid ? (t.isDark ? '#1C1C1E' : '#FFFFFF') : t.isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.97)';
  return (
    <View style={StyleSheet.absoluteFill} testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: st.scrim }, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('hikaye.close')} />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.sheet, { top, backgroundColor: bg, borderTopColor: st.edge, shadowOpacity: st.shadow }, panel]}
      >
        <View style={styles.handleRow}><View style={[styles.handle, { backgroundColor: st.line2 }]} /></View>
        <View style={styles.head}>
          <View style={{ flex: 1, minWidth: 0, paddingTop: sub ? 6 : 0 }}>
            <Text accessibilityRole="header" style={[styles.title, { color: st.text }]}>{title}</Text>
            {sub ? <Text style={[styles.sub, { color: st.sec }]}>{sub}</Text> : null}
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('hikaye.close')} style={styles.close44}>
            <View style={[styles.close32, { backgroundColor: st.closeBg }]}>
              <Svg width={18} height={18} viewBox="0 0 256 256"><Path d={P_X} fill={st.text} /></Svg>
            </View>
          </Pressable>
        </View>
        {children}
        {footer}
      </Animated.View>
    </View>
  );
}

export interface KitTile {
  kind: 'meal' | 'ring' | 'streak' | 'water' | 'steps' | 'recipe' | 'poll';
  label: string;
  preview: StoryOverlay;
  /** Önizleme ölçeği + kutu (tasarım `tile(...)`). */
  sc: number;
  w: number;
  h: number;
}

export function StickersSheet({ visible, onClose, tiles, onGeneric, onTile }: {
  visible: boolean;
  onClose: () => void;
  tiles: KitTile[];
  onGeneric: (k: 'location' | 'mention' | 'poll' | 'time' | 'hashtag') => void;
  onTile: (k: KitTile) => void;
}) {
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const { t: tr } = useT();
  const [q, setQ] = useState('');
  const generic = useMemo(
    () =>
      [
        { k: 'location' as const, label: tr('hikaye.g_place'), path: P_PIN },
        { k: 'mention' as const, label: tr('hikaye.g_mention'), glyph: '@' },
        { k: 'poll' as const, label: tr('hikaye.g_poll'), path: P_CHART },
        { k: 'time' as const, label: tr('hikaye.g_time'), path: P_CLOCK },
        { k: 'hashtag' as const, label: tr('hikaye.g_tag'), glyph: '#' },
      ].filter((g) => !q.trim() || g.label.toLocaleLowerCase('tr-TR').includes(q.trim().toLocaleLowerCase('tr-TR'))),
    [tr, q],
  );
  const shownTiles = tiles.filter((x) => !q.trim() || x.label.toLocaleLowerCase('tr-TR').includes(q.trim().toLocaleLowerCase('tr-TR')));
  return (
    <EditorSheet visible={visible} onClose={onClose} top={150} title={tr('hikaye.stickers')} testID="story-stickers-sheet">
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.search, { backgroundColor: st.field }]}>
          <Svg width={18} height={18} viewBox="0 0 256 256"><Path d={P_SEARCH} fill={st.sec} /></Svg>
          <TextInput value={q} onChangeText={setQ} placeholder={tr('hikaye.search_stickers')} placeholderTextColor={st.sec} accessibilityLabel={tr('hikaye.search_stickers')} style={[styles.searchIn, { color: st.text }]} returnKeyType="search" />
        </View>
        <View style={styles.genRow}>
          {generic.map((g) => (
            <Pressable key={g.k} onPress={() => { haptic('selection'); onGeneric(g.k); }} accessibilityRole="button" style={[styles.gen, { backgroundColor: st.card, borderColor: st.line }]} testID={`story-generic-${g.k}`}>
              {g.glyph ? <Text style={[styles.genGlyph, { color: st.acc }]}>{g.glyph}</Text> : <Svg width={18} height={18} viewBox="0 0 256 256"><Path d={g.path!} fill={st.acc} /></Svg>}
              <Text style={[styles.genT, { color: st.text }]}>{g.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.fromRow}>
          <View style={styles.dot10} />
          <Text accessibilityRole="header" style={[styles.fromT, { color: st.text }]}>{tr('hikaye.from_today')}</Text>
        </View>
        <Text style={[styles.fromSub, { color: st.sec }]}>{tr('hikaye.from_today_sub')}</Text>
        <View style={styles.grid}>
          {shownTiles.map((k) => (
            <Pressable key={k.kind} onPress={() => { haptic('selection'); onTile(k); }} accessibilityRole="button" accessibilityLabel={tr('hikaye.tile_a11y', { name: k.label })} style={styles.tile} testID={`story-tile-${k.kind}`}>
              <LinearGradient colors={['#4A4F3A', '#17191C']} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
              <View pointerEvents="none" style={styles.tilePrev}>
                <View style={{ width: Math.round(k.w * k.sc), height: Math.round(k.h * k.sc) }}>
                  <View style={{ position: 'absolute', left: 0, top: 0, width: k.w, transformOrigin: 'left top', transform: [{ scale: k.sc }] }}>
                    <StorySticker overlay={k.preview} />
                  </View>
                </View>
              </View>
              <View style={styles.tileBar}><Text style={styles.tileT}>{k.label}</Text></View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </EditorSheet>
  );
}

function MealRow({ m, on, first, onPick }: { m: TodayConsumption; on: boolean; first: boolean; onPick: () => void }) {
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const { t: tr, fmt } = useT();
  const photo = useMealPhoto(m.photo_url ?? null);
  return (
    <Pressable onPress={onPick} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.mealRow, !first && { borderTopWidth: 1, borderTopColor: st.line }]}>
      <View style={[styles.mealChip, { backgroundColor: st.chip }]}>
        {photo.status === 'ready' ? <Image source={{ uri: photo.uri }} style={{ width: 44, height: 44 }} contentFit="cover" /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.t12s, { color: st.sec }]}>{tr(`hikaye.${mealTypeLabelKey(m.meal_type)}`)}</Text>
        <Text style={[styles.t15b, { color: st.text }]} numberOfLines={2}>{m.name}</Text>
      </View>
      <Text style={[styles.t13b, { color: st.text }]}>{fmt(m.kcal)} kcal</Text>
      <View style={[styles.radio, on ? { backgroundColor: LIME } : { borderWidth: 2, borderColor: st.line2 }]} />
    </Pressable>
  );
}

export function MealPickSheet({ visible, onClose, meals, initialId, previewUri, onAdd }: {
  visible: boolean;
  onClose: () => void;
  meals: TodayConsumption[];
  initialId?: string | null;
  previewUri: string | null;
  onAdd: (m: TodayConsumption, skin: StickerSkin, showMacros: boolean) => void;
}) {
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const { t: tr } = useT();
  const [id, setId] = useState<string | null>(initialId ?? meals[0]?.id ?? null);
  const [skin, setSkin] = useState<StickerSkin>('light');
  const [macros, setMacros] = useState(true);
  useEffect(() => {
    if (visible) setId(initialId ?? meals[0]?.id ?? null);
  }, [visible, initialId, meals]);
  const cur = meals.find((m) => m.id === id) ?? meals[0];
  const preview: StoryOverlay | null = cur ? { id: 'preview', kind: 'meal', x: 0.5, y: 0.5, scale: 1, rotation: 0, z: 0, data: mealDataFrom(cur, skin, macros) } : null;
  return (
    <EditorSheet
      visible={visible}
      onClose={onClose}
      top={112}
      title={tr('hikaye.pick_title')}
      sub={tr('hikaye.pick_sub')}
      testID="story-mealpick-sheet"
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34 }}>
          <Pressable
            disabled={!cur}
            onPress={() => {
              if (!cur) return;
              haptic('light');
              onAdd(cur, skin, macros);
            }}
            accessibilityRole="button"
            accessibilityState={{ disabled: !cur }}
            style={[styles.cta, { backgroundColor: cur ? LIME : st.off }]}
            testID="story-mealpick-add"
          >
            <Text style={[styles.ctaT, { color: cur ? LIME_INK : st.offFg }]}>{tr('hikaye.add_sticker')}</Text>
          </Pressable>
        </View>
      }
    >
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
        <View accessibilityLabel={tr('hikaye.preview')} style={styles.preview}>
          {previewUri ? <Image source={{ uri: previewUri }} style={[StyleSheet.absoluteFill, { opacity: 0.85 }]} contentFit="cover" /> : <LinearGradient colors={['#4A4F3A', '#17191C']} style={StyleSheet.absoluteFill} />}
          {preview ? <View style={{ transform: [{ scale: 0.9 }] }}><StorySticker overlay={preview} /></View> : null}
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={tr('hikaye.style')} style={styles.skins}>
          {(['light', 'dark', 'glass'] as StickerSkin[]).map((k) => {
            const on = skin === k;
            return (
              <Pressable key={k} onPress={() => { haptic('selection'); setSkin(k); }} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.skin, on ? { backgroundColor: LIME } : { backgroundColor: st.card, borderWidth: 1, borderColor: st.line2 }]}>
                <Text style={[styles.t14b, { color: on ? LIME_INK : st.text }]}>{tr(k === 'light' ? 'hikaye.s_light' : k === 'dark' ? 'hikaye.s_dark' : 'hikaye.s_glass')}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.listH, { color: st.sec }]}>{tr('hikaye.today_meals')}</Text>
        {meals.length ? (
          <View accessibilityRole="radiogroup" style={[styles.list, { backgroundColor: st.card, borderColor: st.line }]}>
            {meals.map((m, i) => <MealRow key={m.id} m={m} on={cur?.id === m.id} first={i === 0} onPick={() => { haptic('selection'); setId(m.id); }} />)}
          </View>
        ) : (
          <Text style={[styles.empty, { color: st.sec }]}>{tr('hikaye.pick_empty')}</Text>
        )}
        <View style={styles.swRow}>
          <Text style={[styles.swT, { color: st.text }]}>{tr('hikaye.show_macros')}</Text>
          <Pressable onPress={() => { haptic('selection'); setMacros((v) => !v); }} accessibilityRole="switch" accessibilityState={{ checked: macros }} accessibilityLabel={tr('hikaye.show_macros')} style={styles.swHit}>
            <View style={[styles.sw, { backgroundColor: macros ? LIME : st.swOff }]}>
              <View style={[styles.swKnob, { transform: [{ translateX: macros ? 20 : 0 }] }]} />
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </EditorSheet>
  );
}

/** Etiket / bahset / konum / anket girişi (tasarımda ayrı kare yok; metin aracıyla aynı dil — LOG KARAR). */
export function LabelSheet({ kind, initial, onClose, onDone }: {
  kind: LabelKind | null;
  initial?: { text?: string; question?: string; options?: string[] } | null;
  onClose: () => void;
  onDone: (v: { text?: string; question?: string; options?: string[] }) => void;
}) {
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const { t: tr } = useT();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<string[]>([]);
  useEffect(() => {
    if (!kind) return;
    setText(initial?.text ?? '');
    setQ(initial?.question ?? '');
    setOpts(initial?.options?.length ? initial.options : [tr('hikaye.poll_yes'), tr('hikaye.poll_no')]);
  }, [kind, initial, tr]);
  if (!kind) return null;
  const title = tr(kind === 'location' ? 'hikaye.g_place' : kind === 'mention' ? 'hikaye.g_mention' : kind === 'hashtag' ? 'hikaye.g_tag' : 'hikaye.g_poll');
  const ok = kind === 'poll' ? q.trim().length > 0 && opts.filter((o) => o.trim()).length >= 2 : text.trim().replace(/^[#@]+/, '').length > 0;
  return (
    <EditorSheet
      visible
      onClose={onClose}
      top={150}
      title={title}
      testID="story-label-sheet"
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34 }}>
          <Pressable disabled={!ok} onPress={() => onDone(kind === 'poll' ? { question: q.trim(), options: opts.map((o) => o.trim()).filter(Boolean) } : { text: text.trim() })} accessibilityRole="button" accessibilityState={{ disabled: !ok }} style={[styles.cta, { backgroundColor: ok ? LIME : st.off }]} testID="story-label-done">
            <Text style={[styles.ctaT, { color: ok ? LIME_INK : st.offFg }]}>{tr('hikaye.done')}</Text>
          </Pressable>
        </View>
      }
    >
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
        {kind === 'poll' ? (
          <>
            <TextInput autoFocus value={q} onChangeText={(v) => setQ(v.slice(0, 80))} placeholder={tr('hikaye.poll_q_ph')} placeholderTextColor={st.sec} style={[styles.input, { color: st.text, backgroundColor: st.card, borderColor: st.line2 }]} accessibilityLabel={tr('hikaye.poll_q_ph')} />
            {opts.map((o, i) => (
              <TextInput key={i} value={o} onChangeText={(v) => setOpts((a) => a.map((x, j) => (j === i ? v.slice(0, 24) : x)))} placeholder={tr('hikaye.poll_opt_ph', { n: i + 1 })} placeholderTextColor={st.sec} style={[styles.input, { color: st.text, backgroundColor: st.card, borderColor: st.line2 }]} accessibilityLabel={tr('hikaye.poll_opt_ph', { n: i + 1 })} />
            ))}
            {opts.length < 4 ? (
              <Pressable onPress={() => setOpts((a) => [...a, ''])} accessibilityRole="button" style={styles.addOpt}>
                <Text style={[styles.t14b, { color: st.text, textDecorationLine: 'underline' }]}>{tr('hikaye.poll_add_opt')}</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <TextInput
            autoFocus
            value={text}
            onChangeText={(v) => setText(v.slice(0, 60))}
            placeholder={tr(kind === 'location' ? 'hikaye.label_place_ph' : kind === 'mention' ? 'hikaye.label_mention_ph' : 'hikaye.label_tag_ph')}
            placeholderTextColor={st.sec}
            autoCapitalize={kind === 'location' ? 'sentences' : 'none'}
            autoCorrect={kind === 'location'}
            style={[styles.input, { color: st.text, backgroundColor: st.card, borderColor: st.line2 }]}
            accessibilityLabel={title}
            returnKeyType="done"
          />
        )}
      </ScrollView>
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, shadowColor: '#000', shadowRadius: 16, shadowOffset: { width: 0, height: -8 }, elevation: 12 },
  handleRow: { alignItems: 'center', paddingTop: 6 },
  handle: { width: 36, height: 5, borderRadius: 3 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 2, paddingRight: 8, paddingLeft: 20 },
  title: { fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 26, paddingTop: 9 },
  sub: { marginTop: 2, fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 19 },
  close44: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  close32: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  search: { height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchIn: { flex: 1, minWidth: 0, fontFamily: fontFamily.bodyRegular, fontSize: 16, height: 44 },
  genRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gen: { minHeight: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  genGlyph: { fontFamily: fontFamily.headingBold, fontSize: 16 },
  genT: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  fromRow: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot10: { width: 10, height: 10, borderRadius: 5, backgroundColor: LIME },
  fromT: { fontFamily: fontFamily.headingBold, fontSize: 18 },
  fromSub: { marginTop: 2, marginBottom: 10, fontFamily: fontFamily.bodyRegular, fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.5%', height: 148, borderRadius: 18, overflow: 'hidden' },
  tilePrev: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 30, alignItems: 'center', justifyContent: 'center' },
  tileBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, alignItems: 'center', justifyContent: 'center' },
  tileT: { color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 13 },
  mealRow: { minHeight: 64, paddingVertical: 8, paddingLeft: 10, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealChip: { width: 44, height: 44, borderRadius: 12, overflow: 'hidden' },
  t12s: { fontFamily: fontFamily.bodySemibold, fontSize: 12, lineHeight: 16 },
  t13b: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  t14b: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  t15b: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 19 },
  radio: { width: 22, height: 22, borderRadius: 11 },
  preview: { height: 150, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  skins: { marginTop: 10, flexDirection: 'row', gap: 8 },
  skin: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  listH: { marginTop: 14, fontFamily: fontFamily.bodyBold, fontSize: 13 },
  list: { marginTop: 6, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  empty: { marginTop: 10, fontFamily: fontFamily.bodyRegular, fontSize: 14 },
  swRow: { marginTop: 6, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  swT: { flex: 1, fontFamily: fontFamily.bodySemibold, fontSize: 15 },
  swHit: { width: 60, height: 44, alignItems: 'center', justifyContent: 'center' },
  sw: { width: 51, height: 31, borderRadius: 16, padding: 2 },
  swKnob: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cta: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaT: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontFamily: fontFamily.bodyRegular, fontSize: 16 },
  addOpt: { minHeight: 44, justifyContent: 'center' },
});
