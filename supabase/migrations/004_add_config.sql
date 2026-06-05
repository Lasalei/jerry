-- Migration: add the app_config table (configurable product label + 1–2 axes).
-- Run this in the Supabase SQL editor. Idempotent + safe; no RPC signature change.
-- The app falls back to the built-in jersey default until this runs, so there is
-- no hard breakage if the deploy lands first.

-- 1. Config table — single row keyed by a fixed id.
create table if not exists app_config (
  id             text primary key default 'singleton',
  product_label  text not null default 'Stil',
  fields         jsonb not null
);

-- 2. RLS — same permissive anon policy as the other tables.
alter table app_config enable row level security;
drop policy if exists anon_all on app_config;
create policy anon_all on app_config
  for all to anon, authenticated using (true) with check (true);

-- 3. Realtime so a config change syncs to the other phone live.
alter publication supabase_realtime add table app_config;

-- 4. Seed the default config (the existing jersey setup) if no row exists yet.
insert into app_config (id, product_label, fields)
values (
  'singleton',
  'Stil',
  '{"field1":{"name":"Variant","values":["Hjemme – Fan","Hjemme – Player","Borte – Fan","Borte – Player"]},"field2":{"name":"Størrelse","values":["S","M","L","XL","XXL","3XL"]}}'::jsonb
)
on conflict (id) do nothing;
