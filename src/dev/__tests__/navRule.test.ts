// G18-S4 md.2 — FinComponents gezinme kuralı: itilen sayfa YALNIZ sol geri;
// sheet/modal YALNIZ sağ X. Statik denetim (Final dosyaları).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const BACK = /\b(ArrowLeft|CaretLeft)\b/;
const CLOSE = /<X\b|\bX as XIcon\b|<XIcon\b|name="x"/;

/** Sheet / tam ekran modal olarak sunulan Final yüzeyler — geri oku YOK. */
const MODAL_FILES = [
  'core/design/components/Sheet.tsx',
  'modules/ai/scan/ui/FinScanCamera.tsx',
  'modules/ai/scan/ui/FinScanViewfinder.tsx',
  'modules/ai/scan/ui/FinScanErrorSheet.tsx',
  'modules/ai/scan/ui/FinPhotoResult.tsx',
  'modules/celebrate/CelebrateOverlay.tsx',
  'modules/kesfet/ui/RulesSheet.tsx',
  'modules/kesfet/ui/ReportFlow.tsx',
  'modules/kesfet/ui/VideoPlayer.tsx',
  'modules/kesfet/ui/ComposerScreen.tsx',
  'modules/kesfet/ui/CommentsSheet.tsx',
  'modules/gun/ui/GunViewer.tsx',
];

/** İtilen sayfa başlıkları / sayfaları — X YOK (yalnız sol geri). */
const PUSH_FILES = [
  'modules/onboarding/v2/FormScreen.tsx',
  'modules/profil/ui/finUi.tsx',
  'modules/kesfet/ui/PostDetailScreen.tsx',
  'modules/profil/ui/PublicProfileScreen.tsx',
  'modules/ai/scan/screens/ScanOfflineScreen.tsx',
  'modules/eatkcal/v2/screens/EkProductScreen.tsx',
  'modules/eatkcal/v2/screens/EkStoreScreen.tsx',
  'modules/eatkcal/v2/screens/EkAddressAddScreen.tsx',
  'modules/eatkcal/v2/screens/EkAddCardScreen.tsx',
  'modules/eatkcal/v2/screens/EkPaymentScreen.tsx',
];

test('gezinme kuralı: sheet/modal yüzeylerinde geri oku yok', () => {
  for (const f of MODAL_FILES) assert.doesNotMatch(read(f), BACK, `${f}: modalda sol geri olamaz`);
});

test('gezinme kuralı: itilen sayfalarda kapat X yok', () => {
  for (const f of PUSH_FILES) assert.doesNotMatch(read(f), CLOSE, `${f}: itilen sayfada X olamaz`);
});

test('gezinme kuralı: Sheet ve Tara kapat X SAĞDA', () => {
  assert.match(read('modules/ai/scan/ui/FinScanCamera.tsx'), /flexDirection: 'row-reverse'/);
  const sheet = read('core/design/components/Sheet.tsx');
  assert.match(sheet, /XIcon/);
});

test('gezinme kuralı: FinSignupAI kod/ad adımlarında sağda "Vazgeç" yok', () => {
  const src = read('modules/onboarding/v2/SignupAIFlowV2.tsx');
  assert.doesNotMatch(src, /topRight=\{\{ label: tt\('common\.cancel'\)/);
});
