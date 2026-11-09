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
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText, fontFamily, useTheme, SPRING, DURATION, CURVE, useReducedMotion, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Avatar } from './Avatar';
import { MediaGrid } from './MediaGrid';
import { PlateMedia } from './PlateMedia';
import { MealCard, type LogOriginFrame } from './MealCard';
import { ActivityCard } from './ActivityCard';
import { VerifiedBadge } from './VerifiedBadge';
import { Icon, type IconName } from './icons';
import { useFeedCardEnter, useIconPop, useDotBurst, useCountRoll } from '../motion';
import type { PostCardModel } from './format';
import type { MealType } from '../types';

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
  // Final (G15): ikon + yalnız sayı; etiket erişilebilirlik adında ("Beğen · N").
  const num = count != null ? (fmtCount ? fmtCount(count) : String(count)) : null;
  const text = num != null ? `${label} (${num})` : label;
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
      {num != null ? (
        <Animated.View style={roll.style}>
          <AppText variant="caption" tone="secondary" style={styles.actionLabel}>
            {num}
          </AppText>
        </Animated.View>
      ) : null}
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
  quickMeal,
  onOpenSheet,
  onOpenMenu,
  onComment,
  onDidIt,
  didItDone = false,
  showComment = false,
  quickLogLabel,
  fitsGoal,
  plateOpen = false,
  onOpen,
  tip,
  onOpenVideo,
  onOpenAuthor,
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
  onShare: () => void;
  /** Öğün kartında dokun = saate göre doğrudan logla (görsel karesiyle). */
  onQuickLog?: (frame: LogOriginFrame, meal?: MealType, portion?: number) => void;
  /** G18-S5 md.8 — yerinde öğün menüsü (FinMoPopover) için saate göre öğün; yoksa ⌄ seçici sayfası. */
  quickMeal?: MealType;
  /** Öğün kartında ⌄ / uzun bas = porsiyon + öğün seçici. */
  onOpenSheet?: () => void;
  onOpenMenu: () => void;
  // G8 — `kesfet_yorum` açıkken yorum aksiyonu; etkinlik kartı için "Ben de yaptım".
  onComment?: () => void;
  onDidIt?: () => void;
  /** G15 — bu oturumda "Ben de yaptım" eklendi → kartta "✓ Yaptın". */
  didItDone?: boolean;
  showComment?: boolean;
  /** G15 — hızlı logla düğmesinin tam metni ("Öğle’ye logla"); yoksa eski kalıp. */
  quickLogLabel?: string;
  /** G15 — öğün kalan günlük kaloriye sığıyor mu ("Kalori hedefine uyar"). */
  fitsGoal?: boolean;
  /** G15 — "Tabaktaki besinler" açık başlasın mı (vitrin FinFeed). */
  plateOpen?: boolean;
  /** G15 — gönderi metnine dokun = ayrıntı (FinDetail). */
  onOpen?: () => void;
  /** G15 — FinFeedTip balonu: öğün kartının logla düğmesinin altına çapalı. */
  tip?: React.ReactNode;
  /** G15 — videoya dokun = tam ekran oynatıcı (FinVideo kare 2). */
  onOpenVideo?: () => void;
  /** G21-S1 md.8 — avatar / ada dokun = yazarın açık profili (FinProfilePublic; takip oradan). */
  onOpenAuthor?: () => void;
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

  // FinFeedTip balonu: öğün kartının altına (kartın son katmanı → aksiyonların üstünde).
  const [mealBottom, setMealBottom] = useState(0);
  const badgeLabel = model.badgeKey ? tr(`kesfet.ui.badge.${model.badgeKey}`) : null;

  return (
    <Animated.View style={[styles.article, { borderBottomColor: t.color.line }, enter.style]}>
      <View style={styles.row}>
        <Pressable
          onPress={onOpenAuthor}
          disabled={!onOpenAuthor}
          accessibilityRole={onOpenAuthor ? 'link' : undefined}
          accessibilityLabel={onOpenAuthor ? `${model.authorName} @${model.handle}` : undefined}
          hitSlop={4}
          testID="post-card-author"
        >
          <Avatar name={model.authorName} url={model.avatarUrl} official={model.isOfficial} />
        </Pressable>
        <View style={[styles.body, tip ? styles.bodyTip : null]}>
          {/* Yazar satırı */}
          <View style={styles.authorRow}>
            <AppText variant="caption" style={styles.name} numberOfLines={1} onPress={onOpenAuthor}>
              {model.authorName}
            </AppText>
            {model.verified ? <VerifiedBadge size={16} /> : null}
            {badgeLabel ? (
              <AppText variant="caption" tone="secondary" style={styles.roleText} numberOfLines={1}>
                {badgeLabel}
              </AppText>
            ) : null}
            <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.handle}>
              @{model.handle}
              {model.time ? `, ${model.time}` : ''}
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
            <AppText variant="body" style={styles.text} onPress={onOpen} suppressHighlighting>
              {model.body}
            </AppText>
          ) : null}

          {/* Görseller — çift dokunma beğen + büyük kalp damgası */}
          {model.media.length === 1 &&
          model.media[0].kind !== 'video' &&
          model.meal &&
          (model.meal.items?.length ?? 0) > 0 ? (
            <PlateMedia
              media={model.media[0]}
              meal={model.meal}
              fitsGoal={fitsGoal}
              initialOpen={plateOpen}
              onMediaTap={onMediaTap}
              overlay={
                <Animated.View pointerEvents="none" style={[styles.heartOverlay, heartStyle]}>
                  <Icon name="heartFill" size={88} color={t.color.accentLine} />
                </Animated.View>
              }
            />
          ) : model.media.length > 0 ? (
            <Pressable onPress={onMediaTap} accessibilityRole="imagebutton" accessibilityLabel={tr('kesfet.ui.a11y.like')}>
              <View>
                <MediaGrid media={model.media} postId={model.id} isVisible={isVisible} onOpenVideo={onOpenVideo} />
                <Animated.View pointerEvents="none" style={[styles.heartOverlay, heartStyle]}>
                  <Icon name="heartFill" size={88} color={t.color.accentLine} />
                </Animated.View>
              </View>
            </Pressable>
          ) : null}

          {/* Öğün kartı */}
          {model.meal ? (
            <View onLayout={(e) => setMealBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
              <MealCard
                meal={model.meal}
                loggedCount={model.stats.adds}
                quickMealLabel={quickMealLabel ?? ''}
                logLabel={quickLogLabel}
                quickMeal={quickMeal}
                onQuickLog={(frame, meal, portion) => onQuickLog?.(frame, meal, portion)}
                onOpenSheet={() => onOpenSheet?.()}
              />
            </View>
          ) : null}

          {/* Etkinlik kartı */}
          {model.postType === 'etkinlik' && model.activity ? (
            <ActivityCard activity={model.activity} didItCount={model.stats.did_it} onDidIt={onDidIt} done={didItDone} />
          ) : null}

          {/* Aksiyon satırı: Beğen · Kaydet · (Yorum) · Paylaş — hepsi etiketli */}
          <View style={styles.actions}>
            <Action
              icon={model.me.liked ? 'heartFill' : 'heart'}
              color={model.me.liked ? t.color.ink : t.color.secondary}
              label={tr('kesfet.ui.a11y.like')}
              count={model.stats.likes}
              fmtCount={(n) => fmt(n)}
              onPress={like}
            />
            {showComment && onComment ? (
              <Action
                icon="chatCircle"
                color={t.color.secondary}
                label={tr('kesfet.ui.a11y.comment')}
                count={model.stats.comments}
                fmtCount={(n) => fmt(n)}
                onPress={onComment}
              />
            ) : null}
            <Action
              icon={model.me.saved ? 'bookmarkFill' : 'bookmark'}
              color={model.me.saved ? t.color.ink : t.color.secondary}
              label={tr('kesfet.ui.a11y.save')}
              count={model.stats.saves}
              fmtCount={(n) => fmt(n)}
              withDot
              dotColor={t.color.accentLine}
              onPress={save}
            />
            <Action
              icon="share"
              color={t.color.secondary}
              label={tr('kesfet.ui.a11y.share')}
              onPress={onShare}
            />
          </View>
          {tip && model.meal ? <View style={[styles.tip, { top: mealBottom - 4 }]}>{tip}</View> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  article: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', gap: 12 },
  body: { flex: 1, minWidth: 0 },
  bodyTip: { paddingBottom: 28 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: fontFamily.bodyBold, fontSize: 14, flexShrink: 1 },
  roleText: { fontSize: 13 },
  handle: { flexShrink: 1, fontFamily: fontFamily.bodyRegular, fontSize: 14 },
  more: { marginLeft: 'auto', minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  text: { marginTop: 2, fontSize: 15, lineHeight: 22 },
  pending: { alignSelf: 'flex-start', marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  pendingLabel: {},
  tip: { position: 'absolute', right: 0 },
  heartOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  actions: { marginTop: 4, flexDirection: 'row', gap: 28, paddingRight: 8 },
  action: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionLabel: { fontFamily: fontFamily.bodyRegular, fontSize: 13 },
  dot: { position: 'absolute', top: -2, right: -4, width: 6, height: 6, borderRadius: 3 },
});
