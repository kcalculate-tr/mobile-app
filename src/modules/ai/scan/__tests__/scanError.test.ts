// G17-S2 md.6 — analyze-ai-scan hatası: edge gövdesindeki `error` kodu istemcide
// korunur, LOG/Sentry'ye (reportFailure) aşama + kod + HTTP durumu gider, hak iade
// edilir. SAF (native yok). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { runAiScan } from '../runScan';
import { createMockAiScanClient } from '../mock';
import {
  ScanStageError,
  analyzeErrorFromInvoke,
  edgeErrorCodeFromBody,
  scanFailureInfo,
  type ScanFailureInfo,
} from '../scanError';

/** supabase-js FunctionsHttpError benzeri: context = edge Response. */
function httpError(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const res = {
    status,
    clone: () => res,
    json: async () => JSON.parse(text),
  };
  return Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    name: 'FunctionsHttpError',
    context: res,
  });
}

test('edgeErrorCodeFromBody: {error} kodu, güvenli karakter; yoksa null', () => {
  assert.equal(edgeErrorCodeFromBody({ error: 'config' }), 'config');
  assert.equal(edgeErrorCodeFromBody({ error: 'model', status: 529 }), 'model');
  assert.equal(edgeErrorCodeFromBody({ error: 'a b/c' }), 'a_b_c');
  assert.equal(edgeErrorCodeFromBody({}), null);
  assert.equal(edgeErrorCodeFromBody('x'), null);
  assert.equal(edgeErrorCodeFromBody(null), null);
});

test('analyzeErrorFromInvoke: 500 {error:"config"} → analyze/config/500', async () => {
  const e = await analyzeErrorFromInvoke(httpError(500, { error: 'config' }));
  assert.ok(e instanceof ScanStageError);
  assert.equal(e.stage, 'analyze');
  assert.equal(e.code, 'config');
  assert.equal(e.httpStatus, 500);
  assert.match(e.message, /analyze-ai-scan: config \(500\)/);
});

test('analyzeErrorFromInvoke: server/timeout/parse kodları ve JSON olmayan gövde', async () => {
  assert.equal((await analyzeErrorFromInvoke(httpError(500, { error: 'server' }))).code, 'server');
  assert.equal((await analyzeErrorFromInvoke(httpError(504, { error: 'timeout' }))).code, 'timeout');
  assert.equal((await analyzeErrorFromInvoke(httpError(502, { error: 'parse' }))).code, 'parse');
  const html = await analyzeErrorFromInvoke(httpError(500, '<html>boom</html>'));
  assert.equal(html.code, 'http_500');
  assert.equal(html.httpStatus, 500);
});

test('analyzeErrorFromInvoke: ağ/relay hataları', async () => {
  const net = await analyzeErrorFromInvoke(Object.assign(new Error('fetch'), { name: 'FunctionsFetchError' }));
  assert.equal(net.code, 'network');
  const relay = await analyzeErrorFromInvoke(Object.assign(new Error('relay'), { name: 'FunctionsRelayError' }));
  assert.equal(relay.code, 'relay');
  const unk = await analyzeErrorFromInvoke(new Error('?'));
  assert.equal(unk.code, 'unknown');
});

test('scanFailureInfo: yükleme hataları kodlanır (kişisel veri yok)', () => {
  assert.equal(scanFailureInfo(new Error('scan_upload: image_too_large'), 'upload').code, 'image_too_large');
  assert.equal(scanFailureInfo(new Error('scan_upload: no_user'), 'upload').code, 'no_user');
  assert.equal(scanFailureInfo(new Error('scan_upload: new row violates policy'), 'upload').code, 'storage');
  assert.equal(scanFailureInfo(new Error('x'), 'analyze').code, 'unknown');
});

test('runAiScan: analiz 500 (config) → reportFailure(analyze, config, 500), iade, outcome.failure', async () => {
  const reports: ScanFailureInfo[] = [];
  const base = createMockAiScanClient({ withUpload: true, userId: 'u1' });
  const client = {
    ...base,
    async analyzeImage() {
      throw await analyzeErrorFromInvoke(httpError(500, { error: 'config' }));
    },
    reportFailure: (i: ScanFailureInfo) => reports.push(i),
  };
  const out = await runAiScan(client, { idempotencyKey: 'k1', imageRef: 'file:///a.jpg' });
  assert.equal(out.status, 'failed');
  assert.equal(reports.length, 1);
  assert.deepEqual(
    { stage: reports[0].stage, code: reports[0].code, httpStatus: reports[0].httpStatus },
    { stage: 'analyze', code: 'config', httpStatus: 500 },
  );
  if (out.status === 'failed') {
    assert.equal(out.failure?.code, 'config');
    assert.equal(out.remaining, 3, 'hak iade edildi');
  }
  assert.ok(base._calls.includes('release:k1'));
});

test('runAiScan: yükleme hatası → aşama upload; reportFailure fırlatsa da akış bozulmaz', async () => {
  const base = createMockAiScanClient({ failUpload: true, userId: 'u1' });
  const client = {
    ...base,
    reportFailure: () => {
      throw new Error('sentry yok');
    },
  };
  const out = await runAiScan(client, { idempotencyKey: 'k2', imageRef: 'file:///b.jpg' });
  assert.equal(out.status, 'failed');
  if (out.status === 'failed') assert.equal(out.failure?.stage, 'upload');
  assert.ok(base._calls.includes('release:k2'));
});
