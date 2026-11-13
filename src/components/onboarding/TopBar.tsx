import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CaretLeft } from '../icons';
import { useNavigation } from '@react-navigation/native';
import { sportive } from '../../theme/sportive';
import { BrandLogo } from '../../core/design/components/BrandLogo';

interface Props {
  showBack?: boolean;
  pageIndicator?: string;
  rightAction?: { label: string; onPress: () => void };
}

export const TopBar: React.FC<Props> = ({ showBack, pageIndicator, rightAction }) => {
  const nav = useNavigation();
  return (
    <View style={styles.row}>
      {showBack ? (
        <Pressable onPress={() => nav.goBack()} style={styles.iconBtn}>
          <CaretLeft size={16} color={sportive.colors.textPrimary} weight="bold" />
        </Pressable>
      ) : (
        <View style={{ width: 32 }} />
      )}

      {/* G39-S1 md.2: PNG yerine SVG "kcal." logosu (aynı yükseklik bandı). */}
      <BrandLogo name="kcal" height={24} color={sportive.colors.textPrimary} />

      {pageIndicator ? (
        <Text style={styles.indicator}>{pageIndicator}</Text>
      ) : rightAction ? (
        <Pressable onPress={rightAction.onPress}>
          <Text style={styles.skip}>{rightAction.label}</Text>
        </Pressable>
      ) : (
        <View style={{ width: 32 }} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: sportive.colors.glassBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sportive.colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  indicator: { ...sportive.type.tactical, color: sportive.colors.textSecondary, width: 50, textAlign: 'right' },
  skip: { ...sportive.type.bodySm, color: sportive.colors.textSecondary, fontFamily: 'PlusJakartaSans_500Medium' },
});
