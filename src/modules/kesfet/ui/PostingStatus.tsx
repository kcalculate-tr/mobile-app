// G15-S3 — Final FinPosting durum satırı + sakin ret kartı (akışın başında,
// Gün halkası şeridinin altında). Durum `postingStore`'dan gelir.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { AppText, CURVE, DURATION, fontFamily, useReducedMotion, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { postingProgress, type PostingPhase } from '../postingStore';

const P = {
  spinner:
    'M232,128a104,104,0,0,1-208,0c0-41,23.81-78.36,60.66-95.27a8,8,0,0,1,6.68,14.54C60.15,61.59,40,93.27,40,128a88,88,0,0,0,176,0c0-34.73-20.15-66.41-51.34-80.73a8,8,0,0,1,6.68-14.54C208.19,49.64,232,87,232,128Z',
  hourglass:
    'M200,75.64V40a16,16,0,0,0-16-16H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.6A16.05,16.05,0,0,0,200,75.64ZM72,40H184V75.64L178.23,80H77.33L72,76Zm56,78L98.67,96h58.4Zm56,98H72V180l48-36v24a8,8,0,0,0,16,0V144.08l48,36.28Z',
  checkCircle:
    'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z',
  shield:
    'M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z',
};

function Glyph({ d, size, color }: { d: string; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
      <Path d={d} />
    </Svg>
  );
}

function Spinner({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const rot = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    // Gerçek yükleme sürerken döner (işlem bitince bileşen kalkar) — story 900 · standard.
    rot.value = withRepeat(withTiming(360, { duration: DURATION.story, easing: CURVE.standard }), -1, false);
  }, [reduced, rot]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Glyph d={P.spinner} size={16} color={color} />
    </Animated.View>
  );
}

export function PostingStatus({
  phase,
  error,
  onRetry,
  onRules,
  onEdit,
}: {
  phase: PostingPhase;
  error?: string | null;
  onRetry?: (() => void) | null;
  onRules: () => void;
  onEdit?: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  if (phase === 'idle') return null;

  if (phase === 'rejected') {
    return (
      <View style={[styles.card, { backgroundColor: t.color.line }]} accessibilityRole="alert">
        <Glyph d={P.shield} size={22} color={t.color.ink} />
        <View style={styles.cardBody}>
          <AppText style={[styles.cardTitle, { color: t.color.ink }]}>{tr('kesfet.posting.rejected_title')}</AppText>
          <AppText style={[styles.cardText, { color: t.color.secondary }]}>{tr('kesfet.posting.rejected_body')}</AppText>
          <View style={styles.cardActions}>
            <Pressable
              onPress={onRules}
              accessibilityRole="button"
              style={[styles.pill, { borderColor: t.isDark ? '#48484A' : '#C3C7CC', borderWidth: 1 }]}
            >
              <AppText style={[styles.pillText, { color: t.color.ink }]}>{tr('kesfet.posting.rules')}</AppText>
            </Pressable>
            {onEdit ? (
              <Pressable onPress={onEdit} accessibilityRole="button" style={styles.pill}>
                <AppText style={[styles.pillText, { color: t.color.ink }]}>{tr('kesfet.posting.edit')}</AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  const progress = postingProgress(phase);
  const label =
    phase === 'uploading' || phase === 'publishing'
      ? tr('kesfet.posting.sharing')
      : phase === 'reviewing'
        ? tr('kesfet.posting.reviewing')
        : phase === 'published'
          ? tr('kesfet.posting.published')
          : error ?? tr('kesfet.compose.err_network');
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label}>
      {progress != null ? (
        <View style={[styles.track, { backgroundColor: t.color.line }]}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: t.color.ink }]} />
        </View>
      ) : null}
      <View style={styles.row}>
        {phase === 'uploading' || phase === 'publishing' ? (
          <Spinner color={t.color.secondary} />
        ) : phase === 'reviewing' ? (
          <Glyph d={P.hourglass} size={16} color={t.color.secondary} />
        ) : phase === 'published' ? (
          <Glyph d={P.checkCircle} size={16} color={t.color.accentLine} />
        ) : null}
        <AppText style={[styles.label, { color: t.color.secondary }]} numberOfLines={2}>
          {label}
        </AppText>
        {phase === 'error' && onRetry ? (
          <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={10} style={styles.retry}>
            <AppText style={[styles.retryText, { color: t.color.ink }]}>{tr('kesfet.posting.retry')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 3 },
  fill: { height: 3 },
  row: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { flexShrink: 1, fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 18 },
  retry: { marginLeft: 'auto', minHeight: 32, justifyContent: 'center' },
  retryText: { fontFamily: fontFamily.bodySemibold, fontSize: 13, textDecorationLine: 'underline' },
  card: { marginHorizontal: 16, marginVertical: 10, padding: 14, borderRadius: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 21 },
  cardText: { fontFamily: fontFamily.bodyRegular, fontSize: 13, lineHeight: 18 },
  cardActions: { flexDirection: 'row', gap: 4, marginTop: 6 },
  pill: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  pillText: { fontFamily: fontFamily.bodySemibold, fontSize: 13 },
});
