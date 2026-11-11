// G30-S1 md.3 — "yanıp sönme" kök nedeni: sekme sahnesi solması (TabSceneFade) üst yığının odak
// değişiminde de tetikleniyordu. Gerçek navigatörlerle ölçülür: kök yığına ekran itip geri
// dönmek solma TETİKLEMEZ; yalnız sekme değişimi tetikler.
import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

// Sayaç: TabSceneFade'in solma çağrısı (opaklık 0 → withTiming(1)).
const mockFades: number[] = [];
jest.mock('react-native-reanimated', () => {
  const real = require('react-native-reanimated/mock');
  return {
    ...real,
    withTiming: (to: number, cfg?: { duration?: number }) => {
      mockFades.push(cfg?.duration ?? -1);
      return to;
    },
  };
});

import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { activeTabKey, shouldFadeOnSelect, tabSceneLayout } from '../TabSceneFade';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ref = createNavigationContainerRef<Record<string, object | undefined>>();

function Screen({ label }: { label: string }) {
  return <Text>{label}</Text>;
}
function Tabs() {
  return (
    <Tab.Navigator screenLayout={tabSceneLayout} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Tracker">{() => <Screen label="ana" />}</Tab.Screen>
      <Tab.Screen name="Profile">{() => <Screen label="profil" />}</Tab.Screen>
    </Tab.Navigator>
  );
}
function App() {
  return (
    <NavigationContainer ref={ref}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Detail">{() => <Screen label="detay" />}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
  }
}

beforeEach(() => {
  mockFades.length = 0;
});

test('kök yığına ekran itip geri dönmek sekme solmasını TETİKLEMEZ (yanıp sönme yok)', async () => {
  render(<App />);
  await flush();
  expect(mockFades).toHaveLength(0); // ilk açılışta solma yok
  await act(async () => {
    ref.navigate('Detail');
  });
  await flush();
  await act(async () => {
    ref.goBack();
  });
  await flush();
  expect(mockFades).toHaveLength(0);
  // ikinci tur (art arda gir-çık)
  await act(async () => {
    ref.navigate('Detail');
  });
  await flush();
  await act(async () => {
    ref.goBack();
  });
  await flush();
  expect(mockFades).toHaveLength(0);
});

test('sekme değişimi solmayı bir kez tetikler (FinMoTokens fast 200)', async () => {
  render(<App />);
  await flush();
  await act(async () => {
    ref.navigate('Tabs', { screen: 'Profile' } as never);
  });
  await flush();
  expect(mockFades).toHaveLength(1);
  await act(async () => {
    ref.navigate('Tabs', { screen: 'Tracker' } as never);
  });
  await flush();
  expect(mockFades).toHaveLength(2);
});

test('saf kurallar: seçilince solma; etkin sekme anahtarı', () => {
  expect(shouldFadeOnSelect(false, true)).toBe(true);
  expect(shouldFadeOnSelect(true, true)).toBe(false);
  expect(shouldFadeOnSelect(true, false)).toBe(false);
  expect(activeTabKey({ index: 1, routes: [{ key: 'a' }, { key: 'b' }] })).toBe('b');
  expect(activeTabKey({ routes: [] })).toBeNull();
  expect(activeTabKey(undefined)).toBeNull();
});
