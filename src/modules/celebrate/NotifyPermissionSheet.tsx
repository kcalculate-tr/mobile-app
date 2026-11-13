import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText, Sheet, haptic, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { requestPushPermission } from '../../core/push/pushPermission';
import { Bell } from '../../components/icons';
import { useOverlayGate } from '../onboarding/first/overlayGate';
import { setMarketingOptIn } from '../../lib/notify/marketing';

const CHECK_D =
  'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z';

/**
 * FinSheetNotify — ILK ogun kutlamasindan sonra teklif edilen bildirim izni
 * alttan sayfasi (G26-S1: tek aciklama ekrani). Yeni izin mantigi KURMAZ; yalniz
 * tek fonksiyonu (core/push/pushPermission requestPushPermission('first_meal'))
 * cagirir ve sonucu disari verir.
 * G20-S3 md.6 (B-11): pazarlama bildirimi AYRI onay kutusu (isaretsiz gelir);
 * yalniz izin verilip kutu isaretlenirse marketing_enabled acilir.
 * G41-S1 md.3: uygulama ici ON KART "Ogun saatinde hatirlatayim mi?" — "Evet" sistem
 * penceresini acar; "Simdi degil" / kaydirip kapatma pencereyi ACMAZ (onLater → 7 gun sonra
 * en fazla bir kez daha, HomeCelebrations).
 */
export function NotifyPermissionSheet({
  visible,
  onClose,
  onResult,
  onLater,
}: {
  visible: boolean;
  onClose: () => void;
  onResult?: (status: 'granted' | 'denied' | 'undetermined') => void;
  /** G41-S1: "Şimdi değil" ya da Evet'e basmadan kapatma — sistem penceresi açılmadı. */
  onLater?: () => void;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const [busy, setBusy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const later = () => {
    onLater?.();
    onClose();
  };
  useOverlayGate(visible); // G18-S1 temas: açıkken oryantasyon ipucu beklesin

  const onAllow = async () => {
    if (busy) return;
    setBusy(true);
    haptic('selection');
    try {
      const status = await requestPushPermission('first_meal');
      if (status === 'granted' && marketing) await setMarketingOptIn(true);
      onResult?.(status);
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Sheet visible={visible} onClose={later} maxHeightRatio={0.6}>
      <View style={styles.body} testID="notify-precard">
        {/* G15-S4 — FinSheetNotify: gri daire + çizgi zil, sola dayalı başlık. */}
        <View style={[styles.iconWrap, { backgroundColor: t.color.bg }]}>
          <Bell size={24} color={t.color.ink} />
        </View>

        <AppText variant="title" tone="ink" style={styles.title}>
          {tt('celebrate.notify_title')}
        </AppText>
        <AppText variant="body" tone="secondary" style={styles.sub}>
          {tt('celebrate.notify_body')}
        </AppText>

        <Pressable
          onPress={() => setMarketing((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: marketing }}
          accessibilityLabel={tt('consent.marketing.label')}
          style={styles.optRow}
          testID="notify-marketing-optin"
        >
          <View
            style={[
              styles.box,
              marketing ? { backgroundColor: t.color.ink, borderColor: t.color.ink } : { borderColor: t.color.line },
            ]}
          >
            {marketing ? (
              <Svg width={14} height={14} viewBox="0 0 256 256">
                <Path d={CHECK_D} fill={t.color.surface} />
              </Svg>
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="body" tone="ink">
              {tt('consent.marketing.label')}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {tt('consent.marketing.hint')}
            </AppText>
          </View>
        </Pressable>

        <Pressable
          onPress={onAllow}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={tt('celebrate.notify_allow')}
          testID="notify-precard-yes"
          style={[styles.primary, { backgroundColor: t.color.ink, opacity: busy ? 0.6 : 1 }]}
        >
          {/* G14-S1 — FinSheetNotify: birincil siyah, ikincil çerçeveli. */}
          <AppText variant="body" style={{ color: t.color.surface, fontWeight: '600' }}>
            {tt('celebrate.notify_allow')}
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => {
            haptic('selection');
            later();
          }}
          accessibilityRole="button"
          accessibilityLabel={tt('celebrate.notify_later')}
          testID="notify-precard-later"
          style={[styles.secondary, { borderColor: t.color.line }]}
        >
          <AppText variant="body" tone="ink" style={{ fontWeight: '600' }}>
            {tt('celebrate.notify_later')}
          </AppText>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'stretch', paddingTop: 8, paddingBottom: 8, gap: 12 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'left' },
  sub: { textAlign: 'left' },
  optRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 44, marginTop: 4 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  primary: {
    minHeight: 52,
    alignSelf: 'stretch',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondary: {
    minHeight: 52,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
});
