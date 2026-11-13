// G41-S1 md.4 — "Ana Yemek + Detoks/Shake Paketi" (id 33) / 2 kişilik (id 43) "Ana Öğün Seçimi":
// seçenek ürünse kart ÜRÜNÜN fotoğrafını gösterir (cover); seçeneğin kendi image_url'i köfte
// çıkartması olsa bile kullanılmaz. Protein çıkartması yalnız gramaj grubunda. Light + Dark.
import React from 'react';
import { render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../../core/design/ThemeProvider';
import { I18nProvider } from '../../../../core/i18n';
import { OptionCard, type OptionCardModel } from '../ui/product/OptionCard';
import { groupOptionImageCandidates, isGramajGroupTitle, OPTION_STICKER_BASE } from '../model/optionImage';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
type Scheme = 'light' | 'dark';
const render = (ui: React.ReactElement, scheme: Scheme) =>
  rtlRender(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider forceScheme={scheme}>
        <I18nProvider forceLang="tr">{ui}</I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
const HID = { includeHiddenElements: true } as const;
const imageNode = (r: ReturnType<typeof render>) =>
  r.UNSAFE_root.findAll(
    (n: { props: Record<string, unknown> }) => typeof n.props.contentFit === 'string' && typeof n.props.source === 'object',
  )[0] as { props: Record<string, unknown> } | undefined;

const KOFTE = `${OPTION_STICKER_BASE}protein-izgara-kofte.webp`;
const PHOTO = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/products/ogun-izgara-tavuk.jpg';

const model = (over: Partial<OptionCardModel>): OptionCardModel => ({
  key: 'a',
  name: 'Izgara Tavuk Bowl',
  priceDelta: 0,
  kcal: 520,
  selected: false,
  disabled: false,
  ...over,
});

describe.each(['light', 'dark'] as Scheme[])('%s tema', (scheme) => {
  test('linked_product_id → ürün fotoğrafı (cover); köfte çıkartması gösterilmez', () => {
    const images = groupOptionImageCandidates({
      own: KOFTE,
      linked: PHOTO,
      byName: null,
      gramajGroup: isGramajGroupTitle('Ana Öğün Seçimi'),
    });
    const r = render(<OptionCard model={model({ images })} multi={false} onPress={jest.fn()} />, scheme);
    const img = imageNode(r)!;
    expect((img.props.source as { uri: string }).uri).toContain('/images/products/ogun-izgara-tavuk.jpg');
    expect(img.props.contentFit).toBe('cover');
    expect(JSON.stringify(images)).not.toContain('protein-izgara-kofte');
  });

  test('ad bir ürünle eşleşiyor (bağlı değil) → yine ürün fotoğrafı', () => {
    const images = groupOptionImageCandidates({ own: KOFTE, byName: PHOTO, gramajGroup: false });
    const r = render(<OptionCard model={model({ images })} multi={false} onPress={jest.fn()} />, scheme);
    expect((imageNode(r)!.props.source as { uri: string }).uri).toContain('/images/products/ogun-izgara-tavuk.jpg');
  });

  test('gramaj grubunda ("Et Gramajı") protein çıkartması korunur (contain)', () => {
    const images = groupOptionImageCandidates({ own: KOFTE, gramajGroup: isGramajGroupTitle('Et Gramajı') });
    const r = render(<OptionCard model={model({ name: 'Izgara Köfte 150g', images })} multi={false} onPress={jest.fn()} />, scheme);
    const img = imageNode(r)!;
    expect((img.props.source as { uri: string }).uri).toBe(KOFTE);
    expect(img.props.contentFit).toBe('contain');
  });

  test('gramaj dışı grupta yalnız protein çıkartması varsa → boş hâl (yanlış görsel yerine)', () => {
    const images = groupOptionImageCandidates({ own: KOFTE, gramajGroup: false });
    const r = render(<OptionCard model={model({ images })} multi={false} onPress={jest.fn()} />, scheme);
    expect(r.getByTestId('ek-option-empty-a', HID)).toBeTruthy();
  });
});
