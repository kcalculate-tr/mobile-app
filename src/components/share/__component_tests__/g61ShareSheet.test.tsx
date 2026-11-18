// G61-S1 — FinShareSheet hâlleri (varsayılan / kopyalandı / hazırlanıyor / hata), hedef yönlendirme
// (kopyala · WhatsApp · X · Instagram), bayrak kapalı = eski davranış (giriş noktaları + eski modallar).
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { Linking } from 'react-native';
import { act, fireEvent, render as rtlRender, renderHook } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

let mockFlags: Record<string, boolean> = { paylasim_karti: true, paylasim_baglanti: true };
jest.mock('../../../core/flags', () => ({ useFeature: (k: string) => !!mockFlags[k] }));
const mockSetString = jest.fn((..._a: unknown[]) => Promise.resolve(true));
jest.mock('expo-clipboard', () => ({ setStringAsync: (...a: unknown[]) => mockSetString(...a) }));
const mockTrack = jest.fn();
jest.mock('../../../lib/analytics', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));
const mockShareImage = jest.fn((..._a: unknown[]) => Promise.resolve());
jest.mock('../../../lib/shareCard', () => ({
  captureSvgToPngBase64: () => Promise.resolve('iVBORw0KGgo='),
  writePngBase64: (_b: string, name: string) => Promise.resolve(`file:///cache/${name}.png`),
  shareImageUri: (...a: unknown[]) => mockShareImage(...a),
}));
const mockCreate = jest.fn((..._a: unknown[]) => Promise.resolve('aB3dE5fG7h'));
jest.mock('../../../lib/share/snapshotApi', () => ({ createShareSnapshot: (...a: unknown[]) => mockCreate(...a) }));

import { ShareSheet } from '../ShareSheet';
import { useShareSheet } from '../useShareSheet';
import { PostMenu } from '../../../modules/kesfet/ui/PostMenu';
import type { ShareCardInput } from '../../../lib/share/cardModel';

const metrics = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const render = (el: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={metrics}>{el}</SafeAreaProvider>);
const SRC = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../..', p), 'utf8');

const MEAL: ShareCardInput = { kind: 'meal', data: { mealLabel: 'Öğle', name: 'Tavuklu kinoa kasesi', kcal: 540, protein: 42, carbs: 48, fat: 16 } };
const POST: ShareCardInput = { kind: 'post', data: { authorName: 'Ayşe', handle: 'ayse', text: 'Antrenman sonrası kase', imageUri: 'https://x.test/a.jpg' } };
const POST_ID = '3f2a9c1e-7b44-4d2a-9a51-0c8e2d1f6b77';

beforeEach(() => {
  mockFlags = { paylasim_karti: true, paylasim_baglanti: true };
  mockSetString.mockClear();
  mockTrack.mockClear();
  mockShareImage.mockClear();
  mockCreate.mockClear();
});

async function flush() {
  await act(async () => {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  });
}

test('varsayılan: başlık, kart adı, ölçü, şablonlar (fotoğraf yoksa 2), gizlilik, 6 hedef', async () => {
  const r = render(<ShareSheet visible onClose={() => {}} input={MEAL} linkEnabled surface="test" forcePhase="default" presetSnapshotId="aB3dE5fG7h" />);
  await flush();
  expect(r.getByText('Paylaş')).toBeTruthy();
  expect(r.getByText('Öğün kartı')).toBeTruthy();
  expect(r.getByText('Hikâye 9:16')).toBeTruthy();
  expect(r.getByText('Gönderi 4:5')).toBeTruthy();
  expect(r.getByTestId('share-tpl-light')).toBeTruthy();
  expect(r.getByTestId('share-tpl-dark')).toBeTruthy();
  expect(r.queryByTestId('share-tpl-photo')).toBeNull();
  expect(r.getByText('Kalori hedefin ve gün toplamın paylaşılmaz.')).toBeTruthy();
  for (const k of ['ig_story', 'ig_post', 'whatsapp', 'x', 'copy', 'other']) expect(r.getByTestId(`share-target-${k}`)).toBeTruthy();
  expect(r.queryByTestId('share-target-save')).toBeNull(); // medya kütüphanesi paketi yok → gizli
  expect(r.getByTestId('share-qr')).toBeTruthy();
  expect(mockTrack).toHaveBeenCalledWith('share_open', { kind: 'meal', surface: 'test' });
});

test('fotoğraflı kartta 3 şablon', async () => {
  const r = render(<ShareSheet visible onClose={() => {}} input={POST} linkId={POST_ID} linkEnabled surface="test" forcePhase="default" />);
  await flush();
  expect(r.getByTestId('share-tpl-photo')).toBeTruthy();
  expect(r.getByText('Gönderinin herkese açık hâli paylaşılır; beğeni sayısı görünmez.')).toBeTruthy();
});

test('hazırlanıyor: iskelet; görsel hedefleri pasif, bağlantı açık', async () => {
  const r = render(<ShareSheet visible onClose={() => {}} input={MEAL} linkEnabled surface="test" forcePhase="loading" presetSnapshotId="aB3dE5fG7h" />);
  await flush();
  expect(r.getByTestId('share-loading')).toBeTruthy();
  expect(r.getByText('Görsel hazırlanıyor…')).toBeTruthy();
  expect(r.queryByTestId('share-templates')).toBeNull();
  expect(r.getByTestId('share-target-ig_story').props.accessibilityState).toMatchObject({ disabled: true });
  expect(r.getByTestId('share-target-ig_post').props.accessibilityState).toMatchObject({ disabled: true });
  expect(r.getByTestId('share-target-copy').props.accessibilityState).toMatchObject({ disabled: false });
  expect(r.getByTestId('share-target-other').props.accessibilityState).toMatchObject({ disabled: false });
});

test('hata: "Görsel hazırlanamadı" + Tekrar dene; bağlantı ve Diğer açık', async () => {
  const r = render(<ShareSheet visible onClose={() => {}} input={MEAL} linkEnabled surface="test" forcePhase="error" presetSnapshotId="aB3dE5fG7h" />);
  await flush();
  expect(r.getByTestId('share-error')).toBeTruthy();
  expect(r.getByText('Görsel hazırlanamadı')).toBeTruthy();
  expect(r.getByTestId('share-retry')).toBeTruthy();
  expect(r.getByTestId('share-target-ig_story').props.accessibilityState).toMatchObject({ disabled: true });
  expect(r.getByTestId('share-target-copy').props.accessibilityState).toMatchObject({ disabled: false });
});

test('kopyalandı hâli: bildirim + kısa bağlantı', async () => {
  const r = render(<ShareSheet visible onClose={() => {}} input={MEAL} linkEnabled surface="test" forcePhase="copied" presetSnapshotId="aB3dE5fG7h" />);
  await flush();
  expect(r.getByTestId('share-toast')).toBeTruthy();
  expect(r.getByText('Bağlantı kopyalandı')).toBeTruthy();
  expect(r.getByText('l.eatkcal.com/m/aB3dE5fG7h')).toBeTruthy();
});

test('Bağlantıyı kopyala → panoya utm_source=copy bağlantısı + bildirim + share_target', async () => {
  const r = render(<ShareSheet visible onClose={() => {}} input={POST} linkId={POST_ID} linkEnabled surface="post_menu" forcePhase="default" />);
  await flush();
  await act(async () => {
    fireEvent.press(r.getByTestId('share-target-copy'));
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
  expect(mockSetString).toHaveBeenCalledWith(`https://l.eatkcal.com/p/${POST_ID}?utm_source=copy`);
  expect(r.getByText('Bağlantı kopyalandı')).toBeTruthy();
  expect(mockTrack).toHaveBeenCalledWith('share_target', expect.objectContaining({ kind: 'post', target: 'copy', ok: true }));
  // 2,4 sn sonra bildirim kapanır.
  await act(async () => {
    jest.advanceTimersByTime(2500);
  });
  expect(r.queryByText('Bağlantı kopyalandı')).toBeNull();
});

test('WhatsApp → whatsapp://send?text= metin + bağlantı; X → x.com/intent/post', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const r = render(<ShareSheet visible onClose={() => {}} input={POST} linkId={POST_ID} linkEnabled surface="t" forcePhase="default" />);
  await flush();
  await act(async () => {
    fireEvent.press(r.getByTestId('share-target-whatsapp'));
    await Promise.resolve();
  });
  await flush();
  expect(open.mock.calls[0][0]).toMatch(/^whatsapp:\/\/send\?text=.*utm_source%3Dwhatsapp$/);
  await act(async () => {
    fireEvent.press(r.getByTestId('share-target-x'));
    await Promise.resolve();
  });
  await flush();
  expect(open.mock.calls[1][0]).toMatch(/^https:\/\/x\.com\/intent\/post\?text=.*&url=.*utm_source%3Dx$/);
  open.mockRestore();
});

test('Instagram Hikâye → bağlantı panoya + 9:16 görsel sistem paylaşımı', async () => {
  const r = render(<ShareSheet visible onClose={() => {}} input={POST} linkId={POST_ID} linkEnabled surface="t" forcePhase="default" />);
  await flush();
  await act(async () => {
    fireEvent.press(r.getByTestId('share-target-ig_story'));
    await Promise.resolve();
  });
  await flush();
  expect(mockSetString).toHaveBeenCalledWith(`https://l.eatkcal.com/p/${POST_ID}?utm_source=instagram`);
  expect(mockShareImage).toHaveBeenCalledWith('file:///cache/post-story.png', 'Paylaş');
});

test('öğün kartı açılınca anlık görüntü istenir (yalnız izinli alanlar)', async () => {
  render(<ShareSheet visible onClose={() => {}} input={MEAL} linkEnabled surface="t" />);
  await flush();
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate.mock.calls[0][0]).toBe('meal');
});

test('bağlantı kapalı: kopyala / X / QR yok, görsel hedefleri var', async () => {
  const r = render(<ShareSheet visible onClose={() => {}} input={MEAL} linkEnabled={false} surface="t" forcePhase="default" />);
  await flush();
  expect(r.queryByTestId('share-target-copy')).toBeNull();
  expect(r.queryByTestId('share-target-x')).toBeNull();
  expect(r.queryByTestId('share-qr')).toBeNull();
  expect(r.getByTestId('share-target-ig_story')).toBeTruthy();
  expect(r.getByTestId('share-target-other')).toBeTruthy();
  expect(mockCreate).not.toHaveBeenCalled();
});

test('useShareSheet: iki bayrak açık → etkin; biri kapalı → etkin değil, düğüm yok (eski davranış)', () => {
  mockFlags = { paylasim_karti: true, paylasim_baglanti: true };
  expect(renderHook(() => useShareSheet('t')).result.current.enabled).toBe(true);
  for (const f of [
    { paylasim_karti: false, paylasim_baglanti: false },
    { paylasim_karti: true, paylasim_baglanti: false },
    { paylasim_karti: false, paylasim_baglanti: true },
  ]) {
    mockFlags = f;
    const h = renderHook(() => useShareSheet('t')).result.current;
    expect(h.enabled).toBe(false);
    expect(h.node).toBeNull();
  }
});

test('gönderi menüsü: onShare yoksa "Paylaş" satırı yok, varsa var', async () => {
  const base = { visible: true, onClose: () => {}, authorName: 'Ayşe', onReport: () => true, onBlock: () => {} };
  const off = render(<PostMenu {...base} />);
  await flush();
  expect(off.queryByLabelText('Paylaş')).toBeNull();
  off.unmount();
  const onShare = jest.fn();
  const on = render(<PostMenu {...base} onShare={onShare} />);
  await flush();
  fireEvent.press(on.getByLabelText('Paylaş'));
  expect(onShare).toHaveBeenCalled();
});

test('bayrak kapalı yol kaynakta duruyor: eski modallar + Share.share + giriş noktaları bayrağa bağlı', () => {
  const tracker = SRC('screens/TrackerScreen.tsx');
  expect(tracker).toMatch(/\{paylasimKarti \? \(\s*<ShareMealCardModal/);
  expect(tracker).toMatch(/shareKit\.enabled\s*\?\s*\(\) =>/); // Günü paylaş yalnız etkinken
  const scan = SRC('modules/ai/scan/screens/ScanScreen.tsx');
  expect(scan).toMatch(/\{paylasimKarti \? \(\s*<PlateXRayShareModal/);
  expect(scan).toMatch(/shareKit\.enabled\s*\?\s*shareKit\.open\(/);
  const kesfet = SRC('modules/kesfet/ui/KesfetScreen.tsx');
  expect(kesfet).toMatch(/Share\.share\(\{ message: postLink\(post\.id\)/);
  expect(kesfet).toMatch(/onShare=\{shareKitEnabled \?/);
  const invite = SRC('modules/eatkcal/v2/screens/EkInviteScreen.tsx');
  expect(invite).toMatch(/Share\.share\(\{ message: referralShareText/);
  const story = SRC('modules/hikaye/ui/StoryViewerScreen.tsx');
  expect(story).toMatch(/if \(shareKit\.enabled && story\)/);
  const profile = SRC('modules/profil/ui/PublicProfileScreen.tsx');
  expect(profile).toMatch(/shareKit\.enabled && !profile\.blocked && !profile\.is_private/);
});
