// G15-S1 Ek karar — SignupEatFlowV2 (FinSignupEat 3 panel) + SignupEatGate.
// Şehir kapısı, harita doğrulamalı adres adımı, telefon, geri geçişleri; tüm dış
// bağımlılıklar (auth, Supabase yazma, harita, geocode, bölgeler) mock'lu.
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

// ── Mock durumu ──────────────────────────────────────────────────────────────
const mockReg = {
  enabled: true,
  city: '',
  setCity: jest.fn(),
  status: 'idle' as string,
  messageKey: null as string | null,
  checkCity: jest.fn(async () => true),
};
jest.mock('../../../profil/useRegistration', () => ({ useEatkcalRegistration: () => mockReg }));

const mockUser = { id: 'u1', email: 'ada@ornek.com' };
jest.mock('../../../../core/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, authLoading: false }),
}));

let mockFlags: Record<string, boolean> = { yeni_onboarding: true };
jest.mock('../../../../core/flags', () => ({ useFeature: (k: string) => !!mockFlags[k] }));

jest.mock('react-native-safe-area-context', () => {
  const R = jest.requireActual('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    useSafeAreaInsets: () => insets,
    SafeAreaView: ({ children }: { children?: React.ReactNode }) => R.createElement(R.Fragment, null, children),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => R.createElement(R.Fragment, null, children),
  };
});

const ZONES = [
  { district: 'Konak', neighbourhood: 'Alsancak', is_active: true },
  { district: 'Konak', neighbourhood: 'Kemeraltı', is_active: false },
];
jest.mock('../../../../lib/delivery', () => ({
  fetchAllDeliveryZones: () => Promise.resolve(ZONES),
  fetchGlobalDeliverySettings: () => Promise.resolve(null),
}));
jest.mock('../../../../lib/addresses', () => ({ normalizeAddress: (r: unknown) => ({ ...(r as object), id: 'a1' }) }));
jest.mock('../../../../lib/supabaseErrors', () => ({
  mapSupabaseErrorToUserMessage: (_e: unknown, fb: string) => fb,
  formatSupabaseErrorForDevLog: () => '',
}));

const mockInsert = jest.fn(async (_s: unknown, payload: Record<string, unknown>, _first: boolean) => ({
  row: payload,
  droppedColumns: [],
}));
const mockBackfill = jest.fn();
let mockProfileContact = { fullName: '', phone: '' };
jest.mock('../../../eatkcal/v2/model/addressSave', () => ({
  fetchUserAddressRows: () => Promise.resolve([]),
  fetchProfileContact: () => Promise.resolve(mockProfileContact),
  insertAddress: (s: unknown, p: Record<string, unknown>, f: boolean) => mockInsert(s, p, f),
  backfillProfileContact: (...a: unknown[]) => mockBackfill(...a),
}));
let mockReadPerm = { status: 'denied', canAskAgain: false };
const mockReqLoc = jest.fn(() => Promise.resolve(false));
jest.mock('../../../eatkcal/v2/model/addressGeocode', () => ({
  IZMIR_CENTER: { latitude: 38.4237, longitude: 27.1428 },
  readLocationPermission: () => Promise.resolve(mockReadPerm),
  requestLocationPermission: () => mockReqLoc(),
  currentCoords: () => Promise.resolve(null),
  reverseGeocodeAt: () =>
    Promise.resolve({ district: 'Konak', neighbourhood: 'Alsancak', street: 'Kıbrıs Şehitleri Cd.', streetNumber: '12' }),
}));

// Harita: native modül yok → düğmeyle pin bırakmayı taklit eden saplama.
jest.mock('../../../eatkcal/v2/ui/address/AddressMap', () => {
  const R = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    AddressMap: ({ onCenterChange }: { onCenterChange: (c: unknown, byUser: boolean) => void }) =>
      R.createElement(
        View,
        null,
        R.createElement(
          Pressable,
          { testID: 'map-drop-pin', onPress: () => onCenterChange({ latitude: 38.43, longitude: 27.14 }, true) },
          R.createElement(Text, null, 'pin'),
        ),
      ),
    NoMapCard: () => null,
  };
});
jest.mock('../../../profil/ui/screens/SignupEatScreen', () => {
  const R = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: () => R.createElement(Text, { testID: 'old-signup-eat' }, 'eski') };
});

import { useAddressStore } from '../../../../store/addressStore';
import SignupEatFlowV2 from '../SignupEatFlowV2';
import SignupEatGate from '../SignupEatGate';

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

function setup(props: Partial<React.ComponentProps<typeof SignupEatFlowV2>> = {}) {
  const onBack = jest.fn();
  const onAllowed = jest.fn();
  const onCityAllowed = jest.fn();
  const utils = render(<SignupEatFlowV2 onBack={onBack} onAllowed={onAllowed} onCityAllowed={onCityAllowed} {...props} />);
  return { ...utils, onBack, onAllowed, onCityAllowed };
}

async function passCity(u: ReturnType<typeof setup>) {
  fireEvent.press(u.getByTestId('city-İzmir'));
  await act(async () => {
    fireEvent.press(u.getByLabelText('Devam'));
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReg.status = 'idle';
  mockReg.messageKey = null;
  mockReg.checkCity = jest.fn(async () => true);
  mockProfileContact = { fullName: '', phone: '' };
  mockFlags = { yeni_onboarding: true };
  useAddressStore.setState({ selectedAddress: null } as never);
});

describe('Panel 1 · şehir', () => {
  it('"Çok yakında" şehir seçilince Devam kapalı kalır, checkCity çağrılmaz', async () => {
    const u = setup();
    fireEvent.press(u.getByTestId('city-İstanbul'));
    await act(async () => {
      fireEvent.press(u.getByLabelText('Devam'));
    });
    expect(mockReg.checkCity).not.toHaveBeenCalled();
    expect(u.queryByTestId('signup-eat-street')).toBeNull();
  });

  it('İzmir izinli → checkCity çağrılır, onCityAllowed + adres paneli açılır', async () => {
    const u = setup();
    await passCity(u);
    expect(mockReg.setCity).toHaveBeenCalledWith('İzmir');
    expect(mockReg.checkCity).toHaveBeenCalledTimes(1);
    expect(u.onCityAllowed).toHaveBeenCalledTimes(1);
    expect(u.getByTestId('signup-eat-street')).toBeTruthy();
    expect(u.onAllowed).not.toHaveBeenCalled();
  });

  it('checkCity false (bloklu) → ilerlemez, bloklu ileti görünür', async () => {
    mockReg.checkCity = jest.fn(async () => false);
    mockReg.messageKey = 'profil.city_gate_only_izmir';
    const u = setup();
    await passCity(u);
    expect(u.onCityAllowed).not.toHaveBeenCalled();
    expect(u.queryByTestId('signup-eat-street')).toBeNull();
    expect(u.getByText('Şu an yalnız İzmir’e teslimat var.')).toBeTruthy();
  });

  it('seçili adres zaten varsa adres+telefon atlanır → doğrudan onAllowed', async () => {
    useAddressStore.setState({ selectedAddress: { id: 'x' } } as never);
    const u = setup();
    await passCity(u);
    expect(u.onAllowed).toHaveBeenCalledTimes(1);
  });

  it('geri → onBack', () => {
    const u = setup();
    fireEvent.press(u.getByLabelText('Geri'));
    expect(u.onBack).toHaveBeenCalledTimes(1);
  });
});

describe('Panel 2 · adres (harita doğrulaması)', () => {
  it('pin bırakılmadan Devam ilerlemez → "önce haritada doğrula"', async () => {
    const u = setup({ vitrinStep: undefined });
    await passCity(u);
    await flush();
    fireEvent.press(u.getByLabelText('Devam'));
    expect(u.getByTestId('signup-eat-step-error')).toHaveTextContent('Önce haritada konumunu doğrula.');
    expect(u.queryByTestId('signup-eat-phone')).toBeNull();
  });

  it('pin bırakılınca ters geocode formu doldurur ve Devam telefon paneline geçer', async () => {
    const u = setup();
    await passCity(u);
    await flush();
    fireEvent.press(u.getByTestId('map-drop-pin'));
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(u.getByTestId('signup-eat-street').props.value).toBe('Kıbrıs Şehitleri Cd.');
    expect(u.getByTestId('signup-eat-building').props.value).toBe('12');
    fireEvent.press(u.getByLabelText('Devam'));
    expect(u.getByTestId('signup-eat-phone')).toBeTruthy();
  });

  it('pin var ama sokak/bina boşsa needs_street', async () => {
    const u = setup();
    await passCity(u);
    await flush();
    fireEvent.press(u.getByTestId('map-drop-pin'));
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.changeText(u.getByTestId('signup-eat-building'), '');
    fireEvent.press(u.getByLabelText('Devam'));
    expect(u.getByTestId('signup-eat-step-error')).toHaveTextContent('Sokak ve bina numarasını yaz.');
  });

  it('G26-S1: adres paneli açılınca konum SİSTEM PENCERESİ YOK (izin sorulmamışken); yalnız "Konumumu kullan" dokununca', async () => {
    mockReadPerm = { status: 'undetermined', canAskAgain: true };
    const u = setup();
    await passCity(u);
    await flush();
    expect(u.getByTestId('signup-eat-street')).toBeTruthy();
    expect(mockReqLoc).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(u.getByTestId('signup-eat-use-location'));
    });
    await flush();
    expect(mockReqLoc).toHaveBeenCalledTimes(1);
    mockReadPerm = { status: 'denied', canAskAgain: false };
  });

  it('geri → şehir paneli', async () => {
    const u = setup();
    await passCity(u);
    fireEvent.press(u.getByLabelText('Geri'));
    expect(u.getByTestId('signup-eat-city')).toBeTruthy();
    expect(u.onBack).not.toHaveBeenCalled();
  });
});

describe('Panel 3 · telefon + kayıt', () => {
  async function toPhone(u: ReturnType<typeof setup>) {
    await passCity(u);
    await flush();
    fireEvent.press(u.getByTestId('map-drop-pin'));
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.press(u.getByLabelText('Devam'));
  }

  it('geçersiz telefon → hata, kayıt yok', async () => {
    const u = setup();
    await toPhone(u);
    fireEvent.changeText(u.getByTestId('signup-eat-first'), 'Ada');
    fireEvent.changeText(u.getByTestId('signup-eat-last'), 'Yılmaz');
    fireEvent.changeText(u.getByTestId('signup-eat-phone'), '+90 412 111');
    await act(async () => {
      fireEvent.press(u.getByLabelText('Sepete dön'));
    });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(u.getByText('Geçerli bir cep numarası gir (5XX XXX XX XX).')).toBeTruthy();
    expect(u.onAllowed).not.toHaveBeenCalled();
  });

  it('geçerli telefon → addressSave AYNI payload (doğrulanmış konum), profil iletişim yazılır, adres seçilir, onAllowed', async () => {
    const u = setup();
    await toPhone(u);
    fireEvent.changeText(u.getByTestId('signup-eat-first'), 'Ada');
    fireEvent.changeText(u.getByTestId('signup-eat-last'), 'Yılmaz');
    fireEvent.changeText(u.getByTestId('signup-eat-phone'), '532 111 22 33');
    await act(async () => {
      fireEvent.press(u.getByLabelText('Sepete dön'));
    });
    await flush();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const payload = mockInsert.mock.calls[0][1];
    expect(payload).toMatchObject({
      user_id: 'u1',
      contact_phone: '05321112233',
      contact_email: 'ada@ornek.com',
      district: 'Konak',
      neighbourhood: 'Alsancak',
      street: 'Kıbrıs Şehitleri Cd.',
      building_no: '12',
      city: 'İzmir',
      latitude: 38.43,
      longitude: 27.14,
    });
    expect(payload.verified_at).toBeTruthy();
    expect(mockInsert.mock.calls[0][2]).toBe(true); // ilk adres → varsayılan
    expect(mockBackfill).toHaveBeenCalledTimes(1);
    expect(useAddressStore.getState().selectedAddress).toMatchObject({ id: 'a1' });
    expect(u.onAllowed).toHaveBeenCalledTimes(1);
  });

  it('profilde ad+telefon varsa ad alanları sorulmaz, backfill çağrılmaz', async () => {
    mockProfileContact = { fullName: 'Ada Yılmaz', phone: '0532 111 22 33' };
    const u = setup();
    await toPhone(u);
    expect(u.queryByTestId('signup-eat-first')).toBeNull();
    await act(async () => {
      fireEvent.press(u.getByLabelText('Sepete dön'));
    });
    await flush();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockBackfill).not.toHaveBeenCalled();
    expect(u.onAllowed).toHaveBeenCalledTimes(1);
  });

  it('geri → adres paneli', async () => {
    const u = setup();
    await toPhone(u);
    fireEvent.press(u.getByLabelText('Geri'));
    expect(u.getByTestId('signup-eat-street')).toBeTruthy();
  });
});

describe('SignupEatGate', () => {
  it('yeni_onboarding KAPALI → mevcut SignupEatScreen aynen', () => {
    mockFlags = { yeni_onboarding: false };
    const u = render(<SignupEatGate onBack={() => {}} onAllowed={() => {}} />);
    expect(u.getByTestId('old-signup-eat')).toBeTruthy();
    expect(u.queryByTestId('signup-eat-city')).toBeNull();
  });

  it('yeni_onboarding AÇIK → yeni 3 panel akışı', () => {
    const u = render(<SignupEatGate onBack={() => {}} onAllowed={() => {}} />);
    expect(u.getByTestId('signup-eat-city')).toBeTruthy();
    expect(u.queryByTestId('old-signup-eat')).toBeNull();
  });
});
