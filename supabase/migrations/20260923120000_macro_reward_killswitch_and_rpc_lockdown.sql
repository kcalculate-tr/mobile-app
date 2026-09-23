-- ─────────────────────────────────────────────────────────────────────────────
-- 1) ÜCRETSİZ ÖĞÜN KUPONU — GEÇİCİ EMNİYET ANAHTARI
-- ─────────────────────────────────────────────────────────────────────────────
-- Sepette ücretsiz öğün kuponu doğru hesaplanıyor (validate_coupon_v2), ancak
-- ödeme başlatma edge fonksiyonu (paynkolay-payment-init) tutarı YENİDEN
-- hesaplarken eski validate_coupon'u çağırıyor. O fonksiyon free_item tipini
-- bilmediği için indirimi 0 döndürüyor. Canlıda ölçüldü:
--     sepet  -> discount_amount = 495   ("bedava öğün")
--     ödeme  -> discount_amount = 0     (tam tutar çekilir)
-- Yani müşteri sepette bedava görür, kartından tam ücret çekilir ve kupon da
-- kullanılmış sayılır. Ödeme fonksiyonu validate_coupon_v2'ye geçirilene kadar
-- hiç ücretsiz öğün kuponu ÜRETİLMEMELİ.
--
-- Macro birikimi devam eder (zararsız); yalnızca kupona dönüştürme durur.
-- Ödeme tarafı düzeldiğinde: update settings set macro_rewards_enabled = true;
alter table public.settings
  add column if not exists macro_rewards_enabled boolean not null default false;

comment on column public.settings.macro_rewards_enabled is
  'false iken Macro birikir ama ücretsiz öğün kuponu üretilmez. Ödeme başlatma '
  'fonksiyonu validate_coupon_v2 kullanmaya başlayana kadar false kalmalı.';

-- grant_macros_on_delivery içinde kupon üretimi bu bayrağa bağlandı:
--     if coalesce(s.macro_rewards_enabled, false) then
--       v_coupon_count := floor(v_balance / greatest(s.macro_meal_cost, 1))::int;
--     else
--       v_coupon_count := 0;
--     end if;
-- (fonksiyonun tam gövdesi 20260922100000 + 20260922110000 migration'larında)

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Korumasız SECURITY DEFINER fonksiyonlarının REST erişimi kapatılıyor
-- ─────────────────────────────────────────────────────────────────────────────
-- trigger_behavioral_push: içeride vault'tan service_role anahtarını okuyup
-- send-notification'a POST atıyor ve HİÇBİR yetki kontrolü yok. anon rolüyle
-- /rest/v1/rpc/trigger_behavioral_push çağrılabildiği için, uygulama paketinin
-- içindeki anon anahtarına sahip herkes istediği kullanıcıya push
-- gönderebiliyordu. Veritabanı trigger'larından yapılan çağrılar bu revoke'tan
-- etkilenmez (onlar tanımlayıcı rolüyle çalışır).
revoke execute on function public.trigger_behavioral_push(uuid, text, jsonb) from anon, authenticated;

-- get_campaign_audience: yetki kontrolü yok; 'all' ile TÜM auth.users id'lerini
-- döndürüyor. Yönetim panelinde yalnızca _count sürümü kullanılıyor.
revoke execute on function public.get_campaign_audience(text) from anon;
revoke execute on function public.get_campaign_audience_count(text) from anon;

-- get_user_campaign_uses: yetki kontrolü yok; başkasının kupon kullanımını
-- p_user_id vererek okumak mümkündü. İstemci tarafında kullanılmıyor.
revoke execute on function public.get_user_campaign_uses(uuid) from anon, authenticated;
