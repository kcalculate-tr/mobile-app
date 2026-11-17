// G59-S1 — Hikâyeni görenler (docs/g59/design/FinStoryViewers.dc.html `state` = list · empty). YALNIZ SAHİBİ
// (sunucu get_story_viewers sahibi denetler). Üstte küçültülmüş hikâye (132×234, köşe 14, 2 pt çerçeve); cam sayfa
// top 312: göz + "N görüntüleme", 24 sa notu, Öne çıkar / Paylaş / Sil, çıkartma etkileşimleri, filtre
// Tümü / Tepkiler, satır 60 pt (avatar 44, beğeni kalbi, tepki hapı, kişi seçenekleri 44). Boş hâl: halka + göz.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image as RNImage } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CURVE, DURATION, fontFamily, haptic, useReducedMotion, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CachedImage } from '../../../components/CachedImage';
import { getStoryClient } from '../client';
import { hoursLeft } from '../rules';
import type { Story, StoryReactionKind, StoryViewersResult } from '../types';
import { HEART, LIME, LIME_INK, storyTheme } from './tokens';
import { StoryCanvas } from './StoryCanvas';
import { useReduceTransparency } from './a11y';

const P_EYE = 'M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z';
const P_CLOCK = 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z';
const P_X = 'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z';
const P_PLUS = 'M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z';
const P_SHARE = 'M229.66,109.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,112H165a88,88,0,0,0-85.23,66,8,8,0,0,1-15.5-4A103.94,103.94,0,0,1,165,96h39.71L170.34,61.66a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,229.66,109.66ZM192,208H40V88a8,8,0,0,0-16,0V208a16,16,0,0,0,16,16H192a8,8,0,0,0,0-16Z';
const P_TRASH = 'M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z';
const P_HEART_F = 'M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z';
const P_USER = 'M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z';
const P_DOTS = 'M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm56-12a12,12,0,1,0,12,12A12,12,0,0,0,196,116ZM60,116a12,12,0,1,0,12,12A12,12,0,0,0,60,116Z';
const P_SEND = 'M231.87,114l-168-95.89A16,16,0,0,0,40.92,37.34L71.55,128,40.92,218.67A16,16,0,0,0,56,240a16.15,16.15,0,0,0,7.93-2.1l167.92-96.05a16,16,0,0,0,.05-27.89ZM56,224a.56.56,0,0,0,0-.12L85.74,136H144a8,8,0,0,0,0-16H85.74L56.06,32.16A.46.46,0,0,0,56,32l168,95.83Z';

const BOWL = require('../../../../assets/glass/bowl.png');

export const REACTION_KEY: Record<StoryReactionKind, string> = {
  like: 'hikaye.r_like',
  congrats: 'hikaye.r_congrats',
  enjoy: 'hikaye.r_enjoy',
  recipe: 'hikaye.r_recipe',
  great: 'hikaye.r_great',
  join: 'hikaye.r_join',
};

export function StoryViewersSheet({
  story,
  previewUri,
  nowMs,
  onClose,
  onHighlight,
  onShare,
  onDelete,
  onOpenProfile,
  initial,
}: {
  story: Story;
  previewUri: string | null;
  nowMs: number;
  onClose: () => void;
  onHighlight: () => void;
  onShare?: () => void;
  onDelete: () => void;
  onOpenProfile: (handleOrId: string) => void;
  /** YALNIZ __DEV__ vitrini / testler: ön dolu sonuç. */
  initial?: StoryViewersResult | null;
}) {
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const { t: tr, fmt } = useT();
  const { height: H } = useWindowDimensions();
  const reduced = useReducedMotion();
  const solid = useReduceTransparency();
  const [filter, setFilter] = useState<'all' | 'reacted'>('all');
  const [data, setData] = useState<StoryViewersResult | null>(initial ?? null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    getStoryClient()
      .getViewers({ story: story.id, filter: 'all' })
      .then(setData)
      .catch(() => setError(true));
  }, [story.id]);
  useEffect(() => {
    if (!initial) load();
  }, [load, initial]);

  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: reduced ? 200 : DURATION.slow, easing: CURVE.enter });
  }, [p, reduced]);
  const panel = useAnimatedStyle(() => (reduced ? { opacity: p.value } : { transform: [{ translateY: (1 - p.value) * H }] }));

  const rows = (data?.viewers ?? []).filter((r) => filter === 'all' || r.liked || r.reaction);
  const empty = data != null && data.views === 0;
  const hrs = hoursLeft(story.expires_at, nowMs);
  const bg = solid ? (t.isDark ? '#1C1C1E' : '#FFFFFF') : t.isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.97)';
  const actions = [
    { key: 'hl', label: tr('hikaye.highlight'), d: P_PLUS, fg: st.text, onPress: onHighlight },
    ...(onShare ? [{ key: 'share', label: tr('hikaye.share_story'), d: P_SHARE, fg: st.text, onPress: onShare }] : []),
    { key: 'del', label: tr('hikaye.del'), d: P_TRASH, fg: st.danger, onPress: onDelete },
  ];

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: st.bg }]} testID="story-viewers-sheet">
      <View style={styles.previewRow} importantForAccessibility="no-hide-descendants">
        <View style={[styles.preview, { borderColor: st.text }]}>
          <StoryCanvas w={132} h={234} mediaUri={previewUri} mediaType={story.media_type === 'video' ? 'image' : story.media_type} bg={story.bg} overlays={story.overlays} />
        </View>
      </View>
      <Animated.View accessibilityViewIsModal style={[styles.sheet, { top: 312, backgroundColor: bg, borderTopColor: st.edge, shadowOpacity: st.shadow }, panel]}>
        <View style={styles.handleRow}><View style={[styles.handle, { backgroundColor: st.line2 }]} /></View>
        <View style={styles.head}>
          <Svg width={22} height={22} viewBox="0 0 256 256"><Path d={P_EYE} fill={st.text} /></Svg>
          <Text accessibilityRole="header" style={[styles.title, { color: st.text }]}>{empty || !data ? tr('hikaye.no_views') : tr('hikaye.views', { n: fmt(data.views) })}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('hikaye.close')} style={styles.close44} testID="story-viewers-close">
            <View style={[styles.close32, { backgroundColor: st.closeBg }]}><Svg width={18} height={18} viewBox="0 0 256 256"><Path d={P_X} fill={st.text} /></Svg></View>
          </Pressable>
        </View>
        <View style={styles.note}>
          <Svg width={14} height={14} viewBox="0 0 256 256"><Path d={P_CLOCK} fill={st.sec} /></Svg>
          <Text style={[styles.noteT, { color: st.sec }]}>{hrs > 0 ? tr('hikaye.note24', { n: hrs }) : tr('hikaye.note_archive')}</Text>
        </View>
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable key={a.key} onPress={() => { haptic('selection'); a.onPress(); }} accessibilityRole="button" style={[styles.action, { backgroundColor: st.card, borderColor: st.line }]} testID={`story-viewers-${a.key}`}>
              <Svg width={22} height={22} viewBox="0 0 256 256"><Path d={a.d} fill={a.fg} /></Svg>
              <Text style={[styles.actionT, { color: a.fg }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 34 }}>
          {!data && !error ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
          {error ? (
            <Pressable onPress={load} accessibilityRole="button" style={styles.retry}>
              <Text style={[styles.emptyBody, { color: st.sec }]}>{tr('hikaye.load_failed')} {tr('hikaye.retry')}</Text>
            </Pressable>
          ) : null}
          {data && !empty ? (
            <>
              {data.stickers.length ? (
                <>
                  <Text accessibilityRole="header" style={[styles.h3, { color: st.sec }]}>{tr('hikaye.sticker_stats')}</Text>
                  <View style={[styles.card, { backgroundColor: st.card, borderColor: st.line }]}>
                    {data.stickers.map((s, i) => (
                      <View key={s.sticker_id} style={[styles.statRow, i > 0 && { borderTopWidth: 1, borderTopColor: st.line }]}>
                        <View style={[styles.statIcon, { backgroundColor: st.chip }]}>
                          <RNImage source={BOWL} style={{ width: 30, height: 30 }} resizeMode="contain" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.statT, { color: st.text }]} numberOfLines={1}>{s.kind === 'meal' ? tr('hikaye.meal_sticker') : s.label ?? ''}</Text>
                          <Text style={[styles.statS, { color: st.sec }]}>
                            {s.kind === 'meal' ? tr('hikaye.meal_stat', { taps: fmt(s.taps), adds: fmt(s.adds) }) : s.kind === 'poll' ? tr('hikaye.poll_stat', { n: fmt(s.votes) }) : tr('hikaye.tap_stat', { n: fmt(s.taps) })}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
              <View style={styles.filterRow}>
                <Text accessibilityRole="header" style={[styles.h3, { color: st.sec, marginTop: 0, marginBottom: 0 }]}>{tr('hikaye.viewers')}</Text>
                <View accessibilityRole="tablist" accessibilityLabel={tr('hikaye.filter')} style={{ flexDirection: 'row', gap: 6 }}>
                  {(['all', 'reacted'] as const).map((f) => {
                    const on = filter === f;
                    return (
                      <Pressable key={f} onPress={() => { haptic('selection'); setFilter(f); }} accessibilityRole="tab" accessibilityState={{ selected: on }} hitSlop={4} style={[styles.filter, on ? { backgroundColor: st.text } : { borderWidth: 1, borderColor: st.line2 }]} testID={`story-viewers-filter-${f}`}>
                        <Text style={[styles.filterT, { color: on ? st.bg : st.text }]}>{tr(f === 'all' ? 'hikaye.all' : 'hikaye.reacted')}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {rows.map((r) => (
                <View key={r.user_id} style={[styles.row, { borderBottomColor: st.line }]}>
                  <Pressable onPress={() => onOpenProfile(r.handle || r.user_id)} accessibilityRole="button" accessibilityLabel={`${r.display_name}${r.handle ? `, @${r.handle}` : ''}`} style={styles.rowMain}>
                    <View style={[styles.ava, { backgroundColor: st.ph }]}>
                      {r.avatar_url ? <CachedImage uri={r.avatar_url} style={{ width: 44, height: 44 }} /> : <Svg width={22} height={22} viewBox="0 0 256 256"><Path d={P_USER} fill={st.phIcon} /></Svg>}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.name, { color: st.text }]} numberOfLines={1}>{r.display_name || (r.handle ? `@${r.handle}` : '')}</Text>
                      {r.handle ? <Text style={[styles.handle2, { color: st.sec }]} numberOfLines={1}>@{r.handle}</Text> : null}
                    </View>
                  </Pressable>
                  {r.liked ? (
                    <View accessible accessibilityRole="image" accessibilityLabel={tr('hikaye.liked_a11y')}>
                      <Svg width={18} height={18} viewBox="0 0 256 256"><Path d={P_HEART_F} fill={HEART} /></Svg>
                    </View>
                  ) : null}
                  {r.reaction ? (
                    <View style={[styles.react, { backgroundColor: st.chip }]}><Text style={[styles.reactT, { color: st.text }]}>{tr(REACTION_KEY[r.reaction])}</Text></View>
                  ) : null}
                  <Pressable onPress={() => onOpenProfile(r.handle || r.user_id)} accessibilityRole="button" accessibilityLabel={tr('hikaye.row_more')} style={styles.close44}>
                    <Svg width={22} height={22} viewBox="0 0 256 256"><Path d={P_DOTS} fill={st.text} /></Svg>
                  </Pressable>
                </View>
              ))}
              {rows.length === 0 ? <Text style={[styles.noReacts, { color: st.sec }]}>{tr('hikaye.no_reacts')}</Text> : null}
            </>
          ) : null}
          {empty ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyArt}>
                <View style={[StyleSheet.absoluteFill, { borderRadius: 52, borderWidth: 2, borderColor: st.line2 }]} />
                <View style={[styles.emptyIn, { backgroundColor: st.card, borderColor: st.line }]}>
                  <Svg width={36} height={36} viewBox="0 0 256 256"><Path d={P_EYE} fill={st.sec} /></Svg>
                </View>
                <View style={styles.emptyDot} />
              </View>
              <Text style={[styles.emptyTitle, { color: st.text }]}>{tr('hikaye.empty_title')}</Text>
              <Text style={[styles.emptyBody, { color: st.sec }]}>{tr('hikaye.empty_body', { n: hrs })}</Text>
              {onShare ? (
                <Pressable onPress={onShare} accessibilityRole="button" style={styles.sendBtn}>
                  <Svg width={18} height={18} viewBox="0 0 256 256"><Path d={P_SEND} fill={LIME_INK} /></Svg>
                  <Text style={styles.sendT}>{tr('hikaye.send_story')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewRow: { position: 'absolute', left: 0, right: 0, top: 56, alignItems: 'center' },
  preview: { width: 132, height: 234, borderRadius: 14, overflow: 'hidden', borderWidth: 2 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, shadowColor: '#000', shadowRadius: 16, shadowOffset: { width: 0, height: -8 }, elevation: 12 },
  handleRow: { alignItems: 'center', paddingTop: 6 },
  handle: { width: 36, height: 5, borderRadius: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2, paddingRight: 8, paddingLeft: 20 },
  title: { flex: 1, fontFamily: fontFamily.headingBold, fontSize: 22 },
  close44: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  close32: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2, paddingHorizontal: 20 },
  noteT: { flex: 1, fontFamily: fontFamily.bodyRegular, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 4 },
  action: { flex: 1, minHeight: 64, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionT: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  h3: { marginTop: 6, marginBottom: 6, fontFamily: fontFamily.bodyBold, fontSize: 13 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  statRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 14 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statT: { fontFamily: fontFamily.bodySemibold, fontSize: 15 },
  statS: { fontFamily: fontFamily.bodyRegular, fontSize: 13 },
  filterRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  filter: { minHeight: 36, borderRadius: 18, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  filterT: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  rowMain: { flex: 1, minWidth: 0, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ava: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  handle2: { fontFamily: fontFamily.bodyRegular, fontSize: 13 },
  react: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  reactT: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  noReacts: { marginTop: 16, fontFamily: fontFamily.bodyRegular, fontSize: 14, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { paddingTop: 20, paddingHorizontal: 8, alignItems: 'center' },
  emptyArt: { width: 104, height: 104 },
  emptyIn: { position: 'absolute', left: 14, top: 14, right: 14, bottom: 14, borderRadius: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyDot: { position: 'absolute', right: 2, top: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: LIME },
  emptyTitle: { marginTop: 14, fontFamily: fontFamily.headingBold, fontSize: 19, textAlign: 'center' },
  emptyBody: { marginTop: 6, maxWidth: 300, fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  sendBtn: { marginTop: 16, minHeight: 48, borderRadius: 24, backgroundColor: LIME, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sendT: { fontFamily: fontFamily.bodyBold, fontSize: 15, color: LIME_INK },
});
