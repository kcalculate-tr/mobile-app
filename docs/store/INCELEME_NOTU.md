# İnceleme notu — App Store "App Review Information" + Google Play "Uygulama erişimi" (G20-S2 md.2)

> **Şifre, kod, jeton bu dosyaya YAZILMAZ.** Yer tutucular (`[DEMO_EPOSTA]`, `[POSTA_KUTUSU_ERİŞİMİ]`)
> yalnız App Store Connect / Play Console formunda doldurulur.

## 0. Giriş yöntemi sorunu (önce karar)
Uygulamada **parola yok**: e-posta + 6 haneli tek kullanımlık kod (Supabase OTP), Apple ile Giriş, Google ile Giriş
(`src/core/AuthContext.tsx:283-300`). İnceleme ekibinin koda erişmesi gerekir. İki yol:

| Yol | Nasıl | Artı | Eksi |
|---|---|---|---|
| **A (önerilen)** Demo e-posta + erişilebilir posta kutusu | Yalnız inceleme için açılmış bir posta kutusu (`[DEMO_EPOSTA]`); kutunun web girişi `[POSTA_KUTUSU_ERİŞİMİ]` ASC "Notes" alanına yazılır. Hesap Auth Admin API ile oluşturulur (CLAUDE.md "Test kullanıcıları"), bayrak kilitleri açılır (aşağıda) | İnceleme, yayına açılmamış bayraklı özellikleri de görür; Apple "çalışan demo hesap" şartı (2.1) | Ayrı posta kutusu yönetimi; inceleme sonrası parola değiştirilmeli |
| B | "Apple ile devam et" ile kendi Apple kimliğiyle girer | Kurulum yok | Hesap önceden bilinmez → bayrak kilidi açılamaz; özellikler yalnız bayrak %100 ise görünür |

**Bayrak kilidi (Yol A):** demo kullanıcı için `user_feature_unlocks` satırları (`get_my_features` kilidi rollout'tan bağımsız
açar — `supabase/migrations/20261103000500_feature_flags.sql:151-185`). Açıklamada anlatılan özellikler:
`yeni_kabuk`, `yeni_onboarding`, `yeni_siparis`, `ai_tarama`, `kesfet`, `kesfet_takip`, `kesfet_paylasim`, `kesfet_yorum`,
`kesfet_video`, `gun_halkasi`, `su_takibi`, `etkinlik`, `paylasim_karti`, `sosyal_bildirim`. Canlı DB yazımı = İlter onayı
(`YAYIN_KONTROL.md` › A6). Not: bayraklar yalnız **girişten sonra** çözülür (`src/core/flags/FlagsProvider.tsx:66-70`);
giriş öncesi karşılama/onboarding varsayılan (eski) akışla açılabilir — notta söylendi.

## 1. App Store Connect › App Review Information
| Alan | Değer |
|---|---|
| Sign-in required | Yes |
| User name | `[DEMO_EPOSTA]` |
| Password | `N/A — one-time email code, see Notes` |
| Contact first/last name | `[AD] [SOYAD]` |
| Contact phone | `[TELEFON]` |
| Contact email | `[support@kcalculate.ai]` |
| Attachment | İsteğe bağlı: 60 sn ekran kaydı (Tara → logla → Keşfet → hesap silme yeri) |

**Notes (EN — forma yapıştır, yer tutucuları doldur):**
```text
Thank you for reviewing Kcalculate AI 1.1.0.

SIGN-IN (no password in this app — email one-time code)
1. Launch the app, tap "Get started" (or "I already have an account").
2. On "Create your account." tap "Continue with email".
3. Enter [DEMO_EPOSTA]. Tick "I have read and accept the Terms of Use and the Privacy Policy." and tap "Send code".
4. Open the review mailbox: [POSTA_KUTUSU_ERİŞİMİ]. Enter the 6-digit code and tap "Verify and continue".
   (Sign in with Apple and Google also work; the demo account has all 1.1.0 features enabled.)

PRIVACY / ATT
- Before any tracking, the sign-up screen shows Terms, Privacy Policy, KVKK notice and an "Ad measurement (Meta)" switch the user can turn off.
- The iOS App Tracking Transparency prompt appears only after sign-up and only if ad measurement is left on. Meta is used only to measure our ad campaigns, not to show ads (the app has no ads). Declining ATT turns Meta off.
- Profile > Privacy > Data and ad permissions: usage measurement and ad measurement on/off.
- Account deletion: Profile > Security > Delete account (in-app, guideline 5.1.1(v)).

WHAT TO TRY
- Scan (center tab): take or pick a plate photo. AI returns estimated calories/macros; edit grams, then "Log". Without a camera, use the gallery option.
- Home: calorie, macro, water and activity rings; add water and an activity.
- Explore: recipes and posts. Each post's "..." menu has Report and Block. New posts are screened by automated moderation; users accept Community Guidelines before posting (guideline 1.2).
- eatkcal (food ordering): physical meals, delivered only in İzmir, Türkiye. Outside İzmir the app shows a waitlist. To view the ordering flow choose city "İzmir" and any İzmir address; please do not complete payment (real orders are prepared and delivered). Physical goods, so no in-app purchase is used (3.1.3(e)).

HEALTH
Calorie and nutrition values are estimates and the app states they are not medical advice. No HealthKit. Users must be 18+.

PERMISSIONS
Camera: plate scan. Photos: pick plate/profile/post images. Location (when in use): verify delivery address, nearest branch. Notifications: optional streak/meal reminders.
```

## 2. Google Play Console › Uygulama içeriği › Uygulama erişimi
- "Uygulamanın tamamı veya bir kısmı kısıtlı" → **Talimat ekle**:
  - Ad: `Demo hesap (e-posta kodu)`
  - Kullanıcı adı: `[DEMO_EPOSTA]` · Parola: `Yok — e-posta kodu`
  - Diğer bilgiler: yukarıdaki EN metnin "SIGN-IN" ve "eatkcal" bölümleri (Play incelemesi kodu posta kutusundan alır:
    `[POSTA_KUTUSU_ERİŞİMİ]`).
- Diğer beyanlar (aynı bölüm): Reklamlar = **Hayır** · Reklam kimliği = **Evet** (Meta SDK, ölçüm/analiz; `AD_ID` izni) ·
  Hedef kitle = **18+** · Veri güvenliği = `GIZLILIK_BEYANLARI.md` · Sağlık uygulamaları = beslenme/kilo takibi,
  tıbbi değil · Hesap silme URL'si = `https://eatkcal.com/account-deletion`.

## 3. TR özet (İlter için)
1. Demo hesabı Auth Admin API ile aç (çıktıya parola/jeton yazma), bayrak kilitlerini aç, posta kutusunu hazırla.
2. Formlara yalnız yer tutucuların gerçek değerlerini gir; bu dosyaya yazma.
3. İnceleme bitince: posta kutusu parolasını değiştir; demo kullanıcı kalabilir (sonraki sürümler) ama test verisi temizlenir.
4. eatkcal ödeme adımında **ödeme yapılmamalı** notu kritik (gerçek sipariş mutfağa düşer).
