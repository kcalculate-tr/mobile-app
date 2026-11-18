# G62-S1 — eatkcal siparişi değerlendir (v2) — LOG (18 Kas)

Worktree `g23-s1`, dal `release/1.1.0` (G61-S1-DONE üstüne). Yalnız JS/TS + migration/edge DOSYASI. Yeni paket yok, `app.config.js`'e dokunulmadı, deploy / OTA / canlı DB yazma / bayrak açma yok.

## ÖZET
1. **Bölüm 1 (mevcut durum):** v1 = `reviews` (tek puan + yorum, `is_approved`) + `review_item_feedback` (ürün beğendim/beğenmedim). İstemci doğrudan `insert` ediyor (`src/lib/orderFeedback.ts`); giriş eski `HomeScreen` modalı + `EkOrderDetailScreen` ReviewCard. Ayrıntı aşağıda.
2. **Migration (dosya):** `reviews`'a yalnız sütun ekleme (Teslimat / Kalori uyumu / Lezzet, fotoğraf, sürüm, `moderation_id`), ürün etiketleri, tek yazma yolu `submit_order_rating` RPC (sahiplik + teslim + 7 gün + tek kez + yorum ≤ 500), `restaurant_rating` alt boyutları v2'den (kural aynen), moderasyon hedefi `review`, bayrak `siparis_degerlendirme` KAPALI, 2 olay adı. Rollback veri silmez.
3. **moderate-content (dosya):** `target_type: 'review'` (yorum + `user-media` fotoğrafı); onay → `is_approved = true`; ret → onaysız + `content_reports('review')`.
4. **Arayüz:** FinEkRateSheet (boş / dolu / gönderildi) birebir ölçülerle; ürün oyu + etiketler; düşük puanda (≤ 2) "Bir sorun mu vardı?" → mevcut Destek ekranı. Giriş kartı Ana sayfada (TrackerScreen, "Şimdi değil" ile kapatılabilir) ve sipariş detayında.
5. **İstem:** teslim edildi → 7 gün boyunca, sipariş başına bir kez (sunucu da zorlar). Bayrak kapalıyken v1 akışı bayt bayt aynı (yeni bileşen çizilmez, sorgu atılmaz).
6. **Analitik:** `order_rate_prompt` (sipariş, yüzey; oturumda bir kez) · `order_rate_submit` (puan, 3 başlık, ürün sayısı, yorum var/yok, fotoğraf var/yok — metin YOK).
7. **Kontroller:** hygiene + tsc ✔ · unit 1602/1602 ✔ · jest 140 suite / 987 test ✔ (+ G62 10 test) · `expo export` iOS ✔ (3538 modül) · Android ✔ (3545 modül).
8. **Görüntüler:** `docs/night/g62/` — 16 pano (açık/koyu, TR/EN, büyük yazı).
9. Tasarım uyuşmazlığı: brifteki "FinEkRateNew = giriş kartı" ama dosya "puan + Yeni rozeti kuralı" panosu → kart başka kaynaktan kuruldu (KARAR 1, SORU 1).
10. CANLIYA: 1 migration + 1 edge function deploy (onayınızla); push metni önerisi SORULAR'da.

## Commit
| commit | içerik |
|---|---|
| `d90d5fe` | backend: migration `20261118120100_g62_order_rating.sql` + rollback + `moderate-content` (`index.ts`, `review.ts`) |
| `4dcea4f` | istemci: model (`orderRate.ts`, `orderRateData.ts`), `ui/rate/*` (Sheet, Card, Entry), TrackerScreen + EkOrderDetail bağlantısı, bayrak, olaylar, TR/EN `g62.ts`, vitrin, testler |
| `db8b901` | ekran görüntüleri + vitrin XL çeşidi |
| (bu) | LOG |
| (son) | `docs/night/G62-S1-DONE` |

## 1. Mevcut durum (v1)
- **Şema** (`20260921180500_review_item_feedback.sql`, `20261016143911_reviews_reply_fields_and_guard.sql`, canlı şema 9 Kas):
  - `reviews(id int8, order_id int4, user_id uuid, rating int2, comment text, is_approved bool, created_at, admin_reply, admin_reply_at, admin_reply_by, reply_seen_at)`; `trg_reviews_reply_guard` müşterinin `is_approved`/yanıt alanlarını değiştirmesini engeller (service_role/admin serbest). Sipariş başına tekillik kısıtı repoda YOK.
  - `review_item_feedback(id, review_id → reviews, order_id, user_id, product_id, product_name, liked, created_at)`, `unique(order_id, user_id, product_id)`, RLS kendi satırı.
- **Akış:** RPC yok — `src/lib/orderFeedback.ts`: `fetchPendingFeedbackOrder` (teslim + 30 dk geçmiş + 48 sa içinde + reviews'ta yok; `orders.updated_at` ile) ve `submitOrderReview` (doğrudan `reviews.insert` `is_approved=false` + ürün oyları best-effort).
  - Giriş: eski `src/screens/HomeScreen.tsx` → `OrderFeedbackModal` (yalnız `yeni_siparis` kapalı kabukta) ve `EkOrderDetailScreen` ReviewCard (genel puan 1–5 + ürün oyu + yorum).
  - Push: `push-order-feedback` cron'u (teslimden 30 dk – 6 sa, `trigger_behavioral_push(user, 'order_feedback')`).
  - Restoran puanı: `restaurant_rating()` (G22-S1, son 90 gün, tüm puanlar, <10 → "Yeni"; alt boyutlar NULL). Herkese açık yorumlar: `vitrin_yorumlari` RPC (yalnız `is_approved = true`, ≥ 4★) → ReviewsSheet/TopReviewsStrip.
- **Uygulama içi bildirim listesi yok** (`notifications` tablosu var, uygulama okumuyor) → "uygulama içi bildirim" = Ana sayfa giriş kartı (KARAR 5).
- **Destek girişi var:** `ProfileSupport` (sipariş detayındaki "Talep oluştur" ile aynı).

## KARAR
1. **Giriş kartı tasarımı:** `FinEkRateNew.dc.html` giriş kartı değil, "puan ve Yeni rozeti nasıl çalışır" açıklama panosu (2 örnek kart + 5 kural). Kartı FinEkRateSheet'in arka planındaki "teslim edilen sipariş" kartının ölçüleriyle (14 iç boşluk · 20 köşe · 56 görsel/14 köşe · 15 kalın + 13 ikincil) + eatkcal 44 pt mürekkep düğmesiyle kurdum; görsel yoksa cam kase. FinEkRateNew'daki kurallar zaten yayında (G22 restoran puanı) ve değişmedi; v2 yalnız alt boyutları doldurur.
2. **Genel puan:** tasarım üç ayrı yıldız satırı gösteriyor (emoji yok). `reviews.rating` = üçünün yuvarlanmış ortalaması (istemci ve sunucu aynı formül) → Boss paneli, vitrin, Yorumlarım, restoran puanı DEĞİŞMEDEN çalışır.
3. **Ürün bazında oy + etiketler tasarımda yok** ama brifte var → dim kartlarıyla aynı iç yüzey kartında, 44 pt düğme / etiketlerle eklendi (v1'deki ürün oyu kaybolmasın). Etiketler: beğendim → Lezzetli / Doyurucu / Taze / Porsiyon iyi / Kalori tutarlı; beğenmedim → Soğuk geldi / Porsiyon az / Tuzlu ya da yağlı / Eksik ürün / Kalori tutmadı. Sunucu beyaz listesi istemciyle birebir (test).
4. **Pencere:** v1'deki 30 dk bekleme kaldırıldı — istem teslimden hemen sonra; 7 gün sonra kaybolur. Teslim anı `delivered_at`, yoksa `updated_at`.
5. **Uygulama içi bildirim = Ana sayfa kartı** (bildirim listesi ekranı yok). Kart "Şimdi değil" ile cihazda sipariş bazında kapatılır (AsyncStorage); sipariş detayındaki giriş 7 gün kalır.
6. **Fotoğraf:** mevcut `user-media` (özel) kovası, AI tarama ile aynı yükleme kodu; yol `<uid>/reviews/<sipariş>-<zaman>.jpg` (kova politikası `<uid>/` klasörü). Gönderimde yüklenir; yüklenemezse gönderim durur ve "fotoğrafsız gönderebilirsin" denir. Fotoğraf bu sürümde herkese açık gösterilmiyor (ReviewsSheet fotoğraf çizmiyor) — yalnız denetim + Boss.
7. **Moderasyon:** `moderation_queue` / `content_reports` uuid hedef istiyor, `reviews.id` bigint → `reviews.moderation_id uuid` eklendi. RPC yorum/fotoğraf varsa kuyruğa yazar; istemci `moderate-content`'i best-effort çağırır, düşerse pg_cron yeniden dener. AI onayı `is_approved = true` yapar → onaylı yorum ≥ 4★ ise vitrine girer. Boss panelinin manuel onayı aynen çalışır (yalnız onaysızsa güncellenir). Yalnız puanlı değerlendirmeler v1 gibi onaysız kalır.
8. **Sayfa başlığı:** mevcut `Sheet` bileşeni (tek satır başlık + sağda 44 pt X, eatkcal 200/28 yayı); alt başlık "kcalculate, <tarih>" gövdenin ilk satırı. Mağaza adı sabit "kcalculate" (tek marka; siparişte marka alanı yok). Gönderildi hâlinde sayfa içerik boyunda (tasarımda tam yükseklik) — Sheet bileşeni böyle çalışıyor.
9. **Renkler:** tasarımın açık/koyu değerleri; lime `#B9EF14` jetonu (tasarımdaki eski lime çevrildi). Dolu yıldız = lime dolgu + açıkta mürekkep, koyuda lime çizgi (tasarımdaki gibi).
10. **Rollback veri silmez:** v2 sütunları kalır (v1 okuyucuları görmez); tam temizlik bloğu rollback dosyasında yorum satırı.
11. **Sipariş başına tek değerlendirme** canlıda unique kısıt yerine RPC içinde sipariş satırı kilidi (`for update`) + varlık kontrolüyle — canlıda olası eski çift kayıtlar migration'ı düşürmesin diye. v1 doğrudan insert yolu (bayrak kapalı) değişmedi.

## HIG / erişilebilirlik (kod denetimi + simülatör)
- Dokunma ≥ 44 pt: yıldız 52×48, ürün oyu 44×44, etiket ≥ 44 yükseklik, fotoğraf ekle 44, fotoğraf kaldır 44 (görsel 24), Gönder 52, Tamam 52, destek 44, kart X 44, Değerlendir 44.
- VoiceOver: her başlık `radiogroup` ("Teslimat puanı, 1 ile 5 yıldız arası"), yıldız `radio` + `checked` ("3 yıldız"); oy düğmeleri "<ürün>: beğendim" + `selected`; etiket `checkbox`; Gönder `disabled`/`busy`; ipucu/hata `accessibilityLiveRegion`; gönderimde "Teşekkürler" duyurusu, eksik puanla Gönder'de "üç başlığı da puanla" duyurusu; onay dairesi gizli; özet satırları tek etiket.
- Dynamic Type: sayfa kaydırılabilir; başlık ipuçları sarar (G62-Dolu-XL / G62-Kart-XL: kırpılma yok).
- Reduce Motion: yıldız ve onay dairesi ölçeği yok, onaya geçiş 200 ms opaklık; Sheet kendi azaltılmış kipini kullanır.
- Haptik: yıldız/etiket/oy `selection`, gönderim `success`, hata `warning`.
- `apple-design-skill` ayrıca çalıştırılmadı; denetim yukarıdaki maddelerle elle + simülatörde.

## Testler
- Birim `src/modules/eatkcal/v2/__tests__/g62OrderRate.test.ts` (13): istem (teslim + 7 gün sınırı + bir kez + delivered_at/updated_at), Ana sayfa seçimi (kapatılan / değerlendirilen / eski), genel puan + düşük puan, oy/etiket, gövde (yorum ≤ 500, boş → null), analitikte metin yok, hata kodları, bayrak + migration/rollback metni, RPC kuralları, etiket beyaz listesi eşitliği, moderate-content review yardımcıları, TR/EN anahtar eşitliği + tasarım metinleri.
- Jest `src/modules/eatkcal/v2/__component_tests__/g62OrderRate.test.tsx` (10): boş hâl, dolu → gönder (ürün oyu, etiket, yorum sınırı, fotoğraf), düşük puan → destek, "zaten değerlendirildi", fotoğraf yüklenemedi, giriş kartı + analitik, Ana sayfa bayrak KAPALI (çizim/sorgu yok), oturumsuz / istem yok, "Şimdi değil", EN.
- `metricsDictionary`, `navRule` testleri yeni olaylar / dosyalar için güncellendi.

## Ekran görüntüleri (`docs/night/g62/`)
`G62-Bos`, `G62-Dolu`, `G62-Gonderildi`, `G62-Dusuk`, `G62-Kart` (+ `-Dark`), `G62-Bos-EN`, `G62-Dolu-EN`, `G62-Kart-EN`, `G62-Gonderildi-EN-Dark`, `G62-Dolu-XL`, `G62-Kart-XL`. Yöntem: "G40 iPhone" simülatörü, bu worktree'den Metro (8146, CI), `scripts/dev/g14-shots.sh` storage kipi, vitrin `src/dev/vitrinRate.tsx` (sahte veri). Native derleme yok; İlter'in "iPhone 17"sine dokunulmadı; sonra Metro durduruldu, simülatör kapatıldı.

## CANLIYA UYGULANACAK migration (önce dal DB'de `supabase db push --dry-run`)
1. `supabase/migrations/20261118120100_g62_order_rating.sql` — rollback `supabase/rollbacks/20261118120100_g62_order_rating_rollback.sql`.
   - Önkoşul: G8 `moderation_queue` / `content_reports` / `moderation_actions` (G59 hedef listesi), G22 `restaurant_rating`, G19 `analytics_event_names` (yoksa olay satırları atlanır), `gen_random_uuid()`.
   - `reviews.moderation_id` varsayılanlı NOT NULL sütun → tablo bir kez yeniden yazılır (tablo küçük).
   - Yerel Postgres yok → SQL çalıştırılarak denenmedi; birim testi metni denetliyor.
- CLAUDE.md gereği backend commit'i main'e cherry-pick edilmeli (bu oturumda main yasak): `d90d5fe` (yalnız `supabase/` dosyaları).

## DEPLOY GEREKİR (onayınızla)
- `supabase functions deploy moderate-content` (review hedefi). Migration'dan SONRA (önce deploy edilirse `reviews.moderation_id` yok → 404/500; kuyrukta 'review' satırı da olmaz, zararsız).
- Uygulama: OTA (`eas update --channel production`) — onayınızla. Sıra: migration → edge deploy → OTA → `siparis_degerlendirme` aç (önce %10).

## SORULAR
1. **Giriş kartı tasarımı:** `FinEkRateNew` dosyası giriş kartı değil, puan kuralı panosu çıktı. Kartı mevcut sipariş kartı diliyle kurdum (G62-Kart). Asıl giriş kartı tasarımı varsa gönderir misiniz?
2. **Push metni (onay gerekir):** mevcut `order_feedback` şablonu kullanılıyor (metni repoda yok). Öneri — TR: başlık "Siparişin nasıldı?", gövde "Teslimat, kalori uyumu ve lezzeti 3 dokunuşta puanla." EN: "How was your order?" / "Rate delivery, calorie match and taste in 3 taps." Derin bağlantı sipariş detayı (`EkOrderDetail`). Ayrıca cron penceresi (30 dk – 6 sa) 7 günlük istemle uyumlu; değiştirmedim.
3. **AI otomatik onay:** AI onayı yorumu doğrudan `is_approved = true` yapıyor (≥ 4★ ise vitrine girer). Manuel Boss onayını şart tutmak isterseniz `moderate-content`'te review onayını yalnız "şikâyet yok" işaretine çevirebilirim.
4. **Değerlendirme fotoğrafı** şimdilik herkese açık gösterilmiyor (özel kova). ReviewsSheet'te onaylı fotoğrafların imzalı adresle gösterilmesi istenir mi?
5. **Eski Ana sayfa modalı** (`HomeScreen` + `OrderFeedbackModal`, yalnız `yeni_siparis` kapalı kabuk) v1 olarak bırakıldı. Bayrak açıkken orada da v2 sayfasını açalım mı?
