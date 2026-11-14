// G46-S1 — saf mantık: L2 grafiği iç boşluğu (uç nokta kırpılmaz), T1 teklifi bir kez (cihaz + hesap).
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEIGHT_CHART, weightChartGeometry } from '../ui/chart';
import {
  OFFER_META_KEY,
  OFFER_SHOWN_KEY,
  accountOfferShown,
  isOfferShownOnDevice,
  markOfferShownOnDevice,
  shouldShowOffer,
  type KvStore,
} from '../storage';

function mem(): KvStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}

// L2 kartının iç genişliği: ekran − 40 sayfa − 38 kart (dolgu + kenar).
const inner = (screen: number) => screen - 40 - 38;

test('md.1: 375 ve 430 pt, inen ve çıkan çizgide uç daireler + çizgi SVG alanının içinde', () => {
  const C = WEIGHT_CHART;
  for (const screen of [320, 375, 402, 430]) {
    const w = inner(screen);
    for (const down of [true, false]) {
      const g = weightChartGeometry(w, down);
      const endR = C.endR + C.endStroke / 2;
      // Hedef dairesi (r 7 + kenarın dış yarısı) sağ, üst ve alt kenarı aşmaz.
      assert.ok(g.x1 + endR <= w, `${screen}/${down} sağ kenar: ${g.x1 + endR} > ${w}`);
      assert.ok(g.y1 - endR >= 0 && g.y1 + endR <= g.h, `${screen}/${down} hedef dikey`);
      // Başlangıç dairesi ve 3 pt çizgi.
      assert.ok(g.x0 - C.startR >= 0 && g.x0 - C.line / 2 >= 0, `${screen}/${down} sol kenar`);
      assert.ok(g.y0 - C.startR >= 0 && g.y0 + C.startR <= g.h, `${screen}/${down} başlangıç dikey`);
      // Bant ±14 pt alanın içinde.
      assert.ok(g.y1 - C.band >= 0 && g.y1 + C.band <= g.h, `${screen}/${down} bant`);
      // İç boşluk: sağ/üst/alt = hedef yarıçapı + kenar kalınlığı.
      assert.equal(w - g.x1, C.endR + C.endStroke);
      const pad = C.endR + C.endStroke;
      if (down) {
        assert.equal(g.y0, pad); // üst
        assert.equal(g.h - (g.y1 + C.band), pad); // alt (bandın alt kenarı)
      } else {
        assert.equal(g.h - g.y0, pad); // alt
        assert.equal(g.y1 - C.band, pad); // üst (bandın üst kenarı)
      }
    }
  }
});

test('md.1: inen çizgi yukarıdan başlar, aşağıda biter (yön korunur)', () => {
  const d = weightChartGeometry(300, true);
  assert.ok(d.y0 < d.y1);
  const u = weightChartGeometry(300, false);
  assert.ok(u.y0 > u.y1);
  assert.match(d.line, /^M 9 9\.5 C /);
});

test('md.3: T1 yalnız A yolunda ve cihazda/hesapta daha önce gösterilmediyse', () => {
  assert.equal(shouldShowOffer({ path: 'a', device: false, account: false }), true);
  assert.equal(shouldShowOffer({ path: 'a', device: true, account: false }), false);
  assert.equal(shouldShowOffer({ path: 'a', device: false, account: true }), false);
  assert.equal(shouldShowOffer({ path: 'b', device: false, account: false }), false);
});

test('md.3: hesap işareti user_metadata.kayit_offer_shown_at', () => {
  assert.equal(OFFER_META_KEY, 'kayit_offer_shown_at');
  assert.equal(accountOfferShown(undefined), false);
  assert.equal(accountOfferShown({}), false);
  assert.equal(accountOfferShown({ [OFFER_META_KEY]: '' }), false);
  assert.equal(accountOfferShown({ [OFFER_META_KEY]: '2026-11-14T10:00:00.000Z' }), true);
});

test('md.3: cihaz işareti bir kez yazılır, sonra gösterilmez', async () => {
  const s = mem();
  assert.equal(await isOfferShownOnDevice(s), false);
  await markOfferShownOnDevice(s, Date.parse('2026-11-14T10:00:00Z'));
  assert.equal(s.data.get(OFFER_SHOWN_KEY), '2026-11-14T10:00:00.000Z');
  assert.equal(await isOfferShownOnDevice(s), true);
  assert.equal(shouldShowOffer({ path: 'a', device: await isOfferShownOnDevice(s), account: false }), false);
});
