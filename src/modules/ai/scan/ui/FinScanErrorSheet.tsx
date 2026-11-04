/**
 * G12-S4 — Tara hata/çevrimdışı/limit alt sayfası (FinScanError paneli).
 *
 * `kind`'a göre tek sheet: analiz başarısız (hak iade edildi), çevrimdışı
 * (fotoğraf sırada bekliyor) veya günlük kota doldu. FinMoShake burada
 * TETİKLENMEZ — bu alan doğrulama hatası değil, ağ/limit/red durumu
 * (bkz. FinMoShake.dc.html: "Yalnız form alanı · ağ/limit/red: titreşim yok").
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { ClockCounterClockwise, Lock, WifiSlash, ArrowCounterClockwise } from '../../../../components/icons';
import { finExtras, FinPrimaryButton, FinSecondaryButton, body, bodyBold, bodySemibold } from '../../../profil/ui/finUi';

export type FinScanErrorKind = 'failed' | 'offline' | 'limit';

export default function FinScanErrorSheet({
  visible,
  kind,
  remaining,
  onClose,
  onManualEntry,
  onRetry,
}: {
  visible: boolean;
  kind: FinScanErrorKind;
  remaining: number;
  onClose: () => void;
  onManualEntry: () => void;
  onRetry?: () => void;
}) {
  const t = useTheme();
  const x = finExtras(t);
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();

  const icon =
    kind === 'failed' ? (
      <ArrowCounterClockwise size={26} color={t.color.ink} weight="bold" />
    ) : kind === 'offline' ? (
      <WifiSlash size={26} color={t.color.ink} weight="bold" />
    ) : (
      <ClockCounterClockwise size={26} color={t.color.ink} weight="bold" />
    );

  const title =
    kind === 'failed' ? tr('ai_scan.failed_title') : kind === 'offline' ? tr('ai_scan.offline_title') : tr('ai_scan.limit_title');
  const body_ =
    kind === 'failed' ? tr('ai_scan.failed_body') : kind === 'offline' ? tr('ai_scan.offline_body') : tr('ai_scan.limit_body');
  const note =
    kind === 'failed'
      ? tr('ai_scan.failed_note', { count: remaining })
      : kind === 'offline'
        ? tr('ai_scan.offline_note', { count: 1 })
        : tr('ai_scan.quota_chip', { count: remaining });
  const chip = kind === 'failed' ? tr('ai_scan.photo_saved') : kind === 'offline' ? tr('ai_scan.offline_chip') : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: t.color.bg, paddingBottom: Math.max(34, insets.bottom + 16) },
          ]}
        >
          <View style={styles.topRow}>
            <View style={[styles.iconCircle, { backgroundColor: t.color.surface }]}>{icon}</View>
            {chip ? (
              <View style={[styles.chip, { backgroundColor: x.nested }]}>
                <Text style={{ fontFamily: bodySemibold, fontSize: 12, color: t.color.secondary }}>{chip}</Text>
              </View>
            ) : null}
          </View>

          <Text style={{ marginTop: 14, fontFamily: bodyBold, fontSize: 22, color: t.color.ink }}>{title}</Text>
          <Text style={{ marginTop: 6, fontFamily: body, fontSize: 15, color: t.color.secondary, lineHeight: 20 }}>
            {body_}
          </Text>

          {kind === 'failed' ? (
            <FinPrimaryButton label={tr('ai_scan.failed_retry')} onPress={onRetry} style={{ marginTop: 18 }} />
          ) : kind === 'offline' ? (
            <FinPrimaryButton label={tr('ai_scan.offline_ok')} onPress={onClose} style={{ marginTop: 18 }} />
          ) : (
            <FinPrimaryButton label={tr('ai_scan.manual_entry')} onPress={onManualEntry} style={{ marginTop: 18 }} />
          )}

          {kind === 'limit' ? (
            <View style={{ marginTop: 10, opacity: 0.45 }}>
              <FinSecondaryButton label={tr('ai_scan.pro_soon')} icon={<Lock size={18} color={t.color.ink} />} height={52} />
            </View>
          ) : (
            <View style={{ marginTop: 10 }}>
              <FinSecondaryButton label={tr('ai_scan.manual_entry')} onPress={onManualEntry} height={52} />
            </View>
          )}

          <Text style={{ marginTop: 14, fontFamily: body, fontSize: 12, color: t.color.secondary, textAlign: 'center' }}>
            {note}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,10,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 24, paddingHorizontal: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
});
