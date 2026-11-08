// G18-S4 md.5 — Tara "Detay ekle" notunun saf kuralları (native bağımlılık yok).
export const SCAN_NOTE_MAX = 160;

/** Kontrol karakterlerini at, boşlukları sadeleştir, 160'a kırp; boşsa `undefined`. */
export function normalizeScanNote(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return undefined;
  return s.slice(0, SCAN_NOTE_MAX);
}
