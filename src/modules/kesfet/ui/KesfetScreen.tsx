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
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import { AppText, useTheme, LogTrail } from '../../../core/design';
import { useFeature } from '../../../core/flags';
import { useT } from '../../../core/i18n';
import { haptic } from '../../../core/design';
import { useIconPop } from '../motion';

import { useKesfetStore } from '../store';
import { getKesfetClient } from '../client';
import { useNotificationsStore } from '../notificationsStore';
import { emitLogFlight } from '../events';
import { trackEvent } from '../../gun/track/events';
import { inferMealTypeFromHour } from '../../ai/scan/mealTypeFromHour';
import { useNutritionSummary } from '../../../hooks/useNutritionSummary';
import type { LogOriginFrame } from './MealCard';
import { getGunClient } from '../../gun';
import { getProfilClient } from '../../profil';
import { tabBarContentInset, useTabBarCollapse, useTabBarCollapsedValue } from '../../shell';
import type { DayRing } from '../../gun/types';
import type { FeedPost, MealType, ReportTargetType } from '../types';

import { Icon } from './icons';
import { PostCard } from './PostCard';
import { useOrientTarget } from '../../onboarding/first/orient/useOrientTarget'; // G18-S1 temas: Orient4
import { GunViewer } from '../../gun/ui';
import { RingStrip } from './RingStrip';
import { VideoPlayer } from './VideoPlayer';
import { PostingStatus } from './PostingStatus';
import { RulesSheet } from './RulesSheet';
import { usePostingStore, type PostingPhase } from '../postingStore';
import type { DayCard } from '../../gun/types';
import { AddToDaySheet } from './AddToDaySheet';
import { PostMenu } from './PostMenu';
import { EditPostSheet } from './EditPostSheet';
import { CommentsSheet } from './CommentsSheet';
import { SocialPushPrompt, socialPushPromptSeen } from './SocialPushPrompt';
import { FeedTip, feedTipSeen } from './FeedTip';
import { AddToast, type ToastState } from './AddToast';
import { DidItSheet } from './DidItSheet';
import { FeedSkeleton, FeedError, FeedOffline, useIsOnline, type SuggestedAccount } from './states';
import { FeedStartEmpty } from './FeedStartEmpty';
import { deriveStarters, isInvitedCreatorRole } from '../starters';
import { postCardModel, postLink, roleBadgeKey, type ReportReason } from './format';
import { reportReasonText } from './ReportFlow';
import { track } from '../../../lib/analytics';
import { SectionSlide, SlidingIndicator, useRowWidth } from '../../../core/design/sectionSlide';

function Header({
  onSearch,
  onNotifications,
  onCompose,
  showCompose,
  showBell,
  unread,
  finalHeader = true,
}: {
  onSearch: () => void;
  onNotifications: () => void;
  onCompose: () => void;
  showCompose: boolean;
  showBell: boolean;
  unread: number;
  /** G15 — Final başlığı (+ yok, zilde nokta). */
  finalHeader?: boolean;
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
      <AppText textRole="screenTitle" style={styles.title}>
        {tr('kesfet.title')}
      </AppText>
      <View style={styles.headerIcons}>
        <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel={tr('kesfet.ui.a11y.search')} style={styles.iconBtn}>
          <Icon name="search" size={24} color={t.color.ink} />
        </Pressable>
        {/* G15 — Final başlığında + yok: paylaş girişi Gün halkası şeridindeki
            "Günüm +" rozetine taşındı (özellik kaybı yok). */}
        {showCompose && !finalHeader ? (
          <Pressable onPress={onCompose} accessibilityRole="button" accessibilityLabel={tr('kesfet.ui.a11y.compose')} style={styles.iconBtn}>
            <Icon name="plus" size={24} color={t.color.ink} />
          </Pressable>
        ) : null}
        {showBell ? (
          <Pressable onPress={onNotifications} accessibilityRole="button" accessibilityLabel={tr('kesfet.ui.a11y.notifications')} style={styles.iconBtn}>
            <Icon name="bell" size={24} color={t.color.ink} />
            {unread > 0 && finalHeader ? (
              // Final: okunmamış varsa zilin sağ üstünde lime nokta (sayı yok).
              <Animated.View style={[styles.dot, { backgroundColor: t.color.accent, borderColor: t.color.bg }, badgePop.style]} />
            ) : unread > 0 ? (
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
  const [rowW, onRowLayout] = useRowWidth();
  const activeIndex = Math.max(0, items.findIndex((it) => it.key === tab));

  return (
    <View {...useOrientTarget('kesfet')} onLayout={onRowLayout} style={[styles.tabs, { borderBottomColor: t.color.line }]} accessibilityRole="tablist">
      {/* G21-S1 md.9: alt çizgi seçili sekmeye kayar (azaltılmışta opaklık). */}
      <SlidingIndicator
        testID="kesfet-tab-indicator"
        index={activeIndex}
        count={items.length}
        containerWidth={rowW}
        itemWidth={56}
        style={[styles.tabUnderline, { backgroundColor: t.color.ink }]}
      />
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
  // tab barına göre — `tabBarContentInset` (tek kaynak, shell/layout.ts; G16-S2). Stack
  // olarak açılınca (bildirim/derin bağlantı) bugünkü boşluk korunur.
  const asTab = route.params?.asTab === true;
  // G15 — YALNIZ __DEV__ vitrini: Final ara durumlarını açar (ör. 'comments',
  // 'didIt', 'posting'). Üretimde parametre hiç verilmez → undefined.
  const vitrin: string | undefined = __DEV__ ? route.params?.vitrin : undefined;
  const vitrinXray: boolean = __DEV__ ? route.params?.vitrinXray === true : false;
  // Vitrin: kaydırılmış durumlar (FinFeedScrollR3 / FinFeedTip) — ilk yüklemeden sonra.
  const vitrinScroll: number | undefined = __DEV__ ? route.params?.vitrinScroll : undefined;
  const listRef = useRef<any>(null);
  const { summary } = useNutritionSummary();
  const listBottomPad = asTab ? tabBarContentInset(insets.bottom) : insets.bottom + 120;
  // Kaydırınca tab barı küçült (yalnız sekme bağlamında; stack'te provider yok
  // → useTabBarCollapse no-op). scrollY → useTabBarCollapse (G11-CONTRACT m.39).
  const scrollY = useSharedValue(0);
  useTabBarCollapse(scrollY);
  // G15 — Final FinFeedScrollR3: aşağı kaydırınca tab bar küçülürken başlık + sekmeler
  // de katlanır (yukarı kaydırınca geri gelir). Yalnız sekme bağlamında (provider).
  const collapsed = useTabBarCollapsedValue();
  const headerH = useSharedValue(0);
  const headerHideStyle = useAnimatedStyle(() => {
    const c = collapsed ? collapsed.value : 0;
    if (!collapsed || headerH.value === 0) return {};
    return { height: headerH.value * (1 - c), opacity: 1 - c, overflow: 'hidden' };
  });
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const { t: tr, fmt, lang } = useT();
  const kesfetTakip = useFeature('kesfet_takip');
  // G8 bayrakları — her biri kapalıyken ilgili davranış HİÇ render olmaz.
  const kesfetPaylasim = useFeature('kesfet_paylasim');
  const kesfetYorum = useFeature('kesfet_yorum');
  // G18-S5 md.8: yerinde öğün menüsü (FinMoPopover) yalnız yeni kabukta; kapalıyken ⌄ = seçici sayfası (aynen).
  const yeniKabukMenu = useFeature('yeni_kabuk');
  const sosyalBildirim = useFeature('sosyal_bildirim');

  const unread = useNotificationsStore((s) => s.unread);
  const online = useIsOnline();

  const tab = useKesfetStore((s) => s.tab);
  const allPosts = useKesfetStore((s) => s.posts);
  // G15 — FinPosting: paylaşım durumu (Composer arka planda gönderir).
  const postingPhase = usePostingStore((s) => s.phase);
  const postingId = usePostingStore((s) => s.postId);
  const postingError = usePostingStore((s) => s.error);
  const postingRetry = usePostingStore((s) => s.retry);
  const [rulesOpen, setRulesOpen] = useState(false);
  // Ret: gönderi akışta gösterilmez, yerine sakin kart.
  const posts = useMemo(
    () => (postingPhase === 'rejected' && postingId ? allPosts.filter((p) => p.id !== postingId) : allPosts),
    [allPosts, postingPhase, postingId],
  );
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
  // G18-S4 md.4 — FinFollowingEmpty "Başlangıç için": for_you'daki kcal (Marka/Editör)
  // gönderileri; Takip boşken bir kez okunur. Gerçek veri yoksa bölüm gizli.
  const [starterPool, setStarterPool] = useState<FeedPost[]>([]);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [commentsPost, setCommentsPost] = useState<FeedPost | null>(null);
  // G15 — FinVideo kare 2: tam ekran oynatıcı (videoya dokun).
  const [videoPostId, setVideoPostId] = useState<string | null>(null);
  const videoPost = videoPostId ? posts.find((p) => p.id === videoPostId) ?? null : null;
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
  // G15 — FinActivityCard: "Ben de yaptım" süre sayfası + bu oturumda eklenenler ("✓ Yaptın").
  const [didItPost, setDidItPost] = useState<FeedPost | null>(null);
  const [didItDone, setDidItDone] = useState<ReadonlySet<string>>(() => new Set());

  // Hangi gönderi ekranda görünür — FeedVideo otomatik oynat/durdur (G8-S3).
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: FeedPost; isViewable: boolean }> }) => {
      const visible = viewableItems.find((v) => v.isViewable);
      setVisiblePostId(visible ? visible.item.id : null);
    },
  ).current;

  // İlk yükleme + gün halkaları. (Vitrin: `initialTab: 'following'` → Takip sekmesiyle aç.)
  useEffect(() => {
    if (__DEV__ && route.params?.initialTab === 'following') {
      void useKesfetStore.getState().setTab('following');
    } else if (useKesfetStore.getState().posts.length === 0) {
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

  useEffect(() => {
    if (vitrinScroll == null || posts.length === 0) return;
    const id = setTimeout(() => listRef.current?.scrollToOffset?.({ offset: vitrinScroll, animated: false }), 600);
    return () => clearTimeout(id);
  }, [vitrinScroll, posts.length]);

  // Vitrin (FinVideo kare 2): ilk video gönderisini tam ekran aç.
  useEffect(() => {
    if (vitrin !== 'videoFull') return;
    const v = posts.find((p) => p.media.some((m) => m.kind === 'video'));
    if (v) setVideoPostId(v.id);
  }, [vitrin, posts]);

  // Paylaşım durumu: "Yayında" birkaç saniye görünür; "İnceleniyor"da sunucu
  // durumu aralıklı sorulur (yayımlandı → Yayında; kaldırıldı → sakin ret kartı).
  useEffect(() => {
    if (vitrin) return;
    if (postingPhase === 'published') {
      const id = setTimeout(() => usePostingStore.getState().clear(), 3500);
      return () => clearTimeout(id);
    }
    if (postingPhase !== 'reviewing' || !postingId) return;
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      const p = await getKesfetClient().getPost({ post: postingId }).catch(() => null);
      if (p?.status === 'published') {
        usePostingStore.getState().set('published');
        void useKesfetStore.getState().refresh();
      } else if (p?.status === 'removed') {
        usePostingStore.getState().set('rejected');
      }
      if (tries >= 15) clearInterval(iv);
    }, 8000);
    return () => clearInterval(iv);
  }, [postingPhase, postingId, vitrin]);

  // Vitrin (FinPosting kareleri): durum satırı + kendi gönderim.
  useEffect(() => {
    const map: Record<string, PostingPhase> = { posting: 'uploading', reviewing: 'reviewing', published: 'published', rejected: 'rejected' };
    if (!vitrin || !map[vitrin]) return;
    usePostingStore.getState().set(map[vitrin], { postId: 'post-p1' });
  }, [vitrin]);

  // Vitrin (FinAddToast): loglama sonrası toast'ı göster ("Öğle’ye loglandı · Geri al · Gör").
  useEffect(() => {
    if (vitrin !== 'addToast' || posts.length === 0) return;
    setToast({
      message: tr('kesfet.ui.logged_to', { meal: tr('kesfet.ui.meal_dat.lunch') }),
      undoLabel: tr('common.undo'),
      onUndo: () => {},
      actionLabel: tr('kesfet.ui.view_day'),
      onAction: () => {},
    });
  }, [vitrin, posts.length, tr]);

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
  // (gerçek veri; uydurma yok). Takip boşken gösterilir. G15: Takip sekmesiyle
  // açılınca (henüz for_you yüklenmemiş) for_you bir kez okunur; kısa tanıtım
  // herkese açık profilden (bio) gelir — yoksa yalnız @kullanıcı adı.
  const suggestionsFrom = useCallback((list: FeedPost[]) => {
    const seen = new Map<string, SuggestedAccount>();
    for (const p of list) {
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
    return Array.from(seen.values());
  }, []);
  useEffect(() => {
    if (tab !== 'for_you') return;
    const next = suggestionsFrom(posts);
    if (next.length > 0) setSuggestions(next);
  }, [tab, posts, suggestionsFrom]);
  const showFollowingEmptyNow = tab === 'following' && !loading && !error && posts.length === 0;
  const bioFetched = useRef(false);
  useEffect(() => {
    if (!showFollowingEmptyNow || bioFetched.current) return;
    bioFetched.current = true;
    let alive = true;
    void (async () => {
      let list = suggestions;
      const page = await getKesfetClient().getFeed({ tab: 'for_you', lang }).catch(() => null);
      if (alive && page) setStarterPool(page.items);
      if (list.length === 0) {
        list = page ? suggestionsFrom(page.items) : [];
      }
      const withBio = await Promise.all(
        list.map(async (a) => {
          const prof = await getProfilClient().getPublicProfile({ handle: a.handle }).catch(() => null);
          return { ...a, bio: prof?.bio ?? null };
        }),
      );
      if (alive && withBio.length > 0) setSuggestions(withBio);
    })();
    return () => {
      alive = false;
    };
  }, [showFollowingEmptyNow, suggestions, suggestionsFrom, lang]);

  const nowMs = Date.now();
  // G15 — FinFeedTip balonu ilk öğün kartlı gönderinin logla düğmesine çapalanır.
  const firstMealPostId = useMemo(() => posts.find((p) => p.meal_card != null)?.id ?? null, [posts]);

  const onShare = useCallback(async (post: FeedPost) => {
    try {
      const r = await Share.share({ message: postLink(post.id), url: postLink(post.id) });
      if (r?.action !== Share.dismissedAction) track('share', { target: 'post', surface: 'kesfet' });
    } catch {
      // kullanıcı iptal etti
    }
  }, []);

  // Tek loglama yolu — hem hızlı logla (dokun) hem seçiciden (sheet) buraya gelir.
  // addToDay → uçuş olayı (`kcal:logFlight`, her yolda) → "Logla izi"; toast'ı kabuk
  // çizer ("<Öğün> loglandı · Geri al · Gör" — Gör = Ana sayfa). Geri al kaydı siler.
  const logMeal = useCallback(
    async (post: FeedPost, mealType: MealType, portion: number, frame?: LogOriginFrame) => {
      addSeq.current += 1;
      const key = `kesfet-${post.id}-${mealType}-${portion}-${addSeq.current}`;
      const consumptionId = await useKesfetStore.getState().addToDay(post.id, mealType, portion, key);
      if (!consumptionId) return;
      // G19-S4 md.2: Keşfet logu tam 1 log_add — uçuş yalnız çerçeve varken yayınlandığı için
      // köprüye bırakılmaz (çerçevesiz sheet yolu sayılmıyordu; kaynak/kcal da gitmiyordu).
      const kcal = Math.round((post.meal_card?.kcal ?? 0) * portion);
      trackEvent({ name: 'log_add', props: { source: 'kesfet', slot: mealType, kcal, offline: false } });
      const mealLabel = tr(`meal.${mealType}`);
      // G21-S1 md.4: logla sonrası TEK toast = kabuk toast'ı ("<Öğün> loglandı · Geri al · Gör").
      // Uçuş her yolda yayınlanır (çerçevesiz sheet yolunda w/h 0 → kabuk uçuşsuz rozet +
      // toast); kayıt id'si + kaydı GERÇEKTEN silen `undo` taşınır. Keşfet kendi log
      // toast'ını artık göstermez (önceden iki toast aynı yerde üst üste biniyordu).
      const hasFrame = !!frame && (frame.w > 0 || frame.h > 0);
      emitLogFlight({
        x: hasFrame ? frame!.x : 0,
        y: hasFrame ? frame!.y : 0,
        w: hasFrame ? frame!.w : 0,
        h: hasFrame ? frame!.h : 0,
        imageUri: post.meal_card?.photo_url ?? null,
        mealLabel,
        source: 'kesfet',
        kcal,
        id: consumptionId,
        // Kabuk "Geri al" → meal_consumptions satırı silinir (logUndo'yu kabuk yayınlar).
        undo: async () => {
          const ok = await useKesfetStore.getState().undoAddToDay(post.id, consumptionId, key);
          if (ok) trackEvent({ name: 'log_delete', props: { source: 'kesfet', slot: mealType, undone: false } });
          else setToast({ message: tr('kesfet.ui.undo_failed') });
        },
      });
      // "Logla izi" — ekran içi kısa yankı (yemek noktaya iner, yay çizip uçar).
      trailSeq.current += 1;
      setTrail({ token: trailSeq.current, label: post.meal_card?.name ?? '' });
    },
    [tr],
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
    (post: FeedPost, frame: LogOriginFrame, meal?: MealType, portion?: number) => {
      touchSocial();
      const mealType = meal ?? inferMealTypeFromHour(new Date().getHours());
      void logMeal(post, mealType, portion ?? 1, frame);
    },
    [logMeal, touchSocial],
  );

  // Saate göre hızlı loglanacak öğünün etiketi — kartlardaki düğme bunu gösterir.
  const quickMealType = inferMealTypeFromHour(new Date().getHours());
  const quickMealLabel = tr(`meal.${quickMealType}`);
  // G15 — doğru yönelme ekiyle tam düğme metni ("Kahvaltı’ya logla" · "Öğle’ye logla").
  const quickLogLabel = tr('kesfet.ui.meal_card.log_to', { meal: tr(`kesfet.ui.meal_dat.${quickMealType}`) });
  // G15 — "Kalori hedefine uyar": bugünkü kalan kalori (sunucu özeti) varsa.
  const remainingKcal = summary && summary.targetKcal > 0 ? summary.remainingKcal : null;

  // Sonuç PostMenu içinde gösterilir (FinReportDone/FinReportNotice) — burada
  // toast YOK, yalnız başarı/başarısızlığı döndürür.
  const onReport = useCallback(
    (post: FeedPost, reason: ReportReason, note?: string) =>
      useKesfetStore.getState().report('post' as ReportTargetType, post.id, reportReasonText(reason, note ?? '')),
    [],
  );

  // G15 — FinReportDone "Sessize al" / "Benzerlerini daha az göster": sunucu
  // karşılığı yok (SORULAR) → yalnız bu oturumun akışından düşer.
  const onMute = useCallback(
    (post: FeedPost) => {
      useKesfetStore.setState((s) => ({ posts: s.posts.filter((p) => p.author.id !== post.author.id) }));
      setToast({ message: tr('kesfet.report.muted_toast', { name: post.author.display_name }) });
    },
    [tr],
  );
  const onLessLike = useCallback(
    (post: FeedPost) => {
      useKesfetStore.setState((s) => ({ posts: s.posts.filter((p) => p.id !== post.id) }));
      setToast({ message: tr('kesfet.report.less_toast') });
    },
    [tr],
  );

  // G15 — YALNIZ __DEV__ vitrini: FinComments kare 1–3 — ilk gönderinin yorumları açık.
  useEffect(() => {
    if ((vitrin !== 'comments' && vitrin !== 'commentsMenu') || posts.length === 0) return;
    setCommentsPost(posts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitrin, posts.length]);

  // G15 — YALNIZ __DEV__ vitrini: FinPostMenu / Block / Report / ReportDone — ilk
  // gönderinin ⋯ menüsü ilgili adımda açılır.
  const vitrinMenuStep =
    vitrin === 'menu' || vitrin === 'block' || vitrin === 'report' || vitrin === 'reportDone' ? vitrin : undefined;
  useEffect(() => {
    if (!vitrinMenuStep || posts.length === 0) return;
    setMenuPost(posts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitrinMenuStep, posts.length]);

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
        const res = await getProfilClient().follow({ user: userId, on: true });
        track('follow', { on: true, state: res?.state, surface: 'kesfet_suggest' });
        if (useKesfetStore.getState().tab === 'following') void useKesfetStore.getState().refresh();
      } catch {
        // yut — öneri zaten listeden düştü
      }
    },
    [],
  );

  const onDidIt = useCallback(
    async (post: FeedPost, chosenMinutes?: number) => {
      touchSocial();
      didItSeq.current += 1;
      const key = `didit-${post.id}-${didItSeq.current}`;
      const minutes = chosenMinutes ?? post.activity_card?.minutes ?? null;
      const kcal = await useKesfetStore.getState().didIt(post.id, minutes, key);
      if (kcal != null) {
        // FinActivityCard kare 3: kart "✓ Yaptın" + "Etkinliğin eklendi · Günüme paylaş".
        setDidItDone((prev) => new Set(prev).add(post.id));
        setToast({
          message: tr('kesfet.activity.logged'),
          actionLabel: tr('kesfet.activity.share_day'),
          onAction: () => {},
        });
      }
      // Başarısızlık sessiz: kcal null ise toast yok (olumsuz an sessiz — motion §2).
    },
    [touchSocial, tr],
  );

  // G15 — YALNIZ __DEV__ vitrini: FinActivityCard kare 2 (süre sayfası) / kare 3
  // (eklendi + toast) ilk etkinlik gönderisiyle açılır.
  useEffect(() => {
    if (vitrin !== 'didIt' && vitrin !== 'didItToast') return;
    const first = posts.find((p) => p.post_type === 'etkinlik' && p.activity_card);
    if (!first) return;
    if (vitrin === 'didIt') setDidItPost(first);
    else {
      setDidItDone(new Set([first.id]));
      setToast({ message: tr('kesfet.activity.logged'), actionLabel: tr('kesfet.activity.share_day'), onAction: () => {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitrin, posts.length]);

  const onDeletePost = useCallback(async (post: FeedPost) => {
    const ok = await useKesfetStore.getState().deletePost(post.id);
    if (ok) setToast({ message: tr('kesfet.ui.post_deleted') });
  }, [tr]);

  const renderItem = useCallback(
    ({ item, index }: { item: FeedPost; index: number }) => {
      const base = postCardModel(item, nowMs, lang);
      // Durum satırı görünürken kartın kendi "İnceleniyor" etiketi tekrar etmesin.
      const inPosting = item.id === postingId && postingPhase !== 'idle';
      const model = inPosting ? { ...base, pending: false } : base;
      const faded = inPosting && (postingPhase === 'uploading' || postingPhase === 'publishing' || postingPhase === 'reviewing');
      return (
        <View style={faded ? styles.faded : undefined}>
          <PostCard
            model={model}
            index={index}
            showComment={kesfetYorum}
            isVisible={item.id === visiblePostId}
            quickMealLabel={quickMealLabel}
            quickLogLabel={quickLogLabel}
            tip={
              showFeedTip && item.id === firstMealPostId ? <FeedTip onDismiss={() => setShowFeedTip(false)} /> : undefined
            }
            fitsGoal={remainingKcal != null && item.meal_card != null ? item.meal_card.kcal <= remainingKcal : undefined}
            plateOpen={vitrinXray}
            onOpen={() => navigation.navigate('SharedPost', { postId: item.id })}
            // G21-S1 md.8 (#D1): avatar / ad → açık profil (takip düğmesi oradan; önce yalnız bildirimden ulaşılıyordu).
            onOpenAuthor={
              item.author.handle
                ? () => navigation.navigate('PublicProfile', { handle: item.author.handle.replace(/^@/, '') })
                : undefined
            }
            onOpenVideo={() => setVideoPostId(item.id)}
            onLike={() => {
              touchSocial();
              void useKesfetStore.getState().react(item.id, 'like', !item.me.liked);
            }}
            onSave={() => useKesfetStore.getState().react(item.id, 'save', !item.me.saved)}
            onShare={() => onShare(item)}
            quickMeal={yeniKabukMenu ? quickMealType : undefined}
            onQuickLog={(frame, meal, portion) => onQuickLog(item, frame, meal, portion)}
            onOpenSheet={() => setSheetPost(item)}
            onOpenMenu={() => setMenuPost(item)}
            onComment={() => {
              touchSocial();
              setCommentsPost(item);
            }}
            onDidIt={() => setDidItPost(item)}
            didItDone={didItDone.has(item.id)}
          />
        </View>
      );
    },
    [nowMs, lang, onShare, kesfetYorum, touchSocial, didItDone, visiblePostId, quickMealLabel, onQuickLog, quickLogLabel, quickMealType, yeniKabukMenu, remainingKcal, vitrinXray, navigation, showFeedTip, firstMealPostId, postingId, postingPhase],
  );

  // G18-S4 md.4: akış boşken (FinFeedEmpty/FinFollowingEmpty) başka halka yoksa
  // "Günüm" + açıklama satırı; akış doluyken bugünkü davranış aynen.
  const feedIsEmpty = !loading && !error && posts.length === 0;
  const ringStrip = useMemo(
    () =>
      rings.length > 0 || feedIsEmpty ? (
        <RingStrip
          rings={rings}
          onOpen={(userId) => setViewerUserId(userId)}
          onAddMine={kesfetPaylasim ? () => navigation.navigate('Composer') : undefined}
          emptyHint={feedIsEmpty}
        />
      ) : null,
    [rings, kesfetPaylasim, navigation, feedIsEmpty],
  );

  const feedHeader = (
    <>
      {ringStrip}
      <PostingStatus
        phase={postingPhase}
        error={postingError}
        onRetry={postingRetry}
        onRules={() => setRulesOpen(true)}
        onEdit={(() => {
          const own = allPosts.find((p) => p.id === postingId);
          return own ? () => setEditPost(own) : undefined;
        })()}
      />
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
  } else if (posts.length === 0) {
    // G18-S4 md.4 — FinFeedEmpty / FinFollowingEmpty (Final). Başlangıç kartları ve
    // davetli üreticiler YALNIZ gerçek akış verisinden (yoksa gizli).
    const startEmpty = (
      <FeedStartEmpty
        variant={showFollowingEmpty ? 'following' : 'for_you'}
        starters={deriveStarters(showFollowingEmpty ? starterPool : posts)}
        creators={suggestions.filter((a) => isInvitedCreatorRole(a.role))}
        onOpenPost={(postId) => navigation.navigate('SharedPost', { postId })}
        onFollow={onFollow}
        onCompose={kesfetPaylasim ? () => navigation.navigate('Composer') : undefined}
      />
    );
    body = (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: listBottomPad }}>
        {feedHeader}
        {startEmpty}
      </ScrollView>
    );
  } else {
    body = (
      <Animated.FlatList
        ref={listRef}
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
      {/* G15 — koyu temada durum çubuğu yazısı açık (Final -Dark panoları). */}
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Animated.View style={headerHideStyle} onLayout={(e) => {
          // Yalnız açıkken ölç (katlanırken gelen küçük yükseklikler ölçüyü bozmasın).
          const h = e.nativeEvent.layout.height;
          if (h > 0 && (headerH.value === 0 || (collapsed?.value ?? 0) === 0)) headerH.value = h;
        }}>
      <Header
        onSearch={() => {}}
        onNotifications={() => navigation.navigate('KesfetNotifications')}
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
      </Animated.View>
      {/* G21-S1 md.9: Senin için ↔ Takip — içerik yatay kayarak geçer. */}
      <SectionSlide index={tab === 'following' ? 1 : 0} style={styles.content} testID="kesfet-section">
        {body}
      </SectionSlide>

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
        onReport={(reason, note) => (menuPost ? onReport(menuPost, reason, note) : false)}
        onBlock={() => menuPost && void onBlock(menuPost)}
        onMute={() => menuPost && onMute(menuPost)}
        onLessLike={() => menuPost && onLessLike(menuPost)}
        vitrinStep={vitrinMenuStep}
        vitrinNote={vitrinMenuStep ? route.params?.vitrinNote : undefined}
        onDelete={() => menuPost && void onDeletePost(menuPost)}
        onEdit={() => setEditPost(menuPost)}
      />
      <EditPostSheet
        visible={editPost != null}
        initialBody={editPost?.body ?? ''}
        onClose={() => setEditPost(null)}
        onSave={onEditSave}
      />
      <DidItSheet
        visible={didItPost != null}
        activity={didItPost?.activity_card ?? null}
        authorName={didItPost?.author.display_name ?? ''}
        initialMinutes={vitrin === 'didIt' ? 30 : undefined}
        onClose={() => setDidItPost(null)}
        onAdd={(minutes) => {
          const post = didItPost;
          setDidItPost(null);
          if (post) void onDidIt(post, minutes);
        }}
      />
      {/* Vitrin (YALNIZ __DEV__) karesinde toast kendiliğinden kapanmaz — görüntü alınabilsin. */}
      <VideoPlayer
        post={videoPost}
        onClose={() => setVideoPostId(null)}
        onLike={() => videoPost && void useKesfetStore.getState().react(videoPost.id, 'like', !videoPost.me.liked)}
        onSave={() => videoPost && void useKesfetStore.getState().react(videoPost.id, 'save', !videoPost.me.saved)}
        onShare={() => videoPost && void onShare(videoPost)}
        onComment={
          kesfetYorum
            ? () => {
                const p = videoPost;
                setVideoPostId(null);
                if (p) setCommentsPost(p);
              }
            : undefined
        }
      />
      <RulesSheet visible={rulesOpen} onAccept={() => setRulesOpen(false)} onClose={() => setRulesOpen(false)} />
      <AddToast toast={toast} onDismiss={() => (vitrin ? undefined : setToast(null))} />

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
          count={commentsPost?.stats.comments}
          onClose={() => setCommentsPost(null)}
          onToast={(message) => setToast({ message })}
          vitrinMenu={vitrin === 'commentsMenu'}
        />
      ) : null}

      {sosyalBildirim ? (
        <>
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
  dot: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#0A0A0A', fontSize: 10, fontWeight: '800', lineHeight: 14 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tabUnderline: { position: 'absolute', bottom: 0, width: 56, height: 3, borderRadius: 2 },
  content: { flex: 1 },
  faded: { opacity: 0.6 },
  footer: { paddingVertical: 20, alignItems: 'center' },
  trailOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});

export default KesfetScreen;
