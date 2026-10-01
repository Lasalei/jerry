# Varelager

> Formerly **Draktlager**. The app, its icon and its texts are now product-neutral:
> the display name lives in one constant, `APP_NAME` in `src/lib/constants.ts`
> (the browser title, home-screen label and export file names all follow it).
> The GitHub repo and Vercel projects keep their old names.

Phone-first web app for tracking football jersey inventory and sales.

## Kom i gang (Phase 1 — local only)

```bash
npm install
npm run dev
```

Open the printed URL on your computer, or on your phone (same Wi-Fi) using the
**Network** URL Vite prints. Data is stored in the browser's `localStorage` on
that device — nothing leaves your machine yet (that's Phase 2).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — typecheck + production build into `dist/`
- `npm run preview` — preview the production build
- `npm run typecheck` — TypeScript check only

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- Fonts: Oswald (display) + Hanken Grotesk (body), accent **kit green** `#0B8457`

## Architecture

All persistence goes through **one module**: [`src/lib/db.ts`](src/lib/db.ts).
It exposes the async `DraktlagerDB` interface and a `db` singleton (currently the
localStorage implementation). Phase 2 swaps in a Supabase implementation of the
same interface — no other file changes.

```
src/
  lib/
    db.ts          ← persistence interface + localStorage impl (swap point)
    types.ts       ← domain model
    constants.ts   ← variants, sizes, channels, payments (Norwegian)
    format.ts      ← nb-NO currency/date formatting
    exporters.ts   ← JSON backup, sales CSV (semicolon), JSON import
    stats.ts       ← basic statistics
  components/      ← BottomNav, StylePicker, QtyStepper, StyleEditor, ui, Toast, Confirm
  screens/         ← NyttSalg, Lager, Logg, Mer
  store.tsx        ← React layer over db (state + actions + selectors)
  App.tsx          ← tab shell
```

## Domain model

- **Style** (product) = one team/design (e.g. "Liverpool 24/25"). Each product
  carries its **own** grid axes (`variants` = rows, `sizes` = columns), editable
  in the product editor; the workspace config only supplies the field names and
  the default values a new product starts with.
- **SKU** = style + variant + size → integer qty.
  - generic defaults — variants: Standard; sizes: XS, S, M, L, XL, XXL
    (the original jersey workspace used Hjemme/Borte × Fan/Player and S–3XL)
- **Transaction** = a sale (`salg`) or giveaway (`gitt_bort`). Saving decrements
  stock; deleting restores it. Each item snapshots `styleName` so history
  survives style deletion.

## Phase 2 — Supabase (shared live data)

The app runs local-only until you add Supabase env vars. With them set, both
phones share one live dataset.

### 1. Create the project
1. Sign up at [supabase.com](https://supabase.com) and create a free project.
2. Wait for it to finish provisioning.

### 2. Create the schema
1. In the dashboard go to **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and **Run**.
   This creates the 5 tables, the atomic RPCs (`create_transaction`,
   `delete_transaction`, `import_data`), the RLS policies, and enables Realtime.

> **Already have a database?** `schema.sql` is for a *fresh* project. An existing
> database is upgraded by running the numbered files in
> [`supabase/migrations/`](supabase/migrations/) that you haven't run yet, in
> order (each is idempotent — running one twice is harmless). Run a migration
> **before** deploying the app version that needs it.

### 3. Wire up the env vars
1. Dashboard → **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key.
2. In the project root: `cp .env.example .env`
3. Fill in:
   ```
   VITE_SUPABASE_URL=https://YOUR-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-anon-key
   VITE_APP_PASSCODE=          # optional shared passcode; leave blank to disable
   ```
4. Restart the dev server (`npm run dev`). The **Mer** tab footer should now show
   a green dot + "synkronisert live (Supabase)".

### How sync / offline work
- All persistence still goes through `db.ts`, which now picks the **Supabase**
  backend automatically when the env vars exist, else falls back to localStorage.
- Sales + stock changes go through Postgres RPCs so a sale and its stock
  decrement can never get out of sync.
- **Realtime**: each device subscribes to row changes on all four tables, so a
  sale logged on one phone appears on the other within ~1s.
- **Offline**: every successful load is cached to localStorage. If the network
  is down, the app serves the cached data read-only so you can still view stock
  and history. (Full offline editing comes with the PWA work in Phase 3.)

### Optional: migrate your Phase-1 data
If you already entered styles in local-only mode: open **Mer → Eksporter JSON**
*before* adding the env vars, then after switching to Supabase use
**Mer → Importer JSON** to push that data up.

## Phase 3 — PWA + deploy to Vercel

The app is now an installable PWA: it precaches its shell with a service worker
(via `vite-plugin-pwa` + Workbox), so it opens offline and can be added to your
home screen like a native app. A small banner offers "Oppdater" when a new
version is deployed.

> The service worker is **disabled during `npm run dev`** (to avoid stale-cache
> confusion) and only active in production / `npm run preview`. To test the PWA
> locally: `npm run build && npm run preview`.

### Deploy to Vercel

You need a [vercel.com](https://vercel.com) account (free). Pick **one** path.

#### Path A — Git + Vercel dashboard (recommended; auto-deploys on every push)

1. Put the project on GitHub:
   ```bash
   git init
   git add .
   git commit -m "Draktlager"
   # create an empty repo on github.com, then:
   git remote add origin https://github.com/YOU/draktlager.git
   git branch -M main
   git push -u origin main
   ```
   (`.env` is gitignored, so your keys stay private.)
2. On Vercel: **Add New → Project → Import** your GitHub repo. It auto-detects
   Vite (build `npm run build`, output `dist` — already pinned in `vercel.json`).
3. Before the first deploy, add the env vars (next section), then **Deploy**.
4. Every `git push` to `main` now redeploys automatically.

#### Path B — Vercel CLI (no GitHub needed)

```bash
npm i -g vercel       # one-time
vercel                # first run: links/creates the project, follow prompts
vercel --prod         # deploy to the production URL
```

### Set the environment variables on Vercel

Your local `.env` is **not** uploaded. Add the same keys in Vercel:

- Dashboard: **Project → Settings → Environment Variables**, or
- CLI: `vercel env add VITE_SUPABASE_URL` (repeat for each), then redeploy.

Add these for the **Production** (and Preview) environment:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://pidfzknulxjcslgmxilp.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your `eyJ…` anon key |
| `VITE_APP_PASSCODE` | optional shared passcode (or leave unset) |

After setting them, trigger a redeploy (push a commit, or `vercel --prod`, or
"Redeploy" in the dashboard) so they're baked into the build.

> No Supabase config change is needed — the anon key already permits browser
> access from any origin, so your Vercel URL works immediately.

### Add to Home Screen — iPhone (Safari)

1. Open your Vercel URL (e.g. `https://pmoney-peach.vercel.app`) in **Safari**
   (must be Safari, not Chrome, for iOS install).
2. Tap the **Share** button (square with an up-arrow, bottom centre).
3. Scroll down and tap **"Legg til på Hjem-skjerm" / "Add to Home Screen"**.
4. The name **Varelager** and the green box icon appear — tap **Legg til / Add**.
   (Already installed? Remove the old icon and add it again to pick up a new name/icon — iOS doesn't refresh them.)
5. Launch it from the home-screen icon: it opens full-screen with no Safari
   chrome, like a native app, and works offline for viewing.

Repeat on your brother's phone. Both installs talk to the same Supabase data, so
sales and stock stay in sync live.

### Add to Home Screen — Android (Chrome)

Open the URL in Chrome → menu (⋮) → **"Install app" / "Legg til på startskjerm"**.
Chrome usually also shows an automatic install prompt.

## Configurable product fields (Innstillinger)

The product model is configurable per workspace via **Mer → Innstillinger**:
- **Product label** — what one product is called (e.g. "Stil" for jerseys,
  "Produkt" for clothes).
- **Field 1** (required) + **Field 2** (optional toggle) — each a **name** plus a
  list of **default values**. Jerseys use Variant × Størrelse; another seller
  might use Farge × Størrelse, or just "Kategori".

The whole app (sale form, stock grid, log, stats, CSV) follows the config. A
brand-new workspace starts with a generic Produkt × Variant × Størrelse setup;
an existing workspace keeps whatever it has saved. Keep the product label to one
short word — it is dropped into sentences like «+ Ny produkt» and «Navn på
produkt».

### Per-product values (since migration 005)

The values in Innstillinger are only **defaults for new products**. Every product
owns its own rows and columns, edited right in the product editor
(**Lager → + Ny … / Rediger**): each field shows its values as chips with a
**Legg til** box, so "Nike svart t-skjorte" can have XS, S, M, L, XL while
"Nike Air Max" has 40–46, and a new colour can be added to one product without
touching the others.

- New values go to the end of the list, except that a list where *every* value
  looks like a size (XS–6XL in any case, or numbers like 42 / 42,5) is kept in
  size order automatically, so adding XS to S–XL puts it first.
- Removing a value that still holds stock asks for confirmation; the stock under
  it is deleted when you save.
- Stock that exists under a value not in the product's list (e.g. restored by
  deleting a sale) is shown anyway, so the grid always matches the total.
- Changing the defaults in Innstillinger never touches existing products.
  Switching Field 2 on/off does affect them (stock was saved with/without a
  second value) and asks for confirmation.
- Products created before migration 005 use the workspace defaults until they are
  edited once. The migration backfills them with the current defaults, which is
  exactly the grid they showed before.

## Lage en egen kopi for en annen selger (separate workspace)

To let another person use the app for **their own products with their own data**
— fully isolated from yours — give them a separate copy. Two databases, zero
shared data.

1. **New Supabase project:** they create a free project at supabase.com, then run
   the entire [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor
   (it now includes the `app_config` table + a default config row).
2. **New Vercel project:** in Vercel, **Add New → Project → Import** the *same*
   GitHub repo, but set that project's own env vars to the new Supabase
   project's `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (and its own
   `VITE_APP_PASSCODE`). Deploy → they get their own URL.
3. **Configure fields:** they open **Mer → Innstillinger** and set their product
   label + fields (e.g. Produkt / Kategori / Tilstand).

Your existing project and data are never touched by any of this. Repeat per group.

## Phases

- **Phase 1 — done:** local-only, all four screens working, localStorage behind `db.ts`.
- **Phase 2 — done:** Supabase schema + client + realtime, localStorage offline fallback, optional passcode.
- **Phase 3 — done:** installable PWA (offline viewing, home-screen icon, update prompt) + Vercel deploy config.
- **Later additions:** shipping/Ordre page, per-product photos, **configurable product fields** + separate-copy support for other sellers, **per-product values** (each product owns its rows/columns; migration 005).
