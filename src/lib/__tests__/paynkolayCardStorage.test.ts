import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RECONCILE_MARGIN_MS,
  deleteCardVerified,
  fetchListOutcome,
  isCardStorageListEmpty,
  planOrphans,
  sanitizeText,
  ListOutcome,
} from '../../../supabase/functions/_shared/paynkolay-card-storage';

const CFG = { vposUrl: 'https://vpos.example/Vpos', sx: 'SX_VAL', secretKey: 'SECRET_VAL' };
const CK = 'cust-key-1';
const TOKEN = 'TOKEN_ABC_1234567890_SECRET';
const OTHER = 'TOKEN_OTHER_999';
const sha = (parts: string[]) => createHash('sha512').update(parts.join('|')).digest('base64');

// ── Canlıda gözlenen gerçek zarflar ───────────────────────────────────────────
const LIST_OK = (tokens: string[]) => ({
  ProcReturnCode: '00', ErrMsg: 'İşlem Başarılı',
  Data: { cards: { Card: { CardFileds: { Detail: tokens.map((t, i) => ({ Token: t, TranId: `TR${i}`, Maskedpan: `5528 79** **** 970${i}`, CARDBRAND: 'MASTERCARD', CARDISSUER: 'QNB BANK A.Ş.' })) } } } },
});
const LIST_EMPTY = { ProcReturnCode: '02', ErrMsg: 'Gecerli Kart Yok' }; // 2026-09-18 22:03 canlı
const DELETE_ENVELOPE = { TRAN_ID: '', RESPONSE_CODE: '2', ERROR_CODE: '', RESPONSE_DATA: 'ok', sessionId: 's', CORE_TRX_ID_RESERVED: '', ERROR_MESSAGE: '', TimeStamp: 't' };

type Call = { kind: 'list' | 'delete'; fields: Record<string, string> };
type Reply = { status?: number; body: unknown } | Error;
function mock(deleteReply: Reply, listReplies: Reply[]) {
  const calls: Call[] = [];
  let li = 0;
  const fetchFn = async (url: string, init: { body: any }) => {
    const fields: Record<string, string> = {};
    init.body.forEach((v: string, k: string) => { fields[k] = v; });
    const isDelete = url.endsWith('/Payment/CardStorageCardDelete');
    calls.push({ kind: isDelete ? 'delete' : 'list', fields });
    const r = isDelete ? deleteReply : listReplies[Math.min(li++, listReplies.length - 1)];
    if (r instanceof Error) throw r;
    const status = r.status ?? 200;
    return { ok: status < 300, status, text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)) };
  };
  return { fetchFn, calls };
}
const P = { ...CFG, customerKey: CK, tranId: '1234567890', token: TOKEN };

// ── Liste sınıflandırma ───────────────────────────────────────────────────────
test('liste: 00 -> listed; "02 Gecerli Kart Yok" -> KESİN boş (hata değil)', async () => {
  const a = await fetchListOutcome(CFG, CK, mock({ body: {} }, [{ body: LIST_OK([TOKEN, OTHER]) }]).fetchFn);
  assert.equal(a.kind, 'listed');
  if (a.kind === 'listed') assert.deepEqual(a.entries.map((e) => e.token), [TOKEN, OTHER]);
  const b = await fetchListOutcome(CFG, CK, mock({ body: {} }, [{ body: LIST_EMPTY }]).fetchFn);
  assert.equal(b.kind, 'empty');
});

test('liste: yalnız gerçek "kart yok" boş sayılır; diğer 02/HTTP/JSON-değil/ağ = BELİRSİZ (error)', async () => {
  assert.equal(isCardStorageListEmpty({ ProcReturnCode: '02', ErrMsg: 'Geçerli Kart Yok' }), true); // Türkçe karakterli yazım
  assert.equal(isCardStorageListEmpty({ ProcReturnCode: '02', ErrMsg: 'Hash hatalı' }), false);
  assert.equal(isCardStorageListEmpty({ ProcReturnCode: '99', ErrMsg: 'Gecerli Kart Yok' }), false);
  for (const reply of [{ status: 500, body: {} }, { body: 'html değil json değil' }, { body: { ProcReturnCode: '02', ErrMsg: 'Hash hatalı' } }, new Error('network')] as Reply[]) {
    const o = await fetchListOutcome(CFG, CK, mock({ body: {} }, [reply]).fetchFn);
    assert.equal(o.kind, 'error');
  }
  assert.equal((await fetchListOutcome({ ...CFG, sx: '' }, CK)).kind, 'error');
  assert.equal((await fetchListOutcome(CFG, '')).kind, 'error');
});

test('liste hash: sx|customerKey|secret', async () => {
  const m = mock({ body: {} }, [{ body: LIST_EMPTY }]);
  await fetchListOutcome(CFG, CK, m.fetchFn);
  assert.equal(m.calls[0].fields.hashDatav2, sha([CFG.sx, CK, CFG.secretKey]));
});

// ── Silme: yanıta değil LİSTEYE göre ──────────────────────────────────────────
test('KÖK NEDEN SENARYOSU: yeni zarflı silme yanıtı + liste "Gecerli Kart Yok" -> ok=true (deleted)', async () => {
  const m = mock({ body: DELETE_ENVELOPE }, [{ body: LIST_EMPTY }]);
  const r = await deleteCardVerified(P, m.fetchFn);
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'deleted');
  assert.deepEqual(m.calls.map((c) => c.kind), ['delete', 'list']); // önce sil, sonra doğrula
});

test('silme yanıtı NE derse desin karar liste ile verilir (ProcReturnCode yok / hata gibi görünen zarf)', async () => {
  // silme "hata" zarfı döndürse de liste token yok diyorsa (yetim kart) -> ok
  const errEnv = { ...DELETE_ENVELOPE, RESPONSE_CODE: '0', ERROR_CODE: 'X1', ERROR_MESSAGE: 'Token bulunamadı' };
  const orphan = await deleteCardVerified(P, mock({ body: errEnv }, [{ body: LIST_EMPTY }]).fetchFn);
  assert.equal(orphan.ok, true);
  // silme "başarılı" görünse de liste token'ı hâlâ gösteriyorsa -> ok=false
  const still = await deleteCardVerified(P, mock({ body: DELETE_ENVELOPE }, [{ body: LIST_OK([TOKEN, OTHER]) }]).fetchFn);
  assert.equal(still.ok, false);
  assert.equal(still.reason, 'still_listed');
});

test('liste geldi, token yok ama başka kart var -> silinmiş (ok)', async () => {
  const r = await deleteCardVerified(P, mock({ body: DELETE_ENVELOPE }, [{ body: LIST_OK([OTHER]) }]).fetchFn);
  assert.equal(r.ok, true);
});

test('KURAL 1: liste doğrulaması başarısız (servis hatası) -> ok=false/verify_unavailable (yerel kayıt SİLİNMEZ)', async () => {
  for (const listReply of [{ status: 500, body: {} }, { body: 'x' }, { body: { ProcReturnCode: '99', ErrMsg: 'hata' } }, new Error('down')] as Reply[]) {
    const r = await deleteCardVerified(P, mock({ body: DELETE_ENVELOPE }, [listReply]).fetchFn);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'verify_unavailable');
  }
});

test('silme isteği ağ hatasıyla düşse de liste gerçeği söyler (ok ya da still_listed)', async () => {
  assert.equal((await deleteCardVerified(P, mock(new Error('timeout'), [{ body: LIST_EMPTY }]).fetchFn)).ok, true);
  const bad = await deleteCardVerified(P, mock(new Error('timeout'), [{ body: LIST_OK([TOKEN]) }]).fetchFn);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'still_listed');
});

test('silme isteği: alanlar ve hash (tranId dolu / tranId BOŞken "||" korunur)', async () => {
  const full = mock({ body: DELETE_ENVELOPE }, [{ body: LIST_EMPTY }]);
  await deleteCardVerified(P, full.fetchFn);
  const d = full.calls[0].fields;
  assert.deepEqual(Object.keys(d).sort(), ['customerKey', 'hashDatav2', 'sx', 'token', 'tranId']);
  assert.equal(d.hashDatav2, sha([CFG.sx, CK, '1234567890', TOKEN, CFG.secretKey]));

  const empty = mock({ body: DELETE_ENVELOPE }, [{ body: LIST_EMPTY }]);
  await deleteCardVerified({ ...P, tranId: '' }, empty.fetchFn);
  const e = empty.calls[0].fields;
  assert.equal(e.tranId, '');
  assert.equal(e.hashDatav2, sha([CFG.sx, CK, '', TOKEN, CFG.secretKey]));
  assert.ok([CFG.sx, CK, '', TOKEN, CFG.secretKey].join('|').includes('|' + CK + '||' + TOKEN)); // "||" yeri
  assert.notEqual(e.hashDatav2, sha([CFG.sx, CK, TOKEN, CFG.secretKey])); // yer ATLANMAZ
});

test('atlanır: token/yapılandırma yok -> ok (ağ çağrısı yok); customerKey yok -> doğrulanamaz', async () => {
  const m = mock({ body: DELETE_ENVELOPE }, [{ body: LIST_EMPTY }]);
  assert.deepEqual(await deleteCardVerified({ ...P, token: '' }, m.fetchFn), { ok: true, reason: 'skipped' });
  assert.equal((await deleteCardVerified({ ...P, sx: '' }, m.fetchFn)).ok, true);
  assert.equal(m.calls.length, 0);
  const noCk = await deleteCardVerified({ ...P, customerKey: '' }, m.fetchFn);
  assert.equal(noCk.ok, false);
  assert.equal(m.calls.length, 0);
});

test('GÜVENLİK: log ve sonuçta token/secret/hash yok (yanıt token içerse de maskelenir)', async () => {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
  try {
    const leaky = { ...DELETE_ENVELOPE, ERROR_MESSAGE: `token ${TOKEN} 5528790000001234 geçersiz`, ERROR_CODE: 'E1' };
    const r = await deleteCardVerified(P, mock({ body: leaky }, [{ body: LIST_OK([TOKEN]) }]).fetchFn);
    const dump = logs.join('\n') + JSON.stringify(r);
    for (const secret of [TOKEN, CFG.secretKey, CFG.sx, CK, sha([CFG.sx, CK, '1234567890', TOKEN, CFG.secretKey]), '5528790000001234']) {
      assert.ok(!dump.includes(secret), `sızıntı: ${secret.slice(0, 8)}`);
    }
    assert.match(dump, /E1/); // teşhis kodu yine görünür
  } finally { console.log = orig; }
  assert.equal(sanitizeText('a ' + TOKEN, TOKEN), 'a [token]');
});

// ── Sync yetim temizliği ──────────────────────────────────────────────────────
const NOW_MS = Date.parse('2026-09-18T19:10:00Z');
const old = '2026-09-18T17:00:00Z';
const local = (id: string, token: string | null, o: Partial<{ customerKey: string | null; createdAt: string }> = {}) =>
  ({ id, token, customerKey: CK, createdAt: old, ...o });
const listed = (tokens: string[]): ListOutcome => ({ kind: 'listed', httpStatus: 200, procReturnCode: '00', errMsg: '', entries: tokens.map((t) => ({ token: t, tranId: 'x', maskedPan: '', last4: '', brand: '', bank: '', alias: '' })) });
const EMPTY: ListOutcome = { kind: 'empty', httpStatus: 200, procReturnCode: '02', errMsg: 'Gecerli Kart Yok' };
const ERR: ListOutcome = { kind: 'error', httpStatus: 500, procReturnCode: '', errMsg: 'HTTP 500' };

test('KURAL 2: sync başarısızsa (error) HİÇBİR ŞEY silinmez', () => {
  assert.equal(planOrphans(ERR, [local('a', TOKEN)], CK, NOW_MS), null);
});

test('yetim: listede olmayan yerel kart silinir; listede olan kalır (mevcut QNB •••• 9701 durumu)', () => {
  assert.deepEqual(planOrphans(EMPTY, [local('qnb', TOKEN)], CK, NOW_MS), ['qnb']);
  assert.deepEqual(planOrphans(listed([OTHER]), [local('qnb', TOKEN), local('ok', OTHER)], CK, NOW_MS), ['qnb']);
  assert.deepEqual(planOrphans(listed([TOKEN, OTHER]), [local('qnb', TOKEN), local('ok', OTHER)], CK, NOW_MS), []);
});

test('güvenlik: token kaydı olmayan / başka customerKey / yeni oluşmuş (yarış) kart DOKUNULMAZ', () => {
  const recent = new Date(NOW_MS - RECONCILE_MARGIN_MS + 10_000).toISOString();
  const fresh = new Date(NOW_MS + 5_000).toISOString();
  assert.deepEqual(planOrphans(EMPTY, [local('notoken', null)], CK, NOW_MS), []);
  assert.deepEqual(planOrphans(EMPTY, [local('otherck', TOKEN, { customerKey: 'başka' })], CK, NOW_MS), []);
  assert.deepEqual(planOrphans(EMPTY, [local('recent', TOKEN, { createdAt: recent })], CK, NOW_MS), []);
  assert.deepEqual(planOrphans(EMPTY, [local('fresh', TOKEN, { createdAt: fresh })], CK, NOW_MS), []);
  assert.deepEqual(planOrphans(EMPTY, [local('bad', TOKEN, { createdAt: 'geçersiz' })], CK, NOW_MS), []);
});

test('güvenlik: liste dolu ama hiçbir kayıtta token yoksa (beklenmeyen biçim) HİÇBİR ŞEY silinmez', () => {
  const noTokens: ListOutcome = { kind: 'listed', httpStatus: 200, procReturnCode: '00', errMsg: '', entries: [{ token: '', tranId: 'x', maskedPan: '', last4: '', brand: '', bank: '', alias: '' }] };
  assert.equal(planOrphans(noTokens, [local('a', TOKEN)], CK, NOW_MS), null);
});

// ── Kaynak taramaları ─────────────────────────────────────────────────────────
const read = (p: string) => readFileSync(join(__dirname, '../../../supabase/functions', p), 'utf8');
const cardsIdx = read('paynkolay-cards/index.ts');
const cardsShared = read('_shared/paynkolay-cards.ts');
const storage = read('_shared/paynkolay-card-storage.ts');
const glue = read('_shared/paynkolay-card-verification.ts');
const delAcc = read('delete-account/index.ts');

test('handleDelete: doğrulanamazsa yerel silme YOK; mesajlar düzgün Türkçe', () => {
  const fn = cardsIdx.slice(cardsIdx.indexOf('async function handleDelete'));
  const fail = fn.slice(fn.indexOf('if (!result.ok)'), fn.indexOf("from('user_cards').delete()"));
  assert.match(fail, /return jsonResponse/);
  assert.match(fail, /Şu an silinemedi, tekrar dene\./);
  assert.match(fail, /Kart PaynKolay tarafında silinemedi\./);
  assert.ok(fn.indexOf('if (!result.ok)') < fn.indexOf("from('user_cards').delete()"));
});

test('sync: yetim temizliği liste sonucuna bağlı, hata yutulur ve kartlar temizlik SONRASI okunur', () => {
  const fn = cardsIdx.slice(cardsIdx.indexOf('async function handleSync'), cardsIdx.indexOf('async function pruneOrphanCards'));
  assert.ok(fn.indexOf('pruneOrphanCards(') > fn.indexOf('upsertUserCard(admin'));
  assert.ok(fn.indexOf('pruneOrphanCards(') < fn.indexOf('await fetchLocalCards(admin, userId)', fn.indexOf('pruneOrphanCards(')));
  const prune = cardsIdx.slice(cardsIdx.indexOf('async function pruneOrphanCards'), cardsIdx.indexOf('async function handleDelete'));
  assert.match(prune, /if \(outcome\.kind === 'error'\) return 0/);
  assert.match(prune, /planOrphans\(/);
});

test('delete-account ve Kart Ekle kopya-kart silmesi AYNI doğrulamalı fonksiyonu kullanır', () => {
  assert.match(delAcc, /deleteCardFromPaynkolay\(/);
  assert.match(glue, /deleteCardFromPaynkolay\(/);
  assert.match(cardsShared, /return deleteCardVerified\(params\)/);
  // eski hatalı kural (ProcReturnCode !== '00' ile silme başarısı) KALMADI
  assert.doesNotMatch(cardsShared, /delete ProcReturnCode/);
  assert.doesNotMatch(cardsShared, /Payment\/CardStorageCardDelete/); // çağrı tek yerde (card-storage)
});

test('kullanıcıya dönen mesajlarda ASCII-kısaltma (ı/ş/ğ/ü/ö/ç eksik) kalmadı', () => {
  const messages = [...cardsIdx.matchAll(/error: '([^']*)'/g)].map((m) => m[1]);
  assert.ok(messages.length > 20);
  const ascii = /\b(Islem|baslat|tamamlanamadi|bulunamadi|basarisiz|Guncelleme|tarafinda|yapilandirmasi|Musteri|anahtari|Siparis|gecersiz|odeme|erisilemedi|dondu)/;
  for (const m of messages) assert.doesNotMatch(m, ascii, m);
  for (const m of messages) assert.doesNotMatch(m, /Paynkolay/, m); // "PaynKolay" yazımı
});

test('servis başına başarı kuralları kod içinde belgelendi', () => {
  for (const s of ['CardStorageCardList', 'CardStorageCardDelete', 'RESPONSE_CODE', 'ProcReturnCode', 'CancelRefundPayment', 'PfTransactionReportList', 'responseCode', 'v1/Payment']) {
    assert.ok(storage.includes(s), s);
  }
  assert.match(storage, /KOPYALAMA|kopyalama/);
});
