// G17-S2 md.1–4 — FinScanR2 CANLI kamera (expo-camera, İlter onayı 7 Kas 15:35).
//
// Sekmedeki Tara → doğrudan bu ekran (yeni kabuk). Canlı görüntü tam ekran;
// üstte kapat X (sağ, modal kuralı) + hak hapı; ortada köşe çerçevesi + "Tabağı
// tam çerçevele"; alt panel: mod çubuğu (Fotoğraf · Barkod · Elle), galeri (ImagePicker
// — çağıran), lime deklanşör, flaş (fotoğrafta `flash`, barkodda `enableTorch`).
// "Kamerayı aç" kartı ve sistem kamerası KALKTI (yalnız ExpoCamera native modülü
// olmayan eski derlemede güvenlik yedeği: FinScanViewfinder — OTA çökmesin).
//
// Deklanşör: takePictureAsync (kalite 0.5, `pictureSize` ile uzun kenar ≤ 1600) →
// `onCaptured(uri)`; analiz sürerken (`analyzing`) aynı ekranda FinMoScan katmanı.
// İzin: ilk açılışta istenir; reddedilirse `onPermissionDenied` (FinScanError
// "Kameraya erişim kapalı" + Ayarlar). Ayarlar'dan dönünce yeniden denetlenir.
// Barkod: EAN-13/8, UPC-A/E okunur; uygulamada barkod akışı YOK → "Barkod yakında"
// hâli (okunan kod gösterilir, sahte ürün/sonuç yok).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { requireOptionalNativeModule } from 'expo';

import { AppText, Button, haptic, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { X } from '../../../../components/icons';
import { SCAN_QUOTA_CAP } from './ScanQuotaChip';
import ScanFrame from './ScanFrame';
import FinScanAnalyzing from './FinScanAnalyzing';
import { finScanTokens } from './FinScanViewfinder';
import {
  CAPTURE_QUALITY,
  SCAN_BARCODE_TYPES,
  normalizeBarcode,
  pickPictureSize,
} from '../camera';

type ExpoCameraModule = typeof import('expo-camera');

const FLASH_D = 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z';
const FLASH_OFF_D = 'M13 2 9.5 6.7 M7.4 9.5 4 14h7l-1 8 4.2-5.6 M16.3 12.4 19 10h-7l1-8 M3 3l18 18';

/**
 * ExpoCamera native modülü bu derlemede var mı? (1.1.0 (25) ve öncesinde YOK —
 * OTA ile gelen JS çökmemeli.) Varsa expo-camera tembel yüklenir.
 */
export function loadExpoCamera(): ExpoCameraModule | null {
  try {
    if (!requireOptionalNativeModule('ExpoCamera')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-camera') as ExpoCameraModule;
  } catch {
    return null;
  }
}

export type ScanCameraMode = 'photo' | 'barcode';
type Perm = 'unknown' | 'granted' | 'denied';

export default function FinScanCamera({
  cam,
  remaining,
  analyzing,
  photoUri,
  paused,
  onClose,
  onCaptured,
  onGallery,
  onManual,
  onPermissionDenied,
  onPermissionGranted,
}: {
  cam: ExpoCameraModule;
  remaining: number | null;
  /** Analiz sürüyor → çekilen kare + FinMoScan katmanı; kontroller kilitli. */
  analyzing: boolean;
  photoUri: string | null;
  /** Hata sheet'i vb. açıkken önizleme duraklar (pil/ısı). */
  paused?: boolean;
  onClose: () => void;
  onCaptured: (uri: string) => void;
  onGallery: () => void;
  onManual: () => void;
  onPermissionDenied: () => void;
  onPermissionGranted?: () => void;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const k = finScanTokens(t.isDark);
  const { CameraView, Camera } = cam;

  const ref = useRef<InstanceType<ExpoCameraModule['CameraView']> | null>(null);
  const [perm, setPerm] = useState<Perm>('unknown');
  const [ready, setReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<ScanCameraMode>('photo');
  const [flashOn, setFlashOn] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [barcode, setBarcode] = useState<string | null>(null);
  const deniedReported = useRef(false);

  // ── İzin akışı ──────────────────────────────────────────────────────────────
  const checkPermission = useCallback(
    async (askIfPossible: boolean) => {
      try {
        let res = await Camera.getCameraPermissionsAsync();
        if (!res.granted && askIfPossible && res.canAskAgain) {
          res = await Camera.requestCameraPermissionsAsync();
        }
        if (res.granted) {
          setPerm('granted');
          if (deniedReported.current) {
            deniedReported.current = false;
            onPermissionGranted?.();
          }
          return;
        }
        setPerm('denied');
        if (!deniedReported.current) {
          deniedReported.current = true;
          onPermissionDenied();
        }
      } catch {
        setPerm('denied');
        if (!deniedReported.current) {
          deniedReported.current = true;
          onPermissionDenied();
        }
      }
    },
    [Camera, onPermissionDenied, onPermissionGranted],
  );

  useEffect(() => {
    void checkPermission(true);
    // Ayarlar'dan dönünce yeniden denetle (izin verildiyse canlı görüntü açılır).
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void checkPermission(false);
    });
    return () => sub.remove();
  }, [checkPermission]);

  // ── Çekim ───────────────────────────────────────────────────────────────────
  const onReady = async () => {
    setReady(true);
    try {
      const sizes = await ref.current?.getAvailablePictureSizesAsync();
      setPictureSize(pickPictureSize(sizes));
    } catch {
      // boyut listesi yoksa cihaz varsayılanı (5 MB yükleme sınırı yine korunur)
    }
  };

  const shoot = async () => {
    if (!ref.current || !ready || capturing || analyzing || mode !== 'photo') return;
    haptic('medium');
    setCapturing(true);
    try {
      const pic = await ref.current.takePictureAsync({ quality: CAPTURE_QUALITY, exif: false });
      if (pic?.uri) onCaptured(pic.uri);
    } catch {
      // çekim başarısız (kamera meşgul) — kullanıcı tekrar basabilir
    } finally {
      setCapturing(false);
    }
  };

  const onBarcode = (r: { type: string; data: string }) => {
    if (barcode) return;
    const code = normalizeBarcode(r.type, r.data);
    if (!code) return;
    haptic('light');
    setBarcode(code);
  };

  const switchMode = (m: ScanCameraMode) => {
    if (m === mode || analyzing) return;
    haptic('selection');
    setMode(m);
    setBarcode(null);
  };

  // ── Ölçüler ─────────────────────────────────────────────────────────────────
  const frameW = Math.min(winW - 96, 300);
  const frameH = mode === 'barcode' ? Math.round(frameW * 0.56) : Math.round(frameW * 1.1);
  const live = perm === 'granted';
  const locked = analyzing || capturing;

  return (
    <View style={[styles.fill, { backgroundColor: k.panel }]}>
      <View style={[styles.camArea, { backgroundColor: '#000000' }]}>
        {live ? (
          <CameraView
            ref={ref}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            active={!paused && !analyzing}
            animateShutter={false}
            flash={mode === 'photo' && flashOn ? 'on' : 'off'}
            enableTorch={mode === 'barcode' && flashOn}
            pictureSize={pictureSize}
            onCameraReady={() => void onReady()}
            barcodeScannerSettings={mode === 'barcode' ? { barcodeTypes: [...SCAN_BARCODE_TYPES] } : undefined}
            onBarcodeScanned={mode === 'barcode' && !barcode ? onBarcode : undefined}
            accessibilityLabel={tt('ai_scan.camera_label')}
            testID="fin-scan-camera"
          />
        ) : null}

        {live && !analyzing ? (
          <>
            <ScanFrame active={false} color="#FFFFFF" width={frameW} height={frameH} />
            <View style={[styles.hintWrap, { top: '50%', marginTop: frameH / 2 + 16 }]} pointerEvents="none">
              <View style={[styles.hint, { backgroundColor: k.glass }]}>
                <AppText style={[styles.hintText, { color: k.ink }]} numberOfLines={1}>
                  {!ready ? tt('ai_scan.camera_starting') : mode === 'barcode' ? tt('ai_scan.barcode_hint') : tt('ai_scan.frame_hint')}
                </AppText>
              </View>
            </View>
          </>
        ) : null}

        {analyzing ? (
          <FinScanAnalyzing photoUri={photoUri} frameWidth={frameW} frameHeight={Math.round(frameW * 1.1)} />
        ) : null}

        {/* Barkod modu — uygulamada barkod akışı yok: dürüst "yakında" kartı. */}
        {live && mode === 'barcode' && !analyzing ? (
          <View style={styles.soonWrap} pointerEvents="box-none">
            <View style={[styles.soon, { backgroundColor: t.color.surface }]} testID="fin-scan-barcode-soon">
              <AppText style={[styles.soonTitle, { color: t.color.ink }]} accessibilityRole="header">
                {tt('ai_scan.barcode_soon_title')}
              </AppText>
              <AppText style={[styles.soonBody, { color: t.color.secondary }]}>{tt('ai_scan.barcode_soon_body')}</AppText>
              {barcode ? (
                <AppText style={[styles.soonCode, { color: t.color.ink }]} accessibilityLiveRegion="polite">
                  {tt('ai_scan.barcode_read', { code: barcode })}
                </AppText>
              ) : null}
              <Button label={tt('ai_scan.manual_entry')} onPress={onManual} haptic="light" style={styles.soonCta} />
            </View>
          </View>
        ) : null}

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
      </View>

      <View style={[styles.panel, { backgroundColor: k.panel, paddingBottom: Math.max(20, insets.bottom + 4) }]}>
        <View style={styles.modes} accessibilityRole="tablist">
          {(['photo', 'barcode'] as const).map((m) => {
            const sel = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                disabled={locked}
                style={[styles.mode, sel ? { backgroundColor: k.ink } : null]}
                accessibilityRole="tab"
                accessibilityState={{ selected: sel, disabled: locked }}
              >
                <AppText style={[styles.modeText, { color: sel ? t.color.bg : k.ink }]}>
                  {tt(m === 'photo' ? 'ai_scan.mode_photo' : 'ai_scan.mode_barcode')}
                </AppText>
              </Pressable>
            );
          })}
          <Pressable onPress={onManual} disabled={locked} style={styles.mode} accessibilityRole="tab">
            <AppText style={[styles.modeText, { color: k.ink }]}>{tt('ai_scan.mode_manual')}</AppText>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable
            onPress={onGallery}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={tt('ai_scan.gallery_pick')}
            style={[styles.thumb, { backgroundColor: k.thumb }]}
          >
            <AppText style={[styles.thumbText, { color: k.thumbText }]}>{tt('ai_scan.gallery')}</AppText>
          </Pressable>
          <Pressable
            onPress={() => void shoot()}
            disabled={locked || !ready || mode !== 'photo'}
            accessibilityRole="button"
            accessibilityLabel={tt('ai_scan.capture')}
            accessibilityState={{ disabled: locked || !ready || mode !== 'photo', busy: analyzing }}
            style={({ pressed }) => [
              styles.shutter,
              { borderColor: k.ring, opacity: mode === 'photo' ? 1 : 0.4, transform: [{ scale: pressed ? 0.9 : 1 }] },
            ]}
            testID="fin-scan-shutter"
          >
            <View style={[styles.shutterInner, { backgroundColor: t.color.accent }]} />
          </Pressable>
          <Pressable
            onPress={() => {
              haptic('selection');
              setFlashOn((v) => !v);
            }}
            disabled={locked || !live}
            accessibilityRole="switch"
            accessibilityLabel={tt('ai_scan.flash')}
            accessibilityState={{ checked: flashOn }}
            accessibilityValue={{ text: tt(flashOn ? 'ai_scan.flash_on' : 'ai_scan.flash_off') }}
            style={[styles.flash, { backgroundColor: flashOn ? t.color.accent : k.btn }]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d={flashOn ? FLASH_D : FLASH_OFF_D}
                stroke={flashOn ? t.color.onAccent : k.ink}
                fill={flashOn ? t.color.onAccent : 'none'}
                strokeWidth={1.75}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  camArea: { flex: 1, overflow: 'hidden' },
  hintWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hint: { height: 36, borderRadius: 18, paddingHorizontal: 14, justifyContent: 'center' },
  hintText: { fontSize: 14, fontWeight: '500' },
  soonWrap: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  soon: { borderRadius: 24, padding: 20 },
  soonTitle: { fontSize: 18, fontWeight: '700' },
  soonBody: { marginTop: 6, fontSize: 15, lineHeight: 21 },
  soonCode: { marginTop: 10, fontSize: 14, fontWeight: '600' },
  soonCta: { marginTop: 16, alignSelf: 'stretch' },
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
  thumbText: { fontSize: 13 },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 64, height: 64, borderRadius: 32 },
  flash: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
});
