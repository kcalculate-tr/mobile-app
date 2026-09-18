import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  POLL_INTERVAL_MS,
  POLL_MAX_MS,
  VerificationStatus,
  consumeCardsStale,
  inProgressMessage,
  isTerminalStatus,
  markCardsStale,
  minutesFromSeconds,
  pollVerification,
  resultForStatus,
} from '../cardVerification';
import { matchesPaynkolayReturn } from '../paynkolayReturn';

const st = (status: string, o: Partial<VerificationStatus> = {}): VerificationStatus => ({
  status, card_saved: false, note: null, refunded: status === 'refunded', ...o,
});

// ── Sonuç metinleri (kullanıcının onayladığı birebir) ─────────────────────────
test('sonuç metinleri: onaylanan 5 senaryo BİREBİR', () => {
  assert.equal(resultForStatus(st('refunded', { card_saved: true }))!.message, 'Kartın kaydedildi. 1 TL doğrulama tutarı iade edildi.');
  assert.equal(resultForStatus(st('refund_pending', { card_saved: true }))!.message, 'Kartın kaydedildi. 1 TL doğrulama tutarı kısa süre içinde iade edilecek.');
  assert.equal(resultForStatus(st('refunded', { note: 'duplicate_card' }))!.message, 'Bu kart zaten kayıtlı. 1 TL doğrulama tutarı iade edildi.');
  assert.equal(resultForStatus(st('refunded', { note: 'card_not_listed' }))!.message, 'Kart kaydedilemedi, tutar iade edildi.');
  assert.equal(resultForStatus(st('failed', { note: 'declined' }))!.message, 'Kart doğrulanamadı, tutar çekilmedi.');
});

test('KURAL: "iade edildi" YALNIZ status=refunded iken söylenir', () => {
  const notes = [null, 'duplicate_card', 'duplicate_card_delete_failed', 'card_not_listed', 'amount_mismatch', 'report_recovered'];
  for (const status of ['refund_pending', 'refund_failed'] as const) {
    for (const note of notes) for (const card_saved of [true, false]) {
      const m = resultForStatus(st(status, { note, card_saved }))!.message;
      assert.doesNotMatch(m, /iade edildi/, `${status}/${note}/${card_saved}: ${m}`);
      assert.match(m, /iade/);
    }
  }
  // failed satırlarda da "iade edildi" yok (para çekilmemiş ya da otomatik iade edilecek)
  for (const note of ['declined', 'cancelled', 'timeout', 'init_error', null]) {
    assert.doesNotMatch(resultForStatus(st('failed', { note }))!.message, /iade edildi/);
  }
});

test('card_saved, amount_mismatch gibi notlara baskın; refund_failed "ekibimiz takip ediyor"', () => {
  assert.match(resultForStatus(st('refunded', { card_saved: true, note: 'amount_mismatch' }))!.message, /^Kartın kaydedildi/);
  const m = resultForStatus(st('refund_failed', { card_saved: true }))!.message;
  assert.match(m, /^Kartın kaydedildi\./);
  assert.match(m, /takip ediliyor/);
});

test('duplicate_card_delete_failed kullanıcıya "zaten kayıtlı" gösterilir; card_not_listed+bekleyen iade doğru', () => {
  assert.match(resultForStatus(st('refunded', { note: 'duplicate_card_delete_failed' }))!.message, /^Bu kart zaten kayıtlı/);
  assert.equal(resultForStatus(st('refund_pending', { note: 'card_not_listed' }))!.message, 'Kart kaydedilemedi. 1 TL doğrulama tutarı kısa süre içinde iade edilecek.');
});

test('failed: iptal / timeout mesajları; tekrar deneme izni', () => {
  assert.equal(resultForStatus(st('failed', { note: 'cancelled' }))!.message, 'Kart doğrulaması iptal edildi.');
  assert.match(resultForStatus(st('failed', { note: 'timeout' }))!.message, /Tutar çekildiyse otomatik olarak iade edilir/);
  assert.equal(resultForStatus(st('failed', { note: 'declined' }))!.canRetry, true);
  assert.equal(resultForStatus(st('refunded', { card_saved: true }))!.canRetry, false);
});

test('tonlar: kayıt=success, zaten kayıtlı=info, kaydedilemedi/declined=error', () => {
  assert.equal(resultForStatus(st('refunded', { card_saved: true }))!.tone, 'success');
  assert.equal(resultForStatus(st('refunded', { note: 'duplicate_card' }))!.tone, 'info');
  assert.equal(resultForStatus(st('refunded', { note: 'card_not_listed' }))!.tone, 'error');
  assert.equal(resultForStatus(st('failed', { note: 'declined' }))!.tone, 'error');
});

test('initiated/succeeded/bilinmeyen: nihai değil (null) -> polling sürer', () => {
  for (const s of ['initiated', 'succeeded', 'whatever']) {
    assert.equal(resultForStatus(st(s)), null);
    assert.equal(isTerminalStatus(s), false);
  }
  for (const s of ['refunded', 'refund_pending', 'refund_failed', 'failed']) assert.equal(isTerminalStatus(s), true);
});

// ── 409 / dakika ──────────────────────────────────────────────────────────────
test('409 mesajı: saniyeden yukarı yuvarlanmış dakika, en az 1', () => {
  assert.equal(minutesFromSeconds(600), 10);
  assert.equal(minutesFromSeconds(601), 11);
  assert.equal(minutesFromSeconds(1), 1);
  assert.equal(minutesFromSeconds(undefined), 1);
  assert.equal(minutesFromSeconds(-5), 1);
  assert.equal(inProgressMessage(540), 'Devam eden bir kart doğrulaman var. 9 dakika sonra tekrar deneyebilirsin.');
});

// ── Polling ───────────────────────────────────────────────────────────────────
function clock() {
  let t = 0;
  const sleeps: number[] = [];
  return { now: () => t, sleep: async (ms: number) => { sleeps.push(ms); t += ms; }, sleeps, advance: (ms: number) => { t += ms; } };
}

test('polling: ilk sorgu BEKLEMEDEN; 2.5 sn aralık', async () => {
  const c = clock();
  const seq = [st('initiated'), st('initiated'), st('refunded', { card_saved: true })];
  let i = 0;
  const out = await pollVerification({ fetchStatus: async () => seq[i++], sleep: c.sleep, now: c.now });
  assert.equal(out.kind, 'terminal');
  assert.equal(i, 3);
  assert.deepEqual(c.sleeps, [POLL_INTERVAL_MS, POLL_INTERVAL_MS]);
  assert.equal(POLL_INTERVAL_MS, 2500);
});

test('polling: hemen nihai ise hiç beklemez', async () => {
  const c = clock();
  const out = await pollVerification({ fetchStatus: async () => st('failed', { note: 'declined' }), sleep: c.sleep, now: c.now });
  assert.equal(out.kind, 'terminal');
  assert.deepEqual(c.sleeps, []);
});

test('polling: succeeded (iade sürüyor) beklemeye devam eder, sonra nihaiyi döner', async () => {
  const c = clock();
  const seq = [st('succeeded'), st('refund_pending', { card_saved: true })];
  let i = 0;
  const out = await pollVerification({ fetchStatus: async () => seq[i++], sleep: c.sleep, now: c.now });
  assert.equal(out.kind, 'terminal');
  if (out.kind === 'terminal') assert.match(out.result.message, /kısa süre içinde iade edilecek/);
});

test('polling: ~60 sn sonra timeout (sonsuz beklemez)', async () => {
  const c = clock();
  let calls = 0;
  const out = await pollVerification({ fetchStatus: async () => { calls++; return st('initiated'); }, sleep: c.sleep, now: c.now });
  assert.equal(out.kind, 'timeout');
  assert.ok(c.now() <= POLL_MAX_MS && c.now() >= POLL_MAX_MS - POLL_INTERVAL_MS, `toplam bekleme ${c.now()}`);
  assert.ok(calls >= 20 && calls <= 26, `çağrı sayısı ${calls}`);
});

test('polling: geçici ağ hatası durdurmaz; sonraki turda sonuç alınır', async () => {
  const c = clock();
  let i = 0;
  const out = await pollVerification({
    fetchStatus: async () => { if (i++ < 2) throw new Error('network'); return st('refunded', { card_saved: true }); },
    sleep: c.sleep, now: c.now,
  });
  assert.equal(out.kind, 'terminal');
  assert.equal(i, 3);
});

test('polling: sürekli hata da sonunda timeout olur', async () => {
  const c = clock();
  const out = await pollVerification({ fetchStatus: async () => { throw new Error('down'); }, sleep: c.sleep, now: c.now });
  assert.equal(out.kind, 'timeout');
});

test('polling: iptal (ekran kapandı) -> aborted; tek-sorgu modu (maxMs=0) bekleme yapmaz', async () => {
  const c = clock();
  let abort = false;
  const out = await pollVerification({ fetchStatus: async () => { abort = true; return st('initiated'); }, sleep: c.sleep, now: c.now, isAborted: () => abort });
  assert.equal(out.kind, 'aborted');
  const once = await pollVerification({ fetchStatus: async () => st('initiated'), sleep: c.sleep, now: c.now, maxMs: 0 });
  assert.equal(once.kind, 'timeout');
  assert.deepEqual(c.sleeps, []);
  const onceDone = await pollVerification({ fetchStatus: async () => st('refunded', { card_saved: true }), sleep: c.sleep, now: c.now, maxMs: 0 });
  assert.equal(onceDone.kind, 'terminal');
});

test('kart listesi tazeleme bayrağı: bir kez tüketilir', () => {
  consumeCardsStale();
  assert.equal(consumeCardsStale(), false);
  markCardsStale();
  assert.equal(consumeCardsStale(), true);
  assert.equal(consumeCardsStale(), false);
});

// ── Dönüş URL'i (PaymentScreen'den taşındı — davranış AYNI) ───────────────────
test('matchesPaynkolayReturn: yalnız eatkcal.com/payment/success|fail', () => {
  assert.deepEqual(matchesPaynkolayReturn('https://eatkcal.com/payment/success'), { matches: true, success: true });
  assert.deepEqual(matchesPaynkolayReturn('https://www.eatkcal.com/payment/fail?x=1'), { matches: true, success: false });
  // callback ara durağı (query'de pk=success) dönüş SAYILMAZ
  assert.equal(matchesPaynkolayReturn('https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/paynkolay-callback?pk=success').matches, false);
  assert.equal(matchesPaynkolayReturn('https://paynkolay.nkolayislem.com.tr/Vpos').matches, false);
  assert.equal(matchesPaynkolayReturn('not a url').matches, false);
});

// ── Kaynak taramaları ─────────────────────────────────────────────────────────
const root = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const addCard = read('src/screens/profile/AddCardScreen.tsx');
const saved = read('src/screens/profile/SavedCardsScreen.tsx');
const payment = read('src/screens/PaymentScreen.tsx');
const cardsLib = read('src/lib/cards.ts');
const cardsFn = read('supabase/functions/paynkolay-cards/index.ts');

test('PaymentScreen: ortak matchesPaynkolayReturn kullanır, yerel kopya YOK', () => {
  assert.match(payment, /from '..\/lib\/paynkolayReturn'/);
  assert.doesNotMatch(payment, /const matchesPaynkolayReturn\s*=/);
});

test('SavedCards: "Kart Ekle" yalnız kapı açıkken; hata/kapalı = gizli; dönüşte yenileme', () => {
  assert.match(saved, /useState\(false\)/);
  assert.match(saved, /getCardsFeatureStatus\(\)/);
  assert.match(saved, /setCanAddCard\(r\?\.enabled === true\)/);
  assert.match(saved, /\.catch\(\(\) => \{ if \(!cancelled\) setCanAddCard\(false\)/);
  assert.match(saved, /\{canAddCard \? \(/);
  assert.match(saved, /navigate\('ProfileAddCard'\)/);
  assert.match(saved, /consumeCardsStale\(\)/);
});

test('AddCard: bilgilendirme metni, Devam/Vazgeç ve iptal butonu metinleri', () => {
  assert.match(addCard, /Kartını doğrulamak için 1 TL'lik bir işlem yapılacak ve aynı gün iade edilecek\./);
  assert.match(addCard, /label="Devam et"/);
  assert.match(addCard, /label="Vazgeç"/);
  assert.match(addCard, /label="İptal et ve yeniden dene"/);
});

test('AddCard: WebView kapatılınca önce TEK durum kontrolü, sonra "açık kayıt" bilgisi', () => {
  const fn = addCard.slice(addCard.indexOf('const handleWebViewClose'), addCard.indexOf('const handleNavigationCheck'));
  assert.match(fn, /runPoll\(id, 0\)/);
  assert.match(fn, /CLOSED_MESSAGE/);
  assert.match(fn, /setStage\('closed'\)/);
});

test('AddCard: WebView açık/poll sürerken geri hareketi ve donanım geri tuşu kayıt bırakmaz', () => {
  assert.match(addCard, /gestureEnabled: stage !== 'webview' && stage !== 'verifying'/);
  assert.match(addCard, /hardwareBackPress/);
});

test('AddCard: dönüş URL\'i bir kez işlenir ve navigasyonu engeller; sonuç sunucudan okunur', () => {
  const fn = addCard.slice(addCard.indexOf('const handleNavigationCheck'), addCard.indexOf('const goBackToCards'));
  assert.match(fn, /returnHandledRef\.current/);
  assert.match(fn, /return false;/);
  assert.match(fn, /beginVerifying\(id\)/);
});

test('AddCard: sayfa gösterilemezse açık kayıt iptal edilir (kullanıcı kilitli kalmaz)', () => {
  assert.match(addCard, /toRenderableFormHtml\(r\.formHtml\)/);
  assert.match(addCard, /if \(!html\) \{[\s\S]*?cancelCardVerification\(r\.verificationId\)/);
});

test('AddCard: log/konsolda formHtml/kart/token yok', () => {
  const logs = addCard.split('\n').filter((l) => /console\./.test(l)).join('\n');
  assert.doesNotMatch(logs.replace('[add-card]', ''), /formHtml|html|token|cardNumber|maskedPan/i);
});

test('cards.ts: verify_* helper\'ları 409/429\'u veri olarak döndürür', () => {
  assert.match(cardsLib, /'verify_start', \{\}, \{ throwOnFailure: false/);
  assert.match(cardsLib, /if \(json\.inProgress\)/);
  assert.match(cardsLib, /if \(json\.limitReached\)/);
  assert.match(cardsLib, /'verify_cancel'/);
});

test('verify_cancel (sunucu): kapı sonrası; yalnız KENDİ ve yalnız initiated; failed/cancelled; token yok', () => {
  const gate = cardsFn.indexOf('if (!featureAllowed)');
  assert.ok(gate !== -1 && gate < cardsFn.indexOf("action === 'verify_cancel'"));
  const fn = cardsFn.slice(cardsFn.indexOf('async function handleVerifyCancel'), cardsFn.indexOf('async function handleSetDefault'));
  assert.match(fn, /\.update\(\{ status: 'failed', note: 'cancelled' \}\)/);
  assert.match(fn, /\.eq\('user_id', userId\)/);
  assert.match(fn, /\.eq\('status', 'initiated'\)/);
  assert.match(fn, /toPublicStatus\(row\)/);
  assert.doesNotMatch(fn, /card_token|tran_id|paynkolay_reference_code|client_ref_code/);
  // sweep iptal edilenleri rapor kontrolüne dahil eder (para çekilmiş olabilir)
  assert.match(read('supabase/functions/_shared/paynkolay-verification-flow.ts'), /row\.note === 'cancelled'/);
});
