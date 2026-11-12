# G20-S1 — Rıza ve politika akışı + açık hatalar · LOG (9 Kas)
Dal `night20/consent` (taban `night19/release` @ da8edf4) · worktree `.claude/worktrees/g20-s1` · simülatör "G20-1 iPhone" (G19-4 klonu, B36E75B6…) · Metro `--port 8121`.

## ÖZET (10 satır)
1. Hesap oluşturma (FinOnbAccount): Apple/Google düğmelerinin altında mevcut "Devam ederek Koşullar ve Gizlilik'i kabul edersin." satırı artık BAĞLANTILI + yeni kısa satır "Reklam ölçümü (Meta) açık. Ayrıntılar" → ayrıntı sheet'i (aynı blok).
2. E-posta sheet'i: "Kod gönder" öncesi tek blok — Kullanım Koşulları + Gizlilik Politikası kabulü (onay kutusu, ZORUNLU), KVKK Aydınlatma Metni (bilgi bağlantısı), "Reklam ölçümü (Meta)" anahtarı AÇIK gelir, kapatılabilir.
3. Mevcut kullanıcı: bir sonraki açılışta BİR KEZ bilgilendirme sheet'i (aynı içerik, "Devam et"); yeni belge sürümünde tekrar kabul sheet'i (onay kutusu zorunlu, kapatılamaz).
4. Sıra: politika bloğu → ATT. Yeni arayüz bayrağı açıkken Meta SDK + ATT artık açılışta değil, kabulden ve girişten SONRA (`ConsentGate`). ATT reddi = Meta kapalı (+ `user_consents` satırı). Reklam ölçümü kapalıyken Apple ATT sorusu hiç gösterilmez.
5. Profil › Gizlilik › "Veri ve reklam izinleri": kullanım ölçümü + reklam ölçümü (Meta) aç/kapa (`setFirstPartyConsent` / `setAdConsent`), iOS'ta açınca ATT, red → "iPhone Ayarları'nı aç"; Koşullar / Gizlilik / KVKK bağlantıları.
6. Migration DOSYASI (uygulanmadı) `20261109210100_g20_s1_user_consents.sql` + rollback: `legal_documents.version` + `requires_acceptance`, `user_consents` (yalnız ekleme, RLS kendi satırı), `my_consent_status()`.
7. md.4: Keşfet'te tek toast (kabuk ikinci toast çizmez); "Geri al" `meal_consumptions` satırını SİLER, silinemezse söylenir. Kabuk toast'ının yanıltıcı "Geri al"ı yalnız gerçek `undo` verilirse görünür.
8. md.4: Tara "kullanılamıyor" kartı FinErrLimit diliyle (saat ikonu + üst durum hapı "Tara geçici olarak kapalı"; İlter metni aynen). Kamera izin metni denetlendi (aynı, testli); ATT amaç metni rıza bloğuyla hizalandı (TR/EN).
9. Kontrol: tsc 0 · unit 837 (836 ✓, 1 atlandı, 0 ✗) · bileşen 42 takım / 254 ✓, snapshot 2/2 · hygiene ✓ · i18n eksik 0 · "₺" 0 · expo export iOS ✓ 10,3 MB / Android ✓ 10,4 MB.
10. Bayrak kapalı parite: iki bayrak (yeni_onboarding, yeni_kabuk) kapalıyken Meta/ATT bugünkü gibi açılışta, eski kabuk giriş/kayıt ekranları ve onay metinleri AYNEN (statik + bileşen testi). Eski tasarım: 0.

## Commit tablosu
| Commit | Madde | İçerik |
|---|---|---|
| `36893c1` | 1 · 2 · 3 | `lib/consent/{policy,store,i18n}.ts`, `ConsentBlock` / `ConsentSheet` / `ConsentGate` / `LegalDocModal`, Hesap ekranı + e-posta sheet'i, `SettingsDataConsentScreen`, Gizlilik satırı, App.tsx kapı, analytics `initFBSDK({onAtt})` + `requestAttForAds`, migration + rollback |
| `81981ac` | 4 | tek toast (`ownToast`, `undo`), Keşfet geri al hata toast'ı, Tara kullanılamıyor kartı, ATT amaç metni (app.config + locales TR/EN) |
| `fb5ee93` | 5 | testler: `consentPolicy` (12), `consentFlagParity` (5), `g20Consent` (14), TabBarR3 tek toast (3), analyticsAtt güncel + 2 yeni, first.test kabul zorunluluğu |
| `2f7162c` | 5 | vitrin kayıtları FinConsentData / FinConsentDetails / FinConsentNotice / FinConsentReconsent / FinErrUnavailable |
| (bu) | — | LOG |
| (son) | — | `docs/night/G20-S1-DONE` |

## Akış (bayrak açık)
| Durum | Kapı kararı | Ne olur |
|---|---|---|
| Hesap yok, cihaz kaydı yok | bekle | ATT sorulmaz; Karşılama → Hesap |
| Apple/Google başarı | (kapı tutulur) → kabul `signup_social` | cihaz kaydı + bekleyen satırlar → oturumda `user_consents`'e yazılır → ATT |
| E-posta: onay kutusu + kod doğrulandı | (kapı tutulur) → kabul `signup_email` | aynı |
| Oturum var, hiç kabul yok (mevcut kullanıcı) | notice | bilgilendirme sheet'i bir kez → kabul `notice` → ATT |
| Sunucu sürümü > kabul edilen | reconsent | onay kutusu zorunlu → kabul `reconsent` (sunucunun gördüğü sürüm) → ATT |
| Başka cihazda kabul (sunucu) | hazır | cihaza yazılır, sheet yok |
| Sunucu okunamadı (migration yok / çevrimdışı) | yalnız cihaz kaydı | fail-open, kullanıcı kilitlenmez; satırlar cihazda bekler, sonraki açılışta yazılır |

## KARAR
1. **Kabul biçimi**: e-postada onay kutusu (zorunlu, "Kod gönder" öncesi); Apple/Google'da düğmeye basmak = "Devam ederek … kabul edersin" satırıyla kabul (görev: "düğmelerin altında kısa satır + ayrıntı sheet'i"). Ayrıntı sheet'inde onay kutusu yok, yalnız bilgi + Meta anahtarı.
2. **Kapı bayrağı** = `yeni_onboarding || yeni_kabuk`. İkisi kapalı → bugünkü davranış (Meta/ATT açılışta; `adConsent` 'unset' = iOS ATT'ye bağlı, Android açık). Yeni kabuk açık ama yeni onboarding kapalıysa (eski giriş ekranı) giriş sonrası bilgilendirme sheet'i gelir.
3. **ATT zamanı**: kabul + oturumdan sonra (Apple/Google giriş sheet'inin üstüne binmesin diye hesap oluşturma sırasında kapı tutulur). Misafir (girişsiz) kullanıcıya bayrak açıkken ATT sorulmaz → iOS'ta misafirde Meta kapalı.
4. **Reklam ölçümü kapalıyken ATT sorulmaz** (yalnız durum okunur). Ayarlar'dan açınca sorulur; ATT reddi → uygulama içi rıza da 'denied' kaydedilir (tek doğru, anahtar kapalı görünür).
5. **Meta varsayılanı AÇIK** (İlter 9 Kas): blokta ve bilgilendirmede anahtar açık gelir; kabulde `setAdConsent('granted')`. `consent.ts` › `metaAllowed` değiştirilmedi ('unset' yalnız bayrak kapalı yolda kalır).
6. **Sürümler**: `legal_documents.version` (migration ekler, varsayılan 1). Zorunlu belgeler `terms`, `privacy` (`requires_acceptance`); `kvkk` yalnız bilgilendirme. Slug'lar `contractsData.ts` ile aynı varsayıldı (canlı okuma reddedildi, `S1-DB_AUDIT`: 4 satır).
7. **Belge gösterimi**: bağlantılar Final Sözleşmeler ekranını (FinPrAgreements, metin kaynağı `contractsData.ts`) tam ekran Modal'da açar; alttaki form (e-posta, anahtar) korunur. `legal_documents.content` istemcide okunmuyor (bugünkü gibi).
8. **Tek toast**: Keşfet uçuşu `ownToast: true` + `id` taşır → kabuk yalnız uçuş + rozet. Kabuk toast'ında "Geri al" yalnız kaynak gerçek silen `undo` verirse (Tara/eatkcal bugün vermiyor → düğme yok; önceden yalnız rozeti azaltıyordu).
9. **Tara kullanılamıyor**: İlter'in cümlesi başlıkta aynen (G19-S4 KARAR 4); FinErrLimit dili = saat ikonu + üst hap + "Elle gir" / "Tamam".
10. **ATT amaç metni**: "daha alakalı reklamlar" → "Reklam kampanyalarımızın etkisini ölçmek için…" (kişiselleştirme yapılmıyor; App Store 5.1.1/5.1.2 doğruluğu). EN `locales/en.json` `NSUserTrackingUsageDescription`.

## Bayrak kapalı parite
- Statik (`consentFlagParity`): eski kabuk (`onboarding/v2`, `src/screens`) rıza modüllerini import etmez; eski onay metni yerinde; App.tsx doğrudan `initFBSDK` çağırmaz, kapı `!flagsOn` → `startMeta(false)`.
- Bileşen (`g20Consent`): iki bayrak kapalı → `initFBSDK()` argümansız, sheet yok. Bayraklar hazır değilken ATT sorulmaz.
- Snapshot 2/2 (ScanScreen.flagParity, TrackerScreen.flagOff) değişmedi. `noLegacyWhenFlagsOn` ✓ → Eski tasarım: 0.

## Kontroller (md.5)
| Kontrol | Sonuç |
|---|---|
| `tsc --noEmit` | 0 hata |
| `npm run test:unit` | 837 · 836 ✓ · 0 ✗ · 1 atlandı (tabandaki) — i18nKeys (TR/EN eksik 0), g17Keys (" · " ayracı 0), noLegacyWhenFlagsOn, screenCatalog dahil |
| `jest` (bileşen) | 42 takım · 254 ✓ · snapshot 2/2 |
| `npm run hygiene` | OK |
| "₺" (arayüz) | 0 |
| `expo export` iOS / Android | ✓ 10,3 MB / ✓ 10,4 MB (çıktı iş geçici dizininde) |
| EN | `g20Consent` EN testi (Data and ad permissions · Ad measurement (Meta) · KVKK Privacy Notice); bütün yeni metinler `consent.*` TR+EN |
| Simülatör çekimi | YAPILAMADI — bkz. SORULAR 5 |

Eski tasarım: 0

## Tasarım farkları (Final'e göre, dayanağı görev md.1–2)
| Pano | Fark | Dayanak |
|---|---|---|
| FinOnbAccount | alt yazıya ikinci satır "Reklam ölçümü (Meta) açık. Ayrıntılar"; Koşullar/Gizlilik dokunulabilir | md.1 "düğmelerin altında kısa satır + ayrıntı sheet'i" |
| FinOnbAccountEmail / Keyboard | "Kod gönder" üstünde rıza bloğu (onay kutusu, KVKK satırı, Meta anahtarı) | md.1 "Devam öncesi tek blok" |
| FinPrivacySettings | Engellenenler ile Hesabı sil arasında "Veri ve reklam izinleri" bölümü + satır | md.2 |
| (yeni) FinConsentData / Details / Notice / Reconsent / FinErrUnavailable | Final'de pano yok; mevcut bileşen dili (Onb sheet, FinPrivacySettings satırı, Notify anahtarı, FinErrLimit kartı) | görev: "tasarım BEKLENMEZ" |

## CANLIYA UYGULANACAK
1. `supabase/migrations/20261109210100_g20_s1_user_consents.sql` (rollback `supabase/rollbacks/20261109210100_g20_s1_user_consents_rollback.sql`). Geriye uyumlu: istemci migration yokken fail-open çalışır (satırlar cihazda bekler, sürüm 1 varsayılır).
2. Uygulamadan sonra kontrol: `select slug, version, requires_acceptance from legal_documents order by slug;` → terms/privacy `true`. Slug'lar farklıysa `requires_acceptance` elle değil yeni migration ile düzeltilmeli.
3. Yeni sürüm yayınlama prosedürü: metni güncelle + `version = version + 1` (migration dosyasıyla) → kullanıcılar bir sonraki açılışta tekrar kabul sheet'i görür. Not: uygulama içi metin bugün `contractsData.ts`'ten (paketle gelir) — sürüm artışı aynı anda OTA ile metin güncellemesi gerektirir.
4. Backend dosyası main'e cherry-pick İlter onayıyla (CLAUDE.md).

## DEPLOY GEREKİR
- **OTA (JS) ile gidebilir**: rıza bloğu, kapı, sheet'ler, izin sayfası, tek toast, Tara kartı. (`eas update --channel production` onaysız YASAK — yapılmadı.)
- **Yeni derleme gerekir**: ATT amaç metni (`NSUserTrackingUsageDescription`, app.config iki eklenti + locales TR/EN) — G20-S2 app.config işiyle birlikte derlemeye girer.
- Edge function değişikliği yok.

## SORULAR
1. **Hukuki metin onayı**: blok metinleri ("…okudum, kabul ediyorum", "Kişisel verilerin KVKK Aydınlatma Metni kapsamında işlenir.", "Reklam ölçümü (Meta) — Kampanyalarımızın etkisini ölçmek için…") ve Meta'nın varsayılan AÇIK gelmesi KVKK açık rıza ilkesiyle (önceden işaretli kutu tartışması) uyumlu mu? İlter kararı uygulandı; L-S1 açık rıza taslağıyla karşılaştırılmalı.
2. **Apple/Google'da kabul biçimi**: onay kutusu yerine "Devam ederek … kabul edersin" yeterli mi? İstenirse Apple/Google'a basınca önce ayrıntı sheet'i (onay kutulu) açılabilir — tek satırlık değişiklik.
3. **Mevcut kullanıcı bilgilendirmesi**: "Devam et" kabul sayılıyor (`source: notice`). Kabul etmeyen için "Çıkış yap / hesabı sil" yolu eklensin mi? Tekrar kabul sheet'i kapatılamaz.
4. **legal_documents slug'ları**: canlı okuma reddedildi; `terms`, `privacy`, `kvkk`, `distance-sales` varsayıldı. Farklıysa migration'daki `update … where slug in ('terms','privacy')` düzeltilmeli.
5. **Simülatör çekimi yapılamadı**: "G20-1 iPhone" klonlandı, Metro 8121 açıldı, ama iOS 26 "Kcalculate ile Açılsın mı?" onayı `osascript` tuşuyla kapanmadı (Erişilebilirlik izni yok; 2 deneme). Dev client 8121'e bağlanamadı. Kanıt birim + bileşen testleri (36 yeni test). Çekim için: Sistem Ayarları › Gizlilik › Erişilebilirlik'te Terminal'e izin + `G14_UDID=B36E75B6-9799-48AA-83C6-24E1F2667845 scripts/dev/g14-shots.sh FinConsentNotice FinConsentDetails FinConsentReconsent FinConsentData FinErrUnavailable FinOnbAccount FinOnbAccountEmail`. Simülatör kapalı bırakıldı; istenirse silinebilir.
6. **Tara toast'ları**: Tara da kendi "kaydedildi" toast'ını gösteriyor ve kabuğa uçuş yayınlıyor; kabuk toast'ında artık "Geri al" yok (silemiyordu). Tara kaydını kabuktan geri almak istenirse ScanScreen uçuşa `id` + `undo` (consumption silme) vermeli — kapsam dışı bırakıldı.
7. **Misafirde ATT**: bayrak açıkken girişsiz kullanıcıya ATT sorulmuyor (iOS'ta Meta kapalı). eatkcal misafir siparişlerinde reklam ölçümü gerekiyorsa misafir için de kısa bilgilendirme eklenebilir.
8. **G20-S2'ye not**: ATT metni bu dalda değişti (`app.config.js` iki yer + `locales/*.json`); izin metinleri işinde üzerine yazılmamalı.
