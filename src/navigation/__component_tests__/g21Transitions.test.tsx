// G21-S1 md.9 — sayfa içi geçişler: push sağdan (PREMIUM.push), azaltılmışta 200 ms
// opaklık; bölüm sekmesi göstergesi + içerik kayar (azaltılmışta opaklık).
import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockTiming = jest.fn();
jest.mock('react-native-reanimated', () => {
  const m = require('react-native-reanimated/mock');
  return {
    ...m,
    withTiming: (v: number, cfg?: { duration?: number }) => {
      mockTiming(v, cfg?.duration);
      return v;
    },
  };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: any) => children };
});

import { pushTransition } from '../transitions';
import { PREMIUM, REDUCED, ReducedMotionProvider } from '../../core/design/motion';
import { SectionSlide } from '../../core/design/sectionSlide';
import { FinSegmented } from '../../modules/profil/ui/finUi';

const layout = (width: number) => ({ nativeEvent: { layout: { width, height: 48, x: 0, y: 0 } } });

beforeEach(() => mockTiming.mockClear());

test('push: sağdan kayma · PREMIUM.push.enter · kenar jesti açık', () => {
  expect(pushTransition(false)).toEqual({
    animation: 'slide_from_right',
    animationDuration: PREMIUM.push.enter,
    gestureEnabled: true,
  });
  expect(PREMIUM.push.enter).toBe(330); // G22-S2 md.1: push 300→330
});

test('push (azaltılmış hareket): opaklık 200 ms, jest yine açık', () => {
  expect(pushTransition(true)).toEqual({ animation: 'fade', animationDuration: REDUCED.duration, gestureEnabled: true });
  expect(REDUCED.duration).toBe(200);
});

function Seg({ reduced }: { reduced: boolean }) {
  const [i, setI] = React.useState(0);
  return (
    <ReducedMotionProvider value={reduced}>
      <FinSegmented options={['Makro', 'Abonelik']} index={i} onChange={setI} />
      <SectionSlide index={i} testID="section">
        <Text>{i === 0 ? 'icerik-0' : 'icerik-1'}</Text>
      </SectionSlide>
    </ReducedMotionProvider>
  );
}

test('bölüm sekmesi: gösterge ölçümden sonra çizilir, sekmeye basınca gösterge + içerik kayar (300 ms)', () => {
  const ui = render(<Seg reduced={false} />);
  expect(ui.queryByTestId('fin-segmented-indicator')).toBeNull();
  const row = ui.getByTestId('fin-segmented');
  act(() => fireEvent(row, 'layout', layout(361)));
  act(() => fireEvent(ui.getByTestId('section'), 'layout', layout(361)));
  expect(ui.getByTestId('fin-segmented-indicator')).toBeTruthy();
  mockTiming.mockClear();
  fireEvent.press(ui.getByText('Abonelik'));
  expect(ui.getByText('icerik-1')).toBeTruthy();
  // gösterge yeni sütuna (4 + 174.5 + 4) kayar, içerik 0'a kayarak oturur
  expect(mockTiming).toHaveBeenCalledWith(182.5, PREMIUM.push.enter);
  expect(mockTiming).toHaveBeenCalledWith(0, PREMIUM.push.enter);
});

test('bölüm sekmesi (azaltılmış): kayma yok, yalnız 200 ms opaklık', () => {
  const ui = render(<Seg reduced />);
  act(() => fireEvent(ui.getByTestId('fin-segmented'), 'layout', layout(361)));
  act(() => fireEvent(ui.getByTestId('section'), 'layout', layout(361)));
  mockTiming.mockClear();
  fireEvent.press(ui.getByText('Abonelik'));
  const durations = mockTiming.mock.calls.map(([, d]) => d);
  expect(durations.length).toBeGreaterThan(0);
  expect(durations.every((d) => d === REDUCED.duration)).toBe(true);
  // opaklık 1'e (gösterge + içerik), konum değeri animasyonla değil anında
  expect(mockTiming.mock.calls.every(([v]) => v === 1)).toBe(true);
});
