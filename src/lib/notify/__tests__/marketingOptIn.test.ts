// G20-S3 md.6 (B-11) — pazarlama bildirimi varsayılan KAPALI; mevcut tercih korunur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_NOTIFY_PREFS, prefsFromRow } from '../marketingPrefs';
import { kategoriAcikMi } from '../../../../supabase/functions/send-notification/prefs';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('istemci: satır yok / alan eksik → pazarlama KAPALI, diğerleri açık; kayıtlı değer aynen', () => {
  assert.equal(DEFAULT_NOTIFY_PREFS.marketing_enabled, false);
  assert.deepEqual(prefsFromRow(null), {
    transactional_enabled: true,
    marketing_enabled: false,
    reminder_enabled: true,
    behavioral_enabled: true,
  });
  // mevcut kullanıcının açık tercihi KORUNUR
  assert.equal(prefsFromRow({ marketing_enabled: true }).marketing_enabled, true);
  assert.equal(prefsFromRow({ marketing_enabled: null }).marketing_enabled, false);
  assert.equal(prefsFromRow({ reminder_enabled: false }).reminder_enabled, false);
});

test('send-notification: satır yoksa pazarlama gitmez, diğer kategoriler gider; satır varsa değeri', () => {
  assert.equal(kategoriAcikMi(undefined, 'marketing'), false);
  assert.equal(kategoriAcikMi(undefined, 'transactional'), true);
  assert.equal(kategoriAcikMi(undefined, 'reminder'), true);
  assert.equal(kategoriAcikMi(undefined, 'behavioral'), true);
  assert.equal(kategoriAcikMi({ marketing_enabled: true }, 'marketing'), true);
  assert.equal(kategoriAcikMi({ marketing_enabled: false }, 'marketing'), false);
  const idx = read('supabase/functions/send-notification/index.ts');
  assert.match(idx, /import \{ kategoriAcikMi \} from '\.\/prefs\.ts'/);
  assert.match(idx, /const kategoriAcik = kategoriAcikMi\(prefs, content\.category\)/);
  assert.doesNotMatch(idx, /prefs \? Boolean\(prefs\[categoryEnabledKey\]\) : true/);
});

test('ayar ekranları (yeni + eski kabuk): varsayılan ve eksik değer KAPALI', () => {
  for (const p of ['src/modules/profil/ui/screens/SettingsNotifyScreen.tsx', 'src/screens/profile/NotificationPreferencesScreen.tsx']) {
    const s = read(p);
    assert.match(s, /marketing_enabled: false,/, p);
    assert.match(s, /marketing_enabled: data\.marketing_enabled \?\? false,/, p);
    assert.doesNotMatch(s, /marketing_enabled: true,/, p);
  }
});

test('migration: varsayılan false + yeni satır kapalı (INSERT tetikleyicisi), mevcut satır güncellenmez, rollback', () => {
  const mig = 'supabase/migrations/20261109220300_g20_s3_marketing_optin.sql';
  const rb = 'supabase/rollbacks/20261109220300_g20_s3_marketing_optin_rollback.sql';
  assert.ok(existsSync(join(ROOT, mig)) && existsSync(join(ROOT, rb)));
  const sql = read(mig);
  const code = sql.replace(/--.*$/gm, '');
  assert.match(code, /alter column marketing_enabled set default false/);
  assert.match(code, /before insert on public\.notification_preferences/);
  assert.doesNotMatch(code, /update public\.notification_preferences/i);
  assert.match(read(rb), /drop trigger if exists notification_preferences_marketing_optin/);
});
