# İnceleme notu — App Store "App Review Information" + Google Play "Uygulama erişimi" · 1.1.0 (M-S1 md.2 · M-S2 md.2: Koç açık)

> **Şifre, kod, jeton bu dosyaya YAZILMAZ.** `[İLTER]` yer tutucuları yalnız App Store Connect / Play Console formunda doldurulur.
> Not metni İngilizce (App Review dili). **M-S2 (İlter 11 Kas 16:00): kcalAI Koç 1.1.0'da AÇIK** (bayrak `koc` + `abonelik`, `coach-chat` yayında) →
> notta nasıl test edileceği ve tıbbi tavsiye vermediği anlatılır. Hâlâ kapalı olanlar (`yakinda_satirlari`, `paylasim_baglanti`) anılmaz.

## 0. Önce (İlter — gönderimden önce, bir kez)
1. **İnceleme hesabı** `apple@inceleme.eatkcal.com` — Supabase Auth Admin API ile oluştur (CLAUDE.md "Test kullanıcıları"; çıktıya şifre/jeton yazma).
2. **Giriş yöntemi: şifreyle** (G28-S1 md.5, `release/1.1.0` › `src/lib/auth/reviewLogin.ts`). Giriş ekranına `apple@inceleme.eatkcal.com`
   (ya da `review@inceleme.eatkcal.com`) yazılınca "Kod gönder" yerine **Şifre** alanı ve **"Şifreyle giriş"** düğmesi açılır
   (`supabase.auth.signInWithPassword`); diğer herkes e-posta koduyla girer. Hesap Supabase Auth'ta **şifreyle** oluşturulur; şifre `[İLTER]`
   yalnız formda. (M-S1'deki posta kutusu web girişi seçeneği artık gerekmiyor.)
3. **Bayrak kilitleri** (yalnız bu kullanıcı, `user_feature_unlocks`; canlı DB yazımı = İlter onayı): 1.1.0'da açık olacak bayrakların hepsi —
   `yeni_kabuk`, `yeni_onboarding`, `yeni_siparis`, `ai_tarama`, `barcode_scan`, `abonelik`, `kesfet`, `kesfet_takip`, `kesfet_yorum`,
   `kesfet_paylasim`, `kesfet_video`, `gun_halkasi`, `su_takibi`, `etkinlik`, `paylasim_karti`, `sosyal_bildirim`, `ogun_hatirlatma`, **`koc`**.
   **AÇMA:** `yakinda_satirlari`, `paylasim_baglanti` (1.1.0'da kapalı; inceleme ekranda görmemeli).
   ⚠ Koç tanıtım ekranında "Egzersiz planı yok · **Yakında**" rozeti var (`CoachIntroScreen.tsx:75`, bayraksız) — İlter kuralı "yakında deme"
   ile çelişiyor; gönderimden önce kaldırılmalı (kod işi, M-S2-LOG SORULAR 1).
4. **Abonelikler ASC'de "Ready to Submit"** ve 1.1.0 sürüm sayfasında "In-App Purchases and Subscriptions" bölümüne eklenmiş olmalı
   (ilk abonelik sürümle birlikte incelenir). RevenueCat'te ürünler + `fresh`/`balance` yetkileri + `default` teklif bağlı.
5. Hesabın günlük AI hakkını sıfırla (yeni kullanıcı = Ücretsiz, günde 2) — inceleme sınır ekranını da görebilsin diye ek hak verme.
   Koç deneme sayacı da sıfır olmalı (Ücretsiz/Fresh'te 3 deneme mesajı; `coach_trial_free`), Koç AI izni (`ai_coach`) verilmemiş olmalı —
   inceleyici izin sheet'ini görsün. `coach_daily_balance` = 30 (`app_settings`) canlıda teyit.
6. `coach-chat` edge function yayında ve AI sağlayıcı anahtarı tanımlı (YAYIN_KONTROL A); inceleme hesabıyla TestFlight'ta bir Koç mesajı dene.

## 1. App Store Connect › App Review Information
| Alan | Değer |
|---|---|
| Sign-in required | Yes |
| User name | `apple@inceleme.eatkcal.com` |
| Password | `[İLTER]` (inceleme hesabının uygulama şifresi — giriş ekranında yalnız bu adres için şifre alanı açılır) |
| Contact first / last name | `[İLTER]` |
| Contact phone | `+90 232 332 21 00` (KURUMSAL_KIMLIK tek biçim) · teyit `[İLTER]` |
| Contact email | `info@eatkcal.com` |
| Attachment | İsteğe bağlı: 60 sn ekran kaydı (şifreyle giriş → fotoğraf tarama → ses → Koç (deneme mesajı) → paywall → hesap silme yeri) |

**Notes (EN — forma yapıştır, `[İLTER]` yerlerini doldur):**
```text
Thank you for reviewing KCAL 1.1.0.

SIGN-IN (review account signs in with a password)
1. Launch the app and tap "I already have an account".
2. Enter apple@inceleme.eatkcal.com in the Email field. For this review address a Password field appears (regular users get a one-time email code instead).
3. Enter the password from the Password field above and tap "Sign in with password".
Sign in with Apple and Google also work, but the review account above has every 1.1.0 feature enabled.

AI FOOD LOGGING (center "Scan" tab)
- Photo: frame a plate (or pick one from the gallery) and take the photo. Before the first analysis the app asks once for permission to send the photo and note to our AI provider. The result lists each food with estimated grams, calories and macros; edit grams or portions, then tap the lime "Log to …" button (meal name, e.g. Lunch).
- Voice: switch the mode bar to "Voice", allow Microphone and Speech Recognition, and say e.g. "a bowl of lentil soup and a glass of ayran". Speech is turned into text by the phone's speech recognition; no audio is recorded or sent to us. Tap "Done" and the text is split into items like a photo result.
- Barcode and Manual modes are in the same mode bar.
The free plan includes 2 AI scans per day (photo and voice share this allowance). After the second scan a limit sheet offers the plans.

KCALAI COACH (nutrition and daily tracking chat)
- What it is: a chat coach for nutrition and daily tracking. It reads the user's logged day (calories, macros, water) and replies with short suggestions: meal ideas that fit the calories left, recipes from Explore, an eatkcal meal (only for users in İzmir), and weekly chart cards. The user always decides what to add; the Coach never logs anything by itself.
- Where: Home tab > "Ask your coach" card, or Profile tab > "AI Coach".
- Allowance: kcalAI Balance includes 30 Coach messages per day (reset at 00:00). Free and Fresh accounts get 3 trial messages in total; after that an upgrade sheet offers Balance. The review account starts on Free, so you can send 3 messages without buying.
- To test the full allowance: buy kcalAI Balance with your sandbox Apple ID (see SUBSCRIPTIONS); the pill at the top of the chat then shows "Today 30/30".
- Before the first message the app asks for a separate permission: the user's messages and a daily tracking summary are sent to our AI provider (United States) to write the reply. If the user declines, nothing is sent. It can be withdrawn in Profile > Privacy > Data and ad permissions.
- No medical advice: the chat shows "Coach doesn't give medical advice." under the input. Questions about symptoms, medication, blood sugar or eating disorders get a "Talk to a professional" reply that points to a doctor or dietitian (and the local emergency number if the user feels unwell) instead of advice.
- Try: "How am I doing today?", "What should I have for dinner?", "Summarise my week".

SUBSCRIPTIONS (auto-renewable, group "kcalAI")
- kcalAI Fresh: 10 AI scans/day, monthly or yearly. kcalAI Balance: 50 AI scans/day plus kcalAI Coach (30 messages/day), monthly or yearly. Yearly plans include a 7-day free trial.
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
- AI data permissions are separate and asked in-app before first use: photo/voice analysis, and kcalAI Coach.
- Each system permission is requested only when the related feature is used: Camera (Scan), Microphone + Speech Recognition (Voice), Location while using (only when the user taps "Use my location" for an eatkcal address), Notifications (optional reminders). Photos are picked with the system photo picker.
- Profile > Privacy: usage and ad measurement switches. Account deletion: Profile > Security > Delete account.

HEALTH
Calorie and nutrition values and Coach replies are estimates and general information, and the app says they are not medical advice. The Coach does not diagnose or treat. No HealthKit. Users must be 18 or older.
```

## 2. Google Play Console › Uygulama içeriği › Uygulama erişimi
- "Uygulamanın tamamı veya bir kısmı kısıtlı" → **Talimat ekle**:
  - Ad: `İnceleme hesabı (şifreyle giriş)`
  - Kullanıcı adı: `apple@inceleme.eatkcal.com` · Parola: `[İLTER]` (uygulama şifresi; Play için ayrı adres istenirse `review@inceleme.eatkcal.com`)
  - Diğer bilgiler: yukarıdaki EN metnin **SIGN-IN**, **KCALAI COACH** ("sandbox Apple ID" yerine "Play license testing"), **SUBSCRIPTIONS** ("App Store sandbox" yerine "Google Play license testing / test card"
    yazılır; Play'de lisans test hesabı olarak inceleme Gmail'i eklenmez — Google kendi test kartını kullanır) ve **EATKCAL** bölümleri.
- Abonelik testi: Play Console › Ayarlar › Lisans testi listesine iç test hesapları; inceleme için ek işlem gerekmez.

## 3. Kontrol (gönderimden hemen önce, TestFlight / iç test derlemesinde)
| # | Adım | Beklenen |
|---|---|---|
| 1 | Giriş ekranına inceleme adresi | Şifre alanı + "Şifreyle giriş" açılır; doğru şifreyle giriş, yanlışta "E-posta ya da şifre yanlış." |
| 2 | Tara › Fotoğraf | İlk analizde AI izni sheet'i, sonra sonuç; "Logla" çalışır |
| 3 | Tara › Ses | Mikrofon + konuşma tanıma izni bir kez; döküm → öğeler |
| 4 | 3. AI tarama | Sınır sheet'i → "Planları gör" → paywall (fiyatlar mağazadan) |
| 5 | Sandbox satın alma + Geri yükle | Hak hapı 10/50'ye çıkar; geri yükleme mesajı |
| 6 | eatkcal › yukarıdaki adres | Bölge içinde; sepet → ödeme ekranına kadar (ÖDEME YAPMA) |
| 7 | Ana sayfa "Koçuna sor" kartı + Profil › AI Koç | İkisi de görünüyor ve Koç'u açıyor; "yakında" satırları **görünmüyor** |
| 7a | Koç › ilk mesaj (Ücretsiz) | Ayrı AI izni sheet'i ("kcalAI Koç ve yapay zekâ"); kabulde yanıt gelir, hap "Deneme 2/3" |
| 7b | 4. Koç mesajı (Ücretsiz) | Balance'a geçiş sheet'i; Balance sandbox alımından sonra hap "Bugün 30/30" |
| 7c | "Kan şekerim düşük, ne yapmalıyım?" | "Bir uzmana danış" yanıtı; tıbbi tavsiye yok; giriş altında "Koç tıbbi tavsiye vermez." |
| 7d | Koç tanıtım ekranı | "Yakında" rozeti **olmamalı** (bugünkü kodda var — SORULAR 1) |
| 8 | Profil › Güvenlik › Hesabımı sil | Ekran açılır (silme yapma) |
