-- Migration 005: per-product grid axes.
--
-- Each product (styles row) now carries its OWN ordered list of field1 values
-- (rows) and field2 values (columns), so "Nike svart t-skjorte" can have XS–XL
-- while another product has 40–46. The app_config values become defaults that
-- pre-fill a new product.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query). Idempotent:
-- safe to run twice. Also (re)applies migration 004 in case it was skipped, since
-- the backfill below reads app_config.

-- ---------------------------------------------------------------------------
-- 0. Safety net: migration 004 (app_config) — no-ops if already applied.
-- ---------------------------------------------------------------------------

create table if not exists app_config (
  id             text primary key default 'singleton',
  product_label  text not null default 'Stil',
  fields         jsonb not null
);

alter table app_config enable row level security;
drop policy if exists anon_all on app_config;
create policy anon_all on app_config
  for all to anon, authenticated using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_config'
  ) then
    alter publication supabase_realtime add table app_config;
  end if;
end $$;

insert into app_config (id, product_label, fields)
values (
  'singleton',
  'Stil',
  '{"field1":{"name":"Variant","values":["Hjemme – Fan","Hjemme – Player","Borte – Fan","Borte – Player"]},"field2":{"name":"Størrelse","values":["S","M","L","XL","XXL","3XL"]}}'::jsonb
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 1. The new column.
-- ---------------------------------------------------------------------------

alter table styles add column if not exists axes jsonb;

-- ---------------------------------------------------------------------------
-- 2. Backfill: every existing product gets the workspace's current values, which
--    is exactly the grid it was displaying before this migration.
-- ---------------------------------------------------------------------------

update styles
set axes = jsonb_build_object(
  'variants', coalesce((select fields->'field1'->'values' from app_config where id = 'singleton'), '[]'::jsonb),
  'sizes',    coalesce((select fields->'field2'->'values' from app_config where id = 'singleton'), '[]'::jsonb)
)
where axes is null;

-- ---------------------------------------------------------------------------
-- 3. JSON import must carry the axes too (replaces the 003 version).
-- ---------------------------------------------------------------------------

create or replace function import_data(payload jsonb)
returns void
language plpgsql
as $$
begin
  delete from transactions; -- items cascade
  delete from styles;       -- stock cascades

  insert into styles (id, name, image_url, axes, created_at)
  select (s->>'id')::uuid,
         s->>'name',
         nullif(s->>'imageUrl', ''),
         jsonb_build_object(
           'variants', coalesce(s->'variants', '[]'::jsonb),
           'sizes',    coalesce(s->'sizes',    '[]'::jsonb)
         ),
         coalesce((s->>'created_at')::timestamptz, now())
  from jsonb_array_elements(payload->'styles') s;

  insert into stock (id, style_id, variant, size, qty)
  select (u->>'id')::uuid,
         (u->>'style_id')::uuid,
         u->>'variant',
         u->>'size',
         (u->>'qty')::int
  from jsonb_array_elements(payload->'stock') u;

  insert into transactions (id, date, type, buyer, channel, payment, carrier, tracking_code, pickup_date, sent, note, total, created_at)
  select (t->>'id')::uuid,
         (t->>'date')::date,
         t->>'type',
         coalesce(t->>'buyer', ''),
         t->>'channel',
         nullif(t->>'payment', ''),
         nullif(t->>'carrier', ''),
         coalesce(t->>'trackingCode', ''),
         nullif(t->>'pickupDate', '')::date,
         coalesce((t->>'sent')::boolean, false),
         coalesce(t->>'note', ''),
         coalesce((t->>'total')::numeric, 0),
         coalesce((t->>'created_at')::timestamptz, now())
  from jsonb_array_elements(payload->'transactions') t;

  insert into transaction_items (transaction_id, style_id, style_name, variant, size, qty, price)
  select (t->>'id')::uuid,
         nullif(it->>'styleId', '')::uuid,
         it->>'styleName',
         it->>'variant',
         it->>'size',
         (it->>'qty')::int,
         coalesce((it->>'price')::numeric, 0)
  from jsonb_array_elements(payload->'transactions') t,
       jsonb_array_elements(t->'items') it;
end;
$$;

-- Done. Verify: select id, name, axes from styles limit 5;
