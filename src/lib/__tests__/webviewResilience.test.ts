import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DeadlineError,
  START_REQUEST_TIMEOUT_MS,
  WEBVIEW_LOAD_TIMEOUT_MS,
  createLoadGuard,
  fetchWithTimeout,
  isBenignWebViewError,
  isFatalHttpError,
  isFormDocumentUrl,
  isProviderPageReady,
  userMessageForError,
  withDeadline,
} from '../webviewResilience';

const BASE = 'https://paynkolay.nkolayislem.com.tr';

test('sabitler: WebView yükleme 20 sn', () => {
  assert.equal(WEBVIEW_LOAD_TIMEOUT_MS, 20_000);
  assert.ok(START_REQUEST_TIMEOUT_MS > WEBVIEW_LOAD_TIMEOUT_MS);
});

// ── Hazır olma: form belgesi ≠ sağlayıcı sayfası ─────────────────────────────
test('form belgesi (baseUrl / about:blank / boş) sağlayıcı sayfası SAYILMAZ; hosted/banka URL\'i sayılır', () => {
  for (const u of [BASE, BASE + '/', 'about:blank', '', undefined, null, BASE + '/#x']) {
    assert.equal(isFormDocumentUrl(u as string, BASE), true, String(u));
    assert.equal(isProviderPageReady(u as string, BASE), false, String(u));
  }
  for (const u of [BASE + '/Vpos/Payment/Hosted?x=1', 'https://acs.bank.example/3ds/challenge', 'https://paynkolay.nkolayislem.com.tr/Vpos']) {
    assert.equal(isProviderPageReady(u, BASE), true, u);
  }
});

// ── Hata sınıflandırma ───────────────────────────────────────────────────────
test('onError: iptal edilen navigasyon (iOS -999 / ERR_ABORTED) gerçek hata DEĞİL; ağ hatası gerçek', () => {
  assert.equal(isBenignWebViewError({ code: -999, description: 'The operation couldn’t be completed. (NSURLErrorDomain error -999.)' }), true);
  assert.equal(isBenignWebViewError({ code: -3, description: 'net::ERR_ABORTED' }), true);
  assert.equal(isBenignWebViewError({ code: -1001, description: 'The request timed out.' }), false);
  assert.equal(isBenignWebViewError({ code: -1009, description: 'The Internet connection appears to be offline.' }), false);
  assert.equal(isBenignWebViewError({ code: -2, description: 'net::ERR_NAME_NOT_RESOLVED' }), false);
});

test('onHttpError: yalnız ana belge 4xx/5xx ölümcül; alt kaynak (favicon) 404 yoksayılır', () => {
  const main = BASE + '/Vpos/Payment/Hosted';
  assert.equal(isFatalHttpError({ statusCode: 502, url: main }, main), true);
  assert.equal(isFatalHttpError({ statusCode: 503, url: main + '/' }, main), true);
  assert.equal(isFatalHttpError({ statusCode: 404, url: BASE + '/favicon.ico' }, main), false);
  assert.equal(isFatalHttpError({ statusCode: 200, url: main }, main), false);
  assert.equal(isFatalHttpError({ statusCode: 500, url: main }, ''), false);
});

// ── Bekçi (fake timer) ───────────────────────────────────────────────────────
function fakeTimers() {
  const tasks = new Map<number, { fn: () => void; at: number }>();
  let now = 0;
  let id = 0;
  return {
    setTimer: (fn: () => void, ms: number) => { tasks.set(++id, { fn, at: now + ms }); return id; },
    clearTimer: (h: unknown) => { tasks.delete(h as number); },
    advance(ms: number) {
      now += ms;
      for (const [k, t] of [...tasks]) if (t.at <= now) { tasks.delete(k); t.fn(); }
    },
    pending: () => tasks.size,
  };
}

test('bekçi: hazır olmazsa 20 sn sonra TAM 1 kez tetiklenir', () => {
  const t = fakeTimers();
  let fired = 0;
  const g = createLoadGuard({ onTimeout: () => { fired++; }, setTimer: t.setTimer, clearTimer: t.clearTimer });
  g.start();
  t.advance(19_999);
  assert.equal(fired, 0);
  t.advance(1);
  assert.equal(fired, 1);
  t.advance(60_000);
  assert.equal(fired, 1);
});

test('bekçi: sayfa hazır olursa (markReady) tetiklenmez; stop() de iptal eder; start() yeniden kurar', () => {
  const t = fakeTimers();
  let fired = 0;
  const g = createLoadGuard({ onTimeout: () => { fired++; }, setTimer: t.setTimer, clearTimer: t.clearTimer });
  g.start(); g.markReady(); t.advance(60_000);
  assert.equal(fired, 0);
  assert.equal(g.isReady(), true);
  g.start(); g.stop(); t.advance(60_000);
  assert.equal(fired, 0);
  g.start(); t.advance(20_000);
  assert.equal(fired, 1);
  assert.equal(t.pending(), 0);
});

// ── Üst süreler ──────────────────────────────────────────────────────────────
test('withDeadline: zamanında çözülür; süre dolarsa DeadlineError; hata aynen iletilir', async () => {
  assert.equal(await withDeadline(Promise.resolve(7), 50), 7);
  await assert.rejects(() => withDeadline(new Promise(() => {}), 20), (e: Error) => e instanceof DeadlineError);
  await assert.rejects(() => withDeadline(Promise.reject(new Error('x')), 50), /x/);
});

test('fetchWithTimeout: takılan istek AbortError ile biter; normal istek döner', async () => {
  const hang = (_u: string, init: { signal: { addEventListener: (n: string, f: () => void) => void } }) =>
    new Promise((_, reject) => { init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }); });
  await assert.rejects(() => fetchWithTimeout('https://x', {}, 20, hang as never), (e: Error) => e.name === 'AbortError');
  const ok = await fetchWithTimeout('https://x', {}, 50, (async () => ({ ok: true })) as never);
  assert.deepEqual(ok, { ok: true });
});

test('userMessageForError: ağ/zaman aşımı/İngilizce -> Türkçe genel mesaj; Türkçe sunucu mesajı korunur', () => {
  const abort = Object.assign(new Error('Aborted'), { name: 'AbortError' });
  assert.equal(userMessageForError(abort, 'F'), 'F');
  assert.equal(userMessageForError(new DeadlineError(), 'F'), 'F');
  assert.equal(userMessageForError(new Error('Network request failed'), 'F'), 'F');
  assert.equal(userMessageForError(new Error('Something weird'), 'F'), 'F');
  assert.equal(userMessageForError(new Error('Oturum bulunamadı'), 'F'), 'Oturum bulunamadı');
  assert.equal(userMessageForError(new Error('İşlem başlatılamadı'), 'F'), 'İşlem başlatılamadı');
  assert.match(userMessageForError(undefined), /Bağlantı sorunu/);
});

// ── Kaynak taramaları: hiçbir koşulda sonsuz "yükleniyor" kalmasın ────────────
const root = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const add = read('src/screens/profile/AddCardScreen.tsx');
const pay = read('src/screens/PaymentScreen.tsx');
const cards = read('src/lib/cards.ts');

test('AddCard: WebView 20 sn bekçisi + onError + onHttpError bağlı', () => {
  assert.match(add, /createLoadGuard\(\{ onTimeout: \(\) => failRef\.current\('timeout'\) \}\)/);
  assert.match(add, /guard\.start\(\)/);
  assert.match(add, /onLoadEnd=\{\(e\) => markProviderReady\(e\.nativeEvent\.url\)\}/);
  assert.match(add, /onError=\{/);
  assert.match(add, /onHttpError=\{/);
  assert.match(add, /isBenignWebViewError\(ev\)\) return/);
  assert.match(add, /isFatalHttpError\(ev, mainUrlRef\.current\)/);
});

test('AddCard: sayfa açılamazsa WebView kaldırılır, mesaj SABİT, kayıt OTOMATİK iptal, tekrar dene var', () => {
  const fn = add.slice(add.indexOf('const handleLoadFailure'), add.indexOf('const failRef'));
  assert.match(fn, /setFormHtml\(null\)/);
  assert.match(fn, /setStage\('load_failed'\)/);
  assert.match(fn, /cancelCardVerification\(id\)/);
  assert.match(fn, /console\.warn\('\[add-card\] sayfa açılamadı'/);
  assert.match(add, /label="Tekrar dene" onPress=\{retryAfterLoadFailure\}/);
  assert.match(read('src/lib/webviewResilience.ts'), /PAGE_LOAD_FAILED_MESSAGE = 'Sayfa şu an açılamadı, tekrar dene\.'/);
  // dönüş URL'i işlendikten sonra gelen hata/zaman aşımı sonucu bozmaz
  assert.match(fn, /returnHandledRef\.current/);
});

test('AddCard: "starting" ve "verifying" sonsuz sürmez (üst süre); ekrandan çıkışta açık kayıt iptal edilir', () => {
  assert.match(add, /withDeadline\(startCardVerification\(\), START_REQUEST_TIMEOUT_MS\)/);
  assert.match(add, /withDeadline\(runPoll\(id\), POLL_MAX_MS \+ 15_000\)/);
  assert.match(add, /withDeadline\(runPoll\(id, 0\), 15_000\)/);
  // başlatma beklerken ekrandan çıkıldıysa yeni açılan kayıt iptal edilir
  assert.match(add, /if \(abortedRef\.current\) \{[\s\S]*?cancelCardVerification\(r\.verificationId\)/);
  // unmount + WebView açık + dönüş yok -> iptal
  assert.match(add, /stageRef\.current === 'webview' && !returnHandledRef\.current[\s\S]*?cancelCardVerification\(id\)/);
});

test('LİMİT: otomatik iptal verify_cancel (failed+cancelled) kullanır -> günlük limite sayılmaz', () => {
  assert.match(cards, /'verify_cancel'/);
  assert.match(read('supabase/functions/paynkolay-cards/index.ts'), /update\(\{ status: 'failed', note: 'cancelled' \}\)/);
  assert.match(read('supabase/functions/_shared/paynkolay-verification-flow.ts'), /row\.status === 'failed' && row\.note === 'cancelled'/);
});

test('Ödeme: WebView bekçisi + onError + onHttpError; bant WebView\'i KAPATMAZ (yavaş ama çalışan sayfa kesilmesin)', () => {
  assert.match(pay, /createLoadGuard\(\{/);
  assert.match(pay, /onHttpError=\{onWebViewHttpError\}/);
  assert.match(pay, /onLoadEnd=\{onLoadEnd\}/);
  const timeoutBody = pay.slice(pay.indexOf('const guard = createLoadGuard('), pay.indexOf('guardRef.current = guard;', pay.indexOf('const guard = createLoadGuard(')));
  assert.match(timeoutBody, /setStalled\(/);
  assert.doesNotMatch(timeoutBody, /setFormHtml\(null\)/);
  assert.match(pay, /\{stalled && formHtml && !verifying \? \(/);
  assert.match(pay, /Tekrar dene/);
  assert.match(pay, /Geri Dön/);
});

test('Ödeme: init/saklı kart isteği/sipariş kontrolü/onay polling sonsuz sürmez', () => {
  assert.match(pay, /fetchWithTimeout\(PAYNKOLAY_INIT_URL/);
  assert.match(pay, /START_REQUEST_TIMEOUT_MS/);
  assert.match(cards, /throwOnFailure: false, timeoutMs: 25000/);
  const review = pay.slice(pay.indexOf('const { data: orderRow }'), pay.indexOf('if (orderRow?.payment_review_pending)'));
  assert.match(review, /withDeadline\(/);
  const poll = pay.slice(pay.lastIndexOf('const pollOrderConfirmed'), pay.indexOf('const handleSuccess', pay.lastIndexOf('const pollOrderConfirmed')));
  assert.match(poll, /withDeadline\(/);
});

test('Ödeme: iOS -999 / dönüş engeli hata bandı tetiklemez; hata metni Türkçe genel mesaj', () => {
  assert.match(pay, /isBenignWebViewError\(ev\) \|\| handledRef\.current\) return/);
  assert.match(pay, /userMessageForError\(err, PAYMENT_PAGE_LOAD_FAILED_MESSAGE\)/);
  assert.match(read('src/lib/webviewResilience.ts'), /PAYMENT_PAGE_LOAD_FAILED_MESSAGE = 'Ödeme sayfası şu an açılamadı\. Lütfen tekrar dene\.'/);
});
