// G19-S3 md.3 — Kaynak takibi: derin bağlantı / UTM / l.eatkcal.com / kutu kartı QR / saha kodu.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTRIBUTION_WINDOW_MS,
  FIRST_OPEN_KEY,
  FIRST_TOUCH_KEY,
  LAST_TOUCH_KEY,
  activeSahaCode,
  attributionProps,
  captureTouch,
  isSahaCode,
  parseAttribution,
} from '../attribution';
import { sanitizeProps } from '../sanitize';

const NOW = '2026-11-09T10:00:00.000Z';
const T0 = Date.parse(NOW);

function mem() {
  const m = new Map<string, string>();
  return { m, getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v) };
}

test('UTM parametreleri (https://l.eatkcal.com ve kcal://)', () => {
  const t = parseAttribution('https://l.eatkcal.com/?utm_source=instagram&utm_medium=story&utm_campaign=kasim%20indirim&utm_content=v2', NOW);
  assert.deepEqual(t, { source: 'instagram', medium: 'story', campaign: 'kasim_indirim', content: 'v2', link: 'other', at: NOW });
  const k = parseAttribution('kcal://kesfet?utm_source=tiktok&utm_campaign=lansman', NOW)!;
  assert.equal(k.source, 'tiktok');
  assert.equal(k.campaign, 'lansman');
  assert.equal(k.link, 'explore');
});

test('kutu kartı QR: /k/<kod> ve ?kutu=', () => {
  assert.deepEqual(parseAttribution('https://l.eatkcal.com/k/box-1024', NOW), {
    source: 'box_card', medium: 'qr', code: 'BOX-1024', link: 'box', at: NOW,
  });
  assert.equal(parseAttribution('kcal://?kutu=ab12', NOW)!.code, 'AB12');
});

test('saha kodu: /s/<kod> ve ?saha=', () => {
  assert.deepEqual(parseAttribution('https://l.eatkcal.com/s/saha-ahmet01', NOW), {
    source: 'saha', medium: 'field', code: 'SAHA-AHMET01', link: 'saha', at: NOW,
  });
  assert.equal(parseAttribution('kcal://?saha=SAHA77', NOW)!.source, 'saha');
});

test('paylaşım bağlantıları: kişiye bağlanan parça (post id, handle) saklanmaz', () => {
  const p = parseAttribution('https://l.eatkcal.com/p/3f2a9c1e-7b1d', NOW)!;
  assert.deepEqual(p, { source: 'share', medium: 'link', link: 'post', at: NOW });
  const u = parseAttribution('https://l.eatkcal.com/u/ilter', NOW)!;
  assert.deepEqual(u, { source: 'share', medium: 'link', link: 'profile', at: NOW });
  assert.equal(JSON.stringify(u).includes('ilter'), false);
});

test('yok sayılanlar: auth/ödeme dönüşü, geliştirici vitrin, yabancı alan, kaynaksız iç bağlantı', () => {
  for (const url of [
    'kcal://auth-callback#access_token=abc',
    'kcal://payment-callback?status=ok',
    'kcal://dev/screen/FinHome',
    'https://eatkcal.com/payment/success',
    'https://evil.example.com/?utm_source=x',
    'kcal://reviews',
    '',
    null,
  ]) {
    assert.equal(parseAttribution(url as string | null, NOW), null, String(url));
  }
});

test('değerler temizlenir (boşluk, özel karakter, uzunluk)', () => {
  const t = parseAttribution(`kcal://?utm_source=${'a'.repeat(100)}&utm_campaign=<script>`, NOW)!;
  assert.equal(t.source.length, 64);
  assert.equal(t.campaign, 'script');
});

test('ilk açılış: first touch bir kez yazılır; bağlantı yoksa direct; sonra asla değişmez', async () => {
  const s = mem();
  const r1 = await captureTouch(s, null, { initial: true, now: () => T0 });
  assert.equal(r1.firstOpen, true);
  assert.equal(r1.firstTouch!.source, 'direct');
  assert.equal(s.m.get(FIRST_OPEN_KEY), '1');

  const r2 = await captureTouch(s, 'https://l.eatkcal.com/s/SAHA9', { initial: true, now: () => T0 + 1000 });
  assert.equal(r2.firstOpen, false);
  assert.equal(JSON.parse(s.m.get(FIRST_TOUCH_KEY)!).source, 'direct');
  assert.equal(JSON.parse(s.m.get(LAST_TOUCH_KEY)!).source, 'saha');
});

test('ilk açılış derin bağlantıyla: first_touch = bağlantı kaynağı', async () => {
  const s = mem();
  const r = await captureTouch(s, 'https://l.eatkcal.com/k/K1?utm_campaign=kutu_kasim', { initial: true, now: () => T0 });
  assert.equal(r.firstTouch!.source, 'box_card');
  assert.equal(r.firstTouch!.campaign, 'kutu_kasim');
  // first_touch olayının prop'ları beyaz listeden geçer.
  const clean = sanitizeProps('first_touch', { ...r.firstTouch! });
  assert.deepEqual(clean, { source: 'box_card', medium: 'qr', campaign: 'kutu_kasim', code: 'K1', link: 'box' });
});

test('sipariş olayına kaynak: ilk + son dokunma; son dokunma 7 gün penceresi', async () => {
  const s = mem();
  await captureTouch(s, 'kcal://?utm_source=instagram&utm_campaign=lansman', { initial: true, now: () => T0 });
  await captureTouch(s, 'https://l.eatkcal.com/s/SAHA5', { initial: false, now: () => T0 + 3600e3 });
  const p = await attributionProps(s, T0 + 2 * 3600e3);
  assert.deepEqual(p, {
    channel: 'app',
    ft_source: 'instagram',
    ft_campaign: 'lansman',
    lt_source: 'saha',
    lt_medium: 'field',
    lt_code: 'SAHA5',
    lt_age_h: 1,
  });
  // checkout olayının beyaz listesi bu alanları taşır.
  assert.deepEqual(Object.keys(sanitizeProps('begin_checkout', { price: 100, ...p })).sort(), ['channel', 'ft_campaign', 'ft_source', 'lt_age_h', 'lt_code', 'lt_medium', 'lt_source', 'price'].sort());

  const late = await attributionProps(s, T0 + 3600e3 + ATTRIBUTION_WINDOW_MS + 1);
  assert.equal(late.lt_source, undefined);
  assert.equal(late.ft_source, 'instagram');
});

test('saha kodu tanıma: SAHA öneki (D-S1 kuralı) ya da bağlantıdan gelen kod', async () => {
  assert.equal(isSahaCode('saha12'), true);
  assert.equal(isSahaCode('YAZ25'), false);
  assert.equal(isSahaCode('ahmet01', 'AHMET01'), true);
  const s = mem();
  await captureTouch(s, 'https://l.eatkcal.com/s/ahmet01', { initial: false, now: () => T0 });
  assert.equal(await activeSahaCode(s, T0 + 1000), 'AHMET01');
  assert.equal(await activeSahaCode(s, T0 + ATTRIBUTION_WINDOW_MS + 1), null);
});

test('depo hatası açılışı bozmaz', async () => {
  const broken = {
    getItem: async () => {
      throw new Error('disk');
    },
    setItem: async () => {
      throw new Error('disk');
    },
  };
  const r = await captureTouch(broken, 'kcal://?utm_source=x', { initial: true, now: () => T0 });
  assert.equal(r.touch!.source, 'x');
  assert.deepEqual(await attributionProps(broken, T0), { channel: 'app' });
});
