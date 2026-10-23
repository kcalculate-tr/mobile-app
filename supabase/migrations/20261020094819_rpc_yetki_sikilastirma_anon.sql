-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER RPC'lerinde anon/authenticated yetkisinin sikilastirilmasi
--
-- Supabase'de bir fonksiyon olusturuldugunda EXECUTE varsayilan olarak PUBLIC'e
-- verilir; sonradan "grant ... to authenticated" yazmak bu varsayilani KALDIRMAZ.
-- Bu yuzden asagidaki SECURITY DEFINER fonksiyonlar, uygulamanin icine gomulu
-- olan anon anahtariyla /rest/v1/rpc/... uzerinden dogrudan cagrilabiliyordu:
--
--   * get_campaign_audience('all')  -> 683 kullanicinin tamaminin user_id'si
--     anon olarak listelenebiliyordu (canli olarak dogrulandi).
--   * trigger_behavioral_push(user_id, template_key) -> hicbir korumasi yoktu;
--     yukaridaki id listesiyle birlestirildiginde herhangi biri TUM musterilere
--     marka adina sinirsiz push gonderebilirdi.
--   * get_user_campaign_uses(p_user_id) -> parametre olarak baskasinin id'si
--     verilebiliyordu (IDOR).
--
-- Cagiranlar: get_campaign_audience ve trigger_behavioral_push yalnizca sunucu
-- tarafindan (send-notification edge function, pg_cron, trigger'lar) cagriliyor;
-- bunlar service_role / fonksiyon sahibi baglaminda calistigi icin bu yetki
-- kaldirmasi islevi bozmaz. get_campaign_audience_count panelde (admin,
-- authenticated) kullanildigi icin authenticated'ta birakilip is_admin()
-- korumasi eklenmistir.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Yalnizca sunucu tarafindan cagrilanlar: tamamen kapat
revoke all on function public.trigger_behavioral_push(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_campaign_audience(text)              from public, anon, authenticated;
revoke all on function public.get_user_campaign_uses(uuid)             from public, anon, authenticated;

-- 2) Panelin kullandigi sayac: donus tipi korunur (integer), admin korumasi eklenir
create or replace function public.get_campaign_audience_count(p_target_type text)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_n integer;
begin
  if not public.is_admin() then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  select count(*)::integer into v_n from public.get_campaign_audience(p_target_type);
  return v_n;
end;
$$;

revoke all on function public.get_campaign_audience_count(text) from public, anon;
grant execute on function public.get_campaign_audience_count(text) to authenticated;

-- 3) Bu oturumda eklenen huni RPC'leri: is_admin() korumasi vardi ama varsayilan
--    PUBLIC yetkisi duruyordu; katmanli savunma icin anon kapatildi
revoke all on function public.boss_funnel(timestamptz, timestamptz) from public, anon;
grant execute on function public.boss_funnel(timestamptz, timestamptz) to authenticated;

revoke all on function public.boss_funnel_daily(timestamptz, timestamptz) from public, anon;
grant execute on function public.boss_funnel_daily(timestamptz, timestamptz) to authenticated;

revoke all on function public.boss_funnel_dropoffs(text, timestamptz, timestamptz, int) from public, anon;
grant execute on function public.boss_funnel_dropoffs(text, timestamptz, timestamptz, int) to authenticated;

revoke all on function public.boss_funnel_sessions(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.fn_push_cart_abandoned() from public, anon, authenticated;;
