# İnceleme notu — App Store "App Review Information" + Google Play "Uygulama erişimi" · 1.1.0 (M-S1 md.2)

> **Şifre, kod, jeton bu dosyaya YAZILMAZ.** `[İLTER]` yer tutucuları yalnız App Store Connect / Play Console formunda doldurulur.
> Not metni İngilizce (App Review dili). Bayrakla kapalı özellikler (kcalAI Koç vb.) notta **anılmaz**.

## 0. Önce (İlter — gönderimden önce, bir kez)
1. **İnceleme hesabı** `apple@inceleme.eatkcal.com` — Supabase Auth Admin API ile oluştur (CLAUDE.md "Test kullanıcıları"; çıktıya şifre/jeton yazma).
2. **Giriş yöntemi:** uygulamada **şifre alanı yok** (e-posta + 6 haneli kod, Apple ile, Google ile — `src/core/AuthContext.tsx`). İnceleme ekibinin kodu
   okuyabilmesi için `inceleme.eatkcal.com` posta kutusuna web erişimi gerekir → formdaki "Password" alanına **posta kutusunun web giriş
   şifresi** `[İLTER]`, Notes'a web posta adresi `[İLTER]` yazılır (bkz. LOG SORULAR 1).
3. **Bayrak kilitleri** (yalnız bu kullanıcı, `user_feature_unlocks`; canlı DB yazımı = İlter onayı): 1.1.0'da açık olacak bayrakların hepsi —
   `yeni_kabuk`, `yeni_onboarding`, `yeni_siparis`, `ai_tarama`, `barcode_scan`, `abonelik`, `kesfet`, `kesfet_takip`, `kesfet_yorum`,
   `kesfet_paylasim`, `kesfet_video`, `gun_halkasi`, `su_takibi`, `etkinlik`, `paylasim_karti`, `sosyal_bildirim`, `ogun_hatirlatma`.
   **AÇMA:** `koc`, `yakinda_satirlari`, `paylasim_baglanti` (1.1.0'da kapalı; inceleme ekranda görmemeli).
4. **Abonelikler ASC'de "Ready to Submit"** ve 1.1.0 sürüm sayfasında "In-App Purchases and Subscriptions" bölümüne eklenmiş olmalı
   (ilk abonelik sürümle birlikte incelenir). RevenueCat'te ürünler + `fresh`/`balance` yetkileri + `default` teklif bağlı.
5. Hesabın günlük AI hakkını sıfırla (yeni kullanıcı = Ücretsiz, günde 2) — inceleme sınır ekranını da görebilsin diye ek hak verme.

## 1. App Store Connect › App Review Information
| Alan | Değer |
|---|---|
| Sign-in required | Yes |
| User name | `apple@inceleme.eatkcal.com` |
| Password | `[İLTER]` (posta kutusu web girişi — uygulamada şifre yok) |
| Contact first / last name | `[İLTER]` |
| Contact phone | `+90 232 332 21 00` (KURUMSAL_KIMLIK tek biçim) · teyit `[İLTER]` |
| Contact email | `info@eatkcal.com` |
| Attachment | İsteğe bağlı: 60 sn ekran kaydı (giriş → fotoğraf tarama → ses → paywall → hesap silme yeri) |

**Notes (EN — forma yapıştır, `[İLTER]` yerlerini doldur):**
```text
Thank you for reviewing KCAL 1.1.0.

SIGN-IN (this app has no password field; it uses a one-time email code)
1. Launch the app and tap "Get started" (or "I already have an account").
2. On "Create your account." tick the Terms / Privacy box, then tap "Continue with email".
3. Enter apple@inceleme.eatkcal.com and tap "Send code".
4. Open the review mailbox at [İLTER: webmail URL] and sign in with the password in the Password field above.
   Enter the 6-digit code from the newest email and tap "Verify and continue".
Sign in with Apple and Google also work, but the review account above has every 1.1.0 feature enabled.

AI FOOD LOGGING (center "Scan" tab)
- Photo: frame a plate (or pick one from the gallery) and take the photo. Before the first analysis the app asks once for permission to send the photo and note to our AI provider. The result lists each food with estimated grams, calories and macros; edit grams or portions, then tap the lime "Log to …" button (meal name, e.g. Lunch).
- Voice: switch the mode bar to "Voice", allow Microphone and Speech Recognition, and say e.g. "a bowl of lentil soup and a glass of ayran". Speech is turned into text by the phone's speech recognition; no audio is recorded or sent to us. Tap "Done" and the text is split into items like a photo result.
- Barcode and Manual modes are in the same mode bar.
The free plan includes 2 AI scans per day (photo and voice share this allowance). After the second scan a limit sheet offers the plans.

SUBSCRIPTIONS (auto-renewable, group "kcalAI")
- kcalAI Fresh: 10 AI scans/day, monthly or yearly. kcalAI Balance: 50 AI scans/day, monthly or yearly. Yearly plans include a 7-day free trial.
- Open: Profile tab > kcalAI card > "See plans" (or the limit sheet after the free scans).
- Purchases run in the App Store sandbox with your sandbox Apple ID; no real charge. After purchase the daily allowance pill on Scan shows the new limit.
- "Restore purchases" is on the plans screen. The plans screen shows price, period, trial terms, auto-renewal text, Terms of Use and Privacy Policy links.
- Subscriptions are managed in iOS Settings > Apple ID > Subscriptions; Profile > Security > Delete account warns about an active subscription.

EATKCAL MEAL ORDERING (physical food, İzmir only)
- eatkcal sells meals cooked in our own kitchen and delivered only within İzmir, Türkiye. Outside İzmir the tab shows a waitlist instead of ordering.
- To see the ordering flow, open the "eatkcal" tab, tap the delivery address and enter this address (our office, inside the delivery area):
  Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir
  The nearest branch is selected automatically ([İLTER: branch name]).
- Add any meal to the cart and go to checkout. Please do not complete payment: real orders are prepared and delivered by our kitchen. These are physical goods, so in-app purchase is not used (guideline 3.1.3(e)).

COMMUNITY (Explore tab)
- Recipes and meal posts. Every post's "..." menu has Report and Block. Users accept Community Guidelines before their first post, and new posts are screened by automated moderation (guideline 1.2).

PRIVACY AND PERMISSIONS
- No ads and no tracking: the app does not use App Tracking Transparency and does not access the IDFA.
- Each system permission is requested only when the related feature is used: Camera (Scan), Microphone + Speech Recognition (Voice), Location while using (only when the user taps "Use my location" for an eatkcal address), Notifications (optional reminders). Photos are picked with the system photo picker.
- Profile > Privacy: usage and ad measurement switches. Account deletion: Profile > Security > Delete account.

HEALTH
Calorie and nutrition values are estimates, and the app says they are not medical advice. No HealthKit. Users must be 18 or older.
```

## 2. Google Play Console › Uygulama içeriği › Uygulama erişimi
- "Uygulamanın tamamı veya bir kısmı kısıtlı" → **Talimat ekle**:
  - Ad: `İnceleme hesabı (e-posta kodu)`
  - Kullanıcı adı: `apple@inceleme.eatkcal.com` · Parola: `[İLTER]` (posta kutusu web girişi)
  - Diğer bilgiler: yukarıdaki EN metnin **SIGN-IN**, **SUBSCRIPTIONS** ("App Store sandbox" yerine "Google Play license testing / test card"
    yazılır; Play'de lisans test hesabı olarak inceleme Gmail'i eklenmez — Google kendi test kartını kullanır) ve **EATKCAL** bölümleri.
- Abonelik testi: Play Console › Ayarlar › Lisans testi listesine iç test hesapları; inceleme için ek işlem gerekmez.

## 3. Kontrol (gönderimden hemen önce, TestFlight / iç test derlemesinde)
| # | Adım | Beklenen |
|---|---|---|
| 1 | İnceleme hesabıyla e-posta koduyla giriş | Kod posta kutusuna < 1 dk'da düşer; giriş olur |
| 2 | Tara › Fotoğraf | İlk analizde AI izni sheet'i, sonra sonuç; "Logla" çalışır |
| 3 | Tara › Ses | Mikrofon + konuşma tanıma izni bir kez; döküm → öğeler |
| 4 | 3. AI tarama | Sınır sheet'i → "Planları gör" → paywall (fiyatlar mağazadan) |
| 5 | Sandbox satın alma + Geri yükle | Hak hapı 10/50'ye çıkar; geri yükleme mesajı |
| 6 | eatkcal › yukarıdaki adres | Bölge içinde; sepet → ödeme ekranına kadar (ÖDEME YAPMA) |
| 7 | Profil | Koç girişi, "yakında" satırları **görünmüyor** |
| 8 | Profil › Güvenlik › Hesabımı sil | Ekran açılır (silme yapma) |
