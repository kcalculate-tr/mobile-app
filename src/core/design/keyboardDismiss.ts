/**
 * G27-S1 md.1 — Klavye kapanışı. TEK KAYNAK (saf, RN'siz → birim testli).
 *
 * İlter (11 Kas): klavyenin üstündeki "Kapat" barı HER YERDE kalktı. Instagram
 * gibi: klavye açıkken giriş alanı dışında herhangi bir yere dokununca klavye
 * kapanır; kaydırınca da kapanır (kaydırma tarafı `SCROLL_KEYBOARD`, keyboard.ts).
 *
 * Dokunma kararı uygulama kökündeki `KeyboardDismissRoot` içinde verilir:
 *  - dokunma başında odaklı bir giriş alanı yoksa → hiçbir şey;
 *  - dokunulan şey odaklı alanın kendisiyse (imleç taşıma) → kapanmaz;
 *  - dokunulan şey başka bir giriş alanıysa (alan değiştirme) → kapanmaz;
 *  - parmak kaydıysa (sürükleme / kaydırma) → dokunma değildir, karar kaydırma
 *    kabının `keyboardDismissMode`'una kalır;
 *  - dokunma `keepKeyboardOnTouch` işaretli bir öğede başladıysa (ör. sohbet
 *    "Gönder") → kapanmaz;
 *  - aksi hâlde kapanır. Kök dokunmayı YAKALAMAZ (responder olmaz) → liste
 *    öğesine / düğmeye dokunma hem klavyeyi kapatır hem öğeyi açar.
 */

/** Bu kadar pt'den fazla kayan parmak dokunma sayılmaz (RN Pressable sınırıyla aynı mertebe). */
export const TAP_SLOP = 10;

export type TapDecision = {
  /** Dokunma başında odaklı giriş alanı (yoksa null). */
  focused: unknown;
  /** Dokunmanın hedefi (host örneği). */
  target: unknown;
  /** Hedef kayıtlı bir giriş alanı mı (TextInputState.isTextInput). */
  targetIsTextInput: boolean;
  /** Dokunma boyunca en büyük kayma (pt). */
  movedPx: number;
  /** Dokunma `keepKeyboardOnTouch` işaretli öğede başladı. */
  keep: boolean;
};

export function shouldDismissOnTap(d: TapDecision): boolean {
  if (d.keep) return false;
  if (d.focused == null) return false;
  if (!(d.movedPx <= TAP_SLOP)) return false;
  if (d.target != null && d.target === d.focused) return false;
  if (d.targetIsTextInput) return false;
  return true;
}

export function distance(x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return Math.sqrt(dx * dx + dy * dy);
}

// Dokunma olayı yapraktan köke kabarır: işaretli öğenin onTouchStart'ı kökünkünden
// ÖNCE çalışır → kök bu dokunmayı "klavyeyi koru" olarak okur ve bayrağı tüketir.
let keepFlag = false;

/** Bir öğenin `onTouchStart`'ına verilir: o öğeye dokunma klavyeyi kapatmaz. */
export function keepKeyboardOnTouch(): void {
  keepFlag = true;
}

/** Kök tarafından her dokunma başında okunur ve sıfırlanır. */
export function consumeKeepKeyboard(): boolean {
  const v = keepFlag;
  keepFlag = false;
  return v;
}
