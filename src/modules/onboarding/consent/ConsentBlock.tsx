// G20-S1 md.1 — Hesap oluşturma rıza bloğu (tek blok, "Devam" öncesi):
//   • Kullanım Koşulları + Gizlilik Politikası kabulü (bağlantılı, zorunlu — onay kutusu)
//   • KVKK Aydınlatma Metni (yalnız bilgilendirme bağlantısı)
//   • "Reklam ölçümü (Meta)" anahtarı — AÇIK gelir, kapatılabilir (İlter kararı 9 Kas)
// Tasarım yeni pano BEKLEMEZ: FinOnbAccount alt yazı dili (helper, ikincil renk,
// altı çizili bağlantı) + FinPrivacySettings satır dili (başlık 15/600, alt 13,
// sağda anahtar) + Onb paleti. `accepted` verilmezse onay kutusu çizilmez
// (Apple/Google ayrıntı sheet'i: kabul "Devam ederek …" satırıyla).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../core/design/components/AppText';
import { useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useOnb } from '../components/onbTheme';
import { LegalDocModal, type LegalSlug } from './LegalDocModal';
import { LEGAL_SLUG } from '../../../lib/legal/slugs';

const CHECK_D =
  'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z';

export function ConsentBlock({
  accepted,
  onAcceptedChange,
  adOn,
  onAdChange,
  showRequired,
  testID = 'consent-block',
}: {
  /** undefined → onay kutusu yok (kabul başka satırla). */
  accepted?: boolean;
  onAcceptedChange?: (v: boolean) => void;
  adOn: boolean;
  onAdChange: (v: boolean) => void;
  /** Kabul edilmeden "Devam"a basıldıysa uyarı satırı. */
  showRequired?: boolean;
  testID?: string;
}) {
  const P = useOnb();
  const t = useTheme();
  const i18n = useT();
  const [doc, setDoc] = useState<LegalSlug | null>(null);
  const link = { color: P.ink, textDecorationLine: 'underline' as const, fontFamily: 'PlusJakartaSans_600SemiBold' };
  const open = (s: LegalSlug) => () => setDoc(s);
  const hasBox = accepted !== undefined;

  return (
    <View style={styles.wrap} testID={testID}>
      {hasBox ? (
        <Pressable
          onPress={() => onAcceptedChange?.(!accepted)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!accepted }}
          accessibilityLabel={i18n.t('consent.block.accept_a11y')}
          style={styles.acceptRow}
          testID={`${testID}-accept`}
        >
          <View
            style={[
              styles.box,
              accepted
                ? { backgroundColor: P.ink, borderColor: P.ink }
                : { borderColor: showRequired ? '#E5484D' : P.line2 },
            ]}
          >
            {accepted ? (
              <Svg width={14} height={14} viewBox="0 0 256 256">
                <Path d={CHECK_D} fill={P.onInk} />
              </Svg>
            ) : null}
          </View>
          <AppText textRole="helper" style={[styles.flex, { color: P.ink }]}>
            {i18n.t('consent.block.accept_pre')}
            <AppText textRole="helper" style={link} onPress={open(LEGAL_SLUG.terms)} accessibilityRole="link" testID={`${testID}-terms`}>
              {i18n.t('consent.block.terms')}
            </AppText>
            {i18n.t('consent.block.accept_mid')}
            <AppText textRole="helper" style={link} onPress={open(LEGAL_SLUG.privacy)} accessibilityRole="link" testID={`${testID}-privacy`}>
              {i18n.t('consent.block.privacy')}
            </AppText>
            {i18n.t('consent.block.accept_post')}
          </AppText>
        </Pressable>
      ) : null}
      {hasBox && showRequired && !accepted ? (
        <AppText textRole="helper" style={styles.err} accessibilityLiveRegion="polite">
          {i18n.t('consent.block.required')}
        </AppText>
      ) : null}

      <AppText textRole="helper" style={{ color: P.sec }}>
        {i18n.t('consent.block.kvkk_pre')}
        <AppText textRole="helper" style={link} onPress={open(LEGAL_SLUG.kvkk)} accessibilityRole="link" testID={`${testID}-kvkk`}>
          {i18n.t('consent.block.kvkk')}
        </AppText>
        {i18n.t('consent.block.kvkk_post')}
      </AppText>

      <View style={[styles.adRow, { borderColor: P.line }]}>
        <View style={styles.flex}>
          <AppText style={[styles.adTitle, { color: P.ink }]}>{i18n.t('consent.block.ads_label')}</AppText>
          <AppText textRole="helper" style={{ color: P.sec }}>
            {i18n.t('consent.block.ads_desc')}
          </AppText>
        </View>
        <Switch
          value={adOn}
          onValueChange={onAdChange}
          trackColor={{ false: P.line2, true: t.color.accentLine }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={P.line2}
          accessibilityLabel={i18n.t('consent.block.ads_label')}
          testID={`${testID}-ads`}
        />
      </View>
      <LegalDocModal slug={doc} onClose={() => setDoc(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1 },
  acceptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 44 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  err: { color: '#E5484D', marginTop: -6 },
  adRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  adTitle: { fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
