// G26-S1 md.7 (İlter 11 Kas) — aynı oturumda arka arkaya birden fazla onay sheet'i açılmaz.
//
// Zorunlu kapılar (yeni belge sürümü kabulü, AI izni ilk taramada, koç izni ilk koç mesajında)
// kullanıcının o anki eylemine bağlı olduğu için yerinde kalır ve oturumun "onay sheet'i"
// hakkını kullanır. Ertelenebilir teklifler (ilk öğün sonrası bildirim açıklaması) bu oturumda
// başka bir onay sheet'i açıldıysa GÖSTERİLMEZ, bir sonraki oturuma kalır.
// Bellek içi (uygulama süreci = oturum); kalıcı değil.

let shownKind: string | null = null;

/** Bir onay sheet'i ekrana geldi (ConsentSheet görünür olunca çağrılır; 'details' sayılmaz). */
export function noteConsentSheet(kind: string): void {
  if (!shownKind) shownKind = kind;
}

/** Bu oturumda daha önce bir onay sheet'i açıldı mı? */
export function consentSheetShownThisSession(): boolean {
  return shownKind != null;
}

/** Yalnız testler. */
export function resetConsentSheetSession(): void {
  shownKind = null;
}
