# G58-S1 — Bayrak açma turu: ogun_plani · sosyal_bildirim · kesfet_video (17 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `4709129` (G58-S1 brief, G57 üstü). Uygulama yalnız JS/TS (OTA uyumlu, runtime 1.1.0; `app.config.js`'e dokunulmadı). Yeni paket yok. Deploy / OTA / canlı DB yazma / migration uygulama / canlıya sorgu YOK. Bayraklar AÇILMADI (canlıda dördü de `false`).

## ÖZET
1. **ogun_plani:** 5 hata düzeltildi — (a) Ücretsiz kullanıcı alışveriş listesinde paywall'ı kapatınca listenin tamamını görüyordu → liste HİÇ çizilmez, kilitli kart; (b) abonelik durumu yüklenmeden (`unknown` → `free`) Fresh kullanıcı paywall'a atılıyordu → bekler; (c) plan yokken "Elle ekle" ile eklenen kalem görünmüyordu; (d) misafir ve yükleme hatası hâli yoktu (boş plan kartı + sessiz başarısız kayıt) → giriş kartı / hata + Tekrar dene; (e) gün kartında "Loglandı 443 kcal" iOS'ta satırın üstüne kayıyordu; büyük yazıda başlık/ad kırpılıyordu.
2. **ogun_plani engeli:** üretimde **yayımlanmış tarif yok** (`g33_recipe_seed` satırları `draft`) → "Planı benim için oluştur" kalıcı pasif, alışveriş listesi tarif malzemesi üretmez. Açılış için tarif yayımı + `meal-plan-generate` deploy gerekir (BAYRAK RAPORU).
3. **sosyal_bildirim:** okundu işareti yalnız başarılı yüklemede ve yüklenen en yeni satıra kadar (eskiden hata olsa da hepsi okundu, arada gelen görülmemiş satır da okunuyordu); okunmamış vurgusu korunur; sayfalama (eskiden ilk 30); sonuçlanmış takip isteği yeniden "Onayla/Sil" ile dönmüyor; satır VoiceOver etiketi + takip isteği düğmelerine ulaşım; zil rozeti ekran her öne gelişte tazelenir, zil etiketi okunmamış sayısını söyler.
4. **sosyal_bildirim sunucu (migration DOSYASI):** okumada engellenen aktör, sonuçlanmış takip isteği ve moderasyonda kaldırılan yorumun bildirimi listede ve sayaçta süzülür; 1 saatlik tekilleştirme aynı kişinin farklı yorumlarını artık düşürmüyor. Kendi eylemin için bildirim yok + ekleme anı engel kontrolü zaten vardı, korundu.
5. **Yönlendirme:** gönderili bildirim → `SharedPost` (yorum/yanıtta `commentId` de), gönderisiz → `PublicProfile { handle || id }` — handle'sız kullanıcıda kimlikle açıldığı test edildi; dev alt sayfasında da aynı düzeltme.
6. **kesfet_video:** native oynatıcı yalnız görünür hücrede (liste kaydırmada aynı anda tek akış oynatıcısı; görünmez olan sökülür/serbest — eskiden her video satırı kendi oynatıcısını açıp kaynağı yüklüyordu); Keşfet arka plandayken ya da tam ekran açıkken akış videosu durur (eskiden çift ses); 4 foto + video gönderisinde video akışta düşüyordu → video 1 hücre (toplam ≤ 4, Final çubuğu "En fazla 4 foto veya 60 sn video") ve ızgarada ilk hücre; ses tercihi hücreler arası ortak, her açılışta sessiz.
7. **Video sınırları:** 60 sn / 50 MB korundu (öneriyle aynı). iOS'ta galeriden seçilen video 720p H.264'e dışa aktarılır (`videoExportPreset`, mevcut `expo-image-picker`); boyut okunamazsa ret; 3gpp/webm ret; hata metni türüne göre (eskiden her hata "çok uzun"); süre etiketi "1:00" (eskiden "0:60"); kaldır düğmesi 44 pt.
8. G57'den kalan 3 kırık test düzeltildi (ImageViewer klavye özellikleri + modal sınıfı; Keşfet yazar profili `handle || id` test kalıbı).
9. Testler: plan (ekran hâli, kilit, misafir, elle kalem), bildirim (yönlendirme, okundu, istek, sayfalama, bayrak kapısı, migration), video (sınırlar, tür, ızgara, kota, oynatma kapısı, tek oynatıcı, bayrak kapısı) — birim + jest.
10. Kontroller (son kodla): hygiene + tsc · unit 1478/1478 · jest 131/131 suite, 911/911 test · expo export iOS (3483 modül) + Android (3490 modül) — hepsi geçti.

## Commit
| Commit | İçerik |
|---|---|
| `48b3430` | ogun_plani: misafir/hata hâli, alışveriş listesi kilidi, abonelik yüklenmeden atmama, plansız elle kalem; TR/EN metinler; birim + jest |
| `e2dea53` | sosyal_bildirim: okundu güvenliği, sayfalama, istek, VoiceOver, rozet; `notifRoute.ts`; migration + rollback; testler |
| `f07debc` | G57 sonrası kırık 3 test |
| `903b3cb` | kesfet_video: tek oynatıcı, odak/tam ekran durdurma, ızgara + composer kotası, seçici doğrulama, metinler; testler |
| `8f4e10c` | vitrin G58 sahneleri (yalnız `__DEV__`), seçici kontrol sırası |
| `c0eb711` | ogun_plani: gün kartı "Loglandı N kcal" kayması |
| `79d112b` | vitrin: Keşfet sekmesiyle aç, kilitli liste, composer seçili video (yalnız `__DEV__` parametreleri) |
| `9df0c59` | ogun_plani: büyük yazıda gün kartı başlığı + öğün adı; vitrin `-XL` |
| (LOG commit'i) | bu LOG + `docs/night/g58/` ekran görüntüleri + G53 kılavuz testinde tek-video kalıbı (vitrin ön dolumu) |
| (son) | `docs/night/G58-S1-DONE` |

Not: aynı worktree'de `docs/g58/` (G58-S2 brief + başlatma betiği) başka bir oturumun dosyaları — dokunulmadı, commit'lenmedi. Commit'ler yalnız yol belirtilerek atıldı.

## BAYRAK RAPORU
| Bayrak | Karar | Neden / önkoşul |
|---|---|---|
| `ogun_plani` | **AÇILAMAZ (şimdilik)** | (1) Üretimde yayımlanmış tarif yok: `20261112100200_g33_recipe_seed.sql` 40 tarifi `draft` ekler, istemci yalnız `published` okur (taslak yalnız `__DEV__`) → "Planı oluştur" pasif + "Plan şu an yüklenemedi" metni, alışveriş listesi tarif malzemesi üretmez; elle planlama yalnız eatkcal (İzmir) ve "kendi öğünüm" ile çalışır. (2) Balance koç modu `meal-plan-generate` edge fonksiyonu deploy'u ister (bulunamazsa şablona düşer + "koç şu an yok" bildirimi — kırılmaz). (3) G33 tablolarının canlıda varlığı bu oturumda doğrulanamadı (canlıya sorgu yasak; `CANLI_SEMA_2026-11-09` G33'ten önce) — doğrulama SQL'i aşağıda. (4) G58 düzeltmeleri OTA ile yayında olmalı (eski 1.1.0 paketinde Ücretsiz kullanıcı paywall'ı kapatınca listeyi görür). **Dördü sağlanınca AÇILABİLİR.** |
| `sosyal_bildirim` | **AÇILABİLİR** — koşullu | G58 OTA'sı yayında olmalı (okundu/istek/sayfalama düzeltmeleri istemcide). `20261117200100_g58_social_notif_filters.sql` önerilir (yoksa: engellenen kişinin engelden önceki bildirimleri görünür ve sayılır; sonuçlanmış istek satırı listede kalır — istemci artık düğmeye basınca gizliyor). Dikkat: bildirim satırları bayrak kapalıyken de üretiliyor (yalnız push bayrağa bağlı) → açılışta kullanıcılar birikmiş geçmişi ve yüksek okunmamış sayısı görür (SORULAR 3). Push bu turda yok. |
| `kesfet_video` | **AÇILAMAZ (şimdilik)** | Kod tarafı düzeltildi ve iOS simülatörde akış/tam ekran/composer doğrulandı; ancak (1) **Android'de sıkıştırma yok** (seçicinin video kalite seçeneği yalnız iOS; yeni paket yasak) → 1080p telefon videosu ~25–30 sn'de 50 MB'ı aşıp reddedilir, kullanıcı "en fazla 50 MB" görür; (2) Android cihaz/emülatörde oynatıcı + bellek testi yapılamadı (yalnız iOS simülatör + jest); (3) yeniden denemede yüklenmiş dosyalar sahipsiz kalır (her deneme yeni klasör) ve sunucu `create_post` bayrağı denetlemiyor; (4) depolama/çıkış maliyeti kararı (aşağıdaki yöntem). Android'de en azından gerçek cihaz testi + maliyet onayıyla **AÇILABİLİR**; Android sıkıştırma native paket ister (yeni build). |

## Kontroller
(son kodla, LOG commit'inden önce)
- hygiene + tsc: geçti (hygiene OK, tsc 0 hata)
- unit (`tsx --test`): 1478/1478 geçti
- jest: 131/131 suite, 911/911 test geçti
- expo export iOS: geçti (3483 modül) · Android: geçti (3490 modül)
- Başlangıçta (4709129) kırık: unit 2 (ImageViewer klavye, gezinme sınıfı) + jest 1 (g21Handoff) — G57 kaynaklı, düzeltildi.

## CANLIYA UYGULANACAK migration'lar
1. `supabase/migrations/20261117200100_g58_social_notif_filters.sql` — rollback `supabase/rollbacks/20261117200100_g58_social_notif_filters_rollback.sql` (g8 gövdeleri birebir). İdempotent; yalnız `list_social_notifications` ve `social_notifications_guard` gövdeleri; tablo/şema/veri değişmez. Yerel Postgres yok → SQL çalıştırılarak denenmedi; birim testi metni denetliyor. Önce dal veritabanında `supabase db push --dry-run` önerilir. Backend commit'i CLAUDE.md gereği main'e cherry-pick edilmeli (bu oturumda main'e commit yasak).
2. ogun_plani için yeni migration YOK. Açılıştan önce canlıda doğrulama (salt okuma):
   ```sql
   select to_regclass('public.meal_plans'), to_regclass('public.meal_plan_items'), to_regclass('public.shopping_list_items'),
          to_regclass('public.recipes'), to_regclass('public.ingredient_nutrition');
   select status, count(*) from public.recipes group by status;
   ```
   Tarif yayımı (diyetisyen onayıyla, İlter): `update public.recipes set status = 'published' where key in (…);`

## DEPLOY GEREKİR
- Uygulama: OTA (`eas update --channel production`) — onayınızla. Native değişiklik yok.
- ogun_plani Balance: `supabase functions deploy meal-plan-generate` (açılıştan önce).

## KARAR
- Plan ekranı hâli saf fonksiyonda (`access.planScreenState`): misafir → giriş kartı (her durumda); hata + önbellek yok → hata kartı; önbellek varsa içerik; yüklenirken boş plan kartı yerine yuvalar.
- Alışveriş listesi kapısı (`access.shopGate`): Fresh/Balance açık; abonelik `unknown` + oturumlu → bekle (hiçbir şey çizilmez, paywall açılmaz); Ücretsiz → paywall BİR KEZ açılır, kapatılınca altında kilitli kart ("Fresh'e geç"); misafir → giriş kartı (paywall açılmaz). Erişim kuralı aynı: Ücretsiz plan görüntüleme + elle planlama serbest, şablon önizleme 1 gün; Fresh şablon + liste; Balance koç + liste (brief'teki "Pro" = uygulamada Balance).
- Tasarım kaynağı: worktree'de ve ana checkout'ta `design/final` yok → mevcut ekranlar referans; yeni görsel karar yok, yalnız boş/hata/kilit hâlleri mevcut boş kart düzeniyle (aynı kase, aynı düğme).
- Bildirim okundu üst sınırı = yüklenen en yeni satırın `created_at`'ı (`markReadUntil`); liste boşsa sunucu `now()`.
- `respond_follow_request` → `istek_yok` = istek zaten sonuçlanmış/iptal → satır gizli kalır; ağ hatasında satır geri gelir.
- Video sınırları değişmedi (60 sn / 50 MB = öneri). Süre bilgisi gelmezse (0) kabul (bazı sağlayıcılar vermiyor; reddetmek tüm videoları engelleyebilir) — boyut ise zorunlu (dosyadan okunur, okunamazsa ret).
- Composer: video 1 hücre sayılır (toplam ≤ 4) — Final çubuk metni "En fazla 4 foto veya 60 sn video" ve 4 hücreli ızgarayla tutarlı. Kılavuzdaki "En fazla 4 fotoğraf ve 1 video" satırı (G53) bu kuralla çelişiyor → SORULAR 5.
- Oynatıcı sayısı: akışta yalnız görünür hücrede (`shouldMountPlayer`); geri kaydırınca yeniden tamponlar (bellek/veri karşılığında kabul).
- Vitrin (yalnız `__DEV__`): `initialTab: 'for_you'` (17 Kas sonrası ilk açılış "Sana Özel"), `vitrinLocked`, composer `vitrinPrefill.video`, G58 sahneleri ve sahte veri yolları.

## HIG / erişilebilirlik (kod denetimi + simülatör)
- Dokunma ≥ 44 pt: plan kartı düğmeleri 50, liste kilit düğmesi 48, bildirim satırı tam genişlik, Onayla/Sil 32 + hitSlop 6, zil/geri 44, akış ses 36 + 4, tam ekran rozeti (G8 kipi) 28 + 8, composer kaldır 20 + 12.
- Dynamic Type (AX XL, `-XL` kareleri): plan gün kartı başlığı kayar, öğün adı büyük yazıda 5 satıra kadar (eskiden "…"); bildirim, kilitli liste, composer taşmasız.
- VoiceOver: bildirim satırı tek etiket ("Okunmamış, Ad, eylem, zaman"); takip isteği satırı gruplanmaz (düğmeler ayrı); zil "Bildirimler, 3 okunmamış"; plan hâl başlıkları `header`; video kapağı "Tam ekran", ses düğmesi "Sesi aç/kapat"; composer video düğmesi `disabled` durumu.
- Kontrast: yeni metinler tema rolleri (ink / sec); açık + koyu kareler.
- Hareket: yeni hâller mevcut `FadeIn` (azaltılmışta 200 ms opaklık).
- `apple-design-skill` ayrıca çalıştırılmadı; denetim yukarıdaki maddelerle elle yapıldı.

## Depolama maliyeti (kesfet_video) — yöntem
Sayı uydurulmadı. Gönderi başına üst sınır: video ≤ 50 MB + 3 kare JPEG (q 0,7; kapak = ilk kare). Tahmin için:
1. Ortalama video boyutu = ort. bit hızı × ort. süre / 8. iOS (720p H.264 dışa aktarım) ve Android (sıkıştırmasız, cihaz kayıt bit hızı) AYRI ölçülmeli; en doğrusu ilk test yüklemelerinden:
   `select count(*), avg((metadata->>'size')::bigint)/1048576.0 as ort_mb from storage.objects where bucket_id = 'post-media' and name like 'posts/%/video.%';`
2. Aylık depolama artışı (GB) = aylık video gönderisi × (ort. video + 3 kare) / 1024. Birikimli: her ay eklenir (silme yok).
3. Aylık çıkış (egress, GB) = Σ izlenme × ort. video boyutu × izlenen oran. Kova herkese açık; akışta yalnız görünür hücre yüklenir (G58 öncesi her satır yükleniyordu).
4. Maliyet = depolama GB × Supabase depolama birim fiyatı + egress GB × egress birim fiyatı (plan kotası düşülerek; güncel fiyat Supabase faturalandırma sayfasından).

## Ekran görüntüleri (`docs/night/g58/`, "G40 iPhone" 402 pt, JPG)
- **ogun_plani:** `G58-Plan(-Dark)` dolu hafta (bugün kahvaltı loglanmış) · `G58-PlanBos(-Dark)` boş · `G58-Liste(-Dark)` alışveriş listesi (Fresh) · `G58-ListeBos(-Dark)` · `G58-ListeKilit(-Dark)` Ücretsiz kilitli kart · EN `G58-Plan-EN`, `G58-Liste-EN` · büyük yazı `G58-Plan-XL`, `G58-ListeKilit-XL`.
- **sosyal_bildirim:** `G58-Bildirim(-Dark)` (takip isteği, gruplanmış beğeni, yorum, yanıt, takip) · `G58-BildirimBos(-Dark)` · EN `G58-Bildirim-EN-Dark` · `G58-Bildirim-XL`.
- **kesfet_video:** `G58-Video(-Dark)` akışta sessiz otomatik oynatma (0:42 hapı, ilerleme) · `G58-VideoTam(-Dark)` tam ekran · `G58-VideoYaz(-Dark)` composer boş (Video düğmesi) · `G58-VideoSecili(-Dark)` foto + video seçili ("1:00", Video pasif, 2/4) · `G58-VideoSecili-XL`.
- Yöntem: Metro bu worktree'den (8146, CI kipi), `scripts/dev/g14-shots.sh` storage kipi, dev client `--initialUrl`; native derleme yok. Plan verisi tohum tariflerden deterministik şablon (yalnız vitrin), bildirim/video mevcut vitrin örnekleri. İlter'in "iPhone 17" simülatörüne dokunulmadı; çekim sonrası Metro durduruldu, görünüm/yazı boyutu sıfırlandı, simülatör kapatıldı.
- Çekimde bulunan ve düzeltilen: gün kartı sayı kayması; büyük yazıda başlık/ad kırpılması; G57 sonrası vitrin akışının "Sana Özel"de (boş) açılması.

## SORULAR
1. **Tarif yayımı:** 40 taslak tarif diyetisyen onayıyla `published` yapılsın mı? (ogun_plani'nin tek gerçek engeli.)
2. **Android video sıkıştırma:** Android'de 50 MB sınırı ~25–30 sn 1080p'ye denk geliyor. Seçenekler: (a) böyle aç (kullanıcı uzun videoda "en fazla 50 MB" görür), (b) Android'de süre sınırını düşür, (c) native sıkıştırma paketi + yeni build. Hangisi?
3. **Birikmiş bildirimler:** `sosyal_bildirim` açılınca kapalıyken üretilmiş bildirimler (aylar) görünecek. Açmadan önce eski satırlar okundu yapılsın mı (canlı veri yazma — sizde), yoksa liste yalnız son N gün mü gösterilsin?
4. **Gizli hesap:** gizli hesabın (takip onaylanmamış) beğeni/yorumu bildirimi bugün geliyor (gönderi herkese açıksa doğal). Ek bir kural istenirse (ör. karşılıklı takip yoksa ad gizli) karar sizde.
5. **Medya kotası metni:** composer kuralı "4 foto veya video (toplam 4)" oldu; görsel kılavuzundaki (G53) "En fazla 4 fotoğraf ve 1 video" satırı güncellensin mi? (Metin İlter onayı ister; değiştirilmedi.)
6. **Push metinleri** (bu turda yok) — öneri: beğeni "%{ad} gönderini beğendi", yorum "%{ad} yorum yaptı: %{alıntı}", takip "%{ad} seni takip etmeye başladı", istek "%{ad} seni takip etmek istiyor". Onay sizde.
7. **Sunucu bayrak denetimi:** `create_post` `kesfet_video` bayrağını denetlemiyor (eski/yan istemci video gönderebilir); ayrıca yeniden denemede sahipsiz dosyalar kalıyor. Bir sonraki turda migration + temizlik işi açılsın mı?
8. `Gün ekranı` girişi: bugün Gün ekranında öğün planına doğrudan giriş yok (yalnız Profil satırları, kişisel plan ekranı, `kcal://plan/today`, eatkcal "Planından sipariş"). Tasarımda Gün kartı isteniyorsa ayrı iş.
