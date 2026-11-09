/**
 * G20-S1 md.2 — Profil › Gizlilik › "Veri ve reklam izinleri".
 *
 * Tasarım yeni pano BEKLEMEZ: FinPrivacySettings (başlık sola, bölüm etiketi, düz
 * çizgili grup) + SettingsNotifyScreen anahtar satırı (başlık 15/600, alt 13,
 * sağda Switch, accentLine) + FinRow bağlantı satırları. Metinler: G19-S3
 * `metrics.consent.*` + G20-S1 `consent.settings.*`.
 *
 *  • Uygulama içi kullanım ölçümü aç/kapa → setFirstPartyConsent (+ user_consents)
 *  • Reklam ölçümü (Meta) aç/kapa → setAdConsent (+ user_consents). iOS'ta açınca
 *    ATT henüz sorulmadıysa Apple sorusu gelir; ATT reddi = Meta kapalı (anahtar
 *    kapalı kalır, "iPhone Ayarları'nı aç" bağlantısı).
 *  • Metinler: Kullanım Koşulları · Gizlilik Politikası · KVKK Aydınlatma Metni.
 */
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Switch, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { getConsent, requestAttForAds } from '../../../../lib/analytics';
import { metaAllowed } from '../../../../lib/metrics/consent';
import { onConsentChange, setAdMeasurement, setUsageMeasurement } from '../../../../lib/consent/store';
import { LegalDocModal, type LegalSlug } from '../../../onboarding/consent/LegalDocModal';
import { LEGAL_SLUG } from '../../../../lib/legal/slugs';
import { FileText } from '../../../../components/icons';
import { FinScreen, FinHeader, FinSectionLabel, FinRow, body, bodyMedium, bodySemibold } from '../finUi';

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
    // Etkin durum: uygulama içi rıza + (iOS) ATT. ATT reddi = Meta kapalı.
    ads: c.adConsent !== 'denied' && (c.platform !== 'ios' || c.att !== 'denied' && c.att !== 'restricted'),
    attBlocked: c.platform === 'ios' && (c.att === 'denied' || c.att === 'restricted'),
    effective: metaAllowed(c),
  };
};

export default function SettingsDataConsentScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const [state, setState] = useState(readState);
  const [saving, setSaving] = useState<'usage' | 'ads' | null>(null);
  const [error, setError] = useState(false);
  const [doc, setDoc] = useState<LegalSlug | null>(null);

  useEffect(() => onConsentChange(() => setState(readState())), []);

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
      if (on && Platform.OS === 'ios') {
        const att = await requestAttForAds();
        if (att === 'denied' || att === 'restricted') {
          // ATT reddi = Meta kapalı: uygulama içi rıza da kapalı kaydedilir.
          await setAdMeasurement(false, 'att');
          return;
        }
      }
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
        {state.attBlocked ? (
          <View style={{ gap: 6, paddingHorizontal: 4 }} testID="consent-att-blocked">
            <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
              {tr('consent.settings.att_denied')}
            </Text>
            <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="link" hitSlop={8}>
              <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: t.color.ink, textDecorationLine: 'underline' }}>
                {tr('consent.settings.att_open')}
              </Text>
            </Pressable>
          </View>
        ) : null}
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
