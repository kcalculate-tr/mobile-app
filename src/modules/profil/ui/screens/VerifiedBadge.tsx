// G12-S4 GEÇİCİ: S2'nin VerifiedBadge'i repoda yok (yalnız PrivilegedBadge var);
// yerel geçici rozet. S6 entegrasyonda S2 bileşenine geçirilecek.
//
// Küçük, yeniden kullanılabilir "onaylı" mührü — lime dolgu üstünde ink CheckCircle.
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../../../core/design';
import { CheckCircle } from '../../../../components/icons';

export function VerifiedBadge({ size }: { size?: number }) {
  const t = useTheme();
  const d = size ?? 20;
  return (
    <View
      accessibilityRole="image"
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: t.color.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CheckCircle size={Math.round(d * 0.72)} color={t.color.onAccent} weight="fill" />
    </View>
  );
}

export default VerifiedBadge;
