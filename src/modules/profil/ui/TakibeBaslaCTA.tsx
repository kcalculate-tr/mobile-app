// T20TakibeBasla — "Takibe başla" girişi. İsteğe bağlı/atlanabilir; yeniden
// hedef/makro HESAPLAMASI YAZMAZ, mevcut `NutritionProfileScreen`'e
// (`firstTime: true`) yönlendirir — o ekran zaten "Şimdi değil" ile atlanabilir
// ve `lib/nutrition.ts`'teki hesaplamayı kullanır. Profil ve Günüm (GunEmpty
// boş durumu) bu bileşeni aynı şekilde kullanır.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Target } from '../../../components/icons';
import { RootStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TakibeBaslaCTA() {
  const t = useTheme();
  const { t: tt } = useT();
  const navigation = useNavigation<Nav>();

  return (
    <Pressable
      onPress={() => navigation.navigate('NutritionProfile', { firstTime: true })}
      style={[styles.row, { backgroundColor: t.color.surface, borderColor: t.color.line }]}
      accessibilityRole="button"
    >
      <View style={[styles.iconWrap, { backgroundColor: t.color.accent }]}>
        <Target size={18} color={t.color.onAccent} weight="bold" />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="body" style={styles.title}>
          {tt('profil.start_tracking')}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {tt('profil.start_tracking_hint')}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '700' },
});
