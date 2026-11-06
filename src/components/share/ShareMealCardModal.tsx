// Öğün paylaşım kartı — önizleme + "Paylaş" modalı (G5-S4 md.1).
//
// Kartı tam çözünürlükte (1080×1350) render eder; ÖNİZLEMEDE transformOrigin
// 'top left' + scale ile küçültür (yerleşim boyutu tam kalır, böylece
// `toDataURL` tam çözünürlük yakalar). "Paylaş" → PNG üret → önbelleğe yaz →
// sistem paylaşım sayfası (bkz. src/lib/shareCard.ts).
//
// Tamamen kendine yeten yeni bir bileşen: çağıran ekran yalnız bayrak açıkken
// (paylasim_karti) mount eder; kapalıyken hiç render olmaz, üretim davranışı
// değişmez.
//
// G15-S2 (ESKİ TASARIM YASAĞI): sabit koyu renkler + eski lime (#B9EF14) yerine
// tema token'ları ve Final sheet dili (28 köşe, tutamaç, kapat 44, lime 52
// düğme, Export ikonu); metinler i18n. Paylaşım mantığı aynı.

import React, { useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';
import { Export, X } from '../icons';
import MealShareCard, { CARD_W, CARD_H, ShareMealData } from './MealShareCard';
import { captureSvgToPngBase64, sharePngBase64 } from '../../lib/shareCard';
import { AppText, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
  data: ShareMealData | null;
  /** Dosya adı benzersizliği için (öğün id'si gibi); sağlık verisi içermez. */
  seed?: string | number;
};

export default function ShareMealCardModal({ visible, onClose, data, seed }: Props) {
  const t = useTheme();
  const { t: tt } = useT();
  const insets = useSafeAreaInsets();
  const cardRef = useRef<React.ElementRef<typeof Svg>>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screenW = Dimensions.get('window').width;
  const previewW = Math.min(screenW * 0.74, 320);
  const scale = previewW / CARD_W;
  const previewH = CARD_H * scale;

  const handleShare = async () => {
    if (busy || !data) return;
    setBusy(true);
    setError(null);
    try {
      const base64 = await captureSvgToPngBase64(cardRef.current as any);
      await sharePngBase64(base64, data.name, seed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : tt('share_card.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: t.color.bg, paddingBottom: Math.max(28, insets.bottom + 16) }]}
        >
          <View style={[styles.handle, { backgroundColor: t.isDark ? '#48484A' : '#C3C7CC' }]} />
          <View style={styles.headerRow}>
            <AppText textRole="sheetTitle" accessibilityRole="header">
              {tt('share_card.meal_title')}
            </AppText>
            <Pressable
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={tt('common.close')}
              style={styles.close}
            >
              <X size={22} color={t.color.ink} />
            </Pressable>
          </View>

          {/* Önizleme — tam boy kart, görsel olarak ölçeklenmiş. */}
          <View style={[styles.previewBox, { width: previewW, height: previewH }]}>
            {data ? (
              <View style={{ width: CARD_W, height: CARD_H, transformOrigin: 'top left', transform: [{ scale }] }}>
                <MealShareCard ref={cardRef} data={data} />
              </View>
            ) : null}
          </View>

          <AppText tone="secondary" style={styles.hint}>
            {tt('share_card.hint')}
          </AppText>

          {error ? (
            <AppText tone="danger" style={styles.hint}>
              {error}
            </AppText>
          ) : null}

          <Pressable
            style={[styles.shareBtn, { backgroundColor: t.color.accent, opacity: busy ? 0.6 : 1 }]}
            onPress={handleShare}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={t.color.onAccent} />
            ) : (
              <>
                <Export size={20} color={t.color.onAccent} weight="bold" />
                <AppText tone="onAccent" style={styles.shareBtnText}>
                  {tt('share_card.cta')}
                </AppText>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 8, alignItems: 'center' },
  handle: { width: 36, height: 5, borderRadius: 3, marginBottom: 8 },
  headerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  previewBox: { overflow: 'hidden', borderRadius: 24, backgroundColor: '#0A0A0A' },
  hint: { fontSize: 13, textAlign: 'center', marginTop: 14 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 26,
    height: 52,
    width: '100%',
    marginTop: 18,
  },
  shareBtnText: { fontSize: 15, fontWeight: '700' },
});
