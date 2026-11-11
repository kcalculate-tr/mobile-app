// G34-S1 · Tur 26o — Akış üst çubuğu (01 panosu): adım Geri (akış İÇİ; rota değiştirmez) ·
// "Kişisel plan" + "n/8" · sağda Giriş / Kaldığın yerden için kapat X ya da "Şimdilik geç";
// altında ilerleme çubuğu (Geri ve çubuk sabit kalır, yalnız içerik kayar).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../core/design/components/AppText';
import { useT } from '../../../core/i18n';
import { CaretLeft, X } from '../../../components/icons';
import { Crossfade, ProgressFill } from './motion';
import { usePp } from './parts';

/** Üst çubuk: Geri · "Kişisel plan" + "n/8" · sağ eylem (× ya da "Şimdilik geç"); altında ilerleme. */
export function PpHeader({
  onBack,
  progress,
  dragBack = 0,
  right,
  title,
}: {
  onBack?: () => void;
  progress?: { index: number; total: number } | null;
  /** Sol kenar jestinde 0..1 — çubuk oranla geri iner. */
  dragBack?: number;
  right?: { kind: 'close' | 'text'; label: string; onPress: () => void };
  title?: string;
}) {
  const P = usePp();
  const i18n = useT();
  const insets = useSafeAreaInsets();
  const ratio = progress ? Math.max(0, (progress.index - dragBack) / progress.total) : 0;
  return (
    <View style={{ paddingTop: insets.top + 4 }}>
      <View style={styles.headRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel={i18n.t('pp.back')} style={styles.headBtn}>
            <CaretLeft size={22} color={P.ink} weight="bold" />
          </Pressable>
        ) : (
          <View style={styles.headBtn} />
        )}
        <View style={styles.headMid} accessible accessibilityRole="header" accessibilityLabel={progress ? `${title ?? i18n.t('pp.header')}, ${i18n.t('pp.progress_a11y', { n: progress.index, total: progress.total })}` : title ?? i18n.t('pp.header')}>
          <AppText textRole="helper" style={{ color: P.sec, textAlign: 'center' }} numberOfLines={1}>
            {title ?? i18n.t('pp.header')}
          </AppText>
          {progress ? (
            <Crossfade k={`${progress.index}/${progress.total}`}>
              <AppText textRole="helper" style={{ color: P.ink, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                {i18n.t('pp.step', { n: progress.index, total: progress.total })}
              </AppText>
            </Crossfade>
          ) : null}
        </View>
        {right ? (
          right.kind === 'close' ? (
            <Pressable onPress={right.onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={right.label} style={styles.headBtn}>
              <View style={[styles.closeDot, { backgroundColor: P.chip, borderColor: P.chipEdge }]}>
                <X size={14} color={P.ink} weight="bold" />
              </View>
            </Pressable>
          ) : (
            <Pressable onPress={right.onPress} hitSlop={8} accessibilityRole="button" style={[styles.headBtn, { width: 'auto', minWidth: 44, paddingHorizontal: 4 }]}>
              <AppText textRole="helper" style={{ color: P.ink, fontWeight: '600' }}>
                {right.label}
              </AppText>
            </Pressable>
          )
        ) : (
          <View style={styles.headBtn} />
        )}
      </View>
      {progress ? (
        <View style={styles.progressWrap}>
          <ProgressFill ratio={ratio} color={P.ink} track={P.track} />
        </View>
      ) : (
        <View style={styles.progressWrap} />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 48 },
  headBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headMid: { flex: 1, alignItems: 'center' },
  closeDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  progressWrap: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10, minHeight: 20 },
});
