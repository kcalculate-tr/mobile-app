// eatkcal v2 (G15-S5 md.2 → G18-S3 md.1) — il kapısı: FinCityR1 · FinWaitlistR1 · FinEatBerlin
// + FinWaitlistAdd / FinWaitlistSuggest form sheet'leri.
//
// Tur 26 md.10: ülke → il. İzmir "Açık" (tek hizmet verilen il) → MANTIK AYNI:
// `useEatkcalRegistration()` → setCity + checkCity (checkDeliveryCity RPC) →
// çağıranın `onAllowed`'u (writeCityGatePassed + adres/ileri). Diğer 80 il ve
// "Diğer ülke" → "Çok yakında" sayfası; SİPARİŞ AKIŞI BAŞLAMAZ. Oradaki iki eylem
// form sheet açar; gönderim `eatkcal_waitlist_requests` tablosuna (migration
// dosyası, CANLIYA UYGULANACAK), tablo/oturum yokken cihaz kuyruğunda bekler.
// Veri olmayan Final öğeleri GİZLİ (uydurma yok): şehir fotoğrafı (yer tutucu
// yüzey), Berlin restoran satırları.
//
// G22-S2 md.3: "Diğer ülke" yerine Avrupa + Amerika (Kuzey, Orta, Güney) ülke listesi
// (model/geoCountries, GeoNames). Türkiye → yukarıdaki il akışı AYNEN. Diğer ülke →
// şehir araması (`search_cities` RPC, duraksamalı; yükleniyor/boş/hata; ağ yokken
// "yazdığınla devam et"). Listede şehirlerin yanında "Çok yakında" YOK. Seçilen şehir →
// FinEatBerlin: "Çok yakında [şehir]'deki restoranlar burada listelenecek." + Restoranını
// ekle / Restoran öner (aynı form sheet'leri, ülke kodu ISO2).
// G23-S1: Türkiye il listesinde de "Çok yakında" yazmaz; yabancı şehir satırında eyalet/
// bölge (admin1) alt satırda.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { BlurView } from 'expo-blur';
import { haptic } from '../../../../../core/design';
import { CaretDown, CaretLeft, CaretRight, Check, MagnifyingGlass, MapPin, Plus, Storefront } from '../../../../../components/icons';
import { TAB_BAR_TOTAL } from '../../../../../constants/layout';
import { tabBarBottomOffset, TAB_BAR_R3 } from '../../../../shell/layout';
import { useInR3Shell } from '../../../../shell';
import { useEatkcalRegistration } from '../../../../profil/useRegistration';
import { CITY_CATALOG } from '../../../cityGate';
import { ekType, useEk } from '../kit';
import { IZMIR, filterProvinces, orderedProvinces } from '../../model/provinces';
import {
  TURKEY,
  cityLabel,
  countryName,
  filterCountries,
  findCountry,
  geoGateTarget,
  isTurkey,
  orderedCountries,
  trLocativeKi,
  typedCity,
  type GeoCity,
} from '../../model/geo';
import { WaitlistFormSheet } from './WaitlistFormSheet';
import { flushWaitlistQueue } from './waitlistSend';
import { useCitySearch } from './useCitySearch';
import type { WaitlistKind } from '../../model/waitlist';

export type GateStep = 'city' | 'waitlist' | 'other';

/** Şehir fotoğrafları (varlık eklenince doldurulur; anahtar il adı). */
const CITY_PHOTOS: Partial<Record<string, ImageSourcePropType>> = {};

const IZMIR_TR = CITY_CATALOG.find((x) => x.active)?.labelTr ?? IZMIR;

function usePalette() {
  const { theme } = useEk();
  const dark = theme.isDark;
  return {
    ph: dark ? '#3A3A3C' : '#DCDEE2',
    glass: dark ? 'rgba(28,28,30,0.62)' : 'rgba(255,255,255,0.72)',
    outline: dark ? 'rgba(255,255,255,0.22)' : '#C3C7CC',
    line2: dark ? '#48484A' : '#C3C7CC',
    nested: dark ? '#1C1C1E' : '#E9EBEE',
    card: dark ? '#1C1C1E' : '#FFFFFF',
    dis: dark ? '#2C2C2E' : '#DCDEE2',
    disText: dark ? '#8E8E93' : '#6B6B70',
    tint: (dark ? 'dark' : 'light') as 'dark' | 'light',
  };
}

/** Lime vurgulu başlık parçası (lime YALNIZ dolgu, üstünde koyu metin). */
function Mark({ children, size }: { children: string; size: number }) {
  const { c } = useEk();
  return (
    <View style={[styles.mark, { backgroundColor: c.accent }]}>
      <Text style={[ekType.h24, { fontSize: size, lineHeight: size * 1.2, color: c.onAccent }]}>{children}</Text>
    </View>
  );
}

export function CityGateView({
  onAllowed,
  onExit,
  onTrack,
  onPrivacy,
  initialStep = 'city',
  initialCityKey,
  initialSheet,
  otherCityName,
  showTabSpace = true,
}: {
  onAllowed: () => void;
  /** Kapı bir stack ekranında açıldıysa geri (yoksa ilk adımda geri yok). */
  onExit?: () => void;
  /** "Bu arada takibe devam et" (Ana sayfa). */
  onTrack?: () => void;
  /** Aydınlatma metni (form sheet'inde bağlantı). */
  onPrivacy?: () => void;
  initialStep?: GateStep;
  /** YALNIZ vitrin: bekleme sayfasının ili (il adı ya da eski katalog anahtarı). */
  initialCityKey?: string;
  /** YALNIZ vitrin: açık başlayan form sheet'i. */
  initialSheet?: WaitlistKind;
  /** "Diğer şehir" adımında gösterilecek şehir adı (kayıtlı adresten). */
  otherCityName?: string | null;
  /** Sekme içinde: alt sekme çubuğu kadar boşluk. */
  showTabSpace?: boolean;
}) {
  const { c, t, lang, insets } = useEk();
  const p = usePalette();
  const reg = useEatkcalRegistration();
  const inR3 = useInR3Shell();
  const [step, setStep] = useState<GateStep>(initialStep);
  /** ISO2 ülke kodu; 'TR' = bugünkü il akışı. */
  const [country, setCountry] = useState<string>(TURKEY);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQ, setCountryQ] = useState('');
  const [geoCity, setGeoCity] = useState<GeoCity | null>(null);
  const [cq, setCq] = useState('');
  const isTr = isTurkey(country);
  const countries = useMemo(() => orderedCountries(lang), [lang]);
  const countryList = useMemo(() => filterCountries(countries, countryQ, lang), [countries, countryQ, lang]);
  const search = useCitySearch(cq, isTr ? null : country, !isTr && !countryOpen);
  const searchStatus = search.state.status;
  // VoiceOver: arama sonucu duyurusu (sonuç sayısı / boş / hata).
  useEffect(() => {
    if (search.state.status === 'ok') {
      AccessibilityInfo.announceForAccessibility(t('eatkcal.v2.geo.results', { count: search.state.cities.length }));
    } else if (search.state.status === 'empty') {
      AccessibilityInfo.announceForAccessibility(t('eatkcal.v2.geo.city_no_match'));
    } else if (search.state.status === 'error') {
      AccessibilityInfo.announceForAccessibility(t('eatkcal.v2.geo.city_error'));
    }
  }, [search.state, t]);
  const [il, setIl] = useState<string | null>(() => {
    if (!initialCityKey) return null;
    const cat = CITY_CATALOG.find((x) => x.key === initialCityKey);
    return cat?.labelTr ?? initialCityKey;
  });
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState<WaitlistKind | null>(initialSheet ?? null);
  const all = useMemo(() => orderedProvinces(), []);
  const list = useMemo(() => filterProvinces(all, q), [all, q]);

  // Sekme çubuğunun üstünde 12 (Final: alt 112 = 100 sekme alanı + 12).
  const bottomSpace = showTabSpace
    ? inR3
      ? tabBarBottomOffset(insets.bottom) + TAB_BAR_R3.PILL_HEIGHT + 12
      : TAB_BAR_TOTAL + insets.bottom + 12
    : Math.max(insets.bottom, 16) + 12;

  // Bekleyen form gönderimleri (tablo/oturum hazır olunca).
  useEffect(() => {
    flushWaitlistQueue().catch(() => {});
  }, []);

  const target = geoGateTarget(country, il, geoCity);
  // FinWaitlistR1 yalnız Türkiye illeri için (diğer ülkeler FinEatBerlin'e gider).
  const waitCity = il ?? '';
  // FinEatBerlin şehri: seçilen yabancı şehir; yoksa (vitrin / eski yol) kayıtlı adres şehri.
  const otherName = geoCity?.name ?? otherCityName ?? null;
  const checking = reg.status === 'checking';
  const { setCity } = reg;
  // Doğrulama şehri baştan İzmir (SignupEatScreen ile aynı: setCity, onayda checkCity).
  useEffect(() => {
    setCity(IZMIR_TR);
  }, [setCity]);

  const onContinue = useCallback(async () => {
    if (!target || checking) return;
    haptic('selection');
    if (target === 'waitlist') {
      setStep('waitlist');
      return;
    }
    if (target === 'soon') {
      setStep('other');
      return;
    }
    // G18-S5 (uçtan uca akışta bulundu): kapı denetimi `restoran_yakinda` bayrağına bağlı
    // (useEatkcalRegistration.enabled). Bayrak kapalıyken checkCity sessizce false döner ve
    // İzmir "Devam et" çıkmaza giriyordu → denetim kapalıyken İzmir (açık il) doğrudan geçer.
    if (!reg.enabled) {
      haptic('success');
      onAllowed();
      return;
    }
    // İzmir: bugünkü doğrulama (checkCity — şehir açılışta ayarlı), sonra onAllowed.
    const ok = await reg.checkCity();
    if (ok) {
      haptic('success');
      onAllowed();
    }
  }, [target, checking, reg, onAllowed]);

  const openSheet = (k: WaitlistKind) => {
    haptic('selection');
    setSheet(k);
  };
  const sheetEl = (
    <WaitlistFormSheet
      kind={sheet ?? 'restaurant_add'}
      visible={sheet != null}
      city={step === 'other' ? otherName ?? '' : il ?? ''}
      country={geoCity ? geoCity.country : step === 'other' ? 'OTHER' : country}
      onClose={() => setSheet(null)}
      onPrivacy={() => {
        setSheet(null);
        onPrivacy?.();
      }}
    />
  );

  // ── FinWaitlistR1 ────────────────────────────────────────────────────────
  if (step === 'waitlist') {
    const photo = il ? CITY_PHOTOS[il] : undefined;
    return (
      <View style={[styles.fill, { backgroundColor: c.bg }]} testID="ek-gate-waitlist">
        <View
          style={[styles.hero, { backgroundColor: p.ph }]}
          accessible={!!photo}
          accessibilityRole={photo ? 'image' : undefined}
          accessibilityLabel={photo ? t('eatkcal.v2.gate.photo_a11y', { city: waitCity }) : undefined}
        >
          {photo ? <Image source={photo} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        </View>
        <Pressable
          onPress={() => {
            haptic('selection');
            setStep('city');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('eatkcal.v2.common.back')}
          style={[styles.backGlass, { top: insets.top }]}
          testID="ek-gate-back"
        >
          <BlurView intensity={30} tint={p.tint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: p.glass }]} />
          <CaretLeft size={22} color={c.ink} />
        </Pressable>
        <View style={styles.waitText}>
          <View style={styles.titleRow} accessible accessibilityRole="header" accessibilityLabel={t('eatkcal.v2.gate.soon')}>
            <Mark size={34}>{t('eatkcal.v2.gate.soon')}</Mark>
          </View>
          <Text style={[styles.body16, { color: c.ink }]}>{t('eatkcal.v2.gate.wait_body', { city: waitCity })}</Text>
        </View>
        <View style={[styles.waitActions, { bottom: bottomSpace }]}>
          <Pressable
            onPress={() => openSheet('restaurant_add')}
            accessibilityRole="button"
            accessibilityLabel={`${t('eatkcal.v2.gate.add_restaurant')}, ${t('eatkcal.v2.gate.add_sub')}`}
            style={({ pressed }) => [styles.actCard, { backgroundColor: c.accent }, pressed && { opacity: 0.9 }]}
            testID="ek-gate-add-restaurant"
          >
            <Storefront size={22} color={c.onAccent} />
            <View style={styles.fill}>
              <Text style={[styles.actT, { color: c.onAccent }]}>{t('eatkcal.v2.gate.add_restaurant')}</Text>
              <Text style={[ekType.c13, { color: c.onAccent }]}>{t('eatkcal.v2.gate.add_sub')}</Text>
            </View>
            <CaretRight size={18} color={c.onAccent} />
          </Pressable>
          <Pressable
            onPress={() => openSheet('restaurant_suggest')}
            accessibilityRole="button"
            accessibilityLabel={`${t('eatkcal.v2.gate.suggest')}, ${t('eatkcal.v2.gate.suggest_sub')}`}
            style={({ pressed }) => [styles.actCard, { backgroundColor: p.card, borderColor: p.line2, borderWidth: 1 }, pressed && { opacity: 0.9 }]}
            testID="ek-gate-suggest"
          >
            <MapPin size={22} color={c.ink} weight="fill" />
            <View style={styles.fill}>
              <Text style={[styles.actT, { color: c.ink }]}>{t('eatkcal.v2.gate.suggest')}</Text>
              <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.gate.suggest_sub')}</Text>
            </View>
            <CaretRight size={18} color={c.secondary} />
          </Pressable>
          {onTrack ? (
            <Pressable onPress={onTrack} accessibilityRole="button" style={styles.textBtn} testID="ek-gate-track">
              <Text style={[styles.link15, { color: c.ink }]}>{t('eatkcal.v2.gate.keep_tracking')}</Text>
            </Pressable>
          ) : null}
        </View>
        {sheetEl}
      </View>
    );
  }
  // ── FinEatBerlin (mutfak olmayan şehir) ──────────────────────────────────
  if (step === 'other') {
    const soonText = otherName
      ? t('eatkcal.v2.geo.soon_city', { city: otherName, city_ki: trLocativeKi(otherName) })
      : null;
    return (
      <View style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]} testID="ek-gate-other">
        <View style={styles.otherHead}>
          <Text style={[ekType.h24, { color: c.ink, flex: 1 }]} accessibilityRole="header">
            eatkcal
          </Text>
          <Pressable
            onPress={() => {
              haptic('selection');
              setStep('city');
            }}
            accessibilityRole="button"
            accessibilityLabel={otherName ? `${t('eatkcal.v2.gate.change_city')}: ${otherName}` : t('eatkcal.v2.gate.change_city')}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[styles.cityPill, { borderColor: p.outline }]}
            testID="ek-gate-city-pill"
          >
            <MapPin size={16} color={c.ink} />
            <Text style={[ekType.c13s, styles.pillText, { color: c.ink }]} numberOfLines={1}>
              {otherName || t('eatkcal.v2.gate.other_city')}
            </Text>
            <CaretDown size={12} color={c.ink} weight="fill" />
          </Pressable>
        </View>
        <ScrollView style={styles.fill} contentContainerStyle={{ paddingBottom: bottomSpace }} showsVerticalScrollIndicator={false}>
          <View style={[styles.notice, { borderBottomColor: c.line }]}>
            <Storefront size={22} color={c.ink} />
            <View style={styles.fill}>
              <Text style={[ekType.b15s, { color: c.ink }]}>{t('eatkcal.v2.gate.no_kitchen_title')}</Text>
              <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.gate.no_kitchen_body')}</Text>
            </View>
          </View>
          <View style={styles.nearHead}>
            <Text style={[ekType.b17, styles.bric, { color: c.ink }]}>{t('eatkcal.v2.city.nearby_title')}</Text>
            <Text style={[ekType.c13, { color: c.secondary }]}>{` (${t('eatkcal.v2.gate.soon')})`}</Text>
          </View>
          {soonText ? (
            <Text style={[ekType.b15, styles.soonText, { color: c.ink }]} testID="ek-gate-soon-city">
              {soonText}
            </Text>
          ) : null}
          <Pressable
            onPress={() => openSheet('restaurant_add')}
            accessibilityRole="button"
            accessibilityLabel={t('eatkcal.v2.gate.add_restaurant')}
            style={({ pressed }) => [styles.addRow, { borderTopColor: c.line, borderBottomColor: c.line }, pressed && { opacity: 0.7 }]}
            testID="ek-gate-add-restaurant"
          >
            <View style={[styles.addIcon, { borderColor: p.outline }]}>
              <Plus size={20} color={c.ink} />
            </View>
            <Text style={[ekType.b15s, { color: c.ink, flex: 1 }]}>{t('eatkcal.v2.gate.add_restaurant')}</Text>
            <CaretRight size={18} color={c.ink} />
          </Pressable>
          <Pressable
            onPress={() => openSheet('restaurant_suggest')}
            accessibilityRole="button"
            accessibilityLabel={t('eatkcal.v2.gate.suggest')}
            style={({ pressed }) => [styles.addRow, styles.addRowNext, { borderBottomColor: c.line }, pressed && { opacity: 0.7 }]}
            testID="ek-gate-suggest"
          >
            <View style={[styles.addIcon, { borderColor: p.outline }]}>
              <MapPin size={20} color={c.ink} />
            </View>
            <Text style={[ekType.b15s, { color: c.ink, flex: 1 }]}>{t('eatkcal.v2.gate.suggest')}</Text>
            <CaretRight size={18} color={c.ink} />
          </Pressable>
          <Text style={[ekType.c13, styles.footnote, { color: c.secondary }]}>{t('eatkcal.v2.gate.only_kitchens')}</Text>
        </ScrollView>
        {sheetEl}
      </View>
    );
  }
  // ── FinCityR1 ────────────────────────────────────────────────────────────
  const countryEntry = findCountry(country);
  const countryLabel = countryEntry ? countryName(countryEntry, lang) : t('eatkcal.v2.gate.country_tr');
  const pickHelp = isTr ? t('eatkcal.v2.gate.pick_city') : t('eatkcal.v2.geo.pick_city');
  const typed = isTr ? null : typedCity(cq, country);
  const typedSel = !!typed && geoCity?.geonameid === 0 && geoCity.name === typed.name;
  const pickCountry = (iso2: string) => {
    haptic('selection');
    if (iso2 !== country) {
      setCountry(iso2);
      setIl(null);
      setGeoCity(null);
      setCq('');
    }
    setCountryQ('');
    setCountryOpen(false);
  };
  const pickCity = (x: GeoCity) => {
    haptic('selection');
    setGeoCity(x);
  };
  return (
    <View style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]} testID="ek-gate-city">
      <View style={[styles.cityWrap, { paddingBottom: bottomSpace + 52 + 26 + 12 }]}>
        {onExit ? (
          <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel={t('eatkcal.v2.common.back')} style={styles.exitBtn}>
            <CaretLeft size={22} color={c.ink} />
          </Pressable>
        ) : null}
        <View style={{ gap: 6 }}>
          <View style={styles.titleRow} accessible accessibilityRole="header" accessibilityLabel={`${t('eatkcal.v2.gate.where_pre')}${t('eatkcal.v2.gate.where_mark')}`}>
            <Text style={[ekType.h24, styles.t30, { color: c.ink }]}>{t('eatkcal.v2.gate.where_pre')}</Text>
            <Mark size={30}>{t('eatkcal.v2.gate.where_mark')}</Mark>
          </View>
          <Text style={[ekType.b15, { color: c.secondary }]}>{t('eatkcal.v2.gate.sub')}</Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={[ekType.c13s, { color: c.secondary }]}>{t('eatkcal.v2.gate.country')}</Text>
          <Pressable
            onPress={() => {
              haptic('selection');
              setCountryOpen((o) => !o);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t('eatkcal.v2.gate.country')}: ${countryLabel}`}
            accessibilityState={{ expanded: countryOpen }}
            style={[styles.select, { backgroundColor: p.card, borderColor: c.line }]}
            testID="ek-gate-country"
          >
            <Text style={[styles.selectText, { color: c.ink }]}>{countryLabel}</Text>
            <CaretDown size={18} color={c.secondary} />
          </Pressable>
        </View>

        {countryOpen ? (
          <View style={styles.cityCol} testID="ek-gate-country-list">
            <View style={[styles.search, { backgroundColor: p.nested }]}>
              <MagnifyingGlass size={18} color={c.secondary} />
              <TextInput
                value={countryQ}
                onChangeText={setCountryQ}
                placeholder={t('eatkcal.v2.geo.country_search')}
                placeholderTextColor={c.secondary}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={t('eatkcal.v2.geo.country_search')}
                style={[styles.searchInput, { color: c.ink }]}
                testID="ek-gate-country-search"
              />
            </View>
            <ScrollView
              style={[styles.listCard, styles.fill, { backgroundColor: p.card }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('eatkcal.v2.gate.country')}
            >
              {countryList.map((k) => {
                const label = countryName(k, lang);
                const sel = country === k.iso2;
                return (
                  <Pressable
                    key={k.iso2}
                    onPress={() => pickCountry(k.iso2)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    accessibilityLabel={label}
                    style={[styles.row, { borderBottomColor: c.line }]}
                    testID={`ek-gate-country-${k.iso2}`}
                  >
                    <Text style={[styles.rowText, { color: c.ink, fontFamily: ekType.b15s.fontFamily }]}>{label}</Text>
                    <Radio on={sel} ring={p.line2} />
                  </Pressable>
                );
              })}
              {countryList.length === 0 ? (
                <Text style={[ekType.b15, styles.noMatch, { color: c.secondary }]}>{t('eatkcal.v2.geo.country_no_match')}</Text>
              ) : null}
            </ScrollView>
          </View>
        ) : isTr ? (
          <View style={styles.cityCol}>
            <Text style={[ekType.c13s, { color: c.secondary }]}>{t('eatkcal.v2.gate.city_label')}</Text>
            <View style={[styles.search, { backgroundColor: p.nested }]}>
              <MagnifyingGlass size={18} color={c.secondary} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={t('eatkcal.v2.gate.search')}
                placeholderTextColor={c.secondary}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={t('eatkcal.v2.gate.search')}
                style={[styles.searchInput, { color: c.ink }]}
                testID="ek-gate-search"
              />
            </View>
            <ScrollView
              style={[styles.listCard, styles.fill, { backgroundColor: p.card }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('eatkcal.v2.gate.city_label')}
              testID="ek-gate-list"
            >
              {list.map((name) => {
                const open = name === IZMIR;
                const sel = il === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => {
                      haptic('selection');
                      setIl(name);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    accessibilityLabel={open ? `${name}, ${t('eatkcal.v2.gate.open')}` : name}
                    style={[styles.row, { borderBottomColor: c.line }]}
                    testID={`ek-gate-il-${name}`}
                  >
                    <Text style={[styles.rowText, { color: c.ink, fontFamily: open ? ekType.b15s.fontFamily : ekType.b15m.fontFamily }]}>{name}</Text>
                    {/* G23-S1 (İlter): listede "Çok yakında" yazılmaz; seçimden sonra bekleme
                        sayfası mesajı + Restoranını ekle / Restoran öner. */}
                    {open ? (
                      <View style={[styles.openChip, { backgroundColor: c.accent }]}>
                        <Text style={[ekType.c13s, { color: c.onAccent }]}>{t('eatkcal.v2.gate.open')}</Text>
                      </View>
                    ) : null}
                    <Radio on={sel} ring={p.line2} />
                  </Pressable>
                );
              })}
              {list.length === 0 ? <Text style={[ekType.b15, styles.noMatch, { color: c.secondary }]}>{t('eatkcal.v2.gate.no_match')}</Text> : null}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.cityCol}>
            <Text style={[ekType.c13s, { color: c.secondary }]}>{t('eatkcal.v2.geo.city_label')}</Text>
            <View style={[styles.search, { backgroundColor: p.nested }]}>
              <MagnifyingGlass size={18} color={c.secondary} />
              <TextInput
                value={cq}
                onChangeText={setCq}
                placeholder={t('eatkcal.v2.geo.city_search')}
                placeholderTextColor={c.secondary}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="search"
                accessibilityLabel={t('eatkcal.v2.geo.city_search')}
                style={[styles.searchInput, { color: c.ink }]}
                testID="ek-gate-city-search"
              />
            </View>
            <ScrollView
              style={[styles.listCard, styles.fill, { backgroundColor: p.card }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('eatkcal.v2.geo.city_label')}
              testID="ek-gate-city-list"
            >
              {searchStatus === 'idle' ? (
                <Text style={[ekType.b15, styles.noMatch, { color: c.secondary }]}>{t('eatkcal.v2.geo.city_hint')}</Text>
              ) : null}
              {searchStatus === 'loading' ? (
                <View
                  style={styles.stateRow}
                  accessible
                  accessibilityLabel={t('eatkcal.v2.geo.city_loading')}
                  accessibilityLiveRegion="polite"
                  testID="ek-gate-city-loading"
                >
                  <ActivityIndicator color={c.secondary} />
                  <Text style={[ekType.b15, styles.fill, { color: c.secondary }]}>{t('eatkcal.v2.geo.city_loading')}</Text>
                </View>
              ) : null}
              {search.state.status === 'ok'
                ? search.state.cities.map((x) => {
                    const sel = geoCity?.geonameid === x.geonameid && x.geonameid !== 0;
                    return (
                      <Pressable
                        key={x.geonameid}
                        onPress={() => pickCity(x)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: sel }}
                        accessibilityLabel={cityLabel(x)}
                        style={[styles.row, { borderBottomColor: c.line }]}
                        testID={`ek-gate-city-${x.geonameid}`}
                      >
                        <View style={styles.fill}>
                          <Text style={[styles.rowText, { color: c.ink, fontFamily: ekType.b15m.fontFamily }]}>{x.name}</Text>
                          {x.admin1 ? (
                            <Text style={[ekType.c13, { color: c.secondary }]} testID={`ek-gate-city-admin1-${x.geonameid}`}>
                              {x.admin1}
                            </Text>
                          ) : null}
                        </View>
                        <Radio on={sel} ring={p.line2} />
                      </Pressable>
                    );
                  })
                : null}
              {searchStatus === 'empty' ? (
                <Text style={[ekType.b15, styles.noMatch, { color: c.secondary }]} testID="ek-gate-city-empty">
                  {t('eatkcal.v2.geo.city_no_match')}
                </Text>
              ) : null}
              {searchStatus === 'error' ? (
                <View style={styles.errorBox} testID="ek-gate-city-error">
                  <Text style={[ekType.b15, { color: c.secondary }]}>{t('eatkcal.v2.geo.city_error')}</Text>
                  <Pressable
                    onPress={() => {
                      haptic('selection');
                      search.retry();
                    }}
                    accessibilityRole="button"
                    style={[styles.retryBtn, { borderColor: p.outline }]}
                    testID="ek-gate-city-retry"
                  >
                    <Text style={[ekType.b15s, { color: c.ink }]}>{t('eatkcal.v2.geo.retry')}</Text>
                  </Pressable>
                </View>
              ) : null}
              {(searchStatus === 'empty' || searchStatus === 'error') && typed ? (
                <Pressable
                  onPress={() => pickCity(typed)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: typedSel }}
                  accessibilityLabel={t('eatkcal.v2.geo.use_typed', { q: typed.name })}
                  style={[styles.row, styles.rowTop, { borderTopColor: c.line, borderBottomColor: c.line }]}
                  testID="ek-gate-city-typed"
                >
                  <Text style={[styles.rowText, { color: c.ink, fontFamily: ekType.b15m.fontFamily }]}>
                    {t('eatkcal.v2.geo.use_typed', { q: typed.name })}
                  </Text>
                  <Radio on={typedSel} ring={p.line2} />
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={[styles.cityCta, { bottom: bottomSpace }]}>
        {!target ? (
          <Text style={[styles.help, { color: c.secondary }]} testID="ek-gate-help">
            {pickHelp}
          </Text>
        ) : null}
        <Pressable
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityState={{ disabled: !target, busy: checking }}
          accessibilityHint={!target ? pickHelp : undefined}
          style={[styles.cta, { backgroundColor: target ? c.ink : p.dis }]}
          testID="ek-gate-continue"
        >
          {checking ? (
            <ActivityIndicator color={c.surface} />
          ) : (
            <Text style={[styles.ctaText, { color: target ? c.surface : p.disText }]}>{t('eatkcal.v2.gate.continue')}</Text>
          )}
        </Pressable>
        {reg.messageKey && reg.status !== 'checking' ? (
          <Text style={[ekType.c13, { color: c.danger, textAlign: 'center' }]}>{t(reg.messageKey)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Radio({ on, ring }: { on: boolean; ring: string }) {
  const { c } = useEk();
  return (
    <View
      style={[
        styles.radio,
        on ? { backgroundColor: c.ink } : { borderWidth: 1.5, borderColor: ring },
      ]}
    >
      {on ? <Check size={14} color={c.surface} weight="bold" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bric: { fontFamily: ekType.h20.fontFamily },
  t30: { fontSize: 30, lineHeight: 36 },
  mark: { borderRadius: 8, paddingHorizontal: 6 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  cityWrap: { flex: 1, paddingHorizontal: 16, gap: 16 },
  cityCol: { flex: 1, minHeight: 0, gap: 6 },
  exitBtn: { width: 44, height: 44, marginLeft: -10, marginBottom: -8, alignItems: 'center', justifyContent: 'center' },
  select: { height: 52, borderRadius: 16, borderWidth: 1, paddingLeft: 14, paddingRight: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontFamily: ekType.b15s.fontFamily, fontSize: 16, lineHeight: 21 },
  search: { height: 48, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: ekType.b15.fontFamily, fontSize: 16, paddingVertical: 0 },
  listCard: { borderRadius: 20, overflow: 'hidden' },
  row: { minHeight: 52, paddingHorizontal: 14, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, fontSize: 16, lineHeight: 21 },
  openChip: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  noMatch: { paddingVertical: 16, paddingHorizontal: 14 },
  rowTop: { borderTopWidth: 1 },
  stateRow: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  errorBox: { paddingVertical: 16, paddingHorizontal: 14, gap: 12, alignItems: 'flex-start' },
  retryBtn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cityCta: { position: 'absolute', left: 16, right: 16, gap: 6 },
  help: { textAlign: 'center', fontFamily: ekType.c13.fontFamily, fontSize: 13, lineHeight: 18 },
  cta: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: ekType.b15s.fontFamily, fontSize: 16, lineHeight: 21 },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 340, overflow: 'hidden' },
  backGlass: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitText: { position: 'absolute', top: 364, left: 16, right: 16, gap: 10 },
  body16: { fontFamily: ekType.b15.fontFamily, fontSize: 16, lineHeight: 22 },
  waitActions: { position: 'absolute', left: 16, right: 16, gap: 10 },
  actCard: { minHeight: 64, paddingVertical: 10, paddingLeft: 18, paddingRight: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actT: { fontFamily: ekType.b15s.fontFamily, fontSize: 16, lineHeight: 21 },
  textBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  link15: { fontFamily: ekType.b15s.fontFamily, fontSize: 15, lineHeight: 20 },
  otherHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52, gap: 12 },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 180,
  },
  notice: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nearHead: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footnote: { paddingHorizontal: 16, paddingTop: 20 },
  soonText: { paddingHorizontal: 16, paddingBottom: 16 },
  addRowNext: { borderTopWidth: 0 },
  pillText: { fontSize: 15, flexShrink: 1 },
});
