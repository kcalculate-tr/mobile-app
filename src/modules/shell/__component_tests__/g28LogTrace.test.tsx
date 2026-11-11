// G28-S1 md.1 — Logla izi A ortak katmanı (LogTraceHost + logTrace + TabBarR3 rozeti).
// FinMoLogA: uçuş tabaktan Ana sayfa sekmesine; varışta +1 + toast; art arda her log ayrı
// uçuş ve +1; uçuş sürerken Geri al → uçuş kesilir, rozet artmaz; azaltılmışta uçuş yok.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DeviceEventEmitter } from 'react-native';
import { ReducedMotionProvider } from '../../../core/design/motion';

// Reanimated taklidi: animasyonu ELLE bitirebilmek için withTiming geri çağrısını sakla.
const mockPending: Array<(fin: boolean) => void> = [];
jest.mock('react-native-reanimated', () => {
  const real = require('react-native-reanimated/mock');
  return {
    ...real,
    withTiming: (to: number, _cfg?: unknown, cb?: (fin: boolean) => void) => {
      if (cb) mockPending.push(cb);
      return to;
    },
    withSpring: (to: number) => to,
    cancelAnimation: () => {
      // iptal: bekleyen geri çağrılar fin=false ile biter
      while (mockPending.length) mockPending.shift()!(false);
    },
  };
});
jest.mock('expo-blur', () => ({
  BlurView: ({ children, ...rest }: any) => require('react').createElement('View', rest, children),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: () => false }));

import { TabBarR3 } from '../TabBarR3';
import { LogTraceHost } from '../LogTraceHost';
import { badgeText, getHomeTabTarget, logTrace, measureRect } from '../logTrace';

function props() {
  const routes = ['Tracker', 'KesfetTab', 'Home', 'Profile'];
  return {
    state: { index: 1, routeNames: routes, routes: routes.map((name, i) => ({ key: `${name}-${i}`, name })), type: 'tab', stale: false, history: [], key: 't' },
    navigation: { emit: () => ({ defaultPrevented: false }), navigate: jest.fn(), getParent: () => ({ navigate: jest.fn() }) },
    descriptors: {},
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as any;
}

function mount(reduced = false) {
  return render(
    <ReducedMotionProvider value={reduced}>
      <TabBarR3 {...props()} />
      <LogTraceHost />
    </ReducedMotionProvider>,
  );
}

/** Uçuşun varışını tamamla (withTiming fin=true). */
function finishFlights() {
  act(() => {
    while (mockPending.length) mockPending.shift()!(true);
  });
}

const plate = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(40, 120, 240, 240) };

beforeEach(() => {
  mockPending.length = 0;
});

test('TabBarR3 Ana sayfa sekmesi hedefini bildirir (uçuş hedefi)', () => {
  mount();
  const t = getHomeTabTarget();
  expect(t).not.toBeNull();
  expect(t!.x).toBeGreaterThan(0);
});

test('logTrace: tabak ölçülür → uçuş başlar; varışta +1 rozet + toast (Geri al · Gör)', async () => {
  const ui = mount();
  const undo = jest.fn();
  await act(async () => {
    await logTrace({ from: plate, imageUri: 'file:///p.jpg', mealLabel: 'Öğle’ye', source: 'scan', id: 'r1', undo });
  });
  expect(ui.getByTestId('log-flight-r1')).toBeTruthy();
  expect(ui.queryByText('+1')).toBeNull(); // rozet varışta
  finishFlights();
  expect(ui.queryByTestId('log-flight-r1')).toBeNull();
  expect(ui.getByText('+1')).toBeTruthy();
  expect(ui.getByText(/loglandı/)).toBeTruthy();
  expect(ui.getByText('Geri al')).toBeTruthy();
  await act(async () => {
    fireEvent.press(ui.getByText('Geri al'));
  });
  expect(undo).toHaveBeenCalledTimes(1);
  expect(ui.queryByText('+1')).toBeNull();
});

test('uçuş sürerken Geri al → uçuş kesilir (solar), rozet ARTMAZ, toast yok', async () => {
  const ui = mount();
  await act(async () => {
    await logTrace({ from: plate, mealLabel: 'Öğle’ye', source: 'kesfet', id: 'r2', undo: jest.fn() });
  });
  expect(ui.getByTestId('log-flight-r2')).toBeTruthy();
  act(() => {
    DeviceEventEmitter.emit('kcal:logUndo', { id: 'r2' });
  });
  finishFlights(); // solma biter
  expect(ui.queryByTestId('log-flight-r2')).toBeNull();
  expect(ui.queryByText('+1')).toBeNull();
  expect(ui.queryByText(/loglandı/)).toBeNull();
});

test('art arda: her log ayrı uçuş ve +1', async () => {
  const ui = mount();
  await act(async () => {
    await logTrace({ from: plate, mealLabel: 'Öğle’ye', id: 'a' });
    await logTrace({ from: plate, mealLabel: 'Öğle’ye', id: 'b' });
  });
  expect(ui.getByTestId('log-flight-a')).toBeTruthy();
  expect(ui.getByTestId('log-flight-b')).toBeTruthy();
  finishFlights();
  expect(ui.getByText('+2')).toBeTruthy();
});

test('azaltılmış hareket: uçuş YOK — rozet + toast doğrudan', async () => {
  const ui = mount(true);
  await act(async () => {
    await logTrace({ from: plate, mealLabel: 'Öğle’ye', id: 'c' });
  });
  expect(ui.queryByTestId('log-flight-c')).toBeNull();
  expect(ui.getByText('+1')).toBeTruthy();
  expect(ui.getByText(/loglandı/)).toBeTruthy();
});

test('ölçülemeyen kaynak → uçuşsuz rozet + toast', async () => {
  const ui = mount();
  await act(async () => {
    await logTrace({ from: null, mealLabel: 'Öğle’ye', id: 'd' });
  });
  expect(ui.queryByTestId('log-flight-d')).toBeNull();
  expect(ui.getByText('+1')).toBeTruthy();
});

test('rozet en fazla 9+; measureRect boyutsuz görünümde null', async () => {
  expect(badgeText(1)).toBe('+1');
  expect(badgeText(9)).toBe('+9');
  expect(badgeText(10)).toBe('9+');
  expect(await measureRect({ measureInWindow: (cb) => cb(0, 0, 0, 0) })).toBeNull();
  expect(await measureRect(null)).toBeNull();
});

// G29-S1 md.1: logla izinde uçan görsel ÇIKARTMA — kırpılmaz/yuvarlanmaz, oran korunur (contain).
test('G29: çıkartma uçuşu (cutout) kırpılmaz; normal fotoğraf yuvarlatılmış cover kalır', async () => {
  const { StyleSheet } = require('react-native');
  const ui = mount();
  await act(async () => {
    await logTrace({ from: plate, imageUri: 'file:///sticker.webp', cutout: true, mealLabel: 'Öğle’ye', source: 'scan', id: 's1' });
  });
  const img = ui.getByTestId('log-flight-s1-sticker');
  expect(img.props.resizeMode).toBe('contain');
  const box = StyleSheet.flatten(ui.getByTestId('log-flight-s1').props.style);
  expect(box.overflow).toBe('visible');
  expect(box.borderRadius).toBe(0);
  finishFlights();
  await act(async () => {
    await logTrace({ from: plate, imageUri: 'file:///p.jpg', mealLabel: 'Öğle’ye', source: 'scan', id: 'p1' });
  });
  expect(ui.queryByTestId('log-flight-p1-sticker')).toBeNull();
  const box2 = StyleSheet.flatten(ui.getByTestId('log-flight-p1').props.style);
  expect(box2.overflow).toBe('hidden');
  expect(box2.borderRadius).toBe(16);
  finishFlights();
});
