import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, dayKeyFromIso, lastDayKeys, startOfDayIso } from '../dayKey';

// 24.09.2026: Tracker yerel, Profil UTC, sunucu Europe/Istanbul kullanıyordu.
// Bu testler üçünün tek referansta (Europe/Istanbul) buluştuğunu sabitler.

test('gece yarısından sonraki öğün UTC gününe DEĞİL, İstanbul gününe yazılır', () => {
  // 25 Eylül 01:00 İstanbul = 24 Eylül 22:00 UTC.
  // Eski ProfileScreen mantığı bunu "2026-09-24" sayıyordu — hata buydu.
  assert.equal(dayKeyFromIso('2026-09-24T22:00:00.000Z'), '2026-09-25');
});

test('İstanbul gün sınırı 21:00 UTC’dir', () => {
  assert.equal(dayKeyFromIso('2026-09-24T20:59:59.000Z'), '2026-09-24');
  assert.equal(dayKeyFromIso('2026-09-24T21:00:00.000Z'), '2026-09-25');
});

test('gün ortası ve gün sonu doğru', () => {
  assert.equal(dayKeyFromIso('2026-09-24T09:00:00.000Z'), '2026-09-24'); // 12:00 TR
  assert.equal(dayKeyFromIso('2026-09-24T00:00:00.000Z'), '2026-09-24'); // 03:00 TR
});

test('ay ve yıl sınırı', () => {
  assert.equal(dayKeyFromIso('2026-09-30T21:00:00.000Z'), '2026-10-01');
  assert.equal(dayKeyFromIso('2026-12-31T21:00:00.000Z'), '2027-01-01');
});

test('boş / geçersiz girdi çökmez', () => {
  assert.equal(dayKeyFromIso(null), '');
  assert.equal(dayKeyFromIso(''), '');
  assert.equal(dayKeyFromIso('kesinlikle-tarih-degil'), '');
  assert.equal(dayKey(new Date('bozuk')), '');
});

test('son 7 gün eskiden yeniye sıralı ve bugünle biter', () => {
  const g = lastDayKeys(7, new Date('2026-09-24T09:00:00.000Z'));
  assert.equal(g.length, 7);
  assert.equal(g[6], '2026-09-24');
  assert.equal(g[0], '2026-09-18');
  assert.deepEqual([...g].sort(), g, 'sıralı olmalı');
});

test('gün başlangıcı sınırı İstanbul gece yarısıdır (UTC 21:00)', () => {
  const t = new Date('2026-09-24T09:00:00.000Z'); // 12:00 TR
  assert.equal(startOfDayIso(0, t), '2026-09-23T21:00:00.000Z');
  assert.equal(startOfDayIso(1, t), '2026-09-24T21:00:00.000Z');
  assert.equal(startOfDayIso(-7, t), '2026-09-16T21:00:00.000Z');
});

test('sınır ile gün anahtarı AYNI güne işaret eder', () => {
  // İkisi ayrışırsa Tracker "bugün" derken sorgu dünün verisini çeker.
  const t = new Date('2026-09-25T00:30:00.000Z'); // 03:30 TR, yeni gün
  assert.equal(dayKey(t), '2026-09-25');
  assert.equal(startOfDayIso(0, t), '2026-09-24T21:00:00.000Z');
});
