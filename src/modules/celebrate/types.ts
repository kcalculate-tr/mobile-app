// Kutlama (celebrate) tipleri + saf icerik eslemesi.
// SAF dosya — native/React yok, test'ten dogrudan import edilir.

/** Kutlanacak an: ilk ogun, 3 gunluk seri, 7 gunluk seri. */
export type CelebrateMoment = 'first' | 'streak3' | 'streak7';

/**
 * Bir kutlamanin gorsel icerigi. `bigSub` semantik bir anahtardir (or. 'gun',
 * 'first') — UI bunu i18n'e map'ler, burada ceviri yapilmaz.
 */
export interface CelebrateContent {
  moment: CelebrateMoment;
  /** Hangi cam nesne gosterilecek. */
  glass: 'flame' | 'trophy' | 'drop';
  /** Paylasim kartindaki halkanin dolumu (0..1). */
  ringProgress: number;
  /** Halkanin ortasindaki buyuk sayi/etiket (or. '1.', '3', '7'). */
  big: string;
  /** Buyuk sayinin alti — semantik i18n anahtari (or. 'first', 'gun'). */
  bigSub: string;
}

/**
 * Saf icerik eslemesi — her an icin kartin cam/halka/sayi degerleri.
 *  - first   -> alev, dolu halka, '1.' + 'first'
 *  - streak3 -> alev, 3/7 halka, '3' + 'gun'
 *  - streak7 -> kupa, dolu halka, '7' + 'gun'
 */
export function celebrateContent(moment: CelebrateMoment): CelebrateContent {
  switch (moment) {
    case 'first':
      return { moment, glass: 'flame', ringProgress: 1, big: '1.', bigSub: 'first' };
    case 'streak3':
      return { moment, glass: 'flame', ringProgress: 3 / 7, big: '3', bigSub: 'gun' };
    case 'streak7':
      return { moment, glass: 'trophy', ringProgress: 1, big: '7', bigSub: 'gun' };
  }
}
