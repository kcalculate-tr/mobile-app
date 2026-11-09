// G18-S4 md.2 — FinComponents gezinme kuralı: itilen sayfa YALNIZ sol geri;
// sheet/modal YALNIZ sağ X. Statik denetim — KAPSAYICI: `src` altında geri oku
// (ArrowLeft/CaretLeft) ya da kapat X'i çizen HER dosya aşağıdaki sınıflardan
// birinde olmak zorunda (yeni dosya sınıflandırılmazsa test kırılır).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const BACK = /\b(ArrowLeft|CaretLeft|ChevronLeft)\b/;
const CLOSE = /<X\b|\bX as XIcon\b|<XIcon\b|name="x"/;

/** Sheet / tam ekran modal (bayrak açık yol) — geri oku YOK, kapat X sağda. */
const MODAL_FILES = [
  'core/design/components/Sheet.tsx',
  'modules/ai/scan/screens/ScanScreen.tsx',
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
  'screens/tracker/HomeManualMealSheet.tsx',
  'components/OrderFeedbackModal.tsx',
  'components/share/PlateXRayShareModal.tsx',
  'components/share/ShareMealCardModal.tsx',
  'components/checkout/AddressVerificationSheet.tsx',
  // G18-S5 birleştirme: S3 (eatkcal) yeni yüzeyleri — sağ üst X, geri oku yok.
  'modules/eatkcal/v2/screens/EkOrderSuccessScreen.tsx',
  'modules/eatkcal/v2/ui/gate/WaitlistFormSheet.tsx',
];

/** İtilen sayfa / sayfa başlığı (bayrak açık yol) — kapat X YOK, yalnız sol geri. */
const PUSH_FILES = [
  'modules/onboarding/v2/FormScreen.tsx',
  'modules/profil/ui/finUi.tsx',
  'modules/profil/ui/PublicProfileScreen.tsx',
  'modules/profil/ui/screens/PublicPreviewScreen.tsx',
  'modules/profil/ui/signup/KcalAiSignUpScreen.tsx',
  'modules/kesfet/ui/PostDetailScreen.tsx',
  'modules/ai/scan/screens/ScanOfflineScreen.tsx',
  'modules/collection/CollectionCardDetail.tsx',
  'modules/eatkcal/v2/ui/kit.tsx',
  'modules/eatkcal/v2/ui/gate/CityGateView.tsx',
  'modules/eatkcal/v2/screens/EkProductScreen.tsx',
  'modules/eatkcal/v2/screens/EkStoreScreen.tsx',
  'modules/eatkcal/v2/screens/EkAddressAddScreen.tsx',
  'modules/eatkcal/v2/screens/EkAddCardScreen.tsx',
  'modules/eatkcal/v2/screens/EkPaymentScreen.tsx',
];

/** Gezinme DEĞİL, yerinde denetim (alan temizleme / ek kaldırma / arama kapatma). */
const IN_PLACE: Record<string, string> = {
  'modules/ai/scan/ui/ScanNote.tsx': 'not alanını temizle',
  'modules/eatkcal/v2/screens/EkHomeScreen.tsx': 'arama alanını kapat',
  'modules/profil/ui/screens/SettingsSupportScreen.tsx': 'eklenen görseli kaldır',
  'dev/vitrinStress.tsx': 'yalnız __DEV__ vitrin',
};

/** Yalnız bayrak KAPALI yol (1.0.7) — bayrak açıkken finalRoutes/v2ScreenFor Final karşılığını verir. */
const LEGACY = [
  'components/BottomSheet.tsx',
  'components/ReorderCard.tsx',
  'components/onboarding/TopBar.tsx',
  'modules/eatkcal/screens/CheckoutScreen.tsx',
  'modules/eatkcal/screens/PaymentScreen.tsx',
  'screens/AddressesScreen.tsx',
  'screens/BrandLandingScreen.tsx',
  'screens/CategoriesScreen.tsx',
  'screens/CategoryProductsScreen.tsx',
  'screens/FeedbackScreen.tsx',
  'screens/OffersAndCouponsScreen.tsx',
  'screens/PersonalInfoScreen.tsx',
  'screens/ProductDetailScreen.tsx',
  'screens/profile/AddCardScreen.tsx',
  'screens/profile/ContractsScreen.tsx',
  'screens/profile/MyReviewsScreen.tsx',
  'screens/profile/NotificationPreferencesScreen.tsx',
  'screens/profile/OrdersScreen.tsx',
  'screens/profile/SavedCardsScreen.tsx',
  'screens/profile/SecurityScreen.tsx',
  'screens/profile/SupportScreen.tsx',
  'screens/tracker/MeasurementHistoryScreen.tsx',
  'screens/tracker/NutritionProfileScreen.tsx',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) {
      if (n === 'node_modules' || n.startsWith('__')) continue;
      walk(p, out);
    } else if (n.endsWith('.tsx')) out.push(path.relative(SRC, p).split(path.sep).join('/'));
  }
  return out;
}

test('gezinme kuralı: geri oku / X çizen HER dosya sınıflandırılmış (kapsayıcı tarama)', () => {
  const known = new Set([...MODAL_FILES, ...PUSH_FILES, ...Object.keys(IN_PLACE), ...LEGACY]);
  const users = walk(SRC).filter((f) => {
    const s = read(f);
    return BACK.test(s) || CLOSE.test(s);
  });
  const unclassified = users.filter((f) => !known.has(f));
  assert.deepEqual(unclassified, [], 'yeni gezinme ikonu kullanan dosya: MODAL/PUSH/IN_PLACE/LEGACY listesine ekle');
});

test('gezinme kuralı: sheet/modal yüzeylerinde geri oku yok', () => {
  for (const f of MODAL_FILES) assert.doesNotMatch(read(f), BACK, `${f}: modalda sol geri olamaz`);
});

test('gezinme kuralı: itilen sayfalarda kapat X yok', () => {
  for (const f of PUSH_FILES) assert.doesNotMatch(read(f), CLOSE, `${f}: itilen sayfada X olamaz`);
});

test('gezinme kuralı: Tara kapat X SAĞDA; Sheet kapat X var', () => {
  assert.match(read('modules/ai/scan/ui/FinScanCamera.tsx'), /flexDirection: 'row-reverse'/);
  assert.match(read('core/design/components/Sheet.tsx'), /XIcon/);
});

test('gezinme kuralı: FinSignupAI kod/ad adımlarında sağda "Vazgeç" yok', () => {
  const src = read('modules/onboarding/v2/SignupAIFlowV2.tsx');
  assert.doesNotMatch(src, /topRight=\{\{ label: tt\('common\.cancel'\)/);
});
