# docs/store — KCAL 1.1.0 mağaza paketi (M-S1 + M-S2 Koç açık, 11 Kas; ilk hâl G20-S2)

| Dosya | İçerik |
|---|---|
| `YAYIN_KONTROL.md` | 1.1.0 gönderim kontrol listesi: canlı (migration, edge, bayrak, web URL'leri), derleme, ASC, Play, yayın sonrası, geri dönüş |
| `APP_STORE_METINLERI.md` | App Store Connect metinleri TR/EN: ad, alt başlık, anahtar kelime, promosyon, açıklama (abonelik + EULA), yenilikler, abonelik ürünleri |
| `GOOGLE_PLAY_METINLERI.md` | Google Play metinleri TR/EN + abonelikler + konsol alanları |
| `INCELEME_NOTU.md` | App Review notu (EN) + Play "Uygulama erişimi"; şifreyle inceleme girişi, Sandbox, AI foto/ses, kcalAI Koç, eatkcal İzmir |
| `GIZLILIK_BEYANLARI.md` | Apple App Privacy (tür tür) + Play Data safety (soru soru); G26 ve L-S3 ile tutarlılık |
| `EKRAN_GORUNTUSU_PLANI.md` | 7 kare TR/EN (03 = kcalAI Koç), kaynak panolar, örnek veriler, yeniden üretme |
| `shots/` | `ios/{tr,en}/NN.png` (6,9"), `ios/{tr,en}/65/NN.png` (6,5"), `play/{tr,en}/NN.png` + `feature.png`; betikler `_kaynak/` (`prep.sh` → `phone.js` → `compose.js`) |
| `IZIN_METINLERI.md` | İzin metinleri TR/EN |
| `well-known/` | `apple-app-site-association`, `assetlinks.json` (web'e konacak) |
| `_uret_metinler.py` | Metin üreticisi + denetim (`python3 -I docs/store/_uret_metinler.py docs/store`) |
