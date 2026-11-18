// G63-S1 — Sohbet balonları (docs/g63/design/FinChat.dc.html). Ölçüler birebir: balon en çok 280, iç boşluk 10/14,
// köşe 20 + kuyruk köşesi 6 (gelen sol alt, giden sağ alt; ardışık balonlarda bitişik köşe 6), gelen = kart + 1 iç
// çizgi (koyuda çizgisiz), giden = lime + mürekkep; gönderi kartı 268 (yazar 28, metin 14, görsel 120 / 12 köşe,
// çipler 22); öğün kartı 260 (görsel 64 / 14 köşe, cam kase); hikâye yanıtı = 12 ikincil etiket + 3 pt çizgi;
// gün çipi 26 / 13 köşe; "yazıyor" 40 pt balon + 3 × 7 pt nokta (990 ms döngü, 110 ms arayla).
// Hareket: yeni balon 330 ms enter (8 pt yukarı + 0,96 → 1); azaltılmış harekette 220 ms doğrusal opaklık,
// yazıyor noktaları sabit 0,6 opaklık.
import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../core/design/components/FinText';
import { RN_CURVE, DURATION, REDUCED, fontFamily, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import type { FeedPost } from '../../kesfet/types';
import type { DmMessage } from '../types';
import { INK, LIME, type DmPalette } from './parts';

const BOWL = require('../../../../assets/glass/bowl.png');

export function bubbleRadius(mine: boolean, first: boolean, last: boolean) {
  const R = 20;
  const S = 6;
  return mine
    ? { borderTopLeftRadius: R, borderBottomLeftRadius: R, borderTopRightRadius: first ? R : S, borderBottomRightRadius: S }
    : { borderTopRightRadius: R, borderBottomRightRadius: R, borderTopLeftRadius: first ? R : S, borderBottomLeftRadius: last ? S : S };
}

/** Yeni gelen/gönderilen balonun girişi (FinChat `.msgIn`). İlk yüklemede animasyon yok. */
export function MsgIn({ animate, mine, children }: { animate: boolean; mine: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    Animated.timing(v, {
      toValue: 1,
      duration: reduced ? REDUCED.duration : DURATION.base,
      easing: reduced ? RN_CURVE.linear : RN_CURVE.enter,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = reduced
    ? { opacity: v }
    : {
        opacity: v,
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      };
  return <Animated.View style={[{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '100%' }, style]}>{children}</Animated.View>;
}

export function TextBubble({ m, c, first, last }: { m: DmMessage; c: DmPalette; first: boolean; last: boolean }) {
  const mine = m.mine;
  return (
    <View
      style={[
        styles.bubble,
        bubbleRadius(mine, first, last),
        mine
          ? { backgroundColor: LIME }
          : { backgroundColor: c.card, borderWidth: c.inLine === 'transparent' ? 0 : 1, borderColor: c.inLine },
        m.local === 'sending' || m.local === 'failed' ? { opacity: 0.6 } : null,
      ]}
    >
      <Text style={[styles.body, { color: mine ? INK : c.text }]} selectable>
        {m.body}
      </Text>
    </View>
  );
}

export function PostBubble({
  m,
  c,
  post,
  first,
  last,
  onOpen,
}: {
  m: DmMessage;
  c: DmPalette;
  post: FeedPost | null | undefined;
  first: boolean;
  last: boolean;
  onOpen: () => void;
}) {
  const { t: tr } = useT();
  const gone = post === null;
  const img = post?.media?.find((x) => !x.kind || x.kind === 'image')?.url ?? post?.meal_card?.photo_url ?? null;
  const name = post?.author.display_name ?? '';
  const text = post?.body ?? '';
  return (
    <View style={{ alignItems: m.mine ? 'flex-end' : 'flex-start', gap: 6 }}>
      <Pressable
        onPress={gone ? undefined : onOpen}
        disabled={gone}
        accessibilityRole={gone ? 'text' : 'link'}
        accessibilityLabel={gone ? tr('dm.chat.post_gone') : tr('dm.chat.post_a11y', { name, text })}
        style={[styles.postCard, bubbleRadius(m.mine, first, last && !m.body), { backgroundColor: c.card, borderColor: c.line }]}
      >
        {gone ? (
          <Text style={[styles.sub13, { color: c.sec }]}>{tr('dm.chat.post_gone')}</Text>
        ) : (
          <>
            <View style={styles.postHead}>
              <View style={[styles.postAvatar, { backgroundColor: c.ph }]}>
                {post?.author.avatar_url ? <Image source={{ uri: post.author.avatar_url }} style={styles.postAvatar} /> : null}
              </View>
              <Text style={[styles.postName, { color: c.text }]} numberOfLines={1}>
                {name || tr('dm.chat.post')}
              </Text>
              {post?.author.handle ? (
                <Text style={[styles.sub13, { color: c.sec, flexShrink: 1 }]} numberOfLines={1}>
                  @{post.author.handle}
                </Text>
              ) : null}
            </View>
            {text ? (
              <Text style={[styles.postText, { color: c.text }]} numberOfLines={3}>
                {text}
              </Text>
            ) : null}
            {img ? <Image source={{ uri: img }} style={styles.postImg} accessibilityIgnoresInvertColors /> : null}
            {post?.meal_card ? (
              <View style={styles.chips}>
                <View style={[styles.chip, { backgroundColor: c.chip }]}>
                  <Text style={[styles.chipText, { color: c.text }]}>{Math.round(post.meal_card.kcal)} kcal</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: c.chip }]}>
                  <Text style={[styles.chipText, { color: c.text }]}>P {Math.round(post.meal_card.protein_g)} g</Text>
                </View>
              </View>
            ) : null}
          </>
        )}
      </Pressable>
      {m.body ? <TextBubble m={m} c={c} first={false} last={last} /> : null}
    </View>
  );
}

export function MealBubble({ m, c, first, last }: { m: DmMessage; c: DmPalette; first: boolean; last: boolean }) {
  const { t: tr } = useT();
  const r = m.ref ?? {};
  return (
    <View style={{ alignItems: m.mine ? 'flex-end' : 'flex-start', gap: 6 }}>
      <View
        accessible
        accessibilityLabel={`${tr('dm.chat.meal')}: ${r.name ?? ''}${r.kcal != null ? `, ${r.kcal} kcal` : ''}`}
        style={[styles.mealCard, bubbleRadius(m.mine, first, last && !m.body), { backgroundColor: c.card, borderColor: c.line }]}
      >
        <View style={[styles.mealThumb, { backgroundColor: c.thumbBg }]}>
          <Image source={BOWL} style={{ width: 56, height: 56 }} resizeMode="contain" />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={[styles.cardLabel, { color: c.sec }]}>{tr('dm.chat.meal')}</Text>
          <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
            {r.name}
          </Text>
          <View style={styles.chips}>
            {r.kcal != null ? (
              <View style={[styles.chip, { backgroundColor: c.chip }]}>
                <Text style={[styles.chipText, { color: c.text }]}>{r.kcal} kcal</Text>
              </View>
            ) : null}
            {r.protein_g != null ? (
              <View style={[styles.chip, { backgroundColor: c.chip }]}>
                <Text style={[styles.chipText, { color: c.text }]}>P {r.protein_g} g</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      {m.body ? <TextBubble m={m} c={c} first={false} last={last} /> : null}
    </View>
  );
}

export function StoryReplyBubble({ m, c, first, last }: { m: DmMessage; c: DmPalette; first: boolean; last: boolean }) {
  const { t: tr } = useT();
  return (
    <View style={{ alignItems: m.mine ? 'flex-end' : 'flex-start', gap: 4 }}>
      <Text style={[styles.cardLabel, { color: c.sec, fontFamily: fontFamily.bodyRegular }]}>
        {m.mine ? tr('dm.chat.story_reply_mine') : tr('dm.chat.story_reply_theirs')}
      </Text>
      <View style={{ flexDirection: m.mine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
        <View style={[styles.storyBar, { backgroundColor: c.line2 }]} />
        {m.ref?.thumb_url ? (
          <Image source={{ uri: m.ref.thumb_url }} style={styles.storyThumb} accessibilityLabel={tr('dm.chat.story_alt')} />
        ) : null}
      </View>
      <TextBubble m={m} c={c} first={first} last={last} />
    </View>
  );
}

export function DayChip({ label, c }: { label: string; c: DmPalette }) {
  return (
    <View style={[styles.dayChip, { backgroundColor: c.chip }]}>
      <Text style={[styles.dayChipText, { color: c.sec }]}>{label}</Text>
    </View>
  );
}

export function TypingBubble({ c, label }: { c: DmPalette; label: string }) {
  const reduced = useReducedMotion();
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    if (reduced) return;
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * DURATION.instant),
          Animated.timing(d, { toValue: 1, duration: DURATION.base, easing: RN_CURVE.standard, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: DURATION.base, easing: RN_CURVE.standard, useNativeDriver: true }),
          Animated.delay(DURATION.story - DURATION.base - DURATION.base - i * DURATION.instant),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return (
    <MsgIn animate mine={false}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={label}
        accessibilityLiveRegion="polite"
        style={[styles.typing, bubbleRadius(false, true, true), { backgroundColor: c.card, borderWidth: c.inLine === 'transparent' ? 0 : 1, borderColor: c.inLine }]}
        testID="dm-typing"
      >
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={[
              styles.tdot,
              { backgroundColor: c.sec },
              reduced
                ? { opacity: 0.6 }
                : { opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] },
            ]}
          />
        ))}
      </View>
    </MsgIn>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: 280, paddingVertical: 10, paddingHorizontal: 14 },
  body: { fontSize: 15, lineHeight: 21 },
  sub13: { fontSize: 13 },
  postCard: { width: 268, padding: 12, borderWidth: 1, gap: 8, overflow: 'hidden' },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  postAvatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden' },
  postName: { fontFamily: fontFamily.bodyBold, fontSize: 14, flexShrink: 1 },
  postText: { fontSize: 14, lineHeight: 20 },
  postImg: { width: '100%', height: 120, borderRadius: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { minHeight: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: 'center' },
  chipText: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  mealCard: { width: 260, padding: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  mealThumb: { width: 64, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  cardTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 19 },
  storyBar: { width: 3, height: 56, borderRadius: 2 },
  storyThumb: { width: 68, height: 112, borderRadius: 12 },
  dayChip: { alignSelf: 'center', marginTop: 2, marginBottom: 8, minHeight: 26, paddingHorizontal: 12, borderRadius: 13, justifyContent: 'center' },
  dayChipText: { fontFamily: fontFamily.bodySemibold, fontSize: 12 },
  typing: { height: 40, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 5 },
  tdot: { width: 7, height: 7, borderRadius: 4 },
});
