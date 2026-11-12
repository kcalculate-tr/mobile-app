// G21-S1 md.3 — AppSchemeGate: yeni kabukta useTheme sistem temasını izler; eski
// kabukta koyu telefonda bile açık kalır ve native görünüm açığa sabitlenir.
import React from 'react';
import { Appearance, Text } from 'react-native';
import { render } from '@testing-library/react-native';

let mockFlags: Record<string, boolean> = {};
let mockReady = true;
jest.mock('../../flags', () => ({
  useFeature: (k: string) => mockFlags[k] === true,
  useFlagsContext: () => ({ ready: mockReady }),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => 'dark' }));

import { AppSchemeGate } from '../SchemeGate';
import { useTheme } from '../ThemeProvider';

function Probe() {
  const t = useTheme();
  return <Text testID="probe">{t.isDark ? 'dark' : 'light'}</Text>;
}

describe('AppSchemeGate', () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    mockReady = true;
  });
  afterEach(() => spy.mockRestore());

  test('yeni kabuk + koyu telefon → koyu tema, native çağrı yok', () => {
    mockFlags = { yeni_kabuk: true };
    const ui = render(<AppSchemeGate><Probe /></AppSchemeGate>);
    expect(ui.getByTestId('probe').props.children).toBe('dark');
    expect(spy).not.toHaveBeenCalled();
  });

  test('eski kabuk + koyu telefon → açık tema, Appearance.setColorScheme("light")', () => {
    mockFlags = { yeni_kabuk: false };
    const ui = render(<AppSchemeGate><Probe /></AppSchemeGate>);
    expect(ui.getByTestId('probe').props.children).toBe('light');
    expect(spy).toHaveBeenCalledWith('light');
  });

  test('bayrak hazır değil → açık tema, native dokunulmaz', () => {
    mockFlags = { yeni_kabuk: true };
    mockReady = false;
    const ui = render(<AppSchemeGate><Probe /></AppSchemeGate>);
    expect(ui.getByTestId('probe').props.children).toBe('light');
    expect(spy).not.toHaveBeenCalled();
  });
});
