import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CheckoutFooter from '../CheckoutFooter';

// Sipariş akışının son ekranı. Buradaki bir hata doğrudan "sipariş
// verilemiyor" demek; 18-23 Eylül arasında tam olarak bu bileşende üç ayrı
// canlı hata yaşandı. Testler o üçünün geri gelmediğini doğruluyor.

const temel = {
  label: 'Siparişi Ver',
  onPress: () => {},
  bottomInset: 0,
};

test('etiket ve tutar AYRI düğümler — araya nokta/ayraç girmiyor', () => {
  // "Siparişi Ver • 405 TL" amatör duruyordu; tutar ayrı prop olarak veriliyor.
  const { getByText, queryByText } = render(
    <CheckoutFooter {...temel} priceText="405,00 TL" />,
  );
  expect(getByText('Siparişi Ver')).toBeTruthy();
  expect(getByText('405,00 TL')).toBeTruthy();
  expect(queryByText(/•/)).toBeNull();
});

test('minimum sepetin altında kalan tutarı söyler ve Ürün Ekle kısayolunu gösterir', () => {
  const { getByText } = render(
    <CheckoutFooter
      {...temel}
      showProgress
      cartTotal={220}
      minOrderAmount={300}
      freeDeliveryThreshold={500}
      onAddProducts={() => {}}
    />,
  );
  expect(getByText(/Minimum sipariş tutarına/)).toBeTruthy();
  expect(getByText('80 TL')).toBeTruthy();
  expect(getByText('Ürün Ekle')).toBeTruthy();
});

test('minimum aşıldıysa mesaj ücretsiz teslimat eşiğine döner', () => {
  const { getByText, queryByText } = render(
    <CheckoutFooter
      {...temel}
      showProgress
      cartTotal={350}
      minOrderAmount={300}
      freeDeliveryThreshold={500}
    />,
  );
  expect(getByText(/Ücretsiz teslimata/)).toBeTruthy();
  expect(getByText('150 TL')).toBeTruthy();
  expect(queryByText(/Minimum sipariş/)).toBeNull();
});

test('eşik aşıldığında "kazandınız" der ve Ürün Ekle kısayolu kaybolur', () => {
  const { getByText, queryByText } = render(
    <CheckoutFooter
      {...temel}
      showProgress
      cartTotal={500}
      minOrderAmount={300}
      freeDeliveryThreshold={500}
      onAddProducts={() => {}}
    />,
  );
  expect(getByText('kazandınız', { exact: false })).toBeTruthy();
  expect(queryByText('Ürün Ekle')).toBeNull();
});

test('Gel-Al → Eve Teslim geçişinde şerit yeniden görünürken hedefe ATLAR', () => {
  // 22.09.2026 canlı hatası: şerit gizliyken (Gel-Al) Animated.Value'ya bağlı
  // son görünüm söküldüğü için RN animasyonu durduruyordu; Eve Teslim'e
  // dönünce "Ücretsiz teslimat kazandınız" yazıyor ama bar %54'te takılı
  // kalıyordu. Çözüm: gizliyken ve YENİDEN görünür olurken setValue ile
  // doğrudan yazmak, animasyonu yalnız şerit zaten ekrandayken çalıştırmak.
  const { rerender, getByText, queryByText } = render(
    <CheckoutFooter {...temel} showProgress={false} cartTotal={600} freeDeliveryThreshold={500} />,
  );
  expect(queryByText('kazandınız', { exact: false })).toBeNull();

  rerender(
    <CheckoutFooter {...temel} showProgress cartTotal={600} freeDeliveryThreshold={500} />,
  );
  expect(getByText('kazandınız', { exact: false })).toBeTruthy();
});

test('eşik tanımlı değilse ilerleme şeridi kazanılmış sayılır, çökmez', () => {
  const { getByText } = render(
    <CheckoutFooter {...temel} showProgress cartTotal={0} minOrderAmount={0} freeDeliveryThreshold={0} />,
  );
  expect(getByText('kazandınız', { exact: false })).toBeTruthy();
});

test('sözleşme kutusu onaysızken tıklanınca toggle çağrılır', () => {
  const tiklamalar: number[] = [];
  const { getByText } = render(
    <CheckoutFooter
      {...temel}
      showContracts
      contractsAccepted={false}
      onToggleContracts={() => tiklamalar.push(1)}
    />,
  );
  fireEvent.press(getByText(/okudum ve onaylıyorum/));
  expect(tiklamalar.length).toBe(1);
});

test('buton disabled iken onPress ÇAĞRILMAZ', () => {
  const tiklamalar: number[] = [];
  const { getByText } = render(
    <CheckoutFooter {...temel} disabled onPress={() => tiklamalar.push(1)} />,
  );
  fireEvent.press(getByText('Siparişi Ver'));
  expect(tiklamalar.length).toBe(0);
});

test('buton etkinken onPress bir kez çağrılır', () => {
  const tiklamalar: number[] = [];
  const { getByText } = render(
    <CheckoutFooter {...temel} onPress={() => tiklamalar.push(1)} />,
  );
  fireEvent.press(getByText('Siparişi Ver'));
  expect(tiklamalar.length).toBe(1);
});
