// G15-S3 — Keşfet "Gün halkası" şeridi (Final FinFeed): 64 px halka (3 px, iz
// #DCDEE2 / koyu #3A3A3C), 52 px avatar, ilk öğe "Günüm" + lime "+" rozeti,
// diğerlerinde seri hapı (siyah, alev + gün sayısı; seri yoksa hap yok). Ana
// sayfadaki GunRingStrip'e DOKUNMAZ (S2 alanı); veri aynı `DayRing`.
//
// "Günüm +" rozeti = paylaş girişi (Final başlığında + yok) — `onAddMine` verilirse
// ayrı dokunma hedefi; halkanın kendisi yine kendi günümü açar.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText, fontFamily, ProgressRing, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CachedImage } from '../../../components/CachedImage';
import type { DayRing } from '../../gun/types';
import { Icon } from './icons';

const SIZE = 64;
const STROKE = 3;
const AVATAR = 52;

export function RingStrip({
  rings,
  onOpen,
  onAddMine,
}: {
  rings: DayRing[];
  onOpen: (userId: string) => void;
  onAddMine?: () => void;
}) {
  const t = useTheme();
  const { t: tr, fmt } = useT();
  if (rings.length === 0) return null;
  const track = t.isDark ? '#3A3A3C' : '#DCDEE2';

  return (
    <View style={[styles.wrap, { borderBottomColor: t.color.line }]} accessibilityLabel={tr('kesfet.ui.ring_strip')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {rings.map((ring, i) => {
          const isMe = i === 0;
          const name = isMe ? tr('gun.my_ring') : ring.user.display_name;
          return (
            <View key={ring.user.id} style={styles.item}>
              <Pressable
                onPress={() => onOpen(ring.user.id)}
                accessibilityRole="button"
                accessibilityLabel={name}
                style={styles.ringBox}
              >
                <ProgressRing progress={ring.progress} size={SIZE} strokeWidth={STROKE} color={t.color.accentLine} trackColor={track}>
                  <View style={[styles.avatar, { backgroundColor: track }]}>
                    {ring.user.avatar_url ? <CachedImage uri={ring.user.avatar_url} style={styles.avatarImg} /> : null}
                  </View>
                </ProgressRing>
                {!isMe && ring.streak > 0 ? (
                  <View style={[styles.streak, { backgroundColor: t.color.ink, borderColor: t.color.bg }]}>
                    <Icon name="fire" size={10} color={t.color.bg} />
                    <AppText style={[styles.streakText, { color: t.color.bg }]}>{fmt(ring.streak)}</AppText>
                  </View>
                ) : null}
              </Pressable>
              {isMe ? (
                <Pressable
                  onPress={onAddMine ?? (() => onOpen(ring.user.id))}
                  accessibilityRole="button"
                  accessibilityLabel={onAddMine ? tr('kesfet.ui.a11y.compose') : name}
                  hitSlop={10}
                  style={[styles.plus, { backgroundColor: t.color.accent }]}
                >
                  <Icon name="plus" size={14} color={t.color.onAccent} />
                </Pressable>
              ) : null}
              <AppText
                numberOfLines={1}
                style={[styles.label, isMe ? { fontFamily: fontFamily.bodyBold, color: t.color.ink } : { color: t.color.secondary }]}
              >
                {name}
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
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  plus: {
    position: 'absolute',
    left: 68 / 2 + SIZE / 2 - 20,
    top: SIZE - 20,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streak: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  streakText: { fontFamily: fontFamily.bodyBold, fontSize: 13, lineHeight: 14 },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 17, maxWidth: 68, textAlign: 'center' },
});
