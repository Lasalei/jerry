-- Migration: add an optional photo (image_url) to styles.
-- Run this in the Supabase SQL editor. Idempotent + safe (empty/existing data).

-- 1. New column — stores a downscaled image as a data URL.
alter table styles
  add column if not exists image_url text;

-- 2. Update import_data so JSON imports carry the style photo.
create or replace function import_data(payload jsonb)
returns void
language plpgsql
as $$
begin
  delete from transactions; -- items cascade
  delete from styles;       -- stock cascades

  insert into styles (id, name, image_url, created_at)
  select (s->>'id')::uuid,
         s->>'name',
         nullif(s->>'imageUrl', ''),
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
