// T20ScanLimit — günlük AI tarama kotası dolduğunda gösterilen alt sayfa.
// "Pro ile sınırsız" dokunulamaz (satın alma yok, G6-S4 md.3).
import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClockCounterClockwise, Lock } from '../../../../components/icons';
import { useT } from '../../../../core/i18n';
import { useTheme } from '../../../../core/design';

type Props = {
  visible: boolean;
  onManualEntry: () => void;
  onClose: () => void;
};

export default function ScanLimitSheet({ visible, onManualEntry, onClose }: Props) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const th = useTheme(); // G14-S1: koyu temada da doğru renkler (FinErrLimit-Dark)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: th.color.surface, paddingBottom: Math.max(34, insets.bottom + 16) }]}>
          <View style={[styles.iconCircle, { backgroundColor: th.color.line }]}>
            <ClockCounterClockwise size={26} color="#0A0A0A" />
          </View>
          <Text style={[styles.title, { color: th.color.ink }]}>{t('ai_scan.limit_title')}</Text>
          <Text style={[styles.body, { color: th.color.secondary }]}>{t('ai_scan.limit_body')}</Text>

          <TouchableOpacity style={[styles.manualBtn, { backgroundColor: th.color.ink }]} onPress={onManualEntry} activeOpacity={0.85}>
            <Text style={[styles.manualBtnText, { color: th.color.surface }]}>{t('ai_scan.manual_entry')}</Text>
          </TouchableOpacity>

          <View style={[styles.proBtn, { borderColor: th.color.line }]}>
            <Lock size={18} color="#0A0A0A" />
            <Text style={[styles.proBtnText, { color: th.color.secondary }]}>{t('ai_scan.pro_soon')}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,10,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E9EBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: '#0A0A0A',
  },
  body: {
    marginTop: 6,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: '#6B6B70',
    lineHeight: 20,
  },
  manualBtn: {
    marginTop: 18,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
  },
  proBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#C3C7CC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 0.45,
  },
  proBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#0A0A0A',
  },
});
