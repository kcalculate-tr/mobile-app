// G58-S2 md.5 — kcal://teklif/izmir (ve l.eatkcal.com/teklif/izmir) → SubPaywall Fresh yıllık + İzmir
// teklifi; bölge/abonelik/"bir kez gösterildi" kaydı atlanır; satın almada teklif kaydı yalnız Fresh yıllıkta.
import fs from 'node:fs';
import path from 'node:path';
import { getStateFromPath } from '@react-navigation/native';

jest.mock('expo-linking', () => ({ createURL: () => 'kcal://' }));
import { linking } from '../linking';
import { OFFER_LINK_FROM, normalizePaywallParams, offerForPurchase, offerFromSlug } from '../offerLinks';

const route = (p: string) => {
  const st = getStateFromPath(p, linking.config as never) as { routes: Array<{ name: string; params?: Record<string, unknown> }> } | undefined;
  return st?.routes[st.routes.length - 1];
};

test('teklif/izmir → SubPaywall { offer: izmir_fresh } → Fresh yıllık seçili', () => {
  const r = route('teklif/izmir');
  expect(r?.name).toBe('SubPaywall');
  expect(r?.params).toEqual({ offer: 'izmir_fresh' });
  expect(normalizePaywallParams(r?.params as never)).toEqual({ offer: 'izmir_fresh', plan: 'fresh', yearly: true, from: OFFER_LINK_FROM });
});

test('uygulama içi tetikleyici (plan/dönem verilmiş) bozulmaz; teklifsiz paywall aynen', () => {
  expect(normalizePaywallParams({ plan: 'fresh', yearly: true, from: 'izmir_offer', offer: 'izmir_fresh' })).toEqual({ plan: 'fresh', yearly: true, from: 'izmir_offer', offer: 'izmir_fresh' });
  expect(normalizePaywallParams({ plan: 'balance', coach: true })).toEqual({ plan: 'balance', coach: true });
  expect(normalizePaywallParams(undefined)).toEqual({});
});

test('bilinmeyen teklif adı → teklif yok', () => {
  expect(offerFromSlug('izmir')).toBe('izmir_fresh');
  expect(offerFromSlug('IZMIR')).toBe('izmir_fresh');
  expect(offerFromSlug('ankara')).toBeUndefined();
  expect(route('teklif/ankara')?.params?.offer).toBeUndefined();
});

test('teklif kaydı yalnız İzmir + Fresh yıllık satın alımda', () => {
  expect(offerForPurchase('izmir_fresh', 'fresh_yearly')).toBe('izmir_fresh');
  expect(offerForPurchase('izmir_fresh', 'fresh_monthly')).toBeNull();
  expect(offerForPurchase('izmir_fresh', 'balance_yearly')).toBeNull();
  expect(offerForPurchase(undefined, 'fresh_yearly')).toBeNull();
});

test('bağlantı görülme kaydına ve bölge/abonelik koşuluna DOKUNMAZ; paywall satın almadan önce teklifi kaydeder', () => {
  const root = path.resolve(__dirname, '../../..');
  const code = (f: string) => fs.readFileSync(path.join(root, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const links = code('src/navigation/offerLinks.ts') + code('src/navigation/linking.ts');
  expect(links).not.toMatch(/IZMIR_OFFER_SEEN_KEY|shouldShowIzmirOffer|AsyncStorage/);
  const pw = fs.readFileSync(path.join(root, 'src/modules/subscription/screens/PaywallScreen.tsx'), 'utf8');
  const buy = pw.slice(pw.indexOf('const buy = async'), pw.indexOf('const restore = async'));
  expect(buy.indexOf('recordSubscriptionOffer(offer)')).toBeGreaterThan(-1);
  expect(buy.indexOf('setPurchaseOffer(offer)')).toBeLessThan(buy.indexOf('await purchasePlan('));
  expect(pw).toMatch(/normalizePaywallParams\(/);
});
