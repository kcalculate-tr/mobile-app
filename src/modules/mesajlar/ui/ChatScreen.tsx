// G63-S1 — 1:1 sohbet (docs/g63/design/FinChat.dc.html: chat · request · menu · block).
// Başlık 56 + alt çizgi (geri 44 · avatar 36 + ad 16 kalın + alt satır 13 · seçenekler 44); mesaj alanı role=log;
// yazma çubuğu üst çizgi, 8/12 iç boşluk, alan 44 / 22 köşe, gönder 44 lime daire (taslak varken 220 ms solarak).
// İstek hâli: profil bloğu (avatar 80, ad Bricolage 20, @kullanıcı 14, "takip etmiyorsun" 14, Profili gör 44)
// + gelen balonlar + alt bölüm (başlık 14 kalın, gövde 13, Engelle · Sil · Kabul et ≥ 48 / 24 köşe).
// KARAR (LOG): tasarımdaki kamera + sesli mesaj düğmeleri bu turda YOK (medya/ses mesaj türü kapsam dışı, işlevsiz
// düğme HIG'e aykırı); "Son görülme" yerine @kullanıcı (çevrimiçi durumu tutulmuyor); kaydırarak yanıtla yok.
// Kurallar sunucuda: okundu yalnız iki taraf aktifken (receipts), yazıyor aynı kurala bağlı, silme 15 dk.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FinText as Text } from '../../../core/design/components/FinText';
import { Toast, fontFamily, haptic } from '../../../core/design';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import type { RootStackParamList } from '../../../navigation/types';
import { getKesfetClient } from '../../kesfet/client';
import type { FeedPost } from '../../kesfet/types';
import { ReportModal, reportReasonText } from '../../kesfet/ui/ReportFlow';
import { getDmClient } from '../client';
import {
  applyRealtime,
  canDeleteMessage,
  cleanBody,
  errorKey,
  hasLinkOrPhone,
  newIdem,
  rpcCode,
  seenMessageId,
  timeline,
  typingAllowed,
  type TimelineRow,
} from '../rules';
import type { DmConversationMeta, DmMessage } from '../types';
import { DayChip, MealBubble, MsgIn, PostBubble, StoryReplyBubble, TextBubble, TypingBubble } from './bubbles';
import { BlockAlert, ChatMenuSheet, MessageActionsSheet, StatusToast } from './ChatOverlays';
import { DmIcon, FadeIn, INK, LIME, PersonAvatar, dmStyles, personName, useDmPalette } from './parts';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Row = TimelineRow | { type: 'seen'; key: string } | { type: 'typing'; key: string } | { type: 'risky'; key: string };

function dayLabel(iso: string, lang: string, tr: (k: string, v?: Record<string, string | number>) => string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'tr-TR', { hour: '2-digit', minute: '2-digit' });
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= start) return tr('dm.chat.today', { time });
  if (d.getTime() >= start - 86400000) return tr('dm.chat.yday', { time });
  const date = d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long' });
  return tr('dm.chat.date', { date, time });
}

export default function ChatScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'DmChat'>>();
  const params = route.params;
  const insets = useSafeAreaInsets();
  const c = useDmPalette();
  const { t: tr, lang } = useT();
  const { user } = useAuth();
  const myId = user?.id ?? params.vitrinMe ?? null;

  const [conversationId, setConversationId] = useState<string | null>(params.conversationId ?? null);
  const [meta, setMeta] = useState<DmConversationMeta | null>(null);
  const [msgs, setMsgs] = useState<DmMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState(params.vitrinDraft ?? '');
  const [menu, setMenu] = useState(params.vitrinView === 'menu');
  const [blockAsk, setBlockAsk] = useState(params.vitrinView === 'block');
  const [report, setReport] = useState<{ type: 'conversation' | 'message'; id: string } | null>(null);
  const [actionsFor, setActionsFor] = useState<DmMessage | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [typingUntil, setTypingUntil] = useState(params.vitrinTyping ? Number.MAX_SAFE_INTEGER : 0);
  const [posts, setPosts] = useState<Record<string, FeedPost | null>>({});
  const animated = useRef(new Set<string>());
  const typingCh = useRef<ReturnType<ReturnType<typeof getDmClient>['typing']> | null>(null);
  const lastTypingSent = useRef(0);
  const lastRead = useRef(0);

  const other = meta?.other ?? null;
  const name = personName(other, lang) || params.name || '';
  const handle = other?.handle ?? params.handle ?? null;
  const isRequest = meta?.my_state === 'request';

  // 1) Sohbeti çöz: conversationId yoksa userId ile aç (dm_open).
  useEffect(() => {
    if (conversationId || !params.userId) return;
    getDmClient()
      .open({ user: params.userId })
      .then((r) => setConversationId(r.conversation_id))
      .catch((e) => setLoadError(rpcCode(e)));
  }, [conversationId, params.userId]);

  const markRead = useCallback(() => {
    if (!conversationId) return;
    const t = Date.now();
    if (t - lastRead.current < 1500) return;
    lastRead.current = t;
    void getDmClient().markRead({ conversation: conversationId }).catch(() => {});
    typingCh.current?.sendRead();
  }, [conversationId]);

  const load = useCallback(async () => {
    if (!conversationId) return;
    try {
      const th = await getDmClient().thread({ conversation: conversationId });
      setMeta(th.conversation);
      setMsgs((prev) => {
        // İyimser (yerel) balonlar korunur.
        const locals = prev.filter((m) => m.local && !th.messages.some((x) => x.id === m.id));
        return [...th.messages, ...locals];
      });
      setHasMore(th.has_more);
      setLoadError(null);
      if (th.conversation.my_state === 'active') markRead();
    } catch (e) {
      setLoadError(rpcCode(e));
    }
  }, [conversationId, markRead]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ön plana gelişte yenile (Realtime düştüyse de güncel kalır).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  // Realtime: bu sohbetin mesaj olayları.
  useEffect(() => {
    if (!conversationId) return;
    return getDmClient().subscribe({
      conversation: conversationId,
      onEvent: (e) => {
        if (e.type === 'insert' || e.row.status === 'sent') animated.current.add(e.row.id);
        setMsgs((list) => applyRealtime(list, e, myId));
        if (e.row.sender_id !== myId && e.row.status === 'sent') {
          setTypingUntil(0);
          if (AppState.currentState === 'active') markRead();
        }
      },
    });
  }, [conversationId, myId, markRead]);

  // Yazıyor + okundu yayını (yalnız iki taraf aktifken).
  const receipts = typingAllowed(meta);
  useEffect(() => {
    if (!conversationId || !receipts) return;
    const ch = getDmClient().typing({
      conversation: conversationId,
      onTyping: (uid) => {
        if (uid !== myId) setTypingUntil(Date.now() + 4000);
      },
      onRead: (uid) => {
        if (uid !== myId) setMeta((m) => (m ? { ...m, other_last_read_at: new Date().toISOString() } : m));
      },
    });
    typingCh.current = ch;
    return () => {
      ch.close();
      typingCh.current = null;
    };
  }, [conversationId, receipts, myId]);

  // Yazıyor göstergesi kendiliğinden söner.
  useEffect(() => {
    if (!typingUntil || typingUntil === Number.MAX_SAFE_INTEGER) return;
    const ms = typingUntil - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => setTypingUntil(0), ms);
    return () => clearTimeout(t);
  }, [typingUntil]);

  // Paylaşılan gönderileri getir (görülemiyorsa null → "artık yok").
  useEffect(() => {
    const ids = msgs.filter((m) => m.kind === 'post' && m.ref?.post_id && !(m.ref.post_id in posts)).map((m) => m.ref!.post_id!);
    if (!ids.length) return;
    ids.forEach((id) => {
      getKesfetClient()
        .getPost({ post: id })
        .then((p) => setPosts((s) => ({ ...s, [id]: p })))
        .catch(() => setPosts((s) => ({ ...s, [id]: null })));
    });
  }, [msgs, posts]);

  const showError = (key: string) => {
    haptic('warning');
    setErrorText(tr(key));
  };

  const onDraft = (v: string) => {
    setDraft(v);
    if (receipts && v.trim() && Date.now() - lastTypingSent.current > 2500) {
      lastTypingSent.current = Date.now();
      typingCh.current?.send();
    }
  };

  const deliver = async (body: string, idem: string, localId: string) => {
    if (!conversationId) return;
    try {
      const res = await getDmClient().send({ conversation: conversationId, body, kind: 'text', idem });
      if (!res.ok) {
        setMsgs((l) => l.filter((m) => m.id !== localId));
        setDraft((d) => d || body);
        showError(errorKey(res.error, 'scope' in res ? res.scope : undefined));
        return;
      }
      const real: DmMessage = {
        id: res.id,
        conversation_id: conversationId,
        sender_id: myId,
        mine: true,
        body,
        kind: 'text',
        ref: null,
        status: res.status,
        created_at: res.created_at,
        local: res.needs_moderation ? 'sending' : undefined,
        idem,
      };
      animated.current.add(res.id);
      setMsgs((l) => l.filter((m) => m.id !== res.id).map((m) => (m.id === localId ? real : m)));
      if (res.needs_moderation) {
        const verdict = await getDmClient().moderate({ message: res.id });
        if (verdict === 'blocked') {
          // Engellenen içerik gönderilmez: balon kalkar, metin taslağa döner, nötr hata.
          setMsgs((l) => l.filter((m) => m.id !== res.id));
          setDraft((d) => d || body);
          showError('dm.err.not_sent');
        } else if (verdict === 'sent') {
          setMsgs((l) => l.map((m) => (m.id === res.id ? { ...m, status: 'sent', local: undefined } : m)));
        }
        // 'pending': "Gönderiliyor…" kalır; sunucu yeniden dener, Realtime 'sent' olunca günceller.
      }
    } catch (e) {
      const code = rpcCode(e);
      if (code === 'engel' || code === 'gizli_hesap' || code === 'bulunamadi' || code === 'kapali') {
        setMsgs((l) => l.filter((m) => m.id !== localId));
        setDraft((d) => d || body);
        void load();
      } else {
        setMsgs((l) => l.map((m) => (m.id === localId ? { ...m, local: 'failed' } : m)));
      }
      showError(errorKey(code));
    }
  };

  const send = () => {
    const body = cleanBody(draft);
    if (!body || !conversationId) return;
    const idem = newIdem();
    const localId = `local-${idem}`;
    const temp: DmMessage = {
      id: localId,
      conversation_id: conversationId,
      sender_id: myId,
      mine: true,
      body,
      kind: 'text',
      ref: null,
      status: 'pending',
      created_at: new Date().toISOString(),
      local: 'sending',
      idem,
    };
    animated.current.add(localId);
    setMsgs((l) => [...l, temp]);
    setDraft('');
    void deliver(body, idem, localId);
  };

  const retry = (m: DmMessage) => {
    if (m.local !== 'failed' || !m.idem || !m.body) return;
    setMsgs((l) => l.map((x) => (x.id === m.id ? { ...x, local: 'sending' } : x)));
    void deliver(m.body, m.idem, m.id);
  };

  const loadOlder = async () => {
    if (!hasMore || !conversationId) return;
    const oldest = msgs.find((m) => !m.local);
    if (!oldest) return;
    try {
      const th = await getDmClient().thread({ conversation: conversationId, before: oldest.created_at });
      setMsgs((l) => [...th.messages.filter((m) => !l.some((x) => x.id === m.id)), ...l]);
      setHasMore(th.has_more);
    } catch {
      // sessiz
    }
  };

  const accept = async () => {
    if (!conversationId) return;
    haptic('success');
    try {
      await getDmClient().accept({ conversation: conversationId });
      await load();
    } catch (e) {
      showError(errorKey(rpcCode(e)));
    }
  };
  const decline = async () => {
    if (!conversationId) return;
    try {
      await getDmClient().decline({ conversation: conversationId });
      navigation.goBack();
    } catch (e) {
      showError(errorKey(rpcCode(e)));
    }
  };
  const confirmBlock = async () => {
    setBlockAsk(false);
    setMenu(false);
    if (!other) return;
    try {
      await getDmClient().block({ user: other.id });
      if (isRequest && conversationId) await getDmClient().decline({ conversation: conversationId }).catch(() => {});
      setStatus(tr('dm.chat.blocked', { name }));
      setTimeout(() => {
        if (navigation.canGoBack()) navigation.goBack();
      }, 1400);
    } catch (e) {
      showError(errorKey(rpcCode(e)));
    }
  };
  const toggleMute = async () => {
    if (!conversationId || !meta) return;
    const on = !meta.muted;
    setMeta({ ...meta, muted: on });
    try {
      await getDmClient().mute({ conversation: conversationId, on });
    } catch {
      setMeta((m) => (m ? { ...m, muted: !on } : m));
    }
  };
  const deleteMessage = async (m: DmMessage) => {
    setActionsFor(null);
    try {
      await getDmClient().deleteMessage({ message: m.id });
      setMsgs((l) => l.filter((x) => x.id !== m.id));
      setStatus(tr('dm.chat.deleted'));
      setTimeout(() => setStatus(null), 2200);
    } catch (e) {
      showError(errorKey(rpcCode(e)));
    }
  };

  const openProfile = () => {
    if (handle) navigation.navigate('PublicProfile', { handle });
  };

  // ─── Satırlar (ters liste: en yeni altta) ───────────────────────────────────
  const visibleMsgs = useMemo(() => msgs.filter((m) => m.local !== 'blocked'), [msgs]);
  const seenId = seenMessageId(meta ?? { receipts: false, other_last_read_at: null }, visibleMsgs);
  const typing = receipts && typingUntil > Date.now();
  const firstIncomingRisky = isRequest && visibleMsgs.some((m) => !m.mine && hasLinkOrPhone(m.body));
  const rows: Row[] = useMemo(() => {
    const base: Row[] = [];
    for (const r of timeline(visibleMsgs)) {
      base.push(r);
      if (r.type === 'msg' && r.msg.id === seenId) base.push({ type: 'seen', key: 'seen' });
    }
    if (firstIncomingRisky) base.push({ type: 'risky', key: 'risky' });
    if (typing || (params.vitrinTyping && meta)) base.push({ type: 'typing', key: 'typing' });
    return base.reverse();
  }, [visibleMsgs, seenId, typing, firstIncomingRisky, params.vitrinTyping, meta]);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.type === 'chip') return <DayChip label={dayLabel(item.at, lang, tr)} c={c} />;
    if (item.type === 'seen')
      return (
        <Text accessibilityLiveRegion="polite" style={[styles.seen, { color: c.sec }]} testID="dm-seen">
          {tr('dm.chat.seen')}
        </Text>
      );
    if (item.type === 'typing') return <TypingBubble c={c} label={tr('dm.chat.typing', { name })} />;
    if (item.type === 'risky')
      return (
        <View style={[styles.risky, { borderColor: c.line2 }]} accessibilityRole="alert" testID="dm-risky">
          <Text style={[styles.riskyText, { color: c.sec }]}>{tr('dm.chat.risky')}</Text>
        </View>
      );
    const m = item.msg;
    const animate = animated.current.has(m.id);
    const deletable = canDeleteMessage(m, Date.now()) && !m.local;
    const reportable = !m.mine && m.status === 'sent';
    const bubble =
      m.kind === 'post' ? (
        <PostBubble m={m} c={c} post={m.ref?.post_id ? posts[m.ref.post_id] : undefined} first={item.first} last={item.last} onOpen={() => m.ref?.post_id && navigation.navigate('SharedPost', { postId: m.ref.post_id })} />
      ) : m.kind === 'meal' ? (
        <MealBubble m={m} c={c} first={item.first} last={item.last} />
      ) : m.kind === 'story_reply' ? (
        <StoryReplyBubble m={m} c={c} first={item.first} last={item.last} />
      ) : (
        <TextBubble m={m} c={c} first={item.first} last={item.last} />
      );
    return (
      <View style={{ marginTop: item.first ? 6 : 0 }}>
        <MsgIn animate={animate} mine={m.mine}>
          <Pressable
            onPress={m.local === 'failed' ? () => retry(m) : undefined}
            onLongPress={deletable || reportable ? () => { haptic('selection'); setActionsFor(m); } : undefined}
            delayLongPress={350}
            accessibilityRole={m.local === 'failed' ? 'button' : 'text'}
            accessibilityLabel={[m.body ?? '', m.local === 'sending' ? tr('dm.chat.sending') : m.local === 'failed' ? tr('dm.chat.failed') : null].filter(Boolean).join(', ')}
            accessibilityHint={deletable || reportable ? tr('dm.chat.msg_actions_a11y') : undefined}
            accessibilityActions={deletable || reportable ? [{ name: 'longpress', label: tr('dm.chat.msg_actions') }] : undefined}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'longpress') setActionsFor(m);
            }}
            testID={`dm-msg-${m.id}`}
          >
            {bubble}
          </Pressable>
        </MsgIn>
        {m.local === 'sending' ? <Text style={[styles.meta, { color: c.sec, alignSelf: 'flex-end' }]}>{tr('dm.chat.sending')}</Text> : null}
        {m.local === 'failed' ? <Text style={[styles.meta, { color: c.red, alignSelf: 'flex-end' }]}>{tr('dm.chat.failed')}</Text> : null}
      </View>
    );
  };

  const hasDraft = draft.trim().length > 0;
  const cannot = meta && !meta.can_send ? meta.cannot_reason : null;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]} testID="dm-chat">
      <View style={{ height: insets.top, backgroundColor: c.bg }} />
      <View style={[styles.header, { borderBottomColor: c.line, backgroundColor: c.bg }]}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={tr('dm.chat.back')} style={dmStyles.icon44} testID="dm-chat-back">
          <DmIcon name="arrowLeft" size={22} color={c.text} />
        </Pressable>
        <Pressable onPress={openProfile} accessibilityRole="button" accessibilityLabel={tr('dm.chat.profile_a11y', { name })} style={styles.headProfile}>
          <PersonAvatar person={other ?? { avatar_url: params.avatar ?? null }} size={36} bg={c.ph} glyph={c.phGlyph} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.headName, { color: c.text }]} numberOfLines={1}>
              {name}
            </Text>
            {handle ? (
              <Text style={[styles.headSub, { color: c.sec }]} numberOfLines={1}>
                @{handle}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} disabled={!meta} accessibilityRole="button" accessibilityLabel={tr('dm.chat.options')} style={dmStyles.icon44} testID="dm-chat-options">
          <DmIcon name="dotsThree" size={24} color={c.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loadError && !meta ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={[styles.body15, { color: c.sec, textAlign: 'center' }]}>
              {loadError === 'engel' ? tr('dm.chat.cannot_engel') : loadError === 'gizli_hesap' ? tr('dm.chat.cannot_gizli_hesap') : tr('dm.load_error')}
            </Text>
            {loadError !== 'engel' && loadError !== 'gizli_hesap' ? (
              <Pressable onPress={() => void load()} accessibilityRole="button" style={[styles.outlineBtn, { backgroundColor: c.card, borderColor: c.line2 }]}>
                <Text style={[styles.btn14, { color: c.text }]}>{tr('dm.retry')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <FadeIn deps={[isRequest]} style={styles.flex}>
            <FlatList
              {...SCROLL_KEYBOARD}
              data={rows}
              inverted
              keyExtractor={(r) => r.key}
              renderItem={renderRow}
              accessibilityLabel={tr('dm.chat.log')}
              contentContainerStyle={styles.log}
              onEndReached={() => void loadOlder()}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                isRequest && meta ? (
                  <View style={styles.reqProfile}>
                    <PersonAvatar person={other} size={80} bg={c.ph} glyph={c.phGlyph} />
                    <Text style={[styles.reqName, { color: c.text }]}>{name}</Text>
                    {handle ? <Text style={[styles.sub14, { color: c.sec }]}>@{handle}</Text> : null}
                    {!other?.i_follow ? <Text style={[styles.sub14, { color: c.sec }]}>{tr('dm.chat.not_following')}</Text> : null}
                    <Pressable onPress={openProfile} accessibilityRole="button" style={[styles.outlineBtn, { backgroundColor: c.card, borderColor: c.line2, minHeight: 44, marginTop: 8 }]} testID="dm-req-profile">
                      <Text style={[styles.btn14, { color: c.text }]}>{tr('dm.chat.view_profile')}</Text>
                    </Pressable>
                  </View>
                ) : null
              }
            />
          </FadeIn>
        )}

        {isRequest && meta ? (
          <View
            accessibilityLabel={tr('dm.chat.req_label')}
            style={[styles.reqBar, { borderTopColor: c.line, backgroundColor: c.bg, paddingBottom: Math.max(insets.bottom, 16) }]}
            testID="dm-req-bar"
          >
            <Text style={[styles.reqTitle, { color: c.text }]}>{tr('dm.chat.req_title', { name })}</Text>
            <Text style={[styles.reqBody, { color: c.sec }]}>{tr('dm.chat.req_body')}</Text>
            <View style={styles.reqBtns}>
              <Pressable onPress={() => setBlockAsk(true)} accessibilityRole="button" style={[styles.reqBtn, { backgroundColor: c.card, borderColor: c.line2, borderWidth: 1 }]} testID="dm-req-block">
                <Text style={[styles.reqBtnText, { color: c.red }]} >
                  {tr('dm.chat.block')}
                </Text>
              </Pressable>
              <Pressable onPress={() => void decline()} accessibilityRole="button" style={[styles.reqBtn, { backgroundColor: c.card, borderColor: c.line2, borderWidth: 1 }]} testID="dm-req-delete">
                <Text style={[styles.reqBtnText, { color: c.text }]} >
                  {tr('dm.chat.del')}
                </Text>
              </Pressable>
              <Pressable onPress={() => void accept()} accessibilityRole="button" style={[styles.reqBtn, { backgroundColor: LIME }]} testID="dm-req-accept">
                <Text style={[styles.reqBtnText, { color: INK }]} >
                  {tr('dm.chat.accept')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : meta && cannot ? (
          <View style={[styles.composer, { borderTopColor: c.line, backgroundColor: c.bg, paddingBottom: Math.max(insets.bottom, 8) + 4 }]} testID="dm-cannot">
            <Text style={[styles.reqBody, { color: c.sec, flex: 1 }]}>
              {cannot === 'gizli_hesap' ? tr('dm.chat.cannot_gizli_hesap') : tr('dm.chat.cannot_engel')}
            </Text>
          </View>
        ) : meta ? (
          <View style={[styles.composer, { borderTopColor: c.line, backgroundColor: c.bg, paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
            <View style={[styles.field, { backgroundColor: c.card, borderColor: c.line }]}>
              <TextInput
                value={draft}
                onChangeText={onDraft}
                placeholder={tr('dm.chat.placeholder')}
                placeholderTextColor={c.sec}
                accessibilityLabel={tr('dm.chat.field')}
                multiline
                maxLength={1000}
                style={[styles.input, { color: c.text }]}
                testID="dm-composer"
              />
            </View>
            {hasDraft ? (
              <FadeIn>
                <Pressable onPress={send} accessibilityRole="button" accessibilityLabel={tr('dm.chat.send')} style={[styles.sendBtn, { backgroundColor: LIME }]} testID="dm-send">
                  <DmIcon name="arrowUp" size={20} color={INK} />
                </Pressable>
              </FadeIn>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ChatMenuSheet
        visible={menu}
        name={name}
        muted={!!meta?.muted}
        c={c}
        onClose={() => setMenu(false)}
        onToggleMute={() => void toggleMute()}
        onReport={() => {
          setMenu(false);
          if (conversationId) setReport({ type: 'conversation', id: conversationId });
        }}
        onBlock={() => {
          setMenu(false);
          setBlockAsk(true);
        }}
      />
      <MessageActionsSheet
        visible={!!actionsFor}
        c={c}
        canDelete={!!actionsFor && canDeleteMessage(actionsFor, Date.now())}
        canReport={!!actionsFor && !actionsFor.mine}
        onClose={() => setActionsFor(null)}
        onDelete={() => actionsFor && void deleteMessage(actionsFor)}
        onReport={() => {
          const m = actionsFor;
          setActionsFor(null);
          if (m) setReport({ type: 'message', id: m.id });
        }}
      />
      <BlockAlert visible={blockAsk} name={name} c={c} onCancel={() => setBlockAsk(false)} onConfirm={() => void confirmBlock()} />
      <ReportModal
        visible={!!report}
        authorName={name}
        onClose={() => setReport(null)}
        onSubmit={async (reason, note) => {
          if (!report) return false;
          try {
            await getDmClient().report({ targetType: report.type, target: report.id, reason: reportReasonText(reason, note) });
            return true;
          } catch {
            return false;
          }
        }}
        onBlock={other ? () => { setReport(null); setBlockAsk(true); } : undefined}
      />
      <StatusToast text={status ?? (params.vitrinView === 'blocked' ? tr('dm.chat.blocked', { name }) : null)} c={c} icon="prohibit" />
      <Toast visible={!!errorText} message={errorText ?? ''} tone="error" onDismiss={() => setErrorText(null)} autoHideMs={4000} testID="dm-error" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, borderBottomWidth: 1, zIndex: 5 },
  headProfile: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headName: { fontFamily: fontFamily.bodyBold, fontSize: 16, lineHeight: 19 },
  headSub: { fontSize: 13, lineHeight: 16 },
  log: { paddingTop: 12, paddingBottom: 12, paddingHorizontal: 16, gap: 6 },
  seen: { alignSelf: 'flex-end', fontFamily: fontFamily.bodySemibold, fontSize: 12, paddingRight: 4 },
  meta: { fontSize: 12, marginTop: 2, paddingRight: 4 },
  risky: { alignSelf: 'flex-start', marginTop: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', maxWidth: 300 },
  riskyText: { fontSize: 12, lineHeight: 16 },
  composer: { borderTopWidth: 1, paddingTop: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  field: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 22, borderWidth: 1, paddingLeft: 16, paddingRight: 12, justifyContent: 'center' },
  input: { fontFamily: fontFamily.bodyRegular, fontSize: 16, lineHeight: 21, maxHeight: 120, paddingTop: Platform.OS === 'ios' ? 11 : 8, paddingBottom: Platform.OS === 'ios' ? 11 : 8 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reqProfile: { alignItems: 'center', gap: 4, paddingTop: 8, paddingBottom: 18 },
  reqName: { marginTop: 6, fontFamily: fontFamily.headingBold, fontSize: 20, textAlign: 'center' },
  sub14: { fontSize: 14, textAlign: 'center' },
  reqBar: { borderTopWidth: 1, paddingTop: 16, paddingHorizontal: 16, gap: 12 },
  reqTitle: { fontFamily: fontFamily.bodyBold, fontSize: 14, textAlign: 'center' },
  reqBody: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  reqBtns: { flexDirection: 'row', gap: 8 },
  reqBtn: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  reqBtnText: { fontFamily: fontFamily.bodyBold, fontSize: 15, textAlign: 'center' },
  errorBox: { flex: 1, paddingTop: 48, paddingHorizontal: 32, alignItems: 'center', gap: 8 },
  body15: { fontSize: 15, lineHeight: 21 },
  outlineBtn: { minHeight: 48, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btn14: { fontFamily: fontFamily.bodySemibold, fontSize: 14 },
});
