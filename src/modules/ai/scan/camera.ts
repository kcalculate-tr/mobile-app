// G17-S2 md.1/2/4 — canlı Tara kamerası için SAF yardımcılar (native yok; test eder).
//
//  • Çekim: takePictureAsync kalite 0.5; uzun kenar ≤ 1600 px. expo-camera çekimi
//    yeniden boyutlandırmaz ve yeni paket (image-manipulator) yasak → çekim boyutu
//    `pictureSize` ile seçilir (cihazın sunduğu boyutlardan uzun kenarı ≤ 1600 olan
//    en büyüğü; 4:3 tercih).
//  • Barkod: EAN-13 / EAN-8 / UPC-A / UPC-E; sağlama basamağı doğrulanır (yanlış
//    okumalar sonuç sayılmaz).

export const CAPTURE_QUALITY = 0.5;
export const CAPTURE_MAX_EDGE = 1600;

/** expo-camera `barcodeScannerSettings.barcodeTypes`. */
export const SCAN_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;
export type ScanBarcodeType = (typeof SCAN_BARCODE_TYPES)[number];

function parseSize(s: string): { w: number; h: number } | null {
  const m = /^(\d+)\s*x\s*(\d+)$/i.exec(s.trim());
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? { w, h } : null;
}

/**
 * Cihazın sunduğu çekim boyutlarından uzun kenarı ≤ maxEdge olan en uygununu seçer:
 * önce 4:3 (tabak kadrajı) ve uzun kenarı ≥ 1000 olanların en büyüğü, yoksa
 * herhangi bir oranın en büyüğü. Uygun yoksa (yalnız "Photo"/"High" gibi iOS
 * ön ayarları) undefined → cihaz varsayılanı (yükleme sınırı 5 MB yine korunur).
 */
export function pickPictureSize(sizes: readonly string[] | null | undefined, maxEdge = CAPTURE_MAX_EDGE): string | undefined {
  const fits = (sizes ?? [])
    .map((s) => ({ s, p: parseSize(s) }))
    .filter((x): x is { s: string; p: { w: number; h: number } } => x.p != null)
    .filter((x) => Math.max(x.p.w, x.p.h) <= maxEdge);
  if (fits.length === 0) return undefined;
  const area = (x: { p: { w: number; h: number } }) => x.p.w * x.p.h;
  const isFourThree = (x: { p: { w: number; h: number } }) => {
    const r = Math.max(x.p.w, x.p.h) / Math.min(x.p.w, x.p.h);
    return Math.abs(r - 4 / 3) < 0.02;
  };
  const preferred = fits.filter((x) => isFourThree(x) && Math.max(x.p.w, x.p.h) >= 1000);
  const pool = preferred.length ? preferred : fits;
  return pool.reduce((best, x) => (area(x) > area(best) ? x : best)).s;
}

/** GTIN sağlama basamağı (EAN-8/12/13 aynı ağırlık kuralı: sağdan 3,1,3,…). */
function gtinValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/** UPC-E (8 hane, sayı sistemi 0/1) → UPC-A (12 hane). */
export function upcEToUpcA(upce: string): string | null {
  if (!/^[01]\d{7}$/.test(upce)) return null;
  const ns = upce[0];
  const d = upce.slice(1, 7);
  const check = upce[7];
  const last = d[5];
  let mfr: string;
  let prod: string;
  if (last === '0' || last === '1' || last === '2') {
    mfr = d[0] + d[1] + last + '00';
    prod = '00' + d[2] + d[3] + d[4];
  } else if (last === '3') {
    mfr = d[0] + d[1] + d[2] + '00';
    prod = '000' + d[3] + d[4];
  } else if (last === '4') {
    mfr = d[0] + d[1] + d[2] + d[3] + '0';
    prod = '0000' + d[4];
  } else {
    mfr = d.slice(0, 5);
    prod = '0000' + last;
  }
  return ns + mfr + prod + check;
}

function typeKey(type: string): ScanBarcodeType | null {
  const t = type.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (t.endsWith('ean13')) return 'ean13';
  if (t.endsWith('ean8')) return 'ean8';
  if (t.endsWith('upca')) return 'upc_a';
  if (t.endsWith('upce')) return 'upc_e';
  return null;
}

/**
 * Okunan barkodu doğrular ve GTIN olarak döner (geçersiz/desteklenmeyen → null).
 * iOS UPC-A'yı başına 0 eklenmiş EAN-13 olarak bildirebilir — EAN-13 olarak kalır.
 */
export function normalizeBarcode(type: string, data: string): string | null {
  const kind = typeKey(type);
  const raw = (data ?? '').trim();
  if (!kind || !/^\d+$/.test(raw)) return null;
  switch (kind) {
    case 'ean13':
      return raw.length === 13 && gtinValid(raw) ? raw : null;
    case 'ean8':
      return raw.length === 8 && gtinValid(raw) ? raw : null;
    case 'upc_a':
      return raw.length === 12 && gtinValid(raw) ? raw : null;
    case 'upc_e': {
      const a = raw.length === 8 ? upcEToUpcA(raw) : null;
      return a && gtinValid(a) ? raw : null;
    }
  }
}
