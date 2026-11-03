-- G5-S1 — Keşfet (editoryal akış) temel tabloları + RLS + yardımcı fonksiyonlar.
-- Instagram gizlilik modeli: gizli hesap → yalnız onaylı takipçi; açık → herkes.
-- Dalga 1: yayın zamanına göre akış; puanlı sıralama / yanıt / sponsor / Besin Notu YOK.
-- NOT: staging'de test EDİLMEDİ — gece kuralları gereği yalnız DOSYA olarak yazıldı,
-- hiçbir yere uygulanmadı. Geriye uyumlu, kolon silme/yeniden adlandırma yok.
-- Rollback: 20261103020000_feed_tables_rollback.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 0) profiles sosyal kolonları (hesap-düzeyi gizlilik + @handle)             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Bu kolonlar sözleşmede (G5-CONTRACT.md) kayıt akışı olarak S2'ye ait; ancak
-- akış RLS'i `is_private`'a, FeedPost.author ise `handle`'a bağlı. Feed migration'ı
-- kendi başına uygulanabilsin diye IF NOT EXISTS ile savunmacı eklenir — S2 aynı
-- kolonları eklerse çakışmaz. `handle` benzersizliği/`claim_handle` S2'nindir;
-- burada yalnız okunur, UNIQUE index BİLEREK eklenmez.
alter table public.profiles add column if not exists is_private boolean not null default false;
alter table public.profiles add column if not exists handle      text;
alter table public.profiles add column if not exists bio         text;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1) creators — kim gönderi yazabilir (kurum + davetli diyetisyen/PT/mod)     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.creators (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  role        text        not null check (role in ('kurum', 'diyetisyen', 'pt', 'moderator')),
  verified_at timestamptz,                       -- doğrulandıysa dolu → FeedPost.verified
  can_post    boolean     not null default false, -- yetki: yalnız true olanlar yazar
  created_at  timestamptz not null default now()
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2) posts — editoryal gönderi                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.posts (
  id           uuid        primary key default gen_random_uuid(),
  author_id    uuid        not null references auth.users(id) on delete cascade,
  lang         text        not null check (lang in ('tr', 'en')),
  body         text        not null check (char_length(body) <= 1000),
  quote_of     uuid        references public.posts(id) on delete set null, -- alıntı (Dalga 1'de salt-gösterim)
  thread_root  uuid        references public.posts(id) on delete set null, -- dizi kökü
  thread_index int,                                                        -- dizi içindeki sıra (0-tabanlı)
  meal_card    jsonb,                                                      -- { name,kcal,protein_g,carbs_g,fat_g,portion_label,photo_url,product_id }
  pinned_until timestamptz,                                                -- bitiş tarihine kadar akışın en üstünde
  status       text        not null default 'published' check (status in ('published', 'hidden', 'removed')),
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3) post_media — Dalga 1'de yalnız görsel (video yok)                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.post_media (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.posts(id) on delete cascade,
  url      text not null,
  width    int,
  height   int,
  sort     int  not null default 0
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4) post_reactions — like/save (PK üçlü); sayaçlar sorguda hesaplanır        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.post_reactions (
  post_id    uuid        not null references public.posts(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  kind       text        not null check (kind in ('like', 'save')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5) follows — ONAYLI takip ilişkisi (gizli hesapta istek önce kabul edilir)  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.follows (
  follower_id  uuid        not null references auth.users(id) on delete cascade,
  following_id uuid        not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6) follow_requests — gizli hesaba bekleyen takip isteği                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.follow_requests (
  requester_id uuid        not null references auth.users(id) on delete cascade,
  target_id    uuid        not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (requester_id, target_id),
  check (requester_id <> target_id)
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7) user_blocks — engel (çift yönlü süzülür)                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
create table if not exists public.user_blocks (
  blocker_id uuid        not null references auth.users(id) on delete cascade,
  blocked_id uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8) content_reports — içerik şikayeti (post/user/day_card)                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- review_reports (yorum/feedback şikayeti) AYRI bir tablodur; ona dokunulmaz.
create table if not exists public.content_reports (
  id          bigserial   primary key,
  reporter_id uuid        not null references auth.users(id) on delete cascade,
  target_type text        not null check (target_type in ('post', 'user', 'day_card')),
  target_id   uuid        not null,                 -- FK yok: user/post/day_card ayrı kaynaklar
  reason      text        not null,
  status      text        not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)      -- aynı içeriği bir kez bildirir
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 9) post_meal_adds — "Günüme ekle" sayımı için bağ tablosu                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Sözleşme tablo listesinde adı geçmez; stats.adds (gönderi başına ekleme sayısı)
-- istemci-yazılamaz biçimde ancak gerçek bir kayıttan türetilebilsin diye eklenir.
-- add_post_meal_to_day hem meal_consumptions'a (gerçek günlük) hem buraya yazar.
-- Bkz. docs/night/G5-S1-FEED.md ve LOG > SORULAR.
create table if not exists public.post_meal_adds (
  consumption_id uuid        primary key references public.meal_consumptions(id) on delete cascade,
  post_id        uuid        not null references public.posts(id) on delete cascade,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  portion        numeric     not null default 1,
  created_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- İndeksler
-- ─────────────────────────────────────────────────────────────────────────────
-- Akış keyset'i (for_you): dil + yayın zamanı; imleç (published_at, id).
create index if not exists posts_feed_idx         on public.posts (lang, published_at desc, id desc) where status = 'published';
create index if not exists posts_author_idx       on public.posts (author_id, published_at desc);
create index if not exists posts_pinned_idx        on public.posts (pinned_until) where pinned_until is not null;
create index if not exists posts_thread_root_idx   on public.posts (thread_root) where thread_root is not null;
create index if not exists post_media_post_idx     on public.post_media (post_id, sort);
create index if not exists post_reactions_post_idx on public.post_reactions (post_id, kind);
create index if not exists post_reactions_user_idx on public.post_reactions (user_id);
create index if not exists follows_following_idx    on public.follows (following_id);
create index if not exists follow_requests_target_idx on public.follow_requests (target_id);
create index if not exists user_blocks_blocked_idx  on public.user_blocks (blocked_id);
create index if not exists content_reports_status_idx on public.content_reports (status, created_at desc);
create index if not exists post_meal_adds_post_idx  on public.post_meal_adds (post_id);
-- profiles.handle okuması (büyük/küçük harf duyarsız arama S2'de index ekleyebilir).

-- ═════════════════════════════════════════════════════════════════════════════
-- Yardımcı fonksiyonlar (hepsi security definer, set search_path = public)
-- ═════════════════════════════════════════════════════════════════════════════

-- İki kullanıcı arasında (her iki yönde) engel var mı?
create or replace function public.feed_is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- Kullanıcı gönderi yazabilir mi? (creators.can_post)
create or replace function public.feed_can_post(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.creators c where c.user_id = uid and c.can_post);
$$;

-- Kullanıcı moderatör mü?
create or replace function public.feed_is_moderator(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.creators c where c.user_id = uid and c.role = 'moderator');
$$;

-- viewer, author'ı görebilir mi? (açık hesap herkes; gizli hesap yalnız onaylı
-- takipçi/kendisi) VE aralarında engel yok. viewer null (anonim) ise yalnız açık.
create or replace function public.feed_can_view_author(viewer uuid, author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    not public.feed_is_blocked(coalesce(viewer, '00000000-0000-0000-0000-000000000000'::uuid), author)
    and (
      author = viewer
      or coalesce((select not p.is_private from public.profiles p where p.id = author), true)
      or (viewer is not null and exists (
            select 1 from public.follows f
            where f.follower_id = viewer and f.following_id = author))
    );
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RLS
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.creators        enable row level security;
alter table public.posts           enable row level security;
alter table public.post_media      enable row level security;
alter table public.post_reactions  enable row level security;
alter table public.follows         enable row level security;
alter table public.follow_requests enable row level security;
alter table public.user_blocks     enable row level security;
alter table public.content_reports enable row level security;
alter table public.post_meal_adds  enable row level security;

-- ── creators ────────────────────────────────────────────────────────────────
-- Herkes (authenticated) kimin üretici/doğrulanmış olduğunu okuyabilir (rozet).
-- Yazma yalnız moderatör; kullanıcı kendini üretici YAPAMAZ (bayrak yetki değildir).
drop policy if exists creators_select on public.creators;
create policy creators_select on public.creators
  for select to authenticated using (true);
drop policy if exists creators_mod_write on public.creators;
create policy creators_mod_write on public.creators
  for all to authenticated
  using (public.feed_is_moderator(auth.uid()))
  with check (public.feed_is_moderator(auth.uid()));

-- ── posts ─────────────────────────────────────────────────────────────────────
-- Okuma: yayımlanmış + yazar görülebilir (gizlilik) + engelsiz; VEYA kendi gönderisi;
-- VEYA moderatör (her şeyi görür).
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to authenticated using (
    author_id = auth.uid()
    or public.feed_is_moderator(auth.uid())
    or (status = 'published' and public.feed_can_view_author(auth.uid(), author_id))
  );
-- Yazma: yalnız can_post olan, kendi adına.
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert to authenticated
  with check (author_id = auth.uid() and public.feed_can_post(auth.uid()));
-- Güncelleme: kendi gönderisi (düzenleme) VEYA moderatör (status değiştirme).
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
  for update to authenticated
  using (author_id = auth.uid() or public.feed_is_moderator(auth.uid()))
  with check (author_id = auth.uid() or public.feed_is_moderator(auth.uid()));
-- Silme: kendi gönderisi VEYA moderatör.
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete to authenticated
  using (author_id = auth.uid() or public.feed_is_moderator(auth.uid()));

-- ── post_media ────────────────────────────────────────────────────────────────
-- Okuma: bağlı gönderi görülebiliyorsa. Yazma: gönderi sahibi (üretici).
drop policy if exists post_media_select on public.post_media;
create policy post_media_select on public.post_media
  for select to authenticated using (
    exists (
      select 1 from public.posts p
      where p.id = post_media.post_id
        and (
          p.author_id = auth.uid()
          or public.feed_is_moderator(auth.uid())
          or (p.status = 'published' and public.feed_can_view_author(auth.uid(), p.author_id))
        )
    )
  );
drop policy if exists post_media_write on public.post_media;
create policy post_media_write on public.post_media
  for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_media.post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_media.post_id and p.author_id = auth.uid())
              and public.feed_can_post(auth.uid()));

-- ── post_reactions ──────────────────────────────────────────────────────────────
-- Kullanıcı YALNIZ kendi tepkisini okur/değiştirir (başkasının tepkisi görünmez;
-- sayımlar RPC ile). Yazma yalnız görülebilir gönderiye.
drop policy if exists post_reactions_rw on public.post_reactions;
create policy post_reactions_rw on public.post_reactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id = post_reactions.post_id
        and p.status = 'published'
        and public.feed_can_view_author(auth.uid(), p.author_id)
    )
  );

-- ── follows ───────────────────────────────────────────────────────────────────
-- Kendi grafiğini (takip ettikleri + takipçileri) okur; yalnız kendi takibini kurar/bozar.
drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows
  for select to authenticated using (follower_id = auth.uid() or following_id = auth.uid());
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows
  for insert to authenticated
  with check (follower_id = auth.uid() and not public.feed_is_blocked(auth.uid(), following_id));
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows
  for delete to authenticated using (follower_id = auth.uid());

-- ── follow_requests ─────────────────────────────────────────────────────────────
-- İstek sahibi veya hedef okur; istek sahibi kurar/iptal eder; hedef reddeder (siler).
drop policy if exists follow_requests_select on public.follow_requests;
create policy follow_requests_select on public.follow_requests
  for select to authenticated using (requester_id = auth.uid() or target_id = auth.uid());
drop policy if exists follow_requests_insert on public.follow_requests;
create policy follow_requests_insert on public.follow_requests
  for insert to authenticated
  with check (requester_id = auth.uid() and not public.feed_is_blocked(auth.uid(), target_id));
drop policy if exists follow_requests_delete on public.follow_requests;
create policy follow_requests_delete on public.follow_requests
  for delete to authenticated using (requester_id = auth.uid() or target_id = auth.uid());

-- ── user_blocks ─────────────────────────────────────────────────────────────────
drop policy if exists user_blocks_rw on public.user_blocks;
create policy user_blocks_rw on public.user_blocks
  for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

-- ── content_reports ───────────────────────────────────────────────────────────
-- Kullanıcı yalnız kendi adına şikayet EKLER; moderatör okur. Normal kullanıcı okuyamaz.
drop policy if exists content_reports_insert on public.content_reports;
create policy content_reports_insert on public.content_reports
  for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists content_reports_mod_select on public.content_reports;
create policy content_reports_mod_select on public.content_reports
  for select to authenticated using (public.feed_is_moderator(auth.uid()));

-- ── post_meal_adds ──────────────────────────────────────────────────────────────
-- Kullanıcı kendi eklemelerini okur (sayım RPC ile). Yazma RPC (definer) üzerinden.
drop policy if exists post_meal_adds_select on public.post_meal_adds;
create policy post_meal_adds_select on public.post_meal_adds
  for select to authenticated using (user_id = auth.uid());
drop policy if exists post_meal_adds_insert on public.post_meal_adds;
create policy post_meal_adds_insert on public.post_meal_adds
  for insert to authenticated with check (user_id = auth.uid());

-- Yardımcı fonksiyonların EXECUTE yetkisi (anon kapalı).
revoke all on function public.feed_is_blocked(uuid, uuid)        from public, anon;
revoke all on function public.feed_can_post(uuid)                from public, anon;
revoke all on function public.feed_is_moderator(uuid)            from public, anon;
revoke all on function public.feed_can_view_author(uuid, uuid)   from public, anon;
grant execute on function public.feed_is_blocked(uuid, uuid)      to authenticated;
grant execute on function public.feed_can_post(uuid)             to authenticated;
grant execute on function public.feed_is_moderator(uuid)         to authenticated;
grant execute on function public.feed_can_view_author(uuid, uuid) to authenticated;
