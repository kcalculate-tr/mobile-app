// G49-S1 md.3 — profilsiz Ana sayfa hızlı eylemleri: takip eylemleri profil kapısından geçer (dönüş hedefi = dokunulan
// eylem); paylaşım Keşfet kuralıyla (oturum yoksa giriş katmanı).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runQuickAction, type QuickDeps } from '../quickActions';
import { kayitRouteFor, type GateTarget } from '../gateLogic';

const T = {
  scan: { name: 'AiScan' },
  activity: { name: 'Tabs', params: { screen: 'Tracker', params: { finAddActivity: true } } },
  coach: { name: 'CoachIntro', params: { from: 'home', prefill: 'Akşam ne yesem?' } },
};

function deps(blocked: boolean, over: Partial<QuickDeps> = {}) {
  const calls: string[] = [];
  const routed: (GateTarget | null)[] = [];
  const d: QuickDeps = {
    require: (t) => {
      if (!blocked) return false;
      routed.push(t);
      calls.push(`nav:${JSON.stringify(kayitRouteFor(true, 'gate', t))}`);
      return true;
    },
    targets: T,
    startScan: () => calls.push('scan'),
    openActivity: () => calls.push('activity'),
    openCoach: () => calls.push('coach'),
    signedIn: true,
    openLogin: () => calls.push('login'),
    openComposer: () => calls.push('composer'),
    openKesfet: () => calls.push('kesfet'),
    ...over,
  };
  return { d, calls, routed };
}

test('profil yok: Tara · Etkinlik · Koç → kayıt akışı, dönüş hedefi dokunulan eylem; eylem AÇILMAZ', () => {
  for (const a of ['scan', 'activity', 'coach'] as const) {
    const { d, calls, routed } = deps(true);
    assert.equal(runQuickAction(a, d), 'kayit');
    assert.deepEqual(routed, [T[a]]);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /"name":"Kayit"/);
    assert.ok(calls[0].includes(JSON.stringify(T[a])), `${a} returnTo`);
  }
});

test('profil var (kapı geçer): eylem doğrudan açılır', () => {
  for (const a of ['scan', 'activity', 'coach'] as const) {
    const { d, calls } = deps(false);
    assert.equal(runQuickAction(a, d), a);
    assert.deepEqual(calls, [a]);
  }
});

test('Paylaş: profil kapısına takılmaz; oturum yoksa giriş katmanı; paylaşım kapalıysa Keşfet', () => {
  const a = deps(true);
  assert.equal(runQuickAction('share', a.d), 'composer');
  assert.deepEqual(a.routed, []);
  const b = deps(true, { signedIn: false });
  assert.equal(runQuickAction('share', b.d), 'login');
  assert.deepEqual(b.calls, ['login']);
  const c = deps(false, { openComposer: null });
  assert.equal(runQuickAction('share', c.d), 'kesfet');
});

test('TrackerScreen: profilsiz Ana sayfa = yeni kart + hemen altında 4 eylem; eylemler runQuickAction ile', () => {
  const s = fs.readFileSync(path.resolve(__dirname, '../../../screens/TrackerScreen.tsx'), 'utf8');
  assert.match(s, /\{yeniKabuk && profileGate\.blocked \? <HomePlanGateCard onStart=\{\(\) => profileGate\.require\(null\)\} \/> : null\}\s*\{yeniKabuk && profileGate\.blocked \? <HomeQuickActions actions=\{quickActions\} onAction=\{onQuickAction\} \/> : null\}/);
  assert.match(s, /runQuickAction\(a, \{\s*require: profileGate\.require,/);
  assert.match(s, /activity: homeTarget\(\{ finAddActivity: true \}\)/);
  assert.match(s, /coach: \{ name: 'CoachIntro', params: \{ from: 'home', prefill \} \}/);
  assert.match(s, /openLogin: \(\) => nav\.navigate\('Login'\)/);
  // Dönüşte etkinlik sheet'i bir kez açılır (yalnız kapı açıldıktan sonra).
  assert.match(s, /if \(!yeniKabuk \|\| !finAddActivity \|\| profileGate\.blocked\) return;/);
  assert.match(s, /openSignal=\{activityOpenSignal\}/);
  // Eski G47 kartı kalktı.
  assert.doesNotMatch(s, /HomeProfileGateCard/);
  assert.equal(fs.existsSync(path.resolve(__dirname, '../ui/HomeProfileGateCard.tsx')), false);
});
