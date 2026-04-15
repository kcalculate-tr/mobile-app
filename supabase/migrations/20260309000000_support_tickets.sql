create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  user_email text not null,
  order_code text,
  subject text not null,
  message text not null,
  admin_reply text,
  status text not null default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table support_tickets enable row level security;

create policy "users can insert own tickets"
  on support_tickets for insert
  with check (auth.uid() = user_id);

create policy "users can select own tickets"
  on support_tickets for select
  using (auth.uid() = user_id);
