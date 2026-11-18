// SVG kart metni için yaklaşık genişlik ölçümü + satır kırma (G61-S1 md.1).
//
// react-native-svg metni çalışma zamanında ölçemez ve kendi kendine satır
// kırmaz. Kartlar sabit 1080 px genişlikte olduğundan karakter sınıfına göre
// em tablosu yeterli ve deterministik (Plus Jakarta Sans / Bricolage Grotesque
// ortalamalarından; güvenli tarafta, biraz geniş tahmin). SAF modül.

export type FontKind = 'jakarta' | 'bricolage';

const NARROW = new Set("il.,:;'!|ıjtfrI ’()[]".split(''));
const WIDE = new Set('mwMW@%'.split(''));

function charEm(ch: string, kind: FontKind, weight: number): number {
  let em: number;
  if (ch === ' ') em = 0.27;
  else if (NARROW.has(ch)) em = 0.3;
  else if (WIDE.has(ch)) em = 0.86;
  else if (/[0-9]/.test(ch)) em = 0.6;
  else if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) em = 0.68;
  else em = 0.55;
  if (kind === 'bricolage') em *= 0.94;
  if (weight >= 700) em *= 1.05;
  if (weight >= 800) em *= 1.03;
  return em;
}

export function textWidth(text: string, size: number, kind: FontKind = 'jakarta', weight = 600, letterSpacingEm = 0): number {
  let w = 0;
  for (const ch of text) w += charEm(ch, kind, weight) + letterSpacingEm;
  return w * size;
}

/**
 * Metni `maxWidth` içine sözcük sınırından kırar; `maxLines` aşılırsa son satır
 * "…" ile kesilir. `\n` zorunlu satır sonu sayılır.
 */
export function wrapText(
  text: string,
  size: number,
  maxWidth: number,
  maxLines: number,
  kind: FontKind = 'jakarta',
  weight = 600,
): string[] {
  const out: string[] = [];
  const paragraphs = (text || '').split('\n');
  let truncated = false;
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const cand = line ? `${line} ${word}` : word;
      if (textWidth(cand, size, kind, weight) <= maxWidth) {
        line = cand;
        continue;
      }
      if (line) out.push(line);
      // Tek sözcük satırdan uzunsa karakterden böl.
      let w = word;
      while (textWidth(w, size, kind, weight) > maxWidth && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && textWidth(w.slice(0, cut), size, kind, weight) > maxWidth) cut--;
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      line = w;
    }
    if (line) out.push(line);
    if (out.length > maxLines) break;
  }
  if (out.length > maxLines) {
    out.length = maxLines;
    truncated = true;
  }
  if (truncated && out.length) {
    let last = out[out.length - 1];
    while (last.length > 1 && textWidth(`${last}…`, size, kind, weight) > maxWidth) last = last.slice(0, -1);
    out[out.length - 1] = `${last.replace(/[\s.,;:]+$/, '')}…`;
  }
  return out;
}

/** Tek satıra sığdır (gerekirse "…"). */
export function fitLine(text: string, size: number, maxWidth: number, kind: FontKind = 'jakarta', weight = 600): string {
  return wrapText(text.replace(/\n/g, ' '), size, maxWidth, 1, kind, weight)[0] ?? '';
}

/** Satır kutusu üstünden taban çizgisi (line-height katsayısı ile). */
export function baselineAt(top: number, size: number, lineHeight: number): number {
  return top + (size * lineHeight) / 2 + size * 0.35;
}
