# G3-S2 — Eski service_role anahtarından kurtulma: envanter + rotasyon runbook

**Durum:** HAZIRLIK. Bu gece HİÇBİR anahtar değiştirilmedi, hiçbir migration uygulanmadı,
canlı DB yalnızca metadata için okundu. Dal: `night3/key-rotation`.
**Amaç:** Eski (legacy, JWT formatlı) `anon` ve `service_role` anahtarlarını hiçbir şeyi
bozmadan devre dışı bırakabilecek duruma gelmek.

---

## 1. Envanter — eski anon/service_role anahtarı nerelerde kullanılıyor

Değerler asla yazılmadı; yalnızca "tür + yer" belirtildi. Anahtar türleri:
- **legacy anon JWT** — `eyJ…role":"anon"…` (eski publishable)
- **legacy service_role JWT** — `eyJ…role":"service_role"…` (eski secret)
- **yeni publishable** — `sb_publishable_…` (anon yerine)
- **yeni secret** — `sb_secret_…` (service_role yerine; henüz OLUŞTURULMADI)

### 1a. Veritabanı içi (canlı `xtjakvinklthlvsfcncu`)

DB'deki HİÇBİR fonksiyon/cron/trigger gövdesinde ham (gömülü) JWT **yok** — hepsi
anahtarı **Supabase Vault**'tan okur. Repo migration geçmişi ile doğrulandı.

**Vault secret'ları (ad — değer YAZILMADI):**

| Vault secret adı | Şu an tuttuğu (tahmini) | Okuyan DB nesneleri |
|---|---|---|
| `service_role_key` | legacy service_role JWT | aşağıdaki 8 cron/trigger |
| `adisyo_service_role_key` | legacy service_role JWT | `fn_notify_adisyo_save_order` (orders trigger) |

**`service_role_key`'i Vault'tan okuyup `net.http_post` ile edge function çağıran yerler**
(dosya referansları, hepsi `vault.decrypted_secrets WHERE name='service_role_key'`):
- `supabase/migrations/20260916270000_macro_expiry_cron_vault.sql` — cron `macro-expiry-daily`
- `supabase/migrations/20260916260000_payment_review_pending.sql` — cron `paynkolay-review-sweep` (+ `expire-abandoned-orders`)
- `supabase/migrations/20260918160000_card_verification_sweep.sql` — cron `card-verification-sweep`
- `supabase/migrations/20260921124959_cron_order_feedback_push.sql` — cron `push-order-feedback`
- `supabase/migrations/20261020094231_push_cart_abandoned_5min.sql` — cron `push-cart-abandoned`
- `supabase/migrations/20261013114037_trendyolgo_poll_cron.sql` — cron `trendyolgo-poll`
- `supabase/migrations/20261013114021_trendyolgo_push_status_trigger.sql` — `fn_trendyolgo_push_status`
- `supabase/migrations/20260923124848_macro_reward_killswitch_and_rpc_lockdown.sql` — behavioral-push trigger

**`adisyo_service_role_key`'i okuyan:**
- `supabase/migrations/20261013104028_adisyo_skip_external_orders.sql` — `fn_notify_adisyo_save_order` (en güncel tanım)
- `supabase/migrations/20261013101152_adisyo_trigger_branch_guard.sql` — aynı fonksiyonun önceki sürümü

**Anahtar KULLANMAYAN cron** (yalnız SQL, bilgi için):
- `adisyo-retry-failed` (`20260508000100_adisyo_retry_cron.sql`) — sadece `UPDATE orders`.

> **⚠️ Tek açık nokta — canlı doğrulama yapılamadı:** `mcp__supabase-prod__execute_sql`
> auto-mode politikası tarafından reddedildi (prod'a doğrudan SELECT için İlter'in onayı
> gerekiyor). Yukarıdaki tablo repo migration geçmişinden çıkarıldı. Canlıda migration'a
> girmemiş, **elle oluşturulmuş** bir cron/fonksiyonun gövdesine ham JWT gömülü OLMADIĞINI
> kanıtlamak için aşağıdaki salt-okunur sorgu çalıştırılmalı (Bölüm 4, "Ön doğrulama").

### 1b. Edge Functions (29 aktif)

Hepsi anahtarı ortam değişkeninden okur; repo'da değer yok. Kullanılan env ADLARI:
- `SUPABASE_SERVICE_ROLE_KEY` — service_role. Kullananlar (örnek): `adisyo-save-order`,
  `adisyo-sync-products`, `adisyo-status-forward`, `adisyo-webhook-receiver`, `adisyo-debug`,
  `macro-expiry`, `notify-order-status`, `order-alert`, `payment-verify`, `payment-init`,
  `paynkolay-callback`, `paynkolay-payment-init`, `paynkolay-query`, `paynkolay-refund`,
  `paynkolay-cards`, `free-order-complete`, `delete-account`, `apple-link-token`,
  `card-verification-refund-retry`, `tosla-payment-init`.
- `SUPABASE_ANON_KEY` — anon (kullanıcı JWT doğrulama / authed client). Kullananlar:
  `apple-link-token`, `delete-account`, `paynkolay-*`, `payment-init`, `free-order-complete`,
  `card-verification-refund-retry`.
- `SUPABASE_URL` — sabit, anahtar değil.

> Bu üç değişken Supabase platformu tarafından her edge function'a **otomatik enjekte**
> edilir. Legacy JWT devre dışı bırakılınca platformun enjekte ettiği değerlerin yeni
> anahtarlara dönüp dönmediği İlter tarafından `env-check` fonksiyonu ile doğrulanmalı
> (Bölüm 4). Eğer manuel olarak set edilmiş özel bir secret varsa, o elle güncellenir.

### 1c. Mobil uygulama (repo'da gömülü — yeni anahtar, legacy DEĞİL)

Zaten **yeni publishable** (`sb_publishable_…`) kullanıyor:
- `src/core/supabase.ts:5`, `src/lib/cards.ts:4`, `src/lib/payment.ts:7`,
  `src/modules/eatkcal/screens/PaymentScreen.tsx:49`
- Env değişkeni adı: `EXPO_PUBLIC_SUPABASE_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  (`app.config.js:100`, `scripts/*`). → Rotasyonda değişmez (publishable zaten yeni).

### 1d. Paneller / landing / tools

- **branch-panel** — `branch-panel/src/supabase.ts:13` env `VITE_SUPABASE_ANON_KEY`
  (+ `VITE_SUPABASE_URL`). Değer Vercel'de. Yeni publishable olmalı.
- **admin-panel** — submodule; bu worktree'de checkout edilmedi. Vercel env adları
  İlter tarafından admin-panel reposundan ayrıca doğrulanmalı (beklenen: `VITE_SUPABASE_*`
  veya `NEXT_PUBLIC_SUPABASE_*`). → SORULAR.
- **landing-page** — Supabase env kullanımı bulunamadı (statik).
- **tools/adisyo-prices/setup-adisyo-trigger.sql** — ESKİDEN satır 32'de ham legacy
  service_role JWT vardı. **Bu dalda placeholder ile değiştirildi** (Bölüm 3).
- `scripts/test-paynkolay-query.sh:24`, `scripts/test-paynkolay-refund.sh:22` — gömülü
  `sb_publishable_…` (yeni anon, zararsız; yine de ideal değil — SORULAR).

### 1e. Vercel ortam değişkeni ADLARI (değer yok)

Rotasyonda **yeni publishable** değere güncellenecek adlar:
- branch-panel: `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`
- admin-panel: (doğrulanacak) muhtemelen `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Hiçbir panel **service_role** kullanmıyor (iyi — service_role yalnız DB Vault + edge env'de).

---

## 2. "Vault'tan oku" migration'ı — durum

Item 2 gereği "gömülü anahtarı Vault'tan okuyan sürüme geçiren migration" **gerekmiyor**:
tüm DB tüketicileri zaten Vault'tan okuyor (Bölüm 1a, dosya referansları). Yani kod tarafı
hazır. Rotasyon = Vault secret'larının **değerini** değiştirmek + Dashboard/Vercel secret'ları.

Bu değer değişimi şema migration'ı değildir (secret değeri dosyaya yazılamaz), bu yüzden
`supabase/migrations/` ALTINA KONMADI. Bunun yerine otomatik push edilmeyen bir yardımcı:
- `supabase/migrations-manual/20261103T0000_rotate_vault_service_keys.sql` (+`_rollback.sql`)
  — placeholder'lı, idempotent `UPDATE vault.secrets`. Bölüm 5 adım 3'te kullanılır.

---

## 3. Repo temizliği (bu dalda yapıldı)

- `tools/adisyo-prices/setup-adisyo-trigger.sql:31` — ham legacy service_role JWT
  → `'PASTE_SECRET_KEY_HERE'` placeholder + "değeri commit'leme" uyarısı.

**Git geçmişinden temizleme (filter-repo) — ÖNERİLMEZ (bu gece):**
- Eski JWT commit `2c75997`'de duruyor. Repo **private** (`github.com/kcalculate-tr`).
- `git filter-repo` TÜM commit SHA'larını değiştirir → tüm worktree'ler/açık PR'lar/klonlar
  ve CI referansları bozulur; bu çok-worktree'li gece kurgusunda yüksek risk.
- **Doğru çözüm:** anahtarı geçmişten silmek yerine **rotasyonla değersizleştir** — legacy
  JWT Dashboard'dan devre dışı bırakılınca `2c75997`'deki değer artık çalışmaz, yani zaten
  ölü bir string olur. filter-repo'ya gerek kalmaz.
- İstenirse (opsiyonel, İlter kararı): rotasyon tamamlanıp legacy kapatıldıktan SONRA,
  ayrı ve koordineli bir bakım penceresinde geçmiş temizliği düşünülebilir — acil değil.

---

## 4. Doğrulama sorguları (salt-okunur — İlter çalıştırır)

### Ön doğrulama (rotasyon ÖNCESİ — envanteri kapat)
Canlıda migration dışı, gömülü ham JWT taşıyan cron/fonksiyon var mı?
```sql
-- (a) Fonksiyon gövdelerinde gömülü JWT / ham anahtar?  (değer dönmez, sadece ad)
SELECT n.nspname AS schema, p.proname AS func
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND pg_get_functiondef(p.oid) ~ 'eyJ[A-Za-z0-9_-]{6,}';
-- Beklenen: 0 satır. Satır dönerse o fonksiyonu Vault okuyan sürüme çevir.

-- (b) Tüm pg_cron işleri + komutlarında gömülü JWT var mı?
SELECT jobid, jobname, schedule, (command ~ 'eyJ[A-Za-z0-9_-]{6,}') AS has_embedded_jwt
FROM cron.job ORDER BY jobid;
-- Beklenen has_embedded_jwt: hepsi false. (Komut metnini TAM yazdırma — JWT içerebilir.)

-- (c) Beklenen Vault secret'ları mevcut mu? (değer açılmaz, sadece uzunluk)
SELECT name, length(decrypted_secret) AS len, updated_at
FROM vault.decrypted_secrets
WHERE name IN ('service_role_key','adisyo_service_role_key');
-- Beklenen: 2 satır, len > 0.
```

### Son doğrulama (rotasyon SONRASI — eski anahtarı kapatmadan ÖNCE)
```sql
-- pg_net son yanıtlar: cron/trigger çağrıları 2xx mı?
SELECT id, status_code, error_msg, created
FROM net._http_response ORDER BY id DESC LIMIT 20;
-- 401/403 = yeni anahtar bir yerde oturmadı → eski anahtarı KAPATMA.
```
- Edge functions: `env-check` fonksiyonunu çağır → `SUPABASE_SERVICE_ROLE_KEY` /
  `SUPABASE_ANON_KEY` yeni değerlere dönmüş mü (uzunluk/prefix, değer değil).
- Mobil: Simülatörde bir test siparişi + ödeme akışı; panel: giriş + sipariş listesi.

---

## 5. ROTASYON RUNBOOK (İlter — Dashboard adım adım)

> Sıra önemli: önce **yeni anahtarları her yere yerleştir**, **doğrula**, EN SON
> legacy anahtarı devre dışı bırak. Her adımda "ne bozulabilir" notu var.

**Adım 0 — Ön koşul.** Yedek mevcut (`.claude/backups/2026-11-02/`). Bölüm 4 "Ön
doğrulama" (a)(b)(c) çalıştır; (a)/(b) 0 satır değilse önce onları Vault'a çevir.
_Bozulma:_ yok (salt okunur).

**Adım 1 — Yeni secret key oluştur.** Dashboard → Project Settings → API Keys →
"Create new secret key" (`sb_secret_…`). Değeri parola yöneticisine koy. Publishable
(`sb_publishable_…`) zaten var.
_Bozulma:_ yok — yeni anahtar oluşturmak eskisini etkilemez.

**Adım 2 — Edge function secret'ları.** Dashboard → Edge Functions → Secrets:
`SUPABASE_SERVICE_ROLE_KEY` yeni `sb_secret_…` değerine; `SUPABASE_ANON_KEY` yeni
`sb_publishable_…` değerine (platform otomatik enjekte ediyorsa önce `env-check` ile
mevcut değeri doğrula, gerekiyorsa override et).
_Bozulma:_ Yanlış değer → ödeme/sipariş/adisyo edge fonksiyonları 401. Bu yüzden Adım 6'da
test, Adım 7'de kapatma.

**Adım 3 — Vault secret'ları.** SQL Editor →
`supabase/migrations-manual/20261103T0000_rotate_vault_service_keys.sql`'i yapıştır,
placeholder'lara yeni `sb_secret_…` yaz, çalıştır. İki secret (`service_role_key`,
`adisyo_service_role_key`) güncellenir.
_Bozulma:_ Yanlış/eksik değer → tüm cron'lar ve orders→adisyo trigger'ı 401 (sipariş Adisyo'ya
düşmez, bildirim gitmez). Rollback dosyası hazır.

**Adım 4 — Vercel env (paneller).** branch-panel (+ admin-panel) projelerinde
`VITE_SUPABASE_ANON_KEY` (ve varsa admin-panel'in anon adı) → yeni `sb_publishable_…`.
Kaydet + **redeploy** (env değişikliği build'e yeni deploy ile girer).
_Bozulma:_ Redeploy olmazsa panel eski değerle çalışmaya devam eder (sorun değil); ama legacy
kapatılınca eski değerli panel giriş yapamaz. Bu yüzden kapatmadan ÖNCE redeploy + test.

**Adım 5 — Mobil.** Publishable değişmediği için kod değişikliği gerekmez. (İleride EAS
ortam değişkeni `EXPO_PUBLIC_SUPABASE_KEY` yeni publishable'a eşit mi, kontrol.)
_Bozulma:_ yok (aynı publishable).

**Adım 6 — DOĞRULA (kapatmadan önce şart).** Bölüm 4 "Son doğrulama":
`net._http_response` son 20 kayıt 2xx; `env-check` yeni değerleri gösteriyor; simülatörde
test sipariş+ödeme; panelde giriş+liste. Hepsi yeşilse devam.
_Bozulma:_ Burada 401/403 görürsen DURMA noktası — eski anahtarı KAPATMA, hatalı adımı düzelt.

**Adım 7 — Legacy anahtarları devre dışı bırak.** Dashboard → API Keys → legacy `anon`
ve `service_role` (JWT) anahtarlarını "Disable". Bu an `2c75997`'deki geçmiş JWT dahil tüm
eski değerler ölür.
_Bozulma:_ Gözden kaçan bir tüketici hâlâ eski anahtarı kullanıyorsa o an kırılır — Adım 6'yı
atlamadıysan risk minimum. İlk 30 dk `net._http_response` ve Sentry'i izle.

**Adım 8 — İzleme (ilk 24 saat).** `net._http_response`'ta 401/403; edge function logları;
sipariş→Adisyo akışı; push bildirimleri.

### Geri dönüş planı
- Adım 2/3'ten sonra sorun + legacy HENÜZ KAPALI DEĞİL → Vercel/edge/Vault'u eski değere
  döndür (`_rollback.sql` Vault için; edge/Vercel'de eski değeri geri yaz), legacy hâlâ
  aktif olduğu için sistem çalışmaya devam eder.
- Adım 7'den (kapatma) sonra sorun → legacy anahtarı **yeniden etkinleştir** (mümkünse) VEYA
  yeni secret key'i doğru yere yerleştirip ileri git. Legacy silindiyse geri dönüş yoktur;
  bu yüzden "disable" (silme değil) tercih et ve birkaç gün öyle beklet.

---

## 6. SORULAR (İlter)
1. **Canlı DB salt-okunur onayı:** Bölüm 4 ön doğrulama (a)(b)(c)'yi ben çalıştırayım mı?
   (`execute_sql` auto-mode'da reddedildi.) Onay verirsen envanterin canlı teyidini tamamlarım.
2. **admin-panel** Vercel'deki Supabase env değişkeninin tam adı nedir (`VITE_` mi
   `NEXT_PUBLIC_` mi)? Submodule bu worktree'de yok.
3. `scripts/test-paynkolay-*.sh` içindeki gömülü `sb_publishable_` değerlerini de env'e mi
   taşıyalım (zararsız ama ideal değil)?
4. Geçmiş temizliği (filter-repo) İSTENİYOR mu? Önerim: hayır — rotasyon zaten değersizleştirir.
