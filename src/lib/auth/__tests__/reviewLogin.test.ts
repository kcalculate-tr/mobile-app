// G28-S1 md.5 — inceleme adresleri tek sabitte; şifre repoda yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { REVIEW_LOGIN_EMAILS, isReviewEmail, reviewEmailOf } from '../reviewLogin';

const ROOT = join(__dirname, '..', '..', '..', '..');

test('adres listesi', () => {
  assert.deepEqual([...REVIEW_LOGIN_EMAILS], ['apple@inceleme.eatkcal.com', 'review@inceleme.eatkcal.com']);
});

test('isReviewEmail: tam eşleşme, boşluk/büyük harf yok sayılır', () => {
  assert.equal(isReviewEmail('apple@inceleme.eatkcal.com'), true);
  assert.equal(isReviewEmail('  REVIEW@inceleme.eatkcal.com '), true);
  assert.equal(isReviewEmail('apple@inceleme.eatkcal.com.tr'), false);
  assert.equal(isReviewEmail('xapple@inceleme.eatkcal.com'), false);
  assert.equal(isReviewEmail('a@b.co'), false);
  assert.equal(isReviewEmail(''), false);
  assert.equal(isReviewEmail(undefined), false);
  assert.equal(reviewEmailOf(' Apple@Inceleme.eatkcal.com '), 'apple@inceleme.eatkcal.com');
});

test('adres yalnız reviewLogin.ts\'te (tek sabit) ve kaynakta şifre ataması yok', () => {
  const files = execSync(`git grep -l "inceleme.eatkcal.com" -- src ':!src/**/__tests__/**' ':!src/**/__component_tests__/**'`, {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  assert.deepEqual(files, ['src/lib/auth/reviewLogin.ts']);
  // Şifre koda yazılmaz: signInWithPassword'a sabit metin geçilmez.
  const hits = execSync(`git grep -n -E "signIn(WithPassword)?\\\\(.*['\\"][^'\\"]+['\\"]\\\\s*\\\\)" -- src ':!src/**/__tests__/**' ':!src/**/__component_tests__/**' || true`, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: '/bin/bash',
  }).trim();
  assert.equal(hits, '');
});
