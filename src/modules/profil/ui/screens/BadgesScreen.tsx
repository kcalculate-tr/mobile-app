// FinBadges — "Doğrulama rozetleri": Keşfet'te ad yanında görünen mührün ve rol
// çiplerinin açıklaması (Diyetisyen, PT, Sporcu, Kcalculate). Giriş: Profil ›
// Hesabım › Rozetlerim.
// G25-S1 md.8 (A11): örnek "Ad Soyad" satırları kalktı (2.1 yer tutucu görünümü). Üstte GERÇEK
// veri: kullanıcının kendi adı + (doğrulandıysa) mühür ve rol çipi — `get_public_profile`;
// doğrulanmadıysa / okunamazsa boş hâl ("Hesabın henüz doğrulanmadı."). Altta rol çipleri ve
// ne anlama geldikleri (kişi adı yok, uydurma yok).
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';

import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { Barbell, CheckCircle, SealCheck, Sneaker } from '../../../../components/icons';
import { getProfilClient } from '../../client';
import type { PublicProfile } from '../../types';
import { FinCard, FinScreen, FinHeader, heading, body, bodyBold, bodySemibold } from '../finUi';
// G12-S6: S2'nin (Keşfet) gerçek VerifiedBadge'i tek kaynak.
import { VerifiedBadge } from '../../../kesfet/ui/VerifiedBadge';

type RoleKey = 'dietitian' | 'pt' | 'athlete' | 'official';
type RoleRow = { key: RoleKey; chip: string; desc: string; icon: React.ReactNode };

/** Sunucu rol değeri → rozet çipi anahtarı (bilinmeyen → null: çip yok). SAF. */
export function badgeRoleKey(role: string | null | undefined): RoleKey | null {
  switch ((role ?? '').toLowerCase()) {
    case 'dietitian':
    case 'dyt':
      return 'dietitian';
    case 'pt':
    case 'trainer':
      return 'pt';
    case 'athlete':
    case 'sporcu':
      return 'athlete';
    case 'official':
    case 'kurum':
      return 'official';
    default:
      return null;
  }
}

export default function BadgesScreen({ onBack, handle }: { onBack: () => void; handle?: string | null }) {
  const t = useTheme();
  const { t: tr } = useT();

  const [me, setMe] = useState<PublicProfile | null>(null);

  useEffect(() => {
    let alive = true;
    const h = (handle ?? '').trim().replace(/^@/, '');
    if (!h) return;
    getProfilClient()
      .getPublicProfile({ handle: h })
      .then((p) => {
        if (alive && p) setMe(p);
      })
      .catch(() => {
        /* sunucu erişilemezse boş hâl — uydurma yok */
      });
    return () => {
      alive = false;
    };
  }, [handle]);

  const icon = (el: (c: string) => React.ReactNode) => el(t.color.ink);
  const roles: RoleRow[] = [
    { key: 'dietitian', chip: tr('profil.badge_role_dietitian'), desc: tr('profil.badge_role_dietitian_desc'), icon: icon((c) => <CheckCircle size={14} color={c} />) },
    { key: 'pt', chip: tr('profil.badge_role_pt'), desc: tr('profil.badge_role_pt_desc'), icon: icon((c) => <Barbell size={14} color={c} />) },
    { key: 'athlete', chip: tr('profil.badge_role_athlete'), desc: tr('profil.badge_role_athlete_desc'), icon: icon((c) => <Sneaker size={14} color={c} />) },
    { key: 'official', chip: tr('profil.badge_role_official'), desc: tr('profil.badge_role_official_desc'), icon: icon((c) => <CheckCircle size={14} color={c} />) },
  ];
  const verified = !!me?.verified;
  const myRole = verified ? roles.find((r) => r.key === badgeRoleKey(me?.role)) ?? null : null;

  const chip = (r: RoleRow) => (
    <View
      style={{
        minHeight: 28,
        paddingHorizontal: 10,
        borderRadius: 14,
        backgroundColor: t.color.line,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
      }}
    >
      {r.icon}
      <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: t.color.ink }}>{r.chip}</Text>
    </View>
  );

  return (
    <FinScreen scroll>
      <FinHeader title="" onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 14 }}>
        <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }} accessibilityRole="header">
          {tr('profil.badges_title')}
        </Text>

        {/* Kendi durumun: gerçek veri ya da boş hâl. */}
        {verified && me ? (
          <FinCard style={{ padding: 16, gap: 10 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
              accessible
              accessibilityLabel={`${me.display_name}, ${tr('profil.badge_verified')}${myRole ? `, ${myRole.chip}` : ''}`}
              testID="badges-me"
            >
              <Text style={{ fontFamily: bodyBold, fontSize: 16, color: t.color.ink, flexShrink: 1 }}>{me.display_name}</Text>
              <VerifiedBadge size={18} />
              {myRole ? chip(myRole) : null}
            </View>
            <Text style={{ fontFamily: body, fontSize: 14, lineHeight: 20, color: t.color.secondary }}>{tr('profil.badge_verified_desc')}</Text>
          </FinCard>
        ) : (
          <FinCard style={{ padding: 16, gap: 10, alignItems: 'center' }} >
            <View testID="badges-empty" style={{ alignItems: 'center', gap: 10 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.color.line, alignItems: 'center', justifyContent: 'center' }}>
                <SealCheck size={22} color={t.color.ink} />
              </View>
              <Text style={{ fontFamily: body, fontSize: 14, lineHeight: 20, color: t.color.secondary, textAlign: 'center' }}>
                {tr('profil.badge_locked')}
              </Text>
            </View>
          </FinCard>
        )}

        {/* Rol çipleri ve anlamları (kişi adı yok). */}
        <Text style={{ fontFamily: bodySemibold, fontSize: 14, color: t.color.secondary, marginTop: 6 }}>{tr('profil.badge_roles_h')}</Text>
        {roles.map((r) => (
          <View key={r.key} style={{ gap: 6 }} accessible accessibilityLabel={`${r.chip}. ${r.desc}`} testID={`badge-role-${r.key}`}>
            {chip(r)}
            <Text style={{ fontFamily: body, fontSize: 14, lineHeight: 20, color: t.color.ink }}>{r.desc}</Text>
          </View>
        ))}
      </View>
    </FinScreen>
  );
}
