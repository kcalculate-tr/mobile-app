// Keşfet durum görünümleri — iskelet (yükleme), hata (+ Tekrar dene), boş akış
// ve "Takip" boş durumu (önerilen hesaplar). Öneriler GERÇEK veriden gelir
// (çağıran, can_post yazarlarını geçer); uydurma isim/sayı yok.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import NetInfo from '@react-native-community/netinfo';
import { AppText, fontFamily, useTheme, useBreath } from '../../../core/design';
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
  /** G15 — kısa tanıtım (herkese açık profil `bio`); yoksa yalnız @kullanıcı adı. */
  bio?: string | null;
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
    <View style={[styles.sugRow, { borderTopColor: t.color.line }]}>
      <Avatar name={account.display_name} url={account.avatar_url} official={badgeKey === 'official'} size={44} />
      <View style={styles.sugInfo}>
        <View style={styles.sugNameRow}>
          <AppText style={[styles.sugName, { color: t.color.ink }]} numberOfLines={1}>
            {account.display_name}
          </AppText>
          {account.verified ? <Icon name="seal" size={16} color={t.color.accentLine} /> : null}
          {badgeKey ? (
            <AppText style={[styles.sugSub, { color: t.color.secondary }]} numberOfLines={1}>
              {tr(`kesfet.ui.badge.${badgeKey}`)}
            </AppText>
          ) : null}
        </View>
        <AppText style={[styles.sugSub, { color: t.color.secondary }]} numberOfLines={2}>
          @{account.handle}
          {account.bio ? ` · ${account.bio}` : ''}
        </AppText>
      </View>
      <Pressable
        onPress={() => onFollow(account.id)}
        accessibilityRole="button"
        accessibilityLabel={`${tr('profil.follow')} ${account.display_name}`}
        hitSlop={8}
        style={({ pressed }) => [styles.followBtn, { backgroundColor: t.color.ink, opacity: pressed ? 0.9 : 1 }]}
      >
        <AppText style={[styles.followText, { color: t.color.bg }]}>{tr('profil.follow')}</AppText>
      </Pressable>
    </View>
  );
}

/** "Takip" sekmesi boş — Final FinFollowingEmpty: ikon dairesi, başlık, açıklama, önerilen hesaplar. */
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
    <View>
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyIcon, { backgroundColor: t.color.line }]}>
          <Icon name="users" size={24} color={t.color.ink} />
        </View>
        <AppText style={[styles.emptyTitle, { color: t.color.ink }]}>{tr('kesfet.ui.following_empty_title')}</AppText>
        <AppText style={[styles.emptyDesc, { color: t.color.secondary }]}>{tr('kesfet.ui.following_empty_desc')}</AppText>
      </View>
      {suggestions.length > 0 ? (
        <View>
          <AppText style={[styles.sugTitle, { color: t.color.secondary }]}>{tr('kesfet.ui.suggested_title')}</AppText>
          {suggestions.map((a) => (
            <SuggestionRow key={a.id} account={a} onFollow={onFollow} />
          ))}
          <View style={[styles.sugEnd, { borderTopColor: t.color.line }]} />
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
  emptyWrap: { paddingTop: 36, paddingHorizontal: 16, paddingBottom: 20, alignItems: 'flex-start', gap: 6 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontFamily: fontFamily.headingSemibold, fontSize: 20, lineHeight: 26 },
  emptyDesc: { fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 20 },
  sugTitle: { paddingHorizontal: 16, paddingBottom: 6, fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 18 },
  sugRow: { minHeight: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  sugEnd: { borderTopWidth: StyleSheet.hairlineWidth },
  sugInfo: { flex: 1, minWidth: 0 },
  sugNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sugName: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  sugSub: { fontFamily: fontFamily.bodyRegular, fontSize: 13, lineHeight: 18 },
  followBtn: { height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  followText: { fontFamily: fontFamily.bodySemibold, fontSize: 14 },
});
