// G59-S1 — Keşfet tepsisi: yatay halka sırası. İlk öğe "Hikâyen" (+ lime artı → kamera; hikâyem varsa halkaya
// dokunmak görüntüleyiciyi açar). Görülmemiş = lime halka, görülmüş = gri. Ölçüler Keşfet "Gün halkası"
// şeridiyle aynı (64 halka · 3 çizgi · 52 avatar · 68 öğe) — tasarımda ayrı tepsi karesi yok (LOG KARAR).
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText, fontFamily, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CachedImage } from '../../../components/CachedImage';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { ringState, type RingState } from '../rules';
import type { TrayItem } from '../types';
import { LIME, LIME_INK } from './tokens';

const SIZE = 64;
const STROKE = 3;
const AVATAR = 52;

/** Avatar + hikâye halkası (tepside ve profilde ortak). */
export function StoryRingAvatar({
  url,
  state,
  size = SIZE,
  avatar = AVATAR,
  stroke = STROKE,
  initials,
}: {
  url: string | null;
  state: RingState;
  size?: number;
  avatar?: number;
  stroke?: number;
  initials?: string;
}) {
  const t = useTheme();
  const track = t.isDark ? '#3A3A3C' : '#DCDEE2';
  const ringColor = state === 'unseen' ? LIME : state === 'seen' ? track : 'transparent';
  const r = (size - stroke) / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ringColor} strokeWidth={stroke} />
      </Svg>
      <View style={{ width: avatar, height: avatar, borderRadius: avatar / 2, overflow: 'hidden', backgroundColor: track, alignItems: 'center', justifyContent: 'center' }}>
        {url ? (
          <CachedImage uri={url} style={{ width: '100%', height: '100%' }} />
        ) : initials ? (
          <AppText style={{ fontFamily: fontFamily.headingBold, fontSize: avatar * 0.36, color: t.color.secondary }}>{initials}</AppText>
        ) : null}
      </View>
    </View>
  );
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');
}

export function StoryTray({
  items,
  meAvatar,
  onOpen,
  onCreate,
}: {
  items: TrayItem[];
  /** Tepsi boşken (RPC yok / yükleniyor) "Hikâyen" yine çizilir. */
  meAvatar?: string | null;
  onOpen: (userId: string) => void;
  onCreate: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const me = items.find((i) => i.is_me);
  const others = items.filter((i) => !i.is_me && i.story_count > 0);
  const meHas = (me?.story_count ?? 0) > 0;
  return (
    <View style={[styles.wrap, { borderBottomColor: t.color.line }]} accessibilityLabel={tr('hikaye.tray')} testID="story-tray">
      <ScrollView {...SCROLL_KEYBOARD} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <View style={styles.item}>
          <Pressable
            onPress={meHas && me ? () => onOpen(me.user_id) : onCreate}
            accessibilityRole="button"
            accessibilityLabel={meHas ? tr('hikaye.tray_seen', { name: tr('hikaye.your_story') }) : tr('hikaye.tray_add_a11y')}
            style={styles.ringBox}
            testID="story-tray-me"
          >
            <StoryRingAvatar url={me?.avatar_url ?? meAvatar ?? null} state={meHas ? 'seen' : 'none'} initials={me ? initialsOf(me.display_name) : undefined} />
          </Pressable>
          <Pressable
            onPress={onCreate}
            accessibilityRole="button"
            accessibilityLabel={tr('hikaye.tray_add_a11y')}
            hitSlop={12}
            style={[styles.plus, { backgroundColor: LIME, borderColor: t.color.bg }]}
            testID="story-tray-add"
          >
            <Svg width={12} height={12} viewBox="0 0 12 12">
              <Path d="M6 1v10M1 6h10" stroke={LIME_INK} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
          <AppText numberOfLines={1} style={[styles.label, { fontFamily: fontFamily.bodyBold, color: t.color.ink }]}>
            {tr('hikaye.your_story')}
          </AppText>
        </View>
        {others.map((it) => {
          const st = ringState(it);
          return (
            <View key={it.user_id} style={styles.item}>
              <Pressable
                onPress={() => onOpen(it.user_id)}
                accessibilityRole="button"
                accessibilityLabel={tr(st === 'unseen' ? 'hikaye.tray_unseen' : 'hikaye.tray_seen', { name: it.display_name || it.handle || '' })}
                style={styles.ringBox}
                testID={`story-tray-${it.user_id}`}
              >
                <StoryRingAvatar url={it.avatar_url} state={st} initials={initialsOf(it.display_name || it.handle || '')} />
              </Pressable>
              <AppText numberOfLines={1} style={[styles.label, { color: st === 'unseen' ? t.color.ink : t.color.secondary }]}>
                {it.display_name || (it.handle ? `@${it.handle}` : '')}
              </AppText>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { gap: 10, paddingTop: 12, paddingBottom: 14, paddingHorizontal: 16 },
  item: { width: 68, alignItems: 'center', gap: 8 },
  ringBox: { width: SIZE, height: SIZE },
  plus: {
    position: 'absolute',
    left: 68 / 2 + SIZE / 2 - 22,
    top: SIZE - 22,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 17, maxWidth: 68, textAlign: 'center' },
});
