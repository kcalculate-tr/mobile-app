// G22-S2 md.4 — Keşfet arama = profil + içerik (FinSearch · FinSearchResults ·
// FinSearchEmpty, TR/EN, açık/koyu). Yemek araması DEĞİL (o Tara › Elle'de kalır).
//
// Durumlar: son aramalar (yazmadan önce; yerel, tek tek / hepsini sil) → yazınca
// bekleme (debounce) + yükleniyor iskeleti → sonuçlar (Kişi listesi · Gönderi ızgarası
// · Tarif listesi) / sonuç yok ("Şurada da ara") / hata (Tekrar dene).
// Kişiye dokun → açık profil (PublicProfile); gönderi/tarife dokun → gönderi
// (SharedPost). Vazgeç → geri. Hareket yalnız motion.tsx token'larıyla.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  FinText as Text,
  PREMIUM,
  REDUCED,
  fontFamily,
  haptic,
  useReducedMotion,
  useTheme,
} from '../../../core/design';
import { SlidingIndicator, useRowWidth } from '../../../core/design/sectionSlide';
import { useT } from '../../../core/i18n';
import { getProfilClient } from '../../profil';

import { getSearchClient } from '../search/client';
import {
  EMPTY_RESULTS,
  SEARCH_DEBOUNCE_MS,
  SEARCH_SCOPES,
  addRecent,
  clearRecent,
  handleLabel,
  isSearchable,
  kcalOf,
  normalizeQuery,
  otherScopes,
  postImage,
  postTitle,
  proteinGrams,
  queryKey,
  quoteQuery,
  removeRecent,
  scopeCounts,
  scopeForQuery,
  searchView,
  type RecentSearch,
} from '../search/logic';
import { loadRecentSearches, saveRecentSearches } from '../search/recentStorage';
import type { SearchFollowState, SearchPost, SearchProfile, SearchResults, SearchScope } from '../search/types';
import { Avatar } from './Avatar';
import { roleBadgeKey } from './format';

// FinSearch renkleri — tema token'ı olmayan üç ara ton (tasarım t.track/t.seg/t.line2/t.ph).
function palette(isDark: boolean) {
  return isDark
    ? { track: '#1C1C1E', seg: '#3A3A3C', line2: '#48484A', ph: '#2C2C2E', onInk: '#0A0A0A' }
    : { track: '#E4E6EA', seg: '#FFFFFF', line2: '#C3C7CC', ph: '#DCDEE2', onInk: '#FFFFFF' };
}

// İkonlar — tasarımdaki yollar (Phosphor 256 dolgu · 24 çizgi).
const P256 = {
  search:
    'M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z',
  close:
    'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z',
  caret:
    'M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z',
} as const;
const P24 = {
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.5V12l3 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 20.5c1.6-3 4.6-4.5 8-4.5s6.4 1.5 8 4.5',
  searchX: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M15.5 15.5 20.5 20.5 M8.3 8.3l4.4 4.4 M12.7 8.3l-4.4 4.4',
  alert: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.5v5.5 M12 16.5h.01',
} as const;

function Fill({ d, size, color }: { d: string; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessible={false}>
      <Path d={d} fill={color} />
    </Svg>
  );
}

function Stroke({ d, size, color }: { d: string; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path d={d} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Durum bloğu girişi — FinSearch `.fadeIn` (fast 200 · standard); azaltılmışta 200 ms opaklık. */
function FadeIn({ children, style }: { children: React.ReactNode; style?: object }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withTiming(1, {
      duration: reduced ? REDUCED.duration : PREMIUM.load.duration,
      easing: PREMIUM.load.curve,
    });
  }, [o, reduced]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

type Nav = { goBack: () => void; navigate: (name: string, params?: object) => void; canGoBack?: () => boolean };

const NO_NAV: Nav = { goBack: () => {}, navigate: () => {} };

/** Yığın ekranı `navigation` prop'unu verir; testler sade bir taklit geçer. */
export function SearchScreen({ navigation = NO_NAV }: { navigation?: Nav }) {
  const t = useTheme();
  const c = palette(t.isDark);
  const insets = useSafeAreaInsets();
  const { t: tr, lang } = useT();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('posts');
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [resultsFor, setResultsFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [follow, setFollow] = useState<Record<string, SearchFollowState>>({});
  const [focused, setFocused] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const reqId = useRef(0);

  // Son aramalar — cihazdan bir kez.
  useEffect(() => {
    let alive = true;
    void loadRecentSearches().then((list) => {
      if (alive) setRecents((cur) => (cur.length ? cur : list));
    });
    return () => {
      alive = false;
    };
  }, []);

  const updateRecents = useCallback((fn: (l: RecentSearch[]) => RecentSearch[]) => {
    setRecents((cur) => {
      const next = fn(cur);
      void saveRecentSearches(next);
      return next;
    });
  }, []);

  // Bekletilmiş arama: sorgu değişince (ya da Tekrar dene) 3 kapsam paralel.
  const norm = normalizeQuery(query);
  useEffect(() => {
    const id = ++reqId.current;
    if (!isSearchable(norm)) {
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      const client = getSearchClient();
      Promise.all([client.searchProfiles(norm), client.searchPosts(norm, 'post'), client.searchPosts(norm, 'recipe')])
        .then(([people, posts, recipes]) => {
          if (id !== reqId.current) return;
          setResults({ people, posts, recipes });
          setResultsFor(norm);
          setLoading(false);
        })
        .catch(() => {
          if (id !== reqId.current) return;
          setError(true);
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [norm, attempt]);

  const view = searchView({ query: norm, scope, loading, error, resultsFor, results });
  const counts = scopeCounts(results);
  const freshCounts = resultsFor != null && queryKey(resultsFor) === queryKey(norm);

  const pickRecent = (r: RecentSearch) => {
    haptic('selection');
    setQuery(r.q);
    setScope((s) => scopeForQuery(r.q, s));
    updateRecents((l) => addRecent(l, r.q, r.kind));
    inputRef.current?.blur();
  };

  const submit = () => {
    if (isSearchable(norm)) updateRecents((l) => addRecent(l, norm, 'query'));
  };

  const openPerson = (p: SearchProfile) => {
    updateRecents((l) => addRecent(l, handleLabel(p), 'person'));
    navigation.navigate('PublicProfile', { handle: p.handle });
  };

  const openPost = (p: SearchPost) => {
    submit();
    navigation.navigate('SharedPost', { postId: p.id });
  };

  const toggleFollow = async (p: SearchProfile) => {
    const cur = follow[p.id] ?? p.me_following;
    const on = cur === 'none';
    haptic('selection');
    const optimistic: SearchFollowState = on ? (p.is_private ? 'requested' : 'following') : 'none';
    setFollow((m) => ({ ...m, [p.id]: optimistic }));
    try {
      const res = await getProfilClient().follow({ user: p.id, on });
      setFollow((m) => ({ ...m, [p.id]: res.state }));
    } catch {
      setFollow((m) => ({ ...m, [p.id]: cur }));
    }
  };

  const scopeIndex = SEARCH_SCOPES.indexOf(scope);
  const [trackW, onTrackLayout] = useRowWidth();
  const ring = focused && view === 'recent' ? { borderWidth: 2, borderColor: t.color.ink } : { borderWidth: 1, borderColor: c.line2 };

  return (
    <View style={[styles.screen, { backgroundColor: t.color.bg, paddingTop: insets.top }]}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />

      {/* Arama alanı + Vazgeç */}
      <View style={styles.headerRow}>
        <View accessibilityRole="search" style={[styles.field, { backgroundColor: t.color.surface }, ring]}>
          <Fill d={P256.search} size={18} color={t.color.secondary} />
          <TextInput
            ref={inputRef}
            testID="kesfet-search-input"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            clearButtonMode="never"
            accessibilityLabel={tr('kesfetSearch.fieldLabel')}
            placeholder={tr('kesfetSearch.placeholder')}
            placeholderTextColor={t.color.secondary}
            selectionColor={t.color.ink}
            style={[styles.input, { color: t.color.ink }]}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              accessibilityRole="button"
              accessibilityLabel={tr('kesfetSearch.clearField')}
              style={styles.clearBtn}
            >
              <View style={[styles.clearDot, { backgroundColor: t.color.secondary }]}>
                <Fill d={P256.close} size={11} color={t.color.surface} />
              </View>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfetSearch.cancel')}
          style={styles.cancelBtn}
        >
          <Text style={[styles.cancelText, { color: t.color.ink }]}>{tr('kesfetSearch.cancel')}</Text>
        </Pressable>
      </View>

      {/* Kapsam: Kişi · Gönderi · Tarif */}
      <View
        onLayout={onTrackLayout}
        accessibilityRole="tablist"
        accessibilityLabel={tr('kesfetSearch.scopeLabel')}
        style={[styles.track, { backgroundColor: c.track }]}
      >
        <SlidingIndicator
          testID="kesfet-search-scope-indicator"
          index={scopeIndex}
          count={SEARCH_SCOPES.length}
          containerWidth={trackW}
          inset={3}
          gap={3}
          style={[styles.segPill, { backgroundColor: c.seg, shadowOpacity: t.isDark ? 0.4 : 0.1 }]}
        />
        {SEARCH_SCOPES.map((s) => {
          const on = s === scope;
          const label = tr(`kesfetSearch.scope.${s}`);
          return (
            <Pressable
              key={s}
              testID={`kesfet-search-scope-${s}`}
              onPress={() => {
                if (!on) haptic('selection');
                setScope(s);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={
                freshCounts && view !== 'recent'
                  ? tr('kesfetSearch.scopeA11y', { label, count: counts[s] })
                  : label
              }
              style={styles.seg}
            >
              <Text style={[styles.segText, { color: t.color.ink, fontWeight: on ? '700' : '500' }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {view === 'recent' ? (
          <FadeIn key="recent" style={styles.recentWrap}>
            <View style={styles.recentHead}>
              <Text accessibilityRole="header" style={[styles.h2, { color: t.color.ink }]}>
                {tr('kesfetSearch.recent')}
              </Text>
              {recents.length > 0 ? (
                <Pressable
                  onPress={() => {
                    haptic('light');
                    updateRecents(() => clearRecent());
                  }}
                  accessibilityRole="button"
                  style={styles.textBtn}
                >
                  <Text style={[styles.clearAll, { color: t.color.ink }]}>{tr('kesfetSearch.clearAll')}</Text>
                </Pressable>
              ) : null}
            </View>
            {recents.length > 0 ? (
              recents.map((r) => (
                <View key={queryKey(r.q)} style={[styles.recentRow, { borderBottomColor: t.color.line }]}>
                  <Pressable onPress={() => pickRecent(r)} accessibilityRole="button" style={styles.recentPick}>
                    <Stroke d={r.kind === 'person' ? P24.user : P24.clock} size={20} color={t.color.secondary} />
                    <Text style={[styles.recentText, { color: t.color.ink }]} numberOfLines={1}>
                      {r.q}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateRecents((l) => removeRecent(l, r.q))}
                    accessibilityRole="button"
                    accessibilityLabel={tr('kesfetSearch.removeRecent', { q: quoteQuery(r.q) })}
                    style={styles.recentRemove}
                  >
                    <Fill d={P256.close} size={16} color={t.color.secondary} />
                  </Pressable>
                </View>
              ))
            ) : (
              <Text accessibilityRole="text" style={[styles.noRecent, { color: t.color.secondary }]}>
                {tr('kesfetSearch.noRecent')}
              </Text>
            )}
          </FadeIn>
        ) : null}

        {view === 'loading' ? <LoadingSkeleton scope={scope} ph={c.ph} label={tr('kesfetSearch.loading')} /> : null}

        {view === 'results' ? (
          <FadeIn key={`results-${scope}`} style={styles.resultsWrap}>
            <Text accessibilityLiveRegion="polite" style={[styles.resultsLabel, { color: t.color.secondary }]}>
              {tr('kesfetSearch.results', { q: quoteQuery(norm) })}
            </Text>
            {scope === 'posts' ? (
              <PostGrid posts={results.posts} ph={c.ph} onOpen={openPost} />
            ) : null}
            {scope === 'recipes'
              ? results.recipes.map((p) => <RecipeRow key={p.id} post={p} onPress={() => openPost(p)} />)
              : null}
            {scope === 'people'
              ? results.people.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    state={follow[p.id] ?? p.me_following}
                    onInk={c.onInk}
                    line2={c.line2}
                    onOpen={() => openPerson(p)}
                    onToggle={() => void toggleFollow(p)}
                  />
                ))
              : null}
          </FadeIn>
        ) : null}

        {view === 'empty' ? (
          <FadeIn key={`empty-${scope}`} style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
              <Stroke d={P24.searchX} size={28} color={t.color.ink} />
            </View>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.emptyTitle, { color: t.color.ink }]}>
              {tr('kesfetSearch.emptyTitle', { q: quoteQuery(norm) })}
            </Text>
            <Text style={[styles.emptyBody, { color: t.color.secondary }]}>{tr('kesfetSearch.emptyBody')}</Text>
            <Text style={[styles.tryIn, { color: t.color.secondary }]}>{tr('kesfetSearch.tryIn')}</Text>
            <View style={styles.tryRow}>
              {otherScopes(scope, results).map((s) => (
                <Pressable
                  key={s}
                  testID={`kesfet-search-try-${s}`}
                  onPress={() => {
                    haptic('selection');
                    setScope(s);
                  }}
                  accessibilityRole="button"
                  style={[styles.tryBtn, { backgroundColor: t.color.surface, borderColor: c.line2 }]}
                >
                  <Text style={[styles.tryText, { color: t.color.ink }]}>{tr(`kesfetSearch.scope.${s}`)}</Text>
                </Pressable>
              ))}
            </View>
          </FadeIn>
        ) : null}

        {view === 'error' ? (
          <FadeIn key="error" style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
              <Stroke d={P24.alert} size={28} color={t.color.ink} />
            </View>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.emptyTitle, { color: t.color.ink }]}>
              {tr('kesfetSearch.errorTitle')}
            </Text>
            <Text style={[styles.emptyBody, { color: t.color.secondary }]}>{tr('kesfetSearch.errorBody')}</Text>
            <Pressable
              testID="kesfet-search-retry"
              onPress={() => {
                haptic('light');
                setAttempt((n) => n + 1);
              }}
              accessibilityRole="button"
              style={[styles.retryBtn, { backgroundColor: t.color.ink }]}
            >
              <Text style={[styles.retryText, { color: c.onInk }]}>{tr('kesfetSearch.retry')}</Text>
            </Pressable>
          </FadeIn>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Satır bileşenleri ───────────────────────────────────────────────────────
function Chip({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: t.color.line }]}>
      <Text style={[styles.chipText, { color: t.color.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function PostTile({ post, ph, onPress }: { post: SearchPost; ph: string; onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const title = postTitle(post);
  const img = postImage(post);
  const p = proteinGrams(post);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr('kesfetSearch.postA11y', { title, by: post.author.display_name })}
      style={[styles.tile, { backgroundColor: t.color.surface, borderColor: t.color.line }]}
    >
      {img ? (
        <Image source={{ uri: img }} style={styles.tileImg} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.tileImg, { backgroundColor: ph }]} />
      )}
      <View style={styles.tileText}>
        <Text style={[styles.tileTitle, { color: t.color.ink }]} numberOfLines={3}>
          {title}
        </Text>
        <View style={styles.tileMeta}>
          <Avatar name={post.author.display_name} url={post.author.avatar_url} size={20} />
          <Text style={[styles.tileBy, { color: t.color.secondary }]} numberOfLines={1}>
            {post.author.display_name}
          </Text>
          {p != null ? <Chip label={tr('kesfetSearch.proteinChip', { n: p })} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Gönderi ızgarası — 2 sütun, aralık 12; tek kalan kart yarım genişlikte. */
function PostGrid({ posts, ph, onOpen }: { posts: SearchPost[]; ph: string; onOpen: (p: SearchPost) => void }) {
  const rows: SearchPost[][] = [];
  for (let i = 0; i < posts.length; i += 2) rows.push(posts.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].id} style={styles.gridRow}>
          {row.map((p) => (
            <PostTile key={p.id} post={p} ph={ph} onPress={() => onOpen(p)} />
          ))}
          {row.length === 1 ? <View style={styles.gridSpacer} /> : null}
        </View>
      ))}
    </View>
  );
}

function RecipeRow({ post, onPress }: { post: SearchPost; onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const title = postTitle(post);
  const img = postImage(post);
  const p = proteinGrams(post);
  const k = kcalOf(post);
  return (
    <View style={[styles.listItem, { borderBottomColor: t.color.line }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={tr('kesfetSearch.postA11y', { title, by: post.author.display_name })}
        style={styles.recipeRow}
      >
        <View style={[styles.recipeThumb, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
          {img ? <Image source={{ uri: img }} style={styles.recipeImg} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
        </View>
        <View style={styles.recipeText}>
          <Text style={[styles.recipeTitle, { color: t.color.ink }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.recipeBy, { color: t.color.secondary }]} numberOfLines={1}>
            {post.author.display_name}
          </Text>
          <View style={styles.chipRow}>
            {k != null ? <Chip label={tr('kesfetSearch.kcalChip', { n: k })} /> : null}
            {p != null ? <Chip label={tr('kesfetSearch.proteinChip', { n: p })} /> : null}
          </View>
        </View>
        <Fill d={P256.caret} size={18} color={t.color.secondary} />
      </Pressable>
    </View>
  );
}

function PersonRow({
  person,
  state,
  onInk,
  line2,
  onOpen,
  onToggle,
}: {
  person: SearchProfile;
  state: SearchFollowState;
  onInk: string;
  line2: string;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const badge = roleBadgeKey(person.role) ?? (person.role === 'pt' ? 'pt' : null);
  const roleLabel = badge ? tr(`kesfetSearch.role.${badge}`) : null;
  const isOn = state !== 'none';
  const action =
    state === 'following'
      ? tr('kesfetSearch.following')
      : state === 'requested'
        ? tr('kesfetSearch.requested')
        : tr('kesfetSearch.follow');
  return (
    <View style={[styles.listItem, styles.personItem, { borderBottomColor: t.color.line }]}>
      <Pressable onPress={onOpen} accessibilityRole="button" style={styles.personMain}>
        <Avatar name={person.display_name} url={person.avatar_url} official={badge === 'official'} size={48} />
        <View style={styles.personText}>
          <View style={styles.personNameRow}>
            <Text style={[styles.personName, { color: t.color.ink }]} numberOfLines={1}>
              {person.display_name}
            </Text>
            {roleLabel ? <Chip label={roleLabel} /> : null}
          </View>
          <Text style={[styles.personHandle, { color: t.color.secondary }]} numberOfLines={1}>
            {handleLabel(person)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ selected: isOn }}
        accessibilityLabel={tr('kesfetSearch.followA11y', { action, name: person.display_name })}
        style={styles.followHit}
      >
        <View
          style={[
            styles.followPill,
            isOn ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: line2 } : { backgroundColor: t.color.ink },
          ]}
        >
          <Text style={[styles.followText, { color: isOn ? t.color.ink : onInk }]} numberOfLines={1}>
            {action}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function LoadingSkeleton({ scope, ph, label }: { scope: SearchScope; ph: string; label: string }) {
  const t = useTheme();
  return (
    <View testID="kesfet-search-loading" accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.resultsWrap}>
      <View style={[styles.skelLabel, { backgroundColor: ph }]} />
      {scope === 'posts' ? (
        <View style={styles.grid}>
          {[0, 1].map((r) => (
            <View key={r} style={styles.gridRow}>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.tile, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
                  <View style={[styles.tileImg, { backgroundColor: ph }]} />
                  <View style={styles.tileText}>
                    <View style={[styles.skelLine, { backgroundColor: ph }]} />
                    <View style={[styles.skelLine, styles.skelShort, { backgroundColor: ph }]} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        [0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.listItem, styles.personItem, { borderBottomColor: t.color.line }]}>
            <View style={[scope === 'people' ? styles.skelAvatar : styles.skelThumb, { backgroundColor: ph }]} />
            <View style={styles.personText}>
              <View style={[styles.skelLine, { backgroundColor: ph }]} />
              <View style={[styles.skelLine, styles.skelShort, { backgroundColor: ph }]} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export default SearchScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 4 },
  field: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
  },
  input: { flex: 1, minWidth: 0, minHeight: 44, fontSize: 16, fontFamily: fontFamily.bodyRegular, paddingVertical: 0 },
  clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  clearDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  cancelText: { fontSize: 16, fontWeight: '600' },
  track: { marginTop: 4, marginHorizontal: 16, padding: 3, borderRadius: 13, flexDirection: 'row', gap: 3 },
  segPill: {
    top: 3,
    bottom: 3,
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  seg: { flex: 1, minHeight: 44, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 15, textAlign: 'center' },
  body: { flex: 1 },
  recentWrap: { paddingTop: 12 },
  recentHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 4 },
  h2: { fontFamily: fontFamily.headingBold, fontSize: 20, lineHeight: 26 },
  textBtn: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  clearAll: { fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  recentRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 16, borderBottomWidth: 1 },
  recentPick: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recentText: { flex: 1, minWidth: 0, fontSize: 16 },
  recentRemove: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  noRecent: { marginTop: 4, marginHorizontal: 16, fontSize: 15 },
  resultsWrap: { paddingTop: 12 },
  resultsLabel: { marginHorizontal: 16, marginBottom: 10, fontSize: 13, fontWeight: '600' },
  grid: { paddingHorizontal: 16, gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  gridSpacer: { flex: 1 },
  tile: { flex: 1, minWidth: 0, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  tileImg: { width: '100%', aspectRatio: 1 },
  tileText: { gap: 6, paddingTop: 8, paddingHorizontal: 10, paddingBottom: 10 },
  tileTitle: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  tileMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileBy: { flex: 1, minWidth: 0, fontSize: 13 },
  chip: { minHeight: 22, paddingHorizontal: 7, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  listItem: { marginLeft: 16, borderBottomWidth: 1 },
  recipeRow: { minHeight: 88, paddingVertical: 10, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recipeThumb: { width: 64, height: 64, borderRadius: 14, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  recipeImg: { width: '100%', height: '100%' },
  recipeText: { flex: 1, minWidth: 0, gap: 4 },
  recipeTitle: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  recipeBy: { fontSize: 13 },
  personItem: { minHeight: 68, paddingVertical: 10, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personMain: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personText: { flex: 1, minWidth: 0, gap: 2 },
  personNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  personName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  personHandle: { fontSize: 14 },
  followHit: { minHeight: 44, justifyContent: 'center' },
  followPill: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  followText: { fontSize: 14, fontWeight: '600' },
  emptyWrap: { paddingTop: 56, paddingHorizontal: 32, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 6, fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 26, textAlign: 'center' },
  emptyBody: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  tryIn: { marginTop: 14, fontSize: 13, fontWeight: '600' },
  tryRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  tryBtn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tryText: { fontSize: 15, fontWeight: '600' },
  retryBtn: { marginTop: 14, minHeight: 44, paddingHorizontal: 22, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 15, fontWeight: '600' },
  skelLabel: { height: 12, width: 140, borderRadius: 6, marginHorizontal: 16, marginBottom: 12 },
  skelLine: { height: 12, borderRadius: 6, width: '80%' },
  skelShort: { width: '45%' },
  skelAvatar: { width: 48, height: 48, borderRadius: 24 },
  skelThumb: { width: 64, height: 64, borderRadius: 14 },
});
