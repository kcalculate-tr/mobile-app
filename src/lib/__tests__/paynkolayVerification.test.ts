import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  buildAutoSubmitForm,
  buildCardVerificationForm,
  escapeHtml,
  getRnd,
  toDecimalTL,
} from '../../../supabase/functions/_shared/paynkolay-hosted-form';
import {
  DAILY_VERIFICATION_LIMIT,
  MAX_REFUND_ATTEMPTS,
  findDuplicateOfNewCard,
  isDailyLimitReached,
  isInitiatedTimedOut,
  isVerificationRefCode,
  newVerificationRefCode,
  nextRefundState,
  trDayStartUtcIso,
} from '../../../supabase/functions/_shared/paynkolay-verification';

// ── Hosted form ─────────────────────────────────────────────────────────────
const P = {
  sx: 'SX', secretKey: 'SECRET', vposUrl: 'https://vpos.example/Vpos',
  clientRefCode: 'KCALVERabc12345', amount: '1.00',
  successUrl: 'https://f/callback?pk=success', failUrl: 'https://f/callback?pk=fail',
  rnd: '18.09.2026 21:00:00', customerKey: '85063455264', cardHolderIP: '1.2.3.4',
};

test('doğrulama formu: 1 TL, use3D, csAutoSave, customerKey + payment-init ile aynı hash sırası', async () => {
  const { fields, formHtml } = await buildCardVerificationForm(P);
  const expected = createHash('sha512')
    .update(['SX', 'KCALVERabc12345', '1.00', P.successUrl, P.failUrl, P.rnd, '85063455264', 'SECRET'].join('|'))
    .digest('base64');
  assert.equal(fields.hashDataV2, expected);
  assert.equal(fields.amount, '1.00');
  assert.equal(fields.use3D, 'true');
  assert.equal(fields.csAutoSave, 'true');
  assert.equal(fields.customerKey, '85063455264');
  assert.equal(fields.transactionType, 'sales');
  assert.equal(fields.currencyCode, '949');
  assert.ok(!('agentCode' in fields));
  assert.ok(!('secretKey' in fields) && !JSON.stringify(fields).includes('SECRET'));
  assert.match(formHtml, /<form method="POST" action="https:\/\/vpos\.example\/Vpos">/);
  assert.match(formHtml, /document\.forms\[0\]\.submit\(\)/);
});

test('agentCode yalnız verilirse eklenir; customerKey/clientRefCode/amount zorunlu', async () => {
  assert.equal((await buildCardVerificationForm({ ...P, agentCode: 'A1' })).fields.agentCode, 'A1');
  await assert.rejects(() => buildCardVerificationForm({ ...P, customerKey: '' }));
  await assert.rejects(() => buildCardVerificationForm({ ...P, clientRefCode: '' }));
  await assert.rejects(() => buildCardVerificationForm({ ...P, amount: '0.00' }));
});

test('form yardımcıları: kaçırma, rnd biçimi, tutar', () => {
  assert.equal(escapeHtml('a"<b>&'), 'a&quot;&lt;b&gt;&amp;');
  assert.match(buildAutoSubmitForm('https://x/y?a=1&b=2', { k: '"v"' }), /action="https:\/\/x\/y\?a=1&amp;b=2"[\s\S]*value="&quot;v&quot;"/);
  assert.equal(getRnd(new Date('2026-09-18T18:05:09Z')), '18.09.2026 21:05:09');
  assert.equal(toDecimalTL(1), '1.00');
});

// ── Doğrulama iş kuralları ──────────────────────────────────────────────────
test('ref kodu: KCALVER öneki, sipariş regex\'ine (^KCAL(\\d+)T) ASLA uymaz', () => {
  const code = newVerificationRefCode('a1c0f950-72cd-4ef3-8d67-051dbd891929');
  assert.equal(code, 'KCALVERa1c0f95072cd4ef38d67051dbd891929');
  assert.ok(isVerificationRefCode(code));
  assert.ok(!/^KCAL(\d+)T/.test(code));
  assert.ok(!isVerificationRefCode('KCAL382T1789753539914CARD'));
  assert.ok(!isVerificationRefCode('KCAL380T1789753539914'));
  assert.ok(!isVerificationRefCode(undefined));
  // ve tersi: gerçek sipariş kodu doğrulama sanılmaz
  assert.ok(/^KCAL(\d+)T/.test('KCAL382T1789753539914CARD'));
});

test('günlük limit: TR günü penceresi (gece yarısı 21:00Z) ve 3/gün', () => {
  assert.equal(trDayStartUtcIso(new Date('2026-09-18T18:00:00Z')), '2026-09-17T21:00:00.000Z'); // TR 21:00, gün başı TR 00:00
  assert.equal(trDayStartUtcIso(new Date('2026-09-18T21:00:00Z')), '2026-09-18T21:00:00.000Z'); // TR 00:00 -> yeni gün
  assert.equal(trDayStartUtcIso(new Date('2026-09-18T20:59:59Z')), '2026-09-17T21:00:00.000Z');
  assert.equal(DAILY_VERIFICATION_LIMIT, 3);
  assert.equal(isDailyLimitReached(2), false);
  assert.equal(isDailyLimitReached(3), true);
});

test('initiated zaman aşımı: 15 dk', () => {
  const now = new Date('2026-09-18T18:00:00Z');
  assert.equal(isInitiatedTimedOut('2026-09-18T17:46:00Z', now), false); // 14 dk
  assert.equal(isInitiatedTimedOut('2026-09-18T17:45:00Z', now), true); // 15 dk
  assert.equal(isInitiatedTimedOut('geçersiz', now), false);
});

const card = (token: string, tranId: string, maskedPan: string) => ({ token, tranId, maskedPan });

test('yinelenen kart: yeni kayıt (TranId) başka bir kayıtla aynı maskeli numaraya sahipse', () => {
  const list = [
    card('t-old', 'tr-old', '515787******1234'),
    card('t-new', 'tr-new', '515787******1234'),
  ];
  const r = findDuplicateOfNewCard(list, 'tr-new');
  assert.equal(r.isDuplicate, true);
  assert.equal(r.newEntry?.token, 't-new');
  assert.equal(r.existing?.token, 't-old');
});

test('yinelenen kart: farklı kart / yalnız-son-4 maske / yeni kayıt yok -> yinelenen SAYILMAZ (yanlış silme yok)', () => {
  assert.equal(findDuplicateOfNewCard([card('a', 'x', '515787******1234'), card('b', 'y', '454360******1234')], 'y').isDuplicate, false); // aynı son4, farklı BIN
  assert.equal(findDuplicateOfNewCard([card('a', 'x', '************1234'), card('b', 'y', '************1234')], 'y').isDuplicate, false); // karar verilemez
  assert.equal(findDuplicateOfNewCard([card('a', 'x', '515787******1234')], 'yok').isDuplicate, false);
  assert.equal(findDuplicateOfNewCard([card('a', 'x', '515787******1234')], 'x').isDuplicate, false); // tek kayıt
  assert.equal(findDuplicateOfNewCard([card('a', 'x', ''), card('b', 'y', '')], 'y').isDuplicate, false);
});

test('iade durumu: başarı -> refunded', () => {
  const n = nextRefundState(0, true, '', new Date('2026-09-18T18:00:00Z'));
  assert.equal(n.status, 'refunded');
  assert.equal(n.refund_attempts, 1);
  assert.equal(n.refunded_at, '2026-09-18T18:00:00.000Z');
  assert.equal(n.last_refund_error, null);
});

test('iade durumu: hata -> refund_pending; 72. deneme -> refund_failed', () => {
  const p = nextRefundState(0, false, 'reddedildi');
  assert.equal(p.status, 'refund_pending');
  assert.equal(p.refund_attempts, 1);
  assert.equal(p.refunded_at, null);
  assert.equal(nextRefundState(MAX_REFUND_ATTEMPTS - 2, false, 'x').status, 'refund_pending'); // 71. deneme
  const last = nextRefundState(MAX_REFUND_ATTEMPTS - 1, false, 'x'); // 72. deneme
  assert.equal(last.status, 'refund_failed');
  assert.equal(last.refund_attempts, 72);
});

test('iade durumu: hata metni kart-benzeri rakamlardan arındırılır, boşsa varsayılan', () => {
  assert.ok(!nextRefundState(0, false, 'kart 4111111111111111 hata').last_refund_error!.includes('4111111111111111'));
  assert.equal(nextRefundState(0, false, '').last_refund_error, 'bilinmeyen hata');
  assert.ok(nextRefundState(0, false, 'z'.repeat(999)).last_refund_error!.length <= 300);
});
