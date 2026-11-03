// ProfileSocialHeader — yeni kabuk (yeni_kabuk) açıkken Profil üstündeki sosyal
// başlık: avatar, ad, @kullanıcı adı, gönderi/takipçi/takip sayıları, gizlilik
// rozeti (→ PrivacySheet) + "Macro aboneliğim" satırı (→ Subscriptions).
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
import { CaretRight, CrownSimpleIcon, LockSimple, User } from '../../../components/icons';
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

  return (
    <View style={styles.wrap}>
      <View style={styles.identityRow}>
        <Pressable onPress={onAvatarPress} style={[styles.avatar, { backgroundColor: t.color.line }]} accessibilityRole="button">
          {avatarUrl ? (
            <CachedImage uri={avatarUrl} style={styles.avatarImg} />
          ) : (
            <User size={34} color={t.color.secondary} weight="fill" />
          )}
        </Pressable>
        <View style={styles.identityInfo}>
          <View style={styles.nameRow}>
            <AppText variant="title" numberOfLines={1} style={styles.name}>
              {name}
            </AppText>
            {isPrivate ? (
              <View style={[styles.privateBadge, { backgroundColor: t.color.line }]}>
                <LockSimple size={11} color={t.color.secondary} weight="fill" />
                <AppText variant="caption" tone="secondary">
                  {tt('profil.private_badge')}
                </AppText>
              </View>
            ) : null}
          </View>
          {handle ? (
            <AppText variant="body" tone="secondary" numberOfLines={1}>
              @{handle}
            </AppText>
          ) : null}
        </View>
      </View>

      {/* Sayaçlar — yalnız gerçek veri geldiyse. */}
      {profile ? (
        <View style={styles.counters}>
          <Counter label={tt('profil.posts')} value={profile.posts} lang={lang as NumLang} />
          <View style={[styles.counterDivider, { backgroundColor: t.color.line }]} />
          <Counter label={tt('profil.followers')} value={profile.followers} lang={lang as NumLang} />
          <View style={[styles.counterDivider, { backgroundColor: t.color.line }]} />
          <Counter label={tt('profil.following_count')} value={profile.following} lang={lang as NumLang} />
        </View>
      ) : null}

      {/* Gizlilik satırı → PrivacySheet. */}
      <Pressable
        onPress={() => setPrivacyOpen(true)}
        style={[styles.row, { borderColor: t.color.line }]}
        accessibilityRole="button"
      >
        <LockSimple size={18} color={t.color.ink} weight="fill" />
        <AppText variant="body" style={styles.rowLabel}>
          {tt('profil.privacy_title')}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {isPrivate ? tt('profil.private_account') : tt('profil.privacy_public')}
        </AppText>
        <CaretRight size={16} color={t.color.secondary} />
      </Pressable>

      {/* Macro aboneliğim → Subscriptions. */}
      <Pressable
        onPress={onOpenSubscriptions}
        style={[styles.row, { borderColor: t.color.line }]}
        accessibilityRole="button"
      >
        <CrownSimpleIcon size={18} color={t.color.ink} weight="fill" />
        <AppText variant="body" style={styles.rowLabel}>
          {tt('profil.macro_subscription')}
        </AppText>
        <CaretRight size={16} color={t.color.secondary} />
      </Pressable>

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
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  identityInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1 },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  counters: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 4 },
  counter: { alignItems: 'center', gap: 2, flex: 1 },
  counterDivider: { width: StyleSheet.hairlineWidth, height: 28 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flex: 1 },
});
