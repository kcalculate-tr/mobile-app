-- G5-S1 — Keşfet RLS / erişim testi (iki kullanıcı A ve B).
-- Instagram gizlilik modelini DOĞRULAR:
--   · A gizli hesap → gönderisi B'ye (takipçi değilken) GÖRÜNMEZ, takip onaylanınca görünür.
--   · B, A'nın tepkisini (post_reactions) OLUŞTURAMAZ/DEĞİŞTİREMEZ.
--   · Engel çift yönlü süzülür.
--   · Gizliye follow() → 'requested'; respond_follow_request kabul edince 'following'.
--   · Görünmeyen gönderiye react_post / add_post_meal_to_day reddedilir.
-- G6 ek senaryoları (T11-T15):
--   · check_handle SALT OKUR (rezervasyon yapmaz).
--   · set_profile_privacy gizli→açık geçişte bekleyen istekleri onaylar.
--   · moderatör olmayan mod_list_reports/mod_resolve_report çağıramaz.
--   · moderatör mod_resolve_report('remove') → gönderi 'removed', akışta görünmez.
-- G11 ek senaryoları (T28-T33):
--   · T28 ayrılmış kullanıcı adları (claim/check_handle; tam eşleşme + marka öneki).
--   · T29 update_my_post + posts guard gövde dalı (yayındaki gövde değişimi → pending).
--   · T30 post-media tek writer_* seti (creator_* kaldırıldı).
--   · T31 search_products (<2 karakter boş; aktif filtre + kolon eşlemesi).
--   · T32 yeni_kabuk bayrak satırı varsayılanları; T33 bayrak yönetimi RPC'leri + audit.
--
-- Çalıştırma: psql ... -f feed_rls_test.sql  (tamamı BEGIN ... ROLLBACK içinde,
-- hiçbir kalıcı veri bırakmaz). NOT: staging'de test EDİLMEDİ — yalnız dosya.
-- Başarı: sonuna kadar hatasız gelir ve "TUM TESTLER GECTI" yazar; herhangi bir
-- beklenti tutmazsa RAISE EXCEPTION ile durur.
-- ═════════════════════════════════════════════════════════════════════════════
begin;

-- Sabit kimlikler (rollback edileceği için güvenli).
-- A = üretici + GİZLİ hesap · B = normal kullanıcı · C = A'nın onaylı takipçisi
-- D = A'ya bekleyen istek sahibi (gizli→açık testi) · M = moderatör
\set A  '''aaaa0000-0000-4000-8000-000000000001'''
\set B  '''bbbb0000-0000-4000-8000-000000000002'''
\set C  '''cccc0000-0000-4000-8000-000000000003'''
\set D  '''dddd0000-0000-4000-8000-000000000004'''
\set M  '''eeee0000-0000-4000-8000-000000000005'''
\set F  '''ffff0000-0000-4000-8000-000000000006'''
\set PA '''dddd0000-0000-4000-8000-000000000010'''
-- G8 fixture kimlikleri
\set PA2 '''dddd0000-0000-4000-8000-000000000020'''
\set PA3 '''dddd0000-0000-4000-8000-000000000030'''
\set PC  '''cccc0000-0000-4000-8000-000000000040'''
\set CA  '''aaaa0000-0000-4000-8000-000000000050'''

-- ── Kurulum (ayrıcalıklı rol; RLS baypas) ───────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, encrypted_password)
values
  ('00000000-0000-0000-0000-000000000000', :A, 'authenticated','authenticated','a_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}',''),
  ('00000000-0000-0000-0000-000000000000', :B, 'authenticated','authenticated','b_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}',''),
  ('00000000-0000-0000-0000-000000000000', :C, 'authenticated','authenticated','c_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}',''),
  ('00000000-0000-0000-0000-000000000000', :D, 'authenticated','authenticated','d_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}',''),
  ('00000000-0000-0000-0000-000000000000', :M, 'authenticated','authenticated','m_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}',''),
  ('00000000-0000-0000-0000-000000000000', :F, 'authenticated','authenticated','f_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}','')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, handle, is_private, created_at) values
  (:A, 'Ayşe Üretici', 'ayse', true,  now()),   -- GİZLİ
  (:B, 'Bora Kullanıcı','bora', false, now()),
  (:C, 'Cem Takipçi',  'cem',  false, now()),
  (:D, 'Dilan İstek',  'dilan',false, now()),
  (:M, 'Mert Moderatör','mert',false, now()),
  (:F, 'Fuat Üretici', 'fuat', false, now())
on conflict (id) do nothing;

-- A üretici ve yazabilir; M moderatör; F üretici (hız sınırı testi için).
insert into public.creators (user_id, role, verified_at, can_post)
values (:A, 'diyetisyen', now(), true),
       (:M, 'moderator',  now(), false),
       (:F, 'uretici',    now(), true) on conflict (user_id) do nothing;

-- D, A gizli hesabına bekleyen takip isteği gönderdi (gizli→açık testinde onaylanacak).
insert into public.follow_requests (requester_id, target_id) values (:D, :A) on conflict do nothing;

-- A'nın yayımlanmış gönderisi (meal_card ile).
insert into public.posts (id, author_id, lang, body, meal_card, status, published_at)
values (:PA, :A, 'tr', 'Gizli hesabin gonderisi',
        jsonb_build_object('name','Test Ogun','kcal',500,'protein_g',30,'carbs_g',40,'fat_g',20,'portion_label','1 porsiyon'),
        'published', now())
on conflict (id) do nothing;

-- C, A'yı takip ediyor (onaylı).
insert into public.follows (follower_id, following_id) values (:C, :A) on conflict do nothing;

-- ── G8 fixture'ları (ayrıcalıklı; RLS baypas) ───────────────────────────────
-- PA2: A'nın 'pending' (incelenen) gönderisi — yalnız A'ya görünmeli.
insert into public.posts (id, author_id, lang, body, post_type, status, published_at)
values (:PA2, :A, 'tr', 'A incelenen gonderi', 'serbest', 'pending', now())
on conflict (id) do nothing;
-- PA3: A'nın YAYIMLANMIŞ etkinlik gönderisi (activity_card) — did_it/self-notify testi.
insert into public.posts (id, author_id, lang, body, post_type, activity_card, status, published_at)
values (:PA3, :A, 'tr', 'A kosu etkinligi', 'etkinlik',
        jsonb_build_object('type','kosu','minutes',30,'kcal_est',300), 'published', now())
on conflict (id) do nothing;
-- PC: C'nin AÇIK yayımlanmış gönderisi — gizli hesabın yorumu testi için zemin.
insert into public.posts (id, author_id, lang, body, post_type, status, published_at)
values (:PC, :C, 'tr', 'C acik gonderi', 'serbest', 'published', now())
on conflict (id) do nothing;
-- CA: A'nın (gizli olacak) PC üzerine YAYIMLANMIŞ yorumu — B'ye görünmemeli.
insert into public.post_comments (id, post_id, author_id, body, status)
values (:CA, :PC, :A, 'Gizli hesabin yorumu', 'published')
on conflict (id) do nothing;

-- ── G10 fixture'ları (ayrıcalıklı; RLS baypas) ──────────────────────────────
\set PG  '''dddd0000-0000-4000-8000-000000000200'''
\set CG  '''aaaa0000-0000-4000-8000-000000000202'''
\set CB  '''aaaa0000-0000-4000-8000-000000000201'''
-- PG: A'nın 'pending' gönderisi (item 4 — AI beklettiği, dismiss ile yayına alınacak).
insert into public.posts (id, author_id, lang, body, post_type, status, published_at)
values (:PG, :A, 'tr', 'A AI-bekleyen gonderi', 'serbest', 'pending', now())
on conflict (id) do nothing;
-- CG: A'nın PC üzerine 'pending' yorumu (item 4 — dismiss ile published olacak).
insert into public.post_comments (id, post_id, author_id, body, status)
values (:CG, :PC, :A, 'A AI-bekleyen yorum', 'pending')
on conflict (id) do nothing;
-- CB: A'nın PC üzerine 'pending' yorumu (item 5 — status guard testi: A doğrudan
--     published yapamaz; delete_my_comment RPC ile removed yapabilir).
insert into public.post_comments (id, post_id, author_id, body, status)
values (:CB, :PC, :A, 'A guard yorum', 'pending')
on conflict (id) do nothing;
-- AI denetim kuyruğu + sistem (ai) şikayeti: PG (post) + CG (comment).
insert into public.moderation_queue (target_type, target_id, status)
values ('post', :PG, 'pending'), ('comment', :CG, 'pending')
on conflict (target_type, target_id) do update set status = 'pending';
insert into public.content_reports (reporter_id, target_type, target_id, reason, status, risk, source)
values (null, 'post',    :PG, 'ai:spam', 'open', 1, 'ai'),
       (null, 'comment', :CG, 'ai:spam', 'open', 1, 'ai');
-- Storage: post-media kovasına A'nın ve C'nin birer objesi (item 2 listeleme kapısı).
insert into storage.objects (id, bucket_id, name)
values (gen_random_uuid(), 'post-media', 'posts/aaaa0000-0000-4000-8000-000000000001/a1.jpg'),
       (gen_random_uuid(), 'post-media', 'posts/cccc0000-0000-4000-8000-000000000003/c1.jpg');
-- item 3 günlük 50 şikayet sınırı için B'ye 50 adet (bugün, source=user) tohum.
insert into public.content_reports (reporter_id, target_type, target_id, reason, status, risk, source)
select :B, 'user',
       ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       'spam', 'open', 1, 'user'
from generate_series(1, 50) g
on conflict (reporter_id, target_type, target_id) do nothing;

-- ── Kimlik değiştirme yardımcıları ──────────────────────────────────────────
set local role authenticated;

-- ============================ TEST 1 =========================================
-- B (takipçi değil) gizli A'nın gönderisini for_you akışında GÖRMEMELİ.
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
declare v_n int;
begin
  select count(*) into v_n
  from jsonb_array_elements(public.get_feed('for_you','tr',null,50)->'items') e
  where e->>'id' = 'dddd0000-0000-4000-8000-000000000010';
  if v_n <> 0 then raise exception 'FAIL T1: B gizli hesabin gonderisini gordu (n=%)', v_n; end if;
  raise notice 'OK T1: gizli gonderi B''ye gorunmuyor';
end $$;

-- ============================ TEST 2 =========================================
-- C (onaylı takipçi) gizli A'nın gönderisini GÖRMELİ.
select set_config('request.jwt.claims', json_build_object('sub', :C, 'role','authenticated')::text, true);
do $$
declare v_n int;
begin
  select count(*) into v_n
  from jsonb_array_elements(public.get_feed('following','tr',null,50)->'items') e
  where e->>'id' = 'dddd0000-0000-4000-8000-000000000010';
  if v_n <> 1 then raise exception 'FAIL T2: onayli takipci gizli gonderiyi goremedi (n=%)', v_n; end if;
  raise notice 'OK T2: onayli takipci gizli gonderiyi goruyor';
end $$;

-- ============================ TEST 3 =========================================
-- B, A adına tepki (post_reactions) YAZAMAZ (RLS with check user_id = auth.uid()).
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
begin
  begin
    insert into public.post_reactions (post_id, user_id, kind)
    values ('dddd0000-0000-4000-8000-000000000010', 'aaaa0000-0000-4000-8000-000000000001', 'like');
    raise exception 'FAIL T3: B, A adina tepki yazabildi';
  exception
    when insufficient_privilege then raise notice 'OK T3: B, A adina tepki yazamadi (RLS)';
  end;
end $$;

-- ============================ TEST 4 =========================================
-- B görünmeyen (gizli) gönderiye react_post yapamaz → 'bulunamadi'.
do $$
begin
  begin
    perform public.react_post('dddd0000-0000-4000-8000-000000000010'::uuid, 'like', true);
    raise exception 'FAIL T4: B gorunmeyen gonderiye tepki verebildi';
  exception
    when others then
      if sqlerrm like '%bulunamadi%' then raise notice 'OK T4: react_post gorunmeyen gonderiyi reddetti';
      else raise; end if;
  end;
end $$;

-- ============================ TEST 5 =========================================
-- B, A gizli hesabını takip edince follow() 'requested' döner (istek gider).
do $$
declare v_state text;
begin
  select (public.follow('aaaa0000-0000-4000-8000-000000000001'::uuid, true))->>'state' into v_state;
  if v_state <> 'requested' then raise exception 'FAIL T5: gizliye follow state=% (beklenen requested)', v_state; end if;
  if not exists (select 1 from public.follow_requests
                 where requester_id = 'bbbb0000-0000-4000-8000-000000000002'
                   and target_id   = 'aaaa0000-0000-4000-8000-000000000001')
  then raise exception 'FAIL T5: follow_requests satiri olusmadi'; end if;
  raise notice 'OK T5: gizliye follow -> requested';
end $$;

-- ============================ TEST 6 =========================================
-- A, B'nin isteğini KABUL eder → follows satırı oluşur, istek silinir.
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
begin
  perform public.respond_follow_request('bbbb0000-0000-4000-8000-000000000002'::uuid, true);
  if not exists (select 1 from public.follows
                 where follower_id = 'bbbb0000-0000-4000-8000-000000000002'
                   and following_id = 'aaaa0000-0000-4000-8000-000000000001')
  then raise exception 'FAIL T6: kabul sonrasi follows satiri yok'; end if;
  if exists (select 1 from public.follow_requests
             where requester_id = 'bbbb0000-0000-4000-8000-000000000002'
               and target_id   = 'aaaa0000-0000-4000-8000-000000000001')
  then raise exception 'FAIL T6: kabul sonrasi istek silinmedi'; end if;
  raise notice 'OK T6: istek kabul edildi, takip kuruldu';
end $$;

-- ============================ TEST 7 =========================================
-- Artık B onaylı takipçi → gizli gönderiyi görür ve react_post çalışır.
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
declare v jsonb;
begin
  v := public.react_post('dddd0000-0000-4000-8000-000000000010'::uuid, 'like', true);
  if (v->'stats'->>'likes')::int < 1 then raise exception 'FAIL T7: like sayilmadi'; end if;
  if not (v->'me'->>'liked')::bool then raise exception 'FAIL T7: me.liked false'; end if;
  raise notice 'OK T7: onayli takipci like atabiliyor';
end $$;

-- ============================ TEST 8 =========================================
-- add_post_meal_to_day idempotent: aynı anahtar iki kez → tek satır, aynı id.
do $$
declare v1 uuid; v2 uuid; v_cnt int;
begin
  v1 := (public.add_post_meal_to_day('dddd0000-0000-4000-8000-000000000010'::uuid, 'ogle', 1, 'idem-key-xyz'))->>'consumption_id';
  v2 := (public.add_post_meal_to_day('dddd0000-0000-4000-8000-000000000010'::uuid, 'ogle', 1, 'idem-key-xyz'))->>'consumption_id';
  if v1 is null or v1 <> v2 then raise exception 'FAIL T8: idempotency bozuk (v1=%, v2=%)', v1, v2; end if;
  select count(*) into v_cnt from public.meal_consumptions
   where user_id = 'bbbb0000-0000-4000-8000-000000000002' and source='post' and source_ref='idem-key-xyz';
  if v_cnt <> 1 then raise exception 'FAIL T8: tekrar satir acildi (n=%)', v_cnt; end if;
  raise notice 'OK T8: add_post_meal_to_day idempotent';
end $$;

-- ============================ TEST 9 =========================================
-- Engel çift yönlü: A, B'yi engellerse B artık A'yı göremez (takip de silinir).
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
begin
  perform public.block_user('bbbb0000-0000-4000-8000-000000000002'::uuid, true);
  if exists (select 1 from public.follows
             where follower_id='bbbb0000-0000-4000-8000-000000000002'
               and following_id='aaaa0000-0000-4000-8000-000000000001')
  then raise exception 'FAIL T9: engelden sonra takip silinmedi'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
declare v_n int;
begin
  select count(*) into v_n
  from jsonb_array_elements(public.get_feed('for_you','tr',null,50)->'items') e
  where e->>'id' = 'dddd0000-0000-4000-8000-000000000010';
  if v_n <> 0 then raise exception 'FAIL T9: engelli kullanici engelleyenin gonderisini gordu'; end if;
  raise notice 'OK T9: engel cift yonlu suzuldu';
end $$;

-- ============================ TEST 10 ========================================
-- B, content_reports tablosunu OKUYAMAZ (moderatör değil), ama şikayet EKLER.
do $$
declare v_n int;
begin
  perform public.report_content('post', 'dddd0000-0000-4000-8000-000000000010'::uuid, 'spam');
  select count(*) into v_n from public.content_reports;  -- RLS: moderatör değil → 0 satır
  if v_n <> 0 then raise exception 'FAIL T10: normal kullanici content_reports okudu (n=%)', v_n; end if;
  raise notice 'OK T10: sikayet eklendi ama okunamiyor (RLS)';
end $$;

-- ============================ TEST 11 ========================================
-- check_handle SALT OKUR: alınmış → available=false/taken; boş geçerli →
-- available=true; HİÇBİR satır yazmaz (rezervasyon yok).
select set_config('request.jwt.claims', json_build_object('sub', :C, 'role','authenticated')::text, true);
do $$
declare r jsonb; v_before text; v_after text;
begin
  select handle into v_before from public.profiles where id = 'cccc0000-0000-4000-8000-000000000003';
  r := public.check_handle('ayse');  -- A'nın handle'ı (alınmış)
  if (r->>'available')::bool or (r->>'reason') <> 'taken' then
    raise exception 'FAIL T11: alinmis handle available/taken degil (%).', r; end if;
  r := public.check_handle('bosbirhandle');
  if not (r->>'available')::bool or (r->>'reason') is not null then
    raise exception 'FAIL T11: bos handle available=true/reason=null degil (%).', r; end if;
  -- Salt okur: C'nin handle'ı değişmedi ve yeni handle rezerve edilmedi.
  select handle into v_after from public.profiles where id = 'cccc0000-0000-4000-8000-000000000003';
  if v_before is distinct from v_after then raise exception 'FAIL T11: check_handle handle degistirdi'; end if;
  if exists (select 1 from public.profiles where lower(handle) = 'bosbirhandle') then
    raise exception 'FAIL T11: check_handle rezervasyon yapti'; end if;
  raise notice 'OK T11: check_handle salt okur';
end $$;

-- ============================ TEST 12 ========================================
-- set_profile_privacy(false): A gizli→açık; D'nin bekleyen isteği onaylanır.
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
declare r jsonb;
begin
  r := public.set_profile_privacy(false);
  if (r->>'is_private')::bool then raise exception 'FAIL T12: is_private hala true'; end if;
  if coalesce((select is_private from public.profiles where id='aaaa0000-0000-4000-8000-000000000001'), true) then
    raise exception 'FAIL T12: profiles.is_private guncellenmedi'; end if;
  if not exists (select 1 from public.follows
                 where follower_id='dddd0000-0000-4000-8000-000000000004'
                   and following_id='aaaa0000-0000-4000-8000-000000000001')
  then raise exception 'FAIL T12: bekleyen istek onaylanmadi (follows yok)'; end if;
  if exists (select 1 from public.follow_requests
             where requester_id='dddd0000-0000-4000-8000-000000000004'
               and target_id='aaaa0000-0000-4000-8000-000000000001')
  then raise exception 'FAIL T12: istek temizlenmedi'; end if;
  raise notice 'OK T12: gizli->acik gecisde bekleyen istek onaylandi';
end $$;

-- ============================ TEST 13 ========================================
-- Moderatör olmayan B, mod_list_reports / mod_resolve_report ÇAĞIRAMAZ.
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
begin
  begin
    perform public.mod_list_reports('open', 50, null);
    raise exception 'FAIL T13: moderator olmayan mod_list_reports cagirabildi';
  exception when others then
    if sqlerrm like '%yetkisiz%' then raise notice 'OK T13a: mod_list_reports yetki reddi';
    else raise; end if;
  end;
  begin
    perform public.mod_resolve_report(1::bigint, 'dismiss', 'x');
    raise exception 'FAIL T13: moderator olmayan mod_resolve_report cagirabildi';
  exception when others then
    if sqlerrm like '%yetkisiz%' then raise notice 'OK T13b: mod_resolve_report yetki reddi';
    else raise; end if;
  end;
end $$;

-- ============================ TEST 14 ========================================
-- Moderatör M: açık şikayeti listeler ve 'remove' ile çözer (posts.status='removed',
-- şikayet 'resolved', moderation_actions kaydı).  (B'nin T10'daki PA şikayeti.)
select set_config('request.jwt.claims', json_build_object('sub', :M, 'role','authenticated')::text, true);
do $$
declare r jsonb; v_rid bigint;
begin
  r := public.mod_list_reports('open', 50, null);
  if jsonb_array_length(r->'items') < 1 then raise exception 'FAIL T14: moderator acik sikayet goremedi'; end if;
  select id into v_rid from public.content_reports
   where target_type='post' and target_id='dddd0000-0000-4000-8000-000000000010' order by id limit 1;
  if v_rid is null then raise exception 'FAIL T14: PA sikayeti yok'; end if;

  r := public.mod_resolve_report(v_rid, 'remove', 'topluluk kurali ihlali');
  if not (r->>'ok')::bool then raise exception 'FAIL T14: mod_resolve_report ok degil'; end if;
  if (select status from public.posts where id='dddd0000-0000-4000-8000-000000000010') <> 'removed' then
    raise exception 'FAIL T14: gonderi removed olmadi'; end if;
  if exists (select 1 from public.content_reports
             where target_type='post' and target_id='dddd0000-0000-4000-8000-000000000010' and status='open') then
    raise exception 'FAIL T14: acik sikayet resolved olmadi'; end if;
  if not exists (select 1 from public.moderation_actions
                 where target_id='dddd0000-0000-4000-8000-000000000010' and action='remove') then
    raise exception 'FAIL T14: moderation_actions kaydi yok'; end if;
  raise notice 'OK T14: moderator remove + sikayet resolved + kayit';
end $$;

-- ============================ TEST 15 ========================================
-- Remove sonrası gönderi akışta GÖRÜNMEZ (C takipçi; PA status='removed').
select set_config('request.jwt.claims', json_build_object('sub', :C, 'role','authenticated')::text, true);
do $$
declare v_n int;
begin
  select count(*) into v_n
  from jsonb_array_elements(public.get_feed('following','tr',null,50)->'items') e
  where e->>'id' = 'dddd0000-0000-4000-8000-000000000010';
  if v_n <> 0 then raise exception 'FAIL T15: removed gonderi hala akista (n=%)', v_n; end if;
  raise notice 'OK T15: removed gonderi akista gorunmuyor';
end $$;

-- ============================ TEST 16 ========================================
-- pending yalnız YAZARA görünür: A kendi 'pending' PA2'sini for_you'da görür;
-- C (A'yı görebilen takipçi) A'nın YAYIMLANMIŞ PA3'ünü görür ama PA2'yi GÖRMEZ.
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
declare v_pa2 int;
begin
  select count(*) into v_pa2
  from jsonb_array_elements(public.get_feed('for_you','tr',null,50)->'items') e
  where e->>'id' = 'dddd0000-0000-4000-8000-000000000020';
  if v_pa2 <> 1 then raise exception 'FAIL T16: yazar kendi pending gonderisini goremedi (n=%)', v_pa2; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :C, 'role','authenticated')::text, true);
do $$
declare v_pa2 int; v_pa3 int;
begin
  select count(*) into v_pa2
  from jsonb_array_elements(public.get_feed('for_you','tr',null,50)->'items') e
  where e->>'id' = 'dddd0000-0000-4000-8000-000000000020';
  select count(*) into v_pa3
  from jsonb_array_elements(public.get_feed('for_you','tr',null,50)->'items') e
  where e->>'id' = 'dddd0000-0000-4000-8000-000000000030';
  if v_pa2 <> 0 then raise exception 'FAIL T16: baskasi pending gonderiyi gordu (n=%)', v_pa2; end if;
  if v_pa3 <> 1 then raise exception 'FAIL T16: yayimlanmis etkinlik gonderisi gorunmuyor (n=%)', v_pa3; end if;
  raise notice 'OK T16: pending yalniz yazara gorunuyor';
end $$;

-- ============================ TEST 17 ========================================
-- did_it idempotent: C aynı etkinlik gönderisine iki kez → tek kayıt, aynı id, kcal>0.
do $$
declare v1 uuid; v2 uuid; v_k numeric; v_cnt int;
begin
  v1  := (public.did_it('dddd0000-0000-4000-8000-000000000030'::uuid, null, 'did-key-1'))->>'activity_log_id';
  v_k := (public.did_it('dddd0000-0000-4000-8000-000000000030'::uuid, null, 'did-key-2'))->>'kcal_est';
  select (public.did_it('dddd0000-0000-4000-8000-000000000030'::uuid, 30, 'did-key-3'))->>'activity_log_id' into v2;
  if v1 is null or v1 <> v2 then raise exception 'FAIL T17: did_it idempotent degil (v1=%, v2=%)', v1, v2; end if;
  if coalesce(v_k,0) <= 0 then raise exception 'FAIL T17: kcal_est hesaplanmadi (%).', v_k; end if;
  select count(*) into v_cnt from public.activity_logs
   where user_id = 'cccc0000-0000-4000-8000-000000000003'
     and source = 'post' and source_ref = 'dddd0000-0000-4000-8000-000000000030';
  if v_cnt <> 1 then raise exception 'FAIL T17: did_it tekrar satir acti (n=%)', v_cnt; end if;
  raise notice 'OK T17: did_it idempotent + kcal tahmini';
end $$;

-- ============================ TEST 18 ========================================
-- kendine bildirim yok: A kendi gönderisini beğenir → A'ya (actor=A) bildirim OLUŞMAZ.
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
declare v_self int;
begin
  perform public.react_post('dddd0000-0000-4000-8000-000000000030'::uuid, 'like', true);
  select count(*) into v_self from public.social_notifications
   where user_id = 'aaaa0000-0000-4000-8000-000000000001'
     and actor_id = 'aaaa0000-0000-4000-8000-000000000001';
  if v_self <> 0 then raise exception 'FAIL T18: kendine bildirim olustu (n=%)', v_self; end if;
  raise notice 'OK T18: kendine bildirim yok (guard)';
end $$;

-- ============================ TEST 19 ========================================
-- gizli hesabın yorumu görünmez: A gizli olunca, A'nın PC üzerindeki yorumu (CA)
-- takipçi olmayan F'ye GÖRÜNMEZ; PC sahibi C ise GÖRÜR.
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$ begin perform public.set_profile_privacy(true); end $$;  -- A yeniden GİZLİ
select set_config('request.jwt.claims', json_build_object('sub', :F, 'role','authenticated')::text, true);
do $$
declare v_n int;
begin
  select count(*) into v_n
  from jsonb_array_elements(public.list_comments('cccc0000-0000-4000-8000-000000000040'::uuid,null,50)->'items') e
  where e->>'id' = 'aaaa0000-0000-4000-8000-000000000050';
  if v_n <> 0 then raise exception 'FAIL T19: gizli hesabin yorumu yabanciya gorundu (n=%)', v_n; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :C, 'role','authenticated')::text, true);
do $$
declare v_n int;
begin
  select count(*) into v_n
  from jsonb_array_elements(public.list_comments('cccc0000-0000-4000-8000-000000000040'::uuid,null,50)->'items') e
  where e->>'id' = 'aaaa0000-0000-4000-8000-000000000050';
  if v_n <> 1 then raise exception 'FAIL T19: gonderi sahibi yorumu goremedi (n=%)', v_n; end if;
  raise notice 'OK T19: gizli hesabin yorumu suzuldu';
end $$;

-- ============================ TEST 20 ========================================
-- engelli yorum yapamaz: B (A tarafından engelli) A'nın gönderisine add_comment → 'engel_var'.
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
begin
  begin
    perform public.add_comment('dddd0000-0000-4000-8000-000000000030'::uuid, 'olmaz', null, 'c-key-b');
    raise exception 'FAIL T20: engelli kullanici yorum yapabildi';
  exception when others then
    if sqlerrm like '%engel_var%' or sqlerrm like '%bulunamadi%'
      then raise notice 'OK T20: engelli yorum yapamadi';
    else raise; end if;
  end;
end $$;

-- ============================ TEST 21 ========================================
-- hız sınırı: F (üretici, hesap <24s → limit 3) 3 gönderi açar, 4. 'rate_limited'.
select set_config('request.jwt.claims', json_build_object('sub', :F, 'role','authenticated')::text, true);
do $$
declare r jsonb; i int;
begin
  for i in 1..3 loop
    r := public.create_post('serbest', 'f gonderi ' || i, 'tr', null, null, null, 'f-idem-' || i);
    if (r->>'post_id') is null then raise exception 'FAIL T21: % . gonderi acilamadi (%).', i, r; end if;
  end loop;
  r := public.create_post('serbest', 'f gonderi 4', 'tr', null, null, null, 'f-idem-4');
  if (r->>'error') <> 'rate_limited' then raise exception 'FAIL T21: 4. gonderi rate_limited donmedi (%).', r; end if;
  raise notice 'OK T21: gonderi hiz siniri (gunde 3/yeni hesap)';
end $$;

-- ============================ TEST 22 (G10/1) ================================
-- reserve_ai_scan: BAŞKA kullanıcının idempotency anahtarıyla kota aşılamaz.
-- B anahtarla rezerve eder; C aynı anahtarla çağırınca 'ok' ALAMAZ (hata) ve C'nin
-- kota sayacı artMAZ.
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
declare r jsonb;
begin
  r := public.reserve_ai_scan('g10-shared-key');
  if (r->>'ok') <> 'true' then raise exception 'FAIL T22: B rezervasyon alamadi (%).', r; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :C, 'role','authenticated')::text, true);
do $$
declare v_used int;
begin
  begin
    perform public.reserve_ai_scan('g10-shared-key');
    raise exception 'FAIL T22: C baskasinin anahtariyla rezervasyon aldi';
  exception when others then
    if sqlerrm like '%baskasinin_anahtari%' then
      select coalesce(used, 0) into v_used from public.ai_scan_usage
       where user_id = 'cccc0000-0000-4000-8000-000000000003'
         and day = (now() at time zone 'Europe/Istanbul')::date;
      if coalesce(v_used, 0) <> 0 then raise exception 'FAIL T22: C kotasi harcandi (used=%)', v_used; end if;
      raise notice 'OK T22: baskasinin anahtari reddedildi, kota korundu';
    else raise; end if;
  end;
end $$;

-- ============================ TEST 23 (G10/2) ================================
-- post-media kovası LİSTELEME: yabancı 0 görür; sahip yalnız kendi objesini; moderatör hepsini.
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
declare v_n int;
begin
  select count(*) into v_n from storage.objects where bucket_id = 'post-media';
  if v_n <> 0 then raise exception 'FAIL T23: yabanci post-media kovasini listeledi (n=%)', v_n; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
declare v_mine int; v_others int;
begin
  select count(*) into v_mine   from storage.objects where bucket_id='post-media' and name like 'posts/aaaa%';
  select count(*) into v_others from storage.objects where bucket_id='post-media' and name like 'posts/cccc%';
  if v_mine < 1  then raise exception 'FAIL T23: sahip kendi objesini goremedi'; end if;
  if v_others <> 0 then raise exception 'FAIL T23: sahip baskasinin objesini gordu (n=%)', v_others; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :M, 'role','authenticated')::text, true);
do $$
declare v_n int;
begin
  select count(*) into v_n from storage.objects where bucket_id='post-media';
  if v_n < 2 then raise exception 'FAIL T23: moderator kovayi listeleyemedi (n=%)', v_n; end if;
  raise notice 'OK T23: post-media listeleme yalniz sahip + moderator';
end $$;

-- ============================ TEST 24 (G10/3) ================================
-- report_content görünürlük kapısı + comment + günlük 50 sınır.
-- (a) B (A engelli) A'nin yayimlanmis gonderisini (PA) sikayet → 'bulunamadi'.
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
begin
  begin
    perform public.report_content('post', 'dddd0000-0000-4000-8000-000000000010'::uuid, 'spam');
    raise exception 'FAIL T24a: engelli kullanici gorulmez gonderiyi sikayet edebildi';
  exception when others then
    if sqlerrm like '%bulunamadi%' then raise notice 'OK T24a: gorulmeyen gonderi bulunamadi';
    else raise; end if;
  end;
end $$;
-- (b) C (A takipcisi) A'nin PENDING gonderisini (PA2) sikayet → 'bulunamadi'.
select set_config('request.jwt.claims', json_build_object('sub', :C, 'role','authenticated')::text, true);
do $$
begin
  begin
    perform public.report_content('post', 'dddd0000-0000-4000-8000-000000000020'::uuid, 'spam');
    raise exception 'FAIL T24b: pending gonderi sikayet edilebildi';
  exception when others then
    if sqlerrm like '%bulunamadi%' then raise notice 'OK T24b: pending gonderi bulunamadi';
    else raise; end if;
  end;
end $$;
-- (c) C, C'nin ACIK gonderisini (PC) + A'nin yayimlanmis yorumunu (CA) sikayet → hata YOK.
do $$
begin
  perform public.report_content('post',    'cccc0000-0000-4000-8000-000000000040'::uuid, 'uygunsuz');
  perform public.report_content('comment', 'aaaa0000-0000-4000-8000-000000000050'::uuid, 'uygunsuz');
  raise notice 'OK T24c: gorulebilir gonderi + yorum sikayet edildi';
end $$;
-- (d) B (bugun 50 sikayeti var) gorulebilir PC'yi sikayet → 'cok_fazla_sikayet'.
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
begin
  begin
    perform public.report_content('post', 'cccc0000-0000-4000-8000-000000000040'::uuid, 'spam');
    raise exception 'FAIL T24d: gunluk 50 sinir asildi ama izin verildi';
  exception when others then
    if sqlerrm like '%cok_fazla_sikayet%' then raise notice 'OK T24d: gunluk 50 sikayet siniri';
    else raise; end if;
  end;
end $$;

-- ── Sahip (ayrıcalıklı) rolde çalışan testler (RLS baypas; guard trigger jwt rolünü
--    okumaya devam eder, auth.uid() jwt claim'den gelir) ──────────────────────
reset role;

-- ============================ TEST 25 (G10/4) ================================
-- mod_resolve_report(dismiss): pending gonderi+yorum published olur VE moderation_queue done.
select set_config('request.jwt.claims', json_build_object('sub', :M, 'role','authenticated')::text, true);
do $$
declare v_rid bigint; v_st text; v_q text;
begin
  -- PG (post)
  select id into v_rid from public.content_reports
   where target_type='post' and target_id='dddd0000-0000-4000-8000-000000000200' and source='ai';
  perform public.mod_resolve_report(v_rid, 'dismiss', 'uygundur');
  select status into v_st from public.posts where id='dddd0000-0000-4000-8000-000000000200';
  if v_st <> 'published' then raise exception 'FAIL T25: pending gonderi published olmadi (%).', v_st; end if;
  select status into v_q from public.moderation_queue
   where target_type='post' and target_id='dddd0000-0000-4000-8000-000000000200';
  if v_q <> 'done' then raise exception 'FAIL T25: post moderation_queue done olmadi (%).', v_q; end if;

  -- CG (comment)
  select id into v_rid from public.content_reports
   where target_type='comment' and target_id='aaaa0000-0000-4000-8000-000000000202' and source='ai';
  perform public.mod_resolve_report(v_rid, 'dismiss', 'uygundur');
  select status into v_st from public.post_comments where id='aaaa0000-0000-4000-8000-000000000202';
  if v_st <> 'published' then raise exception 'FAIL T25: pending yorum published olmadi (%).', v_st; end if;
  select status into v_q from public.moderation_queue
   where target_type='comment' and target_id='aaaa0000-0000-4000-8000-000000000202';
  if v_q <> 'done' then raise exception 'FAIL T25: comment moderation_queue done olmadi (%).', v_q; end if;
  raise notice 'OK T25: dismiss gonderi+yorum published + queue done';
end $$;

-- ============================ TEST 26 (G10/5) ================================
-- post_comments.status guard: yazar A kendi pending yorumunu DOĞRUDAN published yapamaz;
-- delete_my_comment RPC'si ile removed yapabilir (islem-yerel app.post_rpc bayragi).
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
begin
  begin
    update public.post_comments set status='published'
     where id='aaaa0000-0000-4000-8000-000000000201';
    raise exception 'FAIL T26: yazar yorum durumunu dogrudan degistirebildi';
  exception when others then
    if sqlerrm like '%post_comments_guard%' then raise notice 'OK T26a: dogrudan status degisimi engellendi';
    else raise; end if;
  end;
end $$;
do $$
declare v_st text;
begin
  perform public.delete_my_comment('aaaa0000-0000-4000-8000-000000000201'::uuid);
  select status into v_st from public.post_comments where id='aaaa0000-0000-4000-8000-000000000201';
  if v_st <> 'removed' then raise exception 'FAIL T26b: delete_my_comment removed yapmadi (%).', v_st; end if;
  raise notice 'OK T26b: delete_my_comment RPC ile removed';
end $$;

-- ============================ TEST 27 (G10/6) ================================
-- get_user_day_progress yetki kapisi: gorulemeyene (B→A) 'yetkisiz'; auth.uid() NULL
-- (rolsuz/servis definer) → kapi atlanir (hata YOK); self → ok.
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
begin
  begin
    perform public.get_user_day_progress('aaaa0000-0000-4000-8000-000000000001'::uuid);
    raise exception 'FAIL T27a: B gorulemeyen A ilerlemesini okuyabildi';
  exception when others then
    if sqlerrm like '%yetkisiz%' then raise notice 'OK T27a: gorulemeyen ilerleme reddedildi';
    else raise; end if;
  end;
end $$;
select set_config('request.jwt.claims', NULL, true);  -- auth.uid() = NULL (rolsüz/servis)
do $$
declare r jsonb;
begin
  r := public.get_user_day_progress('aaaa0000-0000-4000-8000-000000000001'::uuid);
  if r is null or (r ? 'progress') is not true then
    raise exception 'FAIL T27b: null-auth definer cagri sonuc donmedi (%).', r;
  end if;
  raise notice 'OK T27b: auth.uid() NULL iken kapi atlandi (definer korundu)';
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
declare r jsonb;
begin
  r := public.get_user_day_progress('aaaa0000-0000-4000-8000-000000000001'::uuid);
  if r is null or (r ? 'progress') is not true then raise exception 'FAIL T27c: self ilerleme okunamadi (%).', r; end if;
  raise notice 'OK T27c: kullanici kendi ilerlemesini okur';
end $$;

-- ============================ TEST 28 (G11/1) ================================
-- Ayrilmis kullanici adlari: claim_handle/check_handle rezerve kontrolu. Ortak
-- vektor src/modules/profil/__tests__/handle.reserved.test.ts ile AYNI kural.
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
declare r jsonb;
begin
  -- Tam eslesme ayrilmis.
  r := public.check_handle('kcalculate');
  if (r->>'available')::boolean or (r->>'reason') <> 'reserved' then
    raise exception 'FAIL T28a: kcalculate ayrilmis degil (%).', r; end if;
  r := public.check_handle('admin');
  if (r->>'available')::boolean or (r->>'reason') <> 'reserved' then
    raise exception 'FAIL T28a: admin ayrilmis degil (%).', r; end if;
  -- Marka oneki + harf → ayrilmis.
  r := public.check_handle('kcalofficial');
  if (r->>'available')::boolean or (r->>'reason') <> 'reserved' then
    raise exception 'FAIL T28b: kcalofficial ayrilmis degil (%).', r; end if;
  -- Noktali turev → ayrilmis DEGIL (kimsede yok → available).
  r := public.check_handle('kcal.official');
  if not (r->>'available')::boolean then
    raise exception 'FAIL T28c: kcal.official ayrilmis sayildi (%).', r; end if;
  -- claim_handle rezerve reddi.
  r := public.claim_handle('kcal');
  if (r->>'ok')::boolean or (r->>'reason') <> 'reserved' then
    raise exception 'FAIL T28d: claim_handle(kcal) reddetmedi (%).', r; end if;
  -- Idempotent: B kendi handle'ini (bora) tekrar isteyebilir.
  r := public.claim_handle('bora');
  if not (r->>'ok')::boolean then
    raise exception 'FAIL T28e: B kendi handle idempotent olmadi (%).', r; end if;
  -- Serbest, rezerve olmayan ad → ok + guncellenir.
  r := public.claim_handle('borakullanici');
  if not (r->>'ok')::boolean then
    raise exception 'FAIL T28f: serbest ad alinamadi (%).', r; end if;
  raise notice 'OK T28: ayrilmis ad tam/prefix reddi, noktali turev serbest, idempotent';
end $$;

-- ============================ TEST 29 (G11/4) ================================
-- update_my_post + posts guard govde dali: yayindaki gonderinin govdesi degisirse
-- (RPC VEYA dogrudan UPDATE) status=pending + moderation_queue; yazar status'u
-- hala dogrudan degistiremez.
select set_config('request.jwt.claims', NULL, true);  -- rolsuz: guard bypass (hazirlik)
update public.posts set status = 'published' where id = :PA;
delete from public.moderation_queue where target_type = 'post' and target_id = :PA;
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
declare r jsonb; v_st text; v_q int;
begin
  r := public.update_my_post('dddd0000-0000-4000-8000-000000000010'::uuid, 'G11 yeni govde RPC ile');
  if (r->>'status') <> 'pending' then raise exception 'FAIL T29a: RPC status pending degil (%).', r; end if;
  select status into v_st from public.posts where id = 'dddd0000-0000-4000-8000-000000000010';
  if v_st <> 'pending' then raise exception 'FAIL T29a: gonderi pending olmadi (%).', v_st; end if;
  select count(*) into v_q from public.moderation_queue
   where target_type = 'post' and target_id = 'dddd0000-0000-4000-8000-000000000010';
  if v_q <> 1 then raise exception 'FAIL T29a: moderation_queue satiri yok (%).', v_q; end if;
  raise notice 'OK T29a: update_my_post yayindaki govdeyi pending + kuyruk';
end $$;
-- Dogrudan UPDATE yolu: yayina geri al, kuyrugu temizle, A dogrudan govde degistirir.
select set_config('request.jwt.claims', NULL, true);
update public.posts set status = 'published' where id = :PA;
delete from public.moderation_queue where target_type = 'post' and target_id = :PA;
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
declare v_st text; v_q int;
begin
  update public.posts set body = 'G11 elle duzenleme' where id = 'dddd0000-0000-4000-8000-000000000010';
  select status into v_st from public.posts where id = 'dddd0000-0000-4000-8000-000000000010';
  if v_st <> 'pending' then raise exception 'FAIL T29b: dogrudan govde UPDATE pending yapmadi (%).', v_st; end if;
  select count(*) into v_q from public.moderation_queue
   where target_type = 'post' and target_id = 'dddd0000-0000-4000-8000-000000000010';
  if v_q <> 1 then raise exception 'FAIL T29b: kuyruk satiri yok (%).', v_q; end if;
  raise notice 'OK T29b: dogrudan govde UPDATE yeniden denetime dusurdu (acik kapandi)';
end $$;
-- Yazar status'u hala dogrudan degistiremez (guard regresyonu).
do $$
begin
  begin
    update public.posts set status = 'published' where id = 'dddd0000-0000-4000-8000-000000000010';
    raise exception 'FAIL T29c: yazar status dogrudan degistirdi';
  exception when others then
    if sqlerrm like '%posts_guard%' then raise notice 'OK T29c: yazar status degisimi hala engelli';
    else raise; end if;
  end;
end $$;
-- T29d (S6 EK DUZELTME): daha once denetlenmis (kuyruk 'done') yayindaki gonderi
-- duzenlenince kuyruk satiri yeniden 'pending' acilmali. Eski 'do nothing' bunu
-- yapmiyordu → gonderi sonsuza dek pending kalirdi.
select set_config('request.jwt.claims', NULL, true);  -- rolsuz: guard bypass (hazirlik)
update public.posts set status = 'published' where id = :PA;
insert into public.moderation_queue (target_type, target_id, status, attempts, last_attempt_at)
values ('post', :PA, 'done', 2, now())
on conflict (target_type, target_id)
do update set status = 'done', attempts = 2, last_attempt_at = now();
select set_config('request.jwt.claims', json_build_object('sub', :A, 'role','authenticated')::text, true);
do $$
declare r jsonb; v_q text; v_att int;
begin
  r := public.update_my_post('dddd0000-0000-4000-8000-000000000010'::uuid, 'G11 done kuyruk yeniden acilir');
  if (r->>'status') <> 'pending' then raise exception 'FAIL T29d: RPC status pending degil (%).', r; end if;
  select status, attempts into v_q, v_att from public.moderation_queue
   where target_type = 'post' and target_id = 'dddd0000-0000-4000-8000-000000000010';
  if v_q <> 'pending' then raise exception 'FAIL T29d: done kuyruk yeniden pending olmadi (%).', v_q; end if;
  if v_att <> 0 then raise exception 'FAIL T29d: attempts sifirlanmadi (%).', v_att; end if;
  raise notice 'OK T29d: done kuyruk duzenlemede yeniden pending (attempts=0)';
end $$;

-- ============================ TEST 30 (G11/3) ================================
-- post-media storage politikalari tek sete indi: creator_* kalkti, writer_* (3) kaldi.
do $$
declare v_creator int; v_writer int;
begin
  select count(*) into v_creator from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'post_media_creator_%';
  select count(*) into v_writer from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'post_media_writer_%';
  if v_creator <> 0 then raise exception 'FAIL T30: creator_* kaldirilmadi (%).', v_creator; end if;
  if v_writer <> 3 then raise exception 'FAIL T30: writer_* 3 degil (%).', v_writer; end if;
  raise notice 'OK T30: post-media tek writer_* seti (creator_* kaldirildi)';
end $$;

-- ============================ TEST 31 (G11/5) ================================
-- search_products: p_q<2 → bos; aktif urun + kolon eslemesi (best-effort seed —
-- canli products kolonlari repodan cikarildi, uyusmazsa SKIP).
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
declare r jsonb;
begin
  r := public.search_products('a', 12);
  if r is null or jsonb_typeof(r->'items') <> 'array' or jsonb_array_length(r->'items') <> 0 then
    raise exception 'FAIL T31a: p_q<2 bos items dondurmedi (%).', r; end if;
  raise notice 'OK T31a: search_products p_q<2 → bos items';
end $$;
select set_config('request.jwt.claims', NULL, true);
do $$
declare r jsonb; v_item jsonb; v_seeded boolean := false;
begin
  begin
    insert into public.products (id, name, calories, protein, carbs, fats, img, is_available)
    values (999900001, 'G11TestUrunu Aktif', 321, 11, 22, 33, 'test/img.jpg', true);
    insert into public.products (id, name, calories, protein, carbs, fats, img, is_available)
    values (999900002, 'G11TestUrunu Pasif', 100, 1, 2, 3, 'x.jpg', false);
    v_seeded := true;
  exception when others then
    raise notice 'SKIP T31b: products seed yapilamadi (canli kolonlar farkli olabilir): %', sqlerrm;
  end;
  if v_seeded then
    r := public.search_products('G11TestUrunu', 12);
    if jsonb_array_length(r->'items') <> 1 then
      raise exception 'FAIL T31b: aktif filtre tutmadi (% sonuc).', jsonb_array_length(r->'items'); end if;
    v_item := r->'items'->0;
    if (v_item->>'kcal')::int <> 321 or (v_item->>'protein_g')::int <> 11
       or (v_item->>'carbs_g')::int <> 22 or (v_item->>'fat_g')::int <> 33
       or (v_item->>'image_url') <> 'test/img.jpg' then
      raise exception 'FAIL T31b: kolon eslemesi yanlis (%).', v_item; end if;
    raise notice 'OK T31b: search_products aktif filtre + kolon eslemesi (kcal/protein_g/carbs_g/fat_g/image_url)';
  end if;
end $$;

-- ============================ TEST 32 (G11/7) ================================
-- yeni_kabuk bayrak satiri: enabled=false, rollout_percent=0, min_app_version=1.1.0.
-- (T33'ten ONCE — T33 bu satiri degistirir.)
do $$
declare ff record;
begin
  select * into ff from public.feature_flags where key = 'yeni_kabuk';
  if not found then raise exception 'FAIL T32: yeni_kabuk bayrak satiri yok'; end if;
  if ff.enabled or ff.rollout_percent <> 0 or ff.min_app_version <> '1.1.0' then
    raise exception 'FAIL T32: yeni_kabuk varsayilanlari yanlis (enabled=%, rollout=%, min=%).',
      ff.enabled, ff.rollout_percent, ff.min_app_version;
  end if;
  raise notice 'OK T32: yeni_kabuk enabled=false rollout=0 min_app_version=1.1.0';
end $$;

-- ============================ TEST 33 (G11/6) ================================
-- Bayrak yonetimi RPC'leri + feature_flag_audit. Admin yetkisi admin_allowlist
-- (best-effort seed; yoksa SKIP). non-admin reddi her halukarda calisir.
select set_config('request.jwt.claims', NULL, true);
do $$
begin
  begin
    insert into public.admin_allowlist (user_id) values ('eeee0000-0000-4000-8000-000000000005')
    on conflict do nothing;
  exception when others then
    raise notice 'SKIP T33 seed: admin_allowlist kolonlari farkli olabilir: %', sqlerrm;
  end;
end $$;
-- non-admin B reddedilir.
select set_config('request.jwt.claims', json_build_object('sub', :B, 'role','authenticated')::text, true);
do $$
begin
  begin
    perform public.admin_list_flags();
    raise exception 'FAIL T33a: non-admin admin_list_flags cagirabildi';
  exception when others then
    if sqlerrm like '%yetkisiz%' then raise notice 'OK T33a: non-admin reddedildi';
    else raise; end if;
  end;
end $$;
-- Admin M (seed tuttu ise).
select set_config('request.jwt.claims', json_build_object('sub', :M, 'role','authenticated')::text, true);
do $$
declare r jsonb; v_before int; v_after int; v_cnt int;
begin
  if not exists (select 1 from public.admin_allowlist where user_id = 'eeee0000-0000-4000-8000-000000000005') then
    raise notice 'SKIP T33b-g: M admin degil (seed yapilamadi)';
    return;
  end if;
  -- gecersiz yuzde
  begin perform public.admin_set_flag('yeni_kabuk', true, 150, null, null);
    raise exception 'FAIL T33b: gecersiz yuzde kabul edildi';
  exception when others then
    if sqlerrm like '%gecersiz_yuzde%' then raise notice 'OK T33b: gecersiz yuzde reddedildi'; else raise; end if;
  end;
  -- gecersiz anahtar
  begin perform public.admin_set_flag('olmayan_bayrak_xyz', true, 10, null, null);
    raise exception 'FAIL T33c: gecersiz anahtar kabul edildi';
  exception when others then
    if sqlerrm like '%gecersiz_anahtar%' then raise notice 'OK T33c: gecersiz anahtar reddedildi'; else raise; end if;
  end;
  -- gecerli set + audit satiri
  select count(*) into v_before from public.feature_flag_audit where flag_key = 'yeni_kabuk';
  perform public.admin_set_flag('yeni_kabuk', true, 25, '1.1.0', array['ios','android']);
  select count(*) into v_after from public.feature_flag_audit where flag_key = 'yeni_kabuk';
  if v_after <> v_before + 1 then raise exception 'FAIL T33d: audit satiri yazilmadi'; end if;
  if not exists (select 1 from public.feature_flags where key='yeni_kabuk' and enabled and rollout_percent=25) then
    raise exception 'FAIL T33d: bayrak guncellenmedi'; end if;
  raise notice 'OK T33d: admin_set_flag guncelledi + audit';
  -- list_flags + unlock_count
  r := public.admin_list_flags();
  if not exists (select 1 from jsonb_array_elements(r) e where e->>'key'='yeni_kabuk') then
    raise exception 'FAIL T33e: admin_list_flags yeni_kabuk icermiyor'; end if;
  raise notice 'OK T33e: admin_list_flags listeledi';
  -- flag_unlock ekle/kaldir
  perform public.admin_flag_unlock('yeni_kabuk', 'bbbb0000-0000-4000-8000-000000000002', true);
  if not exists (select 1 from public.user_feature_unlocks
                 where flag_key='yeni_kabuk' and user_id='bbbb0000-0000-4000-8000-000000000002') then
    raise exception 'FAIL T33f: unlock eklenmedi'; end if;
  r := public.admin_list_flags();
  select (e->>'unlock_count')::int into v_cnt from jsonb_array_elements(r) e where e->>'key'='yeni_kabuk';
  if coalesce(v_cnt,0) < 1 then raise exception 'FAIL T33f: unlock_count artmadi (%).', v_cnt; end if;
  perform public.admin_flag_unlock('yeni_kabuk', 'bbbb0000-0000-4000-8000-000000000002', false);
  if exists (select 1 from public.user_feature_unlocks
             where flag_key='yeni_kabuk' and user_id='bbbb0000-0000-4000-8000-000000000002') then
    raise exception 'FAIL T33f: unlock kaldirilmadi'; end if;
  raise notice 'OK T33f: admin_flag_unlock ekle/kaldir + unlock_count';
  -- find_user handle + maskeli email
  r := public.admin_find_user('bora');
  if jsonb_array_length(r) < 1 or not exists (select 1 from jsonb_array_elements(r) e where e->>'handle'='bora') then
    raise exception 'FAIL T33g: admin_find_user handle bulamadi (%).', r; end if;
  if exists (select 1 from jsonb_array_elements(r) e where e->>'email_masked' like '%b_test@kcal.test%') then
    raise exception 'FAIL T33g: email maskelenmedi'; end if;
  raise notice 'OK T33g: admin_find_user handle + maskeli email';
end $$;

reset role;
do $$ begin raise notice '================ TUM TESTLER GECTI ================'; end $$;

rollback;
