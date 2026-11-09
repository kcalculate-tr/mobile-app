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

import Animated from 'react-native-reanimated';

import { AppText, useTheme, usePop } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { CachedImage } from '../../../components/CachedImage';
import { CaretLeft, LockSimple, User, XCircle } from '../../../components/icons';
import { RootStackParamList } from '../../../navigation/types';
import { getProfilClient } from '../client';
import { canViewProfileContent } from '../visibility';
import { RollingNumber } from '../../gun/ui';
import type { NumLang } from '../../gun/motion';
import type { PublicProfile } from '../types';
import { PrivacySheet } from './PrivacySheet';
import PublicPreviewScreen from './screens/PublicPreviewScreen';
import { useFeature } from '../../../core/flags';
import { TakibeBaslaCTA } from './TakibeBaslaCTA';
import { track } from '../../../lib/analytics';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rp = RouteProp<RootStackParamList, 'PublicProfile'>;

export default function PublicProfileScreen() {
  const t = useTheme();
  const { t: tt, lang } = useT();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const handle = (route.params?.handle ?? '').trim().replace(/^@/, '');
  const yeniKabuk = useFeature('yeni_kabuk' as any);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const { style: followPopStyle, pop: followPop } = usePop();

  const load = useCallback(() => {
    setLoading(true);
    getProfilClient()
      .getPublicProfile({ handle })
      .then(setProfile)
      // G21-S1 md.8: ağ hatası işlenmemiş ret bırakmasın (ekran "bulunamadı" + geri).
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  // G21-S1 md.8: derin bağlantıyla gelindiyse geri = Tabs (çıkmaz yok).
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs' as never));
  // Yükleniyor / bulunamadı hâllerinde de geri düğmesi (önce yalnız iOS kenar jesti vardı).
  const backBar = (
    <View style={[styles.topBar, { position: 'absolute', top: insets.top + 8, left: 0, right: 0 }]}>
      <Pressable onPress={goBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={tt('common.back')} testID="public-profile-back">
        <CaretLeft size={22} color={t.color.ink} weight="bold" />
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.color.bg }]}>
        {backBar}
        <ActivityIndicator />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: t.color.bg, paddingTop: insets.top }]}>
        {backBar}
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
      track('follow', { on: turningOn, state: res.state, surface: 'profile' });
      // Takip düğmesi pop'u — yalnız takip/istek AÇILIRKEN (olumlu an); bırakırken sessiz.
      if (turningOn && (res.state === 'following' || res.state === 'requested')) followPop();
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

  // G15-S4 — yeni kabuk açıkken Final (FinProfilePublic) düzeni; kapalıyken aşağıdaki eski görünüm AYNEN.
  if (yeniKabuk) {
    return (
      <>
      {isMe ? (
        <PrivacySheet
          visible={privacyOpen}
          isPrivate={profile.is_private}
          onClose={() => setPrivacyOpen(false)}
          onChanged={(isPrivate) => setProfile((p) => (p ? { ...p, is_private: isPrivate } : p))}
        />
      ) : null}
      <PublicPreviewScreen
        key={`${profile.id}:${profile.me_following}`}
        onBack={() => navigation.goBack()}
        handle={profile.handle}
        vitrinProfile={profile}
        blocked={Boolean(profile.blocked)}
        locked={!canView}
        action={
          isMe
            ? { label: profile.is_private ? tt('profil.private_account') : tt('profil.privacy_public'), onPress: () => setPrivacyOpen(true), outlined: true }
            : { label: followLabel, onPress: handleFollowPress, busy: followBusy, outlined: profile.me_following === 'following' }
        }
      />
      </>
    );
  }

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
          <Counter label={tt('profil.posts')} value={profile.posts} lang={lang as NumLang} color={t.color.ink} />
          <Counter label={tt('profil.followers')} value={profile.followers} lang={lang as NumLang} color={t.color.ink} />
          <Counter label={tt('profil.following_count')} value={profile.following} lang={lang as NumLang} color={t.color.ink} />
        </View>

        {profile.blocked ? (
          // Engelli hâli — takip düğmesi yok, içerik yok (olumsuz an: sessiz, kırmızı yok).
          <View style={styles.blockedWrap}>
            <XCircle size={22} color={t.color.secondary} weight="fill" />
            <AppText variant="body" tone="secondary">
              {tt('profil.blocked_title')}
            </AppText>
          </View>
        ) : isMe ? (
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
          <Animated.View style={[styles.followWrap, followPopStyle]}>
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
          </Animated.View>
        )}
      </View>

      {isMe ? (
        <View style={styles.section}>
          <TakibeBaslaCTA />
        </View>
      ) : null}

      {profile.blocked ? null : (
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
      )}

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

function Counter({ label, value, lang, color }: { label: string; value: number; lang: NumLang; color: string }) {
  return (
    <View style={styles.counter}>
      <RollingNumber value={value} lang={lang} fontSize={20} weight="700" color={color} />
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
  followWrap: { marginTop: 20, alignSelf: 'stretch' },
  followBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
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
