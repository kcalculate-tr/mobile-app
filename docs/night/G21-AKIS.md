# G21-S1 md.8 — Uçtan uca akış denetimi (yeni kabuk, bayraklar AÇIK)

**Yöntem.** Statik kod izleme (cihazda koşu DEĞİL): `yeni_kabuk`, `yeni_siparis`, `yeni_onboarding`,
`kesfet`, `kesfet_takip`, `kesfet_paylasim`, `kesfet_yorum`, `sosyal_bildirim`, `ai_tarama`, `etkinlik`,
`su_takibi`, `paylasim_karti`, `gun_halkasi`, `ogun_hatirlatma` açık varsayıldı. Her ekranın
`onPress`/`navigate`/`replace`/`goBack` çağrısı hedef rotaya kadar izlendi; hedefin flags-on
navigatörde (AppNavigator kök yığın + `ekV2Routes` + `FINAL_ROUTES` + Onboarding/Takibe yığınları +
R3 sekmeleri) kayıtlı olduğu, zorunlu parametrelerin geçtiği, geri dönüşün doğru yere düştüğü,
yükleniyor hâlinin hata/boş çıkışı olduğu kontrol edildi.

Otomatik taramalar (betikler iş geçici dizininde, sonuçlar burada):
- **Rota adı taraması**: `src/` altındaki 400+ `navigate/push/replace/screen:` hedefinin TAMAMI kayıtlı bir rota
  adına gidiyor (kayıtsız ad 0). Sekme adına (Home/Tracker/Profile/KesfetTab/Cart/Subscriptions) yığın
  ekranından doğrudan gezinme 1 (Keşfet "Gör" → `navigate('Home')`, aşağıda #K6).
- **Çeviri anahtarı taraması (EN/TR)**: koddaki 1844 sabit `t('a.b')` anahtarının hepsi TR ve EN sözlükte
  çözülüyor (eksik 0). Kalıcı test: `src/core/i18n/__tests__/usedKeysExist.test.ts`.
- **Sabit Türkçe metin taraması** (EN'de Türkçe kalan): yeni kabukta 3 yer (aşağıda #E1, #K12, #K13).
- **Koyu tema taraması** (temaya bağlanmamış sabit renk): yeni kabuk ekranlarında gerçek hata 1
  (ScanLimitSheet ikonları, düzeltildi). Diğer sabit renkler bilinçli: fotoğraf üstü karartmalar,
  koyu kutlama kartı (FinCelebrate kartı her iki temada koyu — Final), kamera vizörü, hata kırmızısı.

Sütunlar: `geçiş` = push-right (yığın, sağdan kayar) · modal-bottom (yığın, alttan) · tab-none (sekme,
efektsiz/crossfade) · sheet (ekran içi katman) · state (ekran içi durum değişimi) · sistem. `klavye` = giriş
alanı varsa hangisi (md.10 ortak sheet düzeltmesi sonrası davranış md.10 raporunda).
md.9 sonrası Profil alt sayfaları `ProfileSub` yığın ekranı (push-right); tablo bunu yansıtır.

## Özet

| Durum | Adet |
|---|---|
| ✓ doğru | 136 |
| ✗ düzeltildi (bu oturum, testli; #D1–#D5 dahil) | 10 |
| ✗ devredildi | 0 |
| ✗ tasarım gerekir (tablo satırı; liste #T1–#T4) | 2 |
| ⚠ risk | 13 |
| **Toplam satır** | **161** |

---

## 1. İlk açılış → onboarding → rıza → Ana sayfa

| ekran | öğe | beklenen | olan | durum | geçiş | klavye |
|---|---|---|---|---|---|---|
| Splash | soğuk açılış, oturumsuz | bayrak çözülene kadar splash, sonra Onboarding | `waitFlags` ≤2,5 sn, `initialRouteName='Onboarding'` | ✓ | — | n/a |
| FinOpen (OpenSignature) | imza animasyonu / Atla | ilk kez oynar, Atla keser, Karşılama'ya erir | süreç başına bir kez, `markOpenSeen` | ✓ | state | n/a |
| OnbWelcome | Başla | Hesap (intent=track) | `navigate('OnbAccount',{intent:'track'})` | ✓ | push-right | n/a |
| OnbWelcome | Hesabım var | Giriş | `root.navigate('Login')` | ✓ | push-right | n/a |
| OnbWelcome | geri jesti | kapalı | `gestureEnabled:false` | ✓ | — | n/a |
| OnbIntent | (erişim) | — | Karşılama artık doğrudan Hesap'a gidiyor; Niyet ekranına hiçbir yerden gidilmiyor (ölü ekran) | ⚠ | — | n/a |
| OnbAccount | geri | Karşılama | `goBack()` | ✓ | push-right | n/a |
| OnbAccount | onay kutusu | işaretlenmeden 3 düğme pasif | `disabled={busy \|\| !accepted}` | ✓ | — | n/a |
| OnbAccount | Apple / Google | giriş → Ana sayfa (Tracker) | `postAuthShellTab(yeniKabuk)` → Tabs/Tracker | ✓ | push-right | n/a |
| OnbAccount | Apple / Google hata | hata geri bildirimi | `result.error` → sessiz `return` (kullanıcı düğmenin neden çalışmadığını görmez) | ⚠ | — | n/a |
| OnbAccount | E-posta ile devam | e-posta sheet'i | `setEmailOpen(true)` → AccountEmailSheet | ✓ | sheet | e-posta + kod |
| OnbAccount | Ayrıntılar | rıza ayrıntı sheet'i (aynı kutu) | `setDetailsOpen(true)` | ✓ | sheet | n/a |
| ConsentBlock | Koşullar / Gizlilik / KVKK bağlantısı | belge | LegalDocModal → SettingsAgreements (yerel metin, yükleme yok) | ✓ | modal-bottom | n/a |
| OnbNotify | Sonra / İzin ver | Takibe başla | `root.navigate('TakibeBasla')` | ✓ | push-right | n/a |
| OnbUnderage | Düzelt / Tamam | geri / eatkcal | `goBack()` / Tabs/Home | ✓ | push-right | n/a |
| ConsentGate | mevcut kullanıcı / yeni sürüm | bilgilendirme / tekrar kabul sheet'i, sonra ATT | politika → ATT sırası, sunucu yoksa cihaz kaydı | ✓ | sheet | n/a |
| IntroOverlay | yükseltme kullanıcısı | bir kez tanıtım | Karşılama görüldüyse tanıtım görülmüş sayılır | ✓ | sheet | n/a |
| OrientHost | FinOrient1–4 ipuçları | ilk açılışta hedef öğeye çapalı | `useOrientTarget` | ✓ | sheet | n/a |

### Takibe başla (TakibeNavigator)

| ekran | öğe | beklenen | olan | durum | geçiş | klavye |
|---|---|---|---|---|---|---|
| TbGoal | geri | önceki ekran (yığın boşsa kök geri) | `canGoBack ? goBack : root.goBack` | ✓ | push-right | n/a |
| TbGoal…TbFirst | Atla (ilk kurulum) | Ana sayfa | Tabs/Tracker | ✓ | push-right | n/a |
| TbGoal…TbActivity | Atla (**editGoal**, Profil › Hedefim'den) | Profil'e dön | Tabs/**Tracker**'a gidiyor; Profil'den gelen kullanıcı Ana sayfaya atılır | ✗ düzeltildi (#D3, `c13727e`: Hedefim'de Atla = geri) | push-right | n/a |
| TbAbout | yaş/boy/kilo | sayısal giriş, kaydırılabilir | TbFrame `scroll` | ✓ | — | sayı alanları |
| TbResult | Kaydet (editGoal) | kaydet + geri | `root.goBack()` | ✓ | push-right | n/a |
| TbResult | Devam | İlk adım | `navigate('TbFirst')` | ✓ | push-right | n/a |
| TbFirst | Fotoğrafla / Elle / Sonra | kaydet → Ana sayfa | `saveThen(() => Tabs/Tracker)` | ✓ | push-right | n/a |
| TbUnderage | Düzelt / Tamam | geri / eatkcal | `goBack` / Tabs/Home | ✓ | modal-bottom | n/a |

## 2. Ana sayfa (Tracker sekmesi, FinHomeR3)

| ekran | öğe | beklenen | olan | durum | geçiş | klavye |
|---|---|---|---|---|---|---|
| Ana sayfa | zil | bildirim listesi (FinNotifications) | `navigate('Kesfet')` — akışın İKİNCİ kopyasını yığına itiyordu; `kesfet` kapalıyken rota kayıtsız | ✗ düzeltildi → `homeBellTarget` (sosyal_bildirim → KesfetNotifications, değilse KesfetTab, ikisi kapalı → zil yok) · test `g21FlowLinks` | push-right | n/a |
| Ana sayfa | halka merkezi / makrolar | hedef düzenleme | `TakibeBasla {editGoal:true}` | ✓ | push-right | n/a |
| Ana sayfa | Su + | +250 ml, toast "Geri al" | `handleWaterAdd`, sınırda bilgi toast'ı, başarısızsa toast kalkar | ✓ | — | n/a |
| Ana sayfa | ilk kayıt (boş gün) | Tara / elle | `logToSlot` → AiScan · `openMealFormFor` | ✓ | modal-bottom / sheet | elle giriş |
| Ana sayfa | banner (gönderi / eatkcal) | gönderi detayı / eatkcal | SharedPost {postId} / Tabs/Home | ✓ | push-right / tab-none | n/a |
| Ana sayfa | öğün yuvası "…'e logla" | Tara (ai_tarama) | `navigate('AiScan')` | ✓ | modal-bottom | n/a |
| Ana sayfa | yuva ⌄ / menü (FinMoPopover) | porsiyon / taşı / sil / paylaş | `onMoveMeal/onRemove/onPortion/onShare` | ✓ | sheet | n/a |
| Ana sayfa | satır sil → toast Geri al | kaydı geri getir | kabuk toast'ı `undo` (G20-S1) | ✓ | — | n/a |
| Ana sayfa | bekleyen taramalar | çevrimdışı kuyruk / elle | `HomePendingScans onManual` | ✓ | sheet | elle giriş |
| Ana sayfa | Etkinlik bölümü | etkinlik ekle → toast Geri al | `HomeActivitySection onLogged` | ✓ | sheet | dakika |
| Ana sayfa | Keşfet şeridi "Tümü" | Keşfet sekmesi | Tabs/KesfetTab | ✓ | tab-none | n/a |
| Ana sayfa | Keşfet şeridi kare | O gönderinin detayı | genel Keşfet sekmesine gidiyordu (gönderi kimliği atılıyordu) | ✗ düzeltildi → `openPost` (SharedPost {postId}) | push-right | n/a |
| Ana sayfa | eatkcal bölge satırı / ürün | ürün detayı | `EkProduct {productId}` | ✓ | push-right | n/a |
| Ana sayfa | İzmir dışı: ekle / öner | bekleme listesi sheet'i | `setWaitlistKind` → WaitlistFormSheet | ✓ | sheet | il / not |
| Ana sayfa | bildirim dokunuşu (seri/hatırlatma) | Ana sayfa + yuva menüsü bir kez | `finOpenLog` param tüketilir | ✓ | tab-none | n/a |
| Ana sayfa | elle giriş sheet'i | öğün + kcal kaydet | HomeManualMealSheet | ✓ | sheet | ad + kcal |
| Ana sayfa | kutlama (ilk öğün / seri) | FinCelebrate, kapat | HomeCelebrations | ✓ | sheet | n/a |
| Ana sayfa | boş gün | boş hâl | `HomeEmptyToday` | ✓ | — | n/a |

## 3. Tara (AiScan) → sonuç → günüme ekle → geri al

| ekran | öğe | beklenen | olan | durum | geçiş | klavye |
|---|---|---|---|---|---|---|
| Tab çubuğu | Tara düğmesi | AiScan | `navigate('AiScan')` | ✓ | modal-bottom | n/a |
| FinScanCamera | X | geri | `goBack()` | ✓ | modal-bottom | n/a |
| FinScanCamera | ilk tarama | AI izni sheet'i bir kez | ConsentSheet `ai_photo`; Vazgeç → elle | ✓ | sheet | n/a |
| FinScanCamera | çek / galeri | analiz → sonuç | `runFinCapture` / `handleGalleryPick` | ✓ | state | not alanı |
| FinScanCamera | kamera izni yok | ayarlar / galeri / elle | FinScanErrorSheet `camera` | ✓ | sheet | n/a |
| FinScanCamera | çevrimdışı | sade durum ekranı | `replace('AiScanOffline')` | ✓ | push-right | n/a |
| AiScanOffline | Ana sayfa | Tracker | Tabs/Tracker | ✓ | tab-none | n/a |
| Tara | **Elle gir** (kamera / hata / kota / izin Vazgeç) | Ana sayfa + elle giriş sheet'i açık | yalnız `goBack()`; kullanıcı Ana sayfada ikinci kez dokunmak zorunda | ✗ düzeltildi (#D2, `c13727e`: yeni kabukta Tabs/Tracker {finOpenManual}) | modal-bottom | elle giriş |
| Tara | kota bitti | FinErrLimit sheet'i | ScanLimitSheet; ikonlar koyu temada görünmüyordu | ✗ düzeltildi (ikon `th.color.ink`) | sheet | n/a |
| Tara | barkod | OFF sonucu / bulunamadı | md.2 oturumu (FinBarcodeResult) | ✓ (md.2 raporu) | state | ad / porsiyon |
| FinPhotoResult | porsiyon / öğün / düzelt | düzenlenebilir | `onChangeMealType`, düzelt alanları | ✓ | state | ad / kcal |
| FinPhotoResult | Günüme ekle | kayıt + uçuş + kabuk toast'ı | `handleSaveFin` → `emitLogFlight` (md.4: `id` taşır) | ✓ (md.4) | — | n/a |
| FinPhotoResult | Geri al | kaydı sil | `handleUndoFin` → delete | ✓ | — | n/a |
| FinPhotoResult | Gör | Ana sayfa | `goBack()` — Tara Keşfet/Profil sekmesinden açıldıysa o sekmeye döner, güne değil | ⚠ | modal-bottom | n/a |
| FinPhotoResult | Tekrar dene | vizöre dön, not sıfır | `handleRetry` | ✓ | state | n/a |
| FinPhotoResult | Yarına planla | bildirim izni / planlandı | `onAddToPlan` | ✓ | — | n/a |
| FinPhotoResult | kayıt hatası | toast | `Toast saveFailed` | ✓ | — | n/a |

## 4. Gün halkası · su · etkinlik

| ekran | öğe | beklenen | olan | durum | geçiş | klavye |
|---|---|---|---|---|---|---|
| Keşfet RingStrip | halka | GunViewer (hikâye) | `setViewerUserId` | ✓ | modal-bottom | n/a |
| Keşfet RingStrip | + (kendi) | Composer | `navigate('Composer')` (kesfet_paylasim) | ✓ | modal-bottom | metin |
| GunViewer | kapat / ileri-geri | kuyruk | `viewerQueue` | ✓ | — | n/a |
| GunRingStrip | erişilebilirlik etiketi | TR/EN | "Gün halkası" sabit TR (EN'de Türkçe okunur) | ⚠ (#K13) | — | n/a |
| Ana sayfa su | sınır (8) | bilgi toast'ı | `gun.water_limit` | ✓ | — | n/a |
| Etkinlik | ekle / geri al | kayıt + toast | `activityUndo` | ✓ | sheet | dakika |

## 5. Keşfet (sekme)

| ekran | öğe | beklenen | olan | durum | geçiş | klavye |
|---|---|---|---|---|---|---|
| Keşfet | Senin için / Takip | sekme içeriği | `kesfet_takip`; bölüm geçişi md.9 (section-slide) | ✓ | state (md.9: section-slide) | n/a |
| Keşfet | **ara** (büyüteç) | arama ekranı | `onSearch={() => {}}` — dokununca hiçbir şey olmuyor; Final'de arama panosu yok | ✗ tasarım gerekir (#T1) | — | n/a |
| Keşfet | zil | bildirimler | KesfetNotifications | ✓ | push-right | n/a |
| Keşfet | yaz (+) | Composer | `navigate('Composer')` | ✓ | modal-bottom | metin |
| PostCard | gönderi metni | FinDetail | SharedPost {postId} → PostDetailScreen | ✓ | push-right | n/a |
| PostCard | **avatar / ad** | yazarın açık profili (takip oradan) | dokunulmuyordu; açık profile yalnız bildirimden ulaşılıyordu | ✗ düzeltildi (PostCard `onOpenAuthor`, test `g21AuthorLink`); akışta bağlama #D1 | push-right | n/a |
| PostCard | beğen / kaydet | iyimser güncelleme | store `react` | ✓ | — | n/a |
| PostCard | paylaş | sistem paylaşımı | `Share.share(postLink)` | ✓ | sistem | n/a |
| PostCard | yorum | yorum sheet'i | CommentsSheet | ✓ | sheet | yorum |
| PostCard | hızlı logla / ⌄ | FinAddSheet → kayıt → tek toast | md.4 | ✓ (md.4) | sheet | n/a |
| PostCard | ⋯ menü | düzenle / sil / bildir / sessize al | PostMenu → ReportFlow | ✓ | sheet | bildirim notu |
| PostCard | video | tam ekran oynatıcı | `setVideoPostId` | ✓ | modal-bottom | n/a |
| PostCard | Yaptım (etkinlik) | süre sheet'i → kayıt | DidItSheet | ✓ | sheet | dakika |
| Keşfet | logla toast'ı "Gör" | Ana sayfa (gün) | `navigate('Home')` = yeni kabukta **eatkcal** sekmesi | ✗ düzeltildi (md.4 `fe6d6c7`: Keşfet kendi toast'ını göstermez; kabuk toast'ı "Gör" = Tabs/Tracker) | tab-none | n/a |
| Keşfet | Yaptım toast'ı "Günüme paylaş" | güne paylaş | `onAction: () => {}` — eylem yok | ✗ tasarım gerekir (#T2) | — | n/a |
| Keşfet | boş akış / Takip boş | başlangıç hesapları + takip | FeedStartEmpty `onFollow` | ✓ | — | n/a |
| Keşfet | yükleniyor | iskelet | FeedSkeleton (a11y etiketi "Yükleniyor" sabit TR) | ⚠ (#K12) | — | n/a |
| Keşfet | hata | hata kartı + tekrar | `error` hâli | ✓ | — | n/a |
| FinDetail | geri | önceki ekran (derin bağlantıda Tabs) | `canGoBack ? goBack : reset(Tabs)` | ✓ | push-right | n/a |
| FinDetail | **yazar** | açık profil | dokunulmuyordu | ✗ düzeltildi (`onOpenAuthor` → PublicProfile {handle}) | push-right | n/a |
| FinDetail | yorum yaz | gönder | KeyboardAvoidingView + `keyboardShouldPersistTaps` | ✓ | — | yorum |
| FinDetail | bulunamadı | boş hâl | `state='notfound'` | ✓ | — | n/a |
| FinNotifications | satır | gönderi / profil | SharedPost / PublicProfile | ✓ | push-right | n/a |
| FinNotifications | geri | Keşfet | `goBack()` | ✓ | push-right | n/a |
| FinNotifications | yükleme hatası | hata hâli | hata ayrı gösterilmiyor; boş liste "bildirim yok" görünür | ⚠ | — | n/a |
| Açık profil | Takip et / Takipte / İstek | takip durumu | `follow()` + pop | ✓ | — | n/a |
| Açık profil | takip hatası | geri bildirim | `try/finally` — hata sessiz, düğme eski hâline döner | ⚠ | — | n/a |
| Açık profil | yükleniyor / bulunamadı | geri düğmesi | geri düğmesi YOKTU (çıkmaz; ağ hatası işlenmemiş ret) | ✗ düzeltildi (geri + `catch`, yığın boşsa Tabs; test `g21PublicProfileBack`) | push-right | n/a |
| Açık profil (kendim) | gizlilik | PrivacySheet | `setPrivacyOpen` | ✓ | sheet | n/a |
| Composer | paylaş / kapat | yayınla → geri | `goBack()` | ✓ | modal-bottom | metin, öğün değerleri |

## 6. eatkcal (Home sekmesi, v2) — ödeme ekranına KADAR

| ekran | öğe | beklenen | olan | durum | geçiş | klavye |
|---|---|---|---|---|---|---|
| FinEkHome | şehir seçimi yok | şehir kapısı | `EkCityGate` (gated) | ✓ | modal-bottom | n/a |
| EkCityGate | İzmir → sonraki | adres ekle / mağaza / sepet | `replace(EkAddressAdd/EkStore/EkCart)` | ✓ | push-right | n/a |
| EkCityGate | KVKK | belge | ProfileContracts {slug:'kvkk'} | ✓ | push-right | n/a |
| EkCityGate | İzmir dışı | bekleme listesi | WaitlistFormSheet | ✓ | sheet | il / not |
| FinEkHome | Siparişlerim | sipariş listesi | EkOrders | ✓ | push-right | n/a |
| FinEkHome | adres satırı | adres seç / ekle | EkAddresses {selectMode} / EkAddressAdd | ✓ | push-right | n/a |
| FinEkHome | kupon | kuponlar | ProfileCoupons → FinPrCoupons (`onBack=goBack`) | ✓ | push-right | kupon kodu |
| FinEkHome | mağaza / ürün | mağaza / ürün | EkStore {brandKey} / EkProduct {productId} | ✓ | push-right | n/a |
| FinEkHome | aktif sipariş | sipariş detayı | EkOrderDetail {orderId} | ✓ | push-right | n/a |
| FinEkHome | sepet çubuğu | sepet | EkCart | ✓ | push-right | n/a |
| FinEkHome | takibe geç | Ana sayfa | Tabs/Tracker | ✓ | tab-none | n/a |
| EkStore | ürün / sepet çubuğu / geri | ürün / sepet / önceki | EkProduct / EkCart / goBack | ✓ | push-right | n/a |
| EkStore | boş mağaza / hata | boş + hata hâli | var | ✓ | — | n/a |
| EkProduct | sepete ekle → Sepete git | sepet | EkCart | ✓ | push-right | not |
| EkProduct | yükleniyor | iskelet + geri | iskelette geri düğmesi yok (Android geri / iOS jesti var); ağ asılırsa sonsuz iskelet | ⚠ | push-right | n/a |
| EkProduct | yüklenemedi | hata + Geri dön | `goBack()` | ✓ | push-right | n/a |
| EkCart | ürün satırı | ürün | EkProduct | ✓ | push-right | n/a |
| EkCart | Kupon kodu ekle | kupon sheet'i, klavye üstünde | CouponSheet (md.10 ortak Sheet düzeltmesi) | ✓ (md.10) | sheet | kupon kodu |
| EkCart | Devam (oturumsuz) | Giriş | `navigate('Login')` | ✓ | push-right | n/a |
| EkCart | Devam | Özet | EkCheckout | ✓ | modal-bottom | n/a |
| EkCart | boş sepet → Mağazalar | eatkcal | Tabs/Home | ✓ | tab-none | n/a |
| EkCheckout | adres ekle / değiştir | adres | EkAddressAdd / EkAddresses {selectMode} | ✓ | push-right | adres alanları |
| EkCheckout | Koşullar / Mesafeli satış | belge | ProfileContracts {slug} | ✓ | push-right | n/a |
| EkCheckout | stok hatası → sepet | sepet | EkCart | ✓ | push-right | n/a |
| EkCheckout | Öde | ödeme ekranı (SON NOKTA) | `navigate('PaymentScreen', params)` — denetim burada durdu | ✓ | push-right | sipariş notu |
| EkAddresses | adres seç (selectMode) | özete seçili adresle dön | EkCheckout {selectedAddressId} | ✓ | push-right | n/a |
| EkAddresses / EkAddressAdd | oturumsuz | Giriş | `replace('Login',{redirectTo:'Tabs'})` — girişten sonra özet bağlamı kaybolur (Tabs'a düşer) | ⚠ | push-right | n/a |
| EkAddressAdd | kaydet (selectMode) | özete dön | EkCheckout {selectedAddressId} | ✓ | push-right | adres alanları |
| EkOrders | boş → Mağazalar / sipariş | eatkcal / detay | Tabs/Home / EkOrderDetail | ✓ | push-right | n/a |
| EkOrderDetail | Tekrar sipariş / Destek | sepet / destek | EkCart / ProfileSupport | ✓ | push-right | n/a |
| EkOrderDetail | yükleniyor / hata | iskelet + başlık geri / hata + tekrar | var | ✓ | — | n/a |
| EkPaymentScreen | ödeme hatası uyarısı | TR/EN | `Alert.alert('Ödeme başarısız', …, 'Tamam')` sabit TR (EN'de Türkçe) — ödeme adımı, kapsam sınırında | ⚠ (#E1) | — | n/a |

## 7. Profil (sekme) — md.9 sonrası alt sayfalar `ProfileSub` yığın ekranı

| ekran | öğe | beklenen | olan | durum | geçiş | klavye |
|---|---|---|---|---|---|---|
| FinPrProfile | avatar | açık profil önizlemesi | ProfileSub {sub:'public'} | ✓ | push-right | n/a |
| FinPrProfile | Hedefim | Takibe başla (editGoal) | `TakibeBasla {editGoal:true}` | ✓ | push-right | n/a |
| FinPrProfile | İlerleme → Ölçüm ekle | ilerleme → ölçümler (geri → ilerleme) | ProfileSub progress → measurements | ✓ | push-right | ölçüm |
| FinPrProfile | Koleksiyon / Rozetler | koleksiyon / rozetler | ProfileSub collection / badges | ✓ | push-right | n/a |
| FinPrProfile | Makro ve abonelik | FinPrMacro | ProfileSub macro / macroSub | ✓ | push-right | n/a |
| FinPrMacro | yükleniyor | veri / boş | `Promise.all` — biri atarsa yükleniyor kalır (fetch'ler hata döndürüp atmıyor; düşük risk) | ⚠ | — | n/a |
| FinPrMacro | Siparişlerim | siparişler | ProfileOrders → EkOrders (v2 swap) | ✓ | push-right | n/a |
| FinPrProfile | Siparişlerim | EkOrders | `navigate('EkOrders')` | ✓ | push-right | n/a |
| FinPrProfile | Adreslerim | EkAddresses | `navigate('EkAddresses')` | ✓ | push-right | adres |
| FinPrProfile | Kartlarım | FinPrCards → kart ekle | ProfileSub cards → ProfileAddCard (EkAddCard) | ✓ | push-right | kart |
| FinPrProfile | Kuponlarım | FinPrCoupons | ProfileSub coupons (md.10: kaydırılabilir + klavye) | ✓ | push-right | kupon kodu |
| FinPrProfile | Değerlendirmelerim | FinPrReviews | ProfileSub reviews; hata → boş liste | ✓ | push-right | n/a |
| FinPrProfile | Kişisel bilgiler | SettingsPersonal | ProfileSub personal | ✓ | push-right | ad, e-posta kodu |
| FinPrProfile | Bildirimler | SettingsNotify | ProfileSub notify | ✓ | push-right | n/a |
| FinPrProfile | Gizlilik | SettingsPrivacy → güvenlik / veri izinleri | ProfileSub privacy → security / dataConsent (geri → gizlilik) | ✓ | push-right | n/a |
| SettingsPrivacy | gizli hesap anahtarı | kaydet | `handleSelect` | ✓ | — | n/a |
| SettingsPrivacy | Hesabı sil | Güvenlik (silme) | `onOpenSecurity` | ✓ | push-right | n/a |
| SettingsDataConsent | reklam / AI izni anahtarları | kaydet, hata metni | var | ✓ | — | n/a |
| FinPrProfile | Güvenlik | SettingsSecurity | ProfileSub security | ✓ | push-right | n/a |
| SettingsSecurity | Hesabı sil → onay kelimesi | ONAYLANMADI (denetim burada durdu); silme sonrası | `delete-account` → `signOut`; sonra Giriş ekranı açılır (bkz. çıkış satırı) | ⚠ (#D4) | sheet | onay kelimesi |
| FinPrProfile | Sözleşmeler | SettingsAgreements | ProfileSub agreements (yerel metin) | ✓ | push-right | n/a |
| FinPrProfile | Yardım ve destek | SettingsSupport | ProfileSub support; ek imzalı URL, telefon | ✓ | push-right | konu, mesaj |
| FinPrProfile | Öneri ve görüş | SettingsFeedback | ProfileSub feedback | ✓ | push-right | metin |
| FinPrProfile | **Çıkış** | Karşılama/onboarding (yeni_onboarding) | `signOut` sonrası sıfırlama yok: Profil sekmesindeki `useRequireAuth` **Giriş**'i iter; Giriş'ten geri → oturumsuz Profil sekmesi | ✗ düzeltildi (#D4, `c13727e`: yığın Onboarding/WelcomeGate'e sıfırlanır) | push-right | n/a |
| Tab çubuğu | Profil / Ana sayfa / Keşfet (oturumsuz) | Giriş | `authGate` → Login | ✓ | push-right | n/a |
| Tab çubuğu | Sepet hapı | v2 sepet | EkCart kayıtlıysa EkCart | ✓ | push-right | n/a |
| Tab çubuğu | kabuk toast'ı Gör | Ana sayfa | `navigate('Tracker')` | ✓ | tab-none | n/a |
| Tab çubuğu | sekmeler | geçiş efektsiz (crossfade), Android geri = çıkış | `backBehavior='none'`, `tabSceneLayout` | ✓ | tab-none | n/a |

## 8. Derin bağlantı / bildirim

| ekran | öğe | beklenen | olan | durum | geçiş | klavye |
|---|---|---|---|---|---|---|
| /p/:id | gönderi | FinDetail, geri → Tabs | SharedPost (kesfet) | ✓ | push-right | n/a |
| /u/:handle | profil | açık profil | SharedProfile → `replace('PublicProfile')` | ✓ | push-right | n/a |
| SharedPost / SharedProfile | rota `contentStyle` | tema zemini | `#0A0A0A` sabit — açık temada geçiş boyunca koyu kare parlar | ⚠ (AppNavigator, md.9 sahibinde) | push-right | n/a |
| FinPush sipariş / seri / sosyal | dokunuş | sipariş / Ana sayfa menü / bildirim | `finPush` hedefleri kayıtlı | ✓ | push-right | n/a |

---

## Bu oturumda düzeltilenler (md.8, commit `b055b8f`)
1. Ana sayfa zili → bildirimler (`src/screens/tracker/homeBellTarget.ts`, TrackerScreen) · test `g21FlowLinks`.
2. Ana sayfa Keşfet şeridi kare → gönderi detayı (`openPost`).
3. Tara "Elle gir" için Ana sayfa alıcısı: `Tracker {finOpenManual}` param → elle giriş sheet'i açılır (TrackerScreen + `navigation/types.ts`). Çağıran tarafı #D2.
4. PostCard avatar/ad → `onOpenAuthor` (test `g21AuthorLink`).
5. FinDetail yazar → açık profil (`PostDetailScreen onOpenAuthor`, `SharedPostScreen`).
6. Açık profil yükleniyor/bulunamadı geri düğmesi + ağ hatası `catch` (test `g21PublicProfileBack`, `common.back` TR/EN).
7. ScanLimitSheet ikonları koyu temada görünür.
8. Kalıcı test: `usedKeysExist` (koddaki sabit çeviri anahtarları TR+EN'de).

(TrackerScreen parçaları ana oturumun `fe6d6c7` commit'ine diskteki hâliyle girdi; bağımlı dosyalar `b055b8f`'te.)

## Devredilenler — hepsi düzeltildi (`c13727e`, test `src/navigation/__component_tests__/g21Handoff.test.tsx`; #D1 "Gör" kısmı md.4 `fe6d6c7`)
- **#D1** `src/modules/kesfet/ui/KesfetScreen.tsx:446-450` `onViewDay`: `navigation.navigate('Home')` → `navigation.navigate('Tabs', { screen: 'Tracker' })` (yeni kabukta Home = eatkcal). Aynı dosyada PostCard'a (≈:675) `onOpenAuthor={() => navigation.navigate('PublicProfile', { handle: item.author.handle })}` ekle.
- **#D2** `src/modules/ai/scan/screens/ScanScreen.tsx:565-570` `handleManualEntry`: yeni kabukta `navigation.goBack()` yerine `navigation.navigate('Tabs', { screen: 'Tracker', params: { finOpenManual: true } })` (eski kabukta goBack kalsın). Tracker tarafı hazır.
- **#D3** `src/modules/onboarding/takibe/TakibeNavigator.tsx:139,166,228,334,394` `onSkip`: editGoal modunda `root?.goBack()` (Profil'e dön), değilse bugünkü Tabs/Tracker. `draft.editGoal` store'da mevcut (:361).
- **#D4** Çıkış / hesap silme sonrası: `FinPrProfileScreen.tsx:190-195` `handleLogout` ve `SettingsSecurityScreen.tsx:175` sonrasına `navigation.reset({ index: 0, routes: [{ name: yeniOnboarding ? 'Onboarding' : 'Tabs' }] })` (kök yığın; `Onboarding` her zaman kayıtlı). Bugün Giriş itiliyor, geri → oturumsuz Profil.
- **#D5** `src/navigation/AppNavigator.tsx` SharedPost/SharedProfile `contentStyle: '#0A0A0A'` → yeni kabukta tema zemini (açık temada koyu parlama).

## Tasarım gerekir
- **#T1** Keşfet arama düğmesi hedefsiz (Final'de arama panosu yok) → ya arama panosu ya düğme gizlenir.
- **#T2** Keşfet "Etkinliğin eklendi · Günüme paylaş" eylemi boş (güne paylaşım akışı/panosu tanımsız).
- **#T3** Apple/Google giriş hatasında onboarding Hesap ekranında hata hâli yok (Final'de FinOnbAccount hata panosu yok).
- **#T4** FinNotifications / açık profil takip hatası için hata hâli (bugün boş liste / sessiz).

## Riskler (⚠) — özet
OnbIntent ölü ekran · Apple/Google sessiz hata · FinPhotoResult "Gör" açıldığı sekmeye döner · GunRingStrip ve FeedSkeleton a11y etiketleri sabit TR (#K12, #K13) · bildirim yükleme hatası boş görünür · takip hatası sessiz · EkProduct iskeletinde geri yok / zaman aşımı yok · adres ekranlarında Giriş sonrası özet bağlamı kaybı · FinPrMacro `Promise.all` · EkPayment uyarısı sabit TR (#E1) · derin bağlantı koyu zemin parlaması · hesap silme sonrası Giriş.

## Kapsam dışı / yapılmadı
- Cihazda dokunmalı koşu yapılmadı (Erişilebilirlik izni yok); kareler vitrin ile alındı (aşağıda). Ödeme/sipariş ve hesap silme onayı bilinçli olarak yapılmadı.
- `onboarding/v2` (eski giriş/kayıt formları; kendi sözlüğü) anahtar taramasının dışında.


---

## Geçiş türleri (md.9, commit `838a979`) — her sayfa içi gezinme

Alt sekmeler arası: **tab-none** (bugünkü gibi; sekme içeriği crossfade). Sekme içinde bir satıra/sayfaya basınca:
**push-right** = kök yığında `slide_from_right`, PREMIUM.push 300 ms, iOS kenar jesti ile geri (soldan kapanır);
azaltılmış harekette 200 ms opaklık (`src/navigation/transitions.ts`). Modal/sheet'ler aşağıdan (değişmedi).

| Ekran | Öğe | Geçiş |
|---|---|---|
| Profil | her alt sayfa satırı (Kişisel, Bildirimler, Gizlilik, Güvenlik, Sözleşmeler, Destek, Geri bildirim, Macro, İlerleme, Rozetler, Koleksiyon, Değerlendirmeler, Kuponlar, Kartlar), avatar → açık profil önizleme, koleksiyon toast "Gör" | push-right (`ProfileSub {sub}`; önce sekme içi `setSub` durum değişimiydi) |
| Gizlilik | → Güvenlik / Veri ve reklam izinleri | push-right (üstüne; geri → Gizlilik) |
| İlerleme | → Ölçümler | push-right (üstüne; geri → İlerleme) |
| Profil | Siparişlerim / Adreslerim (EkOrders/EkAddresses), Hedefim (TakibeBasla) | push-right |
| Keşfet | gönderi → SharedPost, zil → KesfetNotifications, yazar → PublicProfile | push-right |
| Keşfet | Composer | modal-bottom |
| Keşfet | Senin için ↔ Takip | section-slide (içerik yatay kayar, alt çizgi kayar) |
| Açık profil önizleme | Tabaklar ↔ Gönderiler | section-slide |
| Macro ve Abonelik · Destek | bölüm sekmesi | section-slide |
| Kuponlar | bölüm sekmesi | gösterge kayar; içerik sarılmadı (SORULAR) |
| eatkcal | mağaza → ürün → sepet (EkStore/EkProduct/EkCart) | push-right |
| eatkcal | ödeme özeti, şehir kapısı | modal-bottom |
| Ana sayfa | Gün halkası → GunViewer | modal-fade (hikâye görüntüleyici; bilinçli) |
| Ana sayfa | Tara (AiScan), Checkout, OrderSuccess | modal-bottom |
| Alt sekme çubuğu | sekme değişimi | tab-none (ikon hareketi Design Tur 26h bekliyor — dokunulmadı) |

## Klavye (md.10, commit `fafa889`) — giriş alanlı katmanlar

Kök neden: ortak `Sheet` (core/design) ve Keşfet `BottomSheet` RN `Modal` içinde klavyeyi dinlemiyordu (iOS'ta
Modal penceresi klavyeyle küçülmez → katman ekran altında, klavyenin altında); `position:absolute; bottom:0`
katmanlar `KeyboardAvoidingView` dolgusunu yok sayıyordu (RN ≥ 0.74); Android'de `behavior` verilmiyordu.
Düzeltme ortak `useSheetKeyboard` + `KeyboardLiftView` (src/core/design/keyboard.ts): katman klavyenin üstüne
kayar (klavyenin süresiyle), yükseklik klavye açıkken sınırlanır, içerik kaydırılabilir,
`keyboardShouldPersistTaps="handled"`. Kanıt: `g21SheetKeyboard.test.tsx` (16 test).

| Katman | Bileşen | Klavye |
|---|---|---|
| Sepet › Kupon kodu ekle | `CouponSheet` → `Sheet scroll` | klavyenin üstüne çıkar, kaydırılır ✓ |
| Profil › Kuponlar kod girişi | `FinPrCouponsScreen` → `FinScreen scroll` | sayfa kaydırılır, alan görünür ✓ |
| Kupon detayı | `Sheet scroll` | çıkar ✓ |
| Yorum | `CommentsSheet` → `KeyboardLiftView` | çıkar, liste kısalır ✓ |
| Elle giriş (Kalori ekle) | `HomeManualMealSheet` → `KeyboardLiftView` | çıkar ✓ |
| E-posta kodu | `AccountEmailSheet` → `KeyboardLiftView` | çıkar, kaydırılır ✓ |
| Tara › eksik ekle | `FinPhotoResult` eksik öğe katmanı | çıkar ✓ |
| Keşfet düzenle / etkinlik ekle | `kesfet/BottomSheet` | çıkar ✓ |
| "Çok yakında" formu | `WaitlistFormSheet` | alt kenar klavye yüksekliğinde ✓ |
| Destek / Geri bildirim / Kişisel bilgiler | `FinScreen` | kaydırılır, alan görünür ✓ |
| Adres ekle | `EkAddressAddScreen` (ekran) | zaten dolgu — değişmedi ✓ |
| Tara notu | `ScanNote` | zaten klavyeyi izliyor — değişmedi ✓ |

## TR / EN · açık / koyu

- EN: koddaki 1844 sabit anahtarın tamamı TR + EN (kalıcı test `usedKeysExist`); bu oturumun yeni metinleri
  (barkod, kaynak satırı, geri) TR + EN. Kareler: `FinFeedEN`, `FinEkHomeEN` (+Dark).
- Koyu: md.3 sonrası yeni kabuk telefon temasını izler (`AppSchemeGate`); eski kabuk açık (parite). Yığın zemini,
  Suspense yer tutucusu, paylaşılan gönderi/profil zemini yeni kabukta temadan.

## Simülatör kareleri — `docs/shots/g21/` (34 kare, açık + koyu)

Yöntem: "G19-4 iPhone" (mevcut dev client, native derleme YOK) + bu worktree'den Metro 8114 + vitrin
(`scripts/dev/g14-shots.sh`, `G14_MODE=storage`; Erişilebilirlik izni gerekmez). Vitrin temayı kendisi zorlar
(`ThemeProvider forceScheme`), bu yüzden koyu kareler `userInterfaceStyle` derlemesinden bağımsız.

| Pano | Açık | Koyu |
|---|---|---|
| FinOpen (kase → halka merkezinde alev) | FinOpen.jpg | FinOpen-Dark.jpg |
| FinOnbAccount (kase) | FinOnbAccount.jpg | FinOnbAccount-Dark.jpg |
| FinOnbNotify (kupa) | FinOnbNotify.jpg | FinOnbNotify-Dark.jpg |
| FinTbAbout (alev) | FinTbAbout.jpg | FinTbAbout-Dark.jpg |
| E-posta sheet'i (klavye kipi) | FinOnbAccountKeyboard.jpg | FinOnbAccountKeyboard-Dark.jpg |
| Ana sayfa | FinHomeR3.jpg | FinHomeR3-Dark.jpg |
| Keşfet (TR / EN) | FinFeed.jpg · FinFeedEN.jpg | FinFeed-Dark.jpg · FinFeedEN-Dark.jpg |
| Bildirimler | FinNotifications.jpg | FinNotifications-Dark.jpg |
| Gün halkası | FinGunView.jpg | FinGunView-Dark.jpg |
| Tara | FinScanR2.jpg | FinScanR2-Dark.jpg |
| eatkcal (TR / EN) | FinEkHome.jpg · FinEkHomeEN.jpg | FinEkHome-Dark.jpg · FinEkHomeEN-Dark.jpg |
| Ürün | FinEkProduct.jpg | FinEkProduct-Dark.jpg |
| Sepet | FinEkCart.jpg | FinEkCart-Dark.jpg |
| Profil | FinPrProfile.jpg | FinPrProfile-Dark.jpg |
| Gizlilik ayarları | FinPrivacySettings.jpg | FinPrivacySettings-Dark.jpg |

Klavye açık kare alınamadı: simülatörde donanım klavyesi bağlı (yazılım klavyesi çıkmıyor; Simulator ayarını
değiştirmek kullanıcı tercihini değiştirir → yapılmadı). Klavye davranışı bileşen testleriyle kanıtlı.
