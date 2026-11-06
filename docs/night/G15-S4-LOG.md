# G15-S4 — Profil + Ayarlar + Hatırlatma

## ÖZET (10 satır)
(1) Dal `night15/profil` (taban `night14/visual`), worktree `.claude/worktrees/g15-s4`; ayrı simülatör "G15-4 iPhone", Metro 8094; çekim bitince simülatör `shutdown`.
(2) Profil hub: "Macro aboneliğim" + "Hesap gizliliği" geri geldi, yeni "Hesabım" bölümü + "Rozetlerim" (FinBadges). Macro aboneliğim → Final "Macro ve Abonelik › Öğün Aboneliği". `yeni_siparis` açıkken Siparişlerim/Adreslerim → eatkcal v2 (EkOrders/EkAddresses).
(3) Yeniden çizilen/ince ayarlanan panolar: Personal, Notify, Security, Agreements, Support (+Görsel ekle geri geldi), Feedback, Macro (+ayrı geçmiş ekranı, "Macro nedir?" Sheet), Progress, Privacy sheet + ayar ekranı, ProfilePublic, Badges, SheetNotify.
(4) Profil'den açılan ve eski tasarımda kalan ekranlar Final diliyle yeniden giydirildi: Değerlendirmelerim (`FinPrReviewsScreen`), Kampanyalar & Kuponlarım (`FinPrCouponsScreen`), Ölçüm geçmişi (`FinPrMeasurementsScreen`); `/u/:handle` (`PublicProfileScreen`) `yeni_kabuk` açıkken Final düzenini (FinProfilePublic + gerçek Takip et) kullanır. Eski ekranlar yalnız bayrak kapalı yolda.
(5) Seri hatırlatması: izin verilirse her gün 19:30 yerel bildirim (yeni paket YOK); o gün öğün loglandıysa bugünün bildirimi kurulmaz/iptal, ertesi güne kurulur; FinPrNotify'da aç/kapa; saf plan `streakReminderPlan.ts` (4 birim test). Cihazda bildirim teslimi denenmedi (simülatör).
(6) Kontrol: tsc 0 · test:unit 531/531 · test:components 90/90 (Tracker flagOff snapshot DEĞİŞMEDİ) · `expo export --platform ios` ✓.
(7) Görsel doğrulama (simülatör, `.claude/night/out/g15s4/final/` 32 görüntü + `r3/`): Final ile yan yana okunan panolar tabloda. Çekim aracı vitrin geçişlerinde ara sıra eski pano yakalıyor; bozuk (özdeş md5) görüntüler tek tek yeniden çekildi.
(8) Bayrak kapalı bayt bayt aynı: değişen her yüzey `yeni_kabuk`/`yeni_siparis`/celebrate arkasında; KİMSE dosyalarına dokunulmadı; yeni paket/migration/eas/DB yazma YOK. Dev-only `vitrin*` prop'ları üretimde geçilmez.
(9) Dark: 16 Dark panonun TAMAMI çekildi ve tek tek okundu (Profile, Personal, Notify, Security, Agreements, Support, Feedback, Macro, MacroWhat, MacroHistory, Progress, Privacy, PrivacySettings, Public, Badges, SheetNotify); hepsi temadan, okunur, Final ile aynı ya da küçük fark (SheetNotify-Dark: zil dairesi bg tonunda, Final'de koyu gri). Bozuk/eski pano yakalayan çekimler (özdeş md5 ya da "bilinmeyen pano") yeniden çekildi.
(10) Son commit GERÇEK dosya `docs/night/G15-S4-DONE`.

## Bayrak kapalı parite (son commit'ler sonrası taze kanıt)
`git diff night14/visual --stat` ile bayrak kapalı yoldan ulaşılabilen her dosya tarandı:
- `PrivacySheet.tsx`: yeniden giydirme eski `/u/:handle` (bayrak kapalı) ve GunProfilUiLab'dan da görünüyordu → SIZINTI bulundu ve kapatıldı: eski sheet `LegacyPrivacySheet.tsx`'e taşındı (night14/visual'daki dosyanın bayt bayt kopyası; `diff` yalnız 3 ad değişikliği), `PrivacySheet` bayrağa göre seçer (`yeni_kabuk` kapalı → Legacy).
- `PublicProfileScreen.tsx`: değişiklik yalnız `if (yeniKabuk) { … }` bloğu + 3 import/hook satırı; kapalıyken eski JSX aynen.
- `NotifyPermissionSheet.tsx`, `HomeCelebrations.tsx`: yalnız TrackerScreen'in celebrate bayrağı AÇIKKEN render ettiği bileşenler; bayrak kapalıyken hiç mount edilmez (`TrackerScreen.flagOff` snapshot DEĞİŞMEDEN geçti).
- `dictionaries.ts`: değişen/eklenen anahtarları yalnız `modules/profil/ui/screens/*`, `PrivacySheet`, `NotifyPermissionSheet` kullanıyor (grep: bayrak kapalı yoldan başka kullanıcı yok).
- Diğer değişenler (Fin* ekranları, `finUi`, `streakReminder*`, `icons.ts`, `dev/*`) yalnız yeni kabuk/dev vitrini yolunda; `icons.ts`/`finUi` yalnız ekleme.
- Sonuç (taze): tsc 0 · test:unit 531/531 · test:components 90/90, snapshot 1/1 · `expo export --platform ios` ✓.

## Pano tablosu (önce G14 → sonra)
Sonra = G15-S4 simülatör görüntüsü (Light; Dark ayrıca yukarıdaki listede). "aynı" = bire bir/ölçü ayrımı yok.
| Pano | Önce | Sonra | Kalan fark |
|---|---|---|---|
| FinPrProfile | küçük | küçük | sayaç kartı (vitrinde `get_public_profile` yok), Koleksiyon "6/120" değeri (veri yok), +Hesabım bölümü (talimat) |
| FinPrPersonal | büyük | aynı | etiket büyük/küçük harf |
| FinPrNotify | büyük | aynı | — |
| FinPrSecurity | büyük | aynı | placeholder "En az 6 karakter" (Final 8, kural 6 — SORULAR #1) |
| FinPrAgreements | büyük | aynı | — (chip kaydırıcısı kart boşluğu hatası düzeltildi) |
| FinPrSupport | küçük | aynı | konu çipleri mevcut kategoriler |
| FinPrFeedback | küçük | aynı | çipler mevcut kategoriler |
| FinPrMacro | küçük | aynı | — |
| FinPrMacroWhat | büyük | aynı | — |
| FinPrMacroHistoryEmpty | büyük | aynı | — |
| FinPrProgress | büyük | aynı | — |
| FinPrivacy | büyük | aynı | — |
| FinPrivacySettings | büyük | küçük | Engellenen hesaplar satırında chevron yok (liste kapsam dışı) |
| FinProfilePublic | büyük | küçük | kapak/ızgara fotoğrafları (yazar bazlı gönderi RPC'si yok), "Bugünkü halkası" şeridi (veri yok), "…" menüsü |
| FinBadges | büyük | aynı | — |
| FinSheetNotify | büyük | aynı | arkada ana sayfa yok (vitrin) |

Eski tasarım: 0 (AddCard → S5 EkAddCardScreen, S6'da bağlanır)
Envanter (Profil sekmesi ve açtığı her ekran/sheet, bayraklar açık):
- Benim: hub, Personal, Notify, Security, Privacy sheet + ayarlar, Agreements, Support, Feedback, Macro (+geçmiş, nedir), Progress, Badges, Collection, Public önizleme, `/u/:handle`, Değerlendirmelerim, Kampanyalar & Kuponlar, Ölçüm geçmişi, EkInfoSheet → Final.
- Siparişlerim / Adreslerim: `yeni_siparis` açıkken Profil artık eatkcal v2'ye (EkOrders / EkAddresses, G13-S2 Final ekranları) gider; eski ekranlar yalnız bayrak kapalı.
- Kayıtlı kartlarım (FinPrCards): 5. tur — `FinPrCardsScreen` (Final dili). KİMSE'nin `SavedCardsScreen.tsx` dosyasına DOKUNULMADI; yeni ekran AYNI `lib/cards` çağrılarını (syncSavedCards / setDefaultCard / deleteSavedCard / getCardsFeatureStatus) + `consumeCardsStale` kullanır, ödeme/kart mantığı yeniden yazılmadı; "Yeni kart" mevcut `ProfileAddCard` (PaynKolay doğrulama, KİMSE akışı) ekranına gider. Hub satırı (yalnız kart özelliği açıkken) artık bu ekrana gider. Light + Dark simülatörde Final ile aynı. (Not: görev "FinPrCards S5'te" diyordu; S5 ile çakışmaması için S5'e bu dosyayı kullanabileceği LOG notu — dev vitrini `FinPrCards` girişi bu ekrana işaret eder.)
- Yeni kart ekleme (`ProfileAddCard`, `AddCardScreen.tsx`, KİMSE): İlter kararı — bu oturum DOKUNMAZ (`AddCardScreen.tsx` diff = 0). Yeni tasarımı S5 zaten yaptı: `eatkcal/v2` altındaki `EkAddCardScreen` (mantık AddCardScreen'den satır satır kopya; bayt eşitliğini `legacySwap.test.ts` denetler). G15-S6, bayrak açıkken Profil › Kayıtlı kartlarım › Yeni kart yolunu bu ekrana bağlar. Şimdilik `FinPrCardsScreen`'deki "Yeni kart" `ProfileAddCard`'a gider; S6 bağlayınca Eski tasarım yolu kalmaz.
- TakibeBasla (Hedefi düzenle): onboarding/hedef akışı (başka sahip, Final FinTb* panoları kapsamı).

Yeniden giydirilen (Final'de yok): Macro aboneliğim, Hesap gizliliği, Rozetlerim girişi, Değerlendirmelerim, Kampanyalar & Kuponlarım, Ölçüm geçmişi, hesap silme onay katmanı, Macro işlem geçmişi listesi, Destek geçmişi sekmesi.

## SORULAR
1. Final Güvenlik "En az 8 karakter" diyor; kod 6 doğruluyor (kural değiştirilmedi). 8'e çıkarılsın mı? Final Gizlilik notu "30 gün içinde geri dönebilirsin" — böyle bir bekleme süresi yok, mevcut metin korundu.
2. (Kapandı: FinPrCards Final diliyle yapıldı.) Eski SavedCardsScreen + AddCardScreen (KİMSE) bayrak kapalı yolda kalır; temizlik oturumunda (G-TEMİZLİK) silinir. S5 de FinPrCards'a dokunacaksa `FinPrCardsScreen` ile çakışmasın.
3. FinProfilePublic ızgarası için yazar bazlı gönderi listesi RPC'si gerekiyor (migration dosyası yazılsın mı?); kapak da ilk tabaktan türetilecek.
4. (Kapandı: bütün Dark panolar okundu.)
6. (Kapandı — İlter: AddCardScreen'e dokunma; S5 `EkAddCardScreen` yaptı, G15-S6 Profil › Yeni kart yolunu bağlar.) G15-S6'ya not: `FinPrCardsScreen.tsx` içindeki `navigation.navigate('ProfileAddCard')` bayrak açıkken `EkAddCardScreen` rotasına çevrilecek.
5. Seri hatırlatması öğün silinirse o gün yeniden kurulmaz (gün içi "loglandı" hatırlanır). Kabul mü?
