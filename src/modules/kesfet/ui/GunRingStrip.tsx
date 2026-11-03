// Gün halkası şeridi — G6-S3'ün nihai bileşeni gelene kadarki ARAYÜZ.
// Props sözleşmesi G6-S3 ile aynı: `rings` (ilk öğe daima "ben") ve
// `onOpen(userId)`. Şerit verisi `modules/gun`'dan gelir (KesfetScreen çeker).
// Nihai bileşen bunun yerini aldığında KesfetScreen'de yalnız import değişir.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Avatar } from './Avatar';
import { Icon } from './icons';
import type { DayRing } from '../../gun/types';

const SIZE = 64;
const R = 29.5;
const CIRC = 2 * Math.PI * R; // ≈ 185.35

function Ring({
  ring,
  isMe,
  onPress,
}: {
  ring: DayRing;
  isMe: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const dash = Math.max(0, Math.min(1, ring.progress)) * CIRC;
  const label = isMe ? tr('gun.my_day') : ring.user.display_name;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr('kesfet.ui.a11y.open_day', { name: label })}
      style={styles.item}
    >
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={StyleSheet.absoluteFill}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={t.color.line} strokeWidth={3} />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={t.color.accentLine}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.avatarWrap}>
          <Avatar name={ring.user.display_name} url={ring.user.avatar_url} official={false} size={52} />
        </View>
        {isMe ? (
          <View style={[styles.plusBadge, { backgroundColor: t.color.accent, borderColor: t.color.bg }]}>
            <Icon name="plus" size={14} color={t.color.onAccent} />
          </View>
        ) : ring.streak > 0 ? (
          <View style={[styles.streakBadge, { backgroundColor: t.color.ink, borderColor: t.color.bg }]}>
            <Icon name="fire" size={10} color={t.color.surface} />
            <AppText variant="caption" style={[styles.streakText, { color: t.color.surface }]}>
              {ring.streak}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText
        variant="caption"
        tone={isMe ? 'ink' : 'secondary'}
        numberOfLines={1}
        style={[styles.label, isMe && styles.labelMe]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function GunRingStripPlaceholder({
  rings,
  onOpen,
}: {
  rings: DayRing[];
  onOpen: (userId: string) => void;
}) {
  const t = useTheme();
  if (rings.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Gün halkası"
      style={[styles.strip, { borderBottomColor: t.color.line }]}
      contentContainerStyle={styles.stripContent}
    >
      {rings.map((ring, i) => (
        <Ring key={ring.user.id} ring={ring} isMe={i === 0} onPress={() => onOpen(ring.user.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { borderBottomWidth: StyleSheet.hairlineWidth },
  stripContent: { gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  item: { width: 68, alignItems: 'center', gap: 8 },
  avatarWrap: { position: 'absolute', left: 6, top: 6 },
  plusBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakBadge: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: -6,
    minHeight: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  streakText: { fontWeight: '700', fontSize: 10 },
  label: { maxWidth: 68 },
  labelMe: { fontWeight: '700' },
});
