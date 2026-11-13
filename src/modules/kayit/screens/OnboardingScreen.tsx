// G42-S1 md.2 — Yeni onboarding: 5 ekran, OBS bileşenine birebir (docs/tur27/onboarding/project/OBS.dc.html).
// Konumlar OBS'nin 393×852 çerçevesinden ekrana ölçeklenir (x → W/393, y → H/852); yazılar Dynamic Type ile
// büyür (tavanlı). Beş sahne tek yatay panorama: Devam → sola kayma (450 ms), zemin rengi panellerle geçer;
// maskot AYRI katmanda M tablosuna göre süzülerek yer değiştirir; sürekli süzülme + 4–6 sn göz kırpma;
// azaltılmış harekette sabit (geçiş 220 ms opaklık). Atla yok; sistem geri hareketi bir önceki ekrana döner;
// uygulama kapatılıp açılınca kaldığı ekrandan devam. 5. ekranda başlangıç kartları + "Beslenme profilini"
// segmenti (Şimdi = A, Sonra = B; `kisisel_plan` kapalıysa segment gizli, herkes B).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AppText, CURVE, DURATION, REDUCED, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useFeature } from '../../../core/flags';
import { Mascot, FONT } from '../ui/parts';
import { useEdgeBack } from '../ui/edge';
import { K_MOTION } from '../ui/theme';
import { resolvePath, type KPath, type KStart } from '../model';
import { readOnb, writeOnb } from '../storage';
import { kv, useKayit } from '../store';
import { kTrack } from '../events';

/* eslint-disable @typescript-eslint/no-require-imports */
const BG = {
  1: require('../../../../assets/onboarding/sahne-1.webp'),
  2: require('../../../../assets/onboarding/sahne-2.webp'),
  3: { tr: require('../../../../assets/onboarding/sahne-3-tr.webp'), en: require('../../../../assets/onboarding/sahne-3-en.webp') },
  4: { tr: require('../../../../assets/onboarding/sahne-4-tr.webp'), en: require('../../../../assets/onboarding/sahne-4-en.webp') },
  5: require('../../../../assets/onboarding/sahne-5.webp'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const FW = 393;
const FH = 852;
/** OBS FILL tablosu (2–4 yatay degrade). */
const FILL: Record<number, string[]> = {
  1: ['#0D2617', '#0D2617'],
  2: ['#FECCAA', '#FED9BD', '#FFCFAB'],
  3: ['#FCCEB0', '#FDD8C1', '#FFD7BB'],
  4: ['#FDD9B8', '#FDE2C9', '#FED6B4'],
  5: ['#0D2617', '#0D2617'],
};
/** OBS M tablosu: [x, y, boyut] (393×852 çerçevesinde SVG kutusu; yükseklik boyut × 1,25). */
export const MASCOT_POS: Record<number, [number, number, number]> = { 1: [120, 201, 150], 2: [30, 636, 72], 3: [14, 318, 64], 4: [300, 346, 66], 5: [300, 150, 66] };
const CHIPS: Array<[number, number]> = [
  [79, 596],
  [196, 563],
  [312, 596],
];
const CARD_Y = [258, 367, 473];
const STARTS: readonly KStart[] = ['track', 'recipes', 'community'];
// Kart ikonları (kamera · çanta · topluluk küreleri) sahne-5 görseline gömülü (OBS kartı padding-left 92).

export default function OnboardingScreen({ vitrinStep }: { /** YALNIZ geliştirme vitrini. */ vitrinStep?: number } = {}) {
  const { t, lang } = useT();
  const L = (lang === 'en' ? 'en' : 'tr') as 'tr' | 'en';
  const { width: W, height: H } = useWindowDimensions();
  const sx = W / FW;
  const sy = H / FH;
  const reduced = useReducedMotion();
  const navigation = useNavigation<any>();
  const kisiselPlan = useFeature('kisisel_plan');
  const [step, setStep] = useState(__DEV__ && vitrinStep ? vitrinStep : 1);
  const [start, setStartLocal] = useState<KStart | null>(null);
  const [choice, setChoice] = useState<KPath>('a');
  const hydrated = useRef(!!(__DEV__ && vitrinStep));
  const pan = useSharedValue(-(step - 1) * W);
  const fade = useSharedValue(1);
  const m = useSharedValue(0);

  // Kaldığı yerden devam.
  useEffect(() => {
    if (hydrated.current) return;
    void readOnb(kv).then((s) => {
      hydrated.current = true;
      if (!s) return;
      setStep(s.step);
      setStartLocal(s.start);
      setChoice(s.path);
      pan.value = -(s.step - 1) * W;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    kTrack.onbStep(step, L);
    if (hydrated.current) void writeOnb(kv, { step, start, path: choice });
    if (reduced) {
      pan.value = -(step - 1) * W;
      fade.value = 0.3;
      fade.value = withTiming(1, { duration: REDUCED.duration });
    } else {
      pan.value = withTiming(-(step - 1) * W, { duration: K_MOTION.pan, easing: CURVE.standard });
    }
    m.value = withTiming(step, { duration: reduced ? 0 : K_MOTION.pan, easing: CURVE.standard });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, W]);

  useEffect(() => {
    if (hydrated.current) void writeOnb(kv, { step, start, path: choice });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, choice]);

  const back = step > 1 ? () => setStep((s) => Math.max(1, s - 1)) : null;
  const edge = useEdgeBack(back, W);

  const panStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateX: pan.value }] }));
  // Maskot konumu adımlar arasında süzülerek (ara değer interpolasyonu JS tablosundan).
  const pos = useMemo(() => [1, 2, 3, 4, 5].map((s) => MASCOT_POS[s]), []);
  const mascotStyle = useAnimatedStyle(() => {
    const v = Math.min(5, Math.max(1, m.value));
    const i = Math.min(3, Math.floor(v - 1));
    const f = v - 1 - i;
    const a = pos[i];
    const b = pos[i + 1];
    const x = a[0] + (b[0] - a[0]) * f;
    const y = a[1] + (b[1] - a[1]) * f;
    const s = a[2] + (b[2] - a[2]) * f;
    return { left: (x + s * 0.04) * sx, top: (y + s * 0.156) * sy, width: s * 0.92 * sx, height: s * 0.92 * sx };
  });

  const next = () => {
    haptic('light');
    if (step < 5) {
      setStep(step + 1);
      return;
    }
    const path = resolvePath(choice, kisiselPlan);
    const st = start ?? 'track';
    kTrack.pathChoice(path, st);
    const k = useKayit.getState();
    k.reset(k.answers.units);
    k.setPath(path);
    k.setStart(st);
    navigation.navigate(path === 'a' ? 'KQuestions' : 'KSignup', path === 'a' ? undefined : { path: 'b' });
  };

  const dark = step === 1 || step === 5;
  const tx = t(`kayit.onb.s${step}.a`);
  const em = t(`kayit.onb.s${step}.em`);
  const tb = t(`kayit.onb.s${step}.b`);
  const sub = t(`kayit.onb.s${step}.sub`);
  const fs = step === 1 ? 36 : step === 4 ? 30 : 34;
  const titleTop = step === 1 ? undefined : (step === 4 ? 84 : 104) * sy;
  const btnB = (step === 4 ? 20 : 40) * sy;
  const btnH = step === 4 ? 52 : 58;

  return (
    <View style={styles.root} {...edge} testID="kayit-onb">
      <StatusBar style={dark ? 'light' : 'dark'} />
      {/* Panorama: 5 panel yan yana */}
      <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: W * 5, flexDirection: 'row' }, panStyle]} importantForAccessibility="no-hide-descendants">
        {[1, 2, 3, 4, 5].map((s) => (
          <Panel key={s} s={s} W={W} H={H} sy={sy} lang={L} />
        ))}
      </Animated.View>

      {/* Sayfa noktaları (1–4) */}
      {step <= 4 ? (
        <View accessible accessibilityRole="image" accessibilityLabel={t('kayit.onb.dots', { step })} style={[styles.dots, { top: (step === 4 ? 56 : 62) * sy }]}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? (dark ? '#B9EF14' : '#10301D') : dark ? 'rgba(255,255,255,0.35)' : 'rgba(16,48,29,0.25)' }} />
          ))}
        </View>
      ) : null}

      {/* 2. ekran: Çek / Anlat / Sor çipleri */}
      {step === 2
        ? CHIPS.map(([x, y], i) => (
            <View key={i} style={[styles.chip, { left: x * sx, top: y * sy }]}>
              <AppText maxFontSizeMultiplier={1.3} style={styles.chipText}>
                {t(['kayit.onb.chip_snap', 'kayit.onb.chip_describe', 'kayit.onb.chip_ask'][i])}
              </AppText>
            </View>
          ))
        : null}

      {/* 5. ekran: başlangıç kartları + segment + Devam + Giriş yap */}
      {step === 5 ? (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('kayit.onb.start_group')} style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {STARTS.map((k, i) => {
              const on = start === k;
              return (
                <Pressable
                  key={k}
                  testID={`kayit-start-${k}`}
                  onPress={() => {
                    haptic('selection');
                    setStartLocal(k);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${t(`kayit.onb.card_${k}`)}, ${t(`kayit.onb.card_${k}_sub`)}`}
                  style={[
                    styles.card,
                    { top: CARD_Y[i] * sy, minHeight: 84 * Math.min(1, sy), borderColor: on ? '#B9EF14' : 'rgba(185,239,20,0.3)', borderWidth: on ? 2.5 : 1.5, backgroundColor: on ? 'rgba(185,239,20,0.14)' : 'rgba(255,255,255,0.06)' },
                  ]}
                >
                  <AppText maxFontSizeMultiplier={1.3} style={styles.cardTitle}>
                    {t(`kayit.onb.card_${k}`)}
                  </AppText>
                  <AppText maxFontSizeMultiplier={1.3} style={styles.cardSub}>
                    {t(`kayit.onb.card_${k}_sub`)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {kisiselPlan ? (
            <>
              <AppText nativeID="ob-profile-label" maxFontSizeMultiplier={1.3} style={[styles.segLabel, { top: 622 * sy }]}>
                {t('kayit.onb.seg_label')}
              </AppText>
              <SegmentOnDark top={646 * sy} value={choice} onChange={setChoice} labelNow={t('kayit.onb.seg_now')} labelLater={t('kayit.onb.seg_later')} group={t('kayit.onb.seg_label')} />
            </>
          ) : null}
          <Pressable testID="kayit-onb-next" onPress={next} accessibilityRole="button" accessibilityLabel={t('kayit.onb.next')} style={[styles.next, { bottom: 84 * sy, height: 56, borderRadius: 28 }]}>
            <AppText maxFontSizeMultiplier={1.3} style={styles.nextText}>
              {t('kayit.onb.next')}
            </AppText>
          </Pressable>
          <View style={[styles.loginRow, { bottom: 40 * sy - 12 }]}>
            <AppText maxFontSizeMultiplier={1.3} style={styles.loginQ}>
              {t('kayit.onb.login_q')}
            </AppText>
            <Pressable testID="kayit-onb-login" onPress={() => navigation.getParent()?.navigate('Login')} accessibilityRole="link" accessibilityLabel={t('kayit.onb.login_a')} style={styles.loginBtn}>
              <AppText maxFontSizeMultiplier={1.3} style={styles.loginA}>
                {t('kayit.onb.login_a')}
              </AppText>
            </Pressable>
          </View>
        </>
      ) : null}

      {/* Maskot katmanı */}
      <Animated.View pointerEvents="none" style={[styles.mascot, mascotStyle]}>
        <Mascot fill />
      </Animated.View>

      {/* Başlık + alt metin */}
      <View
        pointerEvents="none"
        style={[
          styles.textBlock,
          step === 1 ? { bottom: 128 * sy, alignItems: 'center' } : { top: titleTop, alignItems: 'flex-start' },
        ]}
      >
        <AppText
          accessibilityRole="header"
          maxFontSizeMultiplier={1.2}
          style={[
            styles.title,
            { fontSize: fs, lineHeight: fs * 1.06, color: dark ? '#FFFFFF' : '#10301D', textAlign: step === 1 ? 'center' : 'left' },
            dark ? styles.darkShadow : null,
          ]}
        >
          {tx}
          <AppText style={dark ? { color: '#C4F530' } : { backgroundColor: '#B9EF14' }}>{dark ? em : ` ${em.trim()} `}</AppText>
          {tb}
        </AppText>
        {sub ? (
          <AppText maxFontSizeMultiplier={1.3} style={[styles.sub, { color: dark ? 'rgba(255,255,255,0.86)' : 'rgba(16,48,29,0.8)', textAlign: step === 1 ? 'center' : 'left' }, dark ? styles.darkShadow : null]}>
            {sub}
          </AppText>
        ) : null}
      </View>

      {/* Devam (1–4) */}
      {step <= 4 ? (
        <Pressable testID="kayit-onb-next" onPress={next} accessibilityRole="button" accessibilityLabel={t('kayit.onb.next')} style={[styles.next, { bottom: btnB, height: btnH, borderRadius: btnH / 2 }]}>
          <AppText maxFontSizeMultiplier={1.3} style={styles.nextText}>
            {t('kayit.onb.next')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function Panel({ s, W, H, sy, lang }: { s: number; W: number; H: number; sy: number; lang: 'tr' | 'en' }) {
  const src = s === 3 || s === 4 ? (BG[s] as { tr: number; en: number })[lang] : (BG[s as 1 | 2 | 5] as number);
  const wide = s === 2 || s === 3;
  const imgH = wide ? (W * 2147) / 1290 : (W * 2796) / 1290;
  const top = wide ? H - imgH : s === 4 ? 96 * sy : 0;
  const fill = FILL[s];
  const mid = fill[Math.floor(fill.length / 2)];
  return (
    <View style={{ width: W, height: H, overflow: 'hidden' }}>
      <LinearGradient colors={fill as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <Image source={src} style={{ position: 'absolute', left: 0, top, width: W, height: imgH }} resizeMode="cover" />
      {wide || s === 4 ? (
        // OBS maskesi: görselin üst 40 pt'si FILL'e erir.
        <LinearGradient colors={[mid, `${mid}00`]} style={{ position: 'absolute', left: 0, right: 0, top, height: 40 }} />
      ) : null}
    </View>
  );
}

function SegmentOnDark({ top, value, onChange, labelNow, labelLater, group }: { top: number; value: KPath; onChange: (v: KPath) => void; labelNow: string; labelLater: string; group: string }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(value === 'a' ? 0 : 1);
  useEffect(() => {
    x.value = reduced ? (value === 'a' ? 0 : 1) : withTiming(value === 'a' ? 0 : 1, { duration: DURATION.fast });
  }, [value, reduced, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 128 }] }));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={group} style={[styles.seg, { top }]}>
      <Animated.View style={[styles.segThumb, thumb]} />
      {(['a', 'b'] as const).map((k) => {
        const on = value === k;
        return (
          <Pressable
            key={k}
            testID={`kayit-seg-${k}`}
            onPress={() => {
              if (!on) haptic('selection');
              onChange(k);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={k === 'a' ? labelNow : labelLater}
            style={styles.segBtn}
          >
            <AppText maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.segText, { color: on ? '#10301D' : '#FFFFFF' }]}>
              {k === 'a' ? labelNow : labelLater}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D2617', overflow: 'hidden' },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  chip: { position: 'absolute', transform: [{ translateX: -40 }], minWidth: 80, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 15, borderRadius: 999, backgroundColor: '#FFFFFF', shadowColor: '#10301D', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } },
  chipText: { fontFamily: FONT.bold, fontSize: 14, color: '#10301D' },
  card: { position: 'absolute', left: 24, right: 24, borderRadius: 24, paddingLeft: 92, paddingRight: 18, paddingVertical: 12, justifyContent: 'center', gap: 3 },
  cardTitle: { fontFamily: FONT.bold, fontSize: 18, color: '#FFFFFF' },
  cardSub: { fontFamily: FONT.body, fontSize: 14, color: 'rgba(255,255,255,0.78)' },
  segLabel: { position: 'absolute', left: 24, right: 24, textAlign: 'center', fontFamily: FONT.semi, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  seg: { position: 'absolute', alignSelf: 'center', left: '50%', marginLeft: -132, width: 264, height: 44, padding: 4, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row' },
  segThumb: { position: 'absolute', top: 4, bottom: 4, left: 4, width: 128, borderRadius: 18, backgroundColor: '#B9EF14' },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  segText: { fontFamily: FONT.bold, fontSize: 14 },
  next: { position: 'absolute', left: 24, right: 24, backgroundColor: '#B9EF14', alignItems: 'center', justifyContent: 'center', shadowColor: '#0A1E0A', shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 14 } },
  nextText: { fontFamily: FONT.bold, fontSize: 17, color: '#10301D' },
  loginRow: { position: 'absolute', left: 24, right: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  loginQ: { fontFamily: FONT.body, fontSize: 15, color: 'rgba(255,255,255,0.82)' },
  loginBtn: { minHeight: 44, justifyContent: 'center' },
  loginA: { fontFamily: FONT.bold, fontSize: 15, color: '#B9EF14', textDecorationLine: 'underline' },
  mascot: { position: 'absolute' },
  textBlock: { position: 'absolute', left: 28, right: 28, gap: 12 },
  title: { fontFamily: FONT.display, letterSpacing: -1 },
  sub: { fontFamily: FONT.body, fontSize: 16, lineHeight: 23, maxWidth: 330 },
  darkShadow: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 2 } },
});
