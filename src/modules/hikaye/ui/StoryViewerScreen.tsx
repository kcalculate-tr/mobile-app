// G59-S1 — Hikâye görüntüleyici (docs/g59/design/FinStoryViewer.dc.html `state` = view · coach · reply).
// Hikâye alanı köşe 20, üst degrade %50 / alt %40; ilerleme çubukları (3 pt, aralık 4, iz %38 beyaz, doğrusal dolum:
// foto 5 sn, video kendi süresi); yazar satırı (32 avatar, ad 14/700, "3 sa" 13/500), Diğer seçenekler + Kapat (44).
// Dokunma: sol üçte bir = önceki, sağ üçte iki = sonraki, basılı tut = duraklat (başlık 220 ms solar; haptik yok).
// Jest: aşağı kaydır = kapat, yana kaydır = sonraki/önceki kişi, yukarı kaydır = hızlı tepkiler (başkası) / Görenler
// (sahibi). `coach` = ilk açılışta gezinme ipucu (bir kez) + kendi hikâyende kcalAI Koç ipucu kartı (koç bayrağı açıksa).
// `reply` = hızlı tepkiler; G63-S1: `mesajlar` açıkken altta serbest metin yanıtı (DM `kind='story_reply'`,
// G59 tasarımındaki yanıt alanı: 48 pt alan, 2 pt çerçeve, 48 pt gönder — taslak varken lime). Kapalıyken AYNEN. Reduce Motion: kişi geçişi / kapanış 200 ms opaklık.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Image as RNImage, KeyboardAvoidingView, PanResponder, Platform, Pressable, Share, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { CURVE, DURATION, fontFamily, haptic, useReducedMotion, useTheme } from '../../../core/design';
import { useFeature } from '../../../core/flags';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { CachedImage } from '../../../components/CachedImage';
import { toServerMealType } from '../../../core/meal/mealType';
import { slotFromHour } from '../../gun/homeData';
import type { RootStackParamList } from '../../../navigation/types';
import { ReportModal, reportReasonText } from '../../kesfet/ui/ReportFlow';
import { BottomSheet } from '../../kesfet/ui/BottomSheet';
import { AddToast, type ToastState } from '../../kesfet/ui/AddToast';
import { getStoryClient, storyMediaUrl } from '../client';
import { classifySwipe, firstUnseenIndex, formatAgo, jumpUser, nextPos, prevPos, QUICK_REACTIONS, storyDurationMs, tapZone, type ViewerPos } from '../rules';
import { useStoryTray } from '../store';
import type { Story, StoryOverlay, StoryReactionKind } from '../types';
import { HEART, LIME, LIME_INK, OM_BG, OM_SOLID, storyTheme } from './tokens';
import { OverlayAt, StoryBackground, StoryCanvas } from './StoryCanvas';
import type { StickerInteract } from './StorySticker';
import { REACTION_KEY, StoryViewersSheet } from './StoryViewersSheet';
import { useShareSheet } from '../../../components/share/useShareSheet';
import { HighlightSheet } from './Highlights';
import { useReduceTransparency } from './a11y';
import { getDmClient } from '../../mesajlar/client';
import { cleanBody, errorKey as dmErrorKey, newIdem, rpcCode } from '../../mesajlar/rules';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rp = RouteProp<RootStackParamList, 'StoryViewer'>;

const COACH_KEY = '@kcal_story_coach_seen';
const P_X = 'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z';
const P_DOTS = 'M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm56-12a12,12,0,1,0,12,12A12,12,0,0,0,196,116ZM60,116a12,12,0,1,0,12,12A12,12,0,0,0,60,116Z';
const P_PAUSE = 'M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z';
const P_PLUS = 'M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z';
const P_CARET_R = 'M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z';
const P_CARET_L = 'M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z';
const P_CARET_UP = 'M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z';
const P_HEART = 'M178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40ZM128,214.8C109.74,204.16,32,155.69,32,102A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,155.61,146.24,204.15,128,214.8Z';
const P_HEART_F = 'M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z';
const P_SEND = 'M231.87,114l-168-95.89A16,16,0,0,0,40.92,37.34L71.55,128,40.92,218.67A16,16,0,0,0,56,240a16.15,16.15,0,0,0,7.93-2.1l167.92-96.05a16,16,0,0,0,.05-27.89ZM56,224a.56.56,0,0,0,0-.12L85.74,136H144a8,8,0,0,0,0-16H85.74L56.06,32.16A.46.46,0,0,0,56,32l168,95.83Z';
const P_EYE = 'M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,160a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z';

const GLASS = { trophy: require('../../../../assets/glass/trophy.png'), bowl: require('../../../../assets/glass/bowl.png') };

interface Group {
  userId: string;
  name: string;
  handle: string | null;
  avatar: string | null;
  stories: Story[] | null;
  error: boolean;
}

function VideoStory({ uri, paused }: { uri: string; paused: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ev = require('expo-video') as typeof import('expo-video');
  const player = ev.useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });
  useEffect(() => {
    try {
      if (paused) player.pause();
      else player.play();
    } catch {
      // oynatıcı serbest bırakıldı
    }
  }, [paused, player]);
  return <ev.VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

function ProgressBars({ count, index, progress }: { count: number; index: number; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({ width: `${Math.round(progress.value * 1000) / 10}%` }));
  return (
    <View style={styles.bars}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.bar}>
          {i < index ? <View style={[styles.barFill, { width: '100%' }]} /> : i === index ? <Animated.View style={[styles.barFill, fill]} /> : null}
        </View>
      ))}
    </View>
  );
}

const INTERACTIVE: ReadonlyArray<StoryOverlay['kind']> = ['meal', 'poll', 'recipe', 'mention'];

export default function StoryViewerScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rp>();
  const params = route.params ?? {};
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const { t: tr, lang } = useT();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const reduced = useReducedMotion();
  const solid = useReduceTransparency();
  const om = solid ? OM_SOLID : OM_BG;
  const { user } = useAuth();
  const koc = useFeature('koc');
  const paylasimBaglanti = useFeature('paylasim_baglanti');
  // G63-S1: serbest metin yanıtı yalnız `mesajlar` açıkken.
  const mesajlar = useFeature('mesajlar');
  const trayItems = useStoryTray((s) => s.items);
  const markSeenTray = useStoryTray((s) => s.markSeen);
  const refreshTray = useStoryTray((s) => s.refresh);
  const client = getStoryClient();
  const me = user?.id ?? null;

  // ── kişi grupları ────────────────────────────────────────────────────────────
  const initialGroups = useMemo<Group[]>(() => {
    if (params.highlightId) {
      return [{ userId: params.highlightOwnerId ?? '', name: params.title ?? params.ownerName ?? '', handle: null, avatar: params.ownerAvatar ?? null, stories: null, error: false }];
    }
    const ids = params.userIds?.length ? params.userIds : params.startUserId ? [params.startUserId] : [];
    return ids.map((id) => {
      const it = trayItems.find((x) => x.user_id === id);
      return { userId: id, name: it?.is_me ? tr('hikaye.your_story') : it?.display_name ?? params.ownerName ?? '', handle: it?.handle ?? null, avatar: it?.avatar_url ?? params.ownerAvatar ?? null, stories: null, error: false };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const startUser = Math.max(0, initialGroups.findIndex((g) => g.userId === params.startUserId));
  const [pos, setPos] = useState<ViewerPos>({ user: params.highlightId ? 0 : startUser, story: -1 });
  const [nowMs] = useState(Date.now());

  const loadGroup = useCallback(
    async (gi: number) => {
      const g = groups[gi];
      if (!g || g.stories) return;
      try {
        const list = params.highlightId ? await client.getHighlightStories({ highlight: params.highlightId }) : await client.getUserStories({ user: g.userId });
        setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, stories: list, error: false } : x)));
      } catch {
        setGroups((gs) => gs.map((x, i) => (i === gi ? { ...x, stories: [], error: true } : x)));
      }
    },
    [groups, client, params.highlightId],
  );
  useEffect(() => {
    void loadGroup(pos.user);
    void loadGroup(pos.user + 1);
  }, [pos.user, loadGroup]);

  const group = groups[pos.user];
  const stories = group?.stories ?? null;
  // İlk açılış: ilk görülmemiş hikâye (öne çıkanda baştan).
  useEffect(() => {
    if (stories && pos.story < 0) setPos((p) => ({ ...p, story: params.highlightId ? 0 : firstUnseenIndex(stories) }));
  }, [stories, pos.story, params.highlightId]);
  const story = stories && pos.story >= 0 ? stories[pos.story] ?? null : null;
  const own = !!story && story.author_id === me;

  // ── hâller ──────────────────────────────────────────────────────────────────
  const [holding, setHolding] = useState(false);
  const [reply, setReply] = useState(__DEV__ && params.vitrinState === 'reply');
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [viewers, setViewers] = useState(!!params.openViewers);
  const [hlSheet, setHlSheet] = useState(false);
  const [mealPop, setMealPop] = useState<string | null>(null);
  const [coach, setCoach] = useState(false);
  const [tipClosed, setTipClosed] = useState(false);
  const [bg, setBg] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [replyText, setReplyText] = useState(__DEV__ && params.vitrinReplyText ? params.vitrinReplyText : '');
  const [replySending, setReplySending] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(COACH_KEY)
      .then((v) => {
        if (v !== '1') setCoach(true);
      })
      .catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => setBg(s !== 'active'));
    return () => sub.remove();
  }, []);
  const paused = holding || reply || menu || report || viewers || hlSheet || !!mealPop || coach || bg || !story;

  // ── ilerleme ────────────────────────────────────────────────────────────────
  const progress = useSharedValue(0);
  const close = useCallback(() => {
    if (nav.canGoBack()) nav.goBack();
  }, [nav]);
  const counts = groups.map((g) => (g.stories ? g.stories.length : 1));
  const goNext = useCallback(() => {
    const n = nextPos({ user: pos.user, story: Math.max(0, pos.story) }, counts);
    if (n === 'end') return close();
    setMealPop(null);
    progress.value = 0;
    setPos(n.user !== pos.user ? { user: n.user, story: -1 } : n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, counts.join(','), close]);
  const goPrev = useCallback(() => {
    const p = prevPos({ user: pos.user, story: Math.max(0, pos.story) }, counts);
    setMealPop(null);
    progress.value = 0;
    if (p.user !== pos.user) {
      const prevCount = groups[p.user]?.stories?.length ?? 1;
      setPos({ user: p.user, story: Math.max(0, prevCount - 1) });
    } else setPos(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, counts.join(','), groups]);
  const goUser = useCallback(
    (dir: 1 | -1) => {
      const j = jumpUser(pos, counts, dir);
      if (j === 'end') return close();
      if (!j) return;
      progress.value = 0;
      setMealPop(null);
      setPos({ user: j.user, story: -1 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pos, counts.join(','), close],
  );
  const nextRef = useRef(goNext);
  nextRef.current = goNext;
  const finish = useCallback(() => nextRef.current(), []);

  const duration = story ? storyDurationMs(story) : 5000;
  useEffect(() => {
    progress.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);
  useEffect(() => {
    if (!story) return;
    if (paused) {
      cancelAnimation(progress);
      return;
    }
    const remaining = Math.max(50, duration * (1 - progress.value));
    progress.value = withTiming(1, { duration: remaining, easing: CURVE.linear }, (done) => {
      if (done) runOnJS(finish)();
    });
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused, duration]);

  // ── görüldü ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!story || own || story.seen || params.highlightId) return;
    const id = story.id;
    setGroups((gs) => gs.map((g, i) => (i === pos.user && g.stories ? { ...g, stories: g.stories.map((s) => (s.id === id ? { ...s, seen: true } : s)) } : g)));
    markSeenTray(story.author_id, 1);
    void client.markViewed({ story: id }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  const patchStory = useCallback(
    (id: string, fn: (s: Story) => Story) =>
      setGroups((gs) => gs.map((g) => (g.stories ? { ...g, stories: g.stories.map((s) => (s.id === id ? fn(s) : s)) } : g))),
    [],
  );

  // ── tepkiler / anket / öğün ─────────────────────────────────────────────────
  const react = useCallback(
    (kind: StoryReactionKind) => {
      if (!story || own) return;
      const on = !story.my_reactions.includes(kind);
      haptic(on ? 'success' : 'selection');
      patchStory(story.id, (s) => ({ ...s, my_reactions: on ? [...s.my_reactions, kind] : s.my_reactions.filter((k) => k !== kind) }));
      void client.react({ story: story.id, kind, on }).catch(() => patchStory(story.id, (s) => ({ ...s, my_reactions: on ? s.my_reactions.filter((k) => k !== kind) : [...s.my_reactions, kind] })));
      if (kind !== 'like' && on) {
        setToast({ message: tr('hikaye.reaction_sent'), success: true });
        setTimeout(() => setReply(false), 500);
      }
    },
    [story, own, client, patchStory, tr],
  );
  const vote = useCallback(
    (sticker: string, option: number) => {
      if (!story || own) return;
      patchStory(story.id, (s) => ({ ...s, my_votes: { ...s.my_votes, [sticker]: option } }));
      void client
        .votePoll({ story: story.id, sticker, option })
        .then((r) => patchStory(story.id, (s) => ({ ...s, my_votes: { ...s.my_votes, [sticker]: r.option }, poll_results: { ...s.poll_results, [sticker]: r.counts } })))
        .catch(() => undefined);
    },
    [story, own, client, patchStory],
  );
  const tapped = useRef(new Set<string>());
  const onMeal = useCallback(
    (sticker: string) => {
      if (!story) return;
      setMealPop((v) => (v === sticker ? null : sticker));
      const key = `${story.id}:${sticker}`;
      if (!own && !tapped.current.has(key)) {
        tapped.current.add(key);
        void client.stickerTap({ story: story.id, sticker }).catch(() => undefined);
      }
    },
    [story, own, client],
  );
  const addMeal = useCallback(async () => {
    if (!story || !mealPop) return;
    const sticker = mealPop;
    setMealPop(null);
    try {
      await client.addMealToDay({
        story: story.id,
        sticker,
        mealType: toServerMealType(slotFromHour(new Date().getHours())),
        idempotencyKey: `story-${story.id}-${sticker}-${me ?? 'anon'}`,
      });
      haptic('success');
      setToast({ message: tr('hikaye.added_to_log'), success: true });
    } catch {
      haptic('warning');
      setToast({ message: tr('hikaye.add_failed') });
    }
  }, [story, mealPop, client, me, tr]);

  const interactFor = useCallback(
    (o: StoryOverlay): StickerInteract | undefined => {
      if (!story) return undefined;
      if (o.kind === 'poll') return { myVote: story.my_votes[o.id] ?? null, results: story.poll_results[o.id] ?? null, onVote: own ? undefined : (i) => vote(o.id, i) };
      if (o.kind === 'meal') return { onMealPress: own ? undefined : () => onMeal(o.id), mealExpanded: mealPop === o.id };
      if (o.kind === 'mention') return { onMentionPress: (h) => nav.push('PublicProfile', { handle: h }) };
      return undefined;
    },
    [story, own, vote, onMeal, mealPop, nav],
  );

  // ── menü eylemleri ──────────────────────────────────────────────────────────
  // G61-S1 md.5 (FinShareEntry "Hikâye görenler"): iki paylaşım bayrağı da açıkken hikâye kartı
  // (katmanlar + l.eatkcal.com/s/<id>); görenler / tepkiler / konum karta GİRMEZ. Değilse bugünkü davranış.
  const shareKit = useShareSheet('story_viewers');
  const shareStory = useMemo(() => {
    const h = group?.handle;
    if (shareKit.enabled && story) {
      return () => {
        const text = story.overlays.find((o) => o.kind === 'text');
        const meal = story.overlays.find((o) => o.kind === 'meal');
        const photo = story.media_type === 'image' ? storyMediaUrl(story.media_url) : story.media_type === 'video' ? storyMediaUrl(story.thumb_url) : null;
        shareKit.open(
          {
            kind: 'story',
            data: {
              photoUri: photo,
              text: text && text.kind === 'text' ? text.data.text : null,
              mealName: meal && meal.kind === 'meal' ? meal.data.name : null,
              mealKcal: meal && meal.kind === 'meal' ? meal.data.kcal : null,
              mealImageUri: meal && meal.kind === 'meal' ? meal.data.image_url : null,
            },
          },
          story.id,
        );
      };
    }
    if (!paylasimBaglanti || !h) return undefined;
    return () => void Share.share({ message: `https://l.eatkcal.com/u/${h}` }).catch(() => undefined);
  }, [group?.handle, paylasimBaglanti, shareKit, story]);
  const deleteStory = useCallback(() => {
    if (!story) return;
    Alert.alert(tr('hikaye.delete_confirm'), tr('hikaye.delete_body'), [
      { text: tr('hikaye.keep'), style: 'cancel' },
      {
        text: tr('hikaye.del'),
        style: 'destructive',
        onPress: () => {
          const id = story.id;
          void client
            .deleteMyStory({ story: id })
            .then(() => {
              setViewers(false);
              setMenu(false);
              void refreshTray();
              const rest = (stories ?? []).filter((s) => s.id !== id);
              if (!rest.length) return close();
              setGroups((gs) => gs.map((g, i) => (i === pos.user ? { ...g, stories: rest } : g)));
              setPos((p) => ({ ...p, story: Math.min(p.story, rest.length - 1) }));
              setToast({ message: tr('hikaye.deleted'), success: true });
            })
            .catch(() => setToast({ message: tr('hikaye.load_failed') }));
        },
      },
    ]);
  }, [story, stories, client, refreshTray, close, pos.user, tr]);

  // ── jestler ─────────────────────────────────────────────────────────────────
  const dragY = useSharedValue(0);
  const fade = useSharedValue(1);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  // G63-S1: hikâyeye serbest metin yanıtı → DM (story_reply). Kurallar (istek, gizli hesap, engel, hız) sunucuda.
  const sendReply = async () => {
    const body = cleanBody(replyText);
    if (!body || !story || replySending || own) return;
    setReplySending(true);
    try {
      const dm = getDmClient();
      const { conversation_id } = await dm.open({ user: story.author_id });
      const res = await dm.send({ conversation: conversation_id, body, kind: 'story_reply', ref: { story_id: story.id }, idem: newIdem() });
      if (!res.ok) {
        setToast({ message: tr(dmErrorKey(res.error, 'scope' in res ? res.scope : undefined)) });
        return;
      }
      if (res.needs_moderation && (await dm.moderate({ message: res.id })) === 'blocked') {
        setToast({ message: tr('dm.err.not_sent') });
        return;
      }
      haptic('success');
      setReplyText('');
      setReply(false);
      setToast({ message: tr('dm.story.sent'), success: true });
    } catch (e) {
      setToast({ message: tr(dmErrorKey(rpcCode(e))) });
    } finally {
      setReplySending(false);
    }
  };

  const actions = useRef({ goNext, goPrev, goUser, close, own, setReply, setViewers });
  actions.current = { goNext, goPrev, goUser, close, own, setReply, setViewers };
  const storyH = Math.max(420, H - Math.max(insets.top, 20) - 69 - Math.max(insets.bottom, 8));
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
        onPanResponderGrant: () => {
          held.current = false;
          holdTimer.current = setTimeout(() => {
            held.current = true;
            setHolding(true);
          }, 220);
        },
        onPanResponderMove: (_e, g) => {
          if (Math.abs(g.dx) + Math.abs(g.dy) > 12 && holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
          }
          if (g.dy > 0 && Math.abs(g.dy) > Math.abs(g.dx)) dragY.value = g.dy;
        },
        onPanResponderRelease: (e, g) => {
          if (holdTimer.current) clearTimeout(holdTimer.current);
          holdTimer.current = null;
          const a = actions.current;
          if (held.current) {
            held.current = false;
            setHolding(false);
            dragY.value = withTiming(0, { duration: DURATION.fast });
            return;
          }
          const sw = classifySwipe(g.dx, g.dy, g.vx, g.vy);
          if (sw === 'down') {
            dragY.value = withTiming(H, { duration: reduced ? 200 : DURATION.base, easing: CURVE.exit });
            fade.value = withTiming(0, { duration: reduced ? 200 : DURATION.base });
            setTimeout(() => a.close(), reduced ? 200 : DURATION.base);
            return;
          }
          dragY.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.standard });
          if (sw === 'up') return a.own ? a.setViewers(true) : a.setReply(true);
          if (sw === 'left') return a.goUser(1);
          if (sw === 'right') return a.goUser(-1);
          if (sw == null) {
            if (tapZone(e.nativeEvent.locationX, W) === 'prev') a.goPrev();
            else a.goNext();
          }
        },
        onPanResponderTerminate: () => {
          if (holdTimer.current) clearTimeout(holdTimer.current);
          held.current = false;
          setHolding(false);
          dragY.value = withTiming(0, { duration: DURATION.fast });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [W, H, reduced],
  );
  const wrapStyle = useAnimatedStyle(() => ({
    opacity: fade.value * (reduced ? 1 : 1 - Math.min(0.4, dragY.value / 1200)),
    transform: reduced ? [] : [{ translateY: dragY.value }, { scale: 1 - Math.min(0.08, dragY.value / 3000) }],
  }));
  // Kişi geçişi: 220 ms solma (Reduce Motion: 200 ms opaklık).
  const swap = useSharedValue(1);
  useEffect(() => {
    swap.value = 0.25;
    swap.value = withTiming(1, { duration: reduced ? 200 : DURATION.fast, easing: CURVE.standard });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.user]);
  const swapStyle = useAnimatedStyle(() => ({ opacity: swap.value }));
  const chromeOp = useSharedValue(1);
  useEffect(() => {
    chromeOp.value = withTiming(holding ? 0 : 1, { duration: DURATION.fast, easing: CURVE.standard });
  }, [holding, chromeOp]);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeOp.value }));

  const mediaUri = story ? (story.media_type === 'video' ? storyMediaUrl(story.thumb_url) : storyMediaUrl(story.media_url)) : null;
  const previewUri = story ? (story.media_type === 'video' ? storyMediaUrl(story.thumb_url) : storyMediaUrl(story.media_url)) : null;
  const liked = !!story?.my_reactions.includes('like');
  const tipKey = story?.overlays.some((o) => o.kind === 'meal') ? 'hikaye.coach_tip_meal' : story?.overlays.some((o) => o.kind === 'ring') ? 'hikaye.coach_tip_ring' : 'hikaye.coach_tip_generic';
  const showTip = own && koc && !tipClosed && !coach && !viewers;
  const topPad = Math.max(insets.top, 20);
  const authorName = own ? tr('hikaye.your_story') : group?.name ?? '';

  if (!group) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: '#000' }]}>
        <Text style={styles.emptyT}>{tr('hikaye.empty')}</Text>
        <Pressable onPress={close} accessibilityRole="button" style={styles.retryBtn}><Text style={styles.retryT}>{tr('hikaye.close')}</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: st.bg, paddingTop: topPad }]} testID="story-viewer">
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Animated.View style={[{ flex: 1 }, wrapStyle]}>
        <Animated.View style={[styles.storyBox, { height: storyH }, swapStyle]} accessibilityLabel={tr('hikaye.story_a11y', { name: authorName })} importantForAccessibility={viewers ? 'no-hide-descendants' : 'auto'}>
          {story ? (
            <StoryCanvas
              w={W}
              h={storyH}
              mediaUri={mediaUri}
              mediaType={story.media_type}
              bg={story.bg}
              overlays={story.overlays}
              reduceTransparency={solid}
              interactFor={interactFor}
              media={
                <>
                  {story.media_type === 'video' && story.media_url ? (
                    <VideoStory key={story.id} uri={storyMediaUrl(story.media_url) ?? ''} paused={paused} />
                  ) : story.media_type === 'none' || !mediaUri ? (
                    <StoryBackground bg={story.bg} />
                  ) : (
                    <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
                  )}
                  <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']} style={styles.gTop} />
                  <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)']} style={styles.gBot} />
                  {/* Dokunma bölgeleri + jestler (katmanların ALTINDA; etkileşimsiz çıkartmalar dokunmayı geçirir). */}
                  <View
                    {...responder.panHandlers}
                    style={[StyleSheet.absoluteFill, { top: 70 }]}
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel={tr('hikaye.next_a11y')}
                    accessibilityValue={{ text: tr('hikaye.prog_a11y', { s: pos.story + 1, n: stories?.length ?? 1 }) }}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'escape' }]}
                    onAccessibilityAction={(ev) => {
                      if (ev.nativeEvent.actionName === 'increment') goNext();
                      if (ev.nativeEvent.actionName === 'decrement') goPrev();
                      if (ev.nativeEvent.actionName === 'escape') close();
                    }}
                    onAccessibilityEscape={close}
                    testID="story-viewer-tap"
                  />
                </>
              }
              renderOverlay={(o, node) => (
                <View key={o.id} pointerEvents={INTERACTIVE.includes(o.kind) && !reply ? 'box-none' : 'none'} style={StyleSheet.absoluteFill}>
                  <OverlayAt overlay={o} w={W} h={storyH}>{node}</OverlayAt>
                </View>
              )}
              testID="story-viewer-canvas"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              {group.error ? (
                <>
                  <Text style={styles.emptyT}>{tr('hikaye.load_failed')}</Text>
                  <Pressable onPress={() => { setGroups((gs) => gs.map((g, i) => (i === pos.user ? { ...g, stories: null, error: false } : g))); }} accessibilityRole="button" style={styles.retryBtn}>
                    <Text style={styles.retryT}>{tr('hikaye.retry')}</Text>
                  </Pressable>
                </>
              ) : stories && stories.length === 0 ? (
                <Text style={styles.emptyT}>{tr('hikaye.empty')}</Text>
              ) : null}
            </View>
          )}

          {/* Başlık: ilerleme + yazar (basılı tutunca 220 ms solar). */}
          <Animated.View style={[styles.chrome, chromeStyle]} importantForAccessibility={holding ? 'no-hide-descendants' : 'auto'} pointerEvents="box-none">
            {stories && stories.length > 0 ? (
              <View accessible accessibilityRole="progressbar" accessibilityLabel={tr('hikaye.prog_a11y', { s: pos.story + 1, n: stories.length })}>
                <ProgressBars count={stories.length} index={Math.max(0, pos.story)} progress={progress} />
              </View>
            ) : null}
            <View style={styles.author}>
              <Pressable
                disabled={own || !group.handle}
                onPress={() => group.handle && nav.push('PublicProfile', { handle: group.handle })}
                accessibilityRole="button"
                style={styles.authorMain}
              >
                <View style={styles.ava32}>{group.avatar ? <CachedImage uri={group.avatar} style={{ width: 32, height: 32 }} /> : null}</View>
                <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
                {story ? <Text style={styles.ago}>{formatAgo(story.created_at, nowMs, lang === 'en' ? 'en' : 'tr')}</Text> : null}
              </Pressable>
              {story?.status === 'pending' && own ? (
                <View style={[styles.badge, { backgroundColor: om }]}><Text style={styles.badgeT}>{tr('hikaye.pending_badge')}</Text></View>
              ) : null}
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel={tr('hikaye.more')} style={styles.hit44} testID="story-viewer-more">
                <Svg width={24} height={24} viewBox="0 0 256 256"><Path d={P_DOTS} fill="#FFFFFF" /></Svg>
              </Pressable>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={tr('hikaye.close')} style={styles.hit44} testID="story-viewer-close">
                <Svg width={24} height={24} viewBox="0 0 256 256"><Path d={P_X} fill="#FFFFFF" /></Svg>
              </Pressable>
            </View>
          </Animated.View>
          {holding ? (
            <View accessibilityLiveRegion="polite" style={[styles.pausedPill, { backgroundColor: om, top: 28 }]}>
              <Svg width={10} height={10} viewBox="0 0 256 256"><Path d={P_PAUSE} fill="#FFFFFF" /></Svg>
              <Text style={styles.badgeT}>{tr('hikaye.paused')}</Text>
            </View>
          ) : null}

          {/* Öğün çıkartması seçenekleri (Ben de günlüğüme ekle). */}
          {mealPop && story ? (() => {
            const o = story.overlays.find((x) => x.id === mealPop);
            if (!o) return null;
            return (
              <View style={[styles.mealPop, { backgroundColor: om, left: Math.min(Math.max(16, o.x * W - 126), W - 268), top: Math.min(storyH - 140, o.y * storyH + 70) }]} accessibilityViewIsModal>
                <Pressable onPress={() => void addMeal()} accessibilityRole="button" style={styles.mealAdd} testID="story-viewer-add-log">
                  <Svg width={16} height={16} viewBox="0 0 256 256"><Path d={P_PLUS} fill={LIME_INK} /></Svg>
                  <Text style={styles.mealAddT}>{tr('hikaye.add_to_log')}</Text>
                </Pressable>
                <Pressable onPress={() => setMealPop(null)} accessibilityRole="button" style={styles.mealClose}>
                  <Text style={styles.mealCloseT}>{tr('hikaye.close')}</Text>
                </Pressable>
              </View>
            );
          })() : null}

          {/* Yanıtla (başkasının hikâyesi) — yukarı kaydırma ipucu. */}
          {story && !own && !reply && !coach ? (
            <Pressable onPress={() => setReply(true)} accessibilityRole="button" style={[styles.swipeUp, { backgroundColor: om }]}>
              <Svg width={14} height={14} viewBox="0 0 256 256"><Path d={P_CARET_UP} fill="#FFFFFF" /></Svg>
              <Text style={styles.swipeUpT}>{tr('hikaye.swipe_up')}</Text>
            </Pressable>
          ) : null}

          {/* kcalAI Koç ipucu (kendi hikâyen + koç bayrağı). */}
          {showTip ? (
            <View style={[styles.tip, { backgroundColor: om }]} testID="story-coach-tip">
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.tipTitle}>{tr('hikaye.coach_tip_title')}</Text>
                <Text style={styles.tipBody}>{tr(tipKey)}</Text>
              </View>
              <View style={{ gap: 4, alignItems: 'flex-end' }}>
                <Pressable onPress={() => setTipClosed(true)} accessibilityRole="button" accessibilityLabel={tr('hikaye.close')} style={styles.hit44}>
                  <Svg width={18} height={18} viewBox="0 0 256 256"><Path d={P_X} fill="#FFFFFF" /></Svg>
                </Pressable>
                <Pressable onPress={() => nav.navigate('CoachChat', { from: 'other', prefill: tr(tipKey) })} accessibilityRole="button" style={styles.tipBtn}>
                  <Text style={styles.tipBtnT}>{tr('hikaye.coach_ask')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* coach: gezinme ipucu (bir kez). */}
          {coach && story ? (
            <View style={styles.coach} accessibilityViewIsModal testID="story-viewer-coach">
              <View style={[styles.zone, { left: 10, top: 78, bottom: 120, width: W / 3 - 18 }]}>
                <View style={styles.zoneIcon}><Svg width={22} height={22} viewBox="0 0 256 256"><Path d={P_CARET_L} fill="#FFFFFF" /></Svg></View>
                <Text style={styles.zoneT}>{tr('hikaye.z_prev')}</Text>
              </View>
              <View style={[styles.zone, { left: W / 3, right: 10, top: 78, bottom: 120 }]}>
                <View style={styles.zoneIcon}><Svg width={22} height={22} viewBox="0 0 256 256"><Path d={P_CARET_R} fill="#FFFFFF" /></Svg></View>
                <Text style={styles.zoneT}>{tr('hikaye.z_next')}</Text>
                <View style={[styles.zoneIcon, { marginTop: 18 }]}><Svg width={20} height={20} viewBox="0 0 256 256"><Path d={P_PAUSE} fill="#FFFFFF" /></Svg></View>
                <Text style={styles.zoneT}>{tr('hikaye.z_hold')}</Text>
              </View>
              <View style={styles.coachFoot}>
                <Text accessibilityRole="header" style={styles.coachTitle}>{tr('hikaye.coach_title')}</Text>
                <Pressable
                  onPress={() => {
                    setCoach(false);
                    void AsyncStorage.setItem(COACH_KEY, '1').catch(() => undefined);
                  }}
                  accessibilityRole="button"
                  style={styles.gotIt}
                  testID="story-viewer-coach-ok"
                >
                  <Text style={styles.gotItT}>{tr('hikaye.got_it')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* reply: hızlı tepkiler (+ G63: `mesajlar` açıkken serbest metin, aşağıda). */}
          {reply && story && !own ? (
            <View style={StyleSheet.absoluteFill} testID="story-viewer-reply">
              <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} onPress={() => setReply(false)} accessibilityRole="button" accessibilityLabel={tr('hikaye.close')} />
              <View style={styles.quick} accessibilityRole="radiogroup" accessibilityLabel={tr('hikaye.quick')}>
                <Text accessibilityRole="header" style={styles.quickT}>{tr('hikaye.quick')}</Text>
                <View style={styles.quickGrid}>
                  {QUICK_REACTIONS.map((k) => {
                    const on = story.my_reactions.includes(k);
                    return (
                      <Pressable key={k} onPress={() => react(k)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.quickBtn, { backgroundColor: on ? LIME : 'rgba(255,255,255,0.92)' }]} testID={`story-react-${k}`}>
                        {k === 'like' ? <Svg width={26} height={26} viewBox="0 0 256 256"><Path d={P_HEART_F} fill="#FF5A5F" /></Svg> : null}
                        {k === 'congrats' ? <RNImage source={GLASS.trophy} style={{ width: 30, height: 30 }} resizeMode="contain" /> : null}
                        {k === 'enjoy' ? <RNImage source={GLASS.bowl} style={{ width: 30, height: 30 }} resizeMode="contain" /> : null}
                        <Text style={styles.quickBtnT}>{tr(REACTION_KEY[k])}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {mesajlar ? (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.replyKav} pointerEvents="box-none">
                  <View style={[styles.replyRow, { backgroundColor: st.bg }]} testID="story-reply-text">
                    <View style={[styles.replyField, { backgroundColor: st.card, borderColor: st.text }]}>
                      <TextInput
                        value={replyText}
                        onChangeText={setReplyText}
                        placeholder={tr('dm.story.reply_ph')}
                        placeholderTextColor={st.sec}
                        accessibilityLabel={tr('dm.story.reply_a11y', { name: group?.name ?? '' })}
                        autoFocus={!(__DEV__ && params.vitrinState === 'reply')}
                        maxLength={1000}
                        returnKeyType="send"
                        onSubmitEditing={() => void sendReply()}
                        style={[styles.replyInput, { color: st.text }]}
                        testID="story-reply-input"
                      />
                    </View>
                    <Pressable
                      onPress={() => void sendReply()}
                      disabled={!replyText.trim() || replySending}
                      accessibilityRole="button"
                      accessibilityLabel={tr('dm.story.send')}
                      accessibilityState={{ disabled: !replyText.trim(), busy: replySending }}
                      style={[styles.replySend, { backgroundColor: replyText.trim() ? LIME : st.card }]}
                      testID="story-reply-send"
                    >
                      <Svg width={22} height={22} viewBox="0 0 256 256"><Path d={P_SEND} fill={replyText.trim() ? '#0A0A0A' : st.sec} /></Svg>
                    </Pressable>
                  </View>
                </KeyboardAvoidingView>
              ) : null}
            </View>
          ) : null}
        </Animated.View>

        {/* Alt çubuk */}
        {story ? (
          own ? (
            <View style={styles.bottom}>
              <Pressable onPress={() => setViewers(true)} accessibilityRole="button" style={[styles.replyPill, { backgroundColor: st.card, borderColor: st.line2, justifyContent: 'center', gap: 8 }]} testID="story-viewer-viewers">
                <Svg width={20} height={20} viewBox="0 0 256 256"><Path d={P_EYE} fill={st.text} /></Svg>
                <Text style={[styles.replyPh, { color: st.text, fontFamily: fontFamily.bodyBold }]}>
                  {story.view_count ? tr('hikaye.views', { n: story.view_count }) : tr('hikaye.views_up')}
                </Text>
              </Pressable>
              <Pressable onPress={() => setHlSheet(true)} accessibilityRole="button" accessibilityLabel={tr('hikaye.highlight')} style={styles.icon48}>
                <Svg width={24} height={24} viewBox="0 0 256 256"><Path d={P_PLUS} fill={st.text} /></Svg>
              </Pressable>
            </View>
          ) : (
            <View style={styles.bottom}>
              <Pressable onPress={() => setReply(true)} accessibilityRole="button" style={[styles.replyPill, { backgroundColor: st.card, borderColor: st.line2 }]} testID="story-viewer-reply-open">
                <Text style={[styles.replyPh, { color: st.sec }]}>{tr('hikaye.reply_ph')}</Text>
              </Pressable>
              <Pressable onPress={() => react('like')} accessibilityRole="button" accessibilityLabel={tr('hikaye.like')} accessibilityState={{ selected: liked }} style={styles.icon48} testID="story-viewer-like">
                <Svg width={26} height={26} viewBox="0 0 256 256"><Path d={liked ? P_HEART_F : P_HEART} fill={liked ? HEART : st.text} /></Svg>
              </Pressable>
              {shareStory ? (
                <Pressable onPress={shareStory} accessibilityRole="button" accessibilityLabel={tr('hikaye.share_story')} style={styles.icon48}>
                  <Svg width={24} height={24} viewBox="0 0 256 256"><Path d={P_SEND} fill={st.text} /></Svg>
                </Pressable>
              ) : null}
            </View>
          )
        ) : null}
      </Animated.View>

      {viewers && story && own ? (
        <StoryViewersSheet
          story={story}
          previewUri={previewUri}
          nowMs={nowMs}
          onClose={() => setViewers(false)}
          onHighlight={() => setHlSheet(true)}
          onShare={shareStory}
          onDelete={deleteStory}
          onOpenProfile={(h) => nav.push('PublicProfile', { handle: h })}
        />
      ) : null}
      {shareKit.node}
      {hlSheet && story ? (
        <HighlightSheet
          mode="new"
          highlight={null}
          preselect={story.id}
          onClose={() => setHlSheet(false)}
          onSaved={(_id, title) => {
            setHlSheet(false);
            setToast({ message: tr('hikaye.added_highlight', { name: title }), success: true });
          }}
        />
      ) : null}

      <BottomSheet visible={menu} onClose={() => setMenu(false)} accessibilityLabel={tr('hikaye.more')}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 4 }}>
          {own ? (
            <>
              <Pressable onPress={() => { setMenu(false); setViewers(true); }} accessibilityRole="button" style={styles.menuRow}><Text style={[styles.menuT, { color: st.text }]}>{tr('hikaye.views_up')}</Text></Pressable>
              <Pressable onPress={() => { setMenu(false); setHlSheet(true); }} accessibilityRole="button" style={styles.menuRow}><Text style={[styles.menuT, { color: st.text }]}>{tr('hikaye.highlight')}</Text></Pressable>
              <Pressable onPress={() => { setMenu(false); deleteStory(); }} accessibilityRole="button" style={styles.menuRow} testID="story-menu-delete"><Text style={[styles.menuT, { color: st.danger }]}>{tr('hikaye.delete_story')}</Text></Pressable>
            </>
          ) : (
            <Pressable onPress={() => { setMenu(false); setReport(true); }} accessibilityRole="button" style={styles.menuRow} testID="story-menu-report"><Text style={[styles.menuT, { color: st.danger }]}>{tr('hikaye.report')}</Text></Pressable>
          )}
        </View>
      </BottomSheet>
      <ReportModal
        visible={report}
        authorName={group.name}
        onSubmit={async (reason, note) => {
          if (!story) return false;
          try {
            await client.report({ story: story.id, reason: reportReasonText(reason, note) });
            return true;
          } catch {
            return false;
          }
        }}
        onClose={() => setReport(false)}
      />
      <AddToast toast={toast} onDismiss={() => setToast(null)} />
    </View>
  );
}

const SH = { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 } as const;

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  storyBox: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#000000' },
  gTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 140 },
  gBot: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  chrome: { position: 'absolute', left: 0, right: 0, top: 0 },
  bars: { position: 'absolute', left: 8, right: 8, top: 8, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.38)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 2 },
  author: { position: 'absolute', left: 12, right: 4, top: 18, height: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorMain: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, maxWidth: '60%' },
  ava32: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.35)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  authorName: { color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 14, flexShrink: 1, ...SH },
  ago: { color: '#FFFFFF', opacity: 0.9, fontFamily: fontFamily.bodyMedium, fontSize: 13, ...SH },
  badge: { height: 24, paddingHorizontal: 8, borderRadius: 12, justifyContent: 'center' },
  badgeT: { color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 12 },
  pausedPill: { position: 'absolute', alignSelf: 'center', height: 24, paddingHorizontal: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  hit44: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  mealPop: { position: 'absolute', width: 252, borderRadius: 18, padding: 6 },
  mealAdd: { minHeight: 44, borderRadius: 12, backgroundColor: LIME, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealAddT: { color: LIME_INK, fontFamily: fontFamily.bodyBold, fontSize: 14 },
  mealClose: { marginTop: 4, minHeight: 44, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center' },
  mealCloseT: { color: '#FFFFFF', fontFamily: fontFamily.bodySemibold, fontSize: 14 },
  swipeUp: { position: 'absolute', alignSelf: 'center', bottom: 14, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6 },
  swipeUpT: { color: '#FFFFFF', fontFamily: fontFamily.bodySemibold, fontSize: 13 },
  tip: { position: 'absolute', left: 12, right: 12, bottom: 14, borderRadius: 18, padding: 12, paddingRight: 6, flexDirection: 'row', gap: 8 },
  tipTitle: { color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 13 },
  tipBody: { marginTop: 2, color: 'rgba(255,255,255,0.9)', fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 19 },
  tipBtn: { minHeight: 44, borderRadius: 22, backgroundColor: LIME, paddingHorizontal: 14, justifyContent: 'center' },
  tipBtnT: { color: LIME_INK, fontFamily: fontFamily.bodyBold, fontSize: 14 },
  coach: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  zone: { position: 'absolute', borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 6 },
  zoneIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  zoneT: { color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 14, textAlign: 'center' },
  coachFoot: { position: 'absolute', left: 16, right: 16, bottom: 24, alignItems: 'center', gap: 10 },
  coachTitle: { color: '#FFFFFF', fontFamily: fontFamily.headingBold, fontSize: 18 },
  gotIt: { minWidth: 160, minHeight: 48, borderRadius: 24, backgroundColor: '#FFFFFF', paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  gotItT: { color: '#0A0A0A', fontFamily: fontFamily.bodyBold, fontSize: 15 },
  quick: { position: 'absolute', left: 16, right: 16, top: '30%' },
  replyKav: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  replyRow: { minHeight: 64, paddingVertical: 8, paddingLeft: 16, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyField: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: 24, borderWidth: 2, paddingHorizontal: 16, justifyContent: 'center' },
  replyInput: { fontFamily: fontFamily.bodyRegular, fontSize: 16, paddingVertical: 10 },
  replySend: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  quickT: { marginBottom: 10, textAlign: 'center', color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 14 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: { width: '31.5%', minHeight: 76, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', gap: 4 },
  quickBtnT: { color: '#0A0A0A', fontFamily: fontFamily.bodyBold, fontSize: 13, lineHeight: 16, textAlign: 'center' },
  bottom: { paddingTop: 12, paddingLeft: 16, paddingRight: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  replyPill: { flex: 1, minWidth: 0, height: 48, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  replyPh: { fontFamily: fontFamily.bodyRegular, fontSize: 15 },
  icon48: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  emptyT: { color: '#FFFFFF', fontFamily: fontFamily.bodySemibold, fontSize: 15, textAlign: 'center' },
  retryBtn: { minHeight: 44, borderRadius: 22, paddingHorizontal: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  retryT: { color: '#0A0A0A', fontFamily: fontFamily.bodyBold, fontSize: 15 },
  menuRow: { minHeight: 52, justifyContent: 'center' },
  menuT: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
});
