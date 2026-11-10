// G18-S4 md.4 — FinFeedEmpty (Sana Özel boş) + FinFollowingEmpty (Takip boş).
// Final: başlık + açıklama · "Başlangıç için / kcal ve editörler" yatay kartlar
// (Marka/Editör etiketli, YALNIZ gerçekte varsa) · "Davetli üreticiler / kcal’a
// katılanlar" (yoksa alan gizli) · "İlk paylaşımını hazırla" kartı.
// Üstteki "Günüm" halka şeridi çağıranın `feedHeader`'ında (aynen).
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText, FinListEnter, fontFamily, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CaretRight } from '../../../components/icons';
import { Avatar } from './Avatar';
import { Icon } from './icons';
import { roleBadgeKey } from './format';
import type { StarterItem } from '../starters';
import type { SuggestedAccount } from './states';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

export function FeedStartEmpty({
  variant,
  starters,
  creators,
  onOpenPost,
  onFollow,
  onCompose,
}: {
  variant: 'for_you' | 'following';
  starters: StarterItem[];
  creators: SuggestedAccount[];
  onOpenPost: (postId: string) => void;
  onFollow: (id: string) => void;
  /** Paylaşım açıksa "İlk paylaşımını hazırla"; yoksa kart gizli. */
  onCompose?: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const has = starters.length > 0;
  const title = variant === 'following' ? tr('kesfet.ui.following_empty_title') : tr('kesfet.ui.start_foryou_title');
  const desc =
    variant === 'following'
      ? tr(has ? 'kesfet.ui.start_following_desc' : 'kesfet.ui.start_following_desc_nostart')
      : tr(has ? 'kesfet.ui.start_foryou_desc' : 'kesfet.ui.start_foryou_desc_nostart');

  return (
    <View testID={variant === 'following' ? 'fin-following-empty' : 'fin-feed-empty'}>
      <View style={styles.head}>
        <AppText style={[styles.h2, { color: t.color.ink }]} accessibilityRole="header">
          {title}
        </AppText>
        <AppText style={[styles.desc, { color: t.color.secondary }]}>{desc}</AppText>
      </View>

      {has ? (
        <View accessibilityLabel={tr('kesfet.ui.start_section')}>
          <View style={styles.secHead}>
            <AppText style={[styles.h3, { color: t.color.ink }]}>{tr('kesfet.ui.start_section')}</AppText>
            <AppText style={[styles.meta, { color: t.color.secondary }]}>{tr('kesfet.ui.start_section_meta')}</AppText>
          </View>
          <ScrollView {...SCROLL_KEYBOARD} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {starters.map((s, i) => (
              <FinListEnter key={s.postId} index={i}>
                <Pressable
                  onPress={() => onOpenPost(s.postId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${tr(`kesfet.ui.start_label_${s.label}`)}, ${s.title}`}
                  style={[styles.card, { backgroundColor: t.color.surface, borderColor: t.color.line }]}
                  testID={`fin-starter-${s.postId}`}
                >
                  <View style={styles.cardImg}>
                    <Image source={{ uri: s.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
                    <View style={[styles.chip, { backgroundColor: t.color.surface }]}>
                      <AppText style={[styles.chipText, { color: t.color.ink }]}>
                        {tr(`kesfet.ui.start_label_${s.label}`)}
                      </AppText>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.byline}>
                      <Avatar name={s.authorName} url={s.avatarUrl} official size={20} />
                      <AppText style={[styles.meta, { color: t.color.secondary }]} numberOfLines={1}>
                        @{s.handle}
                      </AppText>
                    </View>
                    <AppText style={[styles.cardTitle, { color: t.color.ink }]} numberOfLines={2}>
                      {s.title}
                    </AppText>
                    {s.hasRecipe ? (
                      <AppText style={[styles.meta, { color: t.color.secondary }]}>{tr('kesfet.ui.start_meta_recipe')}</AppText>
                    ) : null}
                  </View>
                </Pressable>
              </FinListEnter>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {creators.length > 0 ? (
        <View style={styles.creators} accessibilityLabel={tr('kesfet.ui.creators_title')}>
          <View style={styles.secHead}>
            <AppText style={[styles.h3, { color: t.color.ink }]}>{tr('kesfet.ui.creators_title')}</AppText>
            <AppText style={[styles.meta, { color: t.color.secondary }]}>{tr('kesfet.ui.creators_meta')}</AppText>
          </View>
          {creators.map((a, i) => {
            const badgeKey = roleBadgeKey(a.role);
            return (
              <View
                key={a.id}
                style={[
                  styles.creatorRow,
                  { borderTopColor: t.color.line },
                  i === creators.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.color.line } : null,
                ]}
              >
                <Avatar name={a.display_name} url={a.avatar_url} size={44} />
                <View style={styles.creatorInfo}>
                  <View style={styles.nameRow}>
                    <AppText style={[styles.name, { color: t.color.ink }]} numberOfLines={1}>
                      {a.display_name}
                    </AppText>
                    {a.verified ? <Icon name="seal" size={16} color={t.color.accentLine} /> : null}
                    {badgeKey ? (
                      <AppText style={[styles.meta, { color: t.color.secondary }]} numberOfLines={1}>
                        {tr(`kesfet.ui.badge.${badgeKey}`)}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText style={[styles.meta, { color: t.color.secondary }]} numberOfLines={2}>
                    @{a.handle}
                    {a.bio ? `, ${a.bio}` : ''}
                  </AppText>
                </View>
                <Pressable
                  onPress={() => onFollow(a.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${tr('profil.follow')} ${a.display_name}`}
                  style={styles.followHit}
                >
                  <View style={[styles.followBtn, { backgroundColor: t.color.ink }]}>
                    <AppText style={[styles.followText, { color: t.color.bg }]}>{tr('profil.follow')}</AppText>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {onCompose ? (
        <View style={styles.composeWrap}>
          <Pressable
            onPress={onCompose}
            accessibilityRole="button"
            accessibilityLabel={tr('kesfet.ui.first_post_title')}
            style={[styles.compose, { backgroundColor: t.color.surface, borderColor: t.color.line }]}
            testID="fin-first-post"
          >
            <View style={[styles.composeIcon, { backgroundColor: t.color.accent }]}>
              <Icon name="pencil" size={22} color={t.color.onAccent} />
            </View>
            <View style={styles.composeText}>
              <AppText style={[styles.composeTitle, { color: t.color.ink }]}>{tr('kesfet.ui.first_post_title')}</AppText>
              <AppText style={[styles.meta, { color: t.color.secondary }]}>{tr('kesfet.ui.first_post_desc')}</AppText>
            </View>
            <CaretRight size={18} color={t.color.secondary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 16, gap: 4 },
  h2: { fontFamily: fontFamily.headingSemibold, fontSize: 20, lineHeight: 26 },
  desc: { fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 20 },
  secHead: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  h3: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 20 },
  meta: { fontFamily: fontFamily.bodyRegular, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  row: { gap: 10, paddingHorizontal: 16, paddingBottom: 20 },
  card: { width: 200, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  cardImg: { height: 140 },
  chip: { position: 'absolute', top: 10, left: 10, height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  chipText: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  cardBody: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 20 },
  cardTitle: { fontFamily: fontFamily.bodyBold, fontSize: 14, lineHeight: 19, minHeight: 38 },
  creators: { paddingBottom: 12 },
  creatorRow: { minHeight: 72, paddingLeft: 16, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  creatorInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  followHit: { height: 44, paddingHorizontal: 4, justifyContent: 'center' },
  followBtn: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  followText: { fontFamily: fontFamily.bodySemibold, fontSize: 14 },
  composeWrap: { paddingHorizontal: 16, paddingBottom: 24 },
  compose: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  composeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  composeText: { flex: 1, minWidth: 0, gap: 2 },
  composeTitle: { fontFamily: fontFamily.headingSemibold, fontSize: 16, lineHeight: 21 },
});
