# G24-S1 — kcalAI Koç (Balance) + Tur 26k eşitleme (10–11 Kas)

Dal `night24/coach` (taban `release/1.1.0` @ b2c1205), worktree `.claude/worktrees/g24-s1`.
Deploy YOK, canlı DB yazma YOK, migration UYGULANMADI (yalnız dosya + rollback), YENİ PAKET YOK.
Koç native modül istemez → 1.1.0 yayınlandıktan sonra OTA; bayrak `koc` KAPALI.

## ÖZET
1. **Ön kontrol**: "AI izni metnine not ibaresi eklendi" (b2c1205) release/1.1.0'da VAR → tekrar yapılmadı.
2. **26k eşitleme**: paywall şeridi 1 camera "Günde N AI tarama" · 2 mic "Sesle ekle" · 3 barcode "Barkod sınırsız" · 4 infinity "Elle giriş sınırsız" (TR/EN); koçlu varyant (Balance şeridinde 5. sayfa bowl "kcalAI Koç" + Balance kartlarında "kcalAI Koç dahil"); diğer girişlerden açılan paywall koçsuz.
3. **Hareket**: süreler 110/220/330/550/990 ve push 330 kodla aynıydı; **Reduce Motion 200 → 220 ms** (yalnız opaklık) eşitlendi (açılış imzası dahil).
4. **AI izni sheet'i** FinScanAIConsent ile görsel eşitlendi (tutamak, kıvılcım dairesi, mürekkep renkli gövde, Gizlilik Politikası bağlantısı, açık temada beyaz yüzey). Metin kodda kaldı (G23, doğru).
5. **eatkcal**: İzmir dışı il seçilince "Devam et" yerine "eatkcal şu an yalnız İzmir’de." kartı + Restoran öner / Restoranını ekle (sipariş akışı başlamaz); bekleme başlığı "Şimdilik İzmir’deyiz". FinSubProfileSoon'dan "AI koç" satırı kalktı.
6. **Koç sunucu (yalnız dosya)**: `20261111100100_g24_coach.sql` + rollback — `coach_messages` (RLS: kendi satırı select / update(feedback) / delete; insert yalnız service role), sayaçlar, `reserve/release/consume_coach_message`, `my_coach_status`, `delete_coach_history`, ayarlar 30/3, bayrak `koc` kapalı, `user_consents` ai_coach/coach, olay adları. Edge `coach-chat` (deno check ✓): JWT, dakikada 6, güvenlik ön filtresi (model yok, hak yok), bağlam, Anthropic JSON kartlar, hata → iade + 502, son 20 mesaj.
7. **Koç istemci** `src/modules/coach/`: Intro (bir kez), Chat (9 hâl), History (liste/silme/boş); kartlar (Günüme ekle → öğün kuyruğu, Tarifi aç, Sepete ekle → mevcut sepet, haftalık Kalori/Protein); hap "Bugün N/30" / "Deneme N/3"; "Koç Balance’ta" → koçlu paywall; ayrı AI izni (metin tek yerde); ses (modül yoksa gizli); akan yanıt (SSE yok).
8. **Girişler**: Ana sayfa "Koçuna sor" kartı, Tara sonucu "Koça sor", Profil "AI Koç" satırı (Balance rozeti), tarif "Bu tarif bana uyar mı?" — hepsi soru önceden doldurulmuş; `koc` kapalı ya da coach-chat 404 → gizli (test).
9. **Kontroller**: tsc 0 · hygiene ✓ · unit 1048 (1047 ✓, 1 atlandı, 0 ✗) · jest 70 takım / 403 ✓ · deno check coach-chat ✓ (+ analyze-ai-scan ✓) · expo export iOS ✓ / Android ✓ (16 MB, HEAD fc0284b) · eksik çeviri anahtarı testi ✓ · HIG kod denetimi aşağıda (Kritik yok; 5 bulgu düzeltildi).
10. Tamamlanamayan iş yok; İlter kararı bekleyenler SORULAR'da (AI izni metni onayı, model adı, saklama süresi).

## Commit tablosu
| Commit | Madde | İçerik |
| --- | --- | --- |
| 8269ab3 | 1 | paywall şeridi + koçlu/koçsuz varyant, Reduce Motion 220, AI izni sheet'i, eatkcal yalnız İzmir kartı + "Şimdilik İzmir’deyiz", Profil Yakında'dan AI koç; testler |
| e582798 | 1 | `SubPaywall` rota tipi `coach` + `paywall_view.from` 'coach' |
| aedb0bc | 2 | migration + rollback + `coach-chat` (index/safety/prompt/cards) + olay sözlüğü + sunucu birim testleri |
| fc0982d | 3 | `src/modules/coach/` (ekranlar, kartlar, hap, izin, ses, girişler), navigatör kaydı (`koc`), Ayarlar › koç izni anahtarı, testler |
| fc0284b | 4 | HIG düzeltmeleri |
| (bu) | 4 | LOG |
| (son) | — | `docs/night/G24-S1-DONE` |

## KARAR
- **Şerit metni**: Tur 26k panosundaki açıklamalar birebir ("Paketli ürünleri barkodla tara, günlük sınır yok." / "Öğününü kendin yaz, dilediğin kadar ekle." / ses "Fotoğrafla aynı günlük N hakkı kullanır."). G23'teki "Barkodla ekle" ve "Barkod ve elle giriş sınırsız" kalktı.
- **Koçlu paywall**: yalnız `coach: true` parametresiyle (Koç Balance'ta sheet'i); plan parametresi ne olursa olsun Balance Yıllık seçili açılır. Koç günlük sayısı `app_settings.coach_daily_balance`'tan (abonelik limitleriyle aynı okuma), gelmezse 30.
- **Yaylar**: FinMoTokens 26k panosu yayları 260/24 · 200/28 · 220/14 yazıyor; kod G22'deki İlter kararıyla ×0,9 yumuşak (aynı sönüm oranı). Görev yalnız süre/push/Reduce Motion'ı istediği için yaylar DEĞİŞMEDİ.
- **Reduce Motion 220**: `REDUCED.duration` + açılış imzası `reducedFade/skipFade` 220; FinMoMap tablo metinleri ve testler güncellendi.
- **AI izni sheet'i**: başlık/düğme metinleri kodda kaldı ("Fotoğraf ve ses analizi", "Kabul et" / "Vazgeç"); panodaki "Yapay zekâ ile tahmin" / "Kabul et ve devam et" / "Elle gir" metin farkıdır, görev "metin kodda doğru" dedi. Vazgeç zaten elle girişe gidiyor. Gizlilik bağlantısı izin kaydı yazmadan sheet'i kapatır (sonraki taramada yeniden sorulur). Geri alma ipucu satırı korundu (KVKK: izni geri alma bilgisi).
- **FinSubProfileSoon**: panoda egzersiz satırında sohbet ikonu görünüyor (satır silinirken ikon kaymış); anlamlı ikonlar (halter / çanta) korundu.
- **eatkcal kartı**: TR'de iki eylem yan yana, EN'de alt alta (pano `elseCols`). Form sheet'leri mevcut WaitlistFormSheet.
- **Koç kotası**: Balance → günlük (00.00 İstanbul, AI tarama ile aynı); Free/Fresh → ömür boyu 3 deneme. Hap N = KALAN hak (pano "Bugün 0/30" limitte). `release_coach_message` yalnız service role (istemci başarılı mesajdan sonra iade isteyip hakkı sonsuzlaştıramasın); iade rezervasyon kaydı üstünden (`coach_reservations`).
- **Güvenlik**: ön filtre eşleşirse model ÇAĞRILMAZ ve hak DÜŞMEZ (sabit güvenli yanıt + "Bir uzmana danış" kartı + 112 satırı). Yeme bozukluğu sınıfı tıbbiden önceliklidir; yanıtta rakam yok. Model yanıtı taban altı GÜNLÜK kalori içerirse güvenli yanıtla değiştirilir. Taban: `user_nutrition_profiles.gender` 'female' → 1200, diğer/boş → 1500.
- **Bağlam**: hedefler `use_custom_macros` ise custom_*, değilse target_*; gün sınırı İstanbul (UTC+3); İzmir = kullanıcının herhangi bir adres şehri "izmir" içeriyorsa; ürünler `is_available` ilk 20; tarifler yalnız herkese açık yazarların `meal_card`'lı gönderileri (12). Kartlar sunucuda beyaz listeyle süzülür ve zenginleştirilir (istemci ek sorgu yapmaz).
- **Saklama**: sohbetler 30 gün (`coach_retention_days`); daha eskisi kullanıcının sonraki mesajında silinir (pg_cron gerekmez). Silme sayaçları geri vermez.
- **Günüme ekle**: `meal_consumptions` CHECK'inde koç kaynağı yok → kaynak `manual`, `source_ref = coach:<mesaj>:<sıra>` (aynı öneri iki kez eklenmez); çevrimdışı kuyruk (`submitLogOp`). Yeni CHECK migration'ı açılmadı (canlı tablo riskini almamak için).
- **Sepete ekle**: ürün id ile okunur; gramaj/zorunlu opsiyon varsa ürün ekranına gider (BrandLanding ile aynı kural).
- **Koç AI izni**: cihaz kaydı (`@kcal_ai_coach_consent`, sürüm 1) + `user_consents` (kind ai_coach, source coach|settings) DOĞRUDAN, en iyi çaba — ortak rıza kuyruğuna konmadı (migration uygulanmadan CHECK reddederse diğer rıza satırlarını tıkardı). Ayarlar › Veri ve reklam izinleri'nde "kcalAI Koç" anahtarı (koç açıkken). Sunucu izni denetlemiyor (yeni cihazda bir kez yeniden sorulur — güvenli taraf).
- **Fonksiyon var mı**: bayrak açıkken oturumda bir kez GET yoklaması (fonksiyon 405, ağ geçidi 404). 404 → girişler gizli; ağ yok → gösterilir (gönderimde hata hâli). Gönderimde 404 → girişler gizlenir ve ekran geri döner.
- **Ses**: Tara'daki `speech.ts`; basılı tutma yerine dokun-dinle + İptal / Gönder (VoiceOver'da da kullanılabilir; HIG). İpucu metni buna göre ("Bitince Gönder’e dokun.").
- **Akan yanıt**: kelime parçası ≤ 45 ms, toplam ≤ ~2,2 sn; azaltılmışta parçalar üçer üçer, imleç sabit. "Yanıtı durdur" akışı keser (tam metin görünür). Yanıt beklenirken durdurmak sunucu isteğini iptal edemez — yanıt gelince akışsız eklenir.
- **Yazıyor noktaları**: tasarım 990 döngü; token aritmetiği yasak olduğundan iki yarım `slow` (550+550).
- **Koç + abonelik**: upsell → paywall `abonelik` + RevenueCat ister; `koc` bayrağı `abonelik` ile birlikte açılmalı (SORULAR 4).
- **Geçmiş "devam et"**: tek akış olduğu için dokunulan mesaja kaydırarak sohbet açılır.

## CANLIYA UYGULANACAK
1. Migration: `supabase/migrations/20261111100100_g24_coach.sql` (önkoşul: `20261110100100_g22_s1_subscriptions`, `20261109210100_g20_s1_user_consents` canlıda). Doğrulama: `select public.my_coach_status();` (oturumlu) · `select key, value from app_settings where key like 'coach_%';` · `select * from feature_flags where key = 'koc';`. Geri alma: `supabase/rollbacks/20261111100100_g24_coach_rollback.sql`.
2. Edge: `supabase functions deploy coach-chat` (JWT doğrulaması AÇIK — `--no-verify-jwt` KULLANMA).
3. Secret: `ANTHROPIC_API_KEY` (analyze-ai-scan ile ortak, zaten olmalı); isteğe bağlı `supabase secrets set COACH_MODEL=<model>` (varsayılan analyze-ai-scan'deki gibi `claude-haiku-5-5`), isteğe bağlı `COACH_TIMEOUT_MS` (vars. 25000).
4. Sıra: migration → deploy → (İlter) AI izni metni onayı → bayrak `koc` (önce iç kullanıcı, `abonelik` açıkken).
5. CLAUDE.md kuralı: backend commit'i (aedb0bc) main'e cherry-pick — gece kuralı main'e commit'i yasakladığı için yapılmadı, İlter onayıyla.

## DEPLOY GEREKİR
- `coach-chat` edge fonksiyonu (yeni). Mobil: OTA yeterli (yeni native modül yok); ancak OTA yalnız 1.1.0 derlemesine gider (`runtimeVersion appVersion`).

## HIG (apple-design-skill, kod denetimi kipi)
Kapsam: `src/modules/coach/screens/*`, `src/modules/coach/ui/*`, PaywallScreen (koçlu varyant). Sonuç: **İyi** (Kritik yok).

| Önem | Bulgu | Dayanak | Durum |
| --- | --- | --- | --- |
| Geçti | Bütün dokunma hedefleri ≥ 44 pt (çip 44, geri bildirim 44×44, mikrofon/gönder 44, kart düğmeleri 48, sekme 44, satırlar 52–64, uyarı düğmeleri 48) | `accessibility.md` (iOS 44x44 pt) | — |
| Geçti | Kontrast: ikincil #6B6B70 / #FFFFFF 5,3:1, / #F3F4F6 4,8:1; koyu #A1A1A6 / #1C1C1E 6,9:1; lime üstü #0A0A0A ~15:1; kırmızı #D70015 / beyaz 5,6:1 | `accessibility.md` (17 pt'ye kadar 4.5:1) | — |
| Geçti | VoiceOver: balonlar "Sen:" / "Koç:", kartlar tek öğe + eylem, hap etiketi, yazıyor canlı bölge, hata `alert`, silme uyarısı modal, dekoratif cam nesne gizli | `accessibility.md`, `voiceover.md` | — |
| Geçti | AI şeffaflığı: koç adı + her sohbette "Koç tıbbi tavsiye vermez." + ayrı AI izni; 👍/👎 isteğe bağlı geri bildirim; hata sonrası "Tekrar dene" | `generative-ai.md › Transparency` ("Communicate where your app uses AI"), `› Privacy`, `› Continuous improvement` ("simple thumbs-up and thumbs-down") | — |
| Geçti | Reduce Motion: balon/kart/sheet/uyarı/tanıtım → 220 ms opaklık, noktalar ve dalga sabit, kaydırma animasyonsuz; bulanıklık yok (Reduce Transparency etkilenmez) | `motion.md › Make motion optional`, `accessibility.md` (Reduce Motion) | — |
| Orta | Sohbet başlığı `numberOfLines` ile büyük metinde kırpılıyordu | `accessibility.md` ("Support larger text sizes") | Düzeltildi (fc0284b) |
| Orta | Yeni Koç yanıtı ekran okuyucuya duyurulmuyordu | `voiceover.md` (yargı: odak değişmeden bildirim) | Düzeltildi — `announceForAccessibility` |
| Düşük | Hazır soru çipi basma ölçeği azaltılmış harekette de çalışıyordu | `accessibility.md` ("reducing … zooming, scaling") | Düzeltildi |
| Düşük | Upsell sheet'inde Sheet başlığı + içerik başlığı çift görünüyordu | yargı (Craft) | Düzeltildi |
| Düşük | Hap büyük metinde yatay taşabiliyordu | `accessibility.md` | Düzeltildi (sarar) |
| Düşük | Haftalık grafikte "hedef içi/üstü" renkle ayrılıyor; lime çubuk beyaz zeminde düşük grafik kontrastı | `accessibility.md` (renk tek taşıyıcı olmamalı) | Açık — hedef çizgisi konumsal ipucu veriyor, VoiceOver değerleri okuyor; lime yalnız dolgu kuralı tasarım sisteminden (Final) |

## SORULAR
1. **Koç AI izni metni (İlter onayı)**: TR "Koça yazdıkların ve günlük takip özetin, yanıt üretmek için yapay zekâ hizmet sağlayıcımıza (ABD) gönderilir." / EN "What you write to the coach and a summary of your daily tracking are sent to our AI service provider (USA) to generate replies." — tek yer `src/lib/consent/i18n.ts › sheet.ai_coach_lead`. Değişirse `COACH_CONSENT_VERSION` artırılmalı (bir kez yeniden sorulur).
2. **Model**: `COACH_MODEL` varsayılanı analyze-ai-scan ile aynı (`claude-haiku-5-5`). Koç için daha güçlü bir model istenirse secret ile verilir (kod değişmez).
3. **Saklama süresi**: 30 gün seçildi (pano "[N] gün"). Farklı süre → `app_settings.coach_retention_days` + istemci metnindeki `COACH_RETENTION_DAYS`.
4. **`koc` ↔ `abonelik`**: Koç Balance'a bağlı; `abonelik` kapalıyken `koc` açılırsa deneme bitince paywall fiyat getiremez (FinSubError). İkisi birlikte açılmalı mı, yoksa `koc` bayrağı abonelik kapalıyken girişleri de gizlesin mi?
5. **meal_consumptions kaynağı**: koçtan eklenen öğün `manual` olarak kaydediliyor (source_ref `coach:…`). Ayrı bir `ai_coach` kaynağı istenirse CHECK migration'ı gerekir.
6. **Duman testi**: simülatörde uçtan uca deneme yapılmadı (canlı fonksiyon/migration yok; boş disk 20 GB sınırında, worktree'de `ios/` yok). Bileşen testleri hâlleri kapsıyor.
