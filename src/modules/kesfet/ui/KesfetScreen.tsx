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
import { useNavigation, useRoute } from '@react-navigation/native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { AppText, useTheme, LogTrail } from '../../../core/design';
import { useFeature } from '../../../core/flags';
import { useT } from '../../../core/i18n';
import { haptic } from '../../../core/design';
import { useIconPop } from '../motion';

import { useKesfetStore } from '../store';
import { useNotificationsStore } from '../notificationsStore';
import { emitLogFlight, emitLogUndo } from '../events';
import { inferMealTypeFromHour } from '../../ai/scan/mealTypeFromHour';
import type { LogOriginFrame } from './MealCard';
import { getGunClient } from '../../gun';
import { getProfilClient } from '../../profil';
import { TAB_BAR_R3_HEIGHT, useTabBarCollapse } from '../../shell';
import type { DayRing } from '../../gun/types';
import type { FeedPost, MealType, ReportTargetType } from '../types';

import { Icon } from './icons';
import { PostCard } from './PostCard';
import { GunRingStrip, GunViewer } from '../../gun/ui';
import type { DayCard } from '../../gun/types';
import { AddToDaySheet } from './AddToDaySheet';
import { PostMenu } from './PostMenu';
import { EditPostSheet } from './EditPostSheet';
import { CommentsSheet } from './CommentsSheet';
import { NotificationsSheet } from './NotificationsSheet';
import { SocialPushPrompt, socialPushPromptSeen } from './SocialPushPrompt';
import { FeedTip, feedTipSeen } from './FeedTip';
import { AddToast, type ToastState } from './AddToast';
import { FeedSkeleton, FeedError, FeedOffline, FeedEmpty, FollowingEmpty, useIsOnline, type SuggestedAccount } from './states';
import { postCardModel, postLink, roleBadgeKey, type ReportReason } from './format';

function Header({
  onSearch,
  onNotifications,
  onCompose,
  showCompose,
  showBell,
  unread,
}: {
  onSearch: () => void;
  onNotifications: () => void;
  onCompose: () => void;
  showCompose: boolean;
  showBell: boolean;
  unread: number;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  // Zil rozeti pop'u — okunmamış sayısı arttıkça rozet tek nefes sıçrar.
  const badgePop = useIconPop();
  const prevUnread = useRef(unread);
  useEffect(() => {
    if (unread > prevUnread.current) badgePop.pop();
    prevUnread.current = unread;
  }, [unread, badgePop]);
  return (
    <View style={styles.header}>
      <AppText variant="title" style={styles.title}>
        {tr('kesfet.title')}
      </AppText>
      <View style={styles.headerIcons}>
        <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel={tr('kesfet.ui.a11y.search')} style={styles.iconBtn}>
          <Icon name="search" size={24} color={t.color.ink} />
        </Pressable>
        {showCompose ? (
          <Pressable onPress={onCompose} accessibilityRole="button" accessibilityLabel={tr('kesfet.ui.a11y.compose')} style={styles.iconBtn}>
            <Icon name="plus" size={24} color={t.color.ink} />
          </Pressable>
        ) : null}
        {showBell ? (
          <Pressable onPress={onNotifications} accessibilityRole="button" accessibilityLabel={tr('kesfet.ui.a11y.notifications')} style={styles.iconBtn}>
            <Icon name="bell" size={24} color={t.color.ink} />
            {unread > 0 ? (
              <Animated.View style={[styles.badge, { backgroundColor: t.color.accentLine }, badgePop.style]}>
                <AppText variant="caption" style={styles.badgeText}>
                  {unread > 9 ? '9+' : String(unread)}
                </AppText>
              </Animated.View>
            ) : null}
          </Pressable>
        ) : null}
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
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  // Sekme olarak açıldığında (yeni kabuk): geri düğmesi yok, alt boşluk kabuğun
  // tab barına göre — `TAB_BAR_R3_HEIGHT` (tek kaynak, S2 layout.ts = 96). Stack
  // olarak açılınca (bildirim/derin bağlantı) bugünkü boşluk korunur.
  const asTab = route.params?.asTab === true;
  // G15 — YALNIZ __DEV__ vitrini: Final ara durumlarını açar (ör. 'comments',
  // 'didIt', 'posting'). Üretimde parametre hiç verilmez → undefined.
  const vitrin: string | undefined = __DEV__ ? route.params?.vitrin : undefined;
  const listBottomPad = insets.bottom + (asTab ? TAB_BAR_R3_HEIGHT : 120);
  // Kaydırınca tab barı küçült (yalnız sekme bağlamında; stack'te provider yok
  // → useTabBarCollapse no-op). scrollY → useTabBarCollapse (G11-CONTRACT m.39).
  const scrollY = useSharedValue(0);
  useTabBarCollapse(scrollY);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const { t: tr, fmt, lang } = useT();
  const kesfetTakip = useFeature('kesfet_takip');
  // G8 bayrakları — her biri kapalıyken ilgili davranış HİÇ render olmaz.
  const kesfetPaylasim = useFeature('kesfet_paylasim');
  const kesfetYorum = useFeature('kesfet_yorum');
  const sosyalBildirim = useFeature('sosyal_bildirim');

  const unread = useNotificationsStore((s) => s.unread);
  const online = useIsOnline();

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
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [commentsPost, setCommentsPost] = useState<FeedPost | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pushPromptOpen, setPushPromptOpen] = useState(false);
  // G12-S2 — FinFeedTip: akışa ilk kez girişte bir kez ipucu şeridi.
  const [showFeedTip, setShowFeedTip] = useState(false);
  // G11 — gönderi düzenleme. editAvailable: update_my_post RPC canlıda yoksa
  // (ilk denemede anlaşılır) "Düzenle" seçeneği gizlenir.
  const [editPost, setEditPost] = useState<FeedPost | null>(null);
  const [editAvailable, setEditAvailable] = useState(true);
  // G11 — "Logla izi" imza anı: başarılı "Günüme ekle"de kısa bir iz oynatılır.
  const [trail, setTrail] = useState<{ token: number; label: string } | null>(null);
  const trailSeq = useRef(0);
  const addSeq = useRef(0);
  const addCardSeq = useRef(0);
  const didItSeq = useRef(0);

  // Hangi gönderi ekranda görünür — FeedVideo otomatik oynat/durdur (G8-S3).
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: FeedPost; isViewable: boolean }> }) => {
      const visible = viewableItems.find((v) => v.isViewable);
      setVisiblePostId(visible ? visible.item.id : null);
    },
  ).current;

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

  // "Logla izi" oynadıktan sonra örtüyü kaldır (iz ~logTrail + tampon sürede biter).
  useEffect(() => {
    if (!trail) return;
    const id = setTimeout(() => setTrail(null), 1200);
    return () => clearTimeout(id);
  }, [trail]);

  // Akışa ilk kez girişte bir kez ipucu şeridi (FinFeedTip).
  useEffect(() => {
    void feedTipSeen().then((seen) => setShowFeedTip(!seen));
  }, []);

  // "Takip" bayrağı kapalıysa ama sekme orada kaldıysa Sana Özel'e düş.
  useEffect(() => {
    if (!kesfetTakip && tab === 'following') void useKesfetStore.getState().setTab('for_you');
  }, [kesfetTakip, tab]);

  // Sosyal bildirim rozeti — yalnız bayrak açıkken sayaç çek.
  useEffect(() => {
    if (sosyalBildirim) void useNotificationsStore.getState().refreshUnread();
  }, [sosyalBildirim]);

  // İlk sosyal etkileşimden sonra bir kez push izni ön sayfası (bayrak açıksa).
  const touchSocial = useCallback(() => {
    if (!sosyalBildirim) return;
    void socialPushPromptSeen().then((seen) => {
      if (!seen) setPushPromptOpen(true);
    });
  }, [sosyalBildirim]);

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

  // "Gör" — loglanan öğünü görmek için Ana sayfa/Gün'e geç (varsa). Kabuk
  // bağlamında sekme değişir; bilinmeyen rotada sessizce yutar.
  const onViewDay = useCallback(() => {
    try {
      navigation.navigate('Home');
    } catch {
      // rota yoksa no-op
    }
  }, [navigation]);

  // Tek loglama yolu — hem hızlı logla (dokun) hem seçiciden (sheet) buraya gelir.
  // addToDay → uçuş olayı (`kcal:logFlight`, frame varsa) → "Logla izi" → toast
  // ("<Öğün>'ye loglandı · Geri al · Gör"). Geri al tek kaydı geri alır + logUndo.
  const logMeal = useCallback(
    async (post: FeedPost, mealType: MealType, portion: number, frame?: LogOriginFrame) => {
      addSeq.current += 1;
      const key = `kesfet-${post.id}-${mealType}-${portion}-${addSeq.current}`;
      const consumptionId = await useKesfetStore.getState().addToDay(post.id, mealType, portion, key);
      if (!consumptionId) return;
      const mealLabel = tr(`meal.${mealType}`);
      // Kabuğun tab barına uçuş (S1 dinler): yemek görseli "Ana sayfa"ya uçar + "+N".
      if (frame && (frame.w > 0 || frame.h > 0)) {
        emitLogFlight({
          x: frame.x,
          y: frame.y,
          w: frame.w,
          h: frame.h,
          imageUri: post.meal_card?.photo_url ?? null,
          mealLabel,
        });
      }
      // "Logla izi" — ekran içi kısa yankı (yemek noktaya iner, yay çizip uçar).
      trailSeq.current += 1;
      setTrail({ token: trailSeq.current, label: post.meal_card?.name ?? '' });
      // Toast: "<Öğün>'ye loglandı · Geri al · Gör".
      setToast({
        message: tr('kesfet.added_toast', { meal: mealLabel }),
        undoLabel: tr('common.undo'),
        onUndo: () => {
          void useKesfetStore.getState().undoAddToDay(post.id, consumptionId, key);
          emitLogUndo({ id: consumptionId });
        },
        actionLabel: tr('kesfet.ui.view_day'),
        onAction: onViewDay,
      });
    },
    [tr, onViewDay],
  );

  // Seçiciden (FinAddSheet) öğün + porsiyon ile logla.
  const onAdd = useCallback(
    async (mealType: MealType, portion: number) => {
      const post = sheetPost;
      if (!post) return;
      setSheetPost(null);
      await logMeal(post, mealType, portion);
    },
    [sheetPost, logMeal],
  );

  // Hızlı logla — öğün kartında dokununca saate göre öğüne, porsiyon 1 ile logla.
  const onQuickLog = useCallback(
    (post: FeedPost, frame: LogOriginFrame) => {
      touchSocial();
      const mealType = inferMealTypeFromHour(new Date().getHours());
      void logMeal(post, mealType, 1, frame);
    },
    [logMeal, touchSocial],
  );

  // Saate göre hızlı loglanacak öğünün etiketi — kartlardaki düğme bunu gösterir.
  const quickMealLabel = tr(`meal.${inferMealTypeFromHour(new Date().getHours())}`);

  // Sonuç PostMenu içinde gösterilir (FinReportDone/FinReportNotice) — burada
  // toast YOK, yalnız başarı/başarısızlığı döndürür.
  const onReport = useCallback(
    (post: FeedPost, reason: ReportReason) =>
      useKesfetStore.getState().report('post' as ReportTargetType, post.id, reason),
    [],
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
      // expo-clipboard G8-S3'te kuruldu (onaylı istisna) — gerçek kopyalama.
      await Clipboard.setStringAsync(postLink(post.id));
      setToast({ message: tr('kesfet.ui.link_copied') });
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

  const onDidIt = useCallback(
    async (post: FeedPost) => {
      touchSocial();
      didItSeq.current += 1;
      const key = `didit-${post.id}-${didItSeq.current}`;
      const minutes = post.activity_card?.minutes ?? null;
      const kcal = await useKesfetStore.getState().didIt(post.id, minutes, key);
      if (kcal != null) {
        // Tahmini kcal hapı + "eklendi" (success haptiği ActivityCard'da verildi).
        setToast({
          message: `${tr('kesfet.activity.kcal_est', { kcal: fmt(kcal) })} · ${tr('kesfet.activity.logged')}`,
          actionLabel: tr('kesfet.ui.share_to_my_day'),
          onAction: () => {},
        });
      }
      // Başarısızlık sessiz: kcal null ise toast yok (olumsuz an sessiz — motion §2).
    },
    [touchSocial, tr, fmt],
  );

  const onDeletePost = useCallback(async (post: FeedPost) => {
    const ok = await useKesfetStore.getState().deletePost(post.id);
    if (ok) setToast({ message: tr('kesfet.ui.post_deleted') });
  }, [tr]);

  const renderItem = useCallback(
    ({ item, index }: { item: FeedPost; index: number }) => {
      const model = postCardModel(item, nowMs, lang);
      return (
        <PostCard
          model={model}
          index={index}
          showComment={kesfetYorum}
          isVisible={item.id === visiblePostId}
          quickMealLabel={quickMealLabel}
          onLike={() => {
            touchSocial();
            void useKesfetStore.getState().react(item.id, 'like', !item.me.liked);
          }}
          onSave={() => useKesfetStore.getState().react(item.id, 'save', !item.me.saved)}
          onShare={() => onShare(item)}
          onQuickLog={(frame) => onQuickLog(item, frame)}
          onOpenSheet={() => setSheetPost(item)}
          onOpenMenu={() => setMenuPost(item)}
          onComment={() => {
            touchSocial();
            setCommentsPost(item);
          }}
          onDidIt={() => void onDidIt(item)}
        />
      );
    },
    [nowMs, lang, onShare, kesfetYorum, touchSocial, onDidIt, visiblePostId, quickMealLabel, onQuickLog],
  );

  const ringStrip = useMemo(
    () =>
      rings.length > 0 ? (
        <GunRingStrip rings={rings} onOpen={(userId) => setViewerUserId(userId)} />
      ) : null,
    [rings],
  );

  const feedHeader = (
    <>
      {ringStrip}
      {showFeedTip ? <FeedTip onDismiss={() => setShowFeedTip(false)} /> : null}
    </>
  );

  // GunViewer "Günüme ekle": başkasının paylaştığı kartı kendi günlüğüme
  // (meal_consumptions) ekle (add_day_card_to_day, source='day_card').
  const onAddCardToDay = useCallback(async (card: DayCard) => {
    addCardSeq.current += 1;
    const key = `daycard-${card.id}-${addCardSeq.current}`;
    await getGunClient().addDayCardToDay({
      card: card.id,
      mealType: card.meal_type,
      idempotencyKey: key,
    });
    setToast({ message: tr('kesfet.added_toast', { meal: tr(`meal.${card.meal_type}`) }) });
  }, [tr]);

  // G11 — gönderiyi düzenle. update_my_post yoksa seçeneği gizle; pending dönerse
  // kartta "İncelemede" (store status'u günceller). Olumsuz an sessiz (kırmızı yok).
  const onEditSave = useCallback(
    async (body: string) => {
      const post = editPost;
      if (!post) return;
      setEditPost(null);
      const res = await useKesfetStore.getState().editPost(post.id, body);
      if (!res.available) {
        setEditAvailable(false);
        return;
      }
      if (res.ok) {
        setToast({
          message: res.status === 'pending' ? tr('kesfet.ui.edit_pending') : tr('kesfet.ui.edit_saved'),
        });
      }
    },
    [editPost, tr],
  );

  const showFollowingEmpty = tab === 'following' && !loading && !error && posts.length === 0;

  let body: React.ReactNode;
  if (loading && posts.length === 0) {
    body = (
      <>
        {feedHeader}
        <FeedSkeleton />
      </>
    );
  } else if (error && posts.length === 0) {
    // Çevrimdışıysa sakin çevrimdışı hâli; değilse genel hata + tekrar dene.
    body = online ? (
      <FeedError message={error} onRetry={() => void useKesfetStore.getState().load()} />
    ) : (
      <FeedOffline onRetry={() => void useKesfetStore.getState().load()} />
    );
  } else if (showFollowingEmpty) {
    body = (
      <>
        {feedHeader}
        <FollowingEmpty suggestions={suggestions} onFollow={onFollow} />
      </>
    );
  } else if (posts.length === 0) {
    body = (
      <>
        {feedHeader}
        <FeedEmpty following={tab === 'following'} />
      </>
    );
  } else {
    body = (
      <Animated.FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        ListHeaderComponent={feedHeader}
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
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
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
        contentContainerStyle={{ paddingBottom: listBottomPad }}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: t.color.bg, paddingTop: insets.top }]}>
      <Header
        onSearch={() => {}}
        onNotifications={() => setNotifOpen(true)}
        onCompose={() => navigation.navigate('Composer')}
        showCompose={kesfetPaylasim}
        showBell={sosyalBildirim}
        unread={unread}
      />
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
        isMine={menuPost?.me.is_author ?? false}
        canEdit={(menuPost?.me.is_author ?? false) && editAvailable}
        onCopyLink={() => menuPost && void onCopyLink(menuPost)}
        onReport={(reason) => (menuPost ? onReport(menuPost, reason) : false)}
        onBlock={() => menuPost && void onBlock(menuPost)}
        onDelete={() => menuPost && void onDeletePost(menuPost)}
        onEdit={() => setEditPost(menuPost)}
      />
      <EditPostSheet
        visible={editPost != null}
        initialBody={editPost?.body ?? ''}
        onClose={() => setEditPost(null)}
        onSave={onEditSave}
      />
      <AddToast toast={toast} onDismiss={() => setToast(null)} />

      {trail ? (
        <View pointerEvents="none" style={styles.trailOverlay}>
          <LogTrail playToken={trail.token} label={trail.label} width={300} height={160} />
        </View>
      ) : null}

      {kesfetYorum ? (
        <CommentsSheet
          visible={commentsPost != null}
          postId={commentsPost?.id ?? null}
          currentUser={null}
          onClose={() => setCommentsPost(null)}
          onToast={(message) => setToast({ message })}
        />
      ) : null}

      {sosyalBildirim ? (
        <>
          <NotificationsSheet
            visible={notifOpen}
            onClose={() => setNotifOpen(false)}
            onOpenPost={(postId) => navigation.navigate('SharedPost', { postId })}
            onOpenProfile={(handle) => navigation.navigate('PublicProfile', { handle })}
          />
          <SocialPushPrompt visible={pushPromptOpen} onClose={() => setPushPromptOpen(false)} />
        </>
      ) : null}

      {viewerUserId != null && (
        <GunViewer
          visible
          rings={rings}
          startUserId={viewerUserId}
          onClose={() => setViewerUserId(null)}
          onAddToDay={onAddCardToDay}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 4 },
  title: {},
  headerIcons: { flexDirection: 'row' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#0A0A0A', fontSize: 10, fontWeight: '800', lineHeight: 14 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tabUnderline: { position: 'absolute', bottom: 0, width: 56, height: 3, borderRadius: 2 },
  content: { flex: 1 },
  footer: { paddingVertical: 20, alignItems: 'center' },
  trailOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});

export default KesfetScreen;
