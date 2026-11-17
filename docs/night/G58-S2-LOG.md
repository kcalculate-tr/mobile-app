# G58-S2 — Keşfet okuma deneyimi + Reels akışı + ücretsiz öğün kuponları (17 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `e7c6ba3` (G58-S1-DONE üstü). Yalnız JS/TS (OTA uyumlu, runtime 1.1.0; `app.config.js`'e dokunulmadı). Yeni paket yok. Deploy / OTA / canlı DB yazma / migration uygulama / bayrak açma YOK. Canlı salt-okuma sorgusu (ürün kategorileri) izin sistemince reddedildi → kategori adları repodan alındı.

## ÖZET
1. **Devamını gör:** her zaman aynı kartta metni tam açar (sayfa değişmez, liste kaymaz). Açık gönderi kimlikleri `KesfetScreen` düzeyinde → yeniden çizimde kapanmaz. Metne dokunmak ayrıntıyı açmaya devam eder.
2. **Tam ekran görsel (`ImageViewer`):** altta yazar (avatar + ad → profil), açıklama (2 satır, dokununca açılır), Beğen / Yorum / Kaydet / Paylaş + sayılar. Sayılar çağıranın canlı gönderisinden (akışta ortak store, detayda sayfanın iyimser durumu) → kartla senkron. Yorum = görüntüleyicinin ÜSTÜNDE `CommentsSheet` (aynı Modal ağacı), kapatınca görüntüleyiciye dönülür. Çift dokunma beğenir (geri almaz) + kalp; tek dokunma katmanı gizler/gösterir (× her zaman kalır); aşağı kaydırma / × kapatır; sayaç `1/3`. Detay sayfası aynı bileşeni kullanır. Yorum ekle/sil kart sayacına yansır (`bumpComments`).
3. **Reels (`kesfet_video`):** yeni `KesfetReels` ekranı — dikey sayfa sayfa akış, tasarım FinReelsPlayer/Swipe/Comments (330 ms standart eğri, eşik 140 pt + hızlı fiske, Reduce Motion'da 220 ms solma). Müzik satırı/plak yok; Gönder = sistem paylaşım sayfası. Tek oynatıcı kuralı: ekrandaki oynar (sesli; ses düğmesi ortak), sonraki duraklatılmış önceden yüklenir, diğerleri oynatıcısız (bellekten bırakılır). Dokun = duraklat/oynat, uzun bas = basılıyken duraklat; ekran arka planda → durur. Katman: sağda beğeni/yorum/gönder/kaydet/ses; altta yazar + Takip et + başlık (öğün adı / etkinlik) + açıklama (yerinde aç/kapa) + öğün/etkinlik çıkartması. Kaynak: dokunulan video + akıştaki videolar (sona yaklaşınca `loadMore`). Giriş: videoya dokun + başlıkta oynat simgesi. Bayrak kapalıyken giriş ve rota yok; video yokken boş hâl.
4. **Ücretsiz öğün kuponu (migration DOSYASI):** mevcut `free_item` yolu (ödemede `validate_coupon_v2` sepetten hesaplar): en pahalı 1 ana öğün, içecek + yan ürün (+ koli) hariç, üst sınır `settings.free_meal_max_tl` (boş = sınırsız), tek kullanım, 30 gün. `free_meal_grants` (idempotent; İzmir kişi başı 1), `grant_free_meals` / `void_free_meals` (yalnız service_role).
5. **Davet:** ödül her iki kişiye 1 ücretsiz öğün; davet edilenin ilk siparişi teslim edilince. `20261116210100` **_superseded** (gövde yorum, `select 1` no-op); yerine `20261117210200_..._v2` (TL ayarı boş, banner hedefi; `davet` bayrağı KAPALI). Metinler: "Arkadaşını davet et, ikinize de 1 öğün bizden" / "Invite a friend, you both get a free meal". Davet girişleri artık TL ayarına değil yalnız `davet` bayrağına bağlı.
6. **İzmir teklifi:** `revenuecat-webhook` Fresh yıllık INITIAL_PURCHASE (App Store / Play, sandbox değil) + teklif `izmir_fresh` (RevenueCat attribute `offer` ya da sunucu teklif kaydı, son 7 gün) → 2 kupon; aynı olay iki kez → tekrar yok; CANCELLATION/EXPIRATION → kullanılmamış kuponlar void. Paywall Fresh yıllık satın almadan önce attribute + `record_subscription_offer` yazar.
7. **Personel hakkı koruması:** webhook `store='manual'` + süresi geçmemiş (boş = süresiz) satırı HİÇBİR olayla ezmez (Mehmet'in 23 Kas deneme bitişi EXPIRATION'ı dahil). İstemci `resolveTier`: sunucudaki manuel hak RevenueCat sonucundan önce. Webhook'ta yetki önce yazılır; kupon hatası yetkiyi engellemez.
8. **Kuponlar ekranı:** `free_item` için ilk şart "1 öğün ücretsiz: sepetteki en pahalı 1 ana öğün…" (+ üst sınır varsa). Kupon tanımlanınca uygulama içi bildirim "2 öğünün kupon kısmına tanımlandı" + Gör → Kuponlarım sekmesi (`FreeMealNoticeHost`, RPC yoksa sessiz).
9. **Derin bağlantı:** `kcal://teklif/izmir` (ve `l.eatkcal.com/teklif/izmir`) → SubPaywall Fresh yıllık + `offer:'izmir_fresh'`; bölge/abonelik koşulu ve "görüldü" kaydı atlanır.
10. **Kontroller (son kodla):** hygiene + tsc · unit 1502/1502 · jest 135/135 suite, 933/933 test · expo export iOS (3490 modül) + Android (3497 modül) — hepsi geçti.

## Commit
| Commit | İçerik |
|---|---|
| `fa6fed2` | md.1 Devamını gör yerinde + ekran düzeyinde açık kimlikler + jest |
| `8d223af` | md.2 ImageViewer etkileşimleri, yorum sayfası üstte, detay aynı bileşen, `bumpComments`, saf kurallar `kesfet/reels.ts`, i18n `g58.ts`, jest + unit |
| `5335dc5` | md.3 Reels ekranı, rota, başlık girişi, CommentsSheet `showClose`, jest (tek oynatıcı) + unit |
| `6da62de` | md.4 migration + rollback'ler, superseded davet dosyası + v2, webhook (manuel koruma + İzmir), istemci kademe önceliği, davet metinleri, kupon şartı, bildirim host'u, testler |
| `3f3c8d1` | md.5 `teklif/:offer` bağlantısı + paywall teklif kaydı (attribute + sunucu), jest |
| `990d530` | Reels/görüntüleyici: hareket token'ları (DURATION), tek marka lime, rota denetimi sınıflandırması |
| `e6e12cc` | vitrin kareleri (yalnız `__DEV__`) + `docs/night/g58s2/` ekran görüntüleri |
| (LOG) | bu dosya |
| (son) | `docs/night/G58-S2-DONE` |

## CANLIYA UYGULANACAK migration'lar (sırayla; önce dal veritabanında `supabase db push --dry-run`)
1. `supabase/migrations/20261116210100_davet_canli_kampanya_hedef.sql` — artık **no-op** (`select 1`). Uygulanması zararsız; sürüm geçmişi için kalır.
2. `supabase/migrations/20261117210100_g58s2_ucretsiz_ogun_kuponu.sql` — rollback `supabase/rollbacks/20261117210100_g58s2_ucretsiz_ogun_kuponu_rollback.sql` (G56 `referral_on_delivery` / `my_referral` gövdeleri birebir). Önkoşul: G56 (`20261116200100_g56_eatkcal_growth.sql`: `referrals`, `referral_same_person`, `gen_referral_code`) canlıda olmalı. İdempotent. Yerel Postgres yok → SQL çalıştırılarak denenmedi; birim testleri metni denetliyor.
3. `supabase/migrations/20261117210200_davet_canli_kampanya_hedef_v2.sql` — rollback `..._v2_rollback.sql`. Yalnız veri; bayrağa dokunmaz.
- Backend commit'leri CLAUDE.md gereği main'e cherry-pick edilmeli (bu oturumda main'e commit yasak).
- Önerilen ayar (İlter kararı): `update public.settings set free_meal_max_tl = <TL> where id = 1;` (boş bırakılırsa sınırsız).

## DEPLOY EDİLECEK fonksiyonlar
- `supabase functions deploy revenuecat-webhook --no-verify-jwt` — **migration 2'den SONRA** (aksi hâlde İzmir kuponu RPC'si bulunamaz → webhook 500 döner, RevenueCat yeniden dener; yetki güncellemesi yine yazılır). Personel koruması bu deploy ile canlıya çıkar — Mehmet Karaduman'ın App Store denemesi **23 Kas**'ta bitiyor; o tarihten önce deploy edilmezse EXPIRATION manuel Balance satırını `free` yapar.
- Uygulama: OTA (`eas update --channel production`) — onayınızla. Native değişiklik yok.
- RevenueCat: ek ayar gerekmez (subscriber attributes webhook gövdesinde varsayılan gelir).

## KARAR
- **İçecek / yan ürün kategorileri:** `Detoks & Shake` (içecek; `growth/config.ts` "İçecek" filtresi), `Soslar` (yan ürün; `NON_MEAL_CATEGORIES`), `Koliye Özel Fırsatlar` (çoklu paket; Macro kuponuyla aynı). Ayar `settings.free_meal_excluded_categories` — panelden değiştirilebilir. Canlı kategori listesi okunamadı (izin reddi) → SORULAR 1.
- **Void kapsamı:** İzmir kuponları CANCELLATION (her neden: iade = `CUSTOMER_SUPPORT`, deneme iptali dahil) ve EXPIRATION'da void; kullanılmış kupon (`campaign_uses` kaydı) dokunulmaz. UNCANCELLATION geri vermez. Davet kuponları iptal edilmez.
- **İzmir koşulları:** yalnız `APP_STORE` / `PLAY_STORE`, `environment != SANDBOX`, ürün Fresh yıllık (`kcalai_fresh*` + yearly/annual/P1Y), yalnız INITIAL_PURCHASE. Kişi başı bir kez (kısmi unique index); aynı olay = aynı `ref` (olay kimliği).
- **Teklif kanıtı:** RevenueCat attribute `offer=izmir_fresh` (satın almadan hemen önce) VEYA `subscription_offer_intents` kaydı (son 7 gün). İkisi de paywall'da yalnız Fresh yıllık satın alımında yazılır.
- **Manuel hak:** `store='manual'` + `tier != free` + (`expires_at` boş ya da gelecekte) → webhook olayı `ignore: manual_entitlement`. Süresi geçmiş manuel hak korunmaz (normal akış).
- **Davet görünürlüğü:** ödül TL değil → `inviteVisible` artık `referral_reward_tl`'ye bakmıyor; tek anahtar `davet` bayrağı. `my_referral` `reward_kind:'free_meal'` döndürür. `referral_min_order_tl` doluysa alt sınır olarak çalışır (v2 dosyası boşaltır).
- **Davet banner'ı (kampanya3):** bayrak açılana kadar pasif; açılış SQL'i v2 dosyasında yorum olarak.
- **Görüntüleyici yorumları:** `CommentsSheet` görüntüleyici Modal'ının içinde (iOS'ta ayrı native modal olarak üstte açılır). Detay sayfasında sayfa kapanınca yerel yorum listesi + sayaç sunucudan tazelenir.
- **Reels kaynağı:** yeni RPC/migration YOK — mevcut `get_feed` sayfaları + istemci video süzgeci (`buildReelsQueue`), sona 2 sayfa kala `loadMore`. Akışta az video varsa kuyruk kısa kalır → SORULAR 4.
- **Reels yorum sayfası:** mevcut `CommentsSheet` + `showClose` (× başlıkta, yazı varken lime Gönder). Tasarımdaki cam (blur) yüzey yerine düz tema yüzeyi (Reduce Transparency eşdeğeri; yeni blur katmanı eklenmedi).
- **Tasarım rengi:** tasarım dosyalarındaki eski lime (`#C6F04F`) yerine G40 tek marka yeşili `palette.lime` (repo kuralı `singleBrandLime`).
- **Reels geri düğmesi:** tasarım gibi solda (itilen sayfa; `navRule` itilen sayfa kuralıyla uyumlu).
- **"Zaten abonesin" hâli:** paywall'da ayrı bir abone ekranı yok → bağlantı abone kullanıcıda paywall'ın bugünkü hâlini açar (mağaza zaten abone uyarısını verir; webhook yükseltmede kupon vermez).
- **Bilinmeyen teklif adı** (`kcal://teklif/ankara`) → teklifsiz paywall.

## HIG / erişilebilirlik (kod denetimi + simülatör)
- Dokunma ≥ 44 pt: görüntüleyici eylemleri 44 (min), yazar satırı 44, × 44; Reels sağ sütun 56×60 (ses 56×52), geri 44, Takip et 44 yükseklik, "devamını göster" 44; yorum × 44.
- VoiceOver: görüntüleyici görseli "Görsel 1 / 3" + ipucu (iki kez dokun: beğen); eylemler "Beğen, 312" + seçili durumu; Reels kapsayıcısı `adjustable` (yukarı/aşağı kaydır = sonraki/önceki reel), oynat/duraklat etiketi, ilerleme `progressbar` değeri, ekran dışı sayfalar gizli; Reels başlıkta "Reels, videoları tam ekran izle".
- Reduce Motion: Reels kaydırma yerine 220 ms solma; görüntüleyici kalp damgası opaklık; geri yaylanma `REDUCED.duration`.
- Kontrast: beyaz metin + üst/alt koyu degrade (tasarım değerleri), yazı gölgesi.
- `apple-design-skill` ayrıca çalıştırılmadı; denetim yukarıdaki maddelerle elle yapıldı.

## Ekran görüntüleri (`docs/night/g58s2/`, "G40 iPhone", JPG, açık + koyu)
- `G58S2-Viewer(-Dark)` — tam ekran görsel + yazar, açıklama, beğen/yorum/kaydet/paylaş.
- `G58S2-Reels(-Dark)` — Reels oynatıcı (öğün çıkartması, Takip et, ses, ilerleme).
- `G58S2-ReelsYorum(-Dark)` — Reels yorum sayfası (× başlıkta).
- `G58S2-Kupon(-Dark)` — Kuponlarım: "1 Öğün Ücretsiz" + kampanya koşulları.
- `G58S2-Davet(-Dark)` — Davet ekranı yeni metinler (G56-Davet panosu).
- Yöntem: Metro bu worktree'den (8146, CI), `scripts/dev/g14-shots.sh` storage kipi, dev client; native derleme yok. Örnek veri yalnız `__DEV__` vitrini. İlter'in "iPhone 17" simülatörüne dokunulmadı; çekim sonrası Metro durduruldu, görünüm/yazı boyutu sıfırlandı, simülatör kapatıldı.

## SORULAR
1. **Hariç kategoriler:** "içecek + yan ürün" = `Detoks & Shake` + `Soslar` (+ `Koliye Özel Fırsatlar`) varsaydım. Canlıda başka içecek/yan ürün kategorisi (ör. tatlı, ekstra) varsa `settings.free_meal_excluded_categories`'e eklenmeli.
2. **Üst sınır:** `free_meal_max_tl` boş (sınırsız) bırakıldı. Bir tavan istenir mi (ör. 350 TL)?
3. **İptalde void:** deneme sırasında aboneliği iptal eden (yenilemeyi kapatan) kullanıcının İzmir kuponları da düşüyor. İstenen buysa tamam; yalnız iadede düşsün istenirse `cancel_reason = 'CUSTOMER_SUPPORT'` ile sınırlarım.
4. **Reels kaynağı:** şimdilik Keşfet akışındaki videolar. Video az olursa kuyruk kısa kalır — yalnız video döndüren `get_feed(p_media='video')` migration'ı bir sonraki turda yazılsın mı?
5. **Davet banner'ı:** bayrak açılınca kampanya3 banner görseli ("Davet et, ikiniz de kazanın") eski TL vaadini taşıyorsa yeni görsel gerekir (metin görselin içinde olabilir).
6. **Bildirim:** kupon bildirimi şimdilik uygulama içi (açılış/öne gelişte). Push da istenirse metin onayı + `send-notification` entegrasyonu ayrı iş.
7. **Davet min. sipariş:** v2 dosyası `referral_min_order_tl`'yi boşaltıyor (İlter: "ilk siparişi teslim edildiğinde"). Alt sınır istenirse ayar doldurulabilir.
