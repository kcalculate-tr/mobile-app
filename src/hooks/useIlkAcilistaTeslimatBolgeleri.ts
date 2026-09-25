import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANAHTAR = 'kcal.teslimatBolgeleriGosterildi.v1';

/**
 * Teslimat bölgeleri ekranını kullanıcıya ÖMÜR BOYU BİR KEZ açar.
 *
 * Kurallar:
 *  · Kampanya pop-up'ı varken açılmaz — iki modal üst üste binmesin. Kampanya
 *    kapandığında bu tekrar denenir.
 *  · AsyncStorage okunamazsa (private mod, bozuk depo) gösterilmez. Bilgi
 *    zaten profilde ve anasayfa şeridinde kalıcı olarak duruyor; her açılışta
 *    pop-up patlatmaktansa hiç göstermemek daha iyi.
 *  · Bayrak AÇILIŞTA değil, kullanıcı ekranı GÖRDÜĞÜNDE yazılır.
 */
export function useIlkAcilistaTeslimatBolgeleri(bekleyenBaskaModalVar: boolean) {
  const [gorunur, setGorunur] = useState(false);
  const denendi = useRef(false);

  useEffect(() => {
    if (denendi.current || bekleyenBaskaModalVar) return;
    denendi.current = true;

    let gecerli = true;
    (async () => {
      try {
        const deger = await AsyncStorage.getItem(ANAHTAR);
        if (!gecerli || deger) return;
        // Anasayfa yerleşene kadar kısa bir nefes — açılışın ilk karesinde
        // modal fırlatmak sıçrama gibi görünüyor.
        setTimeout(() => { if (gecerli) setGorunur(true); }, 900);
      } catch {
        // sessiz
      }
    })();

    return () => { gecerli = false; };
  }, [bekleyenBaskaModalVar]);

  const kapat = () => {
    setGorunur(false);
    AsyncStorage.setItem(ANAHTAR, new Date().toISOString()).catch(() => {});
  };

  return { gorunur, kapat };
}
