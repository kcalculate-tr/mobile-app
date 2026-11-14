// G53-S1 md.3 — Paylaşım ekranı görsel kılavuzu (i). Küçük alt sayfa: önerilen oran/ölçü, kırpma notu, kaç
// görsel, dosya boyutu, (video açıksa) video süre/boyut. Sayıların HEPSİ ../shareGuide.ts → koddaki gerçek
// sınırlar. İlk paylaşım ekranında bir kez kendiliğinden açılır (`tip` satırıyla), sonra yalnız "i" ile.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Sheet, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { ImageSquare, Info, Stack, VideoCamera } from '../../../components/icons';
import { SHARE_GUIDE_RATIOS, pctLabel, shareGuideValues } from '../shareGuide';

export function ShareGuideSheet({
  visible,
  onClose,
  showVideo,
  firstTime = false,
}: {
  visible: boolean;
  onClose: () => void;
  /** `kesfet_video` açık mı (kapalıyken video satırı yok). */
  showVideo: boolean;
  /** Kendiliğinden açıldı → "i" ipucu satırı. */
  firstTime?: boolean;
}) {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const v = shareGuideValues();
  const [portrait, square] = SHARE_GUIDE_RATIOS;

  const Row = ({ icon, title, lines, testID }: { icon: React.ReactNode; title: string; lines: string[]; testID: string }) => (
    <View style={styles.row} testID={testID}>
      <View style={[styles.icon, { backgroundColor: t.color.line }]}>{icon}</View>
      <View style={styles.rowText}>
        <AppText style={styles.rowTitle}>{title}</AppText>
        {lines.map((l, i) => (
          <AppText key={i} tone="secondary" style={styles.rowLine} testID={`${testID}-${i}`}>
            {l}
          </AppText>
        ))}
      </View>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={tr('share_guide.title')} testID="share-guide-sheet">
      <View style={styles.wrap}>
        <AppText tone="secondary" style={styles.sub}>
          {tr('share_guide.sub')}
        </AppText>
        <Row
          testID="share-guide-ratio"
          icon={<ImageSquare size={20} color={t.color.ink} />}
          title={tr('share_guide.ratio_title')}
          lines={[
            tr('share_guide.ratio_portrait', { w: portrait.w, h: portrait.h }),
            tr('share_guide.ratio_square', { w: square.w, h: square.h }),
            tr('share_guide.crop_note', { min: v.feedMinH, max: v.feedMaxH }),
          ]}
        />
        <Row
          testID="share-guide-count"
          icon={<Stack size={20} color={t.color.ink} />}
          title={tr('share_guide.count_title')}
          lines={[tr(showVideo ? 'share_guide.count_video' : 'share_guide.count', { n: v.maxPhotos })]}
        />
        <Row
          testID="share-guide-size"
          icon={<Info size={20} color={t.color.ink} />}
          title={tr('share_guide.size_title')}
          lines={[tr('share_guide.photo_size', { mb: v.photoMaxMb, q: pctLabel(v.photoQualityPct, lang) })]}
        />
        {showVideo ? (
          <Row
            testID="share-guide-video"
            icon={<VideoCamera size={20} color={t.color.ink} />}
            title={tr('share_guide.video_title')}
            lines={[tr('share_guide.video_limit', { s: v.videoMaxSeconds, mb: v.videoMaxMb })]}
          />
        ) : null}
        {firstTime ? (
          <AppText tone="secondary" style={styles.tip} testID="share-guide-tip">
            {tr('share_guide.tip')}
          </AppText>
        ) : null}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={[styles.ok, { backgroundColor: t.color.ink }]}
          testID="share-guide-ok"
        >
          <AppText style={[styles.okText, { color: t.color.bg }]}>{tr('share_guide.ok')}</AppText>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingBottom: 8 },
  sub: { fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowLine: { fontSize: 14, lineHeight: 20 },
  tip: { fontSize: 13, lineHeight: 18 },
  ok: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  okText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
});
