# L-S3 LOG — Abonelik ve AI maddeleri: Koşullar + Gizlilik taslakları (11 Kas 2026)

Dal `legal/global` (taban 95f3389 = L-S2-DONE) · worktree `.claude/worktrees/l-s3` (l-s1/l-s2 yoktu → `git worktree add`). **PUSH YOK · YAYIN YOK** — İlter (avukat) incelemesi için taslak. Kod kanıtları `release/1.1.0` (@ 0401d64), yalnız okundu.

## ÖZET
1. Koşullar TR+EN: §12A kcalAI abonelikleri (Fresh/Balance, aylık/yıllık, 7 gün deneme + kullanılmayan kısmın sona ermesi, Apple Kimliği/Google Play tahsilatı, 24 saat iptal, mağazadan yönetim, mağaza iadesi, fiyat değişikliği, günlük hak tablosu 2/10/50 · barkod 5/∞ · Koç 3 deneme/30, 00.00 TR yenileme, devredilemezlik, Koç tıbbi tavsiye değil, Apple Standard EULA). + §2 tanımlar, §5.4, §13.3, §15.4 (silme aboneliği iptal etmez).
2. Gizlilik TR+EN: §5A AI tarama/sesli giriş (ses kaydı yok; konuşma tanıma SEÇENEK A/B köşeli parantez — G25-S1 LOG yoktu), §5B Koç (gönderilen özet alanları koddan, 30 gün, silme), §11A RevenueCat, §12A Open Food Facts (ODbL) + GeoNames (CC BY 4.0), §13A KVKK md.9 + uygulama içi AI izinleri; §3/§12/§14 tablolarına satırlar.
3. `docs/legal/MAGAZA_GIZLILIK_ESLEME.md`: Apple App Privacy + Play Data safety, bağlı/izleme/amaç/paylaşım, metin↔etiket tutarlılık tablosu.
4. `BOSLUKLAR.md`: B-21…B-32 + avukat soruları 7–14.
5. Kod bulguları (metne inceleme notu olarak girdi): Koç 30 gün silmesi yalnız kullanıcı yeniden yazınca çalışıyor; hesap silmede RevenueCat kaydı silinmiyor; ODbL atfı eksik; ses tanıma bugün B davranışında (cihaz desteklemezse platform hizmeti).
6. Her yeni madde `<!-- L-S3 -->` ile başlıyor (TR ve EN gizlilikte 20'şer, koşullarda eşit).
7. Şirket adı yalnız SEKULART LTD; uygulama/web metinlerine dokunulmadı.

## Değişen dosyalar
| Dosya | Değişiklik |
|---|---|
| `docs/legal/tr/05-kullanim-kosullari.md`, `en/05-terms-of-use.md` | §2 (4 tanım), §5.4, **§12A** (13 alt madde + inceleme notu), §13.3, §15.4, başlıkta L-S3 notu |
| `docs/legal/tr/01-gizlilik-politikasi.md`, `en/01-privacy-policy.md` | §3 (4 satır + "işlemediklerimiz"), **§5A, §5B, §11A, §12A, §13A**, §12 (5 satır), §14 (4 satır), başlıkta L-S3 notu |
| `docs/legal/MAGAZA_GIZLILIK_ESLEME.md` | YENİ |
| `docs/legal/BOSLUKLAR.md` | özet tablo B-21…B-32, yeni "kcalAI" bölümü, B-07'ye yönlendirme, sorular 7–14 |
| `docs/legal/README.md` | okuma sırası 7 + "yayından önce" maddesi |

## Commit tablosu
| Commit | Madde |
|---|---|
| 2f5bb13 | md.1 Kullanım Koşulları — kcalAI abonelikleri |
| 3baef94 | md.2 Gizlilik Politikası ekleri |
| 8a1ffff | md.3 Mağaza gizlilik eşleme + README |
| 634b2c5 | md.4 BOSLUKLAR karar noktaları |
| (sonraki) | LOG + `docs/night/L-S3-DONE` |

## KARAR
- Konuşma tanıma: G25-S1 LOG'u yoktu → görev gereği iki seçenek köşeli parantezle; inceleme notunda kodun bugün SEÇENEK B gibi davrandığı yazıldı.
- Fiyat metne yazılmadı (mağaza ülkeye göre gösterir); hak sayıları "yayın tarihindeki değerler" diye tabloda.
- Bölüm numaraları kaydırılmadı: yeni bölümler 5A/5B/11A/12A/13A ve Koşullar 12A — mevcut çapraz atıflar bozulmasın diye.
- §13A aktarımı standart sözleşmeye, sağlık verisini açık rızaya dayandırıyor; AI izni md.9 rızası olarak sunulmadı (2024 rejimi).
- "İzleme yok" yalnız kcalAI verileri için yazıldı; Meta ticaret olayları yüzünden Apple etiketinde "İzleme: Evet" satırları kalıyor → B-29 kararı İlter'de.
- KVKK Aydınlatma (02) ve Açık Rıza (03) bu oturumda güncellenmedi (görev kapsamı Koşullar + Gizlilik); SORULAR 3.

## CANLIYA UYGULANACAK / DEPLOY GEREKİR
Yok (yalnız taslak). Önerilen kod/konsol işleri BOSLUKLAR B-21…B-32 ve `MAGAZA_GIZLILIK_ESLEME.md` §4'te.

## SORULAR
1. B-21 Standard EULA mı özel EULA mı? · B-22 ses tanıma A mı B mi?
2. B-23 Anthropic/RevenueCat standart sözleşmeleri imzalanmadan AI ve abonelik TR'de açılsın mı?
3. 02 KVKK Aydınlatma ve 03 Açık Rıza (sağlık §1) metinlerine sesli giriş/Koç/RevenueCat aynı şekilde işlensin mi? (Öneri: evet, ayrı kısa oturum.)
4. B-29 Meta reklam ölçümü kalsın mı? · B-30 `ai_coach` izin metni önerisi onaylanıyor mu?
5. Avukat soruları tam liste: `BOSLUKLAR.md` "Karar bekleyen sorular" 7–14.
