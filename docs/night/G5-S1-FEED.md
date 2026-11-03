# G5-S1 — Keşfet sunucusu (Dalga 1, editoryal akış) tasarım notu

Instagram gizlilik modeli. Gizli hesap → yalnız onaylı takipçi; açık → herkes. Dalga 1 basit:
yayın zamanına göre akış; puanlı sıralama, yanıt, sponsor, Besin Notu YOK; medya yalnız görsel.
Tüm RPC'ler `security definer`, `set search_path = public`, yalnız `authenticated`, `auth.uid()` ile.
**Staging'de test edilmedi** — her şey yalnız DOSYA (migration + rollback), hiçbir yere uygulanmadı.

## Tablolar
| tablo | amaç | anahtar alanlar |
|---|---|---|
| `creators` | kim gönderi yazar | PK user_id→auth.users, role(kurum/diyetisyen/pt/moderator), verified_at, can_post |
| `posts` | editoryal gönderi | id, author_id, lang(tr/en), body≤1000, quote_of, thread_root, thread_index, meal_card jsonb, pinned_until, status(published/hidden/removed), published_at |
| `post_media` | görsel | post_id, url, width, height, sort |
| `post_reactions` | like/save | **PK (post_id,user_id,kind)** |
| `follows` | onaylı takip | PK (follower_id,following_id) |
| `follow_requests` | gizliye bekleyen istek | PK (requester_id,target_id) |
| `user_blocks` | engel (çift yönlü) | PK (blocker_id,blocked_id) |
| `content_reports` | post/user/day_card şikayeti | reporter_id, target_type, target_id, reason, status; `review_reports`'tan AYRI |
| `post_meal_adds` *(sözleşme dışı ek)* | stats.adds sayımı | PK consumption_id→meal_consumptions, post_id, user_id, portion |

`profiles`'a savunmacı (IF NOT EXISTS) eklenenler: `is_private`(RLS için), `handle`, `bio` — sözleşmede S2'nin;
`handle` benzersizliği/`claim_handle` S2'de. Tüm FK'ler `on delete cascade` (hesap silinince satırlar gider).
İstatistik sayaç kolonu YOK → istemci sayaç yazamaz; likes/saves/adds sorguda `count()` ile.

## Yetki matrisi (okuma R / yazma W)
| nesne | anonim | kullanıcı | üretici (can_post) | moderatör |
|---|---|---|---|---|
| yayımlanmış gönderi (açık yazar) | – (RPC yalnız authenticated) | R | R + kendi W | R hepsi + status W |
| yayımlanmış gönderi (gizli yazar) | – | yalnız onaylı takipçi R | +kendi W | R + status W |
| post_media | – | bağlı gönderi görünürse R | kendi gönderisine W | R |
| post_reactions | – | yalnız KENDİ R/W | = | = |
| follows / follow_requests | – | kendi grafiği R/W | = | = |
| user_blocks | – | kendi R/W | = | = |
| content_reports | – | yalnız INSERT (kendi) | = | R (moderasyon) |
| creators | – | R (rozet) | R | R/W (üretici atama) |

Engellenen kullanıcıların içeriği `feed_can_view_author()` ile her listeden çift yönlü süzülür.
Yetki SUNUCUDA: gönderi yazma yalnız `creators.can_post` (bayrak değil); kullanıcı kendini üretici yapamaz.

## İndeksler
- `posts(lang, published_at desc, id desc) where status='published'` — for_you keyset `(pin,published_at,id)`
- `posts(author_id, published_at desc)` — following / profil; `posts(pinned_until) where not null`; `posts(thread_root)`
- `post_media(post_id, sort)` · `post_reactions(post_id, kind)` + `(user_id)` · `follows(following_id)`
- `follow_requests(target_id)` · `user_blocks(blocked_id)` · `content_reports(status, created_at desc)` · `post_meal_adds(post_id)`

## RPC imzaları (sözleşme ile birebir → S3 bunlara kodlar)
`get_feed(p_tab,p_lang,p_cursor default null,p_limit default 20)→{items:FeedPost[],next_cursor}` ·
`react_post(p_post,p_kind,p_on)→{stats,me}` ·
`add_post_meal_to_day(p_post,p_meal_type,p_portion default 1,p_idempotency_key)→{consumption_id}` *(bkz. nüans ↓)* ·
`report_content(p_target_type,p_target,p_reason)→void` · `block_user(p_user,p_on)→void` ·
`follow(p_user,p_on)→{state:'following'|'requested'|'none'}` · `respond_follow_request(p_requester,p_accept)→void`.

**İmza nüansları (S3 bilsin):**
- `FeedPost.quote.author` tekil string değil, **nesne** `{id,display_name,handle}`. `meal_type` değerleri mevcut
  günlükle aynı: `kahvalti|ogle|aksam|atistirma`. `imleç` opaktır (base64 `pin|epoch_us|id`), S3 ilet-geri ver.
- `add_post_meal_to_day`: Postgres, default'lı `p_portion`'dan sonra default'suz parametreye izin vermez; bu yüzden
  `p_idempotency_key text default null` verildi ama **zorunludur** (null/boş reddedilir). Ad/tür/sıra sözleşmeyle aynı.
- Idempotency: `meal_consumptions(user_id, source='post', source_ref=p_idempotency_key)` mevcut benzersizliğiyle;
  aynı anahtar yeni satır açmaz, aynı `consumption_id` döner. O anki besin değerleri porsiyonla ölçeklenip saklanır.

## Medya kovası
`post-media`: public okuma; yazma yalnız `can_post` üretici, kendi klasörüne `posts/{auth.uid()}/...`;
tür jpeg/png/webp/heic, boyut ≤ 5 MB (`20261103020200_post_media_storage.sql`).

## Tohum & test
`supabase/seed/feed_seed.sql`: "Kcalculate" kurum hesabı + 20 TR / 10 EN gönderi; meal_card'lar gerçek
`products` satırlarından SELECT ile (sayı uydurulmaz), beden fotoğrafı yok.
`supabase/tests/feed_rls_test.sql`: A(gizli üretici)/B/C ile 10 senaryo; tamamı `begin … rollback`.
