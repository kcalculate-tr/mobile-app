// G19-S3 — Prop beyaz listesi + kişisel veri süzgeci (saf, native bağımlılık yok).
//
// Katmanlar (hepsi istemcide; sunucuda D-S1 tetikleyicisi ayrıca kara liste uygular):
//  1) Olayın sözlükteki `props` listesinde olmayan anahtar düşer.
//  2) Değer, anahtarın türüne uymuyorsa düşer (ör. 'number' alanına metin).
//  3) Metin değerleri: e-posta, telefon (≥ 10 rakam), TCKN (11 rakam), kart
//     numarası (13–19 rakam), IBAN, koordinat çifti desenine uyan her değer
//     anahtar beyaz listede olsa bile düşer.
//  4) Uzunluk sınırları; `url` türünde sorgu dizesi ve parça atılır.
import { eventDef, type PropKind } from './events';

export type CleanProps = Record<string, string | number | boolean>;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;
const IBAN = /\bTR\d{2}[\s]?(\d{4}[\s]?){5}\d{2}\b/i;
const COORD = /-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/;
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const CODE_RE = /^[A-Z0-9_-]{1,32}$/;

/** Değer kişisel veri gibi görünüyor mu? (beyaz listeden bağımsız son kapı) */
export function looksPersonal(value: string): boolean {
  if (EMAIL.test(value)) return true;
  if (IBAN.test(value)) return true;
  if (COORD.test(value)) return true;
  // Rakam dizileri: boşluk/tire/parantez/artı ayraçlarıyla yazılmış telefon,
  // TCKN, kart numarası. 10+ ardışık (ayraçlı) rakam → kişisel say.
  const digitRuns = value.match(/[+(]?\d[\d\s().-]{8,}\d/g) ?? [];
  for (const run of digitRuns) {
    if (run.replace(/\D/g, '').length >= 10) return true;
  }
  return false;
}

function cleanUrl(v: string): string | null {
  const cut = v.split(/[?#]/)[0].trim().slice(0, 200);
  if (!cut || looksPersonal(cut)) return null;
  return cut;
}

export function coerceProp(kind: PropKind, raw: unknown): string | number | boolean | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(kind)) {
    const s = String(raw);
    return (kind as readonly string[]).includes(s) ? s : null;
  }
  switch (kind) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      if (!Number.isFinite(n)) return null;
      return Math.round(n * 100) / 100;
    }
    case 'boolean':
      return typeof raw === 'boolean' ? raw : null;
    case 'id': {
      if (typeof raw !== 'string' && typeof raw !== 'number') return null;
      const s = String(raw).trim();
      if (!ID_RE.test(s)) return null;
      // Uzun salt-rakam kimlik telefon/TCKN olabilir → düş (sipariş no'ları < 10 hane).
      if (/^\d{10,}$/.test(s)) return null;
      return s;
    }
    case 'code': {
      if (typeof raw !== 'string') return null;
      const s = raw.trim().toUpperCase();
      if (!CODE_RE.test(s) || looksPersonal(s)) return null;
      return s;
    }
    case 'url':
      return typeof raw === 'string' ? cleanUrl(raw) : null;
    case 'text': {
      if (typeof raw !== 'string' && typeof raw !== 'number') return null;
      const s = String(raw).trim().slice(0, 64);
      if (!s || looksPersonal(s)) return null;
      return s;
    }
    default:
      return null;
  }
}

/**
 * Olayın beyaz listesine göre prop'ları temizler. Bilinmeyen olay → boş nesne
 * (track() zaten bilinmeyen adı yazmaz). Dönüş yalnız ilkel değer içerir.
 */
export function sanitizeProps(eventName: string, props: Record<string, unknown> | null | undefined): CleanProps {
  const def = eventDef(eventName);
  const out: CleanProps = {};
  if (!def || !props || typeof props !== 'object') return out;
  for (const [key, kind] of Object.entries(def.props)) {
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    const v = coerceProp(kind, (props as Record<string, unknown>)[key]);
    if (v !== null) out[key] = v;
  }
  return out;
}

/** Test/denetim yardımcısı: beyaz listede olmadığı için düşen anahtarlar. */
export function droppedKeys(eventName: string, props: Record<string, unknown>): string[] {
  const clean = sanitizeProps(eventName, props);
  return Object.keys(props).filter((k) => !(k in clean));
}
