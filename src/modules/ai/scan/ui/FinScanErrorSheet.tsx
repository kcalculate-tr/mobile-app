/**
 * G12-S4 / G15-S2 — Tara hata/çevrimdışı/limit/kamera izni sayfası
 * (FinScanError, FinErrFailed, FinErrOffline, FinErrLimit).
 *
 * Final düzeni (G15-S2): tam ekran — zemin çekilen foto (varsa) ya da kamera
 * alanı; sol üstte kapat (44), sağ üstte durum hapı ("Fotoğrafın saklandı" ·
 * "Çevrimdışı" · "Bugün 0/3 tarama hakkın kaldı"); altta beyaz sheet: 52'lik
 * ikon dairesi, Bricolage başlık, açıklama, tikli not hapı (butonlardan önce),
 * birincil siyah + ikincil çerçeveli düğmeler.
 *
 * `camera` (G15-S2): "Kameraya erişim kapalı" AYRI durum — Ayarlar'ı aç +
 * Galeriden seç / Elle gir (yan yana).
 *
 * FinMoShake burada TETİKLENMEZ — doğrulama hatası değil, ağ/limit/red durumu.
 */
import React from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { CameraSlash, Check, Clock, MagnifyingGlass, WarningCircle, WifiSlash, X } from '../../../../components/icons';
import { SCAN_QUOTA_CAP } from './ScanQuotaChip';

// G19-S1: 'unavailable' = Tara geçici kapalı (acil anahtar / genel tavan; İlter 9 Kas).
// G20-S1 md.4: FinErrLimit kartı diliyle — kamera alanı zemini, üstte durum hapı,
// saat ikonu, başlık + gövde, birincil "Elle gir" + ikincil çerçeveli (metin farklı).
// G21-S1 md.2: barkod → Open Food Facts durumları (aynı FinScanError düzeni):
//   barcode_missing / barcode_nokcal → "Ürün bulunamadı" + [Fotoğrafla tara] [Elle ekle]
//   barcode_error (zaman aşımı / ağ / 5xx) → [Tekrar dene] [Elle ekle]
//   barcode_offline → mevcut çevrimdışı hâli (ikon/hap/başlık) + barkod metni.
export type FinScanErrorKind =
  | 'failed'
  | 'offline'
  | 'limit'
  | 'camera'
  | 'unavailable'
  | 'barcode_missing'
  | 'barcode_nokcal'
  | 'barcode_error'
  | 'barcode_offline';

function tokens(isDark: boolean) {
  return isDark
    ? { sheet: '#1C1C1E', nested: '#2C2C2E', photo: '#2C2C2E', camOff: '#2C2C2E', glass: 'rgba(28,28,30,0.72)', line: '#48484A' }
    : { sheet: '#FFFFFF', nested: '#F3F4F6', photo: '#D3D6DA', camOff: '#48484C', glass: 'rgba(255,255,255,0.86)', line: '#C3C7CC' };
}

function Btn({
  label,
  onPress,
  primary,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  primary?: boolean;
  disabled?: boolean;
  style?: object;
}) {
  const t = useTheme();
  const k = tokens(t.isDark);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.btn,
        primary ? { backgroundColor: t.color.ink } : { borderWidth: 1, borderColor: k.line },
        disabled ? { opacity: 0.45 } : null,
        style,
      ]}
    >
      <AppText style={[styles.btnText, { color: primary ? t.color.bg : t.color.ink }]} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function FinScanErrorSheet({
  visible,
  kind,
  remaining,
  pendingCount = 1,
  photoUri,
  onClose,
  onManualEntry,
  onRetry,
  onOpenSettings,
  onGallery,
  onPhotoScan,
  barcode,
  reason,
  limitCap,
}: {
  /** G22-S1: kademeli günlük AI tavanı (sunucudan). Yoksa eski G19 metni/tavanı. */
  limitCap?: number | null;
  /** G21-S1 md.2: barkod durumlarında "Fotoğrafla tara" (foto moduna döner). */
  onPhotoScan?: () => void;
  /** G21-S1 md.2: okunan barkod — durum hapında gösterilir. */
  barcode?: string | null;
  /** G19-S1 md.4: 'failed' alt nedeni — dosya 5 MB üstü / bulunamadı (hak harcanmadı). */
  reason?: 'too_large' | 'missing';
  visible: boolean;
  kind: FinScanErrorKind;
  remaining: number;
  /** Çevrimdışı kuyruktaki fotoğraf sayısı (G16-S1). */
  pendingCount?: number;
  /** Çekilen foto (failed/offline) — zemin. */
  photoUri?: string | null;
  onClose: () => void;
  onManualEntry: () => void;
  onRetry?: () => void;
  onOpenSettings?: () => void;
  onGallery?: () => void;
}) {
  const t = useTheme();
  const k = tokens(t.isDark);
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();

  const iconColor = t.color.ink;
  const isBarcode = kind.startsWith('barcode_');
  const icon =
    kind === 'barcode_missing' || kind === 'barcode_nokcal' ? (
      <MagnifyingGlass size={24} color={iconColor} />
    ) : kind === 'barcode_error' ? (
      <WarningCircle size={24} color={iconColor} />
    ) : kind === 'barcode_offline' ? (
      <WifiSlash size={24} color={iconColor} />
    ) : kind === 'failed' ? (
      <WarningCircle size={24} color={iconColor} />
    ) : kind === 'offline' ? (
      <WifiSlash size={24} color={iconColor} />
    ) : kind === 'camera' ? (
      <CameraSlash size={24} color={iconColor} />
    ) : kind === 'unavailable' ? (
      // G20-S1 md.4: FinErrLimit kartı dili — geçici durum = saat ikonu (limit ile aynı).
      <Clock size={24} color={iconColor} />
    ) : (
      <Clock size={24} color={iconColor} />
    );

  const title =
    kind === 'barcode_missing' || kind === 'barcode_nokcal'
      ? tr('ai_scan.barcode_missing_title')
      : kind === 'barcode_error'
        ? tr('ai_scan.barcode_error_title')
        : kind === 'barcode_offline'
          ? tr('ai_scan.offline_title')
          : kind === 'failed'
      ? tr('ai_scan.failed_title')
      : kind === 'offline'
        ? tr('ai_scan.offline_title')
        : kind === 'camera'
          ? tr('ai_scan.camera_denied_title')
          : kind === 'unavailable'
            ? tr('ai_scan.unavailable_title')
            : limitCap != null
              ? tr('sub.limit.ai_title', { n: limitCap })
              : tr('ai_scan.limit_title');
  const body =
    kind === 'barcode_missing'
      ? tr('ai_scan.barcode_missing_body')
      : kind === 'barcode_nokcal'
        ? tr('ai_scan.barcode_nokcal_body')
        : kind === 'barcode_error'
          ? tr('ai_scan.barcode_error_body')
          : kind === 'barcode_offline'
            ? tr('ai_scan.barcode_offline_body')
            : kind === 'failed'
      ? reason === 'too_large'
        ? tr('ai_scan.failed_body_large')
        : reason === 'missing'
          ? tr('ai_scan.failed_body_missing')
          : tr('ai_scan.failed_body')
      : kind === 'offline'
        ? tr('ai_scan.offline_body')
        : kind === 'camera'
          ? tr('ai_scan.camera_denied_body')
          : kind === 'unavailable'
            ? tr('ai_scan.unavailable_body')
            : tr('ai_scan.limit_body');
  const note =
    kind === 'failed'
      ? tr('ai_scan.failed_note', { count: remaining })
      : kind === 'offline'
        ? tr('ai_scan.offline_note', { count: pendingCount })
        : null;
  const topChip =
    kind === 'barcode_offline'
      ? tr('ai_scan.offline_chip')
      : isBarcode
        ? barcode
          ? tr('ai_scan.barcode_read', { code: barcode })
          : null
        : kind === 'failed'
      ? reason
        ? null
        : tr('ai_scan.photo_saved')
      : kind === 'offline'
        ? tr('ai_scan.offline_chip')
        : kind === 'limit'
          ? tr('ai_scan.quota_left_of', { count: remaining, cap: limitCap ?? SCAN_QUOTA_CAP })
          : kind === 'unavailable'
            ? tr('ai_scan.unavailable_chip')
            : null;
  const bg = photoUri && (kind === 'failed' || kind === 'offline') ? null : kind === 'failed' || kind === 'offline' ? k.photo : k.camOff;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.fill, bg ? { backgroundColor: bg } : null]}>
        {!bg && photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}

        <View style={[styles.top, { top: insets.top + 6 }]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={tr('common.close')}
            style={[styles.close, { backgroundColor: k.glass }]}
          >
            <X size={20} color={t.color.ink} />
          </Pressable>
          {topChip ? (
            <View style={[styles.topChip, { backgroundColor: k.glass }]}>
              <AppText style={styles.topChipText} numberOfLines={1}>
                {topChip}
              </AppText>
            </View>
          ) : null}
        </View>

        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: k.sheet, paddingBottom: Math.max(24, insets.bottom + 8) }]}
        >
          <View style={[styles.iconCircle, { backgroundColor: k.nested }]}>{icon}</View>
          <AppText textRole="screenTitle" style={styles.title} accessibilityRole="header">
            {title}
          </AppText>
          <AppText tone="secondary" style={styles.body}>
            {body}
          </AppText>

          {note ? (
            <View style={[styles.note, { backgroundColor: k.nested }]}>
              <Check size={14} color={t.color.ink} weight="bold" />
              <AppText style={styles.noteText}>{note}</AppText>
            </View>
          ) : null}

          {kind === 'barcode_missing' || kind === 'barcode_nokcal' ? (
            <>
              <Btn primary label={tr('ai_scan.barcode_photo_scan')} onPress={onPhotoScan} style={styles.first} />
              <Btn label={tr('ai_scan.barcode_manual')} onPress={onManualEntry} style={styles.next} />
            </>
          ) : kind === 'barcode_error' ? (
            <>
              <Btn primary label={tr('ai_scan.failed_retry')} onPress={onRetry} style={styles.first} />
              <Btn label={tr('ai_scan.barcode_manual')} onPress={onManualEntry} style={styles.next} />
            </>
          ) : kind === 'barcode_offline' ? (
            <>
              <Btn primary label={tr('ai_scan.offline_ok')} onPress={onClose} style={styles.first} />
              <Btn label={tr('ai_scan.barcode_manual')} onPress={onManualEntry} style={styles.next} />
            </>
          ) : kind === 'failed' ? (
            <>
              <Btn primary label={reason ? tr('ai_scan.retake') : tr('ai_scan.failed_retry')} onPress={onRetry} style={styles.first} />
              <Btn label={tr('ai_scan.manual_entry')} onPress={onManualEntry} style={styles.next} />
            </>
          ) : kind === 'offline' ? (
            <>
              <Btn primary label={tr('ai_scan.offline_ok')} onPress={onClose} style={styles.first} />
              <Btn label={tr('ai_scan.manual_entry')} onPress={onManualEntry} style={styles.next} />
            </>
          ) : kind === 'unavailable' ? (
            <>
              <Btn primary label={tr('ai_scan.manual_entry')} onPress={onManualEntry} style={styles.first} />
              <Btn label={tr('ai_scan.offline_ok')} onPress={onClose} style={styles.next} />
            </>
          ) : kind === 'camera' ? (
            <>
              <Btn primary label={tr('ai_scan.open_settings')} onPress={onOpenSettings} style={styles.first} />
              <View style={[styles.next, styles.pair]}>
                <Btn label={tr('ai_scan.gallery_pick_short')} onPress={onGallery} style={styles.half} />
                <Btn label={tr('ai_scan.manual_entry')} onPress={onManualEntry} style={styles.half} />
              </View>
            </>
          ) : (
            <>
              <Btn primary label={tr('ai_scan.manual_entry')} onPress={onManualEntry} style={styles.first} />
              <Btn label={tr('ai_scan.pro_soon')} disabled style={styles.next} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  // G17-S1 md.7: modal → kapat X SAĞDA.
  top: { position: 'absolute', left: 8, right: 4, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topChip: { height: 36, borderRadius: 18, paddingHorizontal: 14, justifyContent: 'center', flexShrink: 1, marginRight: 12 },
  topChipText: { fontSize: 13, fontWeight: '600' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 24, paddingHorizontal: 16 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 14 },
  body: { marginTop: 6, fontSize: 15, lineHeight: 21 },
  note: { marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  noteText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  first: { marginTop: 18 },
  next: { marginTop: 10 },
  pair: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  btn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
