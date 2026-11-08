// G18-S4 md.3 — FinPush: 4 şablon, başlık ≤ 35 / gövde ≤ 90, 0–2 aksiyon, gizli
// önizlemede kişisel ayrıntı yok, TR/EN sözlük + sunucu şablon dosyası birebir.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIN_PUSH_ACTIONS,
  FIN_PUSH_CATEGORY,
  FIN_PUSH_LIMITS,
  FIN_PUSH_TEXT,
  charCount,
  clip,
  finPushRoute,
  isReminderMuted,
  muteUntilEndOfDay,
  renderFinPush,
  type FinLang,
  type FinMeal,
  type FinPushInput,
} from '../finPush';
import { translations } from '../../i18n/dictionaries';
import { FIN_TEMPLATES } from '../../../../supabase/functions/send-notification/finPushTemplates';

const LANGS: FinLang[] = ['tr', 'en'];
const MEALS: FinMeal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// En uzun yer tutucular (pano "Sayım kuralı").
const WORST: FinPushInput[] = [
  { kind: 'order_status', orderNo: 'KCAL-9999', etaMin: 999, orderId: 1 },
  { kind: 'order_status', orderNo: 'KCAL-9999-EXTRA-LONG', etaMin: null },
  { kind: 'streak', days: 999 },
  { kind: 'social', name: 'Çok Uzun Bir Kullanıcı Adı Burada', excerpt: 'y'.repeat(300), postId: 'p1', commentId: 'c1' },
  ...MEALS.map((meal) => ({ kind: 'reminder' as const, meal })),
];

test('FinPush: 4 şablon, her biri başlık ≤ 35 ve gövde ≤ 90 (iki dilde, en uzun yer tutucuyla)', () => {
  assert.deepEqual(Object.keys(FIN_PUSH_CATEGORY).sort(), ['order_status', 'reminder', 'social', 'streak']);
  for (const lang of LANGS) {
    for (const input of WORST) {
      const m = renderFinPush(input, lang);
      assert.ok(charCount(m.title) <= FIN_PUSH_LIMITS.title, `${lang} ${input.kind} başlık ${charCount(m.title)}: ${m.title}`);
      assert.ok(charCount(m.body) <= FIN_PUSH_LIMITS.body, `${lang} ${input.kind} gövde ${charCount(m.body)}: ${m.body}`);
      assert.ok(!m.title.includes('%{') && !m.body.includes('%{'), 'doldurulmamış yer tutucu yok');
    }
  }
});

test('FinPush: pano metinleri (TR) birebir', () => {
  const o = renderFinPush({ kind: 'order_status', orderNo: 'KCAL-1234', etaMin: 25 }, 'tr');
  assert.equal(o.title, 'Siparişin yolda');
  assert.equal(o.body, 'KCAL-1234 numaralı siparişin kuryede. Tahmini varış 25 dk.');
  const s = renderFinPush({ kind: 'streak', days: 12 }, 'tr');
  assert.equal(s.title, 'Serin 12. gününde');
  assert.equal(s.body, 'Bugün bir öğün logla, serin devam etsin. Gün bitmeden vaktin var.');
  const c = renderFinPush({ kind: 'social', name: 'Deniz', excerpt: 'Tarifi paylaşır mısın?', postId: 'p' }, 'tr');
  assert.equal(c.title, 'Deniz yorum yaptı');
  assert.equal(c.body, 'Paylaşımına yorum yazdı: “Tarifi paylaşır mısın?”');
  const r = renderFinPush({ kind: 'reminder', meal: 'lunch' }, 'tr');
  assert.equal(r.title, 'Öğle öğününü henüz loglamadın');
  assert.equal(r.body, 'Şimdi loglarsan günlük dengen güncel kalır. Bir dokunuşla ekleyebilirsin.');
});

test('FinPush: yorum özeti ≤ 60, fazlası "…" ile kesilir; ad ≤ 16', () => {
  const c = renderFinPush({ kind: 'social', name: 'x'.repeat(40), excerpt: 'a'.repeat(100), postId: 'p' }, 'tr');
  const excerpt = c.body.slice(c.body.indexOf('“') + 1, c.body.lastIndexOf('”'));
  assert.equal(charCount(excerpt), 60);
  assert.ok(excerpt.endsWith('…'));
  assert.ok(c.title.startsWith('x'.repeat(15) + '…'));
  assert.equal(clip('kısa', 10), 'kısa');
});

test('FinPush: aksiyon sayısı 0–2 — sipariş "Siparişi izle", seri yok, sosyal "Yanıtla" (metin), hatırlatma "30 dk ertele" + "Bugün sessize al"', () => {
  for (const acts of Object.values(FIN_PUSH_ACTIONS)) assert.ok(acts.length <= FIN_PUSH_LIMITS.actions);
  assert.equal(FIN_PUSH_ACTIONS.streak.length, 0);
  assert.equal(FIN_PUSH_ACTIONS.social[0].textInput, true);
  const tr = translations.tr as any;
  const en = translations.en as any;
  const labels = (lang: any, kind: keyof typeof FIN_PUSH_ACTIONS) =>
    FIN_PUSH_ACTIONS[kind].map((a) => a.labelKey.split('.').reduce((o: any, k) => o?.[k], lang));
  assert.deepEqual(labels(tr, 'order_status'), ['Siparişi izle']);
  assert.deepEqual(labels(tr, 'social'), ['Yanıtla']);
  assert.deepEqual(labels(tr, 'reminder'), ['30 dk ertele', 'Bugün sessize al']);
  assert.deepEqual(labels(en, 'reminder'), ['Snooze 30 min', 'Mute for today']);
});

test('FinPush: gizli önizleme — data yalnız kimlik taşır (ad/yorum/öğün metni yok), yer tutucu "Bildirim"', () => {
  const c = renderFinPush({ kind: 'social', name: 'Deniz', excerpt: 'gizli yorum', postId: 'p9', commentId: 'c9' }, 'tr');
  const dataStr = JSON.stringify(c.data);
  assert.ok(!dataStr.includes('Deniz') && !dataStr.includes('gizli yorum'));
  const o = renderFinPush({ kind: 'order_status', orderNo: 'KCAL-1234', orderId: 42 }, 'tr');
  assert.ok(!JSON.stringify(o.data).includes('KCAL-1234'));
  assert.equal((translations.tr as any).push.fin.hidden_preview, 'Bildirim');
  assert.equal((translations.en as any).push.fin.hidden_preview, 'Notification');
});

test('FinPush: i18n sözlüğü (TR/EN) şablon metinleriyle birebir', () => {
  for (const lang of LANGS) {
    const dict = (translations[lang] as any).push.fin as Record<string, string>;
    for (const [k, v] of Object.entries(FIN_PUSH_TEXT[lang])) assert.equal(dict[k], v, `${lang}.push.fin.${k}`);
  }
});

test('FinPush: sunucu şablon dosyası istemciyle birebir ({{var}} biçimi)', () => {
  const toClient = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => `%{${k === 'min' ? 'min' : k}}`);
  for (const lang of LANGS) {
    const T = FIN_PUSH_TEXT[lang];
    assert.equal(toClient(FIN_TEMPLATES.fin_order_status.title[lang]), T.order_title);
    assert.equal(toClient(FIN_TEMPLATES.fin_order_status.body[lang]), T.order_body);
    assert.equal(toClient(FIN_TEMPLATES.fin_streak.title[lang]), T.streak_title);
    assert.equal(toClient(FIN_TEMPLATES.fin_streak.body[lang]), T.streak_body);
    assert.equal(toClient(FIN_TEMPLATES.fin_social.title[lang]), T.social_title);
    assert.equal(toClient(FIN_TEMPLATES.fin_social.body[lang]), T.social_body);
    for (const meal of MEALS) {
      const tpl = FIN_TEMPLATES[`fin_reminder_${meal}` as const];
      assert.equal(tpl.title[lang], T[`reminder_title_${meal}`]);
      assert.equal(tpl.body[lang], T.reminder_body);
      assert.equal(tpl.categoryId, FIN_PUSH_CATEGORY.reminder);
    }
  }
});

test('FinPush: dokunma hedefleri — sipariş detayı, Ana sayfa logla açık, yorumlar, logla + öğün seçili', () => {
  assert.deepEqual(finPushRoute({ fin: 'order_status', orderId: 42 }), { name: 'OrderDetail', params: { orderId: 42 } });
  assert.deepEqual(finPushRoute({ fin: 'order_status' }), { name: 'ProfileOrders' });
  assert.deepEqual(finPushRoute({ fin: 'streak' }), { name: 'Tabs', params: { screen: 'Tracker', params: { finOpenLog: true } } });
  assert.deepEqual(finPushRoute({ fin: 'social', postId: 'p', commentId: 'c' }), {
    name: 'SharedPost',
    params: { postId: 'p', commentId: 'c' },
  });
  assert.deepEqual(finPushRoute({ fin: 'reminder', meal: 'lunch' }), {
    name: 'Tabs',
    params: { screen: 'Tracker', params: { finOpenLog: 'lunch' } },
  });
  assert.equal(finPushRoute({ deep_link: 'x' }), null, 'FinPush olmayan bildirim bugünkü işleyicide kalır');
});

test('FinPush: send-notification fin_* şablonlarında categoryId + channelId ekler (diğerleri aynen)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path');
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../../../supabase/functions/send-notification/index.ts'),
    'utf8',
  );
  assert.match(src, /import \{ FIN_TEMPLATES, type FinTemplateKey \} from '\.\/finPushTemplates\.ts'/);
  assert.match(src, /if \(!templateKey \|\| !\(templateKey in FIN_TEMPLATES\)\) return \{\}/);
  assert.match(src, /\.\.\.finPushExtras\(content\.templateKey\),/);
  for (const t of Object.values(FIN_TEMPLATES)) {
    assert.ok(Object.values(FIN_PUSH_CATEGORY).includes(t.categoryId));
    assert.equal(t.channelId, 'fin');
  }
});

test('FinPush: "Bugün sessize al" gün sonuna kadar', () => {
  const now = new Date(2026, 10, 8, 13, 0, 0);
  const until = muteUntilEndOfDay(now);
  assert.equal(new Date(until).getHours(), 23);
  assert.equal(isReminderMuted(until, now.getTime()), true);
  assert.equal(isReminderMuted(until, new Date(2026, 10, 9, 0, 0, 1).getTime()), false);
  assert.equal(isReminderMuted(null), false);
});
