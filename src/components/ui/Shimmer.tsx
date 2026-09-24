import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DURATION, EASING } from '../../constants/motion';

/** Işık bandının genişliği — geniş bant daha yumuşak, daha "parlama" hissi verir. */
const BAND = 170;

interface ShimmerProps {
  /**
   * Kaç kez geçsin. Sayı verilirse o kadar, `'sonsuz'` verilirse durmaz.
   * Bir kereye mahsus bir olayı kutluyorsan (kupon uygulandı) sayı ver;
   * kalıcı bir davete dikkat çekiyorsan (tek dokunuşla tekrar sipariş)
   * sonsuz doğru — kart zaten ekranda kaldığı sürece davet sürüyor.
   */
  repeat?: number | 'sonsuz';
  /** İki geçiş arasındaki bekleme. Sonsuz döngüde daha uzun olmalı. */
  gapMs?: number;
  /** Bandın en parlak noktasının opaklığı. Koyu zeminde yüksek, açıkta düşük. */
  strength?: number;
}

/**
 * Bir yüzeyin üzerinden "/" biçiminde 45°'lik geniş bir ışığın soldan sağa
 * yürümesi.
 *
 * 24.09.2026: bu efekt AppliedCouponCard'ın içine gömülüydü. Aynı parıltı
 * başka yerlerde de istendiği için ayrı bileşene alındı — kopyalanırsa
 * kaçınılmaz olarak ayrışır (bkz. aynı gün yapılan yinelenen-mantık
 * denetimi).
 *
 * Kullanan yüzeyin `overflow: 'hidden'` ve `position: 'relative'` olması
 * gerekir; bu bileşen kendini mutlak konumlandırır.
 */
export default function Shimmer({ repeat = 5, gapMs = 450, strength = 0.6 }: ShimmerProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const ilerleme = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (box.width <= 0) return;
    ilerleme.setValue(0);
    const dongu = Animated.loop(
      Animated.sequence([
        Animated.timing(ilerleme, {
          toValue: 1,
          duration: DURATION.sweep,
          easing: EASING.move,
          useNativeDriver: true,
        }),
        Animated.delay(gapMs),
      ]),
      repeat === 'sonsuz' ? undefined : { iterations: repeat },
    );
    dongu.start();
    // Ekrandan kalkınca döngü durmalı; aksi halde arkada dönmeye devam eder.
    return () => dongu.stop();
  }, [box.width, ilerleme, repeat, gapMs]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.width || height !== box.height) setBox({ width, height });
  };

  // Bant 45° eğik olduğu için yatayda kendi genişliğinden fazla yer kaplar;
  // iki yandan tamamen çıkabilmesi için yüksekliği de payda sayıyoruz.
  const basla = -(BAND + box.height);
  const bitir = box.width + box.height;

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {box.width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            s.band,
            {
              left: 0,
              top: -box.height,
              height: box.height * 3,
              // Sıra kritik: translateX ÖNCE yazılıyor ki hareket yüzeyin
              // kendi yatay ekseninde kalsın; rotate yalnızca bandın BİÇİMİNİ
              // eğiyor. Ters sırada yazılırsa hareket de döner, ışık çapraz
              // kayar.
              transform: [
                { translateX: ilerleme.interpolate({ inputRange: [0, 1], outputRange: [basla, bitir] }) },
                { rotate: '-45deg' },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              `rgba(255,255,255,${strength * 0.37})`,
              `rgba(255,255,255,${strength})`,
              `rgba(255,255,255,${strength * 0.37})`,
              'rgba(255,255,255,0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  band: { position: 'absolute', width: BAND },
});
