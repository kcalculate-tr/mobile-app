# G27-S1 — Klavye "Kapat" barı kalkar + G26 kararları + fiyat eşitleme · 11 Kas 2026

Dal `release/1.1.0` (worktree `.claude/worktrees/g23-s1`, G26-S1-DONE var). Yeni paket yok. Deploy yok, canlı DB yazma yok;
migration yalnız DOSYA.

## ÖZET
1. Klavye "Kapat" barı HER YERDE kalktı: `KeyboardToolbar` (App kökündeki global bar) ve `KeyboardAccessory` silindi, 7 dosyadaki `inputAccessoryViewID` / ölü kimlikler temizlendi.
2. Yerine kökte `KeyboardDismissRoot` (`src/core/design/KeyboardDismissRoot.tsx`): klavye dışında herhangi bir yere dokununca kapanır. Responder olmaz → liste öğesine / düğmeye dokunma hem kapatır hem öğeyi açar; Modal, sheet (Elle gir, not, adres), portal dahil.
3. İstisnalar: odaklı alanın kendisi (imleç), başka giriş alanı (alan değiştirme), sürükleme, Koç "Gönder" (`keepKeyboardOnTouch`, sohbet sürer).
4. 131 kaydırma kabı (ScrollView / FlatList / SectionList, Animated/Reanimated dahil) `{...SCROLL_KEYBOARD}`: `keyboardShouldPersistTaps="handled"` + iOS `interactive` / Android `on-drag`. `FIN_SCROLL_KEYBOARD` bunu yayar. Kaynak bekçisi yeni kabı yakalar.
5. Kısa çok satırlı notlarda klavye içi "Bitti" (sipariş notu ×2, bekleme listesi notu, biyografi); gönderi / yorum / koç / geri bildirim zaten gönder düğmeli.
6. Fiyat: uygulama fiyatı yalnız mağazadan (yedek fiyat yok); rozet ve haftalık karşılık zaten hesaplanıyor → Fresh 199×12 vs 999 = **%58**, Balance **%50**. Sabit 149 / %44 yalnız testlerdeydi → `demoPrices.ts` (199/999/499/2999, USD $4.99/$29.99) tek kaynak.
7. G26 (2): Meta varsayılan KAPALI — olay yalnız `granted`; `unset` = kapalı (iOS + Android); otomatik uygulama olayları da (app.config `autoLogAppEventsEnabled: false`); onay anahtarları önceden işaretli değil.
8. G26 (3): sağlık verisi açık rızası `user_consents` ayrı satır (`health_data` / `takibe`) — migration DOSYASI + rollback + istemci (yan kuyruk).
9. G26 (4): kaçan bildirim teklifi sonraki oturumda öğün kaydından sonra BİR kez daha. (5) Tara sırası aynı, (7) eski kabuk kabul — kod değişikliği yok.
10. Kontroller: tsc 0 · hygiene OK · unit 1087/0 (1 atlanan) · jest 454/454 (80 dosya) · expo export iOS + Android OK. **Yeni native derleme gerekir** (app.config FBSDK `autoLogAppEventsEnabled` değişti).

## Commit tablosu
| Madde | Commit | Özet |
|---|---|---|
| 1 | `b8db801` | Kapat barı + aksesuar silindi; KeyboardDismissRoot; 131 kap SCROLL_KEYBOARD; notlarda Bitti; testler + Tracker snapshot |
| 2 | `a268324` | demoPrices (199/999/499/2999); test sabitleri 199; bekçi (149 TL / %44 yok) |
| 3 (S2) | `09eb012` | Meta varsayılan kapalı (metaAllowed = granted), autoLog kapalı, anahtarlar işaretsiz, metin TR/EN |
| 3 (S3) | `6db64b9` | migration `20261111230100_g27_health_consent` + rollback; `recordHealthConsent`; yan kuyruk |
| 3 (S4) | `35ca71d` | `decideNotifyOffer`; HomeCelebrations ikinci şans; bileşen testi |
| 4 | `f250001` | G20-S3 kapı bekçisi güncellendi; kontroller |
| — | (bu commit) | LOG; ardından `G27-S1-DONE` |

## KARAR
1. **Kapanış kökte, tek yer**: her ekrana `TouchableWithoutFeedback` sarmak yerine App kökünde ham dokunma dinleyicisi (`onTouchStart/Move/End`, responder değil). Ekran kökü sarmalayıcısı dokunmayı yutup düğmeleri bozabilirdi; kök dinleyici React ağacı boyunca kabardığı için Modal/sheet içleri de kapsanır. Karar saf fonksiyonda (`keyboardDismiss.ts`, birim testli).
2. **Dokunma = ≤ 10 pt kayma**; daha fazlası kaydırmadır ve kabın `keyboardDismissMode`'una kalır. Native kaydırma dokunmayı devralınca (`touchCancel`) kök karar vermez.
3. **Koç "Gönder" klavyeyi kapatmaz** (sohbet akışı). Yorum gönder kapatır (yeni yorum görünsün). Başka istisna yok.
4. **Kısa notlarda `submitBehavior="blurAndSubmit"`** (return = Bitti, yeni satır yok): sipariş notu (eski + v2), bekleme listesi notu, biyografi (150 krk). Gönderi metni / geri bildirim / destek / şikâyet uzun metin → yeni satır korunur, kendi gönder düğmeleri var.
5. **Fiyat yedeği eklenmedi**: G23-S1 kararı (fiyat yalnız RevenueCat, yoksa hata ekranı) korunuyor. `demoPrices.ts` yalnız test/vitrin; bekçi testi üretim kodundan içe aktarılmadığını denetler. Vitrin kataloğunda paywall sahnesi yok — ekran görüntüsü mağaza sandbox fiyatıyla (SORULAR 2).
6. **Meta "unset" = kapalı**: açılışta disk okunmadan gelen olaylar da gitmez (güvenli yön). Otomatik olaylar (yükleme/etkinleştirme) yalnız rızada açılır; FBSDK yine başlatılır (AEM yapılandırması için), IDFA/izleme iOS'ta sabit kapalı.
7. **Sağlık rızası anı = "Seni tanıyalım › Devam"** (kutu işaretli, 18 yaş üstü). Aynı metin sürümünde tekrar yazılmaz (`@kcal_health_consent`, sürüm 1). Satır ortak kuyruğa KONMAZ: migration uygulanmadan CHECK reddederse politika/reklam satırlarını tıkardı; yan kuyrukta (`@kcal_consent_pending_side`) bekler, oturum açılınca / migration sonrası yazılır.
8. **İkinci şans** yalnız "kaçan" teklif için (ilk öğün oturumunda başka onay sheet'i açılmışsa). Sonraki oturumda yeni öğün kaydından sonra (kutlama varsa kapanınca); o oturumda da başka sheet açıldıysa hak korunur; izin artık sorulamıyorsa / verildiyse hak düşer.

## HIG (klavye kapanışı, VoiceOver)
- "Kapat" düğmesi olmadan VoiceOver kullanıcısı klavyeyi: klavyenin kendi yolu (return tuşu "Bitti"/"Gönder" — kısa alanlarda alanı bırakır; iPad'de klavyeyi gizle tuşu), alan dışındaki bir öğeye çift dokunma (VoiceOver etkinleştirmesi dokunma olayı üretir, kök görür) ve kaydırma (`interactive`/`on-drag`; VoiceOver'da üç parmak kaydırma) ile kapatır. Görev tanımındaki not: iOS'ta klavyenin kendi kapatma hareketi + kökte dokunma yeterli kabul edildi; VoiceOver'da gerçek cihaz denemesi yapılmadı. Kök görünüm erişilebilirlik ağacına girmez (düz View, `accessible` değil; test var).
- Android: geri tuşu klavyeyi kapatır (sistem).
- Dokunma hedefleri değişmedi (yeni düğme yok). Dynamic Type etkilenmez. `apple-design-skill` ile ayrı otomatik denetim çalıştırılmadı; elle kod denetimi.

## CANLIYA UYGULANACAK
- `supabase/migrations/20261111230100_g27_health_consent.sql` (İlter onayıyla `supabase db push`). Rollback: `supabase/rollbacks/20261111230100_g27_health_consent_rollback.sql`. Uygulanana dek istemci güvenli (satır cihazda bekler).

## DEPLOY GEREKİR
- **Yeni native derleme** (iOS + Android): `app.config.js` FBSDK eklentisi `autoLogAppEventsEnabled: false` (Info.plist `FacebookAutoLogAppEventsEnabled`, Android manifest meta-data). JS tarafı OTA ile de gider ama otomatik olayların açılışta kapalı olması derleme ister. G26-S1 zaten yeni derleme istiyordu — aynı derlemeye girer.

## Cihazda doğrulanacak (simülatörde elle)
- Fabric'te ham dokunma olayının `target`'ı TextInput örneğiyle eşleşiyor mu (alan değiştirirken klavye kapanıp açılmamalı). RN ScrollView aynı karşılaştırmayı kullanıyor; birim/bileşen testleri taklitle geçiyor.
- Sepet / Ödeme / Elle gir / adres sheet'lerinde dışarı dokunma + liste öğesi dokunma.

## SORULAR
1. Yorum "Gönder" de klavyeyi açık tutsun mu (Koç gibi)? Şu an kapatıyor.
2. Paywall ekran görüntüsü için vitrin sahnesi (demoPrices ile 199/999/499/2999) eklensin mi? Şu an vitrin kataloğunda paywall yok.
3. `docs/store/APP_STORE_METINLERI.md` "Uygulama içi satın alma YOK" satırı abonelikle çelişiyor — mağaza metni güncellenmeli (bu oturumda dokunulmadı).
4. Sağlık rızasını Ayarlar'dan geri alma (Veri ve reklam izinleri'nde ayrı satır) eklensin mi? İstemci fonksiyonu hazır (`recordHealthConsent(false, 'settings')`), ekran tasarımı yok.
5. Balance USD fiyatı (Fresh $4.99 / $29.99 dışında) karar notunda yok — demo fiyatlara yalnız Fresh USD yazıldı.
