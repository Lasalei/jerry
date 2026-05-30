-- Draktlager — Supabase schema (Phase 2)
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Single shared workspace, no per-user auth. The anon key is public, so this
-- grants the anon role full access; optionally gate the app with VITE_APP_PASSCODE.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists styles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists stock (
  id        uuid primary key default gen_random_uuid(),
  style_id  uuid not null references styles(id) on delete cascade,
  variant   text not null,
  size      text not null,
  qty       integer not null default 0 check (qty >= 0),
  unique (style_id, variant, size)
);

create table if not exists transactions (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  type        text not null check (type in ('salg', 'gitt_bort')),
  buyer       text not null default '',
  channel     text not null,
  payment     text,
  note        text not null default '',
  total       numeric not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists transaction_items (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references transactions(id) on delete cascade,
  -- Keep history if the style is later deleted: null out the link, keep snapshot.
  style_id        uuid references styles(id) on delete set null,
  style_name      text not null,
  variant         text not null,
  size            text not null,
  qty             integer not null,
  price           numeric not null default 0
);

create index if not exists stock_style_idx on stock(style_id);
create index if not exists items_tx_idx on transaction_items(transaction_id);
create index if not exists tx_date_idx on transactions(date);

-- ---------------------------------------------------------------------------
-- RPC: create a transaction + decrement stock, atomically
-- ---------------------------------------------------------------------------

create or replace function create_transaction(
  p_date    date,
  p_type    text,
  p_buyer   text,
  p_channel text,
  p_payment text,
  p_note    text,
  p_total   numeric,
  p_items   jsonb
) returns uuid
language plpgsql
as $$
declare
  v_tx_id uuid;
  v_item  jsonb;
  v_style uuid;
begin
  insert into transactions (date, type, buyer, channel, payment, note, total)
  values (p_date, p_type, p_buyer, p_channel, p_payment, p_note, p_total)
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

-- ---------------------------------------------------------------------------
-- RPC: delete a transaction + restore stock, atomically
-- ---------------------------------------------------------------------------

create or replace function delete_transaction(p_tx_id uuid)
returns void
language plpgsql
as $$
declare
  v_item record;
begin
  for v_item in
    select style_id, variant, size, qty
    from transaction_items
    where transaction_id = p_tx_id
  loop
    if v_item.style_id is not null then
      -- Restore onto the SKU, recreating the row if it had been removed.
      insert into stock (style_id, variant, size, qty)
      values (v_item.style_id, v_item.variant, v_item.size, v_item.qty)
      on conflict (style_id, variant, size)
      do update set qty = stock.qty + excluded.qty;
    end if;
  end loop;

  delete from transactions where id = p_tx_id; -- items cascade
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: replace the whole dataset (JSON import)
-- ---------------------------------------------------------------------------

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

  insert into transactions (id, date, type, buyer, channel, payment, note, total, created_at)
  select (t->>'id')::uuid,
         (t->>'date')::date,
         t->>'type',
         coalesce(t->>'buyer', ''),
         t->>'channel',
         nullif(t->>'payment', ''),
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

-- ---------------------------------------------------------------------------
-- Row Level Security — single shared workspace: allow the anon role full access.
-- (Realtime respects RLS, so these permissive policies are required for live
--  updates to reach both phones.)
-- ---------------------------------------------------------------------------

alter table styles            enable row level security;
alter table stock             enable row level security;
alter table transactions      enable row level security;
alter table transaction_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['styles', 'stock', 'transactions', 'transaction_items']
  loop
    execute format('drop policy if exists anon_all on %I', t);
    execute format(
      'create policy anon_all on %I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime — broadcast row changes on all four tables to subscribed clients.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table styles;
alter publication supabase_realtime add table stock;
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table transaction_items;
