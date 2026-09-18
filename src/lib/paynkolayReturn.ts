// PaynKolay hosted sayfasından dönüş URL'i eşleştirici — ödeme (PaymentScreen) ve
// Kart Ekle (AddCardScreen) ortak kullanır. Import'suz: Node testlerinde çalışır.

export type PaynkolayReturn = { matches: boolean; success: boolean };

export const matchesPaynkolayReturn = (url: string): PaynkolayReturn => {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    // SADECE callback'in ASIL redirect'ini (eatkcal.com/payment/success|fail) yakala.
    // 'result='/'pk=' gibi query fallback'i KULLANMA: callback URL'inin KENDISI query
    // tasidigi icin (successUrl=.../paynkolay-callback?...), fallback o ara duragi
    // "donus" sanip navigasyonu keserdi -> callback HIC kosmaz, order pending kalir,
    // polling timeout olurdu. Final-redirect host'una kilitleyince callback once kosar.
    if (host === 'eatkcal.com') {
      if (u.pathname === '/payment/success') return { matches: true, success: true };
      if (u.pathname === '/payment/fail') return { matches: true, success: false };
    }
    return { matches: false, success: false };
  } catch {
    return { matches: false, success: false };
  }
};
