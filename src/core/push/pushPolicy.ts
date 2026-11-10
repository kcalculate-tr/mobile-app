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

// ─────────────────────────────────────────────────────────────────────────────
// G27-S1 md.3 (G26 SORULAR 4, İlter 11 Kas) — kaçan teklifin İKİNCİ şansı.
// İlk öğün oturumunda başka bir onay sheet'i açıldığı için teklif atlandıysa (KAÇTI),
// SONRAKİ bir oturumda bir öğün kaydından sonra (ikinci öğün kaydı) BİR kez daha
// teklif edilir. Sonrası otomatik teklif yok (yalnız Ayarlar › Bildirimler).
// ─────────────────────────────────────────────────────────────────────────────

export type NotifyTrigger = 'first_meal' | 'meal_log';
export type NotifyOfferDecision =
  /** Açıklama ekranını şimdi göster (ve "teklif edildi" işaretle). */
  | 'offer'
  /** Bu oturumda gösterme; kaçtı olarak bu oturumu kaydet (ikinci şans hakkı). */
  | 'defer'
  /** İkinci şans hakkını düşür (artık gerekmiyor: izin verildi / sorulamaz). */
  | 'drop'
  /** Hiçbir şey yapma. */
  | 'skip';

export function decideNotifyOffer(i: {
  trigger: NotifyTrigger;
  /** Açıklama ekranı daha önce gösterildi (ilk ya da ikinci şans). */
  offered: boolean;
  /** Teklifin kaçtığı oturumun kimliği (yoksa null). */
  missedSession: string | null;
  currentSession: string;
  /** Bu oturumda başka bir onay sheet'i açıldı (G26 md.7: oturum başına tek sheet). */
  consentShownThisSession: boolean;
  /** canOfferPush('first_meal') — hiç sorulmamış + işletim sistemi sorabiliyor. */
  canOffer: boolean;
}): NotifyOfferDecision {
  if (i.offered) return 'skip';
  if (i.trigger === 'first_meal') {
    if (!i.canOffer) return 'skip';
    return i.consentShownThisSession ? 'defer' : 'offer';
  }
  // meal_log: yalnız kaçmış bir teklif varsa ve AYNI oturum değilse.
  if (i.missedSession == null || i.missedSession === i.currentSession) return 'skip';
  if (!i.canOffer) return 'drop';
  // Bu oturumda da başka bir onay sheet'i açıldıysa hak korunur (bir sonraki kayıtta).
  if (i.consentShownThisSession) return 'skip';
  return 'offer';
}
