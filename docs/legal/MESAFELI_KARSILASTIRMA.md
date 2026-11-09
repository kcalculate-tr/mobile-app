# Mesafeli Satış / Ön Bilgilendirme — Mevcut Metinler ile Taslak Karşılaştırması

> **TASLAK — hukuki inceleme için (İlter Öziseven). Yayımlanmadı.** Sürüm `v0.1-taslak` · 2026-11-09
> Taslak: `tr/06-mesafeli-satis-ve-on-bilgilendirme.md` (EN: `en/06-distance-sales-and-pre-contract-information.md`).
> Mevcut web: `web:apps/eatkcal/content/legal/mesafeli.ts` (eatkcal.com/mesafeli-satis-sozlemesi; canlı Framer metninden "AYNEN" kopya) ve satışla ilgili maddeler için `web:apps/eatkcal/content/legal/kullanim.ts`.
> Mevcut mobil: `src/data/contractsData.ts:16` (`distance-sales`, tek satır JSON; maddeler "M" numarasıyla) ve satış maddeleri için `src/data/contractsData.ts:11` (`terms`).
> Öncelik: **P0** = yayın öncesi zorunlu / hükümsüzlük veya idari yaptırım riski · **P1** = yüksek · **P2** = düzeltme.

| # | Konu | Mevcut web | Mevcut mobil | Taslak | Risk / öncelik |
|---|---|---|---|---|---|
| 1 | Satıcı kimliği | Uzun ticaret unvanı, adres, VKN 7591148741, MERSİS 0759-1148-7410-0001, info@ (`mesafeli.ts:22-…`). Telefon ve KEP yok | Aynı blok (M1). Telefon, KEP yok | SEKULART LTD, MERSİS, VKN, adres dolduruldu (L-S2); **telefon, e-posta** yer tutucusu; KEP eklenmedi (A.1, B-1.1) | **P1** — Yönetmelik md.5/1 satıcının telefon ve e-posta dahil iletişim bilgilerini ister; ETK künye zorunluluğu KEP'i de kapsar |
| 2 | Ön Bilgilendirme Formu | Ayrı form **yok**; "sözleşme ön bilgilendirme formu niteliği de taşır" notu (`mesafeli.ts:9-19`) | **Hiç yok** ("Ön Bilgilendirme" geçmiyor) | Ayrı Bölüm A; dinamik alanlar; **ayrı teyit kutusu** | **P0** — Yönetmelik md.5–6: sözleşmeden önce ayrı bilgilendirme + tüketici teyidi; ispat satıcıda. İhlal → TKHK md.77 idari para cezası ve sözleşmenin tüketici lehine yorumlanması |
| 3 | Ödeme kuruluşu | **Tosla (Akbank)** (`mesafeli.ts:82,84`; `kullanim.ts:106`) | **PaynKolay** (M5.1, Mersis 0627-0428-1384-5156) | PaynKolay; kart verisi satıcıya girmez; jetonlama | **P0** — web metni gerçek akışla çelişiyor (kod: `src/config/payment.ts:8,19-25`). Açılış sayfası ayrıca **PayTR** diyor (`landing-page/privacy.html:74`) |
| 4 | Teslimat saatleri | "Her gün 09:00–21:00" (`mesafeli.ts:89`) | Aynı (M6.2) | `[TESLİMAT SAATLERİ]` + uygulamadaki güncel ekrana atıf | **P1** — web sitesi "Pzt–Cmt 09:00–21:30, Pazar kapalı" (`web:apps/eatkcal/lib/site.ts:16-17`); yanıltıcı ön bilgi |
| 5 | Teslimat bölgeleri / şubeler | "İzmir ili sınırları"; tek adres (Karabağlar) | Aynı | Hizmet bölgeleri uygulamada; {{SUBE}} alanı | **P1** — ertesi gün bölgeleri (`web:apps/eatkcal/lib/delivery.ts:5-10`) ve Bayraklı şubesi (`web:apps/eatkcal/lib/site.ts:52`) metinde yok |
| 6 | Teslimat türleri tablosu | Var: Hemen / Randevulu (`mesafeli.ts:90-98`) | **Boş** — "6.3 Teslimat Türleri:" sonrası tablo kaybolmuş (M6.3) | {{TESLIMAT_TURU}} + Gel-Al dahil üç tür | **P1** — mobil metin eksik |
| 7 | Gel-Al / teslim edilemeyen sipariş | — (web M7 benzeri) | M7: Karabağlar'dan aynı/ertesi gün 21:00'e kadar teslim alma; iade yok | B-4.3: usul yer tutucusu; "iade yok" yalnız satıcı kusuru dışındaki hallerde | P2 |
| 8 | Cayma hakkı dayanağı | "6502 s. TKHK md.15/1-(b) ve (c)"; (b)=finansal piyasa, (c)=kişisel ihtiyaç; çabuk bozulan "Ek olarak" (`mesafeli.ts:134-146`) | M8.1: "tüm gıda ürünleri için cayma hakkı kullanılamaz", **atıf yok**; terms M10.1: "Kanun md.15/1-(c) … (b) bendi uyarınca çabuk bozulabilen" | **Mesafeli Sözleşmeler Yönetmeliği md.15/1-(c)** (çabuk bozulabilen); kişiye özel üründe ek olarak (b) | **P1** — yanlış norm (Kanun yerine Yönetmelik) ve harf karışıklığı; sonuç (cayma yok) doğru ama gerekçe hatalı. Harf sırası güncel konsolide metinden teyit |
| 9 | Ödeme sonrası iptal | "Hiçbir koşulda iptal/iade/değişiklik yok" (`mesafeli.ts:153-154`) | Aynı (M8.1) | Hazırlık başlamadan iptal penceresi `[İPTAL PENCERESİ]` (işletme kararı) | P2 — hukuken zorunlu değil; müşteri deneyimi ve "kesin ret" algısı |
| 10 | Macro paketi iadesi | "Cayma yok; hiç kullanılmamış dahi olsa iade yok" (`mesafeli.ts:158-166`); paket tablosu var (`kullanim.ts:205-214`) | M8.2 / M11.3 aynı; "TKHK md.15" atfı; **terms 11.2 paket tablosu boş** | 14 gün içinde hiç kullanılmamışsa cayma; onaylı hemen kullanımda (ğ); kısmi iade yer tutucusu | **P0** — TKHK md.5 haksız şart riski; (ğ) yalnız tüketici onayıyla ifaya başlanmışsa |
| 11 | Ayıp bildirimi | **2 saat, kesin ve uzatılamaz; yalnız uygulama; telefon/e-posta geçersiz; görselsiz talep işleme alınmaz** (`mesafeli.ts:180-189`) | terms M10.3 aynı; distance-sales M9 | Hak düşürücü koşul yok; "en kısa sürede, mümkünse fotoğraf" ricası; uygulama + e-posta + telefon | **P0** — TKHK md.8–12 ve md.5 bakımından geçersiz/haksız şart riski |
| 12 | Ayıp koşulları ve süreç listeleri | Dolu (`mesafeli.ts:180-200`) | **9.2 koşul listesi ve 9.4 listesi boş** (tablo/not kaybı) | B-9.1–9.4 tam | **P1** — mobil metin eksik |
| 13 | İade süresi | 14 gün içinde başlatma, 15 iş günü içinde yansıma (`mesafeli.ts:196`) | Aynı (M9) | Karardan itibaren 14 gün içinde iade; banka süresi ayrı | P2 |
| 14 | Yetkili yer | "İzmir Merkez Tüketici Mahkemeleri" (`mesafeli.ts:284`); `kullanim.ts:289` "İzmir Merkez Mahkemeleri ve İcra Müdürlükleri" | M14 aynı | Tüketicinin yerleşim yeri veya işlem yeri (TKHK md.73) | **P1** — tek yer yetkisi tüketiciye karşı uygulanamaz |
| 15 | Tüketici başvuru yolları | Hakem heyeti, mahkeme, TÜBİS (`mesafeli.ts:220-240,285`) | M10 aynı | Aynı + `[GÜNCEL YIL SINIRI]` | P2 — parasal sınır her yıl güncellenmeli |
| 16 | Kabul kaydı | Ödeme adımındaki onay kutusu (`mesafeli.ts:292-305`) | Onay kutusu var (`src/components/checkout/CheckoutFooter.tsx:153-176`, `src/modules/eatkcal/v2/screens/EkCheckoutScreen.tsx:298-336`) ama **kaydedilmiyor** (sipariş yükünde alan yok) | İki ayrı kutu (ön bilgi teyidi + sözleşme kabulü) + Macro için (ğ) onayı; sürüm, zaman, sipariş no ile kayıt; kopya e-posta + uygulama | **P0** — Yönetmelik md.6 ve md.18 ispat/saklama; bugün ispat imkânı yok |
| 17 | Kalıcı veri saklayıcısı (sözleşme kopyası) | Belirtilmemiş | Belirtilmemiş | E-posta + sipariş detayı (B-12.2) | **P1** — Yönetmelik md.7 |
| 18 | Markalar | Yalnız "KCAL" | Yalnız "KCAL" | eatkcal + mutfak markaları kcal., tera, Breaking Fast | P2 — web üç mutfak markası satıyor (`web:apps/eatkcal/lib/site.ts:43-47`) |
| 19 | Alerjen / besin değeri uyarısı | Yok (ayrı) | Yok | A.2'de alerjen ve tahmini değer uyarısı | P1 — Gıda bilgilendirme mevzuatı (Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği) — uzaktan satışta zorunlu bilgiler teyit |
| 20 | Kişisel veri atfı | Genel | Genel | KVKK Aydınlatma'ya link; kurye ve Adisyo ile paylaşım | P2 |
| 21 | Satıcının kayıt saklama süresi | Yok | Yok | En az 3 yıl (teyit) | P1 |

## Özet — yayın öncesi zorunlu (P0)

1. Ayrı Ön Bilgilendirme Formu + ayrı teyit kaydı (#2, #16).
2. Web metnindeki ödeme kuruluşunun düzeltilmesi (Tosla/PayTR → PaynKolay) (#3).
3. Ayıp bildirimi hak düşürücü koşullarının kaldırılması (#11).
4. Macro paketi "kullanılmasa da iade yok" hükmünün yeniden yazılması (#10).

## Mobil metindeki kayıplar (veri kaybı, hukuki değil teknik)

`src/data/contractsData.ts` JSON'a dönüştürülürken tablolar ve notlar düşmüş: distance-sales 6.3 (teslimat türleri), 9.2 ve 9.4 (ayıp listeleri); terms 11.2 (Macro paketleri); privacy MADDE 5/6/7.1 ve kvkk Bölüm 1/3/4.1/4.2/5/7/8/9. Metinler `legal_documents` tablosuna taşınırken (bkz. `ENTEGRASYON.md`) bu kayıplar giderilmeli.
