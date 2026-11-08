// G15-S6 md.3 — "Eski tasarım: 0" otomatik denetimi.
// Bütün bayraklar AÇIKKEN Final yolunun (v2/Fin* giriş dosyaları) import ağacında
// 1.0.7 tasarımı bileşeni olmamalı: eski `COLORS` (constants/theme), eski
// `BottomSheet`, eski logo (kcalculateLogo) ve 1.0.7 kart/düğme bileşenleri.
// Bayrak kapısı dosyaları (`*Gate*`, `Legacy*`, `legacy*`) DURAK düğümüdür:
// eski ekran yalnız onların arkasında, bayrak kapalı yolda yaşar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../..');

const LEGACY_FILES = [
  'constants/kcalculateLogo.ts',
  'components/BottomSheet.tsx',
  'components/ScreenContainer.tsx',
  'components/FormField.tsx',
  'components/PopupModal.tsx',
  'components/ReorderCard.tsx',
  'components/ActiveOrderCard.tsx',
  'components/FloatingCartPill.tsx',
];
const COLORS_IMPORT = /import\s*\{[^}]*\bCOLORS\b[^}]*\}\s*from\s*['"][^'"]*constants\/theme['"]/;

function walk(dir: string, out: string[] = []): string[] {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (n === 'node_modules' || n.startsWith('__')) continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx'), base]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

const rel = (f: string) => path.relative(SRC, f);
const isGate = (f: string) => /(Gate|Legacy|legacy)/.test(path.basename(f));

function importsOf(f: string): string[] {
  const src = fs.readFileSync(f, 'utf8');
  const specs = [...src.matchAll(/(?:from\s+|import\(\s*|require\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
  return specs.map((s) => resolveImport(f, s)).filter((x): x is string => !!x);
}

/** Giriş dosyalarından erişilen eski tasarım ihlalleri. */
function violations(entries: string[], allow: Record<string, string>): string[] {
  const seen = new Set<string>();
  const bad: string[] = [];
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const r = rel(f);
    if (LEGACY_FILES.includes(r) && !allow[r]) {
      bad.push(`${r} (eski bileşen)`);
      continue;
    }
    if (COLORS_IMPORT.test(fs.readFileSync(f, 'utf8')) && !allow[r]) bad.push(`${r} (eski COLORS)`);
    for (const dep of importsOf(f)) if (!isGate(dep)) stack.push(dep);
  }
  return bad.sort();
}

const list = (dir: string, re?: RegExp) => walk(path.join(SRC, dir)).filter((f) => !re || re.test(rel(f)));

// Final (bayrak açık) yolun giriş noktaları.
const ENTRIES: Record<string, string[]> = {
  'eatkcal v2': list('modules/eatkcal/v2'),
  'onboarding v2': list('modules/onboarding/v2'),
  // G18-S1 — ilk 60 saniye (FinOpen, e-posta sheet'i, profil kartı, Profil hazır, Orient1–4, boş hâl).
  'onboarding ilk 60 sn': list('modules/onboarding/first'),
  'onboarding (Final)': ['modules/onboarding/OnboardingNavigator.tsx', 'modules/onboarding/takibe/TakibeNavigator.tsx'].map((p) => path.join(SRC, p)),
  'profil Fin*': list('modules/profil/ui/screens', /\/Fin[A-Z]/),
  'kesfet Final': list('modules/kesfet/ui', /\/(Fin[A-Z]|FeedCard|Composer|Comments|Notifications)/),
  celebrate: list('modules/celebrate'),
  shell: list('modules/shell'),
};

// Bilinçli istisnalar (sebebiyle): boş = yok.
const ALLOW: Record<string, string> = {
  // Ölçüm raporu PDF'inin içindeki marka logosu (dışa aktarılan belge, uygulama ekranı
  // değil). Final logo varlığı gelene kadar bilinçli istisna → LOG "SORULAR".
  'constants/kcalculateLogo.ts': 'PDF rapor logosu (exportNutritionReport)',
};

for (const [name, files] of Object.entries(ENTRIES)) {
  test(`Eski tasarım: 0 — ${name} (bayrak açık yolda eski bileşen import edilmez)`, () => {
    assert.ok(files.length > 0, `${name}: giriş dosyası yok`);
    assert.deepEqual(violations(files, ALLOW), []);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// G17-S1 md.13 — ROTA BAZINDA denetim (G14/G15 vitrini gerçek gezinmeyi
// kapsamıyordu). AppNavigator'da kayıtlı HER rota sınıflandırılmalı; bayraklar
// açıkken çizdiği bileşen Final/v2 olmalı ve import ağacında eski bileşen
// bulunmamalı. Yeni bir rota eklenip buraya yazılmazsa test düşer.
type Audit =
  | { kind: 'final'; file: string }
  | { kind: 'finalRoute' } // finalScreenFor / checkoutScreenFor (navigation/finalRoutes.tsx)
  | { kind: 'v2swap'; file: string } // v2ScreenFor (eatkcal/v2/routes.tsx LEGACY_SWAP)
  | { kind: 'gate'; file: string } // *Gate: bayrak açıkken bu dosyayı çizer
  | { kind: 'internal'; why: string } // bileşen bayrağı kendi içinde dallandırır
  | { kind: 'flagOff'; why: string }
  | { kind: 'dev' };

const ROUTE_AUDIT: Record<string, Audit> = {
  WelcomeGate: { kind: 'flagOff', why: 'yeni_onboarding açıkken oturumsuz açılış Onboarding' },
  Onboarding: { kind: 'final', file: 'modules/onboarding/OnboardingNavigator.tsx' },
  TakibeBasla: { kind: 'final', file: 'modules/onboarding/takibe/TakibeNavigator.tsx' },
  Tabs: { kind: 'internal', why: 'TabsRoot → yeni_kabuk: TabNavigatorR3 (aşağıda sekme bazında)' },
  Categories: { kind: 'finalRoute' },
  CategoryProducts: { kind: 'finalRoute' },
  BrandLanding: { kind: 'finalRoute' },
  ProductDetail: { kind: 'finalRoute' },
  Checkout: { kind: 'finalRoute' },
  Addresses: { kind: 'v2swap', file: 'modules/eatkcal/v2/screens/EkAddressesScreen.tsx' },
  OrderSuccess: { kind: 'v2swap', file: 'modules/eatkcal/v2/screens/EkOrderSuccessScreen.tsx' },
  Offers: { kind: 'finalRoute' },
  DevDiagnostics: { kind: 'dev' },
  DesignShowcase: { kind: 'dev' },
  FeedDataLab: { kind: 'dev' },
  GunProfilUiLab: { kind: 'dev' },
  Kesfet: { kind: 'final', file: 'modules/kesfet/ui/KesfetScreen.tsx' },
  Composer: { kind: 'final', file: 'modules/kesfet/ui/ComposerScreen.tsx' },
  KesfetNotifications: { kind: 'final', file: 'modules/kesfet/ui/NotificationsScreen.tsx' },
  PublicProfile: { kind: 'internal', why: 'PublicProfileScreen yeni_kabuk ile dallanır (Final dal: profil/ui)' },
  KcalAiSignUp: { kind: 'gate', file: 'modules/onboarding/v2/SignupAIFlowV2.tsx' },
  Login: { kind: 'gate', file: 'modules/onboarding/v2/LoginV2.tsx' },
  NutritionProfile: { kind: 'finalRoute' },
  MeasurementHistory: { kind: 'finalRoute' },
  ProfileOrders: { kind: 'v2swap', file: 'modules/eatkcal/v2/screens/EkOrdersScreen.tsx' },
  OrderDetail: { kind: 'finalRoute' },
  ProfileSavedCards: { kind: 'v2swap', file: 'modules/eatkcal/v2/screens/EkSavedCardsScreen.tsx' },
  ProfileAddCard: { kind: 'v2swap', file: 'modules/eatkcal/v2/screens/EkAddCardScreen.tsx' },
  ProfileCoupons: { kind: 'finalRoute' },
  ProfileSupport: { kind: 'v2swap', file: 'modules/eatkcal/v2/screens/EkProfileLinks.tsx' },
  ProfileReviews: { kind: 'finalRoute' },
  ProfileSecurity: { kind: 'finalRoute' },
  ProfileNotificationPreferences: { kind: 'finalRoute' },
  Feedback: { kind: 'finalRoute' },
  PersonalInfo: { kind: 'finalRoute' },
  ProfileContracts: { kind: 'v2swap', file: 'modules/eatkcal/v2/screens/EkProfileLinks.tsx' },
  PaymentScreen: { kind: 'v2swap', file: 'modules/eatkcal/v2/screens/EkPaymentScreen.tsx' },
  SharedPost: { kind: 'internal', why: 'kesfet açıkken KesfetPostDetail (PostDetailScreen), değilse Legacy*' },
  SharedProfile: { kind: 'finalRoute' },
  AiScan: { kind: 'internal', why: 'ScanScreen yeni_kabuk ile dallanır (G17-S2: FinScanCamera canlı + FinScanAnalyzing/FinPhotoResult/FinScanErrorSheet; eski derlemede FinScanViewfinder yedeği)' },
  AiScanOffline: { kind: 'final', file: 'modules/ai/scan/screens/ScanOfflineScreen.tsx' },
  EatCatalog: { kind: 'finalRoute' },
};

// R3 (yeni kabuk) sekmeleri — yalnız bayrak açıkken çizilir.
const R3_TAB_AUDIT: Record<string, Audit> = {
  Tracker: { kind: 'internal', why: 'TrackerScreen yeni_kabuk dalı (screens/tracker/Fin*/Home*); flagOn/flagOff snapshot testleri' },
  KesfetTab: { kind: 'final', file: 'modules/kesfet/ui/KesfetScreen.tsx' },
  Home: { kind: 'final', file: 'modules/eatkcal/v2/screens/EkHomeScreen.tsx' },
  Profile: { kind: 'internal', why: 'ProfileScreen yeni_kabuk → FinPrProfileScreen' },
  Cart: { kind: 'internal', why: 'gizli sekme; yeni kabukta sepet hapı EkCart açar (TabBarR3.onCartPress), Final koddan Tabs/Cart çağrısı yok' },
  Subscriptions: { kind: 'finalRoute' },
};

const NAV_SRC = fs.readFileSync(path.join(SRC, 'navigation/AppNavigator.tsx'), 'utf8');
const FINAL_SRC = fs.readFileSync(path.join(SRC, 'navigation/finalRoutes.tsx'), 'utf8');
const abs = (r: string) => path.join(SRC, r);

function finalFileOf(name: string): string {
  if (name === 'Checkout') return 'modules/eatkcal/v2/screens/EkCheckoutScreen.tsx';
  const m = new RegExp(`\\b${name}: \\{ flag: '[a-z_]+', final: '([^']+)'`).exec(FINAL_SRC);
  assert.ok(m, `${name}: finalRoutes.tsx FINAL_ROUTES kaydı yok`);
  return m![1];
}

function filesFor(name: string, a: Audit): string[] {
  if (a.kind === 'final' || a.kind === 'v2swap' || a.kind === 'gate') return [a.file];
  if (a.kind === 'finalRoute') return [finalFileOf(name)];
  return [];
}

test("Rota denetimi: AppNavigator'daki her Stack rotası sınıflandırılmış (bayrak açık yol listesi)", () => {
  const routes = [...NAV_SRC.matchAll(/<Stack\.Screen\s+name="([A-Za-z]+)"\s+component=\{([^}]+)\}/g)];
  assert.ok(routes.length >= 40, `rota sayısı beklenenden az: ${routes.length}`);
  const missing = routes.map((m) => m[1]).filter((n) => !ROUTE_AUDIT[n]);
  assert.deepEqual(missing, [], `sınıflandırılmamış rota: ${missing.join(', ')}`);
  for (const [, name, comp] of routes) {
    const a = ROUTE_AUDIT[name];
    if (a.kind === 'finalRoute') {
      const ok = comp.startsWith(`finalScreenFor('${name}'`) || (name === 'Checkout' && comp.startsWith('checkoutScreenFor('));
      assert.ok(ok, `${name}: finalScreenFor ile kayıtlı değil (${comp})`);
    }
    if (a.kind === 'v2swap') assert.ok(comp.startsWith(`v2ScreenFor('${name}'`), `${name}: v2ScreenFor ile kayıtlı değil (${comp})`);
  }
});

test('Rota denetimi: R3 sekmeleri sınıflandırılmış; Subscriptions Final Macro', () => {
  const r3 = NAV_SRC.slice(NAV_SRC.indexOf('function TabNavigatorR3'), NAV_SRC.indexOf('function TabsRoot'));
  const tabs = [...r3.matchAll(/<Tab\.Screen\s+name="([A-Za-z]+)"/g)].map((m) => m[1]);
  assert.ok(tabs.length >= 5);
  assert.deepEqual(tabs.filter((n) => !R3_TAB_AUDIT[n]), []);
  assert.match(r3, /name="Subscriptions"[\s\S]*?component=\{FINAL_ROUTES\.Subscriptions\.component\}/);
});

test('Rota denetimi: bayrak açıkken çizilen Final dosyalarında eski bileşen YOK (rota bazında)', () => {
  const bad: string[] = [];
  for (const [name, a] of [...Object.entries(ROUTE_AUDIT), ...Object.entries(R3_TAB_AUDIT)]) {
    for (const f of filesFor(name, a)) {
      assert.ok(fs.existsSync(abs(f)), `${name}: dosya yok ${f}`);
      for (const v of violations([abs(f)], ALLOW)) bad.push(`${name} → ${v}`);
    }
  }
  assert.deepEqual(bad, []);
});
