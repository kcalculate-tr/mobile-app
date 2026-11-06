// eatkcal v2 (G15-S5 md.5) — eski tasarım envanteri rota değişimleri: bayrak KAPALI
// iken bugünkü (1.0.7) bileşenler AYNEN kaydolur; açıkken v2 görünüm.
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), 'utf8');

const SWAPPED: Record<string, string> = {
  Addresses: 'AddressesLazy',
  OrderSuccess: 'OrderSuccessLazy',
  ProfileOrders: 'OrdersLazy',
  ProfileSavedCards: 'SavedCardsLazy',
  ProfileAddCard: 'AddCardLazy',
  ProfileSupport: 'SupportLazy',
  ProfileContracts: 'ContractsLazy',
  PaymentScreen: 'PaymentLazy',
};

test('AppNavigator: her değişim yalnız yeniSiparis ile ve bugünkü bileşen yedekte', () => {
  const nav = read('../../../../navigation/AppNavigator.tsx');
  for (const [route, legacy] of Object.entries(SWAPPED)) {
    const re = new RegExp(`name="${route}" component=\\{v2ScreenFor\\('${route}', yeniSiparis, ${legacy}\\)\\}`);
    assert.match(nav, re, route);
  }
  const calls = nav.match(/v2ScreenFor\(/g) ?? [];
  // import satırında `v2ScreenFor }` geçer (parantezsiz) → çağrı sayısı = değişim sayısı.
  assert.equal(calls.length, Object.keys(SWAPPED).length);
});

test('routes.v2ScreenFor: kapalı → verilen bugünkü bileşen; tablo yalnız bu adlar', () => {
  const src = read('../routes.tsx');
  assert.match(src, /return enabled \? \(LEGACY_SWAP\[name\] as unknown as React\.ComponentType<P>\) : legacy;/);
  const block = src.slice(src.indexOf('const LEGACY_SWAP = {'), src.indexOf('} as const;', src.indexOf('const LEGACY_SWAP = {')));
  const keys = [...block.matchAll(/^\s{2}([A-Za-z]+): withSuspense/gm)].map((m) => m[1]).sort();
  assert.deepEqual(keys, Object.keys(SWAPPED).sort());
});

test('sekme çubuğu sepet hapı: EkCart yalnız kökte kayıtlıysa (yeni_siparis açık), yoksa bugünkü Cart', () => {
  const bar = read('../../../shell/TabBarR3.tsx');
  assert.match(bar, /routeNames\?\.includes\('EkCart'\)/);
  assert.match(bar, /navigation\.navigate\('Cart' as never\);/);
});

test('ödeme / kart doğrulama v2 kopyaları kaynakla aynı mantık bloklarını içerir', () => {
  // Mantık bloğu: ilk bileşen tanımından görünümün başına kadar. v2'de yalnız tema
  // kancası satırı ve bileşen adı farklı olabilir; gerisi BAYT BAYT aynı olmalı.
  const norm = (s: string, from: string, to: RegExp) => {
    const a = s.indexOf(from);
    const rest = s.slice(a);
    const b = rest.search(to);
    return rest
      .slice(0, b)
      .replace(/^\s*const \{ c, t, theme(, insets)? \} = useEk\(\);\n/m, '')
      .replace(/export default function \w+\(\)/, 'export default function X()')
      .replace(/\s+$/, '');
  };
  const payEnd = /\n {2}(const onInk|return \(\n {4}<View style=\{\[hostedStyles\.container)/;
  assert.equal(
    norm(read('../screens/EkPaymentScreen.tsx'), 'export default function', payEnd),
    norm(read('../../screens/PaymentScreen.tsx'), 'export default function', payEnd),
  );
  const cardEnd = /\n {2}(const onInk|return \(\n {4}<ScreenContainer)/;
  assert.equal(
    norm(read('../screens/EkAddCardScreen.tsx'), 'export default function', cardEnd),
    norm(read('../../../../screens/profile/AddCardScreen.tsx'), 'export default function', cardEnd),
  );
});
