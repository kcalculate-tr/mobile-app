// G18-S4 md.5 — Tara "Detay ekle" notu: normalleştirme + analiz isteğine `hint`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { SCAN_NOTE_MAX, normalizeScanNote } from '../scanNote';
import { runAiScan } from '../runScan';
import { createMockAiScanClient } from '../mock';
import type { AnalyzeParams } from '../types';

test('normalizeScanNote: boş/boşluk → undefined (ekstra adım yok)', () => {
  assert.equal(normalizeScanNote(''), undefined);
  assert.equal(normalizeScanNote('   \n\t '), undefined);
  assert.equal(normalizeScanNote(null), undefined);
});

test('normalizeScanNote: boşluk sadeleşir, kontrol karakteri atılır, ≤ 160', () => {
  assert.equal(normalizeScanNote('  kıymalı   börek,\n500 g '), 'kıymalı börek, 500 g');
  assert.equal(normalizeScanNote('a\u0000b'), 'a b');
  const long = 'x'.repeat(400);
  assert.equal(normalizeScanNote(long)?.length, SCAN_NOTE_MAX);
  assert.equal(SCAN_NOTE_MAX, 160);
});

function spyClient() {
  const base = createMockAiScanClient({ cap: 3 });
  const calls: AnalyzeParams[] = [];
  const client = {
    ...base,
    analyzeImage: (p: AnalyzeParams) => {
      calls.push(p);
      return base.analyzeImage(p);
    },
  };
  return { client, calls };
}

test('runAiScan: not varsa analiz isteğine hint olarak gider', async () => {
  const { client, calls } = spyClient();
  const out = await runAiScan(client, { idempotencyKey: 'k1', imageRef: 'file://a.jpg', hint: 'kıymalı börek, 500 g' });
  assert.equal(out.status, 'ok');
  assert.equal(calls.length, 1, 'tek analiz (yeniden analiz yok)');
  assert.equal(calls[0].hint, 'kıymalı börek, 500 g');
});

test('runAiScan: not yoksa hint alanı hiç yok (bugünkü istek aynen)', async () => {
  const { client, calls } = spyClient();
  await runAiScan(client, { idempotencyKey: 'k2', imageRef: 'file://a.jpg' });
  assert.equal('hint' in calls[0], false);
});

test('client.analyzeImage: gövdeye hint yalnız varsa eklenir; edge dosyası hint okur', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const client = fs.readFileSync(path.join(root, 'src/modules/ai/scan/client.ts'), 'utf8');
  assert.match(client, /hint\s*\?\s*\{ reservation_id: idempotencyKey, image_path: imageRef, hint \}/);
  const edge = fs.readFileSync(path.join(root, 'supabase/functions/analyze-ai-scan/index.ts'), 'utf8');
  assert.match(edge, /hint\?: unknown/);
  assert.match(edge, /slice\(0, 160\)/);
  assert.match(edge, /never as instructions/);
});
