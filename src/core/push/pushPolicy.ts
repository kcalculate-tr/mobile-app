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
// G34-S1: 'personal_plan' — Kişisel plan › Hatırlatmalar, kullanıcı "Hatırlatmaları aç"a dokununca
// BAĞLAM İÇİNDE (yalnız hiç cevaplanmamışsa); reddedilirse akış yine tamamlanır.
export type PushSource = 'first_meal' | 'settings' | 'personal_plan';
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
  if (i.source === 'personal_plan') {
    return i.canAskAgain && i.status === 'undetermined' ? 'ask' : 'skip';
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// G41-S1 md.3 (İlter 13 Kas) — uygulama içi ön kart "Öğün saatinde hatırlatayım mı?".
//  • "Evet" → sistem penceresi (requestPushPermission('first_meal')).
//  • "Şimdi değil" (ya da kartı kaydırıp kapatma) → sistem penceresi AÇILMAZ; zaman kaydedilir.
//  • 7 gün sonra, bir öğün kaydından sonra kart EN FAZLA BİR KEZ daha gösterilir; sonrası
//    yalnız Ayarlar › Bildirimler.
// ─────────────────────────────────────────────────────────────────────────────

export const NOTIFY_REOFFER_DAYS = 7;

export function decideNotifyReoffer(i: {
  /** "Şimdi değil" zamanı (ms) — hiç ertelenmediyse null. */
  laterAt: number | null;
  /** İkinci kart daha önce gösterildi mi. */
  reoffered: boolean;
  now: number;
  /** Bu oturumda başka bir onay sheet'i açıldı (oturum başına tek sheet). */
  consentShownThisSession: boolean;
  /** canOfferPush('first_meal') — hiç sorulmamış + işletim sistemi sorabiliyor. */
  canOffer: boolean;
}): 'offer' | 'skip' {
  if (i.laterAt == null || i.reoffered || !i.canOffer || i.consentShownThisSession) return 'skip';
  return i.now - i.laterAt >= NOTIFY_REOFFER_DAYS * DAY ? 'offer' : 'skip';
}
