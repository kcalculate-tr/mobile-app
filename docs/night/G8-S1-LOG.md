# G8-S1 — Sunucu: açık paylaşım, yorum, etkinlik, bildirim, AI denetim · LOG

## Özet (10 satır)
1. Dal `night8/social-backend` (taban `night7/release`), worktree `.claude/worktrees/g8-s1`. Yalnız sunucu dosyaları; hiçbir yere uygulanmadı/deploy edilmedi (gece kuralı).
2. Ana migration `20261104002000_g8_social.sql` (+ rollback): bayrak tohumları (5 bayrak, hepsi KAPALI), `posts`/`post_media`/`content_reports` kolon+CHECK genişletmeleri, yeni tablolar `activity_logs/post_comments/social_notifications/moderation_queue` + RLS, G8-CONTRACT'taki tüm RPC'ler, tetikleyiciler, `get_feed` genişletmesi.
3. `activity_kcal(type,minutes,weight)` = MET × kilo × saat; MET tablosu fonksiyonda sabit; kilo `user_nutrition_profiles.weight` (yoksa 70); sonuç her zaman tahmini.
4. Sosyal bildirim: 8 tür için tetikleyiciler + BEFORE INSERT **guard** (kendine yok, çift yönlü engel, aynı aktör+tür+gönderi 1 saatte tek satır = hız sınırı). Push: AFTER INSERT → `send-notification` (by_content, category `behavioral`); `sosyal_bildirim` KAPALIYKEN net'e hiç ulaşılmaz; sipariş bildirimlerine dokunulmadı.
5. Yayın yetkisi (`create_post`): `kesfet_paylasim` sunucuda (`feature_flags.enabled`) okunur; kapalıyken yalnız `creators.can_post`. Hız sınırı: günde 10 (hesap <24s ise 3) → aşılırsa `{error:'rate_limited'}`.
6. Edge function `supabase/functions/moderate-content/index.ts` (yalnız dosya): `analyze-ai-scan` stili, Anthropic Messages API, `AI_MODERATION_MODEL ?? 'claude-haiku-5-5'`. allow→published, bloke→pending+sistem şikayeti (risk 3/2/1), hata/timeout→pending+`ai:unavailable` risk 1. Fitness istisnası (mayo/spor/beden fotoğrafı tek başına ihlal değil) talimatta açık.
7. pg_cron yeniden deneme ayrı migration `20261104002100_g8_moderation_cron.sql` (+ rollback); iş adı `moderate_pending_retry`, her 5 dk, 10 dk'dan eski `pending` hedefleri en fazla 3 kez (attempts cron'da artar).
8. `post-media` kovası: video (mp4/mov) + ≤50 MB; yol `posts/{uid}/...`; yazma `kesfet_paylasim` açıkken herkes kendi klasörüne, kapalıyken yalnız `can_post`.
9. Panel RPC'leri (yalnız `admin_allowlist`): `admin_list_posts`, `admin_delete_draft_post` (yalnız planlı/`pending`; yayındakini silmez — şikayet kuyruğundan kaldırılır). `mod_list_reports`/`mod_resolve_report` yorum + AI hedeflerini kapsar.
10. Kontrol: `deno check` moderate-content **0 hata**; SQL `$$`/`begin`-`commit` pariteleri dengeli, elle gözden geçirildi (yerel Postgres yok → çalıştırılmadı). `feed_rls_test.sql` **21 senaryoya** çıkarıldı (T16–T21 G8); staging erişimi olmadığı için koşulmadı. SORULAR aşağıda — hiçbiri teslimi bloklamıyor.

## Yapılanlar (madde madde)

### 1 — Ana migration `20261104002000_g8_social.sql`
- **Bayraklar** (tohum, KAPALI): `kesfet_paylasim, kesfet_video, kesfet_yorum, etkinlik, sosyal_bildirim`.
- **posts**: `post_type` (serbest|ogun|etkinlik, default ogun), `activity_card jsonb`, `status` CHECK'ine `pending` (hidden korundu), `idempotency_key` + partial unique `(author_id, idempotency_key)`.
- **post_media**: `kind` (image|video, default image), `duration_s`, `thumb_path`, `frame_paths text[]`.
- **content_reports**: `target_type += 'comment'`; `reporter_id` nullable + `source` (user|ai) + partial unique `(target_type,target_id) where source='ai'` (AI şikayeti hedef başına tek).
- **activity_logs** (yeni): owner-only RLS, `unique (user_id, source, source_ref)`.
- **post_comments** (yeni): tek seviye (`parent_id`), `body ≤ 500`, `status` (pending|published|removed); RLS: gönderiyi+yazarı görebilen okur (gizli/engel süzülür), kendi `pending`'ini görür.
- **social_notifications** (yeni): yalnız alıcı okur; yazma tetikleyici/RPC (definer).
- **moderation_queue** (yeni): AI denetim kuyruğu + `attempts`; yalnız moderatör/admin okur.
- **Yardımcılar**: `feed_flag_enabled` (storage RLS için `authenticated`'a GRANT), `activity_kcal`, `social_notify` (ikincisi yalnız tetikleyici içinden — authenticated'a verilmez).
- **Tetikleyiciler**: `post_reactions`(like), `post_comments`(comment/reply), `follows`(follow / `app.follow_accept` bayrağıyla follow_accept), `follow_requests`(follow_request), `post_meal_adds`(add_to_day), `activity_logs`(did_it); `social_notifications` BEFORE guard + AFTER push.
- **RPC'ler** (hepsi definer, search_path=public, yalnız authenticated): `create_post, delete_my_post, add_comment, list_comments, delete_my_comment, did_it, log_activity, get_my_day_activity, list_social_notifications, mark_social_notifications_read`.
- **create or replace (geriye uyumlu genişletme)**: `get_feed` (ek: post_type, activity_card, media.kind/duration_s/thumb_path, stats.comments/did_it, status; kendi pending'i "İnceleniyor"), `mod_list_reports` (comment önizleme + AI şikayetleri), `mod_resolve_report` (comment remove), `respond_follow_request`/`set_profile_privacy` (follow_accept bayrağı; g7 `app.profile_rpc` bloğu aynen taşındı).
- **Panel**: `admin_list_posts(p_author, p_status, p_cursor)`, `admin_delete_draft_post(p_post)`.
- **Storage**: `post-media` kovası 50 MB + video mime; yazma politikaları `kesfet_paylasim` veya `can_post`.

### 2 — Edge function `moderate-content` (+ `deno.json`)
- POST `{target_type:'post'|'comment', target_id}`. Yetki: iç çağrı (service_role) **veya** hedefin yazarı olan kullanıcı. Service-role ile hedefi okur; gönderide görseller (+ video `frame_paths`) + metin, yorumda metin.
- Anthropic Messages API; JSON `{allow, categories, confidence}`. Karar → `posts/post_comments.status` + `content_reports` (AI) + `moderation_queue.status='done'`. Nihai karar yoksa (hata/timeout/parse) `ai:unavailable` + kuyruk `pending` kalır (cron yeniden dener).

### 3 — Yeniden deneme cron `20261104002100_g8_moderation_cron.sql`
- `fn_moderate_pending_retry()` (Vault `service_role_key` → `net.http_post` moderate-content). `cron.schedule('moderate_pending_retry','*/5 * * * *', …)`. Tik başına en fazla 50 hedef; attempts cron'da artırılır (edge erişilemese bile 3 sınırı tutar).

### 4 — Test `feed_rls_test.sql` (T16–T21)
- T16 pending yalnız yazara görünür · T17 did_it idempotent + kcal tahmini · T18 kendine bildirim yok (guard) · T19 gizli hesabın yorumu süzülür · T20 engelli yorum yapamaz · T21 gönderi hız sınırı (yeni hesap 3/gün). Yeni fixture kullanıcı F (üretici).

### 5 — Dokümanlar
- `G6-APPLY.md`: #12/#13 satırları + uygulama notu (sıra, ezilen gövdeler), moderate-content edge bölümü, test 21 senaryo + G8 bayrakları.

## Kontrol sonuçları
- `deno check --config deno.json index.ts` (moderate-content) → **0 hata**.
- SQL dosyaları: `$$` pariteleri çift, tek `begin;`/`commit;` sarmalayıcı; elle gözden geçirildi. **Yerel Postgres/staging olmadığı için migration ÇALIŞTIRILMADI** (gece kuralı: yalnız dosya).
- `feed_rls_test.sql` 21 senaryo; **koşulmadı** (staging erişimi yok).

## SORULAR / Kararlar
1. **Push yolu (karar)**: `social_notifications` kalıcı kayıt/kuyruk; push AFTER INSERT tetikleyici → mevcut `send-notification` (by_content, category `behavioral`), `fn_notify_review_reply` deseniyle birebir (best-effort, hata yutulur). Daha ağır bir cron-sweep düşünüldü; "en az riskli + mevcut gönderici" için tetikleyici seçildi. `sosyal_bildirim` kapalıyken `net.http_post`'a hiç ulaşılmaz.
2. **AI sistem şikayeti şeması**: `content_reports.reporter_id` nullable + `source='ai'` + partial unique (hedef başına tek AI satırı). `mod_list_reports`/`mod_resolve_report` bunları kapsıyor (reason=`ai:<kategori>`). Mevcut kullanıcı unique'i (`reporter_id,target_type,target_id`) korundu.
3. **add_comment sunucu bayrağı**: `create_post` sözleşme §2 gereği `kesfet_paylasim` ile gate'li; `add_comment` için sözleşmede sunucu bayrak kapısı belirtilmedi → eklenmedi. Bayraklar istemci UI'ını kapatır, RPC'ler çağrılmadığı için davranış değişmez. Onay İlter'e.
4. **did_it anahtarı**: `source_ref = p_post` (gönderi başına tek kayıt → doğal idempotent). İmzadaki `p_idempotency_key` kabul edilir ama kayıt anahtarı post'tur (test T17 idempotency'yi doğrular).
5. **_shared yardımcı**: AI için paylaşılan yardımcı yok; `analyze-ai-scan` gibi `moderate-content` de kendi içinde (CORS/json/base64/extractJson desenleri aynen).
6. **post-media boyut**: kova `file_size_limit` tek değer → 50 MB (video tavanı); görsel ≤5 MB sınırı istemcide uygulanır.

## İlter'in yapacakları

### A) Canlı DB (elle, `supabase db push` DEĞİL — bkz. G6-APPLY.md)
1. #1–#11 uygulandıktan SONRA **#12** `20261104002000_g8_social.sql`.
2. **#13** `20261104002100_g8_moderation_cron.sql` — yalnız `moderate-content` deploy edildikten ve Vault'ta `service_role_key` olduktan sonra anlamlı.
3. Geri alma: önce `…002100…_rollback.sql` (cron), sonra `…002000…_rollback.sql`. `get_feed/mod_*/set_profile_privacy/respond_follow_request` için önceki migration'lar yeniden koşulmalı (rollback dosyasında not var).

### B) Edge function (ayrı deploy)
`supabase functions deploy moderate-content`. Secret'lar: `ANTHROPIC_API_KEY` (zorunlu), `AI_MODERATION_MODEL` (geçerli canlı model kimliğine set et — dosyadaki `claude-haiku-5-5` yer tutucu).

### C) Test + dalga
`supabase/tests/feed_rls_test.sql` staging'de koş (21 senaryo; FK'ler için auth kullanıcıları Auth Admin API ile). Bayrak açılışı (`kesfet_paylasim, kesfet_video, kesfet_yorum, etkinlik, sosyal_bildirim`) senin dalga planı kararın — hepsi KAPALI, davranış değişmez.

İlgili: G8-CONTRACT.md (`.claude/night/G8-CONTRACT.md`), [G6-APPLY.md](./G6-APPLY.md), [G7-S1-LOG.md](./G7-S1-LOG.md).
