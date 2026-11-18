// G63-S1 — Yeni mesaj (docs/g63/design/FinChatNew.dc.html: suggest · results · none). Sayfa (modal) üstte 14 köşe,
// 36×5 tutamaç, başlık 48 (Bricolage 18, ortada) + sağda 30 pt çip içinde X (44 dokunma); "Kime:" satırı ≥ 48,
// üst/alt çizgi; öneri/son/sonuç satırı ≥ 60 (avatar 44, ad 15 kalın, alt 13), rol çipi 22; sonuç yok: 64 daire +
// çizgi büyüteç, başlık Bricolage 20, Davet bağlantısı paylaş 44. Görünüm değişiminde 220 ms solma.
// Paylaş kipi (G61 ShareSheet "Mesajla gönder"): kişi seçilince gönderi `kind='post'` gönderilir, sayfa kapanır.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import { FinText as Text } from '../../../core/design/components/FinText';
import { Toast, fontFamily, haptic } from '../../../core/design';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { useT } from '../../../core/i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { getDmClient } from '../client';
import { errorKey, newIdem, rpcCode } from '../rules';
import type { DmInboxItem, DmPerson } from '../types';
import { DM_SEARCH_NONE } from './paths';
import { DmIcon, FadeIn, PersonAvatar, dmStyles, personName, roleLabel, useDmPalette } from './parts';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function NewMessageScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'DmNew'>>();
  const share = route.params?.share ?? null;
  const insets = useSafeAreaInsets();
  const c = useDmPalette();
  const { t: tr, lang } = useT();
  const [query, setQuery] = useState(route.params?.vitrinQuery ?? '');
  const [suggested, setSuggested] = useState<DmPerson[]>([]);
  const [recent, setRecent] = useState<DmInboxItem[]>([]);
  const [results, setResults] = useState<DmPerson[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const reqSeq = useRef(0);

  useEffect(() => {
    void getDmClient()
      .searchPeople({ q: '' })
      .then((r) => setSuggested(r.items.slice(0, 3)))
      .catch(() => {});
    void getDmClient()
      .inbox({ tab: 'all' })
      .then((p) => setRecent(p.items.filter((i) => i.other).slice(0, 5)))
      .catch(() => {});
  }, []);

  const q = query.trim();
  useEffect(() => {
    if (q.replace(/^@/, '').length < 2) {
      setResults(null);
      return;
    }
    const my = ++reqSeq.current;
    const t = setTimeout(() => {
      getDmClient()
        .searchPeople({ q })
        .then((r) => {
          if (my === reqSeq.current) setResults(r.items);
        })
        .catch(() => {
          if (my === reqSeq.current) setResults([]);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const view: 'suggest' | 'results' | 'none' = q.replace(/^@/, '').length < 2 ? 'suggest' : results === null ? 'suggest' : results.length ? 'results' : 'none';

  const pick = async (p: Pick<DmPerson, 'id' | 'handle' | 'avatar_url'> & { name: string }) => {
    if (busy) return;
    haptic('selection');
    setBusy(p.id);
    try {
      const { conversation_id } = await getDmClient().open({ user: p.id });
      if (share?.kind === 'post') {
        const res = await getDmClient().send({ conversation: conversation_id, body: null, kind: 'post', ref: { post_id: share.postId }, idem: newIdem() });
        if (!res.ok) {
          setErrorText(tr(errorKey(res.error, 'scope' in res ? res.scope : undefined)));
          setBusy(null);
          return;
        }
        haptic('success');
        navigation.replace('DmChat', { conversationId: conversation_id, name: p.name, handle: p.handle, avatar: p.avatar_url });
        return;
      }
      navigation.replace('DmChat', { conversationId: conversation_id, name: p.name, handle: p.handle, avatar: p.avatar_url });
    } catch (e) {
      setErrorText(tr(errorKey(rpcCode(e))));
      setBusy(null);
    }
  };

  const invite = () => {
    void Share.share({ message: tr('dm.new.invite_text') }).catch(() => {});
  };

  const subFor = (p: DmPerson) => (p.follows_me ? tr('dm.sg_follows_you') : p.i_follow ? tr('dm.sg_you_follow') : p.handle ? `@${p.handle}` : '');
  const noneTitle = useMemo(() => tr('dm.new.none', { q }), [tr, q]);

  const PersonRow = ({ p, sub, role }: { p: DmPerson; sub: string; role?: string | null }) => (
    <Pressable
      onPress={() => void pick({ id: p.id, handle: p.handle, avatar_url: p.avatar_url, name: personName(p, lang) })}
      disabled={!!busy}
      accessibilityRole="button"
      accessibilityLabel={[personName(p, lang), role, sub].filter(Boolean).join(', ')}
      accessibilityState={{ busy: busy === p.id }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.line }]}
      testID={`dm-new-person-${p.id}`}
    >
      <PersonAvatar person={p} size={44} bg={c.newPh} glyph={c.newPhGlyph} />
      <View style={styles.col}>
        <View style={styles.nameLine}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {personName(p, lang)}
          </Text>
          {role ? (
            <View style={[styles.roleChip, { backgroundColor: c.newChip }]}>
              <Text style={[styles.roleText, { color: c.text }]}>{role}</Text>
            </View>
          ) : null}
        </View>
        {sub ? (
          <Text style={[styles.sub, { color: c.sec }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.newBg }]} testID="dm-new">
      <View accessibilityElementsHidden style={[styles.handle, { backgroundColor: c.line2 }]} />
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {share ? tr('dm.new.share_title') : tr('dm.new.title')}
        </Text>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={tr('dm.new.close')} style={[dmStyles.icon44, styles.close]} testID="dm-new-close">
          <View style={[styles.closeChip, { backgroundColor: c.newChip }]}>
            <DmIcon name="x" size={14} color={c.text} />
          </View>
        </Pressable>
      </View>
      <View style={[styles.to, { borderColor: c.line }]}>
        <Text style={[styles.toLabel, { color: c.sec }]}>{tr('dm.new.to')}</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus={!route.params?.vitrinQuery}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          accessibilityLabel={tr('dm.new.to_a11y')}
          returnKeyType="search"
          style={[styles.toInput, { color: c.text }]}
          testID="dm-new-input"
        />
        {q ? (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={tr('dm.new.clear')} style={dmStyles.icon44}>
            <View style={[styles.clearDot, { backgroundColor: c.sec }]}>
              <DmIcon name="x" size={11} color={c.newBg} />
            </View>
          </Pressable>
        ) : null}
      </View>

      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {view === 'suggest' ? (
          <FadeIn deps={['suggest']}>
            {suggested.length ? (
              <>
                <Text accessibilityRole="header" style={[styles.h2, { color: c.sec }]}>
                  {tr('dm.new.suggested')}
                </Text>
                {suggested.map((p) => (
                  <PersonRow key={p.id} p={p} sub={p.role === 'diyetisyen' ? tr('dm.role.diyetisyen') : subFor(p)} />
                ))}
              </>
            ) : null}
            {recent.length ? (
              <>
                <Text accessibilityRole="header" style={[styles.h2, { color: c.sec, marginTop: 12 }]}>
                  {tr('dm.new.recent')}
                </Text>
                {recent.map((it) => (
                  <PersonRow key={it.conversation_id} p={it.other!} sub={it.other?.handle ? `@${it.other.handle}` : ''} />
                ))}
              </>
            ) : null}
          </FadeIn>
        ) : view === 'results' ? (
          <FadeIn deps={['results']}>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.h2, { color: c.sec }]}>
              {tr('dm.new.people')}
            </Text>
            {results!.map((p) => (
              <PersonRow
                key={p.id}
                p={p}
                role={roleLabel(p.role, tr)}
                sub={p.handle ? (p.mutual_count ? tr('dm.new.mutual', { handle: p.handle, n: p.mutual_count }) : `@${p.handle}`) : ''}
              />
            ))}
          </FadeIn>
        ) : (
          <FadeIn deps={['none']}>
            <View style={styles.none}>
              <View style={[styles.noneIcon, { backgroundColor: c.newCard, borderColor: c.line }]}>
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                  <Path d={DM_SEARCH_NONE} stroke={c.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.noneTitle, { color: c.text }]}>
                {noneTitle}
              </Text>
              <Text style={[styles.noneBody, { color: c.sec }]}>{tr('dm.new.none_body')}</Text>
              <Pressable onPress={invite} accessibilityRole="button" style={[styles.invite, { backgroundColor: c.newCard, borderColor: c.line2 }]} testID="dm-new-invite">
                <DmIcon name="export" size={18} color={c.text} />
                <Text style={[styles.inviteText, { color: c.text }]}>{tr('dm.new.invite')}</Text>
              </Pressable>
            </View>
          </FadeIn>
        )}
      </ScrollView>
      <Toast visible={!!errorText} message={errorText ?? ''} tone="error" onDismiss={() => setErrorText(null)} autoHideMs={4000} testID="dm-new-error" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginTop: 6 },
  header: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 52 },
  title: { fontFamily: fontFamily.headingBold, fontSize: 18, textAlign: 'center' },
  close: { position: 'absolute', right: 4, top: 2 },
  closeChip: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  to: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 4, borderTopWidth: 1, borderBottomWidth: 1 },
  toLabel: { fontSize: 16 },
  toInput: { flex: 1, minWidth: 0, fontFamily: fontFamily.bodyRegular, fontSize: 16, paddingVertical: 10 },
  clearDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  h2: { marginTop: 14, marginHorizontal: 16, marginBottom: 2, fontFamily: fontFamily.bodyBold, fontSize: 13 },
  row: { minHeight: 60, paddingVertical: 6, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  col: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontFamily: fontFamily.bodyBold, fontSize: 15, flexShrink: 1 },
  sub: { fontSize: 13 },
  roleChip: { minHeight: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: 'center' },
  roleText: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  none: { paddingTop: 40, paddingHorizontal: 32, alignItems: 'center', gap: 10 },
  noneIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  noneTitle: { marginTop: 4, fontFamily: fontFamily.headingBold, fontSize: 20, lineHeight: 25, textAlign: 'center' },
  noneBody: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  invite: { marginTop: 8, minHeight: 44, paddingHorizontal: 20, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  inviteText: { fontFamily: fontFamily.bodySemibold, fontSize: 15 },
});
