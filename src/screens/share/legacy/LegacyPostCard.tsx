// G15-S3 — DONDURULMUŞ KOPYA (night14/visual): yalnız `kesfet` KAPALIYKEN derin
// bağlantı ekranı (SharedPostScreen) bunu çizer → bayrak kapalı görünüm bayt bayt
// aynı kalır. Keşfet'teki güncel bileşen modules/kesfet/ui altında. G-TEMİZLİK'te silinir.
// Keşfet PostCard — tasarım Final FinFeed / FinSerbest / FinActivityCard /
// FinVideo. Avatar, yazar satırı (ad, doğrulama mührü, rol çipi, @handle · süre,
// ⋯ menü), metin, 1–4 görsel, MealCard ve aksiyon satırı. Aksiyon satırı
// etiketli + sayaçlı: "Beğen · N" · "Kaydet · N" · "Yorum · N" · "Paylaş · N".
//
// Hareket (G11-S3 + G12 FinMoLike): kart girişte sırayla akar (useFeedCardEnter);
// beğen/kaydet ikonu pop + sayaç yuvarlanması (useIconPop/useCountRoll), kaydet'te
// nokta izi (useDotBurst). ÇİFT DOKUNMA görselde → beğen + büyük kalp damgası
// (opaklık + yay ölçek, FinMoLike). Haptik: beğen/kaydet light. Azaltılmış harekete
// hook'lar uyar.
import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText, useTheme, SPRING, DURATION, CURVE, useReducedMotion, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Avatar } from './LegacyAvatar';
import { MediaGrid } from './LegacyMediaGrid';
import { MealCard, type LogOriginFrame } from './LegacyMealCard';
import { ActivityCard } from './LegacyActivityCard';
import { VerifiedBadge } from '../../../modules/kesfet/ui/VerifiedBadge';
import { Icon, type IconName } from '../../../modules/kesfet/ui/icons';
import { useFeedCardEnter, useIconPop, useDotBurst, useCountRoll } from '../../../modules/kesfet/motion';
import type { PostCardModel } from '../../../modules/kesfet/ui/format';

function Action({
  icon,
  color,
  label,
  count,
  fmtCount,
  withDot,
  dotColor,
  onPress,
}: {
  icon: IconName;
  color: string;
  label: string;
  count?: number;
  fmtCount?: (n: number) => string;
  withDot?: boolean;
  dotColor?: string;
  onPress: () => void;
}) {
  const pop = useIconPop();
  const dot = useDotBurst();
  const roll = useCountRoll(count ?? 0);
  // Final: ikon + "Etiket · N" (sayaç varsa). Sayaç yoksa yalnız etiket.
  const text = count != null ? `${label} · ${fmtCount ? fmtCount(count) : String(count)}` : label;
  return (
    <Pressable
      onPress={() => {
        pop.pop();
        if (withDot) dot.burst();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={text}
      hitSlop={8}
      style={styles.action}
    >
      <View>
        <Animated.View style={pop.style}>
          <Icon name={icon} size={18} color={color} />
        </Animated.View>
        {withDot ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.dot, { backgroundColor: dotColor ?? color }, dot.style]}
          />
        ) : null}
      </View>
      <Animated.View style={count != null ? roll.style : undefined}>
        <AppText variant="caption" tone="secondary" style={styles.actionLabel}>
          {text}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

export function PostCard({
  model,
  index = 0,
  isVisible = false,
  quickMealLabel,
  onLike,
  onSave,
  onShare,
  onQuickLog,
  onOpenSheet,
  onOpenMenu,
  onComment,
  onDidIt,
  showComment = false,
}: {
  model: PostCardModel;
  /** Akışta sıra — girişte ardışık animasyon için (en fazla 6 gecikir). */
  index?: number;
  /** Video otomatik oynatma/durdurma için — ekranda görünür mü (G8-S3). */
  isVisible?: boolean;
  /** Saate göre hızlı loglanacak öğünün etiketi (örn. "Öğle"). */
  quickMealLabel?: string;
  onLike: () => void;
  onSave: () => void;
  /** G25-S1 md.7 (A10): verilmezse (bayrak `paylasim_baglanti` kapalı) düğme çizilmez. */
  onShare?: () => void;
  /** Öğün kartında dokun = saate göre doğrudan logla (görsel karesiyle). */
  onQuickLog?: (frame: LogOriginFrame) => void;
  /** Öğün kartında ⌄ / uzun bas = porsiyon + öğün seçici. */
  onOpenSheet?: () => void;
  onOpenMenu: () => void;
  // G8 — `kesfet_yorum` açıkken yorum aksiyonu; etkinlik kartı için "Ben de yaptım".
  onComment?: () => void;
  onDidIt?: () => void;
  showComment?: boolean;
}) {
  const t = useTheme();
  const { t: tr, fmt } = useT();
  const enter = useFeedCardEnter(index);
  const reduced = useReducedMotion();

  // Çift dokunma kalp damgası (FinMoLike): opaklık 0→1→0 + yay ölçek 0.6→1→1.15.
  const heart = useSharedValue(0);
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.value,
    transform: [{ scale: reduced ? 1 : 0.6 + heart.value * 0.55 }],
  }));
  const lastTap = useRef(0);

  const like = () => {
    haptic('light');
    onLike();
  };
  const save = () => {
    haptic('light');
    onSave();
  };
  const burstHeart = () => {
    cancelAnimation(heart);
    heart.value = 0;
    heart.value = withSequence(
      reduced
        ? withTiming(1, { duration: DURATION.micro })
        : withSpring(1, SPRING.eat),
      withTiming(0, { duration: DURATION.standard, easing: CURVE.in }),
    );
  };
  // Görselde çift dokunma: 300 ms içinde ikinci dokunma → beğen (değilse) + damga.
  const onMediaTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      burstHeart();
      if (!model.me.liked) like();
      else haptic('light');
    } else {
      lastTap.current = now;
    }
  };

  const badgeLabel = model.badgeKey ? tr(`kesfet.ui.badge.${model.badgeKey}`) : null;

  return (
    <Animated.View style={[styles.article, { borderBottomColor: t.color.line }, enter.style]}>
      <View style={styles.row}>
        <Avatar name={model.authorName} url={model.avatarUrl} official={model.isOfficial} />
        <View style={styles.body}>
          {/* Yazar satırı */}
          <View style={styles.authorRow}>
            <AppText variant="caption" style={styles.name} numberOfLines={1}>
              {model.authorName}
            </AppText>
            {model.verified ? <VerifiedBadge size={16} /> : null}
            {badgeLabel ? (
              <View style={[styles.roleChip, { backgroundColor: t.color.line }]}>
                <AppText variant="caption" style={styles.roleChipText} numberOfLines={1}>
                  {badgeLabel}
                </AppText>
              </View>
            ) : null}
            <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.handle}>
              @{model.handle}
              {model.time ? ` · ${model.time}` : ''}
            </AppText>
            <Pressable
              onPress={onOpenMenu}
              accessibilityRole="button"
              accessibilityLabel={tr('kesfet.ui.a11y.post_menu')}
              hitSlop={8}
              style={styles.more}
            >
              <Icon name="more" size={18} color={t.color.secondary} />
            </Pressable>
          </View>

          {/* Pending etiketi — yalnız yazarına (İnceleniyor) */}
          {model.pending ? (
            <View style={[styles.pending, { borderColor: t.color.line }]}>
              <Icon name="clock" size={13} color={t.color.secondary} />
              <AppText variant="caption" tone="secondary" style={styles.pendingLabel}>
                {tr('kesfet.ui.reviewing_badge')}
              </AppText>
            </View>
          ) : null}

          {/* Metin — serbest sarar (dinamik yazı boyutunda kırılmasın diye clamp yok) */}
          {model.body ? (
            <AppText variant="body" style={styles.text}>
              {model.body}
            </AppText>
          ) : null}

          {/* Görseller — çift dokunma beğen + büyük kalp damgası */}
          {model.media.length > 0 ? (
            <Pressable onPress={onMediaTap} accessibilityRole="imagebutton" accessibilityLabel={tr('kesfet.ui.a11y.like')}>
              <View>
                <MediaGrid media={model.media} postId={model.id} isVisible={isVisible} />
                <Animated.View pointerEvents="none" style={[styles.heartOverlay, heartStyle]}>
                  <Icon name="heartFill" size={88} color={t.color.accentLine} />
                </Animated.View>
              </View>
            </Pressable>
          ) : null}

          {/* Öğün kartı */}
          {model.meal ? (
            <MealCard
              meal={model.meal}
              loggedCount={model.stats.adds}
              quickMealLabel={quickMealLabel ?? ''}
              onQuickLog={(frame) => onQuickLog?.(frame)}
              onOpenSheet={() => onOpenSheet?.()}
            />
          ) : null}

          {/* Etkinlik kartı */}
          {model.postType === 'etkinlik' && model.activity ? (
            <ActivityCard activity={model.activity} didItCount={model.stats.did_it} onDidIt={onDidIt} />
          ) : null}

          {/* Aksiyon satırı: Beğen · Kaydet · (Yorum) · Paylaş — hepsi etiketli */}
          <View style={styles.actions}>
            <Action
              icon={model.me.liked ? 'heartFill' : 'heart'}
              color={model.me.liked ? t.color.accentLine : t.color.secondary}
              label={tr('kesfet.ui.a11y.like')}
              count={model.stats.likes}
              fmtCount={(n) => fmt(n)}
              onPress={like}
            />
            <Action
              icon={model.me.saved ? 'bookmarkFill' : 'bookmark'}
              color={model.me.saved ? t.color.accentLine : t.color.secondary}
              label={tr('kesfet.ui.a11y.save')}
              count={model.stats.saves}
              fmtCount={(n) => fmt(n)}
              withDot
              dotColor={t.color.accentLine}
              onPress={save}
            />
            {showComment && onComment ? (
              <Action
                icon="chat"
                color={t.color.secondary}
                label={tr('kesfet.ui.a11y.comment')}
                count={model.stats.comments}
                fmtCount={(n) => fmt(n)}
                onPress={onComment}
              />
            ) : null}
            {onShare ? (
              <Action
                icon="share"
                color={t.color.secondary}
                label={tr('kesfet.ui.a11y.share')}
                onPress={onShare}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  article: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', gap: 12 },
  body: { flex: 1, minWidth: 0 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontWeight: '700', flexShrink: 1 },
  roleChip: { minHeight: 20, paddingHorizontal: 8, borderRadius: 10, justifyContent: 'center' },
  roleChipText: { fontWeight: '700', fontSize: 13 },
  handle: { flexShrink: 1 },
  more: { marginLeft: 'auto', minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  text: { marginTop: 2, fontSize: 15, lineHeight: 22 },
  pending: { alignSelf: 'flex-start', marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  pendingLabel: {},
  heartOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  actions: { marginTop: 4, flexDirection: 'row', gap: 20 },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionLabel: { fontSize: 13 },
  dot: { position: 'absolute', top: -2, right: -4, width: 6, height: 6, borderRadius: 3 },
});
