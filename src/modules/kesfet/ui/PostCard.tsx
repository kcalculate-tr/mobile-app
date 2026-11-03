// Keşfet PostCard — tasarım T20Feed-D1. Avatar, yazar satırı (ad, doğrulama
// mührü, rol rozeti, @handle · süre, ⋯ menü), metin, 1–4 görsel, MealCard ve
// aksiyon satırı. Aksiyon satırı YALNIZ Beğen · Kaydet · Paylaş (yanıt/alıntı/
// besin notu/sponsorlu YOK — sözleşme).
//
// Hareket (G11-S3): kart girişte sırayla akar (useFeedCardEnter); beğen/kaydet
// ikonu pop + sayaç yuvarlanması (useIconPop/useCountRoll), kaydet'te nokta izi
// (useDotBurst). Haptik: beğen/kaydet light. Azaltılmış harekete hook'lar uyar.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { haptic } from '../../../core/design';
import { Avatar } from './Avatar';
import { MediaGrid } from './MediaGrid';
import { MealCard } from './MealCard';
import { ActivityCard } from './ActivityCard';
import { Icon, type IconName } from './icons';
import { useFeedCardEnter, useIconPop, useDotBurst, useCountRoll } from '../motion';
import type { PostCardModel } from './format';

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
  const a11y = count != null ? `${label} · ${count}` : label;
  return (
    <Pressable
      onPress={() => {
        pop.pop();
        if (withDot) dot.burst();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
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
      {count != null ? (
        <Animated.View style={roll.style}>
          <AppText variant="caption" tone="secondary" style={styles.actionCount}>
            {fmtCount ? fmtCount(count) : String(count)}
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
  onLike,
  onSave,
  onShare,
  onAddToDay,
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
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onAddToDay: () => void;
  onOpenMenu: () => void;
  // G8 — `kesfet_yorum` açıkken yorum aksiyonu; etkinlik kartı için "Ben de yaptım".
  onComment?: () => void;
  onDidIt?: () => void;
  showComment?: boolean;
}) {
  const t = useTheme();
  const { t: tr, fmt } = useT();
  const enter = useFeedCardEnter(index);

  const like = () => {
    haptic('light');
    onLike();
  };
  const save = () => {
    haptic('light');
    onSave();
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
            {model.verified ? (
              <Icon name="seal" size={16} color={t.color.accentLine} />
            ) : null}
            {badgeLabel ? (
              <AppText variant="caption" tone="secondary" numberOfLines={1}>
                {badgeLabel}
              </AppText>
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

          {/* Görseller */}
          {model.media.length > 0 ? (
            <MediaGrid media={model.media} postId={model.id} isVisible={isVisible} />
          ) : null}

          {/* Öğün kartı */}
          {model.meal ? (
            <MealCard meal={model.meal} addsCount={model.stats.adds} onAddToDay={onAddToDay} />
          ) : null}

          {/* Etkinlik kartı */}
          {model.postType === 'etkinlik' && model.activity ? (
            <ActivityCard activity={model.activity} didItCount={model.stats.did_it} onDidIt={onDidIt} />
          ) : null}

          {/* Aksiyon satırı: Beğen · Kaydet · Paylaş */}
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
            <Action
              icon="share"
              color={t.color.secondary}
              label={tr('kesfet.ui.a11y.share')}
              onPress={onShare}
            />
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
  handle: { flexShrink: 1 },
  more: { marginLeft: 'auto', minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  text: { marginTop: 2, fontSize: 15, lineHeight: 22 },
  pending: { alignSelf: 'flex-start', marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  pendingLabel: {},
  actions: { marginTop: 4, flexDirection: 'row', gap: 28 },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: {},
  dot: { position: 'absolute', top: -2, right: -4, width: 6, height: 6, borderRadius: 3 },
});
