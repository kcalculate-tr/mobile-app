# G60-S1 — Keşfet sıralaması v2 (dil + yerellik + etkileşim) + eatkcal konum kapısı (17 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `cee9143` (G59-S1-DONE üstü). Yalnız JS/TS (OTA, runtime 1.1.0; `app.config.js`'e dokunulmadı). Yeni paket yok (PGlite yalnız geçici dizinde, repoya eklenmedi). Deploy / OTA / canlı DB yazma / migration uygulama / bayrak açma YOK.

## ÖZET
1. **Eski yol dokunulmaz:** `get_feed` aynen; yeni `get_feed_ranked(p_lang, p_cursor, p_limit)` ayrı fonksiyon. İstemci yalnız `kesfet_siralama` açıkken ve yalnız "Keşfet" (for_you) sekmesinde çağırır; "Sana Özel" kronolojik. Sunucu da bayrağı denetler (kapalı → `kapali` → istemci `get_feed('tr')`ye düşer). Geri alma = bayrağı kapatmak.
2. **Puan** (ağırlıklar tek yerde: `kesfet_rank_score` + `kesfet_rank_config`; TS kopyası `src/modules/kesfet/ranking.ts`): `yenilik × (1 + etkileşim) × ilişki × yerellik × dil − ceza`. Dil ve şehir FİLTRE DEĞİL öncelik; gizlilik süzgeci get_feed ile birebir (`published` + kendi `pending`, `feed_can_view_author`).
3. **Sayfalama:** imleç = `as_of` + konum + son puan + son id. Puan as_of'a göre (yaş, as_of sonrası etkileşimler sayaçtan düşülür, takip/etkileşim as_of'a kadar, as_of sonrası gönderi aday değil). İstemci id ile tekilleştirir. Tekrar/kayıp yok — SQL'de ve TS'de test edildi.
4. **Çeşitlilik + keşif:** aynı yazardan arka arkaya en çok 2; resmi hesap (`kurum`) 20'lik sayfada sabitlenmiş dışı en çok 3; her 10. yuva keşif (başka dil/şehir, ağırlıklı etkileşim ≥ 3); ilk 24 sa +0,5 yenilik bonusu. Uygun aday yoksa sıradaki alınır (akış boş kalmaz).
5. **Performans:** `post_stats` (likes/saves/adds/comments/reports) + yeniden sayma tetikleyicileri (hata yutar — beğeni/yorum yazması asla bozulmaz) + ilk doldurma migration'ı. Aday = sabitlenmiş + son 30 gün, en çok 500.
6. **Dil:** store'da sabit `'tr'` kalktı → `feedRequestLang`: bayrak kapalıyken `'tr'` (bugünkü davranış birebir), açıkken uygulama dili. Composer'da TR/EN seçici (varsayılan uygulama dili) → `posts.lang`.
7. **Ölçüm:** `post_views` + `record_post_views` (toplu upsert, ≤ 50 öğe, süre ≤ 600 sn, görülemeyen gönderi atlanır). İstemci `impressions.ts`: ≥ 1 sn, oturumda gönderi başına bir kez, 10'luk paket ya da 30 sn; RPC yoksa / bayrak sunucuda kapalıysa toplama durur. Puana girmez.
8. **eatkcal kapısı:** yabancı ülkede arama boşken ülkenin en kalabalık 30 şehri (eyalet alt satırı) — yeni `top_cities` RPC (anon + authenticated; `search_cities` değişmedi); 1 harfte yerel süzme; veri yok → "Şehrini yaz" + yazılanla devam satırı hemen; hata → "Şehirler yüklenemedi" + Tekrar dene. "Çok yakında" + bekleme listesi akışı aynen.
9. **Veri tamamlama:** `scripts/geo/build-missing-cities-seed.mjs` (talimat aşağıda; canlıya yükleme İlter).
10. **Kontroller (son kodla):** hygiene + tsc ✓ · unit 1551/1551 ✓ · jest 137/137 suite, 959/959 test ✓ · PGlite 45/45 ✓ · expo export iOS (3515 modül) ✓ + Android (3522 modül) ✓.

## Commit
| Commit | İçerik |
|---|---|
| `407d8a5` | 5 migration + 5 rollback (post_stats → doldurma → get_feed_ranked → post_views → top_cities) + `supabase/tests/g60_s1.check.mts` (PGlite) |
| `0e1424e` | İstemci: `ranking.ts` (saf TS kopyası), store sıralı yol + düşme, `client.getFeedRanked/recordPostViews`, `impressions.ts`, KesfetScreen bağlantısı, composer TR/EN, bayrak kaydı, `g60.ts` TR/EN, birim testleri + SQL'den üretilmiş puan fikstürü |
| `b14bdfd` | eatkcal kapısı (`useTopCities`, GatePicker hâlleri), `geo.ts` (`fetchTopCities`, `filterTopCities`, `isMissingRpc`), i18n, geo tamamlama betiği, birim + jest testleri |
| (LOG) | bu dosya |
| (son) | `docs/night/G60-S1-DONE` |

## KARAR
- **Ağırlıklar SQL sabiti** (`kesfet_rank_score` gövdesi + okunur `kesfet_rank_config()`), `settings`/`app_settings` değil: her çağrıda ek okuma/RLS yok, sürüm denetimi migration ile. TS `RANK_CONFIG` aynı; birim testi iki tarafın sabitlerini SQL dosyasından okuyup karşılaştırıyor. Ayar değişikliği = yeni migration.
- **Ağırlıklar:** tazelik τ = 48 sa, ilk 24 sa +0,5 · ekleme 4 / kaydetme 3 / yorum 2 / beğeni 1 · takip ×1,5, son 30 gün etkileşim ×1,2 · aynı şehir ×1,3 · başka dil ×0,35 · ceza 0,2 × çözülmemiş şikayet (en çok 5) · aday 30 gün / 500 · keşif her 10. yuva, eşik ağırlıklı ≥ 3 · yazar dizisi ≤ 2 · resmi ≤ 3 / 20 · ileri bakış 50.
- **Ceza:** yalnız çözülmemiş şikayetler (`content_reports.status in ('open','pending')`, hedef `post`); reddedilen şikayet cezayı kaldırır. Eşik üstü zaten gizli (moderasyon `status` değiştirir).
- **"Resmi hesap" = `creators.role = 'kurum'`.**
- **Şehir:** izleyenin ve yazarın `addresses.city` (varsayılan adres, yoksa en yeni), `geo_fold` ile karşılaştırma ("İzmir" = "izmir"). Şehir hiçbir yere DÖNDÜRÜLMEZ. IP/GPS kullanılmaz.
- **Çeşitlilik + keşif + imleç:** keyset `(puan, id)` yeniden sıralama ile tutarsız olacağı için sıra her çağrıda as_of'a göre deterministik yeniden kurulur (yalnız istenen sayfa + 1 sayfa paya kadar); imleçteki son id bulunursa ondan sonrası, bulunamazsa konumdan. As_of sonrası gönderi aday değil; as_of sonrası beğeniler sayaçtan düşülür → bir gönderi sayfalar arasında yükselip atlanamaz.
- **Planlı gönderi:** `get_feed` `published_at > now()` olanları da döndürüyor; `get_feed_ranked` yalnız `published_at <= as_of` (zamanı gelmemiş gönderi erken görünmez).
- **Gönderi sayaçları:** öğe gövdesi get_feed ile aynı şekil; likes/saves/adds/comments `post_stats`'tan (güncel), `did_it` ve `me` alt sorgu (sayfa başına ≤ 20).
- **Hata yolu:** sıralı ilk sayfa hata verirse `get_feed('tr')` (bugünkü davranış); sıralı imleçle sonraki sayfa hata verirse normal hata (imleç eski RPC'de geçersiz). Bayrak oturum ortasında değişirse yüklü akış baştan yüklenir.
- **"Sana Özel" + bayrak açık:** görev metnine uyuldu — get_feed'e uygulama dili gidiyor. get_feed dili SERT filtrelediği için EN kullanıcı takip ettiklerinin yalnız EN gönderilerini görür → SORULAR 1.
- **top_cities ayrı fonksiyon** (search_cities imzası/davranışı aynen; eski sürümler etkilenmez). Canlıda henüz yoksa (PGRST202) istemci hata değil serbest yazım gösterir — migration öncesi OTA güvenli.
- **post_views** yalnız bayrak açıkken yazılır (sunucu da denetler); RLS açık, istemci okuyamaz.
- **Apple HIG (kod denetimi, apple-design-skill):** dil çipi dokunma alanı 44×44 pt (`buttons.md › Best practices`), VoiceOver etiketi seçili dili söyler + ipucu; şehir hata satırı 52 pt, `button` rolü, tam etiket; liste başlığı/ipucu 13 pt tema `secondary` (mevcut `optSub` stili), FinText/AppText ile Dynamic Type; yeni hareket yok. Critical/High bulgu yok.

## CANLIYA UYGULANACAK (sırayla; önce dal veritabanında `supabase db push --dry-run`)
1. `supabase/migrations/20261117230100_g60_post_stats.sql` — tablo + `post_stats_refresh` + 4 tetikleyici (reactions, meal_adds, comments, content_reports). Rollback `supabase/rollbacks/20261117230100_g60_post_stats_rollback.sql` (önce 3'ü geri al).
2. `supabase/migrations/20261117230200_g60_post_stats_backfill.sql` — mevcut tablolardan ilk doldurma (idempotent). Rollback `…230200_…_rollback.sql`.
3. `supabase/migrations/20261117230300_g60_get_feed_ranked.sql` — bayrak `kesfet_siralama` (KAPALI, min 1.1.0), 5 indeks, `kesfet_rank_config`, `kesfet_rank_score`, `get_feed_ranked`. Önkoşul: G22-S2 `geo_fold` (canlıda var). Rollback `…230300_…_rollback.sql`.
4. `supabase/migrations/20261117230400_g60_post_views.sql` — `post_views` + `record_post_views`. Rollback `…230400_…_rollback.sql`.
5. `supabase/migrations/20261117230500_g60_top_cities.sql` — `top_cities` (anon + authenticated). Rollback `…230500_…_rollback.sql`. **Bayraktan bağımsız; kapıyı hemen düzeltir** (OTA ile birlikte).
- Doğrulama: `PGLITE_DIR=<pglite node_modules üstü> npx tsx supabase/tests/g60_s1.check.mts` → "G60-S1 PGLITE: TUM KONTROLLER GECTI" (5 migration 2 kez + rollback + yeniden; SQL ≡ TS; tekrar/kayıp yok; gizlilik; tetikleyici hatası yazmayı bozmaz).
- Backend commit'i CLAUDE.md gereği main'e cherry-pick edilmeli (bu oturumda main'e commit yasak): `407d8a5`.
- Bayrak açılışı (İlter): `update public.feature_flags set enabled = true, rollout_percent = 10 where key = 'kesfet_siralama';` (önce küçük yüzde). Kapatmak = `enabled = false` (istemci anında get_feed'e döner).

### Veri tamamlama (geo_cities; İlter'in makinesinde)
```
cd ~/dev/kcal-mobile   # release/1.1.0
curl -O https://download.geonames.org/export/dump/cities15000.zip && unzip cities15000.zip
curl -O https://download.geonames.org/export/dump/countryInfo.txt
curl -O https://download.geonames.org/export/dump/admin1CodesASCII.txt
psql "$DB_URL" -At -c "select distinct country_iso2 from public.geo_cities order by 1" > have.txt
node scripts/geo/build-missing-cities-seed.mjs --cities cities15000.txt --countries countryInfo.txt \
  --admin1 admin1CodesASCII.txt --have have.txt --out supabase/seed/geo_cities_missing.sql \
  --client-out /tmp/geoCountries.next.ts
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed/geo_cities_missing.sql
```
Betik idempotent SQL üretir (ülke + şehir + admin1, `ON CONFLICT DO NOTHING`); RU/BY varsayılan hariç (G23 kararı). Sentetik GeoNames biçimli dosyayla denendi (JP eklendi, RU atlandı, PPLX süzüldü, admin1 doldu).

## PERFORMANS NOTU
- Canlıda `EXPLAIN` çalıştırılmadı (canlı DB okuma izni bu oturumda reddedildi; yazma zaten yasak). Ölçüm PGlite'ta (WASM, tek iş parçacığı — Postgres sunucusundan belirgin yavaş): 702 gönderi (643'ü 30 gün penceresinde → 500 aday sınırı), 3.947 tepki: sayfa süreleri **35,5 / 32,7 / 32,8 / 33,0 / 32,8 / 34,1 ms**, konum 480 sayfası 42,2 ms; `EXPLAIN ANALYZE select get_feed_ranked('tr', null, 20)` → Execution Time 30,6 ms. Hedef < 150 ms.
- Bugünkü canlı hacim (13 gönderi) için ihmal edilebilir. Büyüdükçe maliyet: aday başına `feed_can_view_author` (2 dizinli EXISTS) + sıra kurma (plpgsql, en çok sayfa + 20 konum × ≤ 50 ileri bakış).
- Canlıda uygulamadan sonra ölçüm: `explain (analyze, buffers) select public.get_feed_ranked('tr', null, 20);` (bir kullanıcı JWT'siyle, ya da `set request.jwt.claim.sub`).

## DEPLOY GEREKİR
- Edge function yok. Uygulama: OTA (`eas update --channel production`) — onayınızla. Native değişiklik yok. OTA migration'lardan önce de güvenli: bayrak satırı yokken kapalı, `top_cities` yokken serbest yazım, `record_post_views` yokken toplama durur.

## SORULAR
1. **"Sana Özel" dili (bayrak açıkken):** görev "eski get_feed için de doğru dil gider" diyor; ama get_feed dili SERT filtreler → EN uygulama dilindeki kullanıcı takip ettiklerinin TR gönderilerini görmez (bugün 13 gönderinin hepsi TR). Öneri: "Sana Özel" için de `'tr'` korunsun ya da dil filtresiz `get_feed_following` yazılsın. Karar?
2. **KVKK — `post_views` ve şehir eşleşmesi:** görüntülenme kişiye özel, yalnız sıralama için; yazar/izleyen adres şehri yalnız puanda kullanılıyor (dışarı verilmiyor). Gizlilik metnindeki "uygulama kullanım verisi" maddesi görüntülenme verisini kapsıyor mu, adres şehrinin içerik önceliği için kullanılması ayrıca belirtilmeli mi? Hukuk onayı olmadan bayrak açılmasın öneririm.
3. **Ülke listesi:** istemci ülke listesi (`geoCountries.ts`) bilerek yalnız EU/NA/SA + TR (G22-S2); JP, AE vb. seçilemiyor. Betik `--client-out` ile Intl adlı genişletilmiş liste önerisi üretiyor. Asya/Afrika/Okyanusya listeye eklensin mi? (Eklenirse `GeoContinent` tipine AF/OC + `geo.test.ts` kıta beklentisi güncellenir.)
4. **Ağırlıklar:** τ = 48 sa ile 10 günlük gönderi bile çok etkileşimle ~0,06 puan alıyor (akış pratikte "son 2–3 gün + etkileşim"). İçerik az olduğu dönemde eski güçlü gönderilerin daha uzun yaşaması istenirse τ büyütülebilir (yeni migration).
5. **Planlı gönderi farkı:** get_feed `published_at` gelecekte olan gönderiyi şimdiden gösteriyor (sıralı akış göstermiyor). get_feed'deki bu davranış bilinçli mi?
