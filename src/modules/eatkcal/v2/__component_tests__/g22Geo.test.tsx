// G22-S2 md.3 — eatkcal konum (Avrupa + Amerika): ülke seçici + şehir araması +
// "Çok yakında [şehir]'deki restoranlar…" + öner/ekle sheet'leri. Türkiye il akışı aynen.
import React from 'react';
import { act, fireEvent, render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CITY_SEARCH_DEBOUNCE_MS } from '../model/geo';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (ui: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

const mockRpc = jest.fn();
jest.mock('../../../../core/supabase', () => {
  const client = {
    rpc: (...a: unknown[]) => mockRpc(...a),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  };
  return { supabase: client, getSupabaseClient: () => client };
});
jest.mock('../ui/gate/waitlistSend', () => ({
  submitWaitlist: jest.fn(async () => {}),
  flushWaitlistQueue: jest.fn(async () => {}),
}));
const mockSetCity = jest.fn();
jest.mock('../../../profil/useRegistration', () => ({
  useEatkcalRegistration: () => ({
    enabled: false,
    status: 'idle',
    messageKey: null,
    city: '',
    setCity: mockSetCity,
    checkCity: jest.fn(async () => true),
  }),
}));
jest.mock('../../../shell', () => ({ useInR3Shell: () => false }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CityGateView } = require('../ui/gate/CityGateView');

async function typeAndWait(r: ReturnType<typeof render>, testID: string, text: string) {
  fireEvent.changeText(r.getByTestId(testID), text);
  await act(async () => {
    jest.advanceTimersByTime(CITY_SEARCH_DEBOUNCE_MS);
  });
  await act(async () => {});
}

beforeEach(() => mockRpc.mockReset());

test('Türkiye varsayılan: il listesi bugünkü gibi; İzmir → onAllowed', () => {
  const onAllowed = jest.fn();
  const r = render(<CityGateView onAllowed={onAllowed} showTabSpace={false} />);
  expect(r.getByText('Türkiye')).toBeTruthy();
  expect(r.getByTestId('ek-gate-il-İzmir')).toBeTruthy();
  // G23-S1 (İlter): il listesinde de "Çok yakında" yazmaz; İzmir "Açık" çipi kalır.
  expect(r.queryByText('Çok yakında')).toBeNull();
  expect(r.getByText('Açık')).toBeTruthy();
  expect(r.getByTestId('ek-gate-il-Ankara').props.accessibilityLabel).toBe('Ankara');
  fireEvent.press(r.getByTestId('ek-gate-il-İzmir'));
  fireEvent.press(r.getByTestId('ek-gate-continue'));
  expect(onAllowed).toHaveBeenCalledTimes(1);
  expect(mockRpc).not.toHaveBeenCalled();
});

test('Almanya → şehir ara → Berlin (listede "Çok yakında" yok) → mesaj + Restoran öner / Restoranını ekle', async () => {
  mockRpc.mockResolvedValue({
    data: [
      { geonameid: 2950159, name: 'Berlin', ascii_name: 'Berlin', country_iso2: 'DE', population: 3426354 },
      { geonameid: 2950096, name: 'Bernau bei Berlin', ascii_name: 'Bernau bei Berlin', country_iso2: 'DE', population: 34866 },
    ],
    error: null,
  });
  const onAllowed = jest.fn();
  const r = render(<CityGateView onAllowed={onAllowed} showTabSpace={false} />);
  fireEvent.press(r.getByTestId('ek-gate-country'));
  fireEvent.changeText(r.getByTestId('ek-gate-country-search'), 'alman');
  fireEvent.press(r.getByTestId('ek-gate-country-DE'));
  expect(r.getByText('Almanya')).toBeTruthy();
  expect(r.getByText('Şehrinin adını yaz.')).toBeTruthy();
  expect(r.getByText('Şehir seç')).toBeTruthy();

  await typeAndWait(r, 'ek-gate-city-search', 'ber');
  expect(mockRpc).toHaveBeenCalledWith('search_cities', { q: 'ber', country: 'DE' });
  expect(r.getByTestId('ek-gate-city-2950159')).toBeTruthy();
  expect(r.queryByText('Çok yakında')).toBeNull(); // şehir listesinde yok

  fireEvent.press(r.getByTestId('ek-gate-city-2950159'));
  fireEvent.press(r.getByTestId('ek-gate-continue'));
  expect(onAllowed).not.toHaveBeenCalled(); // sipariş akışı başlamaz
  expect(r.getByTestId('ek-gate-other')).toBeTruthy();
  expect(r.getByText("Çok yakında Berlin'deki restoranlar burada listelenecek.")).toBeTruthy();
  expect(r.getByText('Restoranını ekle')).toBeTruthy();
  fireEvent.press(r.getByTestId('ek-gate-suggest'));
  expect(r.getByText('Öneriyi gönder')).toBeTruthy(); // FinWaitlistSuggest sheet'i
});

test('ağ yok / RPC canlıda yok: hata + Tekrar dene + yazdığınla devam', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
  const r = render(<CityGateView onAllowed={jest.fn()} showTabSpace={false} />);
  fireEvent.press(r.getByTestId('ek-gate-country'));
  fireEvent.press(r.getByTestId('ek-gate-country-FR'));
  await typeAndWait(r, 'ek-gate-city-search', 'Lyon');
  expect(r.getByTestId('ek-gate-city-error')).toBeTruthy();
  mockRpc.mockResolvedValue({ data: [], error: null });
  fireEvent.press(r.getByTestId('ek-gate-city-retry'));
  await act(async () => {
    jest.advanceTimersByTime(CITY_SEARCH_DEBOUNCE_MS);
  });
  await act(async () => {});
  expect(mockRpc).toHaveBeenCalledTimes(2);
  expect(r.getByTestId('ek-gate-city-empty')).toBeTruthy();
  fireEvent.press(r.getByTestId('ek-gate-city-typed'));
  fireEvent.press(r.getByTestId('ek-gate-continue'));
  expect(r.getByText("Çok yakında Lyon'daki restoranlar burada listelenecek.")).toBeTruthy();
});
