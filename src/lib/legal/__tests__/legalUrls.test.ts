// G28-S1 md.7 — yasal web bağlantıları tek sabit dosyada (urls.ts); kullanılan yerler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { LEGAL_WEB_BASE, legalWebUrl, webDocForSlug } from '../urls';
import { LEGAL_SLUG } from '../slugs';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('TR adresleri', () => {
  assert.equal(LEGAL_WEB_BASE, 'https://legal.eatkcal.com');
  assert.equal(legalWebUrl('terms', 'tr'), 'https://legal.eatkcal.com/kullanim-kosullari');
  assert.equal(legalWebUrl('privacy', 'tr'), 'https://legal.eatkcal.com/gizlilik-politikasi');
  assert.equal(legalWebUrl('support', 'tr'), 'https://legal.eatkcal.com/destek');
  assert.equal(legalWebUrl('accountDeletion', 'tr'), 'https://legal.eatkcal.com/account-deletion');
});

test('EN adresleri; bilinmeyen dil → TR', () => {
  assert.equal(legalWebUrl('terms', 'en'), 'https://legal.eatkcal.com/en/legal/terms');
  assert.equal(legalWebUrl('privacy', 'en'), 'https://legal.eatkcal.com/en/legal/privacy');
  assert.equal(legalWebUrl('support', 'en'), 'https://legal.eatkcal.com/en/support');
  assert.equal(legalWebUrl('privacy', undefined), 'https://legal.eatkcal.com/gizlilik-politikasi');
});

test('uygulama içi belge adı → web belgesi (KVKK / mesafeli satış uygulama içi kalır)', () => {
  assert.equal(webDocForSlug(LEGAL_SLUG.terms), 'terms');
  assert.equal(webDocForSlug(LEGAL_SLUG.privacy), 'privacy');
  assert.equal(webDocForSlug(LEGAL_SLUG.kvkk), null);
  assert.equal(webDocForSlug(LEGAL_SLUG.distanceSales), null);
});

test('adres yalnız urls.ts\'te yazılı (tek sabit dosya)', () => {
  const out = execSync(`git grep -l "https://legal.eatkcal" -- src ':!src/**/__tests__/**' ':!src/**/__component_tests__/**'`, {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    // erişilebilirlik metni sitenin adını söyler (adres değil)
    .filter((f) => f !== 'src/core/i18n/dictionaries.ts');
  assert.deepEqual(out, ['src/lib/legal/urls.ts']);
});

test('paywall, Sözleşmeler, onay sheet\'leri ve hesap silme web bağlantısını kullanır', () => {
  assert.match(read('src/modules/subscription/ui/SubLegalLinks.tsx'), /openLegalWeb\('privacy'/);
  assert.match(read('src/modules/subscription/ui/SubLegalLinks.tsx'), /openLegalWeb\('terms'/);
  assert.match(read('src/modules/profil/ui/screens/SettingsAgreementsScreen.tsx'), /openLegalWeb\(web, lang\)/);
  assert.match(read('src/modules/onboarding/consent/ConsentBlock.tsx'), /openLegalWeb\(web, i18n\.lang/);
  assert.match(read('src/modules/ai/scan/screens/ScanScreen.tsx'), /openLegalWeb\('privacy'/);
  assert.match(read('src/modules/coach/screens/CoachChatScreen.tsx'), /openLegalWeb\('privacy'/);
  assert.match(read('src/modules/profil/ui/screens/SettingsDataConsentScreen.tsx'), /openLegalWeb\('terms'/);
  assert.match(read('src/modules/profil/ui/screens/SettingsSecurityScreen.tsx'), /openLegalWeb\('accountDeletion'/);
});

// G29-S1 md.2 (G28 SORULAR 3 kararı): Profil › Destek'te web Destek ve SSS bağlantısı;
// EN hesap silme TR ile AYNI sayfa (/account-deletion).
test('G29: Destek ekranı web Destek ve SSS sayfasını açar; EN hesap silme aynı sayfa', () => {
  const src = read('src/modules/profil/ui/screens/SettingsSupportScreen.tsx');
  assert.match(src, /openLegalWeb\('support', lang\)/);
  assert.match(src, /accessibilityRole="link"/);
  assert.equal(legalWebUrl('support', 'en'), 'https://legal.eatkcal.com/en/support');
  assert.equal(legalWebUrl('accountDeletion', 'en'), legalWebUrl('accountDeletion', 'tr'));
  assert.equal(legalWebUrl('accountDeletion', 'en'), 'https://legal.eatkcal.com/account-deletion');
});
