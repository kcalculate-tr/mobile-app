// G50-S1 md.1–2 — Ana sayfa ek bölümleri: her bölüm veri yokken GİZLİ; ilk gün görevleri durumu gerçek kayıtlardan
// (sunucu mock'u); 3/3 → bir kez "Harika başlangıç!" ve kart kaybolur; tarama rozeti; tarifler; Koç hazır soruları;
// seri + hafta; eatkcal köprü satırı. md.2: kupa ilk 3 döngüden sonra durur, odakta yeniden 3 döngü.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => {
  const m = require('react-native-reanimated/mock');
  return { ...m, withRepeat: jest.fn((v: unknown) => v), withSequence: jest.fn((...v: unknown[]) => v[0]) };
});
jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets };
});
jest.mock('../../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../personalPlan/bridge', () => ({ useReduceTransparency: () => false }));
const mockAddToDay = jest.fn((..._a: unknown[]) => Promise.resolve('c-new'));
jest.mock('../../../kesfet/store', () => ({
  useKesfetStore: { getState: () => ({ addToDay: (...a: unknown[]) => mockAddToDay(...a), undoAddToDay: () => Promise.resolve(true) }) },
}));
jest.mock('../../../shell/logTrace', () => ({ logTrace: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../../lib/products', () => ({ fetchProducts: () => Promise.resolve([]) }));
jest.mock('../../../../lib/banners', () => ({ fetchBannerRows: () => Promise.resolve({ hero: [], promo: [] }) }));
jest.mock('../../../../lib/brands', () => ({ fetchBrand: () => Promise.resolve(null) }));
jest.mock('../../../eatkcal/v2/ui/home/useDeliveryChip', () => ({ useDeliveryChip: () => ({ address: null, chip: null }) }));

import { withRepeat, withSequence } from 'react-native-reanimated';
import { ThemeProvider } from '../../../../core/design/ThemeProvider';
import { HOME_GATE_MOTION, ReducedMotionProvider } from '../../../../core/design/motion';
import { I18nProvider } from '../../../../core/i18n';
import { track } from '../../../../lib/analytics';
import { HomeCoachPrompts, HomeFirstDayTasks, HomeStreakWeek, HomeTodayRecipes, setHomeExtrasProvider } from '../HomeExtras';
import { HomeEatkcalShowcase, setHomeRegionProvider } from '../HomeRegion';
import { HomeQuickActions } from '../../../kayit/ui/HomeQuickActions';
import { HomePlanGateCard } from '../../../kayit/ui/HomePlanGateCard';
import type { FeedPost } from '../../../kesfet/types';

const trackMock = track as unknown as jest.Mock;
const repeatMock = withRepeat as unknown as jest.Mock;
const seqMock = withSequence as unknown as jest.Mock;
const H = { includeHiddenElements: true } as const;
const NOW = new Date('2026-11-14T12:00:00.000Z');
const FRESH = new Date(NOW.getTime() - 2 * 864e5).toISOString();
const OLD = new Date(NOW.getTime() - 9 * 864e5).toISOString();

const wrap = (el: React.ReactElement, o: { lang?: 'tr' | 'en'; reduced?: boolean; scheme?: 'light' | 'dark' } = {}) => (
  <ThemeProvider forceScheme={o.scheme ?? 'light'}>
    <I18nProvider forceLang={o.lang ?? 'tr'}>
      <ReducedMotionProvider value={o.reduced ?? false}>{el}</ReducedMotionProvider>
    </I18nProvider>
  </ThemeProvider>
);
async function flush() {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
}

const records = { v: { scan: false, water: false } as { scan: boolean; water: boolean } | null };
const firstRecords = jest.fn(async (_uid: string) => records.v);
const feed = { v: [] as FeedPost[] };

function mkPost(id: string, meal: Partial<NonNullable<FeedPost['meal_card']>> | null): FeedPost {
  return {
    id,
    author: { id: 'a', handle: 'kcal', display_name: 'kcal', avatar_url: null, role: 'kurum', verified: true } as unknown as FeedPost['author'],
    published_at: NOW.toISOString(),
    lang: 'tr',
    body: '',
    media: [],
    meal_card: meal
      ? { name: `Tarif ${id}`, kcal: 540, protein_g: 32, carbs_g: 50, fat_g: 14, portion_label: '1 porsiyon', photo_url: `https://x/${id}.jpg`, product_id: null, ...meal }
      : null,
    quote: null,
    thread: null,
    stats: { likes: 0, saves: 0, adds: 0, comments: 0, did_it: 0 },
    me: { liked: false, saved: false, is_author: false },
    post_type: 'ogun',
    status: 'published',
    activity_card: null,
  };
}

beforeEach(async () => {
  jest.setSystemTime(NOW);
  jest.clearAllMocks();
  records.v = { scan: false, water: false };
  feed.v = [];
  setHomeExtrasProvider({ firstRecords, feed: async () => feed.v });
  await AsyncStorage.clear();
});
afterAll(() => setHomeExtrasProvider(null));

function tasks(p: Partial<React.ComponentProps<typeof HomeFirstDayTasks>> = {}, o?: { lang?: 'tr' | 'en' }) {
  const onTask = jest.fn();
  const props = { userId: 'u1', createdAt: FRESH, planDone: false, waterOn: true, onTask, ...p };
  const r = render(wrap(<HomeFirstDayTasks {...props} />, o));
  return { r, onTask, props };
}
const checked = (r: ReturnType<typeof render>, k: string) => r.getByTestId(`home-task-${k}`).props.accessibilityState?.checked;

describe('6a İlk gün görevleri', () => {
  test('veri yoksa gizli: hesap tarihi yok · 7 gün geçti · sunucu okunamadı · kullanıcı yok · profil durumu bilinmiyor', async () => {
    for (const p of [{ createdAt: null }, { createdAt: OLD }, { userId: null }, { planDone: null }]) {
      const { r } = tasks(p);
      await flush();
      expect(r.queryByTestId('home-tasks')).toBeNull();
      r.unmount();
    }
    records.v = null;
    const { r } = tasks();
    await flush();
    expect(r.queryByTestId('home-tasks')).toBeNull();
    // 7 gün dışındaki hesap için sunucuya hiç gidilmez
    firstRecords.mockClear();
    tasks({ createdAt: OLD });
    await flush();
    expect(firstRecords).not.toHaveBeenCalled();
  });

  test('0/3: başlık + ilerleme çubuğu + 3 satır (Plan · Tara · Su), hepsi işaretsiz; durum sunucu kayıtlarından', async () => {
    const { r, onTask } = tasks();
    await flush();
    expect(firstRecords).toHaveBeenCalledWith('u1');
    expect(r.getByText('İlk gün görevlerin')).toBeTruthy();
    expect(r.getByTestId('home-tasks-count').props.children).toBe('0/3');
    expect(r.getByTestId('home-tasks-bar')).toBeTruthy();
    for (const k of ['plan', 'scan', 'water']) expect(checked(r, k)).toBe(false);
    expect(r.getByText('Planını oluştur')).toBeTruthy();
    expect(r.getByText('İlk tabağını tara')).toBeTruthy();
    expect(r.getByText('Su ekle')).toBeTruthy();
    expect(trackMock).toHaveBeenCalledWith('home_tasks_view', { done: 0, total: 3 });
    fireEvent.press(r.getByTestId('home-task-scan'));
    expect(onTask).toHaveBeenCalledWith('scan');
    expect(trackMock).toHaveBeenCalledWith('home_tasks_tap', { task: 'scan', done: false });
    expect(r.getByTestId('home-task-water').props.accessibilityLabel).toBe('Su ekle, yapılmadı');
  });

  test('2/3: profil var + ilk tarama kaydı var (sunucu) → işaretli, soluk / üstü çizili DEĞİL; su işaretsiz', async () => {
    records.v = { scan: true, water: false };
    const { r } = tasks({ planDone: true });
    await flush();
    expect(r.getByTestId('home-tasks-count').props.children).toBe('2/3');
    expect(checked(r, 'plan')).toBe(true);
    expect(checked(r, 'scan')).toBe(true);
    expect(checked(r, 'water')).toBe(false);
    const label = r.getByText('İlk tabağını tara');
    const st = Object.assign({}, ...[label.props.style].flat(3).filter(Boolean));
    expect(st.textDecorationLine).toBeUndefined();
    expect(st.opacity).toBeUndefined();
    expect(r.getByTestId('home-task-plan').props.accessibilityLabel).toBe('Planını oluştur, tamamlandı');
  });

  test('yerel sinyal (bugünkü tarama / su) sunucu yanıtıyla birleşir; su takibi kapalı → 2 görev', async () => {
    const a = tasks({ localScan: true });
    await flush();
    expect(checked(a.r, 'scan')).toBe(true);
    a.r.unmount();
    const b = tasks({ waterOn: false });
    await flush();
    expect(b.r.queryByTestId('home-task-water')).toBeNull();
    expect(b.r.getByTestId('home-tasks-count').props.children).toBe('0/2');
  });

  test('3/3: bir kez kısa kutlama (halka + "Harika başlangıç!", konfeti yok), sonra kart kaybolur ve bir daha gelmez', async () => {
    records.v = { scan: true, water: true };
    const { r, props } = tasks({ planDone: true });
    await flush();
    expect(r.getByTestId('home-tasks-celebrate')).toBeTruthy();
    expect(r.getByText('Harika başlangıç!')).toBeTruthy();
    expect(r.getByTestId('home-tasks-ring', H)).toBeTruthy();
    expect(r.queryByTestId('home-task-plan')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await flush();
    expect(r.queryByTestId('home-tasks')).toBeNull();
    expect(await AsyncStorage.getItem('@kcal_first_tasks_closed:u1')).toBe('1');
    r.unmount();
    // yeniden açılış: cihazdaki "kapatıldı" işareti → gizli
    const again = render(wrap(<HomeFirstDayTasks {...props} />));
    await flush();
    expect(again.queryByTestId('home-tasks')).toBeNull();
  });

  test('EN metinler', async () => {
    const { r } = tasks({}, { lang: 'en' });
    await flush();
    expect(r.getByText('Your first-day tasks')).toBeTruthy();
    expect(r.getByText('Create your plan')).toBeTruthy();
    expect(r.getByText('Scan your first plate')).toBeTruthy();
    expect(r.getByText('Add water')).toBeTruthy();
  });
});

describe('6e Seri ve haftalık özet', () => {
  const days = [
    { date: '2026-11-12', kcal: 1800, count: 2 },
    { date: '2026-11-13', kcal: 2100, count: 3 },
  ];
  const base = { days, todayKey: '2026-11-14', todayCount: 1, targetKcal: 2000, ready: true, onOpen: jest.fn() };

  test('veri yoksa gizli (yükleniyor / kova boş)', () => {
    expect(render(wrap(<HomeStreakWeek {...base} ready={false} />)).queryByTestId('home-streak')).toBeNull();
    expect(render(wrap(<HomeStreakWeek {...base} days={[]} />)).queryByTestId('home-streak')).toBeNull();
  });

  test('seri metni + 7 günlük mini sütun (gerçek kalori); dokununca İlerleme', () => {
    const onOpen = jest.fn();
    const r = render(wrap(<HomeStreakWeek {...base} onOpen={onOpen} />));
    expect(r.getByText('3 gündür kayıttasın')).toBeTruthy();
    expect(r.getAllByTestId('home-streak-col', H)).toHaveLength(7);
    fireEvent.press(r.getByRole('button'));
    expect(onOpen).toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith('home_streak_tap');
  });

  test('seri 0 → "Bugün bir öğün ekle, serin başlasın"; EN', () => {
    const r = render(wrap(<HomeStreakWeek {...base} days={[{ date: '2026-11-10', kcal: 900, count: 1 }]} todayCount={0} />));
    expect(r.getByText('Bugün bir öğün ekle, serin başlasın')).toBeTruthy();
    const e = render(wrap(<HomeStreakWeek {...base} />, { lang: 'en' }));
    expect(e.getByText('You’ve logged 3 days in a row')).toBeTruthy();
  });
});

describe('6d Koç hazır soruları', () => {
  test('3 çip; dokununca soru ile Koç (prefill); EN', () => {
    const onPrompt = jest.fn();
    const r = render(wrap(<HomeCoachPrompts onPrompt={onPrompt} />));
    expect(r.getByText('Koç’a sor')).toBeTruthy();
    for (const q of ['Akşam ne yesem?', 'Proteinimi nasıl tamamlarım?', 'Haftamı özetle']) expect(r.getByText(q)).toBeTruthy();
    fireEvent.press(r.getByTestId('home-coach-protein'));
    expect(onPrompt).toHaveBeenCalledWith('protein', 'Proteinimi nasıl tamamlarım?');
    expect(trackMock).toHaveBeenCalledWith('home_coach_prompts_tap', { prompt: 'protein' });
    const e = render(wrap(<HomeCoachPrompts onPrompt={onPrompt} />, { lang: 'en' }));
    for (const q of ['Ask the Coach', 'What should I eat tonight?', 'How do I hit my protein?', 'Summarize my week']) expect(e.getByText(q)).toBeTruthy();
  });
});

describe('6c Bugünün tarifleri', () => {
  const props = () => ({ onOpen: jest.fn(), onAll: jest.fn(), requireGate: jest.fn(() => false) });

  test('veri yoksa gizli: akış boş / kalorisi ya da görseli olan tarif yok', async () => {
    const a = render(wrap(<HomeTodayRecipes {...props()} />));
    await flush();
    expect(a.queryByTestId('home-recipes')).toBeNull();
    feed.v = [mkPost('x', null), mkPost('y', { kcal: 0 }), mkPost('z', { photo_url: null })];
    const b = render(wrap(<HomeTodayRecipes {...props()} />));
    await flush();
    expect(b.queryByTestId('home-recipes')).toBeNull();
  });

  test('en çok 8 kart: görsel, ad, "540 kcal, 32 g protein"; dokun → detay; Tümü → Keşfet', async () => {
    feed.v = Array.from({ length: 10 }, (_, i) => mkPost(`p${i}`, {}));
    const p = props();
    const r = render(wrap(<HomeTodayRecipes {...p} />));
    await flush();
    expect(r.getByText('Bugünün tarifleri')).toBeTruthy();
    expect(r.getAllByText('540 kcal, 32 g protein')).toHaveLength(8);
    fireEvent.press(r.getByTestId('home-recipe-p2'));
    expect(p.onOpen).toHaveBeenCalledWith('p2');
    fireEvent.press(r.getByTestId('home-recipes-all'));
    expect(p.onAll).toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith('home_recipes_view', { count: 8 });
  });

  test('"Güne ekle" (+): kapı yönlendirdiyse sheet yok; geçerse mevcut tariften öğün ekleme', async () => {
    feed.v = [mkPost('p1', {})];
    const p = props();
    p.requireGate.mockReturnValueOnce(true);
    const r = render(wrap(<HomeTodayRecipes {...p} />));
    await flush();
    fireEvent.press(r.getByTestId('home-recipe-add-p1'));
    expect(p.requireGate).toHaveBeenCalledWith('p1');
    const logBtn = () => r.queryAllByRole('button').find((b) => /logla$/.test(String(b.props.accessibilityLabel ?? '')));
    expect(logBtn()).toBeUndefined();
    fireEvent.press(r.getByTestId('home-recipe-add-p1'));
    await flush();
    expect(logBtn()).toBeTruthy();
    fireEvent.press(logBtn()!);
    await flush();
    expect(mockAddToDay).toHaveBeenCalledWith('p1', 'lunch', 1, expect.stringMatching(/^home-recipe-p1-lunch-1-/));
  });
});

describe('6b Kalan tarama hakkı rozeti', () => {
  test('"Tabağını tara" kartında rozet; null → yok', () => {
    const r = render(wrap(<HomeQuickActions onAction={jest.fn()} scanBadge="Bugün 2 ücretsiz tarama" />));
    expect(r.getByText('Bugün 2 ücretsiz tarama')).toBeTruthy();
    expect(r.getByTestId('home-quick-scan').props.accessibilityLabel).toMatch(/Bugün 2 ücretsiz tarama$/);
    const n = render(wrap(<HomeQuickActions onAction={jest.fn()} scanBadge={null} />));
    expect(n.queryByTestId('home-quick-scan-badge')).toBeNull();
  });
});

describe('6f eatkcal köprüsü', () => {
  test('logonun altında tek satır (TR / EN)', async () => {
    setHomeRegionProvider({ campaigns: async () => [], stores: async () => [] });
    const r = render(wrap(<HomeEatkcalShowcase onOpenStore={jest.fn()} onCampaign={jest.fn()} onSeeAll={jest.fn()} />));
    await flush();
    expect(r.getByTestId('home-ek-bridge').props.children).toBe('Siparişin günlüğüne kendiliğinden işlenir.');
    const e = render(wrap(<HomeEatkcalShowcase onOpenStore={jest.fn()} onCampaign={jest.fn()} onSeeAll={jest.fn()} />, { lang: 'en' }));
    await flush();
    expect(e.getByTestId('home-ek-bridge').props.children).toBe('Your order is logged to your day automatically.');
    setHomeRegionProvider(null);
  });
});

describe('md.2 kupa süzülmesi', () => {
  test('ilk 3 döngüden (6 yarım) sonra durur; odak sayacı değişince yeniden 3 döngü; azaltılmış harekette yok', () => {
    expect(HOME_GATE_MOTION.cupCycles).toBe(3);
    const r = render(wrap(<HomePlanGateCard onStart={jest.fn()} cycleKey={1} />));
    expect(repeatMock).toHaveBeenCalledTimes(1);
    // sonlu tekrar: 3 tam döngü = 6 yarım (sonsuz −1 DEĞİL), ters yön
    expect(repeatMock.mock.calls[0][1]).toBe(6);
    expect(repeatMock.mock.calls[0][2]).toBe(true);
    // dizinin sonunda orta konuma dönüş (sabit)
    expect(seqMock).toHaveBeenCalledTimes(1);
    expect(seqMock.mock.calls[0]).toHaveLength(3);
    r.rerender(wrap(<HomePlanGateCard onStart={jest.fn()} cycleKey={1} />));
    expect(repeatMock).toHaveBeenCalledTimes(1);
    r.rerender(wrap(<HomePlanGateCard onStart={jest.fn()} cycleKey={2} />));
    expect(repeatMock).toHaveBeenCalledTimes(2);
    repeatMock.mockClear();
    render(wrap(<HomePlanGateCard onStart={jest.fn()} cycleKey={3} />, { reduced: true }));
    expect(repeatMock).not.toHaveBeenCalled();
  });
});
