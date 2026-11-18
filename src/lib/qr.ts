// QR kod üretici — saf TypeScript, PAKETSİZ (G61-S1 md.1).
//
// ISO/IEC 18004 bayt kipi (UTF-8), sürüm 1–10 (en fazla 271 bayt, L), hata
// düzeltme L/M/Q/H. Paylaşım kartlarındaki kısa bağlantılar (≈ 40–70 karakter)
// için fazlasıyla yeterli; daha uzun veri açık bir hata fırlatır.
//
// Çıktı: `QrMatrix` (true = koyu modül). Kartlar `qrPath()` ile tek bir SVG yolu
// çizer (yatay koşular birleştirilir → az düğüm, react-native-svg hızlı).
//
// Doğruluk: `__tests__/qr.test.ts` bağımsız bir uygulamanın (Kazuhiko Arase
// QRCode, aynı sürüm + maske) ürettiği altın matrislerle birebir karşılaştırır;
// ayrıca biçim bilgisi BCH'si ve yapısal desenler denetlenir.

export type QrEcc = 'L' | 'M' | 'Q' | 'H';

export type QrMatrix = {
  version: number;
  size: number;
  ecc: QrEcc;
  mask: number;
  /** modules[y][x] — satır, sütun. */
  modules: boolean[][];
};

// Biçim bilgisindeki hata düzeltme bitleri (L=01, M=00, Q=11, H=10).
const ECC_FORMAT: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };

// [ecc kod sözcüğü / blok, grup1 blok sayısı, grup1 veri, grup2 blok sayısı, grup2 veri]
type Rs = readonly [number, number, number, number, number];
const RS_BLOCKS: Record<QrEcc, readonly Rs[]> = {
  L: [
    [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0], [26, 1, 108, 0, 0],
    [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0], [30, 2, 116, 0, 0], [18, 2, 68, 2, 69],
  ],
  M: [
    [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
  ],
  Q: [
    [13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0], [18, 2, 15, 2, 16],
    [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19], [20, 4, 16, 4, 17], [24, 6, 19, 2, 20],
  ],
  H: [
    [17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0], [22, 2, 11, 2, 12],
    [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15], [24, 4, 12, 4, 13], [28, 6, 15, 2, 16],
  ],
};

const ALIGN: readonly (readonly number[])[] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

export const QR_MAX_VERSION = 10;

/** UTF-8 baytları (TextEncoder'a güvenmeden — Hermes/Node aynı sonuç). */
export function utf8Bytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function dataCapacity(version: number, ecc: QrEcc): number {
  const [, n1, d1, n2, d2] = RS_BLOCKS[ecc][version - 1];
  return n1 * d1 + n2 * d2;
}

/** Bayt kipinde sığan en küçük sürüm (bulunamazsa null). */
export function pickVersion(byteLen: number, ecc: QrEcc): number | null {
  for (let v = 1; v <= QR_MAX_VERSION; v++) {
    const countBits = v <= 9 ? 8 : 16;
    const needBits = 4 + countBits + byteLen * 8;
    if (needBits <= dataCapacity(v, ecc) * 8) return v;
  }
  return null;
}

// ─── GF(256) Reed–Solomon (ilkel polinom 0x11D) ──────────────────────────────
function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < divisor.length; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

// ─── Kod sözcükleri ──────────────────────────────────────────────────────────
function encodeData(bytes: readonly number[], version: number, ecc: QrEcc): number[] {
  const bits: number[] = [];
  const put = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(0b0100, 4); // bayt kipi
  put(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const capBits = dataCapacity(version, ecc) * 8;
  put(0, Math.min(4, capBits - bits.length)); // sonlandırıcı
  while (bits.length % 8 !== 0) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    out.push(v);
  }
  for (let pad = 0xec; out.length < capBits / 8; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

function interleave(data: readonly number[], version: number, ecc: QrEcc): number[] {
  const [eccLen, n1, d1, n2, d2] = RS_BLOCKS[ecc][version - 1];
  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  const eccs: number[][] = [];
  let k = 0;
  for (let b = 0; b < n1 + n2; b++) {
    const len = b < n1 ? d1 : d2;
    const chunk = data.slice(k, k + len);
    k += len;
    blocks.push(chunk);
    eccs.push(rsRemainder(chunk, divisor));
  }
  const out: number[] = [];
  const maxLen = Math.max(d1, d2);
  for (let i = 0; i < maxLen; i++) for (const blk of blocks) if (i < blk.length) out.push(blk[i]);
  for (let i = 0; i < eccLen; i++) for (const e of eccs) out.push(e[i]);
  return out;
}

// ─── Matris ──────────────────────────────────────────────────────────────────
type Grid = { size: number; mod: boolean[][]; fn: boolean[][] };

function newGrid(size: number): Grid {
  const mk = () => Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { size, mod: mk(), fn: mk() };
}

function setFn(g: Grid, x: number, y: number, dark: boolean) {
  g.mod[y][x] = dark;
  g.fn[y][x] = true;
}

function drawFinder(g: Grid, cx: number, cy: number) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= g.size || y >= g.size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      setFn(g, x, y, d !== 2 && d !== 4);
    }
  }
}

function drawAlignment(g: Grid, cx: number, cy: number) {
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) setFn(g, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
}

export function formatBits(ecc: QrEcc, mask: number): number {
  const data = (ECC_FORMAT[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormat(g: Grid, ecc: QrEcc, mask: number) {
  const bits = formatBits(ecc, mask);
  const bit = (i: number) => ((bits >>> i) & 1) !== 0;
  const n = g.size;
  for (let i = 0; i <= 5; i++) setFn(g, 8, i, bit(i));
  setFn(g, 8, 7, bit(6));
  setFn(g, 8, 8, bit(7));
  setFn(g, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFn(g, 14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) setFn(g, n - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFn(g, 8, n - 15 + i, bit(i));
  setFn(g, 8, n - 8, true); // daima koyu modül
}

function drawVersion(g: Grid, version: number) {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) !== 0;
    const a = g.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFn(g, a, b, dark);
    setFn(g, b, a, dark);
  }
}

function drawFunctionPatterns(g: Grid, version: number, ecc: QrEcc) {
  const n = g.size;
  for (let i = 0; i < n; i++) {
    setFn(g, 6, i, i % 2 === 0);
    setFn(g, i, 6, i % 2 === 0);
  }
  drawFinder(g, 3, 3);
  drawFinder(g, n - 4, 3);
  drawFinder(g, 3, n - 4);
  const pos = ALIGN[version - 1];
  const last = pos.length - 1;
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      drawAlignment(g, pos[i], pos[j]);
    }
  }
  drawFormat(g, ecc, 0); // yer ayırma; maske seçiminden sonra yeniden çizilir
  drawVersion(g, version);
}

function placeCodewords(g: Grid, data: readonly number[]) {
  const n = g.size;
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? n - 1 - vert : vert;
        if (!g.fn[y][x] && i < data.length * 8) {
          g.mod[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(g: Grid, mask: number) {
  for (let y = 0; y < g.size; y++)
    for (let x = 0; x < g.size; x++) if (!g.fn[y][x] && maskBit(mask, x, y)) g.mod[y][x] = !g.mod[y][x];
}

/** ISO 18004 §7.8.3 ceza puanı (N1..N4). */
export function penaltyScore(mod: readonly (readonly boolean[])[]): number {
  const n = mod.length;
  let score = 0;
  const lineScore = (get: (i: number) => boolean) => {
    let s = 0;
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) run++;
      else {
        if (run >= 5) s += 3 + (run - 5);
        run = 1;
      }
    }
    // Bulucu benzeri 1:1:3:1:1 + 4 açık (iki yön)
    for (let i = 0; i + 10 < n + 4; i++) {
      const at = (k: number) => (k < 0 || k >= n ? false : get(k));
      const core = at(i) && !at(i + 1) && at(i + 2) && at(i + 3) && at(i + 4) && !at(i + 5) && at(i + 6);
      if (!core) continue;
      const before = !at(i - 1) && !at(i - 2) && !at(i - 3) && !at(i - 4);
      const after = !at(i + 7) && !at(i + 8) && !at(i + 9) && !at(i + 10);
      if (before) s += 40;
      if (after) s += 40;
    }
    return s;
  };
  for (let y = 0; y < n; y++) score += lineScore((i) => mod[y][i]);
  for (let x = 0; x < n; x++) score += lineScore((i) => mod[i][x]);
  for (let y = 0; y + 1 < n; y++)
    for (let x = 0; x + 1 < n; x++) {
      const c = mod[y][x];
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) score += 3;
    }
  let dark = 0;
  for (const row of mod) for (const c of row) if (c) dark++;
  const total = n * n;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  score += Math.max(0, k) * 10;
  return score;
}

export type QrOptions = { ecc?: QrEcc; mask?: number; version?: number };

/** Metni QR matrisine çevirir. Sığmazsa Error fırlatır. */
export function encodeQr(text: string, opts: QrOptions = {}): QrMatrix {
  const ecc: QrEcc = opts.ecc ?? 'M';
  const bytes = utf8Bytes(text);
  const minVersion = pickVersion(bytes.length, ecc);
  if (minVersion == null) throw new Error(`QR: veri çok uzun (${bytes.length} bayt, ${ecc})`);
  const version = opts.version != null ? Math.max(minVersion, Math.min(QR_MAX_VERSION, opts.version)) : minVersion;
  const codewords = interleave(encodeData(bytes, version, ecc), version, ecc);
  const size = version * 4 + 17;

  const build = (mask: number): Grid => {
    const g = newGrid(size);
    drawFunctionPatterns(g, version, ecc);
    placeCodewords(g, codewords);
    applyMask(g, mask);
    drawFormat(g, ecc, mask);
    return g;
  };

  let mask = opts.mask ?? -1;
  let best: Grid | null = null;
  if (mask < 0 || mask > 7) {
    let bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      const g = build(m);
      const s = penaltyScore(g.mod);
      if (s < bestScore) {
        bestScore = s;
        best = g;
        mask = m;
      }
    }
  } else {
    best = build(mask);
  }
  return { version, size, ecc, mask, modules: (best as Grid).mod };
}

/**
 * Matrisi tek bir SVG yol verisine çevirir (birim = 1 modül, `quiet` kenar
 * boşluğu modül cinsinden eklenir). viewBox: `0 0 (size+2q) (size+2q)`.
 */
export function qrPath(m: QrMatrix, quiet = 0): string {
  const parts: string[] = [];
  for (let y = 0; y < m.size; y++) {
    let x = 0;
    while (x < m.size) {
      if (!m.modules[y][x]) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < m.size && m.modules[y][x + w]) w++;
      parts.push(`M${x + quiet} ${y + quiet}h${w}v1h-${w}z`);
      x += w;
    }
  }
  return parts.join('');
}
