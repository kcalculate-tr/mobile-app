// G59-S1 — Hikâye bileşenleri: tepsi (lime/gri halka, "Hikâyen +"), görüntüleyici (ilk görülmemişten açılır,
// görüldü işareti, dokunma bölgeleri, basılı tut duraklat, hızlı tepkiler — serbest metin YOK, anket oyu,
// öğün → Günlüğüne ekle, gizli/engelli görünmez), görenler (yalnız sahibi, filtre), düzenleyici (yazı katmanı →
// paylaş = katmanlı create_story, metin → moderate-content), öne çıkanlar (oluştur), kamera (mod sekmeleri bayrağa
// bağlı), bayrak kapalıyken giriş yok, personel hakkı koruması.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render as rtlRender, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TextInput } from 'react-native';

let mockFlags: Record<string, boolean> = { hikaye: true, kesfet_video: true, kesfet_paylasim: true, koc: true, paylasim_baglanti: false, su_takibi: false };
jest.mock('../../../core/flags', () => ({ useFeature: (k: string) => !!mockFlags[k] }));
let mockUser: { id: string } | null = { id: 'me' };
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
const mockNav = { navigate: jest.fn(), push: jest.fn(), goBack: jest.fn(), replace: jest.fn(), canGoBack: () => true, addListener: jest.fn(() => () => {}) };
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }), useFocusEffect: () => undefined };
});
jest.mock('../../gun/todayConsumptions', () => ({
  getTodayConsumptions: async () => [
    { id: 'mc1', name: 'Somon kinoa kase', meal_type: 'lunch', kcal: 520, consumed_at: '2026-11-17T10:00:00Z', protein_g: 38, carbs_g: 52, fat_g: 16, photo_url: null },
  ],
}));
jest.mock('../../gun/client', () => ({ getGunClient: () => ({ getDayRings: async () => [{ user: { id: 'me' }, progress: 0.6, streak: 7, has_new: false }] }) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import { createMockStoryClient, emptyWorld, seedStory, type MockWorld } from '../mock';
import { resetStoryClient, setStoryClient } from '../client';
import { useStoryTray, viewerQueue } from '../store';
import { StoryTray } from '../ui/StoryTray';
import StoryViewerScreen from '../ui/StoryViewerScreen';
import StoryEditorScreen from '../ui/StoryEditorScreen';
import StoryCameraScreen from '../ui/StoryCameraScreen';
import { StoryViewersSheet } from '../ui/StoryViewersSheet';
import { HighlightSheet, HighlightsRow } from '../ui/Highlights';
import { LIME } from '../ui/tokens';
import type { StoryOverlay } from '../types';
import { mapRevenueCatEvent } from '../../../../supabase/functions/revenuecat-webhook/mapping';

const metrics = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (el: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={metrics}>{el}</SafeAreaProvider>);
const SRC = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');

const poll: StoryOverlay = { id: 'p1', kind: 'poll', x: 0.5, y: 0.3, scale: 1, rotation: 0, z: 2, data: { question: 'Meal prep yaptın mı?', options: ['Evet', 'Hayır'], skin: 'light' } };
const meal: StoryOverlay = { id: 'm1', kind: 'meal', x: 0.4, y: 0.6, scale: 1, rotation: -6, z: 1, data: { name: 'Somon kinoa kase', meal_type: 'lunch', kcal: 520, protein_g: 38, carbs_g: 52, fat_g: 16, image_url: null, show_macros: true, skin: 'light' } };

let W: MockWorld;
function world() {
  W = emptyWorld('me', Date.now());
  W.users.push(
    { id: 'ayse', name: 'Ayşe', handle: 'ayse' },
    { id: 'gizli', name: 'Gizli', handle: 'gizli', is_private: true },
    { id: 'eng', name: 'Engelli', handle: 'eng' },
  );
  W.follows.push(['me', 'ayse'], ['me', 'eng']);
  W.blocks.push(['eng', 'me']);
  seedStory(W, { id: 'a1', author_id: 'ayse' }, 3);
  seedStory(W, { id: 'a2', author_id: 'ayse', overlays: [poll, meal] }, 2);
  seedStory(W, { id: 'g1', author_id: 'gizli' }, 1);
  seedStory(W, { id: 'e1', author_id: 'eng' }, 1);
  W.views.push({ story: 'a1', viewer: 'me', at: new Date().toISOString() });
  const c = createMockStoryClient(W);
  setStoryClient(c);
  return c;
}

beforeEach(async () => {
  mockFlags = { hikaye: true, kesfet_video: true, kesfet_paylasim: true, koc: true, paylasim_baglanti: false, su_takibi: false };
  mockUser = { id: 'me' };
  mockParams = undefined;
  Object.values(mockNav).forEach((f) => typeof f === 'function' && 'mockClear' in f && (f as jest.Mock).mockClear());
  await AsyncStorage.setItem('@kcal_story_coach_seen', '1');
  world();
  useStoryTray.setState({ items: [], loaded: false, postedAt: 0 });
});
afterAll(() => resetStoryClient());

test('tepsi: "Hikâyen" + artı → kamera; görülmemiş lime, görülmüş gri; gizli/engelli yok', async () => {
  await act(async () => {
    await useStoryTray.getState().refresh();
  });
  const items = useStoryTray.getState().items;
  expect(items.map((i) => i.user_id)).toEqual(['me', 'ayse']);
  const onOpen = jest.fn();
  const onCreate = jest.fn();
  const r = render(<StoryTray items={items} onOpen={onOpen} onCreate={onCreate} />);
  expect(r.getByText('Hikâyen')).toBeTruthy();
  fireEvent.press(r.getByTestId('story-tray-add'));
  expect(onCreate).toHaveBeenCalled();
  fireEvent.press(r.getByTestId('story-tray-ayse'));
  expect(onOpen).toHaveBeenCalledWith('ayse');
  const strokes = r.UNSAFE_getAllByType(Circle).map((c) => c.props.stroke);
  expect(strokes).toContain(LIME);
  expect(r.getByLabelText('Ayşe, yeni hikâye')).toBeTruthy();
  expect(viewerQueue(items)).toEqual(['ayse']);
});

test('görüntüleyici: ilk görülmemişten açılır, görüldü işaretlenir, sol üçte bir önceki / sağ sonraki', async () => {
  mockParams = { userIds: ['ayse'], startUserId: 'ayse' };
  const r = render(<StoryViewerScreen />);
  await waitFor(() => expect(r.getByLabelText('Hikâye 2 / 2')).toBeTruthy());
  await waitFor(() => expect(W.views.some((v) => v.story === 'a2' && v.viewer === 'me')).toBe(true));
  const tap = r.getByTestId('story-viewer-tap');
  // Dokunma bölgesi kuralı saf testte; burada erişilebilirlik eylemi ile önceki/sonraki.
  act(() => tap.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
  await waitFor(() => expect(r.getByLabelText('Hikâye 1 / 2')).toBeTruthy());
  act(() => tap.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  await waitFor(() => expect(r.getByLabelText('Hikâye 2 / 2')).toBeTruthy());
});

test('görüntüleyici reply: YALNIZ hızlı tepkiler (6), metin alanı yok; tepki sunucuya; beğen aç/kapa', async () => {
  mockParams = { userIds: ['ayse'], startUserId: 'ayse' };
  const r = render(<StoryViewerScreen />);
  await waitFor(() => expect(r.getByTestId('story-viewer-reply-open')).toBeTruthy());
  fireEvent.press(r.getByTestId('story-viewer-reply-open'));
  expect(r.getByTestId('story-viewer-reply')).toBeTruthy();
  for (const k of ['like', 'congrats', 'enjoy', 'recipe', 'great', 'join']) expect(r.getByTestId(`story-react-${k}`)).toBeTruthy();
  expect(r.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  await act(async () => {
    fireEvent.press(r.getByTestId('story-react-congrats'));
  });
  await waitFor(() => expect(W.reactions.map((x) => x.kind)).toEqual(['congrats']));
  await act(async () => {
    fireEvent.press(r.getByTestId('story-viewer-like'));
  });
  await waitFor(() => expect(W.reactions.some((x) => x.kind === 'like')).toBe(true));
});

test('görüntüleyici: anket oyu tek seferlik, sonuç yüzdeleri; öğün çıkartması → Günlüğüne ekle (source=story)', async () => {
  mockParams = { userIds: ['ayse'], startUserId: 'ayse' };
  const r = render(<StoryViewerScreen />);
  await waitFor(() => expect(r.getByLabelText('Evet')).toBeTruthy());
  await act(async () => {
    fireEvent.press(r.getByLabelText('Hayır'));
  });
  await waitFor(() => expect(W.votes).toEqual([{ story: 'a2', sticker: 'p1', user: 'me', option: 1 }]));
  await waitFor(() => expect(r.getByLabelText('Hayır, yüzde 100')).toBeTruthy());
  fireEvent.press(r.getByLabelText(/Öğün çıkartması: Somon kinoa kase, 520 kcal\. Seçenekler/));
  await act(async () => {
    fireEvent.press(r.getByTestId('story-viewer-add-log'));
  });
  await waitFor(() => expect(W.consumptions.map((c) => [c.source, c.kcal])).toEqual([['story', 520]]));
  expect(W.events.map((e) => e.action).sort()).toEqual(['add_log', 'tap']);
});

test('gizli hesap (takip yok) ve engelli kişinin hikâyesi açılmaz', async () => {
  mockParams = { userIds: ['gizli'], startUserId: 'gizli', ownerName: 'Gizli' };
  const r = render(<StoryViewerScreen />);
  await waitFor(() => expect(r.getByText('Görülecek hikâye kalmadı.')).toBeTruthy());
  mockParams = { userIds: ['eng'], startUserId: 'eng', ownerName: 'Engelli' };
  const r2 = render(<StoryViewerScreen />);
  await waitFor(() => expect(r2.getAllByText('Görülecek hikâye kalmadı.').length).toBeGreaterThan(0));
  expect(W.views.some((v) => v.story === 'g1' || v.story === 'e1')).toBe(false);
});

test('kendi hikâyen: Görenler düğmesi + kcalAI Koç ipucu (koç açık); görenler sayfası yalnız sahibine', async () => {
  seedStory(W, { id: 'mine', author_id: 'me', overlays: [meal] }, 1);
  W.views.push({ story: 'mine', viewer: 'ayse', at: new Date().toISOString() });
  W.reactions.push({ story: 'mine', user: 'ayse', kind: 'recipe', at: new Date().toISOString() });
  mockParams = { userIds: ['me'], startUserId: 'me' };
  const r = render(<StoryViewerScreen />);
  await waitFor(() => expect(r.getByTestId('story-viewer-viewers')).toBeTruthy());
  expect(r.getByTestId('story-coach-tip')).toBeTruthy();
  expect(r.getByText('Öğün çıkartması eklediğin hikâyeleri izleyenler tek dokunuşla günlüğüne ekleyebilir.')).toBeTruthy();
  fireEvent.press(r.getByTestId('story-viewer-viewers'));
  await waitFor(() => expect(r.getByTestId('story-viewers-sheet')).toBeTruthy());
  expect(r.getByTestId('story-viewers-hl')).toBeTruthy();
});

test('koç bayrağı kapalıyken kendi hikâyende ipucu kartı yok', async () => {
  mockFlags.koc = false;
  seedStory(W, { id: 'mine2', author_id: 'me' }, 1);
  mockParams = { userIds: ['me'], startUserId: 'me' };
  const r = render(<StoryViewerScreen />);
  await waitFor(() => expect(r.getByTestId('story-viewer-viewers')).toBeTruthy());
  expect(r.queryByTestId('story-coach-tip')).toBeNull();
});

test('görenler: boş hâl metni (24 sa notu) ve Öne çıkar / Sil eylemleri', async () => {
  seedStory(W, { id: 'mine3', author_id: 'me' }, 2);
  const st = (await createMockStoryClient(W).getArchive())[0];
  const r = render(
    <StoryViewersSheet story={st} previewUri={null} nowMs={W.now()} onClose={jest.fn()} onHighlight={jest.fn()} onDelete={jest.fn()} onOpenProfile={jest.fn()} />,
  );
  await waitFor(() => expect(r.getByText('Henüz kimse görmedi')).toBeTruthy());
  expect(r.getByText('Hikâyen 22 saat daha yayında, sonra yalnızca senin arşivinde kalır.')).toBeTruthy();
  expect(r.getByTestId('story-viewers-hl')).toBeTruthy();
  expect(r.getByTestId('story-viewers-del')).toBeTruthy();
});

test('düzenleyici: yazılı hikâye → "Bitti" → paylaş = katmanlı create_story (pending) + moderate', async () => {
  mockParams = { mediaType: 'none', preset: 'text' };
  const r = render(<StoryEditorScreen />);
  fireEvent.changeText(r.getByTestId('story-text-input'), 'Koşu sonrası tabak');
  fireEvent.press(r.getByTestId('story-text-done'));
  await act(async () => {
    fireEvent.press(r.getByTestId('story-editor-share'));
  });
  await waitFor(() => expect(W.stories.filter((s) => s.author_id === 'me')).toHaveLength(1));
  const s = W.stories.find((x) => x.author_id === 'me')!;
  expect(s.media_type).toBe('none');
  expect(s.bg).toBeTruthy();
  expect(s.overlays.map((o) => o.kind)).toEqual(['text']);
  // metin katmanı → pending başlar; moderate (mock) yayına alır
  await waitFor(() => expect(s.status).toBe('published'));
  expect(useStoryTray.getState().postedAt).toBeGreaterThan(0);
});

test('düzenleyici araç çubuğu: Yazı, Çizim, Çıkartma, Bahset, Konum, Anket — müzik/bağlantı YOK; çıkartma sayfası', async () => {
  mockParams = { mediaType: 'none', preset: 'tools' };
  const r = render(<StoryEditorScreen />);
  // Gün verisi (öğünler, seri) yüklensin.
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  for (const id of ['text', 'draw', 'sticker', 'mention', 'place', 'poll']) expect(r.getByTestId(`story-tool-${id}`)).toBeTruthy();
  expect(r.queryByText('Müzik')).toBeNull();
  expect(r.queryByText('Bağlantı')).toBeNull();
  fireEvent.press(r.getByTestId('story-tool-sticker'));
  await waitFor(() => expect(r.getByTestId('story-stickers-sheet')).toBeTruthy());
  expect(r.queryByText('Soru')).toBeNull();
  expect(r.queryByText('Challenge')).toBeNull();
  await waitFor(() => expect(r.getByTestId('story-tile-meal')).toBeTruthy());
  expect(r.getByTestId('story-tile-streak')).toBeTruthy();
  expect(r.queryByTestId('story-tile-steps')).toBeNull();
});

test('öne çıkanlar: sahibi "Yeni" görür; arşivden seç + ad → Oluştur', async () => {
  seedStory(W, { id: 'old1', author_id: 'me' }, 30);
  seedStory(W, { id: 'old2', author_id: 'me' }, 40);
  const r = render(<HighlightsRow userId="me" isOwner enabled onOpen={jest.fn()} />);
  await waitFor(() => expect(r.getByTestId('story-highlights-new')).toBeTruthy());
  const saved = jest.fn();
  const s = render(<HighlightSheet mode="new" highlight={null} onClose={jest.fn()} onSaved={saved} />);
  await waitFor(() => expect(s.getByTestId('story-hl-cell-old1')).toBeTruthy());
  fireEvent.press(s.getByTestId('story-hl-cell-old2'));
  fireEvent.press(s.getByTestId('story-hl-cell-old1'));
  fireEvent.changeText(s.getByTestId('story-highlight-name'), 'Meal prep');
  await act(async () => {
    fireEvent.press(s.getByTestId('story-highlight-save'));
  });
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(W.highlights[0]).toMatchObject({ title: 'Meal prep', items: ['old2', 'old1'] });
  // başkasının (görülemeyen) öne çıkanları satırı çizilmez
  const o = render(<HighlightsRow userId="gizli" isOwner={false} enabled onOpen={jest.fn()} />);
  await act(async () => {});
  expect(o.queryByTestId('story-highlights')).toBeNull();
});

test('kamera: mod sekmeleri Gönderi/Hikâye/Reels; Reels yalnız kesfet_video; Gönderi → Composer', async () => {
  const r = render(<StoryCameraScreen />);
  expect(r.getByTestId('story-camera-mode-post')).toBeTruthy();
  expect(r.getByTestId('story-camera-mode-reels')).toBeTruthy();
  expect(r.getByLabelText('Fotoğraf çek. Video için basılı tut.')).toBeTruthy();
  fireEvent.press(r.getByTestId('story-camera-mode-post'));
  expect(mockNav.replace).toHaveBeenCalledWith('Composer');
  fireEvent.press(r.getByTestId('story-camera-create'));
  expect(mockNav.replace).toHaveBeenCalledWith('StoryEditor', { mediaType: 'none', preset: 'text' });
  mockFlags.kesfet_video = false;
  const r2 = render(<StoryCameraScreen />);
  expect(r2.queryByTestId('story-camera-mode-reels')).toBeNull();
  expect(r2.getAllByLabelText('Fotoğraf çek').length).toBeGreaterThan(0);
});

test('bayrak kapalıyken giriş yok: rotalar kayıtlı değil, Keşfet tepsisi ve profil halkası/öne çıkanlar bayrağa bağlı', () => {
  const nav = SRC('../../../navigation/AppNavigator.tsx');
  for (const n of ['StoryCamera', 'StoryEditor', 'StoryViewer']) {
    expect(nav).toMatch(new RegExp(`\\(hikayeEnabled \\|\\| __DEV__\\) && \\(\\s*<Stack.Screen name="${n}"`));
  }
  const kes = SRC('../../kesfet/ui/KesfetScreen.tsx');
  expect(kes).toMatch(/const storyTray = hikaye \? \(/);
  expect(kes).toMatch(/if \(hikaye\) void refreshStories\(\)/);
  const prof = SRC('../../profil/ui/screens/FinPrProfileScreen.tsx');
  expect(prof).toMatch(/storyRing=\{hikaye \?/);
  expect(prof).toMatch(/\{hikaye \? \(\s*<HighlightsRow/);
  const pub = SRC('../../profil/ui/PublicProfileScreen.tsx');
  expect(pub).toMatch(/storyRing=\{hikaye && !profile\.blocked \?/);
  const reg = SRC('../../../core/flags/registry.ts');
  expect(reg).toMatch(/\n\s*hikaye: false,/);
  // HighlightsRow bayrak kapalıyken hiç çizilmez (istek de yok)
  const r = render(<HighlightsRow userId="me" isOwner enabled={false} onOpen={jest.fn()} />);
  expect(r.queryByTestId('story-highlights')).toBeNull();
});

test('personel hakkı koruması: store=manual + süresiz satır App Store EXPIRATION ile ezilmez', () => {
  const current = { tier: 'balance', status: 'active', store: 'manual', product_id: 'internal_staff', expires_at: null } as never;
  for (const type of ['EXPIRATION', 'CANCELLATION', 'RENEWAL', 'INITIAL_PURCHASE', 'PRODUCT_CHANGE']) {
    expect(mapRevenueCatEvent({ type, app_user_id: '7b0c6d2e-1f3a-4c5b-9d8e-0a1b2c3d4e5f', product_id: 'kcalai_fresh_yearly', store: 'APP_STORE', id: `e-${type}`, event_timestamp_ms: Date.parse('2026-11-23T12:00:00Z') } as never, current)).toEqual({ action: 'ignore', reason: 'manual_entitlement' });
  }
});

test('görenler (liste): tepki hapı, Tümü / Tepkiler filtresi', async () => {
  seedStory(W, { id: 'mine9', author_id: 'me' }, 2);
  W.views.push({ story: 'mine9', viewer: 'ayse', at: new Date().toISOString() });
  W.reactions.push({ story: 'mine9', user: 'ayse', kind: 'recipe', at: new Date().toISOString() });
  const st = (await createMockStoryClient(W).getArchive())[0];
  const r = render(<StoryViewersSheet story={st} previewUri={null} nowMs={W.now()} onClose={jest.fn()} onHighlight={jest.fn()} onDelete={jest.fn()} onOpenProfile={jest.fn()} />);
  await waitFor(() => expect(r.getByText('Tarifi?')).toBeTruthy());
  expect(r.getByText('1 görüntüleme')).toBeTruthy();
  fireEvent.press(r.getByTestId('story-viewers-filter-reacted'));
  expect(r.getByText('Ayşe')).toBeTruthy();
  expect(r.getByText('@ayse')).toBeTruthy();
});
