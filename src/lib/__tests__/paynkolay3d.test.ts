import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize3DMessage, parsePay3DResponse } from '../../../supabase/functions/_shared/paynkolay-3d';
import { PAYMENT_PAGE_ERROR_MESSAGE, toRenderableFormHtml } from '../paymentHtml';

const FORM = '<html><body onload="document.forms[0].submit()"><form method="POST" action="https://bank.example/3d"><input name="PaReq" value="abc"/></form></body></html>';
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

// Kullanıcının bildirdiği gerçek alan kümesi (BANK_REQUEST_MESSAGE içeriği değişken).
const payJson = (msg: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    USE_3D: 'true',
    BANK_REQUEST_MESSAGE: msg,
    REFERENCE_CODE: 'IKSIRPF335519406',
    AUTH_CODE: null,
    sessionId: 'd9f311ef-x',
    CORE_TRX_ID_RESERVED: '4DBC653F-x',
    ERROR_MESSAGE: null,
    ...extra,
  });

test('düz HTML BANK_REQUEST_MESSAGE -> form', () => {
  const r = parsePay3DResponse(payJson(FORM));
  assert.equal(r.kind, 'form');
  assert.equal(r.kind === 'form' && r.format, 'html');
  assert.equal(r.kind === 'form' && r.html, FORM);
});

test('base64 HTML (Türkçe karakterli) -> çözülür', () => {
  const html = FORM.replace('abc', 'şğüıöç');
  const r = parsePay3DResponse(payJson(b64(html)));
  assert.equal(r.kind, 'form');
  assert.equal(r.kind === 'form' && r.format, 'base64_html');
  assert.equal(r.kind === 'form' && r.html, html);
});

test('URL-encoded ve entity-escaped HTML çözülür', () => {
  assert.equal(normalize3DMessage(encodeURIComponent(FORM)).format, 'html_urlencoded');
  assert.equal(normalize3DMessage(FORM.replace(/</g, '&lt;').replace(/>/g, '&gt;')).format, 'html_entities');
});

test('https URL -> yönlendirme sayfası', () => {
  const n = normalize3DMessage('https://bank.example/3d?x=1&y="2"');
  assert.equal(n.format, 'url');
  assert.match(n.html!, /window\.location\.replace/);
  assert.doesNotMatch(n.html!, /y="2"/); // tırnak kaçırılmış
});

test('HTML olmayan JSON gövdesi (gerçek hata): ham JSON asla form olmaz', () => {
  const r = parsePay3DResponse(payJson('bilinmeyen-düz-metin'));
  assert.equal(r.kind, 'error');
});

test('BANK_REQUEST_MESSAGE yok/boş -> hata', () => {
  assert.equal(parsePay3DResponse(payJson(null)).kind, 'error');
  assert.equal(parsePay3DResponse(payJson('')).kind, 'error');
});

test('ERROR_MESSAGE dolu ve form yok -> provider_error', () => {
  const r = parsePay3DResponse(payJson(null, { ERROR_MESSAGE: 'Limit yetersiz' }));
  assert.equal(r.kind, 'error');
  assert.equal(r.kind === 'error' && r.reason, 'provider_error');
  assert.equal(r.kind === 'error' && r.providerError, 'Limit yetersiz');
});

test('JSON olmayan gövde: HTML ise form, düz metin ise hata', () => {
  assert.equal(parsePay3DResponse(FORM).kind, 'form');
  assert.equal(parsePay3DResponse('Internal Server Error').kind, 'error');
});

test('anahtar adları büyük/küçük harf duyarsız (bankRequestMessage)', () => {
  const r = parsePay3DResponse(JSON.stringify({ bankRequestMessage: FORM }));
  assert.equal(r.kind, 'form');
});

// ── İstemci savunması: ham JSON/düz metin ASLA WebView'e verilmez ───────────
test('toRenderableFormHtml: JSON, düz metin, boş, string-olmayan reddedilir', () => {
  assert.equal(toRenderableFormHtml(payJson(FORM)), null); // ham PaynKolay JSON'u (bildirilen hata)
  assert.equal(toRenderableFormHtml('hazırlık süreci başarılı'), null);
  assert.equal(toRenderableFormHtml(''), null);
  assert.equal(toRenderableFormHtml(undefined), null);
  assert.equal(toRenderableFormHtml({ a: 1 }), null);
  assert.equal(toRenderableFormHtml('<b>merhaba</b>'), null); // form/html işareti yok
});

test('toRenderableFormHtml: geçerli form HTML\'i kabul edilir', () => {
  assert.equal(toRenderableFormHtml(`  ${FORM}\n`), FORM);
  assert.ok(PAYMENT_PAGE_ERROR_MESSAGE.length > 10);
});
