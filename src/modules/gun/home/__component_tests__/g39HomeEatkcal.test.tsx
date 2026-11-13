// G39-S1 md.8 — Ana sayfa eatkcal alanı (md.6): tek ürün kartı yok; başlık eatkcal LOGOSU + "İzmir'de <süre>";
// kampanya bannerları (yatay) + restoran/mağaza kartları (en fazla 6 + "Tümü"); kayıtlı adres YOKSA üstte
// "Adresini gir…" kartı + "Adres ekle" (restoranlar yine listelenir); adres kaydedilince alan yenilenir;
// iskelet · "Şu an açık restoran yok" · sessiz hata (alan gizli). İzmir dışı → bekleme listesi aynen.
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets };
});
jest.mock('../../../../lib/products', () => ({ fetchProducts: () => Promise.resolve([]) }));
jest.mock('../../../../lib/banners', () => ({ fetchBannerRows: () => Promise.resolve({ hero: [], promo: [] }) }));
jest.mock('../../../../lib/brands', () => ({ fetchBrand: () => Promise.resolve(null) }));
jest.mock('../../../eatkcal/v2/ui/home/useDeliveryChip', () => ({
  useDeliveryChip: () => {
    const { useAddressStore } = require('../../../../store/addressStore');
    return { address: useAddressStore((s: { selectedAddress: unknown }) => s.selectedAddress), chip: null };
  },
}));

// eslint-disable-next-line import/first
import { ThemeProvider } from '../../../../core/design';
// eslint-disable-next-line import/first
import { HomeEatkcalShowcase, HomeRegionSection, setHomeRegionProvider } from '../HomeRegion';
// eslint-disable-next-line import/first
import { useAddressStore } from '../../../../store/addressStore';
// eslint-disable-next-line import/first
import { HOME_STORE_LIMIT, type StoreItem } from '../../../eatkcal/v2/model/showcase';
// eslint-disable-next-line import/first
import type { BannerCell } from '../../../../lib/banners';

const cell = (id: string): BannerCell => ({ id, row_id: 'r', position: 0, image_url: `https://example.invalid/${id}.jpg`, title: `Kampanya ${id}`, link: null, navigate_to: null, is_active: true });
const store = (i: number): StoreItem => ({
  key: `b${i}`,
  brand: { key: `b${i}`, name: `Restoran ${i}`, tagline: 'Sağlıklı öğünler', description: null, hero_image_url: null, accent_color: null },
  cover: null,
});
const ADDRESS = { id: 'a1', title: 'Ev', district: 'Konak', city: 'İzmir' } as never;

const handlers = () => ({ onOpenStore: jest.fn(), onCampaign: jest.fn(), onSeeAll: jest.fn(), onAddAddress: jest.fn() });

function mount(h = handlers(), scheme: 'light' | 'dark' = 'light') {
  return render(
    <ThemeProvider forceScheme={scheme}>
      <HomeEatkcalShowcase {...h} />
    </ThemeProvider>,
  );
}

let storesCalls = 0;
beforeEach(() => {
  storesCalls = 0;
  setHomeRegionProvider({
    campaigns: async () => [cell('c1'), cell('c2')],
    stores: async () => {
      storesCalls += 1;
      return Array.from({ length: 8 }, (_, i) => store(i + 1));
    },
  });
  useAddressStore.getState().setSelectedAddress(null);
});
afterAll(() => setHomeRegionProvider(null));

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme} · adres VAR: adres kartı yok; logo + "İzmir'de 30–45 dk"; bannerlar + en fazla 6 restoran + "Tümü"`, async () => {
    useAddressStore.getState().setSelectedAddress(ADDRESS);
    const h = handlers();
    const r = mount(h, scheme);
    expect(r.getByTestId('home-ek-skeleton', { includeHiddenElements: true })).toBeTruthy();
    await waitFor(() => expect(r.getByTestId('home-ek-stores')).toBeTruthy());
    expect(r.queryByTestId('home-ek-address-prompt')).toBeNull();
    expect(r.getByTestId('home-ek-logo').props.accessibilityLabel).toBe('eatkcal');
    expect(r.queryByText('eatkcal')).toBeNull(); // başlık yazı değil logo
    expect(r.getByText('İzmir’de 30–45 dk')).toBeTruthy();
    expect(r.getAllByTestId('ek-campaign-card')).toHaveLength(2);
    expect(r.getAllByTestId('ek-store-card')).toHaveLength(HOME_STORE_LIMIT);
    expect(HOME_STORE_LIMIT).toBe(6);
    // Eski tek ürün kartı yok.
    expect(r.queryByText(/kcal\s+\d+ TL|285 TL/)).toBeNull();
    fireEvent.press(r.getByTestId('home-ek-all'));
    expect(h.onSeeAll).toHaveBeenCalled();
    fireEvent.press(r.getAllByTestId('ek-store-card')[0]);
    expect(h.onOpenStore).toHaveBeenCalledWith('b1');
    fireEvent.press(r.getAllByTestId('ek-campaign-card')[1]);
    expect(h.onCampaign).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2' }));
  });
}

test('adres YOK: bannerların ÜSTÜNDE "Adresini gir…" kartı + "Adres ekle"; restoranlar yine listelenir', async () => {
  const h = handlers();
  const r = mount(h);
  await waitFor(() => expect(r.getByTestId('home-ek-stores')).toBeTruthy());
  expect(r.getByText('Adresini gir, sana yakın restoranları gör')).toBeTruthy();
  expect(r.getAllByTestId('ek-store-card').length).toBeGreaterThan(0);
  const btn = r.getByTestId('home-ek-address-add');
  expect(btn.props.accessibilityLabel).toBe('Adres ekle');
  fireEvent.press(btn);
  expect(h.onAddAddress).toHaveBeenCalled();
  // Sıra: adres kartı → kampanyalar → mağazalar.
  const order = r.UNSAFE_root.findAll((n: TNode) => ['home-ek-address-prompt', 'home-ek-campaigns', 'home-ek-stores'].includes(n.props?.testID) && typeof n.type !== 'string').map((n: TNode) => n.props.testID);
  expect([...new Set(order)]).toEqual(['home-ek-address-prompt', 'home-ek-campaigns', 'home-ek-stores']);
});

test('adres kaydedilince alan yenilenir: kart kalkar, liste yeniden okunur', async () => {
  const r = mount();
  await waitFor(() => expect(r.getByTestId('home-ek-address-prompt')).toBeTruthy());
  const before = storesCalls;
  await act(async () => {
    useAddressStore.getState().setSelectedAddress(ADDRESS);
  });
  await waitFor(() => expect(r.queryByTestId('home-ek-address-prompt')).toBeNull());
  expect(storesCalls).toBe(before + 1);
});

test('boş: "Şu an açık restoran yok" (bannerlar varsa durur)', async () => {
  setHomeRegionProvider({ campaigns: async () => [cell('c1')], stores: async () => [] });
  const r = mount();
  await waitFor(() => expect(r.getByTestId('home-ek-empty')).toBeTruthy());
  expect(r.getByText('Şu an açık restoran yok')).toBeTruthy();
  expect(r.getAllByTestId('ek-campaign-card')).toHaveLength(1);
});

test('sessiz hata: restoran verisi alınamazsa alan tamamen gizlenir', async () => {
  setHomeRegionProvider({ campaigns: async () => [cell('c1')], stores: () => Promise.reject(new Error('ağ')) });
  const r = mount();
  await waitFor(() => expect(r.queryByTestId('home-region-izmir')).toBeNull());
});

test('kampanya verisi düşse de restoranlar listelenir (banner satırı gizli)', async () => {
  setHomeRegionProvider({ campaigns: () => Promise.reject(new Error('x')), stores: async () => [store(1)] });
  const r = mount();
  await waitFor(() => expect(r.getByTestId('home-ek-stores')).toBeTruthy());
  expect(r.queryByTestId('home-ek-campaigns')).toBeNull();
});

test('EN: metinler İngilizce, varsayılan süre "30–45 min"', async () => {
  const { I18nProvider } = require('../../../../core/i18n');
  const r = render(
    <I18nProvider forceLang="en">
      <HomeEatkcalShowcase {...handlers()} />
    </I18nProvider>,
  );
  await waitFor(() => expect(r.getByTestId('home-ek-stores')).toBeTruthy());
  expect(r.getByText('30–45 min in İzmir')).toBeTruthy();
  expect(r.getByText('Add your address to see restaurants near you')).toBeTruthy();
  expect(r.getByText('Add address')).toBeTruthy();
  expect(r.getByText('See all')).toBeTruthy();
});

test('bölge: İzmir ve bilinmeyen → vitrin; İzmir dışı → bekleme listesi', async () => {
  const props = { ...handlers(), onWaitlist: jest.fn() };
  const a = render(<HomeRegionSection region="unknown" {...props} />);
  await waitFor(() => expect(a.getByTestId('home-region-izmir')).toBeTruthy());
  const b = render(<HomeRegionSection region="other" {...props} />);
  expect(b.getByTestId('home-region-outside')).toBeTruthy();
  expect(b.queryByTestId('home-region-izmir')).toBeNull();
});

// Test ağacı düğümü (react-test-renderer tipi pakette yok).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TNode = { props: Record<string, any>; type: unknown };
