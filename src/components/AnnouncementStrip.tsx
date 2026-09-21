import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../constants/theme';

interface AnnouncementStripProps {
  message: string;
  /** Bir turun süresi (ms) — küçük değer = hızlı akış */
  speedMs?: number;
  bgColor?: string | null;
  textColor?: string | null;
  onPress?: () => void;
}

const SEPARATOR = '  ▲  ';

/**
 * Sürekli akan tek satırlık duyuru şeridi.
 *
 * Çalışma mantığı: metin ARKA ARKAYA İKİ KEZ render edilir; ilk kopyanın
 * genişliği kadar sola kaydırıldığında ikinci kopya tam olarak ilkinin
 * başladığı yere gelir, animasyon başa sarar → dikişsiz sonsuz döngü.
 * Genişlik onLayout ile ölçülür (font/dil bağımsız).
 */
export default function AnnouncementStrip({
  message,
  speedMs = 18000,
  bgColor,
  textColor,
  onPress,
}: AnnouncementStripProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trackWidth <= 0) return;
    translateX.setValue(0);
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: -trackWidth,
        duration: Math.max(3000, speedMs),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [trackWidth, speedMs, translateX]);

  // Kısa metinde tek kopya ekranı doldurmaz → boşluk akar. Metni, makul bir
  // asgari uzunluğa ulaşana kadar kendi içinde tekrarlıyoruz.
  const unit = `${message}${SEPARATOR}`;
  const repeatCount = Math.max(2, Math.ceil(40 / Math.max(1, unit.length)));
  const track = unit.repeat(repeatCount);

  const body = (
    <View
      style={[styles.strip, { backgroundColor: bgColor || COLORS.brand.green }]}
      pointerEvents={onPress ? 'auto' : 'none'}
    >
      <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
        <Text
          numberOfLines={1}
          style={[styles.text, { color: textColor || '#000000' }]}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          {track}
        </Text>
        {/* Dikişsiz döngü için birebir ikinci kopya */}
        <Text numberOfLines={1} style={[styles.text, { color: textColor || '#000000' }]}>
          {track}
        </Text>
      </Animated.View>
    </View>
  );

  if (!onPress) return body;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      {body}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    height: 32,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  text: {
    // Kategori/menu tipografisiyle ayni aile ve olcek; genis harf araligi
    // (letterSpacing 0.6) seridi ekranin geri kalanindan kopariyordu.
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    // KRITIK: satir icinde Text varsayilan olarak KUCULUR (flexShrink:1) ve
    // numberOfLines=1 ile kirpilir -> marquee calismaz. 0 yaparak metnin
    // kendi dogal genisligine ulasmasini ve tasmasini sagliyoruz.
    flexShrink: 0,
  },
});
