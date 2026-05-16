import React from 'react';
import { View, StyleSheet } from 'react-native';
import { sportive } from '../../theme/sportive';

interface Props { total: number; current: number; }

export const StepDots: React.FC<Props> = ({ total, current }) => (
  <View style={styles.row}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.dot,
          i === current && styles.dotActive,
        ]}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { width: 16, backgroundColor: sportive.colors.accent },
});
