/**
 * G20-S1 md.2 — Profil › Gizlilik › "Veri ve reklam izinleri".
 *
 * Tasarım yeni pano BEKLEMEZ: FinPrivacySettings (başlık sola, bölüm etiketi, düz
 * çizgili grup) + SettingsNotifyScreen anahtar satırı (başlık 15/600, alt 13,
 * sağda Switch, accentLine) + FinRow bağlantı satırları. Metinler: G19-S3
 * `metrics.consent.*` + G20-S1 `consent.settings.*`.
 *
 *  • Uygulama içi kullanım ölçümü aç/kapa → setFirstPartyConsent (+ user_consents)
 *  • Reklam ölçümü (Meta) aç/kapa → setAdConsent (+ user_consents). Yalnız uygulama
 *    içi tercih — G26-S1: iOS ATT kaldırıldı, Apple izleme sorusu gelmez.
 *  • G20-S3 md.2: Fotoğraf analizi (yapay zekâ) aç/kapa → ai_photo (+ user_consents).
 *    Kapalıyken Tara ilk çekimde izin sheet'ini yeniden gösterir; kuyruk gönderilmez.
 *  • Metinler: Kullanım Koşulları · Gizlilik Politikası · KVKK Aydınlatma Metni.
 */
import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { getConsent } from '../../../../lib/analytics';
import { metaAllowed } from '../../../../lib/metrics/consent';
import { onConsentChange, setAdMeasurement, setUsageMeasurement } from '../../../../lib/consent/store';
import { hasLocalAiPhotoConsent, setAiPhotoConsent } from '../../../../lib/consent/aiPhoto';
import { setCoachConsent, useCoachConsent, useCoachEnabled } from '../../../coach/access';
import { LegalDocModal, type LegalSlug } from '../../../onboarding/consent/LegalDocModal';
import { LEGAL_SLUG } from '../../../../lib/legal/slugs';
import { FileText } from '../../../../components/icons';
import { FinScreen, FinHeader, FinSectionLabel, FinRow, bodyMedium, bodySemibold } from '../finUi';

const flatGroup = (t: ReturnType<typeof useTheme>) => ({
  borderTopWidth: 1,
  borderBottomWidth: 1,
  borderColor: t.color.line,
  marginHorizontal: -16,
  paddingHorizontal: 2,
});

function ToggleRow({
  title,
  desc,
  value,
  onChange,
  disabled,
  first,
  testID,
}: {
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  first?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.color.line,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>{title}</Text>
        <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>{desc}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: t.color.line, true: t.color.accentLine }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={t.color.line}
        accessibilityLabel={title}
        testID={testID}
      />
    </View>
  );
}

const readState = () => {
  const c = getConsent();
  return {
    usage: c.firstParty,
    // G26-S1: yalnız uygulama içi rıza (ATT yok).
    ads: metaAllowed(c),
  };
};

export default function SettingsDataConsentScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const [state, setState] = useState(readState);
  const [saving, setSaving] = useState<'usage' | 'ads' | 'ai' | null>(null);
  const [error, setError] = useState(false);
  const [doc, setDoc] = useState<LegalSlug | null>(null);
  const [aiOn, setAiOn] = useState(false);
  // G24-S1: kcalAI Koç ayrı AI izni (yalnız koç açıkken satır görünür; kapatınca koç mesaj göndermeden önce yeniden sorar).
  const coachOn = useCoachEnabled();
  const [coachConsent, refreshCoach] = useCoachConsent();
  const toggleCoach = async (on: boolean) => {
    await setCoachConsent(on, 'settings');
    refreshCoach();
  };
  const refreshAi = () => {
    void hasLocalAiPhotoConsent()
      .then(setAiOn)
      .catch(() => {});
  };

  useEffect(() => onConsentChange(() => {
    setState(readState());
    refreshAi();
  }), []);
  useEffect(refreshAi, []);

  const toggleAi = async (on: boolean) => {
    if (saving) return;
    setSaving('ai');
    setError(false);
    setAiOn(on);
    try {
      await setAiPhotoConsent(on, 'settings');
    } catch {
      setError(true);
    } finally {
      setSaving(null);
      refreshAi();
    }
  };

  const toggleUsage = async (on: boolean) => {
    if (saving) return;
    setSaving('usage');
    setError(false);
    setState((s) => ({ ...s, usage: on }));
    try {
      await setUsageMeasurement(on);
    } catch {
      setError(true);
    } finally {
      setSaving(null);
      setState(readState());
    }
  };

  const toggleAds = async (on: boolean) => {
    if (saving) return;
    setSaving('ads');
    setError(false);
    setState((s) => ({ ...s, ads: on }));
    try {
      await setAdMeasurement(on);
    } catch {
      setError(true);
    } finally {
      setSaving(null);
      setState(readState());
    }
  };

  return (
    <FinScreen scroll contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('consent.settings.title')} onBack={onBack} align="left" />
      <View style={{ paddingHorizontal: 16, gap: 16 }} testID="settings-data-consent">
        <FinSectionLabel>{tr('consent.settings.measure_section')}</FinSectionLabel>
        <View style={flatGroup(t)}>
          <ToggleRow
            first
            title={tr('metrics.consent.analytics_label')}
            desc={tr('metrics.consent.analytics_desc')}
            value={state.usage}
            onChange={toggleUsage}
            disabled={saving === 'usage'}
            testID="consent-usage-switch"
          />
          <ToggleRow
            title={tr('metrics.consent.ads_label')}
            desc={tr('metrics.consent.ads_desc')}
            value={state.ads}
            onChange={toggleAds}
            disabled={saving === 'ads'}
            testID="consent-ads-switch"
          />
        </View>
        <FinSectionLabel>{tr('consent.settings.ai_section')}</FinSectionLabel>
        <View style={flatGroup(t)}>
          <ToggleRow
            first
            title={tr('consent.settings.ai_photo_label')}
            desc={tr('consent.settings.ai_photo_desc')}
            value={aiOn}
            onChange={toggleAi}
            disabled={saving === 'ai'}
            testID="consent-ai-photo-switch"
          />
          {coachOn ? (
            <ToggleRow
              title={tr('consent.settings.ai_coach_label')}
              desc={tr('consent.sheet.ai_coach_lead')}
              value={coachConsent}
              onChange={(v) => void toggleCoach(v)}
              testID="consent-ai-coach-switch"
            />
          ) : null}
        </View>
        {error ? (
          <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: '#E5484D', paddingHorizontal: 4 }} accessibilityLiveRegion="polite">
            {tr('consent.settings.error')}
          </Text>
        ) : null}

        <FinSectionLabel>{tr('consent.settings.docs_section')}</FinSectionLabel>
        <View style={flatGroup(t)}>
          <FinRow first icon={<FileText size={18} color={t.color.ink} />} label={tr('consent.block.terms')} onPress={() => setDoc(LEGAL_SLUG.terms)} />
          <FinRow icon={<FileText size={18} color={t.color.ink} />} label={tr('consent.block.privacy')} onPress={() => setDoc(LEGAL_SLUG.privacy)} />
          <FinRow icon={<FileText size={18} color={t.color.ink} />} label={tr('consent.block.kvkk')} onPress={() => setDoc(LEGAL_SLUG.kvkk)} />
        </View>

        <Text
          style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.secondary, textAlign: 'center', paddingHorizontal: 8 }}
        >
          {tr('consent.settings.footer')}
        </Text>
      </View>
      <LegalDocModal slug={doc} onClose={() => setDoc(null)} />
    </FinScreen>
  );
}
