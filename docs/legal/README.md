# docs/legal — Global hukuk paketi (TASLAK)

> **Hiçbiri yayımlanmadı.** Tümü hukuki inceleme için taslaktır (İlter Öziseven, avukat). Uygulama ve web metinleri bu oturumda değiştirilmedi.
> Oturum: L-S1 · 2026-11-09 · dal `legal/global` (taban `night19/release`)

## Okuma sırası

1. `VERI_ENVANTERI.md` — koddan çıkarılmış kişisel veri envanteri (`dosya:satır` kanıtlı). Diğer her şeyin temeli.
2. `BOSLUKLAR.md` — öncelikli uyum boşlukları (P0/P1/P2), mağaza formu cevap tabloları.
3. Taslak metinler (aşağıda).
4. `MESAFELI_KARSILASTIRMA.md` — mesafeli satış taslağı ile mevcut web/mobil metinlerin karşılaştırması.
5. `KURUMSAL_KIMLIK.md` — yasal ad kuralı, footer standardı, iletişim adresleri, marka mimarisi.
6. `ENTEGRASYON.md` — hangi metin nerede, sürümleme, gereken kod/migration işleri (yapılmadı, yalnız liste).
7. <!-- L-S3 --> `MAGAZA_GIZLILIK_ESLEME.md` — Apple App Privacy + Google Play Data safety eşleme tablosu (kcalAI: AI tarama, sesli giriş, Koç, abonelik); B-07 tablolarını günceller.

## Taslak metinler

| # | Metin | TR | EN | Yayın yeri |
|---|---|---|---|---|
| 01 | Gizlilik Politikası (global; KVKK + GDPR Art.13/14 + ABD eyalet) | `tr/01-gizlilik-politikasi.md` | `en/01-privacy-policy.md` | uygulama, eatkcal.com, kcalculate.ai, mağazalar |
| 02 | KVKK Aydınlatma Metni | `tr/02-kvkk-aydinlatma-metni.md` | `en/02-kvkk-information-notice.md` | uygulama, web |
| 03 | Açık Rıza Metinleri (sağlık · yurt dışı aktarım · pazarlama · reklam ölçümü/Meta) | `tr/03-acik-riza-metinleri.md` | `en/03-explicit-consent-forms.md` | uygulama akışları, web formları |
| 04 | Çerez Politikası (web) | `tr/04-cerez-politikasi.md` | `en/04-cookie-policy.md` | web |
| 05 | Kullanım Koşulları (global) | `tr/05-kullanim-kosullari.md` | `en/05-terms-of-use.md` | uygulama, web |
| 06 | Ön Bilgilendirme Formu + Mesafeli Satış Sözleşmesi (eatkcal) | `tr/06-mesafeli-satis-ve-on-bilgilendirme.md` | `en/06-distance-sales-and-pre-contract-information.md` | ödeme adımı, eatkcal.com, sipariş e-postası |
| 07 | Topluluk Kuralları (FinRules ile uyumlu) | `tr/07-topluluk-kurallari.md` | `en/07-community-guidelines.md` | Keşfet, kcalculate.ai |
| 08 | Veri Sahibi Başvuru Formu + süreç (30 gün) | `tr/08-veri-sahibi-basvuru-formu-ve-sureci.md` | `en/08-data-subject-request-form-and-process.md` | uygulama, web; süreç iç kullanım |
| 09 | Saklama ve İmha Politikası | `tr/09-saklama-ve-imha-politikasi.md` | `en/09-retention-and-deletion-policy.md` | iç belge |
| 10 | Veri İhlali Müdahale Planı | `tr/10-veri-ihlali-mudahale-plani.md` | `en/10-data-breach-response-plan.md` | iç belge |

## Gösterim kuralları

- `[YER TUTUCU]` — doldurulacak bilgi: `[TİCARET SİCİL NO]`, `[TELEFON]`, `[privacy@…]` vb. (Şirket adı, MERSİS, VKN ve adres L-S2'de dolduruldu; kalanlar: `L-S2-NOT.md`.)
- `{{DİNAMİK}}` — çalışma anında doldurulan alan (sipariş no, tutar…).
- `> **[İnceleme notu]**` / `> **[Reviewer note]**` — avukatın karar vermesi gereken nokta. Yayından önce silinir.
- Türkçe metin bağlayıcıdır; İngilizce metinler tam çeviridir (GDPR/ABD okuru için ek bölümler EN'de de vardır).
- Şirket adı: her yerde (TR + EN) **SEKULART LTD** — karar 9 Kas 2026. MERSİS 0759-1148-7410-0001 · VKN 7591148741 · Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir. Vergi dairesi ve KEP eklenmedi (`BOSLUKLAR.md` B-20).

## Yayından önce mutlaka

Bazı taslak cümleler **hedef davranışı** anlatır; kod düzelmeden yayımlanırsa gerçeğe aykırı olur. Ayrıntılar `BOSLUKLAR.md`'de; kısaca:
- Meta'ya yalnız rızayla gönderim (B-06).
- Tarama fotoğraflarının 30 günde silinmesi (B-15).
- Pazarlama iletisinin yalnız onayla gönderilmesi (B-11).
- 18+ kontrolü (B-10).
- Rıza ve kabul kayıtları (B-02).
- Gizli profil medyasının korunması (B-18).
- <!-- L-S3 --> Koç sohbetinin 30 günde silinmesi için zamanlanmış iş (B-24); ses tanıma seçeneği A/B'nin kesinleşmesi (B-22); Anthropic + RevenueCat standart sözleşmeleri (B-23).
