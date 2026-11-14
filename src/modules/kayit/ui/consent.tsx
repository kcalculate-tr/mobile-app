// G45-S1 md.6 — Sağlık verisi açık rıza notu (L2 "Onayla ve planımı kaydet" ve B yolu "Onayla ve takibe başla").
// Son iki kelime "Aydınlatma metni" bağlantı → mevcut KVKK aydınlatma metni (uygulama içi belge, `ProfileContracts` +
// LEGAL_SLUG.kvkk; KVKK'nın web yolu yok). Rıza kaydı burada YAPILMAZ: düğmeye basılınca mevcut G27/G36 yapısına
// (recordHealthConsent) yazılır.
// G47-S1 md.6: not düğmenin ALTINDA (düğme önce). 11 pt, ikincil renk, ortalı, sıkı satır aralığı (14 pt), hedef en çok
// 2 satır; bağlantı aynı satırın sonunda küçük alt çizgili (bölünmez boşluk → iki kelime ayrı satırlara düşmez).
// Düğme ile metin arası 8 pt (`marginTop`), altında güvenli alan (çağıran kap). Metin içeriği G45 ile AYNI.
import React from 'react';
import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useT } from '../../../core/i18n';
import { LEGAL_SLUG } from '../../../lib/legal/slugs';
import { FONT, KText } from './parts';
import { useK } from './theme';

export const CONSENT_NOTE = { size: 11, lineHeight: 14, gap: 8, maxLines: 2 } as const;

export function HealthConsentNote() {
  const { t } = useT();
  const P = useK();
  const navigation = useNavigation<any>();
  return (
    <KText testID="kayit-health-consent" maxFontSizeMultiplier={1.3} style={[styles.note, { color: P.sec }]}>
      {t('kayit.q.consent_note')}
      <KText
        testID="kayit-consent-link"
        accessibilityRole="link"
        onPress={() => navigation.navigate('ProfileContracts', { slug: LEGAL_SLUG.kvkk })}
        style={[styles.link, { color: P.sec }]}
      >
        {t('kayit.q.consent_link').replace(/ /g, ' ')}
      </KText>
    </KText>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: FONT.body, fontSize: CONSENT_NOTE.size, lineHeight: CONSENT_NOTE.lineHeight, letterSpacing: -0.1, textAlign: 'center', marginTop: CONSENT_NOTE.gap },
  link: { fontFamily: FONT.semi, fontSize: CONSENT_NOTE.size, lineHeight: CONSENT_NOTE.lineHeight, textDecorationLine: 'underline' },
});
