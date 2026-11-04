// Doğrulama rozeti — tasarım Final FinBadges / FinComponents. İsmin yanında
// satır içi mühür (seal-check) ikonu; renk tema rolü `accentLine` (açık #4A6B00,
// koyu #C6F04F — Final paletiyle birebir). S4 (Profil) bu bileşeni import eder;
// tek kaynak budur, kopyalanmaz. Boyut 16 (akış/yorum) veya çağırana göre.
import React from 'react';
import { useTheme } from '../../../core/design';
import { Icon } from './icons';

export function VerifiedBadge({
  size = 16,
  color,
}: {
  /** Mühür boyutu (px). Final: akış 16, resmi avatar 18. */
  size?: number;
  /** Rengi geçersiz kıl (varsayılan tema `accentLine`: #4A6B00 / #C6F04F). */
  color?: string;
}) {
  const t = useTheme();
  return <Icon name="seal" size={size} color={color ?? t.color.accentLine} />;
}

export default VerifiedBadge;
