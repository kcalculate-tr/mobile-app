// G63-S1 — Gelen kutusu (docs/g63/design/FinInbox.dc.html: chats · requests · chatsEmpty · requestsEmpty).
// Ölçüler birebir: başlık 44 (geri 44 · başlık Bricolage 20 · yeni mesaj 44), arama 44 / 12 köşe / iç çizgi,
// sekmeler 2 eşit sütun ≥ 48 + 64×3 alt çubuk, satır ≥ 76 (avatar 52, ad 16, önizleme 14, zaman 13),
// okunmamış = lime 10 nokta (açıkta #4A6B00 halka), boş hâl 72 daire + 22 başlık + 48 mürekkep düğme,
// öneri satırı ≥ 68 (avatar 48, "Mesaj" 36 hap ≥ 44 dokunma). Sekme değişiminde 220 ms solma.
// Veri: dm_inbox (çek-yenile + odakta + ön plana gelişte + Realtime olayında yeniden çek).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FinText as Text } from '../../../core/design/components/FinText';
import { fontFamily, haptic } from '../../../core/design';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { useT } from '../../../core/i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { getDmClient } from '../client';
import { hasLinkOrPhone, previewText, relTime } from '../rules';
import { useDmBadge } from '../store';
import type { DmInboxItem, DmPerson } from '../types';
import { DmIcon, FadeIn, LIME, PersonAvatar, dmStyles, personName, useDmPalette } from './parts';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'all' | 'requests';

export default function InboxScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'DmInbox'>>();
  const insets = useSafeAreaInsets();
  const c = useDmPalette();
  const { t: tr, lang } = useT();
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Record<Tab, DmInboxItem[] | null>>({ all: null, requests: null });
  const [counts, setCounts] = useState({ unread: 0, requests: 0 });
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [suggested, setSuggested] = useState<DmPerson[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const busy = useRef(false);

  const load = useCallback(
    async (which: Tab = tab) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const page = await getDmClient().inbox({ tab: which });
        setItems((s) => ({ ...s, [which]: page.items }));
        setCounts({ unread: page.unread, requests: page.requests });
        useDmBadge.setState({ unread: page.unread, requests: page.requests });
        setError(false);
        setNow(Date.now());
        if (which === 'all' && page.items.length === 0) {
          const sug = await getDmClient().searchPeople({ q: '' }).catch(() => null);
          if (sug) setSuggested(sug.items.slice(0, 3));
        }
      } catch {
        setError(true);
      } finally {
        busy.current = false;
      }
    },
    [tab],
  );

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  // Odakta + ön plana gelişte yenile (Realtime yoksa da güncel kalır).
  useEffect(() => {
    const off = navigation.addListener('focus', () => void load());
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void load();
    });
    return () => {
      off();
      sub.remove();
    };
  }, [navigation, load]);

  // Realtime: herhangi bir sohbette mesaj olayı → listeyi yeniden çek (RLS yalnız benim sohbetlerimi verir).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = getDmClient().subscribe({
      conversation: null,
      onEvent: () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => void load(), 400);
      },
    });
    return () => {
      if (t) clearTimeout(t);
      off();
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const list = items[tab];
  const q = query.trim().toLocaleLowerCase(lang === 'en' ? 'en' : 'tr');
  const filtered = useMemo(() => {
    if (!list) return null;
    if (!q) return list;
    return list.filter((it) => `${personName(it.other, lang)} ${it.other?.handle ?? ''} ${previewText(it, tr)}`.toLocaleLowerCase(lang === 'en' ? 'en' : 'tr').includes(q));
  }, [list, q, lang, tr]);

  const openChat = (it: DmInboxItem) => {
    haptic('selection');
    navigation.navigate('DmChat', { conversationId: it.conversation_id, name: personName(it.other, lang), handle: it.other?.handle ?? null, avatar: it.other?.avatar_url ?? null });
  };
  const openNew = () => {
    haptic('selection');
    navigation.navigate('DmNew', undefined);
  };
  const messagePerson = async (p: DmPerson) => {
    try {
      const { conversation_id } = await getDmClient().open({ user: p.id });
      navigation.navigate('DmChat', { conversationId: conversation_id, name: personName(p, lang), handle: p.handle, avatar: p.avatar_url });
    } catch {
      // nötr: sohbet açılamadı → hiçbir şey (kişi öneriden düşer)
    }
  };

  const empty = filtered !== null && (list?.length ?? 0) === 0;
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'all', label: tr('dm.tab_chats') },
    { key: 'requests', label: counts.requests > 0 ? tr('dm.tab_requests', { n: counts.requests }) : tr('dm.tab_requests_plain') },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]} testID="dm-inbox">
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={tr('dm.back')} style={dmStyles.icon44} testID="dm-inbox-back">
          <DmIcon name="arrowLeft" size={22} color={c.text} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.h1, { color: c.text }]} numberOfLines={1}>
          {tr('dm.title')}
        </Text>
        <Pressable onPress={openNew} accessibilityRole="button" accessibilityLabel={tr('dm.new_msg')} style={dmStyles.icon44} testID="dm-inbox-new">
          <DmIcon name="notePencil" size={24} color={c.text} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: c.field, borderColor: c.line }]}>
          <DmIcon name="search" size={18} color={c.sec} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tr('dm.search')}
            placeholderTextColor={c.sec}
            accessibilityLabel={tr('dm.search_a11y')}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={[styles.searchInput, { color: c.text }]}
            testID="dm-inbox-search"
          />
        </View>
      </View>

      <View accessibilityRole="tablist" accessibilityLabel={tr('dm.tabs_a11y')} style={[styles.tabs, { borderBottomColor: c.line }]}>
        {tabs.map((tb) => {
          const on = tab === tb.key;
          return (
            <Pressable
              key={tb.key}
              onPress={() => {
                if (!on) haptic('selection');
                setTab(tb.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={styles.tab}
              testID={`dm-tab-${tb.key}`}
            >
              <Text style={[styles.tabText, { color: c.text, fontFamily: on ? fontFamily.bodyBold : fontFamily.bodyMedium }]} numberOfLines={1}>
                {tb.label}
              </Text>
              <View style={[styles.tabBar, { backgroundColor: on ? c.text : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>

      {error && list === null ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Text style={[styles.body15, { color: c.sec, textAlign: 'center' }]}>{tr('dm.load_error')}</Text>
          <Pressable onPress={() => void load()} accessibilityRole="button" style={[styles.outlineBtn, { backgroundColor: c.card, borderColor: c.line2 }]}>
            <Text style={[styles.btn15, { color: c.text }]}>{tr('dm.retry')}</Text>
          </Pressable>
        </View>
      ) : filtered === null ? null : empty && tab === 'all' ? (
        <FadeIn deps={[tab, 'empty']} style={styles.flex}>
          <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            <View style={styles.emptyBox}>
              <View style={[styles.emptyIcon, { backgroundColor: c.card, borderColor: c.line }]}>
                <DmIcon name="chatCircle" size={32} color={c.text} />
              </View>
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.emptyTitle, { color: c.text }]}>
                {tr('dm.empty_title')}
              </Text>
              <Text style={[styles.body15, { color: c.sec, textAlign: 'center' }]}>{tr('dm.empty_body')}</Text>
              <Pressable onPress={openNew} accessibilityRole="button" style={[styles.inkBtn, { backgroundColor: c.ink }]} testID="dm-empty-new">
                <DmIcon name="notePencil" size={18} color={c.onInk} />
                <Text style={[styles.inkBtnText, { color: c.onInk }]}>{tr('dm.new_msg')}</Text>
              </Pressable>
            </View>
            {suggested.length > 0 ? (
              <>
                <Text accessibilityRole="header" style={[styles.h2, { color: c.text }]}>
                  {tr('dm.suggested')}
                </Text>
                {suggested.map((p) => (
                  <View key={p.id} style={styles.sugRow}>
                    <PersonAvatar person={p} size={48} bg={c.ph} glyph={c.phGlyph} />
                    <View style={styles.flexCol}>
                      <Text style={[styles.sugName, { color: c.text }]} numberOfLines={1}>
                        {personName(p, lang)}
                      </Text>
                      <Text style={[styles.sub13, { color: c.sec }]} numberOfLines={1}>
                        {p.role === 'diyetisyen' ? tr('dm.role.diyetisyen') : p.follows_me ? tr('dm.sg_follows_you') : tr('dm.sg_you_follow')}
                      </Text>
                    </View>
                    <Pressable onPress={() => void messagePerson(p)} accessibilityRole="button" accessibilityLabel={tr('dm.message_a11y', { name: personName(p, lang) })} style={styles.msgHit}>
                      <View style={[styles.msgPill, { borderColor: c.line2 }]}>
                        <Text style={[styles.msgPillText, { color: c.text }]}>{tr('dm.message')}</Text>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </FadeIn>
      ) : empty && tab === 'requests' ? (
        <FadeIn deps={[tab, 'empty']} style={styles.flex}>
          <ScrollView {...SCROLL_KEYBOARD} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            <View style={[styles.emptyBox, { paddingTop: 56 }]}>
              <View style={[styles.emptyIcon, { backgroundColor: c.card, borderColor: c.line }]}>
                <DmIcon name="envelope" size={32} color={c.text} />
              </View>
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.emptyTitle, { color: c.text }]}>
                {tr('dm.req_empty_title')}
              </Text>
              <Text style={[styles.body15, { color: c.sec, textAlign: 'center' }]}>{tr('dm.req_empty_body')}</Text>
              <Pressable
                onPress={() => navigation.navigate('ProfileSub', { sub: 'privacy' })}
                accessibilityRole="button"
                style={[styles.outlineBtn, { backgroundColor: c.card, borderColor: c.line2 }]}
                testID="dm-req-settings"
              >
                <Text style={[styles.btn15, { color: c.text }]}>{tr('dm.req_settings')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </FadeIn>
      ) : (
        <FadeIn deps={[tab]} style={styles.flex}>
          <FlatList
            {...SCROLL_KEYBOARD}
            data={filtered}
            keyExtractor={(it) => it.conversation_id}
            accessibilityLabel={tab === 'all' ? tr('dm.tab_chats') : tr('dm.tab_requests_plain')}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ paddingTop: tab === 'all' ? 4 : 0, paddingBottom: insets.bottom + 16 }}
            ListHeaderComponent={
              tab === 'requests' ? <Text style={[styles.reqNote, { color: c.sec }]}>{tr('dm.req_note')}</Text> : null
            }
            ListFooterComponent={
              tab === 'requests' ? <Text style={[styles.reqHidden, { color: c.sec }]}>{tr('dm.req_hidden')}</Text> : null
            }
            ListEmptyComponent={q ? <Text style={[styles.reqNote, { color: c.sec, textAlign: 'center', marginTop: 24 }]}>{tr('dm.no_results')}</Text> : null}
            renderItem={({ item }) =>
              tab === 'requests' ? (
                <RequestRow item={item} now={now} onPress={() => openChat(item)} />
              ) : (
                <ChatRow item={item} now={now} onPress={() => openChat(item)} />
              )
            }
          />
        </FadeIn>
      )}
    </View>
  );
}

function ChatRow({ item, now, onPress }: { item: DmInboxItem; now: number; onPress: () => void }) {
  const c = useDmPalette();
  const { t: tr, lang } = useT();
  const unread = item.unread > 0;
  const name = personName(item.other, lang);
  const preview = previewText(item, tr);
  const time = relTime(item.last_message_at, now, tr);
  const a11y = [name, preview, time, unread ? (item.unread > 1 ? tr('dm.unread_n', { n: item.unread }) : tr('dm.unread')) : null, item.muted ? tr('dm.muted') : null]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.line }]} testID={`dm-row-${item.conversation_id}`}>
      <PersonAvatar person={item.other} size={52} bg={c.ph} glyph={c.phGlyph} />
      <View style={styles.flexCol}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, { color: c.text, fontFamily: unread ? fontFamily.bodyBold : fontFamily.bodySemibold }]} numberOfLines={1}>
            {name}
          </Text>
          {item.muted ? <DmIcon name="bellSlash" size={15} color={c.sec} /> : null}
          <Text style={[styles.time, { color: c.sec }]}>{time}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, unread ? { color: c.text, fontFamily: fontFamily.bodySemibold } : { color: c.sec }]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {unread ? <View style={[styles.dot, { backgroundColor: LIME, borderColor: c.dotRing }]} testID="dm-unread-dot" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function RequestRow({ item, now, onPress }: { item: DmInboxItem; now: number; onPress: () => void }) {
  const c = useDmPalette();
  const { t: tr, lang } = useT();
  const name = personName(item.other, lang);
  const preview = previewText(item, tr);
  const risky = hasLinkOrPhone(item.last?.body);
  const time = relTime(item.last_message_at, now, tr);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[name, preview, time, risky ? tr('dm.req_risky') : null].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.line }]}
      testID={`dm-req-${item.conversation_id}`}
    >
      <PersonAvatar person={item.other} size={52} bg={c.ph} glyph={c.phGlyph} />
      <View style={styles.flexCol}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, { color: c.text, fontFamily: fontFamily.bodyBold, flexShrink: 1 }]} numberOfLines={1}>
            {name}
          </Text>
          {item.other?.handle ? (
            <Text style={[styles.time, { color: c.sec, marginLeft: 0, flexShrink: 2 }]} numberOfLines={1}>
              @{item.other.handle}
            </Text>
          ) : null}
          <Text style={[styles.time, { color: c.sec }]}>{time}</Text>
        </View>
        <Text style={[styles.preview, { color: c.sec }]} numberOfLines={1}>
          {preview}
        </Text>
        {risky ? (
          <Text style={[styles.sub13, { color: c.sec }]} numberOfLines={2}>
            {tr('dm.req_risky')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  flexCol: { flex: 1, minWidth: 0, gap: 2 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  h1: { flex: 1, minWidth: 0, fontFamily: fontFamily.headingBold, fontSize: 20 },
  searchWrap: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 4 },
  search: { minHeight: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: fontFamily.bodyRegular, fontSize: 16, paddingVertical: 8 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  tabText: { fontSize: 15 },
  tabBar: { position: 'absolute', bottom: -1, left: '50%', width: 64, marginLeft: -32, height: 3, borderRadius: 2 },
  row: { minHeight: 76, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  name: { flexShrink: 1, minWidth: 0, fontSize: 16 },
  time: { flexShrink: 0, marginLeft: 'auto', fontSize: 13 },
  preview: { flex: 1, minWidth: 0, fontSize: 14 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  reqNote: { marginTop: 12, marginHorizontal: 16, marginBottom: 6, fontSize: 13 },
  reqHidden: { marginTop: 8, marginHorizontal: 16, fontSize: 13 },
  emptyBox: { paddingTop: 40, paddingHorizontal: 32, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 6, fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 26, textAlign: 'center' },
  body15: { fontSize: 15, lineHeight: 21 },
  inkBtn: { marginTop: 10, minHeight: 48, paddingHorizontal: 24, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  inkBtnText: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
  outlineBtn: { marginTop: 10, minHeight: 48, paddingHorizontal: 22, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btn15: { fontFamily: fontFamily.bodySemibold, fontSize: 15 },
  h2: { marginTop: 32, marginHorizontal: 16, marginBottom: 4, fontFamily: fontFamily.headingBold, fontSize: 18 },
  sugRow: { minHeight: 68, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sugName: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  sub13: { fontSize: 13 },
  msgHit: { minHeight: 44, justifyContent: 'center' },
  msgPill: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  msgPillText: { fontFamily: fontFamily.bodySemibold, fontSize: 14 },
  errorBox: { paddingTop: 48, paddingHorizontal: 32, alignItems: 'center', gap: 8 },
});
