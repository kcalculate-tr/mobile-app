// Tabak Röntgeni — önizleme + "Paylaş" modalı (G6-S4 md.4). AI tarama sonucu
// ekranından açılır; yalnız `paylasim_karti` bayrağı açıkken mount edilir
// (çağıran ekran denetler) — kapalıyken hiç render olmaz.
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';
import { ShareNetwork, X } from '../icons';
import PlateXRayShareCard, { CARD_W, CARD_H, PlateXRayData } from './PlateXRayShareCard';
import { captureSvgToPngBase64, sharePngBase64 } from '../../lib/shareCard';
import { useT } from '../../core/i18n';

const C = {
  bg: '#141414',
  border: '#232323',
  accent: '#B9EF14',
  accentText: '#0A0A0A',
  textPrimary: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.55)',
  overlay: 'rgba(0,0,0,0.75)',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  data: PlateXRayData | null;
  seed?: string | number;
};

export default function PlateXRayShareModal({ visible, onClose, data, seed }: Props) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const cardRef = useRef<React.ElementRef<typeof Svg>>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screenW = Dimensions.get('window').width;
  const previewW = Math.min(screenW * 0.7, 300);
  const scale = previewW / CARD_W;
  const previewH = CARD_H * scale;

  const handleShare = async () => {
    if (busy || !data) return;
    setBusy(true);
    setError(null);
    try {
      const base64 = await captureSvgToPngBase64(cardRef.current as any);
      await sharePngBase64(base64, data.mealName, seed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('share_card.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={busy ? undefined : onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(28, insets.bottom + 16) }]}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('share_card.title')}</Text>
            <TouchableOpacity onPress={onClose} disabled={busy} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={24} color={C.textMuted} weight="bold" />
            </TouchableOpacity>
          </View>

          <View style={[styles.previewBox, { width: previewW, height: previewH }]}>
            {data ? (
              <View style={{ width: CARD_W, height: CARD_H, transformOrigin: 'top left', transform: [{ scale }] }}>
                <PlateXRayShareCard ref={cardRef} data={data} />
              </View>
            ) : null}
          </View>

          <Text style={styles.hint}>{t('share_card.hint')}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={[styles.shareBtn, busy && styles.shareBtnDisabled]} onPress={handleShare} disabled={busy} activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color={C.accentText} />
            ) : (
              <>
                <ShareNetwork size={22} color={C.accentText} weight="bold" />
                <Text style={styles.shareBtnText}>{t('share_card.cta')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: C.textPrimary },
  previewBox: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: C.border,
  },
  hint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  error: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: 12,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.accent,
    borderRadius: 100,
    height: 56,
    width: '100%',
    marginTop: 20,
  },
  shareBtnDisabled: { opacity: 0.6 },
  shareBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: C.accentText },
});
