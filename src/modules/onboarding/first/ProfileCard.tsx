// G18-S1 md.5 — FinHomeProfileCard: Ana sayfada tek, kapatılabilir "Profilini
// oluşturalım" kartı. Kart: 12/16 dış boşluk, 16 iç (sağ 52 — X için), 20 köşe,
// kart yüzeyi + 1 pt çizgi; başlık Bricolage 600/20, açıklama 14 ikincil,
// "Profilini oluştur" mürekkep hap 44; sağ üstte 44×44 X. Kapanış: fast 200 opaklık.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../core/design/components/AppText';
import { CURVE, DURATION, haptic } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { BRICOLAGE_SEMI, useHomeTokens } from './homeTokens';

const X_D =
  'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z';

export function ProfileCard({ onCreate, onDismiss }: { onCreate: () => void; onDismiss: () => void }) {
  const k = useHomeTokens();
  const i18n = useT();
  const o = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));

  const dismiss = () => {
    haptic('selection');
    o.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.exit }, (ok) => {
      if (ok) runOnJS(onDismiss)();
    });
  };

  return (
    <Animated.View style={[styles.wrap, style]} testID="fin-home-profile-card">
      <View
        accessibilityRole="summary"
        accessibilityLabel={i18n.t('onboarding.profile_card.title')}
        style={[styles.card, { backgroundColor: k.card, borderColor: k.line }]}
      >
        <AppText style={[styles.title, { color: k.text }]} accessibilityRole="header">
          {i18n.t('onboarding.profile_card.title')}
        </AppText>
        <AppText style={[styles.sub, { color: k.sec }]}>{i18n.t('onboarding.profile_card.sub')}</AppText>
        <Pressable
          onPress={() => {
            haptic('light');
            onCreate();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, { backgroundColor: k.ink, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          testID="fin-home-profile-card-cta"
        >
          <AppText style={[styles.ctaText, { color: k.onInk }]}>{i18n.t('onboarding.profile_card.cta')}</AppText>
        </Pressable>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('onboarding.profile_card.close')}
          style={styles.x}
          testID="fin-home-profile-card-close"
        >
          <Svg width={20} height={20} viewBox="0 0 256 256">
            <Path d={X_D} fill={k.text} />
          </Svg>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 12, paddingHorizontal: 16 },
  card: {
    position: 'relative',
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    paddingRight: 52,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  title: { fontFamily: BRICOLAGE_SEMI, fontSize: 20, lineHeight: 25 },
  sub: { fontSize: 14, lineHeight: 20 },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 8,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    justifyContent: 'center',
  },
  ctaText: { fontFamily: BRICOLAGE_SEMI, fontSize: 15, lineHeight: 20 },
  x: { position: 'absolute', top: 4, right: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
