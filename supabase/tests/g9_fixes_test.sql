-- G9-S1 — Düzeltme testleri (3b, 3c, 3d, 3e, 3f, 3g, 3h, 3j). Sunucu tarafı.
-- (3a = istemci kova/yol → src/modules/kesfet/__tests__/g9.test.ts; 3i = istemci
--  MET → aynı dosya; burada SQL yok.)
--
-- Çalıştırma: psql ... -f g9_fixes_test.sql  (tamamı BEGIN ... ROLLBACK içinde;
-- kalıcı veri bırakmaz). NOT: staging'de test EDİLMEDİ — yalnız dosya (gece kuralı).
-- Başarı: sonuna kadar hatasız gelir ve "TUM G9 TESTLERI GECTI" yazar; bir beklenti
-- tutmazsa RAISE EXCEPTION ile durur.
-- Önkoşul: 20261105000100_g9_fixes.sql + tüm G6-APPLY zinciri uygulanmış olmalı.
-- ═════════════════════════════════════════════════════════════════════════════
begin;

\set A  '''a9990000-0000-4000-8000-000000000001'''   -- üretici (can_post) + gizli
\set B  '''b9990000-0000-4000-8000-000000000002'''   -- normal kullanıcı
\set C  '''c9990000-0000-4000-8000-000000000003'''   -- A'yı takip eden
\set M  '''e9990000-0000-4000-8000-000000000005'''   -- moderatör + admin
\set PP '''a9990000-0000-4000-8000-000000000010'''   -- A'nın pending gönderisi
\set CC '''a9990000-0000-4000-8000-000000000020'''   -- A'nın pending yorumu (C'nin gönderisinde)
\set PC '''c9990000-0000-4000-8000-000000000030'''   -- C'nin yayımlanmış gönderisi
\set MCID '''a9990000-0000-4000-8000-000000000040''' -- A'nın öğün tüketimi (gün kartı)
\set DSID '''a9990000-0000-4000-8000-000000000050''' -- A'nın day_share'i

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, encrypted_password)
values
  ('00000000-0000-0000-0000-000000000000', :A, 'authenticated','authenticated','a9_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}',''),
  ('00000000-0000-0000-0000-000000000000', :B, 'authenticated','authenticated','b9_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}',''),
  ('00000000-0000-0000-0000-000000000000', :C, 'authenticated','authenticated','c9_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}',''),
  ('00000000-0000-0000-0000-000000000000', :M, 'authenticated','authenticated','m9_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}','')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, handle, is_private, created_at) values
  (:A, 'A Uretici', 'a9user', true,  now()),   -- GİZLİ
  (:B, 'B Normal',  'b9user', false, now()),
  (:C, 'C Takipci', 'c9user', false, now()),
  (:M, 'M Mod',     'm9user', false, now())
on conflict (id) do nothing;

insert into public.creators (user_id, role, verified_at, can_post)
values (:A, 'diyetisyen', now(), true),
       (:M, 'moderator',  now(), false)
on conflict (user_id) do nothing;

-- M admin (admin_create_post + is_admin için).
insert into public.admin_allowlist (user_id) values (:M) on conflict do nothing;

-- C, A'yı takip ediyor (onaylı) → C, A'nın içeriğini görebilir.
insert into public.follows (follower_id, following_id) values (:C, :A) on conflict do nothing;

-- A'nın pending gönderisi (dismiss→published + posts guard testleri).
insert into public.posts (id, author_id, lang, body, post_type, status, published_at)
values (:PP, :A, 'tr', 'A incelenen gonderi', 'serbest', 'pending', now())
on conflict (id) do nothing;

-- C'nin yayımlanmış gönderisi (yorum testleri zemini).
insert into public.posts (id, author_id, lang, body, post_type, status, published_at)
values (:PC, :C, 'tr', 'C acik gonderi', 'serbest', 'published', now())
on conflict (id) do nothing;

-- A'nın PC üzerine pending yorumu (dismiss→published yorum testi).
insert into public.post_comments (id, post_id, author_id, body, status)
values (:CC, :PC, :A, 'A pending yorum', 'pending')
on conflict (id) do nothing;

-- A'nın öğün tüketimi + day_share (3b gün kartı görünürlüğü).
insert into public.meal_consumptions (id, user_id, name, meal_type, calories, protein, carbs, fat, source, photo_path, consumed_at)
values (:MCID, :A, 'Test Ogun', 'ogle', 500, 30, 40, 20, 'manual', 'a9990000-0000-4000-8000-000000000001/day/x.jpg', now())
on conflict (id) do nothing;
insert into public.day_shares (id, user_id, consumption_id, expires_at, created_at)
values (:DSID, :A, :MCID, now() + interval '24 hours', now())
on conflict (id) do nothing;

-- kesfet_yorum bayrağı (3g). Başta KAPALI.
insert into public.feature_flags (key, enabled) values ('kesfet_yorum', false)
on conflict (key) do update set enabled = false;

set local role authenticated;

-- ============================ 3d: handle Instagram kuralı ====================
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
begin
  -- Nokta içeren ad artık GEÇERLİ (eski regex reddediyordu).
  if (public.check_handle('john.doe')->>'available') <> 'true' then
    raise exception 'FAIL 3d: john.doe uygun olmaliydi';
  end if;
  -- Ardışık nokta → format.
  if (public.check_handle('a..b')->>'reason') <> 'format' then
    raise exception 'FAIL 3d: a..b format reddi beklenirdi';
  end if;
  -- Başta nokta → format.
  if (public.check_handle('.abc')->>'reason') <> 'format' then
    raise exception 'FAIL 3d: .abc format reddi beklenirdi';
  end if;
  -- 31 karakter → format (3–30).
  if (public.check_handle(repeat('a',31))->>'reason') <> 'format' then
    raise exception 'FAIL 3d: 31 karakter format reddi beklenirdi';
  end if;
  -- 30 karakter → uygun.
  if (public.check_handle(repeat('a',30))->>'available') <> 'true' then
    raise exception 'FAIL 3d: 30 karakter uygun olmaliydi';
  end if;
  raise notice 'OK 3d: handle Instagram kurali (nokta izinli, edge/ardisik yok, 3-30)';
end $$;

-- ============================ 3e: carb_g → carbs_g ===========================
select set_config('request.jwt.claims', json_build_object('sub', :M, 'role','authenticated')::text, true);
do $$
declare v_post uuid; v_mc jsonb;
begin
  v_post := (public.admin_create_post(
    'a9990000-0000-4000-8000-000000000001'::uuid, 'Panel gonderi', 'tr', null,
    jsonb_build_object('name','Panel Ogun','kcal',400,'protein_g',20,'carb_g',55,'fat_g',10)
  )->>'post_id')::uuid;
  select meal_card into v_mc from public.posts where id = v_post;
  if not (v_mc ? 'carbs_g') or (v_mc->>'carbs_g') <> '55' then
    raise exception 'FAIL 3e: carbs_g=55 bekleniyordu (meal_card=%)', v_mc;
  end if;
  if v_mc ? 'carb_g' then
    raise exception 'FAIL 3e: carb_g anahtari kalmamaliydi (meal_card=%)', v_mc;
  end if;
  raise notice 'OK 3e: admin_create_post carb_g -> carbs_g normalize etti';
end $$;

-- ============================ 3f: dismiss → published ========================
select set_config('request.jwt.claims', json_build_object('sub', :M, 'role','authenticated')::text, true);
do $$
declare v_rep bigint; v_repc bigint; v_status text;
begin
  -- pending gönderiye AI sistem şikayeti.
  insert into public.content_reports (target_type, target_id, reason, status, source, reporter_id)
  values ('post', 'a9990000-0000-4000-8000-000000000010', 'ai:other', 'open', 'ai', null)
  returning id into v_rep;
  perform public.mod_resolve_report(v_rep, 'dismiss', 'uygun');
  select status into v_status from public.posts where id = 'a9990000-0000-4000-8000-000000000010';
  if v_status <> 'published' then
    raise exception 'FAIL 3f: dismiss sonrasi gonderi published olmaliydi (status=%)', v_status;
  end if;

  -- pending yoruma şikayet → dismiss → published.
  insert into public.content_reports (target_type, target_id, reason, status, source, reporter_id)
  values ('comment', 'a9990000-0000-4000-8000-000000000020', 'ai:other', 'open', 'ai', null)
  returning id into v_repc;
  perform public.mod_resolve_report(v_repc, 'dismiss', 'uygun');
  select status into v_status from public.post_comments where id = 'a9990000-0000-4000-8000-000000000020';
  if v_status <> 'published' then
    raise exception 'FAIL 3f: dismiss sonrasi yorum published olmaliydi (status=%)', v_status;
  end if;
  raise notice 'OK 3f: mod_resolve_report(dismiss) pending hedefi published yapti';
end $$;

-- ============================ 3g: add_comment bayrak kapisi ==================
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
declare v_cid jsonb;
begin
  -- Bayrak KAPALI → reddedilmeli.
  begin
    perform public.add_comment('c9990000-0000-4000-8000-000000000030'::uuid, 'merhaba', null, 'idem-g7-1');
    raise exception 'FAIL 3g: bayrak kapaliyken add_comment gecti';
  exception
    when sqlstate '42501' then raise notice 'OK 3g-a: bayrak kapali -> add_comment reddetti';
  end;
end $$;

-- Bayrağı aç, tekrar dene → kabul.
select set_config('request.jwt.claims', json_build_object('sub', :M, 'role','authenticated')::text, true);
update public.feature_flags set enabled = true where key = 'kesfet_yorum';
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
declare v_res jsonb;
begin
  v_res := public.add_comment('c9990000-0000-4000-8000-000000000030'::uuid, 'merhaba', null, 'idem-g7-2');
  if (v_res->>'status') <> 'pending' then
    raise exception 'FAIL 3g: bayrak acikken yorum pending olmaliydi (res=%)', v_res;
  end if;
  raise notice 'OK 3g-b: bayrak acik -> add_comment pending olusturdu';
end $$;
-- Bayrağı tekrar kapat (yan etki bırakma).
select set_config('request.jwt.claims', json_build_object('sub', :M, 'role','authenticated')::text, true);
update public.feature_flags set enabled = false where key = 'kesfet_yorum';

-- ============================ 3c: posts status korumasi ======================
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
begin
  -- A kendi pending gönderisini DOĞRUDAN published yapamaz (guard).
  begin
    update public.posts set status = 'published'
     where id = 'a9990000-0000-4000-8000-000000000010';
    raise exception 'FAIL 3c: yazar status degistirebildi';
  exception
    when others then
      if sqlerrm like 'FAIL 3c%' then raise; end if;
      raise notice 'OK 3c-a: yazar status degistiremedi (guard)';
  end;
  -- A body güncelleyebilir (korunan kolon değil).
  update public.posts set body = 'A guncel metin'
   where id = 'a9990000-0000-4000-8000-000000000010';
  raise notice 'OK 3c-b: yazar body guncelleyebildi';
  -- delete_my_post işlem-yerel bayrakla status='removed' yapar.
  perform public.delete_my_post('a9990000-0000-4000-8000-000000000010'::uuid);
  if (select status from public.posts where id = 'a9990000-0000-4000-8000-000000000010') <> 'removed' then
    raise exception 'FAIL 3c: delete_my_post status=removed yapmaliydi';
  end if;
  raise notice 'OK 3c-c: delete_my_post (app.post_rpc bayragi) status=removed yapti';
end $$;

-- ============================ 3h: get_user_day_progress yetki ================
-- B (A'yı takip ETMİYOR, A gizli) → başkasının ilerlemesini okuyamaz.
-- NOT: fonksiyon authenticated'a GRANT edilmediği için doğrudan çağrı zaten
-- insufficient_privilege verir; burada SECURITY DEFINER zincir güvenliğini
-- (feed_can_view_author kapısı) ayrı bir definer sarmalla doğrularız.
create or replace function pg_temp.g9_probe_progress(p_uid uuid) returns jsonb
language sql security definer set search_path = public as $probe$
  select public.get_user_day_progress(p_uid);
$probe$;
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
begin
  begin
    perform pg_temp.g9_probe_progress('a9990000-0000-4000-8000-000000000001'::uuid);
    raise exception 'FAIL 3h: B, A''nin ilerlemesini okuyabildi';
  exception
    when sqlstate '42501' then raise notice 'OK 3h-a: gorunmeyen kullanicinin ilerlemesi okunamadi';
  end;
  -- Kendi ilerlemesi her zaman okunur.
  perform pg_temp.g9_probe_progress('b9990000-0000-4000-8000-000000000002'::uuid);
  raise notice 'OK 3h-b: kullanici kendi ilerlemesini okudu';
end $$;
-- C (A'nın onaylı takipçisi) A'nın ilerlemesini okuyabilir.
select set_config('request.jwt.claims', json_build_object('sub', :C, 'role','authenticated')::text, true);
do $$
begin
  perform pg_temp.g9_probe_progress('a9990000-0000-4000-8000-000000000001'::uuid);
  raise notice 'OK 3h-c: onayli takipci A''nin ilerlemesini okudu';
end $$;

-- ============================ 3b: gun karti gorunurlugu ======================
-- C (takipçi) A'nın gün kartlarını get_day_cards ile GÖRMELİ.
select set_config('request.jwt.claims', json_build_object('sub', :C, 'role','authenticated')::text, true);
do $$
declare v_n int;
begin
  select jsonb_array_length(public.get_day_cards('a9990000-0000-4000-8000-000000000001'::uuid)) into v_n;
  if v_n < 1 then raise exception 'FAIL 3b: takipci A gun kartini goremedi (n=%)', v_n; end if;
  raise notice 'OK 3b-a: takipci A gun kartini get_day_cards ile goruyor';
end $$;
-- B (takip etmiyor, A gizli) → GÖRMEMELİ ([]).
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
declare v_n int;
begin
  select jsonb_array_length(public.get_day_cards('a9990000-0000-4000-8000-000000000001'::uuid)) into v_n;
  if v_n <> 0 then raise exception 'FAIL 3b: gizli A gun karti B''ye gorunmemeliydi (n=%)', v_n; end if;
  raise notice 'OK 3b-b: gizli A gun karti takip etmeyene gorunmuyor (feed_can_view_author)';
end $$;

-- ============================ 3j: CHECK comment + AI source ==================
reset role;
do $$
declare v_id bigint;
begin
  -- content_reports comment + source='ai' kabul edilmeli.
  insert into public.content_reports (target_type, target_id, reason, status, source, reporter_id)
  values ('comment', 'a9990000-0000-4000-8000-000000000020', 'ai:spam', 'open', 'ai', null)
  returning id into v_id;
  -- moderation_actions comment kabul edilmeli.
  insert into public.moderation_actions (actor_id, report_id, target_type, target_id, action, reason)
  values ('e9990000-0000-4000-8000-000000000005', v_id, 'comment', 'a9990000-0000-4000-8000-000000000020', 'warn', 'test');
  raise notice 'OK 3j: content_reports/moderation_actions comment + source=ai kabul etti';
end $$;

do $$ begin raise notice '==================== TUM G9 TESTLERI GECTI ===================='; end $$;

rollback;
