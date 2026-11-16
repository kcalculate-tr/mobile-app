# G56-S1 — eatkcal ana sayfa: sipariş artırma bölümleri (16 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `1e09b61` (G55-S1-DONE). Uygulama yalnız JS/TS (OTA uyumlu, runtime 1.1.0; `app.config.js`'e dokunulmadı). Yeni paket yok. Deploy / OTA / canlı DB yazma / migration uygulama YOK (Supabase MCP yalnız okuma). Haftalık öğün paketi (`pack`) ve planlı sipariş kapsam dışı — hiçbir giriş/kod yok.

## ÖZET
1. **Ana sayfa tasarım sırasıyla** (`EkHome`): üst bar · canlı sipariş · Macro · teslimat · **0** kampanya şeridi · **1** kategori çipleri · **2** tekrar sipariş · **3** kalan kalori (öne çıkan, bulanık renkli zemin + cam) · **4** planından sipariş · mağazalar · **5** bu hafta en çok · **6** arkadaşını davet et · en iyi yorumlar. Yeni kullanıcı (`kind="yeni"`) ve iskelet (`kind="skel"`) aynı sırada.
2. **0 Kampanya şeridi:** mevcut `banner_rows/banner_cells` aynı. Hedefler mevcut `navigate_to` metin şemasına eklendi (yeni tip gerekmedi): `Invite`, `SubPaywall:fresh:yearly`, `ProductList:<filtre>`, `CategoryProducts:<kategori>` (artık Filtrelenmiş liste), `Campaign:<id>` (Kampanyalar ve kuponlar, detay açık). Hücre bazında opsiyonel `audience` (signed_in · guest · no_orders · has_orders); `Invite` hedefi misafirde / bayrak kapalıyken kendiliğinden gizli. Sayfa noktaları eklendi.
3. **1 Çipler** tek yapılandırma dosyasından (`growth/config.ts`): yüksek protein ≥ 30 g, düşük karbonhidrat ≤ 20 g, 500 kcal altı, İçecek = "Detoks & Shake". **Vegan ve Tatlı için alan/kategori yok → çip gizli** (SORULAR 1). Dokununca **Filtrelenmiş liste** (`EkList`).
4. **2 Tekrar sipariş:** yalnız teslim edilmiş ≥ 1 siparişte, son 3. Satışta olmayan kalem → kart üstünde `oos` uyarısı, yalnız kalanlar sepete; seçenekli üründe eski seçim bugün de geçerliyse GÜNCEL fiyatla korunur (ürün sayfasıyla aynı `buildCartAddCalls`), değilse ürün sayfası. Bildirim "N ürün sepete eklendi · Sepete git".
5. **3 Kalan kalori:** kalan = `get_nutrition_summary` (gün halkasıyla aynı RPC) hedef − loglanan. Dolu: kalan ≥ kcal, proteine göre, "Gününe uyar". Doldu: ≤ 400 kcal, "Hafif bir şey?". Hedef yok: boş hâl + "Hedefimi belirle" → `NutritionProfile` (G47 kapı yönlendiricisi kayıt akışına çevirir).
6. **4 Planından sipariş:** bugünün `meal_plan_items` satırları; eşleme kuralı aşağıda. "Hepsini sepete ekle" mevcut `addPlanMealsToCart` (seçim isteyen ürün → ürün sayfası).
7. **5 Bu hafta en çok:** migration `top_products_week(p_limit)`; < 3 ürün → bölüm gizli; kartlarda sıra rozeti ve gerçek "Bu hafta N sipariş".
8. **6 Davet:** ana sayfa kartı + `EkInvite` (davet / boş geçmiş / kod kopyalandı) + Profil satırı + sepette "Davet kodun var mı?". Sunucu: `referral_codes`, `referrals`, `my_referral()`, `apply_referral_code()`, teslimatta iki tarafa kupon (mevcut `campaigns` kişiye özel satırı), `settings.referral_reward_tl / referral_min_order_tl`, bayrak `davet` (kapalı).
9. Analitik: `eatkcal_sec_view` / `eatkcal_sec_tap` (+ `sec`, `st` / `action`), `referral_share` (copy | share), `referral_apply` (sonuç). Sunucu sözlüğü migration'da.
10. Kontroller (son kodla): hygiene + tsc · unit 1442/1442 · jest 129/129 suite, 892/892 test · expo export iOS (3473 modül) + Android (3480 modül) — hepsi geçti.

## Commit
| Commit | İçerik |
|---|---|
| `ac98c33` | **Başka bir oturumun commit'i** (banner Kasım kampanyaları, TR/EN görsel). Aynı worktree'de eşzamanlı çalıştığı için benim o anki yarım dosyalarımı da içine aldı: `growth/config.ts`, G56 migration + rollback (ilk sürüm), `events.ts` olayları, `registry.ts` `davet`, sözlük testi. Son hâlleri aşağıdaki commit'lerde. |
| `3ce33d7` | kurallar (`growth/rules`), davet istemcisi, veri katmanı, `EkList`, `EkInvite`, bölüm bileşenleri, TR/EN metinler (`core/i18n/g56.ts`), rotalar, migration son hâli, birim testleri |
| `e248002` | ana sayfa yeniden düzeni, iskelet, Profil davet satırı, sepet davet kodu satırı, `ProfileCoupons { campaignId }`, jest |
| `1436301` | `G56-*` vitrin sahneleri (yalnız `__DEV__`), gezinme kuralı sınıflandırması, kupon ekranı rota bağlamı güvenli |
| `546bb97` | **Başka oturumun** commit'i (flags yayın yedeği) — bu dalda, benim commit'lerimin arasında. |
| `c5a9b0e` | kalan kalori zemini radyal gradyan (bant yok), vitrin kaydırması |
| (LOG commit'inde) | büyük yazıda ürün kartı yazıyla büyür, fiyat satırı kayar, plan adı 2 satır |
| (LOG commit'i) | bu LOG + `docs/night/g56/` ekran görüntüleri |
| (son) | `docs/night/G56-S1-DONE` |

Not: başka oturumun flags değişiklikleri kendi commit'inde (`546bb97`); benim commit'lerim yalnız yol belirtilerek (`git add <dosya>`) atıldı.

## Eşleme kuralları
- **Plan öğünü ↔ ürün** (`growth/config.PLAN_MATCH`, `rules.matchPlanItems`):
  1. Satırda ürün kimliği varsa (`source = 'eatkcal'`, `ref_id`) o ürün; satışta değilse satır gizli (yedek eşleme yapılmaz — planlanan ürün bilinçli seçilmişti).
  2. Yoksa **aynı öğün tipinde** |kcal − plan| ≤ %10 olan en yakın ürün (eşitlikte yüksek protein, sonra küçük kimlik). Ürünlerde öğün tipi alanı yok → öğün tipi kategori listesinden: kahvaltı = Omlette Box, Mavi Haşhaşlı Bagel Ekmeği, Ekşi Maya Sandviç · öğle = Bowl's, Wrap's, Yüksek Protein, Yağ Yakımı, Dengeli ve Sağlıklı, Ekşi Maya Sandviç · akşam = aynı (sandviç hariç) · ara öğün = Detoks & Shake. Soslar hiçbir öğün tipinde aday değil. (SORULAR 2)
  3. Eşleşme yok → satır yok; hiçbiri yoksa bölüm gizli. Sıra kahvaltı → öğle → akşam → ara öğün.
- **Filtreler** (`growth/config.FILTERS`): eşikler dahil (30 g, 20 g); "500 kcal altı" hariç (< 500). Makro filtrelerinde ve öneri bölümlerinde Soslar yer almaz (`NON_MEAL_CATEGORIES`).
- **Tekrar sipariş seçenek doğrulaması** (`rules.rebuildReorderLine`): grup/seçenek kaldırılmış ya da satışta değil, zorunlu seçim eksik, gramaj adı artık yok, şablon değeri yok, paket ürün → ürün sayfası.

## CANLIYA UYGULANACAK migration'lar
Sıra önemli:
1. `supabase/migrations/20261116120100_banner_kampanya_2026_11.sql` (başka oturumun; `image_url_en` + Kasım bannerları; Invite bannerı **kapalı** eklenir).
2. `supabase/migrations/20261116200100_g56_eatkcal_growth.sql` — rollback `supabase/rollbacks/20261116200100_g56_eatkcal_growth_rollback.sql`. İdempotent. İçerik: `banner_cells.audience` · `top_products_week(p_limit)` (anon + authenticated, yalnız toplu sayı) · `referral_codes`, `referrals` (RLS: yalnız kendi satırı okunur, yazma yalnız fonksiyonlarla) · `gen_referral_code`, `my_referral`, `apply_referral_code`, `referral_same_person`, `referral_phone_key` · `trg_referral_on_delivery` (orders, after insert or update of status) · `settings.referral_reward_tl / referral_min_order_tl` (boş) · `feature_flags.davet = false` · olay sözlüğü 4 satır.
   - **Yerel Postgres sunucusu yok** (yalnız libpq) → SQL canlıya benzer bir veritabanında çalıştırılıp denenemedi; şema canlıdan (salt okuma) doğrulandı, birim testi metin içeriğini denetliyor. Uygulamadan önce bir dal veritabanında `supabase db push --dry-run` önerilir.
   - Uygulama migration'sız da kırılmaz: RPC 404 → top gizli; `settings` kolonu yoksa davet gizli; `audience` yoksa koşulsuz.
3. Davet açılışı: `update settings set referral_reward_tl = …, referral_min_order_tl = … where id = 1;` sonra `feature_flags.davet = true`, sonra Invite bannerı `is_active = true`.

## DEPLOY GEREKİR
- Uygulama: OTA (`eas update --channel production`) — onayınızla. Native değişiklik yok.
- admin-panel (yalnız okunur, dokunulmadı): banner hücresine `audience` seçimi ve yeni hedefler (`Invite`, `SubPaywall:fresh:yearly`, `ProductList:<filtre>`, `Campaign:<id>`) için açılır liste eklenmeli (SORULAR 4).

## KARAR
- Hedef bağlantıları için yeni sütun/tip açılmadı: mevcut `navigate_to` önek şeması genişletildi (eski uygulamalar bilinmeyen öneki `resolveNavigation`'a verir → ana sayfaya düşer).
- `no_orders` = teslim edilmiş siparişi yok; oturumlu kullanıcıda sipariş bilgisi gelmeden banner gizli (güvenli taraf); misafirde görünür.
- Davet girişleri yalnız `davet` bayrağı + oturum + `referral_reward_tl > 0` ile görünür (tutarsız "İkinize de TL kupon" metni çıkmasın).
- Davet ödülü: davet edilenin **ilk teslim edilmiş** siparişi, `payment_status = 'paid'` (Macro motoruyla aynı), ara toplam ≥ `referral_min_order_tl`; kuponlar `campaigns` (fixed, tek kullanım, 90 gün, `min_cart_total` = aynı minimum, `source = 'referral'`). Ödül ayarı boşken teslim edilirse satır `pending` kalır, kupon yok.
- Kötüye kullanım (mevcut veriyle): aynı telefon (`profiles.phone`, son 10 hane) ya da ortak bilinen cihaz (`user_known_devices`) → kod girişi reddedilir (`same_person`) ve teslimatta yeniden kontrol edilip `void`. "Hiç siparişi yok" = iptal / ödeme başarısız / süresi dolmuş dışında sipariş satırı yok.
- Davet ekranı cam nesnesi **kase** (kural: kase = öğün/sipariş; ödül sipariş kuponu). Banner görseli gelene kadar davet kartında opak yüzey + kase + "Davet et" hapı (tasarımdaki yer tutucu çizgili alan üretimde gösterilmedi).
- Bulanık zemin: CSS `blur()` yerine radyal gradyan (RN 0.81 yeni mimari `experimental_backgroundImage`); ilk denemedeki eşmerkezli halkalar koyu temada bant yapıyordu, değiştirildi. "Saydamlığı azalt" açıkken cam yüzeyler opak kart.
- Tasarımda olmayan eski "Bu hafta popüler" bölümü yalnız top verisi yoksa (migration öncesi / < 3 ürün) menüye giriş kalsın diye geri düşüş olarak duruyor. "Restoran yakında" kartı (bayraklı) en altta korundu.
- Kalan kalori "Tümü" → aynı kuralla sınırsız liste; top "Tümü" → aynı sırayla liste (EkList `maxKcal` / `ids`).
- `fetchPastOrders`'a isteğe bağlı durum listesi (varsayılan aynı).

## HIG / erişilebilirlik (kod denetimi)
- Dokunma: çip 44, "Tekrar sipariş ver" 44, kart "+" 44 alan (32 görsel), liste "+" 44 (36), "Tümü" 44, kopyala 48, paylaş 52, "Sepete git" 44 alan (40 görsel), Profil satırı ≥ 52.
- Dynamic Type: yeni metinlerde `maxFontSizeMultiplier` 1,3 (başlıkla aynı politika); başlıklar ve kart adları satır kaydırır, büyük yazı görüntüsü `G56-*-XL`.
- VoiceOver: bölüm başlıkları `header`; tekrar sipariş kartı tek etiket (tarih, ürünler, toplam); oos uyarısı `alert`; ürün kartı ad + kcal + sıra + adet + fiyat; sıra rozeti ve görseller gizli; davet kodu harf harf okunur; bildirimler `alert` + `polite`; sayfa noktaları "1 / 3".
- Kontrast: lime üstünde `#0A0A0A`; ikincil metin tema rolleri; açık temada aktif nokta koyu lime `#4A6B00`.
- Hareket/saydamlık: iskelet nabzı azaltılmış harekette sabit (mevcut `EkSkeleton`); cam yüzeyler "Saydamlığı azalt"ta opak.

## Ekran görüntüleri (`docs/night/g56/`, "G40 iPhone" 402 pt, JPG)
- **Dolu** (siparişli + kalori takipli + planlı): `G56-Full(-S650|-S1300|-S1950|-S2600)(-Dark).jpg` — sayfa yukarıdan aşağı 5 kare (şerit · çipler · tekrar sipariş → kalan kalori → plan → mağazalar · top → davet · yorumlar).
- **Yeni kullanıcı** (sipariş / profil / plan yok; 2 ve 4 gizli, 3 boş hâl): `G56-Yeni(-S650|-S1300)(-Dark).jpg`.
- **İskelet**: `G56-Isk(-S700)(-Dark).jpg`.
- **Davet ekranı**: `G56-Davet(-Dark)` · boş geçmiş `G56-DavetBos(-Dark)` · kod kopyalandı `G56-DavetKopya(-Dark)`.
- **Filtrelenmiş liste** (Yüksek protein): `G56-Liste(-Dark)`.
- EN: `G56-Full-EN`, `G56-Full-S650-EN`, `G56-Full-S1300-EN-Dark`, `G56-Davet-EN`, `G56-Liste-EN-Dark`. Büyük yazı (AX 3XL): `G56-Full-S650-XL`, `G56-Davet-XL`.
- Yöntem: Metro bu worktree'den (8146, CI kipi, `--clear`), `scripts/dev/g14-shots.sh` storage kipi, dev client `--initialUrl`; native derleme yok. Sahneler `G56-*` (yalnız `__DEV__`): ürünler, banner görselleri ve mağazalar GERÇEK katalogdan; siparişler, haftalık adetler, kalori hedefi (2000 / 1240 → 760 kalan), plan ve davet geçmişi örnek (`growth/vitrinFixture.ts`). Sepet çubuğu "Sepet (2)" tasarımdaki gibi vitrin sepetinden. İlter'in "iPhone 17" simülatörüne dokunulmadı; çekimden sonra Metro durduruldu, simülatör kapatıldı.
- Çekim sırasında bulunan ve düzeltilen: (1) bulanık zemin koyu temada bant yapıyordu → radyal gradyan; (2) büyük yazıda kart fiyatı "+" ile çakışıyor, ad kırpılıyordu → kart yazı ölçeğiyle büyür (en çok 1,3×), fiyat satırı kayar, plan satırı adı 2 satır.

## SORULAR
1. **Vegan / Tatlı:** ürünlerde diyet etiketi ya da bu adlarla kategori yok; çipler gizli. Bir kategori (ör. "Tatlılar") ya da `products.tags` eklenirse yalnız `growth/config.ts`'e ad yazmak yeter. Hangisi?
2. **Plan eşlemesinde öğün tipi:** ürünlerde öğün tipi alanı olmadığı için kategori → öğün tipi listesi (yukarıda) kullanıldı. Uygun mu, yoksa `products.meal_slots` gibi bir alan mı açılsın?
3. Davet ödülü / minimum tutar ve kupon geçerlilik süresi (90 gün sabit) — değerler sizde; `settings` boşken hiçbir davet girişi görünmez.
4. admin-panel banner formuna `audience` ve yeni hedefler eklenmeli (panel bu oturumda yalnız okunur).
5. Backend commit'i (migration) CLAUDE.md gereği main'e cherry-pick edilmeli — `main`'e commit bu oturumda yasak.
6. Başka bir oturum aynı worktree'de eşzamanlı çalışıyor (`ac98c33` ve commit edilmemiş flags değişiklikleri). İleride oturum başına ayrı worktree önerilir.
