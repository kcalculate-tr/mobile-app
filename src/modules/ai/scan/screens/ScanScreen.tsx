// T20Scan — AI fotoğraf tarama ekranı (G6-S4 md.3). `ai_tarama` bayrağı
// arkasında; giriş noktası TrackerScreen'deki "AI ile tara" butonu (bayrak
// kapalıyken o buton hiç render olmaz, bu ekrana hiç erişilmez).
//
// Bayrak KAPALI (eski dal): canlı önizleme yok, deklanşör `expo-image-picker`
// ile sistem kamerasını açar (bugünkü davranış AYNEN).
// G17-S2: yeni kabukta (FinScanR2) CANLI kamera — `expo-camera` (İlter onayı
// 7 Kas 15:35), bkz. ui/FinScanCamera.tsx; ExpoCamera native modülü olmayan eski
// derlemede FinScanViewfinder (sistem kamerası) yedeği.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DENIED_KEYS, askOnce } from '../../../../lib/permissions/askOnce';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import { LEGAL_SLUG } from '../../../../lib/legal/slugs';
import { openLegalWeb } from '../../../../lib/legal/openLegal';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { X, ArrowCounterClockwise, Image as ImageIcon } from '../../../../components/icons';
import { LogTrail, Toast } from '../../../../core/design';
import { RollingNumber } from '../../../gun/ui';
import type { NumLang } from '../../../gun/motion';
import ScanFrame from '../ui/ScanFrame';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { RootStackParamList } from '../../../../navigation/types';
import { runAiScan } from '../runScan';
import { getAiScanClient } from '../client';
import { scanFailureInfo } from '../scanError';
import { useScanQuotaStore, useScanRemaining } from '../quotaStore';
import { inferMealTypeFromHour } from '../mealTypeFromHour';
import type { ClientMealType } from '../../../../core/meal/mealType';
import { saveAiScanEstimate } from '../saveEstimate';
import { getSupabaseClient } from '../../../../core/supabase';
import type { ScanEstimate } from '../types';
import ScanQuotaChip from '../ui/ScanQuotaChip';
import ScanLimitSheet from '../ui/ScanLimitSheet';
import FinScanErrorSheet, { type FinScanErrorKind } from '../ui/FinScanErrorSheet';
import FinPhotoResult from '../ui/FinPhotoResult';
import FinScanViewfinder from '../ui/FinScanViewfinder';
import FinScanCamera, { loadExpoCamera } from '../ui/FinScanCamera';
import { normalizeScanNote } from '../ui/ScanNote';
import { bestMatchPercent, saveMealToCollection, schedulePlanReminder } from '../mealActions';
import { fetchProducts } from '../../../../lib/products';
import {
  setPendingScanPhoto,
  clearPendingScanPhoto,
  getPendingScanCount,
  getPendingScanQueue,
  removePendingScanPhoto,
  claimPendingKey,
  releasePendingKey,
} from '../offlineQueue';
import { scanImagePath } from '../scanPath';
import { rememberLocalMealPhoto } from '../../../gun/mealPhoto';
import { drainPendingScans, onPendingDrained } from '../drainPending';
import { emitLogFlight, emitLogUndo } from '../logFlight';
import { liftedRect, logTrace, measureRect, type Rect } from '../../../shell/logTrace';
import { LIFT_SCALE, LIFT_SHIFT } from '../ui/StickerLift';
// G29-S1 md.1 — çıkartma (cihazda; yoksa normal fotoğraf, akış beklemez).
import { liftSticker, type Sticker } from '../../../../lib/sticker/subjectLift';
import { forgetSticker } from '../../../../lib/sticker/stickerStore';
import { saveStickerInBackground } from '../../../../lib/sticker/saveSticker';
import { trackSticker } from '../stickerTrack';
import { deleteScanConsumption, scanFlightUndo } from '../scanUndo';
import { checkLocalImage, deleteQueuedImage, persistQueuedImage, type LocalImageCheck } from '../localImage';
import { trackScan } from '../scanEvents';
import { shrinkForScan, type ImageSize } from '../imageResize';
import { keepOrphanResult, takeOrphanResult } from '../orphanResult';
import { useFeature } from '../../../../core/flags';
import { haptic, useReducedMotion } from '../../../../core/design';
import { FinChip } from '../../../profil/ui/finUi';
import PlateXRayShareModal from '../../../../components/share/PlateXRayShareModal';
import type { PlateXRayData } from '../../../../components/share/PlateXRayShareCard';
import { trackBarcodeLog, trackScanLog, trackScanOutcome } from '../scanTrack';
import { lookupBarcode, productDisplayName } from '../barcode/off';
import FinBarcodeResult, { type BarcodeResultProduct } from '../ui/FinBarcodeResult';
import type { ScanCameraMode } from '../ui/FinScanCamera';
import type { ScanVia } from '../scanMetrics';
import { ConsentSheet } from '../../../onboarding/consent/ConsentSheet';
import { resolveAiPhotoConsent, setAiPhotoConsent } from '../../../../lib/consent/aiPhoto';
// G22-S1 — sesle ekleme + kcalAI hakları.
import FinScanVoice, { type ScanInputMode } from '../voice/FinScanVoice';
import { useVoiceScan } from '../voice/useVoiceScan';
import { loadSpeech } from '../voice/speech';
import { reserveBarcode } from '../barcode/quota';
import { SCAN_QUOTA_CAP } from '../ui/ScanQuotaChip';
import SubLimitSheet from '../../../subscription/ui/SubLimitSheet';
import { trackSub } from '../../../subscription/subTrack';
import { pillA11y, pillLabel, type QuotaSnapshot } from '../../../../lib/subscription/limits';
import { noteQuota, useSubscriptionStore, useTier } from '../../../../lib/subscription/purchases';
import { useSubscriptionEnabled } from '../../../../lib/subscription/useSubscriptionBootstrap';
import { monthlyPriceOf, usePlanCards } from '../../../../lib/subscription/usePlanCards';
import type { AiScanOutcome } from '../types';

/**
 * G28-S1 md.4: ön planda başarıyla analiz edilen anahtar kuyruktaysa (önce çevrimdışı
 * kuyruğa alınmıştı) girdi ön plana geçer — kuyruktan çıkar, kopya dosya silinir.
 * Böylece kuyruk sonradan aynı fotoğrafı kaydetmez (kayıt yalnız kullanıcının Logla'sı).
 */
async function adoptPendingEntry(key: string, shownUri: string): Promise<void> {
  try {
    const entry = (await getPendingScanQueue()).find((e) => e.id === key);
    if (!entry) return;
    await removePendingScanPhoto(key);
    if (entry.imageUri && entry.imageUri !== shownUri) void deleteQueuedImage(entry.imageUri);
  } catch {
    // kuyruk okunamazsa kilit yine ikinci analizi önler; kayıt eşitlemesi (saveEstimate) son güvence
  }
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Stage = 'viewfinder' | 'scanning' | 'result';

export default function ScanScreen() {
  const navigation = useNavigation<Nav>();
  const { t, lang } = useT();
  const { user } = useAuth();
  const paylasimKarti = useFeature('paylasim_karti');
  const reducedMotion = useReducedMotion();

  // G19-S1 md.2: İstanbul gece yarısı geçince dünkü sayı gösterilmez (bilinmiyor → gizli).
  const remaining = useScanRemaining();
  const recordQuota = useScanQuotaStore((s) => s.recordQuota);
  // G12-S4 — yeni kabuk Tara (FinScanR2/FinPhotoR1). Bayrak kapalıyken bu
  // değişkenin TÜM etkisi sıfırdır: aşağıdaki JSX dallarından yalnız eski dal
  // render olur, yeni state'ler hiç okunmaz/yazılmaz.
  const yeniKabuk = useFeature('yeni_kabuk');
  // G17-S2 md.1: canlı kamera (expo-camera) YALNIZ yeni kabukta yüklenir; native
  // modül olmayan eski derlemede null → G17-S1 kartı (sistem kamerası) yedeği.
  const liveCam = useMemo(() => (yeniKabuk ? loadExpoCamera() : null), [yeniKabuk]);

  const [stage, setStage] = useState<Stage>('viewfinder');
  const [limitVisible, setLimitVisible] = useState(false);
  const [result, setResult] = useState<Omit<ScanEstimate, 'isEstimate'> | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  // G29-S1 md.1: bu fotoğrafın çıkartması (çekimle birlikte cihazda başlar, ≤ 1,5 sn; yoksa null).
  const [sticker, setSticker] = useState<Sticker | null>(null);
  const liftUriRef = useRef<string | null>(null);
  const stickerRef = useRef<View | null>(null);
  // Bu taramanın benzersiz anahtarı (reservation/idempotency) — kayıtta
  // source_ref olur; aynı gün ikinci tarama çakışmasın diye tarama başına benzersiz.
  const [scanRef, setScanRef] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  // "Günüme ekle" → Logla izi + zaman hapı.
  const [logToken, setLogToken] = useState(0);
  const [savedToast, setSavedToast] = useState(false);

  // Yeni kabuk — hata sayfası (FinScanError: failed/offline/limit) + öğün tipi
  // döngüsü + çevrimdışı bekleyen fotoğraf toast'ı.
  const [errorKind, setErrorKind] = useState<FinScanErrorKind | null>(null);
  const [mealType, setMealType] = useState<ClientMealType>(() => inferMealTypeFromHour(new Date().getHours()));
  const [pendingToast, setPendingToast] = useState(false);
  const [pendingMeal, setPendingMeal] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(1);
  // G18-S4 md.5 — "Detay ekle" notu (isteğe bağlı; boşsa ekstra adım yok).
  const [scanNote, setScanNote] = useState('');

  const insets = useSafeAreaInsets();
  const scanLang: 'tr' | 'en' = lang === 'en' ? 'en' : 'tr';

  // G19-S1 md.1 — yarış korumaları.
  //  • busyRef: deklanşör → (dosya/ağ denetimi) → rezervasyon arasında ikinci dokunma
  //    / galeri seçimi İKİNCİ rezervasyon açmaz (önceden NetInfo beklenirken açılıyordu).
  //  • savingRef: "logla"ya iki hızlı dokunma tek kayıt (state güncellemesi gecikir).
  //  • mountedRef: analiz sürerken ekran kapatılırsa setState yok; sonuç sahipsiz
  //    olarak saklanır (orphanResult) ve Tara yeniden açılınca gösterilir.
  const busyRef = useRef(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastSourceRef = useRef<'camera' | 'gallery'>('camera');
  const [failReason, setFailReason] = useState<LocalImageCheck | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [galleryDenied, setGalleryDenied] = useState(false);
  // G20-S3 md.2 (Apple 5.1.2(i)): ilk taramadan önce BİR KEZ yapay zekâ fotoğraf
  // izni. İzin yokken hiçbir fotoğraf gönderilmez (çekim/galeri/tekrar dene bekçili).
  // Vazgeç → Elle gir (mevcut "Elle gir" yolu).
  // G22-S1 md.5 (G21 SORULAR 2): izin sheet'i AÇILIŞTA DEĞİL, YALNIZ Fotoğraf/Ses AI analizinden
  // önce açılır; Barkod ve Elle izin istemeden çalışır. Onaydan sonra bekleyen eylem sürer.
  const aiConsentRef = useRef<'ok' | 'ask' | null>(null);
  const aiLookupRef = useRef<Promise<'ok' | 'ask'> | null>(null);
  const aiPendingRef = useRef<(() => void) | null>(null);
  const [aiSheet, setAiSheet] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  useEffect(() => {
    const lookup = resolveAiPhotoConsent().catch(() => 'ask' as const);
    aiLookupRef.current = lookup;
    void lookup.then((d) => {
      if (aiConsentRef.current === null) aiConsentRef.current = d;
    });
  }, []);
  /** İzin yoksa sheet'i aç ve true dön (çağıran durur; `resume` onaydan sonra çalışır). */
  const aiBlocked = async (resume?: () => void): Promise<boolean> => {
    const d = aiConsentRef.current ?? (aiLookupRef.current ? await aiLookupRef.current : 'ask');
    if (d === 'ok') return false;
    aiPendingRef.current = resume ?? null;
    setAiSheet(true);
    return true;
  };
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // G19-S1 md.6: scan_open (yalnız yeni kabuk — bayrak kapalı parite).
  // md.1: önceki açılışta analiz sürerken kapatıldıysa sonucu geri getir.
  useEffect(() => {
    if (!yeniKabuk) return;
    const o = takeOrphanResult(user?.id);
    if (o) {
      setPhotoUri(o.photoUri);
      setScanRef(o.scanRef);
      setScanNote(o.note);
      setResult(o.estimate);
      setSaved(false);
      setStage('result');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yeniKabuk]);

  // md.1: analiz sürerken Android geri tuşu ekranı kapatmaz (iOS'ta kaydırma kapalı);
  // kapat X her zaman çalışır — sonuç orphanResult'ta korunur.
  useEffect(() => {
    if (!yeniKabuk) return;
    const scanning = stage === 'scanning';
    try {
      navigation.setOptions({ gestureEnabled: !scanning });
    } catch {
      // test/vitrin gezgini setOptions vermeyebilir
    }
    if (!scanning) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [yeniKabuk, stage, navigation]);

  // Çevrimdışı bekleyen fotoğraflar (G16-S1): ekran açılışında ve bağlantı
  // geri geldiğinde kuyruk SIRAYLA analiz edilir (processPendingQueue); hak
  // yalnız başarılı analizde düşer, başarısız/kota biten girdi kuyrukta kalır.
  // "Tek kayıt": elle giriş kuyruğu zaten boşaltmış olabilir.
  useEffect(() => {
    if (!yeniKabuk || !user?.id) return;
    let cancelled = false;
    const drain = () => void drainPendingScans(user.id, undefined, lang === 'en' ? 'en' : 'tr');
    const unsubNet = NetInfo.addEventListener((s) => {
      if (s.isConnected) drain();
    });
    const unsubDone = onPendingDrained((res) => {
      if (cancelled) return;
      if (res.lastOutcome) recordQuota(res.lastOutcome.remaining, res.lastOutcome.reset_at);
      for (const p of res.processed) {
        // G21-S1 md.4: uçuş kayıt id'sini + gerçek silmeyi taşır → kabuk "Geri al" bu kaydı siler.
        emitLogFlight({
          x: 0, y: 0, w: 0, h: 0, imageUri: p.entry.imageUri, mealLabel: t(`meal.${p.entry.mealType}`), source: 'scan', kcal: p.estimate.kcal,
          id: p.rowId ?? null,
          undo: scanFlightUndo(getSupabaseClient, user.id, p.rowId),
        });
      }
      if (res.processed.length > 0) {
        setPendingMeal(res.processed[res.processed.length - 1].entry.mealType);
        setPendingToast(true);
      }
    });
    return () => {
      cancelled = true;
      unsubNet();
      unsubDone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yeniKabuk, user?.id]);

  // G19-S1 md.6 + G19-S3: scan_open — her açılışta bir kez (eski ve yeni kabuk; G19-S4 tek çağrı).
  useEffect(() => {
    trackScan('scan_open', { camera: !yeniKabuk ? 'legacy' : liveCam ? 'live' : 'fallback' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureOnce = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
    // G26-S1: deklanşöre dokununca bir kez; reddedildiyse bir daha sistem penceresi yok.
    const granted = await askOnce({
      read: async () => {
        const r = await ImagePicker.getCameraPermissionsAsync();
        return { status: r.granted ? 'granted' : r.canAskAgain ? 'undetermined' : 'denied', canAskAgain: r.canAskAgain };
      },
      request: async () => ((await ImagePicker.requestCameraPermissionsAsync()).granted ? 'granted' : 'denied'),
      wasDenied: async () => (await AsyncStorage.getItem(DENIED_KEYS.camera)) === '1',
      markDenied: () => AsyncStorage.setItem(DENIED_KEYS.camera, '1'),
    });
    if (!granted) {
      // G15-S2: yeni kabukta "Kameraya erişim kapalı" ayrı durum (FinScanError);
      // bayrak kapalıyken bugünkü uyarı aynen.
      if (yeniKabuk) setErrorKind('camera');
      else Alert.alert(t('ai_scan.permission_denied'));
      return null;
    }
    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5, // G17-S1: edge sınırı 5 MB — yükleme boyutu
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return null;
    return picked.assets[0];
  };

  const handleCaptureLegacy = async () => {
    if (await aiBlocked(() => void handleCaptureLegacy())) return;
    const uri = (await captureOnce())?.uri;
    if (!uri) return;
    setPhotoUri(uri);
    setStage('scanning');
    const idempotencyKey = `${user?.id ?? 'anon'}-${uri}`;
    setScanRef(idempotencyKey);
    trackScan('scan_capture', { via: 'legacy', has_hint: false, retry: false, offline: false });
    const outcome = await runAiScan(getAiScanClient(), { idempotencyKey, imageRef: uri });
    trackScanOutcome(outcome, 'legacy');
    recordQuota(outcome.remaining, outcome.reset_at);

    if (outcome.status === 'quota_exhausted') {
      setStage('viewfinder');
      setLimitVisible(true);
      return;
    }
    if (outcome.status === 'unavailable') {
      setStage('viewfinder');
      Alert.alert(t('ai_scan.unavailable_title'), t('ai_scan.unavailable_body'));
      return;
    }
    if (outcome.status === 'failed') {
      setStage('viewfinder');
      Alert.alert(t('ai_scan.failed'));
      return;
    }
    setResult(outcome.estimate);
    setSaved(false);
    setStage('result');
  };

  const pickFromGallery = async (): Promise<string | null> => {
    // G26-S1: sistem seçicisi (iOS PHPicker / Android Photo Picker) izin istemez — galeri izni SORULMAZ.
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5, // G17-S1: edge sınırı 5 MB — yükleme boyutu
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return null;
    return picked.assets[0].uri;
  };

  // Yeni kabuk — çevrimdışıysa hiç rezervasyon denemeden kuyruğa al (hak
  // harcanmasın); hata/limit/çevrimdışı tek sheet (FinScanErrorSheet) ile
  // gösterilir — Alert.alert YOK. Kamera ve galeri aynı akışı paylaşır.
  // G19-S1: `retry` = FinErrFailed "Tekrar dene" → AYNI foto, AYNI anahtar (idempotent:
  // iade edilmiş hak yeniden ayrılır, sunucuda tamamlanmışsa önbellekten, hak düşmeden).
  /**
   * G29-S1 md.1: çıkartma analizle PARALEL başlar (sonucu beklemez). Desteklenmeyen cihaz /
   * hata / 1,5 sn aşımı → çıkartma yok (normal fotoğraf). Başka fotoğrafa geçildiyse geç gelen
   * sonuç yok sayılır.
   */
  const startStickerLift = (uri: string) => {
    liftUriRef.current = uri;
    setSticker(null);
    void liftSticker(uri).then((o) => {
      trackSticker(o);
      if (o.ok && mountedRef.current && liftUriRef.current === uri) setSticker(o.sticker);
    });
  };

  const runFinCapture = async (
    rawUri: string,
    source: 'camera' | 'gallery',
    retry = false,
    size?: ImageSize | null,
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    lastSourceRef.current = source;
    try {
      if (await aiBlocked(() => void runFinCapture(rawUri, source, retry, size))) return;
      // İlter 9 Kas: uzun kenar ≤ 1600 (expo-image-manipulator; native yoksa aynı URI).
      // Yeniden denemede foto zaten küçük → boyut verilmez, aynı URI = aynı anahtar.
      const uri = await shrinkForScan(rawUri, size);
      setPhotoUri(uri);
      setFailReason(null);
      startStickerLift(uri);
      const idempotencyKey = `${user?.id ?? 'anon'}-${uri}`;
      setScanRef(idempotencyKey);
      const hint = normalizeScanNote(scanNote);

      // md.4: dosya yok / 5 MB üstü → rezervasyon YOK (hak harcanmaz), belleğe okunmaz.
      const local = await checkLocalImage(uri);
      if (local !== 'ok') {
        trackScan('scan_fail', { code: local === 'too_large' ? 'image_too_large' : 'file_missing', stage: 'local', via: source });
        if (!mountedRef.current) return;
        setFailReason(local);
        setErrorKind('failed');
        return;
      }

      const net = await NetInfo.fetch();
      // isConnected null = henüz bilinmiyor (Android açılışı) → çevrimiçi say; gerçekten
      // bağlantı yoksa analiz 'network' hatasıyla düşer, hak iade edilir, Tekrar dene.
      const offline = net.isConnected === false;
      trackScan('scan_capture', { via: source, has_hint: !!hint, retry, offline });
      if (offline) {
        const stored = await persistQueuedImage(uri, idempotencyKey);
        await setPendingScanPhoto({
          id: idempotencyKey,
          imageUri: stored,
          mealType,
          queuedAt: new Date().toISOString(),
          lang: scanLang,
          ...(hint ? { hint } : {}),
        });
        const count = await getPendingScanCount();
        trackScan('scan_offline', { pending: count });
        if (!mountedRef.current) return;
        setPendingCount(count);
        setErrorKind('offline');
        return;
      }

      setStage('scanning');
      // G28-S1 md.4: bu anahtar (çevrimdışıyken kuyruğa alınmış olabilir) artık ön planda —
      // bağlantı dönüşü kuyruk aynı fotoğrafı İKİNCİ kez analiz edip başka sonuç yazmaz.
      claimPendingKey(idempotencyKey);
      try {
        const outcome = await runAiScan(getAiScanClient(), {
          idempotencyKey,
          imageRef: uri,
          lang: scanLang,
          ...(hint ? { hint } : {}),
        });
        if (outcome.status === 'ok') await adoptPendingEntry(idempotencyKey, uri);
        // G19-S4: sonuç → tam 1 olay (scan_success | scan_limit | scan_fail).
        trackScanOutcome(outcome, source);
        recordQuota(outcome.remaining, outcome.reset_at);
        recordAiQuota(outcome);
        if (outcome.status === 'quota_exhausted') {
          if (!mountedRef.current) return;
          setStage('viewfinder');
          showAiLimit(outcome);
          return;
        }
        if (outcome.status === 'unavailable') {
          // G19-S1 (İlter 9 Kas): acil kapatma / genel tavan — "hakkını kullandın" DEĞİL.
          if (!mountedRef.current) return;
          setStage('viewfinder');
          setErrorKind('unavailable');
          return;
        }
        if (outcome.status === 'failed') {
          if (!mountedRef.current) return;
          setStage('viewfinder');
          setErrorKind('failed');
          return;
        }
        if (!mountedRef.current) {
          // Kapatıldı: hak düştü, sonuç kaybolmasın → Tara yeniden açılınca gösterilir.
          if (user?.id) {
            keepOrphanResult({ userId: user.id, scanRef: idempotencyKey, photoUri: uri, note: hint ?? '', estimate: outcome.estimate });
          }
          return;
        }
        // FinMoScan: başarı animasyonu/sonucu YALNIZ gerçek sonuçtan sonra —
        // burada stage 'result' olana dek hiçbir optimistik gösterim yok.
        haptic('success'); // FinMoScan: medium (deklanşör) → success (sonuç)
        setResult(outcome.estimate);
        setSaved(false);
        setStage('result');
      } catch (e) {
        // G17-S2 md.6: rezervasyon (RPC) hatası da LOG + Sentry'ye gider.
        const info = scanFailureInfo(e, 'reserve');
        try {
          getAiScanClient().reportFailure?.(info);
        } catch {
          // teşhis akışı bozmaz
        }
        trackScan('scan_fail', { code: info.code, stage: info.stage, via: source });
        if (!mountedRef.current) return;
        setStage('viewfinder');
        setErrorKind('failed');
      } finally {
        releasePendingKey(idempotencyKey);
      }
    } finally {
      busyRef.current = false;
    }
  };

  const handleCaptureFin = async () => {
    if (busyRef.current) return;
    if (await aiBlocked(() => void handleCaptureFin())) return;
    const asset = await captureOnce();
    if (!asset?.uri) return;
    await runFinCapture(asset.uri, 'camera', false, asset);
  };

  // G19-S1 md.5: yeni kabukta galeri İZİN İSTEMEDEN açılır (iOS PHPicker / Android
  // Photo Picker izin gerektirmez; "sınırlı erişim" de sorun değil). Yalnız açılamazsa
  // izin istenir; reddedilirse Alert DEĞİL, toast (Ayarlar yolu metinde).
  const pickFromGalleryFin = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
    const open = () =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5, // G17-S1: edge sınırı 5 MB — yükleme boyutu
      });
    let picked: ImagePicker.ImagePickerResult;
    try {
      picked = await open();
    } catch {
      // G26-S1: seçici açılamazsa izin İSTENMEZ (sistem seçicisi izinsiz çalışır) → bilgi hâli.
      setGalleryDenied(true);
      return null;
    }
    if (picked.canceled || !picked.assets?.[0]?.uri) return null;
    return picked.assets[0];
  };

  const handleGalleryPick = async () => {
    if (busyRef.current || stage === 'scanning') return;
    if (await aiBlocked(() => void handleGalleryPick())) return;
    if (yeniKabuk) {
      const asset = await pickFromGalleryFin();
      if (!asset?.uri) return;
      await runFinCapture(asset.uri, 'gallery', false, asset);
      return;
    }
    const uri = await pickFromGallery();
    if (!uri) return;
    await runFinCapture(uri, 'gallery');
  };

  const handleCapture = yeniKabuk ? handleCaptureFin : handleCaptureLegacy;

  const handleSaveLegacy = async () => {
    if (!result || !user?.id || saving) return;
    setSaving(true);
    try {
      const legacyMeal = inferMealTypeFromHour(new Date().getHours());
      await saveAiScanEstimate(getSupabaseClient(), {
        userId: user.id,
        mealType: legacyMeal,
        sourceRef: scanRef ?? `${user.id}-${photoUri ?? ''}`,
        estimate: result,
      });
      trackScanLog(result, false, legacyMeal);
      setSaved(true);
      setLogToken((n) => n + 1); // Logla izi oynar
      setSavedToast(true);
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : t('ai_scan.failed'));
    } finally {
      setSaving(false);
    }
  };

  // G28-S1 md.1: tabak görünümü (FinPhotoResult) — uçuş başlangıcı.
  const plateRef = useRef<View | null>(null);
  // G30-S1 md.1: tam ekran fotoğraf kabı (kompakt sonuç) — uçan kopya tabak bölgesini bu kutudan kırpar.
  const photoRef = useRef<View | null>(null);
  /** Logladıktan sonra Tara kapanır: animasyonsuz (uçuş görünsün); azaltılmış harekette solarak. */
  const closeAfterLog = () => {
    if (!mountedRef.current) return;
    try {
      navigation.setOptions({ animation: reducedMotion ? 'fade' : 'none' });
      if (navigation.canGoBack()) navigation.goBack();
    } catch {
      // test/vitrin gezgini setOptions/canGoBack vermeyebilir — kayıt yine geçerli
    }
  };

  const handleSaveFin = async (adjusted: Omit<ScanEstimate, 'isEstimate'>) => {
    if (!user?.id || savingRef.current || saving || saved) return;
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      const ref = scanRef ?? `${user.id}-${photoUri ?? ''}`;
      const photoPath = scanRef ? scanImagePath(user.id, ref) : null;
      const row = await saveAiScanEstimate(getSupabaseClient(), {
        userId: user.id,
        mealType,
        sourceRef: ref,
        estimate: adjusted,
        // G28-S1 md.2: analiz için yüklenen fotoğraf → Ana sayfa satırının küçük görseli.
        photoPath,
      });
      // Sonuç → liste geçişinde AYNI kare (ağ beklemeden yerel foto).
      rememberLocalMealPhoto(photoPath, photoUri);
      savedRowIdRef.current = (row as { id?: string } | null)?.id ?? null;
      // G29-S1 md.1: çıkartma varsa satır hemen onu gösterir; yükleme + sticker_path ARKA PLANDA
      // (beklenmez — Logla izi ve ekran kapanışı gecikmez). Ses sonucunda çıkartma yok.
      const liftedSticker = resultSource === 'photo' && photoUri && liftUriRef.current === photoUri ? sticker : null;
      void saveStickerInBackground({ userId: user.id, rowId: savedRowIdRef.current, sticker: liftedSticker });
      trackScanLog(
        adjusted,
        !!result &&
          (Math.round(result.kcal) !== Math.round(adjusted.kcal) || result.ingredients.length !== adjusted.ingredients.length),
        mealType,
      );
      if (!mountedRef.current) return;
      setResult(adjusted);
      setSaved(true);
      const label = t(`meal.${mealType}`);
      // G21-S1 md.4: kabuk toast'ının "Geri al"ı bu Tara kaydını GERÇEKTEN siler; ekran
      // hâlâ açıksa "kaydedildi" durumu geri döner (yeniden loglanabilir).
      const rowId = savedRowIdRef.current;
      // G28-S1 md.1 — Logla izi A (FinMoLogA): tabak ölçülür → küçülüp Ana sayfa sekmesine uçar
      // (kök LogTraceHost), varışta +1 rozet + success + "Öğle'ye loglandı · Geri al · Gör".
      // Tara ekranı animasyonsuz kapanır ki uçuş sekme çubuğunun üstünde görünsün.
      // G29-S1 md.1: logla izinde uçan görsel çıkartma (kırpılmaz); yoksa tabak fotoğrafı (G28).
      // G30-S1 md.1: başlangıç = kaynağın GÖRÜNEN kutusu. Çıkartma: kalkış dönüşümü (−8, ×1,04;
      // azaltılmış harekette yok) ölçüme eklenir. Fotoğraf: tabak bölgesi + tam fotoğraf kutusu
      // (kopya alttaki pikselleri birebir kırpar). Sonra Tara, kopya ekrana gelince kapanır.
      const stickerBox = liftedSticker && stickerRef.current ? await measureRect(stickerRef.current) : null;
      const plateBox = stickerBox ? null : await measureRect(plateRef.current);
      const photoBox: Rect | null = plateBox && photoRef.current ? await measureRect(photoRef.current) : null;
      const startRect = stickerBox
        ? reducedMotion
          ? stickerBox
          : liftedRect(stickerBox, LIFT_SHIFT, LIFT_SCALE)
        : plateBox;
      await logTrace({
        rect: startRect,
        imageRect: photoBox,
        imageUri: stickerBox ? liftedSticker?.uri : photoUri, cutout: !!stickerBox,
        mealLabel: label, source: 'scan', kcal: adjusted.kcal, name: adjusted.name,
        id: rowId,
        undo: scanFlightUndo(getSupabaseClient, user.id, rowId, (ok) => {
          if (ok) forgetSticker(rowId);
          if (!ok || !mountedRef.current || savedRowIdRef.current !== rowId) return;
          savedRowIdRef.current = null;
          setSaved(false);
        }),
      });
      closeAfterLog();
    } catch {
      // G19-S1 md.1: önceden errorKind='failed' yazılıyordu ama sonuç ekranında hata
      // sayfası çizilmiyordu → kayıt hatası SESSİZDİ. Artık toast; logla yeniden denenebilir
      // (aynı source_ref → çift kayıt yok).
      if (mountedRef.current) setSaveFailed(true);
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  // G15-S2 (FinCollectCut): tek tabak sonucunda eatkcal menüsüyle eşleşme yüzdesi.
  const [matchPct, setMatchPct] = useState<number | null>(null);
  useEffect(() => {
    setMatchPct(null);
    if (!yeniKabuk || !result || result.ingredients.length > 1) return;
    let alive = true;
    fetchProducts()
      .then((list) => {
        if (alive) setMatchPct(bestMatchPercent(result.name, (list ?? []).map((p) => p.name)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [yeniKabuk, result]);

  // G15-S2 (FinPhotoR1 toast "Geri al"): az önce yazılan kendi kaydını siler.
  const savedRowIdRef = useRef<string | null>(null);
  const handleUndoFin = async () => {
    const id = savedRowIdRef.current;
    if (!id || !user?.id) return;
    const ok = await deleteScanConsumption(getSupabaseClient(), user.id, id);
    if (ok) {
      forgetSticker(id);
      savedRowIdRef.current = null;
      setSaved(false);
      // G21-S1 md.4: kabuk rozeti/toast'ı ve Ana sayfa vurgusu da geri alınsın.
      emitLogUndo({ id });
    }
  };

  const handleSave = () => {
    if (yeniKabuk && result) {
      void handleSaveFin(result);
      return;
    }
    void handleSaveLegacy();
  };

  const handleRetry = () => {
    setFailReason(null);
    setSaveFailed(false);
    setResult(null);
    setPhotoUri(null);
    liftUriRef.current = null;
    setSticker(null);
    setScanNote(''); // yeni çekim = yeni not (yeniden analiz hakkı yok)
    setErrorKind(null);
    setStage('viewfinder');
  };

  const handleManualEntry = () => {
    setLimitVisible(false);
    setErrorKind(null);
    void clearPendingScanPhoto();
    // G21-S1 md.8 (#D2): yeni kabukta "Elle gir/ekle" Ana sayfaya dönüp elle giriş sheet'ini
    // AÇAR (önce yalnız geri dönüyordu). Eski kabuk bugünkü gibi geri döner (parite).
    if (yeniKabuk) {
      (navigation as unknown as { navigate: (n: string, p?: object) => void }).navigate('Tabs', {
        screen: 'Tracker',
        params: { finOpenManual: true },
      });
      return;
    }
    navigation.goBack();
  };

  // ── G21-S1 md.2 — Barkod → Open Food Facts (yalnız yeni kabuk canlı kamera) ──
  // AI hakkı TÜKETMEZ (rezervasyon/analiz yok); fotoğraf gönderilmez. Bulunursa mevcut
  // sonuç düzeninin barkod kipi (FinBarcodeResult), bulunamazsa FinScanError düzeni.
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodeCode, setBarcodeCode] = useState<string | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<BarcodeResultProduct | null>(null);
  const [cameraMode, setCameraMode] = useState<ScanCameraMode>('photo');
  const [cameraModeKey, setCameraModeKey] = useState(0);
  const barcodeBusyRef = useRef(false);
  const barcodeRefRef = useRef<string | null>(null);
  const barcodeRowIdRef = useRef<string | null>(null);

  const handleBarcode = async (code: string) => {
    if (barcodeBusyRef.current) return;
    barcodeBusyRef.current = true;
    setBarcodeBusy(true);
    setBarcodeCode(code);
    setCameraMode('barcode');
    try {
      const net = await NetInfo.fetch().catch(() => null);
      const offline = net?.isConnected === false;
      trackScan('barcode_scan', { offline });
      const res = await lookupBarcode(code, { offline });
      if (!mountedRef.current) return;
      if (res.status === 'found') {
        trackScan('barcode_found', { cached: res.cached, has_serving: res.product.servingGrams != null });
        // G22-S1 md.5: günlük barkod hakkı (bulunan ürün sayılır; aynı gün aynı kod bir kez).
        const q = await reserveBarcode(res.product.code || code);
        if (!mountedRef.current) return;
        if (q.snapshot) noteQuota(q.snapshot);
        if (!q.allowed) {
          trackSub('barcode_limit');
          setSubLimit({ kind: 'barcode' });
          return;
        }
        barcodeRefRef.current = `barcode-${code}-${Date.now()}`;
        barcodeRowIdRef.current = null;
        setSaved(false);
        setSaveFailed(false);
        setBarcodeProduct({
          code: res.product.code,
          name: productDisplayName(res.product, scanLang),
          brand: res.product.brand,
          imageUrl: res.product.imageUrl,
          per100: res.product.per100,
          servingGrams: res.product.servingGrams,
        });
        haptic('success');
        return;
      }
      trackScan('barcode_not_found', { reason: res.reason });
      setErrorKind(
        res.status === 'not_found'
          ? res.reason === 'no_kcal'
            ? 'barcode_nokcal'
            : 'barcode_missing'
          : res.reason === 'offline'
            ? 'barcode_offline'
            : 'barcode_error',
      );
    } finally {
      barcodeBusyRef.current = false;
      if (mountedRef.current) setBarcodeBusy(false);
    }
  };

  const handleSaveBarcode = async (estimate: Omit<ScanEstimate, 'isEstimate'>) => {
    if (!user?.id || !barcodeProduct || savingRef.current || saving || saved) return;
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      const row = await saveAiScanEstimate(getSupabaseClient(), {
        userId: user.id,
        mealType,
        sourceRef: barcodeRefRef.current ?? `barcode-${barcodeProduct.code}-${Date.now()}`,
        estimate,
        source: 'barcode',
      });
      const rowId = (row as { id?: string } | null)?.id ?? null;
      barcodeRowIdRef.current = rowId;
      trackBarcodeLog(estimate, mealType);
      if (!mountedRef.current) return;
      setSaved(true);
      // G28-S1 md.1: ortak Logla izi (barkod sonucunda tabak görseli yok → uçuşsuz rozet + toast).
      await logTrace({
        imageUri: barcodeProduct.imageUrl, mealLabel: t(`meal.${mealType}`), source: 'scan',
        kcal: estimate.kcal, name: estimate.name,
        id: rowId,
        undo: scanFlightUndo(getSupabaseClient, user.id, rowId, (ok) => {
          if (!ok || !mountedRef.current || barcodeRowIdRef.current !== rowId) return;
          barcodeRowIdRef.current = null;
          setSaved(false);
        }),
      });
      closeAfterLog();
    } catch {
      if (mountedRef.current) setSaveFailed(true);
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  const closeBarcodeResult = () => {
    setBarcodeProduct(null);
    setSaved(false);
    setSaveFailed(false);
    setCameraMode('barcode');
  };

  // Android geri: barkod sonucundan kameraya (Tara'yı kapatmaz).
  useEffect(() => {
    if (!barcodeProduct) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeBarcodeResult();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodeProduct]);

  const barcodePhotoScan = () => {
    setErrorKind(null);
    setCameraMode('photo');
    setCameraModeKey((n) => n + 1);
  };

  // ── G22-S1 md.1/md.4 — Ses modu + kcalAI hakları ─────────────────────────
  const subEnabled = useSubscriptionEnabled();
  const { tier } = useTier();
  const subLimits = useSubscriptionStore((s) => s.limits);
  const aiQ = useSubscriptionStore((s) => s.ai);
  const barcodeQ = useSubscriptionStore((s) => s.barcode);
  const { cards: planCards } = usePlanCards(subEnabled);
  const [subLimit, setSubLimit] = useState<null | { kind: 'ai' | 'barcode' }>(null);
  const fresh = (q: QuotaSnapshot | null) => (q && (!q.resetAt || Date.parse(q.resetAt) > Date.now()) ? q : null);
  const aiSnap = fresh(aiQ);
  const bcSnap = fresh(barcodeQ);
  // Hak hapı: sunucu kademeli yanıt verdiyse N/limit (2 · 10 · 50); G19 sunucusunda eski tavanla.
  const aiBase = aiSnap ?? (remaining != null ? { kind: 'ai' as const, remaining, limit: null, unlimited: false } : null);
  const aiPillText = pillLabel(aiBase, t, SCAN_QUOTA_CAP);
  const aiPill = aiPillText ? { text: aiPillText, a11y: pillA11y(aiBase, t, SCAN_QUOTA_CAP) } : null;
  const bcPillText = pillLabel(bcSnap, t);
  const bcPill = bcPillText ? { text: bcPillText, a11y: pillA11y(bcSnap, t) } : null;
  const aiCap = aiSnap?.limit ?? null;

  function recordAiQuota(o: AiScanOutcome) {
    useSubscriptionStore.getState().recordQuota({
      kind: 'ai',
      tier: o.quota?.tier ?? null,
      remaining: o.remaining,
      limit: o.quota?.limit ?? null,
      unlimited: !!o.quota?.unlimited,
      resetAt: o.reset_at,
    });
  }
  function showAiLimit(o: AiScanOutcome) {
    // Abonelik açık → FinSubLimitAI; kapalı → mevcut FinErrLimit (parite).
    if (subEnabled) setSubLimit({ kind: 'ai' });
    else setErrorKind('limit');
  }
  const openPaywall = (from: string) => {
    setSubLimit(null);
    (navigation as unknown as { navigate: (n: string, p?: object) => void }).navigate('SubPaywall', { from });
  };

  const voiceAvailable = useMemo(() => yeniKabuk && !!loadSpeech() && !!getAiScanClient().analyzeText, [yeniKabuk]);
  const [inputMode, setInputMode] = useState<'camera' | 'voice'>('camera');
  const [resultSource, setResultSource] = useState<'photo' | 'voice'>('photo');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const voiceResumeRef = useRef<() => void>(() => {});
  const voice = useVoiceScan({
    active: yeniKabuk && inputMode === 'voice' && stage !== 'result',
    userId: user?.id ?? null,
    lang: scanLang,
    mealType,
    aiBlocked: () => aiBlocked(() => voiceResumeRef.current()),
    onOutcome: (o) => {
      recordQuota(o.remaining, o.reset_at);
      recordAiQuota(o);
    },
    onUnavailable: () => setErrorKind('unavailable'),
    onResult: ({ estimate, key, transcript }) => {
      if (!mountedRef.current) {
        if (user?.id) keepOrphanResult({ userId: user.id, scanRef: key, photoUri: '', note: '', estimate });
        return;
      }
      haptic('success');
      setPhotoUri(null);
      setScanRef(key);
      setScanNote('');
      setResultSource('voice');
      setVoiceTranscript(transcript);
      setResult(estimate);
      setSaved(false);
      setStage('result');
    },
  });
  voiceResumeRef.current = voice.resume;
  const switchInput = (m: ScanInputMode) => {
    if (m === 'manual') {
      voice.reset();
      handleManualEntry();
      return;
    }
    if (m === 'voice') {
      setInputMode('voice');
      return;
    }
    voice.reset();
    setInputMode('camera');
    setCameraMode(m === 'barcode' ? 'barcode' : 'photo');
    setCameraModeKey((n) => n + 1);
  };

  const subLimitEl = (
    <SubLimitSheet
      visible={subLimit !== null}
      kind={subLimit?.kind ?? 'ai'}
      limits={subLimits}
      tier={tier}
      cap={subLimit?.kind === 'barcode' ? bcSnap?.limit ?? null : aiCap}
      prices={{ fresh: monthlyPriceOf(planCards, 'fresh'), balance: monthlyPriceOf(planCards, 'balance') }}
      plansEnabled={subEnabled}
      onPlans={() => openPaywall(subLimit?.kind === 'barcode' ? 'limit_barcode' : 'limit_ai')}
      onManual={() => {
        setSubLimit(null);
        handleManualEntry();
      }}
      onClose={() => setSubLimit(null)}
    />
  );

  const aiSheetEl = (
    <ConsentSheet
      visible={aiSheet}
      mode="ai_photo"
      busy={aiBusy}
      onConfirm={() => {
        if (aiBusy) return;
        setAiBusy(true);
        void setAiPhotoConsent(true, 'scan')
          .catch(() => {})
          .finally(() => {
            aiConsentRef.current = 'ok';
            setAiBusy(false);
            setAiSheet(false);
            const next = aiPendingRef.current;
            aiPendingRef.current = null;
            next?.();
          });
      }}
      onClose={() => {
        setAiSheet(false);
        aiPendingRef.current = null;
        void setAiPhotoConsent(false, 'scan').catch(() => {});
        handleManualEntry();
      }}
      onPrivacy={() => {
        // G24-S1 (FinScanAIConsent): "Gizlilik Politikası" — izin kaydı YAZILMAZ, sheet kapanır
        // (bir sonraki taramada yeniden sorulur).
        setAiSheet(false);
        aiPendingRef.current = null;
        // G28-S1 md.7: legal.eatkcal.com gizlilik; açılamazsa uygulama içi metin.
        void openLegalWeb('privacy', lang, () =>
          (navigation as unknown as { navigate: (n: string, p: object) => void }).navigate('ProfileContracts', { slug: LEGAL_SLUG.privacy }),
        );
      }}
    />
  );

  const shareData: PlateXRayData | null = result
    ? {
        photoUri,
        mealName: result.name,
        totalKcal: result.kcal,
        items: result.ingredients.map((i) => ({ name: i.name, kcal: i.kcal ?? null })),
        handle: null,
      }
    : null;

  if (yeniKabuk) {
    // G21-S1 md.2: barkod sonucu (Open Food Facts) — mevcut sonuç düzeninin barkod kipi.
    if (barcodeProduct) {
      return (
        <View style={styles.fill}>
          <FinBarcodeResult
            product={barcodeProduct}
            mealType={mealType}
            saving={saving}
            saved={saved}
            onChangeMealType={setMealType}
            onSave={(e) => void handleSaveBarcode(e)}
            onClose={closeBarcodeResult}
          />
          {saveFailed ? (
            <View style={styles.toastLayer} pointerEvents="box-none">
              <Toast visible={saveFailed} message={t('ai_scan.save_failed')} onDismiss={() => setSaveFailed(false)} autoHideMs={3200} />
            </View>
          ) : null}
        </View>
      );
    }
    if (stage === 'result' && result) {
      return (
        <View style={styles.fill}>
        <FinPhotoResult
          estimate={result}
          photoUri={photoUri}
          plateRef={plateRef}
          photoRef={photoRef}
          sticker={resultSource === 'photo' ? sticker : null}
          stickerRef={stickerRef}
          mealType={mealType}
          saving={saving}
          saved={saved}
          lang={lang as NumLang}
          onChangeMealType={setMealType}
          onSave={handleSaveFin}
          onRetry={() => {
            if (resultSource === 'voice') {
              // Geri → ses ekranı (yeni söyleyiş).
              setResult(null);
              setSaved(false);
              setResultSource('photo');
              voice.reset();
              setStage('viewfinder');
              return;
            }
            handleRetry();
          }}
          source={resultSource}
          transcript={resultSource === 'voice' ? voiceTranscript : undefined}
          onUndo={() => void handleUndoFin()}
          onView={() => navigation.goBack()}
          onAddToPlan={(a) =>
            schedulePlanReminder({ title: t('ai_scan.plan_title'), body: `${a.name}, ${Math.round(a.kcal)} kcal` })
          }
          onSaveMeal={async (a) => {
            await saveMealToCollection(a.name);
          }}
          match={matchPct}
          note={normalizeScanNote(scanNote)}
        />
        {saveFailed ? (
          <View style={styles.toastLayer} pointerEvents="box-none">
            <Toast visible={saveFailed} message={t('ai_scan.save_failed')} onDismiss={() => setSaveFailed(false)} autoHideMs={3200} />
          </View>
        ) : null}
        </View>
      );
    }
    if (inputMode === 'voice') {
      return (
        <View style={styles.fill}>
          <FinScanVoice
            phase={voice.phase}
            transcript={voice.transcript}
            interim={voice.interim}
            level={voice.level}
            pillText={aiPill?.text ?? null}
            pillA11y={aiPill?.a11y ?? null}
            offlineCount={voice.offlineCount}
            plansEnabled={subEnabled}
            limitCap={aiCap ?? (remaining != null ? SCAN_QUOTA_CAP : null)}
            modesLocked={voice.phase === 'processing'}
            onClose={() => navigation.goBack()}
            onMode={switchInput}
            onMic={voice.mic}
            onDone={voice.done}
            onCancel={voice.cancel}
            onKeyboardSubmit={voice.submitText}
            onPermContinue={() => void voice.permContinue()}
            onPermLater={() => switchInput('photo')}
            onOpenSettings={() => {
              voice.dismiss();
              void Linking.openSettings();
            }}
            onRetry={voice.retry}
            onOfflineOk={() => navigation.goBack()}
            onPlans={() => openPaywall('limit_voice')}
            onManual={() => switchInput('manual')}
          />
          <FinScanErrorSheet
            visible={errorKind === 'unavailable'}
            kind="unavailable"
            remaining={remaining ?? 0}
            pendingCount={pendingCount}
            photoUri={null}
            onClose={() => setErrorKind(null)}
            onManualEntry={handleManualEntry}
            onRetry={() => setErrorKind(null)}
            onOpenSettings={() => setErrorKind(null)}
            onGallery={() => setErrorKind(null)}
          />
          {aiSheetEl}
        </View>
      );
    }
    return (
      <View style={styles.fill}>
        {/* G17-S2 — FinScanR2 CANLI kamera + FinMoScan analiz katmanı (aynı ekran). */}
        {liveCam ? (
          <FinScanCamera
            cam={liveCam}
            remaining={remaining}
            analyzing={stage === 'scanning'}
            photoUri={photoUri}
            paused={errorKind !== null || aiSheet || subLimit !== null}
            onClose={() => navigation.goBack()}
            onCaptured={(uri, size) => void runFinCapture(uri, 'camera', false, size)}
            onGallery={handleGalleryPick}
            onManual={handleManualEntry}
            onPermissionDenied={() => setErrorKind('camera')}
            onPermissionGranted={() => setErrorKind((k) => (k === 'camera' ? null : k))}
            note={scanNote}
            onNoteChange={setScanNote}
            onBarcode={(code) => void handleBarcode(code)}
            barcodeBusy={barcodeBusy}
            initialMode={cameraMode}
            modeKey={cameraModeKey}
            onVoice={voiceAvailable ? () => switchInput('voice') : undefined}
            quotaPills={{ photo: aiPill, barcode: bcPill }}
          />
        ) : (
          // Eski derleme (ExpoCamera native modülü yok) — G15-S2/G17-S1 düzeni yedek.
          <FinScanViewfinder
            remaining={remaining}
            scanning={stage === 'scanning'}
            onClose={() => navigation.goBack()}
            onCapture={handleCapture}
            onGallery={handleGalleryPick}
            onManual={handleManualEntry}
          />
        )}

        <FinScanErrorSheet
          visible={errorKind !== null}
          kind={errorKind ?? 'failed'}
          remaining={remaining ?? 0}
          pendingCount={pendingCount}
          photoUri={photoUri}
          reason={failReason === 'too_large' ? 'too_large' : failReason === 'missing' ? 'missing' : undefined}
          onClose={() => {
            // FinScanOffline: çevrimdışı kuyruğa alındı → sade durum ekranı.
            if (errorKind === 'offline') navigation.replace('AiScanOffline');
            else setErrorKind(null);
          }}
          onManualEntry={handleManualEntry}
          limitCap={aiCap ?? (remaining != null ? SCAN_QUOTA_CAP : null)}
          barcode={barcodeCode}
          onPhotoScan={barcodePhotoScan}
          onRetry={() => {
            // G21-S1 md.2: barkod sorgusu (zaman aşımı/ağ) aynı kodla yeniden.
            if (errorKind === 'barcode_error') {
              setErrorKind(null);
              if (barcodeCode) void handleBarcode(barcodeCode);
              return;
            }
            // G19-S1 md.1: "Fotoğrafın duruyor; tekrar denediğinde baştan çekmen gerekmez" —
            // önceden yalnız sayfayı kapatıyordu (yeniden çekim gerekiyordu). Artık aynı foto
            // yeniden analiz edilir. Dosya sorunu (büyük/yok) → yeni çekim.
            setErrorKind(null);
            if (photoUri && !failReason) void runFinCapture(photoUri, lastSourceRef.current, true);
            else {
              setFailReason(null);
              setPhotoUri(null);
            }
          }}
          onOpenSettings={() => {
            setErrorKind(null);
            void Linking.openSettings();
          }}
          onGallery={() => {
            setErrorKind(null);
            void handleGalleryPick();
          }}
        />

        {aiSheetEl}
        {subLimitEl}

        {galleryDenied ? (
          <View style={styles.toastLayer} pointerEvents="box-none">
            <Toast visible={galleryDenied} message={t('ai_scan.gallery_denied')} onDismiss={() => setGalleryDenied(false)} autoHideMs={3200} />
          </View>
        ) : null}

        {pendingToast ? (
          <View style={styles.toastLayer} pointerEvents="box-none">
            <Toast
              visible={pendingToast}
              message={t('ai_scan.logged_to_meal', { meal: t(`meal.${pendingMeal ?? mealType}`) })}
              onDismiss={() => setPendingToast(false)}
              autoHideMs={2600}
            />
          </View>
        ) : null}
      </View>
    );
  }

  if (stage === 'result' && result) {
    return (
      <View style={styles.resultContainer}>
        <View style={[styles.resultHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={24} color="#0A0A0A" />
          </TouchableOpacity>
          <Text style={styles.resultTitle}>{t('ai_scan.result_title')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.estimateBadge}>{t('common.estimate').toUpperCase()}</Text>
        <Text style={styles.resultName}>{result.name}</Text>

        {/* Makro kartı — kcal RollingNumber + P/K/Y hapları (sayı yuvarlanması). */}
        <View style={styles.kcalRow}>
          <RollingNumber value={Math.round(result.kcal)} lang={lang as NumLang} fontSize={34} weight="700" color="#0A0A0A" />
          <Text style={styles.kcalUnit}>kcal</Text>
        </View>
        <View style={styles.macroPills}>
          <MacroPill label="P" value={Math.round(result.protein_g)} lang={lang as NumLang} />
          <MacroPill label="K" value={Math.round(result.carbs_g)} lang={lang as NumLang} />
          <MacroPill label="Y" value={Math.round(result.fat_g)} lang={lang as NumLang} />
        </View>

        {result.ingredients.length > 0 ? (
          <View style={styles.tagRow}>
            {result.ingredients.map((ing, i) => (
              <View key={`${ing.name}-${i}`} style={styles.tag}>
                <Text style={styles.tagText}>
                  {ing.name}
                  {ing.kcal != null ? ` (${Math.round(ing.kcal)} kcal)` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.resultHint}>{t('ai_scan.result_estimate')}</Text>

        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
          <ArrowCounterClockwise size={18} color="#0A0A0A" />
          <Text style={styles.retryText}>{t('ai_scan.retry')}</Text>
        </TouchableOpacity>

        {paylasimKarti ? (
          <TouchableOpacity style={styles.shareBtn} onPress={() => setShareVisible(true)} activeOpacity={0.85}>
            <Text style={styles.shareBtnText}>{t('ai_scan.share_card')}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, (saving || saved) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || saved}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#0A0A0A" />
          ) : (
            <Text style={styles.saveBtnText}>
              {saved ? t('ai_scan.saved_toast') : t('ai_scan.save_to_day')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Logla izi (Günüme ekle sonrası) — mutlak katman, yerleşimi bozmaz. */}
        {logToken > 0 ? (
          <View pointerEvents="none" style={styles.trailLayer}>
            <LogTrail playToken={logToken} width={300} height={120} label={result.name} />
          </View>
        ) : null}
        <View style={styles.toastLayer} pointerEvents="box-none">
          <Toast
            visible={savedToast}
            message={t('ai_scan.saved_toast')}
            onDismiss={() => setSavedToast(false)}
            autoHideMs={2600}
          />
        </View>

        {paylasimKarti ? (
          <PlateXRayShareModal
            visible={shareVisible}
            onClose={() => setShareVisible(false)}
            data={shareData}
            seed={photoUri ?? undefined}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.viewfinder}>
      <View style={styles.cameraPlaceholder} />
      <ScanFrame active={stage === 'scanning'} />
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={[styles.chipWrap, { top: insets.top + 16 }]}>
        <ScanQuotaChip remaining={remaining} />
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(28, insets.bottom + 8) }]}>
        {stage === 'scanning' ? (
          <View style={styles.scanningWrap}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.scanningText}>{t('ai_scan.scanning')}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.shutter} onPress={handleCapture} activeOpacity={0.85}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        )}
      </View>

      <ScanLimitSheet
        visible={limitVisible}
        cap={aiCap ?? SCAN_QUOTA_CAP}
        onClose={() => setLimitVisible(false)}
        onManualEntry={handleManualEntry}
      />
      {aiSheetEl}
    </View>
  );
}

function MacroPill({ label, value, lang }: { label: string; value: number; lang: NumLang }) {
  return (
    <View style={styles.macroPill}>
      <Text style={styles.macroPillLabel}>{label}</Text>
      <RollingNumber value={value} lang={lang} fontSize={14} weight="700" color="#0A0A0A" />
      <Text style={styles.macroPillUnit}>g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  viewfinder: { flex: 1, backgroundColor: '#2C2C2E' },
  fill: { flex: 1 },
  cameraPlaceholder: { flex: 1 },
  topBar: { position: 'absolute', left: 8, flexDirection: 'row' },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(28,28,30,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  chipRow: { position: 'absolute', left: 0, right: 56, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  frameHint: {
    position: 'absolute',
    top: '42%',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
  },
  shutterRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  galleryBtn: { width: 64, alignItems: 'center', gap: 4 },
  galleryBtnText: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  scanningWrap: { alignItems: 'center', gap: 8 },
  scanningText: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },

  resultContainer: { flex: 1, backgroundColor: '#F3F4F6', paddingHorizontal: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  resultTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#0A0A0A' },
  estimateBadge: {
    alignSelf: 'flex-start',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: '#6B6B70',
    marginTop: 8,
  },
  resultName: { marginTop: 4, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: '#0A0A0A' },
  kcalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 6 },
  kcalUnit: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: '#6B6B70', marginBottom: 4 },
  macroPills: { flexDirection: 'row', gap: 8, marginTop: 10 },
  macroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  macroPillLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#6B6B70', marginRight: 2 },
  macroPillUnit: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#6B6B70' },
  trailLayer: { position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center' },
  toastLayer: { position: 'absolute', top: 60, left: 16, right: 16, zIndex: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#FFFFFF' },
  tagText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#0A0A0A' },
  resultHint: { marginTop: 16, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#6B6B70' },
  retryBtn: {
    marginTop: 24,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#C3C7CC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retryText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#0A0A0A' },
  shareBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#0A0A0A' },
  saveBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#C6F04F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#0A0A0A' },
});
