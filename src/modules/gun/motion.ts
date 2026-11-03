// Gün modülü hareket yardımcıları.
//
// KURAL (G11-S4 madde 8 / RULES.md "Hareket"): İmza anlar `core/design`'ın
// hazır bileşenleriyle (DailyRing yerine ProgressRing dolumu, LogTrail, StreakMoment,
// NumberRoll) kurulur; yeni süre/yay/eğri İCAT EDİLMEZ. Bu dosya yalnız SAF
// yardımcılar içerir (sayı gruplama) — animasyon motoru `core/design/motion.tsx`'te
// kalır. tsx --test ile test edilebilsin diye React Native importu YOK.

export type NumLang = 'tr' | 'en';

/**
 * Tam sayıyı binlik ayıraçla gruplar. TR `1.840`, EN `1,840` (HAREKET kitabı §3
 * "Sayı yuvarlanması" ayıracı). Ondalık yok — sayaç/kalori/makro tam sayı. İşaret
 * korunur. Sayı olmayan girdi (NaN/Infinity) güvenli biçimde '0' döner.
 */
export function groupDigits(value: number, lang: NumLang): string {
  const sep = lang === 'tr' ? '.' : ',';
  if (!Number.isFinite(value)) return '0';
  const n = Math.trunc(value);
  const neg = n < 0;
  const digits = Math.abs(n).toString();
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += sep;
    out += digits[i];
  }
  return neg ? `-${out}` : out;
}

/**
 * Akşam + boş gün "sessiz an" koşulu (HAREKET kitabı §3). Halka boş (progress 0)
 * VE saat akşam (>= 18) ise tek satır "Yarın yeni halka." gösterilir. SAF —
 * `hour` dışarıdan verilir (test edilebilirlik + Date.now worklet yasağı yok).
 */
export function isSilentEvening(progress: number, hour: number): boolean {
  return progress <= 0 && hour >= 18;
}
