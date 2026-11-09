// G18-S2 — Ana sayfa Tur 26 bileşen testleri: FinMoPopover (yerinde öğün menüsü),
// öne çıkanlar banner'ı (veri yoksa gizli, tek dokunuş), bölge satırları, hero (hedef yok).
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: jest.fn() }),
    useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, [cb]),
  };
});
jest.mock('../../../onboarding/first', () => ({
  HomeOnboardingSlot: () => null,
  HomeFirstMealCard: () => null,
  useOrientTarget: () => ({}),
}));
// measureInWindow test ortamında geri çağırmaz → sabit çapa (pano: x 58, y 200).
jest.mock('../MealMenuPopover', () => {
  const actual = jest.requireActual('../MealMenuPopover');
  return {
    ...actual,
    useAnchorMeasure: () => ({ ref: { current: null }, measure: async () => ({ x: 58, y: 200, width: 190, height: 44 }) }),
  };
});

import { HomeMealSlots } from '../../../../screens/tracker/HomeMealSlots';
import { FinTopBlock } from '../../../../screens/tracker/FinTopBlock';
import { buildSlots } from '../../homeData';
import { MealMenuPopover } from '../MealMenuPopover';
import { HomeBanner } from '../HomeBanner';
import { HomeOutsideCards } from '../HomeRegion';
import type { HomeBannerItem } from '../banner';

async function flush(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

describe('FinMoPopover — yerinde öğün menüsü', () => {
  test('⌄ sheet değil yerinde menü açar; öğün seçince etiket güncellenir ve menü kapanır; ana yarı o öğüne + porsiyonla loglar', async () => {
    const onLog = jest.fn();
    const onChangeMeal = jest.fn();
    const ui = render(
      <HomeMealSlots slots={buildSlots([])} eaten={0} target={2000} onLog={onLog} onChangeMeal={onChangeMeal} onRemove={() => {}} nowHour={19} />,
    );
    expect(ui.getByText('Akşam’a logla')).toBeTruthy();
    await act(async () => fireEvent.press(ui.getByTestId('log-pill-caret-dinner')));
    await flush();
    expect(ui.getByTestId('meal-menu')).toBeTruthy();
    expect(onChangeMeal).not.toHaveBeenCalled(); // eski sheet açılmadı

    // Porsiyon değişince menü AÇIK kalır.
    fireEvent.press(ui.getByTestId('meal-menu-portion-one_half'));
    await flush(300);
    expect(ui.getByTestId('meal-menu')).toBeTruthy();

    // Öğün seçimi → etiket "Öğle’ye logla", menü 200 ms'de kapanır.
    fireEvent.press(ui.getByTestId('meal-menu-lunch'));
    await flush(300);
    expect(ui.queryByTestId('meal-menu')).toBeNull();
    expect(ui.getByText('Öğle’ye logla')).toBeTruthy();

    fireEvent.press(ui.getByText('Öğle’ye logla'));
    expect(onLog).toHaveBeenCalledWith('lunch', 1.5);
  });

  test('dışarı dokunma (şeffaf yakalayıcı) menüyü kapatır; seçili öğün işaretli', async () => {
    const onClosed = jest.fn();
    const ui = render(
      <MealMenuPopover
        anchor={{ x: 58, y: 200, width: 190, height: 44 }}
        meal="dinner"
        portion={1}
        onPickMeal={() => {}}
        onPickPortion={() => {}}
        onClosed={onClosed}
      />,
    );
    expect(ui.getByTestId('meal-menu-dinner').props.accessibilityState).toMatchObject({ checked: true });
    expect(ui.getByTestId('meal-menu-lunch').props.accessibilityState).toMatchObject({ checked: false });
    fireEvent.press(ui.getByTestId('meal-menu-catcher', { includeHiddenElements: true }));
    await flush(300);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});

describe('Öne çıkanlar banner', () => {
  const items: HomeBannerItem[] = [
    { kind: 'recipe', id: 'r', image: 'https://x/r.jpg', title: 'Mercimek çorbası', meta: null, target: { type: 'post', postId: 'p1' } },
    { kind: 'campaign', id: 'c', image: 'https://x/c.jpg', title: 'Hafta sonu', meta: null, target: { type: 'eatkcal', link: null } },
  ];
  test('veri yoksa bölüm yok', () => {
    const ui = render(<HomeBanner items={[]} onOpen={() => {}} />);
    expect(ui.queryByTestId('home-banner')).toBeNull();
  });
  test('kart metni görselin altında, "İncele" yok; tek dokunuş onOpen', () => {
    const onOpen = jest.fn();
    const ui = render(<HomeBanner items={items} onOpen={onOpen} />);
    expect(ui.getByText('Haftanın tarifi')).toBeTruthy();
    expect(ui.getByText('Tarifi aç, tek dokunuşla logla')).toBeTruthy();
    expect(ui.getByText('eatkcal kampanyası, yalnız İzmir’de')).toBeTruthy();
    expect(ui.queryByText('İncele')).toBeNull();
    fireEvent.press(ui.getByTestId('home-banner-recipe'));
    expect(onOpen).toHaveBeenCalledWith(items[0]);
  });
});

describe('Bölge — İzmir dışı', () => {
  test('iki satır → bekleme listesi (ekle / öner)', () => {
    const onWaitlist = jest.fn();
    const ui = render(<HomeOutsideCards onWaitlist={onWaitlist} />);
    expect(ui.getByText('Şimdilik yalnız İzmir’de')).toBeTruthy();
    fireEvent.press(ui.getByTestId('home-wait-add'));
    fireEvent.press(ui.getByTestId('home-wait-suggest'));
    expect(onWaitlist.mock.calls).toEqual([['add'], ['suggest']]);
  });
});

describe('Hero (FinHomeR3 a)', () => {
  const base = { macros: { protein: 0, carbs: 0, fat: 0 }, macroTargets: { protein: 140, carbs: 250, fat: 70 } };
  test('hedef yok → "Hedef belirlenmedi", "kcal bugün", makro yüzdesi yerine —', () => {
    const ui = render(<FinTopBlock kcal={0} target={2000} hasTarget={false} {...base} />);
    expect(ui.getByText('Hedef belirlenmedi')).toBeTruthy();
    expect(ui.getByText('kcal bugün')).toBeTruthy();
    expect(ui.getAllByText('—').length).toBe(3);
    expect(ui.getByTestId('home-hero-flame')).toBeTruthy(); // merkezde ALEV (G18-ORTAK #14)
  });
  test('boş gün + hedef var → hedef sayısı + "kcal bugünkü hedefin"', () => {
    const ui = render(<FinTopBlock kcal={0} target={2180} {...base} />);
    expect(ui.getByText('2.180')).toBeTruthy();
    expect(ui.getByText('kcal bugünkü hedefin')).toBeTruthy();
    expect(ui.getAllByText('0 / 140 g').length).toBe(2); // hero Protein satırı + makro çipi
  });
});
