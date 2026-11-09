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
// Barkod: EAN-13/8, UPC-A/E okunur → `onBarcode(kod)` (G21-S1 md.2: ScanScreen Open Food
// Facts'e sorar; "Barkod yakında" hâli KALKTI). Sorgu sürerken "Ürün aranıyor…" hapı.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, DeviceEventEmitter, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { requireOptionalNativeModule } from 'expo';
import { StatusBar } from 'expo-status-bar';

import { AppText, haptic, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { X } from '../../../../components/icons';
import { SCAN_QUOTA_CAP } from './ScanQuotaChip';
import ScanFrame from './ScanFrame';
import FinScanAnalyzing from './FinScanAnalyzing';
import { ScanNoteField, ScanNotePill, normalizeScanNote } from './ScanNote';
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

/** YALNIZ __DEV__ vitrini (FinMoScan): dokunma aracı olmadan deklanşör. */
export const DEV_SCAN_SHUTTER_EVENT = 'kcal:dev:scanShutter';

export type ScanCameraMode = 'photo' | 'barcode';
/** Aynı barkod bu süre içinde yeniden gönderilmez (ms). */
export const BARCODE_REPEAT_MS = 3000;
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
  note = '',
  onNoteChange,
  onBarcode,
  barcodeBusy = false,
  initialMode = 'photo',
  modeKey,
}: {
  /** G21-S1 md.2: geçerli GTIN okundu → ScanScreen Open Food Facts'e sorar. */
  onBarcode?: (code: string) => void;
  /** Sorgu sürüyor → tarayıcı durur, "Ürün aranıyor…" hapı. */
  barcodeBusy?: boolean;
  /** Açılış modu (vitrin/test). */
  initialMode?: ScanCameraMode;
  /** Değişince mod `initialMode`'a döner (ör. "Fotoğrafla tara" → foto). */
  modeKey?: number;
  /** G18-S4 md.5: "Detay ekle" notu (ScanScreen tutar). onNoteChange yoksa hap çizilmez. */
  note?: string;
  onNoteChange?: (v: string) => void;
  cam: ExpoCameraModule;
  remaining: number | null;
  /** Analiz sürüyor → çekilen kare + FinMoScan katmanı; kontroller kilitli. */
  analyzing: boolean;
  photoUri: string | null;
  /** Hata sheet'i vb. açıkken önizleme duraklar (pil/ısı). */
  paused?: boolean;
  onClose: () => void;
  /** size: çekim boyutu (varsa) — `pictureSize` seçilemediyse ScanScreen ≤ 1600'e küçültür. */
  onCaptured: (uri: string, size?: { width: number; height: number }) => void;
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
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<ScanCameraMode>(initialMode);
  useEffect(() => {
    if (modeKey === undefined) return;
    setMode(initialMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeKey]);
  const [flashOn, setFlashOn] = useState(false);
  const [capturing, setCapturing] = useState(false);
  // Aynı kod art arda tetiklemesin: son gönderilen kod + zamanı (sheet kapanınca da tazelenir).
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
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
  // Çekim boyutu (uzun kenar ≤ 1600): görüntü açılınca ve onCameraReady'de istenir
  // (iOS simülatöründe onCameraReady hiç gelmez; Android hazır olmadan reddedebilir).
  const loadSizes = useCallback(async () => {
    try {
      const sizes = await ref.current?.getAvailablePictureSizesAsync();
      const picked = pickPictureSize(sizes);
      if (picked) setPictureSize(picked);
    } catch {
      // boyut listesi yoksa cihaz varsayılanı (5 MB yükleme sınırı yine korunur)
    }
  }, []);
  useEffect(() => {
    if (perm !== 'granted') return;
    const id = setTimeout(() => void loadSizes(), 300);
    return () => clearTimeout(id);
  }, [perm, loadSizes]);

  const onReady = () => {
    void loadSizes();
  };

  const shoot = async () => {
    // `ready` beklenmez: simülatörde onCameraReady gelmez; cihazda hazır olmadan
    // basılırsa takePictureAsync reddeder (aşağıda yutulur, tekrar basılabilir).
    if (!ref.current || capturing || analyzing || mode !== 'photo') return;
    haptic('medium');
    setCapturing(true);
    try {
      const pic = await ref.current.takePictureAsync({ quality: CAPTURE_QUALITY, exif: false });
      if (pic?.uri) onCaptured(pic.uri, pic.width && pic.height ? { width: pic.width, height: pic.height } : undefined);
    } catch {
      // çekim başarısız (kamera meşgul) — kullanıcı tekrar basabilir
    } finally {
      setCapturing(false);
    }
  };

  const shootRef = useRef(shoot);
  shootRef.current = shoot;
  useEffect(() => {
    if (!__DEV__) return;
    const sub = DeviceEventEmitter.addListener(DEV_SCAN_SHUTTER_EVENT, () => void shootRef.current());
    return () => sub.remove();
  }, []);

  const scanningLocked = barcodeBusy || !!paused;
  useEffect(() => {
    // Hata sheet'i kapanınca aynı kod hemen yeniden açmasın (kamera hâlâ ona bakıyor).
    if (!scanningLocked && lastCode.current) lastCode.current = { ...lastCode.current, at: Date.now() };
  }, [scanningLocked]);
  const handleBarcode = (r: { type: string; data: string }) => {
    if (scanningLocked || !onBarcode) return;
    const code = normalizeBarcode(r.type, r.data);
    if (!code) return;
    const last = lastCode.current;
    if (last && last.code === code && Date.now() - last.at < BARCODE_REPEAT_MS) return;
    lastCode.current = { code, at: Date.now() };
    haptic('light');
    onBarcode(code);
  };

  const switchMode = (m: ScanCameraMode) => {
    if (m === mode || analyzing || barcodeBusy) return;
    haptic('selection');
    setMode(m);
    lastCode.current = null;
  };

  // ── Ölçüler ─────────────────────────────────────────────────────────────────
  const frameW = Math.min(winW - 96, 300);
  const frameH = mode === 'barcode' ? Math.round(frameW * 0.56) : Math.round(frameW * 1.1);
  const live = perm === 'granted';
  const locked = analyzing || capturing || barcodeBusy;

  return (
    <View style={[styles.fill, { backgroundColor: k.panel }]}>
      <View style={[styles.camArea, { backgroundColor: '#000000' }]}>
        {/* Kamera alanı her temada siyah → durum çubuğu açık (G17-S2 simülatör çekimi). */}
        <StatusBar style="light" />
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
            onCameraReady={onReady}
            barcodeScannerSettings={mode === 'barcode' ? { barcodeTypes: [...SCAN_BARCODE_TYPES] } : undefined}
            onBarcodeScanned={mode === 'barcode' && !scanningLocked && onBarcode ? handleBarcode : undefined}
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
                  {mode === 'barcode' ? tt('ai_scan.barcode_hint') : tt('ai_scan.frame_hint')}
                </AppText>
              </View>
            </View>
          </>
        ) : null}

        {analyzing ? (
          <FinScanAnalyzing photoUri={photoUri} frameWidth={frameW} frameHeight={Math.round(frameW * 1.1)} />
        ) : null}

        {/* G21-S1 md.2 — barkod okundu, Open Food Facts sorgusu sürüyor. */}
        {live && mode === 'barcode' && barcodeBusy ? (
          <View style={styles.noteWrap} pointerEvents="none">
            <View
              style={[styles.hint, styles.busy, { backgroundColor: k.glass }]}
              testID="fin-scan-barcode-busy"
              accessibilityLiveRegion="polite"
            >
              <ActivityIndicator size="small" color={k.ink} />
              <AppText style={[styles.hintText, { color: k.ink }]} numberOfLines={1}>
                {tt('ai_scan.barcode_searching')}
              </AppText>
            </View>
          </View>
        ) : null}

        {/* G18-S4 md.5 — "Detay ekle" hapı: deklanşörün üstünde (kamera alanının altı). */}
        {live && mode === 'photo' && !analyzing && onNoteChange && !noteOpen ? (
          <View style={styles.noteWrap} pointerEvents="box-none">
            <ScanNotePill
              note={normalizeScanNote(note)}
              disabled={locked}
              onOpen={() => setNoteOpen(true)}
              k={k}
            />
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
            disabled={locked || !live || mode !== 'photo'}
            accessibilityRole="button"
            accessibilityLabel={tt('ai_scan.capture')}
            accessibilityState={{ disabled: locked || !live || mode !== 'photo', busy: analyzing }}
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

      {noteOpen && onNoteChange ? (
        <ScanNoteField value={note} onChange={onNoteChange} onClose={() => setNoteOpen(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  camArea: { flex: 1, overflow: 'hidden' },
  hintWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hint: { height: 36, borderRadius: 18, paddingHorizontal: 14, justifyContent: 'center' },
  hintText: { fontSize: 14, fontWeight: '500' },
  noteWrap: { position: 'absolute', left: 16, right: 16, bottom: 16, alignItems: 'center' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
