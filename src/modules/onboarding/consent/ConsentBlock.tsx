// G20-S1 md.1 — Hesap oluşturma rıza bloğu (tek blok, "Devam" öncesi):
//   • Kullanım Koşulları + Gizlilik Politikası kabulü (bağlantılı, zorunlu — onay kutusu)
//   • KVKK Aydınlatma Metni (yalnız bilgilendirme bağlantısı)
//   • G41-S1 md.2: Meta paylaşımı İŞARETSİZ, isteğe bağlı onay kutusu (MetaConsentRow).
//     Eski "Reklam ölçümü (Meta)" anahtarı kalktı. iOS'ta kutu işaretlenince ATT sorulur
//     (yalnız burada, bir kez); reddedilirse kutu boş kalır ("verilmedi").
// Tasarım yeni pano BEKLEMEZ: FinOnbAccount alt yazı dili (helper, ikincil renk,
// altı çizili bağlantı) + FinPrivacySettings satır dili (başlık 15/600, alt 13,
// sağda anahtar) + Onb paleti. `accepted` verilmezse onay kutusu çizilmez.
// G20-S3 md.2b: Apple/Google'da da kabul ZORUNLU onay kutusuyla (PolicyAcceptRow).
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../core/design/components/AppText';
import { useT } from '../../../core/i18n';
import { useOnb } from '../components/onbTheme';
import { LegalDocModal, type LegalSlug } from './LegalDocModal';
import { LEGAL_SLUG } from '../../../lib/legal/slugs';
import { webDocForSlug } from '../../../lib/legal/urls';
import { openLegalWeb } from '../../../lib/legal/openLegal';
import { requestMetaOptIn } from '../../../lib/consent/metaConsent';

const CHECK_D =
  'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z';

/**
 * Koşullar + Gizlilik kabul satırı (onay kutusu, zorunlu). G20-S3 md.2b: Hesap
 * ekranında Apple/Google/e-posta düğmelerinin altında da AYNI kutu (işaretlenmeden
 * düğmeler pasif). `withAge` → metin 18+ beyanını da içerir (B-10; eski giriş
 * ekranındaki "18 yaşından büyüğüm ve … kabul ediyorum" diliyle aynı).
 */
export function PolicyAcceptRow({
  accepted,
  onAcceptedChange,
  showRequired,
  withAge,
  testID = 'consent-block',
}: {
  accepted: boolean;
  onAcceptedChange?: (v: boolean) => void;
  showRequired?: boolean;
  withAge?: boolean;
  testID?: string;
}) {
  const P = useOnb();
  const i18n = useT();
  const [doc, setDoc] = useState<LegalSlug | null>(null);
  const link = { color: P.ink, textDecorationLine: 'underline' as const, fontFamily: 'PlusJakartaSans_600SemiBold' };
  // G28-S1 md.7: Koşullar / Gizlilik legal.eatkcal.com'da açılır; açılamazsa uygulama içi metin.
  const open = (s: LegalSlug) => () => {
    const web = webDocForSlug(s);
    if (web) void openLegalWeb(web, i18n.lang, () => setDoc(s));
    else setDoc(s);
  };
  return (
    <>
      <Pressable
        onPress={() => onAcceptedChange?.(!accepted)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!accepted }}
        accessibilityLabel={i18n.t(withAge ? 'consent.block.accept_age_a11y' : 'consent.block.accept_a11y')}
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
          {i18n.t(withAge ? 'consent.block.accept_age_pre' : 'consent.block.accept_pre')}
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
      {showRequired && !accepted ? (
        <AppText textRole="helper" style={styles.err} accessibilityLiveRegion="polite">
          {i18n.t('consent.block.required')}
        </AppText>
      ) : null}
      <LegalDocModal slug={doc} onClose={() => setDoc(null)} />
    </>
  );
}

/**
 * G41-S1 md.2 — Meta paylaşım onayı: İŞARETSİZ gelir, kayıt kutusuz da tamamlanır.
 * İşaretlenince (iOS) ATT HEMEN sorulur — açılışta değil, yalnız bu eylemden sonra. İzin
 * verilmezse kutu boş kalır ve kısa bir not çıkar. Kaldırmak ATT sormaz.
 * `value`/`onChange` etkin değer: çağıran yalnız sonuç değerini saklar.
 */
export function MetaConsentRow({
  value,
  onChange,
  testID = 'meta-consent',
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  const P = useOnb();
  const i18n = useT();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const press = async () => {
    if (busy) return;
    if (value) {
      setDenied(false);
      onChange(false);
      return;
    }
    setBusy(true);
    try {
      const r = await requestMetaOptIn();
      setDenied(!r.granted);
      onChange(r.granted);
    } catch {
      onChange(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Pressable
        onPress={() => void press()}
        disabled={busy}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value, busy }}
        accessibilityLabel={i18n.t('consent.block.meta_label')}
        accessibilityHint={i18n.t('consent.block.meta_hint')}
        style={styles.acceptRow}
        testID={testID}
      >
        <View style={[styles.box, value ? { backgroundColor: P.ink, borderColor: P.ink } : { borderColor: P.line2 }]}>
          {busy ? (
            <ActivityIndicator size="small" color={P.sec} />
          ) : value ? (
            <Svg width={14} height={14} viewBox="0 0 256 256">
              <Path d={CHECK_D} fill={P.onInk} />
            </Svg>
          ) : null}
        </View>
        <AppText textRole="helper" style={[styles.flex, { color: P.ink }]}>
          {i18n.t('consent.block.meta_label')}
        </AppText>
      </Pressable>
      {denied && !value ? (
        <AppText textRole="helper" style={[styles.note, { color: P.sec }]} accessibilityLiveRegion="polite" testID={`${testID}-att-denied`}>
          {i18n.t('consent.block.meta_att_denied')}
        </AppText>
      ) : null}
    </>
  );
}

export function ConsentBlock({
  accepted,
  onAcceptedChange,
  adOn,
  onAdChange,
  showRequired,
  withAge,
  testID = 'consent-block',
}: {
  /** undefined → onay kutusu yok (kabul başka satırla). */
  accepted?: boolean;
  onAcceptedChange?: (v: boolean) => void;
  adOn: boolean;
  onAdChange: (v: boolean) => void;
  /** Kabul edilmeden "Devam"a basıldıysa uyarı satırı. */
  showRequired?: boolean;
  /** G20-S3: kabul metni 18+ beyanını da içerir (hesap oluşturma / giriş). */
  withAge?: boolean;
  testID?: string;
}) {
  const P = useOnb();
  const i18n = useT();
  const [doc, setDoc] = useState<LegalSlug | null>(null);
  const link = { color: P.ink, textDecorationLine: 'underline' as const, fontFamily: 'PlusJakartaSans_600SemiBold' };
  const open = (s: LegalSlug) => () => setDoc(s);
  const hasBox = accepted !== undefined;

  return (
    <View style={styles.wrap} testID={testID}>
      {hasBox ? (
        <PolicyAcceptRow
          accepted={!!accepted}
          onAcceptedChange={onAcceptedChange}
          showRequired={showRequired}
          withAge={withAge}
          testID={testID}
        />
      ) : null}

      <AppText textRole="helper" style={{ color: P.sec }}>
        {i18n.t('consent.block.kvkk_pre')}
        <AppText textRole="helper" style={link} onPress={open(LEGAL_SLUG.kvkk)} accessibilityRole="link" testID={`${testID}-kvkk`}>
          {i18n.t('consent.block.kvkk')}
        </AppText>
        {i18n.t('consent.block.kvkk_post')}
      </AppText>

      <View style={[styles.adRow, { borderColor: P.line }]}>
        <MetaConsentRow value={adOn} onChange={onAdChange} testID={`${testID}-ads`} />
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
  note: { marginLeft: 32, marginTop: -4 },
  adRow: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
