// Keşfet ana ekranı — tasarım T20Feed-D1 / T20FollowingEmpty.
// Başlık "Keşfet" + Ara/Bildirim, sekmeler (Sana Özel / Takip — kesfet_takip
// kapalıysa Takip gizli), üstte Gün halkası şeridi, sonra akış. Beğen/Kaydet
// iyimser (store), Günüme ekle → AddToDaySheet → toast (Günüme paylaş), ⋯ menü
// (kopyala/şikayet/engelle). Hepsi `kesfet` bayrağı arkasında (AppNavigator).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, useTheme } from '../../../core/design';
import { useFeature } from '../../../core/flags';
import { useT } from '../../../core/i18n';
import { haptic } from '../../../core/design';

import { useKesfetStore } from '../store';
import { getGunClient } from '../../gun';
import { getProfilClient } from '../../profil';
import type { DayRing } from '../../gun/types';
import type { FeedPost, MealType, ReportTargetType } from '../types';

import { Icon } from './icons';
import { PostCard } from './PostCard';
import { GunRingStripPlaceholder } from './GunRingStrip';
import { AddToDaySheet } from './AddToDaySheet';
import { PostMenu } from './PostMenu';
import { AddToast, type ToastState } from './AddToast';
import { FeedSkeleton, FeedError, FeedEmpty, FollowingEmpty, type SuggestedAccount } from './states';
import { postCardModel, postLink, roleBadgeKey, type ReportReason } from './format';

function Header({ onSearch, onNotifications }: { onSearch: () => void; onNotifications: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  return (
    <View style={styles.header}>
      <AppText variant="title" style={styles.title}>
        {tr('kesfet.title')}
      </AppText>
      <View style={styles.headerIcons}>
        <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel={tr('kesfet.ui.a11y.search')} style={styles.iconBtn}>
          <Icon name="search" size={24} color={t.color.ink} />
        </Pressable>
        <Pressable onPress={onNotifications} accessibilityRole="button" accessibilityLabel={tr('kesfet.ui.a11y.notifications')} style={styles.iconBtn}>
          <Icon name="bell" size={24} color={t.color.ink} />
        </Pressable>
      </View>
    </View>
  );
}

function Tabs({
  tab,
  showFollowing,
  onChange,
}: {
  tab: 'for_you' | 'following';
  showFollowing: boolean;
  onChange: (t: 'for_you' | 'following') => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const items: Array<{ key: 'for_you' | 'following'; label: string }> = [
    { key: 'for_you', label: tr('kesfet.ui.tab.for_you') },
  ];
  if (showFollowing) items.push({ key: 'following', label: tr('kesfet.ui.tab.following') });

  return (
    <View style={[styles.tabs, { borderBottomColor: t.color.line }]} accessibilityRole="tablist">
      {items.map((it) => {
        const active = tab === it.key;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={it.label}
            style={styles.tab}
          >
            <AppText variant="caption" tone={active ? 'ink' : 'secondary'} style={{ fontWeight: active ? '700' : '500', fontSize: 15 }}>
              {it.label}
            </AppText>
            {active ? <View style={[styles.tabUnderline, { backgroundColor: t.color.ink }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function KesfetScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { t: tr, fmt, lang } = useT();
  const kesfetTakip = useFeature('kesfet_takip');

  const tab = useKesfetStore((s) => s.tab);
  const posts = useKesfetStore((s) => s.posts);
  const loading = useKesfetStore((s) => s.loading);
  const refreshing = useKesfetStore((s) => s.refreshing);
  const loadingMore = useKesfetStore((s) => s.loadingMore);
  const hasMore = useKesfetStore((s) => s.hasMore);
  const error = useKesfetStore((s) => s.error);

  const [rings, setRings] = useState<DayRing[]>([]);
  const [sheetPost, setSheetPost] = useState<FeedPost | null>(null);
  const [menuPost, setMenuPost] = useState<FeedPost | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedAccount[]>([]);
  const addSeq = useRef(0);

  // İlk yükleme + gün halkaları.
  useEffect(() => {
    if (useKesfetStore.getState().posts.length === 0) {
      void useKesfetStore.getState().load();
    }
    let alive = true;
    getGunClient()
      .getDayRings()
      .then((r) => {
        if (alive) setRings(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // "Takip" bayrağı kapalıysa ama sekme orada kaldıysa Sana Özel'e düş.
  useEffect(() => {
    if (!kesfetTakip && tab === 'following') void useKesfetStore.getState().setTab('for_you');
  }, [kesfetTakip, tab]);

  // Önerilen hesaplar — for_you akışındaki can_post (rozetli) yazarlardan türet
  // (gerçek veri; uydurma yok). Takip boşken gösterilir.
  useEffect(() => {
    if (tab !== 'for_you') return;
    const seen = new Map<string, SuggestedAccount>();
    for (const p of posts) {
      if (roleBadgeKey(p.author.role) && !seen.has(p.author.id)) {
        seen.set(p.author.id, {
          id: p.author.id,
          display_name: p.author.display_name,
          handle: p.author.handle,
          role: p.author.role,
          verified: p.author.verified,
          avatar_url: p.author.avatar_url,
        });
      }
      if (seen.size >= 3) break;
    }
    if (seen.size > 0) setSuggestions(Array.from(seen.values()));
  }, [tab, posts]);

  const nowMs = Date.now();

  const onShare = useCallback(async (post: FeedPost) => {
    try {
      await Share.share({ message: postLink(post.id), url: postLink(post.id) });
    } catch {
      // kullanıcı iptal etti
    }
  }, []);

  const onAdd = useCallback(
    async (mealType: MealType, portion: number) => {
      const post = sheetPost;
      if (!post) return;
      setSheetPost(null);
      addSeq.current += 1;
      const key = `kesfet-${post.id}-${mealType}-${portion}-${addSeq.current}`;
      const consumptionId = await useKesfetStore.getState().addToDay(post.id, mealType, portion, key);
      if (!consumptionId) return;
      setToast({
        message: tr('kesfet.ui.added_to_meal', { meal: tr(`meal.${mealType}`) }),
        actionLabel: tr('kesfet.ui.share_to_my_day'),
        onAction: () => {
          void getGunClient().shareMealToDay({ consumption: consumptionId }).catch(() => {});
        },
      });
    },
    [sheetPost, tr],
  );

  const onReport = useCallback(
    async (post: FeedPost, reason: ReportReason) => {
      const ok = await useKesfetStore.getState().report('post' as ReportTargetType, post.id, reason);
      if (ok) setToast({ message: tr('kesfet.ui.report_toast') });
    },
    [tr],
  );

  const onBlock = useCallback(
    async (post: FeedPost) => {
      const name = post.author.display_name;
      const ok = await useKesfetStore.getState().blockAuthor(post.author.id);
      if (ok) setToast({ message: tr('kesfet.ui.blocked_toast', { name }) });
    },
    [tr],
  );

  const onCopyLink = useCallback(
    async (post: FeedPost) => {
      // expo-clipboard kurulu değil (yeni paket yasak); şimdilik sistem paylaşım
      // sayfasıyla bağlantı verilir. Gerçek "kopyala" için SORULAR'a bkz.
      try {
        await Share.share({ message: postLink(post.id), url: postLink(post.id) });
        setToast({ message: tr('kesfet.ui.link_shared') });
      } catch {
        // iptal
      }
    },
    [tr],
  );

  const onFollow = useCallback(
    async (userId: string) => {
      haptic('selection');
      setSuggestions((prev) => prev.filter((s) => s.id !== userId));
      try {
        await getProfilClient().follow({ user: userId, on: true });
        if (useKesfetStore.getState().tab === 'following') void useKesfetStore.getState().refresh();
      } catch {
        // yut — öneri zaten listeden düştü
      }
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => {
      const model = postCardModel(item, nowMs, lang);
      return (
        <PostCard
          model={model}
          onLike={() => useKesfetStore.getState().react(item.id, 'like', !item.me.liked)}
          onSave={() => useKesfetStore.getState().react(item.id, 'save', !item.me.saved)}
          onShare={() => onShare(item)}
          onAddToDay={() => setSheetPost(item)}
          onOpenMenu={() => setMenuPost(item)}
        />
      );
    },
    [nowMs, lang, onShare],
  );

  const ringStrip = useMemo(
    () =>
      rings.length > 0 ? (
        <GunRingStripPlaceholder rings={rings} onOpen={() => { /* G6-S3: gün görünümü */ }} />
      ) : null,
    [rings],
  );

  const showFollowingEmpty = tab === 'following' && !loading && !error && posts.length === 0;

  let body: React.ReactNode;
  if (loading && posts.length === 0) {
    body = (
      <>
        {ringStrip}
        <FeedSkeleton />
      </>
    );
  } else if (error && posts.length === 0) {
    body = <FeedError message={error} onRetry={() => void useKesfetStore.getState().load()} />;
  } else if (showFollowingEmpty) {
    body = (
      <>
        {ringStrip}
        <FollowingEmpty suggestions={suggestions} onFollow={onFollow} />
      </>
    );
  } else if (posts.length === 0) {
    body = (
      <>
        {ringStrip}
        <FeedEmpty following={tab === 'following'} />
      </>
    );
  } else {
    body = (
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ListHeaderComponent={ringStrip}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void useKesfetStore.getState().refresh()}
            tintColor={t.color.secondary}
          />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasMore && !loadingMore) void useKesfetStore.getState().loadMore();
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            {loadingMore ? (
              <AppText variant="caption" tone="secondary">
                {tr('kesfet.ui.loading')}
              </AppText>
            ) : !hasMore ? (
              <AppText variant="caption" tone="secondary">
                {tr('kesfet.ui.end')}
              </AppText>
            ) : null}
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: t.color.bg, paddingTop: insets.top }]}>
      <Header onSearch={() => {}} onNotifications={() => {}} />
      <Tabs
        tab={tab}
        showFollowing={kesfetTakip}
        onChange={(next) => {
          haptic('selection');
          void useKesfetStore.getState().setTab(next);
        }}
      />
      <View style={styles.content}>{body}</View>

      <AddToDaySheet
        visible={sheetPost != null}
        onClose={() => setSheetPost(null)}
        meal={sheetPost?.meal_card ?? null}
        authorHandle={sheetPost?.author.handle ?? ''}
        onAdd={onAdd}
      />
      <PostMenu
        visible={menuPost != null}
        onClose={() => setMenuPost(null)}
        authorName={menuPost?.author.display_name ?? ''}
        onCopyLink={() => menuPost && void onCopyLink(menuPost)}
        onReport={(reason) => menuPost && void onReport(menuPost, reason)}
        onBlock={() => menuPost && void onBlock(menuPost)}
      />
      <AddToast toast={toast} onDismiss={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 4 },
  title: {},
  headerIcons: { flexDirection: 'row' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tabUnderline: { position: 'absolute', bottom: 0, width: 56, height: 3, borderRadius: 2 },
  content: { flex: 1 },
  footer: { paddingVertical: 20, alignItems: 'center' },
});

export default KesfetScreen;
