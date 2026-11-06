// ProfileSocialHeader — yeni kabuk (yeni_kabuk) açıkken Profil üstündeki sosyal
// başlık (FinPrProfile, G14-S1): avatar, ad, @kullanıcı adı, açık/gizli hesap
// çipi (→ PrivacySheet), gönderi/takipçi/takip kartı. "Macro aboneliğim"
// satırı Final'de yok (eatkcal › Macro ve Abonelik satırı var) → kaldırıldı;
// `onOpenSubscriptions` geriye uyum için prop'ta kalır.
// ProfileScreen bu bileşeni YALNIZ bayrak açıkken render eder; kapalıyken eski
// profil kartı yerinde kalır (bayt bayt aynı).
//
// Sayılar yalnız GERÇEK veriden (get_public_profile); RPC yoksa/handle yoksa
// sayaç satırı HİÇ gösterilmez (uydurma sayı yok — RULES).
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { getSupabaseClient } from '../../../core/supabase';
import { CachedImage } from '../../../components/CachedImage';
import { Eye, LockSimple } from '../../../components/icons';
import { RollingNumber } from '../../gun/ui';
import type { NumLang } from '../../gun/motion';
import { getProfilClient } from '../client';
import type { PublicProfile } from '../types';
import { PrivacySheet } from './PrivacySheet';

export interface ProfileSocialHeaderProps {
  name: string;
  avatarUrl: string | null;
  onAvatarPress?: () => void;
  onOpenSubscriptions: () => void;
}

export function ProfileSocialHeader({
  name,
  avatarUrl,
  onAvatarPress,
  onOpenSubscriptions,
}: ProfileSocialHeaderProps) {
  const t = useTheme();
  const { t: tt, lang } = useT();
  const { user } = useAuth();

  const [handle, setHandle] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    // Önce profiles satırından handle + gizlilik (hızlı, her zaman var).
    void (async () => {
      try {
        const { data } = await getSupabaseClient()
          .from('profiles')
          .select('handle,is_private')
          .eq('id', user.id)
          .maybeSingle();
        if (!alive || !data) return;
        const h = (data as { handle?: string | null }).handle ?? null;
        setHandle(h);
        setIsPrivate(Boolean((data as { is_private?: boolean }).is_private));
        // Sayılar için get_public_profile — RPC yoksa sessizce atla (sayaç gizli).
        if (h) {
          try {
            const pp = await getProfilClient().getPublicProfile({ handle: h });
            if (alive && pp) setProfile(pp);
          } catch {
            // RPC canlıda yok → sayaç satırı gösterilmez.
          }
        }
      } catch {
        // profiles okunamadı — ad/avatar yine de gösterilir.
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const initial = (name.trim()[0] ?? '?').toLocaleUpperCase(lang === 'en' ? 'en' : 'tr');

  return (
    <View style={styles.wrap}>
      {/* G14-S1 — FinPrProfile kimlik bloğu: 76 avatar (foto yoksa baş harf),
          ad (Bricolage 24), @kullanıcı adı, açık/gizli hesap çipi (→ PrivacySheet). */}
      <View style={styles.identityRow}>
        <Pressable
          onPress={onAvatarPress}
          style={[styles.avatar, { backgroundColor: t.color.line }]}
          accessibilityRole="button"
          accessibilityLabel={name}
        >
          {avatarUrl ? (
            <CachedImage uri={avatarUrl} style={styles.avatarImg} />
          ) : (
            <AppText variant="title" style={styles.initial}>
              {initial}
            </AppText>
          )}
        </Pressable>
        <View style={styles.identityInfo}>
          <AppText variant="title" numberOfLines={1} style={styles.name}>
            {name}
          </AppText>
          {handle ? (
            <AppText tone="secondary" numberOfLines={1} style={styles.handle}>
              @{handle}
            </AppText>
          ) : null}
          <Pressable
            onPress={() => setPrivacyOpen(true)}
            style={[styles.privacyChip, { backgroundColor: t.color.line }]}
            accessibilityRole="button"
            accessibilityLabel={tt('profil.privacy_title')}
          >
            {isPrivate ? (
              <LockSimple size={14} color={t.color.ink} weight="fill" />
            ) : (
              <Eye size={14} color={t.color.ink} />
            )}
            <AppText style={styles.chipText}>
              {isPrivate ? tt('profil.private_account_badge') : tt('profil.public_account')}
            </AppText>
          </Pressable>
        </View>
      </View>

      {/* Sayaçlar — yalnız gerçek veri geldiyse (beyaz kart, 3 sütun). */}
      {profile ? (
        <View style={[styles.counters, { backgroundColor: t.color.surface }]}>
          <Counter label={tt('profil.posts_short')} value={profile.posts} lang={lang as NumLang} />
          <View style={[styles.counterDivider, { backgroundColor: t.color.line }]} />
          <Counter label={tt('profil.followers_short')} value={profile.followers} lang={lang as NumLang} />
          <View style={[styles.counterDivider, { backgroundColor: t.color.line }]} />
          <Counter label={tt('profil.following_short')} value={profile.following} lang={lang as NumLang} />
        </View>
      ) : null}

      <PrivacySheet
        visible={privacyOpen}
        isPrivate={isPrivate}
        onClose={() => setPrivacyOpen(false)}
        onChanged={(next) => setIsPrivate(next)}
      />
    </View>
  );
}

function Counter({ label, value, lang }: { label: string; value: number; lang: NumLang }) {
  const t = useTheme();
  return (
    <View style={styles.counter}>
      <RollingNumber value={value} lang={lang} fontSize={18} weight="700" color={t.color.ink} />
      <AppText tone="secondary" style={styles.counterLabel}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 12 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  initial: { fontSize: 28, lineHeight: 34 },
  identityInfo: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 24, lineHeight: 30 },
  handle: { fontSize: 14, lineHeight: 19 },
  privacyChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  counters: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, minHeight: 60 },
  counter: { alignItems: 'center', justifyContent: 'center', gap: 0, flex: 1, minHeight: 60 },
  counterLabel: { fontSize: 13, lineHeight: 17 },
  counterDivider: { width: StyleSheet.hairlineWidth * 2, alignSelf: 'stretch' },
});
