alter table public.categories
  add column if not exists img text,
  add column if not exists emoji text;
