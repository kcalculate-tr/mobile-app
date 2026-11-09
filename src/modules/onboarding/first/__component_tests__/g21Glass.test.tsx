// G21-S1 md.1 — Tur 26f cam nesneleri (İlter onaylı tablo):
//  · FinOpen/FinMoOpen: tabak → kase → halka merkezinde ALEV
//  · FinOnbAccount: damla → kase · FinOnbNotify: alev → kupa · FinTbAbout: damla → alev
//  · FinHomeXL boş gün: damla → kase · FinCelebrate/FinMoStreak: seri kupa, ilk öğün kase
//  · FinHomeR3/FinMoFocus: halka merkezi alev (değişmedi — doğrulama)
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, act } from '@testing-library/react-native';

jest.mock('../../../../core/flags', () => ({ useFeature: () => false }));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets };
});

import { OpenSignature, __resetOpenSignature } from '../OpenSignature';
import { OPEN_T } from '../state';
import { celebrateContent } from '../../../celebrate/types';

const SRC = path.resolve(__dirname, '../../../..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** `function <name>(` gövdesindeki ilk `glass={GLASS.x}` anahtarı. */
function glassOf(file: string, fn: string): string | undefined {
  const s = read(file);
  const at = s.indexOf(`function ${fn}(`);
  if (at < 0) return undefined;
  const next = s.indexOf('\nfunction ', at + 10);
  const body = s.slice(at, next < 0 ? undefined : next);
  return body.match(/glass=\{GLASS\.(\w+)\}/)?.[1];
}

/** GLASS haritasındaki anahtarın kaynak görseli (bowl/flame/trophy/drop/foot). */
function assetOf(file: string, key: string): string | undefined {
  const s = read(file);
  const m = s.match(new RegExp(`\\b${key}: \\{ source: require\\('[./]+/assets/glass/(\\w+)\\.png'\\)`));
  return m?.[1];
}

describe('Tur 26f cam nesneleri', () => {
  test('FinOpen: halka dolarken kase halka merkezinde aleve döner (kare kare)', async () => {
    __resetOpenSignature();
    expect(OPEN_T.enterEnd).toBeLessThan(OPEN_T.flameIn);
    expect(OPEN_T.flameIn).toBeLessThan(OPEN_T.ringEnd);
    const ui = render(<OpenSignature forcePlay frozenAt={OPEN_T.ringEnd} />);
    await act(async () => {});
    expect(ui.getByTestId('fin-open-flame')).toBeTruthy();
  });

  test('FinOnbAccount = kase · FinOnbNotify = kupa', () => {
    const f = 'modules/onboarding/OnboardingNavigator.tsx';
    expect(assetOf(f, glassOf(f, 'AccountScreen')!)).toBe('bowl');
    expect(assetOf(f, glassOf(f, 'NotifyScreen')!)).toBe('trophy');
    // Aynen kalanlar: Karşılama kase, Niyet ayak izi.
    expect(assetOf(f, glassOf(f, 'WelcomeScreen')!)).toBe('bowl');
    expect(assetOf(f, glassOf(f, 'IntentScreen')!)).toBe('foot');
  });

  test('FinTbAbout = alev; hedef kupa, tempo alev, etkinlik ayak izi, ilk adım kase (aynen)', () => {
    const f = 'modules/onboarding/takibe/TakibeNavigator.tsx';
    expect(assetOf(f, glassOf(f, 'AboutScreen')!)).toBe('flame');
    expect(assetOf(f, glassOf(f, 'GoalScreen')!)).toBe('trophy');
    expect(assetOf(f, glassOf(f, 'PaceScreen')!)).toBe('flame');
    expect(assetOf(f, glassOf(f, 'ActivityScreen')!)).toBe('foot');
    expect(assetOf(f, glassOf(f, 'FirstScreen')!)).toBe('bowl');
  });

  test('FinHomeXL boş gün = kase; damla Ana sayfa boş hâlinde yok', () => {
    const s = read('screens/tracker/HomeMealSlots.tsx');
    expect(s).toMatch(/<GlassObject name="bowl" size=\{104\} \/>/);
    expect(s).not.toMatch(/<GlassObject name="drop"/);
  });

  test('FinCelebrate/FinMoStreak: seri kupa, ilk öğün kase', () => {
    expect(celebrateContent('streak3').glass).toBe('trophy');
    expect(celebrateContent('streak7').glass).toBe('trophy');
    expect(celebrateContent('first').glass).toBe('bowl');
  });

  test('FinHomeR3/FinMoFocus: halka merkezi alev', () => {
    const s = read('screens/tracker/FinTopBlock.tsx');
    expect(s).toMatch(/const FLAME = require\('[./]+\/assets\/glass\/flame\.png'\)/);
    expect(s).toMatch(/source=\{FLAME\}[\s\S]{0,200}testID="home-hero-flame"/);
  });
});
