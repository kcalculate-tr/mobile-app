# L-S1 — Global hukuk paketi + kurumsal kimlik — LOG

**Tarih:** 2026-11-09 (gece 19) · **Dal:** `legal/global` (taban `night19/release` `da8edf4`) · **Worktree:** `.claude/worktrees/l-s1`
**Kapsam:** yalnız `docs/legal/` taslakları + bu LOG. Uygulama/web metni, kod, migration, canlı DB **değiştirilmedi**.

## ÖZET (10 satır)
1. 5 maddenin hepsi tamamlandı ve `docs/legal/` altında ayrı commit'lerle kaydedildi (md.1 → md.5).
2. Veri envanteri koddan çıkarıldı: 10 kategori × amaç × KVKK/GDPR dayanağı × saklama × alıcı × yurt dışı × `dosya:satır` kanıtı (mobil + Supabase + web).
3. Kanıt örneklemi elle doğrulandı (delete-account, ATT, bildirim varsayılanı, user-media kovası, rıza kapısı, 18+ anahtarı).
4. 10 metin TR + EN taslak yazıldı (20 dosya), artı mesafeli satış karşılaştırması. Kimlik: "SEKULART Ltd." + `[TAM UNVAN]` vb. yer tutucular.
5. En kritik bulgu: mevcut metinler "yurt dışına aktarım yok" diyor; kod Supabase, Anthropic, Sentry, Meta, Expo, Google, Resend ve Vercel'e aktarım gösteriyor (B-01).
6. Hiçbir kabul veya rıza sunucuda kaydedilmiyor: koşullar, mesafeli satış, sağlık açık rızası, 18+, topluluk kuralları (B-02, B-03).
7. Meta: Android'de rızasız olay gönderimi; iOS'ta ATT reddinde otomatik olay kaydı açık; rıza arayüzü yok (B-06). Pazarlama push'u varsayılan açık (B-11).
8. Mağaza formları güncel değil: Sentry kullanıcıya bağlı; kullanıcı içeriği, ses ve destek verisi beyan edilmemiş. Güncel cevap tabloları `BOSLUKLAR.md` B-07'de.
9. `support-attachments` kovası herkese açık (B-08). Hesap silme Storage dosyalarını ve Adisyo kayıtlarını silmiyor (B-09).
10. Entegrasyon planı 12 migration, 8 edge function, 16 mobil, 7 web ve 4 konsol işini listeliyor; hiçbiri yapılmadı.

## Commit tablosu

| Commit | Madde | Dosyalar |
|---|---|---|
| `6e316db` | md.1 Veri envanteri | `docs/legal/VERI_ENVANTERI.md` |
| `de76005` | md.2 TR+EN taslaklar | `docs/legal/{tr,en}/01…10-*.md`, `docs/legal/MESAFELI_KARSILASTIRMA.md`, `docs/legal/README.md` |
| `dc982f7` | md.3 Boşluklar raporu | `docs/legal/BOSLUKLAR.md` |
| `727d374` | md.4 Kurumsal kimlik | `docs/legal/KURUMSAL_KIMLIK.md` |
| `83252ff` | md.5 Entegrasyon planı | `docs/legal/ENTEGRASYON.md` |
| (son) | LOG + DONE | `docs/night/L-S1-LOG.md`, `docs/night/L-S1-DONE` |

## KARAR (soru sorulamadığı için en güvenli seçenekle verilenler)
- **Sağlık verisi:** boy, kilo, ölçü, öğün ve AI fotoğrafı **özel nitelikli** kabul edildi (KVKK md.6/3-a, 7499 sonrası numaralandırma; GDPR Art.9(2)(a)). Taslaklar açık rıza varsayımıyla yazıldı.
- **Yurt dışı aktarım:** düzenli aktarımın dayanağı standart sözleşme + 5 iş günü bildirim olarak yazıldı. Yurt dışı açık rıza metni yalnız arızi aktarım (md.9/6-a) için hazırlandı; birincil dayanak olarak önerilmedi.
- **VERBİS:** ihtiyaten kayıt önerildi. Gerekçe: Kcalculate AI'nin ana faaliyeti sağlık sayılabilecek veri.
- **Supabase bölgesi:** görev tanımındaki "AB" kabul edildi. Koddan doğrulanamadı; teyit gerekiyor diye işaretlendi.
- **AI fonksiyonları** (`analyze-ai-scan`, `moderate-content`) "yalnız dosya", yani deploy edilmemiş. Envanter ve metinler canlıya alındıkları hâli de kapsıyor. Canlıya almadan önceki kontrol listesi `ENTEGRASYON.md` §7'de.
- **Topluluk kuralları:** uygulama içi FinRules metni (`src/core/i18n/dictionaries.ts:613-639`) temel alındı. kcalculate.ai creator kuralları "ek kurallar" bölümüne kondu.
- **Mesafeli satış:** iki ayrı belge yapıldı (Ön Bilgilendirme + Sözleşme) ve iki ayrı onay kutusu öngörüldü. Cayma istisnası Mesafeli Sözleşmeler Yönetmeliği md.15/1-(c)'ye bağlandı.
- **Başvuru tablosu adı:** `privacy_requests` (08 taslağıyla tutarlı).
- **Kanıt kaynağı:** çekirdek tabloların `CREATE TABLE`'ı repoda olmadığından canlı şema anlık görüntüsü kullanıldı (`.claude/night/CANLI_SEMA_2026-11-09.md`). Supabase MCP kullanılmadı.
- **Çalışma yöntemi:** veri toplama üç salt-okuma ajanıyla, taslak yazımı dört paralel kopya ajanla yapıldı. Çapraz atıflar (dosya adları, B-numaraları, tablo adları) sonradan elle eşitlendi.

## CANLIYA UYGULANACAK
- **Yok** (bu oturum canlıya hiçbir şey uygulamadı).
- İleride gereken migration'lar `ENTEGRASYON.md` §6.1'de (M1–M12). Avukat onayından sonra ayrı oturumda dosya olarak yazılmalı.

## DEPLOY GEREKİR
- **Yok.**
- İleride: edge function değişiklikleri (F1–F8), native mobil sürüm (K6: `app.config.js` Meta bayrağı ve privacy manifest), web (W1–W7) ve mağaza konsolu (S1–S4). Sıra `ENTEGRASYON.md` §7'de.

## SORULAR (avukat / işletme kararı)

### Hukuki değerlendirme
1. Beslenme/kilo verisi özel nitelikli mi? Taslaklar "evet" varsayımıyla yazıldı (B-03).
2. Sağlık rızası kalori takibinin ön şartı olabilir mi (hizmet şartına bağlama)? Taslak: takip için evet, sipariş için hayır.
3. VERBİS kaydı yapılsın mı? (B-04)
4. Push bildirimleri ticari elektronik ileti sayılsın mı (ETK onayı)? (B-11)
5. Doğrudan Türkiye'deki şirkete gelen AB kullanıcı verisi için GDPR Bölüm V uygulanır mı (EDPB 05/2021)?
6. Arızi aktarım rızası hiç kullanılmalı mı? Taslağı hazırlayan ajanın önerisi: kullanılmasın.
7. Ayıp bildiriminde "2 saat / yalnız uygulama / fotoğraf zorunlu" şartları kaldırılsın mı? Taslakta kaldırıldı, yerine çok kanallı "en kısa sürede" bildirim kondu.
8. Yetki: tüketicinin yerleşim yeri (TKHK md.73) ve AB tüketici istisnası eklendi; uygun mu?
9. KVKK'da GDPR md.33(1)'deki "risk yoksa bildirim gerekmez" istisnası yok. İhlal planındaki düşük seviyeli olaylarda Kurul'a bildirmeme kararı savunulabilir mi?

### Teyit edilecek mevzuat (madde/harf/eşik)
- Mesafeli Sözleşmeler Yönetmeliği md.15/1 harf sırası (2022 değişikliği sonrası konsolide metin), md.16 (14 gün iade), md.18 (3 yıl kayıt).
- Başvuru Tebliği md.5 kanalları ve md.7 ücret tutarı.
- VERBİS muafiyet eşikleri.
- 5651 trafik kaydı süresi.
- Tüketici Hakem Heyeti parasal sınırı.
- AB ODR platformunun 20.07.2025'te kapandığı.
- KVK Kurumu güncel adresi.
- Kurul'un 2018/10 sayılı "yeterli önlemler" kararı.

### İşletme kararları
- Hazırlık öncesi sipariş iptal penceresi tanınacak mı?
- Macro paketinde kısmi iade kuralı ne olacak? "Kullanılmasa da iade yok" kuralı TKHK md.5 haksız şart riski taşıyor.
- Teslimat saatleri tek değere indirilmeli: sözleşmeler "her gün 09:00–21:00", web "Pzt–Cmt 09:00–21:30".
- Bayraklı şubesi ve ertesi gün teslimat bölgeleri sözleşmeye girecek mi?
- "Öncesi/sonrası beden fotoğrafı yasak" kuralı uygulamanın geneline mi uygulanacak? Şu an yalnız creator kurallarında.
- ABD kullanıcıları için tahkim ve sınıf davası feragati istenecek mi?
- AB/UK/ABD'de yayın zamanı ne? Temsilci atanana kadar mağazada bölge kısıtı konacak mı? (B-12, B-17)
- Kendine zarar destek hatları için doğrulanmış numaralar gerekiyor; kodda kaynak listesi yok.

### Doldurulacak bilgiler
- Tam unvan, MERSİS, VKN, vergi dairesi, ticaret sicil no, KEP.
- privacy@/legal@/support@ adresleri açılmalı; şimdilik yalnız info@eatkcal.com var.
- AB/UK temsilcisi ve DSA yasal temsilcisi.
- Müdahale ekibi isim ve iletişim bilgileri.
- Siber sigorta.
- Marka tescil numaraları.

### Sağlayıcılardan teyit
- Supabase bölgesi, yedek döngüsü ve kalıcı depoda şifreleme.
- Anthropic saklama süresi ve DPA.
- Sentry bölgesi ve saklama süresi.
- Hangi sağlayıcıların EU-US DPF sertifikası var?
- Meta veri silme yolu: Data Deletion Callback mi, Events Manager mı?

### Tamamlanamayan kısım
- **Yok.** 5 maddenin hepsi taslak olarak tamamlandı.
- **Sınır:** metinler avukat onayı almadan ve kod boşlukları (B-02, B-06, B-10, B-11, B-15, B-18) kapanmadan yayımlanamaz. Taslaklardaki bazı cümleler hedef davranışı anlatıyor (`docs/legal/README.md` "Yayından önce mutlaka").
