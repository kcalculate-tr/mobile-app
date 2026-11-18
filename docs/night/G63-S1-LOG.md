# G63-S1 — Mesajlar (DM) — LOG (18 Kas)

Worktree `g23-s1`, dal `release/1.1.0` (G62-S1-DONE üstüne). Yalnız JS/TS + migration/edge DOSYASI. Yeni paket yok, `app.config.js`'e dokunulmadı, deploy / OTA / canlı DB yazma / bayrak açma yok. Grup sohbeti: yalnız veri modeli (ekran kapalı).

> Not: worktree'de başka bir oturumun commit'lenmemiş değişiklikleri var (`src/modules/gun/home/homeSectionRules.ts`, `g50HomeRules.test.ts`, `docs/g55…g60`). Dokunulmadı, commit'lere eklenmedi; testler onlarla birlikte koşuldu.

## ÖZET
1. **Veri modeli (migration dosyası):** `conversations` (1to1 | group, `pair_key` tekil), `conversation_members` (role, state active/request/declined/left, last_read_at, muted, istek sınırı alanları), `messages` (body ≤ 1000, kind text/post/story_reply/meal, ref jsonb, **status pending/sent/blocked**, deleted_at). RLS: yalnız üyeler okur, engel iki yönde görmeyi keser; doğrudan yazma politikası YOK.
2. **RPC'ler:** `dm_inbox`, `dm_unread_count`, `dm_open`, `dm_send`, `dm_thread`, `dm_mark_read`, `dm_accept_request`, `dm_decline_request`, `dm_leave`, `dm_mute`, `dm_delete_message` (yalnız kendi, 15 dk), `dm_search_people`. Hepsi `mesajlar` bayrağını denetler.
3. **Kurallar (sunucuda):** karşılıklı takip yoksa ilk mesaj "istek"; kabul edilene kadar okundu bilgisi ve yazıyor yok (`receipts`); gizli hesaba yalnız onaylı takipçi; engel iki yön; hız sınırı 20 mesaj/dk + 30 yeni istek/gün (İstanbul günü) → `{error:'rate_limited', scope}`.
4. **Moderasyon:** metinli mesaj `pending` yazılır + kuyruk; istemci hemen `moderate-content` (`message`) çağırır → izin `sent` (alıcı o an görür, push o an gider), ret `blocked` (alıcı hiç görmez, gönderene nötr "Mesaj gönderilemedi.", metin taslağa döner). Bildir: `report_content` hedefleri `message` + `conversation`; engelle: sohbet menüsünden `block_user`.
5. **Realtime:** `messages` yayına eklendi (RLS'e uyar); yazıyor/okundu = broadcast (DB'ye yazılmaz). Bağlantı yoksa çek-yenile + ön plana gelişte + odakta yenile.
6. **Ekranlar:** FinInbox (sohbetler / istekler / iki boş hâl), FinChat (sohbet / menü / engelle / engellendi / istek hâli), FinChatNew (öneri / sonuç / sonuç yok) birebir ölçüler, açık + koyu, TR + EN.
7. **Girişler:** Keşfet başlığında mesaj simgesi + okunmamış rozeti, PublicProfile "Mesaj", paylaş sayfasında "Mesajla gönder" (gönderi), hikâye görüntüleyicide serbest metin yanıtı (`story_reply`). Bayrak kapalıyken hiçbiri yok, rotalar kayıtlı değil, istek atılmaz.
8. **Push:** `fn_push_dm_message` (sosyal push deseni, bayrak kapalıyken yok, sessize alınana/engelliye yok, istek push'u yalnız ilk mesajda); metin kod sabitinde aynı (`src/modules/mesajlar/push.ts`) — onay bekliyor (SORU 1).
9. **Kontroller:** aşağıdaki tablo (hygiene + tsc · unit · jest · expo export iOS + Android).
10. **Görüntüler:** `docs/night/g63/` — 30 pano (açık/koyu, TR/EN, büyük yazı). Yöntem ve aksilik aşağıda.

## Commit
| commit | içerik |
|---|---|
| `4ffda79` | backend: migration `20261118140100_g63_mesajlar.sql` + rollback + `moderate-content` (`index.ts`, `message.ts`) |
| `e9d2b48` | backend: `dm_thread.receipts` + sıralama / satır tipi düzeltmeleri |
| `9d29754` | istemci: `src/modules/mesajlar/*` (model, istemci, mock, ekranlar, testler), i18n `g63.ts`, bayrak, rotalar + linking + push yönlendirme, Keşfet / PublicProfile / ShareSheet / StoryViewer girişleri, vitrin, kapsayıcı test sınıflandırmaları |
| `520216d` | simülatör düzeltmeleri (hikâye yanıtında alt çubuk gizlenir + yer tutucu "Yanıt gönder…", büyük yazıda balon genişliği, görselsiz hikâye yanıtı) + 30 ekran görüntüsü |
| (bu) | LOG |
| (son) | `docs/night/G63-S1-DONE` |

## Kontroller (son kod)
Kod hâli `520216d` (LOG/DONE yalnız belge):
| Kontrol | Sonuç |
|---|---|
| hygiene + tsc (`npm run typecheck`) | geçti (2841 takipli dosya) |
| unit (`npm run test:unit`) | 1627 / 1627 |
| jest (`npm run test:components`) | 141 / 141 suite, 1002 / 1002 test |
| `expo export --platform ios` | geçti (3550 modül) |
| `expo export --platform android` | geçti (3557 modül) |
| `deno check` (moderate-content) | geçti |

Yeni testler: birim `src/modules/mesajlar/__tests__/g63Dm.test.ts` (25) — istek kuralı, gizli hesap, engel iki yön (SQL + `feed_is_blocked` gövdesi + mock), hız sınırı (sunucu sabitleri + istemci hata metni + uçtan uca 20/dk ve 30 istek/gün), okundu (receipts), silme süresi (15 dk sınırı), bayrak kapalı (her RPC + push + rotalar), migration/rollback/edge sözleşmesi, push metni = SQL, derin bağlantı, TR-EN eşitliği ve tasarım metinleri. Jest `src/modules/mesajlar/__component_tests__/g63Dm.test.tsx` (15) — gelen kutusu, boş hâller, gönder + denetimde engellenen, hız sınırı hatası, Görüldü (aktif/istek), istek kabul/sil + bağlantı uyarısı, silme süresi, gizli hesap, engelle (iki yön), yeni mesaj (öneri/sonuç/yok), paylaş kipi, hikâye yanıtı (bayrak açık/kapalı), ShareSheet hedefi, bayrak kapalı girişler.
Kapsayıcı testlere ekleme: `navRule` (FinChatNew = modal, X sağda), `noLegacyWhenFlagsOn` (DmInbox/DmChat/DmNew = final). `g27KeyboardDismiss` G62'nin `src/dev/vitrinRate.tsx` ScrollView'ı yüzünden kırıktı → `SCROLL_KEYBOARD` eklendi (tek satır).

## KARAR
1. **`messages.status` sütunu eklendi** (brifte yok): "engellenen içerik gönderilmez" kuralı için mesaj önce `pending` (yalnız gönderen görür) yazılıyor. AI erişilemezse mesaj `pending` kalır, "Gönderiliyor…" görünür, pg_cron (`fn_moderate_pending_retry`, mevcut) en çok 3 kez yeniden dener. Metinsiz paylaşım (gönderi/öğün kartı) denetimsiz `sent`.
2. **İstek reddi (Sil) gönderene bildirilmez**; reddeden taraf `declined` kalır, sonraki mesajları görmez (Instagram davranışı). Reddeden kendisi yazarsa sohbet yeniden açılır.
3. **Okundu + yazıyor** yalnız iki taraf da `active` iken (`receipts`). Gönderen, isteğin kabul edilmediğini yalnız "Görüldü" yokluğundan anlar (zaten okunmamışla aynı görünür).
4. **Yazıyor/okundu yayını** Realtime broadcast kanalında (`dm-typing-<sohbet>`); kanal adı sohbet uuid'si. Özel (RLS'li) broadcast kanalı ayarı canlıda açılırsa `config.private` eklenebilir — şimdilik yalnız istemci kuralıyla kapalı (SORU 4).
5. **Tasarımdaki kamera + sesli mesaj düğmeleri yok:** medya/ses mesaj türü bu turda kapsam dışı (yeni paket de gerekir); işlevsiz düğme HIG'e aykırı. "Son görülme [N] dk önce" yerine `@kullanıcı` (çevrimiçi durumu tutulmuyor). Kaydırarak yanıtla (tasarım notu) yok — uzun bas = mesaj seçenekleri (Sil 15 dk / Bildir).
6. **Tarif kartı yerine öğün kartı (`kind='meal'`):** uygulamada tarif ayrıntı rotası yok; tasarımdaki tarif kartı ölçüleriyle (64 görsel, etiket, kcal/P çipleri) öğün kartı. Challenge kartı ve grup satırları meydan okuma özelliğiyle gelecek (ekran kapalı).
7. **Hikâye yanıtı balonu:** sunucu yalnız `story_id` saklar (hikâye 24 sa sonra kalkar) → küçük görsel yoksa etiket + kısa çizgi; görsel varsa tasarımdaki 68×112.
8. **Bağlantı/telefon içeren istekler:** tasarımda bulanık önizleme yok → düz metin + uyarı (gelen kutusu satırında "Bağlantı ya da telefon numarası içeriyor", istek sohbetinde kesik çerçeveli uyarı). Algılama istemcide (`hasLinkOrPhone`, test edildi).
9. **"Mesaj ayarları"** (istekler boş hâli) → mevcut Profil › Gizlilik alt sayfası; ayrı "kim yazabilir" ayarı bu turda yok (SORU 3).
10. **PublicProfile "Mesaj"** yalnız Final düzeninde (yeni kabuk); gizli hesapta yalnız takipçiye görünür (asıl karar sunucuda). Eski kabukta giriş yok.
11. **Paylaş hedefi** yalnız gönderi türünde ve G61 sayfası açıkken (paylasim_karti + paylasim_baglanti); seçilen kişiye `kind='post'` (ref `post_id`) gider, sohbet açılır.
12. **Push metinleri yalnız TR** (sosyal push'larla aynı; G55 bildirim dili altyapısına bağlanmadı). Derin bağlantı `kcal://dm/<sohbet>` → `resolveNavigation` + linking (`DmChat` yalnız bayrak açıkken kayıtlı; değilse varsayılan ekran).
13. **Lime** her yerde `#B9EF14` jetonu (tasarımdaki eski açık lime çevrildi; birim testi denetliyor). Renkler tasarım nesnelerinden birebir (`dmPalette`), cam yüzeyler düz yüzey (Reduce Transparency karşılığı; G61 kararıyla aynı).
14. **Rollback veri silmez:** bayrak kapanır, RPC/tetik/yayın kalkar, okuma politikaları kalkar (tablolar istemciye kapanır), G59 `report_content`/`mod_resolve_report` gövdeleri döner; `message`/`conversation` şikâyetleri arşiv tablolarına taşınır. Tam temizlik yorum bloğunda.

## HIG / erişilebilirlik (kod denetimi + simülatör)
- Dokunma ≥ 44 pt: başlık düğmeleri 44, sekmeler ≥ 48, satırlar ≥ 76 / 60, "Mesaj" hapı 36 görsel / 44 dokunma, gönder 44, istek düğmeleri ≥ 48, menü satırları ≥ 56, uyarı düğmeleri ≥ 48, hikâye yanıtı alanı/gönder 48.
- VoiceOver: satırlar tek etiket (ad, önizleme, zaman, okunmamış, sessize alındı, istek uyarısı); sekmeler `tab` + `selected`; mesaj alanı etiketli; "Görüldü"/yazıyor `liveRegion`; boş hâl başlıkları `header`; Sessize al `switch` + `checked`; engelle onayı `alert` + modal; mesaj seçenekleri erişilebilirlik eylemi ("Mesaj seçenekleri") — uzun basma VoiceOver'da da erişilebilir.
- Dynamic Type: bütün metinler sarar (istek düğmeleri dahil, `adjustsFontSizeToFit` yok); XL panoları `G63-*-XL`.
- Reduce Motion: balon girişi / solmalar 220 ms doğrusal opaklık, uyarı ölçeği yok, yazıyor noktaları sabit 0,6. Hareket değerleri yalnız `motion.tsx` jetonları (`noLocalMotionTokens` testi).
- Haptik: sekme/kişi seçimi `selection`, kabul `success`, engelle `warning`, hata `warning`.
- `apple-design-skill` ayrıca çalıştırılmadı; denetim yukarıdaki maddelerle elle + simülatörde.

## Ekran görüntüleri (`docs/night/g63/`)
`G63-Gelen` (+ `-Dark`, `-EN`, `-XL`), `G63-Istekler` (+ `-Dark`), `G63-GelenBos`, `G63-IsteklerBos`, `G63-Sohbet` (+ `-Dark`, `-EN`, `-XL`), `G63-Menu` (+ `-Dark`), `G63-Engelle` (+ `-Dark`, `-EN`), `G63-Engellendi`, `G63-Istek` (+ `-Dark`, `-EN`, `-XL`), `G63-Yeni` (+ `-Dark`), `G63-YeniSonuc`, `G63-YeniYok` (+ `-EN`), `G63-HikayeYanit` (+ `-Dark`), `G63-Kesfet` (başlıkta mesaj simgesi + rozet).
Yöntem: bu worktree'den Metro (8146, CI), vitrin `src/dev/vitrinMesajlar.ts` (bellek içi DM dünyası, sahte veri), `g14-shots.sh` storage kipinin aynısı.
**Aksilik:** "G40 iPhone"daki uygulama çekim sırasında iki kez kaldırıldı (başka bir süreç; DerivedData da silinmiş, disk 8,5 GB boş → native derleme yasak). Native derleme YAPILMADI: başka bir işin geçici klasöründeki 9 Kas 1.1.0 simülatör dev-client paketi (değiştirilmeden) kopyalandı ve yeni oluşturduğum "G63 iPhone" (iPhone 17 Pro, iOS 26.5) simülatörüne kuruldu; İlter'in "iPhone 17"sine dokunulmadı. Bitince Metro durduruldu, simülatör kapatıldı ("G63 iPhone" cihazı silinmedi — silme izni verilmedi; isterseniz `xcrun simctl delete "G63 iPhone"`). PublicProfile "Mesaj" panosu vitrinde gerçek profil istemcisi istediği için çekilmedi (jest + kaynak denetimi kapsıyor).

## CANLIYA UYGULANACAK migration (önce dal DB'de `supabase db push --dry-run`)
1. `supabase/migrations/20261118140100_g63_mesajlar.sql` — rollback `supabase/rollbacks/20261118140100_g63_mesajlar_rollback.sql`.
   - Önkoşul: G5–G11 Keşfet katmanı (`profiles.is_private`, `follows`, `user_blocks`, `creators`, `posts`, `feed_*` yardımcıları, `content_report_risk`), G22 `search_like_pattern`, G59 `stories` + `story_can_view` + `report_content`/`mod_resolve_report`, G62 hedef listesi (`review`), G8 `fn_moderate_pending_retry` cron'u, Vault `service_role_key`, `pg_net`, yayın `supabase_realtime`.
   - Yerel Postgres yok (yalnız libpq) → SQL çalıştırılarak denenmedi; birim testi metni denetliyor. Dal DB'de dry-run şart.
- CLAUDE.md gereği backend commit'leri main'e cherry-pick edilmeli (bu oturumda main yasak): `4ffda79`, `e9d2b48` (yalnız `supabase/` dosyaları).

## DEPLOY GEREKİR (onayınızla)
- `supabase functions deploy moderate-content` (`message` hedefi) — migration'dan SONRA.
- Uygulama: OTA (`eas update --channel production`) — onayınızla. Sıra: migration → edge deploy → OTA → `mesajlar` aç (önce iç kullanıcılar / %10).

## SORULAR
1. **Push metni (onay gerekir):** önerilen ve kodda olan — sohbet: "%{ad}: %{mesajın ilk 60 karakteri}" (metinsiz paylaşımda "%{ad}: Bir gönderi paylaştı" / "Bir öğün paylaştı"); istek: "%{ad} sana mesaj göndermek istiyor" (yalnız ilk mesajda). Başlık "Kcalculate", derin bağlantı `kcal://dm/<sohbet>`. EN karşılığı (dil altyapısına bağlanırsa): "%{name}: %{text}" / "%{name} wants to send you a message".
2. **AI erişilemezse** mesaj `pending` kalıyor (güvenli taraf; cron 3 deneme). Mesajlaşmada bu gecikme kabul edilmezse "AI düşükse gönder + sistem şikâyeti" (açık başarısızlık) moduna geçebilirim. Ayrıca her metinli mesaj bir model çağrısı demek (maliyet) — kısa/selamlaşma mesajları için ön süzgeç istenir mi?
3. **"Kimler mesaj atabilir" ayarı** (herkes / takip ettiklerim / kimse) tasarımdaki "Mesaj ayarları"nda ima ediliyor ama brifte yok. İstenirse `profiles` alanı + `dm_can_message` dalı eklerim.
4. **Realtime özel kanal:** yazıyor/okundu yayını şu an genel broadcast kanalında (adı sohbet uuid'si). Canlıda "Realtime Authorization" (private channels) açılabilirse `realtime.messages` politikasıyla üyeye kısıtlarım — Dashboard ayarı olduğu için onayınız gerekir.
5. **Medya mesajı** (fotoğraf/ses) ve **grup sohbeti ekranı** sonraki tura mı? Veri modeli grup için hazır (`kind='group'`, `role`).
