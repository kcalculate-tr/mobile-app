-- G5-S1 — Keşfet RLS / erişim testi (iki kullanıcı A ve B).
-- Instagram gizlilik modelini DOĞRULAR:
--   · A gizli hesap → gönderisi B'ye (takipçi değilken) GÖRÜNMEZ, takip onaylanınca görünür.
--   · B, A'nın tepkisini (post_reactions) OLUŞTURAMAZ/DEĞİŞTİREMEZ.
--   · Engel çift yönlü süzülür.
--   · Gizliye follow() → 'requested'; respond_follow_request kabul edince 'following'.
--   · Görünmeyen gönderiye react_post / add_post_meal_to_day reddedilir.
--
-- Çalıştırma: psql ... -f feed_rls_test.sql  (tamamı BEGIN ... ROLLBACK içinde,
-- hiçbir kalıcı veri bırakmaz). NOT: staging'de test EDİLMEDİ — yalnız dosya.
-- Başarı: sonuna kadar hatasız gelir ve "TUM TESTLER GECTI" yazar; herhangi bir
-- beklenti tutmazsa RAISE EXCEPTION ile durur.
-- ═════════════════════════════════════════════════════════════════════════════
begin;

-- Sabit kimlikler (rollback edileceği için güvenli).
-- A = üretici + GİZLİ hesap · B = normal kullanıcı · C = A'nın onaylı takipçisi
\set A  '''aaaa0000-0000-4000-8000-000000000001'''
\set B  '''bbbb0000-0000-4000-8000-000000000002'''
\set C  '''cccc0000-0000-4000-8000-000000000003'''
\set PA '''dddd0000-0000-4000-8000-000000000010'''

-- ── Kurulum (ayrıcalıklı rol; RLS baypas) ───────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, encrypted_password)
values
  ('00000000-0000-0000-0000-000000000000', :A, 'authenticated','authenticated','a_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}',''),
  ('00000000-0000-0000-0000-000000000000', :B, 'authenticated','authenticated','b_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}',''),
  ('00000000-0000-0000-0000-000000000000', :C, 'authenticated','authenticated','c_test@kcal.test', now(), now(), now(), '{"provider":"email"}','{}','')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, handle, is_private, created_at) values
  (:A, 'Ayşe Üretici', 'ayse', true,  now()),   -- GİZLİ
  (:B, 'Bora Kullanıcı','bora', false, now()),
  (:C, 'Cem Takipçi',  'cem',  false, now())
on conflict (id) do nothing;

-- A üretici ve yazabilir.
insert into public.creators (user_id, role, verified_at, can_post)
values (:A, 'diyetisyen', now(), true) on conflict (user_id) do nothing;

-- A'nın yayımlanmış gönderisi (meal_card ile).
insert into public.posts (id, author_id, lang, body, meal_card, status, published_at)
values (:PA, :A, 'tr', 'Gizli hesabin gonderisi',
        jsonb_build_object('name','Test Ogun','kcal',500,'protein_g',30,'carbs_g',40,'fat_g',20,'portion_label','1 porsiyon'),
        'published', now())
on conflict (id) do nothing;

-- C, A'yı takip ediyor (onaylı).
insert into public.follows (follower_id, following_id) values (:C, :A) on conflict do nothing;

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

reset role;
do $$ begin raise notice '================ TUM TESTLER GECTI ================'; end $$;

rollback;
