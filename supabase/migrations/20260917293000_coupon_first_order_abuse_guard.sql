-- Hoş geldin kuponu kötüye kullanımı: aynı kişi farklı e-posta ile yeni hesap
-- açıp aynı telefon/adres/kart ile "ilk siparişe özel" kuponu tekrar tekrar
-- kullanabiliyordu (max_uses_per_user bunu YAKALAMAZ — o sadece AYNI hesabı
-- sınırlar). campaigns.first_order_only=true ise validate_coupon artık bu
-- kullanıcının telefonu/adresi/kart token'ı BAŞKA bir hesabın geçmiş
-- siparişinde görülmüşse kuponu reddediyor.
--
-- Kart eşleşmesi bugün pratikte devrede değil: saklı kart özelliği
-- admin_allowlist-only ve PaynKolay CARD_STORAGE yetkisi henüz yok, yani
-- user_card_secrets'ta gerçek kullanıcı verisi neredeyse hiç yok. Özellik
-- canlıya çıktığında bu kontrol otomatik olarak anlamlı hâle gelecek — o
-- ayrı, kapalı özelliğin kodu burada değiştirilmiyor, sadece tablosu OKUNUYOR.
alter table public.campaigns add column if not exists first_order_only boolean not null default false;

create or replace function public.validate_coupon(p_code text, p_cart_total numeric default 0)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  c public.campaigns%rowtype;
  v_is_targeted boolean;
  v_matches boolean;
  v_user_uses int;
  v_total_uses int;
  v_discount numeric;
  v_final numeric;
  v_phone text;
  v_dup_by_phone boolean := false;
  v_dup_by_address boolean := false;
  v_dup_by_card boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('valid', false, 'reason', 'auth_required');
  end if;

  select email into v_email from auth.users where id = v_uid;

  select * into c from public.campaigns
   where upper(code) = upper(trim(p_code))
   order by created_at desc limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if not c.is_active or c.status <> 'active' then
    return jsonb_build_object('valid', false, 'reason', 'inactive');
  end if;
  if c.start_date is not null and c.start_date > current_date then
    return jsonb_build_object('valid', false, 'reason', 'not_started');
  end if;
  if c.end_date is not null and c.end_date < current_date then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  -- Hedef kitle
  v_is_targeted := exists (select 1 from public.campaign_targets t where t.campaign_id = c.id)
                   or c.user_id is not null or c.user_email is not null;
  if v_is_targeted then
    v_matches :=
         (c.user_id is not null and c.user_id = v_uid)
      or (c.user_email is not null and lower(c.user_email) = lower(coalesce(v_email,'')))
      or exists (select 1 from public.campaign_targets t
                 where t.campaign_id = c.id
                   and (t.user_id = v_uid
                        or (t.user_email is not null and lower(t.user_email) = lower(coalesce(v_email,'')))));
    if not v_matches then
      return jsonb_build_object('valid', false, 'reason', 'not_yours');
    end if;
  end if;

  if p_cart_total < coalesce(c.min_cart_total, 0) then
    return jsonb_build_object('valid', false, 'reason', 'min_cart', 'min_cart_total', c.min_cart_total);
  end if;

  select count(*) into v_user_uses
    from public.campaign_uses where campaign_id = c.id and user_id = v_uid;
  if c.max_uses_per_user is not null and v_user_uses >= c.max_uses_per_user then
    return jsonb_build_object('valid', false, 'reason', 'user_limit_reached');
  end if;

  if c.max_uses_total is not null then
    select count(*) into v_total_uses from public.campaign_uses where campaign_id = c.id;
    if v_total_uses >= c.max_uses_total then
      return jsonb_build_object('valid', false, 'reason', 'total_limit_reached');
    end if;
  end if;

  -- YENİ: ilk-sipariş-özel kupon — telefon/adres/kart token'ı BAŞKA bir
  -- hesabın geçmiş siparişinde görülmüşse reddet (farklı e-posta ile yeni
  -- hesap açıp aynı kimlikle tekrar kullanmayı engeller).
  if c.first_order_only then
    select phone into v_phone from public.profiles where id = v_uid;

    if v_phone is not null and v_phone <> '' then
      select exists(
        select 1 from public.orders o
         where o.phone = v_phone and o.user_id is distinct from v_uid
      ) into v_dup_by_phone;
    end if;

    if not v_dup_by_phone then
      select exists(
        select 1
          from public.addresses a
          join public.orders o on o.address = a.full_address
         where a.user_id = v_uid
           and o.user_id is distinct from v_uid
      ) into v_dup_by_address;
    end if;

    if not v_dup_by_phone and not v_dup_by_address then
      select exists(
        select 1
          from public.user_card_secrets mine
          join public.user_cards mc on mc.id = mine.card_id and mc.user_id = v_uid
          join public.user_card_secrets others on others.card_token = mine.card_token
          join public.user_cards oc on oc.id = others.card_id and oc.user_id is distinct from v_uid
      ) into v_dup_by_card;
    end if;

    if v_dup_by_phone or v_dup_by_address or v_dup_by_card then
      return jsonb_build_object('valid', false, 'reason', 'first_order_only');
    end if;
  end if;

  -- İndirim hesabı
  if c.discount_type = 'percent' then
    v_discount := round(p_cart_total * c.discount_value / 100.0, 2);
    if c.max_discount is not null and c.max_discount > 0 and v_discount > c.max_discount then
      v_discount := c.max_discount;
    end if;
  elsif c.discount_type = 'sponsor' then
    v_final := coalesce(c.discount_value, 1);
    v_discount := round(p_cart_total - v_final, 2);
    if v_discount < 0 then v_discount := 0; end if;
  else
    v_discount := c.discount_value;
  end if;
  if v_discount > p_cart_total then v_discount := p_cart_total; end if;

  return jsonb_build_object(
    'valid', true,
    'campaign_id', c.id, 'code', c.code, 'title', c.title,
    'discount_type', c.discount_type, 'discount_value', c.discount_value,
    'discount_amount', v_discount,
    'final_total', round(p_cart_total - v_discount, 2),
    'remaining_uses_for_user',
      case when c.max_uses_per_user is null then null else c.max_uses_per_user - v_user_uses end
  );
end;
$function$;
