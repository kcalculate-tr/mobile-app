import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFonts } from 'expo-font';
import {
  AppText,
  bricolageFonts,
  GlassObject,
  GlowDot,
  LogPill,
  ProgressRing,
  ReducedMotionProvider,
  Toast,
  ThemeProvider,
  useEnter,
  usePop,
  useTheme,
  type ColorScheme,
} from '../core/design';

/**
 * Tasarım vitrini — YALNIZ __DEV__.
 *
 * Yeni tasarım temelinin tüm parçalarını açık/koyu ve azaltılmış hareketle
 * denemek için. Hiçbir üretim ekranına bağlı değil; AppNavigator'da ekran
 * kaydı __DEV__ ile koşullu. Bricolage fontları burada (açılışta değil)
 * yüklenir — üretim açılış süresi etkilenmez.
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
  const [toastVisible, setToastVisible] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const steps = [0.25, 0.5, 0.75, 1];

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="display">Tasarım vitrini</AppText>
        <AppText variant="caption" tone="secondary" style={styles.sub}>
          Yalnız geliştirme · temel bileşenler ve hareket
          {fontsLoaded ? '' : ' · (Bricolage yükleniyor…)'}
        </AppText>

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
          <AppText variant="caption" tone="secondary">PROGRESSRING</AppText>
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

        {/* GlassObject */}
        <Panel>
          <AppText variant="caption" tone="secondary">GLASSOBJECT (süzülme + eğim + giriş)</AppText>
          <View style={styles.center}>
            <GlassObject size={140} />
          </View>
        </Panel>

        {/* Hareket demoları */}
        <Panel>
          <AppText variant="caption" tone="secondary">HAREKET</AppText>
          <EnterDemo />
          <PopDemo />
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
  toastHost: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
  },
});
