// G15-S2 — FinCollectCut "%NN eşleşme": taranan ad ↔ eatkcal menüsü ürün adları.
// Kelime örtüşmesi (Dice katsayısı). SAF, birim testli. Menü yoksa / eşleşme
// zayıfsa null → hapta yüzde gösterilmez (uydurma yok).

function words(s: string): string[] {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** İki ad arasındaki kelime örtüşmesi (0..1). */
export function nameSimilarity(a: string, b: string): number {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (A.size === 0 || B.size === 0) return 0;
  let common = 0;
  A.forEach((w) => {
    if (B.has(w)) common += 1;
  });
  return (2 * common) / (A.size + B.size);
}

/** En iyi eşleşme yüzdesi (0–100); %60 altı → null. */
export function bestMatchPercent(name: string, menuNames: string[]): number | null {
  let best = 0;
  for (const m of menuNames) best = Math.max(best, nameSimilarity(name, m));
  const pct = Math.round(best * 100);
  return pct >= 60 ? pct : null;
}
