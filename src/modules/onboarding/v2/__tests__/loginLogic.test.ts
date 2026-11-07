import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSendCode,
  formatCountdown,
  hasNutritionGoal,
  interpretSocialResult,
  isCodeComplete,
  isValidEmail,
  needsAgeGate,
  resolveLoginTarget,
  sanitizeCode,
  type GoalClient,
} from '../loginLogic';

test('e-posta doğrulama', () => {
  assert.equal(isValidEmail(' a@b.co '), true);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail('a b@c.com'), false);
  assert.equal(isValidEmail(''), false);
});

test('geri sayım biçimi', () => {
  assert.equal(formatCountdown(60), '01:00');
  assert.equal(formatCountdown(5), '00:05');
  assert.equal(formatCountdown(-3), '00:00');
});

test('18+ kapısı yalnız onboarding/yaş onayı yoksa', () => {
  assert.equal(needsAgeGate(null, null), true);
  assert.equal(needsAgeGate('true', null), false);
  assert.equal(needsAgeGate(null, 'true'), false);
});

test('kod gönderme ön kontrolü: önce yaş, sonra e-posta', () => {
  assert.equal(checkSendCode({ needsAgeGate: true, ageConfirmed: false, email: 'x' }), 'age');
  assert.equal(checkSendCode({ needsAgeGate: true, ageConfirmed: true, email: 'x' }), 'email');
  assert.equal(checkSendCode({ needsAgeGate: false, ageConfirmed: false, email: 'a@b.co' }), 'ok');
});

test('kod temizleme + tamamlanma', () => {
  assert.equal(sanitizeCode('12a3-45 678'), '123456');
  assert.equal(isCodeComplete('123456'), true);
  assert.equal(isCodeComplete('12345'), false);
});

test('hedef çözümü: Checkout/Addresses araya girilmez', () => {
  assert.deepEqual(resolveLoginTarget('Checkout', false), { name: 'Checkout' });
  assert.deepEqual(resolveLoginTarget('Addresses', false), { name: 'Addresses' });
  assert.deepEqual(resolveLoginTarget(undefined, false), { name: 'NutritionProfile', params: { firstTime: true } });
  assert.deepEqual(resolveLoginTarget(undefined, true), { name: 'Tabs', params: { screen: 'Home' } });
});

test('resolveLoginTarget (yeni kabuk, G17-S1 md.4): hedefi olan/olmayan herkes Ana sayfa (Tracker); Checkout/Addresses yönlendirmesi korunur', () => {
  assert.deepEqual(resolveLoginTarget(undefined, false, true), { name: 'Tabs', params: { screen: 'Tracker' } });
  assert.deepEqual(resolveLoginTarget(undefined, true, true), { name: 'Tabs', params: { screen: 'Tracker' } });
  assert.deepEqual(resolveLoginTarget('Checkout', false, true), { name: 'Checkout' });
  assert.deepEqual(resolveLoginTarget('Addresses', true, true), { name: 'Addresses' });
});

function client(over: { uid?: string | null; data?: unknown; error?: unknown; throws?: boolean }): () => Promise<GoalClient> {
  return async () => {
    if (over.throws) throw new Error('x');
    return {
      auth: { getUser: async () => ({ data: { user: over.uid ? { id: over.uid } : null } }) },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: over.data ?? null, error: over.error ?? null }) }) }),
      }),
    };
  };
}

test('hedefiVarMi: kimlik yok / hata / istisna → true (araya girme)', async () => {
  assert.equal(await hasNutritionGoal(client({ uid: null })), true);
  assert.equal(await hasNutritionGoal(client({ error: { m: 1 } }), 'u1'), true);
  assert.equal(await hasNutritionGoal(client({ throws: true }), 'u1'), true);
});

test('hedefiVarMi: kayıt varsa true, yoksa false; kimlik oturumdan çözülür', async () => {
  assert.equal(await hasNutritionGoal(client({ data: { user_id: 'u1' } }), 'u1'), true);
  assert.equal(await hasNutritionGoal(client({}), 'u1'), false);
  assert.equal(await hasNutritionGoal(client({ uid: 'u2' })), false);
});

test('sosyal sonuç: iptal sessiz, hata mesaj, yeni/dönen kullanıcı', async () => {
  let called = 0;
  const post = (o: 'new_user' | 'returning_user' | 'error', error?: string) => async () => {
    called++;
    return { outcome: o, error };
  };
  assert.deepEqual(await interpretSocialResult({ error: null, cancelled: true }, post('new_user')), { kind: 'cancelled' });
  assert.equal(called, 0);
  assert.deepEqual(await interpretSocialResult({ error: 'boom' }, post('new_user')), { kind: 'error', message: 'boom' });
  assert.deepEqual(await interpretSocialResult({ error: null }, post('new_user')), { kind: 'done', newUser: true });
  assert.deepEqual(await interpretSocialResult({ error: null }, post('returning_user')), { kind: 'done', newUser: false });
  assert.deepEqual(await interpretSocialResult({ error: null }, post('error')), { kind: 'error', message: 'Bir hata oluştu.' });
  assert.deepEqual(await interpretSocialResult({ error: null }, post('error', 'oturum yok')), { kind: 'error', message: 'oturum yok' });
});
