// G15-S1 (Ek karar) — Kcal AI kayıt v2 saf adım mantığı. `npm run test:unit` (tsx --test).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BIO_MAX,
  clampBio,
  isValidEmail,
  progressFor,
  socialOutcome,
  stepAfterAuthed,
  stepAfterHandleSubmit,
  stepOnBack,
} from '../signupAILogic';

test('afterAuthed: handle varsa bitir, yoksa ad+handle adımı', () => {
  assert.equal(stepAfterAuthed(true), 'done');
  assert.equal(stepAfterAuthed(false), 'handle');
});

test('geri oku: email/handle → welcome; welcome/profile → çık', () => {
  assert.equal(stepOnBack('email'), 'welcome');
  assert.equal(stepOnBack('handle'), 'welcome');
  assert.equal(stepOnBack('welcome'), 'exit');
  assert.equal(stepOnBack('profile'), 'exit');
});

test('handle submit: başarılı → profile, başarısız → handle', () => {
  assert.equal(stepAfterHandleSubmit(true), 'profile');
  assert.equal(stepAfterHandleSubmit(false), 'handle');
});

test('ilerleme çubuğu yalnız handle ve profile adımlarında', () => {
  assert.deepEqual(progressFor('handle'), { total: 2, done: 1 });
  assert.deepEqual(progressFor('profile'), { total: 2, done: 2 });
  assert.equal(progressFor('welcome'), null);
  assert.equal(progressFor('email'), null);
});

test('sosyal giriş: iptal sessiz, hata mesajlı, aksi devam', () => {
  assert.equal(socialOutcome({ cancelled: true }), 'cancelled');
  assert.equal(socialOutcome({ cancelled: true, error: 'x' }), 'cancelled');
  assert.equal(socialOutcome({ error: 'fail' }), 'error');
  assert.equal(socialOutcome({ error: null }), 'ok');
  assert.equal(socialOutcome({}), 'ok');
});

test('e-posta doğrulama', () => {
  assert.equal(isValidEmail(' a@b.co '), true);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail('a b@c.d'), false);
  assert.equal(isValidEmail(''), false);
});

test('bio 150 karakterle sınırlanır', () => {
  assert.equal(BIO_MAX, 150);
  assert.equal(clampBio('x'.repeat(200)).length, 150);
  assert.equal(clampBio('merhaba'), 'merhaba');
});
