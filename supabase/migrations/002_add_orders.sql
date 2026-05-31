-- Migration: add fulfillment fields (pickup_date + sent) for the Ordre page.
-- Run this in the Supabase SQL editor if you already ran 001_add_shipping.sql.
-- (schema.sql itself is now updated for fresh installs.) Idempotent + safe.

-- 1. New columns.
alter table transactions
  add column if not exists pickup_date date,
  add column if not exists sent        boolean not null default false;

-- 2. Replace create_transaction with the pickup-date-aware signature.
--    (Drop the previous 10-arg version first; Postgres keys functions by signature.)
drop function if exists create_transaction(date, text, text, text, text, text, text, text, numeric, jsonb);

create or replace function create_transaction(
  p_date          date,
  p_type          text,
  p_buyer         text,
  p_channel       text,
  p_payment       text,
  p_carrier       text,
  p_tracking_code text,
  p_pickup_date   date,
  p_note          text,
  p_total         numeric,
  p_items         jsonb
) returns uuid
language plpgsql
as $$
declare
  v_tx_id uuid;
  v_item  jsonb;
  v_style uuid;
begin
  insert into transactions (date, type, buyer, channel, payment, carrier, tracking_code, pickup_date, note, total)
  values (p_date, p_type, p_buyer, p_channel, p_payment, p_carrier, coalesce(p_tracking_code, ''), p_pickup_date, p_note, p_total)
  returning id into v_tx_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_style := nullif(v_item->>'styleId', '')::uuid;

    insert into transaction_items
      (transaction_id, style_id, style_name, variant, size, qty, price)
    values (
      v_tx_id,
      v_style,
      v_item->>'styleName',
      v_item->>'variant',
      v_item->>'size',
      (v_item->>'qty')::int,
      (v_item->>'price')::numeric
    );

    if v_style is not null then
      update stock
        set qty = greatest(0, qty - (v_item->>'qty')::int)
        where style_id = v_style
          and variant = v_item->>'variant'
          and size    = v_item->>'size';
    end if;
  end loop;

  return v_tx_id;
end;
$$;

-- 3. Replace import_data so JSON imports carry pickupDate + sent.
create or replace function import_data(payload jsonb)
returns void
language plpgsql
as $$
begin
  delete from transactions; -- items cascade
  delete from styles;       -- stock cascades

  insert into styles (id, name, created_at)
  select (s->>'id')::uuid,
         s->>'name',
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
