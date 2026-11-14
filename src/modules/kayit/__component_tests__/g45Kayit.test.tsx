// G45-S1 — Kayıt akışı: İlter'in simülatör düzeltmeleri.
//  1. Kesilen yazılar: Bricolage/kayıt yazılarında açık satır yüksekliği (≥ 1,2 em; AppText varsayılanı 24 pt
//     büyük yazıyı üstten kırpıyordu), tekerlek satırı seçili yılı taşır; f+i / f+l bitişik harfi U+200C ile kapalı.
//  2. İkon altı soluk daire yok; ikon rengi seçilmemiş P.ink, seçili limeInk.
//  3. Seçili kart / hap / çipte onay rozeti yok; accessibilityState.selected var.
//  4. Sayılı halka yok → ince ilerleme çubuğu (3 pt, 250 ms); L2/K1'de çubuk yok.
//  5. L2 eatkcal kartı → kampanya bannerı (yalnız İzmir + banner varsa; 300×104, yarıçap 20; hedef kuralı).
//  6. L2 rıza: kutu yok, düğme üstü küçük not + "Onayla ve planımı kaydet" (her zaman etkin; basınca rıza yazılır).
//  7. K1 yazı ölçüleri; 8. balon 22 pt, dar ekranda ≤ 2 satır düzeni; 9. T1 rozetleri düz, kenarsız, kart içinde.
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => {
  const m = require('react-native-reanimated/mock');
  const R = require('react');
  const useSharedValue = (init: unknown) => {
    const ref = R.useRef(null);
    if (!ref.current) ref.current = { value: init };
    return ref.current;
  };
  return { ...m, useSharedValue, default: { ...m.default, useSharedValue } };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: () => true }));
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => ({ user: null, signInWithApple: jest.fn(), signInWithGoogle: jest.fn() }) }));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: () => Promise.resolve({ isConnected: true }) } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'TR' }] }));
jest.mock('../../../lib/consent/metaConsent', () => ({ requestMetaOptIn: jest.fn(async () => ({ granted: false, att: 'denied' })) }));
let mockConsentKnown = false;
jest.mock('../../personalPlan/api', () => ({ healthConsentGiven: jest.fn(async () => mockConsentKnown), savePlan: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../onboarding/takibe/save', () => ({ saveTakibeProfile: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../../lib/consent/store', () => ({ recordHealthConsent: jest.fn(async () => true), acceptPolicies: jest.fn(async () => true) }));
jest.mock('../../plan/client', () => ({ fetchRecipeCatalog: jest.fn(async () => ({ recipes: [] })) }));
const mockCell = { id: 'c1', row_id: 'r1', position: 0, image_url: 'https://cdn.example/b1.webp', title: 'Kampanya', link: null, navigate_to: 'ProductDetail:42', is_active: true };
jest.mock('../../../lib/banners', () => ({
  fetchBannerRows: jest.fn(async () => ({ hero: [{ id: 'r1', type: 'hero', grid_size: 1, order: 0, is_active: true, cells: [mockCell] }], promo: [] })),
}));
let mockRegion: 'izmir' | 'other' | 'unknown' = 'izmir';
jest.mock('../../gun/home/useHomeRegion', () => ({ useHomeRegion: () => mockRegion }));

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), reset: jest.fn(), canGoBack: () => true, getParent: () => mockNav };
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) };
});

import { I18nProvider } from '../../../core/i18n';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import QuestionsScreen from '../screens/QuestionsScreen';
import { ResultScreen } from '../screens/PlanScreens';
import { SignupScreen } from '../screens/SignupScreens';
import { ProgressBar, QuestionHead, ZWNJ, noLig } from '../ui/parts';
import { WHEEL_ROW } from '../ui/pickers';
import { K_DARK, K_LIGHT, K_MOTION } from '../ui/theme';
import { openCampaign, pickCampaign } from '../banner';
import { useKayit } from '../store';
import { emptyKAnswers } from '../model';
import { tr, en } from '../i18n';
import { recordHealthConsent } from '../../../lib/consent/store';

const ROOT = join(__dirname, '../../../..');
const src = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const wrap = (el: React.ReactElement) => (
  <ThemeProvider forceScheme="light">
    <I18nProvider forceLang="tr">{el}</I18nProvider>
  </ThemeProvider>
);
const wait = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const flat = (s: unknown) => (StyleSheet.flatten(s as never) ?? {}) as Record<string, unknown>;
const plain = (v: unknown) => String(v).replace(/‌/g, '');
type N = { props: Record<string, unknown>; type: unknown; parent: N | null; findAll: (f: (n: N) => boolean) => N[] };

const ANSWERS = { ...emptyKAnswers(), goal: 'lose' as const, gender: 'female' as const, birthYear: 1995, heightCm: 170, weightKg: 72, targetWeightKg: 66, activity: 'light' as const, diet: 'all' as const, meals: 3, cooking: 'sometimes' as const, struggle: 'evening_snack' as const };

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = undefined;
  mockConsentKnown = false;
  mockRegion = 'izmir';
  useKayit.getState().reset();
  await AsyncStorage.clear();
});

// ─── md.1 ────────────────────────────────────────────────────────────────────
describe('md.1 kesilen yazılar', () => {
  test('bitişik harf kapatma: f+i / f+l / f+f arasına U+200C, diğerleri aynı', () => {
    expect(noLig('Hafif')).toBe(`Haf${ZWNJ}if`);
    expect(noLig('fly')).toBe(`f${ZWNJ}ly`);
    expect(noLig('Offer')).toBe(`Of${ZWNJ}fer`);
    expect(noLig('Kilo vermek')).toBe('Kilo vermek');
    expect(noLig('fat')).toBe('fat');
    expect(plain(noLig('Hafif fikir'))).toBe('Hafif fikir');
  });

  test('kayıt yazı stilleri: her yazı stilinde açık satır yüksekliği; Bricolage (display) ≥ 1,2 em (doğal satır)', () => {
    const files = [
      'src/modules/kayit/ui/parts.tsx',
      'src/modules/kayit/ui/pickers.tsx',
      'src/modules/kayit/ui/consent.tsx',
      'src/modules/kayit/screens/QuestionsScreen.tsx',
      'src/modules/kayit/screens/PlanScreens.tsx',
      'src/modules/kayit/screens/SignupScreens.tsx',
      'src/modules/kayit/screens/OfferScreen.tsx',
      'src/modules/kayit/screens/ReturnScreen.tsx',
    ];
    const bad: string[] = [];
    for (const f of files) {
      src(f)
        .split('\n')
        .forEach((line, i) => {
          const fs = /fontSize: (\d+)/.exec(line);
          if (!fs || /searchInput|field:/.test(line)) return; // TextInput satırları
          const lh = /lineHeight: (\d+)/.exec(line);
          if (!lh) return bad.push(`${f}:${i + 1} lineHeight yok`);
          if (/FONT\.display/.test(line) && Number(lh[1]) < 1.2 * Number(fs[1]) - 0.01) bad.push(`${f}:${i + 1} ${lh[1]} < 1,2 × ${fs[1]}`);
        });
    }
    expect(bad).toEqual([]);
  });

  test('P3 tekerlek: seçili yıl satırı (34 pt / 44, Dynamic Type tavanı 1,2×) satır yüksekliğine sığar', () => {
    const p = src('src/modules/kayit/ui/pickers.tsx');
    expect(p).toMatch(/wheelOn: \{ fontFamily: FONT\.display, fontSize: 34, lineHeight: 44/);
    expect(WHEEL_ROW).toBeGreaterThanOrEqual(Math.ceil(44 * 1.2));
    // Satır içi yazı tanımı kalmadı (stil dosyasında, açık satır yüksekliğiyle).
    expect(p).not.toMatch(/fontSize: d === 0/);
  });

  test('cetvel / L1 / L2 büyük rakamları kırpılmaz (≥ 1,2 em)', () => {
    expect(src('src/modules/kayit/screens/QuestionsScreen.tsx')).toMatch(/big: \{ fontFamily: FONT\.display, fontSize: 88, lineHeight: 106/);
    const plan = src('src/modules/kayit/screens/PlanScreens.tsx');
    expect(plan).toMatch(/calcNum: \{ fontFamily: FONT\.display, fontSize: 52, lineHeight: 64/);
    expect(plan).toMatch(/kcal: \{ fontFamily: FONT\.display, fontSize: 48, lineHeight: 58/);
  });

  test('P8 galeri başlığı ("Hafif") 25 pt / 32 satır + bitişik harf kapalı', async () => {
    useKayit.getState().patch({ ...ANSWERS, activity: 'light' });
    mockParams = { vitrinStep: 'activity' };
    const r = render(wrap(<QuestionsScreen />));
    await wait(20);
    const title = r.getAllByText(`Haf${ZWNJ}if`)[0];
    expect(flat(title.props.style)).toMatchObject({ fontSize: 25, lineHeight: 32 });
  });
});

// ─── md.2 / md.3 ─────────────────────────────────────────────────────────────
describe('md.2–3 seçim kartları', () => {
  test('P1: ikon altı daire yok; ikon seçilmemiş P.ink, seçili limeInk; rozet yok; selected durumu var', async () => {
    const r = render(wrap(<QuestionsScreen />));
    await wait(20);
    fireEvent.press(r.getByTestId('kayit-goal-lose'));
    await wait(K_MOTION.select + 120);
    for (const g of ['lose', 'maintain', 'gain', 'muscle', 'balanced']) {
      const tile = r.getByTestId(`kayit-goal-${g}`) as unknown as N;
      const on = g === 'lose';
      expect(tile.props.accessibilityState).toMatchObject({ selected: on });
      // Kart içinde ikon arkasında dolgulu daire (soluk lime / beyaz) yok.
      const circles = tile.findAll((n) => {
        const st = flat(n.props.style);
        return typeof st.borderRadius === 'number' && st.backgroundColor !== undefined && n !== tile && st.width === st.height;
      });
      expect(circles.length).toBe(0);
      // Onay rozeti yok (mutlak konumlu öğe yok).
      expect(tile.findAll((n) => flat(n.props.style).position === 'absolute').length).toBe(0);
      // İkon rengi: her seçenekte aynı (seçilmemiş P.ink, seçili limeInk).
      const icons = tile.findAll((n) => typeof n.props.color === 'string' && n.props.weight === 'bold');
      expect(icons.length).toBeGreaterThan(0);
      expect(icons[0].props.color).toBe(on ? K_LIGHT.limeInk : K_LIGHT.ink);
    }
  });

  test('P10 beslenme kartları: ikon dairesi ve rozet yok', async () => {
    useKayit.getState().patch({ ...ANSWERS, diet: 'vegan' });
    mockParams = { vitrinStep: 'diet' };
    const r = render(wrap(<QuestionsScreen />));
    await wait(K_MOTION.select + 50);
    const tile = r.getByTestId('kayit-diet-vegan') as unknown as N;
    expect(flat(tile.props.style).backgroundColor).toBe(K_LIGHT.accent);
    expect(tile.findAll((n) => flat(n.props.style).position === 'absolute').length).toBe(0);
    expect(tile.findAll((n) => flat(n.props.style).backgroundColor === K_LIGHT.accentSoft).length).toBe(0);
  });

  test('P9 çip / gün hapı: tik yok, seçili hâl tam lime + selected', async () => {
    useKayit.getState().patch({ ...ANSWERS, sports: ['run'], sportDays: [0] });
    mockParams = { vitrinStep: 'sport' };
    const r = render(wrap(<QuestionsScreen />));
    await wait(K_MOTION.select + 50);
    const chip = r.getByTestId('kayit-sport-run') as unknown as N;
    expect(chip.props.accessibilityState).toMatchObject({ checked: true, selected: true });
    expect(flat(chip.props.style).backgroundColor).toBe(K_LIGHT.accent);
    const days = tr.q.days.split(',');
    const longs = tr.q.days_long.split(',');
    const day = r.getByTestId(`kayit-day-${days[0]}-${longs[0]}`) as unknown as N;
    expect(day.props.accessibilityState).toMatchObject({ selected: true });
    expect(day.findAll((n) => typeof n.props.color === 'string' && n.props.weight === 'bold').length).toBe(0);
  });

  test('kaynakta rozet bileşeni kalmadı (CheckBadge, iconBg)', () => {
    const p = src('src/modules/kayit/ui/pickers.tsx');
    expect(p).not.toMatch(/CheckBadge|iconBg/);
  });
});

// ─── md.4 ────────────────────────────────────────────────────────────────────
describe('md.4 ilerleme çubuğu', () => {
  test('sorularda sayılı halka yok, ince çubuk var (3 pt, yuvarlak uçlu, oran = görünen soru sayısı)', async () => {
    useKayit.getState().patch({ ...ANSWERS });
    mockParams = { vitrinStep: 'height' };
    const r = render(wrap(<QuestionsScreen />));
    await wait(K_MOTION.bar + 50);
    const bar = r.getByTestId('kayit-progress');
    expect(bar.props.accessibilityRole).toBe('progressbar');
    const { now, max } = bar.props.accessibilityValue as { now: number; max: number };
    expect(now).toBeGreaterThan(0);
    const fill = r.getByTestId('kayit-progress-fill');
    const fst = flat(fill.props.style);
    expect(fst.height).toBe(3);
    expect(fst.borderRadius).toBe(1.5);
    expect(fst.backgroundColor).toBe(K_LIGHT.barFill);
    expect(String(fst.width)).toMatch(/^\d+(\.\d+)?%$/);
    // Halka numarası yok.
    expect(r.queryByText(String(now))).toBeNull();
    expect(max).toBeGreaterThan(now);
  });

  test('çubuk oranı = index / total (ProgressBar tek başına)', () => {
    const r = render(wrap(<ProgressBar index={4} total={14} />));
    expect(String(flat(r.getByTestId('kayit-progress-fill').props.style).width)).toBe(`${(4 / 14) * 100}%`);
    expect(r.getByTestId('kayit-progress').props.accessibilityValue).toMatchObject({ now: 4, max: 14 });
  });

  test('renk/ süre sözleşmesi: açık #3A5A1E, koyu lime; iz yarı saydam beyaz; 250 ms', () => {
    expect(K_LIGHT.barFill).toBe('#3A5A1E');
    expect(K_DARK.barFill).toBe(K_DARK.accent);
    expect(K_LIGHT.barTrack).toMatch(/^rgba\(255,255,255,0\.\d+\)$/);
    expect(K_DARK.barTrack).toMatch(/^rgba\(255,255,255,0\.\d+\)$/);
    expect(K_MOTION.bar).toBe(250);
    expect(src('src/modules/kayit/ui/parts.tsx')).toMatch(/const BAR_EASE = CURVE\.enter;/);
  });
});

// ─── md.5 / md.6 ─────────────────────────────────────────────────────────────
describe('md.5–6 L2', () => {
  const renderL2 = async () => {
    useKayit.getState().patch({ ...ANSWERS });
    const r = render(wrap(<ResultScreen />));
    await wait(50);
    return r;
  };

  test('İzmir + banner: eatkcal kartı yok, başlıksız kampanya bannerı (tam genişlik, 300×104, yarıçap 20); çubuk yok', async () => {
    const r = await renderL2();
    expect(r.queryByTestId('kayit-eatkcal')).toBeNull();
    expect(r.queryByTestId('kayit-progress')).toBeNull();
    const b = r.getByTestId('kayit-banner');
    expect(flat(b.props.style)).toMatchObject({ width: '100%', aspectRatio: 300 / 104, borderRadius: 20, overflow: 'hidden' });
    expect(b.props.accessibilityLabel).toBe('Kampanya');
    expect(r.queryByText(/İzmir'deysen/)).toBeNull();
  });

  test('İzmir dışı ya da bilinmiyor → bölüm gizli', async () => {
    mockRegion = 'other';
    const r = await renderL2();
    expect(r.queryByTestId('kayit-banner')).toBeNull();
    mockRegion = 'unknown';
    const r2 = await renderL2();
    expect(r2.queryByTestId('kayit-banner')).toBeNull();
  });

  test('rıza: kutu yok; düğme üstünde not + "Onayla ve planımı kaydet" (etkin); basınca rıza yazılır → K1', async () => {
    const r = await renderL2();
    expect(r.queryByRole('checkbox')).toBeNull();
    const note = r.getByTestId('kayit-health-consent');
    // G47 md.6: not 11 pt, düğmenin altında; bağlantı bölünmez boşluklu (aynı satırda kalır).
    expect(flat(note.props.style)).toMatchObject({ fontSize: 11, textAlign: 'center' });
    expect(plain(r.getByTestId('kayit-consent-link').props.children).replace(/\u00A0/g, ' ')).toBe('Aydınlatma metni');
    fireEvent.press(r.getByTestId('kayit-consent-link'));
    expect(mockNav.navigate).toHaveBeenCalledWith('ProfileContracts', { slug: 'kvkk' });
    const btn = r.getByTestId('kayit-save-plan');
    expect(btn.props.accessibilityLabel).toBe('Onayla ve planımı kaydet');
    expect(btn.props.accessibilityState).toMatchObject({ disabled: false });
    await act(async () => {
      fireEvent.press(btn);
    });
    await wait(20);
    expect(recordHealthConsent).toHaveBeenCalledWith(true, 'personal_plan');
    expect(useKayit.getState().healthOk).toBe(true);
    expect(mockNav.navigate).toHaveBeenCalledWith('KSignup', { path: 'a' });
  });

  test('rıza önceden verilmişse not gizli, düğme "Planımı kaydet", yeniden yazılmaz', async () => {
    mockConsentKnown = true;
    const r = await renderL2();
    expect(r.queryByTestId('kayit-health-consent')).toBeNull();
    const btn = r.getByTestId('kayit-save-plan');
    expect(btn.props.accessibilityLabel).toBe('Planımı kaydet');
    await act(async () => {
      fireEvent.press(btn);
    });
    expect(recordHealthConsent).not.toHaveBeenCalled();
  });

  test('banner verisi = eatkcal kampanya şeridi (ilk görselli hücre); hedef kuralı', () => {
    const noImg = { ...mockCell, id: 'x', image_url: null };
    expect(pickCampaign({ hero: [{ cells: [noImg as never, mockCell as never] }], promo: [] })?.id).toBe('c1');
    expect(pickCampaign({ hero: [], promo: [] })).toBeNull();
    const nav = { navigate: jest.fn() };
    const onCampaign = jest.fn();
    const resolve = jest.fn();
    openCampaign(nav, mockCell as never, { onCampaign, resolve });
    expect(onCampaign).toHaveBeenCalledWith(mockCell);
    openCampaign(nav, { ...mockCell, navigate_to: 'ProfileCoupons' } as never, { onCampaign, resolve });
    expect(resolve).toHaveBeenCalledWith(nav, 'ProfileCoupons');
    openCampaign(nav, { ...mockCell, navigate_to: null, link: null } as never, { onCampaign, resolve });
    expect(nav.navigate).toHaveBeenCalledWith('ProfileCoupons');
  });

  test('i18n: eatkcal kartı metinleri kalktı; rıza / düğme metinleri TR + EN', () => {
    for (const L of [tr, en] as const) {
      const plan = L.plan as Record<string, string>;
      expect(plan.eatkcal_title).toBeUndefined();
      expect(plan.save_consent).toBeTruthy();
      expect((L.q as Record<string, string>).consent_note).toBeTruthy();
      expect((L.q as Record<string, string>).short_start_consent).toBeTruthy();
    }
    expect(tr.plan.save_consent).toBe('Onayla ve planımı kaydet');
    expect(en.plan.save_consent).toBe('Agree and save my plan');
    expect(tr.q.consent_note + tr.q.consent_link).toBe('Devam ederek sağlık verilerinin (boy, kilo, yaş, hedef) planını hazırlamak için işlenmesine açık rıza vermiş olursun. Aydınlatma metni');
  });
});

test('md.6 B yolu son adım ("Takibe başla"): kutu yok, not + "Onayla ve takibe başla" etkin', async () => {
  mockParams = { mode: 'short', vitrinStep: 'activity' };
  const r = render(wrap(<QuestionsScreen />));
  await wait(50);
  useKayit.getState().patch({ goal: 'lose', gender: 'female', birthYear: 1990, heightCm: 170, weightKg: 70, activity: 'light' });
  await wait(50);
  expect(r.queryByRole('checkbox')).toBeNull();
  expect(r.getByTestId('kayit-health-consent')).toBeTruthy();
  const btn = r.getByTestId('kayit-next');
  expect(btn.props.accessibilityLabel).toBe('Onayla ve takibe başla');
  expect(btn.props.accessibilityState).toMatchObject({ disabled: false });
});

// ─── md.7 / md.8 ─────────────────────────────────────────────────────────────
test('md.7 K1: balon 20 pt (~%15 küçük), düğme 15 (G48), "Devam ederek…" 13, kutu 14 / not 12, "İsteğe bağlı" 13; kutular işaretsiz; çubuk yok', async () => {
  mockParams = { path: 'a' };
  const r = render(wrap(<SignupScreen />));
  await wait(20);
  expect(r.queryByTestId('kayit-progress')).toBeNull();
  const title = r.getByText(tr.signup.title_a);
  expect(flat(title.props.style)).toMatchObject({ fontSize: 20 });
  expect(flat(r.getByText(tr.signup.google).props.style).fontSize).toBe(15); // G48 md.0: giriş düğmeleri 15/600
  expect(flat(r.getByText(tr.signup.optional).props.style).fontSize).toBe(13);
  const legal = r.getByText(/^Devam ederek/);
  expect(flat(legal.props.style).fontSize).toBe(13);
  for (const id of ['kayit-meta', 'kayit-marketing']) {
    const box = r.getByTestId(id);
    expect(box.props.accessibilityState).toMatchObject({ checked: false });
  }
  expect(flat(r.getByText(noLig(tr.signup.marketing)).props.style).fontSize).toBe(14);
  expect(src('src/modules/kayit/ui/parts.tsx')).toMatch(/checkNote: \{ fontFamily: FONT\.body, fontSize: 12/);
});

test('md.8 balon ölçüsü: 22 pt (önce 24); dar ekranda (< 360 pt) maskot 64 + sıkı boşluk; varsayılan yazıda en çok 2 satır', () => {
  const p = src('src/modules/kayit/ui/parts.tsx');
  expect(p).toMatch(/bubbleText: \{ fontFamily: FONT\.display, fontSize: 22, lineHeight: 28/);
  expect(p).toMatch(/bubbleCompact: \{ fontFamily: FONT\.display, fontSize: 20/);
  expect(p).toMatch(/export const NARROW_W = 360/);
  expect(p).toMatch(/numberOfLines=\{fit \? 2 : undefined\}/);
  const pk = src('src/modules/kayit/ui/pickers.tsx');
  expect(pk).toMatch(/tileLabel: \{ fontFamily: FONT\.display, fontSize: 17/);
  expect(pk).toMatch(/optLabel: \{ fontFamily: FONT\.display, fontSize: 16/);
});

// ─── md.9 ────────────────────────────────────────────────────────────────────
test('md.9 T1 rozetleri: kenar çizgisi ve eğiklik yok; "%… tasarruf" kartın içinde (mutlak değil); radyo ana paywall ile aynı kalır', () => {
  const o = src('src/modules/kayit/screens/OfferScreen.tsx');
  const tag = /  tag: \{[^}]*\}/.exec(o)?.[0] ?? '';
  expect(tag).not.toMatch(/borderWidth|rotate|skew/);
  const inline = /  tagInline: \{[^}]*\}/.exec(o)?.[0] ?? '';
  expect(inline).not.toMatch(/position|borderWidth|rotate/);
  expect(o).toMatch(/testID="kayit-offer-save" style=\{\[styles\.tagInline/);
  expect(o).not.toMatch(/bottom: -12/);
  expect(o).toMatch(/const tagBg = mixColor\(P\.accent, '#FFFFFF', k\)/);
  // T1 radyo (md.3 kapsamı dışı) değişmedi.
  expect(o).toMatch(/styles\.radio, \{ borderColor: mixColor\(P\.sec, P\.limeInk, k\), backgroundColor: mixColor\('transparent', P\.limeInk, k\)/);
});

test('md.8 320 pt genişlik: balon 21 pt, maskot 64 pt, en çok 2 satır; büyük yazıda satır sınırı yok', () => {
  const RN = require('react-native');
  const spy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 320, height: 568, scale: 2, fontScale: 1 });
  const r = render(wrap(<QuestionHead title={tr.q.sport_title} layout="right" testID="h" />));
  const h = r.getByTestId('h');
  expect(flat(h.props.style)).toMatchObject({ fontSize: 21, lineHeight: 27 });
  expect(h.props.numberOfLines).toBe(2);
  const mascot = r.getByLabelText(tr.onb.mascot);
  expect(flat(mascot.props.style)).toMatchObject({ width: 64, height: 64 });
  spy.mockReturnValue({ width: 320, height: 568, scale: 2, fontScale: 1.35 });
  const r2 = render(wrap(<QuestionHead title={tr.q.sport_title} layout="right" testID="h2" />));
  expect(r2.getByTestId('h2').props.numberOfLines).toBeUndefined();
  spy.mockRestore();
});
