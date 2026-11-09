// G20-S3 md.2 / 2b / 6 — saf kararlar + kaynak bekçileri (statik).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aiPhotoDecision, parseAiPhoto } from '../policy';
import { EMPTY_SYNCED, confirmAge, mergeSynced, parseSynced } from '../../../modules/onboarding/first/state';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('md.2 aiPhotoDecision: cihaz kaydı kazanır; yoksa sunucu; okunamadı → sor (fail-open YOK)', () => {
  assert.equal(aiPhotoDecision(null, null), 'ask');
  assert.equal(aiPhotoDecision(null, undefined), 'ask');
  assert.equal(aiPhotoDecision(null, false), 'ask');
  assert.equal(aiPhotoDecision(null, true), 'ok');
  assert.equal(aiPhotoDecision({ granted: true, at: '' }, false), 'ok');
  // ayardan geri alındı → sunucuda eski "true" olsa da sor
  assert.equal(aiPhotoDecision({ granted: false, at: '' }, true), 'ask');
});

test('md.2 parseAiPhoto: bozuk veri güvenli', () => {
  assert.equal(parseAiPhoto(null), null);
  assert.equal(parseAiPhoto('{bozuk'), null);
  assert.equal(parseAiPhoto(JSON.stringify({ granted: 'evet' })), null);
  assert.deepEqual(parseAiPhoto(JSON.stringify({ granted: true, at: 'x' })), { granted: true, at: 'x' });
});

test('md.6 18+ (onboarding_state.age_ok): ayrıştırma, birleştirme (VEYA, en erken zaman), eski biçim aynen', () => {
  // eski kayıt (alan yok) → biçim değişmez (yalnız profileCard/orient)
  assert.deepEqual(Object.keys(parseSynced({ profileCard: 'done' })).sort(), ['orient', 'profileCard']);
  assert.deepEqual(parseSynced({ age_ok: true, age_ok_at: 't1' }).age_ok_at, 't1');
  assert.equal(parseSynced({ age_ok: 'true' }).age_ok, undefined);
  const a = confirmAge(EMPTY_SYNCED, '2026-11-09T10:00:00Z');
  assert.equal(a.age_ok, true);
  assert.equal(confirmAge(a, '2027-01-01T00:00:00Z').age_ok_at, '2026-11-09T10:00:00Z'); // ilk zaman korunur
  const b = confirmAge(EMPTY_SYNCED, '2026-11-08T10:00:00Z');
  assert.equal(mergeSynced(a, b).age_ok_at, '2026-11-08T10:00:00Z');
  assert.equal(mergeSynced(EMPTY_SYNCED, a).age_ok, true);
  assert.equal(mergeSynced(EMPTY_SYNCED, EMPTY_SYNCED).age_ok, undefined);
});

test('md.2b Hesap ekranı: Apple/Google/e-posta düğmeleri onay kutusu işaretlenmeden PASİF; kabul 18+ ile', () => {
  const nav = read('src/modules/onboarding/OnboardingNavigator.tsx');
  for (const k of ['apple', 'google', 'email']) {
    assert.match(nav, new RegExp(`<AuthButton kind="${k}"[^>]*disabled=\\{busy \\|\\| !accepted\\}`), k);
  }
  assert.match(nav, /if \(busy \|\| !accepted\) return;/);
  assert.match(nav, /<PolicyAcceptRow accepted=\{accepted\} onAcceptedChange=\{setAccepted\} withAge/);
  // "Devam ederek … kabul edersin" satırı kalktı (kabul = kutu)
  assert.doesNotMatch(nav, /onboarding\.account\.legal_pre/);
  // e-posta sheet'i + ayrıntı sheet'i aynı durumu alır
  assert.match(nav, /<AccountEmailSheet[\s\S]*?accepted=\{accepted\}[\s\S]*?onAcceptedChange=\{setAccepted\}/);
  assert.match(nav, /<ConsentSheet[\s\S]*?accepted=\{accepted\}/);
  // reklam ölçümü anahtarı ayrı ve açık gelir (değişmez)
  assert.match(nav, /const \[adOn, setAdOn\] = useState\(true\);/);
});

test('md.2 Tara bekçileri: çekim / galeri / tekrar dene / kuyruk izin olmadan göndermez', () => {
  const scan = read('src/modules/ai/scan/screens/ScanScreen.tsx');
  assert.ok((scan.match(/if \(await aiBlocked\(\)\) return;/g) ?? []).length >= 4);
  assert.match(scan, /mode="ai_photo"/);
  assert.match(scan, /setAiPhotoConsent\(false, 'scan'\)[\s\S]*?handleManualEntry\(\);/);
  const drain = read('src/modules/ai/scan/drainPending.ts');
  assert.match(drain, /hasLocalAiPhotoConsent\(\)[\s\S]*?ok \? drainNow/);
});

test('md.6 eski giriş ekranı: 18+ kutusu cihaz kaydına bakıp ATLANMAZ; beyan hesaba yazılır; metin aynen', () => {
  const login = read('src/screens/auth/UnifiedLoginScreen.tsx');
  assert.match(login, /const needsAgeGate = true;/);
  assert.doesNotMatch(login, /setNeedsAgeGate/);
  assert.match(login, /if \(ageConfirmed && user\?\.id\) await saveAgeOk\(user\.id\)/);
  assert.match(login, /18 yaşından büyüğüm ve kullanım koşullarını kabul ediyorum\./);
});
