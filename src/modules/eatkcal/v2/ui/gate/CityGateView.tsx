// eatkcal v2 (G15-S5 md.2) — fotoğraflı il kapısı: FinCityR1 · FinWaitlistR1 · FinEatBerlin.
//
// Şehir listesi (SignupEatScreen) YERİNE Final'deki üç adım; MANTIK AYNI:
//  - şehir doğrulama: `useEatkcalRegistration()` → setCity + checkCity
//    (checkDeliveryCity RPC; SignupEatScreen.tsx:52-62 ile aynı sıra: şehir
//    seçilince setCity, onay dokunuşunda checkCity)
//  - "Haber ver": `addNotifyCity` (yalnız yerel tercih; sunucuya gitmez)
//  - geçiş: çağıran `onAllowed` (writeCityGatePassed + adres/ileri) yapar.
// Veri olmayan Final öğeleri GİZLİ (uydurma yok): "[N] kişi listede" (bekleme
// listesi sayısı sunucuda yok), Berlin restoran satırları (restoran verisi yok).
// Şehir fotoğrafları henüz varlık olarak yok → aynı ölçüde yer tutucu yüzey
// (`CITY_PHOTOS`'a görsel eklenince kendiliğinden görünür; LOG › SORULAR).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { BlurView } from 'expo-blur';
import { haptic } from '../../../../../core/design';
import { ArrowLeft, Bell, CaretDown, CaretRight, Check, MapPin, Plus, Storefront } from '../../../../../components/icons';
import { TAB_BAR_TOTAL } from '../../../../../constants/layout';
import { useEatkcalRegistration } from '../../../../profil/useRegistration';
import { CITY_CATALOG, type CityOption } from '../../../cityGate';
import { addNotifyCity, readNotifyCities } from '../../../cityGateStorage';
import { ekType, useEk } from '../kit';

export type GateStep = 'city' | 'waitlist' | 'other';

/** Şehir fotoğrafları (varlık eklenince doldurulur). */
const CITY_PHOTOS: Partial<Record<string, ImageSourcePropType>> = {};

/** Restoran ekleme başvurusu — sözleşmelerdeki resmi iletişim adresi (src/data/contractsData.ts). */
const RESTAURANT_MAIL = 'mailto:info@eatkcal.com?subject=Restoran%20ba%C5%9Fvurusu';

const IZMIR = CITY_CATALOG.find((x) => x.active) ?? CITY_CATALOG[0];
const SOON = CITY_CATALOG.filter((x) => !x.active).slice(0, 2);

function usePalette() {
  const { c, theme } = useEk();
  return {
    ph: theme.isDark ? '#3A3A3C' : '#DCDEE2',
    glass: theme.isDark ? 'rgba(28,28,30,0.62)' : 'rgba(255,255,255,0.72)',
    outline: theme.isDark ? 'rgba(255,255,255,0.22)' : '#C3C7CC',
    tint: (theme.isDark ? 'dark' : 'light') as 'dark' | 'light',
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

function Photo({ cityKey, height, radius, children }: { cityKey: string; height: number; radius: number; children?: React.ReactNode }) {
  const p = usePalette();
  const src = CITY_PHOTOS[cityKey];
  return (
    <View style={{ height, borderRadius: radius, backgroundColor: p.ph, overflow: 'hidden' }}>
      {src ? <Image source={src} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      {children}
    </View>
  );
}

function GlassChip({ label }: { label: string }) {
  const { c } = useEk();
  const p = usePalette();
  return (
    <View style={styles.chip}>
      <BlurView intensity={30} tint={p.tint} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: p.glass }]} />
      <Text style={[ekType.c13, { color: c.ink }]}>{label}</Text>
    </View>
  );
}

export function CityGateView({
  onAllowed,
  onExit,
  onTrack,
  initialStep = 'city',
  initialCityKey,
  otherCityName,
  showTabSpace = true,
}: {
  onAllowed: () => void;
  /** Kapı bir stack ekranında açıldıysa geri (yoksa ilk adımda geri yok). */
  onExit?: () => void;
  /** "Bu arada takibe devam et" (Ana sayfa). */
  onTrack?: () => void;
  initialStep?: GateStep;
  initialCityKey?: string;
  /** "Diğer şehir" adımında gösterilecek şehir adı (kayıtlı adresten). */
  otherCityName?: string | null;
  /** Sekme içinde: alt sekme çubuğu kadar boşluk. */
  showTabSpace?: boolean;
}) {
  const { c, t, lang, insets } = useEk();
  const p = usePalette();
  const reg = useEatkcalRegistration();
  const [step, setStep] = useState<GateStep>(initialStep);
  const [waitCity, setWaitCity] = useState<CityOption>(
    CITY_CATALOG.find((x) => x.key === initialCityKey) ?? SOON[0] ?? IZMIR,
  );
  const [notified, setNotified] = useState<string[]>([]);
  const label = (x: CityOption) => (lang === 'en' ? x.labelEn : x.labelTr);
  // Sekme çubuğu yüzer: görünür yüksekliği TAB_BAR_TOTAL + alt güvenli alan.
  const bottomSpace = showTabSpace ? TAB_BAR_TOTAL + insets.bottom + 4 : insets.bottom;

  // İzmir varsayılan seçili (Final); doğrulama şehri baştan ayarlı.
  const { setCity } = reg;
  useEffect(() => {
    setCity(IZMIR.labelTr);
  }, [setCity]);
  useEffect(() => {
    readNotifyCities().then(setNotified).catch(() => {});
  }, []);

  const confirmIzmir = useCallback(async () => {
    if (reg.status === 'checking') return;
    haptic('selection');
    const ok = await reg.checkCity();
    if (ok) {
      haptic('success');
      onAllowed();
    }
  }, [reg, onAllowed]);

  const openWaitlist = (x: CityOption) => {
    haptic('selection');
    setWaitCity(x);
    setStep('waitlist');
  };

  const notify = async () => {
    haptic('success');
    setNotified(await addNotifyCity(waitCity.key));
  };

  // ── FinWaitlistR1 ────────────────────────────────────────────────────────
  if (step === 'waitlist') {
    const done = notified.includes(waitCity.key);
    const name = label(waitCity);
    return (
      <View style={[styles.fill, { backgroundColor: c.bg }]} testID="ek-gate-waitlist">
        <View style={[styles.hero, { backgroundColor: p.ph }]}>
          {CITY_PHOTOS[waitCity.key] ? (
            <Image source={CITY_PHOTOS[waitCity.key]!} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : null}
        </View>
        <Pressable
          onPress={() => setStep('city')}
          accessibilityRole="button"
          accessibilityLabel={t('eatkcal.v2.common.back')}
          style={[styles.backGlass, { top: insets.top + 6 }]}
        >
          <BlurView intensity={30} tint={p.tint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: p.glass }]} />
          <ArrowLeft size={20} color={c.ink} />
        </Pressable>
        <View style={styles.waitText}>
          <View style={styles.titleRow} accessible accessibilityRole="header" accessibilityLabel={t('eatkcal.v2.gate.wait_a11y', { city: name })}>
            {lang === 'en' ? (
              <>
                <Text style={[ekType.h24, styles.t34, { color: c.ink }]}>{t('eatkcal.v2.gate.wait_pre')}</Text>
                <Mark size={34}>{name}</Mark>
              </>
            ) : (
              <>
                <Mark size={34}>{name}</Mark>
                <Text style={[ekType.h24, styles.t34, { color: c.ink }]}>
                  {t(`eatkcal.v2.gate.wait_post_${waitCity.key}`) || t('eatkcal.v2.gate.wait_post')}
                </Text>
              </>
            )}
          </View>
        </View>
        <View style={[styles.waitActions, { bottom: bottomSpace + 13 }]}>
          <Pressable
            onPress={done ? undefined : notify}
            disabled={done}
            accessibilityRole="button"
            accessibilityState={{ disabled: done }}
            style={({ pressed }) => [
              styles.notifyBtn,
              { backgroundColor: done ? c.surface : c.accent },
              pressed && { opacity: 0.85 },
            ]}
            testID="ek-gate-notify"
          >
            {done ? <Check size={20} color={c.ink} /> : <Bell size={20} color={c.onAccent} />}
            <Text style={[ekType.b15s, { color: done ? c.ink : c.onAccent }]}>
              {done ? t('eatkcal.v2.gate.notify_done') : t('eatkcal.v2.gate.notify')}
            </Text>
          </Pressable>
          {onTrack ? (
            <Pressable onPress={onTrack} accessibilityRole="button" style={styles.textBtn}>
              <Text style={[ekType.b15m, { color: c.ink }]}>{t('eatkcal.v2.gate.keep_tracking')}</Text>
            </Pressable>
          ) : null}
        </View>
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
          <Text style={[ekType.c13, { color: c.secondary }]}>{` · ${t('eatkcal.v2.gate.soon')}`}</Text>
        </View>
        <Pressable
          onPress={() => Linking.openURL(RESTAURANT_MAIL).catch(() => {})}
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
      </View>
    );
  }

  // ── FinCityR1 ────────────────────────────────────────────────────────────
  const checking = reg.status === 'checking';
  return (
    <View style={[styles.fill, styles.cityWrap, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]} testID="ek-gate-city">
      {onExit ? (
        <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel={t('eatkcal.v2.common.back')} style={styles.exitBtn}>
          <ArrowLeft size={22} color={c.ink} />
        </Pressable>
      ) : null}
      <View style={styles.titleRow} accessible accessibilityRole="header" accessibilityLabel={`${t('eatkcal.v2.gate.where_pre')}${t('eatkcal.v2.gate.where_mark')}`}>
        <Text style={[ekType.h24, styles.t30, { color: c.ink }]}>{t('eatkcal.v2.gate.where_pre')}</Text>
        <Mark size={30}>{t('eatkcal.v2.gate.where_mark')}</Mark>
      </View>

      <Pressable
        onPress={confirmIzmir}
        accessibilityRole="button"
        accessibilityState={{ selected: true, busy: checking }}
        accessibilityLabel={`${label(IZMIR)}, ${t('eatkcal.v2.gate.open_now')}`}
        style={styles.izmir}
        testID="ek-gate-izmir"
      >
        <View style={[styles.izmirOutline, { borderColor: c.ink }]}>
          <Photo cityKey={IZMIR.key} height={176} radius={20} />
        </View>
        <View style={styles.izmirMeta}>
          <View style={styles.fill}>
            <Text style={[ekType.h20, { color: c.ink }]}>{label(IZMIR)}</Text>
            <View style={styles.openRow}>
              <View style={[styles.dot, { backgroundColor: c.ink }]} />
              <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.gate.open_now')}</Text>
            </View>
          </View>
          <View style={[styles.radio, { backgroundColor: c.ink }]}>
            {checking ? <ActivityIndicator size="small" color={c.bg} /> : <Check size={16} color={c.bg} weight="bold" />}
          </View>
        </View>
        {reg.status === 'blocked' || reg.status === 'error' ? (
          <Text style={[ekType.c13, { color: c.danger }]} accessibilityRole="alert">
            {reg.status === 'blocked' ? t('eatkcal.city_gate.blocked') : t('eatkcal.city_gate.error')}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.grid}>
        {SOON.map((x) => (
          <Pressable
            key={x.key}
            onPress={() => openWaitlist(x)}
            accessibilityRole="button"
            accessibilityLabel={`${label(x)}, ${t('eatkcal.v2.gate.soon')}`}
            style={styles.gridItem}
            testID={`ek-gate-soon-${x.key}`}
          >
            <Photo cityKey={x.key} height={128} radius={18}>
              <GlassChip label={t('eatkcal.v2.gate.soon')} />
            </Photo>
            <Text style={[ekType.b17, styles.bric, { color: c.ink }]}>{label(x)}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => {
          haptic('selection');
          setStep('other');
        }}
        accessibilityRole="button"
        style={[styles.otherRow, { borderTopColor: c.line, borderBottomColor: c.line }]}
        testID="ek-gate-other-city"
      >
        <View style={[styles.otherIcon, { backgroundColor: c.surface }]}>
          <MapPin size={22} color={c.ink} />
        </View>
        <Text style={[ekType.b17, styles.bric, { color: c.ink, flex: 1 }]}>{t('eatkcal.v2.gate.other_city')}</Text>
        <View style={styles.chev}>
          <CaretRight size={18} color={c.secondary} />
        </View>
      </Pressable>
      <View style={{ height: bottomSpace }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bric: { fontFamily: ekType.h20.fontFamily },
  t30: { fontSize: 30, lineHeight: 36 },
  t34: { fontSize: 34, lineHeight: 41 },
  mark: { borderRadius: 8, paddingHorizontal: 6 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  cityWrap: { paddingHorizontal: 16, gap: 16 },
  exitBtn: { width: 44, height: 44, marginLeft: -10, marginBottom: -8, alignItems: 'center', justifyContent: 'center' },
  izmir: { gap: 8 },
  izmirOutline: { borderWidth: 2, borderRadius: 24, padding: 2 },
  izmirMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  radio: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', gap: 12 },
  gridItem: { flex: 1, gap: 6 },
  chip: {
    position: 'absolute',
    top: 8,
    left: 8,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  otherRow: {
    marginHorizontal: -16,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  otherIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chev: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 400, overflow: 'hidden' },
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
  waitText: { position: 'absolute', top: 424, left: 16, right: 16, gap: 10 },
  waitActions: { position: 'absolute', left: 16, right: 16, gap: 4 },
  notifyBtn: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  textBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
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
