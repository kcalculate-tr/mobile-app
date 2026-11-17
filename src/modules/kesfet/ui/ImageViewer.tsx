// G57 (17 Kas) — gönderi görseline dokununca tam ekran görüntüleyici: siyah zemin, görsel sığdırılmış
// (kırpılmadan), birden çok görselde yatay kaydırma + sayaç, iOS'ta iki parmakla yakınlaştırma.
// Kapat: × düğmesi, Android geri tuşu.
import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { Icon } from './icons';

export interface ImageViewerState {
  urls: string[];
  index: number;
}

export function ImageViewer({ state, onClose }: { state: ImageViewerState | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t: tr } = useT();
  const { width, height } = Dimensions.get('window');
  const [page, setPage] = useState(state?.index ?? 0);
  useEffect(() => setPage(state?.index ?? 0), [state]);
  if (!state || state.urls.length === 0) return null;
  const n = state.urls.length;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={styles.root} testID="kesfet-image-viewer">
        <FlatList
          {...SCROLL_KEYBOARD}
          data={state.urls}
          keyExtractor={(u, i) => `${i}-${u}`}
          horizontal
          pagingEnabled
          initialScrollIndex={Math.min(state.index, n - 1)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index }) => (
            <ScrollView
              {...SCROLL_KEYBOARD}
              style={{ width, height }}
              contentContainerStyle={styles.center}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              accessible
              accessibilityRole="image"
              accessibilityLabel={tr('kesfet_act.viewer_a11y', { i: index + 1, n })}
            >
              <Image source={{ uri: item }} style={{ width, height: height * 0.86 }} contentFit="contain" transition={120} />
            </ScrollView>
          )}
        />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet_act.viewer_close')}
          hitSlop={8}
          style={[styles.close, { top: insets.top + 8 }]}
          testID="kesfet-image-viewer-close"
        >
          <Icon name="x" size={22} color="#FFFFFF" />
        </Pressable>
        {n > 1 ? (
          <View style={[styles.counter, { bottom: insets.bottom + 16 }]} pointerEvents="none">
            <AppText style={styles.counterText}>{`${page + 1} / ${n}`}</AppText>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' },
  counterText: { color: '#FFFFFF', fontSize: 13 },
});
