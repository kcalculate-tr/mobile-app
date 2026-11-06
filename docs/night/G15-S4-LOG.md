# G15-S4 — Profil + Ayarlar + Hatırlatma

## ÖZET (10 satır)
(1) Dal `night15/profil` (taban `night14/visual`), worktree `.claude/worktrees/g15-s4`; ayrı simülatör "G15-4 iPhone", Metro 8094; çekim bitince simülatör `shutdown`.
(2) Profil hub: G14'ün kaldırdığı "Macro aboneliğim" + "Hesap gizliliği" satırları geri geldi, yeni "Hesabım" bölümü + "Rozetlerim" girişi (FinBadges). Macro aboneliğim eski Subscriptions yerine Final "Macro ve Abonelik › Öğün Aboneliği".
(3) FinPrPersonal (avatar solda, gri alanlar, alta yapışık Kaydet), FinPrNotify (ikonlu 4 satır, Final sırası/metni), FinPrSecurity (başlık kartı yok, siyah "Şifreyi güncelle", Hesabı sil satırı; silme akışı aynen), FinPrAgreements (kart başlığı + son güncelleme), FinPrSupport (hat kartı + "Ara", sarmalı çipler, **Görsel ekle geri geldi**), FinPrFeedback (tek kart + alta yapışık Gönder).
(4) FinPrMacro (bakiye kartı + 5 nokta, ödül kartları, Macro geçmişi AYRI ekran, Siparişlerim), "Macro nedir?" gerçek alttan sayfa, FinPrProgress (hap aralık, çubuk grafik, Hedef uyumu + Makro tutarlılığı, makro çubuğu, ölçümler).
(5) FinProfilePublic (kapak, avatar, Takip et, rol çipi, sayaçlar, Tabaklar/Gönderiler ızgarası), FinBadges (doğrulama rozetleri açıklaması), FinPrivacy (Sheet, globe/kilit, radyo), FinPrivacySettings (Final düzeni; "Hesabı sil" artık Güvenlik'e gider — önceden yalnız geri dönüyordu).
(6) Seri hatırlatması: izin verilirse her gün 19:30 yerel bildirim (yeni paket YOK, `expo-notifications`); o gün öğün loglandıysa bugünün bildirimi kurulmaz/iptal, ertesi güne kurulur; 7 günlük ufuk, ana sayfa/öğün sayısı değişince ve izin sheet'inden sonra yeniden eşitlenir; FinPrNotify'da aç/kapa. Saf plan `streakReminderPlan.ts` (4 birim test).
(7) FinSheetNotify metni Final: "Serini korumak için akşam 19:30'da hatırlatayım mı?", gri daire + çizgi zil, sola dayalı.
(8) Kontrol: tsc 0 · test:unit 531/531 (1 atlanmış, önceden) · test:components 90/90 (Tracker flagOff snapshot DEĞİŞMEDİ) · `expo export --platform ios` ✓.
(9) Bayrak kapalı bayt bayt aynı: değişen her yüzey `yeni_kabuk`/celebrate/Fin* arkasında; KİMSE dosyalarına dokunulmadı; yeni paket/migration/eas/DB yazma YOK. Dev-only `vitrin*` prop'ları (Macro, Progress, PublicPreview).
(10) Son commit GERÇEK dosya `docs/night/G15-S4-DONE`.

## Pano tablosu (önce G14 → sonra)
Sonra = G15-S4 simülatör çekimi (`.claude/night/out/g15s4/app/`, Light) + kod incelemesi; Dark panoları aynı bileşenleri temadan kullanır (yeniden çekilmedi — SORULAR #5).
| Pano | Önce | Sonra | Kalan fark |
|---|---|---|---|
| FinPrProfile | küçük | küçük | sayaç kartı (vitrin mock'u yok), Koleksiyon "6/120" değeri (veri yok), +Hesabım bölümü (talimat) |
| FinPrPersonal | büyük | aynı | etiket büyük/küçük harf ("Ad soyad") |
| FinPrNotify | büyük | aynı | — |
| FinPrSecurity | büyük | aynı | placeholder "En az 6 karakter" (Final 8; kural 6 — SORULAR #1); oturum satırı chevron yok |
| FinPrAgreements | büyük | küçük | vitrin çekimi alınmadı (kod: çipler + kart başlığı) |
| FinPrSupport | küçük | küçük | konu çipleri mevcut kategoriler (veri uyumu) |
| FinPrFeedback | küçük | küçük | çipler mevcut kategoriler |
| FinPrMacro | küçük | aynı | — |
| FinPrMacroWhat | büyük | aynı (kod; vitrin `what`) | — |
| FinPrMacroHistoryEmpty | büyük | aynı (ayrı ekran) | — |
| FinPrProgress | büyük | küçük | hafta etiketleri sığma ayarı sonrası yeniden çekilmedi |
| FinPrivacy | büyük | küçük | sheet zemini Sheet bileşeninden |
| FinPrivacySettings | büyük | küçük | Engellenen hesaplar satırında chevron yok (liste kapsam dışı) |
| FinProfilePublic | büyük | küçük | kapak/ızgara görselleri (yazar bazlı gönderi RPC'si yok), "Bugünkü halkası" şeridi (veri yok), "…" menüsü |
| FinBadges | büyük | küçük | Dark yeniden çekilmedi |
| FinSheetNotify | büyük | küçük | arkada ana sayfa yok (vitrin) |

Eski tasarım: 0
Liste: Profil sekmesi ve benim sahip olduğum her alt ekran/sheet (hub, Personal, Notify, Security, Privacy sheet+ayar, Agreements, Support, Feedback, Macro+geçmiş+nedir, Progress, Public önizleme, Badges, Collection, EkInfoSheet) bayraklar açıkken Final dilinde; eski BottomSheet/eski satır kalmadı (PrivacySheet eski BottomSheet'ten core/design Sheet'e geçti). Alan dışı (başka sahip, bu envantere dahil edilmedi): ProfileOrders, Addresses, ProfileCoupons, ProfileReviews, ProfileSavedCards (KİMSE), MeasurementHistory, TakibeBasla — SORULAR #3.

Yeniden giydirilen (Final'de yok): Macro aboneliğim, Hesap gizliliği (Hesabım bölümü), Rozetlerim girişi, hesap silme onay katmanı (açıklama + onay kelimesi), Macro işlem geçmişi listesi (kayıt varsa), Destek geçmişi sekmesi.

## Commit'ler
`60cafeb` Hesabım + Personal · `e8a5c64` Notify + sheet + hatırlatma · Security/Agreements · Macro (+vitrin) · Public · Badges · Privacy · Support · Feedback · Progress · Macro sekme düzeltmesi · bu LOG (git log night15/profil).

## SORULAR
1. Final Güvenlik "En az 8 karakter" diyor; kod 6 doğruluyor (Supabase min). Kural değiştirilmedi, placeholder 6. 8'e çıkarılsın mı? Final FinPrivacySettings notu "30 gün içinde geri dönebilirsin" — böyle bir bekleme süresi yok, mevcut metin (Güvenlik'e yönlendirme) korundu.
2. FinProfilePublic ızgarası için yazar bazlı gönderi listesi RPC'si gerekiyor (`get_feed` yazar süzgeci yok); ızgara hazır, veri gelince dolar. Kapak görseli de ilk tabaktan türetilecek. Migration yazılsın mı?
3. `PublicProfileScreen` (`/u/:handle`, Keşfet'ten açılır) ve Profil'den açılan sipariş/adres/kupon/değerlendirme/ölçüm ekranları bu oturumda envantere/yeniden giydirmeye alınmadı (sahipleri başka oturum / Profil sekmesi dışı). Eski tasarım olabilir.
4. Seri hatırlatması bildirimi öğün silinirse (loggedToday geri düşerse) o gün için yeniden kurulmaz (gün içi "loglandı" hatırlanır). Kabul mü?
5. Dark panolar ve Agreements/Support/Feedback/Privacy/Badges/Macro* için son çekim turu (Light) yalnız Profile, Personal, Security, Notify, Macro, Progress, Public için alındı; Metro CI modunda dosya izleme kapalıydı (düzeltmeler sonradan yeniden başlatıldı). Çekim araçları vitrin geçişlerinde ara sıra yanlış pano yakalıyor.
