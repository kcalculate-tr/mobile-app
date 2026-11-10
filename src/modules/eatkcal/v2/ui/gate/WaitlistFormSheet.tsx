// eatkcal v2 (G18-S3 md.1) — FinWaitlistAdd / FinWaitlistSuggest form sheet'i.
// Sheet: üstten 64, köşe 28, sağda 44'lük X (gezinme kuralı: sheet yalnız sağ X);
// başlık 24 Bricolage + alt metin; alanlar 13/600 etiket + 52 yükseklik 16 köşe;
// altta sabit yardım satırı + "Başvuruyu gönder" / "Öneriyi gönder" (zorunlular
// dolmadan pasif). Gönderince "Başvurunu aldık" durumu (200 ms). Hareket: sheet
// 500 ms eatkcal eğrisi, scrim 300 standard; azaltılmış 200 ms opaklık.
// Gönderim hiçbir durumda hata göstermez (bkz. waitlistSend — kuyruk).
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { DURATION, RN_CURVE, fontFamily, haptic, useReducedMotion } from '../../../../../core/design';
import { Check, X } from '../../../../../components/icons';
import { useSheetKeyboard, SCROLL_KEYBOARD } from '../../../../../core/design/keyboard';
import { ekType, useEk } from '../kit';
import { isDraftComplete, type WaitlistDraft, type WaitlistKind } from '../../model/waitlist';
import { submitWaitlist } from './waitlistSend';

const EAT_EASE = RN_CURVE.eat;
const STD_EASE = RN_CURVE.standard;

type FieldKey = 'restaurant_name' | 'city' | 'contact_name' | 'phone' | 'email' | 'website' | 'district' | 'reason';

interface FieldDef {
  key: FieldKey;
  label: string;
  ph: string;
  req: boolean;
  keyboard?: KeyboardTypeOptions;
  auto?: TextInputProps['autoComplete'];
  content?: TextInputProps['textContentType'];
  caps?: TextInputProps['autoCapitalize'];
  multiline?: boolean;
}

export function WaitlistFormSheet({
  kind,
  visible,
  city,
  country,
  onClose,
  onPrivacy,
  onSent,
}: {
  kind: WaitlistKind;
  visible: boolean;
  /** Seçilen il (alan önceden dolu, düzenlenebilir). */
  city: string;
  /** 'TR', ISO-3166 alfa-2 ülke kodu (G22-S2: Avrupa/Amerika) ya da 'OTHER' (şehirsiz eski yol). */
  country: string;
  onClose: () => void;
  onPrivacy: () => void;
  onSent?: () => void;
}) {
  const { c, t, lang, insets, theme } = useEk();
  const kb = useSheetKeyboard(visible);
  const reduced = useReducedMotion();
  const isAdd = kind === 'restaurant_add';
  const empty = (): WaitlistDraft => ({ kind, country, city, restaurant_name: '', lang: lang === 'en' ? 'en' : 'tr' });
  const [v, setV] = useState<WaitlistDraft>(empty);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const slide = useRef(new Animated.Value(0)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const doneO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setV(empty());
    setSent(false);
    slide.setValue(0);
    scrim.setValue(0);
    Animated.parallel([
      Animated.timing(slide, { toValue: 1, duration: reduced ? DURATION.fast : DURATION.slow, easing: reduced ? RN_CURVE.linear : EAT_EASE, useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 1, duration: reduced ? DURATION.fast : DURATION.base, easing: reduced ? RN_CURVE.linear : STD_EASE, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => {
    haptic('selection');
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: DURATION.fast, easing: reduced ? RN_CURVE.linear : RN_CURVE.exit, useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 0, duration: DURATION.fast, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const fields: FieldDef[] = isAdd
    ? [
        { key: 'restaurant_name', label: t('eatkcal.v2.gate.f_name'), ph: t('eatkcal.v2.gate.f_name_ph_add'), req: true, auto: 'off', caps: 'words' },
        { key: 'city', label: t('eatkcal.v2.gate.f_city'), ph: t('eatkcal.v2.gate.f_city'), req: true, caps: 'words' },
        { key: 'contact_name', label: t('eatkcal.v2.gate.f_person'), ph: t('eatkcal.v2.gate.f_person_ph'), req: true, auto: 'name', content: 'name', caps: 'words' },
        { key: 'phone', label: t('eatkcal.v2.gate.f_phone'), ph: t('eatkcal.v2.gate.f_phone_ph'), req: true, keyboard: 'phone-pad', auto: 'tel', content: 'telephoneNumber' },
        { key: 'email', label: t('eatkcal.v2.gate.f_email'), ph: t('eatkcal.v2.gate.f_email_ph'), req: true, keyboard: 'email-address', auto: 'email', content: 'emailAddress', caps: 'none' },
        { key: 'website', label: t('eatkcal.v2.gate.f_web'), ph: t('eatkcal.v2.gate.f_web_ph'), req: false, keyboard: 'url', auto: 'off', caps: 'none' },
      ]
    : [
        { key: 'restaurant_name', label: t('eatkcal.v2.gate.f_name'), ph: t('eatkcal.v2.gate.f_name_ph_sug'), req: true, auto: 'off', caps: 'words' },
        { key: 'city', label: t('eatkcal.v2.gate.f_city'), ph: t('eatkcal.v2.gate.f_city'), req: true, caps: 'words' },
        { key: 'district', label: t('eatkcal.v2.gate.f_area'), ph: t('eatkcal.v2.gate.f_area_ph'), req: false, caps: 'words' },
        { key: 'email', label: t('eatkcal.v2.gate.f_notify_email'), ph: t('eatkcal.v2.gate.f_email_ph'), req: false, keyboard: 'email-address', auto: 'email', content: 'emailAddress', caps: 'none' },
        { key: 'reason', label: t('eatkcal.v2.gate.f_why'), ph: t('eatkcal.v2.gate.f_why_ph'), req: false, multiline: true },
      ];

  const ok = isDraftComplete(v);
  const field = theme.isDark ? '#2C2C2E' : '#F3F4F6';
  const sheetBg = theme.isDark ? '#1C1C1E' : '#FFFFFF';
  const nested = theme.isDark ? '#2C2C2E' : '#F3F4F6';
  const disBg = theme.isDark ? '#2C2C2E' : '#DCDEE2';
  const disFg = theme.isDark ? '#8E8E93' : '#6B6B70';

  const send = async () => {
    if (!ok || sending) return;
    setSending(true);
    haptic('success');
    try {
      await submitWaitlist(v);
    } finally {
      setSending(false);
      setSent(true);
      doneO.setValue(0);
      Animated.timing(doneO, { toValue: 1, duration: DURATION.fast, easing: reduced ? RN_CURVE.linear : STD_EASE, useNativeDriver: true }).start();
      onSent?.();
    }
  };

  const sheetStyle = reduced
    ? { opacity: slide }
    : { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [900, 0] }) }] };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(10,10,10,0.32)', opacity: scrim }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityElementsHidden importantForAccessibility="no" />
      </Animated.View>
      {/* G21-S1 md.10: sheet üstten+alttan sabitli (absolute); KAV padding'i mutlak
          çocuğu KALDIRMIYORDU (Yoga). Ortak kanca: alt kenar = klavye yüksekliği →
          kaydırma alanı + "Gönder" klavyenin üstünde. */}
      <View style={styles.kav} pointerEvents="box-none" onLayout={kb.onLayout} testID="ek-waitlist-root">
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: sheetBg, top: isAdd ? Math.max(64, insets.top + 5) : Math.max(120, insets.top + 61), bottom: kb.lift }, sheetStyle]}
          testID={isAdd ? 'ek-waitlist-add' : 'ek-waitlist-suggest'}
        >
          <View style={styles.header}>
            <View style={styles.headText}>
              <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header">
                {isAdd ? t('eatkcal.v2.gate.add_restaurant') : t('eatkcal.v2.gate.suggest')}
              </Text>
              <Text style={[ekType.b15, { color: c.secondary }]}>
                {isAdd ? t('eatkcal.v2.gate.add_sheet_sub') : t('eatkcal.v2.gate.sug_sheet_sub')}
              </Text>
            </View>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={t('eatkcal.v2.gate.form_close')}
              style={[styles.close, { backgroundColor: nested }]}
              testID="ek-waitlist-close"
            >
              <X size={18} color={c.ink} />
            </Pressable>
          </View>

          {sent ? (
            <Animated.View style={[styles.done, { opacity: doneO, paddingBottom: Math.max(insets.bottom, 34) }]} accessibilityLiveRegion="polite" testID="ek-waitlist-done">
              <View style={styles.doneIcon}>
                <Check size={28} color="#0A0A0A" weight="bold" />
              </View>
              <Text style={[styles.doneT, { color: c.ink }]}>{isAdd ? t('eatkcal.v2.gate.add_done_t') : t('eatkcal.v2.gate.sug_done_t')}</Text>
              <Text style={[ekType.b15, { color: c.secondary, textAlign: 'center', maxWidth: 300 }]}>
                {isAdd ? t('eatkcal.v2.gate.add_done_b') : t('eatkcal.v2.gate.sug_done_b')}
              </Text>
            </Animated.View>
          ) : (
            <>
              <ScrollView {...SCROLL_KEYBOARD} style={styles.fill} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                {fields.map((f) => (
                  <View key={f.key} style={styles.fieldWrap}>
                    <Text style={[ekType.c13s, { color: c.secondary }]}>
                      {f.label}
                      {f.req ? null : <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.gate.form_opt')}</Text>}
                    </Text>
                    <TextInput
                      value={(v[f.key] as string | undefined) ?? ''}
                      onChangeText={(x) => setV((p) => ({ ...p, [f.key]: x }))}
                      placeholder={f.ph}
                      placeholderTextColor={c.secondary}
                      keyboardType={f.keyboard}
                      autoComplete={f.auto}
                      textContentType={f.content}
                      autoCapitalize={f.caps ?? 'sentences'}
                      autoCorrect={false}
                      multiline={f.multiline}
                      returnKeyType="done"
                      submitBehavior={f.multiline ? 'blurAndSubmit' : undefined}
                      accessibilityLabel={f.label}
                      accessibilityHint={f.req ? undefined : t('eatkcal.v2.gate.form_opt').trim()}
                      style={[
                        f.multiline ? styles.textarea : styles.input,
                        { backgroundColor: field, color: c.ink },
                      ]}
                      testID={`ek-waitlist-${f.key}`}
                    />
                  </View>
                ))}
                {isAdd ? (
                  <Text style={[ekType.c13, { color: c.secondary }]}>
                    {`${t('eatkcal.v2.gate.privacy')} `}
                    <Text style={[ekType.c13s, { color: c.ink }]} onPress={onPrivacy} accessibilityRole="link" suppressHighlighting>
                      {t('eatkcal.v2.gate.privacy_link')}
                    </Text>
                  </Text>
                ) : null}
              </ScrollView>
              <View style={[styles.footer, { borderTopColor: c.line, paddingBottom: kb.lift > 0 ? 12 : Math.max(insets.bottom, 34) }]}>
                {!ok ? (
                  <Text style={[styles.help, { color: c.secondary }]} testID="ek-waitlist-help">
                    {isAdd ? t('eatkcal.v2.gate.add_help') : t('eatkcal.v2.gate.sug_help')}
                  </Text>
                ) : null}
                <Pressable
                  onPress={send}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !ok, busy: sending }}
                  style={[styles.cta, { backgroundColor: ok ? c.ink : disBg }]}
                  testID="ek-waitlist-send"
                >
                  <Text style={[styles.ctaText, { color: ok ? c.surface : disFg }]}>
                    {isAdd ? t('eatkcal.v2.gate.add_send') : t('eatkcal.v2.gate.sug_send')}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  kav: { flex: 1 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  header: { paddingTop: 20, paddingRight: 8, paddingBottom: 8, paddingLeft: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headText: { flex: 1, gap: 4, paddingTop: 6 },
  title: { fontFamily: fontFamily.headingBold, fontSize: 24, lineHeight: 29 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  fieldWrap: { gap: 6 },
  input: { height: 52, paddingHorizontal: 14, borderRadius: 16, fontFamily: ekType.b15.fontFamily, fontSize: 16 },
  textarea: { minHeight: 96, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, borderRadius: 16, fontFamily: ekType.b15.fontFamily, fontSize: 16, lineHeight: 22, textAlignVertical: 'top' },
  footer: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, gap: 6 },
  help: { textAlign: 'center', fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 18 },
  cta: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fontFamily.bodySemibold, fontSize: 16, lineHeight: 21 },
  done: { flex: 1, paddingTop: 40, paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#C6F04F', alignItems: 'center', justifyContent: 'center' },
  doneT: { marginTop: 6, fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 27, textAlign: 'center' },
});
