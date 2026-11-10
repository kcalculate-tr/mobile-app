// G24-S1 md.1 (Tur 26k CityR1 / WaitlistR1): Türkiye'de İzmir dışı il seçilince "Devam et"
// yerine bilgi kartı "eatkcal şu an yalnız İzmir'de." + Restoran öner / Restoranını ekle;
// sipariş akışı başlamaz. Bekleme sayfası başlığı "Şimdilik İzmir'deyiz".
import React from 'react';
import { fireEvent, render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (ui: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

jest.mock('../../../../core/supabase', () => {
  const client = { rpc: jest.fn(), auth: { getSession: () => Promise.resolve({ data: { session: null } }) } };
  return { supabase: client, getSupabaseClient: () => client };
});
jest.mock('../ui/gate/waitlistSend', () => ({
  submitWaitlist: jest.fn(async () => {}),
  flushWaitlistQueue: jest.fn(async () => {}),
}));
jest.mock('../../../profil/useRegistration', () => ({
  useEatkcalRegistration: () => ({
    enabled: false,
    status: 'idle',
    messageKey: null,
    city: '',
    setCity: jest.fn(),
    checkCity: jest.fn(async () => true),
  }),
}));
jest.mock('../../../shell', () => ({ useInR3Shell: () => false }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CityGateView } = require('../ui/gate/CityGateView');

test('Ankara seçilince: "Devam et" yok, "yalnız İzmir" kartı + iki eylem; sipariş akışı başlamaz', () => {
  const onAllowed = jest.fn();
  const r = render(<CityGateView onAllowed={onAllowed} showTabSpace={false} />);
  expect(r.queryByTestId('ek-gate-else')).toBeNull();
  fireEvent.press(r.getByTestId('ek-gate-il-Ankara'));
  expect(r.getByTestId('ek-gate-else')).toBeTruthy();
  expect(r.queryByTestId('ek-gate-continue')).toBeNull();
  expect(r.getByText('eatkcal şu an yalnız İzmir’de.')).toBeTruthy();
  expect(r.getByText('Ankara için sevdiğin bir restoranı önerebilir ya da kendi restoranını ekleyebilirsin.')).toBeTruthy();
  expect(r.getByTestId('ek-gate-else-suggest')).toBeTruthy();
  expect(r.getByTestId('ek-gate-else-add')).toBeTruthy();
  fireEvent.press(r.getByTestId('ek-gate-else-suggest'));
  expect(r.getByTestId('ek-waitlist-suggest')).toBeTruthy();
  expect(onAllowed).not.toHaveBeenCalled();
});

test('İzmir seçilince kart yok, "Devam et" geçer', () => {
  const onAllowed = jest.fn();
  const r = render(<CityGateView onAllowed={onAllowed} showTabSpace={false} />);
  fireEvent.press(r.getByTestId('ek-gate-il-Ankara'));
  fireEvent.press(r.getByTestId('ek-gate-il-İzmir'));
  expect(r.queryByTestId('ek-gate-else')).toBeNull();
  fireEvent.press(r.getByTestId('ek-gate-continue'));
  expect(onAllowed).toHaveBeenCalledTimes(1);
});

test('Bekleme sayfası başlığı "Şimdilik İzmir’deyiz"', () => {
  const r = render(<CityGateView onAllowed={jest.fn()} showTabSpace={false} initialStep="waitlist" initialCityKey="Ankara" />);
  expect(r.queryByText('Çok yakında')).toBeNull();
  expect(r.getAllByText('Şimdilik İzmir’deyiz').length).toBeGreaterThan(0);
});
