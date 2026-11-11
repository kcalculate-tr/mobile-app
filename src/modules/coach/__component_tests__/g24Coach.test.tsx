// G24-S1 md.3 — kcalAI Koç istemci: girişler bayrak `koc` kapalıyken / coach-chat 404 iken gizli
// (çökme yok); sohbet hâlleri (empty · chat · limit · trial · upsell · error · safety); AI izni ilk
// mesajdan önce; "Koç:" / "Sen:" VoiceOver etiketleri; geçmiş (liste · silme · boş); tanıtım.
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), canGoBack: () => true };
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    useNavigation: () => mockNav,
    useRoute: () => ({ params: mockParams }),
    // Fabrika import'tan önce çalışır (mockNav henüz yok) → vekil nesne.
    NavigationContext: R.createContext({ navigate: (...a: unknown[]) => (mockNav.navigate as (...x: unknown[]) => void)(...a) }),
  };
});

let mockFlags: Record<string, boolean> = {};
jest.mock('../../../core/flags', () => ({ useFeature: (k: string) => !!mockFlags[k], useFlagsContext: () => ({ ready: true }) }));
jest.mock('../../../hooks/useNutritionSummary', () => ({
  useNutritionSummary: () => ({ summary: { consumedKcal: 1240, targetKcal: 2000, consumedProtein: 62, targetProtein: 100 }, loading: false, error: null, refetch: jest.fn() }),
}));

// supabase taklidi: functions.invoke (coach-chat), rpc (my_coach_status / delete_coach_history), coach_messages.
type InvokeRes = { data: unknown; error: unknown };
const mockInvoke = jest.fn<Promise<InvokeRes>, [string, { body?: unknown; method?: string }]>();
const mockRpc = jest.fn<Promise<InvokeRes>, [string]>();
let mockRows: unknown[] = [];
const mockUpdate = jest.fn();
jest.mock('../../../core/supabase', () => {
  const chain = () => {
    const q: Record<string, unknown> = {};
    const self = () => q;
    q.select = self;
    q.order = self;
    q.eq = (..._a: unknown[]) => Promise.resolve({ error: null });
    q.limit = () => Promise.resolve({ data: mockRows, error: null });
    q.insert = () => Promise.resolve({ error: null });
    q.update = (patch: unknown) => {
      mockUpdate(patch);
      return { eq: () => Promise.resolve({ error: null }) };
    };
    return q;
  };
  const client = {
    from: () => chain(),
    rpc: (name: string) => mockRpc(name),
    functions: { invoke: (name: string, opts: { body?: unknown; method?: string }) => mockInvoke(name, opts) },
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }) },
  };
  return { supabase: client, getSupabaseClient: () => client };
});

// eslint-disable-next-line import/first
import { CoachHomeCard, CoachProfileRow, CoachRecipeButton, CoachScanButton } from '../ui/entries';
// eslint-disable-next-line import/first
import CoachChatScreen from '../screens/CoachChatScreen';
// eslint-disable-next-line import/first
import CoachHistoryScreen from '../screens/CoachHistoryScreen';
// eslint-disable-next-line import/first
import CoachIntroScreen from '../screens/CoachIntroScreen';
// eslint-disable-next-line import/first
import { COACH_CONSENT_KEY, INTRO_KEY, useCoachAccessStore } from '../access';
// eslint-disable-next-line import/first
import { useSubscriptionStore } from '../../../lib/subscription/purchases';

const STATUS_BAL = { used: 0, limit: 30, kind: 'daily', tier: 'balance', remaining: 30, resets_at: '2026-11-11T21:00:00Z' };
const STATUS_TRIAL = { used: 0, limit: 3, kind: 'trial', tier: 'free', remaining: 3, resets_at: null };

function httpError(status: number, body: unknown) {
  return { name: 'FunctionsHttpError', context: { status, clone: () => ({ json: () => Promise.resolve(body) }) } };
}

let mockStatus: unknown = STATUS_BAL;
beforeEach(async () => {
  jest.clearAllMocks();
  mockFlags = { koc: true, abonelik: true };
  useSubscriptionStore.setState({ available: true });
  mockParams = undefined;
  mockRows = [];
  mockStatus = STATUS_BAL;
  useCoachAccessStore.setState({ avail: 'unknown' });
  await AsyncStorage.clear();
  mockRpc.mockImplementation(async (name: string) => {
    if (name === 'my_coach_status') return { data: mockStatus, error: null };
    if (name === 'delete_coach_history') return { data: 3, error: null };
    return { data: null, error: null };
  });
  // Yoklama (GET) → fonksiyon var (405); gönderim varsayılanı aşağıda testlerde.
  mockInvoke.mockImplementation(async (_n, opts) => (opts.method === 'GET' ? { data: null, error: httpError(405, { error: 'method' }) } : { data: null, error: null }));
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const ENTRIES = () => (
  <>
    <CoachHomeCard consumedKcal={1200} targetKcal={2000} proteinLeft={38} />
    <CoachScanButton meal={{ name: 'Somon kase', kcal: 540, protein: 40, carbs: 50, fat: 15 }} />
    <CoachProfileRow />
    <CoachRecipeButton postId="p1" name="Somon kinoa kase" />
  </>
);

test('bayrak `koc` KAPALI → bütün girişler gizli, yoklama yapılmaz', async () => {
  mockFlags = { koc: false };
  const r = render(<ENTRIES />);
  await flush();
  for (const id of ['coach-home-card', 'coach-scan-open', 'coach-profile-row', 'coach-recipe-fit']) expect(r.queryByTestId(id)).toBeNull();
  expect(mockInvoke).not.toHaveBeenCalled();
});

test('G25 md.12: `koc` AÇIK ama `abonelik` KAPALI → bütün girişler gizli, yoklama yapılmaz', async () => {
  mockFlags = { koc: true, abonelik: false };
  const r = render(<ENTRIES />);
  await flush();
  for (const id of ['coach-home-card', 'coach-scan-open', 'coach-profile-row', 'coach-recipe-fit']) expect(r.queryByTestId(id)).toBeNull();
  expect(mockInvoke).not.toHaveBeenCalled();
});

test('G25 md.12: iki bayrak açık ama RevenueCat yapılandırılmadı → girişler gizli', async () => {
  useSubscriptionStore.setState({ available: false });
  const r = render(<ENTRIES />);
  await flush();
  for (const id of ['coach-home-card', 'coach-scan-open', 'coach-profile-row', 'coach-recipe-fit']) expect(r.queryByTestId(id)).toBeNull();
  expect(mockInvoke).not.toHaveBeenCalled();
});

test('bayrak açık ama coach-chat yok (404) → girişler gizli, çökme yok', async () => {
  mockInvoke.mockImplementation(async () => ({ data: null, error: httpError(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }) }));
  const r = render(<ENTRIES />);
  await flush();
  await waitFor(() => expect(useCoachAccessStore.getState().avail).toBe('missing'));
  for (const id of ['coach-home-card', 'coach-scan-open', 'coach-profile-row', 'coach-recipe-fit']) expect(r.queryByTestId(id)).toBeNull();
});

test('bayrak açık + fonksiyon var → girişler görünür; Ana sayfa soru önceden doldurulmuş açılır (tanıtım bir kez)', async () => {
  const r = render(<ENTRIES />);
  await waitFor(() => expect(r.getByTestId('coach-home-card')).toBeTruthy());
  expect(r.getByText('Protein hedefine 38 g kaldı. Akşam için 3 öneri ister misin?')).toBeTruthy();
  expect(r.getByText('3 deneme mesajı hediye')).toBeTruthy();
  expect(r.getByTestId('coach-profile-row').props.accessibilityLabel).toBe('AI Koç, beslenme ve günlük takip, Balance planında');
  expect(r.getByText('Bu tarif bana uyar mı?')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByTestId('coach-home-open'));
  });
  await flush();
  expect(mockNav.navigate).toHaveBeenCalledWith('CoachIntro', { from: 'home', prefill: 'Proteinimi tamamlamak için akşam için 3 öneri verir misin?' });
  await AsyncStorage.setItem(INTRO_KEY, '1');
  await act(async () => {
    fireEvent.press(r.getByTestId('coach-recipe-fit'));
  });
  await flush();
  expect(mockNav.navigate).toHaveBeenLastCalledWith('CoachChat', { from: 'recipe', prefill: 'Bu tarif (Somon kinoa kase) bana uyar mı?', ref: { type: 'recipe', post_id: 'p1' } });
  await act(async () => {
    fireEvent.press(r.getByTestId('coach-scan-open'));
  });
  await flush();
  expect(mockNav.navigate).toHaveBeenLastCalledWith('CoachChat', expect.objectContaining({ from: 'scan', ref: { type: 'scan', name: 'Somon kase', kcal: 540, protein: 40, carbs: 50, fat: 15 } }));
});

test('sohbet boş hâli: selam + 4 hazır soru + hap "Bugün 30/30" Balance + sabit satır; modül yoksa mikrofon gizli', async () => {
  const r = render(<CoachChatScreen />);
  await waitFor(() => expect(r.getByTestId('coach-empty')).toBeTruthy());
  expect(r.getByText('Merhaba, ben kcalAI Koç')).toBeTruthy();
  for (const q of ['Bugün nasıl gidiyorum?', 'Akşam ne yesem?', 'Proteinimi nasıl tamamlarım?', 'Haftamı özetle']) expect(r.getByTestId(`coach-chip-${q}`)).toBeTruthy();
  expect(r.getByTestId('coach-pill').props.accessibilityLabel).toBe('Bugünkü Koç mesaj hakkın: 30 mesajdan 30 kaldı');
  expect(r.getByText('Bugün 30/30')).toBeTruthy();
  expect(r.getByText('Balance')).toBeTruthy();
  expect(r.getByText('Koç tıbbi tavsiye vermez.')).toBeTruthy();
  expect(r.getByText('Bugün %62, 760 kcal kaldı')).toBeTruthy();
  expect(r.queryByTestId('coach-mic')).toBeNull();
});

test('ilk mesajdan önce AYRI AI izni; kabul → gönderilir, yanıt "Koç:" etiketiyle, kartlar ve geri bildirim', async () => {
  mockInvoke.mockImplementation(async (_n, opts) => {
    if (opts.method === 'GET') return { data: null, error: httpError(405, {}) };
    return {
      data: {
        user_message: { id: 'm1', role: 'user', body: 'Proteinimi nasıl tamamlarım?', cards: null, feedback: null, created_at: new Date().toISOString() },
        reply: {
          id: 'm2', role: 'assistant', body: 'Protein hedefine 38 g kaldı.', feedback: null, created_at: new Date().toISOString(),
          cards: [{ type: 'meal_suggestion', name: 'Izgara tavuk, bulgur pilavı ve cacık', kcal: 540, p: 42, c: 52, f: 14 }],
        },
        status: { ...STATUS_BAL, used: 1 },
      },
      error: null,
    };
  });
  mockParams = { prefill: 'Proteinimi nasıl tamamlarım?' };
  const r = render(<CoachChatScreen />);
  await waitFor(() => expect(r.getByTestId('coach-empty')).toBeTruthy());
  expect(r.getByTestId('coach-input').props.value).toBe('Proteinimi nasıl tamamlarım?');
  await act(async () => {
    fireEvent.press(r.getByTestId('coach-send'));
  });
  // İzin sheet'i (metin tek yerden).
  expect(r.getByTestId('consent-sheet-ai_coach')).toBeTruthy();
  expect(mockInvoke).not.toHaveBeenCalledWith('coach-chat', expect.objectContaining({ body: expect.anything() }));
  await act(async () => {
    fireEvent.press(r.getByTestId('consent-sheet-ai_coach-accept'));
  });
  await flush();
  await waitFor(() => expect(r.getByTestId('coach-reply')).toBeTruthy());
  expect(JSON.parse((await AsyncStorage.getItem(COACH_CONSENT_KEY)) ?? '{}').granted).toBe(true);
  expect(mockInvoke).toHaveBeenCalledWith('coach-chat', { body: { message: 'Proteinimi nasıl tamamlarım?', lang: 'tr' } });
  expect(r.getByTestId('coach-me').props.accessibilityLabel).toBe('Sen: Proteinimi nasıl tamamlarım?');
  expect(r.getByTestId('coach-reply').props.accessibilityLabel).toBe('Koç: Protein hedefine 38 g kaldı.');
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await waitFor(() => expect(r.getByTestId('coach-meal-add-0')).toBeTruthy());
  expect(r.getByText('Bugün 29/30')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByTestId('coach-fb-up'));
  });
  expect(mockUpdate).toHaveBeenCalledWith({ feedback: 1 });
  expect(r.getByText('Teşekkürler')).toBeTruthy();
});

test('Limit hâli (Balance 30/30): "yarın 00.00’da yenilenir", alan kapalı', async () => {
  mockStatus = { ...STATUS_BAL, used: 30, remaining: 0 };
  mockRows = [
    { id: 'a2', role: 'assistant', body: 'Güzel gidiyorsun!', cards: null, feedback: null, created_at: new Date().toISOString() },
    { id: 'a1', role: 'user', body: 'Bugün nasıl gidiyorum?', cards: null, feedback: null, created_at: new Date(Date.now() - 1000).toISOString() },
  ];
  await AsyncStorage.setItem(COACH_CONSENT_KEY, JSON.stringify({ granted: true, v: 1 }));
  const r = render(<CoachChatScreen />);
  await waitFor(() => expect(r.getByTestId('coach-limit')).toBeTruthy());
  expect(r.getByText('Bugünkü mesaj hakkın doldu, yarın 00.00’da yenilenir.')).toBeTruthy();
  expect(r.getByTestId('coach-input').props.editable).toBe(false);
  expect(r.getByTestId('coach-input').props.placeholder).toBe('00.00’da tekrar yazabilirsin');
  expect(r.getByText('Bugün 0/30')).toBeTruthy();
});

test('Deneme: hap "Deneme N/3" + tanıtım satırı; deneme bitince "Koç Balance’ta" → koçlu paywall (Balance Yıllık)', async () => {
  mockStatus = { ...STATUS_TRIAL, used: 1, remaining: 2 };
  mockRows = [
    { id: 'a2', role: 'assistant', body: 'Güzel gidiyorsun!', cards: null, feedback: null, created_at: new Date().toISOString() },
    { id: 'a1', role: 'user', body: 'Bugün nasıl gidiyorum?', cards: null, feedback: null, created_at: new Date(Date.now() - 1000).toISOString() },
  ];
  const r = render(<CoachChatScreen />);
  await waitFor(() => expect(r.getByText('Deneme 2/3')).toBeTruthy());
  expect(r.getByTestId('coach-trial-intro')).toBeTruthy();
  r.unmount();

  mockStatus = { ...STATUS_TRIAL, used: 3, remaining: 0 };
  const r2 = render(<CoachChatScreen />);
  await waitFor(() => expect(r2.getByText('Deneme 0/3')).toBeTruthy());
  expect(r2.getByTestId('coach-input').props.placeholder).toBe('Deneme mesajların bitti');
  await act(async () => {
    fireEvent.press(r2.getByTestId('coach-send'));
  });
  expect(r2.getByTestId('coach-upsell')).toBeTruthy();
  expect(r2.getByText('3 deneme mesajını kullandın. Koç ile devam etmek için kcalAI Balance’a geç.')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r2.getByTestId('coach-upsell-plans'));
  });
  expect(mockNav.navigate).toHaveBeenCalledWith('SubPaywall', { from: 'coach', coach: true, plan: 'balance', yearly: true });
});

test('Hata (ağ yok): "Yanıt alınamadı" + hak düşmedi + Tekrar dene', async () => {
  await AsyncStorage.setItem(COACH_CONSENT_KEY, JSON.stringify({ granted: true, v: 1 }));
  mockInvoke.mockImplementation(async (_n, opts) => (opts.method === 'GET' ? { data: null, error: httpError(405, {}) } : { data: null, error: { name: 'FunctionsFetchError' } }));
  const r = render(<CoachChatScreen />);
  await waitFor(() => expect(r.getByTestId('coach-empty')).toBeTruthy());
  await act(async () => {
    fireEvent.press(r.getByTestId('coach-chip-Bugün nasıl gidiyorum?'));
  });
  await flush();
  await waitFor(() => expect(r.getByTestId('coach-error')).toBeTruthy());
  expect(r.getByText('İnternet bağlantın yok gibi görünüyor. Bu mesaj günlük hakkından düşmedi.')).toBeTruthy();
  expect(r.getByText('Bugün 30/30')).toBeTruthy();
  expect(r.getByTestId('coach-retry')).toBeTruthy();
});

test('Gönderimde 404 → girişler gizlenir, ekran geri döner (çökme yok)', async () => {
  await AsyncStorage.setItem(COACH_CONSENT_KEY, JSON.stringify({ granted: true, v: 1 }));
  mockInvoke.mockImplementation(async () => ({ data: null, error: httpError(404, { code: 'NOT_FOUND' }) }));
  const r = render(<CoachChatScreen />);
  await waitFor(() => expect(r.getByTestId('coach-empty')).toBeTruthy());
  await act(async () => {
    fireEvent.press(r.getByTestId('coach-chip-Akşam ne yesem?'));
  });
  await flush();
  await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
  expect(useCoachAccessStore.getState().avail).toBe('missing');
});

test('Güvenlik yanıtı: "Bir uzmana danış" kartı + 112 satırı', async () => {
  mockRows = [
    { id: 's2', role: 'assistant', body: 'Bunu sorduğun için teşekkürler.', cards: [{ type: 'safety', variant: 'medical' }], feedback: null, created_at: new Date().toISOString() },
    { id: 's1', role: 'user', body: 'Kan şekerim düşük, ne yapmalıyım?', cards: null, feedback: null, created_at: new Date(Date.now() - 1000).toISOString() },
  ];
  const r = render(<CoachChatScreen />);
  await waitFor(() => expect(r.getByTestId('coach-safety-medical')).toBeTruthy());
  expect(r.getByText('Bir uzmana danış')).toBeTruthy();
  expect(r.getByText('Kendini kötü hissediyorsan beklemeden 112’yi ara.')).toBeTruthy();
});

test('Geçmiş: gün grupları, silme uyarısı → boş hâl + "Geçmiş silindi"', async () => {
  const now = Date.now();
  mockRows = [
    { id: 'h2', role: 'assistant', body: 'Güzel gidiyorsun!', cards: null, feedback: null, created_at: new Date(now).toISOString() },
    { id: 'h1', role: 'user', body: 'Bugün nasıl gidiyorum?', cards: null, feedback: null, created_at: new Date(now - 1000).toISOString() },
  ];
  const r = render(<CoachHistoryScreen />);
  await waitFor(() => expect(r.getByText('Bugün nasıl gidiyorum?')).toBeTruthy());
  expect(r.getByText('Bugün')).toBeTruthy();
  expect(r.getByText('Sohbetler 30 gün saklanır. Devam etmek için birine dokun.')).toBeTruthy();
  fireEvent.press(r.getByTestId('coach-history-item-h1'));
  expect(mockNav.navigate).toHaveBeenCalledWith('CoachChat', { focusId: 'h1' });
  fireEvent.press(r.getByTestId('coach-history-delete'));
  expect(r.getByText('Sohbet geçmişi silinsin mi?')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByTestId('coach-delete-confirm'));
  });
  await waitFor(() => expect(r.getByTestId('coach-history-empty')).toBeTruthy());
  expect(mockRpc).toHaveBeenCalledWith('delete_coach_history');
});

test('Geçmiş boş hâli', async () => {
  const r = render(<CoachHistoryScreen />);
  await waitFor(() => expect(r.getByTestId('coach-history-empty')).toBeTruthy());
  expect(r.getByText('Henüz sohbet yok')).toBeTruthy();
});

test('Tanıtım: ne yapar / ne yapmaz (egzersiz "Yakında" satırı YOK — G31), Başla → sohbet, bir kez', async () => {
  mockParams = { from: 'profile', prefill: 'x' };
  const r = render(<CoachIntroScreen />);
  expect(r.getByText('Günün durumunu yorumlar')).toBeTruthy();
  expect(r.getByText('Tıbbi tavsiye ya da teşhis vermez')).toBeTruthy();
  expect(r.queryByText('Yakında')).toBeNull();
  expect(r.queryByText('Egzersiz programı yazmaz')).toBeNull();
  expect(r.getByText('Balance’ta her gün 30 mesaj. Ücretsiz ve Fresh’te 3 deneme mesajı.')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByTestId('coach-intro-start'));
  });
  expect(mockNav.replace).toHaveBeenCalledWith('CoachChat', { from: 'profile', prefill: 'x' });
  await flush();
  expect(await AsyncStorage.getItem(INTRO_KEY)).toBe('1');
});
