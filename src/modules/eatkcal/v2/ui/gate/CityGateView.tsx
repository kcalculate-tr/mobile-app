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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { BlurView } from 'expo-blur';
import { haptic } from '../../../../../core/design';
import { CaretDown, CaretLeft, CaretRight, Check, MagnifyingGlass, MapPin, Plus, Storefront } from '../../../../../components/icons';
import { TAB_BAR_TOTAL } from '../../../../../constants/layout';
import { tabBarBottomOffset, TAB_BAR_R3 } from '../../../../shell/layout';
import { useInR3Shell } from '../../../../shell';
import { useEatkcalRegistration } from '../../../../profil/useRegistration';
import { CITY_CATALOG } from '../../../cityGate';
import { ekType, useEk } from '../kit';
import { IZMIR, filterProvinces, gateTarget, orderedProvinces } from '../../model/provinces';
import { WaitlistFormSheet } from './WaitlistFormSheet';
import { flushWaitlistQueue } from './waitlistSend';
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
  const { c, t, insets } = useEk();
  const p = usePalette();
  const reg = useEatkcalRegistration();
  const inR3 = useInR3Shell();
  const [step, setStep] = useState<GateStep>(initialStep);
  const [country, setCountry] = useState<'TR' | 'OTHER'>('TR');
  const [countryOpen, setCountryOpen] = useState(false);
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

  const target = gateTarget(country, il);
  const waitCity = country === 'OTHER' ? otherCityName || t('eatkcal.v2.gate.region') : il ?? '';
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
      city={country === 'OTHER' ? otherCityName ?? '' : il ?? ''}
      country={country}
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
    return (
      <View style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]} testID="ek-gate-other">
        <View style={styles.otherHead}>
          <Text style={[ekType.h24, { color: c.ink, flex: 1 }]} accessibilityRole="header">
            eatkcal
          </Text>
          <Pressable
            onPress={() => setStep('city')}
            accessibilityRole="button"
            accessibilityLabel={t('eatkcal.v2.gate.change_city')}
            style={[styles.cityPill, { borderColor: p.outline }]}
          >
            <MapPin size={16} color={c.ink} />
            <Text style={[ekType.c13s, { color: c.ink, fontSize: 15 }]} numberOfLines={1}>
              {otherCityName || t('eatkcal.v2.gate.other_city')}
            </Text>
            <CaretDown size={12} color={c.ink} weight="fill" />
          </Pressable>
        </View>
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
        <Pressable
          onPress={() => {
            setCountry('OTHER');
            openSheet('restaurant_add');
          }}
          accessibilityRole="button"
          style={[styles.addRow, { borderTopColor: c.line, borderBottomColor: c.line }]}
          testID="ek-gate-add-restaurant"
        >
          <View style={[styles.addIcon, { borderColor: p.outline }]}>
            <Plus size={20} color={c.ink} />
          </View>
          <Text style={[ekType.b15s, { color: c.ink, flex: 1 }]}>{t('eatkcal.v2.gate.add_restaurant')}</Text>
          <CaretRight size={18} color={c.ink} />
        </Pressable>
        <Text style={[ekType.c13, styles.footnote, { color: c.secondary }]}>{t('eatkcal.v2.gate.only_kitchens')}</Text>
        {sheetEl}
      </View>
    );
  }
  // ── FinCityR1 ────────────────────────────────────────────────────────────
  const countryLabel = country === 'TR' ? t('eatkcal.v2.gate.country_tr') : t('eatkcal.v2.gate.country_other');
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
          {countryOpen ? (
            <View style={[styles.listCard, { backgroundColor: p.card }]} accessibilityRole="radiogroup">
              {(['TR', 'OTHER'] as const).map((k) => (
                <Pressable
                  key={k}
                  onPress={() => {
                    haptic('selection');
                    setCountry(k);
                    setIl(null);
                    setCountryOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: country === k }}
                  style={[styles.row, { borderBottomColor: c.line }]}
                  testID={`ek-gate-country-${k}`}
                >
                  <Text style={[styles.rowText, { color: c.ink, fontFamily: ekType.b15s.fontFamily }]}>
                    {k === 'TR' ? t('eatkcal.v2.gate.country_tr') : t('eatkcal.v2.gate.country_other')}
                  </Text>
                  <Radio on={country === k} ring={p.line2} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {country === 'TR' ? (
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
                    accessibilityLabel={`${name}, ${open ? t('eatkcal.v2.gate.open') : t('eatkcal.v2.gate.soon')}`}
                    style={[styles.row, { borderBottomColor: c.line }]}
                    testID={`ek-gate-il-${name}`}
                  >
                    <Text style={[styles.rowText, { color: c.ink, fontFamily: open ? ekType.b15s.fontFamily : ekType.b15m.fontFamily }]}>{name}</Text>
                    {open ? (
                      <View style={[styles.openChip, { backgroundColor: c.accent }]}>
                        <Text style={[ekType.c13s, { color: c.onAccent }]}>{t('eatkcal.v2.gate.open')}</Text>
                      </View>
                    ) : (
                      <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.gate.soon')}</Text>
                    )}
                    <Radio on={sel} ring={p.line2} />
                  </Pressable>
                );
              })}
              {list.length === 0 ? <Text style={[ekType.b15, styles.noMatch, { color: c.secondary }]}>{t('eatkcal.v2.gate.no_match')}</Text> : null}
            </ScrollView>
          </View>
        ) : (
          <View style={[styles.otherCard, { backgroundColor: p.card }]} testID="ek-gate-other-country">
            <View style={[styles.otherPin, { backgroundColor: p.nested }]}>
              <MapPin size={20} color={c.ink} weight="fill" />
            </View>
            <View style={[styles.fill, { gap: 2 }]}>
              <Text style={[ekType.b15s, { color: c.ink }]}>{t('eatkcal.v2.gate.other_title')}</Text>
              <Text style={[ekType.b15, { color: c.secondary }]}>{t('eatkcal.v2.gate.other_body')}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.cityCta, { bottom: bottomSpace }]}>
        {!target ? (
          <Text style={[styles.help, { color: c.secondary }]} testID="ek-gate-help">
            {t('eatkcal.v2.gate.pick_city')}
          </Text>
        ) : null}
        <Pressable
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityState={{ disabled: !target, busy: checking }}
          accessibilityHint={!target ? t('eatkcal.v2.gate.pick_city') : undefined}
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
  otherCard: { padding: 16, borderRadius: 20, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  otherPin: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
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
});
