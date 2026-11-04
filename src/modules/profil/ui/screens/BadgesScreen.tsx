// FinBadges — kazanılan/kilitli rozetler. "Onaylı" rozeti her zaman listelenir;
// gerçek durum `profiles.verified` (get_public_profile RPC) — kendi handle'ım
// ile okunur, uydurma yok; sunucuya erişilemezse kilitli varsayılır. Hiç
// kazanılmış rozet yoksa boş-durum kartı gösterilir.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { Gift } from '../../../../components/icons';
import { getProfilClient } from '../../client';
import {
  FinScreen,
  FinHeader,
  FinCard,
  heading,
  body,
  bodySemibold,
} from '../finUi';
import { VerifiedBadge } from './VerifiedBadge';

export default function BadgesScreen({ onBack, handle }: { onBack: () => void; handle?: string | null }) {
  const t = useTheme();
  const { t: tr } = useT();

  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let alive = true;
    const h = (handle ?? '').trim().replace(/^@/, '');
    if (!h) return;
    getProfilClient()
      .getPublicProfile({ handle: h })
      .then((p) => {
        if (alive && p) setVerified(p.verified);
      })
      .catch(() => {
        /* sunucu erişilemezse kilitli kalır — uydurma yok */
      });
    return () => {
      alive = false;
    };
  }, [handle]);

  const earnedCount = verified ? 1 : 0;

  return (
    <FinScreen scroll>
      <FinHeader title={tr('profil.badges_title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        <BadgeCard
          locked={!verified}
          icon={<VerifiedBadge size={40} />}
          title={tr('profil.badge_verified')}
          desc={verified ? tr('profil.badge_verified_desc') : tr('profil.badge_locked')}
        />

        {earnedCount === 0 ? (
          <FinCard style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: t.color.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Gift size={24} color={t.color.secondary} weight="fill" />
            </View>
            <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>
              {tr('profil.badges_title')}
            </Text>
            <Text
              style={{
                fontFamily: body,
                fontSize: 15,
                color: t.color.secondary,
                textAlign: 'center',
              }}
            >
              {tr('profil.no_badges')}
            </Text>
          </FinCard>
        ) : null}
      </View>
    </FinScreen>
  );
}

function BadgeCard({
  locked,
  icon,
  title,
  desc,
}: {
  locked: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  const t = useTheme();
  return (
    <FinCard style={{ opacity: locked ? 0.5 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, alignItems: 'center' }}>{icon}</View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>
            {title}
          </Text>
          <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{desc}</Text>
        </View>
      </View>
    </FinCard>
  );
}
