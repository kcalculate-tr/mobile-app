// G49-S1 md.3 — "Neler yapabilirsin" hızlı eylemleri (YALNIZ profilsiz Ana sayfa, plan kartının hemen altında).
// 2×2 kompakt kart: ikon + kısa başlık + tek satır alt metin. Gezinme kuralı çağıranda (TrackerScreen):
// Tara · Etkinlik · Koç G47 profil kapısından geçer (dokununca kayıt akışı; bitince dokunulan eyleme dönülür),
// Paylaş Keşfet kuralıyla (oturum yoksa AuthSheet). Giriş: 8 pt yukarı + fade 220 ms, kademe 50 ms (toplam 150);
// basışta 0,98. Azaltılmış harekette yalnız opaklık (REDUCED.duration). Dokunma alanı ≥ 44 pt (kart ≥ 88 pt).
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { AppText } from '../../../core/design/components/AppText';
import { HOME_GATE_MOTION, REDUCED, haptic, useReducedMotion } from '../../../core/design/motion';
import { palette } from '../../../core/design/tokens';
import { useT } from '../../../core/i18n';
import { track } from '../../../lib/analytics';
import { ChatCircleDots, ImageSquare, Scan, Sneaker, type Icon } from '../../../components/icons';
import { BRICOLAGE_SEMI, useHomeTokens } from '../../onboarding/first/homeTokens';

import type { QuickAction } from '../quickActions';

export type { QuickAction };
export const QUICK_ACTIONS: readonly QuickAction[] = ['scan', 'activity', 'share', 'coach'];

const ICON: Record<QuickAction, Icon> = { scan: Scan, activity: Sneaker, share: ImageSquare, coach: ChatCircleDots };

function ActionCard({ action, index, onPress }: { action: QuickAction; index: number; onPress: () => void }) {
  const k = useHomeTokens();
  const { t } = useT();
  const reduced = useReducedMotion();
  const o = useSharedValue(0);
  useEffect(() => {
    const M = HOME_GATE_MOTION;
    if (reduced) o.value = withTiming(1, { duration: REDUCED.duration });
    else o.value = withDelay(index * M.actStagger, withTiming(1, { duration: M.actEnter, easing: M.actCurve }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const enter = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: reduced ? 0 : (1 - o.value) * HOME_GATE_MOTION.actShift }],
  }));
  const Ico = ICON[action];
  const title = t(`kayit.gate.act_${action}`);
  const sub = t(`kayit.gate.act_${action}_sub`);
  return (
    <Animated.View style={[styles.cell, enter]}>
      <Pressable
        testID={`home-quick-${action}`}
        onPress={() => {
          haptic('light');
          track('home_plan_card_tap', { action });
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${sub}`}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: k.card, borderColor: k.line, transform: [{ scale: pressed ? HOME_GATE_MOTION.pressScale : 1 }] },
        ]}
      >
        <View style={styles.icon} importantForAccessibility="no-hide-descendants">
          <Ico size={22} color={palette.limeInk} weight="bold" />
        </View>
        <AppText maxFontSizeMultiplier={1.3} style={[styles.title, { color: k.text }]}>
          {title}
        </AppText>
        <AppText maxFontSizeMultiplier={1.3} style={[styles.sub, { color: k.sec }]}>
          {sub}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

/** `actions`: gösterilecek eylemler (özelliği kapalı olan çağıranda çıkarılır); sıra sabit. */
export function HomeQuickActions({ actions = QUICK_ACTIONS, onAction }: { actions?: readonly QuickAction[]; onAction: (a: QuickAction) => void }) {
  const k = useHomeTokens();
  const { t } = useT();
  const list = QUICK_ACTIONS.filter((a) => actions.includes(a));
  if (list.length === 0) return null;
  const rows: QuickAction[][] = [];
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
  return (
    <View style={styles.section} testID="home-quick-actions">
      <AppText accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.h2, { color: k.text }]}>
        {t('kayit.gate.actions_title')}
      </AppText>
      <View style={styles.grid}>
        {rows.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((a) => (
              <ActionCard key={a} action={a} index={list.indexOf(a)} onPress={() => onAction(a)} />
            ))}
            {row.length === 1 ? <View style={styles.cell} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 20 },
  h2: { fontFamily: BRICOLAGE_SEMI, fontSize: 20, lineHeight: 26, marginBottom: 10 },
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  card: { flex: 1, minHeight: 104, borderRadius: 20, borderWidth: 1, padding: 14, gap: 4 },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, lineHeight: 20 },
  sub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, lineHeight: 17 },
});
