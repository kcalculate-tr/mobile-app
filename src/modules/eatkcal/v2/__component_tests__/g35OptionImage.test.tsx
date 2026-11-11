// G35-S1 md.4 — seçenek kartı görseli: image_url çıkartması contain (kırpılmaz, köşesiz, şeffaf,
// yer tutucusuz, 44–56 pt), bağlı ürün fotoğrafı cover; eksik URL → boş hâl; yüklenemeyen aday
// atlanır (çıkartma → fotoğraf → boş hâl). Light + Dark: kart zemini tema rolünden, seçiliyken lime.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../../core/design/ThemeProvider';
import { themes } from '../../../../core/design/theme';
import { I18nProvider } from '../../../../core/i18n';
import { OptionCard, type OptionCardModel } from '../ui/product/OptionCard';
import { optionImageCandidates } from '../model/optionImage';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
type Scheme = 'light' | 'dark';
const render = (ui: React.ReactElement, scheme: Scheme = 'light') =>
  rtlRender(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider forceScheme={scheme}>
        <I18nProvider forceLang="tr">{ui}</I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
const HID = { includeHiddenElements: true } as const;
const flat = (s: unknown) => StyleSheet.flatten(s as never) as Record<string, unknown>;

const STICKER = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/options/sos-ranch.webp';
const LINKED = 'https://xtjakvinklthlvsfcncu.supabase.co/storage/v1/object/public/images/products/ogun-1.jpg';

const model = (over: Partial<OptionCardModel>): OptionCardModel => ({
  key: 'a',
  name: 'Ranch Sos',
  priceDelta: 0,
  kcal: null,
  selected: false,
  disabled: false,
  ...over,
});

// expo-image test ortamında `contentFit` / `onError` prop'larını taşıyan düğüm.
const imageNode = (r: ReturnType<typeof render>) => {
  const nodes = r.UNSAFE_root.findAll(
    (n: { props: Record<string, unknown> }) => typeof n.props.contentFit === 'string' && typeof n.props.source === 'object',
  );
  return nodes[0] as { props: Record<string, unknown> } | undefined;
};

describe.each(['light', 'dark'] as Scheme[])('%s tema', (scheme) => {
  const c = themes[scheme].color;

  test('image_url çıkartması: contain, köşesiz, şeffaf zemin, yer tutucu yok, 54 pt; kart zemini tema yüzeyi', () => {
    const r = render(
      <OptionCard model={model({ images: optionImageCandidates({ own: STICKER, linked: LINKED }) })} multi={false} onPress={jest.fn()} />,
      scheme,
    );
    expect(r.getByTestId('ek-option-img-a', HID)).toBeTruthy();
    expect(r.queryByTestId('ek-option-empty-a', HID)).toBeNull();
    const img = imageNode(r)!;
    expect(img.props.contentFit).toBe('contain');
    expect((img.props.source as { uri: string }).uri).toBe(STICKER); // dönüştürülmez (kırpma yok)
    expect(img.props.placeholder).toBeUndefined();
    const st = flat(img.props.style);
    expect(st.width).toBe(54);
    expect(st.height).toBe(54);
    expect(Number(st.width)).toBeGreaterThanOrEqual(44);
    expect(Number(st.width)).toBeLessThanOrEqual(56);
    expect(st.borderRadius).toBeUndefined();
    expect(st.backgroundColor).toBe('transparent');
    expect(flat(r.getByTestId('ek-option-a').props.style).backgroundColor).toBe(c.surface);
  });

  test('seçiliyken çıkartma lime kart zeminine oturur (görsel zemin boyamaz)', () => {
    const r = render(
      <OptionCard model={model({ selected: true, images: optionImageCandidates({ own: STICKER }) })} multi={false} onPress={jest.fn()} />,
      scheme,
    );
    expect(flat(r.getByTestId('ek-option-a').props.style).backgroundColor).toBe(c.accent);
    expect(flat(imageNode(r)!.props.style).backgroundColor).toBe('transparent');
  });

  test('image_url yok → bağlı ürün fotoğrafı (cover, 12 köşe)', () => {
    const r = render(
      <OptionCard model={model({ images: optionImageCandidates({ own: null, linked: LINKED }) })} multi={false} onPress={jest.fn()} />,
      scheme,
    );
    const img = imageNode(r)!;
    expect(img.props.contentFit).toBe('cover');
    expect((img.props.source as { uri: string }).uri).toContain('/storage/v1/render/image/public/images/products/ogun-1.jpg');
    expect(flat(img.props.style).borderRadius).toBe(12);
  });

  test('eksik URL (boş / göreli) → boş hâl: yer tutucu çıkartma çerçevesi + ad, görsel yok', () => {
    const r = render(
      <OptionCard model={model({ images: optionImageCandidates({ own: '  ', linked: 'products/x.jpg' }) })} multi={false} onPress={jest.fn()} />,
      scheme,
    );
    expect(imageNode(r)).toBeUndefined();
    const empty = r.getByTestId('ek-option-empty-a', HID);
    expect(flat(empty.props.style).backgroundColor).toBe(scheme === 'dark' ? c.surfaceRaised : c.line);
    expect(r.getByText('Ranch', HID)).toBeTruthy();
  });
});

test('yüklenemeyen çıkartma atlanır → bağlı ürün fotoğrafı → o da yüklenemezse boş hâl', () => {
  const r = render(
    <OptionCard model={model({ images: optionImageCandidates({ own: STICKER, linked: LINKED }) })} multi={false} onPress={jest.fn()} />,
  );
  expect(imageNode(r)!.props.contentFit).toBe('contain');
  act(() => (imageNode(r)!.props.onError as () => void)());
  expect(imageNode(r)!.props.contentFit).toBe('cover');
  act(() => (imageNode(r)!.props.onError as () => void)());
  expect(imageNode(r)).toBeUndefined();
  expect(r.getByTestId('ek-option-empty-a', HID)).toBeTruthy();
});

test('eski yol: yalnız imageUrl (ada göre fotoğraf) verilirse fotoğraf gösterilir; görsel VoiceOver\'da gizli, kart etiketi ad', () => {
  const onPress = jest.fn();
  const r = render(<OptionCard model={model({ imageUrl: LINKED })} multi={false} onPress={onPress} />);
  expect(imageNode(r)!.props.contentFit).toBe('cover');
  expect(r.getByTestId('ek-option-img-a', HID).props.accessibilityElementsHidden).toBe(true);
  const card = r.getByTestId('ek-option-a');
  expect(card.props.accessibilityLabel).toBe('Ranch Sos');
  fireEvent.press(card);
  expect(onPress).toHaveBeenCalledTimes(1);
});
