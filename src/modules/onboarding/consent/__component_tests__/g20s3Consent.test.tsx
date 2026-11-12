// G20-S3 md.2 / 2b / 6 — zorunlu onay kutusu (Koşullar + Gizlilik + 18+), e-posta
// sheet'i ortak kutu + 18+ beyanı hesaba (profiles.onboarding_state.age_ok), yapay
// zekâ fotoğraf izni modülü (cihaz + user_consents ai_photo/scan). Ağ yok (taklit).
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: any) => children };
});
jest.mock('../../../../core/flags', () => ({ useFeature: () => true, useFlagsContext: () => ({ ready: true }) }));

const mockAuth = {
  user: { id: 'u1' } as null | { id: string },
  signInWithOtp: jest.fn(),
  verifyEmailOtp: jest.fn(),
};
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => mockAuth }));

const mockConsent = { platform: 'ios', adConsent: 'unset', firstParty: true };
jest.mock('../../../../lib/analytics', () => ({
  initFBSDK: () => Promise.resolve(),
  getConsent: () => ({ ...mockConsent }),
  setAdConsent: (v: string) => {
    mockConsent.adConsent = v;
    return Promise.resolve();
  },
  setFirstPartyConsent: () => Promise.resolve(),
}));

// supabase taklidi: user_consents eklemeleri, profiles okuma/güncelleme, my_consent_status.
const mockInserts: { table: string; rows: any[] }[] = [];
const mockUpdates: { table: string; patch: any; id: unknown }[] = [];
let mockProfileState: unknown = { profileCard: 'done', orient: { started: true, skipped: false, seen: { 1: true } } };
let mockRpc: { data: unknown; error: unknown } = { data: null, error: { message: 'yok' } };
jest.mock('../../../../core/supabase', () => {
  const client = {
    from: (table: string) => {
      const q: any = {};
      let patch: any = null;
      for (const m of ['select', 'in']) q[m] = () => q;
      q.eq = (_c: string, v: unknown) => {
        if (patch) {
          mockUpdates.push({ table, patch, id: v });
          return Promise.resolve({ error: null });
        }
        return q;
      };
      q.update = (p: any) => {
        patch = p;
        return q;
      };
      q.maybeSingle = () =>
        Promise.resolve(table === 'profiles' ? { data: { onboarding_state: mockProfileState }, error: null } : { data: null, error: null });
      q.insert = (rows: any[]) => {
        mockInserts.push({ table, rows });
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
    auth: { getSession: () => Promise.resolve({ data: { session: mockAuth.user ? { user: { id: mockAuth.user.id } } : null } }) },
  };
  return { supabase: client, getSupabaseClient: () => client };
});

import { ConsentSheet } from '../ConsentSheet';
import { PolicyAcceptRow } from '../ConsentBlock';
import { AccountEmailSheet } from '../../first/AccountEmailSheet';
import { useOnbFirst } from '../../first/store';
import { AI_PHOTO_KEY } from '../../../../lib/consent/policy';
import { hasLocalAiPhotoConsent, resolveAiPhotoConsent, setAiPhotoConsent } from '../../../../lib/consent/aiPhoto';

const flush = async () => {
  for (let i = 0; i < 20; i++) await act(async () => {});
};
const AGE_TR = '18 yaşından büyüğüm; Kullanım Koşulları’nı ve Gizlilik Politikası’nı okudum, kabul ediyorum.';

beforeEach(async () => {
  jest.clearAllMocks();
  mockInserts.length = 0;
  mockUpdates.length = 0;
  mockAuth.user = { id: 'u1' };
  mockAuth.signInWithOtp.mockResolvedValue({ error: null });
  mockAuth.verifyEmailOtp.mockResolvedValue({ error: null });
  mockProfileState = { profileCard: 'done', orient: { started: true, skipped: false, seen: { 1: true } } };
  mockRpc = { data: null, error: { message: 'yok' } };
  await AsyncStorage.clear();
  useOnbFirst.getState()._reset();
});

describe('md.2b — zorunlu onay kutusu (18+ dahil)', () => {
  test('PolicyAcceptRow withAge: tek kutu, 18+ + Koşullar + Gizlilik metni; dokununca değişir', () => {
    const onChange = jest.fn();
    const ui = render(<PolicyAcceptRow accepted={false} onAcceptedChange={onChange} withAge testID="x" />);
    expect(ui.getByText(AGE_TR)).toBeTruthy();
    expect(ui.getByTestId('x-accept').props.accessibilityState).toEqual({ checked: false });
    fireEvent.press(ui.getByTestId('x-accept'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('Ayrıntı sheet’i (details) Hesap ekranıyla AYNI kutuyu gösterir/değiştirir', () => {
    const onAcc = jest.fn();
    const ui = render(
      <ConsentSheet visible mode="details" adOn onAdChange={() => {}} onConfirm={() => {}} onClose={() => {}} accepted={false} onAcceptedChange={onAcc} />,
    );
    expect(ui.getByText(AGE_TR)).toBeTruthy();
    fireEvent.press(ui.getByTestId('consent-sheet-details-block-accept'));
    expect(onAcc).toHaveBeenCalledWith(true);
    // Reklam ölçümü anahtarı ayrı ve AÇIK (değişmez).
    expect(ui.getByTestId('consent-sheet-details-block-ads').props.value).toBe(true);
  });

  test('E-posta sheet’i: Hesap ekranında işaretlenen kutu taşınır; doğrulamada 18+ hesaba yazılır', async () => {
    const onVerified = jest.fn();
    const ui = render(<AccountEmailSheet visible accepted onAcceptedChange={() => {}} onClose={() => {}} onVerified={onVerified} />);
    expect(ui.getByTestId('fin-onb-email-consent-accept').props.accessibilityState).toEqual({ checked: true });
    fireEvent.changeText(ui.getByTestId('fin-onb-email-input'), 'ad@ornek.com');
    await act(async () => fireEvent.press(ui.getByText('Kod gönder')));
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith('ad@ornek.com');
    fireEvent.changeText(ui.getByTestId('fin-onb-email-code'), '123456');
    await act(async () => fireEvent.press(ui.getByText('Doğrula ve devam et')));
    await flush();
    expect(onVerified).toHaveBeenCalledTimes(1);
    const consentRows = mockInserts.filter((i) => i.table === 'user_consents').flatMap((i) => i.rows);
    expect(consentRows.filter((r) => r.kind === 'policy').map((r) => r.doc_slug)).toEqual(['kullanim-kosullari', 'gizlilik-politikasi']);
    const prof = mockUpdates.find((u) => u.table === 'profiles');
    expect(prof?.id).toBe('u1');
    expect(prof?.patch.onboarding_state.age_ok).toBe(true);
    expect(typeof prof?.patch.onboarding_state.age_ok_at).toBe('string');
    // Profildeki diğer durum ezilmez (okunup birleştirilir).
    expect(prof?.patch.onboarding_state.profileCard).toBe('done');
    expect(prof?.patch.onboarding_state.orient.seen[1]).toBe(true);
    expect(await AsyncStorage.getItem('@kcal_age_18_confirmed')).toBe('true');
  });

  test('profilde age_ok zaten varsa tekrar yazılmaz', async () => {
    mockProfileState = { profileCard: 'open', orient: {}, age_ok: true, age_ok_at: '2026-01-01T00:00:00Z' };
    const ui = render(<AccountEmailSheet visible accepted onAcceptedChange={() => {}} onClose={() => {}} onVerified={() => {}} />);
    fireEvent.changeText(ui.getByTestId('fin-onb-email-input'), 'ad@ornek.com');
    await act(async () => fireEvent.press(ui.getByText('Kod gönder')));
    fireEvent.changeText(ui.getByTestId('fin-onb-email-code'), '123456');
    await act(async () => fireEvent.press(ui.getByText('Doğrula ve devam et')));
    await flush();
    expect(mockUpdates.filter((u) => u.table === 'profiles')).toEqual([]);
  });
});

describe('md.2 — yapay zekâ fotoğraf izni', () => {
  test('sheet (TR): metin + Kabul et / Vazgeç; karartma/X = Vazgeç', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const ui = render(<ConsentSheet visible mode="ai_photo" onConfirm={onConfirm} onClose={onClose} />);
    expect(ui.getByText(/yapay zekâ hizmet sağlayıcımıza \(ABD\) gönderilir/)).toBeTruthy();
    expect(ui.queryByTestId('consent-sheet-ai_photo-block')).toBeNull(); // politika bloğu yok
    fireEvent.press(ui.getByTestId('consent-sheet-ai_photo-accept'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.press(ui.getByTestId('consent-sheet-ai_photo-cancel'));
    for (const el of ui.getAllByLabelText('Kapat')) fireEvent.press(el); // karartma + X
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  test('sheet (EN) + 18+ kutu (EN)', () => {
    const { I18nProvider } = require('../../../../core/i18n');
    const ui = render(
      <I18nProvider forceLang="en">
        <ConsentSheet visible mode="ai_photo" onConfirm={() => {}} onClose={() => {}} />
        <PolicyAcceptRow accepted={false} withAge />
      </I18nProvider>,
    );
    expect(ui.getByText('Photo and voice analysis')).toBeTruthy();
    expect(ui.getByText(/text of your voice entry, is sent to our AI service provider \(USA\) to estimate calories\. Voice entry is converted to text by your phone’s speech recognition; audio is not recorded\./)).toBeTruthy();
    expect(ui.getByText('Accept')).toBeTruthy();
    expect(ui.getByText('Cancel')).toBeTruthy();
    expect(ui.getByText('I am 18 or older and I have read and accept the Terms of Use and the Privacy Policy.')).toBeTruthy();
  });

  test('modül: kayıt yok + sunucu yok → sor; Kabul → cihaz + user_consents (ai_photo, scan)', async () => {
    expect(await resolveAiPhotoConsent()).toBe('ask');
    await setAiPhotoConsent(true, 'scan');
    expect(await hasLocalAiPhotoConsent()).toBe(true);
    expect(await resolveAiPhotoConsent()).toBe('ok');
    const rows = mockInserts.filter((i) => i.table === 'user_consents').flatMap((i) => i.rows);
    expect(rows.map((r) => [r.kind, r.granted, r.source, r.doc_slug, r.user_id])).toEqual([['ai_photo', true, 'scan', null, 'u1']]);
  });

  test('modül: Tara’da Vazgeç cihaz kaydı yazmaz (yeniden sorulur); ayardan kapatma kalıcı', async () => {
    await setAiPhotoConsent(false, 'scan');
    expect(await AsyncStorage.getItem(AI_PHOTO_KEY)).toBeNull();
    expect(await resolveAiPhotoConsent()).toBe('ask');
    await setAiPhotoConsent(true, 'scan');
    await setAiPhotoConsent(false, 'settings');
    expect(await hasLocalAiPhotoConsent()).toBe(false);
    expect(await resolveAiPhotoConsent()).toBe('ask');
  });

  test('modül: başka cihazda verilmiş izin — G23-S1: sunucu metin sürümü bildirmezse bir kez sorulur, v2 bildirirse sorulmaz', async () => {
    mockRpc = { data: { docs: [], ad_measurement: null, first_party: null, ai_photo: true }, error: null };
    expect(await resolveAiPhotoConsent()).toBe('ask');
    expect(await hasLocalAiPhotoConsent()).toBe(false);
    mockRpc = { data: { docs: [], ad_measurement: null, first_party: null, ai_photo: true, ai_photo_version: 2 }, error: null };
    expect(await resolveAiPhotoConsent()).toBe('ok');
    expect(await hasLocalAiPhotoConsent()).toBe(true);
  });

  test('modül: G23-S1 eski metin (v1) cihaz izni → bir kez yeniden sorulur; kabul → v2 yazılır, bir daha sorulmaz', async () => {
    await AsyncStorage.setItem(AI_PHOTO_KEY, JSON.stringify({ granted: true, at: '2026-11-09T10:00:00Z' }));
    expect(await hasLocalAiPhotoConsent()).toBe(false);
    expect(await resolveAiPhotoConsent()).toBe('ask');
    await setAiPhotoConsent(true, 'scan');
    expect(JSON.parse((await AsyncStorage.getItem(AI_PHOTO_KEY)) as string).v).toBe(2);
    expect(await resolveAiPhotoConsent()).toBe('ok');
    expect(await hasLocalAiPhotoConsent()).toBe(true);
  });
});
