// `/u/:handle` hedefi — G5-S4'ün yer tutucu `SharedProfileScreen`'inin yerini
// alacak gerçek açık profil (bu dalda night5/share-links henüz birleşmediği
// için o dosya burada yok; bkz. G6-S3-LOG.md "Rota notu"). Başlık: avatar, ad,
// @handle, bio, sayaçlar, Takip et/İstek gönderildi/Takiptesin. Gizli hesap +
// takip etmiyorsam içerik yerine "Bu hesap gizli".
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { CachedImage } from '../../../components/CachedImage';
import { CaretLeft, LockSimple, User } from '../../../components/icons';
import { RootStackParamList } from '../../../navigation/types';
import { getProfilClient } from '../client';
import { canViewProfileContent } from '../visibility';
import type { PublicProfile } from '../types';
import { PrivacySheet } from './PrivacySheet';
import { TakibeBaslaCTA } from './TakibeBaslaCTA';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rp = RouteProp<RootStackParamList, 'PublicProfile'>;

export default function PublicProfileScreen() {
  const t = useTheme();
  const { t: tt } = useT();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const handle = (route.params?.handle ?? '').trim().replace(/^@/, '');

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getProfilClient()
      .getPublicProfile({ handle })
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.color.bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: t.color.bg, paddingTop: insets.top }]}>
        <AppText variant="body" tone="secondary">
          {tt('profil.not_found')}
        </AppText>
      </View>
    );
  }

  const isMe = Boolean(user?.id && user.id === profile.id);
  const canView = canViewProfileContent(profile, profile.me_following, isMe);

  const handleFollowPress = async () => {
    if (followBusy || isMe) return;
    setFollowBusy(true);
    try {
      const turningOn = profile.me_following === 'none';
      const res = await getProfilClient().follow({ user: profile.id, on: turningOn });
      setProfile((p) => (p ? { ...p, me_following: res.state } : p));
    } finally {
      setFollowBusy(false);
    }
  };

  const followLabel =
    profile.me_following === 'following'
      ? tt('profil.following')
      : profile.me_following === 'requested'
        ? tt('profil.requested')
        : tt('profil.follow');

  return (
    <ScrollView style={{ backgroundColor: t.color.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40 }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button">
          <CaretLeft size={22} color={t.color.ink} weight="bold" />
        </Pressable>
      </View>

      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: t.color.line }]}>
          {profile.avatar_url ? (
            <CachedImage uri={profile.avatar_url} style={styles.avatarImg} />
          ) : (
            <User size={40} color={t.color.secondary} weight="fill" />
          )}
        </View>
        <AppText variant="title" style={styles.name}>
          {profile.display_name}
        </AppText>
        <AppText variant="body" tone="secondary">
          @{profile.handle}
        </AppText>
        {profile.bio ? (
          <AppText variant="body" style={styles.bio}>
            {profile.bio}
          </AppText>
        ) : null}

        <View style={styles.counters}>
          <Counter label={tt('profil.posts')} value={profile.posts} />
          <Counter label={tt('profil.followers')} value={profile.followers} />
          <Counter label={tt('profil.following_count')} value={profile.following} />
        </View>

        {isMe ? (
          <Pressable
            onPress={() => setPrivacyOpen(true)}
            style={[styles.privacyBtn, { borderColor: t.color.line }]}
            accessibilityRole="button"
          >
            <AppText variant="body" style={{ fontWeight: '600' }}>
              {profile.is_private ? tt('profil.private_account') : tt('profil.privacy_public')}
            </AppText>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleFollowPress}
            disabled={followBusy}
            style={[
              styles.followBtn,
              profile.me_following === 'following'
                ? { borderColor: t.color.line, backgroundColor: 'transparent' }
                : { backgroundColor: t.color.accent },
            ]}
            accessibilityRole="button"
          >
            {followBusy ? (
              <ActivityIndicator color={t.color.ink} />
            ) : (
              <AppText
                variant="body"
                tone={profile.me_following === 'following' ? 'ink' : 'onAccent'}
                style={{ fontWeight: '700' }}
              >
                {followLabel}
              </AppText>
            )}
          </Pressable>
        )}
      </View>

      {isMe ? (
        <View style={styles.section}>
          <TakibeBaslaCTA />
        </View>
      ) : null}

      <View style={styles.content}>
        {canView ? (
          <AppText variant="body" tone="secondary" style={styles.emptyContent}>
            {tt('kesfet.empty')}
          </AppText>
        ) : (
          <View style={styles.lockedWrap}>
            <LockSimple size={28} color={t.color.secondary} weight="fill" />
            <AppText variant="heading" style={styles.lockedTitle}>
              {tt('profil.account_private')}
            </AppText>
          </View>
        )}
      </View>

      {isMe ? (
        <PrivacySheet
          visible={privacyOpen}
          isPrivate={profile.is_private}
          onClose={() => setPrivacyOpen(false)}
          onChanged={(isPrivate) => setProfile((p) => (p ? { ...p, is_private: isPrivate } : p))}
        />
      ) : null}
    </ScrollView>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.counter}>
      <AppText variant="heading">{value}</AppText>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { height: 44, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 8 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatarImg: { width: '100%', height: '100%' },
  name: { textAlign: 'center' },
  bio: { marginTop: 10, textAlign: 'center' },
  counters: { flexDirection: 'row', gap: 28, marginTop: 20 },
  counter: { alignItems: 'center', gap: 2 },
  followBtn: {
    marginTop: 20,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyBtn: {
    marginTop: 20,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { paddingHorizontal: 24, marginTop: 20 },
  content: { paddingHorizontal: 24, marginTop: 24 },
  emptyContent: { textAlign: 'center', paddingVertical: 32 },
  lockedWrap: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  lockedTitle: { textAlign: 'center' },
});
