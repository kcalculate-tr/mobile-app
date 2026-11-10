import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useFonts } from 'expo-font';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  AppText,
  bricolageFonts,
  DailyRing,
  GlassObject,
  GlassTabBar,
  GlowDot,
  LogPill,
  LogTrail,
  NumberRoll,
  ProgressRing,
  ReducedMotionProvider,
  StreakMoment,
  Toast,
  ThemeProvider,
  useEnter,
  useFloat,
  usePop,
  useSpringTo,
  useReducedMotion,
  useTheme,
  MOTION_MAP,
  haptic,
  DURATION,
  CURVE,
  REDUCED,
  type MotionMapRow,
  type ColorScheme,
} from '../core/design';
import { SCROLL_KEYBOARD } from '../core/design/keyboard';

/**
 * Tasarım vitrini — YALNIZ __DEV__.
 *
 * Yeni tasarım temelinin tüm parçalarını açık/koyu ve azaltılmış hareketle
 * denemek için. G3-S3 ile hareket motoru Reanimated'a taşındı; bu vitrin her
 * hareketi tek tek tetikleyen düğmeler sunar. Hiçbir üretim ekranına bağlı
 * değil; AppNavigator'da ekran kaydı __DEV__ ile koşullu. Bricolage fontları
 * burada (açılışta değil) yüklenir — üretim açılış süresi etkilenmez.
 */
export default function DesignShowcaseScreen() {
  const [fontsLoaded] = useFonts(bricolageFonts);
  const [scheme, setScheme] = useState<ColorScheme>('light');
  const [reduced, setReduced] = useState(false);

  return (
    <ThemeProvider forceScheme={scheme}>
      <ReducedMotionProvider value={reduced}>
        <ShowcaseBody
          scheme={scheme}
          setScheme={setScheme}
          reduced={reduced}
          setReduced={setReduced}
          fontsLoaded={fontsLoaded}
        />
      </ReducedMotionProvider>
    </ThemeProvider>
  );
}

function ShowcaseBody({
  scheme,
  setScheme,
  reduced,
  setReduced,
  fontsLoaded,
}: {
  scheme: ColorScheme;
  setScheme: (s: ColorScheme) => void;
  reduced: boolean;
  setReduced: (b: boolean) => void;
  fontsLoaded: boolean;
}) {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [toastVisible, setToastVisible] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const steps = [0.25, 0.5, 0.75, 1];

  // Tek tek tetiklenen UI-thread hareketleri (playToken artınca yeniden oynar).
  const [logToken, setLogToken] = useState(0);
  const [streakToken, setStreakToken] = useState(0);
  const [ringToken, setRingToken] = useState(0);
  const [glassKey, setGlassKey] = useState(0);
  const [kcal, setKcal] = useState(1240);

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={styles.content}>
        <AppText variant="display">Tasarım vitrini</AppText>
        <AppText variant="caption" tone="secondary" style={styles.sub}>
          Yalnız geliştirme · Reanimated hareket motoru
          {fontsLoaded ? '' : ' · (Bricolage yükleniyor…)'}
        </AppText>

        {/* G5-S3 veri katmanı deneme ekranı — yalnız __DEV__ */}
        <Panel>
          <AppText variant="caption" tone="secondary">VERİ KATMANI</AppText>
          <Chip
            label="Keşfet ve profil (veri) →"
            active
            onPress={() => navigation.navigate('FeedDataLab')}
          />
        </Panel>

        {/* G11-S2 — bayraklar + geliştirici ekranları (Tanı → "Yeni uygulamayı aç"). */}
        <Panel>
          <AppText variant="caption" tone="secondary">GELİŞTİRİCİ</AppText>
          <Chip
            label="Bayraklar ve geliştirici ekranları →"
            active
            onPress={() => navigation.navigate('DevDiagnostics')}
          />
        </Panel>

        {/* Kontroller */}
        <Panel>
          <AppText variant="heading">Tema</AppText>
          <View style={styles.rowWrap}>
            <Chip label="Açık" active={scheme === 'light'} onPress={() => setScheme('light')} />
            <Chip label="Koyu" active={scheme === 'dark'} onPress={() => setScheme('dark')} />
          </View>
          <AppText variant="heading" style={styles.gap}>
            Hareket
          </AppText>
          <View style={styles.rowWrap}>
            <Chip label="Tam" active={!reduced} onPress={() => setReduced(false)} />
            <Chip label="Azaltılmış" active={reduced} onPress={() => setReduced(true)} />
          </View>
        </Panel>

        {/* Yazı ölçeği */}
        <Panel>
          <AppText variant="caption" tone="secondary">YAZI ÖLÇEĞİ</AppText>
          <AppText variant="display">Display</AppText>
          <AppText variant="title">Title</AppText>
          <AppText variant="heading">Heading</AppText>
          <AppText variant="body">Body — Plus Jakarta Sans gövde metni, okunaklı.</AppText>
          <AppText variant="caption" tone="secondary">Caption — ikincil bilgi</AppText>
        </Panel>

        {/* Hareket motoru hook demoları */}
        <Panel>
          <AppText variant="caption" tone="secondary">HAREKET MOTORU (hook'lar)</AppText>
          <EnterDemo />
          <PopDemo />
          <SpringToDemo />
          <FloatDemo />
        </Panel>

        {/* LogPill */}
        <Panel>
          <AppText variant="caption" tone="secondary">LOGPILL</AppText>
          <AppText variant="caption" tone="secondary" style={styles.note}>
            Dokun: logla (light haptik) · ⌄: seçenekler · uzun bas: öğün seç
          </AppText>
          <LogPill
            label="Izgara tavuk · 320 kcal"
            caption="1 porsiyon"
            onLog={() => setToastVisible(true)}
            onExpand={() => {}}
            onLongPress={() => {}}
          />
        </Panel>

        {/* Toast */}
        <Panel>
          <AppText variant="caption" tone="secondary">TOAST</AppText>
          <Chip label="Toast göster" active onPress={() => setToastVisible(true)} />
        </Panel>

        {/* ProgressRing */}
        <Panel>
          <AppText variant="caption" tone="secondary">PROGRESSRING (UI thread)</AppText>
          <View style={styles.center}>
            <ProgressRing progress={steps[progressStep]}>
              <AppText variant="title">{Math.round(steps[progressStep] * 100)}%</AppText>
              <AppText variant="caption" tone="secondary">günlük</AppText>
            </ProgressRing>
          </View>
          <Chip
            label="İlerlet"
            active
            onPress={() => setProgressStep((s) => (s + 1) % steps.length)}
          />
        </Panel>

        {/* GlowDot */}
        <Panel>
          <AppText variant="caption" tone="secondary">GLOWDOT (yükleniyor)</AppText>
          <View style={styles.center}>
            <GlowDot size={14} />
          </View>
        </Panel>

        {/* GlassObject + ışık süpürmesi */}
        <Panel>
          <AppText variant="caption" tone="secondary">GLASSOBJECT (giriş + ışık süpürmesi + iç parıltı)</AppText>
          <View style={styles.center}>
            <GlassObject key={glassKey} size={140} />
          </View>
          <Chip label="Tekrar (giriş + süpürme)" active onPress={() => setGlassKey((k) => k + 1)} />
        </Panel>

        {/* LogTrail */}
        <Panel>
          <AppText variant="caption" tone="secondary">LOGLA İZİ (öğe → nokta, yay çizerek hedefe)</AppText>
          <View style={styles.center}>
            <LogTrail playToken={logToken} />
          </View>
          <Chip label="Öğle'ye logla" active onPress={() => setLogToken((n) => n + 1)} />
        </Panel>

        {/* DailyRing */}
        <Panel>
          <AppText variant="caption" tone="secondary">GÜNLÜK HALKA (tek çizgi üçe ayrılır)</AppText>
          <View style={styles.center}>
            <DailyRing playToken={ringToken} />
          </View>
          <Chip label="Ayır" active onPress={() => setRingToken((n) => n + 1)} />
        </Panel>

        {/* StreakMoment */}
        <Panel>
          <AppText variant="caption" tone="secondary">SERİ ANI ("7" tek çizgi → halka, hero + success)</AppText>
          <View style={styles.center}>
            <StreakMoment playToken={streakToken} />
          </View>
          <Chip label="Seri anı" active onPress={() => setStreakToken((n) => n + 1)} />
        </Panel>

        {/* NumberRoll */}
        <Panel>
          <AppText variant="caption" tone="secondary">SAYI DEĞİŞİMI</AppText>
          <View style={styles.center}>
            <NumberRoll value={`${kcal} kcal`} />
          </View>
          <View style={styles.rowWrap}>
            <Chip label="+180" active onPress={() => setKcal((k) => k + 180)} />
            <Chip label="−90" active onPress={() => setKcal((k) => Math.max(0, k - 90))} />
          </View>
        </Panel>

        {/* GlassTabBar */}
        <Panel>
          <AppText variant="caption" tone="secondary">GLASSTABBAR (expo-blur · yalnız vitrin)</AppText>
          <AppText variant="caption" tone="secondary" style={styles.note}>
            Sekme değiştir: lime nokta kurdeleye uzayıp hedefe varır.
          </AppText>
          <View style={{ paddingVertical: 8 }}>
            <GlassTabBar />
          </View>
        </Panel>

        {/* Hareket haritası (FinMoMap) — her satırı tetikleyen düğmeler */}
        <Panel>
          <AppText variant="caption" tone="secondary">HAREKET HARİTASI (FinMoMap)</AppText>
          <AppText variant="caption" tone="secondary" style={styles.note}>
            Her satır token adıyla; düğme ilgili hareketi + haptiği tetikler.
          </AppText>
          <MotionMapSection
            onToast={() => {
              setToastVisible(true);
              setTimeout(() => setToastVisible(false), 2600);
            }}
          />
        </Panel>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Toast en üstte, mutlak konumda */}
      <View style={styles.toastHost} pointerEvents="box-none">
        <Toast
          visible={toastVisible}
          message="Öğle'ye loglandı"
          onUndo={() => setToastVisible(false)}
          onView={() => setToastVisible(false)}
          onDismiss={() => setToastVisible(false)}
        />
      </View>
    </View>
  );
}

function EnterDemo() {
  const enter = useEnter();
  const t = useTheme();
  return (
    <View style={styles.demoRow}>
      <Animated.View
        style={[
          enter.style,
          styles.demoBox,
          { backgroundColor: t.color.accent, borderRadius: t.radius.md },
        ]}
      >
        <AppText variant="heading" tone="onAccent">
          Giriş
        </AppText>
      </Animated.View>
      <Chip label="Tekrar oynat" active onPress={enter.play} />
    </View>
  );
}

function PopDemo() {
  const { style, pop } = usePop();
  const t = useTheme();
  return (
    <View style={styles.demoRow}>
      <Animated.View
        style={[
          style,
          styles.demoBox,
          { backgroundColor: t.color.surfaceRaised, borderColor: t.color.line, borderWidth: 1, borderRadius: t.radius.md },
        ]}
      >
        <AppText variant="heading">Pop 🎉</AppText>
      </Animated.View>
      <Chip label="Kutla (success)" active onPress={pop} />
    </View>
  );
}

function SpringToDemo() {
  const { style, springTo } = useSpringTo();
  const t = useTheme();
  const [out, setOut] = useState(false);
  return (
    <View style={styles.demoRow}>
      <View style={styles.springTrack}>
        <Animated.View
          style={[
            style,
            styles.springBox,
            { backgroundColor: t.color.accent, borderRadius: t.radius.sm },
          ]}
        />
      </View>
      <Chip
        label="Yay ile fırlat"
        active
        onPress={() => {
          const next = !out;
          setOut(next);
          springTo({ x: next ? 120 : 0, y: 0 });
        }}
      />
    </View>
  );
}

function FloatDemo() {
  const floatA = useFloat({ tilt: true });
  const t = useTheme();
  return (
    <View style={styles.demoRow}>
      <Animated.View
        style={[
          floatA.style,
          styles.demoBox,
          { backgroundColor: t.color.surfaceRaised, borderColor: t.color.line, borderWidth: 1, borderRadius: t.radius.md },
        ]}
      >
        <AppText variant="caption" tone="secondary">Süzülme</AppText>
      </Animated.View>
      <AppText variant="caption" tone="secondary">sürekli (±4 px, ±2°)</AppText>
    </View>
  );
}

// Preview kutusuna her FinMoMap satırını yaklaşık canlandırır (dev referansı).
const MOTION_KIND: Record<string, 'x' | 'y' | 'scale' | 'opacity'> = {
  tab: 'x',
  jelly: 'x',
  push: 'x',
  pop: 'x',
  sheetAi: 'y',
  sheetEat: 'y',
  modal: 'y',
  toast: 'y',
  tabbar: 'scale',
  header: 'scale',
  skeleton: 'opacity',
  listAdd: 'y',
};

function motionDuration(token: string): number {
  if (token.includes('slow 500')) return DURATION.slow;
  if (token.includes('fast 200')) return DURATION.fast;
  if (token.includes('story 900')) return DURATION.story;
  return DURATION.base;
}

function MotionMapSection({ onToast }: { onToast: () => void }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const [kind, setKind] = useState<'x' | 'y' | 'scale' | 'opacity'>('x');
  const [jelly, setJelly] = useState(false);

  const play = (row: MotionMapRow) => {
    if (row.haptic) haptic(row.haptic);
    if (row.id === 'toast') {
      onToast();
      return;
    }
    setKind(MOTION_KIND[row.id] ?? 'opacity');
    setJelly(row.id === 'jelly');
    const d = reduced ? REDUCED.duration : motionDuration(row.token);
    p.value = 0;
    p.value = withSequence(
      withTiming(1, { duration: d, easing: CURVE.enter }),
      withTiming(0, { duration: Math.round(d * 0.8), easing: CURVE.exit }),
    );
  };

  const previewStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: interpolate(p.value, [0, 1], [0.4, 1]) };
    switch (kind) {
      case 'x': {
        const sx = jelly ? interpolate(p.value, [0, 0.5, 1], [1, 1.6, 1]) : 1;
        return { opacity: 1, transform: [{ translateX: interpolate(p.value, [0, 1], [0, 56]) }, { scaleX: sx }] };
      }
      case 'y':
        return { opacity: interpolate(p.value, [0, 1], [0.4, 1]), transform: [{ translateY: interpolate(p.value, [0, 1], [36, 0]) }] };
      case 'scale':
        return { opacity: 1, transform: [{ scale: interpolate(p.value, [0, 1], [0.6, 1]) }] };
      default:
        return { opacity: interpolate(p.value, [0, 1], [0.25, 1]) };
    }
  });

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.center}>
        <Animated.View style={[styles.motionPreview, { backgroundColor: t.color.accent }, previewStyle]} />
      </View>
      {MOTION_MAP.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => play(row)}
          style={[styles.motionRow, { borderColor: t.color.line }]}
          accessibilityRole="button"
          accessibilityLabel={`${row.label} — ${row.token}`}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="body">{row.label}</AppText>
            <AppText variant="caption" tone="secondary">{row.token}</AppText>
            <AppText variant="caption" tone="secondary">
              azalt: {row.reduced}
              {row.haptic ? ` · haptik: ${row.haptic}` : ''}
            </AppText>
          </View>
          <View style={[styles.playChip, { backgroundColor: t.color.ink }]}>
            <AppText variant="caption" style={{ color: t.color.surface }}>
              Oynat
            </AppText>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: t.color.surface,
          borderColor: t.color.line,
          borderRadius: t.radius.lg,
        },
      ]}
    >
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? t.color.accent : 'transparent',
          borderColor: active ? t.color.accent : t.color.line,
          borderRadius: t.radius.pill,
        },
      ]}
      accessibilityRole="button"
    >
      <AppText variant="caption" tone={active ? 'onAccent' : 'ink'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 56, gap: 14 },
  sub: { marginTop: -6 },
  gap: { marginTop: 8 },
  panel: { padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { marginBottom: 2 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  demoBox: {
    width: 96,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  springTrack: { width: 160, height: 44, justifyContent: 'center' },
  springBox: { width: 40, height: 40 },
  toastHost: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
  },
  motionPreview: { width: 52, height: 52, borderRadius: 16 },
  motionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  playChip: {
    minHeight: 36,
    minWidth: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
