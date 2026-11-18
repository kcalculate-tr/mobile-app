// G63-S1 — Mesajlar bileşenleri: gelen kutusu (sohbetler / istekler / boş hâller), sohbet (gönder, denetimde
// engellenen → nötr hata, hız sınırı istemci hatası, okundu yalnız aktifken, istek hâli kabul/sil, silme süresi,
// gizli hesap, engelle), yeni mesaj (öneri / sonuç / sonuç yok, paylaş kipi), hikâye serbest metin yanıtı,
// paylaş sayfası hedefi, bayrak kapalı = giriş yok.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { TextInput } from 'react-native';
import { act, fireEvent, render as rtlRender, renderHook, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

let mockFlags: Record<string, boolean> = { mesajlar: true, hikaye: true };
jest.mock('../../../core/flags', () => ({ useFeature: (k: string) => !!mockFlags[k] }));
let mockUser: { id: string } | null = { id: 'me' };
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => ({ user: mockUser, session: mockUser ? { user: mockUser } : null }) }));
jest.mock('../../../core/supabase', () => {
  const client = { rpc: jest.fn(), from: jest.fn(), functions: { invoke: jest.fn(async () => ({})) }, auth: { getSession: () => Promise.resolve({ data: { session: null } }) }, channel: jest.fn(), removeChannel: jest.fn() };
  return { supabase: client, getSupabaseClient: () => client };
});
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('../../gun/todayConsumptions', () => ({ getTodayConsumptions: async () => [] }));
jest.mock('../../gun/client', () => ({ getGunClient: () => ({ getDayRings: async () => [] }) }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
const mockNav = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  canGoBack: () => true,
  addListener: jest.fn(() => () => {}),
};
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }), useFocusEffect: () => undefined };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMockDm, type MockDm } from '../mock';
import { resetDmClient, setDmClient } from '../client';
import InboxScreen from '../ui/InboxScreen';
import ChatScreen from '../ui/ChatScreen';
import NewMessageScreen from '../ui/NewMessageScreen';
import { createMockStoryClient, emptyWorld, seedStory } from '../../hikaye/mock';
import { resetStoryClient, setStoryClient } from '../../hikaye/client';
import StoryViewerScreen from '../../hikaye/ui/StoryViewerScreen';
import { ShareSheet } from '../../../components/share/ShareSheet';
import { useShareSheet } from '../../../components/share/useShareSheet';

const metrics = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (el: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={metrics}>{el}</SafeAreaProvider>);
const SRC = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../..', p), 'utf8');
const MIN = 60_000;
// Not: proje jest yapılandırması sahte zamanlayıcıları GLOBAL açar (package.json `fakeTimers.enableGlobally`).

const PEOPLE = [
  { id: 'me', name: 'Ben', handle: 'ben' },
  { id: 'ayse', name: 'Ayşe Kaya', handle: 'ayse' },
  { id: 'can', name: 'Can Demir', handle: 'can' },
  { id: 'dyt', name: 'Elif Tan', handle: 'dytelif', role: 'diyetisyen' },
  { id: 'gizli', name: 'Gizli Hesap', handle: 'gizli', isPrivate: true },
  { id: 'yabanci', name: 'Deniz', handle: 'deniz' },
];

let dm: MockDm;
let now = Date.now();
function setup(opts: Partial<Parameters<typeof createMockDm>[0]> = {}) {
  now = Date.now();
  dm = createMockDm({
    me: 'me',
    people: PEOPLE,
    follows: [['me', 'ayse'], ['ayse', 'me'], ['me', 'dyt'], ['can', 'me']],
    now: () => now,
    blockedWords: ['yasakli'],
    ...opts,
  });
  setDmClient(dm);
  return dm;
}

beforeEach(async () => {
  mockFlags = { mesajlar: true, hikaye: true };
  mockUser = { id: 'me' };
  mockParams = undefined;
  Object.values(mockNav).forEach((f) => typeof f === 'function' && 'mockClear' in f && (f as jest.Mock).mockClear());
  await AsyncStorage.setItem('@kcal_story_coach_seen', '1');
});
afterAll(() => {
  resetDmClient();
  resetStoryClient();
});

// ─── Gelen kutusu ──────────────────────────────────────────────────────────────
test('gelen kutusu: sohbet satırı (okunmamış nokta, sessize alındı, a11y), İstekler (N) sekmesi + not + bağlantı uyarısı', async () => {
  setup();
  dm.seed({ id: 'c-ayse', with: 'ayse', messages: [{ from: 'them', body: 'Tarifi denedim, çok iyi oldu', at: now - 5 * MIN }] });
  dm.seed({ id: 'c-dyt', with: 'dyt', muted: true, myRead: now, messages: [{ from: 'me', body: 'Perşembe görüşürüz', at: now - 60 * MIN }] });
  dm.seed({ id: 'r-deniz', with: 'yabanci', myState: 'request', messages: [{ from: 'them', body: 'Kampanya için www.ornek-kupon.com', at: now - 2 * MIN }] });
  const r = render(<InboxScreen />);
  await waitFor(() => expect(r.getByTestId('dm-row-c-ayse')).toBeTruthy());
  expect(r.getByText('Mesajlar')).toBeTruthy();
  expect(r.getByText('Tarifi denedim, çok iyi oldu')).toBeTruthy();
  expect(r.getByText('Sen: Perşembe görüşürüz')).toBeTruthy();
  expect(r.getByText('Dyt. Elif Tan')).toBeTruthy();
  expect(r.getAllByTestId('dm-unread-dot')).toHaveLength(1);
  expect(r.getByTestId('dm-row-c-dyt').props.accessibilityLabel).toContain('Sessize alındı');
  expect(r.getByTestId('dm-row-c-ayse').props.accessibilityLabel).toContain('okunmamış');
  expect(r.getByText('İstekler (1)')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByTestId('dm-tab-requests'));
  });
  await waitFor(() => expect(r.getByTestId('dm-req-r-deniz')).toBeTruthy());
  expect(r.getByText('Takip etmediğin kişilerden gelen mesajlar. Kabul edene kadar mesajı okuduğunu görmezler.')).toBeTruthy();
  expect(r.getByText('Bağlantı ya da telefon numarası içeriyor')).toBeTruthy();
  expect(r.getByText('Spam olabilecek istekler gizli tutulur.')).toBeTruthy();
  fireEvent.press(r.getByTestId('dm-req-r-deniz'));
  expect(mockNav.navigate).toHaveBeenCalledWith('DmChat', expect.objectContaining({ conversationId: 'r-deniz' }));
});

test('gelen kutusu boş: "Henüz mesajın yok" + Yeni mesaj + Önerilen; istekler boş: Mesaj ayarları → Gizlilik', async () => {
  setup();
  const r = render(<InboxScreen />);
  await waitFor(() => expect(r.getByText('Henüz mesajın yok')).toBeTruthy());
  expect(r.getByTestId('dm-empty-new')).toBeTruthy();
  await waitFor(() => expect(r.getByText('Önerilen')).toBeTruthy());
  expect(r.getByLabelText('Mesaj, Ayşe Kaya')).toBeTruthy();
  expect(r.queryByText('Gizli Hesap')).toBeNull();
  await act(async () => {
    fireEvent.press(r.getByTestId('dm-tab-requests'));
  });
  await waitFor(() => expect(r.getByText('Mesaj isteğin yok')).toBeTruthy());
  fireEvent.press(r.getByTestId('dm-req-settings'));
  expect(mockNav.navigate).toHaveBeenCalledWith('ProfileSub', { sub: 'privacy' });
});

// ─── Sohbet ────────────────────────────────────────────────────────────────────
test('sohbet: gönder → balon; denetimde engellenen içerik gönderilmez (nötr hata, taslağa döner)', async () => {
  setup();
  dm.seed({ id: 'c1', with: 'ayse', messages: [{ from: 'them', body: 'Kaç porsiyon çıkıyor?', at: now - 3 * MIN }] });
  mockParams = { conversationId: 'c1' };
  const r = render(<ChatScreen />);
  await waitFor(() => expect(r.getByText('Kaç porsiyon çıkıyor?')).toBeTruthy());
  expect(r.queryByTestId('dm-send')).toBeNull();
  fireEvent.changeText(r.getByTestId('dm-composer'), '2 porsiyon, porsiyonu 520 kcal');
  await act(async () => {
    fireEvent.press(r.getByTestId('dm-send'));
  });
  await waitFor(() => expect(r.getByText('2 porsiyon, porsiyonu 520 kcal')).toBeTruthy());
  expect(dm.state.msgs.find((m) => m.body === '2 porsiyon, porsiyonu 520 kcal')?.status).toBe('sent');
  expect(dm.calls).toContain('moderate');

  fireEvent.changeText(r.getByTestId('dm-composer'), 'yasakli bir şey');
  await act(async () => {
    fireEvent.press(r.getByTestId('dm-send'));
  });
  await waitFor(() => expect(r.getByText('Mesaj gönderilemedi.')).toBeTruthy());
  expect(r.queryAllByText('yasakli bir şey').filter((n) => n.type === 'Text')).toHaveLength(0);
  expect(r.getByTestId('dm-composer').props.value).toBe('yasakli bir şey');
  expect(dm.state.msgs.find((m) => m.body === 'yasakli bir şey')?.status).toBe('blocked');
});

test('sohbet: dakikada 20 mesaj sınırı → istemci hata metni', async () => {
  setup();
  dm.seed({ id: 'c1', with: 'ayse', messages: [] });
  for (let i = 0; i < 20; i += 1) await dm.send({ conversation: 'c1', body: `m${i}`, kind: 'text', idem: `pre${i}` });
  mockParams = { conversationId: 'c1' };
  const r = render(<ChatScreen />);
  await waitFor(() => expect(r.getByTestId('dm-composer')).toBeTruthy());
  fireEvent.changeText(r.getByTestId('dm-composer'), 'bir tane daha');
  await act(async () => {
    fireEvent.press(r.getByTestId('dm-send'));
  });
  await waitFor(() => expect(r.getByText('Çok hızlı gönderiyorsun. Biraz bekleyip tekrar dene.')).toBeTruthy());
});

test('okundu: aktif sohbette "Görüldü"; istekte (karşı taraf kabul etmedi) yok', async () => {
  setup();
  dm.seed({ id: 'c1', with: 'ayse', otherRead: now, messages: [{ from: 'them', body: 'Selam', at: now - 10 * MIN }, { from: 'me', body: 'Selam!', at: now - 5 * MIN }] });
  mockParams = { conversationId: 'c1' };
  const r = render(<ChatScreen />);
  await waitFor(() => expect(r.getByTestId('dm-seen')).toBeTruthy());
  expect(r.getByText('Görüldü')).toBeTruthy();
  r.unmount();

  dm.seed({ id: 'c2', with: 'yabanci', otherState: 'request', otherRead: now, messages: [{ from: 'me', body: 'Merhaba', at: now - 5 * MIN }] });
  mockParams = { conversationId: 'c2' };
  const r2 = render(<ChatScreen />);
  await waitFor(() => expect(r2.getByText('Merhaba')).toBeTruthy());
  expect(r2.queryByTestId('dm-seen')).toBeNull();
});

test('istek hâli: profil bloğu + Engelle · Sil · Kabul et; yazma çubuğu yok; Kabul → yazma çubuğu', async () => {
  setup();
  dm.seed({ id: 'r1', with: 'yabanci', myState: 'request', messages: [{ from: 'them', body: 'Pazar atölyesinde görüşelim mi?', at: now - MIN }] });
  mockParams = { conversationId: 'r1' };
  const r = render(<ChatScreen />);
  await waitFor(() => expect(r.getByTestId('dm-req-bar')).toBeTruthy());
  expect(r.getByText('Deniz sana mesaj göndermek istiyor')).toBeTruthy();
  expect(r.getByText('Bu kişiyi takip etmiyorsun')).toBeTruthy();
  expect(r.queryByTestId('dm-composer')).toBeNull();
  await act(async () => {
    fireEvent.press(r.getByTestId('dm-req-accept'));
  });
  await waitFor(() => expect(r.getByTestId('dm-composer')).toBeTruthy());
  expect(dm.calls).toContain('accept');
});

test('istek: Sil → reddet + geri; bağlantılı ilk mesajda uyarı', async () => {
  setup();
  dm.seed({ id: 'r2', with: 'yabanci', myState: 'request', messages: [{ from: 'them', body: 'Ara beni 0532 123 45 67', at: now - MIN }] });
  mockParams = { conversationId: 'r2' };
  const r = render(<ChatScreen />);
  await waitFor(() => expect(r.getByTestId('dm-risky')).toBeTruthy());
  await act(async () => {
    fireEvent.press(r.getByTestId('dm-req-delete'));
  });
  expect(dm.calls).toContain('decline');
  expect(mockNav.goBack).toHaveBeenCalled();
});

test('silme süresi: 15 dk içindeki kendi mesajım silinir; eski mesajda seçenek yok', async () => {
  setup();
  dm.seed({ id: 'c1', with: 'ayse', messages: [{ from: 'me', body: 'Eski mesaj', at: now - 20 * MIN }, { from: 'me', body: 'Yeni mesaj', at: now - 2 * MIN }] });
  mockParams = { conversationId: 'c1' };
  const r = render(<ChatScreen />);
  await waitFor(() => expect(r.getByText('Yeni mesaj')).toBeTruthy());
  const oldId = dm.state.msgs.find((m) => m.body === 'Eski mesaj')!.id;
  const newId = dm.state.msgs.find((m) => m.body === 'Yeni mesaj')!.id;
  fireEvent(r.getByTestId(`dm-msg-${oldId}`), 'longPress');
  expect(r.queryByTestId('dm-msg-actions')).toBeNull();
  fireEvent(r.getByTestId(`dm-msg-${newId}`), 'longPress');
  await waitFor(() => expect(r.getByTestId('dm-msg-delete')).toBeTruthy());
  await act(async () => {
    fireEvent.press(r.getByTestId('dm-msg-delete'));
  });
  await waitFor(() => expect(r.queryByText('Yeni mesaj')).toBeNull());
  expect(dm.state.msgs.find((m) => m.id === newId)?.deleted).toBe(true);
});

test('gizli hesap: takipçi değilsen sohbet açılmaz, nötr açıklama', async () => {
  setup();
  mockParams = { userId: 'gizli', name: 'Gizli Hesap', handle: 'gizli' };
  const r = render(<ChatScreen />);
  await waitFor(() => expect(r.getByText('Bu hesap gizli. Mesaj göndermek için takip isteğinin onaylanması gerekir.')).toBeTruthy());
  expect(r.queryByTestId('dm-composer')).toBeNull();
});

test('engelle: menü → Engelle → onay → user_blocks + "[Ad] engellendi"; karşı taraf engellediyse yazılamaz', async () => {
  setup();
  dm.seed({ id: 'c1', with: 'ayse', messages: [{ from: 'them', body: 'Selam', at: now - MIN }] });
  mockParams = { conversationId: 'c1' };
  const r = render(<ChatScreen />);
  await waitFor(() => expect(r.getByText('Selam')).toBeTruthy());
  fireEvent.press(r.getByTestId('dm-chat-options'));
  await waitFor(() => expect(r.getByTestId('dm-menu')).toBeTruthy());
  fireEvent.press(r.getByTestId('dm-menu-mute'));
  expect(r.getByTestId('dm-menu-mute').props.accessibilityState).toEqual({ checked: true });
  fireEvent.press(r.getByTestId('dm-menu-block'));
  await waitFor(() => expect(r.getByTestId('dm-block-alert')).toBeTruthy());
  expect(r.getByText('Ayşe Kaya engellensin mi?')).toBeTruthy();
  await act(async () => {
    fireEvent.press(r.getByTestId('dm-block-confirm'));
  });
  await waitFor(() => expect(r.getByText('Ayşe Kaya engellendi')).toBeTruthy());
  expect(dm.calls).toContain('block:ayse');
  r.unmount();

  // Ters yön: o beni engellediyse sohbet okunamaz / yazılamaz.
  const d2 = setup({ blocks: [['can', 'me']] });
  d2.seed({ id: 'c2', with: 'can', messages: [{ from: 'them', body: 'Eski', at: now - 10 * MIN }] });
  mockParams = { conversationId: 'c2' };
  const r2 = render(<ChatScreen />);
  await waitFor(() => expect(r2.getByText('Bu sohbete mesaj gönderemezsin.')).toBeTruthy());
  expect(r2.queryByText('Eski')).toBeNull();
});

// ─── Yeni mesaj ────────────────────────────────────────────────────────────────
test('yeni mesaj: öneri → arama sonucu (rol çipi) → sonuç yok; kişi seçimi sohbete gider', async () => {
  setup();
  const r = render(<NewMessageScreen />);
  await act(async () => {
    await Promise.resolve();
  });
  await waitFor(() => expect(r.getByText('Önerilen')).toBeTruthy());
  fireEvent.changeText(r.getByTestId('dm-new-input'), 'elif');
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await waitFor(() => expect(r.getByText('Kişiler')).toBeTruthy());
  expect(r.getByText('Diyetisyen')).toBeTruthy();
  fireEvent.changeText(r.getByTestId('dm-new-input'), 'kcal_yok');
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await waitFor(() => expect(r.getByText('“kcal_yok” için kimse bulunamadı')).toBeTruthy());
  expect(r.getByTestId('dm-new-invite')).toBeTruthy();
  fireEvent.changeText(r.getByTestId('dm-new-input'), 'ayse');
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await waitFor(() => expect(r.getByTestId('dm-new-person-ayse')).toBeTruthy());
  await act(async () => {
    fireEvent.press(r.getByTestId('dm-new-person-ayse'));
  });
  expect(mockNav.replace).toHaveBeenCalledWith('DmChat', expect.objectContaining({ name: 'Ayşe Kaya' }));
});

test('paylaş kipi: kişi seçilince gönderi kind=post olarak gider', async () => {
  setup();
  mockParams = { share: { kind: 'post', postId: '3f2a9c1e-7b44-4d2a-9a51-0c8e2d1f6b77' } };
  const r = render(<NewMessageScreen />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(r.getByText('Mesajla gönder')).toBeTruthy();
  await waitFor(() => expect(r.getByTestId('dm-new-person-ayse')).toBeTruthy());
  await act(async () => {
    fireEvent.press(r.getByTestId('dm-new-person-ayse'));
  });
  const sent = dm.state.msgs.find((m) => m.kind === 'post');
  expect(sent?.ref).toEqual({ post_id: '3f2a9c1e-7b44-4d2a-9a51-0c8e2d1f6b77' });
  expect(sent?.status).toBe('sent');
});

// ─── Hikâye serbest metin yanıtı ───────────────────────────────────────────────
function storyWorld() {
  const W = emptyWorld('me', Date.now());
  W.users.push({ id: 'ayse', name: 'Ayşe Kaya', handle: 'ayse' });
  W.follows.push(['me', 'ayse']);
  seedStory(W, { id: 's1', author_id: 'ayse' }, 1);
  setStoryClient(createMockStoryClient(W));
}

test('hikâye: mesajlar açıkken yanıt alanı → DM story_reply; kapalıyken metin alanı yok', async () => {
  setup();
  storyWorld();
  mockParams = { userIds: ['ayse'], startUserId: 'ayse' };
  const r = render(<StoryViewerScreen />);
  await waitFor(() => expect(r.getByTestId('story-viewer-reply-open')).toBeTruthy());
  fireEvent.press(r.getByTestId('story-viewer-reply-open'));
  await waitFor(() => expect(r.getByTestId('story-reply-input')).toBeTruthy());
  expect(r.getByTestId('story-reply-send').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  fireEvent.changeText(r.getByTestId('story-reply-input'), 'Bu kahvaltıyı yarın deneyeceğim');
  await act(async () => {
    fireEvent.press(r.getByTestId('story-reply-send'));
  });
  await waitFor(() => expect(dm.state.msgs.some((m) => m.kind === 'story_reply')).toBe(true));
  const m = dm.state.msgs.find((x) => x.kind === 'story_reply')!;
  expect(m.body).toBe('Bu kahvaltıyı yarın deneyeceğim');
  expect(m.ref).toEqual({ story_id: 's1' });
  expect(m.status).toBe('sent');
  r.unmount();

  mockFlags = { mesajlar: false, hikaye: true };
  storyWorld();
  const r2 = render(<StoryViewerScreen />);
  await waitFor(() => expect(r2.getByTestId('story-viewer-reply-open')).toBeTruthy());
  fireEvent.press(r2.getByTestId('story-viewer-reply-open'));
  expect(r2.getByTestId('story-viewer-reply')).toBeTruthy();
  expect(r2.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
});

// ─── Paylaş sayfası + bayrak kapalı ───────────────────────────────────────────
test('paylaş sayfası: "Mesajla gönder" hedefi yalnız verilince; useShareSheet bayrağa bağlı', async () => {
  mockFlags = { mesajlar: true, paylasim_karti: true, paylasim_baglanti: true };
  const POST = { kind: 'post' as const, data: { authorName: 'Ayşe', handle: 'ayse', text: 'Kase', imageUri: null } };
  const onSend = jest.fn();
  const r = render(<ShareSheet visible onClose={() => {}} input={POST} linkId="3f2a9c1e-7b44-4d2a-9a51-0c8e2d1f6b77" linkEnabled surface="test" forcePhase="default" onSendMessage={onSend} />);
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  expect(r.getByLabelText('Mesajla gönder')).toBeTruthy();
  fireEvent.press(r.getByTestId('share-target-dm'));
  expect(onSend).toHaveBeenCalled();
  r.unmount();
  const r2 = render(<ShareSheet visible onClose={() => {}} input={POST} linkId="x" linkEnabled surface="test" forcePhase="default" />);
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  expect(r2.queryByTestId('share-target-dm')).toBeNull();
  const src = SRC('components/share/useShareSheet.tsx');
  expect(src).toContain("mesajlar && req?.input.kind === 'post' && req.linkId");
  const h = renderHook(() => useShareSheet('test'));
  expect(h.result.current.enabled).toBe(true);
});

test('bayrak kapalı: giriş yok — Keşfet simgesi, profil "Mesaj", hikâye alanı ve rotalar bayrağa bağlı', () => {
  const kesfet = SRC('modules/kesfet/ui/KesfetScreen.tsx');
  expect(kesfet).toContain("const mesajlar = useFeature('mesajlar');");
  expect(kesfet).toContain("dm={mesajlar ? { unread: dmUnread, onPress: () => navigation.navigate('DmInbox') } : undefined}");
  expect(kesfet).toContain('if (mesajlar) void useDmBadge.getState().refresh();');
  const profile = SRC('modules/profil/ui/PublicProfileScreen.tsx');
  expect(profile).toContain('mesajlar && !isMe && !profile.blocked && canMessageProfile(profile)');
  const viewer = SRC('modules/hikaye/ui/StoryViewerScreen.tsx');
  expect(viewer).toContain('{mesajlar ? (\n                <KeyboardAvoidingView');
  const nav = SRC('navigation/AppNavigator.tsx');
  expect(nav).toContain("const mesajlarEnabled = useFeature('mesajlar');");
});
