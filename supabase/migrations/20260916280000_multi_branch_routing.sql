-- FAZ B: Çok-şube (multi-branch) altyapısı — Bayraklı şubesi.
-- Sipariş şube ataması artık SUNUCU tarafında (BEFORE INSERT/UPDATE trigger)
-- yapılır; istemcinin gönderdiği branch_id (mobil DEFAULT_BRANCH_ID dahil)
-- her zaman yok sayılır/ezilir.

-- ── 1) branches: eksik kolonlar + isim düzeltme + Bayraklı + eksik yazma RLS'i ──
alter table public.branches
  add column if not exists is_active boolean not null default true,
  add column if not exists is_default boolean not null default false,
  -- İleride şubeye özel Adisyo kimlik bilgisi eşlemesi için (şimdilik hep NULL —
  -- Adisyo tek hesap; kod bu alanı okuyup boşsa global secret'lara düşecek).
  add column if not exists adisyo_config jsonb;

update public.branches
  set name = 'Karabağlar (Basın Sitesi)', is_default = true
  where id = 'aa8ef65d-a9aa-42fb-bc55-016ba2249dbd';

-- Tek "varsayılan" şube garantisi (birden fazla satır is_default=true olamaz).
create unique index if not exists branches_one_default_idx
  on public.branches (is_default) where is_default;

insert into public.branches (name, address, slug, is_active)
select 'Bayraklı', 'Bayraklı, İzmir', 'bayrakli', true
where not exists (select 1 from public.branches where slug = 'bayrakli');

-- KEŞİF NOTU: branches'te RLS açıktı ama yalnızca "public read" politikası vardı —
-- INSERT/UPDATE/DELETE için HİÇ politika yoktu (Boss panelin "Yeni Şube Ekle" /
-- "Düzenle" / "Sil" butonları muhtemelen hep RLS hatasıyla başarısız oluyordu,
-- tek şube hep migration/service-role ile eklendiği için fark edilmemiş). Ekleniyor.
drop policy if exists "branches_insert_admin" on public.branches;
create policy "branches_insert_admin" on public.branches
  for insert
  with check (exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()));

drop policy if exists "branches_update_admin" on public.branches;
create policy "branches_update_admin" on public.branches
  for update
  using (exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()));

drop policy if exists "branches_delete_admin" on public.branches;
create policy "branches_delete_admin" on public.branches
  for delete
  using (exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()));

-- ── 2) branch_service_areas: hangi (il/ilçe/mahalle) hangi şubeye ait ────────
-- delivery_zones'un YERİNE değil YANINA: delivery_zones "burada teslimat var mı,
-- hangi şartla" sorusunu; bu tablo "varsa hangi şube hazırlıyor" sorusunu cevaplar.
-- Aynı (city,district) sözlüğünü kullanır (Boss panel dropdown'ı delivery_zones'un
-- AKTİF kayıtlarından beslenir — serbest metin YOK).
create table if not exists public.branch_service_areas (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  city text not null default 'İzmir',
  district text not null,
  neighborhood text, -- NULL = mahalle ayrımı yok, TÜM ilçe bu şubeye ait
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists branch_service_areas_lookup_idx
  on public.branch_service_areas (city, district, neighborhood)
  where is_active;
create index if not exists branch_service_areas_branch_idx
  on public.branch_service_areas (branch_id);

-- S4 NOTU (ileride poligon): burada bir `boundary jsonb` (GeoJSON) veya
-- `boundary geography(Polygon,4326)` kolonu ALTER TABLE ile eklenebilir; çözüm
-- fonksiyonu (aşağıda fn_resolve_branch_for_order) önce poligonu, bulamazsa
-- district/neighborhood eşlemesini deneyecek şekilde genişletilir — mevcut
-- satırlar/eşleme mantığı bozulmaz.

alter table public.branch_service_areas enable row level security;

drop policy if exists "branch_service_areas_select_admin" on public.branch_service_areas;
create policy "branch_service_areas_select_admin" on public.branch_service_areas
  for select
  using (exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()));

drop policy if exists "branch_service_areas_insert_admin" on public.branch_service_areas;
create policy "branch_service_areas_insert_admin" on public.branch_service_areas
  for insert
  with check (exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()));

drop policy if exists "branch_service_areas_update_admin" on public.branch_service_areas;
create policy "branch_service_areas_update_admin" on public.branch_service_areas
  for update
  using (exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()));

drop policy if exists "branch_service_areas_delete_admin" on public.branch_service_areas;
create policy "branch_service_areas_delete_admin" on public.branch_service_areas
  for delete
  using (exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()));

-- ── 3) orders: neighbourhood (district/city ile AYNI denormalize desen) ──────
alter table public.orders
  add column if not exists neighbourhood text;

-- ── 4) branch_assignment_log: audit — otomatik VE manuel şube değişiklikleri ──
create table if not exists public.branch_assignment_log (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders(id) on delete cascade,
  from_branch_id uuid references public.branches(id),
  to_branch_id uuid references public.branches(id),
  -- 'auto_initial' | 'auto_reassign' | 'manual'
  reason text not null,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists branch_assignment_log_order_idx
  on public.branch_assignment_log (order_id);

alter table public.branch_assignment_log enable row level security;

drop policy if exists "branch_assignment_log_select_admin" on public.branch_assignment_log;
create policy "branch_assignment_log_select_admin" on public.branch_assignment_log
  for select
  using (exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()));

-- INSERT: service_role (trigger, RLS bypass) + admin panel manuel "şube değiştir"
-- (admin_allowlist). Update/delete YOK — audit trail asla değiştirilmez/silinmez.
drop policy if exists "branch_assignment_log_insert_admin" on public.branch_assignment_log;
create policy "branch_assignment_log_insert_admin" on public.branch_assignment_log
  for insert
  with check (exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()));

-- ── 5) fn_resolve_branch_for_order: (district, neighbourhood) -> branch_id ───
-- SECURITY DEFINER: sipariş veren müşteri branch_service_areas'ı RLS'ten dolayı
-- okuyamaz — bu fonksiyon RLS'i güvenli biçimde bypass eder (yalnızca OKUMA,
-- yalnızca kendi mantığı içinde kullanılır, dışarıya veri sızdırmaz).
create or replace function public.fn_resolve_branch_for_order(
  p_district text,
  p_neighbourhood text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_district text := trim(coalesce(p_district, ''));
  v_neighbourhood text := trim(coalesce(p_neighbourhood, ''));
  v_branch_id uuid;
  v_branch_active boolean;
  v_default_branch_id uuid;
begin
  select id into v_default_branch_id from public.branches where is_default limit 1;

  if v_district = '' then
    return v_default_branch_id;
  end if;

  -- Mahalle-spesifik eşleşme ÖNCE (daha spesifik), sonra ilçe-geneli
  -- (neighborhood IS NULL = tüm ilçe o şubeye ait). Aynı ilçe/mahalle birden
  -- fazla şubede aktifse priority yüksek olan kazanır (Boss panel bu çakışmayı
  -- ayrıca uyarı olarak gösterir — burada sadece kazanan seçilir).
  select bsa.branch_id, b.is_active
    into v_branch_id, v_branch_active
    from public.branch_service_areas bsa
    join public.branches b on b.id = bsa.branch_id
   where bsa.is_active
     and lower(trim(bsa.district)) = lower(v_district)
     and (
       bsa.neighborhood is null
       or (v_neighbourhood <> '' and lower(trim(bsa.neighborhood)) = lower(v_neighbourhood))
     )
   order by
     (bsa.neighborhood is not null) desc,
     bsa.priority desc,
     bsa.created_at asc
   limit 1;

  if v_branch_id is null then
    return v_default_branch_id; -- eşleşme yok -> varsayılan şube
  end if;

  if not v_branch_active then
    -- Şube pasif -> varsayılana düş. İLERİDE: burada "şu an açık mı" (çalışma
    -- saati) kontrolü de eklenecek — v_branch_active'i "sube musait mi" olarak
    -- genişletmek yeterli, akışın gerisi değişmeyecek.
    return v_default_branch_id;
  end if;

  return v_branch_id;
end;
$$;

-- ── 6) fn_assign_order_branch: BEFORE INSERT/UPDATE trigger fonksiyonu ───────
-- HER ZAMAN sunucu hesabını NEW.branch_id'ye yazar — istemcinin gönderdiği
-- (mobil DEFAULT_BRANCH_ID dahil) değer koşulsuz yok sayılır/ezilir.
create or replace function public.fn_assign_order_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resolved uuid;
begin
  v_resolved := public.fn_resolve_branch_for_order(NEW.district, NEW.neighbourhood);

  if TG_OP = 'INSERT' then
    NEW.branch_id := v_resolved;
    insert into public.branch_assignment_log (order_id, from_branch_id, to_branch_id, reason)
      values (NEW.id, null, v_resolved, 'auto_initial');
  else
    NEW.branch_id := v_resolved;
    if v_resolved is distinct from OLD.branch_id then
      insert into public.branch_assignment_log (order_id, from_branch_id, to_branch_id, reason)
        values (NEW.id, OLD.branch_id, v_resolved, 'auto_reassign');
    end if;
  end if;

  return NEW;
end;
$$;

-- Trigger isimleri KASITLI: "trg_orders_assign_branch_*" alfabetik olarak
-- "trg_orders_guard_insert" / "trg_orders_guard_protected_cols"'tan ÖNCE gelir
-- (a < g) — yani branch_id bu trigger'larda kontrol edilmeden ÖNCE zaten doğru
-- sunucu değerine sahip olur.
drop trigger if exists trg_orders_assign_branch_insert on public.orders;
create trigger trg_orders_assign_branch_insert
  before insert on public.orders
  for each row execute function public.fn_assign_order_branch();

drop trigger if exists trg_orders_assign_branch_update on public.orders;
create trigger trg_orders_assign_branch_update
  before update on public.orders
  for each row execute function public.fn_assign_order_branch();

-- ── 7) orders_guard_protected_cols: branch_id koruması ───────────────────────
-- NAIF "OLD != NEW ise reddet" YAZILMADI — bu, adres değişince meşru şube
-- değişimini de bloklardı (assign trigger ZATEN her seferinde doğru değeri
-- yazıyor). Bunun yerine: NEW.branch_id, resolver'ın AYNI district/neighbourhood
-- için üreteceği değere uymuyorsa reddet — meşru (resolver'ın kendi ürettiği)
-- değişiklikler her zaman geçer, resolver'ı atlayan/farklı bir değer asla geçmez.
create or replace function public.orders_guard_protected_cols()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_role   text := case when v_claims is null or v_claims = '' then null
                        else (v_claims::jsonb ->> 'role') end;
  v_priv   boolean;
begin
  if v_role is null or v_role = 'service_role' then
    return NEW;
  end if;

  v_priv := exists (select 1 from admin_allowlist a where a.user_id = auth.uid())
         or exists (select 1 from branch_users b where b.user_id = auth.uid());
  if v_priv then
    return NEW;
  end if;

  if NEW.payment_status = 'paid' and OLD.payment_status is distinct from 'paid' then
    raise exception 'orders_guard: payment_status=paid yalnızca sunucudan set edilebilir';
  end if;

  if NEW.status in ('confirmed','preparing','on_way','delivered')
     and OLD.status is distinct from NEW.status then
    raise exception 'orders_guard: "%" durumu yalnızca sunucudan/yönetimden set edilebilir', NEW.status;
  end if;

  if NEW.total_amount is distinct from OLD.total_amount
     or NEW.discount_amount is distinct from OLD.discount_amount
     or NEW.subtotal_amount is distinct from OLD.subtotal_amount
     or NEW.delivery_fee is distinct from OLD.delivery_fee
     or NEW.macro_discount_amount is distinct from OLD.macro_discount_amount then
    raise exception 'orders_guard: tutar alanları müşteri tarafından değiştirilemez';
  end if;

  if NEW.coupon_code is distinct from OLD.coupon_code
     or NEW.coupon_id is distinct from OLD.coupon_id then
    raise exception 'orders_guard: kupon alanları müşteri tarafından değiştirilemez';
  end if;

  if NEW.items is distinct from OLD.items then
    raise exception 'orders_guard: sipariş içeriği (items) müşteri tarafından değiştirilemez';
  end if;

  if NEW.adisyo_order_id is distinct from OLD.adisyo_order_id
     or NEW.adisyo_sync_status is distinct from OLD.adisyo_sync_status then
    raise exception 'orders_guard: adisyo alanları müşteri tarafından değiştirilemez';
  end if;

  -- YENİ: branch_id sadece resolver'ın (district/neighbourhood'a göre) ürettiği
  -- değere eşitse geçer — assign trigger'ı atlayan/farklı bir değer asla geçmez.
  if NEW.branch_id is distinct from OLD.branch_id
     and NEW.branch_id is distinct from public.fn_resolve_branch_for_order(NEW.district, NEW.neighbourhood) then
    raise exception 'orders_guard: branch_id yalnızca sunucu tarafından (adres bazlı) atanabilir';
  end if;

  return NEW;
end;
$$;
