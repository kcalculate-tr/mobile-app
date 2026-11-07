// FinScanViewfinder — G15-S2 m.5: FinScanR2 kamera düzeni (yeni kabuk).
//
//  • Üst: kapat 44 dairesi (cam) + sağda hak hapı "Bugün N/3 tarama hakkın kaldı".
//  • Orta: çerçeve köşeleri (açıkta mürekkep, koyuda beyaz) + altında
//    "Tabağı tam çerçevele" hapı.
//  • Alt panel: mod çubuğu (Fotoğraf seçili siyah hap · Barkod · Elle),
//    galeri karesi 48 · lime deklanşör (80 halka + 64 lime) · flaş dairesi 48.
//
// Canlı önizleme YOK (expo-camera kurulu değil, yeni paket yasak): deklanşör
// sistem kamerasını açar (mevcut expo-image-picker). Flaş sistem kamerasının
// kendi denetiminde → flaş düğmesi kısa bir bilgi hapı gösterir.
// G17-S2: artık YALNIZ yedek — ExpoCamera native modülü olmayan eski derlemede
// (OTA) gösterilir; yeni derlemede canlı vizör FinScanCamera.tsx.
// G17-S1 md.2: orta alanda gri sahte vizör + çerçeve YERİNE "Kamerayı aç" kartı
// (expo-camera İlter onayına bağlı — SORULAR). Onay gelirse burası canlı vizör olur.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AppText, Button, haptic, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { CameraIcon, X } from '../../../../components/icons';
import { SCAN_QUOTA_CAP } from './ScanQuotaChip';

const FLASH_D = 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z';

export function finScanTokens(isDark: boolean) {
  return isDark
    ? { cam: '#2C2C2E', panel: '#1C1C1E', ink: '#F5F5F5', glass: 'rgba(28,28,30,0.72)', btn: '#2C2C2E', thumb: '#3A3A3C', thumbText: '#C7C7CC', corner: '#FFFFFF', ring: '#F5F5F5' }
    : { cam: '#D3D6DA', panel: '#F3F4F6', ink: '#0A0A0A', glass: 'rgba(255,255,255,0.78)', btn: '#FFFFFF', thumb: '#C3C7CC', thumbText: '#45454A', corner: '#0A0A0A', ring: '#0A0A0A' };
}

export default function FinScanViewfinder({
  remaining,
  scanning,
  onClose,
  onCapture,
  onGallery,
  onManual,
}: {
  remaining: number | null;
  scanning: boolean;
  onClose: () => void;
  onCapture: () => void;
  onGallery: () => void;
  onManual: () => void;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const insets = useSafeAreaInsets();
  const k = finScanTokens(t.isDark);
  const [flashHint, setFlashHint] = useState(false);

  return (
    <View style={[styles.fill, { backgroundColor: k.panel }]}>
      <View style={styles.camArea}>
        <View style={[styles.top, { top: insets.top + 6 }]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={tt('common.close')}
            style={[styles.close, { backgroundColor: k.glass }]}
          >
            <X size={20} color={k.ink} />
          </Pressable>
          {remaining != null ? (
            <View style={[styles.quota, { backgroundColor: k.glass }]}>
              <AppText style={[styles.quotaText, { color: k.ink }]} numberOfLines={1}>
                {tt('ai_scan.quota_left_of', { count: remaining, cap: SCAN_QUOTA_CAP })}
              </AppText>
            </View>
          ) : null}
        </View>
        {/* G17-S1 md.2: canlı önizleme yok (expo-camera onayı bekliyor) → sahte
            vizör/çerçeve YERİNE dürüst "Kamerayı aç" kartı; sistem kamerasını açar. */}
        <View style={[styles.cardWrap, { paddingTop: insets.top + 60 }]}>
          <View style={[styles.card, { backgroundColor: t.color.surface }]} testID="fin-scan-open-camera">
            <View style={[styles.cardIcon, { backgroundColor: t.color.bg }]}>
              {scanning ? <ActivityIndicator color={t.color.ink} /> : <CameraIcon size={28} color={t.color.ink} />}
            </View>
            <AppText style={[styles.cardTitle, { color: t.color.ink }]} accessibilityRole="header">
              {scanning ? tt('ai_scan.scanning') : tt('ai_scan.camera_open_title')}
            </AppText>
            <AppText style={[styles.cardBody, { color: t.color.secondary }]}>
              {flashHint ? tt('ai_scan.flash_hint') : tt('ai_scan.camera_open_body')}
            </AppText>
            <Button
              label={tt('ai_scan.camera_open_cta')}
              onPress={onCapture}
              disabled={scanning}
              haptic="medium"
              style={styles.cardCta}
            />
          </View>
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: k.panel, paddingBottom: Math.max(20, insets.bottom + 4) }]}>
        <View style={styles.modes} accessibilityRole="tablist">
          <View style={[styles.mode, { backgroundColor: k.ink }]} accessibilityRole="tab" accessibilityState={{ selected: true }}>
            <AppText style={[styles.modeText, { color: t.color.bg }]}>{tt('ai_scan.mode_photo')}</AppText>
          </View>
          <View style={styles.mode} accessibilityRole="tab">
            <AppText style={[styles.modeText, { color: k.ink }]}>{tt('ai_scan.mode_barcode')}</AppText>
          </View>
          <Pressable onPress={onManual} style={styles.mode} accessibilityRole="tab">
            <AppText style={[styles.modeText, { color: k.ink }]}>{tt('ai_scan.mode_manual')}</AppText>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable
            onPress={onGallery}
            disabled={scanning}
            accessibilityRole="button"
            accessibilityLabel={tt('ai_scan.gallery_pick')}
            style={[styles.thumb, { backgroundColor: k.thumb }]}
          >
            <AppText style={[styles.thumbText, { color: k.thumbText }]}>{tt('ai_scan.gallery')}</AppText>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic('medium');
              onCapture();
            }}
            disabled={scanning}
            accessibilityRole="button"
            accessibilityLabel={tt('ai_scan.capture')}
            style={[styles.shutter, { borderColor: k.ring }]}
          >
            <View style={[styles.shutterInner, { backgroundColor: t.color.accent }]}>
              {scanning ? <ActivityIndicator color={t.color.onAccent} /> : null}
            </View>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic('selection');
              setFlashHint((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityLabel={tt('ai_scan.flash')}
            accessibilityHint={tt('ai_scan.flash_hint')}
            style={[styles.flash, { backgroundColor: k.btn }]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d={FLASH_D} stroke={k.ink} strokeWidth={1.75} strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  camArea: { flex: 1 },
  cardWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  card: { borderRadius: 24, padding: 24, alignItems: 'center' },
  cardIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { marginTop: 16, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  cardBody: { marginTop: 8, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  cardCta: { marginTop: 20, alignSelf: 'stretch' },
  // G17-S1 md.7: modal → kapat X SAĞDA (row-reverse), hak hapı solda.
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quota: { height: 44, borderRadius: 22, paddingHorizontal: 14, justifyContent: 'center', flexShrink: 1, marginRight: 12 },
  quotaText: { fontSize: 13, fontWeight: '600' },
  panel: { paddingTop: 14 },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  mode: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center' },
  modeText: { fontSize: 14, fontWeight: '600' },
  row: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  thumb: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  flash: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  thumbText: { fontSize: 13 },
});
