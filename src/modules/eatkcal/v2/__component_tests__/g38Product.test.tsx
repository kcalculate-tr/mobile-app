// G38-S1 md.6 — bileşen testleri:
//   md.1 seçenek kartı: ad en fazla 2 satır, ad alanı sabit yükseklik → kısa/uzun adlı kartlar eşit;
//        Dynamic Type 1,4 üst sınır.
//   md.4 sayı hapı (rozet) + "Sepete ekle" düğmesinde ayrı kalın fiyat; hiçbir metinde parantez yok.
//   md.5 kcalculate gramaj grubu (products.gramaj_options) kartları görselli: ürün adından protein
//        çıkartması → yüklenemezse ürün fotoğrafı.
import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { act, fireEvent, render as rtlRender, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../../core/design/ThemeProvider';
import { I18nProvider } from '../../../../core/i18n';
import { CountPill, formatCount } from '../../../../core/design/components/CountPill';
import {
  OptionCard,
  OPTION_NAME_LINES,
  OPTION_NAME_MAX_SCALE,
  optionNameBlockHeight,
  type OptionCardModel,
} from '../ui/product/OptionCard';
import { OptionGroupSection } from '../ui/product/OptionGroupSection';
import { ProductBottomBar } from '../ui/product/ProductBottomBar';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ThemeProvider forceScheme={scheme}>
      <I18nProvider forceLang="tr">{ui}</I18nProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);
const render = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') => rtlRender(wrap(ui, scheme));
const HID = { includeHiddenElements: true } as const;
const flat = (s: unknown) => StyleSheet.flatten(s as never) as Record<string, unknown>;

const model = (over: Partial<OptionCardModel>): OptionCardModel => ({
  key: 'a',
  name: 'Ranch Sos',
  priceDelta: 0,
  kcal: null,
  selected: false,
  disabled: false,
  ...over,
});

// ── md.1 ─────────────────────────────────────────────────────────────────────────
describe('md.1 seçenek kartı 2 satır', () => {
  test('ad: numberOfLines 2, sonda üç nokta, Dynamic Type üst sınırı 1,4', () => {
    const r = render(<OptionCard model={model({ name: 'Turuncu Metabolizma' })} multi={false} onPress={jest.fn()} />);
    const name = r.getByTestId('ek-option-name-a');
    expect(OPTION_NAME_LINES).toBe(2);
    expect(name.props.numberOfLines).toBe(2);
    expect(name.props.ellipsizeMode).toBe('tail');
    expect(name.props.maxFontSizeMultiplier).toBe(OPTION_NAME_MAX_SCALE);
    expect(name.props.children).toBe('Turuncu Metabolizma');
  });

  test('ad alanı sabit 2 satır yüksekliği: kısa ve uzun ad aynı kutu → aynı sıradaki kartlar eşit, zıplama yok', () => {
    const r = render(
      <OptionGroupSection
        group={{
          key: 'g',
          title: 'Detoks Seçimi',
          required: true,
          max: 1,
          multi: false,
          items: [
            model({ key: 'kisa', name: 'Tropikal Yağ Yakıcı' }),
            model({ key: 'uzun', name: 'Salatalıklı Ferahlatıcı' }),
            model({ key: 'tek', name: 'Roka' }),
          ],
        }}
        highlight={false}
        onToggle={jest.fn()}
      />,
    );
    const h = ['kisa', 'uzun', 'tek'].map((k) => flat(r.getByTestId(`ek-option-name-box-${k}`).props.style).height);
    // 2 × 19 pt × yazı ölçeği (1–1,4 arası); jest RN taklidinde fontScale 2 → 1,4 sınırı → 54.
    expect(h[0]).toBe(optionNameBlockHeight(Dimensions.get('window').fontScale));
    expect(h[0]).toBeGreaterThanOrEqual(38);
    expect(new Set(h).size).toBe(1);
    // Kartın kendisi: aynı genişlik ve aynı asgari yükseklik.
    const cards = ['kisa', 'uzun', 'tek'].map((k) => flat(r.getByTestId(`ek-option-${k}`).props.style));
    for (const c of cards) {
      expect(c.width).toBe(136);
      expect(c.minHeight).toBe(166);
    }
  });

  test('optionNameBlockHeight: yazı büyütülünce alan büyür (kırpılma yok), 1,4 üstünde sabit', () => {
    expect(optionNameBlockHeight(1)).toBe(38);
    expect(optionNameBlockHeight(1.2)).toBe(Math.ceil(38 * 1.2));
    expect(optionNameBlockHeight(1.4)).toBe(Math.ceil(38 * 1.4));
    expect(optionNameBlockHeight(3)).toBe(optionNameBlockHeight(1.4));
    expect(optionNameBlockHeight(0.8)).toBe(38);
    expect(optionNameBlockHeight(NaN)).toBe(38);
  });

  test('VoiceOver etiketi tam ad + fiyat farkı + kcal (kısaltma görsel, anlam kaybı yok)', () => {
    const r = render(
      <OptionCard model={model({ name: 'Protein Tavuk Fileto', priceDelta: 40, kcal: 520 })} multi={false} onPress={jest.fn()} />,
    );
    const lbl = r.getByTestId('ek-option-a').props.accessibilityLabel as string;
    expect(lbl).toContain('Protein Tavuk Fileto');
    expect(lbl).toContain('520');
  });
});

// ── md.4 ─────────────────────────────────────────────────────────────────────────
describe('md.4 rozet + ayrı fiyat', () => {
  test('CountPill: sayı, 99+ sınırı, VoiceOver\'dan gizli, ≥ 22 pt, tema renkleri', () => {
    const r = render(<CountPill count={3} bg="#0A0A0A" fg="#C6F04F" testID="pill" />);
    const pill = r.getByTestId('pill', HID);
    expect(pill.props.accessibilityElementsHidden).toBe(true);
    expect(pill.props.importantForAccessibility).toBe('no-hide-descendants');
    const st = flat(pill.props.style);
    expect(st.backgroundColor).toBe('#0A0A0A');
    expect(st.minHeight).toBe(22);
    expect(r.getByText('3', HID)).toBeTruthy();
    expect(formatCount(150)).toBe('99+');
    expect(formatCount(-2)).toBe('0');
    expect(formatCount(1000, 999)).toBe('999+');
  });

  test.each(['light', 'dark'] as const)('%s: "Sepete ekle" + boşluk + ayrı kalın fiyat; parantez/nokta yok; sesli etiket virgüllü', (scheme) => {
    const r = render(
      <ProductBottomBar
        quantity={1}
        onQuantity={jest.fn()}
        price={285}
        ready
        missing={false}
        open
        added={false}
        infoAmount="150 g"
        infoName="Izgara Tavuk Bonfile"
        macros={{ kcal: 540, protein: 42, carbs: 48, fats: 18 }}
        onAdd={jest.fn()}
        onGoCart={jest.fn()}
      />,
      scheme,
    );
    const label = r.getByTestId('ek-product-add-label');
    const price = r.getByTestId('ek-product-add-price');
    expect(label.props.children).toBe('Sepete ekle');
    expect(price.props.children).toBe('285 TL');
    // Ayrı kalın fiyat: etiketten daha ağır aile.
    expect(String(flat(price.props.style).fontFamily)).toMatch(/ExtraBold/);
    expect(String(flat(label.props.style).fontFamily)).not.toMatch(/ExtraBold/);
    // Aynı düğme içinde, araya boşluk (gap), nokta ayracı yok.
    const btn = r.getByTestId('ek-product-add');
    expect(flat(btn.props.style).gap).toBe(10);
    expect(btn.props.accessibilityLabel).toBe('Sepete ekle, 285 TL');
    const texts = r.UNSAFE_root.findAll((n: { type: unknown; props: { children?: unknown } }) => typeof n.props.children === 'string')
      .map((n: { props: { children?: unknown } }) => String(n.props.children));
    for (const t of texts) {
      expect(t).not.toMatch(/[()]/);
      expect(t).not.toMatch(/·/);
    }
  });
});

// ── md.5: EkProductScreen gramaj görseli ───────────────────────────────────────────
const PRODUCT_IMG = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/products/6.jpg';
const STICKER = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/protein-tavuk-bonfile.webp';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({ params: { productId: '6' } }),
}));
jest.mock('../nav', () => ({ useEkNav: () => ({ navigate: jest.fn(), goBack: jest.fn() }) }));
jest.mock('../../../../core/supabase', () => {
  const row = {
    id: 6,
    name: 'Basmati Üzeri Tavuk Fileto ve Brokoli',
    price: 365,
    calories: 520,
    img: 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/products/6.jpg',
    brand: 'kcalculate',
    is_available: true,
    gramaj_options: [
      { name: '200g', is_default: true, display_order: 0, price_modifier: 0, calorie_modifier: 0 },
      { name: '300g', is_default: false, display_order: 1, price_modifier: 110, calorie_modifier: 110 },
      { name: '350g', is_default: false, display_order: 2, price_modifier: 160, calorie_modifier: 165 },
    ],
  };
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }) };
  const client = { rpc: jest.fn(), from: () => q, auth: { getSession: () => Promise.resolve({ data: { session: null } }) } };
  return { supabase: client, getSupabaseClient: () => client };
});
jest.mock('../../../../lib/products', () => ({
  ...jest.requireActual('../../../../lib/products'),
  fetchProductOptionGroups: jest.fn(async () => []),
  fetchProductImagesByName: jest.fn(async () => ({})),
}));
jest.mock('../../../../lib/productOptions', () => ({ fetchProductOptionLinks: jest.fn(async () => []) }));
jest.mock('../../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../../lib/restaurantRating', () => ({ fetchRestaurantRating: jest.fn(async () => null) }));

const imageIn = (node: { findAll: (p: (n: { props: Record<string, unknown> }) => boolean) => { props: Record<string, unknown> }[] }) =>
  node.findAll((n) => typeof n.props.contentFit === 'string' && typeof n.props.source === 'object')[0];

describe('md.5 gramaj kartları görselli', () => {
  test('kcalculate gramaj (200/300/350 g): her kartta protein çıkartması (contain); yüklenemezse ürün fotoğrafı', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const EkProductScreen = require('../screens/EkProductScreen').default;
    const r = rtlRender(<SafeAreaProvider initialMetrics={METRICS}><EkProductScreen /></SafeAreaProvider>);
    await waitFor(() => expect(r.getByTestId('ek-group-gramaj')).toBeTruthy());
    for (const k of ['0', '1', '2']) {
      expect(r.getByTestId(`ek-option-img-${k}`, HID)).toBeTruthy();
      expect(r.queryByTestId(`ek-option-empty-${k}`, HID)).toBeNull();
    }
    const img0 = imageIn(r.getByTestId('ek-option-img-0', HID) as never);
    expect((img0.props.source as { uri: string }).uri).toBe(STICKER);
    expect(img0.props.contentFit).toBe('contain');
    // Çıkartma Storage'da yoksa → ürün fotoğrafı (cover).
    await act(async () => {
      (img0.props.onError as () => void)();
    });
    const img0b = imageIn(r.getByTestId('ek-option-img-0', HID) as never);
    expect((img0b.props.source as { uri: string }).uri).toContain('/images/products/6.jpg');
    expect(img0b.props.contentFit).toBe('cover');
    // Gramaj adı 2 satır kutusunda, seçim çalışıyor.
    expect(r.getByTestId('ek-option-name-1').props.children).toBe('300g');
    fireEvent.press(r.getByTestId('ek-option-1'));
    expect(r.getByTestId('ek-option-1').props.accessibilityState.checked).toBe(true);
  });
});

void PRODUCT_IMG;
