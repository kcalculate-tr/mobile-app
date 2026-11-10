// G22-S2 md.4 — Keşfet arama ekranı durumları: son aramalar (sil / temizle),
// yükleniyor, sonuçlar (Gönderi · Kişi · Tarif), sonuç yok ("Şurada da ara"),
// hata + Tekrar dene, dokunuş → açık profil / gönderi.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SearchScreen } from '../SearchScreen';
import { resetSearchClient, setSearchClient } from '../../search/client';
import { createMockSearchClient } from '../../search/mock';
import { RECENT_SEARCH_KEY } from '../../search/recentStorage';
import { SEARCH_DEBOUNCE_MS } from '../../search/logic';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderScreen() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  const utils = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SearchScreen navigation={navigation} />
    </SafeAreaProvider>,
  );
  return { ...utils, navigation };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function typeAndWait(input: Parameters<typeof fireEvent.changeText>[0], text: string) {
  fireEvent.changeText(input, text);
  await act(async () => {
    jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 10);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  setSearchClient(createMockSearchClient());
});
afterEach(() => resetSearchClient());

test('son aramalar: depodan yüklenir, tek tek silinir, Temizle → boş durum', async () => {
  await AsyncStorage.setItem(
    RECENT_SEARCH_KEY,
    JSON.stringify([{ q: 'somon', kind: 'query' }, { q: '@diyetisyen', kind: 'person' }]),
  );
  const { getByText, queryByText, getByLabelText } = renderScreen();
  await flush();
  expect(getByText('Son aramalar')).toBeTruthy();
  expect(getByText('somon')).toBeTruthy();
  expect(getByText('@diyetisyen')).toBeTruthy();

  fireEvent.press(getByLabelText('“somon” aramasını sil'));
  expect(queryByText('somon')).toBeNull();
  await flush();
  expect(JSON.parse((await AsyncStorage.getItem(RECENT_SEARCH_KEY)) ?? '[]')).toEqual([{ q: '@diyetisyen', kind: 'person' }]);

  fireEvent.press(getByText('Temizle'));
  expect(getByText('Son araman yok.')).toBeTruthy();
  expect(queryByText('Temizle')).toBeNull();
});

test('yazınca yükleniyor → Gönderi sonuçları; gönderiye dokun → SharedPost + son aramaya eklenir', async () => {
  const { getByTestId, queryByTestId, getByText, getByLabelText, navigation } = renderScreen();
  await flush();
  fireEvent.changeText(getByTestId('kesfet-search-input'), 'protein');
  expect(getByTestId('kesfet-search-loading')).toBeTruthy();
  await typeAndWait(getByTestId('kesfet-search-input'), 'protein');
  expect(queryByTestId('kesfet-search-loading')).toBeNull();
  expect(getByText('“protein” için sonuçlar')).toBeTruthy();
  fireEvent.press(getByLabelText('Izgara tavuk ve kinoa kasesi, PT Can Demir'));
  expect(navigation.navigate).toHaveBeenCalledWith('SharedPost', { postId: 'post-1' });
  await flush();
  expect(JSON.parse((await AsyncStorage.getItem(RECENT_SEARCH_KEY)) ?? '[]')).toEqual([{ q: 'protein', kind: 'query' }]);
});

test('Kişi sekmesi: kişiye dokun → PublicProfile; takip düğmesi; sekme a11y sayısı', async () => {
  const { getByTestId, getByText, getByLabelText, navigation } = renderScreen();
  await flush();
  await typeAndWait(getByTestId('kesfet-search-input'), 'elif');
  fireEvent.press(getByTestId('kesfet-search-scope-people'));
  expect(getByLabelText('Kişi, 1 sonuç')).toBeTruthy();
  expect(getByText('@dyt.elif')).toBeTruthy();
  expect(getByText('Diyetisyen')).toBeTruthy();
  expect(getByLabelText('Takip et, Dyt. Elif Yılmaz')).toBeTruthy();
  fireEvent.press(getByText('Dyt. Elif Yılmaz'));
  expect(navigation.navigate).toHaveBeenCalledWith('PublicProfile', { handle: 'dyt.elif' });
  await flush();
  expect(JSON.parse((await AsyncStorage.getItem(RECENT_SEARCH_KEY)) ?? '[]')).toEqual([{ q: '@dyt.elif', kind: 'person' }]);
});

test('sonuç yok: başlık + "Şurada da ara" düğmeleri kapsamı değiştirir', async () => {
  const { getByTestId, getByText } = renderScreen();
  await flush();
  fireEvent.press(getByTestId('kesfet-search-scope-recipes'));
  await typeAndWait(getByTestId('kesfet-search-input'), 'zeytinyağlı enginar');
  expect(getByText('“zeytinyağlı enginar” için sonuç yok')).toBeTruthy();
  expect(getByText('Şurada da ara')).toBeTruthy();
  expect(getByTestId('kesfet-search-try-people')).toBeTruthy();
  expect(getByTestId('kesfet-search-try-posts')).toBeTruthy();
});

test('Tarif sekmesi yalnız öğün kartlı gönderiler (kcal + P çipi)', async () => {
  const { getByTestId, getByText, queryByText } = renderScreen();
  await flush();
  await typeAndWait(getByTestId('kesfet-search-input'), 'protein');
  expect(getByText('Bugün 10 bin adım + protein hedefi tamam!')).toBeTruthy();
  fireEvent.press(getByTestId('kesfet-search-scope-recipes'));
  expect(queryByText('Bugün 10 bin adım + protein hedefi tamam!')).toBeNull();
  expect(getByText('610 kcal')).toBeTruthy();
  expect(getByText('P 46 g')).toBeTruthy();
});

test('hata → Tekrar dene → sonuçlar', async () => {
  setSearchClient(createMockSearchClient({ fail: true }));
  const { getByTestId, getByText } = renderScreen();
  await flush();
  await typeAndWait(getByTestId('kesfet-search-input'), 'somon');
  expect(getByText('Arama yapılamadı')).toBeTruthy();
  setSearchClient(createMockSearchClient());
  fireEvent.press(getByTestId('kesfet-search-retry'));
  await act(async () => {
    jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 10);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(getByText('“somon” için sonuçlar')).toBeTruthy();
});

test('Vazgeç geri döner; temizle düğmesi sorguyu siler → son aramalar', async () => {
  const { getByTestId, getByText, getByLabelText, navigation } = renderScreen();
  await flush();
  await typeAndWait(getByTestId('kesfet-search-input'), 'somon');
  fireEvent.press(getByLabelText('Aramayı temizle'));
  expect(getByText('Son aramalar')).toBeTruthy();
  fireEvent.press(getByLabelText('Vazgeç'));
  expect(navigation.goBack).toHaveBeenCalled();
});
