// G18 ORTAK #10 — çift dil: TR ve EN sözlüklerinde eksik anahtar 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { translations } from '../dictionaries';

function leaves(obj: unknown, prefix = '', out: string[] = []): string[] {
  if (obj && typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    // çoğul nesnesi ({one, other}) tek yaprak sayılır
    if ('other' in o && typeof o.other === 'string') {
      out.push(prefix);
      return out;
    }
    for (const k of Object.keys(o)) leaves(o[k], prefix ? `${prefix}.${k}` : k, out);
  } else {
    out.push(prefix);
  }
  return out;
}

test('i18nKeys: TR ve EN arasında eksik anahtar 0 (iki yön)', () => {
  const tr = new Set(leaves(translations.tr));
  const en = new Set(leaves(translations.en));
  const missingEn = [...tr].filter((k) => !en.has(k));
  const missingTr = [...en].filter((k) => !tr.has(k));
  assert.deepEqual({ missingEn, missingTr }, { missingEn: [], missingTr: [] });
});
