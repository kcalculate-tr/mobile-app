// FinBadges — "Doğrulama rozetleri": Keşfet'te ad yanında görünen mührün ve rol
// çiplerinin açıklaması (Diyetisyen, PT, Sporcu, Kcalculate). Giriş: Profil ›
// Hesabım › Rozetlerim. Örnek satırlar yalnız rozetin NASIL göründüğünü gösterir
// (gri avatar + genel "Ad Soyad"; gerçek kişi uydurulmaz). Kullanıcının kendi
// durumu `profiles.verified` (get_public_profile) ile okunur, alttaki satırda
// yazılır; sunucuya erişilemezse kilitli varsayılır.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { Barbell, CheckCircle, Sneaker } from '../../../../components/icons';
import { getProfilClient } from '../../client';
import { FinScreen, FinHeader, heading, body, bodyBold, bodySemibold } from '../finUi';
// G12-S6: S2'nin (Keşfet) gerçek VerifiedBadge'i tek kaynak.
import { VerifiedBadge } from '../../../kesfet/ui/VerifiedBadge';

type Example = { key: string; chip: string; icon: React.ReactNode; brand?: boolean };

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

  const icon = (el: (c: string) => React.ReactNode) => el(t.color.ink);
  const examples: Example[] = [
    { key: 'dietitian', chip: tr('profil.badge_role_dietitian'), icon: icon((c) => <CheckCircle size={14} color={c} />) },
    { key: 'pt', chip: tr('profil.badge_role_pt'), icon: icon((c) => <Barbell size={14} color={c} />) },
    { key: 'athlete', chip: tr('profil.badge_role_athlete'), icon: icon((c) => <Sneaker size={14} color={c} />) },
    { key: 'official', chip: tr('profil.badge_role_official'), icon: icon((c) => <CheckCircle size={14} color={c} />), brand: true },
  ];

  return (
    <FinScreen scroll>
      <FinHeader title="" onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 14 }}>
        <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>{tr('profil.badges_title')}</Text>

        {examples.map((e) => (
          <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {e.brand ? (
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#0A0A0A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: heading, fontSize: 13, color: '#FFFFFF' }}>kcal.</Text>
              </View>
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.color.line }} />
            )}
            <Text style={{ fontFamily: bodyBold, fontSize: 15, color: t.color.ink }}>
              {e.brand ? 'kcal' : tr('profil.badge_example_name')}
            </Text>
            <VerifiedBadge size={18} />
            <View
              style={{
                height: 28,
                paddingHorizontal: 10,
                borderRadius: 14,
                backgroundColor: t.color.line,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {e.icon}
              <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: t.color.ink }}>{e.chip}</Text>
            </View>
          </View>
        ))}

        <Text style={{ fontFamily: body, fontSize: 13, lineHeight: 18, color: t.color.secondary, marginTop: 8 }}>
          {verified ? tr('profil.badge_verified_desc') : tr('profil.badge_locked')}
        </Text>
      </View>
    </FinScreen>
  );
}
