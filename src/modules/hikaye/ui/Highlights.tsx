// G59-S1 — Profilde öne çıkanlar (docs/g59/design/FinStoryHighlights.dc.html `row` · `edit` · `new`).
// Satır: başlık 15/700 + "Düzenle" (alt çizgili, 44); 72 pt daireler (1,5 pt çerçeve, 3 pt iç boşluk), ilk öğe "Yeni"
// (yalnız sahibi). Sayfa (top 96): kapak 80 + Ad (≤ 16, sayaç) + "Kapağı düzenle", Seçili / Arşiv sekmesi, 3 sütun
// hikâye ızgarası (168 pt; seçim sırası numaralı lime nokta), "Öne çıkanı sil" (düzenle), Kaydet / Oluştur (lime;
// ad + ≥ 1 hikâye yoksa pasif). Kapak seçimi: Kapağı düzenle → kapak modu, dokunulan seçili hikâye kapak olur.
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image as RNImage, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { fontFamily, haptic, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { getStoryClient, storyMediaUrl } from '../client';
import type { Highlight, HighlightCover, Story } from '../types';
import { LIME, LIME_INK, storyTheme } from './tokens';
import { StoryBackground } from './StoryCanvas';
import { EditorSheet } from './editor/EditorSheets';

const P_PLUS = 'M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z';
const P_IMAGE = 'M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z';
const BOWL = require('../../../../assets/glass/bowl.png');
export const HIGHLIGHT_TITLE_MAX = 16;

export function coverUri(c: HighlightCover | Pick<Story, 'media_type' | 'media_url' | 'thumb_url'> | null): string | null {
  if (!c) return null;
  if (c.media_type === 'video') return storyMediaUrl(c.thumb_url);
  if (c.media_type === 'image') return storyMediaUrl(c.media_url);
  return null;
}

function Cover({ cover, size }: { cover: HighlightCover | null; size: number }) {
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const uri = coverUri(cover);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: st.ph, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : cover?.media_type === 'none' ? (
        <StoryBackground bg={cover.bg} />
      ) : (
        <RNImage source={BOWL} style={{ width: size * 0.6, height: size * 0.6 }} resizeMode="contain" />
      )}
    </View>
  );
}

export function HighlightsRow({
  userId,
  isOwner,
  enabled,
  onOpen,
  refreshKey = 0,
  devOpen,
}: {
  userId: string | null | undefined;
  isOwner: boolean;
  enabled: boolean;
  onOpen: (h: Highlight) => void;
  refreshKey?: number;
  /** YALNIZ __DEV__ vitrini: düzenle / yeni sayfası açık başlar. */
  devOpen?: 'edit' | 'new';
}) {
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const { t: tr } = useT();
  const [list, setList] = useState<Highlight[] | null>(null);
  const [sheet, setSheet] = useState<{ mode: 'new' | 'edit'; h: Highlight | null } | null>(null);
  const [pickEdit, setPickEdit] = useState(false);

  const load = useCallback(() => {
    if (!userId || !enabled) return;
    getStoryClient()
      .getHighlights({ user: userId })
      .then(setList)
      .catch(() => setList([]));
  }, [userId, enabled]);
  useEffect(() => {
    load();
  }, [load, refreshKey]);
  useEffect(() => {
    if (!__DEV__ || !devOpen || !list) return;
    if (devOpen === 'new') setSheet({ mode: 'new', h: null });
    else if (list[0]) setSheet({ mode: 'edit', h: list[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devOpen, list == null]);

  if (!enabled || !userId) return null;
  if (!isOwner && (!list || list.length === 0)) return null;

  return (
    <View accessibilityLabel={tr('hikaye.highlights')} style={styles.section} testID="story-highlights">
      <View style={styles.hRow}>
        <Text accessibilityRole="header" style={[styles.h, { color: st.text }]}>{tr('hikaye.highlights')}</Text>
        {isOwner && list && list.length > 0 ? (
          <Pressable onPress={() => { haptic('selection'); if (list.length === 1) setSheet({ mode: 'edit', h: list[0] }); else setPickEdit(true); }} accessibilityRole="button" style={styles.editBtn} testID="story-highlights-edit">
            <Text style={[styles.editT, { color: st.text }]}>{tr('hikaye.edit')}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView {...SCROLL_KEYBOARD} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {isOwner ? (
          <View style={styles.item}>
            <Pressable onPress={() => { haptic('selection'); setSheet({ mode: 'new', h: null }); }} accessibilityRole="button" accessibilityLabel={tr('hikaye.new_a11y')} style={[styles.newBtn, { borderColor: st.line2 }]} testID="story-highlights-new">
              <Svg width={26} height={26} viewBox="0 0 256 256"><Path d={P_PLUS} fill={st.text} /></Svg>
            </Pressable>
            <Text style={[styles.label, { color: st.text }]}>{tr('hikaye.new')}</Text>
          </View>
        ) : null}
        {(list ?? []).map((h) => (
          <View key={h.id} style={styles.item}>
            <Pressable
              onPress={() => onOpen(h)}
              onLongPress={isOwner ? () => setSheet({ mode: 'edit', h }) : undefined}
              accessibilityRole="button"
              accessibilityLabel={tr('hikaye.hl_a11y', { name: h.title })}
              style={[styles.ring, { borderColor: st.line2 }]}
              testID={`story-highlight-${h.id}`}
            >
              <Cover cover={h.cover} size={63} />
            </Pressable>
            <Text numberOfLines={1} style={[styles.label, { color: st.text }]}>{h.title}</Text>
          </View>
        ))}
        {list == null ? <ActivityIndicator style={{ marginLeft: 8 }} /> : null}
      </ScrollView>
      {pickEdit && list ? (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => setPickEdit(false)}>
        <EditorSheet visible onClose={() => setPickEdit(false)} top={300} title={tr('hikaye.edit_title')}>
          <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ padding: 16, gap: 4 }}>
            {list.map((h) => (
              <Pressable key={h.id} onPress={() => { setPickEdit(false); setSheet({ mode: 'edit', h }); }} accessibilityRole="button" style={styles.pickRow}>
                <Cover cover={h.cover} size={40} />
                <Text style={[styles.pickT, { color: st.text }]}>{h.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </EditorSheet>
        </Modal>
      ) : null}
      {sheet ? (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => setSheet(null)}>
        <HighlightSheet
          mode={sheet.mode}
          highlight={sheet.h}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            load();
          }}
        />
        </Modal>
      ) : null}
    </View>
  );
}

export function HighlightSheet({
  mode,
  highlight,
  preselect,
  onClose,
  onSaved,
}: {
  mode: 'new' | 'edit';
  highlight: Highlight | null;
  /** "Öne çıkar" (Görenler) → bu hikâye seçili başlar. */
  preselect?: string | null;
  onClose: () => void;
  onSaved: (id: string, title: string) => void;
}) {
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const { t: tr } = useT();
  const [name, setName] = useState(highlight?.title ?? '');
  const [sel, setSel] = useState<string[]>(() => {
    const base = highlight?.story_ids ?? [];
    return preselect && !base.includes(preselect) ? [...base, preselect] : base;
  });
  const [cover, setCover] = useState<string | null>(highlight?.cover_story_id ?? null);
  const [coverMode, setCoverMode] = useState(false);
  const [src, setSrc] = useState<'selected' | 'archive'>(mode === 'new' ? 'archive' : 'selected');
  const [archive, setArchive] = useState<Story[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getStoryClient()
      .getArchive({ limit: 120 })
      .then(setArchive)
      .catch(() => setArchive([]));
  }, []);

  const byId = useMemo(() => new Map((archive ?? []).map((s) => [s.id, s])), [archive]);
  const shown = src === 'selected' ? sel.map((id) => byId.get(id)).filter((s): s is Story => !!s) : archive ?? [];
  const ok = name.trim().length > 0 && sel.length > 0 && !busy;
  const coverId = cover && sel.includes(cover) ? cover : sel[0] ?? null;
  const coverStory = coverId ? byId.get(coverId) ?? null : null;
  const coverImg = coverStory ? coverUri(coverStory) : null;

  const toggle = (id: string) => {
    haptic('selection');
    if (coverMode) {
      if (sel.includes(id)) {
        setCover(id);
        setCoverMode(false);
      }
      return;
    }
    setSel((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  };

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await getStoryClient().upsertHighlight({ highlight: highlight?.id ?? null, title: name.trim(), storyIds: sel, coverStory: coverId });
      haptic('success');
      onSaved(r.highlight_id, name.trim());
    } catch {
      setErr(tr('hikaye.hl_failed'));
      setBusy(false);
    }
  };
  const del = () => {
    if (!highlight) return;
    Alert.alert(tr('hikaye.delete_hl_confirm'), undefined, [
      { text: tr('hikaye.keep'), style: 'cancel' },
      {
        text: tr('hikaye.del'),
        style: 'destructive',
        onPress: () => {
          void getStoryClient()
            .deleteHighlight({ highlight: highlight.id })
            .then(() => onSaved(highlight.id, highlight.title))
            .catch(() => setErr(tr('hikaye.hl_failed')));
        },
      },
    ]);
  };
  const dateLabel = (iso: string) => {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}` : '';
  };

  return (
    <EditorSheet
      visible
      onClose={onClose}
      top={96}
      title={mode === 'new' ? tr('hikaye.new_title') : tr('hikaye.edit_title')}
      testID="story-highlight-sheet"
      footer={
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34, gap: 6 }}>
          {err ? <Text accessibilityLiveRegion="assertive" style={{ color: st.danger, fontFamily: fontFamily.bodySemibold, fontSize: 13, textAlign: 'center' }}>{err}</Text> : null}
          <Pressable onPress={() => void save()} disabled={!ok} accessibilityRole="button" accessibilityState={{ disabled: !ok, busy }} style={[styles.cta, { backgroundColor: ok ? LIME : st.off }]} testID="story-highlight-save">
            <Text style={[styles.ctaT, { color: ok ? LIME_INK : st.offFg }]}>{mode === 'new' ? tr('hikaye.create_btn') : tr('hikaye.save_btn')}</Text>
          </Pressable>
        </View>
      }
    >
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={[styles.cover80, { borderColor: coverMode ? LIME : st.line2 }]}>
            <View style={{ flex: 1, borderRadius: 40, overflow: 'hidden', backgroundColor: st.ph, alignItems: 'center', justifyContent: 'center' }}>
              {coverImg ? <Image source={{ uri: coverImg }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={tr('hikaye.cover_alt')} /> : coverStory?.media_type === 'none' ? <StoryBackground bg={coverStory.bg} /> : <Svg width={28} height={28} viewBox="0 0 256 256"><Path d={P_IMAGE} fill={st.phIcon} /></Svg>}
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={[styles.lbl, { color: st.sec }]}>{tr('hikaye.name_label')}</Text>
              <Text importantForAccessibility="no" style={[styles.count, { color: st.sec }]}>{`${name.length}/${HIGHLIGHT_TITLE_MAX}`}</Text>
            </View>
            <TextInput value={name} onChangeText={(v) => setName(v.slice(0, HIGHLIGHT_TITLE_MAX))} maxLength={HIGHLIGHT_TITLE_MAX} placeholder={tr('hikaye.name_ph')} placeholderTextColor={st.sec} accessibilityLabel={tr('hikaye.name_label')} style={[styles.input, { color: st.text, backgroundColor: st.card, borderColor: st.line2 }]} testID="story-highlight-name" />
            <Pressable onPress={() => { haptic('selection'); setCoverMode((v) => !v); setSrc('selected'); }} disabled={sel.length === 0} accessibilityRole="button" accessibilityHint={tr('hikaye.cover_hint')} style={styles.linkBtn}>
              <Text style={[styles.link, { color: coverMode ? st.acc : st.text }]}>{tr('hikaye.edit_cover')}</Text>
            </Pressable>
          </View>
        </View>
        <View accessibilityRole="tablist" accessibilityLabel={tr('hikaye.source')} style={[styles.seg, { backgroundColor: st.seg }]}>
          {(['selected', 'archive'] as const).map((k) => {
            const on = src === k;
            return (
              <Pressable key={k} onPress={() => { haptic('selection'); setSrc(k); }} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.segBtn, on && { backgroundColor: st.segOn, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }]}>
                <Text style={[styles.segT, { color: st.text }]}>{tr(k === 'selected' ? 'hikaye.selected' : 'hikaye.archive')}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.info, { color: st.sec }]}>{coverMode ? tr('hikaye.cover_hint') : sel.length ? tr('hikaye.sel_n', { n: sel.length }) : tr('hikaye.sel_none')}</Text>
        {archive == null ? <ActivityIndicator /> : null}
        {archive != null && archive.length === 0 ? <Text style={[styles.info, { color: st.sec }]}>{tr('hikaye.archive_empty')}</Text> : null}
        <View style={styles.grid}>
          {shown.map((s, i) => {
            const idx = sel.indexOf(s.id);
            const on = idx >= 0;
            const uri = coverUri(s);
            return (
              <Pressable key={s.id} onPress={() => toggle(s.id)} onLongPress={() => { if (on) { setCover(s.id); haptic('selection'); } }} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={tr('hikaye.story_n_a11y', { n: i + 1 })} style={[styles.cell, on && { borderWidth: 3, borderColor: LIME }]} testID={`story-hl-cell-${s.id}`}>
                {uri ? <Image source={{ uri }} style={[StyleSheet.absoluteFill, { opacity: on ? 1 : 0.82 }]} contentFit="cover" /> : <StoryBackground bg={s.bg} />}
                <View style={styles.date}><Text style={styles.dateT}>{dateLabel(s.created_at)}</Text></View>
                <View style={[styles.pick, { backgroundColor: on ? LIME : 'rgba(0,0,0,0.25)' }]}>
                  {on ? <Text style={styles.pickN}>{coverId === s.id && coverMode ? '★' : idx + 1}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        {mode === 'edit' ? (
          <Pressable onPress={del} accessibilityRole="button" style={styles.delBtn} testID="story-highlight-delete">
            <Text style={[styles.delT, { color: st.danger }]}>{tr('hikaye.delete_hl')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 16 },
  hRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 },
  h: { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: 15 },
  editBtn: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  editT: { fontFamily: fontFamily.bodySemibold, fontSize: 14, textDecorationLine: 'underline' },
  row: { paddingHorizontal: 16, gap: 14, paddingTop: 4 },
  item: { width: 72, alignItems: 'center', gap: 6 },
  newBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, padding: 3, alignItems: 'center', justifyContent: 'center' },
  label: { maxWidth: 72, fontFamily: fontFamily.bodySemibold, fontSize: 13 },
  pickRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickT: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  cover80: { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, padding: 3 },
  lbl: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  count: { fontFamily: fontFamily.bodyRegular, fontSize: 12 },
  input: { marginTop: 4, height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontFamily: fontFamily.bodyRegular, fontSize: 16 },
  linkBtn: { marginTop: 2, minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: fontFamily.bodyBold, fontSize: 14, textDecorationLine: 'underline' },
  seg: { marginTop: 10, flexDirection: 'row', padding: 3, borderRadius: 14 },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segT: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  info: { marginVertical: 8, fontFamily: fontFamily.bodyRegular, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '32%', height: 168, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000000' },
  date: { position: 'absolute', left: 6, top: 6, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center' },
  dateT: { color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 11 },
  pick: { position: 'absolute', right: 6, bottom: 6, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  pickN: { color: '#0A0A0A', fontFamily: fontFamily.bodyBold, fontSize: 12 },
  delBtn: { marginTop: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  delT: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  cta: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaT: { fontFamily: fontFamily.bodyBold, fontSize: 16 },
});
