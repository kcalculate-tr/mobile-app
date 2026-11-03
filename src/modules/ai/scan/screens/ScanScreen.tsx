// T20Scan — AI fotoğraf tarama ekranı (G6-S4 md.3). `ai_tarama` bayrağı
// arkasında; giriş noktası TrackerScreen'deki "AI ile tara" butonu (bayrak
// kapalıyken o buton hiç render olmaz, bu ekrana hiç erişilmez).
//
// Canlı kamera önizlemesi YOK: `expo-camera` paketi kurulu değil ve RULES.md
// yeni paket kurulmasını yasaklıyor. Bunun yerine mevcut `expo-image-picker`
// ile native kamerayı açıyoruz (profildeki galeri seçimiyle aynı paket,
// bkz. src/screens/ProfileScreen.tsx) — tasarımdaki vitrin/çerçeve zemini
// statik kalır, deklanşöre basınca sistem kamerası açılır.
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { X, ArrowCounterClockwise } from '../../../../components/icons';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { RootStackParamList } from '../../../../navigation/types';
import { runAiScan } from '../runScan';
import { getAiScanClient } from '../client';
import { useScanQuotaStore } from '../quotaStore';
import { inferMealTypeFromHour } from '../mealTypeFromHour';
import { saveAiScanEstimate } from '../saveEstimate';
import { getSupabaseClient } from '../../../../core/supabase';
import type { ScanEstimate } from '../types';
import ScanQuotaChip from '../ui/ScanQuotaChip';
import ScanLimitSheet from '../ui/ScanLimitSheet';
import { useFeature } from '../../../../core/flags';
import PlateXRayShareModal from '../../../../components/share/PlateXRayShareModal';
import type { PlateXRayData } from '../../../../components/share/PlateXRayShareCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Stage = 'viewfinder' | 'scanning' | 'result';

export default function ScanScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useT();
  const { user } = useAuth();
  const paylasimKarti = useFeature('paylasim_karti');

  const remaining = useScanQuotaStore((s) => s.remaining);
  const recordQuota = useScanQuotaStore((s) => s.recordQuota);

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

  const insets = useSafeAreaInsets();

  const handleCapture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('ai_scan.permission_denied'));
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;

    const uri = picked.assets[0].uri;
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

  const handleSave = async () => {
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
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : t('ai_scan.failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setPhotoUri(null);
    setStage('viewfinder');
  };

  const handleManualEntry = () => {
    setLimitVisible(false);
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
        <Text style={styles.resultKcal}>{Math.round(result.kcal)} kcal</Text>

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

const styles = StyleSheet.create({
  viewfinder: { flex: 1, backgroundColor: '#2C2C2E' },
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
  resultKcal: { marginTop: 2, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: '#0A0A0A' },
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
