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

reset role;
do $$ begin raise notice '================ TUM TESTLER GECTI ================'; end $$;

rollback;
