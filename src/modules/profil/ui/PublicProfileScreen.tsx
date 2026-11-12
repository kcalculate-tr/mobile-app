// `/u/:handle` hedefi — G5-S4'ün yer tutucu `SharedProfileScreen`'inin yerini
// alacak gerçek açık profil (bu dalda night5/share-links henüz birleşmediği
// için o dosya burada yok; bkz. G6-S3-LOG.md "Rota notu"). Başlık: avatar, ad,
// @handle, bio, sayaçlar, Takip et/İstek gönderildi/Takip ediliyor. Gizli hesap +
// takip etmiyorsam içerik yerine "Bu hesap gizli".
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Animated from 'react-native-reanimated';

import { AppText, useTheme, usePop, haptic } from '../../../core/design';
import { WAIT } from '../../../core/design/motion';
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
import { AddToast, type ToastState } from '../../kesfet/ui/AddToast';
import { runOptimisticFollow } from '../followOptimistic';
import { FinSkeletonBlock } from '../../../core/design/components/FinSkeleton';
import { useBreath } from '../../../core/design/motion';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

// G22-S2 md.5 (FinFollowError): "Takip edilemedi." uyarısı ~6 sn kalır (okuma süresi).
const FOLLOW_ERROR_HOLD = WAIT.actionToastHold;

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
  const [followToast, setFollowToast] = useState<ToastState | null>(null);
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
    // G23-S1: yeni kabukta FinMoLoad iskeleti (profil düzeni); eski kabuk AYNEN.
    if (yeniKabuk) {
      return (
        <View style={[styles.fill, { backgroundColor: t.color.bg, paddingTop: insets.top + 64 }]}>
          {backBar}
          <PublicProfileSkeleton />
        </View>
      );
    }
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

  // G22-S2 md.5 (FinFollowError): İYİMSER takip — düğme anında hedef duruma geçer;
  // sunucu hatasında önceki durum geri gelir (iyimser "Takip ediliyor" geride
  // kalmaz) + kısa uyarı "Takip edilemedi." · "Tekrar dene" (tab barın üstünde).
  const handleFollowPress = async () => {
    if (followBusy || isMe) return;
    setFollowBusy(true);
    setFollowToast(null);
    const res = await runOptimisticFollow(
      { me_following: profile.me_following, followers: profile.followers, is_private: profile.is_private },
      (on) => getProfilClient().follow({ user: profile.id, on }),
      (next) => setProfile((p) => (p ? { ...p, me_following: next.me_following, followers: next.followers } : p)),
    );
    setFollowBusy(false);
    if (res.ok) {
      track('follow', { on: res.turningOn, state: res.state, surface: 'profile' });
      // Takip düğmesi pop'u — yalnız takip/istek AÇILIRKEN (olumlu an); bırakırken sessiz.
      if (res.turningOn && (res.state === 'following' || res.state === 'requested')) followPop();
      return;
    }
    haptic('warning');
    setFollowToast({
      message: tt('follow_error.failed'),
      actionLabel: tt('follow_error.retry'),
      onAction: () => void handleFollowPress(),
    });
  };
  const followToastView = (
    <AddToast toast={followToast} onDismiss={() => setFollowToast(null)} holdMs={FOLLOW_ERROR_HOLD} />
  );

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
        key={profile.id}
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
      {followToastView}
      </>
    );
  }

  return (
    <>
    <ScrollView {...SCROLL_KEYBOARD} style={{ backgroundColor: t.color.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40 }}>
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
    {followToastView}
    </>
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

/** FinMoLoad iskeleti — FinProfilePublic yerleşimi: avatar, ad, @handle, üç sayaç, düğme, ızgara. */
function PublicProfileSkeleton() {
  const { t: tt } = useT();
  const { style: pulse } = useBreath({ min: 0.45, max: 0.9 });
  return (
    <View
      testID="public-profile-skeleton"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={tt('common.loading')}
      style={styles.skel}
    >
      <FinSkeletonBlock width={88} height={88} radius={44} pulse={pulse} />
      <FinSkeletonBlock width="50%" height={22} radius={8} pulse={pulse} />
      <FinSkeletonBlock width="30%" height={14} radius={7} pulse={pulse} />
      <View style={styles.skelStats}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skelStat}>
            <FinSkeletonBlock width={36} height={20} radius={6} pulse={pulse} />
            <FinSkeletonBlock width={56} height={12} radius={6} pulse={pulse} />
          </View>
        ))}
      </View>
      <FinSkeletonBlock height={44} radius={22} pulse={pulse} />
      <View style={styles.skelGrid}>
        {Array.from({ length: 6 }, (_, i) => (
          <FinSkeletonBlock key={i} width="31%" height={110} radius={12} pulse={pulse} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  skel: { alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  skelStats: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginVertical: 8 },
  skelStat: { alignItems: 'center', gap: 6 },
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, alignSelf: 'stretch', marginTop: 12 },
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
