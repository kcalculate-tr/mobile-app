// G24-S1 md.3 — kcalAI Koç saf mantık: hap metni, kapı (limit / deneme bitti), akış temposu,
// geçmiş gruplaması, başlık ve Ana sayfa satırı, haftalık grafik, TR/EN anahtarları.
import test from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../../../core/i18n/core';
import { tr as coachTr, en as coachEn } from '../i18n';
import {
  chartBars,
  gateOf,
  groupHistory,
  headerSub,
  homeLine,
  optimisticUse,
  pillText,
  statusFrom,
  streamPlan,
  weekdayIndex,
} from '../model';
import type { CoachMessage } from '../types';

const T = (k: string, o?: Record<string, string | number>) => translate('tr', k, o);
const TE = (k: string, o?: Record<string, string | number>) => translate('en', k, o);

test('statusFrom: sunucu yanıtı → durum; eksik alan → null', () => {
  assert.deepEqual(statusFrom({ used: 3, limit: 30, kind: 'daily', tier: 'balance', resets_at: '2026-11-11T21:00:00Z' }), {
    used: 3, limit: 30, kind: 'daily', tier: 'balance', resetsAt: '2026-11-11T21:00:00Z',
  });
  assert.equal(statusFrom({ used: 1 }), null);
  assert.equal(statusFrom(null), null);
});

test('hap: Balance "Bugün N/30" (N = kalan) + rozet; deneme "Deneme N/3"', () => {
  const d = pillText({ used: 4, limit: 30, kind: 'daily', tier: 'balance', resetsAt: null }, T)!;
  assert.equal(d.label, 'Bugün 26/30');
  assert.equal(d.balance, true);
  assert.equal(d.a11y, 'Bugünkü Koç mesaj hakkın: 30 mesajdan 26 kaldı');
  const tr3 = pillText({ used: 1, limit: 3, kind: 'trial', tier: 'free', resetsAt: null }, T)!;
  assert.equal(tr3.label, 'Deneme 2/3');
  assert.equal(tr3.balance, false);
  assert.equal(pillText({ used: 1, limit: 3, kind: 'trial', tier: 'fresh', resetsAt: null }, TE)!.label, 'Trial 2/3');
  assert.equal(pillText(null, T), null);
});

test('kapı: hak varken açık; Balance bitti → limit; deneme bitti → trial_out', () => {
  assert.equal(gateOf(null), 'open');
  assert.equal(gateOf({ used: 29, limit: 30, kind: 'daily', tier: 'balance', resetsAt: null }), 'open');
  assert.equal(gateOf({ used: 30, limit: 30, kind: 'daily', tier: 'balance', resetsAt: null }), 'limit');
  assert.equal(gateOf({ used: 3, limit: 3, kind: 'trial', tier: 'free', resetsAt: null }), 'trial_out');
  assert.equal(optimisticUse({ used: 30, limit: 30, kind: 'daily', tier: 'balance', resetsAt: null })!.used, 30);
});

test('akış: kelime parçaları, parça aralığı ≤ 45 ms, toplam ≤ ~2200 ms', () => {
  const short = streamPlan('Güzel gidiyorsun! Bugün hedefinin yarısındasın.');
  assert.equal(short.chunks.join(''), 'Güzel gidiyorsun! Bugün hedefinin yarısındasın.');
  assert.equal(short.interval, 45);
  const long = streamPlan(Array.from({ length: 200 }, (_, i) => `k${i}`).join(' '));
  assert.ok(long.interval * long.chunks.length <= 3300);
  assert.ok(long.interval >= 16);
  assert.deepEqual(streamPlan(''), { chunks: [], interval: 0 });
});

test('geçmiş: soru + ilk yanıt çiftleri, gün gün yeniden eskiye (Bugün / Dün / tarih)', () => {
  const now = new Date(2026, 10, 11, 20, 0);
  const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).toISOString();
  const M = (id: string, role: 'user' | 'assistant', body: string, created_at: string): CoachMessage => ({ id, role, body, cards: null, feedback: null, created_at });
  const g = groupHistory(
    [
      M('1', 'user', 'Akşam ne yesem?', at(8, 19, 3)),
      M('2', 'assistant', 'Akşam için Keşfet’ten hedefine uyan bir tarif.', at(8, 19, 3)),
      M('3', 'user', 'Haftamı özetle', at(10, 21, 15)),
      M('4', 'assistant', 'Bu hafta 5 gün kalori hedefinin içinde kaldın.', at(10, 21, 15)),
      M('5', 'user', 'Bugün nasıl gidiyorum?', at(11, 18, 40)),
      M('6', 'assistant', 'Güzel gidiyorsun!', at(11, 18, 40)),
    ],
    now,
    'tr',
    T,
  );
  assert.deepEqual(g.map((x) => x.label), ['Bugün', 'Dün', '8 Kas']);
  assert.equal(g[0].items[0].q, 'Bugün nasıl gidiyorum?');
  assert.equal(g[0].items[0].a, 'Güzel gidiyorsun!');
  assert.equal(g[0].items[0].time, '18:40');
});

test('başlık: "Bugün %62, 760 kcal kaldı"; hedef yoksa sabit satır; aşınca "geçtin"', () => {
  assert.deepEqual(headerSub(1240, 2000, T), { text: 'Bugün %62, 760 kcal kaldı', pct: 62 });
  assert.equal(headerSub(null, null, T).text, 'Beslenme ve günlük takip');
  assert.equal(headerSub(2200, 2000, T).text, 'Bugün hedefini 200 kcal geçtin');
  assert.equal(headerSub(1240, 2000, TE).text, '62% today, 760 kcal left');
});

test('Ana sayfa kartı (FinHomeR3 coachLine): boş · aşım · protein · düz', () => {
  assert.equal(homeLine(0, 2000, 100, T).line, 'Nereden başlasan? Kahvaltı için 3 öneri ister misin?');
  assert.equal(homeLine(2300, 2000, 0, T).line, 'Bugün hedefini geçtin, sorun değil. Yarın için hafif bir plan ister misin?');
  const p = homeLine(1200, 2000, 38, T);
  assert.equal(p.line, 'Protein hedefine 38 g kaldı. Akşam için 3 öneri ister misin?');
  assert.equal(p.question, 'Proteinimi tamamlamak için akşam için 3 öneri verir misin?');
  assert.equal(homeLine(1200, null, null, T).line, 'Akşam için dengeli 3 öneri ister misin?');
});

test('haftalık grafik: kalori hedef içinde / protein hedefin %80’i; ortalama yalnız kayıtlı günler', () => {
  const card = {
    type: 'weekly_chart' as const,
    metric: 'kcal' as const,
    goal_kcal: 2000,
    goal_protein: 120,
    days: [
      { date: '2026-11-05', kcal: 1850, protein: 104 },
      { date: '2026-11-06', kcal: 2380, protein: 84 },
      { date: '2026-11-07', kcal: 0, protein: 0 },
    ],
  };
  const k = chartBars(card, 'kcal');
  assert.deepEqual(k.bars.map((b) => b.good), [true, false, true]);
  assert.equal(k.avg, 2115);
  const p = chartBars(card, 'protein');
  assert.deepEqual(p.bars.map((b) => b.good), [true, false, false]);
  assert.equal(weekdayIndex('2026-11-09'), 0); // Pazartesi
  assert.equal(weekdayIndex('2026-11-15'), 6); // Pazar
});

test('metinler: TR ve EN aynı anahtarlar; sabit satır ve hap biçimi görev dosyasıyla aynı', () => {
  assert.deepEqual(Object.keys(coachEn).sort(), Object.keys(coachTr).sort());
  assert.equal(coachTr.disclaimer, 'Koç tıbbi tavsiye vermez.');
  assert.equal(coachEn.disclaimer, 'Coach doesn’t give medical advice.');
  assert.equal(coachTr.limit_title, 'Bugünkü mesaj hakkın doldu, yarın 00.00’da yenilenir.');
  // AI izni metni koç sözlüğünde YOK (tek yer: consent.sheet.ai_coach_lead).
  assert.ok(!JSON.stringify(coachTr).includes('hizmet sağlayıcımıza'));
});
