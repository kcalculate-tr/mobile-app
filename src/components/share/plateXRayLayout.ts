// Tabak Röntgeni kartı (T20ShareCard) — saf yerleşim hesapları. Native yok,
// birim testlerle doğrulanır. Piksel değerleri tasarım dosyasındaki 360×640
// önizlemenin 3× (1080×1920) karşılığıdır (bkz. .claude/night/design/t20/
// T20ShareCard.dc.html, T20ShareCardGuide.dc.html).

export const CARD_W = 1080;
export const CARD_H = 1920;
export const PHOTO_H = 1260; // 420 * 3
export const BOTTOM_H = CARD_H - PHOTO_H; // 660

// Güvenli alan — T20ShareCardGuide.dc.html'de doğrudan 1080×1920 için verilmiş.
export const SAFE_TOP = 250;
export const SAFE_BOTTOM = 340;

export interface LabelPosition {
  x: number;
  y: number;
}

// Tasarımdaki 4 etiketin birebir konumu (sol üst köşe, badge yüksekliği 84px).
const PRESET_POSITIONS: LabelPosition[] = [
  { x: 90, y: 450 }, // "Tavuk göğsü"
  { x: 570, y: 630 }, // "Kinoa"
  { x: 132, y: 858 }, // "Avokado"
  { x: 540, y: 990 }, // "Sebzeler"
];

const BADGE_H = 84;
const GRID_ROW_GAP = 170;

/**
 * Bileşen etiketlerinin foto üzerindeki konumu. 0 → boş dizi (çağıran yerine
 * öğün adını gösterir). 1–4 → tasarımdaki sabit konumlar. 4'ten fazlası
 * (nadir) basit iki sütunlu bir ızgaraya düşer; foto alanının (PHOTO_H) dışına
 * taşmaz.
 */
export function computeLabelPositions(count: number): LabelPosition[] {
  if (count <= 0) return [];
  const out: LabelPosition[] = [];
  for (let i = 0; i < count; i++) {
    if (i < PRESET_POSITIONS.length) {
      out.push(PRESET_POSITIONS[i]);
      continue;
    }
    const col = (i - PRESET_POSITIONS.length) % 2;
    const row = Math.floor((i - PRESET_POSITIONS.length) / 2) + 1;
    const y = Math.min(450 + row * GRID_ROW_GAP, PHOTO_H - BADGE_H - 24);
    out.push({ x: col === 0 ? 90 : 540, y });
  }
  return out;
}
