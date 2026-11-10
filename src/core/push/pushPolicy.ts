// G26-S1 md.6 (İlter 11 Kas) — bildirim izni kararı (saf; RN yok → tsx --test).
//
// Kural:
//  • Kayıt/onboarding/açılışta sistem penceresi YOK.
//  • İlk teklif: ilk öğün kaydından sonra TEK açıklama ekranı → sistem penceresi ('first_meal').
//  • Hatırlatma / seri / sosyal / plan modülleri kendi başına İSTEMEZ: `pushGranted()` sorar,
//    izin yoksa sessizce geçer.
//  • Reddeden (ya da teklifi geçen) kullanıcıya yeniden sistem penceresi en fazla 30 günde
//    bir ve YALNIZ Ayarlar › Bildirimler'den ('settings'); işletim sistemi artık soramıyorsa
//    (iOS ret sonrası) Ayarlar uygulaması açılır.

export type PushStatus = 'granted' | 'denied' | 'undetermined';
export type PushSource = 'first_meal' | 'settings';
export type PushDecision =
  /** İzin zaten var. */
  | 'granted'
  /** Açıklama ekranı / sistem penceresi gösterilebilir. */
  | 'ask'
  /** Sistem penceresi açılamaz → işletim sistemi Ayarlar'ı (yalnız 'settings'). */
  | 'open_settings'
  /** Hiçbir şey gösterme (sessiz). */
  | 'skip';

export const PUSH_REASK_DAYS = 30;
const DAY = 86_400_000;

export function decidePush(i: {
  status: PushStatus;
  canAskAgain: boolean;
  /** Son sistem penceresi zamanı (ms) — hiç sorulmadıysa null. */
  askedAt: number | null;
  now: number;
  source: PushSource;
}): PushDecision {
  if (i.status === 'granted') return 'granted';
  if (i.source === 'first_meal') {
    // Tek teklif: daha önce hiç sorulmadıysa ve işletim sistemi sorabiliyorsa.
    return i.askedAt == null && i.canAskAgain && i.status === 'undetermined' ? 'ask' : 'skip';
  }
  // Ayarlar › Bildirimler: 30 günde en fazla bir sistem penceresi.
  if (!i.canAskAgain) return 'open_settings';
  if (i.askedAt == null || i.now - i.askedAt >= PUSH_REASK_DAYS * DAY) return 'ask';
  return 'open_settings';
}
