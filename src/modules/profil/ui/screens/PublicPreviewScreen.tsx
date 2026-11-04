// FinProfilePublic — "başkaları profilimi böyle görüyor" salt-okur önizleme.
// Açık profil başlığının (avatar, ad, @handle, 3 sütun sayaç) birebir
// görünümünü taşır ama takip düğmesi yok. Sayaçlar get_public_profile RPC'den
// gerçek gelir; gelmezse 0 gösterilir, uydurma veri yok.
import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { LockSimple } from '../../../../components/icons';
import { getProfilClient } from '../../client';
import type { PublicProfile } from '../../types';
import {
  FinScreen,
  FinHeader,
  FinCard,
  FinChip,
  heading,
  body,
  bodySemibold,
} from '../finUi';

export default function PublicPreviewScreen({
  onBack,
  handle,
  displayName,
  avatarUrl,
  isPrivate,
}: {
  onBack: () => void;
  handle?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  isPrivate?: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useT();

  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
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
  }, [handle]);

  const name = (displayName ?? '').trim();
  const firstLetter = name ? name.charAt(0).toUpperCase() : null;
  const privateAccount = isPrivate ?? profile?.is_private ?? false;

  return (
    <FinScreen scroll>
      <FinHeader title={tr('profil.public_profile_title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
          {tr('profil.public_preview_note')}
        </Text>

        <View style={{ alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              overflow: 'hidden',
              backgroundColor: t.color.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
            ) : firstLetter ? (
              <Text style={{ fontFamily: heading, fontSize: 28, color: t.color.ink }}>
                {firstLetter}
              </Text>
            ) : null}
          </View>

          {name ? (
            <Text style={{ fontFamily: heading, fontSize: 24, color: t.color.ink }}>{name}</Text>
          ) : null}

          {handle ? (
            <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary }}>
              @{handle.replace(/^@/, '')}
            </Text>
          ) : null}

          <View style={{ marginTop: 4 }}>
            {privateAccount ? (
              <FinChip
                label={tr('profil.private_account_badge')}
                selected={false}
                onPress={undefined}
              />
            ) : (
              <FinChip label={tr('profil.public_account')} selected={false} onPress={undefined} />
            )}
          </View>
        </View>

        <FinCard>
          <View style={{ flexDirection: 'row' }}>
            <PreviewCounter value={profile?.posts ?? 0} label={tr('profil.posts_short')} />
            <PreviewCounter value={profile?.followers ?? 0} label={tr('profil.followers_short')} />
            <PreviewCounter value={profile?.following ?? 0} label={tr('profil.following_short')} />
          </View>
        </FinCard>

        {privateAccount ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <LockSimple size={16} color={t.color.secondary} weight="fill" />
            <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
              {tr('profil.private_account_badge')}
            </Text>
          </View>
        ) : null}
      </View>
    </FinScreen>
  );
}

function PreviewCounter({ value, label }: { value: number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>{value}</Text>
      <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{label}</Text>
    </View>
  );
}
