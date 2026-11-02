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
export { AppText } from './components/AppText';
export { LogPill } from './components/LogPill';
export { Toast } from './components/Toast';
export { ProgressRing } from './components/ProgressRing';
export { GlowDot } from './components/GlowDot';
export { GlassObject } from './components/GlassObject';
