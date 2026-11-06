// FinPrivacy — Hesap gizliliği. Yalnız iki seçenek (Herkese açık / Gizli
// hesap); başka seçenek yok (bkz. G6-S3.md madde 4). Onayda `set_profile_privacy`
// çağrılır. Gizliden açığa geçişte bekleyen takip istekleri SUNUCUDA otomatik
// onaylanır (G6-CONTRACT.md) — istemci ek bir şey yapmaz.
// G15-S4: tasarım Final alttan sayfa (core/design Sheet: sola dayalı başlık,
// 28 köşe, tutamaç); satırlarda globe/kilit ikonu, radyo = halka + iç nokta.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { FinText as Text } from '../../../core/design/components/FinText';

import { Sheet, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Globe, LockSimple } from '../../../components/icons';
import { getProfilClient } from '../client';
import { useFeature } from '../../../core/flags';
import { LegacyPrivacySheet } from './LegacyPrivacySheet';
import { FinPrimaryButton, body, bodyBold, bodyMedium } from './finUi';

export interface PrivacySheetProps {
  visible: boolean;
  isPrivate: boolean;
  onClose: () => void;
  onChanged: (isPrivate: boolean) => void;
}

/**
 * Bayrak kapalıyken BUGÜNKÜ (eski BottomSheet) görünüm AYNEN; `yeni_kabuk`
 * açıkken Final alttan sayfa. Aynı dosyadan çağıran tüm yerler (eski
 * `/u/:handle`, GunProfilUiLab) bayrak kapalı yolda eski sheet'i görür.
 */
export function PrivacySheet(props: PrivacySheetProps) {
  const yeniKabuk = useFeature('yeni_kabuk' as any);
  return yeniKabuk ? <FinPrivacySheet {...props} /> : <LegacyPrivacySheet {...props} />;
}

export function FinPrivacySheet({ visible, isPrivate, onClose, onChanged }: PrivacySheetProps) {
  const t = useTheme();
  const { t: tt } = useT();
  const [selected, setSelected] = useState(isPrivate);
  const [saving, setSaving] = useState(false);

  // Her açılışta mevcut duruma dön (kapatılıp yeniden açılınca eski seçim kalmasın).
  useEffect(() => {
    if (visible) setSelected(isPrivate);
  }, [visible, isPrivate]);

  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await getProfilClient().setPrivacy({ isPrivate: selected });
      onChanged(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={tt('profil.privacy_title')}
      footer={
        <FinPrimaryButton
          label={tt('profil.privacy_confirm')}
          onPress={handleConfirm}
          disabled={saving}
          icon={saving ? <ActivityIndicator color={t.color.bg} /> : undefined}
          style={{ marginTop: 12 }}
        />
      }
    >
      <Option
        selected={!selected}
        onPress={() => setSelected(false)}
        icon={<Globe size={22} color={t.color.ink} />}
        title={tt('profil.privacy_public')}
        subtitle={tt('profil.privacy_public_hint')}
        first
      />
      <Option
        selected={selected}
        onPress={() => setSelected(true)}
        icon={<LockSimple size={22} color={t.color.ink} />}
        title={tt('profil.private_account')}
        subtitle={tt('profil.privacy_private_hint')}
      />
    </Sheet>
  );
}

function Option({
  selected,
  onPress,
  icon,
  title,
  subtitle,
  first,
}: {
  selected: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  first?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={{
        minHeight: 68,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.color.line,
      }}
    >
      <View style={{ width: 24, alignItems: 'center' }}>{icon}</View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontFamily: selected ? bodyBold : bodyMedium, fontSize: 15, color: t.color.ink }}>{title}</Text>
        <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{subtitle}</Text>
      </View>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: selected ? t.color.ink : t.color.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.color.ink }} /> : null}
      </View>
    </Pressable>
  );
}
