// Kutlama saf mantik testleri — SAF (native yok). Calistirma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { pickCelebration } from '../useCelebrations';
import { celebrateContent } from '../types';

test('pickCelebration: first her seyin onunde', () => {
  // first + streak7 ayni anda uygun olsa bile first kazanir.
  const m = pickCelebration({ isFirstMeal: true, streak: 10, shown: {} });
  assert.equal(m, 'first');
});

test('pickCelebration: streak7, streak3 oncesi gelir', () => {
  const m = pickCelebration({ isFirstMeal: false, streak: 7, shown: {} });
  assert.equal(m, 'streak7');
  // streak 9 da >=7 -> hala streak7.
  assert.equal(pickCelebration({ isFirstMeal: false, streak: 9, shown: {} }), 'streak7');
});

test('pickCelebration: streak3 yalniz 3..6 arasinda', () => {
  assert.equal(pickCelebration({ isFirstMeal: false, streak: 3, shown: {} }), 'streak3');
  assert.equal(pickCelebration({ isFirstMeal: false, streak: 6, shown: {} }), 'streak3');
});

test('pickCelebration: kosul yoksa null', () => {
  assert.equal(pickCelebration({ isFirstMeal: false, streak: 0, shown: {} }), null);
  assert.equal(pickCelebration({ isFirstMeal: false, streak: 2, shown: {} }), null);
});

test('pickCelebration: shown haritasi bastirir', () => {
  // first gosterildi -> siradaki uygun olana duser (streak7).
  assert.equal(
    pickCelebration({ isFirstMeal: true, streak: 7, shown: { first: true } }),
    'streak7',
  );
  // streak7 de gosterildi -> streak3.
  assert.equal(
    pickCelebration({ isFirstMeal: true, streak: 7, shown: { first: true, streak7: true } }),
    'streak3',
  );
  // hepsi gosterildi -> null.
  assert.equal(
    pickCelebration({
      isFirstMeal: true,
      streak: 7,
      shown: { first: true, streak7: true, streak3: true },
    }),
    null,
  );
});

test('celebrateContent: ucu de dogru eslenir', () => {
  const first = celebrateContent('first');
  assert.equal(first.glass, 'flame');
  assert.equal(first.ringProgress, 1);
  assert.equal(first.big, '1.');
  assert.equal(first.bigSub, 'first');

  const s3 = celebrateContent('streak3');
  assert.equal(s3.glass, 'flame');
  assert.equal(s3.ringProgress, 3 / 7);
  assert.equal(s3.big, '3');
  assert.equal(s3.bigSub, 'gun');

  const s7 = celebrateContent('streak7');
  assert.equal(s7.glass, 'flame'); // G15-S2: Final FinCelebStreak7
  assert.equal(s7.ringProgress, 1);
  assert.equal(s7.big, '7');
  assert.equal(s7.bigSub, 'gun');
});
