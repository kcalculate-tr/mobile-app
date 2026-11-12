/**
 * G22-S2 md.6 — Profil › Ayarlar › Dil.
 *
 * Bayraklı seçilebilir liste: en üstte "Telefon dili" (varsayılan, cihazı izler),
 * ardından her etkin dil — bayrak + dilin KENDİ adı (Türkçe, English) + alt satırda
 * İngilizce/Türkçe karşılığı; seçili satırda onay işareti. Seçince uygulama anında o
 * dile geçer (I18nProvider yeniden çizer) ve tercih kalıcıdır (AsyncStorage).
 * Yeni dil = sözlük + `core/i18n/languages.ts` satırı (OTA ile gelebilir).
 *
 * Apple HIG: satır ≥ 60 pt, dil adı her zaman metin (bayrak süs, VoiceOver'dan gizli),
 * VoiceOver "seçili" durumu okur, Dynamic Type'ta metin sarar (kırpılmaz).
 */
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { LangFlag } from '../../../../core/design/components/LangFlag';
import { haptic, useTheme } from '../../../../core/design';
import {
  SYSTEM_PREF,
  enabledLanguages,
  languageEntry,
  languageSubtitle,
  useT,
  type LangPref,
} from '../../../../core/i18n';
import { detectDeviceLang } from '../../../../core/i18n/detect';
import { Check, DeviceMobile } from '../../../../components/icons';
import { FinScreen, FinHeader, FinRowGroup, FinSectionLabel, bodyMedium, body } from '../finUi';
import { SCROLL_KEYBOARD } from '../../../../core/design/keyboard';

function LangRow({
  first,
  leading,
  title,
  subtitle,
  selected,
  onPress,
  testID,
}: {
  first?: boolean;
  leading: React.ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => ({
        minHeight: 60,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.color.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 28, alignItems: 'center' }}>{leading}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: bodyMedium, fontSize: 15, color: t.color.ink }}>{title}</Text>
        <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{subtitle}</Text>
      </View>
      <View style={{ width: 24, alignItems: 'flex-end' }}>
        {selected ? <Check size={20} weight="bold" color={t.color.ink} /> : null}
      </View>
    </Pressable>
  );
}

export default function SettingsLanguageScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const { t: tr, lang, pref, setPref } = useT();
  const device = detectDeviceLang();
  const deviceName = languageEntry(device)?.nativeName ?? device;

  const choose = (next: LangPref) => {
    if (next === pref) return;
    haptic('selection');
    setPref(next);
  };

  return (
    <FinScreen contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.language')} onBack={onBack} />
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 6 }}>
        <FinSectionLabel>{tr('profil.lang_section')}</FinSectionLabel>
        <FinRowGroup>
          <LangRow
            first
            testID="lang-system"
            leading={<DeviceMobile size={20} color={t.color.ink} />}
            title={tr('profil.lang_system')}
            subtitle={deviceName}
            selected={pref === SYSTEM_PREF}
            onPress={() => choose(SYSTEM_PREF)}
          />
          {enabledLanguages().map((l) => (
            <LangRow
              key={l.code}
              testID={`lang-${l.code}`}
              leading={<LangFlag flag={l.flag} borderColor={t.color.line} />}
              title={l.nativeName}
              subtitle={languageSubtitle(l, lang)}
              selected={pref === l.code}
              onPress={() => choose(l.code)}
            />
          ))}
        </FinRowGroup>
        <Text style={{ marginHorizontal: 4, marginTop: 6, fontFamily: body, fontSize: 13, color: t.color.secondary }}>
          {tr('profil.lang_note')}
        </Text>
      </ScrollView>
    </FinScreen>
  );
}
