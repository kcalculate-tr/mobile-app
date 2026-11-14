// G45-S1 md.6 — Sağlık verisi açık rıza notu (L2 "Onayla ve planımı kaydet" ve B yolu "Onayla ve takibe başla"
// düğmesinin hemen üstünde). 13 pt, ikincil renk, ortalı; son iki kelime "Aydınlatma metni" bağlantısı → mevcut
// KVKK aydınlatma metni (uygulama içi belge, `ProfileContracts` + LEGAL_SLUG.kvkk; KVKK'nın web yolu yok).
// Rıza kaydı burada YAPILMAZ: düğmeye basılınca mevcut G27/G36 yapısına (recordHealthConsent) yazılır.
import React from 'react';
import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useT } from '../../../core/i18n';
import { LEGAL_SLUG } from '../../../lib/legal/slugs';
import { FONT, KText } from './parts';
import { useK } from './theme';

export function HealthConsentNote() {
  const { t } = useT();
  const P = useK();
  const navigation = useNavigation<any>();
  return (
    <KText testID="kayit-health-consent" maxFontSizeMultiplier={1.4} style={[styles.note, { color: P.sec }]}>
      {t('kayit.q.consent_note')}
      <KText
        testID="kayit-consent-link"
        accessibilityRole="link"
        onPress={() => navigation.navigate('ProfileContracts', { slug: LEGAL_SLUG.kvkk })}
        style={[styles.link, { color: P.ink }]}
      >
        {t('kayit.q.consent_link')}
      </KText>
    </KText>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8, marginBottom: 10 },
  link: { fontFamily: FONT.semi, textDecorationLine: 'underline' },
});
