// G61-S1 — bağlantı biçimleri + gizlilik (kart modelinde yasak alan yok).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARE_KINDS,
  displayLink,
  parseShareLink,
  shareLink,
  whatsappUrl,
  xIntentUrl,
} from '../links';
import {
  ALLOWED_FIELDS,
  isForbiddenField,
  sanitizeCard,
  snapshotPayload,
  firstLines,
} from '../cardModel';
import { parseAttribution } from '../../metrics/attribution';

const UUID = '3f2a9c1e-7b44-4d2a-9a51-0c8e2d1f6b77';

test('bağlantı biçimleri: 8 tür FinShareNotes ile birebir', () => {
  assert.equal(shareLink('post', UUID), `https://l.eatkcal.com/p/${UUID}`);
  assert.equal(shareLink('profile', '@ilter'), 'https://l.eatkcal.com/u/ilter');
  assert.equal(shareLink('recipe', 'mercimek-corbasi'), 'https://l.eatkcal.com/r/mercimek-corbasi');
  assert.equal(shareLink('invite', 'k7m2qx'), 'https://l.eatkcal.com/i/K7M2QX');
  assert.equal(shareLink('meal', 'aB3dE5fG7h'), 'https://l.eatkcal.com/m/aB3dE5fG7h');
  assert.equal(shareLink('day', 'aB3dE5fG7h'), 'https://l.eatkcal.com/d/aB3dE5fG7h');
  assert.equal(shareLink('xray', 'aB3dE5fG7h'), 'https://l.eatkcal.com/x/aB3dE5fG7h');
  assert.equal(shareLink('story', UUID), `https://l.eatkcal.com/s/${UUID}`);
});

test('utm_source her hedefte eklenir', () => {
  for (const t of ['instagram', 'whatsapp', 'x', 'copy', 'save', 'other'] as const) {
    assert.equal(shareLink('invite', 'ABC234', t), `https://l.eatkcal.com/i/ABC234?utm_source=${t}`);
  }
});

test('geçersiz kimlik → bağlantı yok; hikâye yalnız UUID (saha koduyla çakışmaz)', () => {
  assert.equal(shareLink('post', ''), null);
  assert.equal(shareLink('post', 'a/b'), null);
  assert.equal(shareLink('post', null), null);
  assert.equal(shareLink('story', 'IZM01'), null);
  assert.equal(displayLink('meal', null), 'l.eatkcal.com');
  assert.equal(displayLink('meal', 'abc'), 'l.eatkcal.com/m/abc');
});

test('parseShareLink: https + kcal:// gidiş-dönüş; yabancı alan adı reddedilir', () => {
  for (const k of SHARE_KINDS) {
    const id = k === 'story' || k === 'post' ? UUID : k === 'invite' ? 'ABC234' : 'abc123';
    const url = shareLink(k, id, 'copy')!;
    assert.deepEqual(parseShareLink(url), { kind: k, id });
  }
  assert.deepEqual(parseShareLink('kcal://i/ABC234'), { kind: 'invite', id: 'ABC234' });
  assert.equal(parseShareLink('https://evil.com/p/123'), null);
  assert.equal(parseShareLink('https://l.eatkcal.com/privacy'), null);
  assert.equal(parseShareLink('https://l.eatkcal.com/s/IZM01'), null);
});

test('attribution: /s/<uuid> hikâye paylaşımı, /s/<kod> saha kodu olarak kalır; yeni türler share', () => {
  const now = '2026-11-18T10:00:00.000Z';
  assert.equal(parseAttribution('https://l.eatkcal.com/s/IZM01', now)?.source, 'saha');
  const st = parseAttribution(`https://l.eatkcal.com/s/${UUID}`, now);
  assert.equal(st?.source, 'share');
  assert.equal(st?.link, 'story');
  for (const [p, link] of [['m', 'meal'], ['d', 'day'], ['x', 'xray'], ['r', 'recipe'], ['i', 'invite']] as const) {
    const t = parseAttribution(`https://l.eatkcal.com/${p}/abc123`, now);
    assert.equal(t?.source, 'share', p);
    assert.equal(t?.link, link, p);
  }
  assert.equal(parseAttribution(`https://l.eatkcal.com/m/abc123?utm_source=whatsapp`, now)?.source, 'whatsapp');
});

test('WhatsApp ve X bağlantıları kodlanır', () => {
  assert.equal(whatsappUrl('Öğünüm', 'https://l.eatkcal.com/m/a'), 'whatsapp://send?text=%C3%96%C4%9F%C3%BCn%C3%BCm%20https%3A%2F%2Fl.eatkcal.com%2Fm%2Fa');
  assert.equal(
    xIntentUrl('Bugün', 'https://l.eatkcal.com/d/a?utm_source=x'),
    'https://x.com/intent/post?text=Bug%C3%BCn&url=https%3A%2F%2Fl.eatkcal.com%2Fd%2Fa%3Futm_source%3Dx',
  );
});

test('GİZLİLİK: hiçbir kart modelinde yasak alan yok', () => {
  for (const k of SHARE_KINDS) {
    for (const f of ALLOWED_FIELDS[k] as readonly string[]) {
      assert.equal(isForbiddenField(f), false, `${k}.${f} yasak desene uyuyor`);
    }
  }
  // Desenler gerçekten yakalıyor mu?
  for (const f of ['weight', 'targetWeight', 'goalKcal', 'dailyGoal', 'dayTotal', 'bmi', 'allergies', 'healthPrefs', 'likeCount', 'viewers', 'city', 'planType', 'subscriptionTier', 'coachMessages', 'earnedMeals']) {
    assert.equal(isForbiddenField(f), true, f);
  }
});

test('GİZLİLİK: sanitizeCard izinsiz alanları atar (her tür)', () => {
  const poison = {
    weight: 82, targetWeight: 75, goalKcal: 2100, dayTotal: 1650, bmi: 24, allergies: ['fıstık'],
    likeCount: 99, viewers: ['a'], city: 'İzmir', planType: 'fresh', earnedMeals: 3, email: 'x@y.z',
  };
  const base: Record<string, Record<string, unknown>> = {
    meal: { name: 'Menemen', kcal: 410, protein: 22 },
    day: { pct: 76, meals: 3, protein: 98 },
    post: { authorName: 'Ayşe', text: 'a\nb\nc\nd' },
    profile: { name: 'Ayşe', handle: '@ayse' },
    recipe: { name: 'Çorba', ingredients: ['a', 'b', 'c', 'd'] },
    invite: { code: 'k7-m2qx' },
    xray: { name: 'Menemen', totalKcal: 410, items: [{ name: 'Yumurta', kcal: 150, weight: 100 }] },
    story: { text: 'Bugün', mealName: 'Somon', mealKcal: 520 },
  };
  for (const k of SHARE_KINDS) {
    const out = sanitizeCard(k, { ...base[k], ...poison }) as Record<string, unknown>;
    for (const key of Object.keys(out)) {
      assert.ok((ALLOWED_FIELDS[k] as readonly string[]).includes(key), `${k}: ${key} izinsiz`);
    }
    assert.equal(JSON.stringify(out).includes('2100'), false, `${k}: hedef sızdı`);
    assert.equal(JSON.stringify(out).includes('İzmir'), false, `${k}: konum sızdı`);
  }
  const x = sanitizeCard('xray', base.xray) as { items: Record<string, unknown>[] };
  assert.deepEqual(Object.keys(x.items[0]).sort(), ['kcal', 'name']);
  assert.equal(sanitizeCard('post', base.post).text, 'a\nb\nc');
  assert.equal(sanitizeCard('recipe', base.recipe).ingredients?.length, 3);
  assert.equal(sanitizeCard('invite', base.invite).code, 'K7M2QX');
  assert.equal(sanitizeCard('profile', base.profile).handle, 'ayse');
});

test('anlık görüntü yükü: yerel dosya yolu ve fotoğraf yok, boş alan yok', () => {
  const p = snapshotPayload('meal', { name: 'Menemen', kcal: 410, photoUri: 'file:///var/mobile/x.jpg', weight: 80 });
  assert.deepEqual(p, { name: 'Menemen', kcal: 410 });
  const d = snapshotPayload('day', { pct: 76, meals: 3, protein: 98, waterL: 1.8, dayTotal: 1650 });
  assert.deepEqual(d, { pct: 76, meals: 3, protein: 98, waterL: 1.8 });
});

test('firstLines', () => {
  assert.equal(firstLines('  a \n\n b\nc\nd', 3), 'a\nb\nc');
});
