# G20-S3 — Hukuk ve mağaza boşluklarını kapat · LOG (9 Kas)
Dal `night20/fix` (taban `night20/store` @ 66b4eb4) · worktree `.claude/worktrees/g20-s3`. Kaynak: `legal/global` › `docs/legal/BOSLUKLAR.md` (B-08…B-11), G20-S1/S2 LOG SORULAR.
Canlı DB okuması (Supabase MCP) bu oturumda **reddedildi** → canlı durum görev metnindeki "Claude 9 Kas" notlarından + `CANLI_SEMA_2026-11-09.md`'den alındı.

## ÖZET (10 satır)
1. md.0–1: Belge adları canlı slug'larla tek kaynak (`src/lib/legal/slugs.ts`): `kullanim-kosullari`, `gizlilik-politikasi`, `kvkk`, `mesafeli-satis` — rıza bloğu, ayar sayfası, Sözleşmeler, ödeme ekranları, `user_consents.doc_slug`, `my_consent_status` eşleşmesi, testler. G20-S1 migration dosyası canlıyla eşitlendi (ai_photo/scan, `my_consent_status().ai_photo`, idempotent CHECK).
2. md.2: Tara'da ilk taramadan önce BİR KEZ "Fotoğraf analizi" sheet'i (Final sheet dili): "Tabak fotoğrafın kalori tahmini için yapay zekâ hizmet sağlayıcımıza (ABD) gönderilir" + Kabul et / Vazgeç. Kabul → cihaz + `user_consents` (ai_photo, scan). Vazgeç → Elle gir. İzin yokken çekim/galeri/tekrar dene/çevrimdışı kuyruk fotoğraf GÖNDERMEZ. Profil › Gizlilik › Veri ve reklam izinleri'nde geri alma anahtarı.
3. md.2b: Hesap ekranında Apple/Google/e-posta için ZORUNLU onay kutusu (Koşullar + Gizlilik + 18+ tek kutu); işaretlenmeden üç düğme pasif. E-posta sheet'i ve "Ayrıntılar" sheet'i AYNI kutuyu gösterir. Reklam ölçümü anahtarı ayrı ve AÇIK gelir (değişmedi).
4. md.3: Girişten önce bayrak: `get_anon_features` migration DOSYASI (anon çağrılabilir, cihaz kovası, kural get_my_features ile aynı); FlagsProvider oturumsuzken bunu en çok 2,5 sn bekler (splash açık), hata → önbellek/varsayılan.
5. md.4: Destek ekleri: `getPublicUrl` kalktı; talepte yalnız yol (`support_tickets.attachments`), mesajda URL yok; geçmişte "Ek N" → 300 sn imzalı URL. Eski talepteki public URL'ler yola çevrilip imzalı açılır. Kova migration'ı repo eşitlemesi.
6. md.5: İnceleme hesabı — istemci değişikliği GEREKMEDİ; Supabase test OTP yalnız telefon için var (e-posta için yok) → yapılandırma seçenekleri aşağıda (şifre/kod yazılmadı).
7. md.6: Pazarlama bildirimi varsayılan KAPALI: ilk bildirim izni sheet'inde ayrı kutu (işaretsiz), ayar ekranları `false`, send-notification satır yoksa pazarlama göndermez, migration (default false + yeni satır kapalı; mevcut tercih korunur). 18+ beyanı `profiles.onboarding_state.age_ok` (+`age_ok_at`); eski girişte kutu artık cihaz kaydına bakıp atlanmaz.
8. md.7: `delete-account`: Storage (avatars, user-media, post-media + gönderi medya yolları, support-attachments) + ilişkili kayıtlar (destek talepleri, gönderiler, takip, jeton, bildirim, olaylar silinir; e-posta/adres metni boşalır; sipariş il/ilçe/mahalle + external_payload). `cleanup.ts` saf + testli. support_tickets FK CASCADE migration. kcalculate.ai silme sayfası notu `docs/legal/HESAP_SILME_SAYFASI.md`.
9. Kontroller: tsc 0 · hygiene ✓ · unit 874 (873 ✓, 1 atlandı, 0 ✗; i18nKeys TR/EN eksik 0, noLegacyWhenFlagsOn ✓) · bileşen 47 takım / 278 ✓, snapshot 2/2 · expo export iOS ✓ / Android ✓ · `deno check` delete-account + send-notification ✓.
10. Eski tasarım: 0 · "₺" yeni metinde 0 · yeni metinler TR + EN.

## Commit tablosu
| Commit | Madde | İçerik |
|---|---|---|
| `b02da89` | 0 · 1 | `lib/legal/slugs.ts`, contractsData slug'ları, policy/store `DOC_SLUG`, LegalDocModal/ConsentBlock/ayar/onboarding/ödeme ekranları, G20-S1 migration canlıyla eşit, testler |
| `f834721` | 2 · 2b · 6 (18+) | `lib/consent/aiPhoto.ts`, ConsentSheet `ai_photo` kipi, ScanScreen bekçileri, drainPending bekçisi, ayar anahtarı; `PolicyAcceptRow` (18+), Hesap ekranı zorunlu kutu, e-posta sheet'i ortak kutu, `saveAgeOk` (onboarding_state.age_ok), eski giriş 18+; testler |
| `ad8741b` | 3 | `get_anon_features` migration + rollback, FlagsProvider anonim yol, AppNavigator splash bekçisi; testler |
| `f64c1f4` | 4 | `lib/support/attachments.ts`, iki destek ekranı, `profil.support_attachment*` TR/EN, kova migration (repo eşitleme) + rollback; testler |
| `0f1a82e` | 6 (pazarlama) | `lib/notify/marketing*.ts`, NotifyPermissionSheet ayrı kutu, iki ayar ekranı, `send-notification/prefs.ts`, migration + rollback; testler |
| `6572c43` | 7 | `delete-account/cleanup.ts` + index.ts, support_tickets FK migration + rollback, silme sayfası notu; testler |
| (bu) | 8 | LOG |
| (son) | — | `docs/night/G20-S3-DONE` |

## KARAR
1. **İç anahtar / canlı ad ayrımı**: cihaz kaydı (`@kcal_consent_policy`) iç anahtarları `terms`/`privacy` olarak kaldı (yalnız cihaz içi); sunucuya giden/gelen her ad canlı slug (`DOC_SLUG`). Eski adla gelen gezinme parametresi `normalizeLegalSlug` ile doğru belgeye düşer.
2. **contractsData slug'ları da canlı adlara çevrildi** (tek kaynak); ödeme ekranlarındaki `ProfileContracts` bağlantıları `LEGAL_SLUG` ile.
3. **AI izni her iki kabukta** (eski + yeni Tara): Apple 5.1.2(i) gönderilen derlemenin tamamı için geçerli; bayrak kapalı parite burada uyum gereği bozuldu (yalnız izin sheet'i; izin verildikten sonra ekranlar aynen). Karartma / X / geri = Vazgeç. Tara'da Vazgeç cihaz kaydı YAZMAZ (sonraki taramada yeniden sorulur, `user_consents`'e `granted=false` satırı yazılır); ayardan kapatma kalıcı. Sunucu okunamazsa SORULUR (fail-open yok).
4. **AI izni metnine not cümlesi eklendi**: "Eklediğin not da fotoğrafla birlikte gönderilir." (kod notu da gönderiyor — G20-S2 SORULAR 1). Görev metni aynen ilk cümle.
5. **18+ ve politika tek kutu**: eski giriş ekranındaki "18 yaşından büyüğüm ve kullanım koşullarını kabul ediyorum" diliyle aynı yaklaşım ("18 yaşından büyüğüm; Kullanım Koşulları'nı ve Gizlilik Politikası'nı okudum, kabul ediyorum."). Tekrar kabul (reconsent) / bilgilendirme kutusu 18+ İÇERMEZ.
6. **Eski giriş ekranında 18+ kutusu her girişte** (B-10 "cihazda daha önce işaretlendiyse gösterilmiyor"); metin aynen; beyan hesaba yazılır.
7. **Hesap ekranında "Devam ederek … kabul edersin" satırı kalktı**, yerine aynı konumda zorunlu kutu (helper dili). `onboarding.account.legal_*` anahtarları sözlükte duruyor (başka yerde kullanılmıyor).
8. **Anonim bayrak kovası** ayrı rastgele cihaz kimliğiyle (`kcal.flags.device.v1`, analitik anon_id'den AYRI, sunucuda saklanmaz). Kullanıcı kilitleri (unlock) anonimde yok. %100 dışındaki yüzdelerde girişten önce cihaz, sonra kullanıcı kovası geçerli.
9. **Splash bekleme yalnız oturumsuz açılışta** ve en çok 2,5 sn; oturumlu açılış bugünkü gibi.
10. **Destek mesajında URL yok**, yerine "--- Ekli Görseller (N) ---" satırı (eski panel en azından ek olduğunu görsün). Yollar `attachments` jsonb'de.
11. **Pazarlama onayı `user_consents`'e yazılmadı**: canlı CHECK listesinde `marketing` yok; kuyruktaki tek geçersiz satır bütün bekleyen rıza satırlarını tıkardı. Kayıt `notification_preferences.marketing_enabled` + `updated_at`. ETK/İYS kaydı için SORULAR 4.
12. **Yeni bildirim tercih satırı kapalı başlar** (INSERT tetikleyicisi): yeni kullanıcı satırını açan `create_notification_preferences_for_user()` gövdesi repoda yok; değeri ne yazarsa yazsın pazarlama kapalı başlar. Açık onay yalnız UPDATE ile.
13. **Silmede gönderiler SİLİNİR** (anonimleştirme değil) ve medya nesneleri kaldırılır; başka kullanıcıların alıntı/yanıt FK'leri engellerse adım hata loglar, silme sürer.
14. **analytics_events kullanıcı satırları silinir** (anon_id ile bağlanabilir kişisel veri; KVKK silme).

## md.5 — App Review inceleme hesabı (yapılandırma, istemci değişikliği YOK)
- İstemcide e-posta girişi yalnız **e-posta kodu** (`signInWithOtp` + `verifyOtp`); şifre ve telefon girişi yok.
- **Supabase "test OTP" yalnız TELEFON için** var (Dashboard › Authentication › Providers › Phone › "Test Phone Numbers and OTPs" / `config.toml [auth.sms.test_otp]`). E-posta için sabit kod ayarı YOK → `review@eatkcal.com` ile sabit kod istemci değişikliği olmadan mümkün değil.
- Seçenekler (İlter kararı; Dashboard auth ayarı ONAYSIZ YASAK, yapılmadı):
  - **A (önerilen)** `review@eatkcal.com` gerçek posta kutusu (Google Workspace/Zoho yönlendirmesiz); App Store Connect › App Review Information › Notes'a webmail giriş bilgisi **yalnız orada** yazılır (repo/dosya/LOG'a değil). İnceleme ekibi kodu kendisi okur. İnceleme bitince şifre değiştirilir.
  - **B** İnceleme notunda "Apple ile Giriş'i kullanın" (inceleme Apple Kimliği ile hesap açar) + bayraklar o sürüm için açık. Demo veri yoksa ekranlar boş görünebilir.
  - **C** Telefon test OTP'si — istemciye telefon girişi eklemek gerekir (yeni ekran/akış) → bu gece yapılmadı.
  - Reddedilen: sabit kodla oturum açan özel edge function (hesap ele geçirme riski).
- Her seçenekte: `review@` hesabı silme testi için ayrı ikinci hesap (silme geri alınamaz).

## Admin paneli notu (md.4) — eski panel yalnız okundu, değiştirilmedi
- Yeni talepler: mesajda URL YOK; ekler `support_tickets.attachments` (jsonb, `["tickets/<uid>/<zaman>_<ad>", …]`).
- Panel gösterimi: her yol için `supabase.storage.from('support-attachments').createSignedUrl(path, 300)` (admin, `is_admin()` okuma politikası). Eski talepler: mesajdaki `/object/public/support-attachments/<yol>` URL'lerinden yol çıkarılıp aynı şekilde imzalanmalı (kova özel → public URL'ler artık açılmaz). Mantık: `src/lib/support/attachments.ts` (`ticketView`, `pathFromStorageUrl`).

## CANLIYA UYGULANACAK (sırayla; hepsi idempotent, rollback'li — UYGULANMADI)
1. `20261109210100_g20_s1_user_consents.sql` — **canlıda zaten var** (Claude 9 Kas). Dosya canlıyla eşitlendi; yeniden çalıştırmak güvenli (CHECK listeleri ai_photo/scan ile yeniden kurulur, `my_consent_status` ai_photo döner). Kontrol: `select slug, version, requires_acceptance from legal_documents order by slug;` → kullanim-kosullari / gizlilik-politikasi `true`.
2. `20261109220100_g20_s3_anon_features.sql` — `get_anon_features` (anon). İstemci yokken fail-open (bugünkü davranış).
3. `20261109220200_g20_s3_support_attachments_private.sql` — **canlıda zaten uygulandı** (kova özel); repo eşitlemesi. Uygulamadan önce canlı politika adını karşılaştır (dosya başında sorgu).
4. `20261109220300_g20_s3_marketing_optin.sql` — default false + yeni satır kapalı tetikleyici. Mevcut satırlar değişmez.
5. `20261109220400_g20_s3_account_deletion.sql` — support_tickets.user_id FK → ON DELETE CASCADE (FK adı dinamik).
6. Backend dosyaları (supabase/) main'e cherry-pick İlter onayıyla (CLAUDE.md).

## DEPLOY GEREKİR
- **Edge function** (onaysız yapılmadı): `delete-account` (index.ts + yeni `cleanup.ts`), `send-notification` (index.ts + yeni `prefs.ts`). İkisi de `deno check` ✓.
- **OTA (JS) ile gidebilir**: bütün istemci değişiklikleri (slug'lar, AI izni, zorunlu kutu, 18+, anonim bayrak, destek ekleri, pazarlama kutusu). `eas update --channel production` onaysız YASAK — yapılmadı. Not: anonim bayrak migration'ı (2) OTA'dan ÖNCE uygulanırsa yeni kurulumlar ilk açılışta doğru yola gider; sonra uygulanırsa da zararsız.
- **Native/yeni derleme gerekmez** (yeni paket/izin yok).
- **Web**: kcalculate.ai `/account-deletion` sayfası (`docs/legal/HESAP_SILME_SAYFASI.md`), admin paneli imzalı ek gösterimi.

## Kontroller (md.8)
| Kontrol | Sonuç |
|---|---|
| `tsc --noEmit` | 0 hata |
| `npm run hygiene` | OK |
| `npm run test:unit` | 874 · 873 ✓ · 0 ✗ · 1 atlandı (tabandaki) — i18nKeys (TR/EN eksik 0), noLegacyWhenFlagsOn, consentFlagParity dahil |
| `jest` (bileşen) | 47 takım · 278 ✓ · snapshot 2/2 (ScanScreen.flagParity, TrackerScreen.flagOff) |
| `expo export` iOS / Android | ✓ / ✓ (`EXPO_NO_DOTENV=1`, çıktı iş geçici dizininde, ~14 MB) |
| `deno check` | delete-account/index.ts ✓ · send-notification/index.ts ✓ |
| "₺" (yeni metin) | 0 |
| EN | AI sheet, 18+ kutu, pazarlama kutusu, ek bağlantısı, ayar anahtarı — hepsi TR + EN sözlükte; EN bileşen testi (g20s3Consent) |

Yeni testler: `legalSlugs` (4), `consentPolicy` (+1, slug), `g20s3Gates` (6), `anonFeatures` (2), `supportAttachments` (5), `marketingOptIn` (4), `deleteAccountCleanup` (7) · bileşen: `g20s3AiPhoto` (4), `g20s3Consent` (9), `anonFlags` (6), `g20s3Support` (2), `g20s3NotifyMarketing` (3).
Not: ilk jest koşusunda TrackerScreen snapshot'ı yalnız `testUri` yolu yüzünden düştü (node_modules sembolik bağı g20-s1'e gidiyordu); node_modules APFS klonuna çevrilip önbelleksiz koşuda geçti — kod farkı değil.

Eski tasarım: 0

## Tasarım farkları (Final'e göre, dayanağı görev maddesi)
| Pano | Fark | Dayanak |
|---|---|---|
| FinOnbAccount | alt yazı "Devam ederek … kabul edersin" → aynı yerde zorunlu onay kutusu (18+ dahil); kutu işaretsizken üç düğme Final'in pasif gri hâli | md.2b İlter kararı |
| FinOnbAccountEmail | rıza bloğundaki kutu metni 18+ içerir; Hesap ekranındaki kutuyla ortak | md.2b + md.6 |
| (yeni) Fotoğraf analizi sheet'i | Final'de pano yok; FinOnbAccountEmail sheet dili (yüzey, başlık, X, lime/chip düğme) | md.2 "mevcut Final sheet dili" |
| FinSheetNotify | başlık/metin altında pazarlama onay kutusu (işaretsiz) | md.6 "ilk bildirim izniyle birlikte ayrı onay" |
| FinPrSupport (geçmiş) | talep metni altında "Ek 1 · Ek 2" bağlantıları | md.4 imzalı URL gösterimi |
| Veri ve reklam izinleri | "Yapay zekâ" bölümü + Fotoğraf analizi anahtarı (aynı satır dili) | md.2 izin geri alınabilir olmalı (KVKK md.5) |

## SORULAR
1. **Canlı DB okunamadı** (MCP reddedildi): görev metnindeki canlı durum varsayıldı. Özellikle (a) canlı `user_consents` CHECK adları `user_consents_kind_check` / `_source_check` değilse migration 1 yeniden çalıştırılırken eski kısıt kalır — uygulamadan önce `select conname from pg_constraint where conrelid='public.user_consents'::regclass;`; (b) support-attachments canlı politika adı.
2. **Hukuki metin onayı**: AI izni metni (+ not cümlesi), 18+ birleşik kutu metni, pazarlama kutusu metni ("Kampanya ve fırsat bildirimleri de gelsin") — avukat/İlter okuması. AI sağlayıcısının adı (Anthropic) metinde YOK ("yapay zekâ hizmet sağlayıcımız (ABD)"); Gizlilik Politikası'nda adıyla geçmeli (B-01 yurt dışı aktarım).
3. **İnceleme hesabı** (md.5): A / B / C seçimi İlter'de. A seçilirse posta kutusu kurulumu + App Store Connect notu İlter tarafından.
4. **ETK / İYS** (B-11): pazarlama onayı için 3 yıllık ispat kaydı isteniyorsa `user_consents` kind CHECK'ine `marketing` (+ source `notify`) eklenmeli; o zaman istemci satır yazar. Push'un ETK kapsamı avukat sorusu (BOSLUKLAR 333 §4).
5. **Eski kabuk bildirim kartı** (`PushPermissionPrompt`, "Sana özel indirimleri kaçırma") pazarlama diliyle izin istiyor ama artık pazarlama varsayılan kapalı → izin veren kullanıcıya kampanya gitmez. Eski kabuk metni değiştirilmedi (parite); yeni kabuk açılınca sorun kalmaz. İstenirse eski karta da aynı kutu eklenebilir.
6. **Doğum yılı kontrolü** (B-10 madde 3–4: "hesap oluşturamıyoruz… hiçbir bilgin kaydedilmedi" gerçeğe aykırı metin, 18 altı beyanında hesabın silinmesi) bu oturumun kapsamı dışında kaldı.
7. **Silmede kalanlar** (B-09): Adisyo ham günlükleri, cihazdaki AsyncStorage verisi, Meta veri silme talebi — ayrı iş. `order_modifications.user_id` NOT NULL ve FK'si bilinmiyor; ON DELETE yoksa deleteUser yine engellenebilir → canlıda `\d order_modifications` kontrolü.
8. **Anonim kova ↔ kullanıcı kovası**: %10/%50 dalgalarında yeni kurulumun onboarding'i cihaz kovasına, girişten sonra kabuk kullanıcı kovasına göre çözülür; tutarlı deneyim istenirse dalga planında onboarding bayrağını doğrudan %100'e almak önerilir (YAYIN_KONTROL R1 notu bu dalla kapatılabilir).
9. **Simülatör çekimi yapılmadı** (G20-S1 SORULAR 5 ile aynı engel: Erişilebilirlik izni yok, disk 10 GB). Kanıt birim + bileşen testleri.
