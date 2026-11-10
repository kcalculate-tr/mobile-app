// Gün halkası şeridi — yatay halkalar, ilk öğe her zaman "ben" (bkz.
// G5-CONTRACT.md "Gün halkası"). Halka çevresinde günün doluluk yayı
// (#4A6B00 → temada `color.accentLine`). G6-S2 (Keşfet) bu bileşeni
// `rings`/`onOpen(userId)` props'uyla kullanır — İSİM VE PROPS DEĞİŞMEZ.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, ProgressRing, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CachedImage } from '../../../components/CachedImage';
import { Plus, User } from '../../../components/icons';
import type { DayRing } from '../types';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

const RING_SIZE = 60;
const STROKE = 3;

export interface GunRingStripProps {
  rings: DayRing[];
  onOpen: (userId: string) => void;
}

export function GunRingStrip({ rings, onOpen }: GunRingStripProps) {
  const t = useTheme();
  const { t: tt } = useT();

  if (rings.length === 0) return null;

  return (
    <ScrollView {...SCROLL_KEYBOARD}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {rings.map((ring, i) => {
        const isMe = i === 0;
        return (
          <Pressable
            key={ring.user.id}
            onPress={() => onOpen(ring.user.id)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={isMe ? tt('gun.my_ring') : ring.user.display_name}
          >
            <ProgressRing
              progress={ring.progress}
              size={RING_SIZE}
              strokeWidth={STROKE}
              color={t.color.accentLine}
            >
              <View style={[styles.avatarWrap, { backgroundColor: t.color.line }]}>
                {ring.user.avatar_url ? (
                  <CachedImage uri={ring.user.avatar_url} style={styles.avatarImg} />
                ) : (
                  <User size={22} color={t.color.secondary} weight="fill" />
                )}
                {isMe ? (
                  <View style={[styles.plusBadge, { backgroundColor: t.color.accent }]}>
                    <Plus size={11} color={t.color.onAccent} weight="bold" />
                  </View>
                ) : null}
                {!isMe && ring.has_new ? (
                  <View style={[styles.newDot, { backgroundColor: t.color.accentLine, borderColor: t.color.bg }]} />
                ) : null}
              </View>
            </ProgressRing>
            <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.label}>
              {isMe ? tt('gun.my_ring') : ring.user.display_name}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, gap: 14 },
  item: { alignItems: 'center', width: RING_SIZE + 12 },
  avatarWrap: {
    width: RING_SIZE - STROKE * 4,
    height: RING_SIZE - STROKE * 4,
    borderRadius: (RING_SIZE - STROKE * 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  plusBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newDot: {
    position: 'absolute',
    right: -1,
    top: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  label: { marginTop: 4, maxWidth: RING_SIZE + 8, textAlign: 'center' },
});
