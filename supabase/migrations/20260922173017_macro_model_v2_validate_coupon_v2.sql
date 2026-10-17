create or replace function public.validate_coupon_v2(
  p_code text,
  p_cart_total numeric default 0,
  p_phone text default null,
  p_items jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r          jsonb;
  c          public.campaigns%rowtype;
  v_discount numeric;
begin
  r := public.validate_coupon(p_code, p_cart_total, p_phone);

  if coalesce((r->>'valid')::boolean, false) is not true then
    return r;
  end if;
  if coalesce(r->>'discount_type', '') <> 'free_item' then
    return r;
  end if;

  select * into c from public.campaigns where id = (r->>'campaign_id')::uuid;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('valid', false, 'reason', 'items_required');
  end if;

  select max(x.price) into v_discount
    from jsonb_to_recordset(p_items) as x(category text, price numeric, quantity int)
   where coalesce(x.price, 0) > 0
     and (c.excluded_categories is null
          or coalesce(x.category, '') <> all (c.excluded_categories));

  if v_discount is null then
    return jsonb_build_object('valid', false, 'reason', 'no_eligible_item');
  end if;

  if c.max_discount is not null and c.max_discount > 0 and v_discount > c.max_discount then
    v_discount := c.max_discount;
  end if;
  v_discount := round(v_discount, 2);
  if v_discount > p_cart_total then v_discount := p_cart_total; end if;

  return jsonb_set(
           jsonb_set(r, '{discount_amount}', to_jsonb(v_discount)),
           '{final_total}', to_jsonb(round(p_cart_total - v_discount, 2))
         );
end;
$function$;

grant execute on function public.validate_coupon_v2(text, numeric, text, jsonb) to authenticated, anon;;
