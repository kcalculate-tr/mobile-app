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

// Tekrarlar arasindaki ayrac. Simge YOK: ucgen (21.09.2026) marka diline
// ait degildi ve kucuk puntoda kirli bir leke gibi duruyordu. Genis bosluk
// hem nefes aldiriyor hem tekrarin nerede bittigini gosteriyor.
const SEPARATOR = '      ';

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

  // Olculen dogal genislik verilene kadar kopyalar dogal akisinda kalir.
  const copyStyle = trackWidth > 0 ? { width: trackWidth } : null;
  const copy = (
    <Text
      numberOfLines={1}
      // clip: metin tam kendi genisliginde oldugu icin zaten kirpilmaz;
      // varsayilan 'tail' olsaydi bir piksellik yuvarlama farki bile
      // sonuna ucnokta koyardi.
      ellipsizeMode="clip"
      style={[styles.text, { color: textColor || '#000000' }, copyStyle]}
    >
      {track}
    </Text>
  );

  const body = (
    <View
      style={[styles.strip, { backgroundColor: bgColor || COLORS.brand.greenTicker }]}
      pointerEvents={onPress ? 'auto' : 'none'}
    >
      {/* Olcum kopyasi: GORUNMEZ ve genisligi sinirsiz bir kapta.
          Sebep: numberOfLines=1 olan bir Text, kullanilabilir genislige
          gore olculur; serit ekran genisliginde oldugu icin metin ekranda
          kirpilip sonuna ucnokta koyuluyordu (21.09.2026). Burada kap cok
          genis oldugundan metin kendi DOGAL genisligini bildiriyor. */}
      <View style={styles.measureHost} pointerEvents="none">
        <Text
          numberOfLines={1}
          ellipsizeMode="clip"
          style={styles.text}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          {track}
        </Text>
      </View>

      <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
        {copy}
        {/* Dikişsiz döngü için birebir ikinci kopya */}
        {copy}
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
  // Sadece olcum icin; ekranda gorunmez. Genislik, en uzun duyurunun bile
  // altinda kalmayacak kadar buyuk secildi.
  measureHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10000,
    opacity: 0,
    // KRITIK: row olmali. Sutun yonunde cocuk capraz eksende STRETCH eder,
    // yani metin 10000px genisligi rapor eder ve olcum anlamsizlasir.
    flexDirection: 'row',
  },
  text: {
    // Kategori/menu tipografisiyle ayni aile ve olcek; genis harf araligi
    // (letterSpacing 0.6) seridi ekranin geri kalanindan kopariyordu.
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    // KRITIK: satir icinde Text varsayilan olarak KUCULUR (flexShrink:1) ve
    // numberOfLines=1 ile kirpilir -> marquee calismaz. 0 yaparak metnin
    // kendi dogal genisligine ulasmasini ve tasmasini sagliyoruz.
    flexShrink: 0,
  },
});
