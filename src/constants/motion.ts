import { LEGACY_MOTION } from '../core/design/motion';

/**
 * ESKİ (1.0.7) hareket sabitleri — YALNIZ bayrak kapalı yolun ekranları.
 *
 * G18-S4: hareket token'larının TEK modülü `src/core/design/motion.tsx`
 * (FinMoTokens + FinMoMap, `PREMIUM` geçiş seti). Bu dosya artık değer TAŞIMAZ;
 * aynı değerleri `LEGACY_MOTION`'dan bayt bayt aynen yeniden dışa verir, böylece
 * bayrak kapalıyken uygulama bugünküyle aynı kalır. Yeni kod buradan import
 * ETMEZ (`core/design/motion` kullanılır). G-TEMİZLİK ile silinir.
 */
export const DURATION = LEGACY_MOTION.DURATION;
export const EASING = LEGACY_MOTION.EASING;
export const SPRING = LEGACY_MOTION.SPRING;
export const PRESS_SCALE = LEGACY_MOTION.PRESS_SCALE;
