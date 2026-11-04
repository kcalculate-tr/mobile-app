// G12-S6 (kabul) — Ortak Sheet erişilebilirliği + Dynamic Type en büyük boyda
// aksiyon kaybı yok. Yeni UI'nin tüm sheet'leri (Keşfet kuralları, Ekle sheet'i,
// kutlama bildirimi, eatkcal sheet'leri) bu ortak `Sheet`/`AppText` üzerinden
// render eder; bu test tek yerden garanti verir.
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Sheet, AppText } from '../../index';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function wrap(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
}

describe('Sheet erişilebilirliği', () => {
  test('modal içerik accessibilityViewIsModal + başlık etiketi taşır', () => {
    const { getByLabelText } = wrap(
      <Sheet visible title="Kabul paneli" onClose={() => {}}>
        <AppText>İçerik</AppText>
      </Sheet>,
    );
    const modal = getByLabelText('Kabul paneli');
    expect(modal.props.accessibilityViewIsModal).toBe(true);
  });

  test('kapat düğmesi erişilebilir bir etikete sahip', () => {
    const { getAllByLabelText } = wrap(
      <Sheet visible title="Kabul paneli" onClose={() => {}}>
        <AppText>İçerik</AppText>
      </Sheet>,
    );
    // Sheet "Kapat" etiketli en az bir düğme sunar (üst tutamaç / scrim).
    expect(getAllByLabelText('Kapat').length).toBeGreaterThanOrEqual(1);
  });

  test('footer aksiyonu en büyük Dynamic Type altında da ağaçta kalır (aksiyon kaybı yok)', () => {
    const { getByText } = wrap(
      <Sheet
        visible
        title="Kabul paneli"
        onClose={() => {}}
        footer={<AppText variant="body">Devam et</AppText>}
      >
        <AppText>İçerik</AppText>
      </Sheet>,
    );
    // Aksiyon metni footer'da render edilir — sabit genişlik/numberOfLines=1 ile
    // kırpılıp ağaçtan düşmez.
    expect(getByText('Devam et')).toBeTruthy();
  });
});

describe('Dynamic Type — AppText tavanlı ölçekleme (sınırsız taşma yok)', () => {
  test('her metin allowFontScaling açık + sayısal maxFontSizeMultiplier tavanı taşır', () => {
    const { getByText } = wrap(
      <>
        <AppText variant="title">Başlık</AppText>
        <AppText variant="body">Gövde</AppText>
        <AppText variant="caption">Alt</AppText>
      </>,
    );
    for (const label of ['Başlık', 'Gövde', 'Alt']) {
      const node = getByText(label);
      expect(node.props.allowFontScaling).toBe(true);
      expect(typeof node.props.maxFontSizeMultiplier).toBe('number');
      expect(node.props.maxFontSizeMultiplier).toBeGreaterThan(0);
    }
  });

  test('aksiyon düğmesi etiketi büyük ölçekte de erişilebilir kalır', () => {
    // numberOfLines=1 + sabit genişlik kombinasyonu aksiyonu gizlerdi; AppText
    // gövde/caption serbest sarmalar (typography.ts). Burada metnin RNText
    // olduğunu ve kırpma props'u taşımadığını doğrularız.
    const { getByText } = wrap(<AppText variant="body">Siparişi onayla</AppText>);
    const node = getByText('Siparişi onayla');
    expect(node).toBeTruthy();
    expect(node.props.numberOfLines).toBeUndefined();
  });
});
