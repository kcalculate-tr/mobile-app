// G39-S1 md.1 — Marka logosu SAF yardımcıları (RN/native import'u yok → node:test ve PDF HTML üretimi okur).
import { BRAND_LOGO_PATHS, type BrandName } from './brandLogoPaths';

export type { BrandName };

/** VoiceOver'da okunan marka adları (marka adı çevrilmez). */
export const BRAND_LABEL: Record<BrandName, string> = { kcal: 'kcal.', eatkcal: 'eatkcal', kcalculate: 'kcalculate' };

/** viewBox'tan en-boy oranı (genişlik / yükseklik). */
export function brandAspect(name: BrandName): number {
  const [, , w, h] = BRAND_LOGO_PATHS[name].viewBox.split(/\s+/).map(Number);
  return w / h;
}

/** Verilen yükseklikte logo genişliği (pt, iki ondalık). */
export function brandLogoWidth(name: BrandName, height: number): number {
  return Math.round(height * brandAspect(name) * 100) / 100;
}

/**
 * PDF / HTML için satır içi <svg> (expo-print raporları). React bileşeniyle AYNI yol verisi.
 * `height` px; renk verilmezse siyah.
 */
export function brandLogoSvgMarkup(name: BrandName, opts: { height: number; color?: string; className?: string }): string {
  const { viewBox, paths } = BRAND_LOGO_PATHS[name];
  const w = brandLogoWidth(name, opts.height);
  const cls = opts.className ? ` class="${opts.className}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg"${cls} viewBox="${viewBox}" width="${w}" height="${opts.height}" fill="${opts.color ?? '#000000'}" role="img" aria-label="${BRAND_LABEL[name]}">${paths
    .map((d) => `<path d="${d}"/>`)
    .join('')}</svg>`;
}
