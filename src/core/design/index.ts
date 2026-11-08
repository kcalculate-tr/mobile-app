/**
 * Yeni tasarım temeli — tek giriş noktası.
 *
 * Kullanım: `import { useTheme, AppText, LogPill } from '@/core/design'` gibi.
 * Mevcut ekranların hiçbiri buna bağlı DEĞİL; yeni tasarım buradan beslenecek.
 */

// Token'lar
export * from './tokens';

// Tema
export * from './theme';
export { ThemeProvider, useTheme } from './ThemeProvider';

// Yazı
export * from './typography';
export { bricolageFonts } from './fonts';
export type { BricolageFamily } from './fonts';

// Hareket
export * from './motion';

// Bileşenler
export { AppText, TextScaleCapContext, withWeightFamily } from './components/AppText';
export { FinText, resolveFinTextStyle } from './components/FinText';
export { Button } from './components/Button';
export { Chip } from './components/Chip';
export { Card } from './components/Card';
export { Sheet } from './components/Sheet';
export { EmptyErrorCard } from './components/EmptyErrorCard';
export { MacroStrip } from './components/MacroStrip';
export type { MacroValues } from './components/MacroStrip';
export { LogPill } from './components/LogPill';
export { Toast } from './components/Toast';
export { ProgressRing } from './components/ProgressRing';
export { GlowDot } from './components/GlowDot';
export { GlassObject } from './components/GlassObject';
export { LogTrail } from './components/LogTrail';
export { DailyRing } from './components/DailyRing';
export { StreakMoment } from './components/StreakMoment';
export { NumberRoll } from './components/NumberRoll';
export { GlassTabBar } from './components/GlassTabBar';
export { FinLoadSwap, FinListEnter, FinPressScale, FinErrorReveal } from './components/FinTransitions';
