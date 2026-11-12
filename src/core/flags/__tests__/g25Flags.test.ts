// G25-S1 md.3 + md.7 — yeni uzak bayraklar `yakinda_satirlari` ve `paylasim_baglanti`:
// yerel varsayılan KAPALI, sunucu satırı migration DOSYASINDA kapalı, rollback var.
// md.4 — Macro ödül kuponu bekleme (sepet boşken) bir kez alınır.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FLAG_DEFAULTS } from '../registry';
import { peekPendingCoupon, setPendingCoupon, takePendingCoupon } from '../../../modules/eatkcal/v2/model/pendingCoupon';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('registry: iki yeni bayrak yerelde KAPALI', () => {
  assert.equal(FLAG_DEFAULTS.yakinda_satirlari, false);
  assert.equal(FLAG_DEFAULTS.paylasim_baglanti, false);
});

test('migration dosyası: iki satır kapalı, rollout 0, min 1.1.0, tekrar çalıştırılabilir; rollback siler', () => {
  const sql = read('supabase/migrations/20261111200100_g25_flags.sql');
  for (const key of ['yakinda_satirlari', 'paylasim_baglanti']) {
    assert.match(sql, new RegExp(`'${key}', false, 0, '1\\.1\\.0'`));
  }
  assert.equal((sql.match(/on conflict \(key\) do nothing/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /update public\.feature_flags|enabled\s*=\s*true/);
  const rb = read('supabase/rollbacks/20261111200100_g25_flags_rollback.sql');
  assert.match(rb, /delete from public\.feature_flags where key in \('yakinda_satirlari', 'paylasim_baglanti'\)/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'supabase/migrations/20261111200100_g25_flags_rollback.sql')));
});

test('bekleyen ödül kuponu: boş kod yok sayılır, bir kez alınır', () => {
  setPendingCoupon('  ');
  assert.equal(peekPendingCoupon(), null);
  setPendingCoupon(' MACRO-1 ');
  assert.equal(peekPendingCoupon(), 'MACRO-1');
  assert.equal(takePendingCoupon(), 'MACRO-1');
  assert.equal(takePendingCoupon(), null);
});
