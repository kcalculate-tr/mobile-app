// G54-S1 md.3 — 1.1.0 oryantasyonu (kökte bir kez bağlanır: AppNavigator). `yeni_kayit` açıkken; `yeni_onboarding`
// bayrağından BAĞIMSIZ. Oturumu açık her kullanıcı 1.1.0 ile ilk girişinde BİR KEZ görür (hesap bazında işaret).
//  1) "Yeni Kcalculate" tanıtımı (yalnız eski müşteri): tam ekran, 4 sayfa, yatay kaydırma, kayıt görsel dili (degrade
//     zemin, cam nesneler, küçük maskot); altta noktalar + "Devam" (son sayfada "Başlayalım"), sağ üstte "Geç".
//  2) Uygulama içi 4 ipucu (herkes): Tara → Ana sayfa kalori alanı / "Planını oluştur" kartı → Keşfet → eatkcal;
//     hedefin etrafı açık, gerisi karartılmış, balon + "İleri" / "Geç".
// Başlama: Ana sayfa odakta (hedef kayıtlı) VE başka katman yok (overlayGate sayacı 0 — T1/tebrik kök rotalarında Ana
// sayfa odakta değildir; izin sayfası/kutlama sayaçla kaydolur). Azaltılmış hareket: geçişler anlık. VoiceOver: balon
// metni duyurulur, odak hedefe gider. "Geç" ile kapatan bir daha görmez (işaret tur görünür olduğu anda yazılır).
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, ScrollView, StyleSheet, View, findNodeHandle, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppText } from '../../../core/design/components/AppText';
import { useTheme } from '../../../core/design/ThemeProvider';
import { CURVE, DURATION, REDUCED, haptic, useReducedMotion } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { useFeature } from '../../../core/flags';
import { useGateStore } from '../first/overlayGate';
import { useOnbFirst } from '../first/store';
import { ARROW, TIP_W, holeFor, placeTip, scrimPath, type Hole } from '../first/orient/geometry';
import { FONT, KBackdrop, KButton, KText, Mascot } from '../../kayit/ui/parts';
import { useK } from '../../kayit/ui/theme';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { ORIENT110_INTRO_PAGES, ORIENT110_TIPS, canStartNow, shouldOrient, type Orient110Tip } from './logic';
import { useOrient110 } from './store';

/** Ekran yerleşme payı (hedef ölçülmeden önce). */
const SETTLE = DURATION.slow;

const GLASS = {
  camera: require('../../../../assets/glass/camera.png'),
  trophy: require('../../../../assets/glass/trophy.png'),
  bowl: require('../../../../assets/glass/bowl.png'),
} as const;

/** Tanıtım sayfaları: cam nesne + metin anahtarı. */
export const INTRO_PAGES = [
  { key: 'p1', glass: 'camera' },
  { key: 'p2', glass: 'trophy' },
  { key: 'p3', glass: 'mascot' },
  { key: 'p4', glass: 'bowl' },
] as const;

/** İpucu deliği biçimi (geometri G18 ile ortak). */
const HOLE_SHAPE: Record<Orient110Tip, 'scan' | 'ring' | 'log'> = { scan: 'scan', home: 'ring', kesfet: 'scan', eatkcal: 'scan' };

export function Orient110Host({ vitrin }: { /** YALNIZ __DEV__ vitrini: tanıtım sayfası ya da ipucu doğrudan. */ vitrin?: { intro?: number; tip?: Orient110Tip } } = {}) {
  const flag = useFeature('yeni_kayit');
  const { user } = useAuth();
  const hydrate = useOrient110((s) => s.hydrate);
  const decided = useOrient110((s) => s.decided);
  const seen = useOrient110((s) => s.seen);
  const replay = useOrient110((s) => s.replay);
  const phase = useOrient110((s) => s.phase);
  const start = useOrient110((s) => s.start);
  const homeReady = useOrient110((s) => !!s.targets.home);
  const overlays = useGateStore((s) => s.open);
  const celebrating = useOnbFirst((s) => s.celebrate != null);
  const forced = __DEV__ ? vitrin : undefined;

  useEffect(() => {
    if (flag && !forced) void hydrate(user?.id ?? null);
  }, [flag, user?.id, hydrate, forced]);

  const want = replay || shouldOrient({ flag, session: !!user?.id, decided, seen });
  const ready = canStartNow({ homeReady, overlays, celebrating });
  useEffect(() => {
    if (forced || phase.kind !== 'idle' || !want || !ready) return;
    const id = setTimeout(() => {
      const s = useOrient110.getState();
      if (s.phase.kind === 'idle' && s.targets.home && useGateStore.getState().open === 0) start();
    }, SETTLE);
    return () => clearTimeout(id);
  }, [forced, phase.kind, want, ready, start]);

  if (forced?.intro != null) return <IntroPager page={forced.intro} vitrin />;
  if (forced?.tip) return <TipLayer tip={forced.tip} vitrin />;
  if (phase.kind === 'intro') return <IntroPager page={phase.page} />;
  // İpucu yalnız Ana sayfa odaktayken ve başka katman yokken (geçici olarak duraklar, geri gelince sürer).
  if (phase.kind === 'tip' && ready) return <TipLayer key={phase.tip} tip={phase.tip} />;
  return null;
}

// ─── Tanıtım ──────────────────────────────────────────────────────────────────
function IntroPager({ page, vitrin }: { page: number; vitrin?: boolean }) {
  const { t } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const next = useOrient110((s) => s.next);
  const skip = useOrient110((s) => s.skip);
  const ref = useRef<ScrollView>(null);
  const [shown, setShown] = useState(page);
  const last = shown === ORIENT110_INTRO_PAGES - 1;

  // Depodaki sayfa değişince (Devam) kaydır; azaltılmış harekette anlık.
  useEffect(() => {
    setShown(page);
    ref.current?.scrollTo({ x: page * width, animated: !reduced && !vitrin });
  }, [page, width, reduced, vitrin]);

  // Kullanıcı elle kaydırdı → depoyu o sayfaya getir (ölçüm her sayfada bir kez).
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (vitrin) return;
    const cur = useOrient110.getState().phase;
    if (cur.kind !== 'intro') return;
    if (p > cur.page) for (let i = cur.page; i < p; i++) next();
    else if (p < cur.page) useOrient110.setState({ phase: { kind: 'intro', page: p } });
  };

  const cont = () => {
    haptic('selection');
    if (!vitrin) next();
  };
  const close = () => {
    haptic('selection');
    if (!vitrin) skip();
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} testID="orient110-intro" accessibilityViewIsModal>
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <KBackdrop shift={shown * 6} />
      <View style={[styles.introTop, { paddingTop: insets.top + 6 }]}>
        <View style={styles.kicker}>
          <Mascot size={40} calm label={t('orient110.p3_glass')} />
          <KText maxFontSizeMultiplier={1.3} style={[styles.kickerText, { color: P.ink }]}>
            {t('orient110.intro_kicker')}
          </KText>
        </View>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('orient110.skip')} style={styles.skipBtn} testID="orient110-intro-skip">
          <KText maxFontSizeMultiplier={1.4} style={[styles.skipText, { color: P.ink }]}>
            {t('orient110.skip')}
          </KText>
        </Pressable>
      </View>
      <ScrollView
        {...SCROLL_KEYBOARD}
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        contentOffset={{ x: page * width, y: 0 }}
        style={{ flex: 1 }}
        testID="orient110-pager"
      >
        {INTRO_PAGES.map((pg, i) => (
          <View key={pg.key} style={[styles.page, { width }]} testID={`orient110-page-${i + 1}`} accessible={i === shown} accessibilityLabel={`${t(`orient110.${pg.key}_title`)}. ${t(`orient110.${pg.key}_body`)}. ${t('orient110.page_a11y', { n: i + 1, total: ORIENT110_INTRO_PAGES })}`}>
            <View style={styles.glassBox}>
              {pg.glass === 'mascot' ? <Mascot size={170} calm label={t(`orient110.${pg.key}_glass`)} /> : <Image source={GLASS[pg.glass]} style={styles.glass} resizeMode="contain" accessibilityLabel={t(`orient110.${pg.key}_glass`)} />}
            </View>
            <KText accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.pageTitle, { color: P.ink }]}>
              {t(`orient110.${pg.key}_title`)}
            </KText>
            <KText maxFontSizeMultiplier={1.5} style={[styles.pageBody, { color: P.sec }]}>
              {t(`orient110.${pg.key}_body`)}
            </KText>
          </View>
        ))}
      </ScrollView>
      <View style={[styles.introFoot, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.dots} accessible accessibilityLabel={t('orient110.page_a11y', { n: shown + 1, total: ORIENT110_INTRO_PAGES })}>
          {INTRO_PAGES.map((pg, i) => (
            <View key={pg.key} style={[styles.dot, i === shown ? [styles.dotOn, { backgroundColor: P.ink }] : { backgroundColor: P.ringTrack }]} />
          ))}
        </View>
        <KButton testID="orient110-intro-next" label={last ? t('orient110.start') : t('orient110.cont')} onPress={cont} />
      </View>
    </View>
  );
}

// ─── İpucu ────────────────────────────────────────────────────────────────────
function TipLayer({ tip, vitrin }: { tip: Orient110Tip; vitrin?: boolean }) {
  const target = useOrient110((s) => s.targets[tip]);
  const { width: W, height: H } = useWindowDimensions();
  const [hole, setHole] = useState<Hole | null>(null);
  useEffect(() => {
    setHole(null);
    if (!target) return;
    const id = setTimeout(
      () => {
        target.current?.measureInWindow((x, y, w, h) => {
          if (w > 0 && h > 0) setHole(holeFor(HOLE_SHAPE[tip], { x, y, w, h }, W));
        });
      },
      vitrin ? 0 : DURATION.base,
    );
    return () => clearTimeout(id);
  }, [target, tip, W, vitrin]);
  if (!hole) return null;
  return <Tip tip={tip} hole={hole} screen={{ w: W, h: H }} vitrin={!!vitrin} targetRef={target} />;
}

function Tip({ tip, hole, screen, vitrin, targetRef }: { tip: Orient110Tip; hole: Hole; screen: { w: number; h: number }; vitrin: boolean; targetRef?: React.RefObject<View | null> }) {
  const th = useTheme();
  const { t } = useT();
  const reduced = useReducedMotion();
  const next = useOrient110((s) => s.next);
  const skip = useOrient110((s) => s.skip);
  const homeVariant = useOrient110((s) => s.homeVariant);
  const available = useOrient110((s) => s.targets);
  const order = ORIENT110_TIPS.filter((x) => x === tip || available[x]);
  const n = Math.max(1, order.indexOf(tip) + 1);
  const total = Math.max(n, order.length);
  const last = n === total;
  const key = tip === 'home' ? (homeVariant === 'ring' ? 'home_ring' : 'home_card') : tip;
  const title = t(`orient110.t_${key}_title`);
  const body = t(`orient110.t_${key}_body`);
  const tipBg = th.isDark ? '#F5F5F5' : '#0A0A0A';
  const tipFg = th.isDark ? '#0A0A0A' : '#FFFFFF';
  const scrim = th.isDark ? 'rgba(0,0,0,0.62)' : 'rgba(10,10,10,0.5)';
  const place = placeTip(HOLE_SHAPE[tip], hole, screen);

  const so = useSharedValue(reduced ? 1 : 0);
  const to = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) {
      so.value = withTiming(1, { duration: DURATION.fast, easing: CURVE.enter });
      to.value = withDelay(DURATION.instant, withTiming(1, { duration: DURATION.base, easing: CURVE.enter }));
    }
    // VoiceOver: balon metni okunur, odak hedefe gider.
    AccessibilityInfo.announceForAccessibility(`${title}. ${body}`);
    let node: number | null = null;
    try {
      node = targetRef?.current ? findNodeHandle(targetRef.current as never) : null;
    } catch {
      node = null;
    }
    const id = node ? setTimeout(() => AccessibilityInfo.setAccessibilityFocus(node), DURATION.slow) : undefined;
    return () => {
      if (id) clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: so.value }));
  const tipStyle = useAnimatedStyle(() => ({ opacity: to.value, transform: [{ translateY: reduced ? 0 : 6 * (1 - to.value) }] }));

  const close = (then: () => void) => {
    haptic('selection');
    if (vitrin) return;
    if (reduced) {
      then();
      return;
    }
    so.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.exit });
    to.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.exit });
    setTimeout(then, DURATION.fast);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} testID={`orient110-tip-${tip}`}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]} pointerEvents="none">
        <Svg width={screen.w} height={screen.h}>
          <Path d={scrimPath(screen, hole)} fill={scrim} fillRule="evenodd" />
        </Svg>
      </Animated.View>
      {/* Örtü dokunuşu yutar (seçim balondan). */}
      <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => {}} />
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${t('orient110.tip_a11y', { n, total })}. ${title}. ${body}`}
        style={[styles.tip, { backgroundColor: tipBg, left: place.left }, place.above ? { bottom: place.bottom } : { top: place.top }, tipStyle]}
      >
        <AppText maxFontSizeMultiplier={1.4} style={[styles.title, { color: tipFg }]} testID="orient110-tip-title">
          {title}
        </AppText>
        <AppText maxFontSizeMultiplier={1.5} style={[styles.body, { color: tipFg }]}>
          {body}
        </AppText>
        <View style={styles.foot}>
          <AppText maxFontSizeMultiplier={1.3} style={[styles.count, { color: tipFg }]}>
            {`${n}/${total}`}
          </AppText>
          <View style={styles.actions}>
            {!last ? (
              <Pressable onPress={() => close(skip)} accessibilityRole="button" accessibilityLabel={t('orient110.skip')} style={styles.act} testID="orient110-tip-skip">
                <AppText maxFontSizeMultiplier={1.3} style={[styles.skip, { color: tipFg }]}>
                  {t('orient110.skip')}
                </AppText>
              </Pressable>
            ) : null}
            <Pressable onPress={() => close(next)} accessibilityRole="button" accessibilityLabel={last ? t('orient110.done') : t('orient110.next')} style={styles.act} testID="orient110-tip-next">
              <AppText maxFontSizeMultiplier={1.3} style={[styles.next, { color: tipFg }]}>
                {last ? t('orient110.done') : t('orient110.next')}
              </AppText>
            </Pressable>
          </View>
        </View>
        <View pointerEvents="none" style={[styles.arrow, { backgroundColor: tipBg, left: place.arrowLeft }, place.above ? { bottom: -ARROW / 2 } : { top: -ARROW / 2 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 1000, elevation: 1000 },
  introTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  kickerText: { fontFamily: FONT.semi, fontSize: 16, lineHeight: 21, flexShrink: 1 },
  skipBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontFamily: FONT.semi, fontSize: 16, lineHeight: 21 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  glassBox: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  glass: { width: 200, height: 200 },
  pageTitle: { fontFamily: FONT.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, textAlign: 'center' },
  pageBody: { fontFamily: FONT.body, fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 12, maxWidth: 360 },
  introFoot: { paddingHorizontal: 20, gap: 18 },
  dots: { flexDirection: 'row', alignSelf: 'center', gap: 8, minHeight: 12, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
  tip: { position: 'absolute', width: TIP_W, paddingTop: 12, paddingRight: 8, paddingBottom: 4, paddingLeft: 14, borderRadius: 18, gap: 2, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  title: { fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_700Bold' },
  body: { fontSize: 13, lineHeight: 18, opacity: 0.78, paddingRight: 6 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 13, lineHeight: 18, opacity: 0.7 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  act: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  skip: { fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans_600SemiBold' },
  next: { fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans_700Bold', textDecorationLine: 'underline' },
  arrow: { position: 'absolute', width: ARROW, height: ARROW, borderRadius: 2, transform: [{ rotate: '45deg' }] },
});

void REDUCED;
