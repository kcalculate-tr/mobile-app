# G59-S1 — Hikâye (müziksiz) + personel hakkı koruması (17 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `23f2f38` (G58-S2-DONE üstü). Yalnız JS/TS (OTA uyumlu, runtime 1.1.0; `app.config.js`'e dokunulmadı). Yeni paket yok. Deploy / OTA / canlı DB yazma / migration uygulama / bayrak açma YOK.

## ÖZET
1. **md.0 personel hakkı:** G58-S2'de yapılmıştı (webhook `isProtectedManual` + istemci `resolveTier` manuel önceliği + birim testleri). Doğrulandı; ek olarak jest testi eklendi (EXPIRATION / CANCELLATION / RENEWAL / INITIAL_PURCHASE / PRODUCT_CHANGE → `ignore: manual_entitlement`). **Deploy 23 Kas'tan önce gerekli** (aşağıda).
2. **md.1 veri modeli (migration DOSYASI):** katmanlı hikâye — taban medya (foto / ≤ 60 sn video / yazılı hikâyede düz-degrade `bg`) + `overlays jsonb`; görüntü yakalama yok, görüntüleyici katmanları cihazda çizer. Tablolar `stories`, `story_views`, `story_reactions`, `story_poll_votes`, `story_sticker_events`, `story_highlights`, `story_highlight_items`; RLS; görme kuralı tek yerde (`story_can_view` = `feed_can_view_author` [engel + gizli hesapta yalnız onaylı takipçi] + 24 sa ya da öne çıkanda). RPC'ler: tepsi, kullanıcı hikâyeleri, halka, öne çıkan hikâyeleri, görüldü, tepki, anket, çıkartma dokunması, öğünü günlüğe ekle (`source='story'`), görenler (yalnız sahibi), arşiv, öne çıkan CRUD. Bayrak `hikaye` KAPALI; video hikâye ayrıca `kesfet_video`. Müzik / soru / challenge türleri sunucuda reddedilir.
3. **Moderasyon:** metin katmanı (yazı/konum/bahset/etiket/anket) varsa hikâye `pending` başlar → `moderate-content` (yeni `story` hedefi: metin + taban görsel/kapak) yayına alır; `moderation_queue` + pg_cron yeniden dener. "Bildir" = mevcut rapor akışı (`report_content` hedef `story`), `mod_resolve_report` story'yi kaldırır/yayınlar.
4. **Tepsi:** Keşfet akışının üstünde (gün halkası şeridinin üstünde) — "Hikâyen" + lime artı (kamera), görülmemiş lime / görülmüş gri halka, sıra: ben → görülmemiş → en yeni. Profil fotoğrafında halka (kendi profili + PublicProfile / FinProfilePublic); dokununca görüntüleyici.
5. **Kamera:** tasarım birebir (flaş kapalı/oto/açık + hap, ön/arka, 0,5/1×/2, Oluştur, Günüm, bugünün öğün fotoğrafları şeridi, galeri, dokun = foto / basılı tut = video ≤ 60 sn [yalnız `kesfet_video`], Gönderi / Hikâye / Reels sekmesi; Reels yalnız `kesfet_video` → Composer `startVideo`).
6. **Düzenleyici:** tools · text (renk, 5 yazı tipi, hizalama, kutu) · draw (kalem / fosforlu / silgi, 2–24 pt) · stickers (Konum, Bahset, Anket, Saat, Etiket + "Bugünden": Öğün, Gün halkası, Seri, Su, Anket) · placed (sürükle, iki parmak büyüt/döndür, orta kılavuz, çöpe sürükle) · mealpick (Açık/Koyu/Cam, makro anahtarı) · kit ("Günüm": halka + su + seri + son öğün). Paylaş = yükle → `create_story` → metin varsa `moderate-content`.
7. **Görüntüleyici:** ilerleme çubukları (foto 5 sn, video kendi süresi, doğrusal), sol üçte bir önceki / sağ sonraki, basılı tut duraklat (başlık solar), aşağı kaydır kapat, yana kaydır sonraki/önceki kişi, yukarı kaydır = hızlı tepkiler (başkası) / Görenler (sahibi). `coach` = ilk açılışta gezinme ipucu (bir kez) + kendi hikâyende Kcalculate AI Koç ipucu kartı (`koc` açıksa; "Koç'a sor"). `reply` = YALNIZ 6 hızlı tepki (serbest metin yok). Anket tek oy + yüzdeler; öğün çıkartması → "Ben de günlüğüme ekle".
8. **Görenler** (yalnız sahibi; liste/boş, Tümü/Tepkiler, çıkartma etkileşimleri, Öne çıkar / Paylaş / Sil) ve **Öne çıkanlar** (profilde satır; Yeni / Düzenle / kapak seç / sil; 24 saati dolan hikâyeler arşivden).
9. **Bayrak kapalıyken giriş YOK:** rotalar (`StoryCamera/Editor/Viewer`) kayıtlı değil, tepsi / halka / öne çıkanlar çizilmez, istek atılmaz.
10. **Kontroller (son kodla):** hygiene + tsc · unit 1520/1520 · jest 136/136 suite, 948/948 test · expo export iOS (3512 modül) + Android (3519 modül) — hepsi geçti. Ekran görüntüleri `docs/night/g59/` (34 kare, açık + koyu).

## Commit
| Commit | İçerik |
|---|---|
| `6b790b5` | md.1 migration + rollback, `moderate-content` story hedefi (+ saf `story.ts`), saf model (`overlays.ts`, `rules.ts`), istemci + sunucu kurallarını birebir uygulayan mock, birim testleri |
| `499c47d` | md.2 ekranlar (tepsi, kamera, düzenleyici + sayfalar, çıkartma, tuval, görüntüleyici, görenler, öne çıkanlar), bayrak kaydı, rotalar + rota denetimi, Keşfet / profil entegrasyonu, Composer `startVideo`, TR/EN `g59.ts`, jest |
| `0b20d4e` | Simülatörde bulunan hatalar: Reanimated ilerleme eğrisi worklet değildi (`CURVE.linear` token'ı), öne çıkan sayfaları profil kaydırmasında kırpılıyordu (Modal), kit yerleşimi araç çubuğuyla çakışıyordu, ScrollView ortak klavye özellikleri; vitrin G59 sahneleri (yalnız `__DEV__`) + ekran görüntüleri |
| `eda53b6` | `src/dev/vitrinHikaye.ts` gitignore beyaz listesi (temiz checkout'ta vitrin kırılmasın) |
| (LOG) | bu dosya |
| (son) | `docs/night/G59-S1-DONE` |

## CANLIYA UYGULANACAK migration (önce dal veritabanında `supabase db push --dry-run`)
1. `supabase/migrations/20261117220100_g59_hikaye.sql` — rollback `supabase/rollbacks/20261117220100_g59_hikaye_rollback.sql` (report_content / mod_resolve_report G10 gövdelerine satır satır döner; test bunu denetliyor).
   - Önkoşul: G5–G11 Keşfet katmanı, G10 `report_content`/`mod_resolve_report`, G21 `meal_consumptions_source_check`, G8 `moderation_queue`.
   - İçerik: bayrak `hikaye` (KAPALI, min 1.1.0), 7 tablo + RLS, RPC'ler, `meal_consumptions.source += 'story'`, rapor/moderasyon hedefi `story`, post-media `stories/{uid}/` yazma (bayrak açıkken) / silme politikası.
   - **Yerel Postgres sunucusu yok** (makinede yalnız libpq) → SQL çalıştırılarak denenmedi; birim testleri metni denetliyor (tablolar, RLS, gizlilik kuralı, bayrak, gizli türler, begin/commit, `$$` dengesi). İlk uygulamada dal DB'de deneyin.
- Backend commit'leri CLAUDE.md gereği main'e cherry-pick edilmeli (bu oturumda main'e commit yasak): `6b790b5` (migration + rollback + `moderate-content`).
- Bayrak açılışı (İlter): `update public.feature_flags set enabled = true, rollout_percent = 100 where key = 'hikaye';` — önce `moderate-content` deploy (aksi hâlde metinli hikâyeler `pending` kalır).

## DEPLOY EDİLECEK fonksiyonlar
- **`revenuecat-webhook` (G58-S2'den, ACİL):** personel / manuel hak koruması bu deploy ile canlıya çıkar. **Mehmet Karaduman'ın App Store denemesi 23 Kas'ta bitiyor; o tarihten önce deploy edilmezse EXPIRATION manuel Balance satırını `free` yapar.** (`supabase functions deploy revenuecat-webhook --no-verify-jwt`, G58-S2 migration 2'den sonra — G58-S2-LOG.)
- **`moderate-content`** — `story` hedefi (migration'dan SONRA; yoksa `stories` tablosu bulunamaz). Bayrak açılmadan önce gerekli.
- Uygulama: OTA (`eas update --channel production`) — onayınızla. Native değişiklik yok.

## KARAR
- **Tepsi yeri:** tasarımda tepsi karesi yok → Keşfet akışının en üstü, mevcut "Gün halkası" şeridinin ÜSTÜNDE ayrı satır; ölçüler o şeritle aynı (64 halka / 52 avatar). Gün halkası şeridi kaldırılmadı (SORU 1).
- **Resmi hesap:** `creators.role='kurum'` + `verified_at` dolu + gizli değil → takip edilmese de tepside.
- **Kapsam dışı (İlter):** müzik, anonim, `challenge`, `question`, serbest metinli yanıt — kütüphanede yok, sunucu reddeder. Ek olarak gizli: **Bağlantı** çıkartması (URL denetimi yok, kimlik avı riski), **Yakın arkadaşlar** (özellik yok), **Cihaza kaydet** (görüntü yakalama + medya kütüphanesi paketi yok — yeni paket yasak).
- **Adım çıkartması:** uygulamada adım verisi yok → gizli (uydurma veri yok). Su yalnız `su_takibi` açıkken, halka yalnız hedef kalori varsa, seri yalnız > 0 ise.
- **Tarif çıkartması:** bileşen ve sunucu desteği var, ancak "Bugünden" karosu açılmadı — bugünün tarif kaynağı (öğün planı) canlıda yayımlanmış tarif içermiyor (G58-S1). SORU 3.
- **"Öğün detayını gör"** (görüntüleyici öğün menüsü) gösterilmedi: hikâye öğünü için detay rotası yok; yalnız "Ben de günlüğüme ekle".
- **Yazı tipleri:** Fraunces / JetBrains Mono uygulamada yok → "Klasik" = sistem serif (Georgia), "Daktilo" = sistem mono (Menlo).
- **Silgi:** yol bazlı (dokunulan yolu tümden siler) — piksel silgi görüntü yakalama ister.
- **Anket oyu** değiştirilemez (Instagram davranışı); sonuç yalnız oy veren + sahibine.
- **Tepki** kendi hikâyene yok; tepki "görüldü" de sayılır. Kendi hikâyen görüldü sayılmaz.
- **Silinen hikâye:** yumuşak silme; öne çıkanlardan da düşer. 24 saati dolan hikâye tepside yok, arşivde ve öne çıkanlarda kalır.
- **Cam yüzeyler:** medya üstü kontroller düz `rgba(0,0,0,0.42)` (blur katmanı eklenmedi, G58 kararıyla aynı); Reduce Transparency'de `#1C1C1E`.
- **Lime:** tasarımdaki eski lime yerine G40 tek marka yeşili `palette.lime` (repo kuralı `singleBrandLime`); açık zeminde çizgi `limeLineOnLight`.
- **Hareket:** 110 / 330 / 550 ms = `DURATION.instant/base/slow`; ilerleme çubuğu için yeni token `CURVE.linear` (motion.tsx, tek yer). Reduce Motion: sayfa/kişi geçişi 200 ms opaklık.
- **Video kaydı:** basılı tutunca kamera `video` kipine geçer (~350 ms) sonra `recordAsync({ maxDuration: 60 })`; mikrofon izni o anda istenir. Simülatörde kamera yok → gerçek cihazda denenmeli (SORU 4).
- **Görüldü / sıra:** görüntüleyici kişinin ilk görülmemiş hikâyesinden açılır; öne çıkan modunda baştan.
- **Kcalculate AI Koç ipucu:** tasarımdaki `coach` hâli gezinme ipucu (bir kez gösterilir); İlter'in istediği Koç kartı kendi hikâyende ayrıca, hikâyedeki çıkartmaya göre 3 sabit ipucundan biri + "Koç'a sor" (CoachChat, ön doldurulmuş).

## HIG / erişilebilirlik (kod denetimi + simülatör)
- Dokunma ≥ 44 pt: tüm yüzen düğmeler 44 (40 daire + kenar), deklanşör 84, mod sekmeleri 44, renk/yazı tipi/fırça 44, çıkartma karoları 148, anket seçenekleri 44, hızlı tepkiler 76, görenler satırı 60 + seçenek 44, öne çıkan daireleri 72.
- VoiceOver: tuval/hikâye etiketli; görüntüleyici dokunma alanı `adjustable` (artır = sonraki, azalt = önceki, escape = kapat), ilerleme `progressbar` ("Hikâye 2 / 3"); halkalar "Ayşe, yeni hikâye"; katmanlar düğme + "sil" özel eylemi; anket `radiogroup`, sonuç "Hayır, yüzde 67"; anahtarlar `switch`; kaydırıcı `adjustable`; sayfalar `accessibilityViewIsModal`.
- Reduce Motion / Transparency karşılıkları var (yukarıda). Kontrast: medya üstü beyaz metin + koyu degrade/gölge (tasarım değerleri).
- Dynamic Type: hikâye tuvali içi metinler (çıkartma, yazı katmanı) bilerek sabit (`allowFontScaling=false`) — hikâye görsel bir kompozisyon, izleyicide yazar ile aynı görünmeli; tuval dışı tüm metinler ölçeklenir.
- `apple-design-skill` ayrıca çalıştırılmadı; denetim yukarıdaki maddelerle elle + simülatörde yapıldı.

## Ekran görüntüleri (`docs/night/g59/`, "G40 iPhone", JPG, açık + `-Dark`)
`G59-Tepsi` · `G59-Kamera` · `G59-Duzenleyici` (tools + öğün eşleşme çubuğu) · `G59-Yazi` (text) · `G59-Cizim` (draw) · `G59-Cikartma` (stickers) · `G59-Yerlesim` (placed) · `G59-GundenSec` (mealpick) · `G59-Kit` · `G59-Goruntuleyici` (view) · `G59-Ipucu` (coach) · `G59-Yanit` (reply) · `G59-Gorenler` (liste) · `G59-GorenlerBos` (boş) · `G59-OneCikanlar` (row) · `G59-OneCikanDuzenle` (edit) · `G59-OneCikanYeni` (new).
- Yöntem: Metro bu worktree'den (8146, CI), `scripts/dev/g14-shots.sh` storage kipi, dev client; native derleme yok. Örnek veri yalnız `__DEV__` vitrini (`src/dev/vitrinHikaye.ts`, tasarımın yer tutucu fotoğrafları). Simülatörde kamera yok → kamera karesinde vizör vitrin görseli. İlter'in "iPhone 17" simülatörüne dokunulmadı; çekim sonrası Metro durduruldu, görünüm/yazı boyutu sıfırlandı, simülatör kapatıldı.

## SORULAR
1. **Tepsi + Gün halkası:** Keşfet'te iki yatay halka satırı oldu (hikâyeler üstte, gün halkaları altta). Gün halkası şeridi hikâye açılınca kaldırılsın mı / hikâye tepsisine mi katılsın?
2. **Bağlantı çıkartması** (tasarımda var) URL denetimi olmadan açılmadı. İstenirse yalnız alan adı izin listesi (eatkcal.com vb.) ile ekleyebilirim.
3. **Tarif çıkartması:** kaynak ne olsun — bugünün öğün planındaki tarif mi, Keşfet'te kaydedilen tarif mi? Canlıda yayımlanmış tarif yok.
4. **Video kaydı:** expo-camera'da foto → video kip geçişi gerçek cihazda denenmedi (simülatörde kamera yok). TestFlight'ta basılı tut → kayıt doğrulanmalı.
5. **Bildirimler:** hikâyeye tepki / anket oyu için sosyal bildirim (push) üretilmiyor. İstenirse `social_notifications` türü + metin onayı ayrı iş.
6. **Hikâye saklama:** 24 saati dolan hikâye kalıcı olarak arşivde (depo dosyaları dahil). Belirli bir süre sonra (ör. 1 yıl, öne çıkanda olmayanlar) temizleme cron'u istenir mi?
7. **Moderasyon bekleme:** metinli hikâye `moderate-content` dönene kadar (birkaç sn) yalnız sahibine görünür ("Kontrol ediliyor" rozeti). Model erişilemezse pg_cron 10 dk'da bir en fazla 3 kez yeniden dener; sonra moderatör paneli. Bu bekleme kabul mü?
