// G42-S1 — Kayıt akışı biçimlendiricileri (saf). TR ondalık virgül, binlik nokta (1.850); EN nokta/virgül.
import { cmToFtIn, kgToLb, type KUnits } from './model';

const MONTHS = {
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const MONTHS_SHORT = {
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

type Lang = 'tr' | 'en';
const L = (lang: string): Lang => (lang === 'en' ? 'en' : 'tr');

/** "Şubat – Mart 2027" · "Aralık 2026 – Ocak 2027" · "Şubat 2027" (kısa: "Şub – Mar 2027"). */
export function monthRange(fromIso: string, toIso: string, lang: string, short = false): string {
  const a = new Date(`${fromIso}T00:00:00Z`);
  const b = new Date(`${toIso}T00:00:00Z`);
  const names = (short ? MONTHS_SHORT : MONTHS)[L(lang)];
  const ma = a.getUTCMonth();
  const ya = a.getUTCFullYear();
  const mb = b.getUTCMonth();
  const yb = b.getUTCFullYear();
  if (ma === mb && ya === yb) return `${names[ma]} ${ya}`;
  if (ya === yb) return `${names[ma]} – ${names[mb]} ${yb}`;
  return `${names[ma]} ${ya} – ${names[mb]} ${yb}`;
}

/** 1850 → "1.850" (TR) / "1,850" (EN). */
export function fmtInt(n: number, lang: string): string {
  const s = String(Math.round(Math.abs(n)));
  const sep = L(lang) === 'tr' ? '.' : ',';
  const out = s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return n < 0 ? `−${out}` : out;
}

/** 72 → "72,0" (TR) / "72.0" (EN). */
export function fmtDec1(n: number, lang: string): string {
  const s = (Math.round(n * 10) / 10).toFixed(1);
  return L(lang) === 'tr' ? s.replace('.', ',') : s;
}

/** 0,25 / 0.5 — gereksiz sıfırsız. */
export function fmtPace(n: number, lang: string): string {
  const s = String(Math.round(n * 100) / 100);
  return L(lang) === 'tr' ? s.replace('.', ',') : s;
}

/** Kilo birimle: "72,0 kg" · "158.7 lb". */
export function fmtWeight(kg: number, units: KUnits, lang: string): { value: string; unit: string } {
  if (units === 'imperial') return { value: fmtDec1(kgToLb(kg), lang), unit: 'lb' };
  return { value: fmtDec1(kg, lang), unit: 'kg' };
}

/** Boy birimle: "170 cm" · "5′7″". */
export function fmtHeight(cm: number, units: KUnits): { value: string; unit: string } {
  if (units === 'imperial') {
    const { ft, inch } = cmToFtIn(cm);
    return { value: `${ft}′${inch}″`, unit: '' };
  }
  return { value: String(Math.round(cm)), unit: 'cm' };
}

/** Fark hapı: "−6 kg" / "+2 kg" (lb'de lb). */
export function fmtDiff(diffKg: number, units: KUnits, lang: string): string {
  const v = units === 'imperial' ? kgToLb(Math.abs(diffKg)) : Math.abs(diffKg);
  const r = Math.round(v * 10) / 10;
  const num = Number.isInteger(r) ? String(r) : fmtDec1(r, lang);
  const sign = diffKg < 0 ? '−' : diffKg > 0 ? '+' : '';
  return `${sign}${num} ${units === 'imperial' ? 'lb' : 'kg'}`;
}
