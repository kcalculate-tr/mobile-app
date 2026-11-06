// T20Scan — AI fotoğraf tarama ekranı (G6-S4 md.3). `ai_tarama` bayrağı
// arkasında; giriş noktası TrackerScreen'deki "AI ile tara" butonu (bayrak
// kapalıyken o buton hiç render olmaz, bu ekrana hiç erişilmez).
//
// Canlı kamera önizlemesi YOK: `expo-camera` paketi kurulu değil ve RULES.md
// yeni paket kurulmasını yasaklıyor. Bunun yerine mevcut `expo-image-picker`
// ile native kamerayı açıyoruz (profildeki galeri seçimiyle aynı paket,
// bkz. src/screens/ProfileScreen.tsx) — tasarımdaki vitrin/çerçeve zemini
// statik kalır, deklanşöre basınca sistem kamerası açılır.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
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
import { useScanQuotaStore } from '../quotaStore';
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
import { bestMatchPercent, saveMealToCollection, schedulePlanReminder } from '../mealActions';
import { fetchProducts } from '../../../../lib/products';
import { setPendingScanPhoto, clearPendingScanPhoto, getPendingScanCount } from '../offlineQueue';
import { processPendingQueue } from '../pendingProcessor';
import { emitLogFlight } from '../logFlight';
import { useFeature } from '../../../../core/flags';
import { FinChip } from '../../../profil/ui/finUi';
import PlateXRayShareModal from '../../../../components/share/PlateXRayShareModal';
import type { PlateXRayData } from '../../../../components/share/PlateXRayShareCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Stage = 'viewfinder' | 'scanning' | 'result';

export default function ScanScreen() {
  const navigation = useNavigation<Nav>();
  const { t, lang } = useT();
  const { user } = useAuth();
  const paylasimKarti = useFeature('paylasim_karti');

  const remaining = useScanQuotaStore((s) => s.remaining);
  const recordQuota = useScanQuotaStore((s) => s.recordQuota);
  // G12-S4 — yeni kabuk Tara (FinScanR2/FinPhotoR1). Bayrak kapalıyken bu
  // değişkenin TÜM etkisi sıfırdır: aşağıdaki JSX dallarından yalnız eski dal
  // render olur, yeni state'ler hiç okunmaz/yazılmaz.
  const yeniKabuk = useFeature('yeni_kabuk');

  const [stage, setStage] = useState<Stage>('viewfinder');
  const [limitVisible, setLimitVisible] = useState(false);
  const [result, setResult] = useState<Omit<ScanEstimate, 'isEstimate'> | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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

  const insets = useSafeAreaInsets();

  // Çevrimdışı bekleyen fotoğraflar (G16-S1): ekran açılışında ve bağlantı
  // geri geldiğinde kuyruk SIRAYLA analiz edilir (processPendingQueue); hak
  // yalnız başarılı analizde düşer, başarısız/kota biten girdi kuyrukta kalır.
  // "Tek kayıt": elle giriş kuyruğu zaten boşaltmış olabilir.
  useEffect(() => {
    if (!yeniKabuk || !user?.id) return;
    let cancelled = false;
    let running = false;
    const drain = async () => {
      if (running) return;
      running = true;
      try {
        const res = await processPendingQueue({
          client: getAiScanClient(),
          isCancelled: () => cancelled,
          save: (entry, estimate) =>
            saveAiScanEstimate(getSupabaseClient(), {
              userId: user.id,
              mealType: entry.mealType,
              sourceRef: entry.id,
              estimate,
            }),
        });
        if (cancelled) return;
        if (res.lastOutcome) recordQuota(res.lastOutcome.remaining, res.lastOutcome.reset_at);
        for (const p of res.processed) {
          emitLogFlight({ x: 0, y: 0, w: 0, h: 0, imageUri: p.entry.imageUri, mealLabel: t(`meal.${p.entry.mealType}`) });
        }
        if (res.processed.length > 0) {
          setPendingMeal(res.processed[res.processed.length - 1].entry.mealType);
          setPendingToast(true);
        }
      } catch {
        // Ağ yine kesildi — kuyrukta kalsın.
      } finally {
        running = false;
      }
    };
    const unsub = NetInfo.addEventListener((s) => {
      if (s.isConnected) void drain();
    });
    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yeniKabuk, user?.id]);

  const captureOnce = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      // G15-S2: yeni kabukta "Kameraya erişim kapalı" ayrı durum (FinScanError);
      // bayrak kapalıyken bugünkü uyarı aynen.
      if (yeniKabuk) setErrorKind('camera');
      else Alert.alert(t('ai_scan.permission_denied'));
      return null;
    }
    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return null;
    return picked.assets[0].uri;
  };

  const handleCaptureLegacy = async () => {
    const uri = await captureOnce();
    if (!uri) return;
    setPhotoUri(uri);
    setStage('scanning');
    const idempotencyKey = `${user?.id ?? 'anon'}-${uri}`;
    setScanRef(idempotencyKey);
    const outcome = await runAiScan(getAiScanClient(), { idempotencyKey, imageRef: uri });
    recordQuota(outcome.remaining, outcome.reset_at);

    if (outcome.status === 'quota_exhausted') {
      setStage('viewfinder');
      setLimitVisible(true);
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
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('ai_scan.permission_denied'));
      return null;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return null;
    return picked.assets[0].uri;
  };

  // Yeni kabuk — çevrimdışıysa hiç rezervasyon denemeden kuyruğa al (hak
  // harcanmasın); hata/limit/çevrimdışı tek sheet (FinScanErrorSheet) ile
  // gösterilir — Alert.alert YOK. Kamera ve galeri aynı akışı paylaşır.
  const runFinCapture = async (uri: string) => {
    setPhotoUri(uri);
    const net = await NetInfo.fetch();
    const idempotencyKey = `${user?.id ?? 'anon'}-${uri}`;
    setScanRef(idempotencyKey);

    if (!net.isConnected) {
      await setPendingScanPhoto({ id: idempotencyKey, imageUri: uri, mealType, queuedAt: new Date().toISOString() });
      setPendingCount(await getPendingScanCount());
      setErrorKind('offline');
      return;
    }

    setStage('scanning');
    try {
      const outcome = await runAiScan(getAiScanClient(), { idempotencyKey, imageRef: uri });
      recordQuota(outcome.remaining, outcome.reset_at);
      if (outcome.status === 'quota_exhausted') {
        setStage('viewfinder');
        setErrorKind('limit');
        return;
      }
      if (outcome.status === 'failed') {
        setStage('viewfinder');
        setErrorKind('failed');
        return;
      }
      // FinMoScan: başarı animasyonu/sonucu YALNIZ gerçek sonuçtan sonra —
      // burada stage 'result' olana dek hiçbir optimistik gösterim yok.
      setResult(outcome.estimate);
      setSaved(false);
      setStage('result');
    } catch {
      setStage('viewfinder');
      setErrorKind('failed');
    }
  };

  const handleCaptureFin = async () => {
    const uri = await captureOnce();
    if (!uri) return;
    await runFinCapture(uri);
  };

  const handleGalleryPick = async () => {
    const uri = await pickFromGallery();
    if (!uri) return;
    await runFinCapture(uri);
  };

  const handleCapture = yeniKabuk ? handleCaptureFin : handleCaptureLegacy;

  const handleSaveLegacy = async () => {
    if (!result || !user?.id || saving) return;
    setSaving(true);
    try {
      await saveAiScanEstimate(getSupabaseClient(), {
        userId: user.id,
        mealType: inferMealTypeFromHour(new Date().getHours()),
        sourceRef: scanRef ?? `${user.id}-${photoUri ?? ''}`,
        estimate: result,
      });
      setSaved(true);
      setLogToken((n) => n + 1); // Logla izi oynar
      setSavedToast(true);
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : t('ai_scan.failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFin = async (adjusted: Omit<ScanEstimate, 'isEstimate'>) => {
    if (!user?.id || saving || saved) return;
    setSaving(true);
    try {
      const row = await saveAiScanEstimate(getSupabaseClient(), {
        userId: user.id,
        mealType,
        sourceRef: scanRef ?? `${user.id}-${photoUri ?? ''}`,
        estimate: adjusted,
      });
      savedRowIdRef.current = (row as { id?: string } | null)?.id ?? null;
      setResult(adjusted);
      setSaved(true);
      const label = t(`meal.${mealType}`);
      emitLogFlight({ x: 0, y: 0, w: 0, h: 0, imageUri: photoUri, mealLabel: label });
    } catch {
      setErrorKind('failed');
    } finally {
      setSaving(false);
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
    const { error } = await getSupabaseClient()
      .from('meal_consumptions')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id);
    if (!error) {
      savedRowIdRef.current = null;
      setSaved(false);
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
    setResult(null);
    setPhotoUri(null);
    setErrorKind(null);
    setStage('viewfinder');
  };

  const handleManualEntry = () => {
    setLimitVisible(false);
    setErrorKind(null);
    void clearPendingScanPhoto();
    navigation.goBack();
  };

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
    if (stage === 'result' && result) {
      return (
        <FinPhotoResult
          estimate={result}
          photoUri={photoUri}
          mealType={mealType}
          saving={saving}
          saved={saved}
          lang={lang as NumLang}
          onChangeMealType={setMealType}
          onSave={handleSaveFin}
          onRetry={handleRetry}
          onUndo={() => void handleUndoFin()}
          onView={() => navigation.goBack()}
          onAddToPlan={(a) =>
            schedulePlanReminder({ title: t('ai_scan.plan_title'), body: `${a.name} · ${Math.round(a.kcal)} kcal` })
          }
          onSaveMeal={async (a) => {
            await saveMealToCollection(a.name);
          }}
          match={matchPct}
        />
      );
    }
    return (
      <View style={styles.fill}>
        {/* G15-S2 — FinScanR2 düzeni: alt mod çubuğu, lime deklanşör, hak hapı, flaş. */}
        <FinScanViewfinder
          remaining={remaining}
          scanning={stage === 'scanning'}
          onClose={() => navigation.goBack()}
          onCapture={handleCapture}
          onGallery={handleGalleryPick}
          onManual={handleManualEntry}
        />

        <FinScanErrorSheet
          visible={errorKind !== null}
          kind={errorKind ?? 'failed'}
          remaining={remaining ?? 0}
          pendingCount={pendingCount}
          photoUri={photoUri}
          onClose={() => setErrorKind(null)}
          onManualEntry={handleManualEntry}
          onRetry={() => setErrorKind(null)}
          onOpenSettings={() => {
            setErrorKind(null);
            void Linking.openSettings();
          }}
          onGallery={() => {
            setErrorKind(null);
            void handleGalleryPick();
          }}
        />

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
                  {ing.kcal != null ? ` · ${Math.round(ing.kcal)} kcal` : ''}
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
        onClose={() => setLimitVisible(false)}
        onManualEntry={handleManualEntry}
      />
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
