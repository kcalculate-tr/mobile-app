// "Bugün N/3 tarama hakkın kaldı" çipi (T20Scan/T20ScanLimit). Kalan hak
// bilinmiyorsa (bkz. quotaStore.ts) hiç render edilmez — tahmini sayı
// gösterilmez.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { Sparkle } from '../../../../components/icons';
import { useT } from '../../../../core/i18n';

export const SCAN_QUOTA_CAP = 3;

type Props = {
  remaining: number | null;
};

export default function ScanQuotaChip({ remaining }: Props) {
  const { t } = useT();
  if (remaining == null) return null;

  return (
    <View style={styles.chip}>
      <Sparkle size={16} color="#FFFFFF" weight="fill" />
      <Text style={styles.text}>{t('ai_scan.quota_left', { count: remaining })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: 'rgba(28,28,30,0.62)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
