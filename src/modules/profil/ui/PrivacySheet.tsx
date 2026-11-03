// T20Privacy — Hesap gizliliği. Yalnız iki seçenek (Herkese açık / Gizli
// hesap); başka seçenek yok (bkz. G6-S3.md madde 4). Onayda `set_profile_privacy`
// çağrılır. Gizliden açığa geçişte bekleyen takip istekleri SUNUCUDA otomatik
// onaylanır (G6-CONTRACT.md) — istemci ek bir şey yapmaz.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import BottomSheet from '../../../components/BottomSheet';
import { Check } from '../../../components/icons';
import { getProfilClient } from '../client';

export interface PrivacySheetProps {
  visible: boolean;
  isPrivate: boolean;
  onClose: () => void;
  onChanged: (isPrivate: boolean) => void;
}

export function PrivacySheet({ visible, isPrivate, onClose, onChanged }: PrivacySheetProps) {
  const t = useTheme();
  const { t: tt } = useT();
  const [selected, setSelected] = useState(isPrivate);
  const [saving, setSaving] = useState(false);

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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={tt('profil.privacy_title')}
      footer={
        <Pressable
          onPress={handleConfirm}
          disabled={saving}
          style={[styles.confirmBtn, { backgroundColor: t.color.ink }]}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <AppText variant="body" style={styles.confirmText}>
              {tt('profil.privacy_confirm')}
            </AppText>
          )}
        </Pressable>
      }
    >
      <Option
        selected={!selected}
        onPress={() => setSelected(false)}
        title={tt('profil.privacy_public')}
        subtitle={tt('profil.privacy_public_hint')}
        line={t.color.line}
      />
      <Option
        selected={selected}
        onPress={() => setSelected(true)}
        title={tt('profil.private_account')}
        subtitle={tt('profil.privacy_private_hint')}
        line={t.color.line}
      />
    </BottomSheet>
  );
}

function Option({
  selected,
  onPress,
  title,
  subtitle,
  line,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
  line: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.option, { borderBottomColor: line }]}
    >
      <View style={{ flex: 1 }}>
        <AppText variant="body" style={selected ? styles.optionTitleOn : undefined}>
          {title}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {subtitle}
        </AppText>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Check size={12} color="#FFFFFF" weight="bold" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionTitleOn: { fontWeight: '700' },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C3C7CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  confirmBtn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#FFFFFF', fontWeight: '600' },
});
