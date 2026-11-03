// Keşfet durum görünümleri — iskelet (yükleme), hata (+ Tekrar dene), boş akış
// ve "Takip" boş durumu (önerilen hesaplar). Öneriler GERÇEK veriden gelir
// (çağıran, can_post yazarlarını geçer); uydurma isim/sayı yok.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import NetInfo from '@react-native-community/netinfo';
import { AppText, useTheme, useBreath } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Avatar } from './Avatar';
import { Icon } from './icons';
import { roleBadgeKey } from './format';

/** Çevrimiçi mi — çevrimdışı durumunu sakin göstermek için (states). */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let alive = true;
    const apply = (s: { isConnected?: boolean | null }) => {
      if (alive) setOnline(s.isConnected !== false);
    };
    void NetInfo.fetch().then(apply);
    const unsub = NetInfo.addEventListener(apply);
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  return online;
}

export interface SuggestedAccount {
  id: string;
  display_name: string;
  handle: string;
  role: string;
  verified: boolean;
  avatar_url: string | null;
}

function Block({ w, h, r = 8, shimmer }: { w: number | `${number}%`; h: number; r?: number; shimmer?: ReturnType<typeof useBreath>['style'] }) {
  const t = useTheme();
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: t.color.line }, shimmer]} />;
}

/** Yükleme iskeleti — birkaç kart yer tutucusu; parıltı useBreath (motion). */
export function FeedSkeleton({ count = 4 }: { count?: number }) {
  const t = useTheme();
  const { style: shimmer } = useBreath({ min: 0.4, max: 0.85 });
  return (
    <View accessibilityLabel="Yükleniyor" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.skelCard, { borderBottomColor: t.color.line }]}>
          <Block w={40} h={40} r={20} shimmer={shimmer} />
          <View style={styles.skelBody}>
            <Block w="60%" h={12} shimmer={shimmer} />
            <Block w="90%" h={12} shimmer={shimmer} />
            <Block w="100%" h={160} r={16} shimmer={shimmer} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Çevrimdışı — sakin (kırmızı/alarm yok). Bağlanınca akış kendiliğinden döner. */
export function FeedOffline({ onRetry }: { onRetry: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  return (
    <View style={styles.center}>
      <View style={[styles.offlineIcon, { backgroundColor: t.color.line }]}>
        <Icon name="slash" size={22} color={t.color.secondary} />
      </View>
      <AppText variant="heading" style={styles.centerText}>{tr('kesfet.ui.offline_title')}</AppText>
      <AppText variant="body" tone="secondary" style={styles.centerText}>{tr('kesfet.ui.offline_desc')}</AppText>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={tr('common.retry')}
        style={({ pressed }) => [styles.retry, { borderColor: t.color.line }, pressed && { opacity: 0.9 }]}
      >
        <AppText variant="body" style={{ fontWeight: '600' }}>{tr('common.retry')}</AppText>
      </Pressable>
    </View>
  );
}

/** Hata + Tekrar dene. */
export function FeedError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  return (
    <View style={styles.center}>
      <AppText variant="body" tone="secondary" style={styles.centerText}>
        {message || tr('kesfet.loadError')}
      </AppText>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={tr('common.retry')}
        style={({ pressed }) => [styles.retry, { borderColor: t.color.line }, pressed && { opacity: 0.9 }]}
      >
        <AppText variant="body" style={{ fontWeight: '600' }}>
          {tr('common.retry')}
        </AppText>
      </Pressable>
    </View>
  );
}

/** Genel boş akış. */
export function FeedEmpty({ following }: { following?: boolean }) {
  const { t: tr } = useT();
  return (
    <View style={styles.center}>
      <AppText variant="body" tone="secondary" style={styles.centerText}>
        {tr(following ? 'kesfet.empty_following' : 'kesfet.empty')}
      </AppText>
    </View>
  );
}

function SuggestionRow({
  account,
  onFollow,
}: {
  account: SuggestedAccount;
  onFollow: (id: string) => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const badgeKey = roleBadgeKey(account.role);
  return (
    <View style={styles.sugRow}>
      <Avatar name={account.display_name} url={account.avatar_url} official={badgeKey === 'official'} />
      <View style={styles.sugInfo}>
        <View style={styles.sugNameRow}>
          <AppText variant="caption" style={{ fontWeight: '700' }} numberOfLines={1}>
            {account.display_name}
          </AppText>
          {account.verified ? <Icon name="seal" size={14} color={t.color.accentLine} /> : null}
        </View>
        <AppText variant="caption" tone="secondary" numberOfLines={1}>
          @{account.handle}
          {badgeKey ? ` · ${tr(`kesfet.ui.badge.${badgeKey}`)}` : ''}
        </AppText>
      </View>
      <Pressable
        onPress={() => onFollow(account.id)}
        accessibilityRole="button"
        accessibilityLabel={`${tr('profil.follow')} ${account.display_name}`}
        style={({ pressed }) => [styles.followBtn, { backgroundColor: t.color.ink, opacity: pressed ? 0.9 : 1 }]}
      >
        <AppText variant="caption" style={{ color: t.color.surface, fontWeight: '700' }}>
          {tr('profil.follow')}
        </AppText>
      </Pressable>
    </View>
  );
}

/** "Takip" sekmesi boş — başlık, açıklama ve önerilen hesaplar. */
export function FollowingEmpty({
  suggestions,
  onFollow,
}: {
  suggestions: SuggestedAccount[];
  onFollow: (id: string) => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  return (
    <View style={styles.emptyWrap}>
      <AppText variant="heading" style={styles.emptyTitle}>
        {tr('kesfet.ui.following_empty_title')}
      </AppText>
      <AppText variant="body" tone="secondary" style={styles.emptyDesc}>
        {tr('kesfet.ui.following_empty_desc')}
      </AppText>
      {suggestions.length > 0 ? (
        <View style={styles.sugSection}>
          <AppText variant="caption" tone="secondary" style={styles.sugTitle}>
            {tr('kesfet.ui.suggested_title')}
          </AppText>
          <View style={[styles.sugCard, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
            {suggestions.map((a) => (
              <SuggestionRow key={a.id} account={a} onFollow={onFollow} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skelCard: { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  skelBody: { flex: 1, gap: 10 },
  center: { paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center', gap: 12 },
  centerText: { textAlign: 'center' },
  offlineIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  retry: { minHeight: 44, paddingHorizontal: 20, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { padding: 24, gap: 8 },
  emptyTitle: {},
  emptyDesc: {},
  sugSection: { marginTop: 16, gap: 8 },
  sugTitle: { fontWeight: '600', textTransform: 'uppercase' },
  sugCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12 },
  sugRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  sugInfo: { flex: 1, minWidth: 0, gap: 2 },
  sugNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  followBtn: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
