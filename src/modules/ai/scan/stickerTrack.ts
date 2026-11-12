// G29-S1 md.1 — çıkartma sonucu teşhisi (YALNIZ cihaz içi): ölçüm olayı GÖNDERİLMEZ (olay sözlüğüne
// yeni ad eklenmedi; kişisel veri de yok). Geliştirme derlemesinde konsola; cihaz testinde
// `stickerStats()` ile kaç kez çıkartma / hangi yedek yol.
import type { StickerOutcome, StickerSkip } from '../../../lib/sticker/subjectLift';

type Stats = { ok: number; ms: number[] } & Partial<Record<StickerSkip, number>>;
let stats: Stats = { ok: 0, ms: [] };

export function trackSticker(o: StickerOutcome): void {
  if (o.ok) {
    stats.ok += 1;
    stats.ms = [...stats.ms.slice(-19), o.ms];
  } else {
    stats[o.reason] = (stats[o.reason] ?? 0) + 1;
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.info(`[sticker] ${o.ok ? `ok ${o.sticker.width}x${o.sticker.height} ${o.sticker.format} ${o.sticker.bytes}B` : o.reason} ${o.ms}ms`);
  }
}

export function stickerStats(): Readonly<Stats> {
  return stats;
}

/** Yalnız testler. */
export function __resetStickerStats(): void {
  stats = { ok: 0, ms: [] };
}
