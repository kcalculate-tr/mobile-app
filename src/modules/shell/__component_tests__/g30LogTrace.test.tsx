// G30-S1 md.1 — Logla izi FinMoLogA kare kare: zamanlama sabitleri, Reduce Motion yolu, uçan
// kopyanın görsel yüklenmeden görünmemesi + ekranda olunca kaynağa haber (onStart), tam ekran
// fotoğrafın kırpılarak başlaması, ölçülen sekme hedefi, Ana sayfa görünürken rozet olmaması.
// md.2 — çıkartma konturu yardımcıları.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ReducedMotionProvider, TIMING, DURATION, SPRING } from '../../../core/design/motion';

const mockTimings: { to: number; cfg?: { duration?: number }; cb?: (fin: boolean) => void }[] = [];
const mockSprings: { to: number; cfg: unknown }[] = [];
jest.mock('react-native-reanimated', () => {
  const real = require('react-native-reanimated/mock');
  return {
    ...real,
    withTiming: (to: number, cfg?: { duration?: number }, cb?: (fin: boolean) => void) => {
      mockTimings.push({ to, cfg, cb });
      return to;
    },
    withSpring: (to: number, cfg: unknown) => {
      mockSprings.push({ to, cfg });
      return to;
    },
    cancelAnimation: () => {},
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
const mockNavState: { root: unknown } = { root: undefined };
jest.mock('../../../navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => mockNavState.root !== undefined,
    getRootState: () => mockNavState.root,
    addListener: () => () => {},
    navigate: () => {},
  },
}));

import { LogTraceHost, FLY_END_SCALE, FLY_IMAGE_READY_TIMEOUT_MS, FLY_RADIUS, flightTransform } from '../LogTraceHost';
import { emitLogFlight } from '../logEvents';
import {
  FLIGHT_START_TIMEOUT_MS,
  isHomeVisible,
  liftedRect,
  logTrace,
  measureHomeTabTarget,
  setHomeTabNode,
  setHomeTabTarget,
} from '../logTrace';
import { TabBarR3 } from '../TabBarR3';
import { outlineOffsets, stickerOutlineWidth, STICKER_OUTLINE } from '../../../lib/sticker/StickerImage';
import { LIFT_SCALE, LIFT_SHIFT } from '../../ai/scan/ui/StickerLift';

const H = { includeHiddenElements: true };
const plate = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(16, 152, 358, 300) };

function tabProps() {
  const routes = ['Tracker', 'KesfetTab', 'Home', 'Profile'];
  return {
    state: { index: 1, routeNames: routes, routes: routes.map((name, i) => ({ key: `${name}-${i}`, name })), type: 'tab', stale: false, history: [], key: 't' },
    navigation: { emit: () => ({ defaultPrevented: false }), navigate: jest.fn(), getParent: () => ({ navigate: jest.fn() }) },
    descriptors: {},
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as any;
}
function mount(reduced = false, withBar = false) {
  return render(
    <ReducedMotionProvider value={reduced}>
      {withBar ? <TabBarR3 {...tabProps()} /> : null}
      <LogTraceHost />
    </ReducedMotionProvider>,
  );
}
async function tick(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockTimings.length = 0;
  mockSprings.length = 0;
  mockNavState.root = undefined;
  setHomeTabNode(null);
  setHomeTabTarget({ x: 52, y: 778 });
});

test('zamanlama sabitleri FinMoLogA: uçuş slow 500 (+%10), ölçek 0,08, AI yayı, yarıçap 16', () => {
  expect(TIMING.logTrail).toBe(550);
  expect(FLY_END_SCALE).toBe(0.08);
  expect(FLY_RADIUS).toBe(16);
  expect(FLY_IMAGE_READY_TIMEOUT_MS).toBeLessThan(FLIGHT_START_TIMEOUT_MS);
  expect(FLIGHT_START_TIMEOUT_MS).toBeLessThanOrEqual(DURATION.slow);
});

test('uçan kopya görsel yüklenene kadar görünmez; yüklenince AI yayı + slow 500 saati, kaynağa onStart', async () => {
  const ui = mount();
  const onStart = jest.fn();
  await act(async () => {
    emitLogFlight({ id: 'f1', x: 16, y: 152, w: 358, h: 300, imageUri: 'file:///p.jpg', onStart });
    await Promise.resolve();
    await Promise.resolve();
  });
  const box = ui.getByTestId('log-flight-f1');
  expect(StyleSheet.flatten(box.props.style).opacity).toBe(0); // henüz görünmez
  expect(mockSprings).toHaveLength(0);
  expect(onStart).not.toHaveBeenCalled();
  // görsel yüklendi
  const img = box.findAll((n: any) => typeof n.props?.onLoad === 'function')[0];
  await act(async () => {
    fireEvent(img, 'load');
  });
  expect(mockSprings).toHaveLength(1);
  expect(mockSprings[0].cfg).toBe(SPRING.ai); // konum + ölçek tek ilerleme
  const clock = mockTimings.find((t) => t.cfg?.duration === TIMING.logTrail);
  expect(clock).toBeTruthy();
  await tick(20); // bir kare
  expect(onStart).toHaveBeenCalledTimes(1);
  // varış: kopya kalkar
  await act(async () => {
    clock!.cb!(true);
  });
  expect(ui.queryByTestId('log-flight-f1')).toBeNull();
});

test('görsel hiç yüklenmezse uçuş yine başlar (FLY_IMAGE_READY_TIMEOUT_MS)', async () => {
  mount();
  const onStart = jest.fn();
  await act(async () => {
    emitLogFlight({ id: 'f2', x: 16, y: 152, w: 358, h: 300, imageUri: 'file:///yok.jpg', onStart });
    await Promise.resolve();
  });
  await tick(FLY_IMAGE_READY_TIMEOUT_MS + 20);
  expect(mockSprings).toHaveLength(1);
  expect(onStart).toHaveBeenCalledTimes(1);
});

test('tam ekran fotoğraf: kopya tabak bölgesini alttaki fotoğraftan birebir kırpar (imageRect)', async () => {
  const ui = mount();
  await act(async () => {
    emitLogFlight({
      id: 'f3', x: 70, y: 120, w: 250, h: 250, imageUri: 'file:///p.jpg',
      imageRect: { x: 0, y: 0, w: 390, h: 844 },
    });
    await Promise.resolve();
  });
  const img = ui.getByTestId('log-flight-f3').findAll((n: any) => typeof n.props?.onLoad === 'function')[0];
  const st = StyleSheet.flatten(img.props.style);
  expect(st).toMatchObject({ position: 'absolute', left: -70, top: -120, width: 390, height: 844 });
  expect(img.props.resizeMode).toBe('cover');
});

test('Reduce Motion: uçuş YOK, onStart hemen (kaynak ekran beklemeden kapanır), rozet + toast', async () => {
  const ui = mount(true, true);
  let resolved = false;
  await act(async () => {
    void logTrace({ from: plate, imageUri: 'file:///p.jpg', mealLabel: 'Öğle’ye', id: 'r1' }).then(() => {
      resolved = true;
    });
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(resolved).toBe(true); // zamanlayıcı ilerlemeden
  expect(ui.queryByTestId('log-flight-r1')).toBeNull();
  expect(ui.getByText('+1')).toBeTruthy();
  expect(ui.getByText(/loglandı/)).toBeTruthy();
});

test('hedef: Ana sayfa sekme ikonunun ÖLÇÜLEN merkezi (hesaplanan değil); ölçülemezse hesaplanan', async () => {
  setHomeTabNode({ measureInWindow: (cb) => cb(30, 756, 44, 44) }); // merkez (52, 778)
  setHomeTabTarget({ x: 999, y: 999 });
  await expect(measureHomeTabTarget()).resolves.toEqual({ x: 52, y: 778 });
  setHomeTabNode({ measureInWindow: () => {} }); // yanıt yok → süre aşımı → hesaplanan
  const p = measureHomeTabTarget();
  await tick(100);
  await expect(p).resolves.toEqual({ x: 999, y: 999 });
});

test('dönüşüm: konum + ölçek tek ilerleme; m=1 → kopya merkezi hedefte, ölçek 0,08 (pano −143, +476)', () => {
  // FinMoLogA: 358×300 görsel (16,152) → ikon merkezi (52,778): translate(−143px, 476px) scale(.08)
  const r = { x: 16, y: 152, w: 358, h: 300 };
  const end = flightTransform(1, r, { x: 52, y: 778 });
  expect(end.tx).toBeCloseTo(-143, 5);
  expect(end.ty).toBeCloseTo(476, 5);
  expect(end.scale).toBeCloseTo(FLY_END_SCALE, 5);
  const start = flightTransform(0, r, { x: 52, y: 778 });
  expect(Math.abs(start.tx) + Math.abs(start.ty)).toBe(0);
  expect(start.scale).toBe(1);
  const half = flightTransform(0.5, r, { x: 52, y: 778 });
  expect(half.tx / end.tx).toBeCloseTo(0.5, 5);
  expect((1 - half.scale) / (1 - end.scale)).toBeCloseTo(0.5, 5); // aynı eğri
  expect(flightTransform(1.03, r, { x: 52, y: 778 }).scale).toBeGreaterThan(0); // yay taşması
});

test('Ana sayfa görünürken varışta "+1" rozeti YOK (FinMoLogB: satır + halka); başka sekmedeyken var', async () => {
  mockNavState.root = { index: 0, routes: [{ name: 'Tabs', state: { index: 0, routes: [{ name: 'Tracker' }, { name: 'Profile' }] } }] };
  const ui = mount(true, true);
  await act(async () => {
    await logTrace({ from: plate, mealLabel: 'Öğle’ye', id: 'h1' });
  });
  expect(ui.queryByText('+1')).toBeNull();
  expect(ui.getByText(/loglandı/)).toBeTruthy();
  mockNavState.root = { index: 0, routes: [{ name: 'Tabs', state: { index: 1, routes: [{ name: 'Tracker' }, { name: 'Profile' }] } }] };
  await act(async () => {
    await logTrace({ from: plate, mealLabel: 'Öğle’ye', id: 'h2' });
  });
  expect(ui.getByText('+1')).toBeTruthy();
});

test('isHomeVisible: yalnız kök Tabs + etkin sekme Tracker', () => {
  expect(isHomeVisible({ index: 0, routes: [{ name: 'Tabs', state: { index: 0, routes: [{ name: 'Tracker' }] } }] })).toBe(true);
  expect(isHomeVisible({ index: 1, routes: [{ name: 'Tabs' }, { name: 'AiScan' }] })).toBe(false);
  expect(isHomeVisible({ index: 0, routes: [{ name: 'Tabs', state: { index: 1, routes: [{ name: 'Tracker' }, { name: 'Profile' }] } }] })).toBe(false);
  expect(isHomeVisible({ index: 0, routes: [{ name: 'Tabs' }] })).toBe(false);
  expect(isHomeVisible(undefined)).toBe(false);
});

test('kalkmış çıkartmanın görünen kutusu: −8 kayma, ×1,04 merkezden', () => {
  const r = liftedRect({ x: 100, y: 200, w: 200, h: 100 }, LIFT_SHIFT, LIFT_SCALE);
  expect(r.w).toBeCloseTo(208, 5);
  expect(r.h).toBeCloseTo(104, 5);
  expect(r.x).toBeCloseTo(96, 5);
  expect(r.y).toBeCloseTo(200 - 2 - 8, 5);
});

test('md.2 kontur: 3 pt büyük, 2 pt < 64, 1,5 pt < 40; 3 pt 12 yön, ince 8 yön, yarıçap = kalınlık', () => {
  expect(stickerOutlineWidth(300)).toBe(STICKER_OUTLINE);
  expect(STICKER_OUTLINE).toBe(3);
  expect(stickerOutlineWidth(44)).toBe(2);
  expect(stickerOutlineWidth(30)).toBe(1.5);
  const o3 = outlineOffsets(3);
  expect(o3).toHaveLength(12);
  for (const o of o3) expect(Math.hypot(o.dx, o.dy)).toBeCloseTo(3, 1);
  expect(outlineOffsets(2)).toHaveLength(8);
});
