// G62-S1 — FinEkRateSheet: siparişi değerlendir (boş / dolu / gönderildi).
//
// Kaynak: docs/g62/design/FinEkRateSheet.dc.html — birebir ölçüler: başlık bloğu 18 köşe iç yüzey,
// yıldız 32 pt (dokunma 52×48, role=radio), yorum alanı ≥ 88 pt / 16 köşe, fotoğraf 72 / 14 köşe + 44 pt kaldır,
// Gönder 52 / 26 köşe, onay dairesi 72 lime + ✓ 36. Renkler tasarımın açık/koyu değerleri; lime = #B9EF14 jetonu
// (tasarımdaki eski açık lime jetona çevrildi).
// Hareket: Sheet 'eat' (200/28 yayı); yıldız dokunuşu 0,9 → 1 eatkcal yayı + seçim haptiği; onaya geçiş 220 ms
// opaklık + daire 0,6 → 1 yay + success haptiği. Azaltılmış harekette ölçek yok, yalnız 200 ms opaklık.
// Tasarımda olmayan ama brifte istenen iki bölüm aynı bileşen dilinde (iç yüzey kartı, 44 pt düğmeler): ürün
// bazında beğendim/beğenmedim + etiketler (v1 ürün oyu korunur) ve düşük puanda (≤ 2) "Bir sorun mu vardı?".
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { Sheet, SPRING, fontFamily, haptic, useReducedMotion } from '../../../../../core/design';
import { CameraIcon as Camera, Check, Headset, Star, ThumbsDown, ThumbsUp, X } from '../../../../../components/icons';
import {
  COMMENT_MAX,
  EMPTY_DIMS,
  ITEM_TAGS,
  RATE_DIMS,
  isComplete,
  isLowRating,
  toggleTag,
  toggleVote,
  type ItemTag,
  type ItemVotes,
  type RateDim,
  type RateDims,
} from '../../model/orderRate';
import type { RatePromptOrder, SubmitResult } from '../../model/orderRateData';
import { useEk } from '../kit';

/** Tasarımın renkleri (FinEkRateSheet `c`) — tema jetonlarıyla eşlenmiş; jetonu olmayanlar tasarımdan. */
export function rateColors(isDark: boolean, c: ReturnType<typeof useEk>['c']) {
  return isDark
    ? { nested: c.surfaceRaised, secN: '#A1A1A6', line2: '#48484A', starOff: '#8E8E93', starLine: c.accent, dis: '#2C2C2E', disText: '#A1A1A6', focus: c.accent }
    : { nested: c.bg, secN: '#5C5C61', line2: '#C3C7CC', starOff: c.secondary, starLine: c.ink, dis: '#DCDEE2', disText: '#45454A', focus: c.accentLine };
}

export interface OrderRateDeps {
  submit: (input: { orderId: number; dims: RateDims; comment: string; photoPath: string | null; votes: ItemVotes }) => Promise<SubmitResult>;
  upload: (localUri: string, orderId: number) => Promise<string | null>;
  pickPhoto: () => Promise<string | null>;
}

export interface OrderRateInitial {
  dims?: RateDims;
  comment?: string;
  photoUri?: string | null;
  votes?: ItemVotes;
  sent?: boolean;
}

export function OrderRateSheet({
  visible,
  order,
  dateLabel,
  onClose,
  onSent,
  onSupport,
  deps,
  initial,
  productImage,
}: {
  visible: boolean;
  order: RatePromptOrder;
  /** "18 Kasım 2026" — çağıran biçimlendirir. */
  dateLabel: string;
  onClose: () => void;
  /** Başarılı gönderimden hemen sonra (istem gizlenir, analitik). */
  onSent: (res: Extract<SubmitResult, { ok: true }>) => void;
  /** Düşük puan → mevcut destek girişi. */
  onSupport: () => void;
  deps: OrderRateDeps;
  /** Vitrin/test: dolu ya da gönderildi hâliyle açmak için. */
  initial?: OrderRateInitial;
  productImage?: (productId: string) => string | null;
}) {
  const { c, t, theme } = useEk();
  const rc = rateColors(theme.isDark, c);
  const [dims, setDims] = useState<RateDims>(initial?.dims ?? EMPTY_DIMS);
  const [pop, setPop] = useState<RateDim | null>(null);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(initial?.photoUri ?? null);
  const [votes, setVotes] = useState<ItemVotes>(initial?.votes ?? {});
  const [sent, setSent] = useState(!!initial?.sent);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Her yeni sipariş / açılışta temiz form.
  useEffect(() => {
    if (!visible) return;
    setDims(initial?.dims ?? EMPTY_DIMS);
    setComment(initial?.comment ?? '');
    setPhotoUri(initial?.photoUri ?? null);
    setVotes(initial?.votes ?? {});
    setSent(!!initial?.sent);
    setError('');
    setSending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, order.id]);

  const ok = isComplete(dims);
  const low = isLowRating(dims);

  const pick = useCallback((dim: RateDim, n: number) => {
    haptic('selection');
    setPop(dim);
    setDims((d) => ({ ...d, [dim]: n }));
  }, []);

  const addPhoto = useCallback(async () => {
    setError('');
    const uri = await deps.pickPhoto().catch(() => null);
    if (uri) setPhotoUri(uri);
  }, [deps]);

  const send = useCallback(async () => {
    if (!ok || sending) {
      if (!ok) {
        haptic('warning');
        AccessibilityInfo.announceForAccessibility?.(t('order_rate.need_all'));
      }
      return;
    }
    setSending(true);
    setError('');
    let photoPath: string | null = null;
    if (photoUri) {
      photoPath = await deps.upload(photoUri, order.id);
      if (!photoPath) {
        setSending(false);
        setError(t('order_rate.photo_error'));
        haptic('warning');
        return;
      }
    }
    const res = await deps.submit({ orderId: order.id, dims, comment, photoPath, votes });
    setSending(false);
    if (!res.ok) {
      haptic('warning');
      setError(t(res.error === 'already_rated' ? 'order_rate.err_already' : res.error === 'expired' ? 'order_rate.err_expired' : 'order_rate.err_generic'));
      return;
    }
    haptic('success');
    setSent(true);
    onSent(res);
    AccessibilityInfo.announceForAccessibility?.(t('order_rate.thanks'));
  }, [ok, sending, photoUri, deps, order.id, dims, comment, votes, onSent, t]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('order_rate.title')} product="eat" scroll testID="order-rate-sheet">
      <Text style={[styles.sub, { color: c.secondary }]} testID="order-rate-sub">
        {t('order_rate.sub', { store: t('order_rate.store'), date: dateLabel })}
      </Text>
      {sent ? (
        <SentView dims={dims} low={low} onDone={onClose} onSupport={onSupport} rc={rc} />
      ) : (
        <View style={styles.form}>
          {RATE_DIMS.map((dim) => (
            <DimRow key={dim} dim={dim} value={dims[dim]} popping={pop === dim} onPick={pick} rc={rc} />
          ))}

          {order.items.length > 0 ? (
            <ItemsBlock order={order} votes={votes} setVotes={setVotes} rc={rc} productImage={productImage} />
          ) : null}

          <View style={styles.commentWrap}>
            <Text style={[styles.label, { color: c.ink }]}>
              {t('order_rate.comment')} <Text style={[styles.labelOpt, { color: c.secondary }]}>{t('order_rate.optional')}</Text>
            </Text>
            <TextInput
              value={comment}
              onChangeText={(v) => setComment(v.slice(0, COMMENT_MAX))}
              maxLength={COMMENT_MAX}
              multiline
              placeholder={t('order_rate.comment_ph')}
              placeholderTextColor={c.secondary}
              accessibilityLabel={`${t('order_rate.comment')} ${t('order_rate.optional')}`}
              accessibilityHint={t('order_rate.comment_ph')}
              selectionColor={rc.focus}
              testID="order-rate-comment"
              style={[styles.input, { backgroundColor: rc.nested, color: c.ink, borderColor: c.line }]}
            />
          </View>

          <View style={styles.photoRow}>
            {photoUri ? (
              <View style={styles.thumbWrap} testID="order-rate-photo">
                <Image source={{ uri: photoUri }} style={styles.thumb} accessibilityLabel={t('order_rate.photo_alt')} accessibilityRole="image" />
                <Pressable
                  onPress={() => {
                    haptic('selection');
                    setPhotoUri(null);
                    setError('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('order_rate.remove_photo')}
                  style={styles.thumbX}
                  testID="order-rate-photo-remove"
                >
                  <View style={[styles.thumbXDot, { borderColor: c.surface }]}>
                    <X size={12} color="#FFFFFF" weight="bold" />
                  </View>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              onPress={addPhoto}
              accessibilityRole="button"
              testID="order-rate-photo-add"
              style={({ pressed }) => [styles.photoBtn, { borderColor: rc.line2 }, pressed && { opacity: 0.85 }]}
            >
              <Camera size={20} color={c.ink} />
              <Text style={[styles.photoBtnText, { color: c.ink }]}>{t(photoUri ? 'order_rate.change_photo' : 'order_rate.add_photo')}</Text>
            </Pressable>
          </View>

          <View style={styles.sendWrap}>
            <Pressable
              onPress={send}
              accessibilityRole="button"
              accessibilityState={{ disabled: !ok, busy: sending }}
              accessibilityLabel={t('order_rate.send')}
              testID="order-rate-send"
              style={({ pressed }) => [styles.send, { backgroundColor: ok ? c.ink : rc.dis }, pressed && ok && { opacity: 0.85 }]}
            >
              <Text style={[styles.sendText, { color: ok ? c.surface : rc.disText }]}>
                {t(sending ? 'order_rate.sending' : 'order_rate.send')}
              </Text>
            </Pressable>
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.hint, { color: error ? c.ink : c.secondary }]}
              testID="order-rate-hint"
            >
              {error || (ok ? '' : t('order_rate.need_all'))}
            </Text>
          </View>
        </View>
      )}
    </Sheet>
  );
}

// ── Başlık (Teslimat / Kalori uyumu / Lezzet) ─────────────────────────────
function DimRow({
  dim,
  value,
  popping,
  onPick,
  rc,
}: {
  dim: RateDim;
  value: number;
  popping: boolean;
  onPick: (dim: RateDim, n: number) => void;
  rc: ReturnType<typeof rateColors>;
}) {
  const { c, t } = useEk();
  const name = t(`order_rate.dim_${dim}`);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('order_rate.dim_a11y', { dim: name })}
      style={[styles.dim, { backgroundColor: rc.nested }]}
      testID={`order-rate-dim-${dim}`}
    >
      <View style={styles.dimHead}>
        <Text style={[styles.dimTitle, { color: c.ink }]} numberOfLines={2}>{name}</Text>
        <Text style={[styles.dimHint, { color: rc.secN }]} numberOfLines={1}>
          {value ? t(`order_rate.word_${value}`) : t('order_rate.not_rated')}
        </Text>
      </View>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <StarButton key={n} n={n} on={value >= n} checked={value === n} pop={popping && value >= n} onPress={() => onPick(dim, n)} rc={rc} testID={`order-rate-${dim}-${n}`} />
        ))}
      </View>
    </View>
  );
}

function StarButton({
  n,
  on,
  checked,
  pop,
  onPress,
  rc,
  testID,
}: {
  n: number;
  on: boolean;
  checked: boolean;
  pop: boolean;
  onPress: () => void;
  rc: ReturnType<typeof rateColors>;
  testID: string;
}) {
  const { c, t } = useEk();
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!pop || reduced) return;
    // FinEkRateSheet .starPop: 0,9 → 1, eatkcal yayı.
    s.value = 0.9;
    s.value = withSpring(1, SPRING.eat);
  }, [pop, on, reduced, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={t(n === 1 ? 'order_rate.star_one' : 'order_rate.star_other', { n })}
      style={styles.starBtn}
      testID={testID}
    >
      <Animated.View style={[styles.star, style]}>
        {on ? (
          <>
            <Star size={32} color={c.accent} weight="fill" style={StyleSheet.absoluteFill} />
            <Star size={32} color={rc.starLine} weight="regular" style={StyleSheet.absoluteFill} />
          </>
        ) : (
          <Star size={32} color={rc.starOff} weight="regular" />
        )}
      </Animated.View>
    </Pressable>
  );
}

// ── Ürün bazında beğendim / beğenmedim + etiketler ─────────────────────────
function ItemsBlock({
  order,
  votes,
  setVotes,
  rc,
  productImage,
}: {
  order: RatePromptOrder;
  votes: ItemVotes;
  setVotes: React.Dispatch<React.SetStateAction<ItemVotes>>;
  rc: ReturnType<typeof rateColors>;
  productImage?: (productId: string) => string | null;
}) {
  const { c, t } = useEk();
  return (
    <View style={[styles.dim, styles.items, { backgroundColor: rc.nested }]} testID="order-rate-items">
      <View style={styles.dimHead}>
        <Text style={[styles.dimTitle, { color: c.ink }]} accessibilityRole="header">{t('order_rate.items_title')}</Text>
      </View>
      <Text style={[styles.dimHint, { color: rc.secN }]}>{t('order_rate.items_hint')}</Text>
      {order.items.map((it) => {
        const v = votes[it.productId];
        const img = productImage?.(String(it.productId)) ?? null;
        const tags: readonly ItemTag[] = v ? (v.liked ? ITEM_TAGS.liked : ITEM_TAGS.disliked) : [];
        return (
          <View key={it.productId} style={styles.itemBlock} testID={`order-rate-item-${it.productId}`}>
            <View style={styles.itemRow}>
              {img ? <Image source={{ uri: img }} style={styles.itemImg} accessibilityIgnoresInvertColors /> : null}
              <Text style={[styles.itemName, { color: c.ink }]} numberOfLines={2}>{it.name}</Text>
              <VoteButton
                active={v?.liked === true}
                kind="like"
                label={t('order_rate.like_a11y', { name: it.name })}
                onPress={() => setVotes((p) => toggleVote(p, it.productId, true))}
                testID={`order-rate-like-${it.productId}`}
              />
              <VoteButton
                active={v?.liked === false}
                kind="dislike"
                label={t('order_rate.dislike_a11y', { name: it.name })}
                onPress={() => setVotes((p) => toggleVote(p, it.productId, false))}
                testID={`order-rate-dislike-${it.productId}`}
              />
            </View>
            {v ? (
              <View style={styles.tags} accessibilityLabel={t('order_rate.tags_a11y', { name: it.name })}>
                {tags.map((tag) => {
                  const sel = v.tags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => {
                        haptic('selection');
                        setVotes((p) => toggleTag(p, it.productId, tag));
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: sel }}
                      style={[styles.tag, sel ? { backgroundColor: c.ink, borderColor: c.ink } : { backgroundColor: c.surface, borderColor: c.line }]}
                      testID={`order-rate-tag-${it.productId}-${tag}`}
                    >
                      <Text style={[styles.tagText, { color: sel ? c.surface : c.ink }]}>{t(`order_rate.tag_${tag}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function VoteButton({ active, kind, label, onPress, testID }: { active: boolean; kind: 'like' | 'dislike'; label: string; onPress: () => void; testID: string }) {
  const { c } = useEk();
  const Icon = kind === 'like' ? ThumbsUp : ThumbsDown;
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.vote, active ? { backgroundColor: kind === 'like' ? c.accent : c.ink } : { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1 }]}
      testID={testID}
    >
      <Icon size={20} color={active ? (kind === 'like' ? c.onAccent : c.surface) : c.ink} weight={active ? 'fill' : 'regular'} />
    </Pressable>
  );
}

// ── Gönderildi ─────────────────────────────────────────────────────────────
function SentView({
  dims,
  low,
  onDone,
  onSupport,
  rc,
}: {
  dims: RateDims;
  low: boolean;
  onDone: () => void;
  onSupport: () => void;
  rc: ReturnType<typeof rateColors>;
}) {
  const { c, t } = useEk();
  const reduced = useReducedMotion();
  const fade = useSharedValue(0);
  const scale = useSharedValue(reduced ? 1 : 0.6);
  useEffect(() => {
    fade.value = withTiming(1, { duration: reduced ? 200 : 220 });
    if (!reduced) scale.value = withSpring(1, SPRING.eat);
  }, [fade, scale, reduced]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const okStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const summary = useMemo(() => RATE_DIMS.map((d) => ({ d, v: `${dims[d]} / 5` })), [dims]);
  return (
    <Animated.View style={[styles.sent, fadeStyle]} accessibilityLiveRegion="polite" testID="order-rate-sent">
      <Animated.View style={[styles.okDot, { backgroundColor: c.accent }, okStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Check size={36} color={c.onAccent} weight="bold" />
      </Animated.View>
      <Text style={[styles.thanks, { color: c.ink }]} accessibilityRole="header">{t('order_rate.thanks')}</Text>
      <Text style={[styles.sentBody, { color: c.secondary }]}>{t('order_rate.sent_body')}</Text>
      <View style={[styles.summary, { backgroundColor: rc.nested }]} testID="order-rate-summary">
        {summary.map((m) => (
          <View key={m.d} style={styles.sumRow} accessible accessibilityLabel={`${t(`order_rate.dim_${m.d}`)} ${m.v}`}>
            <Text style={[styles.sumKey, { color: rc.secN }]}>{t(`order_rate.dim_${m.d}`)}</Text>
            <Text style={[styles.sumVal, { color: c.ink }]}>{m.v}</Text>
          </View>
        ))}
      </View>
      {low ? (
        <View style={[styles.low, { backgroundColor: rc.nested }]} testID="order-rate-low">
          <Text style={[styles.dimTitle, { color: c.ink }]} accessibilityRole="header">{t('order_rate.low_title')}</Text>
          <Text style={[styles.dimHint, { color: rc.secN }]}>{t('order_rate.low_body')}</Text>
          <Pressable
            onPress={onSupport}
            accessibilityRole="button"
            testID="order-rate-support"
            style={({ pressed }) => [styles.photoBtn, styles.lowBtn, { borderColor: rc.line2 }, pressed && { opacity: 0.85 }]}
          >
            <Headset size={20} color={c.ink} />
            <Text style={[styles.photoBtnText, { color: c.ink }]}>{t('order_rate.low_cta')}</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        testID="order-rate-done"
        style={({ pressed }) => [styles.send, styles.done, { backgroundColor: c.ink }, pressed && { opacity: 0.85 }]}
      >
        <Text style={[styles.sendText, { color: c.surface }]}>{t('order_rate.done')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 17, marginTop: -4, marginBottom: 14 },
  form: { gap: 14 },
  dim: { borderRadius: 18, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 6, gap: 2 },
  dimHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  dimTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  dimHint: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 17 },
  stars: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -6 },
  starBtn: { width: 52, height: 48, alignItems: 'center', justifyContent: 'center' },
  star: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  items: { paddingBottom: 12, gap: 8 },
  itemBlock: { gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemImg: { width: 40, height: 40, borderRadius: 10 },
  itemName: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 15, lineHeight: 20 },
  vote: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  tagText: { fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 17 },
  commentWrap: { gap: 6 },
  label: { fontFamily: fontFamily.bodySemibold, fontSize: 14, lineHeight: 19 },
  labelOpt: { fontFamily: fontFamily.bodyMedium, fontSize: 14 },
  input: {
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  thumbWrap: { width: 72, height: 72 },
  thumb: { width: 72, height: 72, borderRadius: 14 },
  thumbX: { position: 'absolute', right: -14, top: -14, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  thumbXDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  photoBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoBtnText: { fontFamily: fontFamily.bodySemibold, fontSize: 14, lineHeight: 19, flexShrink: 1 },
  sendWrap: { gap: 8, marginTop: 2 },
  send: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  sendText: { fontFamily: fontFamily.headingBold, fontSize: 17, lineHeight: 22 },
  hint: { minHeight: 18, fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 17, textAlign: 'center' },
  sent: { alignItems: 'center', gap: 12, paddingTop: 24, paddingHorizontal: 8, paddingBottom: 8 },
  okDot: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  thanks: { fontFamily: fontFamily.headingBold, fontSize: 24, lineHeight: 29, textAlign: 'center' },
  sentBody: { maxWidth: 300, fontFamily: fontFamily.bodyRegular, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  summary: { alignSelf: 'stretch', marginTop: 4, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, gap: 4 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  sumKey: { fontFamily: fontFamily.bodyMedium, fontSize: 14, lineHeight: 19, flexShrink: 1 },
  sumVal: { fontFamily: fontFamily.bodySemibold, fontSize: 14, lineHeight: 19, fontVariant: ['tabular-nums'] },
  low: { alignSelf: 'stretch', borderRadius: 18, padding: 12, gap: 6 },
  lowBtn: { alignSelf: 'flex-start', marginTop: 4 },
  done: { alignSelf: 'stretch', marginTop: 8 },
});
