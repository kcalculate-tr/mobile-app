// FinProfilePublic — "başkaları profilimi böyle görüyor" salt-okur önizleme
// (giriş: Profil'de avatara dokunmak). Final düzeni: kapak, üst üste binen
// avatar + "Takip et" (önizlemede etkileşimsiz), ad + doğrulama mührü, @handle
// + rol çipi, bio, sayaçlar, Tabaklar / Gönderiler sekmeleri ve ızgara.
//
// Veri yalnız GERÇEK kaynaklardan (get_public_profile): ad, @handle, bio, rol,
// doğrulama, takipçi/gönderi sayıları. Yazar bazlı gönderi listesi RPC'si henüz
// yok (kesfet.getFeed yazar süzgeci almıyor) → ızgara `posts` verisi gelince
// dolar, gelene kadar boş durum gösterilir; kapak görseli de ilk tabaktan
// türetilir, yoksa nötr zemin. Uydurma veri YOK. Dev vitrini `vitrinPosts` ile
// Final örneğindeki içeriği gösterir (üretimde geçilmez).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { ArrowLeft, LockSimple } from '../../../../components/icons';
import { getProfilClient } from '../../client';
import type { PublicProfile } from '../../types';
import { VerifiedBadge } from '../../../kesfet/ui/VerifiedBadge';
import { roleBadgeKey } from '../../../kesfet/ui/format';
import { FinScreen, heading, body, bodyBold, bodySemibold } from '../finUi';

export type PublicPost = { id: string; photoUrl: string | null; adds: number };

export default function PublicPreviewScreen({
  onBack,
  handle,
  displayName,
  avatarUrl,
  isPrivate,
  vitrinPosts,
  vitrinProfile,
  action,
  locked,
  blocked,
}: {
  onBack: () => void;
  /** Gerçek profil ekranı (`/u/:handle`): Takip et / İstek gönderildi / Takiptesin. Verilmezse önizleme düğmesi. */
  action?: { label: string; onPress: () => void; busy?: boolean; outlined?: boolean };
  /** Gizli hesap + takip etmiyorum: ızgara yerine kilit notu. */
  locked?: boolean;
  /** Engelli: düğme ve içerik yok. */
  blocked?: boolean;
  handle?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  isPrivate?: boolean;
  /** YALNIZ dev vitrini: Final örneğiyle aynı içerikte tabaklar. */
  vitrinPosts?: PublicPost[];
  /** YALNIZ dev vitrini: sunucu yerine hazır profil. */
  vitrinProfile?: PublicProfile;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const cell = Math.floor((screenW - 4) / 3);

  const [profile, setProfile] = useState<PublicProfile | null>(vitrinProfile ?? null);
  const [tab, setTab] = useState<'plates' | 'posts'>('plates');
  const posts: PublicPost[] = vitrinPosts ?? [];

  useEffect(() => {
    if (vitrinProfile) return;
    let alive = true;
    const h = (handle ?? '').trim().replace(/^@/, '');
    if (!h) return;
    getProfilClient()
      .getPublicProfile({ handle: h })
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch(() => {
        /* sunucu erişilemezse sayaçlar 0 kalır — uydurma yok */
      });
    return () => {
      alive = false;
    };
  }, [handle, vitrinProfile]);

  const name = (profile?.display_name || displayName || '').trim();
  const firstLetter = name ? name.charAt(0).toLocaleUpperCase('tr') : null;
  const h = (handle ?? profile?.handle ?? '').replace(/^@/, '');
  const roleKey = profile ? roleBadgeKey(profile.role) : null;
  const roleLabel = roleKey ? tr(`kesfet.ui.badge.${roleKey}`) : null;
  const privateAccount = isPrivate ?? profile?.is_private ?? false;
  const bio = (profile?.bio ?? '').trim();
  const avatar = avatarUrl ?? profile?.avatar_url ?? null;
  const cover = posts.find((p) => p.photoUrl)?.photoUrl ?? null;
  const totalAdds = posts.reduce((n, p) => n + p.adds, 0);

  const stat = (value: number, label: string) => (
    <Text key={label} style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
      <Text style={{ fontFamily: bodyBold, color: t.color.ink }}>{value.toLocaleString('tr-TR')}</Text> {label}
    </Text>
  );

  return (
    <FinScreen scroll contentStyle={{ paddingBottom: 40 }}>
      {/* Kapak */}
      <View style={{ height: 232, backgroundColor: t.color.line }}>
        {cover ? <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} /> : null}
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={tr('profil.public_profile_title')}
          hitSlop={8}
          style={{
            position: 'absolute',
            top: insets.top + 6,
            left: 12,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(10,10,10,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color="#FFFFFF" weight="bold" />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: -44 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View
            style={{
              width: 92,
              height: 92,
              borderRadius: 46,
              borderWidth: 4,
              borderColor: t.color.bg,
              backgroundColor: t.color.line,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
            ) : firstLetter ? (
              <Text style={{ fontFamily: heading, fontSize: 32, color: t.color.ink }}>{firstLetter}</Text>
            ) : null}
          </View>
          {/* Önizleme: başkalarının göreceği düğme; kendi profilinde etkileşimsiz. */}
          {blocked ? null : (
            <Pressable
              onPress={action?.onPress}
              disabled={!action || action.busy}
              accessibilityRole={action ? 'button' : undefined}
              accessibilityElementsHidden={!action}
              style={{
                height: 44,
                paddingHorizontal: 22,
                borderRadius: 22,
                backgroundColor: action?.outlined ? 'transparent' : t.color.ink,
                borderWidth: action?.outlined ? 1 : 0,
                borderColor: t.color.line,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 6,
              }}
            >
              {action?.busy ? (
                <ActivityIndicator color={t.color.bg} />
              ) : (
                <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: action?.outlined ? t.color.ink : t.color.bg }}>
                  {action?.label ?? tr('profil.follow')}
                </Text>
              )}
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <Text style={{ fontFamily: heading, fontSize: 24, color: t.color.ink, flexShrink: 1 }} numberOfLines={1}>
            {name}
          </Text>
          {profile?.verified ? <VerifiedBadge size={20} /> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          {h ? (
            <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary }}>@{h}</Text>
          ) : null}
          {roleLabel ? (
            <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: t.color.line, justifyContent: 'center' }}>
              <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: t.color.ink }}>{roleLabel}</Text>
            </View>
          ) : null}
          {privateAccount ? (
            <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: t.color.line, justifyContent: 'center' }}>
              <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: t.color.ink }}>
                {tr('profil.private_account_badge')}
              </Text>
            </View>
          ) : null}
        </View>

        {bio ? (
          <Text style={{ fontFamily: body, fontSize: 15, lineHeight: 21, color: t.color.ink, marginTop: 12 }}>{bio}</Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {stat(profile?.followers ?? 0, tr('profil.followers_short'))}
          {stat(profile?.posts ?? 0, tr('profil.plates_short'))}
          {posts.length > 0 ? stat(totalAdds, tr('profil.added_total')) : null}
        </View>
      </View>

      {/* Sekmeler */}
      <View style={{ flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.color.line }}>
        {(['plates', 'posts'] as const).map((k) => {
          const on = tab === k;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: on ? bodyBold : body, fontSize: 15, color: on ? t.color.ink : t.color.secondary }}>
                {tr(k === 'plates' ? 'profil.tab_plates' : 'profil.tab_posts')}
              </Text>
              {on ? (
                <View style={{ position: 'absolute', bottom: 0, width: 56, height: 3, borderRadius: 2, backgroundColor: t.color.ink }} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {blocked ? (
        <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center', paddingVertical: 40 }}>
          {tr('profil.blocked_title')}
        </Text>
      ) : locked ? (
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 40 }}>
          <LockSimple size={26} color={t.color.secondary} weight="fill" />
          <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>{tr('profil.account_private')}</Text>
        </View>
      ) : tab === 'plates' && posts.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
          {posts.map((p) => (
            <View key={p.id} style={{ width: cell, height: cell, backgroundColor: t.color.line }}>
              {p.photoUrl ? <Image source={{ uri: p.photoUrl }} style={{ width: '100%', height: '100%' }} /> : null}
              {p.adds > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 8,
                    bottom: 8,
                    height: 24,
                    paddingHorizontal: 8,
                    borderRadius: 12,
                    backgroundColor: 'rgba(10,10,10,0.6)',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: bodySemibold, fontSize: 11, color: '#FFFFFF' }}>
                    {tr('profil.added_by', { n: p.adds })}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center', paddingVertical: 40 }}>
          {tr('profil.public_empty')}
        </Text>
      )}
    </FinScreen>
  );
}
