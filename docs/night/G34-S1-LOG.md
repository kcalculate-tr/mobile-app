# G34-S1 — Tur 26o kişisel plan akışı (12 Kas) — LOG

## ÖZET
1. G33-S1-DONE beklendi (02:12); worktree `g34-s1`, dal `night34/kisisel-plan` (taban `release/1.1.0` @ 87cab1a). Yalnız JS/TS → OTA; yeni paket yok; canlı DB / deploy / OTA yok.
2. Yeni modül `src/modules/personalPlan/`: akış (Giriş + açık rıza TASLAK, Bildiklerimiz, 1–8, Düşük VKİ, Kalori tabanı, Hesaplanıyor, Hata, Planın + Düzenle, Nasıl hesapladık?, Önizleme, Bağlamsal paywall, Hatırlatmalar, Kaldığın yerden, Çıkış, 18 yaş altı). Hepsi `kisisel_plan` bayrağı arkasında (KAPALI, min 1.1.0).
3. Hesap saf modülde (`calc.ts`), tasarım örneği birebir: BMR 1449 · TDEE 1992 · açık 550 · 1440 kcal · P130/K133/Y43 · 14 hafta → 18 Şubat 2027; Düzenle 1200 kcal → 0,72 kg/hafta, 10 hafta → 21 Ocak 2027.
4. Kişisel planım + Tek ekranda düzenle (eski/yeni yan yana; Kaydet / Eski planımı koru) + Koç'la planımı düzenle (Balance; değilse Balance paywall).
5. Haftalık check-in: tartı sayfası + grafik + öneri kartları. Kalori OTOMATİK DÜŞMEZ ("Uygula" / "Eski planımı koru"); yalnız hedef tarihi kendiliğinden güncellenir. Haftalık tartı + öğün hatırlatmaları (yerel bildirim; izin yalnız Hatırlatmalar'da bağlam içinde).
6. 4 giriş noktası (Profil Hedefim kartı, Ana sayfa tek seferlik kart, Koç ilk açılış çipi, satın alma teşekkür satırı); G33 "Planı benim için oluştur" kişisel plandan okur, plan yoksa akışa yönlendirir.
7. Migration DOSYASI `20261112110100_g34_personal_plan.sql` + rollback (canlıya UYGULANMADI).
8. Testler: birim 44 (calc/flow/format/access/hatırlatma/izin), bileşen 17 + G33 plan formu 3. Kontroller: hygiene + tsc ✅ · unit 1228/1228 ✅ · jest 96 suite / 557 test ✅ · expo export iOS ✅ (3299 modül) · Android ✅ (3306 modül) — dalda ve `release/1.1.0` üzerinde yeniden koşuldu.
9. HIG kod denetimi (apple-design-skill): 11 pt alt sınır, buton rolleri, Dynamic Type kırpması düzeltildi; kontrast AA (aşağıda).
10. Birleştirme: `release/1.1.0`'a `git merge --no-ff night34/kisisel-plan` (çakışma yok, force/reset yok). Push: `night34/kisisel-plan`, `release/1.1.0`.

## Commit tablosu
| Commit | Madde | İçerik |
| --- | --- | --- |
| d3f8735 | md.1 + md.6 | migration + rollback, `kisisel_plan` bayrağı, `pp_*` olay sözlüğü, saf hesap/güvenlik, akış durum makinesi, erişim tablosu, kayıt/okuma, hatırlatma planı, izin kaynağı `personal_plan`, birim testleri |
| a8632d4 | md.2 + md.3 + md.4 | akış ekranları, bağlamsal paywall, Hatırlatmalar, Kişisel planım, Tek ekranda düzenle, check-in, hareket (06), TR + EN, rotalar + gezinme/rota denetimi |
| fc5e113 | md.5 | 4 giriş noktası + G33 plan formu kişisel plandan okur (+ 3 test) |
| 775db91 | md.6 + md.7 | bileşen testleri (17, Light/Dark/TR/EN) + HIG düzeltmeleri |
| e455f47 | md.8 | `merge --no-ff night34/kisisel-plan` → `release/1.1.0` |
| (bu) | bitiş | LOG |
| (son) | bitiş | `docs/night/G34-S1-DONE` |

## Migration sırası (CANLIYA UYGULANACAK — İlter onayıyla, `supabase db push`)
1. (G33) `20261112100100_g33_meal_plan.sql` → `20261112100200_g33_recipe_seed.sql`
2. `20261112110100_g34_personal_plan.sql`:
   - `user_nutrition_profiles` + `birth_year, gender_choice, target_weight_kg, pace_kg_week, body_fat_pct, arm_cm, plan_target_date, plan_started_at, plan_version, plan_updated_at, personal_plan jsonb` (+ CHECK'ler). Mevcut own-row RLS geçerli.
   - `body_measurements` + `arm_cm, body_fat_pct` (haftalık tartı mevcut tabloya; `(user_id, date)` tekilliği canlıda var).
   - Yeni `personal_plan_progress` (kullanıcı başına tek satır, RLS select/insert/update/delete own-row).
   - `feature_flags` `kisisel_plan` (enabled=false, rollout 0, min 1.1.0) + `analytics_event_names` `pp_*` (8 olay).
   - Geri alma: `supabase/rollbacks/20261112110100_g34_personal_plan_rollback.sql`.
   İstemci migration'dan ÖNCE de güvenli: yeni kolon reddedilirse yalnız mevcut kolonlarla yazar (hedef/makro yine kaydolur), plan cihazda saklanır, uygulanınca bir sonraki kayıtta sunucuya gider; `personal_plan_progress` yoksa ilerleme yalnız yerel.

## DEPLOY GEREKİR
- Edge function değişikliği YOK. OTA (preview/production) yalnız İlter onayıyla. Açmak için: migration → `kisisel_plan` bayrağı.

## KARAR
1. Veri: `user_nutrition_profiles` kullanıcı başına tek satır ve hedef/makro zaten orada → YENİ TABLO YOK, kolon + `personal_plan` jsonb. Mevcut okuyucular (get_nutrition_summary, Ana sayfa halkası, Takibe başla) plan hedefini değişmeden görür. "Düzenle" sonucu `target_*`'a yazılır (`use_custom_macros=false`), öneri `personal_plan.result`'ta.
2. "Belirtmek istemiyorum": hesapta kadın sabiti (−161; Takibe başla ile aynı, korumacı), taban 1500 (İlter kararı).
3. Egzersiz cevapları TDEE'ye EKLENMEDİ: İlter'in 4 aktivite katsayısı tek çarpan; çift sayımı önlemek ve "Nasıl hesapladık?" formülüyle tutarlılık için. Egzersiz günleri planda saklanır (SORULAR 3).
4. Kas kazan fazlası da tempo × 7700 / 7 (0,25 → +275, 0,5 → +550); tempo yalnız 0,25 / 0,5 (SORULAR 5).
5. Hedef kilo alt sınırı VKİ 18,5 (güvenlik); varsayılan öneri kilo ver −%10, kas kazan +3 kg.
6. Öğün düzeni: ana 2–3, ara 0–2 (G33 planı 4 yuva; ikinci ara öğün yalnız saat/hatırlatma için).
7. Hesaplanıyor gerçek zincir: hesap cihazda, satırlar 5 × 550 ms (~2,75 sn), bağlantı yoksa Hata (cevaplar korunur). Kayıt "Planı başlat"ta; başarısızsa hata toast'ı + Tekrar dene.
8. Check-in önerisi: tek tartıyla plan değişmez ("Kilo günden güne oynar"); ≥ 3 tartı / ≥ 2 hafta trendinde ortalama < tempo × 0,8 → kademeli −100 kcal (tabanın altına inmez); ortalama > vücut ağırlığının %1'i → kaloriyi artırıp tempoyu plana döndür (tasarım 1440 → 1770 birebir). Gerçek harcama = plan kalorisi + kilo değişiminin enerji karşılığı. Tasarımdaki 1440 → 1350 örneği bu kuralla 1340 (SORULAR 4).
9. İlk sorudan (ya da Bildiklerimiz'den) Geri → Çıkış sayfası (01 "Çıkış" panosu); Giriş'e dönülmez. Akış alttan modal; adım geri akış İÇİ (rota değişmez) → gezinme denetiminde "yerinde" sınıfı; Giriş / Kaldığın yerden'de kapat X (tasarım).
10. Balance önizleme: G33 algoritmasının 3 adayı + `meal-plan-generate` sıralar (1 koç mesajı). Koç ulaşılamazsa etiket "Şablonla hazırlandı" — Koç'a ait olmayan plan "kcalAI Koç hazırladı" diye gösterilmez.
11. Sağlık rızası: G27 altyapısı, kaynak `takibe` (CHECK listesinde; ayrı kaynak migration'ı gerekmesin diye). Alerji rızası: G33 `recordAllergenConsent` (kaynak `meal_plan`) — Takibe sağlık rızası alerjeni kapsamaz.
12. "Koçla planımı düzenle": plan sayıları sohbete YALNIZ Koç AI izni varsa ön doldurulur; yoksa genel istek metni (izin Koç'ta sorulur). coach-chat fonksiyonuna dokunulmadı.
13. Tasarımdan küçük sapmalar (yeni paket / varlık yok): Ölçüler'deki vücut silüeti çizilmedi (satırlar + düzenleyici); adım sayısı kaydırıcısı yerine ±500 stepper; hedef eğrisi path-morph yerine 330 ms opaklık geçişi; kilitli günler `expo-blur` (mevcut paket), Saydamlığı Azalt'ta düz örtü.
14. Paywall fiyatları yalnız RevenueCat (`usePlanCards`); yoksa hata kartı + Tekrar dene (G27/G31 kuralı: yedek fiyat yok).
15. Profil: bayrak açık + plan yok → kart "Kişisel planımı oluştur" satırı; plan varsa G33 halka + özet kalır, düğme "Kişisel planım". Bayrak kapalıyken G33 kartı AYNEN.
16. Haftalık tartı bildiriminin `data.url` (`kcal://plan/checkin`) derin bağlantıya henüz bağlanmadı; dokununca uygulama açılır (SORULAR 8).

## HIG (apple-design-skill kod denetimi)
- Düzeltildi: 11 pt altı metinler (paywall rozeti 10→11, önizleme gün çipi 9/10→11, not simgesi 10→11 + VoiceOver'dan gizli) — `typography.md` (iOS min 11 pt); stepper ve öğün saati −/+ düğmelerine `button` rolü; üst çubuk başlığında `numberOfLines` kaldırıldı (büyük Dynamic Type'ta kırpılmaz).
- Dokunma alanları: bütün eylemler ≥ 44 × 44 pt (görsel 28 pt kapat noktası 44 pt alanın içinde).
- Kontrast (hesaplandı): ikincil #6B6B70 / beyaz 5,30:1 · / #F3F4F6 4,82:1 · siyah / lime 15,06:1 · lime üstü ikincil 7,23:1 · uyarı #7A5600 / #FFF6DB 6,16:1 · Dark ikincil #A1A1A6 / #1C1C1E 6,61:1, / #2C2C2E 5,42:1 · eğri #5E7A12 / beyaz 4,92:1. Pasif düğme metni 3,93:1 (pasif denetim, AA dışı).
- Azaltılmış hareket: bütün akış hareketleri 220 ms opaklığa iner (kaydırma/ölçek/çizim yok), haptikler aynı; Saydamlığı Azalt: kilitli günlerde düz örtü + kilit rozeti.

## SORULAR
1. Rıza metinleri (sağlık verisi, alerji) TASLAK işaretli — L-S5 hukuk metni gelince değişecek.
2. Kişisel plan sağlık rızası için `user_consents.source`'a ayrı `personal_plan` eklensin mi (şimdi `takibe`)?
3. Egzersiz (gün × süre) günlük harcamaya eklensin mi? Şimdi yalnız aktivite katsayısı.
4. Check-in "yavaş" önerisi: öneri başına en fazla −100 kcal kuralı uygun mu (tasarım örneği 1350, kural 1340 veriyor)?
5. Kas kazan fazlası 0,5 kg/hafta için +550 kcal; üst sınır (ör. +300) istenir mi?
6. Balance kullanıcıda akış sonundaki önizleme 1 koç mesajı harcıyor — uygun mu, yoksa önizleme şablonla mı kalsın?
7. coach-chat sistem istemi `personal_plan`'ı (hedef tarihi, tempo) okusun mu? (edge deploy gerekir; bu oturumda yapılmadı.)
8. Haftalık tartı / öğün hatırlatması dokunuşu doğrudan Haftalık tartı / Kişisel planım'ı açsın mı? (`linking.ts`'e rota eklenmeli.)
