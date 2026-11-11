// G33-S1 md.10 — Öğün planı ekranları bileşen testleri: haftalık plan (boş hâl, Ekle sayfası sekmeleri +
// İzmir dışı, ekleme + bildirim + Geri al, Logla → mevcut kuyruk + "Öğle'ye loglandı · Geri al"), oluşturma
// (Ücretsiz önizleme: 1. gün açık + kilit; Fresh şablon sonucu + Planı uygula; alerjen açık rıza kartı;
// "Koç tıbbi tavsiye vermez."), alışveriş listesi (birleşik satırlar, Alındı/Temizle, Düzenle sil, Elle ekle,
// Plan yok, eatkcal sepeti → Sepete git), Profil satırları (bayrak), Light/Dark/TR/EN.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import { themes } from '../../../core/design/theme';
import { I18nProvider } from '../../../core/i18n';
import type { PlanItem } from '../types';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-blur', () => ({
  BlurView: (p: Record<string, unknown>) => require('react').createElement('View', { ...p, testID: 'plan-blur' }),
}));
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true), setOptions: jest.fn(), replace: jest.fn() };
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => mockNav,
    useRoute: () => ({ params: mockParams }),
    useFocusEffect: (cb: () => void) => React.useEffect(cb, []),
    NavigationContext: React.createContext(undefined),
  };
});
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1', email: 'deniz@example.com' } }) }));
jest.mock('../../../hooks/useNutritionSummary', () => ({
  useNutritionSummary: () => ({ summary: { targetKcal: 2180, targetProtein: 140, consumedKcal: 0 }, refetch: jest.fn() }),
}));
jest.mock('../../gun/track/dayClock', () => ({ dayKey: () => '2026-11-11' }));
let mockFlags: Record<string, boolean> = {};
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: (k: string) => !!mockFlags[k] }));

let mockWeekItems: PlanItem[] = [];
jest.mock('../client', () => {
  const actual = jest.requireActual('../client');
  return {
    ...actual,
    // Tablo boş (jest supabase taklidi) → uygulama içi TASLAK tohum (yalnız geliştirme yolu).
    fetchRecipeCatalog: () => actual.fetchRecipeCatalog(true),
    fetchWeek: () => Promise.resolve({ planId: mockWeekItems.length ? 'p-1' : null, note: null, items: mockWeekItems }),
    fetchShop: () => Promise.resolve({ state: [], manual: [] }),
    ensurePlan: () => Promise.resolve('p-1'),
    upsertItem: jest.fn(() => Promise.resolve()),
    deleteItem: jest.fn(() => Promise.resolve()),
    setItemLogged: jest.fn(() => Promise.resolve()),
    applyItems: jest.fn(() => Promise.resolve()),
    upsertShopState: jest.fn(() => Promise.resolve()),
    insertManual: jest.fn(() => Promise.resolve()),
    updateManual: jest.fn(() => Promise.resolve()),
  };
});
let mockIzmir = false;
const mockLog = jest.fn(() => Promise.resolve('c-1'));
const mockUnlog = jest.fn(() => Promise.resolve(true));
const mockCart = jest.fn(() => Promise.resolve({ added: 2, skipped: 0 }));
jest.mock('../actions', () => ({
  logPlanItem: (it: PlanItem) => mockLog(it),
  unlogPlanItem: (id: string) => mockUnlog(id),
  userInIzmir: () => Promise.resolve(mockIzmir),
  loadEatkcalOptions: () => Promise.resolve([{ id: 'p1', name: 'KCAL Tavuklu Bowl', kcal: 560, protein: 45, carbs: 50, fat: 18, price: 285 }]),
  addPlanMealsToCart: (items: PlanItem[]) => mockCart(items),
}));
let mockConsent = false;
const mockRecordConsent = jest.fn(() => Promise.resolve());
jest.mock('../../../lib/consent/store', () => ({
  readAllergenConsent: () => Promise.resolve(mockConsent),
  recordAllergenConsent: (g: boolean) => mockRecordConsent(g),
}));
jest.mock('../../gun/track/logQueueNative', () => {
  let n = 0;
  return { newRowId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, submitLogOp: () => Promise.resolve(true) };
});

// eslint-disable-next-line import/first
import { useSubscriptionStore } from '../../../lib/subscription/purchases';
// eslint-disable-next-line import/first
import { usePlanStore } from '../store';
// eslint-disable-next-line import/first
import MealPlanScreen from '../screens/MealPlanScreen';
// eslint-disable-next-line import/first
import PlanGenerateScreen from '../screens/PlanGenerateScreen';
// eslint-disable-next-line import/first
import ShoppingListScreen from '../screens/ShoppingListScreen';
// eslint-disable-next-line import/first
import { ProfilePlanRows } from '../ui/ProfilePlanRows';

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
type Scheme = 'light' | 'dark';
const render = (ui: React.ReactElement, scheme: Scheme = 'light', lang: 'tr' | 'en' = 'tr') =>
  rtlRender(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider forceScheme={scheme}>
        <I18nProvider forceLang={lang}>{ui}</I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
const flush = async () => {
  for (let i = 0; i < 8; i++) await act(async () => {});
};
const H = { includeHiddenElements: true } as const;
const setTier = (tier: 'free' | 'fresh' | 'balance') =>
  useSubscriptionStore.setState({ rc: tier === 'free' ? null : ({ tier } as never), server: tier === 'free' ? ({ tier: 'free' } as never) : ({ tier } as never) });

const item = (p: Partial<PlanItem>): PlanItem => ({
  id: p.id ?? `00000000-0000-4000-8000-0000000000${Math.floor(Math.random() * 90 + 10)}`,
  date: '2026-11-11',
  slot: 'lunch',
  source: 'recipe',
  refId: 'menemen',
  name: 'Menemen',
  portion: 1,
  kcal: 300,
  protein: 18,
  carbs: 22,
  fat: 16,
  loggedId: null,
  price: null,
  ...p,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = undefined;
  mockWeekItems = [];
  mockIzmir = false;
  mockConsent = false;
  mockFlags = { ogun_plani: true };
  usePlanStore.setState({ userId: null, weeks: {}, catalog: null });
  setTier('free');
});

describe('Haftalık plan', () => {
  test('boş hafta: "Bu haftanın planı boş" + Planı oluştur → oluşturma; Kendim planlayacağım → Ekle sayfası', async () => {
    const r = render(<MealPlanScreen />);
    await flush();
    expect(r.getByTestId('plan-empty')).toBeTruthy();
    expect(r.getByText('Bu haftanın planı boş')).toBeTruthy();
    expect(r.getByText('9–15 Kasım')).toBeTruthy();
    fireEvent.press(r.getByTestId('plan-empty-generate'));
    expect(mockNav.navigate).toHaveBeenCalledWith('MealPlanGenerate', { weekStart: '2026-11-09' });
    fireEvent.press(r.getByTestId('plan-empty-manual'));
    await flush();
    expect(r.getByText('Kahvaltı’ya ekle')).toBeTruthy();
  });

  test('Ekle: Tarif sekmesi kahvaltı tarifleri; eatkcal sekmesi İzmir dışında "eatkcal şimdilik yalnız İzmir’de" → Tariflere geç', async () => {
    mockWeekItems = [item({ slot: 'lunch' })];
    const r = render(<MealPlanScreen />);
    await flush();
    fireEvent.press(r.getByTestId('plan-add-breakfast'));
    await flush();
    expect(r.getByText('Yulaflı kahvaltı kasesi')).toBeTruthy();
    fireEvent.press(r.getByTestId('plan-add-tab-eatkcal'));
    await flush();
    expect(r.getByTestId('plan-add-izmir')).toBeTruthy();
    fireEvent.press(r.getByText('Tariflere geç'));
    await flush();
    expect(r.getByTestId('plan-add-search')).toBeTruthy();
  });

  test('Ekle: İzmir’de eatkcal ürünleri fiyatlı ("285 TL"); tarif eklenince satır + "Kahvaltı’ya eklendi · Geri al"', async () => {
    mockIzmir = true;
    mockWeekItems = [item({ slot: 'lunch' })];
    const r = render(<MealPlanScreen />);
    await flush();
    fireEvent.press(r.getByTestId('plan-add-breakfast'));
    await flush();
    fireEvent.press(r.getByTestId('plan-add-tab-eatkcal'));
    await flush();
    expect(r.getByText('KCAL Tavuklu Bowl')).toBeTruthy();
    expect(r.getByText('285 TL')).toBeTruthy();
    fireEvent.press(r.getByTestId('plan-add-tab-recipe'));
    await flush();
    await act(async () => {
      fireEvent.press(r.getByLabelText('Menemen ekle, 300 kcal'));
    });
    await flush();
    expect(r.getByText('Kahvaltı’ya eklendi')).toBeTruthy();
    expect(r.getByTestId('plan-toast-undo')).toBeTruthy();
  });

  test('Logla: mevcut kayıt kuyruğuna gider, buton "Loglandı", bildirim "Öğle’ye loglandı · Geri al"; Geri al siler', async () => {
    mockWeekItems = [item({ id: '00000000-0000-4000-8000-000000000001', slot: 'lunch', name: 'KCAL Tavuklu Bowl', source: 'eatkcal', refId: 'p1', kcal: 560, protein: 45 })];
    const r = render(<MealPlanScreen />);
    await flush();
    expect(r.getAllByText('560').length).toBeGreaterThan(0); // çip kcal + gün kartı
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-log-lunch'));
    });
    // Konum ölçümü en çok 60 ms beklenir (jest sahte zamanlayıcı; ölçüm yok → iz atlanır, kayıt yazılır).
    await act(async () => {
      jest.advanceTimersByTime(120);
    });
    await flush();
    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(r.getByTestId('plan-logged-lunch')).toBeTruthy();
    expect(r.getByText('Öğle’ye loglandı')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-toast-undo'));
    });
    await flush();
    expect(mockUnlog).toHaveBeenCalledWith('c-1');
    expect(r.getByTestId('plan-log-lunch')).toBeTruthy();
  });

  test('gelecek gün Logla yok; gün çipi VoiceOver etiketi; hafta ileri/geri sınırları', async () => {
    mockWeekItems = [item({ date: '2026-11-13', slot: 'dinner' })];
    const r = render(<MealPlanScreen />);
    await flush();
    fireEvent.press(r.getByTestId('plan-day-2026-11-13'));
    await flush();
    expect(r.queryByTestId('plan-log-dinner')).toBeNull();
    expect(r.getByLabelText('Cum 13, 300 kcal, 1 öğün planlı')).toBeTruthy();
    expect(r.getByTestId('plan-week-prev').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(r.getByTestId('plan-week-next'));
    await flush();
    expect(r.getByText('Gelecek hafta')).toBeTruthy();
  });
});

describe('Planı benim için oluştur', () => {
  test('Ücretsiz: şablon önizleme — 1. gün açık, kalanı bulanık + "Planın tamamı Fresh’te"; Planı uygula → Fresh paywall', async () => {
    const r = render(<PlanGenerateScreen />);
    await flush();
    expect(r.getByTestId('plan-mode-template')).toBeTruthy();
    expect(r.getByText('Koç tıbbi tavsiye vermez.')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-generate-cta'));
    });
    // Satırlar sırayla akar (Fresh/şablon 330 aralık) — her adımda zamanlayıcı + mikro görev.
    for (let i = 0; i < 12; i++) {
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
    }
    await flush();
    expect(r.getByTestId('plan-result')).toBeTruthy();
    expect(r.getByTestId('plan-result-lock')).toBeTruthy();
    expect(r.getAllByTestId('plan-blur', H).length).toBe(4); // Çar açık; Per–Paz bulanık
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-apply'));
    });
    expect(mockNav.navigate).toHaveBeenCalledWith('SubPaywall', { from: 'meal_plan', plan: 'fresh' });
  });

  test('Fresh: "Şablonla oluştur" → sonuç (bulanık yok, Balance kartı) → Planı uygula yazar ve haftaya döner', async () => {
    setTier('fresh');
    const r = render(<PlanGenerateScreen />);
    await flush();
    expect(r.getByText('Şablonla oluştur')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-generate-cta'));
    });
    // Satırlar sırayla akar (Fresh/şablon 330 aralık) — her adımda zamanlayıcı + mikro görev.
    for (let i = 0; i < 12; i++) {
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
    }
    await flush();
    expect(r.queryByTestId('plan-blur', H)).toBeNull();
    expect(r.getByTestId('plan-result-upsell')).toBeTruthy();
    expect(r.getByText('Çarşamba – Pazar, 5 gün')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-apply'));
    });
    await flush();
    const { applyItems } = jest.requireMock('../client') as { applyItems: jest.Mock };
    expect(applyItems).toHaveBeenCalledTimes(1);
    expect((applyItems.mock.calls[0] as unknown[])[2]).toHaveLength(20); // 5 gün × 4 yuva
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  test('Alerjen: rıza yoksa çipler kapalı → açık rıza kartı; "Açık rıza veriyorum" kaydeder ve çip seçilir', async () => {
    const r = render(<PlanGenerateScreen />);
    await flush();
    expect(r.getByText('Alerjen seçimi için açık rızan gerekiyor.')).toBeTruthy();
    fireEvent.press(r.getByTestId('plan-allergen-peanut'));
    await flush();
    expect(r.getByTestId('plan-allergen-consent')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-consent-accept'));
    });
    expect(mockRecordConsent).toHaveBeenCalledWith(true);
    fireEvent.press(r.getByTestId('plan-allergen-peanut'));
    await flush();
    expect(r.getByTestId('plan-allergen-peanut').props.accessibilityState).toMatchObject({ checked: true });
    expect(r.getByText('Seçtiklerini içeren tarif ve ürünler plana girmez.')).toBeTruthy();
  });

  test('İzmir dışı: "eatkcal öğünleri dahil et" kapalı + açıklama; geçmiş günler seçilemez', async () => {
    const r = render(<PlanGenerateScreen />);
    await flush();
    expect(r.getByText('eatkcal yalnız İzmir’e teslim eder')).toBeTruthy();
    expect(r.getByTestId('plan-toggle-eatkcal').props.disabled).toBe(true);
    expect(r.getByTestId('plan-gen-day-2026-11-09').props.accessibilityState).toMatchObject({ disabled: true });
    expect(r.getByText('5 gün seçili')).toBeTruthy();
  });

  test('Balance: Koç kartı + "Koç’la oluştur"', async () => {
    setTier('balance');
    const r = render(<PlanGenerateScreen />);
    await flush();
    expect(r.getByTestId('plan-mode-coach')).toBeTruthy();
    expect(r.getByText('Koç’la oluştur')).toBeTruthy();
  });
});

describe('Alışveriş listesi', () => {
  const week = () => [
    item({ id: '00000000-0000-4000-8000-000000000011', date: '2026-11-11', slot: 'breakfast', refId: 'menemen' }),
    item({ id: '00000000-0000-4000-8000-000000000012', date: '2026-11-12', slot: 'breakfast', refId: 'menemen', portion: 1.5 }),
    item({ id: '00000000-0000-4000-8000-000000000013', date: '2026-11-12', slot: 'lunch', source: 'eatkcal', refId: 'p1', name: 'KCAL Tavuklu Bowl', price: 285 }),
  ];

  test('Ücretsiz → Fresh paywall', async () => {
    render(<ShoppingListScreen />);
    await flush();
    expect(mockNav.navigate).toHaveBeenCalledWith('SubPaywall', { from: 'shopping_list', plan: 'fresh' });
  });

  test('Plan yok hâli', async () => {
    setTier('fresh');
    const r = render(<ShoppingListScreen />);
    await flush();
    expect(r.getByTestId('shop-empty')).toBeTruthy();
    expect(r.getByText('Plan yaparsan malzemeler buraya gelir')).toBeTruthy();
  });

  test('birleşik satırlar (Yumurta 250 g → 5 adet), işaretle → Alındı (1) → Temizle; Düzenle → sil', async () => {
    setTier('fresh');
    mockWeekItems = week();
    const r = render(<ShoppingListScreen />);
    await flush();
    expect(r.getByText('Bu haftanın listesi')).toBeTruthy();
    expect(r.getByText(/Sebze ve meyve/)).toBeTruthy();
    expect(r.getByText('5 adet')).toBeTruthy();
    expect(r.getByText('Planındaki 1 tariften')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('shop-check-plan:egg'));
    });
    await flush();
    expect(r.getByText('Alındı (1)')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('shop-clear'));
    });
    await flush();
    expect(r.queryByText('Alındı (1)')).toBeNull();
    fireEvent.press(r.getByTestId('shop-edit'));
    await act(async () => {
      fireEvent.press(r.getByTestId('shop-del-plan:tomato'));
    });
    await flush();
    expect(r.queryByTestId('shop-line-plan:tomato')).toBeNull();
    expect(r.getByText('Bitti')).toBeTruthy();
  });

  test('Elle ekle: satır "Elle eklendi"; eatkcal kartı → sepet → "Sepete ekle (285 TL)" → bildirim "Sepete git"', async () => {
    setTier('fresh');
    mockWeekItems = week();
    const r = render(<ShoppingListScreen />);
    await flush();
    fireEvent.press(r.getByTestId('shop-add'));
    await act(async () => {
      fireEvent.changeText(r.getByTestId('shop-add-input'), 'Kahve');
    });
    await act(async () => {
      fireEvent(r.getByTestId('shop-add-input'), 'submitEditing');
    });
    await flush();
    expect(r.getByText('Kahve')).toBeTruthy();
    expect(r.getByText('Elle eklendi')).toBeTruthy();
    expect(r.getByText('Bu hafta 1 öğün eatkcal’dan')).toBeTruthy();
    fireEvent.press(r.getByTestId('shop-add-cart'));
    await flush();
    expect(r.getByText('Sepete ekle (285 TL)')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('shop-basket-add'));
    });
    await flush();
    expect(mockCart).toHaveBeenCalled();
    expect(r.getByTestId('shop-in-cart')).toBeTruthy();
    fireEvent.press(r.getByTestId('plan-toast-action'));
    expect(mockNav.navigate).toHaveBeenCalledWith('EkCart');
  });
});

describe('Profil satırları', () => {
  test('bayrak KAPALI → satır yok', () => {
    mockFlags = {};
    const r = render(<ProfilePlanRows onOpen={jest.fn()} />);
    expect(r.queryByTestId('profile-plan-row')).toBeNull();
    expect(r.queryByTestId('profile-shopping-row')).toBeNull();
  });

  test('bayrak AÇIK → değerler plandan ("1 / 28 öğün"), dokununca rota', async () => {
    mockWeekItems = [item({})];
    const onOpen = jest.fn();
    const r = render(<ProfilePlanRows onOpen={onOpen} />);
    await flush();
    expect(r.getByText('1 / 28 öğün')).toBeTruthy();
    expect(r.getByText('Tarif malzemeleri')).toBeTruthy();
    fireEvent.press(r.getByTestId('profile-plan-row'));
    expect(onOpen).toHaveBeenCalledWith('MealPlan');
  });
});

describe.each(['light', 'dark'] as Scheme[])('%s tema', (scheme) => {
  const c = themes[scheme].color;
  test('plan ekranı tema zemini + gün kartı yüzeyi', async () => {
    mockWeekItems = [item({})];
    const r = render(<MealPlanScreen />, scheme);
    await flush();
    expect(StyleSheet.flatten(r.getByTestId('meal-plan').props.style).backgroundColor).toBe(c.bg);
    expect(StyleSheet.flatten(r.getByTestId('plan-day-card').props.style).backgroundColor).toBe(c.surface);
  });
});

test('EN: Meal plan, Calories, Log, "This week’s plan is empty", Build my plan for me', async () => {
  const r = render(<MealPlanScreen />, 'dark', 'en');
  await flush();
  expect(r.getByText('Meal plan')).toBeTruthy();
  expect(r.getByText('This week’s plan is empty')).toBeTruthy();
  expect(r.getByText('9–15 November')).toBeTruthy();
  mockWeekItems = [item({})];
  usePlanStore.setState({ weeks: {} });
  const r2 = render(<MealPlanScreen />, 'light', 'en');
  await flush();
  expect(r2.getByText('Calories')).toBeTruthy();
  expect(r2.getByText('Log')).toBeTruthy();
  expect(r2.getByText('Build my plan for me')).toBeTruthy();
});
