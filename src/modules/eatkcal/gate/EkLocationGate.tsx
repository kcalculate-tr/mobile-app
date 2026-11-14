// G48-S1 — eatkcal konum kapısı (tek ekran): CityGateView / WaitlistR1 / FinEatBerlin yerine.
// Tasarım girdisi: docs/tur28/eatkcal-kapi (01/03 adres formu · 02/04 çok yakında), 393×852 pano ölçüleri.
//  • Tam ekran SABİT arka plan (assets/eatkcal/gate-bg.webp, cover, üstten hizalı) + altta zemine karışan koyu
//    yeşil degrade. Açık ve koyu temada AYNI görünüm (görsel tabanlı sayfa). Pano "eatkcal." yazısı yerine
//    uygulama logosu (lime, aynı yer/yükseklik). Pano alt sekme çubuğu yok sayılır (gerçek sekme çubuğu kalır).
//  • Durum A (adres formu): logo · "Adresini gir." · alt metin · koyu cam kartta 2×2 alan (ÜLKE · ŞEHİR · İLÇE ·
//    POSTA KODU) · konum düğmesi (expo-location; izin yoksa sessiz) · lime "Restoranları gör".
//  • Durum B (çok yakında): konum hapı "[İlçe], [Şehir] · Değiştir" · ÇOK YAKINDA · iki parçalı başlık (2. lime)
//    · alt metin · lime "Restoranını ekle" · kenarlı "Çevrendeki restoranları öner" (FinWaitlistAdd / Suggest).
//  • Geçiş: arka plan hiç hareket etmez; yalnız alt blok değişir (EK_GATE_MOTION: eski 180 ms opaklık + 8 pt
//    aşağı, yeni 240 ms opaklık + 12 pt yukarıdan, başlık ↔ kart 60 ms kademe). Azaltılmış harekette anlık.
//    Klavye açılınca blok yukarı kayar (KeyboardAvoidingView), arka plan sabit.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle } from 'react-native-svg';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { FinText as Text } from '../../../core/design/components/FinText';
import { Sheet } from '../../../core/design/components/Sheet';
import { BrandLogo, EK_GATE_MOTION, haptic, useReducedMotion, useTheme } from '../../../core/design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily } from '../../../core/design/typography';
import { palette } from '../../../core/design/tokens';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { CaretDown, CaretLeft, Check, MagnifyingGlass, MapPin } from '../../../components/icons';
import { TAB_BAR_TOTAL } from '../../../constants/layout';
import { tabBarBottomOffset, TAB_BAR_R3 } from '../../shell/layout';
import { useInR3Shell } from '../../shell';
import { useT } from '../../../core/i18n';
import { track } from '../../../lib/analytics';
import { countryName, filterCountries, findCountry, isTurkey, orderedCountries, typedCity, TURKEY } from '../v2/model/geo';
import { filterProvinces, orderedProvinces } from '../v2/model/provinces';
import { useCitySearch } from '../v2/ui/gate/useCitySearch';
import { WaitlistFormSheet } from '../v2/ui/gate/WaitlistFormSheet';
import { flushWaitlistQueue } from '../v2/ui/gate/waitlistSend';
import type { WaitlistKind } from '../v2/model/waitlist';
import {
  IZMIR_NAME,
  canSubmit,
  districtMode,
  findDistrict,
  gateSelectProps,
  gateTarget,
  isIzmir,
  locationLabel,
  selectionFromGeocode,
  type DistrictOption,
  type GateSelection,
} from './gateRule';
import { fetchIzmirDistricts, useIzmirDistricts } from './eatGate';
import { currentCoords, requestLocationPermission, reverseGeocodeAdmin } from '../v2/model/addressGeocode';
import { useEatkcalRegistration } from '../../profil/useRegistration';

const BG = require('../../../../assets/eatkcal/gate-bg.webp');
/** arkaplan.png 852×1846 → en-boy. */
const BG_RATIO = 1846 / 852;

/** Pano renkleri (ölçüldü: docs/tur28/eatkcal-kapi, örnek piksel). Tema bağımsız. */
export const GATE = {
  ground: '#0E3020',
  card: 'rgba(0,0,0,0.29)',
  cardEdge: 'rgba(255,255,255,0.10)',
  field: 'rgba(255,255,255,0.08)',
  fieldEdge: 'rgba(255,255,255,0.12)',
  locate: 'rgba(255,255,255,0.10)',
  ink: '#FFFFFF',
  sub: 'rgba(255,255,255,0.80)',
  label: 'rgba(255,255,255,0.58)',
  muted: 'rgba(255,255,255,0.55)',
  outline: 'rgba(255,255,255,0.38)',
  lime: palette.lime,
  onLime: '#0B1F10',
} as const;

/** Pano ölçüleri (393×852 pt). */
export const GATE_SIZE = {
  side: 22,
  cardSide: 13,
  cardPad: 14,
  cardRadius: 20,
  field: 44,
  fieldRadius: 14,
  colGap: 10,
  rowGap: 10,
  btn: 50,
  btnRadius: 14,
  bigBtn: 51,
  bigBtnRadius: 16,
  bigSide: 16,
  logo: 12,
  title: 31,
  titleLine: 35,
  body: 14,
  bodyLine: 20,
  label: 10,
  /** Sekme çubuğunun üst kenarı ile blok arası (pano: 16–18). */
  aboveTabs: 16,
} as const;

export type GateState = 'address' | 'soon';

const EMPTY_SEL: GateSelection = { country: TURKEY, city: null, district: null, postalCode: null };

export function EkLocationGate({
  onServed,
  onPrivacy,
  onExit,
  showTabSpace = true,
  initialSelection,
  initialState = 'address',
  initialSheet,
  initialPicker,
}: {
  /** Hizmet verilen İzmir ilçesi seçildi ("Restoranları gör"). */
  onServed: (sel: GateSelection) => void;
  onPrivacy?: () => void;
  /** Kapı bir yığın ekranında açıldıysa (sekme dışı giriş) geri. */
  onExit?: () => void;
  showTabSpace?: boolean;
  /** YALNIZ vitrin / test: başlangıç seçimi. */
  initialSelection?: Partial<GateSelection>;
  initialState?: GateState;
  initialSheet?: WaitlistKind;
  /** YALNIZ vitrin: açık başlayan seçici (ilçe adımı görüntüsü). */
  initialPicker?: 'country' | 'city' | 'district';
}) {
  const { t, lang } = useT();
  const reduced = useReducedMotion();
  const inR3 = useInR3Shell();
  const { width: W, height: H } = useWindowDimensions();
  const insetsBottom = useSafeBottom();
  const [sel, setSel] = useState<GateSelection>({ ...EMPTY_SEL, ...initialSelection });
  const [state, setState] = useState<GateState>(initialState);
  const [shown, setShown] = useState<GateState>(initialState);
  const [picker, setPicker] = useState<'country' | 'city' | 'district' | null>(initialPicker ?? null);
  const [sheet, setSheet] = useState<WaitlistKind | null>(initialSheet ?? null);
  const [locating, setLocating] = useState(false);
  const districts = useIzmirDistricts();
  // Mantık korunur: hizmet verilen İzmir ilçesinde sunucu il doğrulaması (checkDeliveryCity) bayrak açıkken.
  const reg = useEatkcalRegistration();
  const { setCity: setRegCity } = reg;
  useEffect(() => {
    setRegCity(IZMIR_NAME);
  }, [setRegCity]);
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const g = (k: string, o?: Record<string, string | number>) => t(`eatkcal.gate48.${k}`, o);

  const bottomSpace = showTabSpace
    ? (inR3 ? tabBarBottomOffset(insetsBottom) + TAB_BAR_R3.PILL_HEIGHT : TAB_BAR_TOTAL + insetsBottom) + GATE_SIZE.aboveTabs
    : Math.max(insetsBottom, 16) + 12;

  // Bekleyen form gönderimleri (ağ hatası yedeği kuyruğu).
  useEffect(() => {
    flushWaitlistQueue().catch(() => {});
  }, []);

  // md.4: görüntülenme (her durum bir kez).
  const viewed = useRef<Set<GateState>>(new Set());
  useEffect(() => {
    if (viewed.current.has(shown)) return;
    viewed.current.add(shown);
    track('eatkcal_gate_view', { state: shown });
  }, [shown]);

  // ── Geçiş: yalnız alt blok (başlık grubu + kart grubu, 60 ms kademe) ─────────
  const headO = useSharedValue(1);
  const headY = useSharedValue(0);
  const bodyO = useSharedValue(1);
  const bodyY = useSharedValue(0);
  const headStyle = useAnimatedStyle(() => ({ opacity: headO.value, transform: [{ translateY: headY.value }] }));
  const bodyStyle = useAnimatedStyle(() => ({ opacity: bodyO.value, transform: [{ translateY: bodyY.value }] }));

  const swapTo = useCallback(
    (next: GateState) => {
      setState(next);
      if (reduced) {
        setShown(next);
        return;
      }
      const M = EK_GATE_MOTION;
      const out = { duration: M.outMs, easing: M.outCurve };
      const inn = { duration: M.inMs, easing: M.inCurve };
      const enter = () => {
        setShown(next);
        headY.value = M.inShift;
        bodyY.value = M.inShift;
        headO.value = withTiming(1, inn);
        headY.value = withTiming(0, inn);
        bodyO.value = withDelay(M.stagger, withTiming(1, inn));
        bodyY.value = withDelay(M.stagger, withTiming(0, inn));
      };
      headO.value = withTiming(0, out);
      headY.value = withTiming(M.outShift, out);
      bodyO.value = withDelay(M.stagger, withTiming(0, out));
      bodyY.value = withDelay(
        M.stagger,
        withTiming(M.outShift, out, (fin) => {
          if (fin) runOnJS(enter)();
        }),
      );
    },
    [reduced, headO, headY, bodyO, bodyY],
  );

  // ── Seçim ────────────────────────────────────────────────────────────────
  const tr = isTurkey(sel.country);
  const izmir = tr && isIzmir(sel.city);
  const mode = districtMode(sel);
  const ready = canSubmit(sel);
  const countryRow = findCountry(sel.country);
  const countryText = countryRow ? countryName(countryRow, lang) : sel.country;

  const setCountry = (iso: string) => setSel({ country: iso, city: null, district: null, postalCode: null });
  const setCity = (city: string) => setSel((s) => ({ ...s, city, district: null }));
  const setDistrict = (d: string) => setSel((s) => ({ ...s, district: d }));

  const onLocate = useCallback(async () => {
    if (locating) return;
    haptic('selection');
    setLocating(true);
    try {
      // İzin tek yardımcıdan (askOnce: reddedildiyse bir daha sistem penceresi yok); izin yoksa sessiz.
      const ok = await requestLocationPermission().catch(() => false);
      if (!ok) return;
      const pos = await currentCoords();
      if (!pos) return;
      const geo = await reverseGeocodeAdmin(pos.latitude, pos.longitude);
      const list = await fetchIzmirDistricts().catch(() => [] as DistrictOption[]);
      const next = selectionFromGeocode(geo, list);
      if (next) {
        haptic('success');
        setSel(next);
      }
    } finally {
      setLocating(false);
    }
  }, [locating]);

  const onSee = useCallback(async () => {
    if (!ready || reg.status === 'checking') return;
    setCheckErr(null);
    const target = gateTarget(sel, districts.list);
    const served = target === 'address';
    track('eatkcal_gate_select', gateSelectProps(sel, served));
    if (served) {
      if (reg.enabled) {
        const ok = await reg.checkCity();
        if (!ok) {
          haptic('warning');
          setCheckErr(reg.messageKey ? t(reg.messageKey) : t('eatkcal.city_gate.error'));
          return;
        }
      }
      haptic('success');
      onServed(sel);
      return;
    }
    haptic('selection');
    swapTo('soon');
  }, [ready, sel, districts.list, onServed, swapTo, reg, t]);

  // ── Arka plan (sabit; pencere boyutuna göre — klavye/yerleşim değişimi taşımaz) ──
  const bgW = Math.max(W, H / BG_RATIO);
  const bgH = bgW * BG_RATIO;

  return (
    <View style={[styles.fill, { backgroundColor: GATE.ground }]} testID="ek-gate48">
      <StatusBar style="light" />
      <View pointerEvents="none" style={[styles.bg, { width: W, height: H }]}>
        <Image source={BG} style={{ position: 'absolute', top: 0, left: (W - bgW) / 2, width: bgW, height: bgH }} resizeMode="cover" accessibilityIgnoresInvertColors />
        <LinearGradient colors={['rgba(14,48,32,0)', GATE.ground]} locations={[0, 1]} style={[styles.fade, { top: H * 0.72 }]} />
      </View>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={-(bottomSpace - 12)}
      >
        <View style={[styles.fill, { justifyContent: 'flex-end', paddingBottom: bottomSpace }]}>
          {shown === 'address' ? (
            <View testID="ek-gate48-address">
              <Animated.View style={[{ paddingHorizontal: GATE_SIZE.side }, headStyle]}>
                <BrandLogo name="eatkcal" height={GATE_SIZE.logo} color={GATE.lime} accessibilityLabel={g('logo_a11y')} testID="gate48-logo" />
                <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title} testID="gate48-title">
                  {g('title')}
                </Text>
                <Text maxFontSizeMultiplier={1.3} style={styles.sub}>
                  {g('sub')}
                </Text>
              </Animated.View>
              <Animated.View style={[styles.card, bodyStyle]} testID="gate48-card">
                <View style={styles.row}>
                  <Field label={g('country')} a11y={g('country_a11y')} value={countryText} onPress={() => setPicker('country')} testID="gate48-country" />
                  <Field label={g('city')} a11y={g('city_a11y')} value={sel.city ?? ''} placeholder={g('pick')} onPress={() => setPicker('city')} testID="gate48-city" />
                </View>
                <View style={[styles.row, { marginTop: GATE_SIZE.rowGap }]}>
                  {mode === 'list' ? (
                    <Field
                      label={g('district')}
                      a11y={g('district_a11y')}
                      value={sel.district ?? ''}
                      placeholder={g('pick')}
                      onPress={() => setPicker('district')}
                      testID="gate48-district"
                    />
                  ) : (
                    <InputField
                      label={g('district')}
                      a11y={g('district_a11y')}
                      value={sel.district ?? ''}
                      placeholder={sel.city ? g('district_ph') : ''}
                      editable={!!sel.city}
                      onChange={(v) => setSel((s) => ({ ...s, district: v }))}
                      testID="gate48-district"
                    />
                  )}
                  <InputField
                    label={g('postcode')}
                    a11y={g('postcode_a11y')}
                    value={sel.postalCode ?? ''}
                    placeholder={tr ? '35040' : ''}
                    keyboardType="number-pad"
                    maxLength={10}
                    onChange={(v) => setSel((s) => ({ ...s, postalCode: v.replace(/[^0-9A-Za-z -]/g, '') }))}
                    testID="gate48-postcode"
                  />
                </View>
                <View style={[styles.row, { marginTop: 12 }]}>
                  <Pressable
                    onPress={() => void onLocate()}
                    accessibilityRole="button"
                    accessibilityLabel={locating ? g('locate_busy') : g('locate')}
                    accessibilityState={{ busy: locating }}
                    style={({ pressed }) => [styles.locate, { opacity: pressed ? 0.8 : 1 }]}
                    testID="gate48-locate"
                  >
                    {locating ? <ActivityIndicator color={GATE.lime} /> : <TargetIcon />}
                  </Pressable>
                  <Pressable
                    onPress={() => void onSee()}
                    disabled={!ready}
                    accessibilityRole="button"
                    accessibilityLabel={g('see')}
                    accessibilityState={{ disabled: !ready }}
                    style={({ pressed }) => [styles.see, { opacity: !ready ? 0.45 : pressed ? 0.9 : 1 }]}
                    testID="gate48-see"
                  >
                    {reg.status === 'checking' ? (
                      <ActivityIndicator color={GATE.onLime} />
                    ) : (
                      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.seeText}>
                        {g('see')}
                      </Text>
                    )}
                  </Pressable>
                </View>
                {checkErr ? (
                  <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.3} style={styles.err} testID="gate48-check-error">
                    {checkErr}
                  </Text>
                ) : null}
              </Animated.View>
            </View>
          ) : (
            <View testID="ek-gate48-soon">
              <Animated.View style={[{ paddingHorizontal: GATE_SIZE.side }, headStyle]}>
                <Pressable
                  onPress={() => {
                    haptic('selection');
                    swapTo('address');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${locationLabel(sel)}, ${g('change_a11y')}`}
                  hitSlop={{ top: 8, bottom: 8 }}
                  style={styles.pill}
                  testID="gate48-change"
                >
                  <MapPin size={14} color={GATE.lime} weight="fill" />
                  <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.pillText} testID="gate48-where">
                    {locationLabel(sel)}
                  </Text>
                  <Text maxFontSizeMultiplier={1.3} style={styles.pillChange}>
                    {`· ${g('change')}`}
                  </Text>
                </Pressable>
                <Text maxFontSizeMultiplier={1.3} style={styles.soonLabel}>
                  {g('soon_label')}
                </Text>
                <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.soonTitle} testID="gate48-soon-title">
                  {`${g('soon_title_1')} `}
                  <Text style={{ color: GATE.lime }}>{g('soon_title_2')}</Text>
                </Text>
                <Text maxFontSizeMultiplier={1.3} style={styles.soonBody}>
                  {g('soon_body')}
                </Text>
              </Animated.View>
              <Animated.View style={[{ paddingHorizontal: GATE_SIZE.bigSide, marginTop: 31 }, bodyStyle]}>
                <Pressable
                  onPress={() => {
                    haptic('selection');
                    setSheet('restaurant_add');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={g('add')}
                  style={({ pressed }) => [styles.bigLime, { opacity: pressed ? 0.9 : 1 }]}
                  testID="gate48-add"
                >
                  <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.seeText}>
                    {g('add')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    haptic('selection');
                    setSheet('restaurant_suggest');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={g('suggest')}
                  style={({ pressed }) => [styles.bigOutline, { opacity: pressed ? 0.85 : 1 }]}
                  testID="gate48-suggest"
                >
                  <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.outlineText}>
                    {g('suggest')}
                  </Text>
                </Pressable>
              </Animated.View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
      {onExit ? <ExitButton onPress={onExit} /> : null}

      {(['country', 'city', 'district'] as const).map((k) => (
        <GatePicker
          key={k}
          kind={k}
          visible={picker === k}
          sel={sel}
          lang={lang}
          districts={districts.list}
          districtsStatus={districts.status}
          onRetryDistricts={districts.retry}
          onClose={() => setPicker(null)}
          onPick={(kind, v) => {
            haptic('selection');
            if (kind === 'country') setCountry(v);
            else if (kind === 'city') setCity(v);
            else setDistrict(v);
            setPicker(null);
          }}
        />
      ))}
      <WaitlistFormSheet
        kind={sheet ?? 'restaurant_add'}
        visible={sheet != null}
        city={sel.city ?? ''}
        district={sel.district ?? ''}
        country={sel.country}
        onClose={() => setSheet(null)}
        onPrivacy={() => {
          setSheet(null);
          onPrivacy?.();
        }}
      />
    </View>
  );
}

// ── Parçalar ─────────────────────────────────────────────────────────────────
function useSafeBottom(): number {
  return useSafeAreaInsets().bottom;
}

function ExitButton({ onPress }: { onPress: () => void }) {
  const { t } = useT();
  const top = useSafeAreaInsets().top;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('eatkcal.v2.common.back')}
      style={[styles.exit, { top: top + 8 }]}
      testID="gate48-exit"
    >
      <CaretLeft size={22} color={GATE.ink} weight="bold" />
    </Pressable>
  );
}

function TargetIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={9} cy={9} r={7.9} stroke={GATE.lime} strokeWidth={2.2} fill="none" />
      <Circle cx={9} cy={9} r={3.9} fill={GATE.lime} />
    </Svg>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
      {children}
    </Text>
  );
}

function Field({ label, a11y, value, placeholder, onPress, testID }: { label: string; a11y: string; value: string; placeholder?: string; onPress: () => void; testID: string }) {
  return (
    <View style={styles.col}>
      <Label>{label}</Label>
      <Pressable
        onPress={() => {
          haptic('selection');
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${a11y}: ${value || placeholder || ''}`}
        style={({ pressed }) => [styles.field, styles.fieldRow, { opacity: pressed ? 0.85 : 1 }]}
        testID={testID}
      >
        <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.fieldText, !value && { color: GATE.muted }]}>
          {value || placeholder || ''}
        </Text>
        <CaretDown size={16} color={GATE.lime} weight="bold" />
      </Pressable>
    </View>
  );
}

function InputField({
  label,
  a11y,
  value,
  placeholder,
  onChange,
  keyboardType,
  maxLength,
  editable = true,
  testID,
}: {
  label: string;
  a11y: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  keyboardType?: 'number-pad' | 'default';
  maxLength?: number;
  editable?: boolean;
  testID: string;
}) {
  return (
    <View style={styles.col}>
      <Label>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={GATE.muted}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength ?? 80}
        editable={editable}
        maxFontSizeMultiplier={1.3}
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType="done"
        accessibilityLabel={a11y}
        keyboardAppearance="dark"
        selectionColor={GATE.lime}
        style={[styles.field, styles.fieldText, styles.input, !editable && { opacity: 0.6 }]}
        testID={testID}
      />
    </View>
  );
}

// ── Seçici sheet'i (ülke · şehir · ilçe) ─────────────────────────────────────
type PickerKind = 'country' | 'city' | 'district';
type Row = { value: string; label: string; sub?: string; served?: boolean };

function GatePicker({
  kind,
  visible,
  sel,
  lang,
  districts,
  districtsStatus,
  onRetryDistricts,
  onClose,
  onPick,
}: {
  /** Her seçici ayrı sheet (hızlı kapat → aç yarışında görünmez kalmasın). */
  kind: PickerKind;
  visible: boolean;
  sel: GateSelection;
  lang: string;
  districts: DistrictOption[];
  districtsStatus: 'loading' | 'ok' | 'error';
  onRetryDistricts: () => void;
  onClose: () => void;
  onPick: (kind: PickerKind, value: string) => void;
}) {
  const { t } = useT();
  const g = (k: string, o?: Record<string, string | number>) => t(`eatkcal.gate48.${k}`, o);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (visible) setQ('');
  }, [visible, kind]);
  const tr = isTurkey(sel.country);
  const foreignCity = kind === 'city' && !tr;
  const search = useCitySearch(q, foreignCity ? sel.country : null, foreignCity);
  const countries = useMemo(() => orderedCountries(lang), [lang]);

  const rows: Row[] = useMemo(() => {
    if (kind === 'country') return filterCountries(countries, q, lang).map((c) => ({ value: c.iso2, label: countryName(c, lang) }));
    if (kind === 'city' && tr) return filterProvinces(orderedProvinces(), q).map((p) => ({ value: p, label: p }));
    if (kind === 'city') {
      const list: Row[] = search.state.status === 'ok' ? search.state.cities.map((c) => ({ value: c.name, label: c.name, sub: c.admin1 })) : [];
      const typed = typedCity(q, sel.country);
      if (typed && !list.some((r) => r.label.toLocaleLowerCase() === typed.name.toLocaleLowerCase())) {
        list.push({ value: typed.name, label: t('eatkcal.v2.geo.use_typed', { q: typed.name }) });
      }
      return list;
    }
    if (kind === 'district') {
      const fq = q.trim().toLocaleLowerCase('tr');
      return districts
        .filter((d) => !fq || d.name.toLocaleLowerCase('tr').includes(fq))
        .map((d) => ({ value: d.name, label: d.name, sub: d.served ? g('served') : g('not_served'), served: d.served }));
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, q, countries, lang, tr, search.state, districts, sel.country]);

  const current = kind === 'country' ? sel.country : kind === 'city' ? sel.city : sel.district;
  const title = kind === 'country' ? g('sheet_country') : kind === 'city' ? g('sheet_city') : g('sheet_district');
  const ph = kind === 'country' ? g('search_country') : kind === 'city' ? g('search_city') : g('search_district');

  return (
    <Sheet visible={visible} onClose={onClose} title={title} product="eat" maxHeightRatio={0.8} testID={`gate48-picker-${kind}`}>
      <PickerBody
        q={q}
        setQ={setQ}
        ph={ph}
        rows={rows}
        current={current ?? ''}
        loading={(kind === 'city' && !tr && search.state.status === 'loading') || (kind === 'district' && districtsStatus === 'loading')}
        error={kind === 'district' && districtsStatus === 'error' ? { text: g('districts_error'), retry: g('retry'), onRetry: onRetryDistricts } : null}
        empty={g('no_match')}
        onPick={(v) => onPick(kind, v)}
      />
    </Sheet>
  );
}

function PickerBody({
  q,
  setQ,
  ph,
  rows,
  current,
  loading,
  error,
  empty,
  onPick,
}: {
  q: string;
  setQ: (v: string) => void;
  ph: string;
  rows: Row[];
  current: string;
  loading: boolean;
  error: { text: string; retry: string; onRetry: () => void } | null;
  empty: string;
  onPick: (v: string) => void;
}) {
  const c = useTheme().color;
  return (
    <View>
      <View style={[styles.search, { backgroundColor: c.surfaceRaised, borderColor: c.line }]}>
        <MagnifyingGlass size={18} color={c.secondary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={ph}
          placeholderTextColor={c.secondary}
          autoCorrect={false}
          accessibilityLabel={ph}
          style={[styles.searchInput, { color: c.ink }]}
          testID="gate48-search"
        />
      </View>
      <ScrollView {...SCROLL_KEYBOARD} style={{ maxHeight: 440 }}>
        {loading ? <ActivityIndicator style={{ marginVertical: 16 }} color={c.secondary} /> : null}
        {error ? (
          <Pressable onPress={error.onRetry} accessibilityRole="button" style={styles.optRow} testID="gate48-districts-retry">
            <Text style={[styles.optText, { color: c.ink }]}>{error.text}</Text>
            <Text style={[styles.optSub, { color: c.accentLine }]}>{error.retry}</Text>
          </Pressable>
        ) : null}
        {!loading && !error && rows.length === 0 && q.trim().length > 0 ? (
          <Text style={[styles.optSub, { color: c.secondary, paddingVertical: 16 }]}>{empty}</Text>
        ) : null}
        {rows.map((r) => {
          const on = r.value === current;
          return (
            <Pressable
              key={`${r.value}|${r.label}`}
              onPress={() => onPick(r.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={r.sub ? `${r.label}, ${r.sub}` : r.label}
              style={[styles.optRow, { borderBottomColor: c.line }]}
              testID={`gate48-opt-${r.value}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.optText, { color: c.ink }]}>{r.label}</Text>
                {r.sub ? <Text style={[styles.optSub, { color: r.served ? c.ink : c.secondary }]}>{r.sub}</Text> : null}
              </View>
              {r.served ? <View style={[styles.servedDot, { backgroundColor: GATE.lime }]} /> : null}
              {on ? <Check size={18} color={c.ink} weight="bold" /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Saf yardımcı (test): İzmir seçiliyken ilçe zorunlu. */
export const __gateInternals = { IZMIR_NAME, findDistrict };

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bg: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  title: { marginTop: 9, color: GATE.ink, fontFamily: fontFamily.bodyExtrabold, fontSize: GATE_SIZE.title, lineHeight: GATE_SIZE.titleLine, letterSpacing: -0.3 },
  sub: { marginTop: 6, color: GATE.sub, fontFamily: fontFamily.bodyRegular, fontSize: GATE_SIZE.body, lineHeight: GATE_SIZE.bodyLine },
  card: {
    marginTop: 21,
    marginHorizontal: GATE_SIZE.cardSide,
    padding: GATE_SIZE.cardPad,
    paddingTop: 14,
    borderRadius: GATE_SIZE.cardRadius,
    backgroundColor: GATE.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GATE.cardEdge,
  },
  row: { flexDirection: 'row', gap: GATE_SIZE.colGap },
  col: { flex: 1, minWidth: 0 },
  label: { color: GATE.label, fontFamily: fontFamily.bodyBold, fontSize: GATE_SIZE.label, lineHeight: 14, letterSpacing: 0.8, marginBottom: 4 },
  field: {
    height: GATE_SIZE.field,
    borderRadius: GATE_SIZE.fieldRadius,
    backgroundColor: GATE.field,
    borderWidth: 1,
    borderColor: GATE.fieldEdge,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 13, paddingRight: 12, gap: 6 },
  fieldText: { flex: 1, color: GATE.ink, fontFamily: fontFamily.bodySemibold, fontSize: 16, lineHeight: 20 },
  input: { paddingHorizontal: 13, paddingVertical: 0 },
  locate: {
    width: GATE_SIZE.btn,
    height: GATE_SIZE.btn,
    borderRadius: GATE_SIZE.btnRadius,
    backgroundColor: GATE.locate,
    borderWidth: 1,
    borderColor: GATE.fieldEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  see: { flex: 1, height: GATE_SIZE.btn, borderRadius: GATE_SIZE.btnRadius, backgroundColor: GATE.lime, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  seeText: { color: GATE.onLime, fontFamily: fontFamily.bodyBold, fontSize: 16, lineHeight: 20 },
  pill: {
    alignSelf: 'flex-start',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 13,
    paddingRight: 12,
    borderRadius: 15,
    backgroundColor: GATE.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GATE.fieldEdge,
    maxWidth: '100%',
  },
  pillText: { flexShrink: 1, color: GATE.ink, fontFamily: fontFamily.bodySemibold, fontSize: 12, lineHeight: 16 },
  pillChange: { color: GATE.muted, fontFamily: fontFamily.bodyMedium, fontSize: 12, lineHeight: 16 },
  soonLabel: { marginTop: 19, color: GATE.lime, fontFamily: fontFamily.bodyExtrabold, fontSize: 11, lineHeight: 14, letterSpacing: 1 },
  soonTitle: { marginTop: 6, color: GATE.ink, fontFamily: fontFamily.bodyExtrabold, fontSize: GATE_SIZE.title, lineHeight: GATE_SIZE.titleLine, letterSpacing: -0.3 },
  soonBody: { marginTop: 13, color: GATE.sub, fontFamily: fontFamily.bodyRegular, fontSize: GATE_SIZE.body, lineHeight: GATE_SIZE.bodyLine },
  bigLime: { height: GATE_SIZE.bigBtn, borderRadius: GATE_SIZE.bigBtnRadius, backgroundColor: GATE.lime, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  bigOutline: {
    marginTop: 11,
    height: GATE_SIZE.bigBtn,
    borderRadius: GATE_SIZE.bigBtnRadius,
    backgroundColor: GATE.card,
    borderWidth: 1,
    borderColor: GATE.outline,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  outlineText: { color: GATE.ink, fontFamily: fontFamily.bodyBold, fontSize: 16, lineHeight: 20 },
  exit: { position: 'absolute', left: 12, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: GATE.card },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, marginBottom: 8 },
  searchInput: { flex: 1, minHeight: 44, fontFamily: fontFamily.bodyMedium, fontSize: 16 },
  optRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  optText: { fontFamily: fontFamily.bodyMedium, fontSize: 16, lineHeight: 21 },
  optSub: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 17 },
  servedDot: { width: 8, height: 8, borderRadius: 4 },
  err: { marginTop: 10, color: GATE.sub, fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 17 },
});
