// G20-S3 md.1 — belge adları canlı legal_documents slug'larıyla aynı (tek kaynak).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { LEGAL_SLUG, normalizeLegalSlug } from '../slugs';
import { CONTRACTS } from '../../../data/contractsData';

const ROOT = join(__dirname, '..', '..', '..', '..');

test('canlı slug\'lar (Claude 9 Kas doğruladı)', () => {
  assert.deepEqual(
    Object.values(LEGAL_SLUG).sort(),
    ['gizlilik-politikasi', 'kullanim-kosullari', 'kvkk', 'mesafeli-satis'],
  );
});

test('uygulama içi metin kaynağı (contractsData) aynı slug\'ları kullanır', () => {
  assert.deepEqual(
    CONTRACTS.map((c) => c.slug).sort(),
    Object.values(LEGAL_SLUG).sort(),
  );
});

test('normalizeLegalSlug: canlı ad aynen, eski ad canlıya, bilinmeyen undefined', () => {
  assert.equal(normalizeLegalSlug('kullanim-kosullari'), 'kullanim-kosullari');
  assert.equal(normalizeLegalSlug(' KVKK '), 'kvkk');
  assert.equal(normalizeLegalSlug('terms'), 'kullanim-kosullari');
  assert.equal(normalizeLegalSlug('privacy'), 'gizlilik-politikasi');
  assert.equal(normalizeLegalSlug('distance-sales'), 'mesafeli-satis');
  assert.equal(normalizeLegalSlug('cookies'), undefined);
  assert.equal(normalizeLegalSlug(undefined), undefined);
  assert.equal(normalizeLegalSlug(42), undefined);
});

test('kaynakta eski belge adıyla gezinme / kayıt kalmadı', () => {
  // ProfileContracts'a eski adla gitmek ya da doc_slug'a eski ad yazmak = yanlış belge.
  const out = execSync(
    "grep -rnE \"slug: '(terms|privacy|distance-sales)'|setDoc\\('(terms|privacy)'\\)|open\\('(terms|privacy)'\\)\" src --include=*.ts --include=*.tsx | grep -v __tests__ | grep -v __component_tests__ || true",
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(out.trim(), '');
});
