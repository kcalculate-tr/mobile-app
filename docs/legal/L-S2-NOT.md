# L-S2 — Şirket kimliği taslaklara işlendi (9 Kas 2026)

> Dal `legal/global` · worktree `.claude/worktrees/l-s2` · push yok · yayın yok

## Ne yapıldı

İlter kararı (9 Kas): şirket adı her yerde, TR ve EN metinlerde aynı biçimde yalnız **SEKULART LTD**. Diğer bilgiler mevcut yayındaki metinden (`kcal-web/apps/eatkcal/content/legal/mesafeli.ts`, yalnız okundu):

| Alan | Değer | Değişen yer tutucular (köşeli parantez içindeki adlar) |
|---|---|---|
| Şirket adı | SEKULART LTD | `TAM UNVAN`, `FULL LEGAL NAME`, `FULL TRADE NAME`, "SEKULART Ltd.", "SEKÜLART Sağlıklı Gıda Ürünleri San. ve Tic. Ltd. Şti.", "SEKÜLART … Ltd. Şti." |
| MERSİS | 0759-1148-7410-0001 | `MERSİS`, `MERSIS` (+ "değer teyit edilmeli" notları kaldırıldı) |
| VKN | 7591148741 | `VKN`, `TAX ID` |
| Adres | Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir (EN: sonuna ", Türkiye") | `ADRES`, `ADDRESS` |
| E-posta | info@eatkcal.com korunur; gizlilik talepleri için taslaktaki `[privacy@…]` olduğu gibi bırakıldı | — |
| Vergi dairesi | mevcut metinlerde **yok** → satırlar kaldırıldı ("Vergi dairesi / no" satırı → yalnız "VKN") | `VERGİ DAİRESİ`, `TAX OFFICE` |
| KEP | mevcut metinlerde **yok** → kimlik bloklarındaki KEP satırları, KEP başvuru kanalı (aydınlatma md. listesi, başvuru formu) ve "☐ KEP" yanıt seçeneği kaldırıldı | `KEP` |

Akış içindeki kısa atıflar ("SEKULART", "biz", "we") olduğu gibi kaldı. Başka şirket adlarındaki "Ltd." (Meta Platforms Ireland Ltd., Google Ireland Ltd.) değiştirilmedi.

**Kontrol:** `git grep -n -E "\[(TAM UNVAN|FULL LEGAL NAME|MERSİS|MERSIS|VKN|ADRES|ADDRESS|KEP)\]" -- docs/legal` → **0 sonuç**. `SEKÜLART` ve `SEKULART Ltd` → bu not dışında 0 sonuç.

## Değişen dosyalar (24 + bu not)

- `tr/` ve `en/`: 01 gizlilik, 02 KVKK aydınlatma, 03 açık rıza, 04 çerez, 05 kullanım koşulları, 06 mesafeli satış + ön bilgilendirme, 08 başvuru formu, 09 saklama-imha, 10 ihlal planı (07 topluluk kurallarında kimlik bloğu yok — değişmedi).
- `KURUMSAL_KIMLIK.md`: §1 kimlik kartı dolduruldu; "kısa ad = tescilli ad" kuralı "SEKULART LTD her yerde" kararıyla değiştirildi (§2.2); footer/fatura örnekleri; KEP satırı ve KEP iletişim adresi satırı kaldırıldı, yerine inceleme notu.
- `README.md`: gösterim kuralları (yer tutucu örnekleri, şirket adı satırı).
- `VERI_ENVANTERI.md`: başlıktaki veri sorumlusu satırı.
- `ENTEGRASYON.md`: §3 `company_identity` alan listesi + doldurulmuş JSON örneği; §6.6 KEP maddesine not.
- `BOSLUKLAR.md`: B-20 tablosuna "Vergi dairesi / KEP eklenmedi" satırı.
- `MESAFELI_KARSILASTIRMA.md`: satır 1'in "yeni taslak" sütunu güncellendi (kapsam dışıydı ama yer tutucu tarifini artık yanlış gösteriyordu; mevcut-metin sütunundaki "SEKÜLART tam unvan" → "Uzun ticaret unvanı").

## Kalan yer tutucular (doldurulmadı — kapsam dışı)

| Yer tutucu | Adet | Not |
|---|---|---|
| `[privacy@…]` · `[privacy@kcalculate.ai]` | 45 | Gizlilik kutusu kararı (KURUMSAL_KIMLIK §4) |
| `[support@…]` / `[legal@…]` | 12 / 10 | Aynı |
| `[TELEFON]` / `[PHONE]` / `[TEL]` | 12 / 16 / 6 | Tek biçim önerisi +90 232 332 21 00 — teyit; `[TEL]` ihlal ekibi kişi telefonları |
| `[TİCARET SİCİL NO]` / `[TRADE REGISTRY NO]` / `[SİCİL MÜDÜRLÜĞÜ]` / `[TİCARET SİCİL MÜDÜRLÜĞÜ]` | 4 / 2 / 1 / 1 | Mevcut metinlerde yok |
| `[YÜRÜRLÜK TARİHİ]` / `[EFFECTIVE DATE]` | 8 / 8 | Yayın günü |
| `[DURUM]` | 13 | Taslak durum etiketi / DPA durumu |
| `[AD SOYAD / UNVAN]` · `[NAME / TITLE]` · `[UNVAN]` · `[TITLE]` · `[YEDEK]` · `[DEPUTY]` · `[AD/UNVAN]` | 5·5·5·5·4·4·1 | Kişi atamaları (ihlal ekibi, saklama-imha görev tablosu) — şirket adı değil |
| `[AB TEMSİLCİSİ]` / `[EU REPRESENTATIVE]` / `[UK REPRESENTATIVE]` / `[UK TEMSİLCİSİ]` | 2 / 1 / 3 / 1 | B-12 |
| `[NO]` | 7 | Marka tescil / sicil numaraları |
| `[TESLİMAT SAATLERİ]` / `[DELIVERY HOURS]`, `[İPTAL PENCERESİ]` / `[CANCELLATION WINDOW]`, `[GEL-AL TESLİM SÜRESİ]` / `[PICK-UP WINDOW]`, `[KISMİ İADE KURALI]` / `[PARTIAL REFUND RULE]`, `[SÜRE SONU KURALI]` / `[EXPIRY RULE]`, `[TUTAR]` / `[AMOUNT]`, `[TOLERANS]` / `[TOLERANCE]`, `[SÜRE]` / `[PERIOD]` | — | İşletme kararları (mesafeli satış, Macro Coin) |
| `[GÜNCEL YIL SINIRI]` / `[CURRENT YEAR LIMIT]` | 3 / 2 | Tüketici hakem heyeti parasal sınırı |
| `[BAĞLANTI]` / `[LİNK]` / `[LINK]`, `[eatkcal.com/legal/veri-talebi]`, `[kcalculate.ai/legal/data-request]`, `[Ayarlar › …]` / `[Settings › …]` | — | URL ve ekran yolları |
| `[EKLENİRSE…]` / `[IF ADDED…]` ve çerez tablosu örnek hücreleri | — | Analitik/pazarlama çerezi eklenirse |
| `[POLİÇE BİLGİSİ]` / `[POLICY DETAILS]`, `[MÜHENDİSLİK SORUMLUSU]` / `[ENGINEERING LEAD]`, `[HUKUK]` / `[LEGAL]`, `[DESTEK]` / `[SUPPORT]`, `[DUNS]`, `[ÖNERİ]`, `[TARİH]` / `[DATE]`, `[YIL]` / `[YEAR]`, `[şablon eklenecek]`, `[varsa]`, `[current KVK Authority address …]` | 1–2 | İhlal planı, iç belgeler |

## Tamamlanamayan kısım

Yok — kapsamdaki tüm madde yapıldı. Not edilmesi gerekenler:
- İhlal planındaki "Kurul'a gerekirse KEP ile bildirim" cümlesi (tr/en 10) Kurum'un kanalını anlattığı için bırakıldı; şirketin KEP adresi yoksa bu yol kullanılamaz.
- Başvuru formundaki inceleme notu (Başvuru Tebliği md.5'in yazılı/KEP başvurusu unsurları) mevzuat tarifi olduğu için bırakıldı.
- KEP zorunluluğu (TTK md.18/3) teyit edilmeli; adres alınırsa kimlik bloklarına ve başvuru kanallarına geri eklenmeli (BOSLUKLAR B-20).
