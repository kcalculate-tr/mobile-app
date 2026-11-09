// G20-S1 md.1–3 — rıza kapısı (politika → ATT), bilgilendirme / tekrar kabul sheet'i,
// Hesap ekranı ayrıntı sheet'i, Veri ve reklam izinleri sayfası. Ağ yok (supabase taklit).
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: any) => children };
});

let mockFlags: Record<string, boolean> = {};
let mockFlagsReady = true;
jest.mock('../../../../core/flags', () => ({
  useFeature: (k: string) => mockFlags[k] === true,
  useFlagsContext: () => ({ ready: mockFlagsReady }),
}));

const mockAuth: { session: null | { user: { id: string } }; loading: boolean } = { session: null, loading: false };
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => mockAuth }));

// analytics: initFBSDK / rıza durumu taklit (ATT sırası analyticsAtt testinde).
const mockConsent = { platform: 'ios', att: 'undetermined', adConsent: 'unset', firstParty: true };
const mockInit = jest.fn((_o?: unknown) => Promise.resolve());
const mockReqAtt = jest.fn(() => Promise.resolve('granted'));
jest.mock('../../../../lib/analytics', () => ({
  initFBSDK: (o?: unknown) => mockInit(o),
  getConsent: () => ({ ...mockConsent }),
  setAdConsent: (v: string) => {
    mockConsent.adConsent = v;
    return Promise.resolve();
  },
  setFirstPartyConsent: (v: boolean) => {
    mockConsent.firstParty = v;
    return Promise.resolve();
  },
  requestAttForAds: () => mockReqAtt(),
}));

// supabase: legal_documents sürümü, my_consent_status, user_consents yazımı.
let mockRpc: { data: unknown; error: unknown } = { data: null, error: { message: 'yok' } };
const mockInserts: unknown[][] = [];
let mockUid: string | null = null;
jest.mock('../../../../core/supabase', () => {
  const client = {
    from: (table: string) => {
      const q: any = {};
      for (const m of ['select', 'in', 'eq']) q[m] = () => q;
      q.insert = (rows: unknown[]) => {
        mockInserts.push(rows);
        return Promise.resolve({ error: null });
      };
      q.then = (res: any) =>
        Promise.resolve(
          table === 'legal_documents'
            ? { data: [{ slug: 'kullanim-kosullari', version: 1 }, { slug: 'gizlilik-politikasi', version: 1 }], error: null }
            : { data: [], error: null },
        ).then(res);
      return q;
    },
    rpc: () => Promise.resolve(mockRpc),
    auth: { getSession: () => Promise.resolve({ data: { session: mockUid ? { user: { id: mockUid } } : null } }) },
  };
  return { supabase: client, getSupabaseClient: () => client };
});

import { ConsentGate } from '../ConsentGate';
import { ConsentSheet } from '../ConsentSheet';
import { POLICY_KEY, PENDING_KEY } from '../../../../lib/consent/policy';
import { holdGate } from '../../../../lib/consent/store';
import SettingsDataConsentScreen from '../../../profil/ui/screens/SettingsDataConsentScreen';

const flush = async () => {
  for (let i = 0; i < 20; i++) await act(async () => {});
};
const signIn = (id = 'u1') => {
  mockAuth.session = { user: { id } };
  mockUid = id;
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockFlags = { yeni_onboarding: true, yeni_kabuk: true };
  mockFlagsReady = true;
  mockAuth.session = null;
  mockAuth.loading = false;
  mockUid = null;
  mockRpc = { data: null, error: { message: 'yok' } };
  mockInserts.length = 0;
  Object.assign(mockConsent, { platform: 'ios', att: 'undetermined', adConsent: 'unset', firstParty: true });
  await AsyncStorage.clear();
});

describe('ConsentGate — sıra: politika → ATT', () => {
  test('bayrak kapalı (iki bayrak da): bugünkü gibi açılışta initFBSDK (rıza seçeneği yok), sheet yok', async () => {
    mockFlags = {};
    const ui = render(<ConsentGate />);
    await flush();
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit.mock.calls[0][0]).toBeUndefined();
    expect(ui.queryByTestId('consent-sheet-notice')).toBeNull();
  });

  test('bayraklar hazır değilken hiçbir şey yapılmaz (ATT erken sorulmaz)', async () => {
    mockFlagsReady = false;
    render(<ConsentGate />);
    await flush();
    expect(mockInit).not.toHaveBeenCalled();
  });

  test('bayrak açık + hesap yok + kayıt yok → ATT SORULMAZ (hesap oluşturma bloğu bekleniyor)', async () => {
    const ui = render(<ConsentGate />);
    await flush();
    expect(mockInit).not.toHaveBeenCalled();
    expect(ui.queryByTestId('consent-sheet-notice')).toBeNull();
  });

  test('mevcut kullanıcı (kayıt yok) → bir kez bilgilendirme; Devam et → kayıt + user_consents + SONRA ATT', async () => {
    signIn();
    const ui = render(<ConsentGate />);
    await flush();
    expect(ui.getByTestId('consent-sheet-notice')).toBeTruthy();
    expect(ui.getByText('Gizlilik ve izinler')).toBeTruthy();
    expect(mockInit).not.toHaveBeenCalled(); // ATT politikadan ÖNCE yok
    // Meta varsayılan AÇIK
    expect(ui.getByTestId('consent-sheet-notice-block-ads').props.value).toBe(true);

    await act(async () => fireEvent.press(ui.getByText('Devam et')));
    await flush();
    expect(JSON.parse((await AsyncStorage.getItem(POLICY_KEY)) as string).v).toEqual({ terms: 1, privacy: 1 });
    expect(mockConsent.adConsent).toBe('granted');
    const rows = mockInserts.flat() as { kind: string; doc_slug: string | null; source: string; user_id: string }[];
    expect(rows.map((r) => [r.kind, r.doc_slug, r.source, r.user_id])).toEqual([
      ['policy', 'kullanim-kosullari', 'notice', 'u1'],
      ['policy', 'gizlilik-politikasi', 'notice', 'u1'],
      ['ad_measurement', null, 'notice', 'u1'],
    ]);
    expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull();
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(typeof (mockInit.mock.calls[0][0] as { onAtt?: unknown }).onAtt).toBe('function');
  });

  test('bilgilendirmede reklam ölçümü kapatılırsa → adConsent denied, satır granted=false', async () => {
    signIn();
    const ui = render(<ConsentGate />);
    await flush();
    fireEvent(ui.getByTestId('consent-sheet-notice-block-ads'), 'valueChange', false);
    await act(async () => fireEvent.press(ui.getByText('Devam et')));
    await flush();
    expect(mockConsent.adConsent).toBe('denied');
    const ad = (mockInserts.flat() as { kind: string; granted: boolean }[]).find((r) => r.kind === 'ad_measurement');
    expect(ad?.granted).toBe(false);
  });

  test('bilgilendirmeden sonra hiç: kayıt varsa sheet yok, doğrudan ATT', async () => {
    signIn();
    await AsyncStorage.setItem(POLICY_KEY, JSON.stringify({ v: { terms: 1, privacy: 1 }, at: 'x' }));
    const ui = render(<ConsentGate />);
    await flush();
    expect(ui.queryByTestId('consent-sheet-notice')).toBeNull();
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  test('yeni belge sürümü → tekrar kabul: onay kutusu olmadan düğme pasif, kabulle kayıt sürüm 2', async () => {
    signIn();
    await AsyncStorage.setItem(POLICY_KEY, JSON.stringify({ v: { terms: 1, privacy: 1 }, at: 'x' }));
    mockRpc = {
      data: {
        docs: [
          { slug: 'gizlilik-politikasi', version: 1, accepted_version: 1 },
          { slug: 'kullanim-kosullari', version: 2, accepted_version: 1 },
        ],
        ad_measurement: true,
        first_party: null,
      },
      error: null,
    };
    const ui = render(<ConsentGate />);
    await flush();
    expect(ui.getByTestId('consent-sheet-reconsent')).toBeTruthy();
    expect(mockInit).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(ui.getByText('Kabul et ve devam et')));
    expect(mockInserts.length).toBe(0); // kabul kutusu işaretlenmedi
    fireEvent.press(ui.getByTestId('consent-sheet-reconsent-block-accept'));
    // legal_documents taklidi sürüm 1 döner; kabulde kapının gördüğü sunucu sürümü (2) yazılır.
    await act(async () => fireEvent.press(ui.getByText('Kabul et ve devam et')));
    await flush();
    const policy = (mockInserts.flat() as { kind: string; source: string; doc_slug: string; doc_version: number }[]).filter(
      (r) => r.kind === 'policy',
    );
    expect(policy.map((r) => [r.doc_slug, r.doc_version, r.source])).toEqual([
      ['kullanim-kosullari', 2, 'reconsent'],
      ['gizlilik-politikasi', 1, 'reconsent'],
    ]);
    expect(JSON.parse((await AsyncStorage.getItem(POLICY_KEY)) as string).v).toEqual({ terms: 2, privacy: 1 });
  });

  test('hesap oluşturma sürerken (kapı tutuluyor) bilgilendirme sheet’i / ATT çıkmaz', async () => {
    const release = holdGate();
    signIn();
    const ui = render(<ConsentGate />);
    await flush();
    expect(ui.queryByTestId('consent-sheet-notice')).toBeNull();
    expect(mockInit).not.toHaveBeenCalled();
    release();
  });

  test('başka cihazda kabul (sunucu) → sheet yok, cihaz kaydı yazılır', async () => {
    signIn();
    mockRpc = {
      data: { docs: [{ slug: 'gizlilik-politikasi', version: 1, accepted_version: 1 }, { slug: 'kullanim-kosullari', version: 1, accepted_version: 1 }], ad_measurement: false, first_party: true },
      error: null,
    };
    const ui = render(<ConsentGate />);
    await flush();
    expect(ui.queryByTestId('consent-sheet-notice')).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem(POLICY_KEY)) as string).v).toEqual({ terms: 1, privacy: 1 });
    expect(mockInit).toHaveBeenCalledTimes(1);
  });
});

describe('ConsentSheet (details — Apple/Google ayrıntı sheet’i)', () => {
  test('blok: Koşullar/Gizlilik/KVKK bağlantıları + Meta anahtarı; onay kutusu yok; Tamam kapatır', () => {
    const onConfirm = jest.fn();
    const onAd = jest.fn();
    const ui = render(<ConsentSheet visible mode="details" adOn onAdChange={onAd} onConfirm={onConfirm} onClose={() => {}} />);
    expect(ui.getByText('Politikalar ve izinler')).toBeTruthy();
    expect(ui.queryByTestId('consent-sheet-details-block-accept')).toBeNull();
    expect(ui.getByText('KVKK Aydınlatma Metni')).toBeTruthy();
    expect(ui.getByText('Reklam ölçümü (Meta)')).toBeTruthy();
    fireEvent(ui.getByTestId('consent-sheet-details-block-ads'), 'valueChange', false);
    expect(onAd).toHaveBeenCalledWith(false);
    fireEvent.press(ui.getByText('Tamam'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('bağlantı → belge tam ekran açılır (Sözleşmeler), geri → kapanır', async () => {
    const ui = render(<ConsentSheet visible mode="details" adOn onAdChange={() => {}} onConfirm={() => {}} onClose={() => {}} />);
    fireEvent.press(ui.getByTestId('consent-sheet-details-block-kvkk'));
    await flush();
    expect(ui.getAllByText(/KVKK/).length).toBeGreaterThan(1);
  });
});

describe('Veri ve reklam izinleri (Profil › Gizlilik)', () => {
  test('iki anahtar: kullanım ölçümü + reklam ölçümü; kapatınca kayıt yazılır', async () => {
    signIn();
    mockConsent.adConsent = 'granted';
    mockConsent.att = 'granted';
    const ui = render(<SettingsDataConsentScreen onBack={() => {}} />);
    expect(ui.getByText('Veri ve reklam izinleri')).toBeTruthy();
    expect(ui.getByTestId('consent-usage-switch').props.value).toBe(true);
    expect(ui.getByTestId('consent-ads-switch').props.value).toBe(true);

    await act(async () => fireEvent(ui.getByTestId('consent-usage-switch'), 'valueChange', false));
    await flush();
    expect(mockConsent.firstParty).toBe(false);
    await act(async () => fireEvent(ui.getByTestId('consent-ads-switch'), 'valueChange', false));
    await flush();
    expect(mockConsent.adConsent).toBe('denied');
    const rows = mockInserts.flat() as { kind: string; granted: boolean; source: string }[];
    expect(rows.map((r) => [r.kind, r.granted, r.source])).toEqual([
      ['first_party', false, 'settings'],
      ['ad_measurement', false, 'settings'],
    ]);
    expect(ui.getByText('Kullanım Koşulları')).toBeTruthy();
    expect(ui.getByText('Gizlilik Politikası')).toBeTruthy();
    expect(ui.getByText('KVKK Aydınlatma Metni')).toBeTruthy();
  });

  test('iOS: açınca ATT sorulur; ATT reddi = Meta kapalı + iPhone Ayarları bağlantısı', async () => {
    signIn();
    mockConsent.adConsent = 'denied';
    mockReqAtt.mockImplementationOnce(() => {
      mockConsent.att = 'denied';
      return Promise.resolve('denied');
    });
    const ui = render(<SettingsDataConsentScreen onBack={() => {}} />);
    await act(async () => fireEvent(ui.getByTestId('consent-ads-switch'), 'valueChange', true));
    await flush();
    expect(mockReqAtt).toHaveBeenCalledTimes(1);
    expect(mockConsent.adConsent).toBe('denied');
    expect(ui.getByTestId('consent-ads-switch').props.value).toBe(false);
    expect(ui.getByTestId('consent-att-blocked')).toBeTruthy();
    const ad = (mockInserts.flat() as { kind: string; source: string }[]).find((r) => r.kind === 'ad_measurement');
    expect(ad?.source).toBe('att');
  });

  test('EN: sayfa başlığı ve satırlar İngilizce', async () => {
    const { I18nProvider } = require('../../../../core/i18n');
    const ui = render(
      <I18nProvider forceLang="en">
        <SettingsDataConsentScreen onBack={() => {}} />
      </I18nProvider>,
    );
    await flush();
    expect(ui.getByText('Data and ad permissions')).toBeTruthy();
    expect(ui.getByText('Ad measurement (Meta)')).toBeTruthy();
    expect(ui.getByText('KVKK Privacy Notice')).toBeTruthy();
  });
});
