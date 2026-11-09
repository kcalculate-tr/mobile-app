# Hesap silme sayfası — kcalculate.ai (G20-S3 md.7, B-09)

Durum: **NOT / TASLAK** — web'e konmadı. Google Play "Data deletion" alanı ve App Store
5.1.1(v) için uygulama dışından erişilebilir bir silme sayfası gerekir. eatkcal.com'da
bir sayfa var (`landing-page/account-deletion.html`), **kcalculate.ai'de yok**.
Hukuki son okuma İlter / avukat.

## Önerilen adres
- `https://kcalculate.ai/account-deletion` (TR varsayılan, `?lang=en` İngilizce)
- Footer'da "Hesabı sil" bağlantısı (eatkcal.com footer'ına da — B-09)
- Play Console › App content › Data safety › "Delete account URL" = bu adres

## İçerik (TR)
**Hesabını sil**
1. Uygulamada: Profil › Gizlilik › Hesabı sil. Silme anında başlar.
2. Uygulamaya erişemiyorsan: hesabına bağlı e-posta adresinden `destek@` adresine
   "Hesabımı sil" konulu e-posta gönder (noreply adresi DEĞİL — B-09). Kimliğini
   doğruladıktan sonra en geç **30 gün** içinde silinir (tek süre; "7 iş günü" ifadesi
   kaldırılmalı).

**Silinenler:** profil, hedef ve ölçüler, öğün/su/etkinlik kayıtları, Tara fotoğrafları,
profil fotoğrafı, gönderiler ve medyası, takip ilişkileri, destek talepleri ve ekleri,
bildirim jetonları ve geçmişi, uygulama içi kullanım olayları, rıza kayıtları, kayıtlı
kartlar (ödeme kuruluşundan da), Apple ile giriş bağlantısı.

**Saklananlar (yasal zorunluluk):** sipariş ve fatura kayıtları **kişiden arındırılarak**
(ad, e-posta, telefon, adres, il/ilçe/mahalle, not boşaltılır) Vergi Usul Kanunu / TTK
süreleri boyunca; kötüye kullanımı önlemek için e-posta/telefonun **geri döndürülemez
özeti** (ilk sipariş kuponu tekrarını engeller).

**Reklam ortağı (Meta):** reklam ölçümü verileri için Meta'nın kendi silme süreci
geçerlidir; talep halinde iletilir.

## İçerik (EN)
**Delete your account**
1. In the app: Profile › Privacy › Delete account. Deletion starts immediately.
2. Can't access the app? Email `support@` from the address linked to your account with
   the subject "Delete my account". After we verify it's you, deletion completes within
   **30 days**.

**Deleted:** profile, goals and measurements, meal/water/activity logs, scan photos,
profile photo, posts and media, follows, support tickets and attachments, push tokens
and notification history, in-app usage events, consent records, saved cards (also at the
payment provider), Sign in with Apple link.

**Kept (legal obligation):** order and invoice records **de-identified** (name, email,
phone, address, city/district/neighbourhood and notes removed) for statutory retention;
an **irreversible hash** of email/phone to prevent first-order coupon abuse.

## Kodla eşleşme (bu dalda)
`supabase/functions/delete-account/index.ts` + `cleanup.ts`:
Storage (avatars `<uid>.*`, user-media `<uid>/`, post-media `posts/<uid>/` + gönderi medya
yolları, support-attachments `tickets/<uid>/`) · support_tickets · posts/post_media ·
follows · push_tokens · notification_sends · analytics_events silinir · feedback /
campaign_targets e-postası, order_modifications adres metni boşalır · orders
anonimleştirmesine il/ilçe/mahalle + external_payload eklendi · auth.users CASCADE
(profiles, user_consents, …).

## Açık kalanlar (B-09)
- Adisyo ham günlükleri (ad/telefon/adres) — kullanıcı bazlı maskeleme (B-16 ile).
- Cihazda kalan veriler (adres, kuyruklar, anon_id) — silme/çıkışta AsyncStorage temizliği (istemci işi).
