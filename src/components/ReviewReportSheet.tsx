import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import BottomSheet from './BottomSheet';
import { Check } from './icons';
import {
  REPORT_REASONS,
  yorumBildir,
  type ReviewReportReason,
} from '../lib/reviewReports';

interface Props {
  visible: boolean;
  onClose: () => void;
  kaynak: 'siparis' | 'uygulama';
  contentId: string;
}

/**
 * Yorum şikayeti seçim ekranı (Apple 1.2 UGC). Sabit sebep listesinden biri
 * seçilip "Bildir"e basılır; review_reports'a yazılır. Mevcut yorum kartının
 * görünümünü değiştirmez — yalnızca kart üzerindeki "Bildir" bu sheet'i açar.
 */
export function ReviewReportSheet({ visible, onClose, kaynak, contentId }: Props) {
  const [reason, setReason] = useState<ReviewReportReason | null>(null);
  const [saving, setSaving] = useState(false);

  const kapat = () => {
    if (saving) return;
    setReason(null);
    onClose();
  };

  const gonder = async () => {
    if (!reason || saving) return;
    setSaving(true);
    const res = await yorumBildir({ kaynak, contentId, reason });
    setSaving(false);
    setReason(null);
    onClose();
    // Sheet kapandıktan sonra sonucu bildir (FeedbackScreen ile aynı desen).
    if (res.ok) {
      Alert.alert('Teşekkürler', 'Bildirimin alındı, ekibimiz inceleyecek.');
    } else {
      Alert.alert('Bildirilemedi', res.error);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={kapat} title="Yorumu Bildir" showCloseButton>
      <Text style={s.aciklama}>
        Bu yorumu neden bildiriyorsun? Ekibimiz en kısa sürede inceleyecek.
      </Text>
      {REPORT_REASONS.map((r) => {
        const secili = reason === r.key;
        return (
          <Pressable
            key={r.key}
            onPress={() => setReason(r.key)}
            style={[s.satir, secili && s.satirSecili]}
          >
            <Text style={[s.satirMetin, secili && s.satirMetinSecili]}>{r.label}</Text>
            <View style={[s.kutu, secili && s.kutuSecili]}>
              {secili ? <Check size={13} color="#000000" weight="bold" /> : null}
            </View>
          </Pressable>
        );
      })}
      <Pressable
        onPress={gonder}
        disabled={!reason || saving}
        style={[s.gonderBtn, (!reason || saving) && s.gonderBtnPasif]}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={s.gonderMetin}>Bildir</Text>
        )}
      </Pressable>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  aciklama: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#6B7280',
    marginBottom: 16,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 8,
  },
  satirSecili: {
    borderColor: '#B9EF14',
    backgroundColor: 'rgba(185,239,20,0.08)',
  },
  satirMetin: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#111827',
  },
  satirMetinSecili: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  kutu: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    flexShrink: 0,
  },
  kutuSecili: {
    backgroundColor: '#B9EF14',
    borderColor: '#B9EF14',
  },
  gonderBtn: {
    marginTop: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gonderBtnPasif: {
    opacity: 0.4,
  },
  gonderMetin: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
