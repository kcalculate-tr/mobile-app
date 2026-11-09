// TabBarR3 + eski kabuk parite — render testleri (G11-S2 madde 9).
// Çalıştırma: npm run test:components (jest, jest-expo preset).
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DeviceEventEmitter } from 'react-native';
import { ReducedMotionProvider } from '../../../core/design/motion';

// ── Yerel taklitler (bu teste özel; paylaşılan jest.setup'a dokunulmaz) ──────
// Reanimated: resmi jest taklidi (useAnimatedStyle/withSpring/... senkron döner).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
// expo-blur: cam efekti testte düz View olarak geçer.
jest.mock('expo-blur', () => ({
  BlurView: ({ children, ...rest }: any) =>
    require('react').createElement('View', rest, children),
}));
// Güvenli alan: sabit insets.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));
// Bayraklar: useFeature'ı testten kontrol et (ai_tarama görünürlüğü için).
const mockFlags: Record<string, boolean> = {};
jest.mock('../../../core/flags', () => ({
  __esModule: true,
  useFeature: (key: string) => mockFlags[key] === true,
}));

import { TabBarR3 } from '../TabBarR3';
import { CustomTabBar } from '../../../navigation/CustomTabBar';
import { LEGACY_TABS } from '../tabs';
import { useCartStore } from '../../../store/cartStore';

function makeProps(routes: string[], index = 0) {
  const state = {
    index,
    routeNames: routes,
    routes: routes.map((name, i) => ({ key: `${name}-${i}`, name })),
    type: 'tab',
    stale: false,
    history: [],
    key: 'tab-root',
  };
  const navigate = jest.fn();
  const navigation = {
    emit: () => ({ defaultPrevented: false }),
    navigate,
    getParent: () => ({ navigate: jest.fn() }),
  };
  return { props: { state, navigation, descriptors: {}, insets: { top: 0, bottom: 0, left: 0, right: 0 } } as any, navigate };
}

const R3_ROUTES = ['Tracker', 'KesfetTab', 'Home', 'Profile', 'Cart', 'Subscriptions'];
const R3_ROUTES_NO_KESFET = ['Tracker', 'Home', 'Profile', 'Cart', 'Subscriptions'];

afterEach(() => {
  for (const k of Object.keys(mockFlags)) delete mockFlags[k];
  useCartStore.setState({ items: [], appliedCoupon: null });
});

describe('TabBarR3 (yeni kabuk)', () => {
  test('kesfet açık → 4 sekme etiketi (TR)', () => {
    const { props } = makeProps(R3_ROUTES, 0);
    const { getByText } = render(<TabBarR3 {...props} />);
    getByText('Ana sayfa');
    getByText('Keşfet');
    getByText('eatkcal');
    getByText('Profil');
  });

  test('ai_tarama açıkken Tara görünür, kapalıyken görünmez', () => {
    mockFlags.ai_tarama = true;
    const withScan = makeProps(R3_ROUTES, 0);
    const r1 = render(<TabBarR3 {...withScan.props} />);
    expect(r1.queryByText('Tara')).not.toBeNull();
    r1.unmount();

    mockFlags.ai_tarama = false; // bayrağı kapat → Tara gizlenmeli
    const noScan = makeProps(R3_ROUTES, 0);
    const r2 = render(<TabBarR3 {...noScan.props} />);
    expect(r2.queryByText('Tara')).toBeNull();
  });

  test('kesfet kapalı (KesfetTab kayıtlı değil) → Keşfet sekmesi yok', () => {
    const { props } = makeProps(R3_ROUTES_NO_KESFET, 0);
    const { queryByText, getByText } = render(<TabBarR3 {...props} />);
    expect(queryByText('Keşfet')).toBeNull();
    getByText('Ana sayfa');
    getByText('eatkcal');
    getByText('Profil');
  });

  test('gizli Cart/Subscriptions sekme olarak çizilmez (düğmesiz)', () => {
    const { props } = makeProps(R3_ROUTES, 0);
    const { queryByText } = render(<TabBarR3 {...props} />);
    // Bu rotalar navigatörde KAYITLI ama tab barda düğmeleri yok.
    expect(queryByText('Macro')).toBeNull();
    expect(queryByText('Sepet')).toBeNull(); // eatkcal sekmesinde değil + sepet boş
  });

  test('eatkcal sekmesinde + sepette ürün varken Sepet hapı çıkar ve Cart\'a gider', () => {
    useCartStore.setState({ items: [{ quantity: 2 } as any], appliedCoupon: null });
    const homeIndex = R3_ROUTES.indexOf('Home');
    const { props, navigate } = makeProps(R3_ROUTES, homeIndex);
    const { getByText } = render(<TabBarR3 {...props} />);
    const pill = getByText('Sepet (2)');
    expect(pill).not.toBeNull();
    const { fireEvent } = require('@testing-library/react-native');
    fireEvent.press(pill);
    expect(navigate).toHaveBeenCalledWith('Cart');
  });
});

describe('Eski kabuk parite (bayrak kapalı)', () => {
  test('CustomTabBar bugünkü etiketleri/sırayı render eder (LEGACY_TABS ile aynı)', () => {
    const legacyRoutes = LEGACY_TABS.map((t) => t.route); // Home,Tracker,Cart,Subscriptions,Profile
    const { props } = makeProps(legacyRoutes, 0);
    const { getByText } = render(<CustomTabBar {...props} />);
    for (const t of LEGACY_TABS) {
      if (t.label) getByText(t.label);
    }
  });
});

describe('Logla izi A — "+N" rozeti (azaltılmış hareket = uçuşsuz)', () => {
  test('kcal:logFlight → Ana sayfa sekmesinde "+1"; kcal:logUndo → kaybolur', () => {
    const { props } = makeProps(R3_ROUTES, 2); // eatkcal aktif; başka sekmeden log
    const { queryByText } = render(
      <ReducedMotionProvider value={true}>
        <TabBarR3 {...props} />
      </ReducedMotionProvider>,
    );
    expect(queryByText('+1')).toBeNull();

    act(() => {
      DeviceEventEmitter.emit('kcal:logFlight', {
        id: 'log-1',
        x: 40,
        y: 120,
        w: 48,
        h: 48,
        mealLabel: 'Öğle’ye',
      });
    });
    expect(queryByText('+1')).not.toBeNull();

    act(() => {
      DeviceEventEmitter.emit('kcal:logUndo', { id: 'log-1' });
    });
    expect(queryByText('+1')).toBeNull();
  });
});

// G20-S1 md.4 — Keşfet'te iki toast üst üste (G19-S4 SORULAR 4): kaynak kendi
// toast'ını gösteriyorsa kabuk yalnız rozet çizer; kabuk "Geri al"ı yalnız kaydı
// gerçekten silen `undo` verilirse görünür ve onu çağırır.
describe('G20-S1 — tek toast, Geri al gerçekten siler', () => {
  const flight = (extra: Record<string, unknown>) =>
    act(() => {
      DeviceEventEmitter.emit('kcal:logFlight', { x: 0, y: 0, w: 0, h: 0, mealLabel: 'Öğle', ...extra });
    });

  test('ownToast (Keşfet) → rozet var, kabuk toast’ı YOK', () => {
    const { props } = makeProps(R3_ROUTES, 1);
    const ui = render(
      <ReducedMotionProvider value={true}>
        <TabBarR3 {...props} />
      </ReducedMotionProvider>,
    );
    flight({ id: 'c-1', source: 'kesfet', ownToast: true });
    expect(ui.queryByText('+1')).not.toBeNull();
    expect(ui.queryByText(/loglandı/)).toBeNull();
    expect(ui.queryByText('Geri al')).toBeNull();
  });

  test('undo verilmeyen kaynak → toast var ama yanıltıcı "Geri al" YOK', () => {
    const { props } = makeProps(R3_ROUTES, 2);
    const ui = render(
      <ReducedMotionProvider value={true}>
        <TabBarR3 {...props} />
      </ReducedMotionProvider>,
    );
    flight({ source: 'scan' });
    expect(ui.queryByText(/loglandı/)).not.toBeNull();
    expect(ui.queryByText('Geri al')).toBeNull();
  });

  test('undo verilen kaynak → "Geri al" undo’yu çağırır, rozet düşer', async () => {
    const { props } = makeProps(R3_ROUTES, 2);
    const undo = jest.fn(() => Promise.resolve());
    const ui = render(
      <ReducedMotionProvider value={true}>
        <TabBarR3 {...props} />
      </ReducedMotionProvider>,
    );
    flight({ id: 'c-2', source: 'eatkcal', undo });
    await act(async () => {
      fireEvent.press(ui.getByText('Geri al'));
    });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(ui.queryByText('+1')).toBeNull();
  });
});
