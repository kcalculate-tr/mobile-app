# G38 — Adisyo ad listesi (İlter için)

Kaynak: canlı DB, salt okunur sorgu (12 Kas 2026). Uygulanacak migration:
`supabase/migrations/20261112140100_g38_urun_adlari.sql` (rollback: `supabase/rollbacks/20261112140100_g38_urun_adlari_rollback.sql`).

## 1) Adisyo panelinde GÜNCELLENECEK ürün adları (products)

Ürün adları yalnız sondaki hacim parantezinden arındırıldı. Uygulamada **kısaltılmadı**
(ürün listesi/ürün sayfası tam adı gösterir). Adisyo'da da aynı adı yazın.

| Ürün id | Adisyo kodu | Eski ad | Yeni ad |
|---|---|---|---|
| 17 | KCAL-17 | Yeşil Canlandırıcı Detoks (330ml) | Yeşil Canlandırıcı Detoks |
| 18 | KCAL-18 | Tropikal Yağ Yakıcı (330ml) | Tropikal Yağ Yakıcı |
| 19 | KCAL-19 | Turuncu Metabolizma Hızlandırıcı (330ml) | Turuncu Metabolizma Hızlandırıcı |
| 20 | KCAL-20 | Limonlu Zencefilli Arındırıcı (330ml) | Limonlu Zencefilli Arındırıcı |
| 21 | KCAL-21 | Salatalıklı Ferahlatıcı (330ml) | Salatalıklı Ferahlatıcı |
| 22 | KCAL-22 | Kırmızı Antioksidan Güç (330ml) | Kırmızı Antioksidan Güç |

## 2) Kodsuz ürünler (ad değişince eşleşme kopabilir)

`adisyo-sync-products` önce `adisyo_product_code` ile, yoksa ADLA eşleşir.

- **Mevcut ürünlerde kodsuz ürün YOK.** Canlıdaki 65 ürünün hepsinde `adisyo_product_code` dolu
  (KCAL-6 … KCAL-84). Yukarıdaki 6 ad değişikliği eşleşmeyi koparmaz: kodla eşleşir.
- **Yeni 5 sos ürünü kodsuz eklenir** (Adisyo kodu canlı veride bulunamadı). Bunlar ADLA eşleşecek:

| Uygulamadaki ad (yeni ürün) | Adisyo'da beklenen ad | Fiyat | Not |
|---|---|---|---|
| Acı Sweet Chili Sos | Acı Sweet Chili Sos (50cc) | 40 TL | |
| Ranch Sos | Ranch Sos (50cc) | 40 TL | |
| Ballı Hardal Sos | Ballı Hardal Sos (50cc) | 40 TL | |
| Remoulade Sos | Remoulade Sos (50cc) | 40 TL | görsel ve kalori/makro yok |
| Chipotle Sos | Chipotle Sos (50cc) | 40 TL | |

  Eşleşme parantezi yok sayar ("Ranch Sos (50cc)" = "Ranch Sos"). Adisyo'daki ad farklıysa
  (ör. "Sweet Chili Sos (50cc)" — "Acı" yok) ya Adisyo'da adı yukarıdaki gibi yapın ya da
  Adisyo ürün koduna "KCAL-<ürün id>" yazıp sync'i kodla eşletin. Aynı addan Adisyo'da iki ürün
  varsa sync "belirsiz" der ve eşlemez.

  Sıra: migration → `adisyo-sync-products` (merkez) → aynı fonksiyon Bayraklı şubesi için
  `{ "branch_id": "921d0a7b-fe2f-47ce-95a9-f7bb5fb16bd0", "dry_run": false }` →
  `supabase/migrations-manual/20261112T1403_g38_soslar_ac.sql` (yalnız eşlenen sosları açar).

## 3) Yalnız uygulamada kısalan SEÇENEK adları (option_items)

Bunlar Adisyo'da ürün DEĞİL; siparişte fiş notuna (OrderDetailNote) seçenek etiketi olarak
yazılır. Adisyo'da güncellenecek bir şey yok, ama **mutfak fişinde kısa ad görünecek** —
ekibe haber verin (ör. paket siparişinde "Protein Tavuk Fileto" = "Basmati Üzeri Tavuk Fileto ve Brokoli").

Ölçü: seçenek kartı 136 pt, metin alanı 117 pt, PlusJakartaSans SemiBold 15 pt. Aşağıdaki
yeni adların hepsi 112 pt'de (güvenlik payı) en fazla 2 satıra sarıyor.

| Eski seçenek adı | Yeni seçenek adı | DB satırı | Neden |
|---|---|---|---|
| Yeşil Canlandırıcı Detoks (330ml) | Yeşil Canlandırıcı | 12 | parantez + kısa ad |
| Tropikal Yağ Yakıcı (330ml) | Tropikal Yağ Yakıcı | 12 | parantez |
| Turuncu Metabolizma Hızlandırıcı (330ml) | Turuncu Metabolizma | 12 | parantez + kısa ad |
| Limonlu Zencefilli Arındırıcı (330ml) | Limonlu Zencefilli | 12 | parantez + kısa ad |
| Salatalıklı Ferahlatıcı (330ml) | Salatalıklı Ferahlatıcı | 12 | parantez |
| Kırmızı Antioksidan Güç (330ml) | Kırmızı Antioksidan | 12 | parantez + kısa ad |
| Basmati Üzeri Tavuk Fileto ve Brokoli | Protein Tavuk Fileto | 17 | kısa ad (Yüksek Protein serisi, bağlı ürün 6) |
| Basmati Üzeri Tavuk Sote ve Brokoli | Protein Tavuk Sote | 11 | kısa ad (Yüksek Protein serisi, bağlı ürün 7) |
| Basmati Üzeri Tavuk Sote ve Brokoli Sebze | Protein Tavuk Sote | 6 | kısa ad (Yüksek Protein serisi, bağlı ürün 7) |
| Basmati Üzeri Izgara Köfte ve Brokoli | Protein Izgara Köfte | 11 | kısa ad (Yüksek Protein serisi, bağlı ürün 8) |
| Basmati Üzeri Izgara Köfte ve Brokoli Sebze | Protein Izgara Köfte | 6 | kısa ad (Yüksek Protein serisi, bağlı ürün 8) |
| Tavuk Fileto Basmati ve Brokoli Sebze | Dengeli Tavuk Fileto | 7 | kısa ad (Dengeli ve Sağlıklı serisi, bağlı ürün 9) |
| Tavuk Sote Basmati ve Brokoli Sebze | Dengeli Tavuk Sote | 7 | kısa ad (Dengeli ve Sağlıklı serisi, bağlı ürün 10) |
| Izgara Köfte Basmati ve Brokoli Sebze | Dengeli Izgara Köfte | 7 | kısa ad (Dengeli ve Sağlıklı serisi, bağlı ürün 11) |
| Brokoli Sebze Üzeri Tavuk Fileto Bowl | Tavuk Fileto Bowl | 9 | kısa ad (Yağ Yakımı serisi, bağlı ürün 12) |
| Brokoli Sebze Üzeri Tavuk Sote Bowl | Tavuk Sote Bowl | 9 | kısa ad (Yağ Yakımı serisi, bağlı ürün 13) |
| Brokoli Sebze Üzeri Izgara Köfte Bowl | Izgara Köfte Bowl | 9 | kısa ad (Yağ Yakımı serisi, bağlı ürün 14) |
| Protein Shake Kakao Fıstık Ezmeli | Fıstık Ezmeli Shake | 6 | kısa ad |
| Protein Shake Kakao Hindistan Cevizli | Hindistan Cevizli Shake | 6 | kısa ad |
| Protein Shake Kakao Yulaf Vanilyalı | Yulaf Vanilyalı Shake | 6 | kısa ad |
| Dana Roastbeef 50g | Roastbeef 50g | 1 | kısa ad (grup içi tutarlılık) |
| Dana Roastbeef 80g | Roastbeef 80g | 1 | kısa ad (grup içi tutarlılık) |
| Dana Roastbeef 100g | Roastbeef 100g | 1 | kısa ad |
| Fıstıklı Mortadella Salam 50g | Mortadella 50g | 1 | kısa ad (grup başlığı 'Fıstıklı Mortadella Salam Seçimi' alerjeni gösteriyor) |
| Fıstıklı Mortadella Salam 80g | Mortadella 80g | 1 | kısa ad (grup başlığı alerjeni gösteriyor) |
| Fıstıklı Mortadella Salam 100g | Mortadella 100g | 1 | kısa ad (grup başlığı alerjeni gösteriyor) |
| Soya Soslu Tavuk Sote 150g | Soya Soslu Sote 150g | 1 | kısa ad (soya alerjeni korunur) |
| Soya Soslu Tavuk Sote 250g | Soya Soslu Sote 250g | 1 | kısa ad (soya alerjeni korunur) |
| Soya Soslu Tavuk Sote 350g | Soya Soslu Sote 350g | 1 | kısa ad (soya alerjeni korunur) |
| Mavi Haşhaşlı Amerikan Bagel | Mavi Haşhaşlı Bagel | 1 | kısa ad |
| Basmati & Lolorosso Karışık | Basmati & Lolorosso | 1 | kısa ad |

Kısaltılmayanlar: "Protein Shake Kakao Muzlu", "Brokoli Sebze Salata Bowl", "Garnitür (Karışık)"
ve diğer tüm seçenekler zaten 2 satıra sığıyor. "Garnitür (Karışık)" parantezi hacim/gramaj
değil, olduğu gibi bırakıldı.

## 4) Şablon (template) değerleri

`product_option_template_values` içinde sonda hacim/gramaj parantezli ad YOK — değişiklik yok.
