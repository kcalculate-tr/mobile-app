// G49-S1 md.2 · md.3 · md.5 — profilsiz Ana sayfa kartı (cam yüzey, süzülen kupa, ÖRNEK analiz önizlemesi, lime düğme),
// "Neler yapabilirsin" 2×2 eylemleri ve kayıt akışı cam ikonları (normal ↔ `_sel`, 150 ms).
import React from 'react';
import fs from 'fs';
import path from 'path';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const m = require('react-native-reanimated/mock');
  return { ...m, withRepeat: jest.fn((v: unknown) => v) };
});
jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
const mockReduceT = { v: false };
jest.mock('../../personalPlan/bridge', () => ({ useReduceTransparency: () => mockReduceT.v }));

import { withRepeat } from 'react-native-reanimated';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import { ReducedMotionProvider } from '../../../core/design/motion';
import { I18nProvider } from '../../../core/i18n';
import { track } from '../../../lib/analytics';
import { HomePlanGateCard, PLAN_SAMPLE } from '../ui/HomePlanGateCard';
import { HomeQuickActions } from '../ui/HomeQuickActions';
import { GlassIcon, KAYIT_GLASS, GOAL_GLASS, GENDER_GLASS, ACT_GLASS, DIET_GLASS, COOK_GLASS, STRUGGLE_GLASS } from '../ui/glassIcons';
import { K_MOTION } from '../ui/theme';

const ROOT = path.join(__dirname, '../../../..');
const H = { includeHiddenElements: true } as const;
const trackMock = track as unknown as jest.Mock;
const repeatMock = withRepeat as unknown as jest.Mock;
type N = { props: Record<string, unknown> };
const flat = (n: N) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, unknown>;
const wrap = (el: React.ReactElement, o: { scheme?: 'light' | 'dark'; lang?: 'tr' | 'en'; reduced?: boolean } = {}) => (
  <ThemeProvider forceScheme={o.scheme ?? 'light'}>
    <I18nProvider forceLang={o.lang ?? 'tr'}>
      <ReducedMotionProvider value={o.reduced ?? false}>{el}</ReducedMotionProvider>
    </I18nProvider>
  </ThemeProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockReduceT.v = false;
});

describe('md.2 profilsiz Ana sayfa kartı', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme} · TR metinler, Örnek etiketi, analiz önizlemesi (halka · 3 makro · 7 sütun), lime düğme`, () => {
      const onStart = jest.fn();
      const r = render(wrap(<HomePlanGateCard onStart={onStart} />, { scheme }));
      expect(r.getByText('Kalorilerini ve sağlığını takip et')).toBeTruthy();
      expect(r.getByText('1 dakikalık planla günlük kalori hedefin ve makroların hazır.')).toBeTruthy();
      expect(r.getByText('Örnek')).toBeTruthy();
      const prev = r.getByTestId('home-gate-preview');
      expect(prev.props.accessibilityLabel).toMatch(/^Örnek analiz önizlemesi, gerçek verin değil: 1\.450 \/ 2\.100 kcal/);
      expect(r.getByText('1.450')).toBeTruthy();
      expect(r.getByText('/ 2.100 kcal')).toBeTruthy();
      for (const m of ['Protein', 'Karb', 'Yağ']) expect(r.getByText(m)).toBeTruthy();
      expect(r.getAllByTestId('home-gate-col')).toHaveLength(7);
      expect(PLAN_SAMPLE.week).toHaveLength(7);
      const b = r.getByTestId('home-profile-gate-start');
      expect(b.props.accessibilityLabel).toBe('Planımı oluştur');
      expect(r.getByText('Planımı oluştur')).toBeTruthy();
      // Yüzey: yarıçap 28, ince iç kenar ışığı.
      const card = r.getByTestId('home-profile-gate') as unknown as { findAll: (f: (n: N) => boolean) => N[] };
      const surf = card.findAll((n) => flat(n).borderRadius === 28 && flat(n).borderWidth === 1);
      expect(surf.length).toBeGreaterThan(0);
      expect(trackMock).toHaveBeenCalledWith('home_plan_card_view');
      expect(trackMock.mock.calls.filter((c) => c[0] === 'home_plan_card_view')).toHaveLength(1);
      fireEvent.press(b);
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(trackMock).toHaveBeenCalledWith('home_plan_card_tap', { action: 'plan' });
    });
  }

  test('EN metinler + "Sample"', () => {
    const r = render(wrap(<HomePlanGateCard onStart={jest.fn()} />, { lang: 'en', scheme: 'dark' }));
    expect(r.getByText('Track your calories and health')).toBeTruthy();
    expect(r.getByText('A 1-minute plan sets your daily calories and macros.')).toBeTruthy();
    expect(r.getByText('Create my plan')).toBeTruthy();
    expect(r.getByText('Sample')).toBeTruthy();
    expect(r.getByTestId('home-gate-preview').props.accessibilityLabel).toMatch(/^Sample analysis preview, not your data/);
  });

  test('kupa: süzülme döngüsü (withRepeat, ±3°, 6 pt); azaltılmış harekette SABİT', () => {
    const r = render(wrap(<HomePlanGateCard onStart={jest.fn()} />));
    expect(repeatMock).toHaveBeenCalled();
    const moving = flat(r.getByTestId('home-gate-cup', H) as unknown as N);
    expect(Array.isArray(moving.transform)).toBe(true);
    repeatMock.mockClear();
    const s = render(wrap(<HomePlanGateCard onStart={jest.fn()} />, { reduced: true }));
    expect(repeatMock).not.toHaveBeenCalled();
    expect(flat(s.getByTestId('home-gate-cup', H) as unknown as N).transform).toBeUndefined();
    // kupa kartın sağ üst köşesinden taşar (negatif üst / sağ)
    const cup = flat(s.getByTestId('home-gate-cup', H) as unknown as N);
    expect(cup.position).toBe('absolute');
    expect(Number(cup.top)).toBeLessThan(0);
    expect(Number(cup.right)).toBeLessThan(0);
  });

  test('hareket token\'ı: 4 sn döngü (2 × 2000), 6 pt, ±3°, çizim 600 ms, sütun kademesi ≤ 40 ms, eylem 220 ms / toplam ≤ 150 ms', () => {
    const { HOME_GATE_MOTION: M } = require('../../../core/design/motion');
    expect(M.cupHalf * 2).toBe(4000);
    expect(M.cupShift).toBe(6);
    expect(M.cupTilt).toBe(3);
    expect(M.draw).toBe(600);
    expect(M.colStagger).toBeLessThanOrEqual(40);
    expect(M.actEnter).toBe(220);
    expect(M.actShift).toBe(8);
    expect(M.actStagger * 3).toBeLessThanOrEqual(150);
    expect(M.pressScale).toBe(0.98);
  });

  test('"Saydamlığı azalt": bulanıklık yerine düz yüzey (kart yine çizilir)', () => {
    mockReduceT.v = true;
    const r = render(wrap(<HomePlanGateCard onStart={jest.fn()} />));
    expect(r.getByTestId('home-profile-gate-start')).toBeTruthy();
  });

  test('1,3× yazı: başlık/metin kırpılmaz (numberOfLines yok), tavan 1,3', () => {
    const r = render(wrap(<HomePlanGateCard onStart={jest.fn()} />));
    const title = r.getByText('Kalorilerini ve sağlığını takip et');
    expect(title.props.numberOfLines).toBeUndefined();
    expect(title.props.maxFontSizeMultiplier).toBe(1.3);
  });
});

describe('md.3 Neler yapabilirsin', () => {
  test('TR: başlık + 4 kart (ikon · başlık · alt metin), dokunma → eylem + ölçüm', () => {
    const onAction = jest.fn();
    const r = render(wrap(<HomeQuickActions onAction={onAction} />));
    expect(r.getByText('Neler yapabilirsin')).toBeTruthy();
    const rows: [string, string, string][] = [
      ['scan', 'Tabağını tara', 'Fotoğrafla, kalorisini gör'],
      ['activity', 'Etkinlik ekle', 'Yürüyüş, spor, yaktığın kalori'],
      ['share', 'Öğününü paylaş', "Bugünkü tabağını Keşfet'te paylaş"],
      ['coach', "Koç'a sor", 'Akşam ne yesem?'],
    ];
    for (const [a, title, sub] of rows) {
      expect(r.getByText(title)).toBeTruthy();
      expect(r.getByText(sub)).toBeTruthy();
      const card = r.getByTestId(`home-quick-${a}`);
      expect(card.props.accessibilityLabel).toBe(`${title}. ${sub}`);
      fireEvent.press(card);
      expect(onAction).toHaveBeenLastCalledWith(a);
      expect(trackMock).toHaveBeenLastCalledWith('home_plan_card_tap', { action: a });
    }
    expect(onAction).toHaveBeenCalledTimes(4);
  });

  test('EN başlıklar; özelliği kapalı eylem gösterilmez (sıra korunur)', () => {
    const r = render(wrap(<HomeQuickActions actions={['coach', 'scan', 'share']} onAction={jest.fn()} />, { lang: 'en' }));
    expect(r.getByText('What you can do')).toBeTruthy();
    expect(r.getByText('Scan your plate')).toBeTruthy();
    expect(r.queryByTestId('home-quick-activity')).toBeNull();
    const ids = r.UNSAFE_root.findAll((n: { props: Record<string, unknown>; type: unknown }) => /^home-quick-(scan|share|coach)$/.test(String(n.props?.testID)) && typeof n.type !== 'string').map((n: { props: Record<string, unknown> }) => n.props.testID);
    expect([...new Set(ids)]).toEqual(['home-quick-scan', 'home-quick-share', 'home-quick-coach']);
  });

  test('kart ≥ 44 pt dokunma alanı', () => {
    const r = render(wrap(<HomeQuickActions onAction={jest.fn()} />));
    const st = StyleSheet.flatten(r.getByTestId('home-quick-scan').props.style) as Record<string, number>;
    expect(st.minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe('md.5 kayıt cam ikonları', () => {
  test('22 ikon × (normal + _sel) asset olarak var, her biri ≤ 30 KB; kaynak sprite/anlam tablosu commit edilmez', () => {
    expect(Object.keys(KAYIT_GLASS)).toHaveLength(22);
    for (const n of Object.keys(KAYIT_GLASS)) {
      for (const f of [`${n}.png`, `${n}_sel.png`]) {
        const p = path.join(ROOT, 'assets/kayit/icons', f);
        expect(fs.existsSync(p)).toBe(true);
        expect(fs.statSync(p).size).toBeLessThanOrEqual(30 * 1024);
      }
    }
    const files = fs.readdirSync(path.join(ROOT, 'assets/kayit/icons'));
    expect(files).toHaveLength(44);
    expect(files.some((f) => f.startsWith('_'))).toBe(false);
  });

  test('eşleme tablosu (P1 · P2 · P8 · P10 · P13 · P14)', () => {
    expect(GOAL_GLASS).toEqual({ lose: 'down', maintain: 'eq', gain: 'up', muscle: 'bell', balanced: 'apple' });
    expect(GENDER_GLASS).toEqual({ female: 'venus', male: 'mars' });
    expect(ACT_GLASS).toEqual({ sedentary: 'desk', light: 'walk', moderate: 'stand', active: 'bolt' });
    expect(DIET_GLASS).toEqual({ all: 'omni', vegetarian: 'sprout', vegan: 'leaf', pescatarian: 'fish' });
    expect(COOK_GLASS).toEqual({ daily: 'pan', sometimes: 'clock', ready: 'bag' });
    expect(STRUGGLE_GLASS).toEqual({ evening_snack: 'moon', eating_out: 'shop', no_time: 'glass', sweet: 'cake' });
    const q = fs.readFileSync(path.join(ROOT, 'src/modules/kayit/screens/QuestionsScreen.tsx'), 'utf8');
    for (const re of [/glass=\{GOAL_GLASS\[g\]\}/, /glass=\{GENDER_GLASS\[g\]\}/, /glass: ACT_GLASS\[k\]/, /glass=\{DIET_GLASS\[d\]\}/, /glass=\{COOK_GLASS\[c\]\}/, /glass=\{STRUGGLE_GLASS\[c\]\}/]) {
      expect(q).toMatch(re);
    }
  });

  test('seçilmemiş → normal PNG, seçili → _sel; 150 ms çapraz geçiş; arkada daire/zemin yok', async () => {
    expect(K_MOTION.iconCross).toBe(150);
    const r = render(wrap(<GlassIcon name="down" selected={false} size={44} testID="gi" />));
    const box = flat(r.getByTestId('gi', H) as unknown as N);
    expect(box.width).toBe(44);
    expect(box.backgroundColor).toBeUndefined();
    expect(box.borderRadius).toBeUndefined();
    expect(flat(r.getByTestId('gi-normal', H) as unknown as N).opacity).toBe(1);
    expect(flat(r.getByTestId('gi-sel', H) as unknown as N).opacity).toBe(0);
    expect(r.getByTestId('gi-normal', H).props.source).toBe(KAYIT_GLASS.down.normal);
    expect(r.getByTestId('gi-sel', H).props.source).toBe(KAYIT_GLASS.down.selected);
    r.rerender(wrap(<GlassIcon name="down" selected size={44} testID="gi" />));
    await act(async () => {
      jest.advanceTimersByTime(80);
    });
    const mid = Number(flat(r.getByTestId('gi-sel', H) as unknown as N).opacity);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(flat(r.getByTestId('gi-sel', H) as unknown as N).opacity).toBe(1);
    expect(flat(r.getByTestId('gi-normal', H) as unknown as N).opacity).toBe(0);
  });

  test('azaltılmış harekette anlık geçiş; açık ve koyu temada aynı PNG', () => {
    const a = render(wrap(<GlassIcon name="moon" selected size={36} testID="m" />, { scheme: 'dark', reduced: true }));
    expect(flat(a.getByTestId('m-sel', H) as unknown as N).opacity).toBe(1);
    const b = render(wrap(<GlassIcon name="moon" selected={false} size={36} testID="m2" />, { scheme: 'light' }));
    const c = render(wrap(<GlassIcon name="moon" selected={false} size={36} testID="m3" />, { scheme: 'dark' }));
    expect(b.getByTestId('m2-normal', H).props.source).toBe(c.getByTestId('m3-normal', H).props.source);
  });
});
